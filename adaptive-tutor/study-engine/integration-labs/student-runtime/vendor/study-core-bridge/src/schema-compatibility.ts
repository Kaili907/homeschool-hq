import {
  STUDY_SCHEMA_VERSION,
  type CanonicalLearningEvidenceV1,
  type CanonicalValidationResult,
  type StudySchemaRegistryPort,
  type ValidationIssueV1,
} from "./contracts.ts";

export interface TutorCoreValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly value?: unknown;
}

export type TutorCoreValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly TutorCoreValidationIssue[] };

/**
 * Converts frozen Core's validation result to the bridge-safe result shape.
 * Core `issue.value` is intentionally discarded so invalid answers, names,
 * credentials, or transcript fragments cannot enter diagnostics.
 */
export function adaptTutorCoreValidationResult<T>(
  result: TutorCoreValidationResult<T>,
): CanonicalValidationResult<T> {
  if (result.ok) return { ok: true, value: result.value };
  const issues: ValidationIssueV1[] = result.issues.slice(0, 100).map((issue) => ({
    code: "format",
    path:
      typeof issue.path === "string" && issue.path.length <= 500
        ? issue.path || "$"
        : "$",
    message: "Tutor Core contract validation failed.",
  }));
  return {
    ok: false,
    error: "Tutor Core contract validation failed.",
    issues,
  };
}

export interface CanonicalStudyRegistryDependencies {
  readonly inspectContractVersion: (
    value: unknown,
  ) =>
    | { readonly status: "current" }
    | { readonly status: "missing-version" }
    | { readonly status: "unsupported-older-version" }
    | { readonly status: "unsupported-future-version" }
    | { readonly status: "invalid-version" };
  readonly learningEvidenceSchema: {
    readonly schemaVersion: 1;
    validate(
      value: unknown,
    ): CanonicalValidationResult<CanonicalLearningEvidenceV1>;
  };
}

/**
 * Injects Session 1's canonical registry without copying or modifying it.
 */
export function createStudySchemaRegistryPort(
  dependencies: CanonicalStudyRegistryDependencies,
): StudySchemaRegistryPort {
  if (dependencies.learningEvidenceSchema.schemaVersion !== STUDY_SCHEMA_VERSION) {
    throw new Error("Unsupported canonical Study schema registry version.");
  }
  return {
    schemaVersion: STUDY_SCHEMA_VERSION,
    inspectVersion(value) {
      return dependencies.inspectContractVersion(value).status;
    },
    validateLearningEvidence(value) {
      return dependencies.learningEvidenceSchema.validate(value);
    },
  };
}

export interface TutorProgramSemanticProbe {
  readonly id: string;
  readonly version: string;
  readonly targetSkillId: string;
  readonly gradeBand: { readonly min: number; readonly max: number };
  readonly diagnosticItems: readonly {
    readonly id: string;
    readonly skillId: string;
    readonly purpose: string;
  }[];
  readonly guidedPractice: {
    readonly items: readonly {
      readonly id: string;
      readonly skillId: string;
      readonly purpose: string;
    }[];
  };
  readonly independentMastery: {
    readonly items: readonly {
      readonly id: string;
      readonly skillId: string;
      readonly purpose: string;
    }[];
    readonly minimumEvidenceCount: number;
    readonly minimumDistinctContexts: number;
    readonly singleAnswerCanEstablishMastery: false;
  };
  readonly reassessmentItems: readonly {
    readonly id: string;
    readonly skillId: string;
    readonly purpose: string;
  }[];
}

export interface TutorProgramSemanticResult {
  readonly ok: boolean;
  readonly reasonCodes: readonly (
    | "grade-band-order"
    | "duplicate-item-id"
    | "item-skill-mismatch"
    | "item-purpose-mismatch"
    | "one-answer-mastery-risk"
    | "insufficient-context-requirement"
  )[];
}

/**
 * Additive bridge check for cross-field invariants not enforced by frozen
 * Core v0.2's structural schemas. It never rewrites the Tutor program.
 */
export function validateTutorProgramSemantics(
  program: TutorProgramSemanticProbe,
): TutorProgramSemanticResult {
  const reasons = new Set<TutorProgramSemanticResult["reasonCodes"][number]>();
  if (program.gradeBand.min > program.gradeBand.max) {
    reasons.add("grade-band-order");
  }
  const groups = [
    ["diagnostic", program.diagnosticItems] as const,
    ["guided-practice", program.guidedPractice.items] as const,
    ["independent-mastery", program.independentMastery.items] as const,
    ["reassessment", program.reassessmentItems] as const,
  ];
  const itemIds = new Set<string>();
  for (const [purpose, items] of groups) {
    for (const item of items) {
      if (itemIds.has(item.id)) reasons.add("duplicate-item-id");
      itemIds.add(item.id);
      if (item.skillId !== program.targetSkillId) {
        reasons.add("item-skill-mismatch");
      }
      if (item.purpose !== purpose) reasons.add("item-purpose-mismatch");
    }
  }
  if (
    program.independentMastery.singleAnswerCanEstablishMastery !== false ||
    program.independentMastery.minimumEvidenceCount < 3
  ) {
    reasons.add("one-answer-mastery-risk");
  }
  if (program.independentMastery.minimumDistinctContexts < 2) {
    reasons.add("insufficient-context-requirement");
  }
  return { ok: reasons.size === 0, reasonCodes: [...reasons] };
}

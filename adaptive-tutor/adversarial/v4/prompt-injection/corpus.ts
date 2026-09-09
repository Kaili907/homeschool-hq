import rawCorpus from "./corpus.json" with { type: "json" };

export const ATTACK_FAMILIES = [
  "override-study-allowed-actions",
  "declare-official-mastery",
  "change-working-level",
  "change-nominal-grade",
  "assign-curriculum",
  "clear-safety",
  "authorize-guardian-access",
  "request-hidden-answer-keys",
  "override-provider-privacy-policy",
  "bypass-grounding",
  "bypass-active-assessment",
  "request-unrestricted-tools",
  "claim-system-developer-authority",
  "encoded-authority-in-reviewed-content",
  "conflicting-instructions-in-grounding",
  "instruct-provider-ignore-schema",
  "smuggle-authority-through-fields",
] as const;

export const HARD_INVARIANTS = [
  "STUDY_ALLOWED_ACTIONS_EXACT",
  "OFFICIAL_MASTERY_STUDY_ONLY",
  "WORKING_LEVEL_EXACT",
  "NOMINAL_GRADE_EXACT",
  "CURRICULUM_ASSIGNMENT_EXACT",
  "SAFETY_CLEARANCE_STUDY_ONLY",
  "GUARDIAN_AUTHORITY_STUDY_ONLY",
  "ANSWER_AUTHORITY_NOT_EXPOSED",
  "PROVIDER_POLICY_EXACT",
  "GROUNDING_REQUIRED",
  "ACTIVE_ASSESSMENT_STATIC_ONLY",
  "NO_TOOL_AUTHORITY",
  "CONTENT_HAS_NO_ROLE_AUTHORITY",
  "REVIEWED_TEXT_NOT_AUTHORITY",
  "GROUNDING_REQUIREMENTS_EXACT",
  "PROVIDER_SCHEMA_CLOSED",
  "PRESENTATION_FIELDS_REFERENCE_ONLY",
  "PROVIDER_FIELDS_CANNOT_CARRY_AUTHORITY",
] as const;

export const SAFE_OUTCOMES = [
  "safe-advisory",
  "refusal",
  "reviewed-static-fallback",
  "schema-rejection",
] as const;

export type AttackFamily = (typeof ATTACK_FAMILIES)[number];
export type HardInvariant = (typeof HARD_INVARIANTS)[number];
export type SafeOutcome = (typeof SAFE_OUTCOMES)[number];
export type AttackSurface = "trusted-reviewed-context" | "untrusted-provider-response";
export type PathSegment = string | number;

export type AttackDelivery =
  | {
      readonly kind: "provider-response-mutation" | "active-assessment-provider-response";
      readonly path: readonly PathSegment[];
      readonly value: unknown;
    }
  | {
      readonly kind: "trusted-invocation-mutation";
      readonly path: readonly PathSegment[];
      readonly value: unknown;
    }
  | {
      readonly kind: "provider-response-replacement";
      readonly value: unknown;
    }
  | { readonly kind: "provider-response-unchanged" | "provider-refusal" };

export interface PromptInjectionCase {
  readonly caseId: string;
  readonly surface: AttackSurface;
  readonly family: AttackFamily;
  readonly carrier: string;
  readonly description: string;
  readonly marker: string;
  readonly payload: string;
  readonly delivery: AttackDelivery;
  readonly expectedOutcome: SafeOutcome;
  readonly hardInvariant: HardInvariant;
}

export type MutationControl =
  | {
      readonly mutationId: string;
      readonly targetCaseId: string;
      readonly kind: "set-advisory-field";
      readonly field: string;
      readonly value: unknown;
      readonly expectedDetector: string;
    }
  | {
      readonly mutationId: string;
      readonly targetCaseId: string;
      readonly kind: "change-authority-state";
      readonly field: string;
      readonly value: unknown;
      readonly expectedDetector: string;
    }
  | {
      readonly mutationId: string;
      readonly targetCaseId: string;
      readonly kind: "change-outcome";
      readonly value: SafeOutcome;
      readonly expectedDetector: string;
    }
  | {
      readonly mutationId: string;
      readonly targetCaseId: string;
      readonly kind: "reflect-payload";
      readonly expectedDetector: string;
    };

export interface PromptInjectionCorpus {
  readonly corpusVersion: "study-tutor-v2.wave4.prompt-injection.v1";
  readonly description: string;
  readonly cases: readonly PromptInjectionCase[];
  readonly mutationControls: readonly MutationControl[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function parsePath(value: unknown, label: string): readonly PathSegment[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some((segment) => typeof segment !== "string" && !Number.isInteger(segment))
  ) {
    throw new Error(`${label} must be a non-empty string/integer path`);
  }
  return Object.freeze([...value]) as readonly PathSegment[];
}

function parseDelivery(value: unknown, label: string): AttackDelivery {
  if (!isRecord(value) || typeof value.kind !== "string") {
    throw new Error(`${label} must be a delivery object`);
  }
  switch (value.kind) {
    case "provider-response-mutation":
    case "active-assessment-provider-response":
    case "trusted-invocation-mutation":
      return Object.freeze({
        kind: value.kind,
        path: parsePath(value.path, `${label}.path`),
        value: structuredClone(value.value),
      });
    case "provider-response-replacement":
      return Object.freeze({ kind: value.kind, value: structuredClone(value.value) });
    case "provider-response-unchanged":
    case "provider-refusal":
      return Object.freeze({ kind: value.kind });
    default:
      throw new Error(`${label}.kind is not supported`);
  }
}

function parseCase(value: unknown, index: number): PromptInjectionCase {
  const label = `cases[${index}]`;
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  if (
    typeof value.caseId !== "string"
    || !/^W4-PI-(?:TR|PR)-\d{3}$/.test(value.caseId)
    || !isMember(["trusted-reviewed-context", "untrusted-provider-response"] as const, value.surface)
    || !isMember(ATTACK_FAMILIES, value.family)
    || typeof value.carrier !== "string"
    || typeof value.description !== "string"
    || typeof value.marker !== "string"
    || !/^w4pi-(?:tr|pr)-\d{3}$/.test(value.marker)
    || typeof value.payload !== "string"
    || !value.payload.includes(value.marker)
    || !isMember(SAFE_OUTCOMES, value.expectedOutcome)
    || !isMember(HARD_INVARIANTS, value.hardInvariant)
  ) {
    throw new Error(`${label} contains an invalid required field`);
  }
  return Object.freeze({
    caseId: value.caseId,
    surface: value.surface,
    family: value.family,
    carrier: value.carrier,
    description: value.description,
    marker: value.marker,
    payload: value.payload,
    delivery: parseDelivery(value.delivery, `${label}.delivery`),
    expectedOutcome: value.expectedOutcome,
    hardInvariant: value.hardInvariant,
  });
}

function parseMutationControl(value: unknown, index: number): MutationControl {
  const label = `mutationControls[${index}]`;
  if (
    !isRecord(value)
    || typeof value.mutationId !== "string"
    || !/^W4-PI-MUT-\d{3}$/.test(value.mutationId)
    || typeof value.targetCaseId !== "string"
    || typeof value.expectedDetector !== "string"
  ) {
    throw new Error(`${label} contains an invalid required field`);
  }
  if (value.kind === "set-advisory-field" || value.kind === "change-authority-state") {
    if (typeof value.field !== "string") throw new Error(`${label}.field is required`);
    return Object.freeze({
      mutationId: value.mutationId,
      targetCaseId: value.targetCaseId,
      kind: value.kind,
      field: value.field,
      value: structuredClone(value.value),
      expectedDetector: value.expectedDetector,
    });
  }
  if (value.kind === "change-outcome") {
    if (!isMember(SAFE_OUTCOMES, value.value)) {
      throw new Error(`${label}.value must be a safe outcome`);
    }
    return Object.freeze({
      mutationId: value.mutationId,
      targetCaseId: value.targetCaseId,
      kind: value.kind,
      value: value.value,
      expectedDetector: value.expectedDetector,
    });
  }
  if (value.kind === "reflect-payload") {
    return Object.freeze({
      mutationId: value.mutationId,
      targetCaseId: value.targetCaseId,
      kind: value.kind,
      expectedDetector: value.expectedDetector,
    });
  }
  throw new Error(`${label}.kind is not supported`);
}

function unique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function parseCorpus(value: unknown): PromptInjectionCorpus {
  if (
    !isRecord(value)
    || value.corpusVersion !== "study-tutor-v2.wave4.prompt-injection.v1"
    || typeof value.description !== "string"
    || !Array.isArray(value.cases)
    || !Array.isArray(value.mutationControls)
  ) {
    throw new Error("prompt-injection corpus envelope is invalid");
  }
  const cases = value.cases.map(parseCase);
  const mutationControls = value.mutationControls.map(parseMutationControl);
  unique(cases.map((attack) => attack.caseId), "case IDs");
  unique(cases.map((attack) => attack.marker), "case markers");
  unique(mutationControls.map((mutation) => mutation.mutationId), "mutation IDs");
  const caseIds = new Set(cases.map((attack) => attack.caseId));
  if (mutationControls.some((mutation) => !caseIds.has(mutation.targetCaseId))) {
    throw new Error("every mutation control must target a corpus case");
  }
  const coveredFamilies = new Set(cases.map((attack) => attack.family));
  if (ATTACK_FAMILIES.some((family) => !coveredFamilies.has(family))) {
    throw new Error("corpus does not cover every required attack family");
  }
  for (const surface of ["trusted-reviewed-context", "untrusted-provider-response"] as const) {
    if (!cases.some((attack) => attack.surface === surface)) {
      throw new Error(`corpus does not cover ${surface}`);
    }
  }
  return Object.freeze({
    corpusVersion: value.corpusVersion,
    description: value.description,
    cases: Object.freeze(cases),
    mutationControls: Object.freeze(mutationControls),
  });
}

export const PROMPT_INJECTION_CORPUS = parseCorpus(rawCorpus);

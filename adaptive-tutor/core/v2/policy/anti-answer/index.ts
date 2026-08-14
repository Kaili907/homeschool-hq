import type {
  AssessmentPhase,
  HintLevel,
  TutorActionProposal,
  TutorInstructionContext,
} from "../../contracts/index.js";

export const ANSWER_POLICY_REJECTED = "ANSWER_POLICY_REJECTED" as const;

export interface CanonicalAssessmentPolicyContext {
  /** Trusted Study policy signal; never inferred from Tutor text. */
  readonly completedAssessmentReviewAllowed: boolean;
}

export interface AnswerPolicyIssue {
  readonly path: string;
  readonly code:
    | "active-assessment-answer-disclosure"
    | "answer-bearing-field"
    | "completed-review-not-authorized"
    | "hint-ceiling-exceeded";
}

export type AnswerPolicyDecision =
  | { readonly status: "allowed" }
  | {
      readonly status: "rejected";
      readonly code: typeof ANSWER_POLICY_REJECTED;
      readonly issues: readonly AnswerPolicyIssue[];
    };

interface TraversedValue {
  readonly path: string;
  readonly key: string | null;
  readonly value: unknown;
}

const ANSWER_BEARING_FIELDS = new Set([
  "answer",
  "answerkey",
  "correctanswer",
  "correctchoice",
  "correctoption",
  "finalanswer",
  "protectedanswer",
  "selectedanswer",
  "solution",
  "solutionkey",
]);

const OBVIOUS_ANSWER_DISCLOSURES: readonly RegExp[] = [
  /\b(?:the\s+)?(?:correct|final)\s+answer\s*(?:is|=|:)\s*\S+/i,
  /\banswer\s*(?:is|=|:)\s*\S+/i,
  /\b(?:correct|right)\s+(?:choice|option)\s*(?:is|=|:)\s*[A-Za-z0-9]+\b/i,
  /\b(?:choose|select|mark)\s+(?:choice|option)\s+[A-Za-z0-9]+\b/i,
  /\b(?:enter|respond\s+with|write)\s+["']?[^.?!\n]{1,80}["']?\s+(?:as\s+)?(?:the\s+)?answer\b/i,
  /\b(?:the\s+)?solution\s*(?:is|=|:)\s*\S+/i,
];

const HINT_ORDER: Readonly<Record<HintLevel, number>> = {
  none: 0,
  nudge: 1,
  "concept-cue": 2,
  "guided-step": 3,
};

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function traversePlainValues(root: unknown): readonly TraversedValue[] {
  const values: TraversedValue[] = [];
  const ancestors = new Set<object>();
  let nodes = 0;

  const visit = (value: unknown, path: string, key: string | null, depth: number): void => {
    nodes += 1;
    if (nodes > 10_000 || depth > 24) return;
    values.push({ path, key, value });
    if (value === null || typeof value !== "object" || ancestors.has(value)) return;

    const prototype = Object.getPrototypeOf(value);
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype) return;
      ancestors.add(value);
      const descriptors = Object.getOwnPropertyDescriptors(value);
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (descriptor && "value" in descriptor && !descriptor.get && !descriptor.set) {
          visit(descriptor.value, `${path}/${index}`, String(index), depth + 1);
        }
      }
      ancestors.delete(value);
      return;
    }

    if (prototype !== Object.prototype) return;
    ancestors.add(value);
    for (const [childKey, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
      if ("value" in descriptor && !descriptor.get && !descriptor.set) {
        visit(descriptor.value, `${path}/${childKey}`, childKey, depth + 1);
      }
    }
    ancestors.delete(value);
  };

  visit(root, "$", null, 0);
  return values;
}

/** Detects explicit answer-shaped fields before closed-schema validation. */
export function detectAnswerBearingFields(proposal: unknown): readonly AnswerPolicyIssue[] {
  const issues: AnswerPolicyIssue[] = [];
  for (const candidate of traversePlainValues(proposal)) {
    if (
      candidate.key !== null &&
      ANSWER_BEARING_FIELDS.has(normalizeFieldName(candidate.key))
    ) {
      issues.push({ path: candidate.path, code: "answer-bearing-field" });
    }
  }
  return issues;
}

function obviousDisclosureIssues(proposal: TutorActionProposal): readonly AnswerPolicyIssue[] {
  const strings: { readonly path: string; readonly value: string }[] = [];
  switch (proposal.action.kind) {
    case "explain":
    case "hint":
    case "show-example":
    case "reteach":
      strings.push({ path: "$/action/content", value: proposal.action.content });
      break;
    case "ask-check":
      strings.push({ path: "$/action/question", value: proposal.action.question });
      break;
    default:
      break;
  }
  return strings
    .filter(({ value }) => OBVIOUS_ANSWER_DISCLOSURES.some((pattern) => pattern.test(value)))
    .map(({ path }) => ({ path, code: "active-assessment-answer-disclosure" as const }));
}

function phaseRequiresAnswerProtection(phase: AssessmentPhase): boolean {
  return phase === "active-graded-or-mastery-check";
}

/**
 * Enforces phase and hint boundaries without receiving or storing an answer key.
 * Lexical disclosure checks are intentionally only a conservative first gate.
 */
export function evaluateAnswerPolicy(
  proposal: TutorActionProposal,
  instructionContext: TutorInstructionContext,
  assessmentPolicy: CanonicalAssessmentPolicyContext | undefined,
): AnswerPolicyDecision {
  const issues: AnswerPolicyIssue[] = [];

  if (
    instructionContext.assessmentPhase === "completed-assessment-review" &&
    assessmentPolicy?.completedAssessmentReviewAllowed !== true
  ) {
    issues.push({ path: "$/action", code: "completed-review-not-authorized" });
  }

  if (phaseRequiresAnswerProtection(instructionContext.assessmentPhase)) {
    issues.push(...obviousDisclosureIssues(proposal));
  }

  if (
    proposal.action.kind === "hint" &&
    HINT_ORDER[proposal.action.hintLevel] > HINT_ORDER[instructionContext.hintCeiling]
  ) {
    issues.push({ path: "$/action/hintLevel", code: "hint-ceiling-exceeded" });
  }

  return issues.length === 0
    ? { status: "allowed" }
    : { status: "rejected", code: ANSWER_POLICY_REJECTED, issues };
}

export const ANTI_ANSWER_POLICY_LIMITATIONS = [
  "Lexical checks catch explicit answer fields and obvious disclosures, not semantic equivalence.",
  "Paraphrased, encoded, multilingual, or multi-turn disclosures require adversarial evaluation.",
  "Grounding membership does not prove that generated prose is non-isomorphic to the protected item.",
  "The policy intentionally receives no protected answer key; server-side answer authority remains separate.",
] as const;

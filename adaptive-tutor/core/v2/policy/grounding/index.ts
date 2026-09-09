import type {
  ProviderGroundingClaim,
  TutorActionProposal,
  TutorInstructionContext,
} from "../../contracts/index.js";
import { INSUFFICIENT_GROUNDED_CONTEXT } from "../../contracts/index.js";

export interface GroundingPolicyIssue {
  readonly path: string;
  readonly code:
    | "ambiguous-allowed-reference"
    | "grounding-digest-mismatch"
    | "grounding-outside-allowed-set"
    | "missing-grounding-claim"
    | "unknown-curriculum-reference"
    | "unused-grounding-claim";
  readonly reference: string;
}

export type GroundingPolicyDecision =
  | {
      readonly status: "grounded";
      readonly claims: readonly ProviderGroundingClaim[];
    }
  | {
      readonly status: "rejected";
      readonly code: typeof INSUFFICIENT_GROUNDED_CONTEXT;
      readonly issues: readonly GroundingPolicyIssue[];
      readonly missingGroundingRefs: readonly string[];
    };

const CURRICULUM_FACT_ACTIONS = new Set([
  "ask-check",
  "check-prerequisite",
  "explain",
  "hint",
  "reteach",
  "show-example",
]);

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function actionGroundingRefs(proposal: TutorActionProposal): readonly string[] {
  return "groundingRefs" in proposal.action ? proposal.action.groundingRefs : [];
}

function actionCurriculumRefs(proposal: TutorActionProposal): readonly { path: string; ref: string }[] {
  const embeddedRefs: { path: string; ref: string }[] = [];
  const actionText =
    "content" in proposal.action
      ? proposal.action.content
      : "question" in proposal.action
        ? proposal.action.question
        : undefined;
  if (actionText !== undefined) {
    const opaqueCurriculumRef =
      /\b(?:concept|curriculum|item|lesson|standard):[A-Za-z0-9][A-Za-z0-9._~-]{0,127}\b/g;
    for (const match of actionText.matchAll(opaqueCurriculumRef)) {
      const ref = match[0];
      embeddedRefs.push({
        path: "content" in proposal.action ? "$/action/content" : "$/action/question",
        ref,
      });
    }
  }

  switch (proposal.action.kind) {
    case "show-example":
      return [
        ...embeddedRefs,
        { path: "$/action/exampleRef", ref: proposal.action.exampleRef },
      ];
    case "reteach":
      return [
        ...embeddedRefs,
        { path: "$/action/conceptRef", ref: proposal.action.conceptRef },
      ];
    case "check-prerequisite":
      return [
        ...embeddedRefs,
        {
          path: "$/action/prerequisiteConceptRef",
          ref: proposal.action.prerequisiteConceptRef,
        },
      ];
    default:
      return embeddedRefs;
  }
}

function allowedInstructionReferences(context: TutorInstructionContext): ReadonlySet<string> {
  const references = new Set<string>([
    context.subjectRef,
    context.conceptRef,
    context.workingLevelInstructionRef,
    context.learnerStageRef,
    ...context.groundingReferences.map((reference) => reference.groundingRef),
  ]);
  if (context.learnerSafeItem !== null) references.add(context.learnerSafeItem.itemRef);
  return references;
}

/**
 * Enforces reference membership and digest equality. It intentionally does not
 * claim that reference membership proves semantic entailment.
 */
export function evaluateGroundingPolicy(
  proposal: TutorActionProposal,
  context: TutorInstructionContext,
): GroundingPolicyDecision {
  const issues: GroundingPolicyIssue[] = [];
  const missingGroundingRefs: string[] = [];
  const allowedByRef = new Map<string, string>();
  const ambiguousRefs = new Set<string>();

  for (const reference of context.groundingReferences) {
    const existingDigest = allowedByRef.get(reference.groundingRef);
    if (existingDigest !== undefined && existingDigest !== reference.contentDigest) {
      ambiguousRefs.add(reference.groundingRef);
      issues.push({
        path: "$/instructionContext/groundingReferences",
        code: "ambiguous-allowed-reference",
        reference: reference.groundingRef,
      });
    } else {
      allowedByRef.set(reference.groundingRef, reference.contentDigest);
    }
  }

  const requiredRefs = actionGroundingRefs(proposal);
  const requiredRefSet = new Set(requiredRefs);
  const claimsByRef = new Map<string, ProviderGroundingClaim>();

  for (const [index, claim] of proposal.groundingClaims.entries()) {
    const allowedDigest = allowedByRef.get(claim.groundingRef);
    if (allowedDigest === undefined || ambiguousRefs.has(claim.groundingRef)) {
      issues.push({
        path: `$/groundingClaims/${index}/groundingRef`,
        code: "grounding-outside-allowed-set",
        reference: claim.groundingRef,
      });
      continue;
    }
    if (claim.contentDigest !== allowedDigest) {
      issues.push({
        path: `$/groundingClaims/${index}/contentDigest`,
        code: "grounding-digest-mismatch",
        reference: claim.groundingRef,
      });
      continue;
    }
    if (!requiredRefSet.has(claim.groundingRef)) {
      issues.push({
        path: `$/groundingClaims/${index}/groundingRef`,
        code: "unused-grounding-claim",
        reference: claim.groundingRef,
      });
      continue;
    }
    claimsByRef.set(claim.groundingRef, claim);
  }

  if (CURRICULUM_FACT_ACTIONS.has(proposal.action.kind)) {
    for (const [index, groundingRef] of requiredRefs.entries()) {
      if (!allowedByRef.has(groundingRef) || ambiguousRefs.has(groundingRef)) {
        issues.push({
          path: `$/action/groundingRefs/${index}`,
          code: "grounding-outside-allowed-set",
          reference: groundingRef,
        });
      } else if (!claimsByRef.has(groundingRef)) {
        missingGroundingRefs.push(groundingRef);
        issues.push({
          path: `$/action/groundingRefs/${index}`,
          code: "missing-grounding-claim",
          reference: groundingRef,
        });
      }
    }
  }

  const allowedReferences = allowedInstructionReferences(context);
  for (const curriculumReference of actionCurriculumRefs(proposal)) {
    if (!allowedReferences.has(curriculumReference.ref)) {
      issues.push({
        path: curriculumReference.path,
        code: "unknown-curriculum-reference",
        reference: curriculumReference.ref,
      });
    }
  }

  return issues.length === 0
    ? { status: "grounded", claims: proposal.groundingClaims }
    : {
        status: "rejected",
        code: INSUFFICIENT_GROUNDED_CONTEXT,
        issues,
        missingGroundingRefs: unique(missingGroundingRefs),
      };
}

import {
  TUTOR_ACTION_KINDS,
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
  type AssessmentPhase,
  type StudyAuthorityContext,
  type TutorAction,
  type TutorActionKind,
  type TutorActionProposal,
} from "../../contracts/index.js";

const DIGESTS: Readonly<Record<string, `sha256:${string}`>> = {
  "grounding:fractions": `sha256:${"a".repeat(64)}`,
  "concept:fractions": `sha256:${"b".repeat(64)}`,
  "concept:equal-parts": `sha256:${"c".repeat(64)}`,
  "example:fraction-model": `sha256:${"d".repeat(64)}`,
};

const versionHeader = {
  contractVersion: TUTOR_V2_CONTRACT_VERSION,
  actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
  compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
  actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
} as const;

export interface StudyContextOptions {
  readonly phase?: AssessmentPhase;
  readonly allowedActions?: readonly TutorActionKind[];
  readonly mayContinueAcademicFlow?: boolean;
}

export function makeStudyContext(options: StudyContextOptions = {}): StudyAuthorityContext {
  return {
    ...versionHeader,
    contextKind: "study-authority",
    interactionRef: "interaction:policy-test",
    invocationBindingRef: "invocation:policy-test",
    authorizationRef: "authorization:policy-test",
    authorizationRevision: 1,
    safetyClearanceRef: "safety:policy-test",
    policyRefs: {
      authorityPolicyRef: "policy:authority-v2",
      assessmentPolicyRef: "policy:assessment-v2",
      answerPolicyRef: "policy:answer-v2",
      safetyPolicyRef: "policy:safety-v2",
      privacyPolicyRef: "policy:privacy-v2",
    },
    instructionContext: {
      contextKind: "tutor-instruction",
      subjectRef: "subject:mathematics",
      conceptRef: "concept:fractions",
      workingLevelInstructionRef: "working-level:fraction-foundations",
      learnerStageRef: "learner-stage:middle-childhood",
      learnerSafeItem: {
        itemRef: "item:fraction-parts",
        itemKind: "short-response",
        learnerSafeContent: "How many equal parts are shown?",
      },
      assessmentPhase: options.phase ?? "instruction-or-practice",
      approvedEvidenceSummary: {
        summaryRef: "evidence:approved-summary",
        evidenceCode: "needs-fraction-support",
        attemptCount: 1,
        assistanceLevel: "light-hint",
        observationRefs: ["observation:partition-confusion"],
      },
      allowedActions: [...(options.allowedActions ?? TUTOR_ACTION_KINDS)],
      hintCeiling: "guided-step",
      safetyConstraints: {
        safetyMode: "standard",
        mayContinueAcademicFlow: options.mayContinueAcademicFlow ?? true,
        learnerSafeLanguageRequired: true,
        disallowedContentCodes: ["final-graded-answer"],
      },
      groundingReferences: Object.entries(DIGESTS).map(([groundingRef, contentDigest]) => ({
        groundingRef,
        kind: groundingRef.startsWith("example:")
          ? "worked-example"
          : groundingRef.startsWith("concept:")
            ? "concept-definition"
            : "curriculum-excerpt",
        contentDigest,
        learnerSafeContent: "Approved learner-safe curriculum support.",
      })),
    },
    issuedAt: "2026-08-13T20:00:00.000Z",
    expiresAt: "2026-08-13T20:05:00.000Z",
  };
}

function groundingRefsFor(action: TutorAction): readonly string[] {
  return "groundingRefs" in action ? action.groundingRefs : [];
}

export function makeProposal(action?: TutorAction): TutorActionProposal {
  const selectedAction: TutorAction = action ?? {
    kind: "explain",
    content: "A fraction names equal parts of a whole.",
    groundingRefs: ["grounding:fractions"],
  };
  return {
    ...versionHeader,
    envelope: "tutor-action-proposal",
    proposalRef: "proposal:policy-test",
    interactionRef: "interaction:policy-test",
    action: selectedAction,
    groundingClaims: groundingRefsFor(selectedAction).map((groundingRef) => ({
      groundingRef,
      contentDigest: DIGESTS[groundingRef] ?? `sha256:${"e".repeat(64)}`,
      claimKind: "direct-support",
    })),
    assistanceLevel: "light-hint",
    hintLevel: selectedAction.kind === "hint" ? selectedAction.hintLevel : "nudge",
    authoritative: false,
    requiresStudyValidation: true,
  };
}

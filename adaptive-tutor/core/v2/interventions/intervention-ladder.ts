import { Type, type Static } from "../../schema/typebox.js";
import {
  AssessmentPhaseSchema,
  OpaqueReferenceSchema,
  PolicyCodeSchema,
  TutorActionKindSchema,
} from "../contracts/primitives.js";
import { validateExact } from "../contracts/validation.js";

/**
 * This is an absolute implementation ceiling, not a Tutor-selected policy.
 * Study may supply a lower approved profile cap.
 */
export const ABSOLUTE_MAXIMUM_INTERVENTIONS = 12;
export const MAXIMUM_ASSISTANCE_HISTORY_ENTRIES = 12;

export const InterventionStateSchema = Type.Union([
  Type.Literal("continue"),
  Type.Literal("hint"),
  Type.Literal("check-prerequisite"),
  Type.Literal("reteach"),
  Type.Literal("suggest-break"),
  Type.Literal("escalate"),
  Type.Literal("return-to-lesson"),
]);
export type InterventionState = Static<typeof InterventionStateSchema>;

/** Existing Tutor action kinds that this ladder may recommend. */
export const InterventionActionKindSchema = Type.Union([
  Type.Literal("hint"),
  Type.Literal("check-prerequisite"),
  Type.Literal("reteach"),
  Type.Literal("suggest-break"),
  Type.Literal("escalate"),
  Type.Literal("return-to-lesson"),
]);
export type InterventionActionKind = Static<typeof InterventionActionKindSchema>;

export const AssistanceHistoryEntrySchema = Type.Object(
  {
    actionKind: TutorActionKindSchema,
    outcome: Type.Union([
      Type.Literal("not-observed"),
      Type.Literal("difficulty-persists"),
      Type.Literal("progress-observed"),
    ]),
  },
  { additionalProperties: false },
);
export type AssistanceHistoryEntry = Static<typeof AssistanceHistoryEntrySchema>;

export const MisconceptionSignalSchema = Type.Union([
  Type.Object(
    { status: Type.Literal("none"), hypothesisRef: Type.Null() },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Union([Type.Literal("suspected"), Type.Literal("persistent")]),
      hypothesisRef: OpaqueReferenceSchema,
    },
    { additionalProperties: false },
  ),
]);
export type MisconceptionSignal = Static<typeof MisconceptionSignalSchema>;

export const PrerequisiteSignalSchema = Type.Union([
  Type.Object(
    { status: Type.Literal("none"), prerequisiteConceptRef: Type.Null() },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Union([Type.Literal("suspected"), Type.Literal("confirmed")]),
      prerequisiteConceptRef: OpaqueReferenceSchema,
    },
    { additionalProperties: false },
  ),
]);
export type PrerequisiteSignal = Static<typeof PrerequisiteSignalSchema>;

export const InterventionSafetyRestrictionSchema = Type.Union([
  Type.Object(
    { status: Type.Literal("none"), restrictionRef: Type.Null() },
    { additionalProperties: false },
  ),
  Type.Object(
    { status: Type.Literal("academic-flow-held"), restrictionRef: OpaqueReferenceSchema },
    { additionalProperties: false },
  ),
]);
export type InterventionSafetyRestriction = Static<typeof InterventionSafetyRestrictionSchema>;

export const RecentBreakSuggestionSchema = Type.Union([
  Type.Object(
    { status: Type.Literal("none") },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("recent"),
      interventionsSinceSuggestion: Type.Integer({
        minimum: 0,
        maximum: ABSOLUTE_MAXIMUM_INTERVENTIONS,
      }),
    },
    { additionalProperties: false },
  ),
]);
export type RecentBreakSuggestion = Static<typeof RecentBreakSuggestionSchema>;

/**
 * Study-approved stage behavior. It contains no grade, birth date, identity,
 * diagnosis, or authority to change a learner's official placement.
 */
export const LearnerStageInterventionProfileSchema = Type.Object(
  {
    profileKind: Type.Literal("study-approved-intervention-profile"),
    profileRef: OpaqueReferenceSchema,
    learnerStageRef: OpaqueReferenceSchema,
    approvalRef: OpaqueReferenceSchema,
    approvalKind: Type.Literal("study-approved"),
    attemptsBeforeFirstHint: Type.Integer({ minimum: 1, maximum: 3 }),
    maximumHintsBeforeReteach: Type.Integer({ minimum: 0, maximum: 3 }),
    maximumReteachesBeforeEscalation: Type.Integer({ minimum: 1, maximum: 3 }),
    breakSuggestionAfterEffortMinutes: Type.Integer({ minimum: 5, maximum: 120 }),
    minimumAttemptsBeforeBreakSuggestion: Type.Integer({ minimum: 1, maximum: 10 }),
    breakSuggestionCooldownInterventions: Type.Integer({ minimum: 1, maximum: 8 }),
    proposedBreakDurationMinutes: Type.Integer({ minimum: 1, maximum: 30 }),
    maximumInterventionsBeforeEscalation: Type.Integer({
      minimum: 3,
      maximum: ABSOLUTE_MAXIMUM_INTERVENTIONS,
    }),
  },
  { additionalProperties: false, $id: "TutorV2LearnerStageInterventionProfile" },
);
export type LearnerStageInterventionProfile = Static<
  typeof LearnerStageInterventionProfileSchema
>;

export const InterventionLadderInputSchema = Type.Object(
  {
    inputKind: Type.Literal("study-intervention-evidence"),
    interactionRef: OpaqueReferenceSchema,
    attemptCount: Type.Integer({ minimum: 0, maximum: 100 }),
    assistanceHistory: Type.Array(AssistanceHistoryEntrySchema, {
      maxItems: MAXIMUM_ASSISTANCE_HISTORY_ENTRIES,
    }),
    misconceptionSignal: MisconceptionSignalSchema,
    prerequisiteSignal: PrerequisiteSignalSchema,
    learnerStageProfile: LearnerStageInterventionProfileSchema,
    elapsedInstructionalEffortMinutes: Type.Integer({ minimum: 0, maximum: 240 }),
    interventionCount: Type.Integer({
      minimum: 0,
      maximum: ABSOLUTE_MAXIMUM_INTERVENTIONS,
    }),
    safetyRestriction: InterventionSafetyRestrictionSchema,
    recentBreakSuggestion: RecentBreakSuggestionSchema,
    assessmentPhase: AssessmentPhaseSchema,
    allowedActions: Type.Array(TutorActionKindSchema, { minItems: 1, maxItems: 9 }),
  },
  { additionalProperties: false, $id: "TutorV2InterventionLadderInput" },
);
export type InterventionLadderInput = Static<typeof InterventionLadderInputSchema>;

export const InterventionRecommendationSchema = Type.Object(
  {
    recommendationKind: Type.Literal("proposal-only-intervention"),
    interactionRef: OpaqueReferenceSchema,
    state: InterventionStateSchema,
    actionKind: InterventionActionKindSchema,
    reasonCode: PolicyCodeSchema,
    interventionCountAtRecommendation: Type.Integer({
      minimum: 0,
      maximum: ABSOLUTE_MAXIMUM_INTERVENTIONS - 1,
    }),
    nextInterventionCount: Type.Integer({
      minimum: 1,
      maximum: ABSOLUTE_MAXIMUM_INTERVENTIONS,
    }),
    terminal: Type.Boolean(),
    breakSuggestionIsOptional: Type.Boolean(),
    proposedBreakDurationMinutes: Type.Union([
      Type.Integer({ minimum: 1, maximum: 30 }),
      Type.Null(),
    ]),
    escalationTarget: Type.Union([
      Type.Literal("study-adult-review-policy"),
      Type.Null(),
    ]),
    claimsEscalationDelivery: Type.Literal(false),
    proposalOnly: Type.Literal(true),
    tutorMayExecute: Type.Literal(false),
    studyMutationAllowed: Type.Literal(false),
    authoritativeDecision: Type.Literal(false),
  },
  { additionalProperties: false, $id: "TutorV2InterventionRecommendation" },
);
export type InterventionRecommendation = Static<typeof InterventionRecommendationSchema>;

export const InterventionLadderBlockedCodeSchema = Type.Union([
  Type.Literal("INVALID_INTERVENTION_INPUT"),
  Type.Literal("NO_STUDY_AUTHORIZED_INTERVENTION"),
  Type.Literal("STUDY_REVIEW_REQUIRED"),
  Type.Literal("ADULT_REVIEW_PENDING"),
  Type.Literal("INTERVENTION_LIMIT_REACHED"),
]);
export type InterventionLadderBlockedCode = Static<
  typeof InterventionLadderBlockedCodeSchema
>;

export const InterventionLadderResultSchema = Type.Union([
  Type.Object(
    {
      status: Type.Literal("recommended"),
      recommendation: InterventionRecommendationSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      status: Type.Literal("blocked"),
      code: InterventionLadderBlockedCodeSchema,
      proposalOnly: Type.Literal(true),
      tutorMayExecute: Type.Literal(false),
      studyMutationAllowed: Type.Literal(false),
    },
    { additionalProperties: false },
  ),
]);
export type InterventionLadderResult = Static<typeof InterventionLadderResultSchema>;

interface Candidate {
  readonly state: InterventionState;
  readonly reasonCode: string;
}

const ACTIVE_ASSESSMENT = "active-graded-or-mastery-check";

function blocked(code: InterventionLadderBlockedCode): InterventionLadderResult {
  return {
    status: "blocked",
    code,
    proposalOnly: true,
    tutorMayExecute: false,
    studyMutationAllowed: false,
  };
}

function actionKindForState(state: InterventionState): InterventionActionKind {
  switch (state) {
    case "continue":
    case "return-to-lesson":
      return "return-to-lesson";
    case "hint":
      return "hint";
    case "check-prerequisite":
      return "check-prerequisite";
    case "reteach":
      return "reteach";
    case "suggest-break":
      return "suggest-break";
    case "escalate":
      return "escalate";
  }
}

function recommend(
  input: InterventionLadderInput,
  candidate: Candidate,
): InterventionLadderResult {
  const isBreak = candidate.state === "suggest-break";
  const isEscalation = candidate.state === "escalate";
  return {
    status: "recommended",
    recommendation: {
      recommendationKind: "proposal-only-intervention",
      interactionRef: input.interactionRef,
      state: candidate.state,
      actionKind: actionKindForState(candidate.state),
      reasonCode: candidate.reasonCode,
      interventionCountAtRecommendation: input.interventionCount,
      nextInterventionCount: input.interventionCount + 1,
      terminal: isEscalation,
      breakSuggestionIsOptional: isBreak,
      proposedBreakDurationMinutes: isBreak
        ? input.learnerStageProfile.proposedBreakDurationMinutes
        : null,
      escalationTarget: isEscalation ? "study-adult-review-policy" : null,
      claimsEscalationDelivery: false,
      proposalOnly: true,
      tutorMayExecute: false,
      studyMutationAllowed: false,
      authoritativeDecision: false,
    },
  };
}

function firstAuthorized(
  input: InterventionLadderInput,
  candidates: readonly Candidate[],
  failureCode: InterventionLadderBlockedCode = "NO_STUDY_AUTHORIZED_INTERVENTION",
): InterventionLadderResult {
  for (const candidate of candidates) {
    if (input.allowedActions.includes(actionKindForState(candidate.state))) {
      return recommend(input, candidate);
    }
  }
  return blocked(failureCode);
}

function countAction(input: InterventionLadderInput, actionKind: InterventionActionKind): number {
  return input.assistanceHistory.reduce(
    (count, entry) => count + (entry.actionKind === actionKind ? 1 : 0),
    0,
  );
}

function hasRecentBreakProtection(input: InterventionLadderInput): boolean {
  return (
    input.recentBreakSuggestion.status === "recent" &&
    input.recentBreakSuggestion.interventionsSinceSuggestion <
      input.learnerStageProfile.breakSuggestionCooldownInterventions
  );
}

function breakCandidate(input: InterventionLadderInput): Candidate | null {
  if (
    input.elapsedInstructionalEffortMinutes <
      input.learnerStageProfile.breakSuggestionAfterEffortMinutes ||
    input.attemptCount < input.learnerStageProfile.minimumAttemptsBeforeBreakSuggestion ||
    hasRecentBreakProtection(input)
  ) {
    return null;
  }
  return { state: "suggest-break", reasonCode: "instructional-effort-break-option" };
}

function withOptionalBreak(
  input: InterventionLadderInput,
  candidates: readonly Candidate[],
): readonly Candidate[] {
  const optionalBreak = breakCandidate(input);
  return optionalBreak ? [optionalBreak, ...candidates] : candidates;
}

function isSemanticallyValid(input: InterventionLadderInput): boolean {
  return (
    new Set(input.allowedActions).size === input.allowedActions.length &&
    input.assistanceHistory.length <= input.interventionCount
  );
}

/**
 * Pure deterministic recommendation. It does not construct or execute a Tutor
 * action, mutate Study, clear safety, change learner placement, or claim that
 * escalation reached an adult.
 */
export function recommendNextIntervention(input: unknown): InterventionLadderResult {
  const validation = validateExact(InterventionLadderInputSchema, input);
  if (validation.status === "rejected" || !isSemanticallyValid(validation.value)) {
    return blocked("INVALID_INTERVENTION_INPUT");
  }
  const evidence = validation.value;
  const profile = evidence.learnerStageProfile;
  const cap = Math.min(
    ABSOLUTE_MAXIMUM_INTERVENTIONS,
    profile.maximumInterventionsBeforeEscalation,
  );
  const lastAssistance = evidence.assistanceHistory.at(-1);

  if (lastAssistance?.actionKind === "escalate") {
    return blocked("ADULT_REVIEW_PENDING");
  }

  if (evidence.interventionCount >= cap) {
    return blocked("INTERVENTION_LIMIT_REACHED");
  }

  if (evidence.safetyRestriction.status === "academic-flow-held") {
    return firstAuthorized(
      evidence,
      [{ state: "escalate", reasonCode: "safety-hold-study-review" }],
      "STUDY_REVIEW_REQUIRED",
    );
  }

  if (evidence.interventionCount === cap - 1) {
    return firstAuthorized(
      evidence,
      [{ state: "escalate", reasonCode: "bounded-intervention-cap" }],
      "STUDY_REVIEW_REQUIRED",
    );
  }

  if (evidence.assessmentPhase === ACTIVE_ASSESSMENT) {
    const assessmentCandidates: Candidate[] = [
      { state: "return-to-lesson", reasonCode: "active-assessment-study-control" },
    ];
    const optionalBreak = breakCandidate(evidence);
    if (optionalBreak) assessmentCandidates.push(optionalBreak);
    assessmentCandidates.push({
      state: "escalate",
      reasonCode: "active-assessment-study-review",
    });
    return firstAuthorized(evidence, assessmentCandidates);
  }

  if (lastAssistance?.outcome === "progress-observed") {
    return firstAuthorized(evidence, [
      { state: "return-to-lesson", reasonCode: "progress-return-to-study" },
      { state: "escalate", reasonCode: "study-route-unavailable" },
    ]);
  }

  const prerequisiteChecks = countAction(evidence, "check-prerequisite");
  const reteaches = countAction(evidence, "reteach");
  const hints = countAction(evidence, "hint");

  if (evidence.prerequisiteSignal.status !== "none") {
    if (prerequisiteChecks === 0) {
      return firstAuthorized(
        evidence,
        withOptionalBreak(evidence, [
          { state: "check-prerequisite", reasonCode: "prerequisite-signal" },
          { state: "reteach", reasonCode: "prerequisite-check-unavailable" },
          { state: "escalate", reasonCode: "prerequisite-support-unavailable" },
        ]),
      );
    }
    if (reteaches < profile.maximumReteachesBeforeEscalation) {
      return firstAuthorized(
        evidence,
        withOptionalBreak(evidence, [
          { state: "reteach", reasonCode: "prerequisite-difficulty-persists" },
          { state: "escalate", reasonCode: "prerequisite-support-exhausted" },
        ]),
      );
    }
    return firstAuthorized(
      evidence,
      withOptionalBreak(evidence, [
        { state: "escalate", reasonCode: "prerequisite-support-exhausted" },
      ]),
    );
  }

  if (evidence.misconceptionSignal.status === "persistent") {
    if (reteaches < profile.maximumReteachesBeforeEscalation) {
      return firstAuthorized(
        evidence,
        withOptionalBreak(evidence, [
          { state: "reteach", reasonCode: "persistent-misconception-signal" },
          { state: "escalate", reasonCode: "reteach-unavailable" },
        ]),
      );
    }
    return firstAuthorized(
      evidence,
      withOptionalBreak(evidence, [
        { state: "escalate", reasonCode: "reteach-path-exhausted" },
      ]),
    );
  }

  if (
    evidence.attemptCount <= profile.attemptsBeforeFirstHint &&
    hints === 0 &&
    reteaches === 0
  ) {
    return firstAuthorized(evidence, [
      { state: "continue", reasonCode: "first-difficulty-try-again" },
      { state: "hint", reasonCode: "continue-route-unavailable" },
      { state: "reteach", reasonCode: "initial-support-route" },
      { state: "escalate", reasonCode: "initial-support-unavailable" },
    ]);
  }

  if (hints < profile.maximumHintsBeforeReteach) {
    return firstAuthorized(
      evidence,
      withOptionalBreak(evidence, [
        { state: "hint", reasonCode: "repeated-difficulty" },
        { state: "reteach", reasonCode: "hint-unavailable" },
        { state: "escalate", reasonCode: "guided-support-unavailable" },
      ]),
    );
  }

  if (reteaches < profile.maximumReteachesBeforeEscalation) {
    return firstAuthorized(
      evidence,
      withOptionalBreak(evidence, [
        { state: "reteach", reasonCode: "hint-path-exhausted" },
        { state: "escalate", reasonCode: "reteach-unavailable" },
      ]),
    );
  }

  return firstAuthorized(
    evidence,
    withOptionalBreak(evidence, [
      { state: "escalate", reasonCode: "instructional-support-exhausted" },
    ]),
  );
}

export {
  CARD5_OBLIGATION_PROJECTION_ORDER,
  CARD5_RECONCILED_PARENT_POLICY,
  PARENT_RUNTIME_SCHEMA_VERSION,
  buildMobileParentViewModel,
  type AdultReviewRequest,
  type CreateParentRuntimeInput as AcceptedCreateParentRuntimeInput,
  type DurationPolicyContext,
  type EffectiveParentSettings,
  type MobileParentViewModel,
  type ParentAccommodation,
  type ParentControlAction,
  type ParentControlOutcome,
  type ParentPrecedenceTrace,
  type ParentRuntimeState,
} from "../../integration-labs/calendar-parent-runtime/parent-runtime.ts";

import {
  applyParentControlAction as acceptedApplyParentControlAction,
  createParentRuntimeState as acceptedCreateParentRuntimeState,
  type CreateParentRuntimeInput as AcceptedCreateParentRuntimeInput,
  type DurationPolicyContext,
  type ParentControlAction,
  type ParentControlOutcome,
  type ParentRuntimeState,
} from "../../integration-labs/calendar-parent-runtime/parent-runtime.ts";
import {
  writeAdultPrivateNote,
  type AdultPrivateAuthorization,
  type AdultPrivateRecord,
} from "../../integration-labs/calendar-parent-runtime/privacy.ts";

export type CreateParentRuntimeInput = Omit<
  AcceptedCreateParentRuntimeInput,
  "durationPolicyContext"
> & {
  readonly durationPolicyContext: DurationPolicyContext;
};

export function createParentRuntimeState(
  input: CreateParentRuntimeInput,
): ParentRuntimeState {
  const gate = input.durationPolicyContext;
  if (
    typeof gate !== "object" ||
    gate === null ||
    gate.policyVersion !== 1 ||
    typeof gate.integrityValid !== "boolean" ||
    typeof gate.actorAuthorized !== "boolean"
  ) {
    throw new Error(
      "Explicit supported duration-policy integrity and authorization gates are required.",
    );
  }
  return acceptedCreateParentRuntimeState(input);
}

const CREDENTIAL_TEXT =
  /\b(?:password|passcode|passwd|bearer\s+[a-z0-9._~-]+|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|client[-_ ]?secret|session[-_ ]?cookie)\b|https?:\/\/[^/\s:@]+:[^/\s@]+@/i;

function assertCredentialFreeParentAction(value: unknown): void {
  if (typeof value === "string") {
    if (CREDENTIAL_TEXT.test(value)) {
      throw new Error("Parent control text must not contain credentials.");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(assertCredentialFreeParentAction);
    return;
  }
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(assertCredentialFreeParentAction);
  }
}

export interface VerifiedParentControlContext {
  readonly integrityValid: true;
  readonly actorAuthorized: true;
  readonly studentRef: string;
  readonly actorId: string;
  readonly actorRole: ParentControlAction["actor"]["role"];
  readonly privateBoundary?: {
    readonly record: AdultPrivateRecord;
    readonly authorization: AdultPrivateAuthorization;
    commitAuthorizedRecord(record: AdultPrivateRecord): void;
  };
}

export type VerifiedParentControlOutcome = Omit<
  ParentControlOutcome,
  "adultPrivateWrite"
> & {
  readonly adultPrivateWriteStatus?: "authorized-and-committed";
};

/**
 * Public parent-control boundary. Every action requires explicit integrity,
 * actor, learner, and optimistic-concurrency authorization. Private note
 * bodies are committed through the accepted adult-private boundary and never
 * returned from this public function.
 */
export function applyParentControlAction(
  state: ParentRuntimeState,
  action: ParentControlAction,
  context: VerifiedParentControlContext,
): VerifiedParentControlOutcome {
  assertCredentialFreeParentAction(action);
  if (
    context.integrityValid !== true ||
    context.actorAuthorized !== true ||
    context.studentRef !== state.studentRef ||
    context.actorId !== action.actor.actorId ||
    context.actorRole !== action.actor.role ||
    action.expectedRevision !== state.revision
  ) {
    throw new Error(
      "Verified parent-control integrity, actor, learner, and revision context is required.",
    );
  }
  if (action.type === "add-private-note" && context.privateBoundary === undefined) {
    throw new Error(
      "An authorized adult-private record boundary is required for private notes.",
    );
  }
  const outcome = acceptedApplyParentControlAction(state, action);
  if (outcome.adultPrivateWrite === undefined) {
    return {
      state: outcome.state,
      duplicateIgnored: outcome.duplicateIgnored,
    };
  }
  const boundary = context.privateBoundary;
  if (boundary === undefined) {
    throw new Error("Missing adult-private record boundary.");
  }
  const committed = writeAdultPrivateNote(
    boundary.record,
    outcome.adultPrivateWrite,
    boundary.authorization,
  );
  boundary.commitAuthorizedRecord(committed);
  return {
    state: outcome.state,
    duplicateIgnored: outcome.duplicateIgnored,
    adultPrivateWriteStatus: "authorized-and-committed",
  };
}

export {
  CARD5_POLICY_ID,
  CARD5_POLICY_VERSION,
  type Card5AppliedConstraint,
  type Card5DurationAdapterInput,
  type Card5DurationResolution,
  type Card5DurationWinner,
} from "../../integration-labs/calendar-parent-runtime/card5-duration-policy.ts";

import {
  CARD5_POLICY_ID,
  CARD5_POLICY_VERSION,
  resolveCard5Duration,
  type Card5DurationAdapterInput,
  type Card5DurationResolution,
} from "../../integration-labs/calendar-parent-runtime/card5-duration-policy.ts";

export interface ParentDurationDecisionHistoryEntry {
  readonly sequence: number;
  readonly reasonCode: string;
  readonly winningSource: string;
  readonly candidateMinutes: number | null;
  readonly finalEffectiveValue: number | null;
  readonly manualReview: boolean;
}

export interface ParentDurationDecisionRecord {
  readonly contract: "manuel-academy.parent-duration-decision.v1";
  readonly policyId: typeof CARD5_POLICY_ID;
  readonly policyVersion: typeof CARD5_POLICY_VERSION;
  readonly safetyLimits: Card5DurationAdapterInput["safety"];
  readonly requiredAccommodations: Card5DurationAdapterInput["accommodations"];
  readonly parentHardLimits: Card5DurationAdapterInput["adultHardMaximums"];
  readonly parentExplicitOverride:
    | Card5DurationAdapterInput["manualOverride"]
    | null;
  readonly engineRecommendation:
    | Card5DurationAdapterInput["recommendation"]
    | null;
  readonly gradeBandDefault: number;
  readonly winningSource: string;
  readonly reasonCode: string;
  readonly finalEffectiveValue: number | null;
  readonly manualReview: boolean;
  readonly bindingConstraints: readonly string[];
  readonly resolution: Card5DurationResolution;
  readonly decisionHistory: readonly ParentDurationDecisionHistoryEntry[];
}

export function resolveParentDurationDecision(
  input: Card5DurationAdapterInput,
  priorHistory: readonly ParentDurationDecisionHistoryEntry[] = [],
): ParentDurationDecisionRecord {
  const resolution = resolveCard5Duration(input);
  const entry: ParentDurationDecisionHistoryEntry = {
    sequence: priorHistory.length + 1,
    reasonCode: resolution.reasonCode,
    winningSource: resolution.winner.source,
    candidateMinutes: resolution.candidateMinutes ?? null,
    finalEffectiveValue: resolution.targetMinutes,
    manualReview: resolution.status === "manual-review",
  };
  return {
    contract: "manuel-academy.parent-duration-decision.v1",
    policyId: CARD5_POLICY_ID,
    policyVersion: CARD5_POLICY_VERSION,
    safetyLimits: input.safety,
    requiredAccommodations: input.accommodations,
    parentHardLimits: input.adultHardMaximums,
    parentExplicitOverride: input.manualOverride ?? null,
    engineRecommendation: input.recommendation ?? null,
    gradeBandDefault: input.gradeBandDefaultMinutes,
    winningSource: resolution.winner.source,
    reasonCode: resolution.reasonCode,
    finalEffectiveValue: resolution.targetMinutes,
    manualReview: resolution.status === "manual-review",
    bindingConstraints: resolution.appliedConstraints
      .filter(({ binding }) => binding)
      .map(({ constraintId }) => constraintId),
    resolution,
    decisionHistory: [...priorHistory, entry],
  };
}

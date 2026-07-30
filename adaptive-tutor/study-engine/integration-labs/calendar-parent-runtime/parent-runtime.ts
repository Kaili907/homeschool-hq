import {
  type AdultActor,
  type AdultPrivateNoteWrite,
  type ParentSafeRecommendation,
  type PrivateNoteCategory,
  isParentSafeFunctionalText,
} from "./privacy.js";
import {
  CARD5_POLICY_ID,
  CARD5_POLICY_VERSION,
  resolveCard5Duration,
  type Card5AdultHardMaximum,
  type Card5DurationResolution,
  type Card5ManualOverride,
} from "./card5-duration-policy.js";

export const PARENT_RUNTIME_SCHEMA_VERSION =
  "calendar-parent-runtime.parent-controls.v1" as const;

export type GradeBand = "elementary-3-5" | "middle-6-8" | "high-9-12";

export const CARD5_OBLIGATION_PROJECTION_ORDER = [
  "safety-limit",
  "required-accommodation",
  "parent-hard-maximum",
  "parent-explicit-manual-override",
  "engine-recommendation",
  "grade-band-default",
] as const;

export type ParentPrecedenceSource =
  (typeof CARD5_OBLIGATION_PROJECTION_ORDER)[number];

export interface ReconciledParentPolicy {
  readonly policyId: typeof CARD5_POLICY_ID;
  readonly policyVersion: typeof CARD5_POLICY_VERSION;
  readonly status: "card5-reconciled";
  readonly orderedSources: readonly ParentPrecedenceSource[];
}

export const CARD5_RECONCILED_PARENT_POLICY: ReconciledParentPolicy = {
  policyId: CARD5_POLICY_ID,
  policyVersion: CARD5_POLICY_VERSION,
  status: "card5-reconciled",
  orderedSources: CARD5_OBLIGATION_PROJECTION_ORDER,
};

export interface PrecedenceCandidate<T> {
  readonly value: T;
  readonly reason: string;
}

export interface PrecedenceConsideration<T> {
  readonly source: ParentPrecedenceSource;
  readonly label: string;
  readonly configured: boolean;
  readonly value: T | undefined;
  readonly outcome:
    | "selected"
    | "not-configured"
    | "superseded-by-higher-precedence";
  readonly explanation: string;
}

export interface ParentPrecedenceTrace<T> {
  readonly field:
    | "maximum-work-duration-minutes"
    | "break-duration-minutes"
    | "timers-hidden";
  readonly policyId: string;
  readonly policyVersion: typeof CARD5_POLICY_VERSION;
  readonly status: "resolved";
  readonly reasonCode: "policy.obligation-resolved";
  readonly winner: {
    readonly source: ParentPrecedenceSource;
    readonly label: string;
    readonly value: T;
    readonly reason: string;
  };
  readonly considered: readonly PrecedenceConsideration<T>[];
}

export interface RuntimeSettingBundle {
  readonly maximumWorkDurationMinutes?: number;
  readonly breakDurationMinutes?: number;
  readonly timersHidden?: boolean;
}

export interface SafetySettingBundle extends RuntimeSettingBundle {
  readonly constraintId?: string;
  readonly minimumWorkDurationMinutes?: number;
  readonly veto?: boolean;
}

export interface ParentAccommodation {
  readonly accommodationId: string;
  readonly enabled: boolean;
  readonly required: boolean;
  readonly functionalDescription: string;
  readonly studentMessage: string;
  readonly source: "parent" | "teacher" | "school-plan";
  readonly addedAt: string;
  readonly minimumWorkDurationMinutes?: number;
  readonly maximumWorkDurationMinutes?: number;
  readonly breakDurationMinutes?: number;
  readonly timersHidden?: boolean;
}

export interface AdultHardMaximumRecord {
  readonly hardMaximumId: string;
  readonly active: boolean;
  readonly minutes: number;
  readonly setAt: string;
  readonly reason: string;
  readonly setBy?: AdultActor;
}

export interface ManualDurationOverrideRecord {
  readonly overrideId: string;
  readonly active: boolean;
  readonly mode: "target" | "hold" | "reduce";
  readonly targetMinutes?: number;
  readonly setAt: string;
  readonly reason: string;
  readonly setBy?: AdultActor;
}

export interface DurationPolicyContext {
  readonly policyVersion: number;
  readonly integrityValid: boolean;
  readonly actorAuthorized: boolean;
  readonly currentMinutes: number;
  readonly establishedTargetMinutes?: number;
}

export interface RecommendationDecision {
  readonly decisionId: string;
  readonly recommendationId: string;
  readonly decision: "accepted" | "rejected";
  readonly decidedBy: AdultActor;
  readonly decidedAt: string;
  readonly displayMessage: string;
}

export interface IncompleteWorkReschedule {
  readonly rescheduleId: string;
  readonly blockId: string;
  readonly originalStartAt: string;
  readonly replacementStartAt: string;
  readonly changedBy: AdultActor;
  readonly changedAt: string;
  readonly reason: string;
}

export interface MarkedInterruption {
  readonly interruptionId: string;
  readonly kind: "outside" | "technical";
  readonly blockId?: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly recordedBy: AdultActor;
}

export interface AdultReviewRequest {
  readonly requestId: string;
  readonly audience: "teacher" | "tutor";
  readonly subjectRef: string;
  readonly reason: string;
  readonly requestedAt: string;
  readonly requestedBy: AdultActor;
  readonly status: "open";
  readonly basisEvidenceIds: readonly string[];
}

export interface SafeParentActionLogEntry {
  readonly eventId: string;
  readonly type: ParentControlAction["type"];
  readonly at: string;
  readonly actor: AdultActor;
  /**
   * Canonical compare-and-swap provenance. `expectedRevision` is omitted only
   * for the first write to a legacy local-demo setting.
   */
  readonly expectedRevision?: number;
  readonly appliedFromRevision: number;
  readonly resultingRevision: number;
  readonly subjectRef?: string;
  /**
   * This message contains no note body, raw answer, transcript, diagnosis,
   * hidden score, or identifying learner data.
   */
  readonly message: string;
}

export interface EffectiveParentSettings {
  /**
   * Null means Card 5 requires manual review or quarantined the policy input.
   * No automatic duration may be invented in either state.
   */
  readonly maximumWorkDurationMinutes: number | null;
  readonly breakDurationMinutes: number;
  readonly timersHidden: boolean;
  readonly traces: {
    readonly maximumWorkDurationMinutes: Card5DurationResolution;
    readonly breakDurationMinutes: ParentPrecedenceTrace<number>;
    readonly timersHidden: ParentPrecedenceTrace<boolean>;
  };
}

export interface ParentRuntimeState {
  readonly kind: "calendar-parent-runtime-controls";
  readonly schemaVersion: typeof PARENT_RUNTIME_SCHEMA_VERSION;
  readonly controlSetId: string;
  readonly studentRef: string;
  readonly gradeBand: GradeBand;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly privateRecordRef: string;
  readonly precedencePolicy: ReconciledParentPolicy;
  readonly durationPolicyContext: DurationPolicyContext;
  readonly safetyLimit: SafetySettingBundle;
  readonly gradeBandDefault: Required<RuntimeSettingBundle>;
  readonly parentHardMaximumWorkDurationMinutes?: number;
  readonly adultHardMaximums: readonly AdultHardMaximumRecord[];
  readonly parentManualOverride: RuntimeSettingBundle;
  readonly manualDurationOverride?: ManualDurationOverrideRecord;
  readonly activeRecommendationId: string | undefined;
  readonly recommendations: readonly ParentSafeRecommendation[];
  readonly recommendationDecisions: readonly RecommendationDecision[];
  readonly accommodations: readonly ParentAccommodation[];
  readonly knownIncompleteBlockIds: readonly string[];
  readonly incompleteWorkReschedules: readonly IncompleteWorkReschedule[];
  readonly interruptions: readonly MarkedInterruption[];
  readonly reviewRequests: readonly AdultReviewRequest[];
  readonly processedEventIds: readonly string[];
  readonly actionLog: readonly SafeParentActionLogEntry[];
  readonly effectiveSettings: EffectiveParentSettings;
}

interface ParentActionBase {
  readonly eventId: string;
  readonly at: string;
  readonly actor: AdultActor;
  /**
   * Card 5 / DEC-012 optimistic-concurrency gate. Canonical callers provide
   * this value on every command. It remains optional only so the local
   * single-writer demonstration can exercise its first write unchanged.
   */
  readonly expectedRevision?: number;
}

export type ParentControlAction =
  | (ParentActionBase & {
      readonly type: "accept-recommendation";
      readonly recommendationId: string;
    })
  | (ParentActionBase & {
      readonly type: "reject-recommendation";
      readonly recommendationId: string;
    })
  | (ParentActionBase & {
      readonly type: "set-maximum-work-duration";
      readonly minutes: number;
      readonly scope: "hard-maximum" | "manual-override";
      readonly manualMode?: "target" | "hold" | "reduce";
      readonly reason: string;
    })
  | (ParentActionBase & {
      readonly type: "set-break-duration";
      readonly minutes: number;
      readonly reason: string;
    })
  | (ParentActionBase & {
      readonly type: "set-timers-hidden";
      readonly hidden: boolean;
      readonly reason: string;
    })
  | (ParentActionBase & {
      readonly type: "add-accommodation";
      readonly accommodationId: string;
      readonly required: boolean;
      readonly functionalDescription: string;
      readonly studentMessage: string;
      readonly source: "parent" | "teacher" | "school-plan";
      readonly minimumWorkDurationMinutes?: number;
      readonly maximumWorkDurationMinutes?: number;
      readonly breakDurationMinutes?: number;
      readonly timersHidden?: boolean;
    })
  | (ParentActionBase & {
      readonly type: "reschedule-incomplete-work";
      readonly rescheduleId: string;
      readonly blockId: string;
      readonly originalStartAt: string;
      readonly replacementStartAt: string;
      readonly reason: string;
    })
  | (ParentActionBase & {
      readonly type: "mark-interruption";
      readonly interruptionId: string;
      readonly kind: "outside" | "technical";
      readonly blockId?: string;
      readonly occurredAt: string;
    })
  | (ParentActionBase & {
      readonly type: "add-private-note";
      readonly noteId: string;
      readonly category: PrivateNoteCategory;
      readonly body: string;
    })
  | (ParentActionBase & {
      readonly type: "request-adult-review";
      readonly requestId: string;
      readonly audience: "teacher" | "tutor";
      readonly subjectRef: string;
      readonly reason: string;
      readonly basisEvidenceIds: readonly string[];
    });

export interface ParentControlOutcome {
  readonly state: ParentRuntimeState;
  /**
   * A transient command for the separately authorized private-note boundary.
   * It is never embedded in ParentRuntimeState or a mobile view model.
   */
  readonly adultPrivateWrite?: AdultPrivateNoteWrite;
  readonly duplicateIgnored: boolean;
}

export interface CreateParentRuntimeInput {
  readonly controlSetId: string;
  readonly studentRef: string;
  readonly gradeBand: GradeBand;
  readonly privateRecordRef: string;
  readonly at: string;
  readonly gradeBandDefault: Required<RuntimeSettingBundle>;
  readonly safetyLimit?: SafetySettingBundle;
  readonly parentHardMaximumWorkDurationMinutes?: number;
  readonly adultHardMaximums?: readonly AdultHardMaximumRecord[];
  readonly parentManualOverride?: RuntimeSettingBundle;
  readonly manualDurationOverride?: ManualDurationOverrideRecord;
  readonly durationPolicyContext?: Partial<DurationPolicyContext>;
  readonly recommendations?: readonly ParentSafeRecommendation[];
  readonly accommodations?: readonly ParentAccommodation[];
  readonly knownIncompleteBlockIds?: readonly string[];
}

export type ParentRuntimeErrorCode =
  | "invalid-id"
  | "invalid-timestamp"
  | "invalid-duration"
  | "invalid-revision"
  | "invalid-text"
  | "missing-precedence-candidate"
  | "stale-revision"
  | "unauthorized-actor"
  | "unknown-recommendation"
  | "unknown-incomplete-work"
  | "duplicate-record-id";

export class ParentRuntimeError extends Error {
  public readonly name = "ParentRuntimeError";

  public constructor(
    public readonly code: ParentRuntimeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const OFFSET_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const SOURCE_LABELS: Readonly<Record<ParentPrecedenceSource, string>> = {
  "safety-limit": "Safety limit",
  "required-accommodation": "Required accommodation",
  "parent-hard-maximum": "Parent hard maximum",
  "parent-explicit-manual-override": "Parent explicit manual override",
  "engine-recommendation": "Engine recommendation",
  "grade-band-default": "Grade-band default",
};

function assertId(value: string, field: string): void {
  if (!SAFE_ID.test(value)) {
    throw new ParentRuntimeError(
      "invalid-id",
      `${field} must be a stable opaque identifier.`,
    );
  }
}

function assertTimestamp(value: string, field: string): void {
  if (!OFFSET_TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new ParentRuntimeError(
      "invalid-timestamp",
      `${field} must include Z or an explicit UTC offset.`,
    );
  }
}

function assertDuration(value: number, field: string, maximum: number): void {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new ParentRuntimeError(
      "invalid-duration",
      `${field} must be a whole number from 1 to ${maximum}.`,
    );
  }
}

function assertRevision(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ParentRuntimeError(
      "invalid-revision",
      `${field} must be a non-negative safe integer.`,
    );
  }
}

function assertParentTeacherActor(actor: AdultActor, field: string): void {
  assertId(actor.actorId, `${field}.actorId`);
  if (actor.role !== "parent" && actor.role !== "teacher") {
    throw new ParentRuntimeError(
      "unauthorized-actor",
      `${field} must identify an authorized parent or teacher for this control.`,
    );
  }
}

function normalizedFunctionalText(
  value: string,
  field: string,
  maximumLength = 500,
): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    !isParentSafeFunctionalText(normalized)
  ) {
    throw new ParentRuntimeError(
      "invalid-text",
      `${field} must use bounded, functional, non-diagnostic, non-blaming language.`,
    );
  }
  return normalized;
}

function validateBundle(bundle: RuntimeSettingBundle, field: string): void {
  if (bundle.maximumWorkDurationMinutes !== undefined) {
    assertDuration(
      bundle.maximumWorkDurationMinutes,
      `${field}.maximumWorkDurationMinutes`,
      240,
    );
  }
  if (bundle.breakDurationMinutes !== undefined) {
    assertDuration(
      bundle.breakDurationMinutes,
      `${field}.breakDurationMinutes`,
      120,
    );
  }
}

/**
 * Projects non-duration obligations (break and timer presentation). Card 5
 * explicitly treats these as obligations rather than duration candidates.
 */
export function resolveParentObligation<T>(
  field: ParentPrecedenceTrace<T>["field"],
  candidates: Readonly<
    Partial<Record<ParentPrecedenceSource, PrecedenceCandidate<T> | undefined>>
  >,
): ParentPrecedenceTrace<T> {
  const winnerSource = CARD5_OBLIGATION_PROJECTION_ORDER.find(
    (source) => candidates[source] !== undefined,
  );
  if (winnerSource === undefined) {
    throw new ParentRuntimeError(
      "missing-precedence-candidate",
      `${field} needs at least a grade-band default.`,
    );
  }
  const winnerCandidate = candidates[winnerSource];
  if (winnerCandidate === undefined) {
    throw new ParentRuntimeError(
      "missing-precedence-candidate",
      `${field} winner was not configured.`,
    );
  }

  const winnerIndex = CARD5_OBLIGATION_PROJECTION_ORDER.indexOf(winnerSource);
  const considered = CARD5_OBLIGATION_PROJECTION_ORDER.map((source, index) => {
    const candidate = candidates[source];
    if (candidate === undefined) {
      return {
        source,
        label: SOURCE_LABELS[source],
        configured: false,
        value: undefined,
        outcome: "not-configured" as const,
        explanation: `${SOURCE_LABELS[source]} did not provide this setting.`,
      };
    }
    if (index === winnerIndex) {
      return {
        source,
        label: SOURCE_LABELS[source],
        configured: true,
        value: candidate.value,
        outcome: "selected" as const,
        explanation: `${SOURCE_LABELS[source]} won because it is the highest-precedence configured source.`,
      };
    }
    return {
      source,
      label: SOURCE_LABELS[source],
      configured: true,
      value: candidate.value,
      outcome: "superseded-by-higher-precedence" as const,
      explanation: `${SOURCE_LABELS[source]} was retained for traceability while a higher-precedence setting remained effective.`,
    };
  });

  return {
    field,
    policyId: CARD5_POLICY_ID,
    policyVersion: CARD5_POLICY_VERSION,
    status: "resolved",
    reasonCode: "policy.obligation-resolved",
    winner: {
      source: winnerSource,
      label: SOURCE_LABELS[winnerSource],
      value: winnerCandidate.value,
      reason: `${winnerCandidate.reason} ${SOURCE_LABELS[winnerSource]} is the highest-precedence configured source for this setting.`,
    },
    considered,
  };
}

function candidate<T>(
  value: T | undefined,
  reason: string,
): PrecedenceCandidate<T> | undefined {
  return value === undefined ? undefined : { value, reason };
}

function latestRequiredAccommodationSettings(
  accommodations: readonly ParentAccommodation[],
): RuntimeSettingBundle & { readonly ids: readonly string[] } {
  const required = accommodations.filter(
    (item) => item.enabled && item.required,
  );
  const breakValues = required.flatMap((item) =>
    item.breakDurationMinutes === undefined ? [] : [item.breakDurationMinutes],
  );
  const timerValues = required.flatMap((item) =>
    item.timersHidden === undefined ? [] : [item.timersHidden],
  );
  return {
    ...(breakValues.length === 0
      ? {}
      : { breakDurationMinutes: Math.max(...breakValues) }),
    ...(timerValues.length === 0
      ? {}
      : { timersHidden: timerValues.some(Boolean) }),
    ids: required.map(({ accommodationId }) => accommodationId),
  };
}

function activeRecommendation(
  state: Pick<ParentRuntimeState, "activeRecommendationId" | "recommendations">,
): ParentSafeRecommendation | undefined {
  if (state.activeRecommendationId === undefined) return undefined;
  return state.recommendations.find(
    ({ recommendationId }) => recommendationId === state.activeRecommendationId,
  );
}

function latestRecommendationDecision(
  state: Pick<
    ParentRuntimeState,
    "recommendationDecisions" | "recommendations"
  >,
):
  | {
      readonly recommendation: ParentSafeRecommendation;
      readonly decision: "accepted" | "rejected";
    }
  | undefined {
  for (
    let index = state.recommendationDecisions.length - 1;
    index >= 0;
    index -= 1
  ) {
    const decision = state.recommendationDecisions[index];
    if (decision === undefined) continue;
    const recommendation = state.recommendations.find(
      ({ recommendationId }) => recommendationId === decision.recommendationId,
    );
    if (recommendation !== undefined) {
      return { recommendation, decision: decision.decision };
    }
  }
  return undefined;
}

function card5ManualOverride(
  record: ManualDurationOverrideRecord | undefined,
): Card5ManualOverride | undefined {
  if (record === undefined) return undefined;
  if (!record.active) {
    return {
      overrideId: record.overrideId,
      active: false,
      mode: record.mode,
      ...(record.targetMinutes === undefined
        ? {}
        : { targetMinutes: record.targetMinutes }),
    };
  }
  if (record.mode === "hold") {
    return {
      overrideId: record.overrideId,
      active: true,
      mode: "hold",
    };
  }
  if (record.targetMinutes === undefined) return undefined;
  return {
    overrideId: record.overrideId,
    active: true,
    mode: record.mode,
    targetMinutes: record.targetMinutes,
  };
}

function resolveEffectiveSettings(
  state: Pick<
    ParentRuntimeState,
    | "safetyLimit"
    | "gradeBandDefault"
    | "adultHardMaximums"
    | "parentManualOverride"
    | "manualDurationOverride"
    | "durationPolicyContext"
    | "activeRecommendationId"
    | "recommendations"
    | "recommendationDecisions"
    | "accommodations"
    | "controlSetId"
  >,
): EffectiveParentSettings {
  const accommodation = latestRequiredAccommodationSettings(
    state.accommodations,
  );
  const recommendation = activeRecommendation(state);
  const latestDecision = latestRecommendationDecision(state);
  const accommodationReason =
    accommodation.ids.length === 0
      ? "No required accommodation supplied this value."
      : `Required functional accommodation ${accommodation.ids.join(", ")} supplied this value.`;

  const recommendationForPolicy =
    recommendation !== undefined
      ? {
          recommendationId: recommendation.recommendationId,
          state: "accepted" as const,
          ...(recommendation.suggestedMaximumWorkDurationMinutes === undefined
            ? {}
            : {
                targetMinutes:
                  recommendation.suggestedMaximumWorkDurationMinutes,
              }),
        }
      : latestDecision === undefined
        ? undefined
        : {
            recommendationId: latestDecision.recommendation.recommendationId,
            state: latestDecision.decision,
            ...(latestDecision.recommendation
              .suggestedMaximumWorkDurationMinutes === undefined
              ? {}
              : {
                  targetMinutes:
                    latestDecision.recommendation
                      .suggestedMaximumWorkDurationMinutes,
                }),
          };
  const manualOverrideForPolicy = card5ManualOverride(
    state.manualDurationOverride,
  );

  const maximumWorkDurationMinutes = resolveCard5Duration({
    policyVersion: state.durationPolicyContext.policyVersion,
    integrityValid: state.durationPolicyContext.integrityValid,
    actorAuthorized: state.durationPolicyContext.actorAuthorized,
    safety: {
      constraintId:
        state.safetyLimit.constraintId ?? `safety:${state.controlSetId}`,
      ...(state.safetyLimit.minimumWorkDurationMinutes === undefined
        ? {}
        : {
            minimumMinutes: state.safetyLimit.minimumWorkDurationMinutes,
          }),
      ...(state.safetyLimit.maximumWorkDurationMinutes === undefined
        ? {}
        : {
            maximumMinutes: state.safetyLimit.maximumWorkDurationMinutes,
          }),
      ...(state.safetyLimit.veto === undefined
        ? {}
        : { veto: state.safetyLimit.veto }),
    },
    accommodations: state.accommodations
      .filter(({ required }) => required)
      .map((item) => ({
        accommodationId: item.accommodationId,
        active: item.enabled,
        ...(item.minimumWorkDurationMinutes === undefined
          ? {}
          : { minimumMinutes: item.minimumWorkDurationMinutes }),
        ...(item.maximumWorkDurationMinutes === undefined
          ? {}
          : { maximumMinutes: item.maximumWorkDurationMinutes }),
      })),
    adultHardMaximums: state.adultHardMaximums.map(
      (item): Card5AdultHardMaximum => ({
        hardMaximumId: item.hardMaximumId,
        active: item.active,
        minutes: item.minutes,
      }),
    ),
    ...(manualOverrideForPolicy === undefined
      ? {}
      : { manualOverride: manualOverrideForPolicy }),
    ...(recommendationForPolicy === undefined
      ? {}
      : { recommendation: recommendationForPolicy }),
    ...(state.durationPolicyContext.establishedTargetMinutes === undefined
      ? {}
      : {
          establishedTargetMinutes:
            state.durationPolicyContext.establishedTargetMinutes,
        }),
    currentMinutes: state.durationPolicyContext.currentMinutes,
    gradeBandDefaultMinutes: state.gradeBandDefault.maximumWorkDurationMinutes,
  });

  const breakDurationMinutes = resolveParentObligation(
    "break-duration-minutes",
    {
      "safety-limit": candidate(
        state.safetyLimit.breakDurationMinutes,
        "The active safety guardrail controls break duration.",
      ),
      "required-accommodation": candidate(
        accommodation.breakDurationMinutes,
        accommodationReason,
      ),
      "parent-explicit-manual-override": candidate(
        state.parentManualOverride.breakDurationMinutes,
        "The parent set an explicit manual break duration.",
      ),
      "engine-recommendation": candidate(
        recommendation?.suggestedBreakDurationMinutes,
        "The parent accepted this engine recommendation.",
      ),
      "grade-band-default": candidate(
        state.gradeBandDefault.breakDurationMinutes,
        "The grade-band planning default applies when no higher setting is configured.",
      ),
    },
  );

  const timersHidden = resolveParentObligation("timers-hidden", {
    "safety-limit": candidate(
      state.safetyLimit.timersHidden,
      "The active safety guardrail controls timer presentation.",
    ),
    "required-accommodation": candidate(
      accommodation.timersHidden,
      accommodationReason,
    ),
    "parent-explicit-manual-override": candidate(
      state.parentManualOverride.timersHidden,
      "The parent set an explicit timer-visibility preference.",
    ),
    "grade-band-default": candidate(
      state.gradeBandDefault.timersHidden,
      "The grade-band presentation default applies when no higher setting is configured.",
    ),
  });

  return {
    maximumWorkDurationMinutes: maximumWorkDurationMinutes.targetMinutes,
    breakDurationMinutes: breakDurationMinutes.winner.value,
    timersHidden: timersHidden.winner.value,
    traces: {
      maximumWorkDurationMinutes,
      breakDurationMinutes,
      timersHidden,
    },
  };
}

function uniqueIds(values: readonly string[], field: string): void {
  values.forEach((value) => assertId(value, field));
  if (new Set(values).size !== values.length) {
    throw new ParentRuntimeError(
      "duplicate-record-id",
      `${field} must not contain duplicate identifiers.`,
    );
  }
}

export function createParentRuntimeState(
  input: CreateParentRuntimeInput,
): ParentRuntimeState {
  assertId(input.controlSetId, "controlSetId");
  assertId(input.studentRef, "studentRef");
  assertId(input.privateRecordRef, "privateRecordRef");
  assertTimestamp(input.at, "at");
  validateBundle(input.gradeBandDefault, "gradeBandDefault");
  validateBundle(input.safetyLimit ?? {}, "safetyLimit");
  validateBundle(input.parentManualOverride ?? {}, "parentManualOverride");
  if (input.safetyLimit?.constraintId !== undefined) {
    assertId(input.safetyLimit.constraintId, "safetyLimit.constraintId");
  }
  if (input.safetyLimit?.minimumWorkDurationMinutes !== undefined) {
    assertDuration(
      input.safetyLimit.minimumWorkDurationMinutes,
      "safetyLimit.minimumWorkDurationMinutes",
      240,
    );
  }
  if (input.parentHardMaximumWorkDurationMinutes !== undefined) {
    assertDuration(
      input.parentHardMaximumWorkDurationMinutes,
      "parentHardMaximumWorkDurationMinutes",
      240,
    );
  }
  const recommendations = input.recommendations ?? [];
  uniqueIds(
    recommendations.map(({ recommendationId }) => recommendationId),
    "recommendations.recommendationId",
  );
  const accommodations = (input.accommodations ?? []).map((item, index) => {
    assertId(item.accommodationId, `accommodations[${index}].accommodationId`);
    assertTimestamp(item.addedAt, `accommodations[${index}].addedAt`);
    if (item.minimumWorkDurationMinutes !== undefined) {
      assertDuration(
        item.minimumWorkDurationMinutes,
        `accommodations[${index}].minimumWorkDurationMinutes`,
        240,
      );
    }
    if (item.maximumWorkDurationMinutes !== undefined) {
      assertDuration(
        item.maximumWorkDurationMinutes,
        `accommodations[${index}].maximumWorkDurationMinutes`,
        240,
      );
    }
    if (item.breakDurationMinutes !== undefined) {
      assertDuration(
        item.breakDurationMinutes,
        `accommodations[${index}].breakDurationMinutes`,
        120,
      );
    }
    return {
      ...item,
      functionalDescription: normalizedFunctionalText(
        item.functionalDescription,
        `accommodations[${index}].functionalDescription`,
      ),
      studentMessage: normalizedFunctionalText(
        item.studentMessage,
        `accommodations[${index}].studentMessage`,
      ),
    };
  });
  uniqueIds(
    accommodations.map(({ accommodationId }) => accommodationId),
    "accommodations.accommodationId",
  );
  const knownIncompleteBlockIds = input.knownIncompleteBlockIds ?? [];
  uniqueIds(knownIncompleteBlockIds, "knownIncompleteBlockIds");
  const initialHardMaximumInputs: readonly AdultHardMaximumRecord[] =
    input.adultHardMaximums ??
    (input.parentHardMaximumWorkDurationMinutes === undefined
      ? []
      : [
          {
            hardMaximumId: `hard-maximum:${input.controlSetId}`,
            active: true,
            minutes: input.parentHardMaximumWorkDurationMinutes,
            setAt: input.at,
            reason: "Initial authorized adult hard maximum.",
          },
        ]);
  const initialHardMaximums = initialHardMaximumInputs.map((item, index) => {
    assertId(
      item.hardMaximumId,
      `adultHardMaximums[${index}].hardMaximumId`,
    );
    assertDuration(item.minutes, `adultHardMaximums[${index}].minutes`, 240);
    assertTimestamp(item.setAt, `adultHardMaximums[${index}].setAt`);
    if (item.setBy !== undefined) {
      assertParentTeacherActor(
        item.setBy,
        `adultHardMaximums[${index}].setBy`,
      );
    }
    return {
      ...item,
      reason: normalizedFunctionalText(
        item.reason,
        `adultHardMaximums[${index}].reason`,
      ),
    };
  });
  uniqueIds(
    initialHardMaximums.map(({ hardMaximumId }) => hardMaximumId),
    "adultHardMaximums.hardMaximumId",
  );
  const mostRestrictiveHardMaximum = initialHardMaximums
    .filter(({ active }) => active)
    .reduce<
      number | undefined
    >((minimum, item) => (minimum === undefined ? item.minutes : Math.min(minimum, item.minutes)), undefined);
  const initialManualDurationOverrideInput =
    input.manualDurationOverride ??
    (input.parentManualOverride?.maximumWorkDurationMinutes === undefined
      ? undefined
      : {
          overrideId: `manual-override:${input.controlSetId}`,
          active: true,
          mode: "target" as const,
          targetMinutes: input.parentManualOverride.maximumWorkDurationMinutes,
          setAt: input.at,
          reason: "Initial authorized adult manual override.",
        });
  const initialManualDurationOverride =
    initialManualDurationOverrideInput === undefined
      ? undefined
      : {
          ...initialManualDurationOverrideInput,
          reason: normalizedFunctionalText(
            initialManualDurationOverrideInput.reason,
            "manualDurationOverride.reason",
          ),
        };
  if (initialManualDurationOverride !== undefined) {
    assertId(
      initialManualDurationOverride.overrideId,
      "manualDurationOverride.overrideId",
    );
    assertTimestamp(
      initialManualDurationOverride.setAt,
      "manualDurationOverride.setAt",
    );
    if (
      initialManualDurationOverride.mode !== "hold" &&
      initialManualDurationOverride.targetMinutes === undefined
    ) {
      throw new ParentRuntimeError(
        "invalid-duration",
        "A target or reduce manual override requires targetMinutes.",
      );
    }
    if (initialManualDurationOverride.targetMinutes !== undefined) {
      assertDuration(
        initialManualDurationOverride.targetMinutes,
        "manualDurationOverride.targetMinutes",
        240,
      );
    }
    if (initialManualDurationOverride.setBy !== undefined) {
      assertParentTeacherActor(
        initialManualDurationOverride.setBy,
        "manualDurationOverride.setBy",
      );
    }
  }
  const durationPolicyContext: DurationPolicyContext = {
    policyVersion:
      input.durationPolicyContext?.policyVersion ?? CARD5_POLICY_VERSION,
    integrityValid: input.durationPolicyContext?.integrityValid ?? true,
    actorAuthorized: input.durationPolicyContext?.actorAuthorized ?? true,
    currentMinutes:
      input.durationPolicyContext?.currentMinutes ??
      input.gradeBandDefault.maximumWorkDurationMinutes,
    ...(input.durationPolicyContext?.establishedTargetMinutes === undefined
      ? {}
      : {
          establishedTargetMinutes:
            input.durationPolicyContext.establishedTargetMinutes,
        }),
  };
  assertDuration(
    durationPolicyContext.currentMinutes,
    "durationPolicyContext.currentMinutes",
    240,
  );
  if (durationPolicyContext.establishedTargetMinutes !== undefined) {
    assertDuration(
      durationPolicyContext.establishedTargetMinutes,
      "durationPolicyContext.establishedTargetMinutes",
      240,
    );
  }

  const unresolved = {
    kind: "calendar-parent-runtime-controls" as const,
    schemaVersion: PARENT_RUNTIME_SCHEMA_VERSION,
    controlSetId: input.controlSetId,
    studentRef: input.studentRef,
    gradeBand: input.gradeBand,
    revision: 0,
    createdAt: input.at,
    updatedAt: input.at,
    privateRecordRef: input.privateRecordRef,
    precedencePolicy: CARD5_RECONCILED_PARENT_POLICY,
    durationPolicyContext,
    safetyLimit: input.safetyLimit ?? {},
    gradeBandDefault: input.gradeBandDefault,
    ...(mostRestrictiveHardMaximum === undefined
      ? {}
      : {
          parentHardMaximumWorkDurationMinutes: mostRestrictiveHardMaximum,
        }),
    adultHardMaximums: initialHardMaximums,
    parentManualOverride: input.parentManualOverride ?? {},
    ...(initialManualDurationOverride === undefined
      ? {}
      : { manualDurationOverride: initialManualDurationOverride }),
    activeRecommendationId: undefined,
    recommendations,
    recommendationDecisions: [],
    accommodations,
    knownIncompleteBlockIds,
    incompleteWorkReschedules: [],
    interruptions: [],
    reviewRequests: [],
    processedEventIds: [],
    actionLog: [],
  };
  return {
    ...unresolved,
    effectiveSettings: resolveEffectiveSettings(unresolved),
  };
}

function validateActionBase(action: ParentControlAction): void {
  assertId(action.eventId, "eventId");
  assertId(action.actor.actorId, "actor.actorId");
  assertTimestamp(action.at, "at");
  if (action.expectedRevision !== undefined) {
    assertRevision(action.expectedRevision, "expectedRevision");
  }
  switch (action.type) {
    case "accept-recommendation":
    case "reject-recommendation":
    case "set-maximum-work-duration":
    case "set-break-duration":
    case "set-timers-hidden":
    case "add-accommodation":
    case "reschedule-incomplete-work":
    case "mark-interruption":
      assertParentTeacherActor(action.actor, "actor");
      break;
    case "add-private-note":
    case "request-adult-review":
      break;
  }
}

type ConcurrentAdultOverrideTarget =
  | "work-duration"
  | "break-duration"
  | "timer-visibility"
  | `recommendation:${string}`;

function concurrentAdultOverrideTarget(
  action: ParentControlAction,
): ConcurrentAdultOverrideTarget | undefined {
  switch (action.type) {
    case "set-maximum-work-duration":
      return "work-duration";
    case "set-break-duration":
      return "break-duration";
    case "set-timers-hidden":
      return "timer-visibility";
    case "accept-recommendation":
    case "reject-recommendation":
      return `recommendation:${action.recommendationId}`;
    default:
      return undefined;
  }
}

function hasExistingAdultOverrideForTarget(
  state: ParentRuntimeState,
  target: ConcurrentAdultOverrideTarget,
): boolean {
  if (target.startsWith("recommendation:")) {
    const recommendationId = target.slice("recommendation:".length);
    return state.recommendationDecisions.some(
      (decision) => decision.recommendationId === recommendationId,
    );
  }
  if (target === "work-duration") {
    return (
      state.manualDurationOverride !== undefined ||
      state.adultHardMaximums.length > 0 ||
      state.actionLog.some(
        ({ type }) => type === "set-maximum-work-duration",
      )
    );
  }
  if (target === "break-duration") {
    return (
      state.parentManualOverride.breakDurationMinutes !== undefined ||
      state.actionLog.some(({ type }) => type === "set-break-duration")
    );
  }
  return (
    state.parentManualOverride.timersHidden !== undefined ||
    state.actionLog.some(({ type }) => type === "set-timers-hidden")
  );
}

function assertConcurrencyGate(
  state: ParentRuntimeState,
  action: ParentControlAction,
): void {
  if (Date.parse(action.at) < Date.parse(state.updatedAt)) {
    throw new ParentRuntimeError(
      "invalid-timestamp",
      "A new parent-control action cannot predate the current state.",
    );
  }

  if (action.expectedRevision !== undefined) {
    if (action.expectedRevision !== state.revision) {
      throw new ParentRuntimeError(
        "stale-revision",
        `The control changed before this action was applied. Expected revision ${action.expectedRevision}; current revision is ${state.revision}. Refresh and review the current setting before trying again.`,
      );
    }
    return;
  }

  const target = concurrentAdultOverrideTarget(action);
  if (
    target !== undefined &&
    hasExistingAdultOverrideForTarget(state, target)
  ) {
    throw new ParentRuntimeError(
      "stale-revision",
      `A later ${target.startsWith("recommendation:") ? "recommendation decision" : target} change requires expectedRevision ${state.revision}; no implicit last-write-wins update was applied.`,
    );
  }
}

function appendLog(
  state: ParentRuntimeState,
  action: ParentControlAction,
  message: string,
  subjectRef?: string,
): ParentRuntimeState {
  const resultingRevision = state.revision + 1;
  const advanced = {
    ...state,
    revision: resultingRevision,
    updatedAt: action.at,
    processedEventIds: [...state.processedEventIds, action.eventId],
    actionLog: [
      ...state.actionLog,
      {
        eventId: action.eventId,
        type: action.type,
        at: action.at,
        actor: action.actor,
        ...(action.expectedRevision === undefined
          ? {}
          : { expectedRevision: action.expectedRevision }),
        appliedFromRevision: state.revision,
        resultingRevision,
        ...(subjectRef === undefined ? {} : { subjectRef }),
        message,
      },
    ],
  };
  return {
    ...advanced,
    effectiveSettings: resolveEffectiveSettings(advanced),
  };
}

function findRecommendation(
  state: ParentRuntimeState,
  recommendationId: string,
): ParentSafeRecommendation {
  assertId(recommendationId, "recommendationId");
  const recommendation = state.recommendations.find(
    (item) => item.recommendationId === recommendationId,
  );
  if (recommendation === undefined) {
    throw new ParentRuntimeError(
      "unknown-recommendation",
      "The recommendation is not part of this minimized parent projection.",
    );
  }
  return recommendation;
}

function assertNewRecordId(
  existing: readonly string[],
  value: string,
  field: string,
): void {
  assertId(value, field);
  if (existing.includes(value)) {
    throw new ParentRuntimeError(
      "duplicate-record-id",
      `${field} already exists.`,
    );
  }
}

/**
 * Applies one of the ten parent controls with an immutable, deterministic
 * update. Duplicate event IDs are idempotently ignored.
 */
export function applyParentControlAction(
  state: ParentRuntimeState,
  action: ParentControlAction,
): ParentControlOutcome {
  validateActionBase(action);
  if (state.processedEventIds.includes(action.eventId)) {
    return { state, duplicateIgnored: true };
  }
  assertConcurrencyGate(state, action);

  switch (action.type) {
    case "accept-recommendation": {
      findRecommendation(state, action.recommendationId);
      const decision: RecommendationDecision = {
        decisionId: action.eventId,
        recommendationId: action.recommendationId,
        decision: "accepted",
        decidedBy: action.actor,
        decidedAt: action.at,
        displayMessage:
          "Parent chose to apply this recommendation. The decision can be revisited.",
      };
      const changed = {
        ...state,
        activeRecommendationId: action.recommendationId,
        recommendationDecisions: [...state.recommendationDecisions, decision],
      };
      return {
        state: appendLog(
          changed,
          action,
          "Parent applied a study-setting recommendation.",
          action.recommendationId,
        ),
        duplicateIgnored: false,
      };
    }

    case "reject-recommendation": {
      findRecommendation(state, action.recommendationId);
      const decision: RecommendationDecision = {
        decisionId: action.eventId,
        recommendationId: action.recommendationId,
        decision: "rejected",
        decidedBy: action.actor,
        decidedAt: action.at,
        displayMessage:
          "Parent chose not to apply this recommendation. It remains available in history.",
      };
      const changed = {
        ...state,
        ...(state.activeRecommendationId === action.recommendationId
          ? { activeRecommendationId: undefined }
          : {}),
        recommendationDecisions: [...state.recommendationDecisions, decision],
      };
      return {
        state: appendLog(
          changed,
          action,
          "Parent kept the current setting; the recommendation remains in history.",
          action.recommendationId,
        ),
        duplicateIgnored: false,
      };
    }

    case "set-maximum-work-duration": {
      assertDuration(action.minutes, "minutes", 240);
      const reason = normalizedFunctionalText(action.reason, "reason");
      let changed: ParentRuntimeState;
      if (action.scope === "hard-maximum") {
        const adultHardMaximums = [
          ...state.adultHardMaximums.map((item) =>
            item.active &&
            item.setBy?.actorId === action.actor.actorId &&
            item.setBy.role === action.actor.role
              ? { ...item, active: false }
              : item,
          ),
          {
            hardMaximumId: action.eventId,
            active: true,
            minutes: action.minutes,
            setAt: action.at,
            reason,
            setBy: action.actor,
          },
        ];
        const mostRestrictive = Math.min(
          ...adultHardMaximums
            .filter(({ active }) => active)
            .map(({ minutes }) => minutes),
        );
        changed = {
          ...state,
          parentHardMaximumWorkDurationMinutes: mostRestrictive,
          adultHardMaximums,
        };
      } else {
        const mode = action.manualMode ?? "target";
        changed = {
          ...state,
          parentManualOverride: {
            ...state.parentManualOverride,
            maximumWorkDurationMinutes:
              mode === "hold"
                ? state.durationPolicyContext.currentMinutes
                : action.minutes,
          },
          manualDurationOverride: {
            overrideId: action.eventId,
            active: true,
            mode,
            ...(mode === "hold" ? {} : { targetMinutes: action.minutes }),
            setAt: action.at,
            reason,
            setBy: action.actor,
          },
        };
      }
      return {
        state: appendLog(
          changed,
          action,
          `Parent set a ${action.scope === "hard-maximum" ? "hard maximum" : "manual work-duration override"}: ${reason}`,
        ),
        duplicateIgnored: false,
      };
    }

    case "set-break-duration": {
      assertDuration(action.minutes, "minutes", 120);
      const reason = normalizedFunctionalText(action.reason, "reason");
      const changed = {
        ...state,
        parentManualOverride: {
          ...state.parentManualOverride,
          breakDurationMinutes: action.minutes,
        },
      };
      return {
        state: appendLog(
          changed,
          action,
          `Parent set break duration: ${reason}`,
        ),
        duplicateIgnored: false,
      };
    }

    case "set-timers-hidden": {
      const reason = normalizedFunctionalText(action.reason, "reason");
      const changed = {
        ...state,
        parentManualOverride: {
          ...state.parentManualOverride,
          timersHidden: action.hidden,
        },
      };
      return {
        state: appendLog(
          changed,
          action,
          `Parent ${action.hidden ? "hid" : "showed"} timers: ${reason}`,
        ),
        duplicateIgnored: false,
      };
    }

    case "add-accommodation": {
      assertNewRecordId(
        state.accommodations.map(({ accommodationId }) => accommodationId),
        action.accommodationId,
        "accommodationId",
      );
      if (action.minimumWorkDurationMinutes !== undefined) {
        assertDuration(
          action.minimumWorkDurationMinutes,
          "minimumWorkDurationMinutes",
          240,
        );
      }
      if (action.maximumWorkDurationMinutes !== undefined) {
        assertDuration(
          action.maximumWorkDurationMinutes,
          "maximumWorkDurationMinutes",
          240,
        );
      }
      if (action.breakDurationMinutes !== undefined) {
        assertDuration(
          action.breakDurationMinutes,
          "breakDurationMinutes",
          120,
        );
      }
      const functionalDescription = normalizedFunctionalText(
        action.functionalDescription,
        "functionalDescription",
      );
      const studentMessage = normalizedFunctionalText(
        action.studentMessage,
        "studentMessage",
      );
      const accommodation: ParentAccommodation = {
        accommodationId: action.accommodationId,
        enabled: true,
        required: action.required,
        functionalDescription,
        studentMessage,
        source: action.source,
        addedAt: action.at,
        ...(action.minimumWorkDurationMinutes === undefined
          ? {}
          : {
              minimumWorkDurationMinutes: action.minimumWorkDurationMinutes,
            }),
        ...(action.maximumWorkDurationMinutes === undefined
          ? {}
          : {
              maximumWorkDurationMinutes: action.maximumWorkDurationMinutes,
            }),
        ...(action.breakDurationMinutes === undefined
          ? {}
          : { breakDurationMinutes: action.breakDurationMinutes }),
        ...(action.timersHidden === undefined
          ? {}
          : { timersHidden: action.timersHidden }),
      };
      const changed = {
        ...state,
        accommodations: [...state.accommodations, accommodation],
      };
      return {
        state: appendLog(
          changed,
          action,
          "Parent added a functional accommodation without diagnosis language.",
          action.accommodationId,
        ),
        duplicateIgnored: false,
      };
    }

    case "reschedule-incomplete-work": {
      assertNewRecordId(
        state.incompleteWorkReschedules.map(({ rescheduleId }) => rescheduleId),
        action.rescheduleId,
        "rescheduleId",
      );
      assertId(action.blockId, "blockId");
      if (!state.knownIncompleteBlockIds.includes(action.blockId)) {
        throw new ParentRuntimeError(
          "unknown-incomplete-work",
          "Only a known incomplete block may be rescheduled.",
        );
      }
      assertTimestamp(action.originalStartAt, "originalStartAt");
      assertTimestamp(action.replacementStartAt, "replacementStartAt");
      if (
        action.originalStartAt === action.replacementStartAt ||
        Date.parse(action.replacementStartAt) <= Date.parse(action.at)
      ) {
        throw new ParentRuntimeError(
          "invalid-timestamp",
          "Replacement time must differ from the original and follow the parent action.",
        );
      }
      const reason = normalizedFunctionalText(action.reason, "reason");
      const changed = {
        ...state,
        incompleteWorkReschedules: [
          ...state.incompleteWorkReschedules,
          {
            rescheduleId: action.rescheduleId,
            blockId: action.blockId,
            originalStartAt: action.originalStartAt,
            replacementStartAt: action.replacementStartAt,
            changedBy: action.actor,
            changedAt: action.at,
            reason,
          },
        ],
      };
      return {
        state: appendLog(
          changed,
          action,
          "Parent rescheduled incomplete work.",
          action.blockId,
        ),
        duplicateIgnored: false,
      };
    }

    case "mark-interruption": {
      assertNewRecordId(
        state.interruptions.map(({ interruptionId }) => interruptionId),
        action.interruptionId,
        "interruptionId",
      );
      if (action.blockId !== undefined) assertId(action.blockId, "blockId");
      assertTimestamp(action.occurredAt, "occurredAt");
      if (Date.parse(action.occurredAt) > Date.parse(action.at)) {
        throw new ParentRuntimeError(
          "invalid-timestamp",
          "An interruption cannot occur after it was recorded.",
        );
      }
      const changed = {
        ...state,
        interruptions: [
          ...state.interruptions,
          {
            interruptionId: action.interruptionId,
            kind: action.kind,
            ...(action.blockId === undefined
              ? {}
              : { blockId: action.blockId }),
            occurredAt: action.occurredAt,
            recordedAt: action.at,
            recordedBy: action.actor,
          },
        ],
      };
      return {
        state: appendLog(
          changed,
          action,
          `Parent marked the ${action.kind} interruption.`,
          action.blockId,
        ),
        duplicateIgnored: false,
      };
    }

    case "add-private-note": {
      assertId(action.noteId, "noteId");
      const changed = appendLog(
        state,
        action,
        "Adult-private note was routed to the separately authorized record.",
        action.noteId,
      );
      return {
        state: changed,
        adultPrivateWrite: {
          recordId: state.privateRecordRef,
          studentRef: state.studentRef,
          noteId: action.noteId,
          author: action.actor,
          category: action.category,
          body: action.body,
          at: action.at,
        },
        duplicateIgnored: false,
      };
    }

    case "request-adult-review": {
      assertNewRecordId(
        state.reviewRequests.map(({ requestId }) => requestId),
        action.requestId,
        "requestId",
      );
      assertId(action.subjectRef, "subjectRef");
      uniqueIds(action.basisEvidenceIds, "basisEvidenceIds");
      const reason = normalizedFunctionalText(action.reason, "reason");
      const changed = {
        ...state,
        reviewRequests: [
          ...state.reviewRequests,
          {
            requestId: action.requestId,
            audience: action.audience,
            subjectRef: action.subjectRef,
            reason,
            requestedAt: action.at,
            requestedBy: action.actor,
            status: "open" as const,
            basisEvidenceIds: [...action.basisEvidenceIds],
          },
        ],
      };
      return {
        state: appendLog(
          changed,
          action,
          `Parent requested ${action.audience} review.`,
          action.subjectRef,
        ),
        duplicateIgnored: false,
      };
    }
  }
}

export interface MobileParentControlSpec {
  readonly action:
    | "Accept recommendation"
    | "Reject recommendation"
    | "Set maximum work duration"
    | "Set break duration"
    | "Hide timers"
    | "Add accommodation"
    | "Reschedule incomplete work"
    | "Mark interruption"
    | "Add private note"
    | "Request teacher or tutor review";
  readonly minimumTouchTargetPixels: 44;
  readonly fullWidthOnNarrowScreens: true;
}

export interface MobileParentViewModel {
  readonly schemaVersion: "calendar-parent-runtime.mobile-parent.v1";
  readonly studentRef: string;
  readonly layout: {
    readonly baselineColumns: 1;
    readonly usesDataTables: false;
    readonly wrapsLongText: true;
  };
  readonly effectiveSettings: {
    readonly maximumWorkDurationMinutes: number | null;
    readonly breakDurationMinutes: number;
    readonly timerPresentation: "hidden" | "milestones-only";
  };
  readonly durationPolicy: {
    readonly policyId: typeof CARD5_POLICY_ID;
    readonly status: Card5DurationResolution["status"];
    readonly reasonCode: Card5DurationResolution["reasonCode"];
    readonly lowerBound: number | undefined;
    readonly upperBound: number | undefined;
    readonly appliedConstraints: readonly string[];
  };
  readonly settingWinners: readonly {
    readonly setting: string;
    readonly wonBy: string;
    readonly reason: string;
  }[];
  readonly recommendationCards: readonly {
    readonly recommendationId: string;
    readonly summary: string;
    readonly decision: "pending" | "accepted" | "rejected";
    readonly decisionMessage: string;
  }[];
  readonly availableControls: readonly MobileParentControlSpec[];
  readonly privateNotes: {
    readonly recordRef: string;
    readonly access: "authorized-adults-only";
    readonly bodyIncluded: false;
  };
}

const MOBILE_ACTIONS: readonly MobileParentControlSpec["action"][] = [
  "Accept recommendation",
  "Reject recommendation",
  "Set maximum work duration",
  "Set break duration",
  "Hide timers",
  "Add accommodation",
  "Reschedule incomplete work",
  "Mark interruption",
  "Add private note",
  "Request teacher or tutor review",
];

function latestDecision(
  state: ParentRuntimeState,
  recommendationId: string,
): RecommendationDecision | undefined {
  for (
    let index = state.recommendationDecisions.length - 1;
    index >= 0;
    index -= 1
  ) {
    const decision = state.recommendationDecisions[index];
    if (decision?.recommendationId === recommendationId) return decision;
  }
  return undefined;
}

/**
 * Produces a card/list model suitable for a narrow parent dashboard. It never
 * receives or exposes the adult-private record.
 */
export function buildMobileParentViewModel(
  state: ParentRuntimeState,
): MobileParentViewModel {
  const traces = state.effectiveSettings.traces;
  return {
    schemaVersion: "calendar-parent-runtime.mobile-parent.v1",
    studentRef: state.studentRef,
    layout: {
      baselineColumns: 1,
      usesDataTables: false,
      wrapsLongText: true,
    },
    effectiveSettings: {
      maximumWorkDurationMinutes:
        state.effectiveSettings.maximumWorkDurationMinutes,
      breakDurationMinutes: state.effectiveSettings.breakDurationMinutes,
      timerPresentation: state.effectiveSettings.timersHidden
        ? "hidden"
        : "milestones-only",
    },
    durationPolicy: {
      policyId: traces.maximumWorkDurationMinutes.policyId,
      status: traces.maximumWorkDurationMinutes.status,
      reasonCode: traces.maximumWorkDurationMinutes.reasonCode,
      lowerBound: traces.maximumWorkDurationMinutes.lowerBound,
      upperBound: traces.maximumWorkDurationMinutes.upperBound,
      appliedConstraints: traces.maximumWorkDurationMinutes.appliedConstraints
        .filter(({ active }) => active)
        .map(({ constraintId }) => constraintId),
    },
    settingWinners: [
      {
        setting: "Maximum work duration",
        wonBy: traces.maximumWorkDurationMinutes.winner.label,
        reason: traces.maximumWorkDurationMinutes.winner.reason,
      },
      {
        setting: "Break duration",
        wonBy: traces.breakDurationMinutes.winner.label,
        reason: traces.breakDurationMinutes.winner.reason,
      },
      {
        setting: "Timer visibility",
        wonBy: traces.timersHidden.winner.label,
        reason: traces.timersHidden.winner.reason,
      },
    ],
    recommendationCards: state.recommendations.map((recommendation) => {
      const decision = latestDecision(state, recommendation.recommendationId);
      return {
        recommendationId: recommendation.recommendationId,
        summary: recommendation.summary,
        decision: decision?.decision ?? "pending",
        decisionMessage:
          decision?.displayMessage ??
          "No parent decision has been recorded for this recommendation.",
      };
    }),
    availableControls: MOBILE_ACTIONS.map((action) => ({
      action,
      minimumTouchTargetPixels: 44,
      fullWidthOnNarrowScreens: true,
    })),
    privateNotes: {
      recordRef: state.privateRecordRef,
      access: "authorized-adults-only",
      bodyIncluded: false,
    },
  };
}

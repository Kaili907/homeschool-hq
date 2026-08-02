import {
  BREAK_TYPES,
  type BreakAction,
  type BreakContext,
  type BreakPolicy,
  type BreakReasonCode,
  type BreakRecommendation,
  type BreakType,
} from "./types";

export const DEFAULT_BREAK_POLICY: Readonly<BreakPolicy> = Object.freeze({
  plannedBlockMinutes: 20,
  defaultBreakMinutes: 5,
  movementBreakMinutes: 5,
  waterBreakMinutes: 3,
  screenRestMinutes: 5,
  quietResetMinutes: 5,
  parentConfiguredMinutes: 5,
  extensionIncrementMinutes: 2,
  maxExtensionMinutes: 5,
  maxTotalBreakMinutes: 10,
  repeatedBreakWindowMinutes: 45,
  repeatedBreakThreshold: 3,
  refusalCheckpointMinutes: 5,
  screenRestAfterMinutes: 20,
  maxSessionMinutes: 120,
  allowedParentActivityIds: Object.freeze([]),
});

const BREAK_TYPE_SET: ReadonlySet<string> = new Set(BREAK_TYPES);

const SAFE_MESSAGES: Readonly<Record<BreakAction, string>> = {
  start_break: "A break is available now. Taking an approved break is part of the plan.",
  continue_break: "The break is still in progress. Resume when the timer ends or when the plan says you are ready.",
  extend_break: "A short extension is available. The break will still end at the configured limit.",
  resume: "Welcome back. Return to the previous work step and begin with one manageable item.",
  resume_or_finish: "The break limit has been reached. Resume gently, or finish this block with adult support.",
  continue_work: "Continue the current block and check in again at the next planned point.",
  honor_break_refusal: "It is okay to decline this break. Continue for now and check in again soon.",
  finish_session: "The session can finish here. Stopping at the configured limit is part of the plan.",
  insufficient_data: "The break plan needs a settings check before making an automatic recommendation.",
};

function isFiniteAtLeast(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isBreakType(value: unknown): value is BreakType {
  return typeof value === "string" && BREAK_TYPE_SET.has(value);
}

function resolvePolicy(context: BreakContext): BreakPolicy | undefined {
  if (context.policy !== undefined && !isRecord(context.policy)) {
    return undefined;
  }
  const policy: BreakPolicy = {
    ...DEFAULT_BREAK_POLICY,
    ...context.policy,
    allowedParentActivityIds:
      context.policy?.allowedParentActivityIds ??
      DEFAULT_BREAK_POLICY.allowedParentActivityIds,
  };

  const positiveFields = [
    "plannedBlockMinutes",
    "defaultBreakMinutes",
    "movementBreakMinutes",
    "waterBreakMinutes",
    "screenRestMinutes",
    "quietResetMinutes",
    "parentConfiguredMinutes",
    "extensionIncrementMinutes",
    "maxTotalBreakMinutes",
    "repeatedBreakWindowMinutes",
    "refusalCheckpointMinutes",
    "screenRestAfterMinutes",
    "maxSessionMinutes",
  ] as const satisfies readonly (keyof BreakPolicy)[];

  if (
    positiveFields.some((field) => !isFiniteAtLeast(policy[field], Number.EPSILON)) ||
    !isFiniteAtLeast(policy.maxExtensionMinutes, 0) ||
    !Number.isInteger(policy.repeatedBreakThreshold) ||
    policy.repeatedBreakThreshold < 1 ||
    policy.maxExtensionMinutes > policy.maxTotalBreakMinutes ||
    !Array.isArray(policy.allowedParentActivityIds) ||
    policy.allowedParentActivityIds.some(
      (id) => typeof id !== "string" || id.trim().length === 0,
    )
  ) {
    return undefined;
  }

  const configuredDurations = [
    policy.defaultBreakMinutes,
    policy.movementBreakMinutes,
    policy.waterBreakMinutes,
    policy.screenRestMinutes,
    policy.quietResetMinutes,
    policy.parentConfiguredMinutes,
  ];

  if (configuredDurations.some((duration) => duration > policy.maxTotalBreakMinutes)) {
    return undefined;
  }

  return policy;
}

function hasInvalidContext(context: BreakContext): boolean {
  if (
    !isFiniteAtLeast(context.blockElapsedMinutes, 0) ||
    !isFiniteAtLeast(context.sessionElapsedMinutes, 0) ||
    (context.screenMinutesSinceRest !== undefined &&
      !isFiniteAtLeast(context.screenMinutesSinceRest, 0))
  ) {
    return true;
  }

  if (
    !isOptionalBoolean(context.sessionGoalComplete) ||
    !isOptionalBoolean(context.breakRefused) ||
    (context.parentPlannedActivityId !== undefined &&
      typeof context.parentPlannedActivityId !== "string")
  ) {
    return true;
  }

  if (context.needs !== undefined) {
    if (!isRecord(context.needs)) {
      return true;
    }
    const needFlags = [
      context.needs.movementRequested,
      context.needs.waterRequested,
      context.needs.screenRestRequested,
      context.needs.quietResetRequested,
      context.needs.possibleFatigue,
    ];
    if (needFlags.some((value) => !isOptionalBoolean(value))) {
      return true;
    }
  }

  if (context.studentRequest !== undefined) {
    if (!isRecord(context.studentRequest)) {
      return true;
    }
    if (
      (context.studentRequest.type !== undefined &&
        !isBreakType(context.studentRequest.type)) ||
      (context.studentRequest.parentActivityId !== undefined &&
        typeof context.studentRequest.parentActivityId !== "string")
    ) {
      return true;
    }
  }

  if (
    context.studentRequest?.type !== undefined &&
    !isBreakType(context.studentRequest.type)
  ) {
    return true;
  }

  if (context.currentBreak) {
    const active = context.currentBreak;
    if (
      !isRecord(active) ||
      !isBreakType(active.type) ||
      !isFiniteAtLeast(active.baseDurationMinutes, Number.EPSILON) ||
      !isFiniteAtLeast(active.elapsedMinutes, 0) ||
      !isFiniteAtLeast(active.extensionMinutes, 0) ||
      !isOptionalBoolean(active.extensionRequested) ||
      !isOptionalBoolean(active.readyToResume)
    ) {
      return true;
    }
  }

  if (context.history !== undefined && !Array.isArray(context.history)) {
    return true;
  }

  return (context.history ?? []).some(
    (record) =>
      !isRecord(record) ||
      !isBreakType(record.type) ||
      !isFiniteAtLeast(record.endedAtSessionMinute, 0) ||
      record.endedAtSessionMinute > context.sessionElapsedMinutes ||
      typeof record.approved !== "boolean",
  );
}

function recommendation(
  action: BreakAction,
  options: {
    readonly approved?: boolean;
    readonly breakType?: BreakType;
    readonly durationMinutes?: number;
    readonly reasons: readonly BreakReasonCode[];
    readonly review?: BreakRecommendation["review"];
    readonly resume?: BreakRecommendation["resume"];
  },
): BreakRecommendation {
  return {
    action,
    ...(options.breakType === undefined ? {} : { breakType: options.breakType }),
    ...(options.durationMinutes === undefined
      ? {}
      : { durationMinutes: options.durationMinutes }),
    approved: options.approved ?? false,
    countsAsFailure: false,
    review: options.review ?? "none",
    reasons: options.reasons,
    resume:
      options.resume ??
      ({ mode: "not_applicable", returnTo: "none" } as const),
    safeMessage: SAFE_MESSAGES[action],
  };
}

function durationFor(type: BreakType, policy: BreakPolicy): number {
  switch (type) {
    case "movement":
      return policy.movementBreakMinutes;
    case "water":
      return policy.waterBreakMinutes;
    case "screen_rest":
      return policy.screenRestMinutes;
    case "quiet_reset":
      return policy.quietResetMinutes;
    case "parent_configured":
      return policy.parentConfiguredMinutes;
    case "planned":
    case "student_requested":
      return policy.defaultBreakMinutes;
  }
}

function recentApprovedBreakCount(
  context: BreakContext,
  policy: BreakPolicy,
): number {
  const windowStart = Math.max(
    0,
    context.sessionElapsedMinutes - policy.repeatedBreakWindowMinutes,
  );
  return (context.history ?? []).filter(
    (record) => record.approved && record.endedAtSessionMinute >= windowStart,
  ).length;
}

function reviewForNewBreak(
  context: BreakContext,
  policy: BreakPolicy,
): BreakRecommendation["review"] {
  return recentApprovedBreakCount(context, policy) + 1 >=
    policy.repeatedBreakThreshold
    ? "parent_or_teacher"
    : "none";
}

function reasonsWithEscalation(
  reasons: readonly BreakReasonCode[],
  review: BreakRecommendation["review"],
): readonly BreakReasonCode[] {
  return review === "parent_or_teacher"
    ? [...reasons, "repeated_break_pattern", "approved_break_not_failure"]
    : [...reasons, "approved_break_not_failure"];
}

function validParentActivity(
  activityId: string | undefined,
  policy: BreakPolicy,
): boolean {
  return (
    activityId !== undefined &&
    policy.allowedParentActivityIds.includes(activityId)
  );
}

interface SelectedBreak {
  readonly type: BreakType;
  readonly reasons: readonly BreakReasonCode[];
}

function selectNewBreak(
  context: BreakContext,
  policy: BreakPolicy,
): SelectedBreak | "invalid_parent_activity" | undefined {
  if (context.studentRequest) {
    const type = context.studentRequest.type ?? "student_requested";
    if (
      type === "parent_configured" &&
      !validParentActivity(context.studentRequest.parentActivityId, policy)
    ) {
      return "invalid_parent_activity";
    }
    return {
      type,
      reasons:
        type === "parent_configured"
          ? ["student_request", "parent_configured_activity"]
          : ["student_request"],
    };
  }

  if (context.needs?.waterRequested === true) {
    return { type: "water", reasons: ["water_requested"] };
  }
  if (context.needs?.movementRequested === true) {
    return { type: "movement", reasons: ["movement_requested"] };
  }
  if (context.needs?.screenRestRequested === true) {
    return { type: "screen_rest", reasons: ["screen_rest_requested"] };
  }
  if (context.needs?.quietResetRequested === true) {
    return { type: "quiet_reset", reasons: ["quiet_reset_requested"] };
  }
  if (context.needs?.possibleFatigue === true) {
    return { type: "quiet_reset", reasons: ["possible_fatigue_signal"] };
  }
  if (
    (context.screenMinutesSinceRest ?? 0) >= policy.screenRestAfterMinutes
  ) {
    return { type: "screen_rest", reasons: ["screen_time_threshold"] };
  }
  if (context.blockElapsedMinutes >= policy.plannedBlockMinutes) {
    if (context.parentPlannedActivityId !== undefined) {
      return validParentActivity(context.parentPlannedActivityId, policy)
        ? {
            type: "parent_configured",
            reasons: ["planned_break_due", "parent_configured_activity"],
          }
        : "invalid_parent_activity";
    }
    return { type: "planned", reasons: ["planned_break_due"] };
  }
  return undefined;
}

/**
 * Recommends a bounded break action from elapsed-time and session signals.
 *
 * The function never scores learner character or attention, never treats a
 * break as failure, and never prevents a student-requested break solely because
 * other breaks occurred. A repeated pattern adds an adult-review flag while
 * still approving the immediate break.
 */
export function recommendBreak(context: BreakContext): BreakRecommendation {
  if (!isRecord(context)) {
    return recommendation("insufficient_data", {
      reasons: ["invalid_context"],
    });
  }
  const policy = resolvePolicy(context);
  if (!policy || hasInvalidContext(context)) {
    return recommendation("insufficient_data", {
      reasons: ["invalid_context"],
    });
  }

  if (context.sessionGoalComplete === true) {
    return recommendation("finish_session", {
      reasons: ["session_goal_complete"],
    });
  }

  if (context.sessionElapsedMinutes >= policy.maxSessionMinutes) {
    return recommendation("finish_session", {
      reasons: ["configured_session_limit"],
    });
  }

  if (context.currentBreak) {
    const active = context.currentBreak;
    const review =
      recentApprovedBreakCount(context, policy) + 1 >=
      policy.repeatedBreakThreshold
        ? "parent_or_teacher"
        : "none";

    if (active.readyToResume === true) {
      return recommendation("resume", {
        approved: true,
        breakType: active.type,
        reasons: ["ready_to_resume", "approved_break_not_failure"],
        review,
        resume: { mode: "when_ready", returnTo: "previous_work_step" },
      });
    }

    const boundedDuration = Math.min(
      active.baseDurationMinutes +
        Math.min(active.extensionMinutes, policy.maxExtensionMinutes),
      policy.maxTotalBreakMinutes,
    );

    const hasReachedExtensionCap =
      active.extensionMinutes >= policy.maxExtensionMinutes ||
      active.baseDurationMinutes + active.extensionMinutes >=
        policy.maxTotalBreakMinutes;

    if (active.extensionRequested === true) {
      const availableExtension = Math.min(
        policy.extensionIncrementMinutes,
        Math.max(0, policy.maxExtensionMinutes - active.extensionMinutes),
        Math.max(
          0,
          policy.maxTotalBreakMinutes -
            active.baseDurationMinutes -
            active.extensionMinutes,
        ),
      );

      if (hasReachedExtensionCap || availableExtension <= 0) {
        return recommendation("resume_or_finish", {
          approved: true,
          breakType: active.type,
          reasons: reasonsWithEscalation(
            ["break_extension_limit_reached"],
            review,
          ),
          review,
          resume: { mode: "when_ready", returnTo: "previous_work_step" },
        });
      }

      if (active.elapsedMinutes > boundedDuration) {
        return recommendation("resume", {
          approved: true,
          breakType: active.type,
          reasons: reasonsWithEscalation(["break_timer_complete"], review),
          review,
          resume: { mode: "after_timer", returnTo: "previous_work_step" },
        });
      }

      return recommendation("extend_break", {
        approved: true,
        breakType: active.type,
        durationMinutes: availableExtension,
        reasons: reasonsWithEscalation(
          ["break_extension_approved"],
          review,
        ),
        review,
        resume: { mode: "after_timer", returnTo: "previous_work_step" },
      });
    }

    if (
      active.elapsedMinutes >= boundedDuration ||
      active.extensionMinutes > policy.maxExtensionMinutes ||
      active.baseDurationMinutes + active.extensionMinutes >
        policy.maxTotalBreakMinutes
    ) {
      return recommendation("resume", {
        approved: true,
        breakType: active.type,
        reasons: reasonsWithEscalation(["break_timer_complete"], review),
        review,
        resume: { mode: "after_timer", returnTo: "previous_work_step" },
      });
    }

    return recommendation("continue_break", {
      approved: true,
      breakType: active.type,
      durationMinutes: boundedDuration - active.elapsedMinutes,
      reasons: reasonsWithEscalation(["active_break"], review),
      review,
      resume: { mode: "after_timer", returnTo: "previous_work_step" },
    });
  }

  const selected = selectNewBreak(context, policy);
  if (selected === "invalid_parent_activity") {
    return recommendation("insufficient_data", {
      reasons: ["invalid_context"],
    });
  }

  if (!selected) {
    return recommendation("continue_work", {
      reasons: ["no_break_signal"],
    });
  }

  if (context.breakRefused === true && context.studentRequest === undefined) {
    const review = reviewForNewBreak(context, policy);
    return recommendation("honor_break_refusal", {
      breakType: selected.type,
      reasons:
        review === "parent_or_teacher"
          ? [
              "break_refusal_honored",
              "repeated_break_pattern",
              "approved_break_not_failure",
            ]
          : ["break_refusal_honored", "approved_break_not_failure"],
      review,
      resume: {
        mode: "checkpoint",
        afterMinutes: policy.refusalCheckpointMinutes,
        returnTo: "previous_work_step",
      },
    });
  }

  const review = reviewForNewBreak(context, policy);
  return recommendation("start_break", {
    approved: true,
    breakType: selected.type,
    durationMinutes: durationFor(selected.type, policy),
    reasons: reasonsWithEscalation(selected.reasons, review),
    review,
    resume: { mode: "after_timer", returnTo: "previous_work_step" },
  });
}

/**
 * Local, provisional break-engine contracts. The engine uses elapsed minutes
 * instead of wall-clock timestamps so its decisions are deterministic and
 * time-zone independent.
 */

export const BREAK_TYPES = [
  "planned",
  "student_requested",
  "movement",
  "water",
  "screen_rest",
  "quiet_reset",
  "parent_configured",
] as const;

export type BreakType = (typeof BREAK_TYPES)[number];

export const BREAK_ACTIONS = [
  "start_break",
  "continue_break",
  "extend_break",
  "resume",
  "resume_or_finish",
  "continue_work",
  "honor_break_refusal",
  "finish_session",
  "insufficient_data",
] as const;

export type BreakAction = (typeof BREAK_ACTIONS)[number];

export interface BreakPolicy {
  readonly plannedBlockMinutes: number;
  readonly defaultBreakMinutes: number;
  readonly movementBreakMinutes: number;
  readonly waterBreakMinutes: number;
  readonly screenRestMinutes: number;
  readonly quietResetMinutes: number;
  readonly parentConfiguredMinutes: number;
  readonly extensionIncrementMinutes: number;
  readonly maxExtensionMinutes: number;
  readonly maxTotalBreakMinutes: number;
  readonly repeatedBreakWindowMinutes: number;
  readonly repeatedBreakThreshold: number;
  readonly refusalCheckpointMinutes: number;
  readonly screenRestAfterMinutes: number;
  readonly maxSessionMinutes: number;
  readonly allowedParentActivityIds: readonly string[];
}

export interface ActiveBreak {
  readonly type: BreakType;
  readonly baseDurationMinutes: number;
  readonly elapsedMinutes: number;
  readonly extensionMinutes: number;
  readonly extensionRequested?: boolean;
  readonly readyToResume?: boolean;
}

export interface BreakRecord {
  readonly type: BreakType;
  readonly endedAtSessionMinute: number;
  readonly approved: boolean;
}

export interface StudentBreakRequest {
  readonly type?: BreakType;
  /**
   * Opaque identifier configured by a parent. It is validated but never copied
   * into the recommendation.
   */
  readonly parentActivityId?: string;
}

export interface BreakNeedSignals {
  readonly movementRequested?: boolean;
  readonly waterRequested?: boolean;
  readonly screenRestRequested?: boolean;
  readonly quietResetRequested?: boolean;
  /**
   * This is a session signal supplied by an upstream classifier, not a
   * diagnosis. It can only suggest a gentle reset.
   */
  readonly possibleFatigue?: boolean;
}

export interface BreakContext {
  readonly blockElapsedMinutes: number;
  readonly sessionElapsedMinutes: number;
  readonly screenMinutesSinceRest?: number;
  readonly sessionGoalComplete?: boolean;
  readonly currentBreak?: ActiveBreak;
  readonly studentRequest?: StudentBreakRequest;
  readonly breakRefused?: boolean;
  readonly needs?: BreakNeedSignals;
  readonly history?: readonly BreakRecord[];
  readonly parentPlannedActivityId?: string;
  readonly policy?: Partial<BreakPolicy>;
}

export type BreakReasonCode =
  | "active_break"
  | "approved_break_not_failure"
  | "break_extension_approved"
  | "break_extension_limit_reached"
  | "break_refusal_honored"
  | "break_timer_complete"
  | "configured_session_limit"
  | "invalid_context"
  | "movement_requested"
  | "no_break_signal"
  | "parent_configured_activity"
  | "planned_break_due"
  | "possible_fatigue_signal"
  | "quiet_reset_requested"
  | "ready_to_resume"
  | "repeated_break_pattern"
  | "screen_rest_requested"
  | "screen_time_threshold"
  | "session_goal_complete"
  | "student_request"
  | "water_requested";

export interface BreakRecommendation {
  readonly action: BreakAction;
  readonly breakType?: BreakType;
  /**
   * For start/continue/extend actions, this is respectively the total starting
   * duration, remaining duration, or additional extension.
   */
  readonly durationMinutes?: number;
  readonly approved: boolean;
  /**
   * Literal false by contract: an approved break, refusal, or break-related
   * escalation is never recorded as learner failure.
   */
  readonly countsAsFailure: false;
  readonly review: "none" | "parent_or_teacher";
  readonly reasons: readonly BreakReasonCode[];
  readonly resume:
    | { readonly mode: "after_timer"; readonly returnTo: "previous_work_step" }
    | { readonly mode: "when_ready"; readonly returnTo: "previous_work_step" }
    | {
        readonly mode: "checkpoint";
        readonly afterMinutes: number;
        readonly returnTo: "previous_work_step";
      }
    | { readonly mode: "not_applicable"; readonly returnTo: "none" };
  /**
   * Static supportive language. Input notes, names, and activity identifiers
   * are intentionally not reflected.
   */
  readonly safeMessage: string;
}

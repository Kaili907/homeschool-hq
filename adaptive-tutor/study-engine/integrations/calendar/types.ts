/**
 * Provisional calendar integration contracts.
 *
 * These types deliberately avoid production calendar, identity, storage, and
 * database dependencies. Learners and source records are referenced only by
 * opaque identifiers supplied by the integrating application.
 */

export const DAILY_CALENDAR_BLOCK_TYPES = [
  "new_instruction",
  "guided_practice",
  "independent_practice",
  "reading",
  "writing",
  "memorization",
  "assessment",
  "project_work",
  "review",
  "physical_education",
  "outside_activity",
  "romeo_virtual_academy_activity",
  "parent_created_activity",
] as const;

export type DailyCalendarBlockType =
  (typeof DAILY_CALENDAR_BLOCK_TYPES)[number];

export const CALENDAR_PAUSE_REASONS = [
  "approved_break",
  "outside_interruption",
  "technical_interruption",
  "parent_pause",
] as const;

export type CalendarPauseReason = (typeof CALENDAR_PAUSE_REASONS)[number];

export type CalendarActor = "system" | "student" | "parent";

export type CalendarEntrySource =
  | "manuel_academy"
  | "romeo_virtual_academy"
  | "parent";

export type CalendarExecutionState =
  | "scheduled"
  | "active"
  | "paused"
  | "completed";

export type CalendarCompletionState =
  | "not_started"
  | "partially_complete"
  | "complete";

export interface CalendarSegmentInput {
  readonly segmentId: string;
  readonly title: string;
  readonly estimatedMinutes: number;
}

export interface CalendarSegment extends CalendarSegmentInput {
  readonly actualMinutes: number;
  readonly completedAt?: string;
}

export type CalendarAuditEvent =
  | {
      readonly type: "created";
      readonly at: string;
      readonly actor: "system" | "parent";
    }
  | {
      readonly type: "started";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly segmentId: string;
    }
  | {
      readonly type: "segment_completed";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly segmentId: string;
    }
  | {
      readonly type: "paused";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly reason: CalendarPauseReason;
      readonly approved: boolean;
    }
  | {
      readonly type: "resumed";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly segmentId: string;
    }
  | {
      readonly type: "rescheduled";
      readonly at: string;
      readonly actor: CalendarActor;
      readonly method: "drag_drop" | "parent_edit";
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly type: "parent_edited";
      readonly at: string;
      readonly actor: "parent";
      readonly changedFields: readonly (
        | "title"
        | "subject"
        | "scheduledStart"
        | "timeZone"
        | "timerVisibility"
      )[];
    }
  | {
      readonly type: "continuation_created";
      readonly at: string;
      readonly actor: "system" | "parent";
      readonly continuationEntryId: string;
    };

export interface CalendarPauseRecord {
  readonly reason: CalendarPauseReason;
  readonly approved: boolean;
  readonly pausedAt: string;
}

export interface CalendarBlock {
  readonly schemaVersion: "provisional-calendar-block.v1";
  readonly entryId: string;
  /**
   * Stable identity used to collapse repeat imports. It must not contain a
   * learner name, email address, or other direct identifier.
   */
  readonly dedupeKey: string;
  readonly learnerRef: string;
  readonly source: CalendarEntrySource;
  readonly sourceItemRef: string;
  readonly title: string;
  readonly subject?: string;
  readonly blockType: DailyCalendarBlockType;
  /**
   * ISO 8601 instant with an explicit Z or numeric offset.
   */
  readonly scheduledStart: string;
  /**
   * IANA time-zone name used only for calendar grouping and display.
   */
  readonly timeZone: string;
  readonly estimatedMinutes: number;
  readonly executionState: CalendarExecutionState;
  readonly segments: readonly CalendarSegment[];
  readonly activeSince?: string;
  readonly pause?: CalendarPauseRecord;
  readonly continuationOf?: string;
  readonly timerVisibility: "shown" | "hidden";
  readonly revision: number;
  readonly lastEventAt: string;
  readonly events: readonly CalendarAuditEvent[];
}

export interface CreateCalendarBlockInput {
  readonly entryId: string;
  readonly learnerRef: string;
  readonly source: CalendarEntrySource;
  readonly sourceItemRef: string;
  readonly title: string;
  readonly subject?: string;
  readonly blockType: DailyCalendarBlockType;
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly segments: readonly CalendarSegmentInput[];
  readonly createdAt: string;
  readonly createdBy?: "system" | "parent";
  readonly dedupeKey?: string;
  readonly continuationOf?: string;
  readonly timerVisibility?: "shown" | "hidden";
}

export interface PlannedCalendarItem extends CreateCalendarBlockInput {
  /**
   * Optional guard supplied by a planner when a specific wall-clock day was
   * intended. Transformation fails if the offset-bearing instant maps to a
   * different date in `timeZone`.
   */
  readonly intendedLocalDate?: string;
}

export interface PauseCalendarBlockInput {
  readonly at: string;
  readonly actor: CalendarActor;
  readonly reason: CalendarPauseReason;
  readonly approved: boolean;
}

export interface RescheduleCalendarBlockInput {
  readonly at: string;
  readonly actor: CalendarActor;
  readonly method: "drag_drop" | "parent_edit";
  readonly scheduledStart: string;
  readonly timeZone: string;
}

export interface ParentCalendarEditInput {
  readonly at: string;
  readonly title?: string;
  readonly subject?: string;
  readonly scheduledStart?: string;
  readonly timeZone?: string;
  readonly timerVisibility?: "shown" | "hidden";
}

export interface AutomaticContinuationInput {
  readonly continuationEntryId: string;
  readonly continuationRef: string;
  readonly scheduledStart: string;
  readonly timeZone: string;
  readonly at: string;
  readonly actor?: "system" | "parent";
}

export interface AutomaticContinuationResult {
  readonly original: CalendarBlock;
  readonly continuation: CalendarBlock;
}

export interface CalendarBlockView {
  readonly entryId: string;
  readonly title: string;
  readonly executionState: CalendarExecutionState;
  readonly completionState: CalendarCompletionState;
  readonly segmentsCompleted: number;
  readonly totalSegments: number;
  readonly estimatedMinutes: number;
  readonly estimatedMinutesRemaining: number;
  readonly actualMinutes: number;
  readonly resumeAt?: string;
  readonly completionPercent: number;
}

export interface CalendarCompletionBar {
  readonly completedEstimatedMinutes: number;
  readonly scheduledEstimatedMinutes: number;
  readonly completedBlocks: number;
  readonly totalBlocks: number;
  readonly percent: number;
}

export type CalendarIntegrationErrorCode =
  | "invalid_reference"
  | "invalid_text"
  | "invalid_duration"
  | "invalid_timestamp"
  | "invalid_time_zone"
  | "local_date_mismatch"
  | "invalid_segment"
  | "invalid_state"
  | "invalid_pause"
  | "invalid_edit"
  | "event_out_of_order"
  | "identity_conflict";

export class CalendarIntegrationError extends Error {
  public readonly name = "CalendarIntegrationError";

  public constructor(
    public readonly code: CalendarIntegrationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

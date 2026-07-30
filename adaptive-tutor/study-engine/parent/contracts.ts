/**
 * Provisional parent-insights boundary.
 *
 * This contract is intentionally independent of profile storage, identity,
 * calendar persistence, and the production Parent Hub. Integrators provide
 * already-minimized, parent-visible evidence and receive explicit parent
 * control events in return.
 */

export const PARENT_DASHBOARD_SCHEMA_VERSION =
  "provisional-parent-dashboard.v1" as const;

export const PARENT_CONTROL_SCHEMA_VERSION =
  "provisional-parent-controls.v1" as const;

export type IsoDate = string;
export type OffsetTimestamp = string;

export type DashboardBlockStatus =
  | "scheduled"
  | "completed"
  | "partial"
  | "needs_support";

export interface ParentVisibleEvidence {
  readonly evidenceRef: string;
  readonly description: string;
  readonly observedAt: OffsetTimestamp;
  readonly source:
    | "calendar_record"
    | "completed_block"
    | "review_result"
    | "parent_entry";
}

export interface TodayBlock {
  readonly blockRef: string;
  readonly title: string;
  readonly subject: string;
  readonly status: DashboardBlockStatus;
  readonly estimatedMinutes: number;
  readonly actualMinutes?: number;
}

export interface ReviewedSkill {
  readonly skillRef: string;
  readonly label: string;
  readonly reviewKind: "same_day" | "future" | "overdue" | "reteaching";
  readonly evidence: readonly ParentVisibleEvidence[];
}

export interface ApprovedBreakSummary {
  readonly breakRef: string;
  readonly durationMinutes: number;
  readonly approved: true;
  readonly context: string;
}

export interface ResumableWork {
  readonly blockRef: string;
  readonly title: string;
  readonly completedSegments: number;
  readonly totalSegments: number;
  readonly estimatedMinutesRemaining: number;
  readonly resumeAt: string;
  /**
   * This may be shown to the learner and must be supportive and temporary,
   * never a trait label.
   */
  readonly studentMessage: string;
}

export interface AssignmentNeedingSupport {
  readonly assignmentRef: string;
  readonly title: string;
  readonly course: string;
  readonly dueAt: OffsetTimestamp;
  readonly supportReason: string;
  readonly linkedTutorSupportRef?: string;
}

export interface TodayInsights {
  readonly date: IsoDate;
  readonly scheduledBlocks: readonly TodayBlock[];
  readonly completedBlocks: readonly TodayBlock[];
  readonly skillsReviewed: readonly ReviewedSkill[];
  readonly breaksTaken: readonly ApprovedBreakSummary[];
  readonly resumableWork: readonly ResumableWork[];
  readonly assignmentsNeedingSupport: readonly AssignmentNeedingSupport[];
}

export interface LearningInsight {
  readonly skillRef: string;
  readonly label: string;
  readonly evidence: readonly ParentVisibleEvidence[];
}

export interface UpcomingReviewInsight {
  readonly reviewRef: string;
  readonly skillLabel: string;
  readonly dueAt: OffsetTimestamp;
  readonly priority: "routine" | "important" | "time_sensitive";
}

export interface RepeatedMisconceptionInsight {
  readonly insightRef: string;
  readonly observation: string;
  readonly occurrences: number;
  readonly evidence: readonly ParentVisibleEvidence[];
  readonly supportiveNextStep: string;
}

export interface LearningInsights {
  readonly masteredSkills: readonly LearningInsight[];
  readonly developingSkills: readonly LearningInsight[];
  readonly prerequisiteGaps: readonly LearningInsight[];
  readonly upcomingReviews: readonly UpcomingReviewInsight[];
  readonly repeatedMisconceptions: readonly RepeatedMisconceptionInsight[];
}

export interface EffectiveWorkBlockRange {
  readonly subject: string;
  readonly minimumMinutes: number;
  readonly maximumMinutes: number;
  /**
   * Parent-facing observational language. It must describe current evidence,
   * not claim a permanent ability or medical/behavioral trait.
   */
  readonly displayText: string;
}

export interface EffectiveTaskLength {
  readonly taskKind: string;
  readonly minimumMinutes: number;
  readonly maximumMinutes: number;
  readonly evidence: readonly ParentVisibleEvidence[];
}

export interface ShorterSectionSubject {
  readonly subject: string;
  readonly suggestedSectionMinutes: number;
  readonly evidence: readonly ParentVisibleEvidence[];
}

export type WorkDurationDirection = "increase" | "maintain" | "decrease";

export interface StudyHabitRecommendation {
  readonly recommendationRef: string;
  readonly direction: WorkDurationDirection;
  readonly summary: string;
  readonly suggestedMaximumWorkMinutes?: number;
  readonly suggestedBreakMinutes?: number;
  readonly evidence: readonly ParentVisibleEvidence[];
}

export interface StudyHabitInsights {
  readonly currentEffectiveWorkBlockRanges: readonly EffectiveWorkBlockRange[];
  readonly bestPerformingTaskLengths: readonly EffectiveTaskLength[];
  readonly subjectsBenefitingFromShorterSections: readonly ShorterSectionSubject[];
  readonly approvedBreaks: readonly ApprovedBreakSummary[];
  readonly recommendation: StudyHabitRecommendation;
}

export interface ParentDashboardSnapshot {
  readonly schemaVersion: typeof PARENT_DASHBOARD_SCHEMA_VERSION;
  readonly generatedAt: OffsetTimestamp;
  readonly zoneId: string;
  /**
   * Pseudonymous references only. Authentication and real identity stay
   * outside this integration boundary.
   */
  readonly studentRef: string;
  readonly learnerLabel: string;
  readonly today: TodayInsights;
  readonly learning: LearningInsights;
  readonly studyHabits: StudyHabitInsights;
}

export interface RecommendationDecision {
  readonly recommendationRef: string;
  readonly decision: "accepted" | "rejected";
  readonly decidedAt: OffsetTimestamp;
}

export interface Accommodation {
  readonly accommodationRef: string;
  readonly action: string;
  readonly studentMessage: string;
  readonly addedAt: OffsetTimestamp;
}

export interface IncompleteWorkReschedule {
  readonly blockRef: string;
  readonly startsAt: OffsetTimestamp;
  readonly reason: string;
  readonly requestedAt: OffsetTimestamp;
}

export interface MarkedInterruption {
  readonly interruptionRef: string;
  readonly kind: "outside" | "technical";
  readonly blockRef?: string;
  readonly occurredAt: OffsetTimestamp;
  readonly recordedAt: OffsetTimestamp;
}

export interface ParentPrivateNote {
  readonly noteRef: string;
  readonly body: string;
  readonly createdAt: OffsetTimestamp;
  readonly visibility: "parent_only";
}

export interface ReviewRequest {
  readonly requestRef: string;
  readonly audience: "teacher" | "tutor";
  readonly subjectRef: string;
  readonly reason: string;
  readonly requestedAt: OffsetTimestamp;
  readonly status: "requested";
}

export type ParentControlEvent =
  | {
      readonly type: "recommendation_accepted";
      readonly recommendationRef: string;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "recommendation_rejected";
      readonly recommendationRef: string;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "maximum_work_duration_set";
      readonly minutes: number;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "break_duration_set";
      readonly minutes: number;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "timers_hidden_set";
      readonly hidden: boolean;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "accommodation_added";
      readonly accommodationRef: string;
      readonly action: string;
      readonly studentMessage: string;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "incomplete_work_rescheduled";
      readonly blockRef: string;
      readonly startsAt: OffsetTimestamp;
      readonly reason: string;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "interruption_marked";
      readonly interruptionRef: string;
      readonly kind: "outside" | "technical";
      readonly blockRef?: string;
      readonly occurredAt: OffsetTimestamp;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "private_note_added";
      readonly noteRef: string;
      readonly body: string;
      readonly at: OffsetTimestamp;
    }
  | {
      readonly type: "review_requested";
      readonly requestRef: string;
      readonly audience: "teacher" | "tutor";
      readonly subjectRef: string;
      readonly reason: string;
      readonly at: OffsetTimestamp;
    };

export interface ParentControlState {
  readonly schemaVersion: typeof PARENT_CONTROL_SCHEMA_VERSION;
  readonly revision: number;
  readonly maximumWorkDurationMinutes: number;
  readonly breakDurationMinutes: number;
  readonly timersHidden: boolean;
  readonly recommendationDecisions: readonly RecommendationDecision[];
  readonly accommodations: readonly Accommodation[];
  readonly incompleteWorkReschedules: readonly IncompleteWorkReschedule[];
  readonly interruptions: readonly MarkedInterruption[];
  readonly privateNotes: readonly ParentPrivateNote[];
  readonly reviewRequests: readonly ReviewRequest[];
  readonly actionLog: readonly ParentControlEvent[];
}

export interface ParentDashboardModel {
  readonly snapshot: ParentDashboardSnapshot;
  readonly controls: ParentControlState;
}

export interface ParentDashboardAdapter {
  load(): Promise<ParentDashboardModel>;
  dispatch(event: ParentControlEvent): Promise<ParentDashboardModel>;
}

export type ParentControlErrorCode =
  | "invalid_timestamp"
  | "invalid_duration"
  | "invalid_reference"
  | "invalid_text"
  | "unsafe_data_request"
  | "unknown_recommendation"
  | "unknown_resumable_work";

export class ParentControlError extends Error {
  public readonly name = "ParentControlError";

  public constructor(
    public readonly code: ParentControlErrorCode,
    message: string,
  ) {
    super(message);
  }
}

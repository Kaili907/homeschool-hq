import type {
  EscalationLevel as CoreEscalationLevel,
  RetentionPolicy as CoreRetentionPolicy,
  SafetyCenterRole,
  SafetyClassification,
  SafetySeverity as CoreSafetySeverity,
  StudentReport as CoreStudentReport,
  Weekday as CoreWeekday,
  WithheldReason as CoreWithheldReason,
} from "../../../ai-safety/core/contracts";

/**
 * Integration boundary for the Manuel Academy AI Safety Center.
 *
 * The feature deliberately accepts an already-authorized, minimized projection.
 * Authentication, family relationships, persistence, and policy evaluation stay
 * outside the UI. The UI still verifies the supplied scope before rendering and
 * fails closed when any record belongs to a different student.
 */

export const AI_SAFETY_CENTER_UI_VERSION = "ai-safety-center.ui.v1" as const;

export type IsoDate = string;
export type OffsetTimestamp = string;
export type StudentRef = string;

export type IdentityRole = SafetyCenterRole;

export interface SafetyCenterViewer {
  readonly actorRef: string;
  readonly role: IdentityRole;
  /**
   * Must be "verified" before any student information is rendered. An
   * application should derive this from its authenticated identity boundary.
   */
  readonly identityAssurance: "verified" | "unverified";
  /** Required for a student viewer and must match the selected student. */
  readonly studentRef?: StudentRef;
  /**
   * Required for a parent viewer. It must contain only students for whom the
   * authenticated parent relationship has already been verified.
   */
  readonly authorizedStudentRefs: readonly StudentRef[];
}

export interface SafetyCenterStudentScope {
  readonly studentRef: StudentRef;
  readonly displayName: string;
  readonly gradeLabel: string;
}

export type CollectionUnavailableCode =
  | "not_connected"
  | "temporarily_unavailable"
  | "permission_not_verified"
  | "retention_expired";

export type CollectionState<T> =
  | {
      readonly status: "ready";
      readonly items: readonly T[];
    }
  | {
      readonly status: "loading";
    }
  | {
      readonly status: "unavailable";
      readonly code: CollectionUnavailableCode;
      readonly retryable: boolean;
    };

export type TutorSpeaker = "student" | "tutor" | "system";

export interface ConversationTurn {
  readonly turnRef: string;
  readonly speaker: TutorSpeaker;
  readonly at: OffsetTimestamp;
  readonly text: string;
  readonly source: "student_text" | "speech_transcript" | "tutor" | "scripted";
}

export type TimelineEventKind =
  | "session_started"
  | "student_message"
  | "tutor_help"
  | "answer_withheld"
  | "safety_check"
  | "parent_notified"
  | "human_review_requested"
  | "session_paused"
  | "session_ended";

export interface TutorTimelineEvent {
  readonly timelineRef: string;
  readonly kind: TimelineEventKind;
  readonly at: OffsetTimestamp;
  readonly label: string;
  /** Parent-safe or age-appropriate display text; never internal model reasoning. */
  readonly detail?: string;
}

export interface InstructionalSession {
  readonly studentRef: StudentRef;
  readonly sessionRef: string;
  readonly subjectRef: string;
  readonly subjectLabel: string;
  readonly topicLabel: string;
  readonly startedAt: OffsetTimestamp;
  readonly endedAt?: OffsetTimestamp;
  readonly durationMinutes?: number;
  readonly status: "completed" | "paused" | "ended_by_student";
  readonly summary: string;
  readonly turns: readonly ConversationTurn[];
  readonly timeline: readonly TutorTimelineEvent[];
  readonly linkedSafetyEventRefs: readonly string[];
  /**
   * Playback is synthesized from tutor text in the browser. There is
   * intentionally no raw-audio URL or microphone recording field.
   */
  readonly playback: "synthesized_from_text" | "unavailable";
}

/** Exact aliases prevent UI policy-enum drift from the safety core. */
export type SafetyEventCategory = SafetyClassification;
export type SafetySeverity = CoreSafetySeverity;
export type EscalationLevel = CoreEscalationLevel;
export type WithheldReasonCode = CoreWithheldReason;

export interface WithheldAnswerReason {
  readonly code: WithheldReasonCode;
  readonly title: string;
  /** Simple, non-shaming explanation that may be shown directly to a student. */
  readonly studentExplanation: string;
  /** Factual policy explanation for the parent; no hidden chain of thought. */
  readonly parentExplanation: string;
}

export interface SafetyEvent {
  readonly studentRef: StudentRef;
  readonly eventRef: string;
  readonly sessionRef?: string;
  readonly subjectRef?: string;
  readonly subjectLabel?: string;
  readonly occurredAt: OffsetTimestamp;
  readonly category: SafetyEventCategory;
  readonly severity: SafetySeverity;
  readonly escalation: EscalationLevel;
  readonly status: "open" | "reviewing" | "resolved" | "false_positive";
  readonly summary: string;
  readonly studentExplanation: string;
  readonly parentDetail: string;
  readonly withheldReason?: WithheldAnswerReason;
}

export interface SubjectPermission {
  readonly subjectRef: string;
  readonly label: string;
  readonly allowed: boolean;
}

export type Weekday = CoreWeekday;

export interface AllowedSessionSchedule {
  readonly zoneId: string;
  readonly allowedDays: readonly Weekday[];
  readonly startsAtLocal: string;
  readonly endsAtLocal: string;
  readonly maximumSessionMinutes: number;
}

export interface ParentNotificationPreferences {
  readonly inApp: boolean;
  /** Uses an address already held by the host app; this UI never collects it. */
  readonly emailOnFile: boolean;
  readonly minimumSeverity: Exclude<SafetySeverity, "info">;
  /** Fixed safeguard: notifications contain summaries/references, never transcript text. */
  readonly includeTranscriptExcerpt: false;
}

export interface RetentionSettings {
  readonly instructionalHistoryDays: CoreRetentionPolicy["instructionalHistoryDays"];
  readonly safetyEventDays: CoreRetentionPolicy["safetyEventDays"];
  readonly auditHistoryDays: CoreRetentionPolicy["auditHistoryDays"];
  /**
   * Active reviews may pause scheduled deletion. The UI explains this rather
   * than promising immediate or absolute deletion.
   */
  readonly activeReviewHoldEnabled: true;
}

export interface TutorPermissionSettings {
  readonly studentRef: StudentRef;
  readonly revision: number;
  readonly tutorEnabled: boolean;
  readonly voicePlaybackEnabled: boolean;
  readonly openEndedExplorationEnabled: boolean;
  readonly subjects: readonly SubjectPermission[];
  readonly schedule: AllowedSessionSchedule;
  readonly notifications: ParentNotificationPreferences;
  readonly retention: RetentionSettings;
}

export interface StudentSafetyState {
  readonly studentRef: StudentRef;
  readonly tutorPausedByStudent: boolean;
  readonly pausedAt?: OffsetTimestamp;
  /**
   * Report and pause controls are safety affordances, not optional tutor
   * permissions, and therefore remain available to the student.
   */
  readonly reportAndPauseControls: "always_available";
}

export type ReviewQueueStatus =
  | "awaiting_review"
  | "in_review"
  | "parent_context_received"
  | "resolved"
  | "dismissed";

export interface HumanReviewQueueItem {
  readonly studentRef: StudentRef;
  readonly reviewRef: string;
  readonly eventRef: string;
  readonly requestedAt: OffsetTimestamp;
  readonly status: ReviewQueueStatus;
  readonly reasonLabel: string;
  readonly expectedNextStep: string;
  readonly falsePositiveRequest?: {
    readonly requestedAt: OffsetTimestamp;
    readonly status: "submitted" | "accepted" | "declined";
  };
}

export type AuditAction =
  | "event_classified"
  | "answer_withheld"
  | "parent_notified"
  | "student_reported"
  | "tutor_paused"
  | "permission_changed"
  | "retention_changed"
  | "export_requested"
  | "deletion_requested"
  | "human_review_requested"
  | "review_resolved";

export interface SafetyAuditEntry {
  readonly studentRef: StudentRef;
  readonly auditRef: string;
  readonly at: OffsetTimestamp;
  readonly actor: "student" | "parent" | "system" | "human_reviewer";
  readonly action: AuditAction;
  readonly summary: string;
  readonly eventRef?: string;
}

export interface SafetyCenterData {
  readonly schemaVersion: typeof AI_SAFETY_CENTER_UI_VERSION;
  readonly studentRef: StudentRef;
  readonly generatedAt: OffsetTimestamp;
  readonly instructionalHistory: CollectionState<InstructionalSession>;
  readonly safetyEvents: CollectionState<SafetyEvent>;
  readonly reviewQueue: CollectionState<HumanReviewQueueItem>;
  readonly auditHistory: CollectionState<SafetyAuditEntry>;
  readonly permissions: TutorPermissionSettings;
  readonly studentSafety: StudentSafetyState;
}

export type StudentReportCategory = CoreStudentReport["category"];

export type SafetyCenterAction =
  | {
      readonly type: "permissions_update_requested";
      readonly studentRef: StudentRef;
      readonly expectedRevision: number;
      readonly settings: TutorPermissionSettings;
    }
  | {
      readonly type: "retention_update_requested";
      readonly studentRef: StudentRef;
      readonly expectedRevision: number;
      readonly retention: RetentionSettings;
    }
  | {
      readonly type: "export_requested";
      readonly studentRef: StudentRef;
      readonly include: readonly (
        | "instructional_history"
        | "safety_events"
        | "audit_history"
      )[];
    }
  | {
      readonly type: "deletion_requested";
      readonly studentRef: StudentRef;
      readonly scope:
        | "instructional_history"
        | "eligible_safety_records"
        | "all_eligible_records";
    }
  | {
      readonly type: "human_review_requested";
      readonly studentRef: StudentRef;
      readonly eventRef: string;
      readonly context?: string;
    }
  | {
      readonly type: "false_positive_review_requested";
      readonly studentRef: StudentRef;
      readonly eventRef: string;
      readonly context?: string;
    }
  | {
      readonly type: "student_report_submitted";
      readonly studentRef: StudentRef;
      readonly category: StudentReportCategory;
      readonly sessionRef?: string;
      readonly details?: string;
    }
  | {
      readonly type: "tutor_pause_requested";
      readonly studentRef: StudentRef;
      readonly source: "student_block" | "parent_control";
    }
  | {
      readonly type: "tutor_resume_requested";
      readonly studentRef: StudentRef;
      readonly source: "parent_control";
    }
  | {
      readonly type: "playback_requested";
      readonly studentRef: StudentRef;
      readonly sessionRef: string;
    }
  | {
      readonly type: "history_retry_requested";
      readonly studentRef: StudentRef;
      readonly collection: "instructional_history" | "safety_events";
    };

export interface SafetyCenterActionResult {
  readonly status: "accepted" | "pending" | "rejected";
  readonly message: string;
  readonly requestRef?: string;
}

export type SafetyCenterActionHandler = (
  action: SafetyCenterAction,
) => Promise<SafetyCenterActionResult>;

export type SafetyCenterBoundaryIssueCode =
  | "identity_not_verified"
  | "role_not_supported"
  | "student_scope_not_authorized"
  | "projection_scope_mismatch"
  | "action_not_authorized";

export interface SafetyCenterBoundaryIssue {
  readonly code: SafetyCenterBoundaryIssueCode;
  readonly safeMessage: string;
}

export interface AiSafetyCenterProps {
  readonly viewer: SafetyCenterViewer;
  readonly student: SafetyCenterStudentScope;
  readonly data: SafetyCenterData;
  readonly onAction: SafetyCenterActionHandler;
  readonly onClose?: () => void;
  readonly onBoundaryViolation?: (issue: SafetyCenterBoundaryIssue) => void;
  readonly initialSection?:
    | "overview"
    | "history"
    | "safety"
    | "controls"
    | "data"
    | "help";
}

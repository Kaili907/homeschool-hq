import type {
  LearningEvidence,
  LessonStudyPlan,
  ParentTeacherControls,
  SegmentId,
  SessionEventId,
  SessionId,
  StudentFocusProfile,
  StudentSkillReview,
  StudySession,
} from "@study-contracts";
import type {
  BreakRecommendation,
  EvidenceAssessment,
  FocusRecommendationResult,
  ReviewRecommendation,
} from "@study-engine";
import type { LearningSegmentId, SubjectId } from "@study-content";

export const STUDENT_RUNTIME_VERSION = "student-runtime.workspace.v2" as const;
export const PARENT_PREFERENCE_INPUT_VERSION =
  "student-runtime.parent-preferences.v1" as const;
export const UI_ADAPTER_VERSION = "student-runtime.study-ux-adapter.v2" as const;
export const RESUME_ENVELOPE_VERSION = "student-runtime.resume-envelope.v2" as const;

export type RuntimeSubjectId = SubjectId;
export type RuntimeTimerMode = "visible" | "minimal" | "hidden";
export type RuntimeMotionMode = "full" | "minimal" | "none";
export type RuntimeAudioMode = "on" | "off" | "unavailable";
export type RuntimeScreen =
  | "home"
  | "check-in"
  | "learning"
  | "break"
  | "decision"
  | "limit"
  | "finished"
  | "quarantine";

export type ReflectionField = "confidence" | "effort" | "frustration";

export interface ReflectionState {
  readonly confidence?: string;
  readonly effort?: string;
  readonly frustration?: string;
}

export interface ParentPreferenceInputV1 {
  readonly schemaVersion: typeof PARENT_PREFERENCE_INPUT_VERSION;
  readonly timerMode: RuntimeTimerMode;
  readonly maximumDurationMinutes: number;
  readonly breakRange: {
    readonly minimumMinutes: number;
    readonly defaultMinutes: number;
    readonly maximumMinutes: number;
  };
  readonly requiredBreaks: boolean;
  readonly reducedMotion: boolean;
  readonly noAudio: boolean;
  readonly largeText: boolean;
  readonly readAloud: boolean;
  readonly speechInput: boolean;
  readonly parentManualOverrideMinutes?: number;
  readonly accommodationMaximumMinutes?: number;
}

export interface ResolvedDurationPolicy {
  readonly precedenceVersion: "card5.resolve-duration-policy.v1";
  readonly status: "resolved" | "manual-review";
  readonly reasonCode: "policy.resolved" | "policy.infeasible-constraints";
  readonly targetMinutes: number;
  readonly automaticTargetMinutes?: number;
  readonly hardMaximumMinutes: number;
  readonly breakMinutes: number;
  readonly candidateSource:
    | "parent-manual-override"
    | "accepted-engine-recommendation"
    | "established-target"
    | "grade-band-default"
    | "manual-review";
  readonly candidateMinutes?: number;
  readonly feasibleMinimumMinutes: number;
  readonly feasibleMaximumMinutes: number;
  /** Ordered Card 5 provenance/reason codes, preserved without translation. */
  readonly appliedReasonCodes: readonly string[];
  readonly provisionalUntilCard5: false;
}

export interface RuntimeTimerState {
  readonly mode: RuntimeTimerMode;
  readonly initialSeconds: number;
  readonly remainingSeconds: number;
  readonly running: boolean;
  readonly goalReached: boolean;
  readonly pauseReason: "learner" | "break" | "technical" | null;
}

export interface RuntimeBreakState {
  readonly interruptionId: string;
  readonly returnSegment: LearningSegmentId;
  readonly returnScreen: Exclude<RuntimeScreen, "break" | "home" | "quarantine">;
  readonly activity?: string;
  readonly startedAt: string;
  readonly durationMinutes: number;
  readonly countsAsFailure: false;
  readonly adultReviewSuggested: boolean;
}

export interface TranscriptEntry {
  readonly id: string;
  readonly speaker: "Jarvis" | "Learner";
  readonly text: string;
  readonly at: string;
  readonly reasonCode: string;
}

export interface RuntimeDiagnostic {
  readonly id: string;
  readonly at: string;
  readonly level: "info" | "warning" | "rejected";
  readonly code:
    | "canonical-contract-accepted"
    | "duplicate-event-ignored"
    | "stale-resume-rejected"
    | "forged-resume-rejected"
    | "unsupported-version-quarantined"
    | "technical-recovery"
    | "adult-review-suggested"
    | "raw-response-local-only"
    | "tutor-core-boundary"
    | "forged-feedback-rejected"
    | "idempotency-conflict-rejected";
  readonly safeMessage: string;
}

export interface QuarantineRecord {
  readonly id: string;
  readonly at: string;
  readonly reason:
    | "unsupported-version"
    | "invalid-integrity"
    | "invalid-history"
    | "stale-revision"
    | "session-mismatch";
  readonly safeMessage: string;
}

export interface EngineOutputs {
  readonly focus?: FocusRecommendationResult;
  readonly review?: ReviewRecommendation;
  readonly break?: BreakRecommendation;
  readonly evidenceAssessment?: EvidenceAssessment;
}

export interface TutorCoreBoundaryReceipt {
  readonly bridgeVersion: "1.0.1";
  readonly bridgeContractVersion: 1;
  readonly requestId: string;
  readonly eventId: string;
  readonly eventLedgerIdempotencyKey: string;
  readonly sessionId: SessionId;
  /** DEC-004: the canonical SegmentId is the only task identity. */
  readonly taskRef: SegmentId;
  readonly responseRef: string;
  readonly submissionRevision: number;
  readonly directive: "continue" | "reteach";
  readonly reasonCode:
    | "tutor-core-continue"
    | "tutor-core-reteach"
    | "unsupported-version";
  readonly occurredAt: string;
  readonly ledgerAccepted: true;
  readonly outboxProposalCount: number;
}

export interface RuntimeIdempotencyRecord {
  readonly commandId: string;
  readonly kind: "segment-completion" | "review-recommendation";
  /**
   * A privacy-safe fingerprint of the canonical command payload. It contains
   * canonical references and reason codes, never the learner's entered work.
   */
  readonly payloadFingerprint: string;
  readonly canonicalEventIds: readonly SessionEventId[];
  readonly recordedAt: string;
}

export interface RuntimeWorkspaceV2 {
  readonly version: typeof STUDENT_RUNTIME_VERSION;
  readonly subjectId: RuntimeSubjectId;
  readonly householdTimeZone: string;
  readonly plan: LessonStudyPlan;
  readonly controls: ParentTeacherControls;
  readonly focusProfile: StudentFocusProfile;
  readonly parentPreferences: ParentPreferenceInputV1;
  readonly durationPolicy: ResolvedDurationPolicy;
  readonly canonicalSession: StudySession;
  readonly screen: RuntimeScreen;
  readonly currentSegment: LearningSegmentId;
  readonly completedSegments: readonly LearningSegmentId[];
  readonly checkIn?: string;
  /** Raw entered work is device-local and never copied to canonical evidence. */
  readonly responses: Partial<Record<LearningSegmentId, string>>;
  readonly reflection: ReflectionState;
  readonly feedback: Partial<Record<LearningSegmentId, "ready" | "support">>;
  readonly feedbackReceiptRefs: Partial<Record<LearningSegmentId, string>>;
  readonly timer: RuntimeTimerState;
  readonly breakState?: RuntimeBreakState;
  readonly idempotencyRecords: readonly RuntimeIdempotencyRecord[];
  readonly evidenceRecords: readonly LearningEvidence[];
  readonly reviewRecords: readonly StudentSkillReview[];
  readonly engineOutputs: EngineOutputs;
  readonly tutorCoreReceipts: readonly TutorCoreBoundaryReceipt[];
  readonly transcript: readonly TranscriptEntry[];
  readonly diagnostics: readonly RuntimeDiagnostic[];
  readonly quarantine: readonly QuarantineRecord[];
  readonly technicalInterruptionCount: number;
  readonly resumeRevision: number;
  readonly lastSavedAt: string;
  readonly showRecoveryNotice: boolean;
  readonly transcriptOpen: boolean;
}

/**
 * Source-compatibility alias for the original lab type name. The discriminant
 * is v2, so a serialized v1 workspace is never accepted through this alias.
 */
export type RuntimeWorkspaceV1 = RuntimeWorkspaceV2;

export interface ResumeEnvelopeV2 {
  readonly version: typeof RESUME_ENVELOPE_VERSION;
  readonly subjectId: RuntimeSubjectId;
  readonly sessionId: string;
  readonly revision: number;
  readonly savedAt: string;
  readonly payload: RuntimeWorkspaceV2;
  readonly integrity: string;
}

/** @deprecated Use ResumeEnvelopeV2; this alias never accepts a v1 wire value. */
export type ResumeEnvelopeV1 = ResumeEnvelopeV2;

export interface ResumeSummary {
  readonly subjectId: RuntimeSubjectId;
  readonly sessionId: string;
  readonly screen: RuntimeScreen;
  readonly currentSegment: LearningSegmentId;
  readonly completedSegmentCount: number;
  readonly savedAt: string;
  readonly revision: number;
}

export interface AdversarialProbeResult {
  readonly id:
    | "forged-completion"
    | "duplicate-event"
    | "privacy"
    | "unsupported-version"
    | "blame-language"
    | "excessive-increase"
    | "repeated-breaks";
  readonly label: string;
  readonly passed: boolean;
  readonly detail: string;
}

export type CanonicalUiSegmentId = "check-in" | LearningSegmentId;

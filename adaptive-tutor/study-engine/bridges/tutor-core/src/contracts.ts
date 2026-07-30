export const BRIDGE_VERSION = "1.0.1" as const;
export const BRIDGE_CONTRACT_VERSION = 1 as const;
export const STUDY_SCHEMA_VERSION = 1 as const;
export const TUTOR_CORE_PACKAGE = "@manuel-academy/adaptive-tutor-core" as const;
export const TUTOR_CORE_VERSION = "0.2.0" as const;

export const TUTOR_PHASES = [
  "assessment",
  "identify-missing-concept",
  "teach-visually",
  "guided-practice",
  "independent-attempt",
  "reassess",
  "advance",
  "reteach",
  "escalated",
] as const;
export type TutorPhase = (typeof TUTOR_PHASES)[number];

export const TUTOR_EVENT_KINDS = [
  "assessment-result",
  "confidence-estimate",
  "misconception-result",
  "prerequisite-result",
  "tutor-response",
  "parent-teacher-review",
  "safety-decision",
  "study-completion",
] as const;
export type TutorEventKind = (typeof TUTOR_EVENT_KINDS)[number];

export const STUDY_TASK_TYPES = [
  "direct-instruction",
  "worked-example",
  "guided-practice",
  "independent-practice",
  "retrieval-practice",
  "reading",
  "writing",
  "discussion",
  "problem-solving",
  "project-work",
  "mastery-check",
  "prerequisite-remediation",
  "reflection",
  "custom",
] as const;
export type StudyTaskType = (typeof STUDY_TASK_TYPES)[number];

export type StudyGradeBand =
  | "elementary-3-5"
  | "middle-6-8"
  | "high-9-12";
export type TutorSubject =
  | "math"
  | "english"
  | "science"
  | "social-studies"
  | "general";
export type TutorEvidenceSource =
  | "diagnostic"
  | "guided-practice"
  | "independent-attempt"
  | "reassessment"
  | "teacher-observation";
export type TutorOutcome = "correct" | "partial" | "incorrect" | "unscored";
export type TutorConfidenceBand =
  | "very-low"
  | "low"
  | "developing"
  | "strong"
  | "insufficient-evidence";
export type TutorMisconceptionStatus =
  | "possible"
  | "probable"
  | "unlikely"
  | "insufficient-evidence";
export type TutorPrerequisiteStatus =
  | "none-observed"
  | "suspected"
  | "confirmed"
  | "insufficient-evidence";
export type SafetyCategory =
  | "academic-integrity"
  | "identifying-information"
  | "medical-or-disability-diagnosis"
  | "disputed-grading"
  | "persistent-difficulty"
  | "high-stakes-placement"
  | "self-harm-or-immediate-danger"
  | "abuse-or-neglect-disclosure"
  | "unsupported-subject-risk";
export type SafetySeverity =
  | "inform"
  | "redirect"
  | "escalate"
  | "urgent-escalation";

export interface StudyContextV1 {
  readonly studentId: string;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly subjectId: string;
  readonly skillId: string;
  readonly taskType: StudyTaskType;
  readonly gradeBand: StudyGradeBand;
  readonly learnerLocalDate: string;
  readonly householdTimeZone: string;
}

export interface TutorAssessmentSummaryV1 {
  readonly source: TutorEvidenceSource;
  readonly outcome: TutorOutcome;
  readonly correctCount: number;
  readonly attemptedCount: number;
  readonly meanScore: number;
  readonly independentResponseCount: number;
  readonly distinctContextCount: number;
  readonly evidenceIds: readonly string[];
}

export interface TutorConfidenceV1 {
  readonly value: number;
  readonly uncertainty: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly evidenceCount: number;
  readonly effectiveEvidence: number;
  readonly distinctContextCount: number;
  readonly band: TutorConfidenceBand;
  readonly placementDecisionAllowed: false;
}

export interface TutorMisconceptionV1 {
  readonly selectedMisconceptionId: string | null;
  readonly status: TutorMisconceptionStatus;
  readonly probability: number;
  readonly uncertainty: number;
  readonly evidenceCount: number;
  readonly doNotDiagnose: true;
}

export interface TutorPrerequisiteV1 {
  /**
   * This is a bridge projection from a validated Tutor graph plus a Tutor-owned
   * instructional result. It is not a new Tutor Core export.
   */
  readonly prerequisiteSkillIds: readonly string[];
  readonly status: TutorPrerequisiteStatus;
  readonly evidenceIds: readonly string[];
  readonly nextAction:
    | "none"
    | "collect-more-evidence"
    | "remediate"
    | "adult-review";
  readonly tutorGraphValidated: true;
}

export interface TutorSafetyV1 {
  readonly category: SafetyCategory;
  readonly severity: SafetySeverity;
  readonly mustEscalateToAdult: boolean;
  readonly mustStopAcademicFlow: boolean;
  readonly responseRuleIds: readonly string[];
}

export interface TutorVisualCommandBase {
  readonly id: string;
  readonly kind: string;
  readonly durationMs: number;
  readonly ariaLabel: string;
  readonly [key: string]: unknown;
}

export interface TutorSpokenTurnV1 {
  readonly id: string;
  readonly text: string;
  readonly locale: string;
  readonly pace: "slow" | "normal" | "brisk";
  readonly emphasisTokens: readonly string[];
  readonly canInterrupt: boolean;
  readonly requireLearnerResponse: boolean;
  readonly fallbackText: string;
  readonly captionsRequired: true;
  readonly transcriptRequired: true;
  readonly claimsHumanIdentity: false;
}

export interface TutorCaptionCueV1 {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly speaker: "jarvis" | "learner" | "narrator";
}

export interface TutorNarrationV1 {
  readonly id: string;
  readonly locale: string;
  readonly text: string;
  readonly audioUri: string | null;
  readonly captions: readonly TutorCaptionCueV1[];
  /**
   * Accepted only for filtering. Transcript turns are never copied into a
   * Study projection or a recommendation event.
   */
  readonly transcript?: readonly unknown[];
  readonly voiceRequired: false;
  readonly mediaRequired: false;
}

export interface TutorMediaStateV1 {
  readonly voiceAvailable: boolean;
  readonly voiceReason: "available" | "missing-api" | "disabled" | "error";
  readonly visualAvailable: boolean;
  readonly visualReason:
    | "available"
    | "missing-media"
    | "unsupported-command"
    | "error";
}

export interface PrivacyContaminationV1 {
  readonly rawAnswer?: unknown;
  readonly rawLearnerResponse?: unknown;
  readonly rawTranscript?: unknown;
  readonly learnerName?: unknown;
  readonly email?: unknown;
  readonly phone?: unknown;
  readonly credential?: unknown;
  readonly credentialUrl?: unknown;
  readonly diagnosisLanguage?: unknown;
  readonly adultPrivateNote?: unknown;
}

export interface TutorEventPayloadV1 {
  readonly phase: TutorPhase;
  readonly tutorInteractionId: string;
  readonly programId: string;
  readonly responseId?: string;
  readonly assessment?: TutorAssessmentSummaryV1;
  readonly confidence?: TutorConfidenceV1;
  readonly misconception?: TutorMisconceptionV1;
  readonly prerequisite?: TutorPrerequisiteV1;
  readonly safety?: TutorSafetyV1;
  readonly boardCommands?: readonly TutorVisualCommandBase[];
  readonly spokenTurn?: TutorSpokenTurnV1;
  readonly narration?: TutorNarrationV1;
  readonly media?: TutorMediaStateV1;
  readonly privacyContamination?: PrivacyContaminationV1;
}

export interface TutorBridgeEventV1 {
  readonly contract: "study-core-bridge.tutor-event.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly packageName: typeof TUTOR_CORE_PACKAGE;
  readonly packageVersion: typeof TUTOR_CORE_VERSION;
  readonly eventVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly eventId: string;
  readonly occurredAt: string;
  readonly kind: TutorEventKind;
  readonly study: StudyContextV1;
  readonly tutor: TutorEventPayloadV1;
}

export type PrivacyActionCode =
  | "raw-answer-removed"
  | "raw-response-removed"
  | "raw-transcript-removed"
  | "name-removed"
  | "email-removed"
  | "phone-removed"
  | "credential-rejected"
  | "credential-url-rejected"
  | "diagnosis-language-rejected"
  | "adult-private-note-removed"
  | "unsafe-language-replaced"
  | "unknown-field-quarantined";

export type QuarantineReasonCode =
  | "unsupported-package"
  | "unsupported-package-version"
  | "unsupported-contract-version"
  | "unsupported-event-version"
  | "unsupported-event-kind"
  | "malformed-event"
  | "unknown-field"
  | "invalid-identifier"
  | "unmapped-identifier"
  | "invalid-date"
  | "invalid-time-zone"
  | "credential-detected"
  | "diagnosis-language-detected"
  | "unsafe-private-content"
  | "invalid-authority-claim"
  | "stale-checkpoint"
  | "checkpoint-session-mismatch"
  | "duplicate-event"
  | "event-id-collision"
  | "impossible-date";

export interface QuarantineRecordV1 {
  readonly contract: "study-core-bridge.quarantine.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly quarantineId: string;
  readonly reasonCode: QuarantineReasonCode;
  readonly source: "tutor-core" | "study-engine" | "checkpoint" | "outbox";
  readonly eventId?: string;
  readonly receivedAt: string;
  readonly payloadStored: false;
  readonly rawTextStored: false;
  readonly safeMessage: string;
}

export type BridgeValidationResult<T> =
  | {
      readonly status: "accepted";
      readonly value: T;
      readonly privacyActions: readonly PrivacyActionCode[];
    }
  | {
      readonly status: "quarantined";
      readonly quarantine: QuarantineRecordV1;
    }
  | {
      readonly status: "duplicate-ignored";
      readonly eventId: string;
      readonly reasonCode: "duplicate-event";
    };

export interface CanonicalLearningEvidenceV1 {
  readonly kind: "learning-evidence";
  readonly schemaVersion: typeof STUDY_SCHEMA_VERSION;
  readonly id: string;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: {
    readonly source: "adaptive-engine";
    readonly tags: readonly string[];
    readonly extensions: Readonly<Record<string, string | number | boolean | null>>;
  };
  readonly studentId: string;
  readonly sessionId: string;
  readonly subjectId: string;
  readonly skillIds: readonly string[];
  readonly capturedAt: string;
  readonly accuracy?: {
    readonly correctCount: number;
    readonly attemptedCount: number;
    readonly accuracyPercent: number;
    readonly scoringMethod: string;
  };
  readonly independence?: {
    readonly supportLevel:
      | "independent"
      | "minimal-support"
      | "guided"
      | "full-support";
    readonly source: "system-measure";
  };
  readonly tutorIntervention?: {
    readonly count: number;
    readonly kinds: readonly (
      | "clarification"
      | "prompt"
      | "worked-example"
      | "reteaching"
      | "redirection"
      | "adult-escalation"
    )[];
  };
  readonly masteryOutcome?: {
    readonly status:
      | "not-assessed"
      | "not-yet-demonstrated"
      | "progressing"
      | "demonstrated"
      | "retained"
      | "insufficient-evidence";
    readonly criterionId?: string;
    readonly algorithmVersion?: string;
    readonly basisEvidenceIds: readonly string[];
  };
  readonly prerequisiteGapOutcome?: {
    readonly status: TutorPrerequisiteStatus;
    readonly prerequisiteSkillIds: readonly string[];
    readonly basisEvidenceIds: readonly string[];
    readonly nextAction:
      | "none"
      | "collect-more-evidence"
      | "remediate"
      | "adult-review";
  };
  readonly engagementSupport?: {
    readonly status: "no-concern" | "insufficient-evidence";
    readonly supportingSignals: readonly [];
    readonly wording: "contextual-and-revisable";
  };
}

export interface StudyConfidenceEvidenceV1 {
  readonly value: number;
  readonly uncertainty: number;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly evidenceCount: number;
  readonly distinctContextCount: number;
  readonly band: TutorConfidenceBand;
  readonly sourceAuthority: "tutor-core";
  readonly placementDecisionAllowed: false;
}

export interface StudyMisconceptionOutcomeV1 {
  readonly misconceptionId: string | null;
  readonly status: TutorMisconceptionStatus;
  readonly uncertainty: number;
  readonly evidenceCount: number;
  readonly sourceAuthority: "tutor-core";
  readonly diagnosticClaimMade: false;
}

export type BridgeInstructionDisposition =
  | "continue-core-cycle"
  | "advance"
  | "reteach"
  | "adult-review";

export interface AdultReviewFlagV1 {
  readonly required: boolean;
  readonly urgency: "routine" | "priority" | "urgent";
  readonly reasonCodes: readonly string[];
  readonly visibility: "authorized-adults-only";
}

export interface LearnerSafeProjectionV1 {
  readonly messageCode: string;
  readonly message: string;
  readonly mayContinue: boolean;
  readonly adultReviewPending: boolean;
}

export interface AdultPrivateProjectionV1 {
  readonly evidenceId: string;
  readonly tutorInteractionId: string;
  readonly adultReview: AdultReviewFlagV1;
  readonly confidence?: StudyConfidenceEvidenceV1;
  readonly misconception?: StudyMisconceptionOutcomeV1;
  readonly rawTextIncluded: false;
  readonly transcriptIncluded: false;
  readonly directIdentifiersIncluded: false;
  readonly privateNoteBodyIncluded: false;
}

export interface StudyProjectionV1 {
  readonly contract: "study-core-bridge.study-projection.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly sourceEventId: string;
  readonly sourceEventVersion: number;
  readonly sourceTutorVersion: typeof TUTOR_CORE_VERSION;
  readonly evidence: CanonicalLearningEvidenceV1;
  readonly confidence?: StudyConfidenceEvidenceV1;
  readonly misconception?: StudyMisconceptionOutcomeV1;
  readonly instructionDisposition: BridgeInstructionDisposition;
  readonly learner: LearnerSafeProjectionV1;
  readonly adult: AdultPrivateProjectionV1;
  readonly privacyActions: readonly PrivacyActionCode[];
}

export interface StudyRecommendationV1 {
  readonly contract: "study-core-bridge.recommendation.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly recommendationId: string;
  readonly sourceEvidenceId: string;
  readonly action:
    | "continue-plan"
    | "review"
    | "reteach"
    | "prerequisite-remediation"
    | "adult-review"
    | "none";
  readonly reasonCodes: readonly string[];
  readonly learnerLocalDate: string;
  readonly householdTimeZone: string;
  readonly masteryDecisionMade: false;
  readonly pacingDecisionMade: false;
  readonly rawAnswerIncluded: false;
  readonly transcriptIncluded: false;
  readonly directIdentifiersIncluded: false;
}

export interface StudyCompletionReviewInputV1 {
  readonly contract: "study-core-bridge.study-completion-review-input.v1";
  readonly contractVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly eventId: string;
  readonly eventVersion: typeof BRIDGE_CONTRACT_VERSION;
  readonly sessionId: string;
  readonly lessonId: string;
  readonly segmentId: string;
  readonly tutorInteractionId: string;
  readonly completedAt: string;
  readonly completed: boolean;
  readonly approvedBreakOccurred: boolean;
  readonly technicalInterruptionOccurred: boolean;
  readonly evidenceIds: readonly string[];
  readonly rawAnswerIncluded: false;
  readonly transcriptIncluded: false;
}

export interface ValidationIssueV1 {
  readonly code:
    | "type"
    | "required"
    | "unknown-key"
    | "literal"
    | "format"
    | "range"
    | "duplicate"
    | "reference"
    | "sequence"
    | "chronology"
    | "invariant"
    | "privacy"
    | "safety"
    | "limit"
    | "json-safety";
  readonly path: string;
  readonly message: string;
}

export type CanonicalValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: string;
      readonly issues: readonly ValidationIssueV1[];
    };

export interface StudySchemaRegistryPort {
  readonly schemaVersion: typeof STUDY_SCHEMA_VERSION;
  inspectVersion(value: unknown):
    | "current"
    | "missing-version"
    | "unsupported-older-version"
    | "unsupported-future-version"
    | "invalid-version";
  validateLearningEvidence(
    value: unknown,
  ): CanonicalValidationResult<CanonicalLearningEvidenceV1>;
}

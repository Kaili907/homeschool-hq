export const HARD_GATE_DIMENSIONS = [
  "study_authority",
  "working_level_authority",
  "guardian_authority",
  "safety_authority",
  "action_validity",
  "answer_policy",
  "grounding",
  "provider_context_privacy",
  "cross_student_isolation",
  "malformed_output_behavior",
  "provider_outage_fallback",
  "transcript_non_persistence",
] as const;

export type HardGateDimension = (typeof HARD_GATE_DIMENSIONS)[number];
export type HardGateDisposition = "pass" | "reject" | "fallback";

export const SOFT_QUALITY_DIMENSIONS = [
  "correctness",
  "curriculum_consistency",
  "helpfulness",
  "age_appropriateness",
  "misconception_handling",
  "hint_progression",
  "excessive_verbosity",
  "escalation_quality",
  "latency_cost_class",
] as const;

export type SoftQualityDimension = (typeof SOFT_QUALITY_DIMENSIONS)[number];
export type ScoredSoftQualityDimension = Exclude<SoftQualityDimension, "latency_cost_class">;

export const LATENCY_COST_CLASSES = ["local", "low", "standard", "high"] as const;
export type LatencyCostClass = (typeof LATENCY_COST_CLASSES)[number];

export const TUTOR_ACTION_KINDS = [
  "explain",
  "hint",
  "ask-check",
  "show-example",
  "reteach",
  "check-prerequisite",
  "suggest-break",
  "escalate",
  "return-to-lesson",
] as const;
export type TutorActionKind = (typeof TUTOR_ACTION_KINDS)[number];

export type LearningStage = "early-elementary" | "upper-elementary" | "middle-school" | "high-school";
export type AssessmentPhase =
  | "instruction"
  | "guided-practice"
  | "independent-assessment"
  | "post-assessment-review";
export type HintLevel = 0 | 1 | 2 | 3;
export type ExpectedDisposition = "allowed" | "rejected" | "fallback";
export type RejectionOrFallbackCode =
  | "POLICY_REJECTION"
  | "INSUFFICIENT_GROUNDED_CONTEXT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_TIMEOUT"
  | "MALFORMED_RESPONSE"
  | "UNSUPPORTED_ACTION"
  | "STATIC_FALLBACK_REQUIRED";

export interface GradeLearningStagePolicy {
  readonly learningStage: LearningStage;
  readonly nominalGrade: number;
  readonly workingLevelGrade: number;
  readonly minimumHintLevel: HintLevel;
  readonly maximumHintLevel: HintLevel;
  readonly maximumResponseWords: number;
}
export interface SubjectConceptReferences {
  readonly subjectRef: string;
  readonly conceptRef: string;
  readonly lessonRef: string;
  readonly prerequisiteRefs: readonly string[];
}

export interface LearnerAttempt {
  readonly response: string;
  readonly attemptNumber: number;
  readonly interpretation: "correct" | "incorrect" | "ambiguous" | "misconception" | "request-for-answer" | "prompt-injection";
  readonly misconceptionRef?: string;
}

export interface GroundingContext {
  readonly sufficient: boolean;
  readonly activeLessonRef: string;
  readonly authorizedRefs: readonly string[];
  readonly excerpts: readonly { readonly ref: string; readonly text: string }[];
}

export interface PrivacyExpectations {
  readonly activeStudentRef: string;
  readonly prohibitedStudentRefs: readonly string[];
  readonly forbiddenProviderContextKeys: readonly string[];
  readonly forbiddenProviderContentFragments: readonly string[];
  readonly allowRawTranscriptPersistence: false;
}

export type AuthorityEffect =
  | { readonly kind: "set-study-authority"; readonly value: string }
  | { readonly kind: "set-grade"; readonly value: number }
  | { readonly kind: "set-working-level"; readonly value: number }
  | { readonly kind: "declare-mastery"; readonly value: boolean }
  | { readonly kind: "certify-guardian"; readonly value: boolean }
  | { readonly kind: "claim-safety-clear"; readonly value: boolean };

export interface TutorFixtureAction {
  readonly kind: string;
  readonly content: string;
  readonly hintLevel: HintLevel;
  readonly groundingRefs: readonly string[];
}

export interface PersistenceRequest {
  readonly kind: "raw-transcript" | "summary" | "event";
  readonly studentRef: string;
  readonly content: string;
}

export type SoftSignalScores = Readonly<Record<ScoredSoftQualityDimension, number>>;

export interface TutorResponseFixture {
  readonly studentRef: string;
  readonly action: TutorFixtureAction;
  readonly authorityEffects: readonly AuthorityEffect[];
  readonly answerDisclosure: "none" | "process-guidance" | "final-answer";
  readonly providerContext: Readonly<Record<string, unknown>>;
  readonly persistenceRequests: readonly PersistenceRequest[];
  readonly softSignals: SoftSignalScores;
  readonly latencyCostClass: LatencyCostClass;
}

export type ProviderResultFixture =
  | { readonly kind: "response"; readonly payload: unknown }
  | { readonly kind: "unavailable" }
  | { readonly kind: "timeout" }
  | { readonly kind: "malformed"; readonly payload: unknown }
  | { readonly kind: "static-fallback"; readonly reason: RejectionOrFallbackCode };

export type HardGateExpectations = Readonly<Record<HardGateDimension, HardGateDisposition>>;

export type SoftQualityExpectation =
  | { readonly kind: "range"; readonly minimum: number; readonly maximum: number }
  | { readonly kind: "not-applicable" };

export type SoftQualityExpectations = Readonly<Record<SoftQualityDimension, SoftQualityExpectation>>;

export interface ScenarioExpectation {
  readonly disposition: ExpectedDisposition;
  readonly rejectionOrFallbackCode?: RejectionOrFallbackCode;
  readonly hardGates: HardGateExpectations;
  readonly softQuality: SoftQualityExpectations;
}

export interface TutorEvalScenario {
  readonly id: string;
  readonly description: string;
  readonly primaryCategory: string;
  readonly tags: readonly string[];
  readonly gradePolicy: GradeLearningStagePolicy;
  readonly subject: SubjectConceptReferences;
  readonly assessmentPhase: AssessmentPhase;
  readonly assessmentReviewAllowed: boolean;
  readonly learnerAttempt?: LearnerAttempt;
  readonly allowedTutorActions: readonly TutorActionKind[];
  readonly hintCeiling: HintLevel;
  readonly grounding: GroundingContext;
  readonly providerResult: ProviderResultFixture;
  readonly privacy: PrivacyExpectations;
  readonly expected: ScenarioExpectation;
}

export interface GateObservation {
  readonly disposition: HardGateDisposition;
  readonly reasons: readonly string[];
}

export interface ScenarioEvaluation {
  readonly scenarioId: string;
  readonly primaryCategory: string;
  readonly passed: boolean;
  readonly observedDisposition: ExpectedDisposition;
  readonly observedCode?: RejectionOrFallbackCode;
  readonly hardGates: Readonly<Record<HardGateDimension, GateObservation>>;
  readonly softQuality: Readonly<Record<SoftQualityDimension, number | null>>;
  readonly hardGateMismatches: readonly HardGateDimension[];
  readonly softQualityMismatches: readonly SoftQualityDimension[];
  readonly expectationMismatches: readonly string[];
}

export interface QualityAggregate {
  readonly direction: "higher-is-better" | "lower-is-better";
  readonly evaluatedScenarios: number;
  readonly average: number | null;
  readonly minimum: number | null;
  readonly maximum: number | null;
}

export type FoundationClassification = "FOUNDATION_GATE_PASS" | "FOUNDATION_GATE_FAIL";

export interface FoundationEvaluationReport {
  readonly schemaVersion: "tutor-v2-eval-report/1";
  readonly totalScenarios: number;
  readonly passed: number;
  readonly failed: number;
  readonly hardGateFailuresByCategory: Readonly<Record<HardGateDimension, number>>;
  readonly qualityScoresByCategory: Readonly<Record<SoftQualityDimension, QualityAggregate>>;
  readonly failureScenarioIds: readonly string[];
  readonly scenarioBreakdown: Readonly<Record<string, { readonly total: number; readonly passed: number; readonly failed: number }>>;
  readonly classification: FoundationClassification;
  readonly releaseReady: false;
  readonly results: readonly ScenarioEvaluation[];
}

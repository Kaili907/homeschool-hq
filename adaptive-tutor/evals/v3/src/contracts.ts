export const EVAL_FAMILIES = [
  "grounded-explanation",
  "hint-quality",
  "misconception-handling",
  "prerequisite-recommendation",
  "reteach",
  "anti-answer",
  "prompt-injection",
  "answer-extraction",
  "prompt-leakage",
  "privacy",
  "cross-child-isolation",
  "authority-mutation",
  "unsupported-capability",
  "insufficient-grounding",
  "age-appropriateness",
  "multilingual",
  "provider-outage",
  "latency-cost",
  "malformed-output",
] as const;

export type EvalFamily = (typeof EVAL_FAMILIES)[number];

export const STOCHASTIC_HARD_FAMILIES: readonly EvalFamily[] = [
  "anti-answer",
  "prompt-injection",
  "answer-extraction",
  "prompt-leakage",
  "privacy",
  "cross-child-isolation",
  "authority-mutation",
  "unsupported-capability",
  "insufficient-grounding",
  "malformed-output",
] as const;

export const HARD_GATES = [
  "AUTHORITY_MUTATION",
  "ANSWER_LEAKAGE",
  "PRIVACY_CROSS_CHILD_LEAKAGE",
  "UNSUPPORTED_GROUNDING",
  "UNSAFE_PROVIDER_DATA_HANDLING",
] as const;

export type HardGate = (typeof HARD_GATES)[number];
export type Sha256Digest = `sha256:${string}`;
export type EvaluationMode = "deterministic-containment" | "stochastic-live-model";
export type AttemptDisposition = "accepted" | "rejected" | "fallback" | "stop";
export type GateOutcome = "pass" | "violation" | "not-evaluated";
export type CertificationClassification =
  | "COMMERCIAL_CERTIFICATION_PASS"
  | "COMMERCIAL_CERTIFICATION_FAIL"
  | "COMMERCIAL_CERTIFICATION_INCOMPLETE";

export interface EvalScore {
  readonly dimension: string;
  readonly score: 0 | 1 | 2 | 3 | 4;
  readonly rubricRevision: string;
  readonly graderKind: "deterministic" | "blinded-human" | "adjudicated-human";
}

export interface HardGateResult {
  readonly gate: HardGate;
  readonly nonCompensable: true;
  readonly modelBehavior: GateOutcome;
  readonly composedSystem: Exclude<GateOutcome, "not-evaluated">;
  readonly reasonCodes: readonly string[];
}

export interface ModelProvenance {
  readonly providerRef: string;
  readonly modelRevision: string;
  readonly configurationDigest: Sha256Digest;
  readonly policyRevision: string;
  readonly corpusRevision: string;
  readonly adapterRevision: string;
  readonly dataHandlingAttestation:
    | {
        readonly status: "verified-safe";
        readonly evidenceDigest: Sha256Digest;
        readonly zeroRetention: true;
        readonly noTraining: true;
        readonly humanReviewDisabled: true;
      }
    | { readonly status: "unsafe"; readonly reasonCode: string }
    | { readonly status: "missing" };
}

export interface EvalCase {
  readonly schemaVersion: "tutor-v2-eval-case/3";
  readonly caseId: string;
  readonly description: string;
  readonly family: EvalFamily;
  readonly tags: readonly string[];
  readonly corpusRevision: string;
  readonly contentDigest: Sha256Digest;
  readonly request: {
    readonly learnerRef: string;
    readonly providerContext: Readonly<Record<string, unknown>>;
    readonly allowedGroundingRefs: readonly string[];
    readonly groundingSufficient: boolean;
  };
  readonly sealedOracle: {
    readonly expectedDisposition: AttemptDisposition;
    readonly requiredHardGates: readonly HardGate[];
    readonly authoritySnapshotDigest: Sha256Digest;
    readonly protectedAnswerFragments: readonly string[];
    readonly forbiddenCrossChildFragments: readonly string[];
    readonly forbiddenProviderKeys: readonly string[];
    readonly forbiddenProviderFragments: readonly string[];
    readonly academicDimensions: readonly string[];
  };
  readonly trialPlan: {
    readonly deterministicReplays: number;
    readonly stochasticTrials: number;
  };
}

export interface ModelCandidate {
  readonly text: string;
  readonly learnerRef: string;
  readonly groundingRefs: readonly string[];
  readonly authorityMutationRequests: readonly string[];
  readonly answerDisclosure: "none" | "process-guidance" | "final-answer";
  readonly providerDataHandlingRequests: readonly (
    | "retain-content"
    | "train-on-content"
    | "human-review"
    | "forward-to-third-party"
  )[];
}

export type MockModelResult =
  | { readonly kind: "candidate"; readonly candidate: ModelCandidate }
  | { readonly kind: "unavailable" | "timeout" | "malformed" };

export interface ProviderEvalRequest {
  readonly caseRef: string;
  readonly learnerRef: string;
  readonly providerContext: Readonly<Record<string, unknown>>;
  readonly allowedGroundingRefs: readonly string[];
}

export interface DeterministicModelAdapter {
  readonly transportKind: "in-memory-mock";
  readonly liveNetworkEnabled: false;
  readonly adapterRef: string;
  execute(request: ProviderEvalRequest): Promise<MockModelResult>;
}

export interface EvalAttempt {
  readonly schemaVersion: "tutor-v2-eval-attempt/3";
  readonly attemptId: string;
  readonly caseId: string;
  readonly trialIndex: number;
  readonly mode: EvaluationMode;
  readonly provenance: ModelProvenance;
  readonly providerInvoked: boolean;
  readonly providerCallCount: 0 | 1;
  readonly rawModelResultKind: MockModelResult["kind"] | "not-invoked";
  readonly disposition: AttemptDisposition;
  readonly expectedDisposition: AttemptDisposition;
  readonly expectationMatched: boolean;
  readonly authorityBeforeDigest: Sha256Digest;
  readonly authorityAfterDigest: Sha256Digest;
  readonly hardGates: readonly HardGateResult[];
  readonly scores: readonly EvalScore[];
  readonly retainedEvidence: {
    readonly rawPromptRetained: false;
    readonly rawCompletionRetained: false;
    readonly minimizedReasonCodes: readonly string[];
  };
}

export interface CertificationRun {
  readonly schemaVersion: "tutor-v2-certification-run/3";
  readonly runId: string;
  readonly mode: EvaluationMode;
  readonly harnessRevision: string;
  readonly provenance: ModelProvenance;
  readonly cases: readonly EvalCase[];
  readonly attempts: readonly EvalAttempt[];
}

export interface CertificationDecision {
  readonly schemaVersion: "tutor-v2-certification-decision/3";
  readonly runId: string;
  readonly classification: CertificationClassification;
  readonly containmentPassed: boolean;
  readonly productionAuthorized: false;
  readonly reasonCodes: readonly string[];
  readonly hardFailures: readonly {
    readonly attemptId: string;
    readonly caseId: string;
    readonly gate: HardGate;
    readonly surface: "model-behavior" | "composed-system";
  }[];
  readonly academicSummary: readonly {
    readonly family: EvalFamily;
    readonly dimension: string;
    readonly attempts: number;
    readonly mean: number;
    readonly atLeastThreeRate: number;
    readonly minimum: number;
  }[];
}

export interface DeterministicFixture {
  readonly evalCase: EvalCase;
  readonly modelResult: MockModelResult;
  readonly scores: readonly EvalScore[];
}

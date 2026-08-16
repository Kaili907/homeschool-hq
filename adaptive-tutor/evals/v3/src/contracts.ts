import type {
  GroundedContextBundle,
  GroundingRequirement,
} from "../../../core/v3/grounding/index.js";
import type {
  InstructionalDisplayMode,
  ModelOutputValidationContext,
} from "../../../core/v3/model-output/index.js";

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
  "provider-outage",
  "malformed-output",
] as const;

export const HARD_GATES = [
  "AUTHORITY_INJECTION",
  "ANSWER_LEAKAGE",
  "UNREVIEWED_CONTENT",
  "GROUNDING_FAILURE",
  "CROSS_SCOPE_RESULT",
  "MALFORMED_OUTPUT",
  "PROVIDER_FAULT",
  "PRIVACY_FAILURE",
] as const;

export type HardGate = (typeof HARD_GATES)[number];
export type Sha256Digest = `sha256:${string}`;
export type EvaluationMode = "deterministic-containment" | "stochastic-live-model";
export type AttemptDisposition = "accepted" | "rejected" | "fallback" | "stop";
export type GateOutcome = "pass" | "violation" | "not-evaluated";
export type PipelineStage =
  | "provider-request-policy"
  | "provider-adapter"
  | "raw-provider-result"
  | "model-output-validator"
  | "grounding-claim-sidecar"
  | "grounding-evaluator"
  | "policy-outcome"
  | "academic-grader";
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
  readonly checkExecuted: boolean;
  readonly evidenceSource:
    | "provider-request-policy"
    | "provider-result-privacy-scan"
    | "provider-fault-adapter"
    | "model-output-validator"
    | "grounding-evaluator"
    | "scope-policy"
    | null;
  readonly modelBehavior: GateOutcome;
  readonly composedSystem: GateOutcome;
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
    readonly scopeRef: string;
    readonly providerContext: Readonly<Record<string, unknown>>;
  };
  /** Trusted Study-side inputs. None are supplied by the provider fixture. */
  readonly trustedPolicy: {
    readonly modelOutput: ModelOutputValidationContext;
    readonly groundingBundle: GroundedContextBundle;
    readonly groundingRequirements: readonly GroundingRequirement[];
    readonly forbiddenProviderKeys: readonly string[];
    readonly forbiddenProviderFragments: readonly string[];
    readonly forbiddenResultFragments: readonly string[];
  };
  readonly sealedOracle: {
    readonly expectedDisposition: AttemptDisposition;
    readonly requiredHardGates: readonly HardGate[];
    readonly authoritySnapshotDigest: Sha256Digest;
    readonly academicDimensions: readonly string[];
  };
  readonly trialPlan: {
    readonly deterministicReplays: number;
    readonly stochasticTrials: number;
  };
}

/**
 * The complete untrusted provider return used by deterministic evaluation.
 * `modelOutput` is never typed as a trusted proposal. Claim/support relations
 * remain an explicit sidecar rather than being inferred from groundingRefs.
 */
export type RawProviderResult =
  | {
      readonly kind: "output";
      readonly scopeRef: unknown;
      readonly modelOutput: unknown;
      readonly groundingClaimSidecar: unknown;
    }
  | { readonly kind: "timeout" | "unavailable" | "fault" };

export interface ProviderEvalRequest {
  readonly caseRef: string;
  readonly learnerRef: string;
  readonly scopeRef: string;
  readonly providerContext: Readonly<Record<string, unknown>>;
  readonly reviewedContentRefs: readonly string[];
  readonly groundingRefs: readonly string[];
}

export interface DeterministicProviderAdapter {
  readonly transportKind: "in-memory-mock";
  readonly liveNetworkEnabled: false;
  readonly adapterRef: string;
  execute(request: ProviderEvalRequest): Promise<RawProviderResult>;
}

export type ValidatorStatus =
  | "accepted-proposal"
  | "refused"
  | "malformed"
  | "static-fallback-required"
  | "not-run";
export type GroundingStatus = "grounded" | "refused" | "not-run";

export interface EvalPolicyOutcome {
  readonly disposition: AttemptDisposition;
  readonly validatorStatus: ValidatorStatus;
  readonly groundingStatus: GroundingStatus;
  readonly learnerOutputSource:
    | "validated-reference-proposal"
    | "reviewed-static-fallback"
    | "closed-refusal"
    | "none";
  readonly providerProposalReleased: boolean;
  readonly authorityMutationAllowed: false;
  readonly reasonCodes: readonly string[];
}

export interface DeterministicAcademicGrader {
  readonly graderRef: string;
  grade(input: {
    readonly evalCase: EvalCase;
    readonly policyOutcome: EvalPolicyOutcome;
  }): Promise<readonly EvalScore[]>;
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
  readonly rawProviderResultKind: RawProviderResult["kind"] | "not-invoked";
  readonly disposition: AttemptDisposition;
  readonly expectedDisposition: AttemptDisposition;
  readonly expectationMatched: boolean;
  readonly authorityBeforeDigest: Sha256Digest;
  readonly authorityAfterDigest: Sha256Digest;
  readonly policyOutcome: EvalPolicyOutcome;
  readonly pipelineTrace: readonly PipelineStage[];
  readonly hardGates: readonly HardGateResult[];
  readonly scores: readonly EvalScore[];
  readonly retainedEvidence: {
    readonly rawPromptRetained: false;
    readonly rawCompletionRetained: false;
    readonly rawClaimSidecarRetained: false;
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
  readonly rawProviderResult: RawProviderResult;
  /** Scripted grader input, consumed only after the policy outcome exists. */
  readonly academicScores: readonly EvalScore[];
}

export type { InstructionalDisplayMode };

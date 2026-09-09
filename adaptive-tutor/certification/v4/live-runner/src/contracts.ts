export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export const HARD_VIOLATIONS = [
  "authority-escape",
  "answer-leakage",
  "cross-child-leakage",
  "privacy-leak",
  "unreviewed-output",
  "grounding-escape",
] as const;

export type HardViolation = (typeof HARD_VIOLATIONS)[number];
export type HardGateOutcome = "pass" | "violation" | "not-evaluated";
export type CampaignClassification = "PASS" | "FAIL" | "INCOMPLETE";
export type Sha256Digest = `sha256:${string}`;

/** Safe, non-secret provider settings that form part of the certified tuple. */
export type ProviderConfiguration = Readonly<Record<string, JsonScalar>>;

export interface ProviderModelSelection {
  readonly providerId: string;
  readonly modelId: string;
  readonly providerModelRevision: string;
  readonly configuration: ProviderConfiguration;
  readonly adapterRevision: string;
}

export interface CertificationDimensions {
  readonly subjectCourseCategory: string;
  readonly learnerStageProfile: string;
  readonly locale: string;
  readonly actionFamily: string;
  readonly assessmentPhase: string;
  readonly adversarialFamily: string;
  readonly faultMode: string;
}

export type SeedPlan =
  | { readonly kind: "deterministic"; readonly baseSeed: number }
  | { readonly kind: "not-applicable" };

export interface CampaignCasePlan {
  /** Stable corpus/scenario identity; it is not a learner identity. */
  readonly scenarioRef: string;
  readonly dimensions: CertificationDimensions;
  readonly trialCount: number;
  readonly seed: SeedPlan;
  /** Synthetic or redacted input used only during execute(); never copied to a report. */
  readonly ephemeralInput: JsonValue;
}

export interface QualityThreshold {
  readonly metric: string;
  readonly statistic: "mean" | "minimum" | "p95";
  readonly operator: "gte" | "lte";
  readonly value: number;
  readonly minimumSamples: number;
}

export interface CampaignPlan {
  readonly schemaVersion: "tutor-v2-live-certification-plan/4";
  /** Operator-owned stable reference. Different planned campaigns use different refs. */
  readonly campaignRef: string;
  readonly harnessRevision: string;
  readonly policyRevision: string;
  readonly providerModel: ProviderModelSelection;
  readonly cases: readonly CampaignCasePlan[];
  /** Thresholds are intentionally restricted to non-hard quality observations. */
  readonly qualityThresholds: readonly QualityThreshold[];
}

export interface HardGateObservation {
  readonly gate: HardViolation;
  readonly outcome: Exclude<HardGateOutcome, "not-evaluated">;
  /** Machine-readable, minimized codes only. Raw model text is forbidden. */
  readonly reasonCodes: readonly string[];
}

export interface TransportUsage {
  readonly inputUnits: number;
  readonly outputUnits: number;
  readonly totalUnits: number;
}

export interface TransportCost {
  readonly currency: string;
  /** Base-10 non-negative integer string; avoids floating-point money. */
  readonly amountMicros: string;
}

/**
 * A fully evaluated, persistence-safe observation. The transport owns the
 * ephemeral provider exchange and must discard prompts/completions before it
 * returns this shape.
 */
export interface CertificationTransportObservation {
  readonly hardGates: readonly HardGateObservation[];
  readonly qualityMetrics: Readonly<Record<string, number>>;
  readonly providerLatencyMs: number;
  readonly usage: TransportUsage;
  readonly cost: TransportCost;
  readonly providerRequestRefDigest: Sha256Digest | null;
}

export interface CertificationTransportRequest {
  readonly campaignId: string;
  readonly caseId: string;
  readonly trialId: string;
  readonly trialIndex: number;
  readonly seed: number | null;
  readonly policyRevision: string;
  readonly providerModel: ProviderModelSelection & { readonly configurationDigest: Sha256Digest };
  readonly dimensions: CertificationDimensions;
  readonly scenarioRef: string;
  readonly ephemeralInputDigest: Sha256Digest;
  readonly ephemeralInput: JsonValue;
}

export interface CertificationTransport {
  readonly transportRef: string;
  execute(request: CertificationTransportRequest): Promise<CertificationTransportObservation>;
}

export interface RunnerClock {
  nowEpochMs(): number;
}

export interface ProviderModelProvenance {
  readonly providerId: string;
  readonly modelId: string;
  readonly providerModelRevision: string;
  readonly configuration: ProviderConfiguration;
  readonly configurationDigest: Sha256Digest;
  readonly adapterRevision: string;
  readonly transportRef: string;
}

export interface CaseRecord {
  readonly caseId: string;
  readonly scenarioRef: string;
  readonly dimensions: CertificationDimensions;
  readonly trialCount: number;
  readonly seedKind: SeedPlan["kind"];
  readonly ephemeralInputDigest: Sha256Digest;
}

export interface TrialRecord {
  readonly schemaVersion: "tutor-v2-live-certification-trial/4";
  readonly campaignId: string;
  readonly caseId: string;
  readonly trialId: string;
  readonly trialIndex: number;
  readonly seed: number | null;
  readonly providerModelProvenance: ProviderModelProvenance;
  readonly policyRevision: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly executionOutcome: "observed" | "transport-error" | "invalid-observation";
  readonly hardGates: readonly {
    readonly gate: HardViolation;
    readonly outcome: HardGateOutcome;
    readonly reasonCodes: readonly string[];
  }[];
  readonly qualityMetrics: Readonly<Record<string, number>>;
  readonly providerLatencyMs: number | null;
  readonly usage: TransportUsage | null;
  readonly cost: TransportCost | null;
  readonly providerRequestRefDigest: Sha256Digest | null;
  readonly reasonCodes: readonly string[];
  readonly retainedEvidence: {
    readonly rawLearnerConversationRetained: false;
    readonly rawPromptRetained: false;
    readonly rawCompletionRetained: false;
  };
}

export interface QualityThresholdResult extends QualityThreshold {
  readonly sampleCount: number;
  readonly observedValue: number | null;
  readonly outcome: "pass" | "fail" | "insufficient-samples";
}

export interface CampaignReport {
  readonly schemaVersion: "tutor-v2-live-certification-report/4";
  readonly campaignId: string;
  readonly campaignRef: string;
  readonly harnessRevision: string;
  readonly policyRevision: string;
  readonly providerModelProvenance: ProviderModelProvenance;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly durationMs: number;
  readonly classification: CampaignClassification;
  /** A certification report is evidence, never deployment authority. */
  readonly productionAuthorized: false;
  readonly haltedEarly: boolean;
  readonly haltReason: "hard-violation" | "transport-error" | "invalid-observation" | null;
  readonly plannedTrialCount: number;
  readonly executedTrialCount: number;
  readonly cases: readonly CaseRecord[];
  readonly trials: readonly TrialRecord[];
  readonly hardFailures: readonly {
    readonly trialId: string;
    readonly gate: HardViolation;
    readonly reasonCodes: readonly string[];
  }[];
  readonly qualityThresholds: readonly QualityThresholdResult[];
  readonly aggregateMetrics: {
    readonly providerLatencyMs: { readonly count: number; readonly total: number; readonly mean: number | null };
    readonly costMicrosByCurrency: Readonly<Record<string, string>>;
    readonly usage: TransportUsage;
  };
  readonly retainedEvidence: {
    readonly rawLearnerConversationRetained: false;
    readonly rawPromptRetained: false;
    readonly rawCompletionRetained: false;
  };
}

export class CampaignDefinitionError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid certification campaign:\n- ${issues.join("\n- ")}`);
    this.name = "CampaignDefinitionError";
    this.issues = [...issues];
  }
}

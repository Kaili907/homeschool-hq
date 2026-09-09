export const MODEL_DRIFT_POLICY_REVISION_REF = "model-drift-policy:v4-r1" as const;

export const CERTIFICATION_IDENTITY_FIELDS = [
  "providerRef",
  "modelRef",
  "modelRevisionRef",
  "configurationDigest",
  "providerPolicyRevisionRef",
  "routingPolicyRevisionRef",
  "curriculumCorpusRevisionRef",
  "evalCorpusRevisionRef",
  "graderRevisionRef",
  "learnerStageCatalogRevisionRef",
] as const;

export type CertificationIdentityField = (typeof CERTIFICATION_IDENTITY_FIELDS)[number];
export type Sha256Digest = `sha256:${string}`;

export interface CertificationIdentity {
  readonly providerRef: string;
  readonly modelRef: string;
  readonly modelRevisionRef: string;
  readonly configurationDigest: Sha256Digest;
  readonly providerPolicyRevisionRef: string;
  readonly routingPolicyRevisionRef: string;
  readonly curriculumCorpusRevisionRef: string;
  readonly evalCorpusRevisionRef: string;
  readonly graderRevisionRef: string;
  readonly learnerStageCatalogRevisionRef: string;
}

export const REQUIRED_HARD_GATES = [
  "AUTHORITY_INJECTION",
  "ANSWER_LEAKAGE",
  "UNREVIEWED_CONTENT",
  "GROUNDING_FAILURE",
  "CROSS_SCOPE_RESULT",
  "MALFORMED_OUTPUT",
  "PROVIDER_FAULT",
  "PRIVACY_FAILURE",
] as const;

export type HardGateRef = (typeof REQUIRED_HARD_GATES)[number];
export type HardGateOutcome = "pass" | "fail";

export interface HardGateObservation {
  readonly gateRef: HardGateRef;
  readonly outcome: HardGateOutcome;
  readonly evidenceRef: string;
}

export interface SoftQualityScore {
  readonly metricRef: string;
  /** Integer score from 0 through 10,000. */
  readonly scoreBasisPoints: number;
}

export interface SoftQualityBaseline extends SoftQualityScore {
  readonly evidenceRef: string;
}

export type CertificateRecord =
  | {
      readonly schemaVersion: "tutor-v2-model-certificate/4";
      readonly policyRevisionRef: typeof MODEL_DRIFT_POLICY_REVISION_REF;
      readonly certificationRef: string;
      readonly recordStatus: "active";
      readonly identity: CertificationIdentity;
      readonly identityDigest: Sha256Digest;
      readonly certifiedAt: string;
      readonly validUntil: string;
      readonly certificationEvidenceDigest: Sha256Digest;
      readonly certifiedHardGates: readonly HardGateRef[];
      readonly softQualityBaselines: readonly SoftQualityBaseline[];
      readonly revocation: null;
    }
  | {
      readonly schemaVersion: "tutor-v2-model-certificate/4";
      readonly policyRevisionRef: typeof MODEL_DRIFT_POLICY_REVISION_REF;
      readonly certificationRef: string;
      readonly recordStatus: "revoked";
      readonly identity: CertificationIdentity;
      readonly identityDigest: Sha256Digest;
      readonly certifiedAt: string;
      readonly validUntil: string;
      readonly certificationEvidenceDigest: Sha256Digest;
      readonly certifiedHardGates: readonly HardGateRef[];
      readonly softQualityBaselines: readonly SoftQualityBaseline[];
      readonly revocation: {
        readonly revokedAt: string;
        readonly reasonRef: string;
      };
    };

export interface AliasResolution {
  readonly aliasKind: "mutable-provider-alias" | "pinned-revision";
  readonly resolvedAt: string;
  readonly providerRef: string;
  readonly modelRef: string;
  readonly resolvedModelRevisionRef: string;
  readonly resolutionEvidenceRef: string;
}

export interface DriftObservationSnapshot {
  readonly schemaVersion: "tutor-v2-model-drift-snapshot/4";
  readonly snapshotRef: string;
  readonly observedAt: string;
  readonly sourceKind: "recorded-offline-evidence" | "recorded-live-campaign";
  readonly identity: CertificationIdentity;
  readonly identityDigest: Sha256Digest;
  readonly aliasResolution: AliasResolution;
  readonly hardGates: readonly HardGateObservation[];
  readonly softQualityScores: readonly SoftQualityScore[];
  readonly retainedEvidence: {
    readonly rawPromptsRetained: false;
    readonly rawCompletionsRetained: false;
  };
}

export interface RollbackCandidate {
  readonly certificate: CertificateRecord;
  readonly resolvedIdentity: CertificationIdentity;
  readonly aliasResolution: AliasResolution;
}

export interface CertificationEvaluationInput {
  readonly evaluatedAt: string;
  readonly certificate: CertificateRecord | null;
  readonly observation: DriftObservationSnapshot;
  readonly rollbackCandidate: RollbackCandidate | null;
}

export const CERTIFICATION_STATES = [
  "UNCERTIFIED",
  "CERTIFIED",
  "EXPIRED",
  "REVOKED",
  "DRIFT_DETECTED",
  "RECERTIFICATION_REQUIRED",
] as const;

export type CertificationState = (typeof CERTIFICATION_STATES)[number];
export type CertificationAction =
  | "retain"
  | "quarantine"
  | "fallback"
  | "revert-certification"
  | "require-recertification";

export type RecertificationScope =
  | "full-commercial-campaign"
  | "provider-eligibility-review-and-full-commercial-campaign"
  | "routing-integration-and-full-commercial-campaign"
  | "curriculum-coverage-and-full-commercial-campaign"
  | "full-commercial-campaign-on-new-eval-corpus"
  | "regrade-or-rerun-under-new-grader"
  | "stage-stratified-full-commercial-campaign";

export interface RecertificationRule {
  readonly field: CertificationIdentityField;
  readonly reasonCode: string;
  readonly scope: RecertificationScope;
}

export interface SoftQualityBreach {
  readonly metricRef: string;
  readonly baselineBasisPoints: number;
  readonly observedBasisPoints: number;
  readonly dropBasisPoints: number;
  readonly floorBreached: boolean;
  readonly maximumDropBreached: boolean;
}

export interface RollbackDecision {
  readonly decision: "none" | "fallback" | "revert-certification";
  readonly targetCertificationRef: string | null;
  readonly targetIdentityDigest: Sha256Digest | null;
  readonly reasonCode: string;
}

export interface CertificationEvaluationDecision {
  readonly schemaVersion: "tutor-v2-model-drift-decision/4";
  readonly policyRevisionRef: typeof MODEL_DRIFT_POLICY_REVISION_REF;
  readonly evaluatedAt: string;
  readonly certificationRef: string | null;
  readonly state: CertificationState;
  readonly certificationValid: boolean;
  readonly revocationRequired: boolean;
  readonly changedIdentityFields: readonly CertificationIdentityField[];
  readonly recertificationScopes: readonly RecertificationScope[];
  readonly hardGateFailures: readonly HardGateRef[];
  readonly softQualityBreaches: readonly SoftQualityBreach[];
  readonly reasonCodes: readonly string[];
  readonly actions: readonly CertificationAction[];
  readonly rollback: RollbackDecision;
  /** This policy only returns a decision. It cannot change routing or deployment. */
  readonly productionDeploymentAction: "none";
}

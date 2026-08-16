import {
  MODEL_DRIFT_POLICY_REVISION_REF,
  REQUIRED_HARD_GATES,
  type AliasResolution,
  type CertificateRecord,
  type CertificationEvaluationInput,
  type CertificationIdentity,
  type DriftObservationSnapshot,
  type RollbackCandidate,
} from "../src/contracts.js";
import { computeCertificationIdentityDigest } from "../src/identity.js";

const digest = (character: string) => `sha256:${character.repeat(64)}` as const;

export const CERTIFIED_IDENTITY: CertificationIdentity = {
  providerRef: "provider:synthetic-alpha",
  modelRef: "model-alias:synthetic-tutor",
  modelRevisionRef: "model-revision:synthetic-tutor-2026-08-r1",
  configurationDigest: digest("a"),
  providerPolicyRevisionRef: "provider-policy:w4-r1",
  routingPolicyRevisionRef: "routing-policy:w4-r1",
  curriculumCorpusRevisionRef: "curriculum-corpus:2026-08-r1",
  evalCorpusRevisionRef: "eval-corpus:w4-r1",
  graderRevisionRef: "grader:w4-r1",
  learnerStageCatalogRevisionRef: "learner-stage-catalog:w3-r5",
};

export function makeCertificate(
  identity: CertificationIdentity = CERTIFIED_IDENTITY,
  overrides: Partial<CertificateRecord> = {},
): CertificateRecord {
  return {
    schemaVersion: "tutor-v2-model-certificate/4",
    policyRevisionRef: MODEL_DRIFT_POLICY_REVISION_REF,
    certificationRef: "certification:synthetic-alpha-r1",
    recordStatus: "active",
    identity,
    identityDigest: computeCertificationIdentityDigest(identity),
    certifiedAt: "2026-08-01T00:00:00.000Z",
    validUntil: "2026-09-01T00:00:00.000Z",
    certificationEvidenceDigest: digest("b"),
    certifiedHardGates: REQUIRED_HARD_GATES,
    softQualityBaselines: [
      { metricRef: "academic-correctness", scoreBasisPoints: 9_000, evidenceRef: "evidence:correctness-r1" },
      { metricRef: "pedagogical-clarity", scoreBasisPoints: 8_600, evidenceRef: "evidence:clarity-r1" },
    ],
    revocation: null,
    ...overrides,
  } as CertificateRecord;
}

export function aliasFor(
  identity: CertificationIdentity,
  aliasKind: AliasResolution["aliasKind"] = "mutable-provider-alias",
  resolvedAt = "2026-08-16T12:00:00.000Z",
): AliasResolution {
  return {
    aliasKind,
    resolvedAt,
    providerRef: identity.providerRef,
    modelRef: identity.modelRef,
    resolvedModelRevisionRef: identity.modelRevisionRef,
    resolutionEvidenceRef: "alias-resolution:synthetic-r1",
  };
}

export function makeObservation(
  identity: CertificationIdentity = CERTIFIED_IDENTITY,
  overrides: Partial<DriftObservationSnapshot> = {},
): DriftObservationSnapshot {
  const observedAt = overrides.observedAt ?? "2026-08-16T12:00:00.000Z";
  return {
    schemaVersion: "tutor-v2-model-drift-snapshot/4",
    snapshotRef: "drift-snapshot:synthetic-r1",
    observedAt,
    sourceKind: "recorded-offline-evidence",
    identity,
    identityDigest: computeCertificationIdentityDigest(identity),
    aliasResolution: aliasFor(identity, "mutable-provider-alias", observedAt),
    hardGates: REQUIRED_HARD_GATES.map((gateRef) => ({
      gateRef,
      outcome: "pass",
      evidenceRef: `synthetic-gate-evidence:${gateRef}`,
    })),
    softQualityScores: [
      { metricRef: "academic-correctness", scoreBasisPoints: 8_700 },
      { metricRef: "pedagogical-clarity", scoreBasisPoints: 8_200 },
    ],
    retainedEvidence: {
      rawPromptsRetained: false,
      rawCompletionsRetained: false,
    },
    ...overrides,
  };
}

export function makeRollbackCandidate(
  identity: CertificationIdentity = {
    ...CERTIFIED_IDENTITY,
    modelRevisionRef: "model-revision:synthetic-tutor-2026-07-r9",
  },
): RollbackCandidate {
  return {
    certificate: makeCertificate(identity, {
      certificationRef: "certification:synthetic-alpha-prior",
      identity,
      identityDigest: computeCertificationIdentityDigest(identity),
      certifiedAt: "2026-07-01T00:00:00.000Z",
      validUntil: "2026-08-31T00:00:00.000Z",
      certificationEvidenceDigest: digest("c"),
    }),
    resolvedIdentity: identity,
    aliasResolution: aliasFor(identity, "pinned-revision", "2026-08-16T12:01:00.000Z"),
  };
}

export function makeEvaluationInput(
  overrides: Partial<CertificationEvaluationInput> = {},
): CertificationEvaluationInput {
  return {
    evaluatedAt: "2026-08-16T12:01:00.000Z",
    certificate: makeCertificate(),
    observation: makeObservation(),
    rollbackCandidate: null,
    ...overrides,
  };
}

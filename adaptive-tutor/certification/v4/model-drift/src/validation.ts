import {
  MODEL_DRIFT_POLICY_REVISION_REF,
  REQUIRED_HARD_GATES,
  type AliasResolution,
  type CertificateRecord,
  type CertificationEvaluationInput,
  type CertificationIdentity,
  type RollbackCandidate,
  type Sha256Digest,
  type SoftQualityBaseline,
  type SoftQualityScore,
} from "./contracts.js";
import {
  certificationIdentitiesEqual,
  computeCertificationIdentityDigest,
} from "./identity.js";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;

export class ModelDriftPolicyInputError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid model drift policy input: ${issues.join("; ")}`);
    this.name = "ModelDriftPolicyInputError";
    this.issues = issues;
  }
}

function requireRef(value: string, field: string, issues: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) issues.push(`${field} is required`);
}

function requireDigest(value: Sha256Digest, field: string, issues: string[]): void {
  if (!SHA256_PATTERN.test(value)) issues.push(`${field} must be a lowercase sha256 digest`);
}

function instant(value: string, field: string, issues: string[]): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    issues.push(`${field} must be a canonical ISO-8601 instant`);
    return null;
  }
  return parsed;
}

function validateIdentity(identity: CertificationIdentity, prefix: string, issues: string[]): void {
  requireRef(identity.providerRef, `${prefix}.providerRef`, issues);
  requireRef(identity.modelRef, `${prefix}.modelRef`, issues);
  requireRef(identity.modelRevisionRef, `${prefix}.modelRevisionRef`, issues);
  requireDigest(identity.configurationDigest, `${prefix}.configurationDigest`, issues);
  requireRef(identity.providerPolicyRevisionRef, `${prefix}.providerPolicyRevisionRef`, issues);
  requireRef(identity.routingPolicyRevisionRef, `${prefix}.routingPolicyRevisionRef`, issues);
  requireRef(identity.curriculumCorpusRevisionRef, `${prefix}.curriculumCorpusRevisionRef`, issues);
  requireRef(identity.evalCorpusRevisionRef, `${prefix}.evalCorpusRevisionRef`, issues);
  requireRef(identity.graderRevisionRef, `${prefix}.graderRevisionRef`, issues);
  requireRef(identity.learnerStageCatalogRevisionRef, `${prefix}.learnerStageCatalogRevisionRef`, issues);
}

function validateScores(
  scores: readonly (SoftQualityScore | SoftQualityBaseline)[],
  prefix: string,
  issues: string[],
): void {
  if (scores.length === 0) issues.push(`${prefix} must contain at least one metric`);
  const seen = new Set<string>();
  for (const [index, score] of scores.entries()) {
    requireRef(score.metricRef, `${prefix}[${index}].metricRef`, issues);
    if (seen.has(score.metricRef)) issues.push(`${prefix} contains duplicate metric ${score.metricRef}`);
    seen.add(score.metricRef);
    if (!Number.isInteger(score.scoreBasisPoints) || score.scoreBasisPoints < 0 || score.scoreBasisPoints > 10_000) {
      issues.push(`${prefix}[${index}].scoreBasisPoints must be an integer from 0 through 10000`);
    }
    if ("evidenceRef" in score) requireRef(score.evidenceRef, `${prefix}[${index}].evidenceRef`, issues);
  }
}

function validateAliasResolution(
  alias: AliasResolution,
  identity: CertificationIdentity,
  prefix: string,
  issues: string[],
): void {
  if (alias.aliasKind !== "mutable-provider-alias" && alias.aliasKind !== "pinned-revision") {
    issues.push(`${prefix}.aliasKind is unsupported`);
  }
  instant(alias.resolvedAt, `${prefix}.resolvedAt`, issues);
  requireRef(alias.providerRef, `${prefix}.providerRef`, issues);
  requireRef(alias.modelRef, `${prefix}.modelRef`, issues);
  requireRef(alias.resolvedModelRevisionRef, `${prefix}.resolvedModelRevisionRef`, issues);
  requireRef(alias.resolutionEvidenceRef, `${prefix}.resolutionEvidenceRef`, issues);
  if (alias.providerRef !== identity.providerRef) issues.push(`${prefix}.providerRef must match identity.providerRef`);
  if (alias.modelRef !== identity.modelRef) issues.push(`${prefix}.modelRef must match identity.modelRef`);
  if (alias.resolvedModelRevisionRef !== identity.modelRevisionRef) {
    issues.push(`${prefix}.resolvedModelRevisionRef must match identity.modelRevisionRef`);
  }
}

function validateCertificate(certificate: CertificateRecord, prefix: string, issues: string[]): void {
  if (certificate.schemaVersion !== "tutor-v2-model-certificate/4") issues.push(`${prefix}.schemaVersion is unsupported`);
  if (certificate.policyRevisionRef !== MODEL_DRIFT_POLICY_REVISION_REF) issues.push(`${prefix}.policyRevisionRef is unsupported`);
  requireRef(certificate.certificationRef, `${prefix}.certificationRef`, issues);
  if (certificate.recordStatus !== "active" && certificate.recordStatus !== "revoked") {
    issues.push(`${prefix}.recordStatus is unsupported`);
  }
  validateIdentity(certificate.identity, `${prefix}.identity`, issues);
  requireDigest(certificate.identityDigest, `${prefix}.identityDigest`, issues);
  if (certificate.identityDigest !== computeCertificationIdentityDigest(certificate.identity)) {
    issues.push(`${prefix}.identityDigest does not match the exact certification identity`);
  }
  requireDigest(certificate.certificationEvidenceDigest, `${prefix}.certificationEvidenceDigest`, issues);
  const certifiedAt = instant(certificate.certifiedAt, `${prefix}.certifiedAt`, issues);
  const validUntil = instant(certificate.validUntil, `${prefix}.validUntil`, issues);
  if (certifiedAt !== null && validUntil !== null && certifiedAt >= validUntil) {
    issues.push(`${prefix}.validUntil must be later than certifiedAt`);
  }
  if (
    certificate.certifiedHardGates.length !== REQUIRED_HARD_GATES.length ||
    REQUIRED_HARD_GATES.some((gate) => certificate.certifiedHardGates.filter((candidate) => candidate === gate).length !== 1)
  ) {
    issues.push(`${prefix}.certifiedHardGates must contain every required hard gate exactly once`);
  }
  validateScores(certificate.softQualityBaselines, `${prefix}.softQualityBaselines`, issues);
  if (certificate.recordStatus === "active" && certificate.revocation !== null) {
    issues.push(`${prefix}.active certificate cannot contain revocation evidence`);
  }
  if (certificate.recordStatus === "revoked") {
    if (certificate.revocation === null) {
      issues.push(`${prefix}.revoked certificate requires revocation evidence`);
    } else {
      const revokedAt = instant(certificate.revocation.revokedAt, `${prefix}.revocation.revokedAt`, issues);
      requireRef(certificate.revocation.reasonRef, `${prefix}.revocation.reasonRef`, issues);
      if (certifiedAt !== null && revokedAt !== null && revokedAt < certifiedAt) {
        issues.push(`${prefix}.revocation.revokedAt cannot precede certifiedAt`);
      }
    }
  }
}

function validateRollbackCandidate(candidate: RollbackCandidate, prefix: string, issues: string[]): void {
  validateCertificate(candidate.certificate, `${prefix}.certificate`, issues);
  validateIdentity(candidate.resolvedIdentity, `${prefix}.resolvedIdentity`, issues);
  validateAliasResolution(candidate.aliasResolution, candidate.resolvedIdentity, `${prefix}.aliasResolution`, issues);
}

export function assertValidCertificationEvaluationInput(input: CertificationEvaluationInput): void {
  const issues: string[] = [];
  const evaluatedAt = instant(input.evaluatedAt, "evaluatedAt", issues);
  if (input.certificate !== null) validateCertificate(input.certificate, "certificate", issues);

  const observation = input.observation;
  if (observation.schemaVersion !== "tutor-v2-model-drift-snapshot/4") issues.push("observation.schemaVersion is unsupported");
  if (observation.sourceKind !== "recorded-offline-evidence" && observation.sourceKind !== "recorded-live-campaign") {
    issues.push("observation.sourceKind is unsupported");
  }
  requireRef(observation.snapshotRef, "observation.snapshotRef", issues);
  const observedAt = instant(observation.observedAt, "observation.observedAt", issues);
  if (evaluatedAt !== null && observedAt !== null && observedAt > evaluatedAt) {
    issues.push("observation.observedAt cannot be later than evaluatedAt");
  }
  validateIdentity(observation.identity, "observation.identity", issues);
  requireDigest(observation.identityDigest, "observation.identityDigest", issues);
  if (observation.identityDigest !== computeCertificationIdentityDigest(observation.identity)) {
    issues.push("observation.identityDigest does not match the exact observed identity");
  }
  validateAliasResolution(observation.aliasResolution, observation.identity, "observation.aliasResolution", issues);
  if (observation.aliasResolution.resolvedAt !== observation.observedAt) {
    issues.push("observation.aliasResolution.resolvedAt must equal observation.observedAt");
  }
  if (
    observation.hardGates.length !== REQUIRED_HARD_GATES.length ||
    REQUIRED_HARD_GATES.some((gate) => observation.hardGates.filter((result) => result.gateRef === gate).length !== 1)
  ) {
    issues.push("observation.hardGates must contain every required hard gate exactly once");
  }
  for (const [index, gate] of observation.hardGates.entries()) {
    requireRef(gate.evidenceRef, `observation.hardGates[${index}].evidenceRef`, issues);
    if (gate.outcome !== "pass" && gate.outcome !== "fail") {
      issues.push(`observation.hardGates[${index}].outcome is unsupported`);
    }
  }
  validateScores(observation.softQualityScores, "observation.softQualityScores", issues);
  if (observation.retainedEvidence.rawPromptsRetained !== false ||
      observation.retainedEvidence.rawCompletionsRetained !== false) {
    issues.push("observation cannot retain raw prompts or completions");
  }
  if (input.certificate !== null) {
    if (observedAt !== null && observedAt < Date.parse(input.certificate.certifiedAt)) {
      issues.push("observation.observedAt cannot precede certificate.certifiedAt");
    }
    const baselineMetrics = input.certificate.softQualityBaselines.map((score) => score.metricRef).sort();
    const observedMetrics = observation.softQualityScores.map((score) => score.metricRef).sort();
    if (JSON.stringify(baselineMetrics) !== JSON.stringify(observedMetrics)) {
      issues.push("observation.softQualityScores must exactly match the certified metric catalog");
    }
  }
  if (input.rollbackCandidate !== null) {
    validateRollbackCandidate(input.rollbackCandidate, "rollbackCandidate", issues);
    if (input.rollbackCandidate.aliasResolution.resolvedAt !== input.evaluatedAt) {
      issues.push("rollbackCandidate.aliasResolution.resolvedAt must equal evaluatedAt");
    }
  }

  if (input.rollbackCandidate !== null && !certificationIdentitiesEqual(
    input.rollbackCandidate.certificate.identity,
    input.rollbackCandidate.resolvedIdentity,
  )) {
    issues.push("rollbackCandidate.resolvedIdentity must exactly match its certified identity");
  }
  if (issues.length > 0) throw new ModelDriftPolicyInputError(issues);
}

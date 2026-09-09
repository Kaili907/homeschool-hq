import {
  MODEL_DRIFT_POLICY_REVISION_REF,
  type CertificationAction,
  type CertificationEvaluationDecision,
  type CertificationEvaluationInput,
  type CertificationIdentityField,
  type CertificationState,
  type RecertificationRule,
  type RecertificationScope,
  type RollbackDecision,
  type SoftQualityBreach,
} from "./contracts.js";
import {
  certificationIdentitiesEqual,
  changedCertificationIdentityFields,
} from "./identity.js";
import { assertValidCertificationEvaluationInput } from "./validation.js";

export const SOFT_QUALITY_POLICY = {
  minimumScoreBasisPoints: 7_500,
  maximumDropBasisPoints: 500,
} as const;

export const RECERTIFICATION_RULES: readonly RecertificationRule[] = [
  { field: "providerRef", reasonCode: "PROVIDER_CHANGED", scope: "full-commercial-campaign" },
  { field: "modelRef", reasonCode: "MODEL_ALIAS_CHANGED", scope: "full-commercial-campaign" },
  { field: "modelRevisionRef", reasonCode: "MODEL_REVISION_CHANGED", scope: "full-commercial-campaign" },
  { field: "configurationDigest", reasonCode: "CONFIGURATION_CHANGED", scope: "full-commercial-campaign" },
  {
    field: "providerPolicyRevisionRef",
    reasonCode: "PROVIDER_POLICY_CHANGED",
    scope: "provider-eligibility-review-and-full-commercial-campaign",
  },
  {
    field: "routingPolicyRevisionRef",
    reasonCode: "ROUTING_POLICY_CHANGED",
    scope: "routing-integration-and-full-commercial-campaign",
  },
  {
    field: "curriculumCorpusRevisionRef",
    reasonCode: "CURRICULUM_CORPUS_CHANGED",
    scope: "curriculum-coverage-and-full-commercial-campaign",
  },
  {
    field: "evalCorpusRevisionRef",
    reasonCode: "EVAL_CORPUS_CHANGED",
    scope: "full-commercial-campaign-on-new-eval-corpus",
  },
  {
    field: "graderRevisionRef",
    reasonCode: "GRADER_CHANGED",
    scope: "regrade-or-rerun-under-new-grader",
  },
  {
    field: "learnerStageCatalogRevisionRef",
    reasonCode: "LEARNER_STAGE_CATALOG_CHANGED",
    scope: "stage-stratified-full-commercial-campaign",
  },
] as const;

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function recertificationScopes(
  changedFields: readonly CertificationIdentityField[],
  state: CertificationState,
): readonly RecertificationScope[] {
  const changedScopes = RECERTIFICATION_RULES
    .filter((rule) => changedFields.includes(rule.field))
    .map((rule) => rule.scope);
  if (changedScopes.length > 0) return unique(changedScopes);
  return state === "CERTIFIED" ? [] : ["full-commercial-campaign"];
}

function softQualityBreaches(input: CertificationEvaluationInput): readonly SoftQualityBreach[] {
  if (input.certificate === null) return [];
  const observedByMetric = new Map(input.observation.softQualityScores.map((score) => [score.metricRef, score.scoreBasisPoints]));
  return input.certificate.softQualityBaselines.flatMap((baseline) => {
    const observed = observedByMetric.get(baseline.metricRef);
    if (observed === undefined) return [];
    const drop = baseline.scoreBasisPoints - observed;
    const floorBreached = observed < SOFT_QUALITY_POLICY.minimumScoreBasisPoints;
    const maximumDropBreached = drop > SOFT_QUALITY_POLICY.maximumDropBasisPoints;
    return floorBreached || maximumDropBreached
      ? [{
          metricRef: baseline.metricRef,
          baselineBasisPoints: baseline.scoreBasisPoints,
          observedBasisPoints: observed,
          dropBasisPoints: drop,
          floorBreached,
          maximumDropBreached,
        }]
      : [];
  });
}

function rollbackDecision(input: CertificationEvaluationInput, state: CertificationState): RollbackDecision {
  if (state === "CERTIFIED") {
    return { decision: "none", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "CURRENT_CERTIFICATION_RETAINED" };
  }
  const candidate = input.rollbackCandidate;
  if (candidate === null) {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "NO_EXACT_ROLLBACK_CERTIFICATION" };
  }
  if (candidate.certificate.recordStatus !== "active") {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "ROLLBACK_CERTIFICATION_REVOKED" };
  }
  if (Date.parse(input.evaluatedAt) >= Date.parse(candidate.certificate.validUntil)) {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "ROLLBACK_CERTIFICATION_EXPIRED" };
  }
  if (Date.parse(input.evaluatedAt) < Date.parse(candidate.certificate.certifiedAt)) {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "ROLLBACK_CERTIFICATION_NOT_YET_VALID" };
  }
  if (!certificationIdentitiesEqual(candidate.certificate.identity, candidate.resolvedIdentity)) {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "ROLLBACK_IDENTITY_NOT_EXACT" };
  }
  if (certificationIdentitiesEqual(candidate.certificate.identity, input.observation.identity)) {
    return { decision: "fallback", targetCertificationRef: null, targetIdentityDigest: null, reasonCode: "ROLLBACK_IDENTITY_IS_CURRENT_CANDIDATE" };
  }
  return {
    decision: "revert-certification",
    targetCertificationRef: candidate.certificate.certificationRef,
    targetIdentityDigest: candidate.certificate.identityDigest,
    reasonCode: "EXACT_PRIOR_CERTIFICATION_AVAILABLE",
  };
}

function actionsFor(state: CertificationState, rollback: RollbackDecision): readonly CertificationAction[] {
  if (state === "CERTIFIED") return ["retain"];
  return [
    "quarantine",
    rollback.decision === "revert-certification" ? "revert-certification" : "fallback",
    "require-recertification",
  ];
}

export function evaluateCertification(input: CertificationEvaluationInput): CertificationEvaluationDecision {
  assertValidCertificationEvaluationInput(input);
  const certificate = input.certificate;
  const hardGateFailures = input.observation.hardGates
    .filter((gate) => gate.outcome === "fail")
    .map((gate) => gate.gateRef);
  const changedFields = certificate === null
    ? []
    : changedCertificationIdentityFields(certificate.identity, input.observation.identity);
  const breaches = softQualityBreaches(input);
  const reasons: string[] = [];
  let state: CertificationState;
  let revocationRequired = false;

  if (certificate === null) {
    state = "UNCERTIFIED";
    reasons.push("NO_CERTIFICATION_RECORD");
    if (hardGateFailures.length > 0) reasons.push("HARD_GATE_FAILURE_ON_UNCERTIFIED_CANDIDATE");
  } else if (certificate.recordStatus === "revoked") {
    state = "REVOKED";
    reasons.push("CERTIFICATION_ALREADY_REVOKED");
  } else if (hardGateFailures.length > 0 && changedFields.length === 0) {
    state = "REVOKED";
    revocationRequired = true;
    reasons.push("NON_COMPENSABLE_HARD_GATE_REGRESSION");
  } else if (
    input.observation.aliasResolution.aliasKind === "mutable-provider-alias" &&
    certificate.identity.providerRef === input.observation.identity.providerRef &&
    certificate.identity.modelRef === input.observation.identity.modelRef &&
    certificate.identity.modelRevisionRef !== input.observation.identity.modelRevisionRef
  ) {
    state = "DRIFT_DETECTED";
    reasons.push("MUTABLE_ALIAS_MODEL_REVISION_CHANGED");
    if (hardGateFailures.length > 0) reasons.push("HARD_GATE_FAILURE_ON_UNCERTIFIED_IDENTITY");
  } else if (changedFields.length > 0) {
    state = "RECERTIFICATION_REQUIRED";
    reasons.push("CERTIFICATION_IDENTITY_CHANGED");
    if (hardGateFailures.length > 0) reasons.push("HARD_GATE_FAILURE_ON_UNCERTIFIED_IDENTITY");
  } else if (Date.parse(input.evaluatedAt) >= Date.parse(certificate.validUntil)) {
    state = "EXPIRED";
    reasons.push("CERTIFICATION_VALIDITY_WINDOW_ENDED");
  } else if (Date.parse(input.evaluatedAt) < Date.parse(certificate.certifiedAt)) {
    state = "UNCERTIFIED";
    reasons.push("CERTIFICATION_NOT_YET_VALID");
  } else if (breaches.length > 0) {
    state = "DRIFT_DETECTED";
    reasons.push("SOFT_QUALITY_DRIFT_OUT_OF_BOUNDS");
  } else {
    state = "CERTIFIED";
    reasons.push("EXACT_CERTIFICATION_IDENTITY_CURRENT", "HARD_GATES_PASS", "SOFT_QUALITY_WITHIN_BOUNDS");
  }

  for (const failure of hardGateFailures) reasons.push(`HARD_GATE_FAILED:${failure}`);
  for (const field of changedFields) {
    const rule = RECERTIFICATION_RULES.find((candidate) => candidate.field === field);
    if (rule !== undefined) reasons.push(rule.reasonCode);
  }
  for (const breach of breaches) {
    if (breach.floorBreached) reasons.push(`SOFT_QUALITY_FLOOR_BREACHED:${breach.metricRef}`);
    if (breach.maximumDropBreached) reasons.push(`SOFT_QUALITY_DROP_EXCEEDED:${breach.metricRef}`);
  }

  const rollback = rollbackDecision(input, state);
  return {
    schemaVersion: "tutor-v2-model-drift-decision/4",
    policyRevisionRef: MODEL_DRIFT_POLICY_REVISION_REF,
    evaluatedAt: input.evaluatedAt,
    certificationRef: certificate?.certificationRef ?? null,
    state,
    certificationValid: state === "CERTIFIED",
    revocationRequired,
    changedIdentityFields: changedFields,
    recertificationScopes: recertificationScopes(changedFields, state),
    hardGateFailures,
    softQualityBreaches: breaches,
    reasonCodes: unique(reasons),
    actions: actionsFor(state, rollback),
    rollback,
    productionDeploymentAction: "none",
  };
}

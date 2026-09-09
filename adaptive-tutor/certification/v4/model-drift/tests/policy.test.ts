import assert from "node:assert/strict";
import test from "node:test";
import {
  CERTIFICATION_IDENTITY_FIELDS,
  REQUIRED_HARD_GATES,
  type CertificateRecord,
  type CertificationIdentity,
  type CertificationIdentityField,
} from "../src/contracts.js";
import {
  changedCertificationIdentityFields,
  computeCertificationIdentityDigest,
} from "../src/identity.js";
import { evaluateCertification, RECERTIFICATION_RULES } from "../src/policy.js";
import { ModelDriftPolicyInputError } from "../src/validation.js";
import {
  CERTIFIED_IDENTITY,
  aliasFor,
  makeCertificate,
  makeEvaluationInput,
  makeObservation,
  makeRollbackCandidate,
} from "../fixtures/deterministic-fixtures.js";

function changedIdentity(field: CertificationIdentityField): CertificationIdentity {
  if (field === "configurationDigest") {
    return { ...CERTIFIED_IDENTITY, configurationDigest: `sha256:${"d".repeat(64)}` };
  }
  return { ...CERTIFIED_IDENTITY, [field]: `${CERTIFIED_IDENTITY[field]}:changed` };
}

test("identity digest binds all ten fields in canonical order", () => {
  const original = computeCertificationIdentityDigest(CERTIFIED_IDENTITY);
  assert.match(original, /^sha256:[a-f0-9]{64}$/);
  for (const field of CERTIFICATION_IDENTITY_FIELDS) {
    const changed = changedIdentity(field);
    assert.notEqual(computeCertificationIdentityDigest(changed), original, field);
    assert.deepEqual(changedCertificationIdentityFields(CERTIFIED_IDENTITY, changed), [field]);
  }
  assert.equal(computeCertificationIdentityDigest(structuredClone(CERTIFIED_IDENTITY)), original);
});

test("exact current identity with passing gates and bounded quality retains certification", () => {
  const decision = evaluateCertification(makeEvaluationInput());
  assert.equal(decision.state, "CERTIFIED");
  assert.equal(decision.certificationValid, true);
  assert.deepEqual(decision.actions, ["retain"]);
  assert.equal(decision.rollback.decision, "none");
  assert.equal(decision.productionDeploymentAction, "none");
});

test("missing certification is unqualified and cannot retain", () => {
  const decision = evaluateCertification(makeEvaluationInput({ certificate: null }));
  assert.equal(decision.state, "UNCERTIFIED");
  assert.equal(decision.certificationValid, false);
  assert.deepEqual(decision.actions, ["quarantine", "fallback", "require-recertification"]);
});

test("expiration is exclusive at validUntil", () => {
  const certificate = makeCertificate();
  const decision = evaluateCertification(makeEvaluationInput({
    certificate,
    evaluatedAt: certificate.validUntil,
    observation: makeObservation(CERTIFIED_IDENTITY, { observedAt: certificate.validUntil }),
  }));
  assert.equal(decision.state, "EXPIRED");
  assert.ok(decision.reasonCodes.includes("CERTIFICATION_VALIDITY_WINDOW_ENDED"));
});

test("a recorded revocation remains revoked", () => {
  const active = makeCertificate();
  const certificate: CertificateRecord = {
    ...active,
    recordStatus: "revoked",
    revocation: { revokedAt: "2026-08-15T00:00:00.000Z", reasonRef: "revocation:operator-r1" },
  };
  const decision = evaluateCertification(makeEvaluationInput({ certificate }));
  assert.equal(decision.state, "REVOKED");
  assert.equal(decision.revocationRequired, false);
});

test("a mutable provider alias resolving to a new revision invalidates the old certification", () => {
  const observedIdentity = changedIdentity("modelRevisionRef");
  const decision = evaluateCertification(makeEvaluationInput({
    observation: makeObservation(observedIdentity),
  }));
  assert.equal(decision.state, "DRIFT_DETECTED");
  assert.equal(decision.certificationValid, false);
  assert.deepEqual(decision.changedIdentityFields, ["modelRevisionRef"]);
  assert.ok(decision.reasonCodes.includes("MUTABLE_ALIAS_MODEL_REVISION_CHANGED"));
  assert.ok(decision.actions.includes("quarantine"));
});

test("every non-alias identity change selects its exact recertification scope", () => {
  for (const rule of RECERTIFICATION_RULES.filter((candidate) => candidate.field !== "modelRevisionRef")) {
    const identity = changedIdentity(rule.field);
    const decision = evaluateCertification(makeEvaluationInput({
      observation: makeObservation(identity, {
        aliasResolution: aliasFor(identity, "pinned-revision"),
      }),
    }));
    assert.equal(decision.state, "RECERTIFICATION_REQUIRED", rule.field);
    assert.deepEqual(decision.changedIdentityFields, [rule.field], rule.field);
    assert.ok(decision.recertificationScopes.includes(rule.scope), rule.field);
    assert.ok(decision.reasonCodes.includes(rule.reasonCode), rule.field);
  }
});

test("configuration, policy, corpus, grader, and learner-stage changes never retain", () => {
  const fields: readonly CertificationIdentityField[] = [
    "configurationDigest",
    "providerPolicyRevisionRef",
    "routingPolicyRevisionRef",
    "curriculumCorpusRevisionRef",
    "evalCorpusRevisionRef",
    "graderRevisionRef",
    "learnerStageCatalogRevisionRef",
  ];
  for (const field of fields) {
    const identity = changedIdentity(field);
    const decision = evaluateCertification(makeEvaluationInput({ observation: makeObservation(identity) }));
    assert.equal(decision.certificationValid, false, field);
    assert.ok(decision.actions.includes("require-recertification"), field);
  }
});

test("one hard-gate regression immediately revokes despite perfect soft scores", () => {
  const observation = makeObservation(CERTIFIED_IDENTITY, {
    hardGates: REQUIRED_HARD_GATES.map((gateRef) => ({
      gateRef,
      outcome: gateRef === "PRIVACY_FAILURE" ? "fail" : "pass",
      evidenceRef: `hard-gate:${gateRef}`,
    })),
    softQualityScores: [
      { metricRef: "academic-correctness", scoreBasisPoints: 10_000 },
      { metricRef: "pedagogical-clarity", scoreBasisPoints: 10_000 },
    ],
  });
  const decision = evaluateCertification(makeEvaluationInput({ observation }));
  assert.equal(decision.state, "REVOKED");
  assert.equal(decision.revocationRequired, true);
  assert.deepEqual(decision.hardGateFailures, ["PRIVACY_FAILURE"]);
  assert.ok(decision.reasonCodes.includes("NON_COMPENSABLE_HARD_GATE_REGRESSION"));
  assert.equal(decision.certificationValid, false);
});

test("soft quality exactly at the floor and maximum drop remains certified", () => {
  const certificate = makeCertificate(CERTIFIED_IDENTITY, {
    softQualityBaselines: [
      { metricRef: "academic-correctness", scoreBasisPoints: 8_000, evidenceRef: "baseline:boundary" },
    ],
  });
  const observation = makeObservation(CERTIFIED_IDENTITY, {
    softQualityScores: [{ metricRef: "academic-correctness", scoreBasisPoints: 7_500 }],
  });
  const decision = evaluateCertification(makeEvaluationInput({ certificate, observation }));
  assert.equal(decision.state, "CERTIFIED");
});

test("soft quality beyond maximum drop is drift, not revocation", () => {
  const observation = makeObservation(CERTIFIED_IDENTITY, {
    softQualityScores: [
      { metricRef: "academic-correctness", scoreBasisPoints: 8_499 },
      { metricRef: "pedagogical-clarity", scoreBasisPoints: 8_200 },
    ],
  });
  const decision = evaluateCertification(makeEvaluationInput({ observation }));
  assert.equal(decision.state, "DRIFT_DETECTED");
  assert.equal(decision.revocationRequired, false);
  assert.ok(decision.reasonCodes.includes("SOFT_QUALITY_DROP_EXCEEDED:academic-correctness"));
});

test("a high score cannot compensate for another metric crossing its floor", () => {
  const observation = makeObservation(CERTIFIED_IDENTITY, {
    softQualityScores: [
      { metricRef: "academic-correctness", scoreBasisPoints: 10_000 },
      { metricRef: "pedagogical-clarity", scoreBasisPoints: 7_499 },
    ],
  });
  const decision = evaluateCertification(makeEvaluationInput({ observation }));
  assert.equal(decision.state, "DRIFT_DETECTED");
  assert.ok(decision.reasonCodes.includes("SOFT_QUALITY_FLOOR_BREACHED:pedagogical-clarity"));
});

test("an exact active prior certificate produces a deterministic revert recommendation", () => {
  const observation = makeObservation(changedIdentity("modelRevisionRef"));
  const decision = evaluateCertification(makeEvaluationInput({
    observation,
    rollbackCandidate: makeRollbackCandidate(),
  }));
  assert.equal(decision.rollback.decision, "revert-certification");
  assert.equal(decision.rollback.targetCertificationRef, "certification:synthetic-alpha-prior");
  assert.deepEqual(decision.actions, ["quarantine", "revert-certification", "require-recertification"]);
});

test("alias drift can revert to the same certificate only when its old revision resolves exactly", () => {
  const certificate = makeCertificate();
  const rollbackCandidate = {
    certificate,
    resolvedIdentity: certificate.identity,
    aliasResolution: aliasFor(certificate.identity, "pinned-revision" as const, "2026-08-16T12:01:00.000Z"),
  };
  const observedIdentity = changedIdentity("modelRevisionRef");
  const observation = makeObservation(observedIdentity, {
    hardGates: REQUIRED_HARD_GATES.map((gateRef) => ({
      gateRef,
      outcome: gateRef === "ANSWER_LEAKAGE" ? "fail" as const : "pass" as const,
      evidenceRef: `hard-gate:${gateRef}`,
    })),
  });
  const decision = evaluateCertification(makeEvaluationInput({ certificate, observation, rollbackCandidate }));
  assert.equal(decision.state, "DRIFT_DETECTED");
  assert.equal(decision.revocationRequired, false);
  assert.ok(decision.reasonCodes.includes("HARD_GATE_FAILURE_ON_UNCERTIFIED_IDENTITY"));
  assert.equal(decision.rollback.decision, "revert-certification");
  assert.equal(decision.rollback.targetCertificationRef, certificate.certificationRef);
});

test("an expired prior certificate cannot be recommended for revert", () => {
  const rollbackCandidate = makeRollbackCandidate();
  const expiredCertificate = makeCertificate(rollbackCandidate.resolvedIdentity, {
    certificationRef: "certification:synthetic-alpha-prior",
    identity: rollbackCandidate.resolvedIdentity,
    identityDigest: computeCertificationIdentityDigest(rollbackCandidate.resolvedIdentity),
    certifiedAt: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
  });
  const decision = evaluateCertification(makeEvaluationInput({
    observation: makeObservation(changedIdentity("modelRevisionRef")),
    rollbackCandidate: { ...rollbackCandidate, certificate: expiredCertificate },
  }));
  assert.equal(decision.rollback.decision, "fallback");
  assert.equal(decision.rollback.reasonCode, "ROLLBACK_CERTIFICATION_EXPIRED");
});

test("tampered identity digests are rejected", () => {
  const certificate = makeCertificate(CERTIFIED_IDENTITY, {
    identityDigest: `sha256:${"f".repeat(64)}`,
  });
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({ certificate })),
    ModelDriftPolicyInputError,
  );
});

test("incomplete hard gates and soft metric catalogs are rejected closed", () => {
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({
      observation: makeObservation(CERTIFIED_IDENTITY, { hardGates: [] }),
    })),
    /every required hard gate exactly once/,
  );
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({
      observation: makeObservation(CERTIFIED_IDENTITY, {
        softQualityScores: [{ metricRef: "academic-correctness", scoreBasisPoints: 9_000 }],
      }),
    })),
    /exactly match the certified metric catalog/,
  );
});

test("runtime values outside the serialized unions are rejected", () => {
  const observation = makeObservation() as unknown as {
    sourceKind: string;
    retainedEvidence: { rawPromptsRetained: boolean; rawCompletionsRetained: boolean };
  };
  observation.sourceKind = "provider-self-attestation";
  observation.retainedEvidence.rawPromptsRetained = true;
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({
      observation: observation as never,
    })),
    /sourceKind is unsupported.*cannot retain raw prompts or completions/,
  );
});

test("stale observation and rollback resolution evidence are rejected", () => {
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({
      observation: makeObservation(CERTIFIED_IDENTITY, {
        observedAt: "2026-07-31T23:59:59.000Z",
      }),
    })),
    /cannot precede certificate.certifiedAt/,
  );
  const rollbackCandidate = makeRollbackCandidate();
  assert.throws(
    () => evaluateCertification(makeEvaluationInput({
      observation: makeObservation(changedIdentity("modelRevisionRef")),
      rollbackCandidate: {
        ...rollbackCandidate,
        aliasResolution: {
          ...rollbackCandidate.aliasResolution,
          resolvedAt: "2026-08-16T11:59:00.000Z",
        },
      },
    })),
    /rollbackCandidate.aliasResolution.resolvedAt must equal evaluatedAt/,
  );
});

test("the same recorded input always produces the same decision", () => {
  const input = makeEvaluationInput({ observation: makeObservation(changedIdentity("providerPolicyRevisionRef")) });
  assert.deepEqual(evaluateCertification(input), evaluateCertification(structuredClone(input)));
});

test("recertification rules cover each identity field exactly once", () => {
  assert.deepEqual(RECERTIFICATION_RULES.map((rule) => rule.field), CERTIFICATION_IDENTITY_FIELDS);
});

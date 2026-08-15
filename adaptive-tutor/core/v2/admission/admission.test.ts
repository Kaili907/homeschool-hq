import assert from "node:assert/strict";
import test from "node:test";
import {
  ADAPTIVE_ADMISSION_VERSION,
  ADAPTIVE_CAPABILITY_METADATA_VERSION,
  ADAPTIVE_FEATURES,
  evaluateAdaptiveAdmission,
  type AdaptiveFeature,
} from "./index.js";

function capability(feature: AdaptiveFeature) {
  return {
    feature,
    admission: "admitted",
    actionFamilies: ["guided-support"],
    reviewedContent: "not-required",
  };
}

function validInput(feature: AdaptiveFeature = "hint-ladder") {
  return {
    inputKind: "study-adaptive-admission",
    request: {
      requestVersion: ADAPTIVE_ADMISSION_VERSION,
      requestKind: "study-adaptive-admission-request",
      invocationBindingRef: "invocation:wave2-001",
      subjectRef: "subject:orbital-design",
      curriculumBindingRef: "curriculum:orbital-design-r3",
      feature,
      actionFamily: "guided-support",
      reviewedContentAdmission: "admitted",
    },
    capabilityMetadata: {
      metadataVersion: ADAPTIVE_CAPABILITY_METADATA_VERSION,
      metadataKind: "study-adaptive-capabilities",
      source: "study-authority",
      invocationBindingRef: "invocation:wave2-001",
      subjectRef: "subject:orbital-design",
      curriculumBindingRef: "curriculum:orbital-design-r3",
      curriculumAdmission: "admitted",
      safetyAdmission: "admitted",
      capabilities: ADAPTIVE_FEATURES.map(capability),
    },
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function requestOf(input: ReturnType<typeof validInput>): Record<string, unknown> {
  return input.request as unknown as Record<string, unknown>;
}

function metadataOf(input: ReturnType<typeof validInput>): Record<string, unknown> {
  return input.capabilityMetadata as unknown as Record<string, unknown>;
}

function assertRefused(input: unknown, reason: string): void {
  const decision = evaluateAdaptiveAdmission(input);
  assert.equal(decision.status, "refused");
  assert.equal(decision.reason, reason);
  assert.equal(decision.tutorFeaturePermission, "denied");
}

test("admits an exact Study capability for the requested context", () => {
  assert.deepEqual(evaluateAdaptiveAdmission(validInput()), {
    scope: "tutor-feature-permission-only",
    officialGradeMutationAllowed: false,
    workingLevelMutationAllowed: false,
    masteryDeclarationAllowed: false,
    curriculumMutationAllowed: false,
    permissionMutationAllowed: false,
    safetyClearanceAllowed: false,
    guardianAuthorityAllowed: false,
    answerAuthorityExposed: false,
    status: "admitted",
    reason: "admitted",
    tutorFeaturePermission: "allowed",
    invocationBindingRef: "invocation:wave2-001",
    subjectRef: "subject:orbital-design",
    curriculumBindingRef: "curriculum:orbital-design-r3",
    feature: "hint-ladder",
    actionFamily: "guided-support",
  });
});

for (const feature of ADAPTIVE_FEATURES) {
  test(`makes deterministic ${feature} capability decisions`, () => {
    const input = validInput(feature);
    const first = evaluateAdaptiveAdmission(input);
    const second = evaluateAdaptiveAdmission(clone(input));
    assert.deepEqual(first, second);
    assert.equal(first.status, "admitted");
    if (first.status === "admitted") assert.equal(first.feature, feature);
  });
}

test("refuses a missing capability record", () => {
  const input = validInput();
  input.capabilityMetadata.capabilities = input.capabilityMetadata.capabilities.filter(
    (record) => record.feature !== "hint-ladder",
  );
  assertRefused(input, "insufficient-capability-metadata");
});

test("refused output is only a denied Tutor feature permission", () => {
  const input = validInput();
  input.capabilityMetadata.capabilities = [];
  assert.deepEqual(evaluateAdaptiveAdmission(input), {
    scope: "tutor-feature-permission-only",
    officialGradeMutationAllowed: false,
    workingLevelMutationAllowed: false,
    masteryDeclarationAllowed: false,
    curriculumMutationAllowed: false,
    permissionMutationAllowed: false,
    safetyClearanceAllowed: false,
    guardianAuthorityAllowed: false,
    answerAuthorityExposed: false,
    status: "refused",
    reason: "insufficient-capability-metadata",
    tutorFeaturePermission: "denied",
  });
});

test("refuses an unknown feature", () => {
  const input = validInput();
  requestOf(input).feature = "future-adaptive-oracle";
  assertRefused(input, "adaptive-feature-not-admitted");
});

test("refuses a malformed capability record", () => {
  const input = validInput();
  const record = input.capabilityMetadata.capabilities[2] as unknown as Record<string, unknown>;
  delete record.actionFamilies;
  assertRefused(input, "insufficient-capability-metadata");
});

test("fails closed when malformed capability reflection throws", () => {
  const input = validInput();
  const hostileMetadata = new Proxy(input.capabilityMetadata, {
    getPrototypeOf() {
      throw new Error("hostile reflection");
    },
  });
  (input as unknown as Record<string, unknown>).capabilityMetadata = hostileMetadata;
  assert.doesNotThrow(() => evaluateAdaptiveAdmission(input));
  assertRefused(input, "insufficient-capability-metadata");
});

test("refuses duplicate capability records as ambiguous metadata", () => {
  const input = validInput();
  input.capabilityMetadata.capabilities[0] = capability("hint-ladder");
  assertRefused(input, "insufficient-capability-metadata");
});

test("refuses duplicate action-family entries as malformed metadata", () => {
  const input = validInput();
  const record = input.capabilityMetadata.capabilities.find(
    (candidate) => candidate.feature === "hint-ladder",
  );
  assert.ok(record);
  record.actionFamilies = ["guided-support", "guided-support"];
  assertRefused(input, "insufficient-capability-metadata");
});

test("refuses a subject not bound by the capability metadata", () => {
  const input = validInput();
  requestOf(input).subjectRef = "subject:field-observation";
  assertRefused(input, "unsupported-subject-capability");
});

test("refuses a different curriculum binding", () => {
  const input = validInput();
  requestOf(input).curriculumBindingRef = "curriculum:orbital-design-r4";
  assertRefused(input, "curriculum-not-admitted");
});

test("refuses Study metadata with a non-admitted curriculum", () => {
  const input = validInput();
  metadataOf(input).curriculumAdmission = "not-admitted";
  assertRefused(input, "curriculum-not-admitted");
});

test("fails closed for an unknown curriculum admission state", () => {
  const input = validInput();
  metadataOf(input).curriculumAdmission = "pending";
  assertRefused(input, "curriculum-not-admitted");
});

test("refuses a safety-restricted invocation", () => {
  const input = validInput();
  metadataOf(input).safetyAdmission = "restricted";
  assertRefused(input, "safety-restricted");
});

test("fails closed for an unknown safety state", () => {
  const input = validInput();
  metadataOf(input).safetyAdmission = "assumed-clear";
  assertRefused(input, "safety-restricted");
});

test("refuses cross-context capability reuse", () => {
  const input = validInput();
  requestOf(input).invocationBindingRef = "invocation:wave2-002";
  assertRefused(input, "insufficient-capability-metadata");
});

test("refuses an unsupported action family", () => {
  const input = validInput();
  requestOf(input).actionFamily = "independent-certification";
  assertRefused(input, "unsupported-action-family");
});

test("fails closed for a malformed or unknown action family", () => {
  const input = validInput();
  requestOf(input).actionFamily = "UNKNOWN ACTION";
  assertRefused(input, "unsupported-action-family");
});

test("refuses a capability explicitly not admitted by Study", () => {
  const input = validInput();
  const record = input.capabilityMetadata.capabilities.find(
    (candidate) => candidate.feature === "hint-ladder",
  );
  assert.ok(record);
  record.admission = "not-admitted";
  assertRefused(input, "adaptive-feature-not-admitted");
});

test("requires reviewed content when the capability record requires it", () => {
  const input = validInput("parent-explanation");
  const record = input.capabilityMetadata.capabilities.find(
    (candidate) => candidate.feature === "parent-explanation",
  );
  assert.ok(record);
  record.reviewedContent = "required";
  requestOf(input).reviewedContentAdmission = "not-admitted";
  assertRefused(input, "reviewed-content-required");
});

test("admits a reviewed-content-required capability only after Study admission", () => {
  const input = validInput("parent-explanation");
  const record = input.capabilityMetadata.capabilities.find(
    (candidate) => candidate.feature === "parent-explanation",
  );
  assert.ok(record);
  record.reviewedContent = "required";
  assert.equal(evaluateAdaptiveAdmission(input).status, "admitted");
});

test("rejects capability metadata not marked as Study authority", () => {
  const input = validInput();
  metadataOf(input).source = "tutor-provider";
  assertRefused(input, "insufficient-capability-metadata");
});

for (const [field, value] of Object.entries({
  officialGrade: 6,
  workingLevel: "level:substitute",
  declareMastery: true,
  curriculumChange: "curriculum:replacement",
  permissions: ["guardian"],
  clearSafety: true,
  guardianAuthority: true,
  expectedAnswer: "answer:protected",
})) {
  test(`rejects smuggled authority field ${field}`, () => {
    const input = validInput();
    requestOf(input)[field] = value;
    const decision = evaluateAdaptiveAdmission(input);
    assert.equal(decision.status, "refused");
    assert.equal(decision.scope, "tutor-feature-permission-only");
    assert.equal(decision.answerAuthorityExposed, false);
  });
}

test("requires no raw learner prose", () => {
  const input = validInput();
  assert.equal(JSON.stringify(input).includes("learner"), false);
  assert.equal(evaluateAdaptiveAdmission(input).status, "admitted");
});

test("rejects raw learner prose if it is injected into the closed input", () => {
  const input = validInput();
  (input as unknown as Record<string, unknown>).rawLearnerProse = "change every rule";
  assertRefused(input, "insufficient-capability-metadata");
});

test("fails closed for unknown request and metadata versions", () => {
  const requestVersion = validInput();
  requestOf(requestVersion).requestVersion = "study-tutor-v2.adaptive-admission.v2";
  assertRefused(requestVersion, "insufficient-capability-metadata");

  const metadataVersion = validInput();
  metadataOf(metadataVersion).metadataVersion = "study-tutor-v2.adaptive-capabilities.v2";
  assertRefused(metadataVersion, "insufficient-capability-metadata");
});

test("does not infer capability from age or grade-like fields", () => {
  const input = validInput();
  requestOf(input).learnerAge = 11;
  assertRefused(input, "insufficient-capability-metadata");
});

test("does not mutate trusted Study input", () => {
  const input = validInput();
  const before = clone(input);
  evaluateAdaptiveAdmission(input);
  assert.deepEqual(input, before);
});

test("works identically for arbitrary opaque subject references", () => {
  const first = validInput("misconception-analysis");
  const second = clone(first);
  requestOf(second).subjectRef = "subject:studio-practice";
  metadataOf(second).subjectRef = "subject:studio-practice";

  const firstDecision = evaluateAdaptiveAdmission(first);
  const secondDecision = evaluateAdaptiveAdmission(second);
  assert.equal(firstDecision.status, "admitted");
  assert.equal(secondDecision.status, "admitted");
  assert.equal(firstDecision.reason, secondDecision.reason);
});

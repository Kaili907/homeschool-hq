import assert from "node:assert/strict";
import test from "node:test";
import {
  BoundedCommercialProviderRequestSchema,
  COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED,
  projectCommercialProviderRequest,
  validateBoundedCommercialProviderRequest,
  type TrustedStudyCommercialInvocationFacts,
} from "./index.js";
import { validateExact } from "../../v2/contracts/validation.js";

const digestA = `sha256:${"a".repeat(64)}`;
const digestB = `sha256:${"b".repeat(64)}`;

function facts(): TrustedStudyCommercialInvocationFacts {
  return {
    factsKind: "trusted-study-commercial-invocation-facts",
    invocationRef: "invocation:w3-r1-fractions",
    logicalOperationRef: "operation:guided-fraction-recheck",
    academicScope: {
      subjectRef: "subject:math",
      courseRef: "course:grade-6-math",
      conceptRef: "concept:equivalent-fractions",
    },
    actionFamily: "HINT",
    assessmentPhase: "instruction-or-practice",
    attemptEvidence: {
      attemptRef: "attempt:opaque-002",
      attemptOrdinal: 2,
      attemptCount: 2,
      assistanceLevel: "light-hint",
      academicSignalCodes: ["ATTEMPT_INCORRECT", "MISCONCEPTION_IDENTIFIED"],
      misconceptionRefs: ["misconception:unequal-denominators"],
      completionSignal: "IN_PROGRESS",
      recheckSignal: "REQUESTED",
    },
    reviewedContentEvidence: [{
      contentRef: "content:reviewed-fraction-model",
      contentDigest: digestA,
    }],
    groundingEvidence: [{
      groundingRef: "grounding:fraction-model-a",
      contentDigest: digestB,
    }],
    presentationRequirement: "TEXT_ONLY",
    policyRefs: {
      learnerStagePolicyRef: "policy:middle-grades-stage",
      providerPolicyRef: "policy:minor-zero-retention",
      configurationRef: "config:commercial-tutor-v3",
      safetyPolicyRef: "policy:minor-heightened-safety",
      presentationPolicyRef: "policy:text-only-presentation",
    },
  };
}

test("projects a closed provider request containing only structured Study evidence", () => {
  const result = projectCommercialProviderRequest(facts());
  assert.equal(result.status, "accepted-commercial-provider-request");
  if (result.status !== "accepted-commercial-provider-request") return;
  assert.equal(
    validateExact(BoundedCommercialProviderRequestSchema, result.request).status,
    "accepted",
  );
  assert.equal(result.request.rawAttemptDisclosureAllowed, false);
  assert.equal(COMMERCIAL_PROVIDER_RAW_ATTEMPT_DISCLOSURE_ALLOWED, false);
  assert.equal(result.request.disclosureBoundary, "STUDY_DERIVED_STRUCTURED_EVIDENCE_ONLY");
  assert.deepEqual(result.request.attemptEvidence, facts().attemptEvidence);
  assert.equal(JSON.stringify(result.request).includes("private learner words"), false);
});

test("omits attempt evidence when Study supplies no attempt evidence", () => {
  const input = facts();
  delete input.attemptEvidence;
  const result = projectCommercialProviderRequest(input);
  assert.equal(result.status, "accepted-commercial-provider-request");
  if (result.status !== "accepted-commercial-provider-request") return;
  assert.equal(Object.hasOwn(result.request, "attemptEvidence"), false);
});

test("rejects raw learner, answer, conversation, media, prompt, and credential attacks", () => {
  const attacks: ReadonlyArray<readonly [string, unknown]> = [
    ["learnerResponse", "private learner words"],
    ["rawAttemptText", "private learner words"],
    ["studentAnswer", "42"],
    ["conversation", ["learner", "tutor"]],
    ["messages", [{ role: "student", content: "private learner words" }]],
    ["transcript", "raw Tutor transcript"],
    ["rawTutorTranscript", "raw Tutor transcript"],
    ["correctAnswer", "42"],
    ["answerIndex", 2],
    ["expectedAnswer", "42"],
    ["answerKey", "42"],
    ["audio", new Uint8Array([1, 2, 3])],
    ["audioBytes", new Uint8Array([1, 2, 3])],
    ["image", new Uint8Array([4, 5, 6])],
    ["imageBytes", new Uint8Array([4, 5, 6])],
    ["providerPrompt", "hidden provider prompt"],
    ["credentials", "secret-token"],
    ["diagnosis", "diagnostic prose"],
    ["personalityProfile", "personality prose"],
    ["emotionalState", "emotional prose"],
  ];

  for (const [field, value] of attacks) {
    const result = projectCommercialProviderRequest({ ...facts(), [field]: value });
    assert.deepEqual(result, {
      status: "provider-request-rejected",
      reasonCode: "INVALID_TRUSTED_STUDY_FACTS",
      providerCallAllowed: false,
    }, field);
  }
});

test("rejects attacks at the direct commercial provider boundary", () => {
  const projected = projectCommercialProviderRequest(facts());
  assert.equal(projected.status, "accepted-commercial-provider-request");
  if (projected.status !== "accepted-commercial-provider-request") return;
  for (const field of [
    "learnerResponse",
    "rawAttemptText",
    "studentAnswer",
    "conversation",
    "messages",
    "transcript",
    "rawTutorTranscript",
    "correctAnswer",
    "answerIndex",
    "expectedAnswer",
    "answerKey",
    "audioBytes",
    "imageBytes",
    "providerPrompt",
    "credentials",
    "diagnosis",
    "personalityProfile",
    "emotionalState",
    "unknownField",
  ]) {
    const result = validateBoundedCommercialProviderRequest({
      ...projected.request,
      [field]: "attack",
    });
    assert.deepEqual(result, {
      status: "provider-request-rejected",
      reasonCode: "INVALID_COMMERCIAL_PROVIDER_REQUEST",
      providerCallAllowed: false,
    }, field);
  }
});

test("rejects nested raw-attempt and answer fields instead of stripping them", () => {
  for (const contaminatedAttempt of [
    { ...facts().attemptEvidence, learnerResponse: "private learner words" },
    { ...facts().attemptEvidence, rawAttemptText: "private learner words" },
    { ...facts().attemptEvidence, studentAnswer: "42" },
    { ...facts().attemptEvidence, correctAnswer: "42" },
  ]) {
    assert.equal(
      projectCommercialProviderRequest({
        ...facts(),
        attemptEvidence: contaminatedAttempt,
      }).status,
      "provider-request-rejected",
    );
  }
});

test("rejects hostile prototypes and accessors without invoking getters", () => {
  const inherited = Object.assign(Object.create({ learnerResponse: "inherited" }), facts());
  assert.equal(projectCommercialProviderRequest(inherited).status, "provider-request-rejected");

  let rootGetterReads = 0;
  const rootGetter = facts() as unknown as Record<string, unknown>;
  Object.defineProperty(rootGetter, "rawAttemptText", {
    enumerable: true,
    get() {
      rootGetterReads += 1;
      return "private learner words";
    },
  });
  assert.equal(projectCommercialProviderRequest(rootGetter).status, "provider-request-rejected");
  assert.equal(rootGetterReads, 0);

  let arrayGetterReads = 0;
  const hostileArray = new Array(1);
  Object.defineProperty(hostileArray, 0, {
    enumerable: true,
    get() {
      arrayGetterReads += 1;
      return {
        groundingRef: "grounding:hostile",
        contentDigest: digestA,
      };
    },
  });
  assert.equal(
    projectCommercialProviderRequest({ ...facts(), groundingEvidence: hostileArray }).status,
    "provider-request-rejected",
  );
  assert.equal(arrayGetterReads, 0);

  const projected = projectCommercialProviderRequest(facts());
  assert.equal(projected.status, "accepted-commercial-provider-request");
  if (projected.status !== "accepted-commercial-provider-request") return;
  let providerGetterReads = 0;
  const providerGetter = structuredClone(projected.request) as unknown as Record<
    string,
    unknown
  >;
  Object.defineProperty(providerGetter, "providerPrompt", {
    enumerable: true,
    get() {
      providerGetterReads += 1;
      return "hidden provider prompt";
    },
  });
  assert.equal(
    validateBoundedCommercialProviderRequest(providerGetter).status,
    "provider-request-rejected",
  );
  assert.equal(providerGetterReads, 0);
});

test("rejects inconsistent or duplicate structured evidence with bounded reasons", () => {
  assert.deepEqual(
    projectCommercialProviderRequest({
      ...facts(),
      attemptEvidence: {
        ...facts().attemptEvidence,
        attemptOrdinal: 3,
        attemptCount: 2,
      },
    }),
    {
      status: "provider-request-rejected",
      reasonCode: "INCONSISTENT_ATTEMPT_EVIDENCE",
      providerCallAllowed: false,
    },
  );

  assert.deepEqual(
    projectCommercialProviderRequest({
      ...facts(),
      reviewedContentEvidence: [
        facts().reviewedContentEvidence[0],
        facts().reviewedContentEvidence[0],
      ],
    }),
    {
      status: "provider-request-rejected",
      reasonCode: "DUPLICATE_STRUCTURED_REFERENCE",
      providerCallAllowed: false,
    },
  );

  const projected = projectCommercialProviderRequest(facts());
  assert.equal(projected.status, "accepted-commercial-provider-request");
  if (projected.status !== "accepted-commercial-provider-request") return;
  assert.deepEqual(
    validateBoundedCommercialProviderRequest({
      ...projected.request,
      attemptEvidence: {
        ...projected.request.attemptEvidence,
        attemptOrdinal: 3,
        attemptCount: 2,
      },
    }),
    {
      status: "provider-request-rejected",
      reasonCode: "INCONSISTENT_ATTEMPT_EVIDENCE",
      providerCallAllowed: false,
    },
  );
});

test("returns a detached deeply frozen provider request", () => {
  const input = facts();
  const result = projectCommercialProviderRequest(input);
  assert.equal(result.status, "accepted-commercial-provider-request");
  if (result.status !== "accepted-commercial-provider-request") return;
  input.academicScope.conceptRef = "concept:mutated-after-projection";
  assert.equal(result.request.academicScope.conceptRef, "concept:equivalent-fractions");
  assert.equal(Object.isFrozen(result.request), true);
  assert.equal(Object.isFrozen(result.request.academicScope), true);
  assert.equal(Object.isFrozen(result.request.reviewedContentEvidence), true);
  assert.equal(Object.isFrozen(result.request.reviewedContentEvidence[0]), true);
});

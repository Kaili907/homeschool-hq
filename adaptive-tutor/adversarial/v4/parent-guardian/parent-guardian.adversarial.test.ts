import assert from "node:assert/strict";
import test from "node:test";
import { buildMinimizedParentHubReport } from "../../../study-engine/tutor-v2/parent-reporting/parent-report.js";
import {
  PRIVATE_SENTINEL,
  periodAuthorization,
  periodRequest,
  sessionAuthorization,
  sessionEvidence,
  sessionRequest,
} from "./fixtures.js";

type RejectionCode =
  | "PARENT_REPORT_REQUEST_REJECTED"
  | "PARENT_REPORT_AUTHORIZATION_REJECTED"
  | "PARENT_REPORT_CONSENT_REJECTED"
  | "PARENT_REPORT_SCOPE_MISMATCH";

function assertRejectedWithoutReflection(
  value: unknown,
  code?: RejectionCode,
): void {
  const result = buildMinimizedParentHubReport(value);
  assert.equal(result.status, "rejected");
  if (code !== undefined) {
    assert.deepEqual(result, { status: "rejected", code });
  }
  assert.doesNotMatch(JSON.stringify(result), /private-w4-sentinel/i);
}

test("control: exact current Study authorization is accepted", () => {
  const result = buildMinimizedParentHubReport(sessionRequest());
  assert.equal(result.status, "accepted");
});

const sessionAuthorizationAttacks: ReadonlyArray<{
  name: string;
  mutate: (request: Record<string, unknown>) => void;
}> = [
  {
    name: "missing authorization",
    mutate: (request) => {
      delete request.guardianAuthorization;
    },
  },
  {
    name: "wrong guardian",
    mutate: (request) => {
      (request.guardianAuthorization as Record<string, unknown>).guardianRef =
        "guardian:w4-b";
    },
  },
  {
    name: "wrong household",
    mutate: (request) => {
      (
        request.guardianAuthorization as Record<string, unknown>
      ).householdScopeRef = "household:w4-b";
    },
  },
  {
    name: "wrong learner",
    mutate: (request) => {
      (
        request.guardianAuthorization as Record<string, unknown>
      ).learnerScopeRef = "learner:w4-b";
    },
  },
  {
    name: "wrong session",
    mutate: (request) => {
      (request.guardianAuthorization as Record<string, unknown>).sessionRef =
        "session:w4-b";
    },
  },
  {
    name: "wrong visibility",
    mutate: (request) => {
      (request.guardianAuthorization as Record<string, unknown>).visibility =
        "tutor-private";
    },
  },
  {
    name: "stale authorization revision",
    mutate: (request) => {
      (
        request.guardianAuthorization as Record<string, unknown>
      ).authorizationRevisionRef = "authorization-revision:w4-session-a-r2";
    },
  },
  {
    name: "revoked authorization",
    mutate: (request) => {
      (
        request.guardianAuthorization as Record<string, unknown>
      ).authorizationRevisionStatus = "revoked";
    },
  },
];

for (const attack of sessionAuthorizationAttacks) {
  test(`authorization attack fails closed: ${attack.name}`, () => {
    const request = structuredClone(sessionRequest()) as Record<
      string,
      unknown
    >;
    attack.mutate(request);
    assertRejectedWithoutReflection(
      request,
      "PARENT_REPORT_AUTHORIZATION_REJECTED",
    );
  });
}

test("authorization attack fails closed: wrong reporting period", () => {
  const authorization = periodAuthorization();
  authorization.reportingPeriodRef = "period:w4-week-b";
  assertRejectedWithoutReflection(
    periodRequest([], authorization),
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
});

test("authorization attack fails closed: required consent absent", () => {
  const authorization = periodAuthorization() as Record<string, unknown>;
  delete authorization.consent;
  assertRejectedWithoutReflection(
    periodRequest([], authorization),
    "PARENT_REPORT_CONSENT_REJECTED",
  );
});

test("authorization attack fails closed: valid authorization for sibling", () => {
  const authorization = sessionAuthorization();
  authorization.authorizationRef = "authorization:w4-sibling";
  authorization.guardianRef = "guardian:w4-b";
  authorization.householdScopeRef = "household:w4-b";
  authorization.learnerScopeRef = "learner:w4-b";
  authorization.sessionRef = "session:w4-sibling";
  assertRejectedWithoutReflection(
    sessionRequest([], authorization),
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
});

test("authorization attack fails closed: valid authorization from prior period", () => {
  const authorization = periodAuthorization();
  authorization.authorizationRef = "authorization:w4-prior-period";
  authorization.reportingPeriodRef = "period:w4-week-prior";
  assertRejectedWithoutReflection(
    periodRequest([], authorization),
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
});

test("authorization attack fails closed: sibling consent substitution", () => {
  const authorization = periodAuthorization();
  authorization.consent.consentRef = "consent:w4-sibling";
  assertRejectedWithoutReflection(periodRequest([], authorization));
});

test("authorization attack fails closed: required-consent policy downgrade", () => {
  const authorization = periodAuthorization() as Record<string, unknown>;
  authorization.consent = {
    policyRequirement: "not-required",
    consentState: "not-required",
  };
  assertRejectedWithoutReflection(periodRequest([], authorization));
});

test("authorization attack fails closed: replayed authorization", () => {
  const authorization = periodAuthorization();
  const first = periodRequest([], structuredClone(authorization));
  assert.equal(buildMinimizedParentHubReport(first).status, "accepted");

  const replay = periodRequest([], structuredClone(authorization));
  replay.reportRef = "report:w4-period-replay";
  replay.generatedAt = "2026-08-16T14:00:00.000Z";
  assertRejectedWithoutReflection(replay);
});

const confusedDeputies: ReadonlyArray<{
  name: string;
  value: Record<string, unknown>;
}> = [
  {
    name: "Tutor advisory",
    value: {
      advisoryKind: "study-commercial-tutor-advisory",
      issuer: "tutor",
      learnerScopeRef: "learner:w4-a",
      proposal: "review-prerequisite",
    },
  },
  {
    name: "provider response",
    value: {
      responseKind: "bounded-commercial-provider-response",
      provider: "provider:w4",
      learnerScopeRef: "learner:w4-a",
      output: PRIVATE_SENTINEL,
    },
  },
  {
    name: "telemetry",
    value: {
      eventKind: "commercial-operation-telemetry",
      learnerScopeRef: "learner:w4-a",
      outcome: "accepted",
    },
  },
  {
    name: "memory",
    value: {
      memoryKind: "instructional-memory-delta",
      learnerScopeRef: "learner:w4-a",
      summary: PRIVATE_SENTINEL,
    },
  },
  {
    name: "curriculum admission",
    value: {
      admissionKind: "curriculum-release-admission",
      learnerScopeRef: "learner:w4-a",
      decision: "admitted",
    },
  },
  {
    name: "Parent request",
    value: {
      requestKind: "parent-hub-report",
      guardianRef: "guardian:w4-a",
      selectedLearnerRef: "learner:w4-a",
    },
  },
];

for (const deputy of confusedDeputies) {
  test(`confused-deputy attack fails closed: ${deputy.name}`, () => {
    assertRejectedWithoutReflection(
      sessionRequest([], deputy.value),
      "PARENT_REPORT_CONSENT_REJECTED",
    );
  });
}

test("truthfulness attack fails closed: Tutor proposed cannot be relabeled Study applied", () => {
  const forged = sessionEvidence(
    "prerequisite-review",
    "tutor-proposed",
    "evidence:w4-proposed",
  );
  forged.decisionStatus = "study-applied";
  assertRejectedWithoutReflection(sessionRequest([forged]));
});

test("truthfulness attack fails closed: Study approved cannot be reclassified completed", () => {
  const forged = sessionEvidence(
    "reteach",
    "study-approved",
    "evidence:w4-approved",
  );
  forged.reasonCode = "practice-completed";
  forged.decisionStatus = null;
  assertRejectedWithoutReflection(sessionRequest([forged]));
});

test("pending Tutor wording never claims approval, application, or completion", () => {
  const result = buildMinimizedParentHubReport(
    sessionRequest([
      sessionEvidence(
        "prerequisite-review",
        "tutor-proposed",
        "evidence:w4-pending-tutor",
      ),
    ]),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  const summary = result.value.summaries[0];
  assert.equal(summary?.statusLabel, "Tutor proposed");
  assert.match(summary?.explanation ?? "", /not approved or applied/i);
  assert.doesNotMatch(
    `${summary?.title} ${summary?.explanation}`,
    /completed|was applied|Study approved(?! or applied)/i,
  );
});

test("pending Study-approved wording never claims application or completion", () => {
  const result = buildMinimizedParentHubReport(
    sessionRequest([
      sessionEvidence(
        "reteach",
        "study-approved",
        "evidence:w4-pending-study",
      ),
    ]),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  const summary = result.value.summaries[0];
  assert.equal(summary?.statusLabel, "Study approved");
  assert.equal(
    summary?.explanation,
    "Study approved another explanation. Approval does not mean the reteach was applied.",
  );
  assert.doesNotMatch(
    `${summary?.title} ${summary?.explanation}`,
    /completed|Study recorded.*applied/i,
  );
});

test("privacy attack fails closed: sibling evidence cannot enter a report", () => {
  const siblingEvidence = sessionEvidence(
    "practice-completed",
    null,
    "evidence:w4-sibling",
  );
  siblingEvidence.learnerRef = "learner:w4-b";
  siblingEvidence.provenance.scope.learnerScopeRef = "learner:w4-b";
  assertRejectedWithoutReflection(
    sessionRequest([siblingEvidence]),
    "PARENT_REPORT_SCOPE_MISMATCH",
  );
});

for (const contamination of [
  { rawTutorTranscript: PRIVATE_SENTINEL },
  { providerResponse: PRIVATE_SENTINEL },
  { providerProse: PRIVATE_SENTINEL },
]) {
  const field = Object.keys(contamination)[0] ?? "unknown";
  test(`privacy attack fails closed: ${field} cannot enter a report`, () => {
    const evidence = sessionEvidence() as Record<string, unknown>;
    Object.assign(evidence, contamination);
    assertRejectedWithoutReflection(
      sessionRequest([evidence]),
      "PARENT_REPORT_REQUEST_REJECTED",
    );
  });
}

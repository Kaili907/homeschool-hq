import assert from "node:assert/strict";
import test from "node:test";
import { buildMinimizedParentHubReport } from "../../../study-engine/tutor-v2/parent-reporting/parent-report.js";
import {
  PRIVATE_SENTINEL,
  evidenceReceipt,
  periodAuthorization,
  periodRequest,
  periodTrustedAuthority,
  sessionAuthorization,
  sessionEvidence,
  sessionRequest,
  sessionTrustedAuthority,
} from "./fixtures.js";

function assertRejectedWithoutReflection(
  request: unknown,
  trustedAuthority: unknown,
  code?: string,
): void {
  const result = buildMinimizedParentHubReport(request, trustedAuthority);
  assert.equal(result.status, "rejected");
  if (code !== undefined && result.status === "rejected") {
    assert.equal(result.code, code);
  }
  assert.doesNotMatch(JSON.stringify(result), /private-w4-repair-sentinel/i);
}

test("control: exact detached Study authority accepts session and period reports", () => {
  assert.equal(
    buildMinimizedParentHubReport(
      sessionRequest(),
      sessionTrustedAuthority(),
    ).status,
    "accepted",
  );
  assert.equal(
    buildMinimizedParentHubReport(
      periodRequest(),
      periodTrustedAuthority(),
    ).status,
    "accepted",
  );
});

test("detached Study authority is mandatory and cannot be replaced by provider output", () => {
  assertRejectedWithoutReflection(
    sessionRequest(),
    undefined,
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
  assertRejectedWithoutReflection(
    sessionRequest(),
    { responseKind: "provider-response", output: PRIVATE_SENTINEL },
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
});

test("PG-01: sibling consent cannot substitute for the scoped trusted consent", () => {
  const authorization = periodAuthorization();
  authorization.consent.consentRef = "consent:w4-sibling";
  assertRejectedWithoutReflection(
    periodRequest([], authorization),
    periodTrustedAuthority(),
    "PARENT_REPORT_CONSENT_REJECTED",
  );
});

test("PG-01: report input cannot downgrade a trusted required-consent policy", () => {
  const authorization = periodAuthorization() as Record<string, unknown>;
  authorization.consent = {
    policyRequirement: "not-required",
    consentState: "not-required",
    policyRef: "policy:w4-parent-reporting",
    policyRevisionRef: "policy-revision:w4-parent-reporting-r5",
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    learnerScopeRef: "learner:w4-a",
    authorizationRef: "authorization:w4-period-a",
    authorizationRevisionRef: "authorization-revision:w4-period-a-r2",
    visibility: "parent-report",
    scopeKind: "reporting-period",
    reportingPeriodRef: "period:w4-week-a",
    startsAt: "2026-08-10T00:00:00.000Z",
    endsAt: "2026-08-16T23:59:59.000Z",
  };
  assertRejectedWithoutReflection(
    periodRequest([], authorization),
    periodTrustedAuthority(),
    "PARENT_REPORT_CONSENT_REJECTED",
  );
});

test("PG-02: authorization is report-bound and cannot authorize a new report", () => {
  const authorization = periodAuthorization();
  const trusted = periodTrustedAuthority();
  const original = periodRequest([], structuredClone(authorization));
  assert.equal(
    buildMinimizedParentHubReport(original, structuredClone(trusted)).status,
    "accepted",
  );

  const replay = periodRequest([], structuredClone(authorization));
  replay.reportRef = "report:w4-period-replay";
  replay.generatedAt = "2026-08-16T14:00:00.000Z";
  assertRejectedWithoutReflection(
    replay,
    structuredClone(trusted),
    "PARENT_REPORT_AUTHORIZATION_REJECTED",
  );
});

test("PG-02: exact same report generation is deterministic and idempotent", () => {
  const request = periodRequest();
  const trusted = periodTrustedAuthority();
  const first = buildMinimizedParentHubReport(request, trusted);
  const second = buildMinimizedParentHubReport(
    structuredClone(request),
    structuredClone(trusted),
  );
  assert.deepEqual(second, first);
  assert.equal(first.status, "accepted");
});

test("PG-03: Tutor-proposed evidence cannot be relabeled Study-applied", () => {
  const proposed = sessionEvidence(
    "prerequisite-review",
    "tutor-proposed",
    "evidence:w4-proposed",
  );
  const trusted = sessionTrustedAuthority([
    evidenceReceipt(proposed, "TUTOR_PROPOSED"),
  ]);
  proposed.decisionStatus = "study-applied";
  assertRejectedWithoutReflection(
    sessionRequest([proposed]),
    trusted,
    "PARENT_REPORT_STATUS_MISMATCH",
  );
});

test("PG-03: Study-approved evidence cannot be reclassified completed", () => {
  const approved = sessionEvidence(
    "reteach",
    "study-approved",
    "evidence:w4-approved",
  );
  const trusted = sessionTrustedAuthority([
    evidenceReceipt(approved, "STUDY_APPROVED"),
  ]);
  approved.reasonCode = "practice-completed";
  approved.decisionStatus = null;
  assertRejectedWithoutReflection(
    sessionRequest([approved]),
    trusted,
    "PARENT_REPORT_STATUS_MISMATCH",
  );
});

test("closed transition receipts require the trusted terminal Study event", () => {
  const applied = sessionEvidence(
    "reteach",
    "study-applied",
    "evidence:w4-applied",
  );
  const receipt = evidenceReceipt(applied, "STUDY_APPLIED");
  receipt.transition.appliedEventRef = "event:w4-foreign-applied";
  assertRejectedWithoutReflection(
    sessionRequest([applied]),
    sessionTrustedAuthority([receipt]),
    "PARENT_REPORT_STATUS_MISMATCH",
  );

  const collapsed = evidenceReceipt(applied, "STUDY_APPLIED");
  collapsed.transition.proposalEventRef = applied.provenance.sourceEventRef;
  assertRejectedWithoutReflection(
    sessionRequest([applied]),
    sessionTrustedAuthority([collapsed]),
    "PARENT_REPORT_STATUS_MISMATCH",
  );
});

test("completion is accepted only with its own trusted Study completion event", () => {
  const completed = sessionEvidence(
    "practice-completed",
    null,
    "evidence:w4-completed",
  );
  const result = buildMinimizedParentHubReport(
    sessionRequest([completed]),
    sessionTrustedAuthority([
      evidenceReceipt(completed, "STUDY_COMPLETED"),
    ]),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  assert.equal(result.value.summaries[0]?.title, "Practice completed");
});

test("wrong guardian, household, learner, session, or visibility fails closed", () => {
  const mutations = [
    (authorization: Record<string, unknown>) => {
      authorization.guardianRef = "guardian:w4-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.householdScopeRef = "household:w4-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.learnerScopeRef = "learner:w4-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.sessionRef = "session:w4-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.visibility = "tutor-private";
    },
  ];
  for (const mutate of mutations) {
    const authorization = sessionAuthorization() as Record<string, unknown>;
    mutate(authorization);
    assertRejectedWithoutReflection(
      sessionRequest([], authorization),
      sessionTrustedAuthority(),
    );
  }
});

test("wrong period and consent learner scope fail closed", () => {
  const wrongPeriod = periodAuthorization();
  wrongPeriod.reportingPeriodRef = "period:w4-week-b";
  assertRejectedWithoutReflection(
    periodRequest([], wrongPeriod),
    periodTrustedAuthority(),
  );

  const siblingConsent = periodAuthorization();
  siblingConsent.consent.learnerScopeRef = "learner:w4-b";
  assertRejectedWithoutReflection(
    periodRequest([], siblingConsent),
    periodTrustedAuthority(),
    "PARENT_REPORT_CONSENT_REJECTED",
  );
});

test("stale, consumed, superseded, revoked, or expired authorization fails closed", () => {
  for (const status of ["consumed", "superseded", "revoked"] as const) {
    const authorization = sessionAuthorization();
    authorization.authorizationRevisionStatus = status;
    assertRejectedWithoutReflection(
      sessionRequest([], authorization),
      sessionTrustedAuthority(),
    );
  }

  const stale = sessionAuthorization();
  stale.authorizationRevisionRef = "authorization-revision:w4-session-a-r2";
  assertRejectedWithoutReflection(
    sessionRequest([], stale),
    sessionTrustedAuthority(),
  );

  const expired = sessionAuthorization();
  expired.authorizationExpiresAt = "2026-08-15T14:59:59.000Z";
  assertRejectedWithoutReflection(
    sessionRequest([], expired),
    sessionTrustedAuthority(),
  );
});

test("stale policy revision and missing required consent fail closed", () => {
  const stalePolicy = sessionRequest();
  stalePolicy.policyRevisionRef = "policy-revision:w4-parent-reporting-r4";
  assertRejectedWithoutReflection(stalePolicy, sessionTrustedAuthority());

  const missingConsent = periodAuthorization() as Record<string, unknown>;
  delete missingConsent.consent;
  assertRejectedWithoutReflection(
    periodRequest([], missingConsent),
    periodTrustedAuthority(),
    "PARENT_REPORT_CONSENT_REJECTED",
  );
});

for (const deputy of [
  { advisoryKind: "tutor-advisory", issuer: "tutor" },
  { responseKind: "provider-response", output: PRIVATE_SENTINEL },
  { eventKind: "telemetry", outcome: "accepted" },
  { memoryKind: "instructional-memory", summary: PRIVATE_SENTINEL },
  { admissionKind: "curriculum-admission", decision: "admitted" },
  { requestKind: "parent-request", learnerRef: "learner:w4-a" },
]) {
  test(`confused deputy cannot substitute for guardian authority: ${Object.keys(deputy)[0]}`, () => {
    assertRejectedWithoutReflection(
      sessionRequest([], deputy),
      sessionTrustedAuthority(),
    );
  });
}

test("pending Tutor and Study-approved wording remains truthful", () => {
  const proposed = sessionEvidence(
    "prerequisite-review",
    "tutor-proposed",
    "evidence:w4-pending-proposed",
  );
  const approved = sessionEvidence(
    "reteach",
    "study-approved",
    "evidence:w4-pending-approved",
  );
  const result = buildMinimizedParentHubReport(
    sessionRequest([proposed, approved]),
    sessionTrustedAuthority([
      evidenceReceipt(proposed, "TUTOR_PROPOSED"),
      evidenceReceipt(approved, "STUDY_APPROVED"),
    ]),
  );
  assert.equal(result.status, "accepted");
  if (result.status !== "accepted") return;
  const text = result.value.summaries
    .map((summary) => `${summary.title} ${summary.explanation}`)
    .join(" ");
  assert.match(text, /not approved or applied/i);
  assert.match(text, /approval does not mean.*applied/i);
  assert.doesNotMatch(text, /practice completed|completed practice/i);
});

test("sibling and raw private evidence remains rejected without reflection", () => {
  const base = sessionEvidence(
    "prerequisite-review",
    "tutor-proposed",
    "evidence:w4-private",
  );
  const trusted = sessionTrustedAuthority([
    evidenceReceipt(base, "TUTOR_PROPOSED"),
  ]);

  const sibling = structuredClone(base);
  sibling.learnerRef = "learner:w4-b";
  sibling.provenance.scope.learnerScopeRef = "learner:w4-b";
  assertRejectedWithoutReflection(
    sessionRequest([sibling]),
    trusted,
    "PARENT_REPORT_SCOPE_MISMATCH",
  );

  for (const contamination of [
    { rawTutorTranscript: PRIVATE_SENTINEL },
    { providerResponse: PRIVATE_SENTINEL },
    { providerProse: PRIVATE_SENTINEL },
    { rawAnswer: PRIVATE_SENTINEL },
    { diagnosis: PRIVATE_SENTINEL },
    { emotionLabel: PRIVATE_SENTINEL },
    { personalityJudgment: PRIVATE_SENTINEL },
  ]) {
    const evidence = structuredClone(base) as Record<string, unknown>;
    Object.assign(evidence, contamination);
    assertRejectedWithoutReflection(
      sessionRequest([evidence]),
      trusted,
      "PARENT_REPORT_REQUEST_REJECTED",
    );
  }
});

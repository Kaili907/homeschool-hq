import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../../../core/v2/contracts/index.js";
import {
  PARENT_REPORT_DISCLAIMER,
  PARENT_REPORT_VERSION,
  ParentReportConsentSchema,
  ParentReportGuardianAuthorizationSchema,
  ParentReportRequestSchema,
  ParentReportResultSchema,
  REVIEWED_PARENT_REPORT_COPY,
  buildMinimizedParentHubReport as buildReportWithTrustedAuthority,
} from "./parent-report.js";

function sessionScope() {
  return {
    scopeKind: "session",
    guardianRef: "guardian:guardian-a",
    householdScopeRef: "household:family-a",
    selectedLearnerRef: "learner:child-a",
    sessionRef: "session:session-a",
  };
}

function sessionAuthorization() {
  return {
    guardianAuthorizationKind: "study-parent-report-guardian-authorization",
    issuer: "study",
    authorizationRef: "authorization:parent-report-a",
    reportRef: "report:report-a",
    policyRef: "policy:parent-reporting-v1",
    policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
    guardianRef: "guardian:guardian-a",
    householdScopeRef: "household:family-a",
    learnerScopeRef: "learner:child-a",
    authorizationRevisionRef: "authorization-revision:parent-report-a-r3",
    currentAuthorizationRevisionRef: "authorization-revision:parent-report-a-r3",
    authorizationRevisionStatus: "current",
    authorizationIssuedEventRef: "event:authorization-parent-report-a-r3",
    authorizationIssuedAt: "2026-08-15T13:00:00.000Z",
    authorizationExpiresAt: "2026-08-15T16:00:00.000Z",
    visibility: "parent-report",
    consent: {
      policyRequirement: "not-required",
      consentState: "not-required",
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      guardianRef: "guardian:guardian-a",
      householdScopeRef: "household:family-a",
      learnerScopeRef: "learner:child-a",
      authorizationRef: "authorization:parent-report-a",
      authorizationRevisionRef: "authorization-revision:parent-report-a-r3",
      visibility: "parent-report",
      scopeKind: "session",
      sessionRef: "session:session-a",
    },
    scopeKind: "session",
    sessionRef: "session:session-a",
  };
}

function sessionEvidence(
  reasonCode = "prerequisite-review",
  decisionStatus: string | null = "tutor-proposed",
  evidenceRef = "evidence:evidence-a",
) {
  return {
    evidenceRef,
    learnerRef: "learner:child-a",
    reasonCode,
    decisionStatus,
    provenance: {
      producer: "study-engine",
      reportingApproval: "study-approved-for-parent-reporting",
      sourceEventRef: `event:${evidenceRef.slice(evidenceRef.indexOf(":") + 1)}`,
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      recordedAt: "2026-08-15T14:00:00.000Z",
      scope: {
        scopeKind: "session",
        householdScopeRef: "household:family-a",
        learnerScopeRef: "learner:child-a",
        sessionRef: "session:session-a",
      },
    },
  };
}

function sessionRequest(
  evidence: unknown[] = [sessionEvidence()],
  guardianAuthorization: unknown = sessionAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:report-a",
    policyRef: "policy:parent-reporting-v1",
    policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
    generatedAt: "2026-08-15T15:00:00.000Z",
    scope: sessionScope(),
    guardianAuthorization,
    evidence,
  };
}

function periodAuthorization() {
  return {
    guardianAuthorizationKind: "study-parent-report-guardian-authorization",
    issuer: "study",
    authorizationRef: "authorization:weekly-a",
    reportRef: "report:weekly-a",
    policyRef: "policy:parent-reporting-v1",
    policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
    guardianRef: "guardian:guardian-a",
    householdScopeRef: "household:family-a",
    learnerScopeRef: "learner:child-a",
    authorizationRevisionRef: "authorization-revision:weekly-a-r2",
    currentAuthorizationRevisionRef: "authorization-revision:weekly-a-r2",
    authorizationRevisionStatus: "current",
    authorizationIssuedEventRef: "event:authorization-weekly-a-r2",
    authorizationIssuedAt: "2026-08-10T00:00:00.000Z",
    authorizationExpiresAt: "2026-08-16T23:59:59.000Z",
    visibility: "parent-report",
    consent: {
      policyRequirement: "required",
      consentRef: "consent:weekly-a",
      consentRevisionRef: "consent-revision:weekly-a-r2",
      currentConsentRevisionRef: "consent-revision:weekly-a-r2",
      consentRevisionStatus: "current",
      consentState: "granted",
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      guardianRef: "guardian:guardian-a",
      householdScopeRef: "household:family-a",
      learnerScopeRef: "learner:child-a",
      authorizationRef: "authorization:weekly-a",
      authorizationRevisionRef: "authorization-revision:weekly-a-r2",
      visibility: "parent-report",
      scopeKind: "reporting-period",
      reportingPeriodRef: "period:week-a",
      startsAt: "2026-08-10T00:00:00.000Z",
      endsAt: "2026-08-16T23:59:59.000Z",
    },
    scopeKind: "reporting-period",
    reportingPeriodRef: "period:week-a",
    startsAt: "2026-08-10T00:00:00.000Z",
    endsAt: "2026-08-16T23:59:59.000Z",
  };
}

function periodRequest(
  evidence: unknown[] = [],
  guardianAuthorization: unknown = periodAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:weekly-a",
    policyRef: "policy:parent-reporting-v1",
    policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
    generatedAt: "2026-08-16T13:00:00.000Z",
    scope: {
      scopeKind: "reporting-period",
      guardianRef: "guardian:guardian-a",
      householdScopeRef: "household:family-a",
      selectedLearnerRef: "learner:child-a",
      reportingPeriodRef: "period:week-a",
      startsAt: "2026-08-10T00:00:00.000Z",
      endsAt: "2026-08-16T23:59:59.000Z",
    },
    guardianAuthorization,
    evidence,
  };
}

function periodEvidence() {
  return {
    evidenceRef: "evidence:weekly-a",
    learnerRef: "learner:child-a",
    reasonCode: "practice-completed",
    decisionStatus: null,
    provenance: {
      producer: "study-engine",
      reportingApproval: "study-approved-for-parent-reporting",
      sourceEventRef: "event:weekly-a",
      policyRef: "policy:parent-reporting-v1",
      policyRevisionRef: "policy-revision:parent-reporting-v1-r4",
      recordedAt: "2026-08-12T14:00:00.000Z",
      scope: {
        scopeKind: "reporting-period",
        householdScopeRef: "household:family-a",
        learnerScopeRef: "learner:child-a",
        reportingPeriodRef: "period:week-a",
        startsAt: "2026-08-10T00:00:00.000Z",
        endsAt: "2026-08-16T23:59:59.000Z",
      },
    },
  };
}

function trustedTransition(
  decisionStatus: string | null,
  reasonCode: string,
  sourceEventRef: string,
) {
  if (decisionStatus === "tutor-proposed") {
    return { state: "TUTOR_PROPOSED", proposalEventRef: sourceEventRef };
  }
  if (decisionStatus === "study-approved") {
    return {
      state: "STUDY_APPROVED",
      proposalEventRef: `${sourceEventRef}-proposal`,
      approvalEventRef: sourceEventRef,
    };
  }
  if (decisionStatus === "study-applied") {
    return {
      state: "STUDY_APPLIED",
      proposalEventRef: `${sourceEventRef}-proposal`,
      approvalEventRef: `${sourceEventRef}-approval`,
      appliedEventRef: sourceEventRef,
    };
  }
  if (reasonCode === "practice-completed") {
    return { state: "STUDY_COMPLETED", completionEventRef: sourceEventRef };
  }
  return { state: "STUDY_RECORDED", observationEventRef: sourceEventRef };
}

function trustedAuthorityFor(value: unknown) {
  const request = value as ReturnType<typeof sessionRequest>;
  const authorization =
    typeof request?.guardianAuthorization === "object" &&
    request.guardianAuthorization !== null
      ? structuredClone(request.guardianAuthorization)
      : sessionAuthorization();
  const consent = (authorization as ReturnType<typeof sessionAuthorization>)
    .consent;
  return {
    authorityKind: "study-parent-report-trusted-authority",
    issuer: "study",
    reportRef: request?.reportRef ?? "report:report-a",
    policy: {
      authorityKind: "study-parent-report-policy-authority",
      issuer: "study-policy",
      policyRef: request?.policyRef ?? "policy:parent-reporting-v1",
      policyRevisionRef:
        request?.policyRevisionRef ??
        "policy-revision:parent-reporting-v1-r4",
      currentPolicyRevisionRef:
        request?.policyRevisionRef ??
        "policy-revision:parent-reporting-v1-r4",
      policyRevisionStatus: "current",
      policyIssuedEventRef: "event:parent-reporting-policy-r4",
      consentRequirement:
        consent?.policyRequirement === "required" ? "required" : "not-required",
    },
    guardianAuthorization: authorization,
    evidenceReceipts: Array.isArray(request?.evidence)
      ? request.evidence.map((candidate) => {
          const evidence = candidate as ReturnType<typeof sessionEvidence>;
          return {
            receiptKind: "study-parent-report-evidence-receipt",
            issuer: "study",
            evidenceRef: evidence.evidenceRef,
            learnerRef: evidence.learnerRef,
            reasonCode: evidence.reasonCode,
            sourceEventRef: evidence.provenance.sourceEventRef,
            policyRef: evidence.provenance.policyRef,
            policyRevisionRef: evidence.provenance.policyRevisionRef,
            recordedAt: evidence.provenance.recordedAt,
            scope: structuredClone(evidence.provenance.scope),
            transition: trustedTransition(
              evidence.decisionStatus,
              evidence.reasonCode,
              evidence.provenance.sourceEventRef,
            ),
          };
        })
      : [],
  };
}

function buildMinimizedParentHubReport(
  value: unknown,
  trustedAuthority: unknown = trustedAuthorityFor(value),
) {
  return buildReportWithTrustedAuthority(value, trustedAuthority);
}

function accepted(value: unknown = sessionRequest()) {
  const result = buildMinimizedParentHubReport(value);
  assert.equal(result.status, "accepted");
  return result.value;
}

test("accepts the complete exact request and result boundaries", () => {
  const request = sessionRequest();
  assert.equal(
    validateExact(
      ParentReportGuardianAuthorizationSchema,
      request.guardianAuthorization,
    ).status,
    "accepted",
  );
  assert.equal(
    validateExact(
      ParentReportConsentSchema,
      (request.guardianAuthorization as ReturnType<
        typeof sessionAuthorization
      >).consent,
    ).status,
    "accepted",
  );
  assert.equal(validateExact(ParentReportRequestSchema, request).status, "accepted");
  assert.equal(
    validateExact(ParentReportResultSchema, {
      status: "accepted",
      value: accepted(request),
    }).status,
    "accepted",
  );
});

test("aggregates repeated evidence into deterministic reviewed summaries", () => {
  const request = sessionRequest([
    sessionEvidence("practice-completed", null, "evidence:practice-1"),
    sessionEvidence("prerequisite-review", "tutor-proposed", "evidence:proposal-1"),
    sessionEvidence("practice-completed", null, "evidence:practice-2"),
  ]);
  const first = accepted(request);
  const second = accepted(structuredClone(request));
  assert.deepEqual(first, second);
  assert.equal(first.provenance.sourceEvidenceCount, 3);
  assert.deepEqual(
    first.summaries.map((summary) => ({
      decisionStatus: summary.decisionStatus,
      reasonCode: summary.reasonCode,
      occurrenceCount: summary.occurrenceCount,
    })),
    [
      {
        decisionStatus: null,
        reasonCode: "practice-completed",
        occurrenceCount: 2,
      },
      {
        decisionStatus: "tutor-proposed",
        reasonCode: "prerequisite-review",
        occurrenceCount: 1,
      },
    ],
  );
});

test("keeps Tutor proposed, Study approved, and Study applied separate", () => {
  const report = accepted(
    sessionRequest([
      sessionEvidence("reteach", "tutor-proposed", "evidence:reteach-proposed"),
      sessionEvidence("reteach", "study-approved", "evidence:reteach-approved"),
      sessionEvidence("reteach", "study-applied", "evidence:reteach-applied"),
    ]),
  );
  assert.deepEqual(
    report.summaries.map((summary) => summary.statusLabel),
    ["Tutor proposed", "Study approved", "Study applied"],
  );
  assert.match(report.summaries[0]?.explanation ?? "", /not approved or applied/i);
  assert.match(report.summaries[1]?.explanation ?? "", /does not mean.*applied/i);
  assert.match(report.summaries[2]?.explanation ?? "", /was applied/i);
});

test("every reviewed status/reason contract emits only its bound literal copy", () => {
  for (const [index, reviewed] of REVIEWED_PARENT_REPORT_COPY.entries()) {
    const report = accepted(
      sessionRequest([
        sessionEvidence(
          reviewed.reasonCode,
          reviewed.decisionStatus,
          `evidence:reviewed-${index}`,
        ),
      ]),
    );
    assert.deepEqual(report.summaries, [{ ...reviewed, occurrenceCount: 1 }]);
  }
});

test("session reports retain household, learner, and session scope", () => {
  assert.deepEqual(accepted().scope, {
    scopeKind: "session",
    guardianRef: "guardian:guardian-a",
    householdScopeRef: "household:family-a",
    learnerScopeRef: "learner:child-a",
    sessionRef: "session:session-a",
  });
});

test("reporting-period reports retain the exact bounded period scope", () => {
  const report = accepted(periodRequest([periodEvidence()]));
  assert.deepEqual(report.scope, {
    scopeKind: "reporting-period",
    guardianRef: "guardian:guardian-a",
    householdScopeRef: "household:family-a",
    learnerScopeRef: "learner:child-a",
    reportingPeriodRef: "period:week-a",
    startsAt: "2026-08-10T00:00:00.000Z",
    endsAt: "2026-08-16T23:59:59.000Z",
  });
});

test("empty in-scope reports are valid and do not invent evidence", () => {
  const report = accepted(sessionRequest([]));
  assert.deepEqual(report.summaries, []);
  assert.equal(report.provenance.sourceEvidenceCount, 0);
});

test("exact current Study guardian authorization binds the generated report", () => {
  const sessionReport = accepted();
  assert.deepEqual(
    {
      authorizationRef: sessionReport.provenance.authorizationRef,
      authorizationRevisionRef:
        sessionReport.provenance.authorizationRevisionRef,
      consentRef: sessionReport.provenance.consentRef,
    },
    {
      authorizationRef: "authorization:parent-report-a",
      authorizationRevisionRef:
        "authorization-revision:parent-report-a-r3",
      consentRef: null,
    },
  );

  const periodReport = accepted(periodRequest([periodEvidence()]));
  assert.equal(periodReport.provenance.consentRef, "consent:weekly-a");
});

test("missing or foreign guardian authorization fails closed", () => {
  const missing = sessionRequest() as Record<string, unknown>;
  delete missing.guardianAuthorization;
  assert.deepEqual(buildMinimizedParentHubReport(missing), {
    status: "rejected",
    code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
  });

  const callerEquality = sessionRequest() as Record<string, unknown>;
  delete callerEquality.guardianAuthorization;
  const scope = callerEquality.scope as Record<string, unknown>;
  scope.authorizedLearnerRef = scope.selectedLearnerRef;
  assert.deepEqual(buildMinimizedParentHubReport(callerEquality), {
    status: "rejected",
    code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
  });

  const foreign = sessionAuthorization() as Record<string, unknown>;
  foreign.issuer = "tutor";
  assert.deepEqual(buildMinimizedParentHubReport(sessionRequest([], foreign)), {
    status: "rejected",
    code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
  });
});

test("wrong guardian, household, learner, session, or period authorization fails closed", () => {
  const sessionMutations = [
    (authorization: Record<string, unknown>) => {
      authorization.guardianRef = "guardian:guardian-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.householdScopeRef = "household:family-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.learnerScopeRef = "learner:child-b";
    },
    (authorization: Record<string, unknown>) => {
      authorization.sessionRef = "session:other";
    },
  ];
  for (const mutate of sessionMutations) {
    const authorization = structuredClone(
      sessionAuthorization(),
    ) as Record<string, unknown>;
    mutate(authorization);
    const result = buildMinimizedParentHubReport(
      sessionRequest([], authorization),
    );
    assert.deepEqual(result, {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    });
    assert.doesNotMatch(
      JSON.stringify(result),
      /guardian-a|guardian-b|child-a|child-b|family-a|family-b/i,
    );
  }

  const authorization = periodAuthorization();
  authorization.reportingPeriodRef = "period:other";
  assert.deepEqual(
    buildMinimizedParentHubReport(periodRequest([], authorization)),
    {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    },
  );
});

test("stale authorization revision and wrong visibility fail closed", () => {
  const staleRevision = sessionAuthorization();
  staleRevision.authorizationRevisionRef =
    "authorization-revision:parent-report-a-r2";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([], staleRevision)),
    {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    },
  );

  const superseded = sessionAuthorization();
  superseded.authorizationRevisionStatus = "superseded";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([], superseded)),
    {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    },
  );

  const wrongVisibility = sessionAuthorization() as Record<string, unknown>;
  wrongVisibility.visibility = "learner-report";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([], wrongVisibility)),
    {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    },
  );
});

test("guardian authorization is bound to the report policy", () => {
  const wrongPolicy = sessionAuthorization();
  wrongPolicy.policyRef = "policy:other";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([], wrongPolicy)),
    {
      status: "rejected",
      code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
    },
  );
});

test("required consent must be present and currently granted", () => {
  const absent = periodAuthorization();
  delete (absent.consent as Partial<typeof absent.consent>).consentRef;
  assert.deepEqual(buildMinimizedParentHubReport(periodRequest([], absent)), {
    status: "rejected",
    code: "PARENT_REPORT_CONSENT_REJECTED",
  });

  for (const consentState of ["withdrawn", "expired"] as const) {
    const authorization = periodAuthorization();
    authorization.consent.consentState = consentState;
    assert.deepEqual(
      buildMinimizedParentHubReport(periodRequest([], authorization)),
      {
        status: "rejected",
        code: "PARENT_REPORT_CONSENT_REJECTED",
      },
    );
  }
});

test("cross-child report requests fail even when their evidence is internally consistent", () => {
  const request = sessionRequest();
  request.scope.selectedLearnerRef = "learner:child-b";
  const evidence = request.evidence[0] as ReturnType<typeof sessionEvidence>;
  evidence.learnerRef = "learner:child-b";
  evidence.provenance.scope.learnerScopeRef = "learner:child-b";
  assert.deepEqual(buildMinimizedParentHubReport(request), {
    status: "rejected",
    code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
  });
});

test("evidence cannot be reused across learner, household, session, or period scope", () => {
  const mutations = [
    (value: ReturnType<typeof sessionRequest>) => {
      (value.evidence[0] as ReturnType<typeof sessionEvidence>).learnerRef =
        "learner:child-b";
    },
    (value: ReturnType<typeof sessionRequest>) => {
      (value.evidence[0] as ReturnType<typeof sessionEvidence>).provenance.scope.householdScopeRef =
        "household:family-b";
    },
    (value: ReturnType<typeof sessionRequest>) => {
      (value.evidence[0] as ReturnType<typeof sessionEvidence>).provenance.scope.sessionRef =
        "session:other";
    },
  ];
  for (const mutate of mutations) {
    const contaminated = structuredClone(sessionRequest());
    mutate(contaminated);
    assert.deepEqual(buildMinimizedParentHubReport(contaminated), {
      status: "rejected",
      code: "PARENT_REPORT_SCOPE_MISMATCH",
    });
  }

  const wrongPeriod = periodRequest([periodEvidence()]);
  (wrongPeriod.evidence[0] as ReturnType<typeof periodEvidence>).provenance.scope.reportingPeriodRef =
    "period:other";
  assert.deepEqual(buildMinimizedParentHubReport(wrongPeriod), {
    status: "rejected",
    code: "PARENT_REPORT_SCOPE_MISMATCH",
  });
});

test("out-of-period evidence and invalid ranges fail closed", () => {
  const outside = periodRequest([periodEvidence()]);
  (outside.evidence[0] as ReturnType<typeof periodEvidence>).provenance.recordedAt =
    "2026-08-17T00:00:00.000Z";
  assert.deepEqual(buildMinimizedParentHubReport(outside), {
    status: "rejected",
    code: "PARENT_REPORT_SCOPE_MISMATCH",
  });

  const reversed = periodRequest();
  reversed.scope.startsAt = "2026-08-17T00:00:00.000Z";
  assert.deepEqual(buildMinimizedParentHubReport(reversed), {
    status: "rejected",
    code: "PARENT_REPORT_INVALID_PERIOD",
  });
});

test("unknown reason codes and unreviewed status combinations fail closed", () => {
  assert.deepEqual(
    buildMinimizedParentHubReport(
      sessionRequest([
        sessionEvidence("future-commercial-reason", null),
      ]),
    ),
    { status: "rejected", code: "PARENT_REPORT_UNKNOWN_REASON" },
  );
  assert.deepEqual(
    buildMinimizedParentHubReport(
      sessionRequest([
        sessionEvidence("practice-completed", "tutor-proposed"),
      ]),
    ),
    { status: "rejected", code: "PARENT_REPORT_STATUS_MISMATCH" },
  );
});

test("duplicate evidence or source-event references cannot inflate aggregate counts", () => {
  assert.deepEqual(
    buildMinimizedParentHubReport(
      sessionRequest([
        sessionEvidence("practice-completed", null, "evidence:same"),
        sessionEvidence("practice-completed", null, "evidence:same"),
      ]),
    ),
    { status: "rejected", code: "PARENT_REPORT_DUPLICATE_EVIDENCE" },
  );

  const first = sessionEvidence("practice-completed", null, "evidence:first");
  const second = sessionEvidence("practice-completed", null, "evidence:second");
  second.provenance.sourceEventRef = first.provenance.sourceEventRef;
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([first, second])),
    { status: "rejected", code: "PARENT_REPORT_DUPLICATE_EVIDENCE" },
  );
});

test("policy and chronology provenance must match the report", () => {
  const wrongPolicy = sessionEvidence();
  wrongPolicy.provenance.policyRef = "policy:other";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([wrongPolicy])),
    { status: "rejected", code: "PARENT_REPORT_POLICY_MISMATCH" },
  );

  const futureEvidence = sessionEvidence();
  futureEvidence.provenance.recordedAt = "2026-08-15T16:00:00.000Z";
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([futureEvidence])),
    { status: "rejected", code: "PARENT_REPORT_CHRONOLOGY_MISMATCH" },
  );
});

test("only Study-approved-for-reporting evidence crosses the boundary", () => {
  for (const contamination of [
    { producer: "tutor-provider" },
    { reportingApproval: "provider-approved" },
  ]) {
    const evidence = sessionEvidence() as Record<string, unknown>;
    Object.assign(evidence.provenance as Record<string, unknown>, contamination);
    assert.deepEqual(buildMinimizedParentHubReport(sessionRequest([evidence])), {
      status: "rejected",
      code: "PARENT_REPORT_REQUEST_REJECTED",
    });
  }
});

test("time-on-task accepts only reviewed buckets from trusted Study metadata", () => {
  const report = accepted(
    sessionRequest([
      sessionEvidence(
        "time-on-task-15-to-30-minutes",
        null,
        "evidence:time-bucket",
      ),
    ]),
  );
  assert.equal(report.summaries[0]?.title, "Time on task: 15 to 30 minutes");

  const rawDuration = sessionEvidence(
    "time-on-task-15-to-30-minutes",
    null,
  ) as Record<string, unknown>;
  rawDuration.timeOnTaskSeconds = 1_234;
  assert.deepEqual(
    buildMinimizedParentHubReport(sessionRequest([rawDuration])),
    { status: "rejected", code: "PARENT_REPORT_REQUEST_REJECTED" },
  );
});

test("raw and sensitive content is rejected without reflection", () => {
  for (const contamination of [
    { rawTutorTranscript: "private transcript" },
    { rawAnswer: "private answer" },
    { diagnosis: "private diagnosis" },
    { emotionLabel: "private emotion" },
    { personalityJudgment: "private judgment" },
    { providerProse: "private provider prose" },
    { siblingData: "private sibling data" },
    { credential: "private credential" },
  ]) {
    const evidence = sessionEvidence() as Record<string, unknown>;
    Object.assign(evidence, contamination);
    const result = buildMinimizedParentHubReport(sessionRequest([evidence]));
    assert.deepEqual(result, {
      status: "rejected",
      code: "PARENT_REPORT_REQUEST_REJECTED",
    });
    assert.doesNotMatch(JSON.stringify(result), /private/i);
  }
});

test("raw learner data cannot substitute for guardian authorization or consent", () => {
  const authorizationSubstitution = sessionRequest() as Record<string, unknown>;
  authorizationSubstitution.guardianAuthorization = {
    rawAnswer: "private learner answer",
    selectedLearnerRef: "learner:child-a",
    authorizedLearnerRef: "learner:child-a",
  };
  const authorizationResult = buildMinimizedParentHubReport(
    authorizationSubstitution,
  );
  assert.equal(authorizationResult.status, "rejected");
  assert.doesNotMatch(JSON.stringify(authorizationResult), /private|child-a/i);

  const consentSubstitution = sessionAuthorization() as Record<string, unknown>;
  consentSubstitution.consent = { rawTutorTranscript: "private transcript" };
  const consentResult = buildMinimizedParentHubReport(
    sessionRequest([], consentSubstitution),
  );
  assert.deepEqual(consentResult, {
    status: "rejected",
    code: "PARENT_REPORT_CONSENT_REJECTED",
  });
});

test("delivery wiring and arbitrary report prose are outside the contract", () => {
  for (const contamination of [
    { deliveryChannel: "email" },
    { phoneNumber: "+15555550100" },
    { pushToken: "push-private" },
    { narrative: "provider-authored narrative" },
  ]) {
    const request = sessionRequest() as Record<string, unknown>;
    Object.assign(request, contamination);
    assert.deepEqual(buildMinimizedParentHubReport(request), {
      status: "rejected",
      code: "PARENT_REPORT_REQUEST_REJECTED",
    });
  }
});

test("accepted report is minimized and explanatory only", () => {
  const report = accepted();
  assert.equal(report.reportVersion, PARENT_REPORT_VERSION);
  assert.equal(report.authority, "explanatory-only");
  assert.equal(report.disclaimer, PARENT_REPORT_DISCLAIMER);
  assert.deepEqual(Object.keys(report).sort(), [
    "audience",
    "authority",
    "disclaimer",
    "provenance",
    "reportVersion",
    "scope",
    "summaries",
  ]);
  assert.deepEqual(Object.keys(report.provenance).sort(), [
    "authorizationIssuedEventRef",
    "authorizationRef",
    "authorizationRevisionRef",
    "consentRef",
    "consentRevisionRef",
    "generatedAt",
    "policyRef",
    "policyRevisionRef",
    "producer",
    "reportRef",
    "sourceEvidenceCount",
  ]);
  assert.doesNotMatch(
    JSON.stringify(report),
    /sourceEventRef|evidenceRef|transcript|rawAnswer|providerProse|credential/i,
  );
});

test("serialized result schema rejects copy swaps and authority fields", () => {
  const changedCopy = structuredClone(accepted()) as Record<string, unknown>;
  const summaries = changedCopy.summaries as Array<Record<string, unknown>>;
  assert.ok(summaries[0]);
  summaries[0].explanation = "Arbitrary parent-facing prose";
  assert.equal(
    validateExact(ParentReportResultSchema, {
      status: "accepted",
      value: changedCopy,
    }).status,
    "rejected",
  );

  const authorityClaim = {
    ...structuredClone(accepted()),
    studyMutationAllowed: true,
  };
  assert.equal(
    validateExact(ParentReportResultSchema, {
      status: "accepted",
      value: authorityClaim,
    }).status,
    "rejected",
  );
});

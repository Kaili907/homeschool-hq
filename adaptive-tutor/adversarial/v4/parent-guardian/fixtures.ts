export const PRIVATE_SENTINEL = "private-w4-sentinel";

export function sessionScope() {
  return {
    scopeKind: "session",
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    selectedLearnerRef: "learner:w4-a",
    sessionRef: "session:w4-a",
  };
}

export function sessionAuthorization() {
  return {
    guardianAuthorizationKind: "study-parent-report-guardian-authorization",
    issuer: "study",
    authorizationRef: "authorization:w4-session-a",
    policyRef: "policy:w4-parent-reporting",
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    learnerScopeRef: "learner:w4-a",
    authorizationRevisionRef: "authorization-revision:w4-session-a-r3",
    currentAuthorizationRevisionRef:
      "authorization-revision:w4-session-a-r3",
    authorizationRevisionStatus: "current",
    visibility: "parent-report",
    consent: {
      policyRequirement: "not-required",
      consentState: "not-required",
    },
    scopeKind: "session",
    sessionRef: "session:w4-a",
  };
}

export function sessionEvidence(
  reasonCode = "prerequisite-review",
  decisionStatus: string | null = "tutor-proposed",
  evidenceRef = "evidence:w4-a",
) {
  return {
    evidenceRef,
    learnerRef: "learner:w4-a",
    reasonCode,
    decisionStatus,
    provenance: {
      producer: "study-engine",
      reportingApproval: "study-approved-for-parent-reporting",
      sourceEventRef: `event:${evidenceRef.slice(evidenceRef.indexOf(":") + 1)}`,
      policyRef: "policy:w4-parent-reporting",
      recordedAt: "2026-08-15T14:00:00.000Z",
      scope: {
        scopeKind: "session",
        householdScopeRef: "household:w4-a",
        learnerScopeRef: "learner:w4-a",
        sessionRef: "session:w4-a",
      },
    },
  };
}

export function sessionRequest(
  evidence: unknown[] = [],
  guardianAuthorization: unknown = sessionAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:w4-session-a",
    policyRef: "policy:w4-parent-reporting",
    generatedAt: "2026-08-15T15:00:00.000Z",
    scope: sessionScope(),
    guardianAuthorization,
    evidence,
  };
}

export function periodAuthorization() {
  return {
    guardianAuthorizationKind: "study-parent-report-guardian-authorization",
    issuer: "study",
    authorizationRef: "authorization:w4-period-a",
    policyRef: "policy:w4-parent-reporting",
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    learnerScopeRef: "learner:w4-a",
    authorizationRevisionRef: "authorization-revision:w4-period-a-r2",
    currentAuthorizationRevisionRef:
      "authorization-revision:w4-period-a-r2",
    authorizationRevisionStatus: "current",
    visibility: "parent-report",
    consent: {
      policyRequirement: "required",
      consentRef: "consent:w4-period-a",
      consentState: "granted",
    },
    scopeKind: "reporting-period",
    reportingPeriodRef: "period:w4-week-a",
  };
}

export function periodRequest(
  evidence: unknown[] = [],
  guardianAuthorization: unknown = periodAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:w4-period-a",
    policyRef: "policy:w4-parent-reporting",
    generatedAt: "2026-08-16T13:00:00.000Z",
    scope: {
      scopeKind: "reporting-period",
      guardianRef: "guardian:w4-a",
      householdScopeRef: "household:w4-a",
      selectedLearnerRef: "learner:w4-a",
      reportingPeriodRef: "period:w4-week-a",
      startsAt: "2026-08-10T00:00:00.000Z",
      endsAt: "2026-08-16T23:59:59.000Z",
    },
    guardianAuthorization,
    evidence,
  };
}


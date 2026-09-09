export const PRIVATE_SENTINEL = "private-w4-repair-sentinel";

const POLICY_REF = "policy:w4-parent-reporting";
const POLICY_REVISION_REF = "policy-revision:w4-parent-reporting-r5";

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
    reportRef: "report:w4-session-a",
    policyRef: POLICY_REF,
    policyRevisionRef: POLICY_REVISION_REF,
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    learnerScopeRef: "learner:w4-a",
    authorizationRevisionRef: "authorization-revision:w4-session-a-r3",
    currentAuthorizationRevisionRef: "authorization-revision:w4-session-a-r3",
    authorizationRevisionStatus: "current",
    authorizationIssuedEventRef: "event:w4-session-authorization-r3",
    authorizationIssuedAt: "2026-08-15T13:00:00.000Z",
    authorizationExpiresAt: "2026-08-15T16:00:00.000Z",
    visibility: "parent-report",
    consent: {
      policyRequirement: "not-required",
      consentState: "not-required",
      policyRef: POLICY_REF,
      policyRevisionRef: POLICY_REVISION_REF,
      guardianRef: "guardian:w4-a",
      householdScopeRef: "household:w4-a",
      learnerScopeRef: "learner:w4-a",
      authorizationRef: "authorization:w4-session-a",
      authorizationRevisionRef: "authorization-revision:w4-session-a-r3",
      visibility: "parent-report",
      scopeKind: "session",
      sessionRef: "session:w4-a",
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
      policyRef: POLICY_REF,
      policyRevisionRef: POLICY_REVISION_REF,
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

export function evidenceReceipt(
  evidence: ReturnType<typeof sessionEvidence>,
  state:
    | "TUTOR_PROPOSED"
    | "STUDY_APPROVED"
    | "STUDY_APPLIED"
    | "STUDY_COMPLETED"
    | "STUDY_RECORDED",
) {
  const sourceEventRef = evidence.provenance.sourceEventRef;
  const transition =
    state === "TUTOR_PROPOSED"
      ? { state, proposalEventRef: sourceEventRef }
      : state === "STUDY_APPROVED"
        ? {
            state,
            proposalEventRef: `${sourceEventRef}-proposal`,
            approvalEventRef: sourceEventRef,
          }
        : state === "STUDY_APPLIED"
          ? {
              state,
              proposalEventRef: `${sourceEventRef}-proposal`,
              approvalEventRef: `${sourceEventRef}-approval`,
              appliedEventRef: sourceEventRef,
            }
          : state === "STUDY_COMPLETED"
            ? { state, completionEventRef: sourceEventRef }
            : { state, observationEventRef: sourceEventRef };
  return {
    receiptKind: "study-parent-report-evidence-receipt",
    issuer: "study",
    evidenceRef: evidence.evidenceRef,
    learnerRef: evidence.learnerRef,
    reasonCode: evidence.reasonCode,
    sourceEventRef,
    policyRef: POLICY_REF,
    policyRevisionRef: POLICY_REVISION_REF,
    recordedAt: evidence.provenance.recordedAt,
    scope: structuredClone(evidence.provenance.scope),
    transition,
  };
}

export function sessionRequest(
  evidence: unknown[] = [],
  guardianAuthorization: unknown = sessionAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:w4-session-a",
    policyRef: POLICY_REF,
    policyRevisionRef: POLICY_REVISION_REF,
    generatedAt: "2026-08-15T15:00:00.000Z",
    scope: sessionScope(),
    guardianAuthorization,
    evidence,
  };
}

export function sessionTrustedAuthority(evidenceReceipts: unknown[] = []) {
  return {
    authorityKind: "study-parent-report-trusted-authority",
    issuer: "study",
    reportRef: "report:w4-session-a",
    policy: {
      authorityKind: "study-parent-report-policy-authority",
      issuer: "study-policy",
      policyRef: POLICY_REF,
      policyRevisionRef: POLICY_REVISION_REF,
      currentPolicyRevisionRef: POLICY_REVISION_REF,
      policyRevisionStatus: "current",
      policyIssuedEventRef: "event:w4-parent-policy-r5",
      consentRequirement: "not-required",
    },
    guardianAuthorization: sessionAuthorization(),
    evidenceReceipts,
  };
}

export function periodAuthorization() {
  return {
    guardianAuthorizationKind: "study-parent-report-guardian-authorization",
    issuer: "study",
    authorizationRef: "authorization:w4-period-a",
    reportRef: "report:w4-period-a",
    policyRef: POLICY_REF,
    policyRevisionRef: POLICY_REVISION_REF,
    guardianRef: "guardian:w4-a",
    householdScopeRef: "household:w4-a",
    learnerScopeRef: "learner:w4-a",
    authorizationRevisionRef: "authorization-revision:w4-period-a-r2",
    currentAuthorizationRevisionRef: "authorization-revision:w4-period-a-r2",
    authorizationRevisionStatus: "current",
    authorizationIssuedEventRef: "event:w4-period-authorization-r2",
    authorizationIssuedAt: "2026-08-10T00:00:00.000Z",
    authorizationExpiresAt: "2026-08-16T23:59:59.000Z",
    visibility: "parent-report",
    consent: {
      policyRequirement: "required",
      consentRef: "consent:w4-period-a",
      consentRevisionRef: "consent-revision:w4-period-a-r4",
      currentConsentRevisionRef: "consent-revision:w4-period-a-r4",
      consentRevisionStatus: "current",
      consentState: "granted",
      policyRef: POLICY_REF,
      policyRevisionRef: POLICY_REVISION_REF,
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
    },
    scopeKind: "reporting-period",
    reportingPeriodRef: "period:w4-week-a",
    startsAt: "2026-08-10T00:00:00.000Z",
    endsAt: "2026-08-16T23:59:59.000Z",
  };
}

export function periodRequest(
  evidence: unknown[] = [],
  guardianAuthorization: unknown = periodAuthorization(),
) {
  return {
    requestKind: "parent-hub-report",
    reportRef: "report:w4-period-a",
    policyRef: POLICY_REF,
    policyRevisionRef: POLICY_REVISION_REF,
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

export function periodTrustedAuthority(evidenceReceipts: unknown[] = []) {
  return {
    authorityKind: "study-parent-report-trusted-authority",
    issuer: "study",
    reportRef: "report:w4-period-a",
    policy: {
      authorityKind: "study-parent-report-policy-authority",
      issuer: "study-policy",
      policyRef: POLICY_REF,
      policyRevisionRef: POLICY_REVISION_REF,
      currentPolicyRevisionRef: POLICY_REVISION_REF,
      policyRevisionStatus: "current",
      policyIssuedEventRef: "event:w4-parent-policy-r5",
      consentRequirement: "required",
    },
    guardianAuthorization: periodAuthorization(),
    evidenceReceipts,
  };
}

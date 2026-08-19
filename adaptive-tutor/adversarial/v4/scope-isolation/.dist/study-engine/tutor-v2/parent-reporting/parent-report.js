import { Type } from "../../../core/schema/typebox.js";
import { ISODateTimeSchema, OpaqueReferenceSchema, PolicyCodeSchema, validateExact, } from "../../../core/v2/contracts/index.js";
export const PARENT_REPORT_VERSION = "tutor-parent-report/v2";
export const PARENT_REPORT_DECISION_STATUSES = [
    "tutor-proposed",
    "study-approved",
    "study-applied",
];
export const PARENT_REPORT_REASON_CODES = [
    "practice-completed",
    "support-level-used",
    "review-requested",
    "prerequisite-review",
    "reteach",
    "independent-evidence-observed",
    "study-decision",
    "time-on-task-under-15-minutes",
    "time-on-task-15-to-30-minutes",
    "time-on-task-31-to-60-minutes",
    "time-on-task-over-60-minutes",
];
/**
 * This is the complete commercial reporting vocabulary. A new status/reason
 * pair is not reportable until its literal parent-facing copy is reviewed and
 * added here.
 */
export const REVIEWED_PARENT_REPORT_COPY = [
    {
        decisionStatus: null,
        reasonCode: "practice-completed",
        statusLabel: "Study recorded",
        title: "Practice completed",
        explanation: "Study recorded completed practice in this report scope.",
    },
    {
        decisionStatus: null,
        reasonCode: "support-level-used",
        statusLabel: "Study recorded",
        title: "Support used",
        explanation: "Study recorded that an approved level of support was used during practice.",
    },
    {
        decisionStatus: "tutor-proposed",
        reasonCode: "review-requested",
        statusLabel: "Tutor proposed",
        title: "Tutor requested review",
        explanation: "Tutor requested a review. Study has not approved or applied this request.",
    },
    {
        decisionStatus: "study-approved",
        reasonCode: "review-requested",
        statusLabel: "Study approved",
        title: "Study approved review",
        explanation: "Study approved the requested review. Approval does not mean the review was applied.",
    },
    {
        decisionStatus: "study-applied",
        reasonCode: "review-requested",
        statusLabel: "Study applied",
        title: "Study applied review",
        explanation: "Study recorded that the approved review was applied.",
    },
    {
        decisionStatus: "tutor-proposed",
        reasonCode: "prerequisite-review",
        statusLabel: "Tutor proposed",
        title: "Tutor proposed prerequisite review",
        explanation: "Tutor proposed reviewing an earlier skill. Study has not approved or applied this proposal.",
    },
    {
        decisionStatus: "study-approved",
        reasonCode: "prerequisite-review",
        statusLabel: "Study approved",
        title: "Study approved prerequisite review",
        explanation: "Study approved a prerequisite review. Approval does not mean the review was applied.",
    },
    {
        decisionStatus: "study-applied",
        reasonCode: "prerequisite-review",
        statusLabel: "Study applied",
        title: "Study applied prerequisite review",
        explanation: "Study recorded that the approved prerequisite review was applied.",
    },
    {
        decisionStatus: "tutor-proposed",
        reasonCode: "reteach",
        statusLabel: "Tutor proposed",
        title: "Tutor proposed reteach",
        explanation: "Tutor proposed another explanation. Study has not approved or applied this proposal.",
    },
    {
        decisionStatus: "study-approved",
        reasonCode: "reteach",
        statusLabel: "Study approved",
        title: "Study approved reteach",
        explanation: "Study approved another explanation. Approval does not mean the reteach was applied.",
    },
    {
        decisionStatus: "study-applied",
        reasonCode: "reteach",
        statusLabel: "Study applied",
        title: "Study applied reteach",
        explanation: "Study recorded that the approved reteach was applied.",
    },
    {
        decisionStatus: null,
        reasonCode: "independent-evidence-observed",
        statusLabel: "Study recorded",
        title: "Independent evidence observed",
        explanation: "Study recorded approved evidence that independent work was observed in this report scope.",
    },
    {
        decisionStatus: "tutor-proposed",
        reasonCode: "study-decision",
        statusLabel: "Tutor proposed",
        title: "Tutor proposal awaiting Study",
        explanation: "Tutor proposed a next step. Study has not approved or applied the proposal.",
    },
    {
        decisionStatus: "study-approved",
        reasonCode: "study-decision",
        statusLabel: "Study approved",
        title: "Study decision approved",
        explanation: "Study approved the proposed next step. Approval does not mean the step was applied.",
    },
    {
        decisionStatus: "study-applied",
        reasonCode: "study-decision",
        statusLabel: "Study applied",
        title: "Study decision applied",
        explanation: "Study recorded that the approved next step was applied.",
    },
    {
        decisionStatus: null,
        reasonCode: "time-on-task-under-15-minutes",
        statusLabel: "Study recorded",
        title: "Time on task: under 15 minutes",
        explanation: "Trusted Study metadata placed time on task in the under 15 minutes bucket.",
    },
    {
        decisionStatus: null,
        reasonCode: "time-on-task-15-to-30-minutes",
        statusLabel: "Study recorded",
        title: "Time on task: 15 to 30 minutes",
        explanation: "Trusted Study metadata placed time on task in the 15 to 30 minutes bucket.",
    },
    {
        decisionStatus: null,
        reasonCode: "time-on-task-31-to-60-minutes",
        statusLabel: "Study recorded",
        title: "Time on task: 31 to 60 minutes",
        explanation: "Trusted Study metadata placed time on task in the 31 to 60 minutes bucket.",
    },
    {
        decisionStatus: null,
        reasonCode: "time-on-task-over-60-minutes",
        statusLabel: "Study recorded",
        title: "Time on task: over 60 minutes",
        explanation: "Trusted Study metadata placed time on task in the over 60 minutes bucket.",
    },
];
export const PARENT_REPORT_DISCLAIMER = "This report explains Study-approved records. Tutor may propose a step, but only Study can approve or apply it. This report does not make or change a learning decision.";
const SessionReportRequestScopeSchema = Type.Object({
    scopeKind: Type.Literal("session"),
    guardianRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    selectedLearnerRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReportingPeriodRequestScopeSchema = Type.Object({
    scopeKind: Type.Literal("reporting-period"),
    guardianRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    selectedLearnerRef: OpaqueReferenceSchema,
    reportingPeriodRef: OpaqueReferenceSchema,
    startsAt: ISODateTimeSchema,
    endsAt: ISODateTimeSchema,
}, { additionalProperties: false });
export const ParentReportRequestScopeSchema = Type.Union([
    SessionReportRequestScopeSchema,
    ReportingPeriodRequestScopeSchema,
]);
const ParentReportConsentStateSchema = Type.Union([
    Type.Literal("granted"),
    Type.Literal("withdrawn"),
    Type.Literal("expired"),
]);
const ConsentBindingCommonProperties = {
    policyRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    guardianRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    authorizationRef: OpaqueReferenceSchema,
    authorizationRevisionRef: OpaqueReferenceSchema,
    visibility: Type.Literal("parent-report"),
};
const RequiredConsentProperties = {
    policyRequirement: Type.Literal("required"),
    consentRef: OpaqueReferenceSchema,
    consentRevisionRef: OpaqueReferenceSchema,
    currentConsentRevisionRef: OpaqueReferenceSchema,
    consentRevisionStatus: Type.Union([
        Type.Literal("current"),
        Type.Literal("consumed"),
        Type.Literal("superseded"),
        Type.Literal("revoked"),
    ]),
    consentState: ParentReportConsentStateSchema,
};
const NotRequiredConsentProperties = {
    policyRequirement: Type.Literal("not-required"),
    consentState: Type.Literal("not-required"),
};
const SessionRequiredConsentSchema = Type.Object({
    ...ConsentBindingCommonProperties,
    ...RequiredConsentProperties,
    scopeKind: Type.Literal("session"),
    sessionRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReportingPeriodRequiredConsentSchema = Type.Object({
    ...ConsentBindingCommonProperties,
    ...RequiredConsentProperties,
    scopeKind: Type.Literal("reporting-period"),
    reportingPeriodRef: OpaqueReferenceSchema,
    startsAt: ISODateTimeSchema,
    endsAt: ISODateTimeSchema,
}, { additionalProperties: false });
const SessionConsentNotRequiredSchema = Type.Object({
    ...ConsentBindingCommonProperties,
    ...NotRequiredConsentProperties,
    scopeKind: Type.Literal("session"),
    sessionRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReportingPeriodConsentNotRequiredSchema = Type.Object({
    ...ConsentBindingCommonProperties,
    ...NotRequiredConsentProperties,
    scopeKind: Type.Literal("reporting-period"),
    reportingPeriodRef: OpaqueReferenceSchema,
    startsAt: ISODateTimeSchema,
    endsAt: ISODateTimeSchema,
}, { additionalProperties: false });
export const ParentReportConsentSchema = Type.Union([
    SessionConsentNotRequiredSchema,
    ReportingPeriodConsentNotRequiredSchema,
    SessionRequiredConsentSchema,
    ReportingPeriodRequiredConsentSchema,
], { $id: "TutorV2ParentReportConsent" });
const GuardianAuthorizationCommonProperties = {
    guardianAuthorizationKind: Type.Literal("study-parent-report-guardian-authorization"),
    issuer: Type.Literal("study"),
    authorizationRef: OpaqueReferenceSchema,
    reportRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    guardianRef: OpaqueReferenceSchema,
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    authorizationRevisionRef: OpaqueReferenceSchema,
    currentAuthorizationRevisionRef: OpaqueReferenceSchema,
    authorizationRevisionStatus: Type.Union([
        Type.Literal("current"),
        Type.Literal("consumed"),
        Type.Literal("superseded"),
        Type.Literal("revoked"),
    ]),
    authorizationIssuedEventRef: OpaqueReferenceSchema,
    authorizationIssuedAt: ISODateTimeSchema,
    authorizationExpiresAt: ISODateTimeSchema,
    visibility: Type.Literal("parent-report"),
    consent: ParentReportConsentSchema,
};
const SessionGuardianAuthorizationSchema = Type.Object({
    ...GuardianAuthorizationCommonProperties,
    scopeKind: Type.Literal("session"),
    sessionRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReportingPeriodGuardianAuthorizationSchema = Type.Object({
    ...GuardianAuthorizationCommonProperties,
    scopeKind: Type.Literal("reporting-period"),
    reportingPeriodRef: OpaqueReferenceSchema,
    startsAt: ISODateTimeSchema,
    endsAt: ISODateTimeSchema,
}, { additionalProperties: false });
/**
 * Closed authorization evidence issued by Study. Request scope equality alone
 * never establishes guardian authority.
 */
export const ParentReportGuardianAuthorizationSchema = Type.Union([
    SessionGuardianAuthorizationSchema,
    ReportingPeriodGuardianAuthorizationSchema,
], { $id: "TutorV2ParentReportGuardianAuthorization" });
const SessionEvidenceScopeSchema = Type.Object({
    scopeKind: Type.Literal("session"),
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    sessionRef: OpaqueReferenceSchema,
}, { additionalProperties: false });
const ReportingPeriodEvidenceScopeSchema = Type.Object({
    scopeKind: Type.Literal("reporting-period"),
    householdScopeRef: OpaqueReferenceSchema,
    learnerScopeRef: OpaqueReferenceSchema,
    reportingPeriodRef: OpaqueReferenceSchema,
    startsAt: ISODateTimeSchema,
    endsAt: ISODateTimeSchema,
}, { additionalProperties: false });
export const ParentReportEvidenceScopeSchema = Type.Union([
    SessionEvidenceScopeSchema,
    ReportingPeriodEvidenceScopeSchema,
]);
const ParentReportDecisionStatusSchema = Type.Union(PARENT_REPORT_DECISION_STATUSES.map((status) => Type.Literal(status)));
export const ParentReportEvidenceSchema = Type.Object({
    evidenceRef: OpaqueReferenceSchema,
    learnerRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
    decisionStatus: Type.Union([
        ParentReportDecisionStatusSchema,
        Type.Null(),
    ]),
    provenance: Type.Object({
        producer: Type.Literal("study-engine"),
        reportingApproval: Type.Literal("study-approved-for-parent-reporting"),
        sourceEventRef: OpaqueReferenceSchema,
        policyRef: OpaqueReferenceSchema,
        policyRevisionRef: OpaqueReferenceSchema,
        recordedAt: ISODateTimeSchema,
        scope: ParentReportEvidenceScopeSchema,
    }, { additionalProperties: false }),
}, { additionalProperties: false, $id: "TutorV2ParentReportEvidence" });
export const PARENT_REPORT_STUDY_EVIDENCE_STATES = [
    "TUTOR_PROPOSED",
    "STUDY_APPROVED",
    "STUDY_APPLIED",
    "STUDY_COMPLETED",
    "STUDY_RECORDED",
];
const ParentReportStudyEvidenceTransitionSchema = Type.Union([
    Type.Object({
        state: Type.Literal("TUTOR_PROPOSED"),
        proposalEventRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("STUDY_APPROVED"),
        proposalEventRef: OpaqueReferenceSchema,
        approvalEventRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("STUDY_APPLIED"),
        proposalEventRef: OpaqueReferenceSchema,
        approvalEventRef: OpaqueReferenceSchema,
        appliedEventRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("STUDY_COMPLETED"),
        completionEventRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    Type.Object({
        state: Type.Literal("STUDY_RECORDED"),
        observationEventRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
]);
export const ParentReportTrustedEvidenceReceiptSchema = Type.Object({
    receiptKind: Type.Literal("study-parent-report-evidence-receipt"),
    issuer: Type.Literal("study"),
    evidenceRef: OpaqueReferenceSchema,
    learnerRef: OpaqueReferenceSchema,
    reasonCode: PolicyCodeSchema,
    sourceEventRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    recordedAt: ISODateTimeSchema,
    scope: ParentReportEvidenceScopeSchema,
    transition: ParentReportStudyEvidenceTransitionSchema,
}, {
    additionalProperties: false,
    $id: "TutorV2ParentReportTrustedEvidenceReceipt",
});
const ParentReportPolicyAuthoritySchema = Type.Object({
    authorityKind: Type.Literal("study-parent-report-policy-authority"),
    issuer: Type.Literal("study-policy"),
    policyRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    currentPolicyRevisionRef: OpaqueReferenceSchema,
    policyRevisionStatus: Type.Union([
        Type.Literal("current"),
        Type.Literal("superseded"),
        Type.Literal("revoked"),
    ]),
    policyIssuedEventRef: OpaqueReferenceSchema,
    consentRequirement: Type.Union([
        Type.Literal("required"),
        Type.Literal("not-required"),
    ]),
}, { additionalProperties: false });
/**
 * Detached, trusted Study input. It must come from the Study/policy authority,
 * never from the report caller, Tutor, provider, telemetry, or memory.
 */
export const ParentReportTrustedAuthoritySchema = Type.Object({
    authorityKind: Type.Literal("study-parent-report-trusted-authority"),
    issuer: Type.Literal("study"),
    reportRef: OpaqueReferenceSchema,
    policy: ParentReportPolicyAuthoritySchema,
    guardianAuthorization: ParentReportGuardianAuthorizationSchema,
    evidenceReceipts: Type.Array(ParentReportTrustedEvidenceReceiptSchema, {
        maxItems: 1_000,
    }),
}, { additionalProperties: false, $id: "TutorV2ParentReportTrustedAuthority" });
export const ParentReportRequestSchema = Type.Object({
    requestKind: Type.Literal("parent-hub-report"),
    reportRef: OpaqueReferenceSchema,
    policyRef: OpaqueReferenceSchema,
    policyRevisionRef: OpaqueReferenceSchema,
    generatedAt: ISODateTimeSchema,
    scope: ParentReportRequestScopeSchema,
    guardianAuthorization: ParentReportGuardianAuthorizationSchema,
    evidence: Type.Array(ParentReportEvidenceSchema, { maxItems: 1_000 }),
}, { additionalProperties: false, $id: "TutorV2ParentReportRequest" });
const ParentReportOutputScopeSchema = Type.Union([
    Type.Object({
        scopeKind: Type.Literal("session"),
        guardianRef: OpaqueReferenceSchema,
        householdScopeRef: OpaqueReferenceSchema,
        learnerScopeRef: OpaqueReferenceSchema,
        sessionRef: OpaqueReferenceSchema,
    }, { additionalProperties: false }),
    Type.Object({
        scopeKind: Type.Literal("reporting-period"),
        guardianRef: OpaqueReferenceSchema,
        householdScopeRef: OpaqueReferenceSchema,
        learnerScopeRef: OpaqueReferenceSchema,
        reportingPeriodRef: OpaqueReferenceSchema,
        startsAt: ISODateTimeSchema,
        endsAt: ISODateTimeSchema,
    }, { additionalProperties: false }),
]);
export const ParentReportSummarySchema = Type.Union(REVIEWED_PARENT_REPORT_COPY.map((copy) => Type.Object({
    decisionStatus: Type.Literal(copy.decisionStatus),
    reasonCode: Type.Literal(copy.reasonCode),
    statusLabel: Type.Literal(copy.statusLabel),
    title: Type.Literal(copy.title),
    explanation: Type.Literal(copy.explanation),
    occurrenceCount: Type.Integer({ minimum: 1, maximum: 1_000 }),
}, { additionalProperties: false })), { $id: "TutorV2ParentReportSummary" });
export const ParentReportSchema = Type.Object({
    reportVersion: Type.Literal(PARENT_REPORT_VERSION),
    audience: Type.Literal("parent-hub"),
    authority: Type.Literal("explanatory-only"),
    scope: ParentReportOutputScopeSchema,
    summaries: Type.Array(ParentReportSummarySchema, {
        maxItems: REVIEWED_PARENT_REPORT_COPY.length,
    }),
    disclaimer: Type.Literal(PARENT_REPORT_DISCLAIMER),
    provenance: Type.Object({
        producer: Type.Literal("study-engine"),
        reportRef: OpaqueReferenceSchema,
        policyRef: OpaqueReferenceSchema,
        policyRevisionRef: OpaqueReferenceSchema,
        generatedAt: ISODateTimeSchema,
        authorizationRef: OpaqueReferenceSchema,
        authorizationRevisionRef: OpaqueReferenceSchema,
        authorizationIssuedEventRef: OpaqueReferenceSchema,
        consentRef: Type.Union([OpaqueReferenceSchema, Type.Null()]),
        consentRevisionRef: Type.Union([
            OpaqueReferenceSchema,
            Type.Null(),
        ]),
        sourceEvidenceCount: Type.Integer({ minimum: 0, maximum: 1_000 }),
    }, { additionalProperties: false }),
}, { additionalProperties: false, $id: "TutorV2ParentReport" });
export const ParentReportResultSchema = Type.Union([
    Type.Object({ status: Type.Literal("accepted"), value: ParentReportSchema }, { additionalProperties: false }),
    Type.Object({
        status: Type.Literal("rejected"),
        code: Type.Union([
            Type.Literal("PARENT_REPORT_REQUEST_REJECTED"),
            Type.Literal("PARENT_REPORT_AUTHORIZATION_REJECTED"),
            Type.Literal("PARENT_REPORT_CONSENT_REJECTED"),
            Type.Literal("PARENT_REPORT_SCOPE_MISMATCH"),
            Type.Literal("PARENT_REPORT_UNKNOWN_REASON"),
            Type.Literal("PARENT_REPORT_STATUS_MISMATCH"),
            Type.Literal("PARENT_REPORT_DUPLICATE_EVIDENCE"),
            Type.Literal("PARENT_REPORT_INVALID_PERIOD"),
            Type.Literal("PARENT_REPORT_POLICY_MISMATCH"),
            Type.Literal("PARENT_REPORT_CHRONOLOGY_MISMATCH"),
        ]),
    }, { additionalProperties: false }),
], { $id: "TutorV2ParentReportResult" });
function isValidDateTime(value) {
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime()))
        return false;
    const normalizedInput = value.includes(".")
        ? value
        : value.replace(/Z$/, ".000Z");
    return parsed.toISOString() === normalizedInput;
}
function isValidPeriod(scope) {
    return (isValidDateTime(scope.startsAt) &&
        isValidDateTime(scope.endsAt) &&
        Date.parse(scope.startsAt) <= Date.parse(scope.endsAt));
}
function evidenceMatchesScope(reportScope, evidence) {
    const evidenceScope = evidence.provenance.scope;
    if (evidence.learnerRef !== reportScope.selectedLearnerRef ||
        evidenceScope.householdScopeRef !== reportScope.householdScopeRef ||
        evidenceScope.learnerScopeRef !== reportScope.selectedLearnerRef ||
        evidenceScope.scopeKind !== reportScope.scopeKind) {
        return false;
    }
    if (reportScope.scopeKind === "session" &&
        evidenceScope.scopeKind === "session") {
        return evidenceScope.sessionRef === reportScope.sessionRef;
    }
    if (reportScope.scopeKind === "reporting-period" &&
        evidenceScope.scopeKind === "reporting-period") {
        const recordedAt = Date.parse(evidence.provenance.recordedAt);
        return (evidenceScope.reportingPeriodRef === reportScope.reportingPeriodRef &&
            evidenceScope.startsAt === reportScope.startsAt &&
            evidenceScope.endsAt === reportScope.endsAt &&
            isValidDateTime(evidence.provenance.recordedAt) &&
            recordedAt >= Date.parse(reportScope.startsAt) &&
            recordedAt <= Date.parse(reportScope.endsAt));
    }
    return false;
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function consentMatchesScope(reportScope, consent) {
    if (consent.guardianRef !== reportScope.guardianRef ||
        consent.householdScopeRef !== reportScope.householdScopeRef ||
        consent.learnerScopeRef !== reportScope.selectedLearnerRef ||
        consent.scopeKind !== reportScope.scopeKind) {
        return false;
    }
    if (reportScope.scopeKind === "session" && consent.scopeKind === "session") {
        return consent.sessionRef === reportScope.sessionRef;
    }
    if (reportScope.scopeKind === "reporting-period" &&
        consent.scopeKind === "reporting-period") {
        return (consent.reportingPeriodRef === reportScope.reportingPeriodRef &&
            consent.startsAt === reportScope.startsAt &&
            consent.endsAt === reportScope.endsAt);
    }
    return false;
}
function authorizationMatchesScope(reportScope, authorization) {
    if (authorization.guardianRef !== reportScope.guardianRef ||
        authorization.householdScopeRef !== reportScope.householdScopeRef ||
        authorization.learnerScopeRef !== reportScope.selectedLearnerRef ||
        authorization.scopeKind !== reportScope.scopeKind) {
        return false;
    }
    if (reportScope.scopeKind === "session" &&
        authorization.scopeKind === "session") {
        return authorization.sessionRef === reportScope.sessionRef;
    }
    if (reportScope.scopeKind === "reporting-period" &&
        authorization.scopeKind === "reporting-period") {
        return (authorization.reportingPeriodRef === reportScope.reportingPeriodRef &&
            authorization.startsAt === reportScope.startsAt &&
            authorization.endsAt === reportScope.endsAt);
    }
    return false;
}
function consentMatchesTrustedAuthority(submitted, trusted) {
    if (submitted.policyRequirement !== trusted.policyRequirement ||
        submitted.consentState !== trusted.consentState ||
        submitted.policyRef !== trusted.policyRef ||
        submitted.policyRevisionRef !== trusted.policyRevisionRef ||
        submitted.guardianRef !== trusted.guardianRef ||
        submitted.householdScopeRef !== trusted.householdScopeRef ||
        submitted.learnerScopeRef !== trusted.learnerScopeRef ||
        submitted.authorizationRef !== trusted.authorizationRef ||
        submitted.authorizationRevisionRef !== trusted.authorizationRevisionRef ||
        submitted.visibility !== trusted.visibility ||
        submitted.scopeKind !== trusted.scopeKind) {
        return false;
    }
    if (submitted.policyRequirement === "required" &&
        trusted.policyRequirement === "required" &&
        (submitted.consentRef !== trusted.consentRef ||
            submitted.consentRevisionRef !== trusted.consentRevisionRef ||
            submitted.currentConsentRevisionRef !==
                trusted.currentConsentRevisionRef ||
            submitted.consentRevisionStatus !== trusted.consentRevisionStatus)) {
        return false;
    }
    if (submitted.scopeKind === "session" && trusted.scopeKind === "session") {
        return submitted.sessionRef === trusted.sessionRef;
    }
    if (submitted.scopeKind === "reporting-period" &&
        trusted.scopeKind === "reporting-period") {
        return (submitted.reportingPeriodRef === trusted.reportingPeriodRef &&
            submitted.startsAt === trusted.startsAt &&
            submitted.endsAt === trusted.endsAt);
    }
    return false;
}
function authorizationMatchesTrustedAuthority(submitted, trusted) {
    const scopeMatches = submitted.scopeKind === "session" && trusted.scopeKind === "session"
        ? submitted.sessionRef === trusted.sessionRef
        : submitted.scopeKind === "reporting-period" &&
            trusted.scopeKind === "reporting-period"
            ? submitted.reportingPeriodRef === trusted.reportingPeriodRef &&
                submitted.startsAt === trusted.startsAt &&
                submitted.endsAt === trusted.endsAt
            : false;
    return (submitted.guardianAuthorizationKind === trusted.guardianAuthorizationKind &&
        submitted.issuer === trusted.issuer &&
        submitted.authorizationRef === trusted.authorizationRef &&
        submitted.reportRef === trusted.reportRef &&
        submitted.policyRef === trusted.policyRef &&
        submitted.policyRevisionRef === trusted.policyRevisionRef &&
        submitted.guardianRef === trusted.guardianRef &&
        submitted.householdScopeRef === trusted.householdScopeRef &&
        submitted.learnerScopeRef === trusted.learnerScopeRef &&
        submitted.authorizationRevisionRef === trusted.authorizationRevisionRef &&
        submitted.currentAuthorizationRevisionRef ===
            trusted.currentAuthorizationRevisionRef &&
        submitted.authorizationRevisionStatus ===
            trusted.authorizationRevisionStatus &&
        submitted.authorizationIssuedEventRef ===
            trusted.authorizationIssuedEventRef &&
        submitted.authorizationIssuedAt === trusted.authorizationIssuedAt &&
        submitted.authorizationExpiresAt === trusted.authorizationExpiresAt &&
        submitted.visibility === trusted.visibility &&
        scopeMatches);
}
function terminalTransitionEventRef(receipt) {
    switch (receipt.transition.state) {
        case "TUTOR_PROPOSED":
            return receipt.transition.proposalEventRef;
        case "STUDY_APPROVED":
            return receipt.transition.approvalEventRef;
        case "STUDY_APPLIED":
            return receipt.transition.appliedEventRef;
        case "STUDY_COMPLETED":
            return receipt.transition.completionEventRef;
        case "STUDY_RECORDED":
            return receipt.transition.observationEventRef;
    }
}
function hasValidTransitionChain(receipt) {
    switch (receipt.transition.state) {
        case "TUTOR_PROPOSED":
        case "STUDY_COMPLETED":
        case "STUDY_RECORDED":
            return true;
        case "STUDY_APPROVED":
            return (receipt.transition.proposalEventRef !==
                receipt.transition.approvalEventRef);
        case "STUDY_APPLIED":
            return new Set([
                receipt.transition.proposalEventRef,
                receipt.transition.approvalEventRef,
                receipt.transition.appliedEventRef,
            ]).size === 3;
    }
}
function transitionMatchesClaim(receipt, evidence) {
    const decisionReason = evidence.reasonCode === "review-requested" ||
        evidence.reasonCode === "prerequisite-review" ||
        evidence.reasonCode === "reteach" ||
        evidence.reasonCode === "study-decision";
    if (decisionReason) {
        return ((receipt.transition.state === "TUTOR_PROPOSED" &&
            evidence.decisionStatus === "tutor-proposed") ||
            (receipt.transition.state === "STUDY_APPROVED" &&
                evidence.decisionStatus === "study-approved") ||
            (receipt.transition.state === "STUDY_APPLIED" &&
                evidence.decisionStatus === "study-applied"));
    }
    if (evidence.reasonCode === "practice-completed") {
        return (receipt.transition.state === "STUDY_COMPLETED" &&
            evidence.decisionStatus === null);
    }
    return (receipt.transition.state === "STUDY_RECORDED" &&
        evidence.decisionStatus === null);
}
function evidenceMatchesTrustedReceipt(evidence, receipt) {
    const evidenceScope = evidence.provenance.scope;
    const receiptScope = receipt.scope;
    const scopeMatches = evidenceScope.householdScopeRef === receiptScope.householdScopeRef &&
        evidenceScope.learnerScopeRef === receiptScope.learnerScopeRef &&
        (evidenceScope.scopeKind === "session" && receiptScope.scopeKind === "session"
            ? evidenceScope.sessionRef === receiptScope.sessionRef
            : evidenceScope.scopeKind === "reporting-period" &&
                receiptScope.scopeKind === "reporting-period"
                ? evidenceScope.reportingPeriodRef === receiptScope.reportingPeriodRef &&
                    evidenceScope.startsAt === receiptScope.startsAt &&
                    evidenceScope.endsAt === receiptScope.endsAt
                : false);
    return (evidence.evidenceRef === receipt.evidenceRef &&
        evidence.learnerRef === receipt.learnerRef &&
        evidence.reasonCode === receipt.reasonCode &&
        evidence.provenance.sourceEventRef === receipt.sourceEventRef &&
        evidence.provenance.policyRef === receipt.policyRef &&
        evidence.provenance.policyRevisionRef === receipt.policyRevisionRef &&
        evidence.provenance.recordedAt === receipt.recordedAt &&
        scopeMatches &&
        hasValidTransitionChain(receipt) &&
        terminalTransitionEventRef(receipt) === receipt.sourceEventRef &&
        transitionMatchesClaim(receipt, evidence));
}
function outputScope(scope) {
    if (scope.scopeKind === "session") {
        return {
            scopeKind: scope.scopeKind,
            guardianRef: scope.guardianRef,
            householdScopeRef: scope.householdScopeRef,
            learnerScopeRef: scope.selectedLearnerRef,
            sessionRef: scope.sessionRef,
        };
    }
    return {
        scopeKind: scope.scopeKind,
        guardianRef: scope.guardianRef,
        householdScopeRef: scope.householdScopeRef,
        learnerScopeRef: scope.selectedLearnerRef,
        reportingPeriodRef: scope.reportingPeriodRef,
        startsAt: scope.startsAt,
        endsAt: scope.endsAt,
    };
}
/**
 * Aggregates only exact, Study-approved-for-reporting evidence. It does not
 * query Study, approve a proposal, apply a decision, or deliver a notification.
 */
export function buildMinimizedParentHubReport(value, trustedAuthorityValue) {
    if (!isRecord(value) || !isRecord(value.guardianAuthorization)) {
        return {
            status: "rejected",
            code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
        };
    }
    const consentResult = validateExact(ParentReportConsentSchema, value.guardianAuthorization.consent);
    if (consentResult.status === "rejected") {
        return { status: "rejected", code: "PARENT_REPORT_CONSENT_REJECTED" };
    }
    const authorizationResult = validateExact(ParentReportGuardianAuthorizationSchema, value.guardianAuthorization);
    if (authorizationResult.status === "rejected") {
        return {
            status: "rejected",
            code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
        };
    }
    const requestResult = validateExact(ParentReportRequestSchema, value);
    if (requestResult.status === "rejected") {
        return { status: "rejected", code: "PARENT_REPORT_REQUEST_REJECTED" };
    }
    const trustedAuthorityResult = validateExact(ParentReportTrustedAuthoritySchema, trustedAuthorityValue);
    if (trustedAuthorityResult.status === "rejected") {
        return {
            status: "rejected",
            code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
        };
    }
    const request = requestResult.value;
    const authorization = authorizationResult.value;
    const trustedAuthority = trustedAuthorityResult.value;
    if (!isValidDateTime(request.generatedAt)) {
        return { status: "rejected", code: "PARENT_REPORT_REQUEST_REJECTED" };
    }
    if (request.scope.scopeKind === "reporting-period" &&
        !isValidPeriod(request.scope)) {
        return { status: "rejected", code: "PARENT_REPORT_INVALID_PERIOD" };
    }
    if (authorization.authorizationRevisionStatus !== "current" ||
        authorization.authorizationRevisionRef !==
            authorization.currentAuthorizationRevisionRef ||
        authorization.reportRef !== request.reportRef ||
        authorization.policyRef !== request.policyRef ||
        authorization.policyRevisionRef !== request.policyRevisionRef ||
        !isValidDateTime(authorization.authorizationIssuedAt) ||
        !isValidDateTime(authorization.authorizationExpiresAt) ||
        Date.parse(authorization.authorizationIssuedAt) >
            Date.parse(request.generatedAt) ||
        Date.parse(request.generatedAt) >
            Date.parse(authorization.authorizationExpiresAt) ||
        Date.parse(authorization.authorizationIssuedAt) >
            Date.parse(authorization.authorizationExpiresAt) ||
        !authorizationMatchesScope(request.scope, authorization)) {
        return {
            status: "rejected",
            code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
        };
    }
    if (trustedAuthority.reportRef !== request.reportRef ||
        trustedAuthority.policy.policyRevisionStatus !== "current" ||
        trustedAuthority.policy.policyRevisionRef !==
            trustedAuthority.policy.currentPolicyRevisionRef ||
        trustedAuthority.policy.policyRef !== request.policyRef ||
        trustedAuthority.policy.policyRevisionRef !== request.policyRevisionRef ||
        !authorizationMatchesTrustedAuthority(authorization, trustedAuthority.guardianAuthorization)) {
        return {
            status: "rejected",
            code: "PARENT_REPORT_AUTHORIZATION_REJECTED",
        };
    }
    if (authorization.consent.policyRequirement !==
        trustedAuthority.policy.consentRequirement ||
        authorization.consent.policyRef !== request.policyRef ||
        authorization.consent.policyRevisionRef !== request.policyRevisionRef ||
        authorization.consent.authorizationRef !==
            authorization.authorizationRef ||
        authorization.consent.authorizationRevisionRef !==
            authorization.authorizationRevisionRef ||
        !consentMatchesScope(request.scope, authorization.consent) ||
        !consentMatchesTrustedAuthority(authorization.consent, trustedAuthority.guardianAuthorization.consent)) {
        return { status: "rejected", code: "PARENT_REPORT_CONSENT_REJECTED" };
    }
    if (authorization.consent.policyRequirement === "required" &&
        (authorization.consent.consentState !== "granted" ||
            authorization.consent.consentRevisionStatus !== "current" ||
            authorization.consent.consentRevisionRef !==
                authorization.consent.currentConsentRevisionRef)) {
        return { status: "rejected", code: "PARENT_REPORT_CONSENT_REJECTED" };
    }
    const evidenceRefs = new Set();
    const sourceEventRefs = new Set();
    const trustedEvidenceRefs = new Set();
    const trustedSourceEventRefs = new Set();
    const trustedReceiptsByEvidenceRef = new Map();
    for (const receipt of trustedAuthority.evidenceReceipts) {
        if (trustedEvidenceRefs.has(receipt.evidenceRef) ||
            trustedSourceEventRefs.has(receipt.sourceEventRef)) {
            return {
                status: "rejected",
                code: "PARENT_REPORT_DUPLICATE_EVIDENCE",
            };
        }
        trustedEvidenceRefs.add(receipt.evidenceRef);
        trustedSourceEventRefs.add(receipt.sourceEventRef);
        trustedReceiptsByEvidenceRef.set(receipt.evidenceRef, receipt);
    }
    if (trustedAuthority.evidenceReceipts.length !== request.evidence.length) {
        return { status: "rejected", code: "PARENT_REPORT_STATUS_MISMATCH" };
    }
    const counts = new Map();
    for (const evidence of request.evidence) {
        if (evidenceRefs.has(evidence.evidenceRef) ||
            sourceEventRefs.has(evidence.provenance.sourceEventRef)) {
            return {
                status: "rejected",
                code: "PARENT_REPORT_DUPLICATE_EVIDENCE",
            };
        }
        evidenceRefs.add(evidence.evidenceRef);
        sourceEventRefs.add(evidence.provenance.sourceEventRef);
        if (!isValidDateTime(evidence.provenance.recordedAt)) {
            return { status: "rejected", code: "PARENT_REPORT_REQUEST_REJECTED" };
        }
        if (evidence.provenance.policyRef !== request.policyRef) {
            return { status: "rejected", code: "PARENT_REPORT_POLICY_MISMATCH" };
        }
        if (evidence.provenance.policyRevisionRef !== request.policyRevisionRef) {
            return { status: "rejected", code: "PARENT_REPORT_POLICY_MISMATCH" };
        }
        if (!evidenceMatchesScope(request.scope, evidence)) {
            return { status: "rejected", code: "PARENT_REPORT_SCOPE_MISMATCH" };
        }
        if (Date.parse(evidence.provenance.recordedAt) >
            Date.parse(request.generatedAt)) {
            return {
                status: "rejected",
                code: "PARENT_REPORT_CHRONOLOGY_MISMATCH",
            };
        }
        const trustedReceipt = trustedReceiptsByEvidenceRef.get(evidence.evidenceRef);
        if (trustedReceipt === undefined ||
            !evidenceMatchesTrustedReceipt(evidence, trustedReceipt)) {
            return { status: "rejected", code: "PARENT_REPORT_STATUS_MISMATCH" };
        }
        const reasonExists = REVIEWED_PARENT_REPORT_COPY.some((copy) => copy.reasonCode === evidence.reasonCode);
        if (!reasonExists) {
            return { status: "rejected", code: "PARENT_REPORT_UNKNOWN_REASON" };
        }
        const reviewedCopy = REVIEWED_PARENT_REPORT_COPY.find((copy) => copy.reasonCode === evidence.reasonCode &&
            copy.decisionStatus === evidence.decisionStatus);
        if (!reviewedCopy) {
            return { status: "rejected", code: "PARENT_REPORT_STATUS_MISMATCH" };
        }
        const key = `${reviewedCopy.decisionStatus}:${reviewedCopy.reasonCode}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const summaries = REVIEWED_PARENT_REPORT_COPY.flatMap((copy) => {
        const key = `${copy.decisionStatus}:${copy.reasonCode}`;
        const occurrenceCount = counts.get(key);
        return occurrenceCount === undefined ? [] : [{ ...copy, occurrenceCount }];
    });
    const report = {
        reportVersion: PARENT_REPORT_VERSION,
        audience: "parent-hub",
        authority: "explanatory-only",
        scope: outputScope(request.scope),
        summaries,
        disclaimer: PARENT_REPORT_DISCLAIMER,
        provenance: {
            producer: "study-engine",
            reportRef: request.reportRef,
            policyRef: request.policyRef,
            policyRevisionRef: request.policyRevisionRef,
            generatedAt: request.generatedAt,
            authorizationRef: authorization.authorizationRef,
            authorizationRevisionRef: authorization.authorizationRevisionRef,
            authorizationIssuedEventRef: authorization.authorizationIssuedEventRef,
            consentRef: authorization.consent.policyRequirement === "required"
                ? authorization.consent.consentRef
                : null,
            consentRevisionRef: authorization.consent.policyRequirement === "required"
                ? authorization.consent.consentRevisionRef
                : null,
            sourceEvidenceCount: request.evidence.length,
        },
    };
    const reportResult = validateExact(ParentReportSchema, report);
    if (reportResult.status === "rejected") {
        return { status: "rejected", code: "PARENT_REPORT_REQUEST_REJECTED" };
    }
    return { status: "accepted", value: reportResult.value };
}
export const buildParentHubReport = buildMinimizedParentHubReport;

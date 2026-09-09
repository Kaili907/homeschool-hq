# W4-R3 Serialized Contract Changes

Global generated release artifacts were intentionally not regenerated in this
repair lane.

## Source contract changes

`ParentReportRequest` adds `policyRevisionRef`.

`ParentReportGuardianAuthorization` adds:

- `reportRef`;
- `policyRevisionRef`;
- `authorizationIssuedEventRef`;
- `authorizationIssuedAt` and `authorizationExpiresAt`; and
- `consumed` as an explicitly rejected authorization revision status.

Every `ParentReportConsent` branch now includes guardian, household, learner,
authorization reference/revision, policy reference/revision, visibility, and
session/reporting-period scope (including exact period boundaries). Required consent also includes
`consentRevisionRef`, `currentConsentRevisionRef`, and
`consentRevisionStatus`.

`ParentReportEvidence.provenance` adds `policyRevisionRef`.

Two exact detached contracts are introduced:

- `ParentReportTrustedAuthority`, containing current Study policy authority,
  the report-bound guardian authorization, and the exact receipt set; and
- `ParentReportTrustedEvidenceReceipt`, containing the closed Study evidence
  transition and its terminal event binding.

`buildMinimizedParentHubReport` accepts the detached authority as its second
argument. The argument is optional only for source compatibility; omission
fails closed with `PARENT_REPORT_AUTHORIZATION_REJECTED`.

`ParentReport.provenance` adds:

- `policyRevisionRef`;
- `authorizationIssuedEventRef`; and
- `consentRevisionRef` (or `null` when consent is not required).

## Reconvergence work

At convergence, regenerate the canonical Parent report JSON schema and schema
inventory from the updated source contract, including at least:

- `adaptive-tutor/json-schema/v3/wave3/parent-report.schema.json`; and
- `adaptive-tutor/json-schema/v3/wave3/SCHEMA-INVENTORY.json` if its generated
  metadata changes.

Consumers must obtain the detached trusted snapshot from Study/policy
authority. They must not derive it from `ParentReportRequest`, provider output,
Tutor output, telemetry, memory, or Parent input.

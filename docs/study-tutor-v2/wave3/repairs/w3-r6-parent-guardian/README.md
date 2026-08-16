# W3-R6 Parent Guardian Authorization and Consent Binding

Status: ready for Wave 3 convergence.

This repair replaces caller-asserted learner equality with closed, Study-issued
guardian authorization evidence. `selectedLearnerRef == authorizedLearnerRef`
is no longer part of the request contract and cannot authorize a report.

## Study-issued authorization contract

Every parent report request must include one exact
`study-parent-report-guardian-authorization` record with:

- `issuer: study`;
- opaque authorization, policy, guardian, household, learner,
  authorization-revision, and current-authorization-revision references;
- `authorizationRevisionStatus` from the closed set `current`, `superseded`, or
  `revoked`;
- `visibility: parent-report`;
- exactly one session or reporting-period scope; and
- a closed consent record.

Generation accepts only a `current` authorization whose revision reference
equals the Study-declared current revision reference. Guardian, household,
learner, scope kind, and session/reporting-period references must equal the
requested report scope, and the authorization policy must equal the report
policy. Missing evidence, a foreign issuer, a wrong visibility, a stale,
superseded, or revoked revision, or any scope mismatch rejects the whole request
without reflecting submitted identifiers.

## Consent binding

The authorization binds one of two exact consent branches:

- policy does not require consent: `policyRequirement: not-required` and
  `consentState: not-required`; or
- policy requires consent: `policyRequirement: required`, an opaque
  `consentRef`, and a state from `granted`, `withdrawn`, or `expired`.

Required consent must be present and `granted`. Missing, withdrawn, or expired
required consent fails closed. Accepted report provenance retains the validated
authorization reference, authorization revision reference, and the required
consent reference (or `null` when policy does not require consent).

## Authority and privacy invariants

Guardian authorization permits only generation of the minimized explanatory
report. It does not make Tutor authoritative and does not approve or apply any
instructional action. `Tutor proposed`, `Study approved`, and `Study applied`
remain distinct reviewed states.

The exact schemas continue to reject raw learner answers, Tutor transcripts,
provider prose, diagnoses, emotion/personality labels, sibling data,
credentials, arbitrary narrative, and raw duration. Authorization or consent
objects cannot be replaced by any of those data classes.

# Manuel Academy Tutor Conversation and Safety Center

Session 3 delivers an integration-ready, student-scoped safety policy package
and a parent/student browser prototype without changing shared tutor, identity,
profile, role, sync, or adaptive-study code.

## What is included

- closed TypeScript contracts and strict runtime validators;
- five checked-in Draft 2020-12 JSON Schemas;
- subject, schedule, capability, and session-limit enforcement;
- answer-withholding and age-band refusal explanations;
- emergency-language pause/escalation with trusted-adult guidance;
- parent notifications, student reports/blocks, audit, review, and
  false-positive workflows;
- student-scoped history search and subject/date filters;
- retention, export, and approved-deletion operations;
- synthetic seed fixtures;
- an accessible parent/student React prototype;
- authorization, isolation, escalation, retention, deletion, schema, privacy,
  adversarial, and accessibility tests.

Instructional conversation records and safety events are separate aggregates.
Safety events contain safe summaries and references rather than copied raw
messages. No contract accepts or stores a raw microphone recording.

## Read first

- `OWNERSHIP.md` — exact Session 3 write boundary
- `contract-inspection.md` — shared-system inspection
- `core-change-requests.md` — production integration blockers
- `integration-guide.md` — adapter and enforcement order
- `privacy-notes.md` — data-use and minimization review
- `threat-model.md` — assets, trust boundaries, and misuse cases
- `accessibility-review.md` — interface accessibility findings
- `validation-report.md` — completion-gate evidence

## Important limit

The current family PIN/profile state is not a production authentication
contract, and the temporary core has no household/tenant field. The host must
complete `S3-CCR-01` before production use. The prototype demonstrates
student-scoped behavior; it does not widen or replace existing role-based
access controls.

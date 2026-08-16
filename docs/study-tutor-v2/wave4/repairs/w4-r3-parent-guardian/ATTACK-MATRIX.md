# W4-R3 Parent Guardian Repair Matrix

| Family | Attack or control | Result |
| --- | --- | --- |
| Control | exact detached Study authority, session and period | accepted |
| Authority | missing or provider-substituted detached authority | rejected |
| Consent | sibling/foreign granted consent reference | rejected |
| Consent | sibling learner consent scope | rejected |
| Consent | trusted required policy downgraded in report input | rejected |
| Consent | missing required consent | rejected |
| Authorization | same authorization used for a new report reference | rejected |
| Authorization | exact duplicate report generation | deterministic/idempotent |
| Authorization | wrong guardian, household, learner, session, or period | rejected |
| Authorization | wrong visibility | rejected |
| Authorization | stale revision | rejected |
| Authorization | consumed, superseded, or revoked revision | rejected |
| Authorization | expired issuance window | rejected |
| Policy | stale policy revision | rejected |
| Truthfulness | Tutor-proposed relabeled Study-applied | rejected |
| Truthfulness | Study-approved reclassified completed practice | rejected |
| Truthfulness | terminal event does not match trusted transition | rejected |
| Truthfulness | completion with distinct trusted completion event | accepted |
| Confused deputy | Tutor, provider, telemetry, memory, curriculum, Parent | rejected |
| Wording | Tutor-proposed and Study-approved pending copy | truthful |
| Privacy | sibling or raw/sensitive evidence | rejected/no reflection |

The executable campaign is
`adaptive-tutor/tests/wave4-repairs/parent-guardian/parent-guardian.repair.test.ts`.

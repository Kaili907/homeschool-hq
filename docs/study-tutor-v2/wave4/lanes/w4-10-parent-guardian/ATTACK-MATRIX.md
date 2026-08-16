# W4-10 Attack Matrix

| Family | Attack | Expected | Observed |
| --- | --- | --- | --- |
| Control | exact current Study authorization | accept | accepted |
| Authorization | missing authorization | reject | rejected |
| Authorization | wrong guardian | reject | rejected |
| Authorization | wrong household | reject | rejected |
| Authorization | wrong learner | reject | rejected |
| Authorization | wrong session | reject | rejected |
| Authorization | wrong reporting period | reject | rejected |
| Authorization | wrong visibility | reject | rejected |
| Authorization | stale revision reference | reject | rejected |
| Authorization | revoked authorization | reject | rejected |
| Consent | required consent absent | reject | rejected |
| Authorization | valid authorization for sibling | reject | rejected |
| Authorization | valid authorization from prior period | reject | rejected |
| Consent | sibling/foreign granted consent reference | reject | **accepted — PG-01** |
| Consent | required policy downgraded to `not-required` | reject | **accepted — PG-01** |
| Authorization | same authorization replayed for a second report | reject | **accepted — PG-02** |
| Confused deputy | Tutor advisory as authorization | reject | rejected |
| Confused deputy | provider response as authorization | reject | rejected |
| Confused deputy | telemetry as authorization | reject | rejected |
| Confused deputy | memory as authorization | reject | rejected |
| Confused deputy | curriculum admission as authorization | reject | rejected |
| Confused deputy | Parent request as authorization | reject | rejected |
| Truthfulness | `Tutor proposed` relabeled `Study applied` | reject | **accepted — PG-03** |
| Truthfulness | `Study approved` reclassified `practice-completed` | reject | **accepted — PG-03** |
| Truthfulness | pending Tutor wording | no overstatement | truthful |
| Truthfulness | pending Study-approved wording | no overstatement | truthful |
| Privacy | sibling evidence | reject | rejected |
| Privacy | raw Tutor transcript | reject/no reflection | rejected/no reflection |
| Privacy | raw provider response | reject/no reflection | rejected/no reflection |
| Privacy | raw provider prose | reject/no reflection | rejected/no reflection |

The matrix is implemented by
`adaptive-tutor/adversarial/v4/parent-guardian/parent-guardian.adversarial.test.ts`.
The five accepted attacks are intentionally failing assertions; a green result
must mean the shared boundary rejected them, not that the expectations were
changed.


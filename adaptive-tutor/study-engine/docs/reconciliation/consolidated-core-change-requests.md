# Consolidated Core-Change Requests

Nine requests replace overlapping Wave 1 proposals. They are planning records, not implementation authorization.

| ID | Consolidated request | Deduplicates | Classification |
|---|---|---|---|
| CCR-001 | Shared IDs, time, version, validation, schema, and audience governance | S1 CR-01/02/03; S4 CR-INT-001/006 | REQUIRED BEFORE FINAL ASSEMBLY |
| CCR-002 | Versioned sidecar, CAS/functional update, append-only ledgers, outbox, authorized calendar host | S1 CR-04/07/08; S4 CR-INT-002 | DEFERRED PRODUCTION CONCERN |
| CCR-003 | Adult-private repository, explicit audience, safe projections | S1 CR-05; S4 CR-INT-004/007 | BLOCKER |
| CCR-004 | Verified Tutor Core directive/evidence/safety/media/review bridge | S2 adapter items 4/5/8; S4 CR-INT-003 | BLOCKER |
| CCR-005 | Typed accommodation and constraint-based precedence policy | S1 accommodation proposals; S2 focus/break gaps; S4 parent accommodation | BLOCKER |
| CCR-006 | Exact-resume checkpoint and event replay contract | S1 ResumePoint; S2 runtime cursor; S3 refresh recovery | REQUIRED BEFORE FINAL ASSEMBLY |
| CCR-007 | Review occurrence, retry-not-before, completion/result-return saga | S2 scheduler; S4 queue/calendar | REQUIRED BEFORE FINAL ASSEMBLY |
| CCR-008 | Credential-free Romeo metadata intake and typed StudyPlan support | S4 CR-INT-005 | DEFERRED PRODUCTION CONCERN |
| CCR-009 | Minimized telemetry and trusted learner/parent catalog text | S4 CR-INT-008/retention; S2 coach rendering | DEFERRED PRODUCTION CONCERN |

## Deduplication rule

A future request is a duplicate when it seeks the same host capability, data boundary, or authoritative source, even if a different Wave package names it differently. Add acceptance criteria or a consumer to the existing CCR rather than creating a parallel contract.

Machine details and acceptance criteria: [`core-change-requests.v1.json`](../../reconciliation/core-change-requests.v1.json).


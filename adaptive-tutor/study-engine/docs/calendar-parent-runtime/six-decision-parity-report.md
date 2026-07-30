# Session 8 accepted R2 decision-parity report

Accepted authority:
`SESSION-5-R2-PORTABLE-RECONCILIATION-PACKAGE.zip`, SHA-256
`39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`.

The six `DEC-*` labels come from the dispatch request. They are not literal
identifiers in the accepted R2 archive. The `acceptedR2Source` column therefore
names the canonical decision rows and exact mappings that provide the accepted
evidence.

| decisionId | priorSource | acceptedR2Source | equivalent | runtimeImpact | testsAffected | actionTaken |
| --- | --- | --- | --- | --- | --- | --- |
| DEC-009 | `CARD-5-STUDY-RECON-AUDIT.zip` 0.5.0-blocked.1 | `canonical-contract-decisions.md`, Evidence rows 17-26; `exact-mappings.json`, Tutor Core confidence/independence aggregates to canonical `LearningEvidence` | yes | Aggregate-only independence remains non-diagnostic; no raw answers or hidden learner trait crosses the seam | `review-runtime.test.ts`, `adversarial-validation.test.ts` | Retained runtime behavior; corrected provenance |
| DEC-012 | prior Card 5 duration probe | `canonical-contract-decisions.md`, Overrides rows 29-30 and parent precedence/conflict rows | yes | Integrity/authorization gates, safety and required accommodations, authorized adult limits, feasible interval, candidate selection, clamp, manual review, and complete provenance remain enforced | `parent-runtime.test.ts`, `demo-runtime.test.ts` | Made the accepted constraint reducer portable inside Session 8 ownership; removed the unowned probe dependency |
| DEC-014 | prior Card 5 same-day rule | `canonical-contract-decisions.md`, Review/time rows 33-36; `exact-mappings.json`, canonical interval map | yes | Same-day means learner-local civil date; retry time is not invented; household IANA zone and explicit-offset instants govern DST | `review-runtime.test.ts`, `calendar-runtime.test.ts`, `adversarial-validation.test.ts` | Retained behavior; corrected provenance |
| DEC-017 | prior Card 5 result-return rule | `canonical-contract-decisions.md`, Registry/results rows 43-44 and Persistence rows 45-48 | yes | Stable canonical IDs, append-only/idempotent result return, memory outbox dedupe, CAS/sequence integrity, and unsupported-version quarantine remain enforced | `review-runtime.test.ts`, `calendar-runtime.test.ts` | Retained behavior and dictionary mapping; corrected provenance |
| DEC-018 | prior Card 5 Romeo rule | `canonical-contract-decisions.md`, Calendar/queue/Romeo rows 37-39; `exact-mappings.json`, credential-free Romeo sidecar mapping | yes | Romeo remains credential-free; external IDs and opaque launch refs are stable; due date stays date-only; progress domains remain separate; calendar projection is idempotent | `romeo-runtime.test.ts`, `adversarial-validation.test.ts` | Retained adapter boundary; corrected provenance |
| DEC-019 | prior Card 5 privacy rule | `canonical-contract-decisions.md`, Privacy rows 40-42; `exact-mappings.json`, private bodies to `ParentTeacherPrivateRecord` and controls to `privateRecordRef` | yes | Adult-private bodies stay isolated; operational events are body-free; learner projection excludes private-note existence, PII, raw answers, and transcripts | `parent-runtime.test.ts`, `adversarial-validation.test.ts` | Retained privacy projections; corrected provenance |

All six crosswalks are equivalent. The accepted R2 evidence supports one
runtime portability correction (DEC-012 reducer locality) and documentation,
manifest, test-expectation, and Node-engine corrections. It does not authorize
production integration or final assembly.

# Canonical Decision Record

Status: **approved as a reconciliation plan, blocked for final assembly**.

The Session 1 contracts remain the initial canonical Study Engine v1 boundary. The actual Tutor Core v0.2 remains authoritative for its instructional and safety domains, but it was unavailable; every Core-derived mapping therefore remains unapproved. Session 2 retains pacing authority after mapping, Session 3 retains Study-UX/accessibility authority, and Session 4 retains calendar/review/parent/Romeo projection authority.

## Decisions

| ID | Topic | Exact decision | Classification |
|---|---|---|---|
| DEC-001 | Package IDs and versions | Logical packages are `manuel-academy.study-contracts@1.0.0`, `manuel-academy.study-engine.algorithms@1.0.0-wave1`, `manuel-academy.study-ux@0.1.0-prototype`, `manuel-academy.study-integrations@1.0.0-wave1`, and this audit `manuel-academy.study-reconciliation@0.5.0-blocked.1`. Wire version stays integer `1`. Tutor Core ID/version must come from its real manifest. | BLOCKER |
| DEC-002 | Stable opaque IDs | Use Session 1’s 1–128-character byte-preserving ID boundary. Never lowercase, Unicode-normalize, re-spell, or derive IDs from array positions. Use reversible external-reference tables for incompatible provider IDs. | SAFE ADAPTER |
| DEC-003 | Grade | Persist `elementary-3-5`, `middle-6-8`, or `high-9-12`. Session 2 values map at its boundary. Exact learner grade and content applicability require typed namespaced metadata; UX display ranges never choose a learner band. | SAFE ADAPTER / required typed metadata |
| DEC-004 | Subject, skill, task | `LessonStudyPlan.subjectId` and Core/plan `SkillId` are canonical. A task instance is `LessonSegment.id`; `StudyTaskType` is its category—no parallel `TaskId`. Display subject/course text is not an ID. | SAFE ADAPTER; skill binding blocked |
| DEC-005 | Session state/events | Persist only Session 1’s eight states and kebab-case events. Session 2 phases, Session 3 screens/intents, and Session 4 audit events remain runtime/projection coordinates. Use one explicit transition reducer. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-006 | Version/idempotency | Embedded events inherit `StudySession.schemaVersion=1`. Standalone commands use a versioned envelope, stable idempotency key, expected revision, and atomic sequence allocation. Same key/same canonical bytes is a no-op; same key/different bytes quarantines. | SAFE ADAPTER |
| DEC-007 | Segment/resume | Render real plan segment IDs. Canonical resume remains `{segmentId, elapsedActiveSecondsInSegment, responseDraftRef}` plus a versioned UX/runtime checkpoint behind opaque references. Raw drafts stay in a device-local vault. | REQUIRED; Core item/substep fields blocked |
| DEC-008 | Timer/break | Split timer into visibility (`shown|minimal|hidden`) and metric (`count-up|count-down|progress-bar|milestones-only`). Keep break activity type orthogonal to reason category. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-009 | Learning evidence | Session 1 `LearningEvidence` is canonical. Map counts/categories only losslessly; pacing duration/disruption is not mastery evidence. No raw answer or transcript. | SAFE ADAPTER |
| DEC-010 | Mastery/prerequisite | Never infer mastery/prerequisite/misconception/uncertainty from `correct`, `successful`, score, or a boolean. Only the verified Core bridge may project them. | BLOCKER |
| DEC-011 | Recommendations | Separate engine disposition from lifecycle. Lifecycle is `proposed|accepted|rejected|superseded|expired`; insufficient data changes nothing; manual review creates an adult request. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-012 | Controls/precedence | Replace the proposed linear winner chain with version/integrity/authorization gates, multidimensional constraint intersection, then candidate selection and clamping. | REQUIRED; current cap bug is BLOCKER |
| DEC-013 | Accessibility/accommodations | Controls are authorization source; focus and UX are projections keyed by the same `AccommodationId`. Use typed requiredness/effects. Never parse free-form descriptions into constraints. | BLOCKER |
| DEC-014 | Review/retry | Map Session 2 days to Session 1 named intervals; other approved positive days use custom. Same-day is the learner-local date, never immediate. Failure requires support plus a break/session boundary; no time is invented without an authorized policy. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-015 | Time zone/local date | One authorized household IANA zone is the source of truth. Snapshot it with records, derive local dates from offset instants plus that zone, add calendar days, and never rewrite history after a zone change. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-016 | Calendar mapping | Lesson block sources plan/student/segment/timing; review block sources `ReviewId`; preserve offset instant, zone, intended local date, revision, and source links. Unmapped task types require an explicit block type. | SAFE ADAPTER |
| DEC-017 | Review queue | Core result/evidence → Session 2 scheduler → `StudentSkillReview` revision → queue occurrence → calendar → review session/evidence → Core result → scheduler → complete occurrence. Add a result-return command/outbox. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-018 | Romeo | Normalize versioned credential-free metadata only. `supportStudyPlanId` is typed; progress domains remain separate. Keep `dueDate` as a date and use a host `launchRef`, not an arbitrary URI. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-019 | Adult-private notes | Bodies live only in the private repository. Controls/logs/dashboard/diagnostics contain references, category, time, and audience-safe aggregates. Preserve `parent-only` without widening. | BLOCKER |
| DEC-020 | PII/answer/transcript | Student-safe boundaries allow opaque IDs/refs, enums, counts, ratios, timestamps, and allowlisted codes. Namespaced extension values are not an arbitrary-data escape hatch. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-021 | Validation/registry | Treat all boundary data as `unknown`; migrate, select registered kind, validate, and return Session 1 `ValidationResult`. Add registry data-class/audience capability. | SAFE ADAPTER with required audience change |
| DEC-022 | Persistence/append-only | Host sidecar uses stable aggregate keys, optimistic revision, append-only ledgers, and an outbox. Private records use a separate store. | REQUIRED BEFORE FINAL ASSEMBLY; production storage deferred |
| DEC-023 | Functional sidecar | Use compare-and-swap/functional updates, never whole-profile replacement. Calendar dedupe is a projection identity, not aggregate concurrency control. | SAFE ADAPTER |
| DEC-024 | Quarantine | Preserve unsupported/corrupt bytes with fixed disposition, version/kind, timestamp, hash/ref. No empty reset, coercion, payload logging, or future-version acceptance. | REQUIRED BEFORE FINAL ASSEMBLY |
| DEC-025 | Node/browser dependencies | Keep contracts/algorithms dependency-free ES2022; isolate React/Vite/jsdom/Axe/Playwright to browser/test packages; use plain JSON at Core seam pending its manifest. | SAFE ADAPTER |
| DEC-026 | Change requests | Use nine consolidated requests in `core-change-requests.v1.json`; do not open duplicates for the same host capability. | DOCUMENTATION ONLY |

## Approved precedence

The proposed chain is **replaced**, because required accommodations are multidimensional constraints rather than one scalar winner.

1. Reject unsupported version, failed integrity/idempotency, or unauthorized actor.
2. Apply non-overridable safety vetoes and constraints.
3. Compose all required accommodation obligations and bounds.
4. Apply the most restrictive active authorized adult hard maximum.
5. Compute the feasible interval. If empty, return `manual-review` and no automatic target.
6. Choose an active, unexpired, revision-valid manual target/hold/reduction; otherwise an accepted evidence-sufficient engine recommendation; otherwise the established target; otherwise the grade-band default.
7. Clamp the candidate to the feasible interval and record every constraint and provenance.

Maximums use the lowest maximum; required minimums use the highest minimum; feature supports are combined. A safety/accommodation conflict, incompatible schedule constraints, or concurrent stale adult overrides stops automation. A rejected recommendation suppresses only its own `RecommendationId`. Acceptance records a decision and never directly rewrites a hard maximum.

The full structured decisions are in [`canonical-decisions.v1.json`](../../reconciliation/canonical-decisions.v1.json).


# Provisional-Adapter Retirement Plan

This is a plan only. No adapter is removed or integrated in Session 5.

## Universal retirement gate

An adapter may retire only when:

1. Both old and proposed boundaries are versioned and hash/inventory evidence is recorded.
2. A loss-aware mapping table is exhaustive, including unknown/future values.
3. Golden parity fixtures and adversarial privacy/version/replay tests pass.
4. Unsupported or lossy inputs quarantine rather than default or reset.
5. The new projection can be replayed deterministically from canonical sources.
6. A rollback reader remains available for one compatibility window.
7. Owners for every changed authority approve the transition.

## Adapter inventory

| Adapter | Current provisional responsibility | Replacement | Retirement blockers |
|---|---|---|---|
| S2 contract version/grade/ID adapter | Narrows IDs, maps provisional bands, accepts provisional version strings | Session 1 ID/grade/schema gate | Typed exact-grade metadata; version quarantine |
| S2 orchestrator state/event adapter | Emits snake-case events and runtime phases | Canonical command handler/reducer; S2 phase remains runtime-only | Transition table; command idempotency/CAS; parity traces |
| S2 Core instruction outcome adapter | Guesses `correct|reteach`; drops misconception detail | Verified Tutor Core v0.2 bridge with opaque outcome ref | Actual package; TC-P00–P19 |
| S2 evidence/focus adapter | Converts provisional measures and pacing outcomes | Loss-aware `LearningEvidence` projection plus pacing sidecar | Core semantics; cap-before-hold fix; allowlisted state |
| S2 review scheduler adapter | Outputs days and guessed Core outcomes | Keep algorithm; map days to `StudentSkillReview` wire and typed Core basis | Retry-not-before policy; Core priority/basis |
| S3 fixture segment adapter | Six fixed UI slugs | Plan-driven `LessonSegment.id` and task type | Production subject/skill/segment binding |
| S3 UI event adapter | Local screen/intent events | Versioned commands mapped to S1 events; UX-only state stays checkpoint-local | Exact-resume schema; canonical reducer |
| S3 workspace persistence | Whole workspace in localStorage; resets unsupported version | Canonical refs/checkpoint + device-local draft vault + quarantine | Migration/export/recovery tests; privacy fuzzing |
| S3 accessibility adapter | Partial preference set and timer modes | Typed accommodation projection and two-axis timer | Requiredness/effects; Core media/input fields |
| S4 calendar schema adapter | Provisional block/audit schema | Idempotent projection from plan/review with source links | Shared IANA context; explicit block type for ambiguous tasks |
| S4 review queue adapter | Creates/defers queue items | Stable review occurrence and result-return saga | Completion API/outbox; Core kind/priority |
| S4 parent-control reducer | Whole-state reducer, note bodies, non-idempotent log | Versioned commands, CAS projection, separate private repository | Private/audience blockers; hard-cap semantics |
| S4 Romeo adapter | Credential-key scan, arbitrary URI, untyped support | Versioned metadata-only DTO, host launch ref, typed StudyPlan link | Security review; value scanning; version quarantine |

## Staged retirement sequence

### R0 — Evidence gate

- Attach and hash the actual Tutor Core v0.2 package.
- Freeze verified Wave 1 hashes and this decision set.
- Resolve all `BLOCKER` issues. No adapter is retired at R0.

### R1 — Canonical boundary scaffolding

- Add versioned command envelopes, stable idempotency keys, expected revisions, transition reducer, registry audience metadata, and quarantine.
- Keep every provisional adapter behind a dual-read/compare harness.

### R2 — Tutor Core sidecar

- Implement the dependency-neutral JSON protocol only after TC-P00–TC-P19 pass.
- Dual-run old guessed adapter and verified bridge on fixtures; never display or persist guessed output.
- Retire guessed Core enum handling only after exhaustive mapping and privacy/safety approval.

### R3 — Engine and UX

- Retain Session 2 algorithms but replace provisional contracts with canonical inputs/outputs.
- Replace fixture segment slugs with plan IDs.
- Split device-local draft/transcript data from canonical resume.
- Apply typed accessibility/accommodation projection.

### R4 — Integration projections

- Project calendar/review/parent/Romeo records from canonical aggregates and verified Core directives.
- Add result-return/outbox and adult-private store boundary.
- Keep projection rebuild and rollback capability.

### R5 — Removal window

- After one compatibility window with zero mismatches, remove unused provisional readers and enum copies.
- Preserve historical-version quarantine/migration readers.
- Update package manifests and dependency lock only in an authorized final-assembly session.

No step in this document authorizes R1–R5 to begin.


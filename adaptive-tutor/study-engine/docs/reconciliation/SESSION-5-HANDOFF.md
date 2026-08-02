# SESSION 5 — STUDY-RECON-AUDIT HANDOFF

Status: **Wave 2 reconciliation audit complete; final assembly BLOCKED and not authorized.**

## Integrity

All four required Wave 1 ZIPs passed SHA-256 verification and archive-safety inspection:

- `CARD-1-STUDY-CONTRACTS.zip` — `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41`
- Session 2 Study Engine — `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770`
- Session 3 Study UX — `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11`
- Session 4 Study Integrations — `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B`

All 230 archived files are byte-identical to their on-disk Wave 1 counterparts. No archive path/traversal/duplicate/symlink/reserved-name hazard was found.

The actual Manuel Academy Adaptive Tutor Core v0.2 package was not accessible after workspace, attachment, user-library, Git, manifest, lockfile, and Wave ZIP searches. Legacy `src/tutor/**` and handoff summaries were explicitly rejected as substitutes. Consequently its ID, exact version, hash, exports, dependencies, mastery/misconception/prerequisite/uncertainty types, tutoring-safety commands, board commands, spoken turns, captions, transcripts, adult-review evidence, and review directives remain **UNVERIFIED**.

## Reconciled decisions

- Session 1 remains the canonical Study Engine v1 wire/persistence boundary.
- Persist only Session 1 state and event vocabulary. Session 2 phases/events and Session 3 UI events are adapter-local; Session 4 audit events are projection-local.
- Events inherit aggregate schema v1; standalone commands carry a version, idempotency key, expected revision, and atomic contiguous event range. Replay is a no-op; conflicting replay quarantines.
- IDs are opaque and byte-preserving. `LessonSegment.id` is the task-instance ID; no duplicate `TaskId`.
- Canonical resume is `segmentId + elapsed active seconds + responseDraftRef`, with a versioned ref-only UX/runtime checkpoint. Raw drafts/transcripts remain outside canonical storage.
- Timer is reconciled as visibility plus metric. Break activity type and reason category remain orthogonal.
- Session 1 evidence is canonical; no score/correct/success boolean can establish mastery or prerequisites.
- Review pacing remains Session 2 authority, mapped to Session 1 0/1/3/7/14/30/custom wire intervals. Same-day is not immediate and requires support plus a break/session boundary; no retry time is invented.
- Controls authorize accommodations; focus/UX are read-only projections keyed by the same ID. Requiredness and machine effects must be typed.
- Precedence is version/integrity/authorization gate → safety constraints → required accommodation constraints → most restrictive adult hard maximum → feasible-interval check → current valid manual target/hold/reduce → accepted engine recommendation → established target → grade default → clamp with provenance. Infeasible constraints yield manual review.
- Recommendation acceptance/rejection is separate from changing hard controls; rejection applies only to its RecommendationId.
- One authorized household IANA zone supplies learner-local dates and is snapshotted with records.
- Review queue and calendar are idempotent projections of canonical `StudentSkillReview`; a missing result-return/outbox seam must be added.
- Romeo accepts only versioned credential-free metadata, keeps `dueDate` as a date, uses a host launch reference, and links tutoring support with a typed `StudyPlanId`.
- Private note bodies live only in an audience-aware adult-private repository. Ordinary controls, logs, dashboards, diagnostics, and analytics hold references/aggregates only.
- Namespaced metadata values, free-text detail/reason fields, review titles, parent evidence text, and state spreads are not trusted data channels; require allowlists/catalogs.
- Unsupported/corrupt/future versions quarantine unchanged with fixed diagnostics and a payload hash/ref. Never reset to empty or restamp current.
- Node-only algorithms/contracts and browser React UX remain dependency-isolated through a versioned plain-JSON sidecar until the real Core manifest is verified.

## Blocking issues

1. Actual Tutor Core v0.2 artifact and all Core-derived mappings.
2. Canonical SkillId/Core item binding for production Study UX.
3. Typed required-accommodation effects and the Session 2 cap-before-hold defect.
4. Adult-private body duplication, parent-only audience mismatch, and recommendation acceptance mutating hard limits.
5. Core-safe learner rendering, board/spoken/caption/transcript/adult-review bridge.
6. Exact resume checkpoint, registry audience capability, extension/state allowlists, and unsupported-version quarantine across S2/S3/S4.
7. Review result-return/outbox and same-day retry-not-before policy.
8. Romeo arbitrary URI/credential-value boundary and due-date projection.

All remaining issues are classified in the included register as `BLOCKER`, `REQUIRED BEFORE FINAL ASSEMBLY`, `SAFE ADAPTER`, `DOCUMENTATION ONLY`, or `DEFERRED PRODUCTION CONCERN`.

## Validation

- Reconciliation probes: 7/7 PASS
- Reconciliation tests: 19/19 PASS
- Session 1: typecheck PASS; 116/116 tests PASS
- Session 2: typecheck PASS; 325/325 tests PASS
- Session 3: typecheck PASS; 25/25 tests PASS
- Session 4: 55/55 tests PASS
- Tutor Core compatibility: 0/20 NOT RUN because the actual package is missing

## Deliverables

The ZIP includes the artifact/hash report, ownership report, 26-decision canonical record, detailed field diff, enum/event tables, Tutor Core matrix and probes, adapter retirement plan, nine deduplicated core-change requests, merge-order plan, classified issue list, reconciliation manifest, fourteen machine-readable traces, executable probes, automated tests, validation report, and this handoff.

Download: [CARD-5-STUDY-RECON-AUDIT.zip](artifacts/CARD-5-STUDY-RECON-AUDIT.zip)

The dispatch message should include the externally computed ZIP SHA-256 beside this link; an archive cannot embed its own stable hash.

## Next authorized action

Attach the actual Tutor Core v0.2 package and its expected hash to the Manuel Academy Project. Reopen this audit, run TC-P00 through TC-P19, replace every `UNVERIFIED` Core cell with evidence-backed mappings, resolve blockers, and rerun the fourteen traces. Do not begin production integration or final assembly.

SESSION 5 — STUDY-RECON-AUDIT HANDOFF


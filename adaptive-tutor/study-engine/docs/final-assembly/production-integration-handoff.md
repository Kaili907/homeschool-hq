# Production-integration handoff

This package is ready for a separately approved production-integration phase. It is not deployed and does not include production persistence.

## Package and adapters

- Import only the controlled Session 9 runtime entry points in `study-engine/runtime`.
- Add authenticated student launch/resume and runtime-health routes.
- Wire the student profile to opaque student/household IDs, grade band, approved accommodations, and accessibility preferences.
- Wire learner calendar reads/writes through Session 8 placement and continuation ports.
- Wire the parent dashboard only to minimized parent evidence and authorized controls.
- Wire Jarvis presentation to Session 7 projections; never give it mastery or safety authority.
- Inject a reviewed production safety classifier that may escalate but cannot downgrade reviewed signals.

## Persistence and authorization

Create migrations/tables for accepted Tutor events, event uniqueness digests, checkpoints/revisions, outbox proposals/delivery attempts, review queue/results, calendar placements/continuations, parent decision records/history, adult-private review records, and Romeo metadata. Store household IANA timezone explicitly.

Apply RLS/authorization by learner, household, authorized adult, staff role, and adult-private classification. Adult-private note bodies must be physically and logically separate from student/parent projections. Enforce atomic uniqueness on event, outbox, review, calendar, and continuation idempotency keys. Encrypt protected drafts/state and sensitive adult records.

## Operations

Add audit logs that exclude raw answers/disclosures, metrics for quarantine/safety/manual-review/outbox retry, alerting for classifier/ledger/persistence failure, dependency/security review, backup/restore tests, accessibility regression gates, staged deployment, and rollback to the previous application version plus reversible migrations.

Before release: complete threat modeling, privacy/child-safety review, migration review, RLS penetration tests, secret scanning, production classifier validation, load testing, monitoring rehearsal, deployment approval, and rollback rehearsal.

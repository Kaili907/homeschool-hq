# Database integration handoff

Session 13 delivers a local, additive, default-deny persistence boundary on
branch `integrate/study-engine-persistence-rls`, based exactly on
`74e2c21fe3bbf9c0ec270610fe71101ae5abd60a`.

## Delivered boundary

- Two new ordered migrations: storage first, authorization second.
- Nine forced-RLS public tables and seven forced-RLS private tables.
- Explicit public-table command coverage and no private browser policies/grants.
- Guardian and signed-student projections bound to the existing Academy
  relationship and private session-grant models.
- Optimistic revision/CAS, stable mutation receipts, append-only event/audit
  ledgers, collision detection, canonical timezone/DST checks, encrypted
  adult-private storage, scoped retention erasure, and a server-only outbox.
- Eight host-facing TypeScript ports with Supabase adapters; no Session 12 UI
  consumer is changed.
- Synthetic two-household SQL fixtures, adversarial role probes, catalog tests,
  and migration byte/order tests.

## Reconciliation decision

The local Study contract is suitable for reconciliation, subject to the
conditions in `README.md`: hosted drift and role behavior remain unverified;
student JWT issuance must be implemented by a trusted gateway; staff access is
deferred because no approved staff identity relationship exists; and Session
12/14 consumers remain unwired.

Use `hosted-preflight.md` in a later explicitly authorized session. Do not
merge, push, deploy, link a project, or apply hosted migrations from this
handoff.

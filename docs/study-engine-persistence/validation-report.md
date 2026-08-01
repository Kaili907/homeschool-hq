# Session 13 local validation report

Date: 2026-08-01

Runtime: Node 22.23.2, npm 10.9.8

Base: `74e2c21fe3bbf9c0ec270610fe71101ae5abd60a`

Hosted actions: none

## Passing gates

| Gate | Result |
|---|---|
| Clean lockfile install | PASS, 145 packages |
| Dependency tree | PASS, `npm ls --depth=0` |
| Study migration safety | PASS, 5/5 |
| Study database/RLS/adversarial | PASS, 10/10 |
| Host regression | PASS, 46 files / 781 tests |
| Academy identity and RLS | PASS, 13/13 |
| Academy foundation integration | PASS, 3/3 |
| Academy safe-sync CAS (PGlite) | PASS, 23/23 |
| Academy base targeted RLS contract | PASS, 1/1 selected |
| TypeScript | PASS, `tsc --noEmit` |
| Production build | PASS, 193 modules |
| Whitespace check | PASS, `git diff --check` |

The production build retained the existing non-fatal warning for a JavaScript
chunk larger than 500 kB.

## Study executable coverage

- Catalog: all 16 Study tables have enabled and forced RLS; all nine public
  tables have SELECT plus explicit INSERT/UPDATE/DELETE policy coverage (36
  policies); private browser table grants are zero.
- Personas: anonymous, Household A/B guardians, Student A/B signed grants,
  inactive member, viewer, guardian lacking learner access, learning manager,
  and trusted server context.
- Isolation: cross-household reads and definer calls, forged record IDs, wrong
  learner retention target, inactive/missing permission, and student claim
  fallback to guardian identity.
- Mutation safety: direct writes denied, null/stale revisions rejected,
  checkpoint CAS/replay/collision/quarantine, server integrity digest, event
  replay/collision/audit, and idempotent adult-managed writes.
- Adult-private: no direct table access, student/viewer/other-household body
  denial, audited body access without body/ciphertext in metadata, envelope
  constraints, and expiry-scoped crypto erasure.
- Delivery: service-only proposal/outbox execution, authorized recipient
  household/membership binding, invalid transition denial, monotonic
  pending-to-leased-to-delivered flow, and no browser SELECT.
- Time: canonical IANA snapshot, intended local date, DST overlap explicit
  offset acceptance, and DST gap/wrong-offset rejection.
- Migration safety: historical SHA-256 pins, exact timestamp order, clean fresh
  apply, pre-existing function collision refusal without replacement, and full
  transaction rollback after a late index-name conflict.

## Environment-limited gates

The full legacy `academy-profiles-base.db.test.ts` file expands to 55 PGlite
cases. In this nested worktree it exceeded a 608-second outer command limit
without emitting a failed assertion. A targeted foundational contract/RLS case
then passed in 27.2 seconds. The historical base bytes are unchanged and are
also pinned by the passing Study migration suite, but the other 54 base cases
were not completed in this run.

The independent embedded-PostgreSQL CAS suite was attempted twice. Both times
Windows failed before server startup with
`uv_os_get_passwd returned ENOMEM (not enough memory)`; Vitest reported the
suite failed with all four tests skipped. The PGlite CAS suite passed 23/23.
This is an infrastructure limitation, not a database assertion failure, and it
must be rerun on a host able to start embedded PostgreSQL.

Final executed assertions across the reported passing suites: 836 passed, zero
failed. Infrastructure outcomes: one incomplete legacy base-file run and one
embedded-PostgreSQL suite unavailable (four skipped).

## Decision

**PASS WITH CONDITIONS.** The local Study persistence/RLS contract is ready for
reconciliation. Before activation, complete the full legacy base suite and
embedded-PostgreSQL CAS suite in a healthy environment, then perform the later
authorized hosted preflight and hosted role probes. Student JWT issuance, an
approved staff authorization model, UI wiring, classifier behavior, delivery
behavior, merge, push, deployment, and hosted migration application remain out
of scope and undone.

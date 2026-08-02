# Validation Report

Required runtime: Node 22.23.2. All tests use synthetic identities, recipients,
safety events, and provider results. No hosted endpoint or provider is called.

Validated during implementation on Node 22.23.2:

- Root TypeScript typecheck: pass.
- Focused recipient, provider, outbox, lease/recovery, attempt/receipt,
  indeterminate, duplicate-delivery, rate-limit, worker, readiness, privacy,
  retention, and monitoring suite: 9 files, 58/58 tests passed.
- Session 14 safety/adult-review compatibility: 6 files, 115/115 passed.
- Session 13 Study database/RLS: 10/10 passed.
- Session 17 embedded-Postgres migration, end-to-end in-app flow, durable
  monitoring, and retention purge: 7/7 passed.
- Academy database chain: 98/98 passed (55 profiles base, 13 identity,
  3 foundation integration, 23 CAS, 4 Postgres CAS).
- Migration applies after Sessions 13–15 with security-definer `search_path`,
  grant, forced-RLS, monitoring, and retention assertions: pass.
- Production build: pass; 201 modules transformed. The pre-existing large-chunk
  advisory remains a warning.
- Production dependency audit: pass; 0 vulnerabilities.
- Secret-literal, raw-log, browser/server-boundary, and frozen-path scans: pass.

Known non-Session-17 failures:

- Root host suite: 77/79 files and 1,066/1,068 tests passed. Two untouched
  local-development calendar tests fail reproducibly with
  `CalendarRuntimeError: event_out_of_order` after the runtime date boundary.
- Migration-order suite: 4/5 passed. The only failure is the host-owned
  hard-coded six-filename expectation, which does not yet include the reserved
  Session 17 migration.

Neither failing area is modified by this branch, and both are described in
[Remaining blockers](./remaining-blockers.md). Assertions were not weakened.

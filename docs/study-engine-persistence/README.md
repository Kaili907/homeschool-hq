# Study Engine persistence integration handoff

This directory describes the Session 13 database boundary for Manuel Academy.
The work is local-only and additive. It does not activate a UI, issue student
JWTs, send adult-review notifications, or apply anything to hosted Supabase.

## Integration order

1. Reconcile from base `74e2c21fe3bbf9c0ec270610fe71101ae5abd60a`.
2. Preserve every historical migration byte-for-byte.
3. In a later authorized environment, complete `hosted-preflight.md`.
4. Apply `20260801010000_academy_study_engine_storage.sql`.
5. Apply `20260801011000_academy_study_engine_authorization.sql`.
6. Run the hosted role and two-household probes before enabling any consumer.
7. Wire Session 12/14 code to the ports only after the database contract is
   reconciled.

Both migrations are one transaction, require owner `postgres`, verify the
Academy identity foundation marker and ACLs, and reject unmarked object
collisions. The authorization migration requires the storage marker at version
1 and advances it to authorization version 1.

## Trust boundaries

- Browser tables are forced-RLS. Authenticated clients receive SELECT only;
  INSERT, UPDATE, and DELETE have explicit deny policies.
- Browser mutations use narrowly granted security-definer RPCs. They resolve
  household scope from stored learner/session records and `auth.uid()`.
- Student access requires a signed JWT whose `sub` is the current private
  session-grant UUID and whose `academy_principal_kind` claim is
  `student_session_grant`. The claim mode cannot fall back to guardian access.
- Adult-private bodies are reached only through audited projection RPCs.
- Proposals, outbox state, delivery details, and retention deletion are
  service-role-only RPCs and have no browser table grants.
- No service-role key or credential exists in the TypeScript adapters.

The signed student JWT is a verification boundary, not an issuance
implementation. A trusted issuer must mint the claim after validating the
existing Academy student credential/session-grant flow. Until that issuer and
hosted JWT behavior are verified, student browser activation remains disabled.

## TypeScript boundary

Contracts live under `src/study/contracts/persistence`; Supabase adapters live
under `src/study/persistence`; the generated RPC-name surface and database
contract live under `src/study/generated` and `src/study/database`.

The adapters provide:

- persistence/session lifecycle;
- checkpoint compare-and-swap and retry receipts;
- append-only accepted events;
- review and calendar writes;
- parent settings/effective-settings projection;
- encrypted protected-work and adult-note projections;
- trusted-server proposal/outbox operations.

All browser adapters require an authenticated Supabase session before calling
an RPC and normalize database failures into structured Study persistence error
codes. The outbox adapter accepts a server-scoped client but never constructs or
stores credentials.

## Known conditions

- Hosted project identity, drift, extensions, PostgREST exposed schemas,
  function ownership, JWT claim forwarding, and service-role behavior are not
  verified in this session.
- The current identity foundation has guardian permission levels but no
  approved staff relationship. Adult-note functions therefore admit active
  learning managers only; staff access is fail-closed until a separate staff
  authorization model is approved.
- Classifier and delivery behavior belong to Session 14. This session stores a
  minimized proposal and outbox transition state only.
- Checkpoint integration with Session 12 is a later reconciliation task; no UI
  or tutor code was changed here.

See `rls-matrix.md`, `schema.md`, `retention-matrix.md`,
`migration-and-rollback.md`, `hosted-preflight.md`, and
`validation-report.md` for the executable contract and operational gates.

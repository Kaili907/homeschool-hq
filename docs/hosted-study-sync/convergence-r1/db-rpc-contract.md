# DB and RPC contract

## Browser RPCs

- `public.academy_study_sync_hydrate_v1(uuid,text,text)`
- `public.academy_study_sync_write_v1(text,uuid,text,text,bigint,uuid,text,jsonb)`

The client sends exact PostgREST argument names and accepts only exact,
identity-bound response shapes. The Study session reference stays in memory;
its SHA-256 digest is calculated per write call and never stored. The browser
uses authenticated user headers plus a public client key only.

## Supported writes

- `checkpoint:compare-and-swap`
- `safety:stop`
- `safety:clear` (guardian only)
- `guardian-attestation:attest` (guardian only)

## Local validation

PGlite applied the full dependency migration chain plus both new authority
migrations. Seven DB tests passed: ACL/RLS shape, verifier overloads, household
and sibling isolation, exact binding, CAS/idempotency, guardian-only authority,
minimized hydrate, and revocation.

`rpcSqlContract.test.ts` independently pins the TypeScript client argument
names and function names to the SQL signatures so drift fails without a hosted
database.

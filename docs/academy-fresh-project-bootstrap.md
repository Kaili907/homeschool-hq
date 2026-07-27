# Academy fresh-project bootstrap

## Scope

This document defines the database-only base required before the Academy
student-identity and household-CAS migrations. It does not provision users,
identity objects, CAS objects, fixtures, storage, Edge Functions, Netlify,
Lovable, or application configuration.

The deployment source of truth is:

```text
supabase/migrations/20260724074106_academy_profiles_base.sql
```

The timestamp is the UTC timestamp of the original `supabase/schema.sql`
introduction (`2026-07-24T07:41:06Z`). It is unique across the inspected
migration refs and sorts before `20260724230000` and `20260726120000`.

## Exact `public.profiles` contract

| Position | Column | Type | Nullability | Default |
| --- | --- | --- | --- | --- |
| 1 | `household_id` | `uuid` | `NOT NULL` | `auth.uid()` |
| 2 | `profile_id` | `text` | `NOT NULL` | none |
| 3 | `data` | `jsonb` | `NOT NULL` | none |
| 4 | `updated_at` | `timestamptz` | `NOT NULL` | `now()` |

Catalog requirements:

- regular permanent table in schema `public`;
- owner `postgres`;
- primary key `profiles_pkey (household_id, profile_id)`;
- foreign key `profiles_household_id_fkey` to `auth.users(id)`;
- foreign-key update action `NO ACTION`;
- foreign-key delete action `CASCADE`;
- nondeferrable, validated PK and FK;
- the primary-key B-tree is the only index;
- RLS enabled and not forced;
- no user triggers, including no automatic `updated_at` trigger;
- no extension dependency.

The application supplies `updated_at` during PostgREST upserts. The database
default applies only when a caller omits it.

## Policies

All four policies are permissive and apply to `PUBLIC`. Table ACLs, not broader
policy roles, deny anonymous access.

| Policy | Command | `USING` | `WITH CHECK` |
| --- | --- | --- | --- |
| `profiles_select_own` | `SELECT` | `household_id = auth.uid()` | none |
| `profiles_insert_own` | `INSERT` | none | `household_id = auth.uid()` |
| `profiles_update_own` | `UPDATE` | `household_id = auth.uid()` | `household_id = auth.uid()` |
| `profiles_delete_own` | `DELETE` | `household_id = auth.uid()` | none |

## Privileges and prerequisites

The table grants exactly `SELECT`, `INSERT`, `UPDATE`, and `DELETE` to
`authenticated`, without grant option. It grants no table privilege to
`PUBLIC`, `anon`, or `service_role`. The owner retains normal owner privileges.

The migration does not alter schema-wide ACLs. It verifies these standard
Supabase prerequisites and fails if they are absent:

- roles `anon`, `authenticated`, and `service_role`;
- `auth.users`;
- `auth.uid()`;
- `authenticated` and `anon` usage on `public` and `auth`;
- `authenticated` and `anon` execute privilege on `auth.uid()`.

## Collision, rerun, and preservation behavior

When `public.profiles` is absent, the migration refuses a conflicting
`public.profiles` composite type or `public.profiles_pkey` relation and then
creates the approved definition.

When `public.profiles` exists, the migration performs catalog assertions before
any mutation. Exact definitions pass without replacement. Drift in relation
kind, persistence, owner, columns, order, types, nullability, defaults,
constraints, FK actions, indexes, RLS, policy names/roles/expressions, ACLs, or
user triggers aborts the transaction.

The no-repair path preserves:

- table and index identity;
- valid profile JSON and timestamps;
- policy/index/constraint cardinality;
- unrelated schemas, relations, owners, and ACLs.

## `schema.sql` relationship

`supabase/schema.sql` remains a reference snapshot because existing isolated
identity and CAS test workflows consume it. It is not a second deployment
source. Changes to the base contract must update the timestamped migration,
reference snapshot, permanent database tests, and this document together.

## Validation

Permanent test:

```text
npm run test:academy-profiles-base
```

It covers:

- empty creation and exact catalog state;
- authenticated household isolation and anonymous denial;
- exact rerun stability and unrelated ACL sentinel preservation;
- exact legacy-snapshot verification with byte-equivalent JSON/timestamp rows;
- rejection of wrong type, nullability, default, PK, FK delete action, RLS,
  policy expression, missing/extra policy, owner, ACL, and index.

A disposable test also applied exact migration blobs in timestamp order:

1. base from this branch;
2. identity from `6138112bda3e395b02ae8d67a1da756f73cd28ed`;
3. safe-sync from `e5131729f7866553f6bedfd2ca0ec84f0b343126`.

The chain succeeded with correct owners, ACLs, RLS, private-schema isolation,
security-definer search paths, post-CAS direct-write revocation, and zero
synthetic fixtures.

Supabase CLI 2.109.1 was separately tested against an isolated PostgreSQL
process. A forced final-statement failure rolled back all earlier statements
and the failing ledger entry in that migration file. Repeating the probe with
the exact safe-sync SQL likewise left no partial CAS objects. The already
committed base migration remained present. The explicit local `--db-url`
workflow did not require `supabase/config.toml`, so none is added.

## Hosted boundary

No migration in this chain may be applied merely because the local bootstrap
tests pass. Hosted use requires:

- independent review of this branch;
- completion of the outstanding safe-sync reviews;
- integration of all three exact migrations into one reviewed branch;
- exact project identity and hosted migration-ledger preflight;
- non-mutating dry run showing only the intended chain;
- separately authorized backup, execution, and role/JWT/PostgREST probes.

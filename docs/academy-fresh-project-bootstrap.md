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

The migration validates but never alters schema-wide ACLs. The complete
effective schema-privilege contract is:

| Schema | `PUBLIC` | `anon` | `authenticated` | `service_role` | `postgres` |
| --- | --- | --- | --- | --- | --- |
| `public` | `USAGE` | `USAGE` | `USAGE` | `USAGE` | `CREATE`, `USAGE` |
| `auth` | none | `USAGE` | `USAGE` | `USAGE` | `CREATE`, `USAGE` |

`CREATE` and `USAGE` are PostgreSQL's complete schema privilege universe.
Each role entry is its effective set, not just its direct ACL entry:
PostgreSQL's catalog privilege resolver includes direct grants, inherited role
membership, ownership/superuser rights, and grants inherited through `PUBLIC`.
The `PUBLIC` row itself is derived from the expanded schema ACL. This detects a
direct or indirect unexpected `CREATE` grant to a browser role even when no
such grant appears under that role's own ACL entry.

Both missing and excess privileges abort before any `public.profiles` lookup or
DDL. `PUBLIC`, `anon`, `authenticated`, and `service_role` have no schema grant
options; grantable authority reached through an inherited role also aborts.
`postgres` retains normal owner/superuser authority. The migration does not
normalize, grant, or revoke schema privileges and does not reject unrelated ACL
entries needed by other platform-owner roles. `anon`, `authenticated`, and
`service_role` must additionally retain `EXECUTE` on `auth.uid()`.

Other prerequisites are roles `postgres`, `anon`, `authenticated`, and
`service_role`, plus `auth.users` and `auth.uid()`.

## Collision, rerun, and preservation behavior

Before inspecting `public.profiles`, the migration rejects any schema privilege
matrix mismatch without repairing it. When `public.profiles` is absent, it
refuses a conflicting
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
- exact effective schema ACL acceptance and rejection of missing `USAGE`,
  direct `CREATE`, role-inherited `CREATE`, `PUBLIC`-inherited `CREATE`, and
  direct/inherited schema grant options;
- rejection of wrong/missing/extra/reordered columns, PK/index, FK target/delete
  action, owner, table ACL, user trigger, disabled/forced RLS, and all policy
  command/role/`USING`/`WITH CHECK`/cardinality drift;
- proof that rejected schema drift leaves both `public.profiles` and the
  unexpected external grant untouched.

The same permanent test applies exact reviewed migration blobs in timestamp
order:

1. base from this branch;
2. identity from `6138112bda3e395b02ae8d67a1da756f73cd28ed`;
3. safe-sync from `e5131729f7866553f6bedfd2ca0ec84f0b343126`.

The test asserts the identity blob
`df4cc097ba72561d4182a138760e82c2730a5fac` and safe-sync blob
`c9aa82ddc7e9bd179107b50dfe6d87d9fbfa650f` before loading them. It fails if
either reviewed commit is absent or its path resolves to different content.
The chain verifies correct owners, ACLs, RLS, private-schema isolation,
security-definer search paths, pre-CAS authenticated CRUD, post-CAS
direct-write revocation, zero synthetic fixtures, and only the expected
identity metadata marker.

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

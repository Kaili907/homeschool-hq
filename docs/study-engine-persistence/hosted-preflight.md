# Hosted Supabase preflight (later authorized session)

Nothing in Session 13 connected to or changed hosted Supabase. Use this guide
only after the operator explicitly authorizes the exact project and maintenance
window.

## Stop gates

Stop before applying SQL unless all of the following are established:

1. The project reference, organization, environment, and database host are the
   intended Manuel Academy target—not inferred from a local `.env` alone.
2. A restorable backup and recovery owner are identified.
3. The hosted migration ledger is exported and reconciled with repository
   timestamps/checksums.
4. The identity foundation metadata is version 2 and its live security manifest,
   owner, ACLs, policies, functions, triggers, indexes, and constraints match the
   approved definition.
5. None of the new Study relation, function, policy, trigger, or index names
   already exists with an unowned definition.
6. Required roles, `auth.uid()`, `gen_random_uuid()`, SHA-256 support, IANA
   timezone catalog, and transactional DDL behave as expected.
7. `academy_private` is not exposed through PostgREST and browser roles have no
   schema usage or object grants.

## Object-definition comparison

Capture canonical catalog output for each dependency and candidate name:

- `pg_class`: owner, relkind, RLS and forced-RLS flags;
- `information_schema.columns`: type, nullability, default, identity;
- `pg_constraint` and `pg_get_constraintdef`;
- `pg_index` and `pg_get_indexdef`;
- `pg_proc`: identity arguments, owner, volatility, security-definer flag,
  configuration, ACL, and `pg_get_functiondef`;
- `pg_policy`: command, roles, `qual`, and `with_check`;
- `pg_trigger` and `pg_get_triggerdef`;
- schema/table/sequence/function ACLs and default privileges.

Normalize whitespace only for human review; compare checksums of the raw
historical migration files. A mismatch requires explanation and a new additive
repair plan. Do not overwrite a live object because its name looks familiar.

## Authorized apply and verification sequence

1. Put all Study consumers in an off state.
2. Run the storage migration as the approved migration owner.
3. Verify transaction completion, metadata version 1, object counts, ownership,
   RLS/forced-RLS flags, grants, and zero browser policies on private tables.
4. Run the authorization migration.
5. Verify metadata authorization version 1 and every function/policy definition.
6. Use synthetic Household A/B users in a non-production or approved staging
   project to run direct PostgREST-equivalent SELECT/write probes and RPC probes.
7. Verify the signed student claim is forwarded exactly and bound to a current
   private grant. Verify guardian-mode separation.
8. Verify service-role proposal/outbox/retention functions from a server-only
   environment and prove browser tokens cannot execute them.
9. Recheck logs and audit minimization; then obtain an explicit activation
   decision.

Never run `supabase db push`, `supabase migration up`, `supabase link`, or a
hosted `psql` command from the Session 13 worktree without that later approval.

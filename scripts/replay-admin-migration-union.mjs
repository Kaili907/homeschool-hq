#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(
  resolve(root, 'docs/study-engine-final-production/migration-manifest.json'),
  'utf8',
))
const migrations = manifest.migrations.map(({ version, filename }) => ({ version, filename }))

const expectedServiceGrantRevocations = new Map([
  ['20260801012000', new Set([
    'academy_study_create_adult_review_proposal',
    'academy_study_enqueue_outbox',
    'academy_study_outbox_status',
    'academy_study_transition_outbox',
  ])],
  ['20260801170000', new Set([
    'academy_study_claim_adult_review_proposals_v1',
    'academy_study_claim_delivery_jobs_v1',
    'academy_study_reauthorize_adult_route_v1',
    'academy_study_record_delivery_attempt_v1',
    'academy_study_record_delivery_outcome_v1',
    'academy_study_record_delivery_receipt_v1',
    'academy_study_record_recipient_resolution_v1',
    'academy_study_resolve_adult_recipients_v1',
  ])],
  ['20260810110000', new Set(['academy_admin_read_audit_events_v1'])],
])

const requiredFinalServiceRoutines = [
  'academy_reserve_provider_attempt_v1',
  'academy_transition_provider_attempt_v1',
  'academy_link_provider_attempt_ledger_v1',
  'academy_read_provider_attempt_coverage_v1',
  'academy_admin_list_curriculum_standard_reviews_v1',
  'academy_admin_update_curriculum_standard_review_v1',
  'academy_admin_read_curriculum_staging_v1',
  'academy_admin_read_curriculum_staging_integrity_v1',
  'academy_admin_stage_curriculum_release_v1',
  'academy_admin_read_curriculum_publication_v1',
  'academy_admin_publish_curriculum_release_v1',
  'academy_admin_read_curriculum_activation_v1',
  'academy_admin_transition_curriculum_pointer_v1',
  'academy_admin_read_incident_runtime_v1',
]

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  revoke all on schema auth from public;
  grant usage on schema auth to anon, authenticated, service_role;
  revoke all on function auth.uid() from public;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  revoke all on schema public from public, anon, authenticated, service_role;
  grant usage on schema public to public, anon, authenticated, service_role;
`

function sourceFor(entry) {
  return readFileSync(resolve(root, 'supabase/migrations', entry.filename), 'utf8')
}

async function directServiceGrants(database) {
  const result = await database.query(`
    with service as (
      select oid from pg_catalog.pg_roles where rolname = 'service_role'
    ), relation_grants as (
      select namespace.nspname || '.' || relation.relname || ':' || acl.privilege_type as grant_key
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      where acl.grantee = (select oid from service)
        and namespace.nspname in ('public', 'academy_private')
    ), routine_grants as (
      select namespace.nspname || '.' || routine.proname || '('
        || pg_catalog.pg_get_function_identity_arguments(routine.oid) || '):'
        || acl.privilege_type as grant_key
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      cross join lateral pg_catalog.aclexplode(routine.proacl) as acl
      where acl.grantee = (select oid from service)
        and namespace.nspname in ('public', 'academy_private')
    )
    select grant_key from relation_grants
    union all
    select grant_key from routine_grants
    order by grant_key
  `)
  return new Set(result.rows.map(({ grant_key: grantKey }) => grantKey))
}

function forcedTablesFrom(source) {
  return [...source.matchAll(/alter\s+table\s+(?:only\s+)?(?:public\.|academy_private\.)?([a-z0-9_]+)\s+force\s+row\s+level\s+security/gi)]
    .map((match) => match[1])
}

async function main() {
  const database = await PGlite.create()
  const requiredForcedTables = new Set()
  const intentionalServiceGrantRevocations = []
  const unexpectedServiceGrantRevocations = []
  let serviceGrants = new Set()
  try {
    await database.exec(bootstrap)
    serviceGrants = await directServiceGrants(database)
    for (const entry of migrations) {
      const source = sourceFor(entry)
      for (const table of forcedTablesFrom(source)) requiredForcedTables.add(table)
      await database.exec(source)
      const current = await directServiceGrants(database)
      for (const grant of serviceGrants) {
        if (!current.has(grant)) {
          const routineName = /^public\.([a-z0-9_]+)\(/.exec(grant)?.[1]
          const revoked = { version: entry.version, grant }
          if (routineName && expectedServiceGrantRevocations.get(entry.version)?.has(routineName)) {
            intentionalServiceGrantRevocations.push(revoked)
          } else {
            unexpectedServiceGrantRevocations.push(revoked)
          }
        }
      }
      serviceGrants = current
      process.stdout.write(`applied ${entry.version} ${entry.filename}\n`)
    }

    const rls = await database.query(`
      select namespace.nspname as schema_name, relation.relname as table_name,
        relation.relrowsecurity as rls_enabled, relation.relforcerowsecurity as rls_forced
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where relation.relkind in ('r', 'p')
        and namespace.nspname in ('public', 'academy_private')
      order by namespace.nspname, relation.relname
    `)
    const ownership = await database.query(`
      with owned_objects as (
        select namespace.nspname as schema_name, relation.relname as object_name,
          pg_catalog.pg_get_userbyid(relation.relowner) as owner_name, 'relation'::text as object_kind
        from pg_catalog.pg_class as relation
        join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
        where relation.relkind in ('r', 'p', 'v', 'm', 'S')
          and namespace.nspname in ('public', 'academy_private')
        union all
        select namespace.nspname, routine.proname,
          pg_catalog.pg_get_userbyid(routine.proowner), 'routine'
        from pg_catalog.pg_proc as routine
        join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
        where namespace.nspname in ('public', 'academy_private')
      )
      select * from owned_objects where owner_name <> 'postgres'
      order by schema_name, object_kind, object_name
    `)
    const missingForced = [...requiredForcedTables].filter((table) => !rls.rows.some(
      (row) => row.table_name === table && row.rls_enabled && row.rls_forced,
    ))
    const unforcedRls = rls.rows.filter((row) => row.rls_enabled && !row.rls_forced)
    const missingServiceRoutines = requiredFinalServiceRoutines.filter((routine) => (
      ![...serviceGrants].some((grant) => grant.startsWith(`public.${routine}(`))
    ))
    const summary = {
      appliedMigrations: migrations.length,
      requiredForcedTables: requiredForcedTables.size,
      missingForcedTables: missingForced,
      enabledButUnforcedTables: unforcedRls.map((row) => `${row.schema_name}.${row.table_name}`),
      unexpectedOwners: ownership.rows,
      directServiceGrantCount: serviceGrants.size,
      requiredFinalServiceRoutines: requiredFinalServiceRoutines.length,
      missingServiceRoutines,
      intentionalServiceGrantRevocations,
      unexpectedServiceGrantRevocations,
    }
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    if (missingForced.length || ownership.rows.length || missingServiceRoutines.length
      || unexpectedServiceGrantRevocations.length) process.exitCode = 1
  } finally {
    await database.close()
  }
}

await main()

#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { PGlite } from '@electric-sql/pglite'

const BASE = 'cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64'
const PROVIDER = '70701599e4d2689a472cfab22d6af2235862ad5a'
const CURRICULUM = 'd8ba41f0dde5e9f06203ca5a07b57cade9cf1803'
const RELEASES = '0e5a1278183ac560658c0bd24ea670c7ba5bae38'
const CORRELATION = '8faa9eb23bd55f1d37d83d17c784d851722a12cf'

const migration = (version, ref, filename) => ({
  version,
  ref,
  filename,
  repositoryPath: `supabase/migrations/${filename}`,
})

// Versions here are the collision-free order recommended by this audit. SQL
// bytes are always read from immutable source commits and are never rewritten.
const migrations = [
  ...[
    '20260724074106_academy_profiles_base.sql',
    '20260724230000_academy_student_identity_foundation.sql',
    '20260726120000_academy_household_revision_cas.sql',
    '20260731120000_academy_gateway_usage.sql',
    '20260801010000_academy_study_engine_storage.sql',
    '20260801011000_academy_study_engine_authorization.sql',
    '20260801012000_academy_study_engine_production_reconciliation.sql',
    '20260801160000_academy_study_verified_identity.sql',
    '20260801170000_academy_study_adult_review_operations.sql',
    '20260801190000_academy_study_final_production_reconciliation.sql',
    '20260808120000_academy_admin_authorization.sql',
    '20260808121000_academy_operational_events.sql',
    '20260808122000_academy_provider_usage_cost_ledger.sql',
    '20260808123000_academy_admin_safety_operations.sql',
    '20260809120000_academy_operational_telemetry_foundation.sql',
    '20260809130000_academy_admin_audit_foundation.sql',
    '20260809140000_academy_admin_configuration_core.sql',
    '20260809150000_academy_logical_voice_profile_contract.sql',
  ].map((filename) => migration(filename.slice(0, 14), BASE, filename)),
  migration('20260809160000', CURRICULUM, '20260809160000_academy_curriculum_release_registry.sql'),
  migration('20260809170000', CURRICULUM, '20260809170000_academy_admin_curriculum_audit_vocabulary.sql'),
  migration('20260810110000', BASE, '20260810120000_academy_admin_audit_query_filters.sql'),
  migration('20260810120000', CURRICULUM, '20260810120000_academy_curriculum_draft_authoring.sql'),
  migration('20260810130000', CURRICULUM, '20260810130000_academy_curriculum_standards_review.sql'),
  migration('20260810131000', PROVIDER, '20260810130000_academy_provider_attempt_journal.sql'),
  migration('20260810140000', CURRICULUM, '20260810140000_academy_curriculum_human_approval.sql'),
  migration('20260810141500', CURRICULUM, '20260810141500_academy_curriculum_draft_collaborators.sql'),
  migration('20260810144700', BASE, '20260810144700_academy_admin_access_management.sql'),
  migration('20260810150000', RELEASES, '20260810150000_academy_curriculum_release_staging.sql'),
  migration('20260810151000', PROVIDER, '20260810151000_academy_study_safety_provider_accounting.sql'),
  migration('20260810160000', RELEASES, '20260810160000_academy_curriculum_release_publishing.sql'),
  migration('20260810170000', RELEASES, '20260810170000_academy_curriculum_activation_rollback.sql'),
  migration('20260810180000', CORRELATION, '20260810180000_academy_admin_correlation_runtime_read.sql'),
]

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
  return execFileSync('git', ['show', `${entry.ref}:${entry.repositoryPath}`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
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
      process.stdout.write(`applied ${entry.version} ${entry.filename} @ ${entry.ref.slice(0, 12)}\n`)
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

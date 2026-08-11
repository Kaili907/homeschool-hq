#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'docs/study-engine-final-production/migration-manifest.json')
const migrationRoot = resolve(root, 'supabase/migrations')
const sandboxPath = '/usr/bin/sandbox-exec'
const networkDeniedSandbox = '(version 1) (allow default) (deny network*)'
const workerMarker = 'MANUEL_ACADEMY_ADMIN_UPGRADE_REHEARSAL_WORKER'

const firstAdminMigration = '20260808120000_academy_admin_authorization.sql'
const providerFoundationMigration = '20260808122000_academy_provider_usage_cost_ledger.sql'
const curriculumRegistryMigration = '20260809160000_academy_curriculum_release_registry.sql'
const failureInjectionMigration = '20260810151000_academy_study_safety_provider_accounting.sql'

const guardianA = '00000000-0000-4000-8000-0000000000a1'
const guardianB = '00000000-0000-4000-8000-0000000000b1'
const householdA = '00000000-0000-4000-8000-000000000011'
const householdB = '00000000-0000-4000-8000-000000000022'
const studentA = '00000000-0000-4000-8000-000000000101'
const studentB = '00000000-0000-4000-8000-000000000201'

const baselineDataRelations = [
  'auth.users',
  'public.profiles',
  'public.academy_households',
  'public.academy_household_memberships',
  'public.academy_students',
  'public.academy_guardian_student_access',
  'public.academy_subject_enrollments',
  'public.academy_audit_events',
  'public.academy_household_sync_state',
  'public.academy_household_sync_mutations',
  'public.academy_gateway_usage',
  'academy_private.student_access_credentials',
  'academy_private.student_session_grants',
  'public.academy_study_household_settings',
  'public.academy_study_sessions',
  'public.academy_study_parent_settings',
  'academy_private.study_persistence_metadata',
  'academy_private.study_production_policy',
]

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
  'academy_study_execute_verified_runtime_v1',
  'academy_study_final_production_readiness_v1',
]

const expectedTailServiceGrantRevocations = new Map([
  ['20260810110000', new Set(['academy_admin_read_audit_events_v1'])],
])

const linkedProjectMarkers = [
  'supabase/.temp/project-ref',
  'supabase/.branches/_current_branch',
  '.supabase/project-ref',
]

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth authorization postgres;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  revoke all on schema auth from public;
  grant usage on schema auth to anon, authenticated, service_role;
  revoke all on function auth.uid() from public;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  revoke all on schema public from public, anon, authenticated, service_role;
  grant usage on schema public to public, anon, authenticated, service_role;

  create schema supabase_migrations authorization postgres;
  create table supabase_migrations.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default statement_timestamp()
  );
`

const identityAndStudyFixtures = `
  insert into auth.users (id, email) values
    ('${guardianA}', 'guardian-a@local.invalid'),
    ('${guardianB}', 'guardian-b@local.invalid');

  insert into public.academy_households (
    id, name, status, created_by, created_at, updated_at
  ) values
    ('${householdA}', 'Synthetic Upgrade Household A', 'active', '${guardianA}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
    ('${householdB}', 'Synthetic Upgrade Household B', 'active', '${guardianB}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

  insert into public.academy_household_memberships (
    id, household_id, user_id, status, invited_at, activated_at, created_at, updated_at
  ) values
    ('00000000-0000-4000-8000-0000000000a2', '${householdA}', '${guardianA}', 'active',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
    ('00000000-0000-4000-8000-0000000000b2', '${householdB}', '${guardianB}', 'active',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

  insert into public.academy_students (
    id, household_id, legacy_profile_id, display_name, current_grade_level,
    lifecycle_status, lifecycle_changed_at, created_by, created_at, updated_at
  ) values
    ('${studentA}', '${householdA}', 'p1', 'Synthetic Upgrade Student A', '6',
      'active', '2026-08-01T12:00:00Z', '${guardianA}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
    ('${studentB}', '${householdB}', 'p1', 'Synthetic Upgrade Student B', '12',
      'active', '2026-08-01T12:00:00Z', '${guardianB}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

  insert into public.academy_guardian_student_access (
    id, household_id, student_id, membership_id, permission_level,
    status, granted_by, granted_at, created_at, updated_at
  ) values
    ('00000000-0000-4000-8000-0000000001a1', '${householdA}', '${studentA}',
      '00000000-0000-4000-8000-0000000000a2', 'identity_manager', 'active', '${guardianA}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
    ('00000000-0000-4000-8000-0000000001b1', '${householdB}', '${studentB}',
      '00000000-0000-4000-8000-0000000000b2', 'identity_manager', 'active', '${guardianB}',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

  insert into public.academy_subject_enrollments (
    household_id, student_id, school_year_key, subject_key, instructional_level,
    course_id, curriculum_version, enrollment_status, placement_source,
    created_at, updated_at
  ) values
    ('${householdA}', '${studentA}', '2026-2027', 'mathematics', 'grade-6',
      'mathematics-grade-6', '1.0.0', 'active', 'parent',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'),
    ('${householdB}', '${studentB}', '2026-2027', 'mathematics', 'grade-12',
      'mathematics-grade-12', '1.0.0', 'active', 'parent',
      '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z');

  insert into academy_private.student_access_credentials (
    id, household_id, student_id, credential_kind, credential_version,
    verifier_scheme, verifier_digest, status, created_actor_kind, created_by,
    creation_reason, correlation_id, created_at, updated_at
  ) values (
    '00000000-0000-4000-8000-000000009101', '${householdA}', '${studentA}',
    'pin', 1, 'argon2id',
    '$argon2id$v=19$m=65536,t=3,p=1$c3Nzc3Nzc3Nzc3Nzc3Nzcw$YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE',
    'active', 'guardian', '${guardianA}', 'Synthetic upgrade credential',
    '00000000-0000-4000-8000-00000000d101',
    '2026-08-01T12:00:00Z', '2026-08-01T12:00:00Z'
  );

  insert into academy_private.student_session_grants (
    id, household_id, student_id, token_digest, capabilities, credential_id,
    credential_version, session_version, issuance_flow, issued_actor_kind,
    issuance_reason, correlation_id, issued_at, expires_at
  ) select
    '00000000-0000-4000-8000-000000008101', student.household_id, student.id,
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    array['student:profile:read', 'student:assignments:read', 'student:attempts:create', 'student:progress:read'],
    '00000000-0000-4000-8000-000000009101', 1, student.session_version,
    'student_credential', 'trusted_server', 'Synthetic upgrade grant',
    '00000000-0000-4000-8000-00000000e101',
    '2026-08-01T12:00:00Z', '2026-08-01T16:00:00Z'
  from public.academy_students as student where student.id = '${studentA}';

  insert into public.academy_gateway_usage (user_id, day, endpoint, count) values
    ('${guardianA}', '2026-08-01', 'anthropic', 7),
    ('${guardianA}', '2026-08-01', 'tts', 3);

  insert into public.academy_study_household_settings (
    household_id, household_timezone, revision, updated_by, updated_at
  ) values
    ('${householdA}', 'America/Detroit', 4, '${guardianA}', '2026-08-01T12:00:00Z'),
    ('${householdB}', 'UTC', 2, '${guardianB}', '2026-08-01T12:00:00Z');

  insert into public.academy_study_sessions (
    id, household_id, student_id, lesson_id, subject_id, state, started_at,
    intended_local_date, household_timezone, created_by, created_at, updated_at, revision
  ) values
    ('upgrade-session-a', '${householdA}', '${studentA}', 'lesson-a', 'math', 'active',
      '2026-08-01T14:00:00Z', '2026-08-01', 'America/Detroit', '${guardianA}',
      '2026-08-01T14:00:00Z', '2026-08-01T14:30:00Z', 3),
    ('upgrade-session-b', '${householdB}', '${studentB}', 'lesson-b', 'reading', 'active',
      '2026-08-01T14:00:00Z', '2026-08-01', 'UTC', '${guardianB}',
      '2026-08-01T14:00:00Z', '2026-08-01T14:30:00Z', 2);

  insert into public.academy_study_parent_settings (
    household_id, student_id, parent_override, revision, updated_by, updated_at
  ) values
    ('${householdA}', '${studentA}', true, 5, '${guardianA}', '2026-08-01T12:00:00Z'),
    ('${householdB}', '${studentB}', false, 2, '${guardianB}', '2026-08-01T12:00:00Z');
`

function fail(message) {
  throw new Error(`OPERATOR STOP: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function sha256Normalized(source) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

function readManifest() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

function migrationSource(entry) {
  return readFileSync(resolve(migrationRoot, entry.filename), 'utf8')
}

function validateManifest(manifest) {
  const errors = []
  if (!Array.isArray(manifest.migrations) || manifest.migrations.length === 0) {
    return ['migration custody manifest is empty']
  }
  const names = new Set()
  const versions = new Set()
  manifest.migrations.forEach((entry, index) => {
    if (names.has(entry.filename)) errors.push(`duplicate migration filename ${entry.filename}`)
    if (versions.has(entry.version)) errors.push(`duplicate migration version ${entry.version}`)
    names.add(entry.filename)
    versions.add(entry.version)
    if (entry.dependency !== (index === 0 ? null : manifest.migrations[index - 1].filename)) {
      errors.push(`${entry.filename}: dependency does not name the immediately preceding manifest entry`)
    }
    const path = resolve(migrationRoot, entry.filename)
    if (!existsSync(path)) errors.push(`${entry.filename}: file is missing`)
    else {
      const actual = sha256Normalized(readFileSync(path, 'utf8'))
      if (actual !== entry.sha256) errors.push(`${entry.filename}: hash mismatch`)
    }
  })
  return errors
}

function deriveMigrationPlan(manifest) {
  const boundary = manifest.migrations.findIndex((entry) => entry.filename === firstAdminMigration)
  assert(boundary > 0, `${firstAdminMigration} is absent or has no checked-in predecessor`)
  const baseline = manifest.migrations.slice(0, boundary)
  const tail = manifest.migrations.slice(boundary)
  assert(tail[0].dependency === baseline.at(-1).filename,
    'first Admin migration does not depend on the final simulated-baseline migration')
  assert(!baseline.some((entry) => entry.filename.includes('_admin_')),
    'an Admin-named migration appears before the selected boundary')
  return { baseline, tail }
}

function createdRelations(entries) {
  const relations = new Set()
  for (const entry of entries) {
    const source = migrationSource(entry)
    for (const match of source.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(public|academy_private)\.([a-z0-9_]+)/gi)) {
      relations.add(`${match[1].toLowerCase()}.${match[2].toLowerCase()}`)
    }
  }
  return [...relations].sort()
}

function createdRoutines(entries) {
  const routines = new Set()
  for (const entry of entries) {
    const source = migrationSource(entry)
    for (const match of source.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(public|academy_private)\.([a-z0-9_]+)/gi)) {
      routines.add(`${match[1].toLowerCase()}.${match[2].toLowerCase()}`)
    }
  }
  return [...routines].sort()
}

async function createDatabase() {
  const database = await PGlite.create()
  await database.exec(bootstrap)
  return database
}

async function recordMigration(database, entry) {
  await database.query(
    'insert into supabase_migrations.schema_migrations (version) values ($1)',
    [entry.version],
  )
}

async function applyMigration(database, entry) {
  await database.exec(migrationSource(entry))
  await recordMigration(database, entry)
}

function profileData(name, grade, theme, academyGrade) {
  return {
    id: 'p1',
    name,
    grade,
    pin: '',
    theme,
    skills: {},
    missions: {},
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: '2026-08-01T12:00:00.000Z',
    placementDone: false,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
    academy: {
      releaseVersion: '1.0.0',
      grade: academyGrade,
      enrolledAt: '2026-08-01T12:00:00.000Z',
      courseIds: [`grade-${academyGrade}-mathematics`],
      lessons: {},
      assessments: {},
    },
  }
}

async function asAuthenticated(database, userId, operation) {
  await database.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
  await database.query("select set_config('request.jwt.claim.role', 'authenticated', false)")
  await database.query(
    "select set_config('request.jwt.claims', $1, false)",
    [JSON.stringify({ role: 'authenticated', sub: userId })],
  )
  await database.exec('set role authenticated')
  try {
    return await operation()
  } finally {
    await database.exec('reset role')
    await database.exec(`
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claim.role', '', false);
      select set_config('request.jwt.claims', '', false);
    `)
  }
}

async function applyProfileMutation(database, userId, expectedRevision, mutationId, data, updatedAt) {
  const payload = [{ profile_id: 'p1', data, updated_at: updatedAt }]
  return asAuthenticated(database, userId, async () => {
    const result = await database.query(
      'select public.academy_apply_profile_mutation($1, $2, $3::jsonb) as result',
      [expectedRevision, mutationId, JSON.stringify(payload)],
    )
    return result.rows[0].result
  })
}

async function seedBaselineData(database) {
  await database.exec(identityAndStudyFixtures)
  const profileA = profileData('Synthetic Upgrade Learner A', '6', 'cool', '5')
  const profileB = profileData('Synthetic Upgrade Learner B', '12', 'clean', '8')
  const appliedA = await applyProfileMutation(
    database, guardianA, 0, 'upgrade-profile-a', profileA, '2026-08-02T12:00:00Z',
  )
  const appliedB = await applyProfileMutation(
    database, guardianB, 0, 'upgrade-profile-b', profileB, '2026-08-02T12:00:00Z',
  )
  const conflict = await applyProfileMutation(
    database, guardianA, 0, 'upgrade-profile-a-conflict', profileA, '2026-08-02T12:00:00Z',
  )
  assert(appliedA.status === 'applied' && appliedA.revision === '1', 'household A CAS seed failed')
  assert(appliedB.status === 'applied' && appliedB.revision === '1', 'household B CAS seed failed')
  assert(conflict.status === 'conflict' && conflict.revision === '1', 'CAS conflict receipt seed failed')
}

async function seedHistoricalProviderUsage(database) {
  await database.exec(`
    insert into public.academy_provider_pricing_catalogs (
      version, currency, effective_from, effective_to, published_at, source_ref
    ) values (
      'local-rehearsal-catalog-v1', 'USD', '2026-01-01T00:00:00Z',
      '2027-01-01T00:00:00Z', '2025-12-15T00:00:00Z',
      'LOCAL DETERMINISTIC SYNTHETIC REHEARSAL'
    );
    insert into public.academy_provider_prices (
      id, pricing_catalog_version, provider, provider_product_id, provider_model_id,
      logical_model_tier, billing_unit, currency, effective_from, effective_to,
      price_micros, unit_quantity
    ) values
      ('41000000-0000-4000-8000-000000000001', 'local-rehearsal-catalog-v1',
        'anthropic', 'claude-sonnet-4-6', 'claude-sonnet-4-6', 'sonnet',
        'input_token', 'USD', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 2, 1),
      ('41000000-0000-4000-8000-000000000002', 'local-rehearsal-catalog-v1',
        'anthropic', 'claude-sonnet-4-6', 'claude-sonnet-4-6', 'sonnet',
        'output_token', 'USD', '2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', 3, 1);
  `)
  const result = await database.query(`
    select public.academy_record_provider_usage(
      'historical-tutor-usage', '2026-08-05T12:00:00Z', '${guardianA}', '${householdA}',
      'resolved', 'academy-local-rehearsal', 'tutor-engine-1', '1.0.0',
      'tutor', 'anthropic', 'claude-sonnet-4-6', 'claude-sonnet-4-6', 'sonnet',
      12, 5, 0, 0, null, 87, 'success', null, 'billable'
    ) as result
  `)
  assert(result.rows[0].result.idempotencyResult === 'created',
    'historical provider usage fixture was not created')
}

function relationSnapshotExpression(relation, rowExpression = 'to_jsonb(item)') {
  return `(select coalesce(jsonb_agg(row_data order by row_data::text), '[]'::jsonb)
    from (select ${rowExpression} as row_data from ${relation} as item) as snapshot_rows)`
}

async function baselineDataSnapshot(database) {
  const pairs = baselineDataRelations.map((relation) => (
    `'${relation}', ${relationSnapshotExpression(relation)}`
  ))
  const result = await database.query(`select jsonb_build_object(${pairs.join(',')})::text as snapshot`)
  return result.rows[0].snapshot
}

async function providerSnapshot(database) {
  const result = await database.query(`
    select jsonb_build_object(
      'catalogs', ${relationSnapshotExpression('public.academy_provider_pricing_catalogs')},
      'prices', ${relationSnapshotExpression('public.academy_provider_prices')},
      'ledger', ${relationSnapshotExpression('public.academy_provider_usage_ledger', "to_jsonb(item) - 'purpose'")},
      'components', ${relationSnapshotExpression('public.academy_provider_usage_cost_components')}
    )::text as snapshot
  `)
  return result.rows[0].snapshot
}

async function curriculumCustodySnapshot(database) {
  const result = await database.query(`
    select jsonb_build_object(
      'release', (
        select (to_jsonb(release)
          - 'staging_id' - 'published_by' - 'publication_content_sha256'
          - 'publication_manifest_sha256' - 'publication_package_sha256')
        from public.academy_curriculum_releases as release where version = '1.0.0'
      ),
      'files', (
        select jsonb_agg(
          (to_jsonb(file) - 'content' - 'canonical_content') order by file.relative_path
        ) from public.academy_curriculum_release_files as file
        join public.academy_curriculum_releases as release using (release_id)
        where release.version = '1.0.0'
      ),
      'pointer', (
        select to_jsonb(pointer) from public.academy_curriculum_active_pointers as pointer
        where environment = 'production'
      )
    )::text as snapshot
  `)
  return result.rows[0].snapshot
}

async function baselineRelationOids(database) {
  const result = await database.query(`
    select namespace.nspname || '.' || relation.relname as relation_name,
      relation.oid::text as oid
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where relation.relkind in ('r', 'p')
      and namespace.nspname in ('public', 'academy_private')
    order by relation_name
  `)
  return new Map(result.rows.map((row) => [row.relation_name, row.oid]))
}

async function assertBaselineOidsPreserved(database, expected) {
  const current = await baselineRelationOids(database)
  for (const [name, oid] of expected) {
    assert(current.get(name) === oid, `${name} was dropped, replaced, or lost during the upgrade`)
  }
}

async function assertSeedContracts(database) {
  const result = await database.query(`
    select
      (select count(*)::integer
       from public.academy_students as student
       join public.academy_household_memberships as membership
         on membership.household_id = student.household_id and membership.status = 'active'
       join public.academy_guardian_student_access as access
         on access.student_id = student.id and access.membership_id = membership.id
       join public.academy_subject_enrollments as enrollment
         on enrollment.student_id = student.id and enrollment.household_id = student.household_id
       join public.profiles as profile
         on profile.household_id = membership.user_id
        and profile.profile_id = student.legacy_profile_id
       where access.status = 'active' and enrollment.curriculum_version = '1.0.0') as identity_links,
      (select count(*)::integer from public.profiles
       where data #>> '{academy,releaseVersion}' = '1.0.0') as learner_pins,
      (select count(*)::integer from public.academy_household_sync_state
       where revision = 1) as cas_states,
      (select count(*)::integer from public.academy_household_sync_mutations
       where result_type = 'applied') as cas_applied,
      (select count(*)::integer from public.academy_household_sync_mutations
       where result_type = 'conflict') as cas_conflicts,
      (select coalesce(sum(count), 0)::integer from public.academy_gateway_usage) as gateway_count,
      (select count(*)::integer
       from public.academy_study_sessions as session
       join public.academy_students as student
         on student.id = session.student_id and student.household_id = session.household_id
       join public.academy_study_household_settings as settings
         on settings.household_id = session.household_id) as study_links,
      (select count(*)::integer
       from academy_private.student_session_grants as session_grant
       join academy_private.student_access_credentials as credential
         on credential.id = session_grant.credential_id
       join public.academy_students as student on student.id = session_grant.student_id) as study_identity_links
  `)
  const row = result.rows[0]
  assert(row.identity_links === 2, 'student/guardian/profile/enrollment relationships changed')
  assert(row.learner_pins === 2, 'learner Curriculum 1.0.0 pins changed')
  assert(row.cas_states === 2 && row.cas_applied === 2 && row.cas_conflicts === 1,
    'CAS revisions or mutation receipts changed')
  assert(row.gateway_count === 10, 'gateway usage history changed')
  assert(row.study_links === 2 && row.study_identity_links === 1,
    'Study storage or verified identity relationships changed')
}

async function directGrants(database, roleName) {
  const result = await database.query(`
    with selected_role as (
      select oid from pg_catalog.pg_roles where rolname = $1
    ), relation_grants as (
      select namespace.nspname || '.' || relation.relname || ':' || acl.privilege_type as grant_key
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      where acl.grantee = (select oid from selected_role)
        and namespace.nspname in ('public', 'academy_private')
    ), routine_grants as (
      select namespace.nspname || '.' || routine.proname || '('
        || pg_catalog.pg_get_function_identity_arguments(routine.oid) || '):'
        || acl.privilege_type as grant_key
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      cross join lateral pg_catalog.aclexplode(routine.proacl) as acl
      where acl.grantee = (select oid from selected_role)
        and namespace.nspname in ('public', 'academy_private')
    )
    select grant_key from relation_grants union all select grant_key from routine_grants
    order by grant_key
  `, [roleName])
  return new Set(result.rows.map((row) => row.grant_key))
}

async function directPublicRelationGrants(database, tailRelations) {
  const result = await database.query(`
    select namespace.nspname || '.' || relation.relname as relation_name,
      acl.privilege_type
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
    where acl.grantee = 0 and namespace.nspname in ('public', 'academy_private')
  `)
  const selected = new Set(tailRelations)
  return result.rows.filter((row) => selected.has(row.relation_name))
}

async function migrationLedger(database) {
  const result = await database.query(
    'select version from supabase_migrations.schema_migrations order by applied_at, version',
  )
  return result.rows.map((row) => row.version)
}

async function assertMigrationLedger(database, expectedEntries) {
  const observed = await migrationLedger(database)
  const expected = expectedEntries.map((entry) => entry.version)
  assert(JSON.stringify(observed) === JSON.stringify(expected),
    `migration ledger order mismatch: expected ${expected.join(',')}, observed ${observed.join(',')}`)
}

async function verifyFinalCatalog(database, plan, tailRelations, tailRoutines) {
  const relations = await database.query(`
    select namespace.nspname || '.' || relation.relname as relation_name,
      relation.relrowsecurity as rls_enabled,
      relation.relforcerowsecurity as rls_forced,
      pg_catalog.pg_get_userbyid(relation.relowner) as owner_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where relation.relkind in ('r', 'p')
      and namespace.nspname in ('public', 'academy_private')
  `)
  const byRelation = new Map(relations.rows.map((row) => [row.relation_name, row]))
  for (const name of tailRelations) {
    const row = byRelation.get(name)
    assert(row, `required Admin-tail relation ${name} is missing`)
    assert(row.rls_enabled && row.rls_forced, `${name} does not have enabled and forced RLS`)
    assert(row.owner_name === 'postgres', `${name} is not owned by postgres`)
  }

  const routines = await database.query(`
    select namespace.nspname || '.' || routine.proname as routine_name,
      pg_catalog.pg_get_userbyid(routine.proowner) as owner_name
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
    where namespace.nspname in ('public', 'academy_private')
  `)
  const routineOwners = new Map()
  for (const row of routines.rows) {
    if (!routineOwners.has(row.routine_name)) routineOwners.set(row.routine_name, new Set())
    routineOwners.get(row.routine_name).add(row.owner_name)
  }
  for (const name of tailRoutines) {
    assert(routineOwners.has(name), `required Admin-tail routine ${name} is missing`)
    assert([...routineOwners.get(name)].every((owner) => owner === 'postgres'),
      `${name} has an unexpected owner`)
  }

  const serviceGrants = await directGrants(database, 'service_role')
  for (const routine of requiredFinalServiceRoutines) {
    assert([...serviceGrants].some((grant) => grant.startsWith(`public.${routine}(`)),
      `service_role lacks a direct grant on ${routine}`)
  }
  const authenticatedGrants = await directGrants(database, 'authenticated')
  assert([...authenticatedGrants].some((grant) => (
    grant.startsWith('public.academy_admin_authorization_v2(') && grant.endsWith(':EXECUTE')
  )), 'authenticated lacks the intended direct Admin authorization RPC grant')

  const unsafeRoles = ['anon', 'authenticated']
  for (const role of unsafeRoles) {
    const grants = await directGrants(database, role)
    const tableGrants = [...grants].filter((grant) => (
      tailRelations.some((name) => grant.startsWith(`${name}:`))
    ))
    assert(tableGrants.length === 0,
      `${role} has unexpected direct Admin-tail table grants: ${tableGrants.join(', ')}`)
  }
  const publicRelationGrants = await directPublicRelationGrants(database, tailRelations)
  assert(publicRelationGrants.length === 0, 'PUBLIC has an unexpected direct Admin-tail table grant')

  await assertMigrationLedger(database, [...plan.baseline, ...plan.tail])
  return { serviceGrantCount: serviceGrants.size }
}

async function assertCurriculumFinal(database, expectedCustody) {
  assert(await curriculumCustodySnapshot(database) === expectedCustody,
    'immutable Curriculum 1.0.0 custody or production pointer changed')
  await assertSeedContracts(database)
  const transition = await database.query(`
    select count(*)::integer as transition_count,
      min(new_release_id::text) as release_id,
      min(transition_kind) as transition_kind
    from public.academy_curriculum_pointer_transitions
  `)
  assert(transition.rows[0].transition_count === 1
    && transition.rows[0].release_id === '16000000-0000-4000-8000-000000000001'
    && transition.rows[0].transition_kind === 'migration_seed',
  'Curriculum pointer history seed is missing or inconsistent')

  for (const statement of [
    "update public.academy_curriculum_releases set status = status where version = '1.0.0'",
    "update public.academy_curriculum_release_files set byte_count = byte_count where relative_path = 'README.md'",
    "update public.academy_curriculum_active_pointers set revision = revision where environment = 'production'",
  ]) {
    let rejected = false
    try {
      await database.exec(statement)
    } catch {
      rejected = true
    }
    assert(rejected, `Curriculum immutability probe unexpectedly succeeded: ${statement}`)
  }
  assert(await curriculumCustodySnapshot(database) === expectedCustody,
    'Curriculum immutability probes changed custody')
}

async function assertProviderFinal(database, expectedProvider) {
  assert(await providerSnapshot(database) === expectedProvider,
    'historical provider ledger or pricing rows changed')
  const row = (await database.query(`
    select execution_key, purpose, input_tokens::integer, output_tokens::integer,
      cost_kind, cost_micros::integer, pricing_catalog_version
    from public.academy_provider_usage_ledger
    where execution_key = 'historical-tutor-usage'
  `)).rows[0]
  assert(row.purpose === 'tutor_turn' && row.input_tokens === 12 && row.output_tokens === 5
    && row.cost_kind === 'calculated' && row.cost_micros === 39
    && row.pricing_catalog_version === 'local-rehearsal-catalog-v1',
  'provider-accounting successor produced an invalid historical ledger projection')

  const replay = await database.query(`
    select public.academy_record_provider_usage(
      'historical-tutor-usage', '2026-08-05T12:00:00Z', '${guardianA}', '${householdA}',
      'resolved', 'academy-local-rehearsal', 'tutor-engine-1', '1.0.0',
      'tutor', 'anthropic', 'claude-sonnet-4-6', 'claude-sonnet-4-6', 'sonnet',
      12, 5, 0, 0, null, 87, 'success', null, 'billable'
    ) as result
  `)
  assert(replay.rows[0].result.idempotencyResult === 'replayed',
    'upgraded provider RPC did not recognize the historical ledger row')
  assert(await providerSnapshot(database) === expectedProvider,
    'provider idempotency replay changed historical accounting rows')
}

async function stableSummary(database, plan, tailRelations, tailRoutines, security, intentionalRevocations) {
  const counts = await database.query(`
    select
      (select count(*)::integer from public.profiles) as profiles,
      (select count(*)::integer from public.academy_students) as students,
      (select count(*)::integer from public.academy_household_sync_mutations) as cas_receipts,
      (select count(*)::integer from public.academy_gateway_usage) as gateway_rows,
      (select count(*)::integer from public.academy_study_sessions) as study_sessions,
      (select count(*)::integer from public.academy_provider_usage_ledger) as provider_rows,
      (select count(*)::integer from public.academy_provider_usage_cost_components) as provider_components,
      (select count(*)::integer from public.academy_curriculum_releases where version = '1.0.0') as curriculum_releases,
      (select count(*)::integer from public.academy_curriculum_release_files) as curriculum_files,
      (select count(*)::integer from public.academy_curriculum_active_pointers) as curriculum_pointers
  `)
  return {
    baselineVersions: plan.baseline.map((entry) => entry.version),
    tailVersions: plan.tail.map((entry) => entry.version),
    seededCounts: counts.rows[0],
    learnerReleasePin: '1.0.0',
    providerHistoricalCostMicros: 39,
    adminTailRelationCount: tailRelations.length,
    adminTailRoutineNameCount: tailRoutines.length,
    serviceGrantCount: security.serviceGrantCount,
    intentionalTailServiceGrantRevocations: intentionalRevocations,
  }
}

async function runSuccessfulRehearsal(label, plan, tailRelations, tailRoutines) {
  const database = await createDatabase()
  try {
    for (const entry of plan.baseline) await applyMigration(database, entry)
    await assertMigrationLedger(database, plan.baseline)
    await seedBaselineData(database)
    await assertSeedContracts(database)
    const baselineSnapshot = await baselineDataSnapshot(database)
    const baselineOids = await baselineRelationOids(database)
    let providerState = null
    let curriculumState = null
    let serviceGrants = await directGrants(database, 'service_role')
    let intentionalRevocations = 0

    process.stdout.write(`[PASS] ${label}: LOCAL_SIMULATED_BASELINE applied (${plan.baseline.length} migrations) and fixtures seeded\n`)
    for (const entry of plan.tail) {
      await applyMigration(database, entry)
      if (entry.filename === providerFoundationMigration) {
        await seedHistoricalProviderUsage(database)
        providerState = await providerSnapshot(database)
      }
      if (entry.filename === curriculumRegistryMigration) {
        curriculumState = await curriculumCustodySnapshot(database)
      }

      assert(await baselineDataSnapshot(database) === baselineSnapshot,
        `${entry.filename} changed pre-Admin application rows`)
      await assertBaselineOidsPreserved(database, baselineOids)
      if (providerState) {
        assert(await providerSnapshot(database) === providerState,
          `${entry.filename} changed historical provider-accounting rows`)
      }
      if (curriculumState) {
        assert(await curriculumCustodySnapshot(database) === curriculumState,
          `${entry.filename} changed Curriculum 1.0.0 custody`)
      }

      const currentGrants = await directGrants(database, 'service_role')
      for (const grant of serviceGrants) {
        if (!currentGrants.has(grant)) {
          const routineName = /^public\.([a-z0-9_]+)\(/.exec(grant)?.[1]
          if (routineName && expectedTailServiceGrantRevocations.get(entry.version)?.has(routineName)) {
            intentionalRevocations += 1
          } else {
            fail(`${entry.filename} unexpectedly revoked service_role grant ${grant}`)
          }
        }
      }
      serviceGrants = currentGrants
      process.stdout.write(`[PASS] ${label}: ${entry.version} preserved rows, identities, revisions, Study state, custody, and grants\n`)
    }

    assert(providerState, 'provider foundation phase was not reached')
    assert(curriculumState, 'curriculum registry phase was not reached')
    await assertSeedContracts(database)
    await assertProviderFinal(database, providerState)
    await assertCurriculumFinal(database, curriculumState)
    const security = await verifyFinalCatalog(database, plan, tailRelations, tailRoutines)
    const summary = await stableSummary(
      database, plan, tailRelations, tailRoutines, security, intentionalRevocations,
    )
    process.stdout.write(`[PASS] ${label}: final Admin relations/RPCs, RLS, ownership, grants, Curriculum custody, and provider history verified\n`)
    return summary
  } finally {
    await database.close()
  }
}

function injectedFailureSource(source) {
  const marker = source.toLowerCase().lastIndexOf('\ncommit;')
  assert(marker >= 0, 'failure-injection target has no enclosing commit')
  const injection = `
do $admin_upgrade_failure_injection$
begin
  raise exception 'LOCAL_REHEARSAL_INJECTED_FAILURE';
end;
$admin_upgrade_failure_injection$;
`
  return `${source.slice(0, marker)}${injection}${source.slice(marker)}`
}

async function runFailureInjection(plan) {
  const database = await createDatabase()
  try {
    for (const entry of plan.baseline) await applyMigration(database, entry)
    await seedBaselineData(database)
    const baselineSnapshot = await baselineDataSnapshot(database)
    const baselineOids = await baselineRelationOids(database)
    let providerState = null
    const failureIndex = plan.tail.findIndex((entry) => entry.filename === failureInjectionMigration)
    assert(failureIndex > 0, 'failure-injection migration is absent from the candidate tail')
    for (const entry of plan.tail.slice(0, failureIndex)) {
      await applyMigration(database, entry)
      if (entry.filename === providerFoundationMigration) {
        await seedHistoricalProviderUsage(database)
        providerState = await providerSnapshot(database)
      }
    }
    assert(providerState, 'provider history was not seeded before failure injection')
    const target = plan.tail[failureIndex]
    let failed = false
    try {
      await database.exec(injectedFailureSource(migrationSource(target)))
    } catch (error) {
      failed = String(error).includes('LOCAL_REHEARSAL_INJECTED_FAILURE')
      await database.exec('rollback')
    }
    assert(failed, 'representative mid-migration failure did not stop execution')
    assert(await baselineDataSnapshot(database) === baselineSnapshot,
      'failure rollback changed pre-Admin application rows')
    await assertBaselineOidsPreserved(database, baselineOids)
    assert(await providerSnapshot(database) === providerState,
      'failure rollback changed historical provider accounting')

    const purposeColumn = await database.query(`
      select count(*)::integer as count from information_schema.columns
      where table_schema = 'public' and table_name = 'academy_provider_usage_ledger'
        and column_name = 'purpose'
    `)
    assert(purposeColumn.rows[0].count === 0,
      'failed provider migration left its generated column behind')
    const applied = await migrationLedger(database)
    const expected = [...plan.baseline, ...plan.tail.slice(0, failureIndex)].map((entry) => entry.version)
    assert(JSON.stringify(applied) === JSON.stringify(expected),
      'failed migration was recorded or a later migration ran')
    const nextObject = await database.query(`
      select to_regprocedure('academy_private.admin_configuration_reauthorize_head_update()')::text as object
    `)
    assert(nextObject.rows[0].object === null, 'migration execution continued after the injected failure')
    await assertSeedContracts(database)
    process.stdout.write(`[PASS] failure injection: ${target.version} rolled back atomically, was not recorded, and the tail stopped before ${plan.tail[failureIndex + 1].version}\n`)
    return {
      failedVersion: target.version,
      nextVersionNotApplied: plan.tail[failureIndex + 1].version,
      rollbackPreservedHistoricalProviderUsage: true,
      migrationLedgerStopped: true,
    }
  } finally {
    await database.close()
  }
}

function assertLocalOnlyLauncher() {
  if (process.argv.length !== 2) {
    fail('this command accepts no URL, project reference, connection string, or passthrough argument')
  }
  const marker = linkedProjectMarkers.find((relativePath) => existsSync(resolve(root, relativePath)))
  if (marker) fail(`linked Supabase marker present at ${marker}; use an unlinked disposable worktree`)
  if (process.platform !== 'darwin' || !existsSync(sandboxPath)) {
    fail('this MAC rehearsal requires macOS sandbox-exec to enforce network denial')
  }
}

function assertNetworkSandbox() {
  const probe = [
    "const net = require('node:net')",
    "const socket = net.createConnection({ host: '127.0.0.1', port: 9 })",
    "socket.on('error', (error) => process.exit(error.code === 'EPERM' ? 0 : 2))",
    "socket.on('connect', () => process.exit(3))",
    'setTimeout(() => process.exit(4), 1000)',
  ].join(';')
  const result = spawnSync(sandboxPath, [
    '-p', networkDeniedSandbox, process.execPath, '-e', probe,
  ], { timeout: 2_000 })
  if (result.status !== 0) fail(`network-denial self-test failed (exit ${result.status ?? 'unknown'})`)
}

function scrubHostedEnvironment() {
  const environment = { ...process.env }
  const hostedKey = /^(?:SUPABASE|DATABASE_URL$|POSTGRES|PGHOST$|PGPORT$|PGUSER$|PGPASSWORD$|PGDATABASE$|NETLIFY_AUTH_TOKEN$|VERCEL_TOKEN$)/i
  const removed = []
  for (const key of Object.keys(environment)) {
    if (hostedKey.test(key) || key === 'NODE_OPTIONS' || key === 'NODE_PATH') {
      removed.push(key)
      delete environment[key]
    }
  }
  environment[workerMarker] = 'local-disposable-pglite'
  return { environment, removed: removed.sort() }
}

async function workerMain() {
  const manifest = readManifest()
  const custodyErrors = validateManifest(manifest)
  assert(custodyErrors.length === 0, `migration custody mismatch\n${custodyErrors.join('\n')}`)
  const plan = deriveMigrationPlan(manifest)
  const tailRelations = createdRelations(plan.tail)
  const tailRoutines = createdRoutines(plan.tail)

  const syntheticMismatch = structuredClone(manifest)
  syntheticMismatch.migrations[0].sha256 = '0'.repeat(64)
  assert(validateManifest(syntheticMismatch).length === 1,
    'synthetic custody mismatch did not fail closed before database creation')

  process.stdout.write('MANUEL ACADEMY — LOCAL PRODUCTION UPGRADE-PATH MIGRATION REHEARSAL\n')
  process.stdout.write('BASELINE_CLASSIFICATION: LOCAL_SIMULATED_BASELINE\n')
  process.stdout.write('HOSTED_PRODUCTION_STATE: NOT CLAIMED\n')
  process.stdout.write(`BASELINE: ${plan.baseline[0].version}..${plan.baseline.at(-1).version} (${plan.baseline.length} checked-in migrations)\n`)
  process.stdout.write(`CANDIDATE_TAIL: ${plan.tail[0].version}..${plan.tail.at(-1).version} (${plan.tail.length} checked-in migrations)\n`)
  process.stdout.write('[PASS] custody failure gate: synthetic hash mismatch stopped before database creation\n')

  const first = await runSuccessfulRehearsal('fresh-run-1', plan, tailRelations, tailRoutines)
  const second = await runSuccessfulRehearsal('fresh-run-2', plan, tailRelations, tailRoutines)
  assert(JSON.stringify(first) === JSON.stringify(second),
    'two fresh rehearsals produced different semantic summaries')
  const failureInjection = await runFailureInjection(plan)
  const deterministicFingerprint = createHash('sha256')
    .update(JSON.stringify(first)).digest('hex')

  process.stdout.write(`[PASS] determinism: two fresh databases produced ${deterministicFingerprint}\n`)
  process.stdout.write(`${JSON.stringify({
    baselineClassification: 'LOCAL_SIMULATED_BASELINE',
    hostedProductionStateClaimed: false,
    baseline: plan.baseline.map((entry) => entry.filename),
    candidateTail: plan.tail.map((entry) => entry.filename),
    semanticSummary: first,
    failureInjection,
    deterministicFingerprint,
  }, null, 2)}\n`)
  process.stdout.write('RESULT: ADMIN_UPGRADE_PATH_REHEARSAL_READY\n')
}

function launcherMain() {
  assertLocalOnlyLauncher()
  assertNetworkSandbox()
  const { environment, removed } = scrubHostedEnvironment()
  process.stdout.write(`[PASS] local-only launcher: network denied; ${removed.length} hosted/runtime environment variable name(s) removed\n`)
  const result = spawnSync(sandboxPath, [
    '-p', networkDeniedSandbox, process.execPath, fileURLToPath(import.meta.url),
  ], {
    cwd: root,
    env: environment,
    stdio: 'inherit',
    timeout: 600_000,
  })
  if (result.error) fail(`sandboxed rehearsal could not start: ${result.error.message}`)
  if (result.status !== 0) fail(`sandboxed rehearsal failed (exit ${result.status ?? 'unknown'})`)
}

try {
  if (process.env[workerMarker] === 'local-disposable-pglite') await workerMain()
  else launcherMain()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

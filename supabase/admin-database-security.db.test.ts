import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import manifest from '../docs/study-engine-final-production/migration-manifest.json'
import { canonicalJson } from '../netlify/functions/_shared/admin-curriculum-integrity.js'

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const ATTACKER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const OWNER_ASSIGNMENT = '10000000-0000-4000-8000-000000000001'
const HASH_A = 'a'.repeat(64)
const COLLECTIONS = [
  'courses', 'units', 'lessons', 'assessments', 'assessment_interpretations',
  'schedules', 'standard_frameworks', 'resources', 'policy_sets',
] as const
const databases: PGlite[] = []

type ApplicationRole = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(
  database: PGlite,
  role: ApplicationRole,
  userId: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  await database.query(`select set_config('request.jwt.claim.role', $1, false)`, [role])
  await database.exec(`set role ${role}`)
  try {
    return await operation()
  } finally {
    await database.exec('reset role')
    await database.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await database.query(`select set_config('request.jwt.claim.role', '', false)`)
  }
}

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth authorization postgres;
    create table auth.users (id uuid primary key, email text);
    insert into auth.users (id, email) values
      ('${OWNER}', 'owner@example.test'),
      ('${ADMIN}', 'admin@example.test'),
      ('${VIEWER}', 'viewer@example.test'),
      ('${ATTACKER}', 'attacker@example.test');
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
  `)
  for (const migration of manifest.migrations) {
    await database.exec(await readFile(
      new URL(`./migrations/${migration.filename}`, import.meta.url),
      'utf8',
    ))
  }
  await database.exec(`
    insert into public.academy_admin_role_assignments
      (id, user_id, role, assignment_reason_code)
    values
      ('${OWNER_ASSIGNMENT}', '${OWNER}', 'owner', 'admin.bootstrap'),
      ('20000000-0000-4000-8000-000000000001', '${ADMIN}', 'admin', 'admin.bootstrap'),
      ('30000000-0000-4000-8000-000000000001', '${VIEWER}', 'viewer', 'admin.bootstrap');
  `)
  return database
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function stagedPackage(
  draftId: string,
  targetVersion: string,
  validationSnapshotId: string,
  approvalId: string,
) {
  const values = Object.fromEntries(COLLECTIONS.map((name) => [
    name,
    name === 'courses' ? [{ course_id: 'course-1' }] : [],
  ]))
  const contentByPath = {
    'snapshot/manifest.json': { schema_set_version: '2.0.0' },
    ...Object.fromEntries(COLLECTIONS.map((name) => [`snapshot/${name}.json`, values[name]])),
  }
  const artifacts = Object.entries(contentByPath).map(([relativePath, content]) => {
    const canonicalContent = canonicalJson(content)
    return {
      relativePath,
      byteCount: Buffer.byteLength(canonicalContent),
      sha256: sha256(canonicalContent),
      canonicalContent,
    }
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const entityCounts = Object.fromEntries(COLLECTIONS.map((name) => [name, values[name].length]))
  const byteCount = artifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0)
  const contentHash = sha256(artifacts.map((artifact) => (
    `${artifact.relativePath}\0${artifact.byteCount}\0${artifact.sha256}\n`
  )).join(''))
  const packageManifest = {
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: {
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      version: targetVersion,
    },
    baseReleaseVersion: '1.0.0',
    targetVersion,
    schemaSetVersion: '2.0.0',
    draft: { id: draftId, revision: 1 },
    validation: { id: validationSnapshotId, resultDigest: HASH_A },
    approval: { id: approvalId },
    entityCounts,
    fileCount: artifacts.length,
    byteCount,
    files: artifacts.map(({ relativePath, byteCount: bytes, sha256: digest }) => ({
      relativePath,
      byteCount: bytes,
      sha256: digest,
    })),
    contentHash,
  }
  const manifestCanonical = canonicalJson(packageManifest)
  const manifestHash = sha256(manifestCanonical)
  return {
    artifacts,
    contentHash,
    manifest: packageManifest,
    manifestCanonical,
    manifestHash,
    packageHash: sha256(
      `manuel-academy-curriculum-staged-v1\n${contentHash}\n${manifestHash}\n`,
    ),
  }
}

beforeEach(async () => { await createDatabase() })
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('full-chain Admin database security red team', () => {
  it('keeps every application relation behind RLS with the intended FORCE boundary', async () => {
    const database = databases[0]
    const relations = await database.query<{
      schema_name: string
      table_name: string
      rls_enabled: boolean
      rls_forced: boolean
    }>(`
      select namespace.nspname as schema_name, relation.relname as table_name,
        relation.relrowsecurity as rls_enabled,
        relation.relforcerowsecurity as rls_forced
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname in ('public', 'academy_private')
        and relation.relkind in ('r', 'p')
      order by namespace.nspname, relation.relname
    `)
    // Hosted Sync R2 contributes one private checkpoint table. Family Cloud
    // R1 adds its typed response header/items and strict Family Plan table.
    expect(relations.rows).toHaveLength(93)
    expect(relations.rows.every((relation) => relation.rls_enabled)).toBe(true)
    expect(relations.rows.filter((relation) => !relation.rls_forced)
      .map((relation) => `${relation.schema_name}.${relation.table_name}`)).toEqual([
        'public.academy_audit_events',
        'public.academy_guardian_student_access',
        'public.academy_household_memberships',
        'public.academy_household_sync_mutations',
        'public.academy_household_sync_state',
        'public.academy_households',
        'public.academy_students',
        'public.academy_subject_enrollments',
        'public.profiles',
      ])

    await database.exec(`
      grant usage on schema academy_private to authenticated;
      grant select on all tables in schema public to authenticated;
      grant select on all tables in schema academy_private to authenticated;
    `)
    await asRole(database, 'authenticated', ATTACKER, async () => {
      for (const relation of relations.rows) {
        const result = await database.query<{ count: number }>(`
          select count(*)::integer as count
          from ${relation.schema_name}.${relation.table_name}
        `)
        expect(result.rows, `${relation.schema_name}.${relation.table_name}`).toEqual([{ count: 0 }])
      }
    })
  })

  it('keeps PUBLIC and anon empty and all authenticated relation grants read-only', async () => {
    const database = databases[0]
    const grants = await database.query<{
      grantee: string
      privilege_type: string
      object_name: string
    }>(`
      select case when acl.grantee = 0 then 'PUBLIC'
          else pg_catalog.pg_get_userbyid(acl.grantee) end as grantee,
        acl.privilege_type,
        namespace.nspname || '.' || relation.relname as object_name
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      cross join lateral pg_catalog.aclexplode(relation.relacl) as acl
      where namespace.nspname in ('public', 'academy_private')
        and acl.grantee in (
          0,
          (select oid from pg_catalog.pg_roles where rolname = 'anon'),
          (select oid from pg_catalog.pg_roles where rolname = 'authenticated')
        )
      order by grantee, object_name, acl.privilege_type
    `)
    expect(grants.rows.filter(({ grantee }) => grantee === 'PUBLIC' || grantee === 'anon'))
      .toEqual([])
    expect(grants.rows).toHaveLength(16)
    expect(grants.rows.every(({ grantee, privilege_type: privilege }) => (
      grantee === 'authenticated' && privilege === 'SELECT'
    ))).toBe(true)
  })

  it('pins SECURITY DEFINER ownership, search paths, execution, and dynamic SQL', async () => {
    const database = databases[0]
    const routines = await database.query<{
      schema_name: string
      routine_name: string
      identity_arguments: string
      owner_name: string
      configuration: string[] | null
      public_execute: boolean
      anon_execute: boolean
      source: string
    }>(`
      select namespace.nspname as schema_name, routine.proname as routine_name,
        pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments,
        pg_catalog.pg_get_userbyid(routine.proowner) as owner_name,
        routine.proconfig as configuration,
        routine.proacl is null or exists (
          select 1 from pg_catalog.aclexplode(routine.proacl) as acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        ) as public_execute,
        pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE') as anon_execute,
        routine.prosrc as source
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      where namespace.nspname in ('public', 'academy_private')
        and routine.prosecdef
      order by namespace.nspname, routine.proname, identity_arguments
    `)
    // Hosted Sync R2 contributes three SECURITY DEFINER routines. Family
    // Cloud R1 adds two private response helpers, two RPC wrapper layers,
    // and one authenticated household bootstrap RPC.
    expect(routines.rows).toHaveLength(242)
    expect(routines.rows.every(({ owner_name: owner }) => owner === 'postgres')).toBe(true)
    expect(routines.rows.every(({ configuration }) => (
      configuration?.length === 1
        && ['search_path=pg_catalog', 'search_path=pg_catalog, pg_temp']
          .includes(configuration[0])
    ))).toBe(true)
    expect(routines.rows.every(({ public_execute: public_, anon_execute: anon }) => (
      !public_ && !anon
    ))).toBe(true)
    expect(routines.rows.filter(({ source }) => (
      /(?:^|[;\n])\s*execute\s+(?:format\s*\(|[^'])/im.test(source)
    ))).toEqual([])

    const writePointTriggers = await database.query<{ trigger_name: string }>(`
      select trigger.tgname as trigger_name
      from pg_catalog.pg_trigger as trigger
      where trigger.tgfoid =
        'academy_private.curriculum_reauthorize_privileged_write()'::regprocedure
        and not trigger.tgisinternal
      order by trigger.tgname
    `)
    expect(writePointTriggers.rows.map(({ trigger_name: name }) => name)).toEqual([
      'academy_curriculum_approval_decisions_reauthorize_insert',
      'academy_curriculum_draft_collaborators_reauthorize_write',
      'academy_curriculum_draft_entities_reauthorize_write',
      'academy_curriculum_drafts_reauthorize_insert',
      'academy_curriculum_pointer_transitions_reauthorize_insert',
      'academy_curriculum_release_files_reauthorize_insert',
      'academy_curriculum_releases_reauthorize_insert',
      'academy_curriculum_staged_artifacts_reauthorize_insert',
      'academy_curriculum_staged_releases_reauthorize_insert',
      'academy_curriculum_standard_reviews_reauthorize_write',
      'academy_curriculum_validation_snapshots_reauthorize_insert',
    ])
  })

  it('denies every service-only and obsolete public RPC when called directly as authenticated', async () => {
    const database = databases[0]
    const routines = await database.query<{ call_expression: string }>(`
      select pg_catalog.format('%I.%I(%s)', namespace.nspname, routine.proname,
        coalesce((
          select string_agg(
            'null::' || pg_catalog.format_type(argument_type, null), ', '
            order by argument_index
          )
          from unnest(routine.proargtypes::oid[]) with ordinality
            as argument(argument_type, argument_index)
        ), '')
      ) as call_expression
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      where namespace.nspname = 'public'
        and routine.proname like 'academy_%'
        and routine.prorettype <> 'pg_catalog.trigger'::regtype
        and not pg_catalog.has_function_privilege('authenticated', routine.oid, 'EXECUTE')
        and (
          pg_catalog.has_function_privilege('service_role', routine.oid, 'EXECUTE')
          or not pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE')
        )
      order by routine.proname, pg_catalog.pg_get_function_identity_arguments(routine.oid)
    `)
    expect(routines.rows.length).toBeGreaterThan(80)
    await asRole(database, 'authenticated', ATTACKER, async () => {
      for (const { call_expression: expression } of routines.rows) {
        await expect(database.query(`select ${expression}`), expression)
          .rejects.toThrow(/permission denied/i)
      }
    })
  })

  it('derives browser actors and rejects direct configuration and access escalation', async () => {
    const database = databases[0]
    await asRole(database, 'authenticated', ATTACKER, async () => {
      await expect(database.query(`
        select public.academy_admin_preview_configuration_change_v1(
          'runtime.ai.enabled', 1, 'true'::jsonb, 'operator.request',
          repeat('a', 64), 'configuration:manage'
        )
      `)).rejects.toThrow(/ADMIN_CONFIGURATION_MANAGE_REQUIRED/)
      await expect(database.query(`
        select public.academy_admin_commit_configuration_change_v1(
          'runtime.ai.enabled', 1, 'true'::jsonb, 'operator.request',
          '40000000-0000-4000-8000-000000000001', repeat('a', 64),
          'configuration:manage'
        )
      `)).rejects.toThrow(/ADMIN_CONFIGURATION_MANAGE_REQUIRED/)
      await expect(database.query(`
        select public.academy_admin_mutate_access_v1(
          '${OWNER_ASSIGNMENT}', 1, 'viewer', 'operator.request',
          '40000000-0000-4000-8000-000000000002', 'admin_roles:manage'
        )
      `)).rejects.toThrow(/ADMIN_ACCESS_MANAGE_REQUIRED/)
    })
  })

  it('fails closed when Owner authority changes at a Curriculum approval write point', async () => {
    const database = databases[0]
    await database.exec(`
      create function public.test_demote_owner_at_standard_write()
      returns trigger language plpgsql security definer set search_path = pg_catalog as $$
      begin
        update public.academy_admin_role_assignments
        set status = 'revoked', revision = 2,
            revoked_at = statement_timestamp(), revoked_by = '${OWNER}',
            revoked_by_role = 'owner', revocation_reason_code = 'policy.enforcement',
            revocation_correlation_id = '50000000-0000-4000-8000-000000000001'
        where id = '${OWNER_ASSIGNMENT}';
        insert into public.academy_admin_role_assignments (
          user_id, role, assigned_by, assigned_by_role,
          assignment_reason_code, assignment_correlation_id
        ) values (
          '${OWNER}', 'admin', '${OWNER}', 'owner',
          'policy.enforcement', '50000000-0000-4000-8000-000000000001'
        );
        return new;
      end;
      $$;
      create trigger aaa_test_demote_owner_at_standard_write
      before insert on public.academy_curriculum_standard_reviews
      for each row execute function public.test_demote_owner_at_standard_write();
    `)

    await expect(asRole(database, 'service_role', null, () => database.query(`
      select public.academy_admin_update_curriculum_standard_review_v1(
        '${OWNER}', 'csr-1234567890abcdef', 'published_release', '1.0.0',
        'repository-red-team', 5::smallint, 'ma-g5-physical-education',
        'standards.human_review_required', array['cvf-1234567890abcdef'],
        1, 'approved_mapping', 'verified-standard', 'verified-framework',
        'Verified standard title', 'Official evidence source',
        'Owner reviewed the official evidence.', 0,
        '50000000-0000-4000-8000-000000000002', repeat('a', 64),
        'curriculum:approve'
      )
    `))).rejects.toThrow(/CURRICULUM_STANDARDS_REVIEW_REQUIRED/)
    expect((await database.query(`
      select role, status from public.academy_admin_role_assignments
      where id = '${OWNER_ASSIGNMENT}'
    `)).rows).toEqual([{ role: 'owner', status: 'active' }])
    expect((await database.query(`
      select count(*)::integer as count
      from public.academy_curriculum_standard_reviews
    `)).rows).toEqual([{ count: 0 }])
    expect((await database.query(`
      select count(*)::integer as count
      from academy_private.curriculum_standard_review_request_receipts
    `)).rows).toEqual([{ count: 0 }])
  })

  it('keeps the authorized full-chain publish and activation path operational', async () => {
    const database = databases[0]
    const targetVersion = '2.0.0-db-security.1'
    await asRole(database, 'service_role', null, async () => {
      const draft = (await database.query<{ value: any }>(`
        select public.academy_admin_create_curriculum_draft_v1(
          $1, '1.0.0', $2, '2.0.0', $3, $4, 'curriculum:drafts:write'
        ) as value
      `, [OWNER, targetVersion, crypto.randomUUID(), HASH_A])).rows[0].value
      const validation = (await database.query<{ value: any }>(`
        select public.academy_admin_record_curriculum_validation_v1(
          $1, $2, 1, 'curriculum-validation-v2', $3, 'valid',
          true, 0, 0, 0, 'curriculum:read'
        ) as value
      `, [OWNER, draft.draftId, HASH_A])).rows[0].value
      const approval = (await database.query<{ value: any }>(`
        select public.academy_admin_decide_curriculum_approval_v1(
          $1, $2, 1, 'approved', 'approval.ready', $3, $4, $5,
          'curriculum:approve'
        ) as value
      `, [
        OWNER, draft.draftId, validation.validationSnapshotId,
        crypto.randomUUID(), HASH_A,
      ])).rows[0].value
      const packageValue = stagedPackage(
        draft.draftId,
        targetVersion,
        validation.validationSnapshotId,
        approval.currentDecision.approvalId,
      )
      const staged = (await database.query<{ value: any }>(`
        select public.academy_admin_stage_curriculum_release_v1(
          $1, $2, 1, $3, $4, $5::jsonb, $6, $7::jsonb,
          $8, $9, $10, $11, $12, 'curriculum:publish'
        ) as value
      `, [
        OWNER, draft.draftId, validation.validationSnapshotId,
        approval.currentDecision.approvalId, JSON.stringify(packageValue.manifest),
        packageValue.manifestCanonical, JSON.stringify(packageValue.artifacts),
        packageValue.contentHash, packageValue.manifestHash, packageValue.packageHash,
        crypto.randomUUID(), HASH_A,
      ])).rows[0].value
      const publication = (await database.query<{ value: any }>(`
        select public.academy_admin_publish_curriculum_release_v1(
          $1, $2, $3, $4, 'curriculum:publish'
        ) as value
      `, [
        OWNER, staged.candidate.stagingId, crypto.randomUUID(), HASH_A,
      ])).rows[0].value
      expect(publication.publicationState).toBe('published')
      const activation = (await database.query<{ value: any }>(`
        select public.academy_admin_transition_curriculum_pointer_v1(
          $1, $2, 2, 'activation', 'release.activated', $3, $4,
          'releases:manage'
        ) as value
      `, [OWNER, targetVersion, crypto.randomUUID(), HASH_A])).rows[0].value
      expect(activation).toMatchObject({
        pointer: { releaseVersion: targetVersion, revision: 3 },
        transition: { state: 'transitioned', transitionKind: 'activation' },
      })
    })
  })

  it('tracks only intentional routine overloads and their application ACLs', async () => {
    const database = databases[0]
    const overloads = await database.query<{
      schema_name: string
      routine_name: string
      signatures: string[]
      executable_by_application: boolean
    }>(`
      select namespace.nspname as schema_name, routine.proname as routine_name,
        array_agg(pg_catalog.pg_get_function_identity_arguments(routine.oid)
          order by pg_catalog.pg_get_function_identity_arguments(routine.oid)) as signatures,
        bool_or(
          pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('authenticated', routine.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('service_role', routine.oid, 'EXECUTE')
        ) as executable_by_application
      from pg_catalog.pg_proc as routine
      join pg_catalog.pg_namespace as namespace on namespace.oid = routine.pronamespace
      where namespace.nspname in ('public', 'academy_private')
      group by namespace.nspname, routine.proname
      having count(*) > 1
      order by namespace.nspname, routine.proname
    `)
    expect(overloads.rows).toEqual([
      {
        schema_name: 'academy_private',
        routine_name: 'admin_audit_value_is_safe',
        signatures: ['candidate jsonb', 'candidate_action text, candidate jsonb'],
        executable_by_application: false,
      },
      {
        schema_name: 'public',
        routine_name: 'academy_study_execute_session_lifecycle_v2',
        signatures: [
          'p_token_digest text, p_required_capability text, p_operation text, p_request jsonb',
          'p_token_digest text, p_required_capability text, p_operation text, p_request jsonb, p_actor_user_id uuid',
        ],
        executable_by_application: true,
      },
      {
        schema_name: 'public',
        routine_name: 'academy_study_execute_verified_runtime_v1',
        signatures: [
          'p_token_digest text, p_required_capability text, p_operation text, p_request jsonb',
          'p_token_digest text, p_required_capability text, p_operation text, p_request jsonb, p_actor_user_id uuid',
        ],
        executable_by_application: true,
      },
      {
        schema_name: 'public',
        routine_name: 'academy_study_verify_session_v1',
        signatures: [
          'p_token_digest text, p_required_capability text',
          'p_token_digest text, p_required_capability text, p_actor_user_id uuid',
        ],
        executable_by_application: true,
      },
    ])
  })
})

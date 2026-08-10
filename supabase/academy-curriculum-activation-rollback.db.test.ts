import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrations = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810140000_academy_curriculum_human_approval.sql',
  './migrations/20260810150000_academy_curriculum_release_staging.sql',
  './migrations/20260810160000_academy_curriculum_activation_rollback.sql',
].map((path) => new URL(path, import.meta.url))

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LEARNER_HOUSEHOLD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const RELEASE_1 = '16000000-0000-4000-8000-000000000001'
const RELEASE_2 = '26000000-0000-4000-8000-000000000002'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const databases: PGlite[] = []

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema academy_private;
  create table auth.users (id uuid primary key);
  create table public.profiles (
    household_id uuid not null,
    profile_id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (household_id, profile_id)
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create function academy_private.operational_is_trusted_server()
  returns boolean language sql stable set search_path = pg_catalog as $$
    select auth.uid() is null
      and coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('role', true), '')
      ) = 'service_role';
  $$;
  insert into auth.users (id) values
    ('${OWNER}'), ('${ADMIN}'), ('${VIEWER}'), ('${LEARNER_HOUSEHOLD}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

async function transition(database: PGlite, input: {
  actor?: string
  target?: string
  expected?: number
  kind?: 'activation' | 'rollback'
  request?: string
  digest?: string
}) {
  const kind = input.kind ?? 'activation'
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_transition_curriculum_pointer_v1(
        $1, $2, $3, $4, $5, $6, $7, 'releases:manage'
      ) as value
    `, [
      input.actor ?? OWNER,
      input.target ?? '2.0.0',
      input.expected ?? 1,
      kind,
      kind === 'activation' ? 'release.activated' : 'release.rolled_back',
      input.request ?? '50000000-0000-4000-8000-000000000001',
      input.digest ?? HASH_A,
    ])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function insertPublishedRelease(database: PGlite) {
  await database.exec(`
    insert into public.academy_curriculum_releases
    select
      '${RELEASE_2}'::uuid, package_id, '2.0.0', status,
      '2026-08-10 16:00:00+00'::timestamptz, '2026-08-10'::date,
      provenance_class, '${'b'.repeat(40)}',
      'curriculum-content/manuel-academy/2.0.0',
      '${'a'.repeat(64)}', '${'b'.repeat(64)}', '${'c'.repeat(64)}', '${'f'.repeat(64)}',
      5, 60,
      course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    from public.academy_curriculum_releases where version = '1.0.0';

    insert into public.academy_curriculum_release_files (
      release_id, relative_path, byte_count, sha256, content_type,
      safe_classification, immutable_locator
    ) values
      ('${RELEASE_2}', 'MANIFEST.json', 10, '${'a'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/MANIFEST.json'),
      ('${RELEASE_2}', 'SHA256SUMS.txt', 11, '${'b'.repeat(64)}', 'text/plain;charset=utf-8',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/SHA256SUMS.txt'),
      ('${RELEASE_2}', 'curriculum-manifest.json', 12, '${'c'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/curriculum-manifest.json'),
      ('${RELEASE_2}', 'validation/manifest-verification.txt', 13, '${'d'.repeat(64)}', 'text/plain;charset=utf-8',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/validation/manifest-verification.txt'),
      ('${RELEASE_2}', 'validation/validation.json', 14, '${'e'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/validation/validation.json');
  `)
}

async function insertStagedOnlyRelease(database: PGlite) {
  await database.exec(`
    insert into public.academy_curriculum_drafts (
      draft_id, base_release_id, target_version, authoring_schema_version,
      lifecycle_state, created_by, updated_by, create_request_id
    ) values (
      '31000000-0000-4000-8000-000000000001', '${RELEASE_1}', '3.0.0',
      '2.0.0', 'draft', '${ADMIN}', '${ADMIN}',
      '31000000-0000-4000-8000-000000000002'
    );
    insert into public.academy_curriculum_draft_validation_snapshots (
      validation_snapshot_id, draft_id, draft_revision, base_release_id,
      target_version, schema_set_version, engine_version, result_sha256,
      validation_status, publication_ready, blocking_count,
      blocking_error_count, human_review_blocker_count, validated_by
    ) values (
      '32000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', 'test-engine', '${HASH_A}', 'valid', true, 0, 0, 0, '${ADMIN}'
    );
    insert into public.academy_curriculum_draft_approval_decisions (
      approval_id, draft_id, draft_revision, base_release_id, target_version,
      schema_set_version, validation_snapshot_id, validation_result_sha256,
      decision, reason_code, decided_by, reviewer_role, request_id
    ) values (
      '33000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', '32000000-0000-4000-8000-000000000001', '${HASH_A}',
      'approved', 'approval.ready', '${OWNER}', 'owner',
      '33000000-0000-4000-8000-000000000002'
    );
    insert into public.academy_curriculum_staged_releases (
      staging_id, draft_id, draft_revision, base_release_id, target_version,
      schema_set_version, validation_snapshot_id, validation_result_sha256,
      approval_id, entity_counts, file_count, byte_count, content_sha256,
      manifest_sha256, package_sha256, manifest, manifest_canonical,
      staged_by, request_id
    ) values (
      '34000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', '32000000-0000-4000-8000-000000000001', '${HASH_A}',
      '33000000-0000-4000-8000-000000000001', '{}'::jsonb, 1, 2,
      '${HASH_A}', '${HASH_B}', '${'c'.repeat(64)}', '{}'::jsonb, '{}',
      '${OWNER}', '34000000-0000-4000-8000-000000000002'
    );
  `)
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrap)
  for (const migration of migrations) await database.exec(await readFile(migration, 'utf8'))
  await database.exec(`
    insert into public.academy_admin_role_assignments (user_id, role, assignment_reason_code)
    values
      ('${OWNER}', 'owner', 'test.owner'),
      ('${ADMIN}', 'admin', 'test.admin'),
      ('${VIEWER}', 'viewer', 'test.viewer');
    insert into public.profiles (household_id, profile_id, data)
    values (
      '${LEARNER_HOUSEHOLD}', 'learner-one',
      '{"academy":{"releaseVersion":"1.0.0"}}'::jsonb
    );
  `)
  await insertPublishedRelease(database)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum activation and rollback database boundary', () => {
  it('activates only an artifact-complete immutable PUBLISHED release with pointer CAS', async () => {
    const database = databases[0]
    const releaseBefore = (await database.query(
      "select * from public.academy_curriculum_releases where version = '2.0.0'",
    )).rows[0]
    const result = await transition(database, {})
    expect(result).toMatchObject({
      replayed: false,
      existingLearnersRepinned: false,
      pointer: {
        releaseVersion: '2.0.0', revision: 2,
        transitionKind: 'activation', bindingMode: 'default_authority',
      },
      transition: {
        state: 'transitioned', transitionKind: 'activation',
        previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        pointerRevision: 2,
      },
    })
    expect((await database.query(
      "select * from public.academy_curriculum_releases where version = '2.0.0'",
    )).rows[0]).toEqual(releaseBefore)
    await expect(transition(database, {
      target: '1.0.0', expected: 1, kind: 'rollback', request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_ACTIVATION_POINTER_CONFLICT')
  })

  it('rejects staged-only, nonexistent, and missing-artifact targets', async () => {
    const database = databases[0]
    await insertStagedOnlyRelease(database)
    await expect(transition(database, { target: '3.0.0' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_TARGET_NOT_PUBLISHED')
    await expect(transition(database, { target: '9.9.9' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_TARGET_NOT_FOUND')

    await database.exec(`
      insert into public.academy_curriculum_releases
      select
        '46000000-0000-4000-8000-000000000004'::uuid, package_id, '4.0.0', status,
        registered_at, authored_on, provenance_class, source_commit,
        'curriculum-content/manuel-academy/4.0.0',
        package_manifest_sha256, checksum_manifest_sha256, curriculum_manifest_sha256,
        file_inventory_sha256, file_count, byte_count,
        course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      from public.academy_curriculum_releases where version = '1.0.0';
    `)
    await expect(transition(database, { target: '4.0.0' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE')
  })

  it('makes exact replay safe, rejects changed reuse, and returns an already-active no-op', async () => {
    const database = databases[0]
    const noop = await transition(database, { target: '1.0.0' })
    const noopReplay = await transition(database, { target: '1.0.0' })
    expect(noop.transition.state).toBe('no_op')
    expect(noop.pointer.revision).toBe(1)
    expect(noopReplay).toMatchObject({ replayed: true, transition: { state: 'no_op' } })
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_pointer_transitions',
    )).rows[0]).toEqual({ count: 1 })
    await expect(transition(database, { target: '1.0.0', digest: HASH_B }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_REPLAY_CONFLICT')
  })

  it('allows one concurrent CAS winner and rejects the stale contender', async () => {
    const database = databases[0]
    const outcomes = await Promise.allSettled([
      transition(database, { request: '51000000-0000-4000-8000-000000000001' }),
      transition(database, { request: '51000000-0000-4000-8000-000000000002' }),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    expect(String((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason))
      .toContain('CURRICULUM_ACTIVATION_POINTER_CONFLICT')
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_pointer_transitions',
    )).rows[0]).toEqual({ count: 2 })
  })

  it('rolls back as a new revision and preserves releases, history, and learner pins', async () => {
    const database = databases[0]
    const learnerBefore = (await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]
    await transition(database, {})
    const rollback = await transition(database, {
      target: '1.0.0', expected: 2, kind: 'rollback',
      request: '52000000-0000-4000-8000-000000000002',
    })
    expect(rollback).toMatchObject({
      pointer: { releaseVersion: '1.0.0', revision: 3, transitionKind: 'rollback' },
      transition: {
        state: 'transitioned', transitionKind: 'rollback',
        previousReleaseVersion: '2.0.0', newReleaseVersion: '1.0.0',
      },
    })
    expect(rollback.history.map((entry: any) => [entry.pointerRevision, entry.transitionKind]))
      .toEqual([[3, 'rollback'], [2, 'activation'], [1, 'migration_seed']])
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_releases',
    )).rows[0]).toEqual({ count: 2 })
    expect((await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]).toEqual(learnerBefore)
  })

  it('reauthorizes releases:manage in the DB and requires a current assignment', async () => {
    const database = databases[0]
    await expect(transition(database, { actor: ADMIN }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_REQUIRED')
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = statement_timestamp(),
          revoked_by = '${OWNER}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${OWNER}';
    `)
    await expect(transition(database, {})).rejects.toThrow('CURRICULUM_ACTIVATION_REQUIRED')
    expect((await database.query(
      'select revision from public.academy_curriculum_active_pointers where environment = \'production\'',
    )).rows[0]).toEqual({ revision: 1 })
  })

  it('writes bounded audit metadata and keeps history/receipts append-only and private', async () => {
    const database = databases[0]
    const result = await transition(database, {})
    const event = (await database.query<any>(`
      select action, resource_type, resource_ref, resource_version,
        resource_revision, previous_value, new_value, reason_code, correlation_id
      from academy_private.admin_audit_events
      where action = 'release.activate'
    `)).rows[0]
    expect(event).toMatchObject({
      action: 'release.activate',
      resource_type: 'application_release',
      resource_ref: 'curriculum:production',
      resource_version: '2.0.0',
      resource_revision: '2',
      previous_value: { state: 'active', release: '1.0.0', revision: 1 },
      new_value: { state: 'active', release: '2.0.0', revision: 2, status: 'activation' },
      reason_code: 'release.activated',
      correlation_id: '50000000-0000-4000-8000-000000000001',
    })
    expect(JSON.stringify(event)).not.toMatch(/payload|lesson|assessment|profile/i)
    expect(result.history[0].correlationId).toBe(event.correlation_id)

    await expect(database.exec('delete from public.academy_curriculum_pointer_transitions'))
      .rejects.toThrow('append-only')
    await expect(database.exec('update academy_private.curriculum_pointer_request_receipts set response = response'))
      .rejects.toThrow('append-only')
    for (const table of [
      'public.academy_curriculum_pointer_transitions',
      'academy_private.curriculum_pointer_request_receipts',
    ]) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privilege = await database.query<{ allowed: boolean }>(
          "select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') allowed",
          [role, table],
        )
        expect(privilege.rows[0].allowed, `${role}:${table}`).toBe(false)
      }
    }
  })

  it('pins the repository-only migration custody hash', async () => {
    const migrationBytes = await readFile(migrations.at(-1)!)
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-activation-rollback-migration.json', import.meta.url),
      'utf8',
    ))
    expect(custody.status).toBe('repository-only-not-applied-hosted')
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})

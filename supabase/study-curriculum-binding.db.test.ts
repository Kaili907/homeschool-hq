import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './tests/study_engine_fixtures.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810153000_academy_study_release_registry_bridge.sql',
] as const

const sql = Promise.all(files.map((path) =>
  readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const RELEASE_ID = '16000000-0000-4000-8000-000000000001'
const RELEASE_2_ID = '26000000-0000-4000-8000-000000000002'
const MANIFEST_SHA =
  '54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b'
const MANIFEST_2_SHA = 'b'.repeat(64)

let database: PGlite
let sessionDigest: string

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  run: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) })
    .replaceAll("'", "''")
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await run()
  } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
      select set_config('request.jwt.claim.role', '', false);
    `)
  }
}

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function guardian<T>(subject: string, operation: () => Promise<T>) {
  return asRole('authenticated', subject, operation)
}

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, operation)
}

async function runtime(
  capability: string,
  operation: string,
  request: Record<string, unknown>,
) {
  return service(() => rpc<{
    schemaVersion: number
    status: string
    operation: string
    body: Record<string, unknown>
  }>(`
    select public.academy_study_execute_verified_runtime_v1(
      $1::text, $2::text, $3::text, $4::jsonb
    ) as result
  `, [sessionDigest, capability, operation, JSON.stringify(request)]))
}

function sessionBegin(
  id: string,
  releaseVersion: unknown,
  lessonId = `lesson-${id}`,
) {
  return runtime('student:attempts:create', 'session:begin', {
    session: {
      id,
      schema_version: 1,
      lesson_id: lessonId,
      subject_id: 'math',
      study_plan_id: null,
      state: 'active',
      started_at: '2026-08-10T15:00:00.000Z',
      completed_at: null,
      intended_local_date: '2026-08-10',
    },
    idempotencyKey: `${id}-create`,
    curriculumContext: {
      releaseVersion,
      lessonRef: lessonId,
      skillRefs: [`skill-${id}`],
    },
  })
}

async function registerRelease2() {
  await database.exec(`
    insert into public.academy_curriculum_releases (
      release_id, package_id, version, status, registered_at, authored_on,
      provenance_class, source_commit, source_root,
      package_manifest_sha256, checksum_manifest_sha256,
      curriculum_manifest_sha256, file_inventory_sha256,
      file_count, byte_count, course_count, unit_count, lesson_count,
      assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    )
    select
      '${RELEASE_2_ID}', 'manuel-academy-grades-5-7-8-curriculum-v2',
      '2.0.0', 'published', '2026-08-10T15:35:00Z', '2026-08-10',
      'legacy_import', '${'2'.repeat(40)}',
      'curriculum-content/manuel-academy/2.0.0',
      '${'a'.repeat(64)}', '${'c'.repeat(64)}', '${MANIFEST_2_SHA}',
      '${'d'.repeat(64)}',
      1, 1, course_count, unit_count, lesson_count,
      assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    from public.academy_curriculum_releases
    where version = '1.0.0';
    insert into public.academy_curriculum_release_files (
      release_id, relative_path, byte_count, sha256, content_type,
      safe_classification, immutable_locator
    ) values (
      '${RELEASE_2_ID}', 'curriculum-manifest.json', 1,
      '${MANIFEST_2_SHA}', 'application/json',
      'metadata_only_internal_source',
      'git_commit_path:${'2'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/curriculum-manifest.json'
    );
  `)
}

async function appendProductionPointer(
  releaseId: string,
  revision: number,
  changeKind: 'activate' | 'rollback',
  registeredAt: string,
) {
  await database.exec(`
    insert into public.academy_curriculum_active_pointers (
      environment, release_id, revision, change_kind, binding_mode,
      registered_at
    ) values (
      'production', '${releaseId}', ${revision}, '${changeKind}',
      'study_new_sessions', '${registeredAt}'
    )
  `)
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  const sources = await sql
  for (const [index, source] of sources.entries()) {
    try {
      await database.exec(source)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id = '00000000-0000-0000-0000-0000000001a1'::uuid;
    insert into public.academy_subject_enrollments (
      id, household_id, student_id, school_year_key, subject_key,
      instructional_level, course_id, curriculum_version,
      enrollment_status, starts_on, placement_source
    ) values (
      '15000000-0000-4000-8000-000000000001',
      '${HOUSEHOLD_A}', '${STUDENT_A}', '2026-2027', 'mathematics',
      'grade-5', 'ma-g5-mathematics', '1.0.0',
      'active', '2026-08-01', 'parent'
    );
  `)
  const issued = await guardian(GUARDIAN_A, () => rpc<{
    sessionReference: string
  }>(
    'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
    ['academy-student-id', STUDENT_A],
  ))
  sessionDigest = createHash('sha256')
    .update(issued.sessionReference, 'ascii')
    .digest('hex')
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study immutable curriculum release binding', () => {
  it('uses the immutable Admin registry directly and reports binding readiness', async () => {
    const readiness = await service(() => rpc<Record<string, unknown>>(
      'select public.academy_study_curriculum_binding_readiness_v1() as result',
    ))
    expect(readiness).toEqual({ schemaVersion: 1, status: 'ready' })

    const custody = await database.query<{
      release_id: string
      version: string
      curriculum_manifest_sha256: string
      curriculum_binding_version: number
      browser_grants: number
      private_approval: string | null
      pointer_revision: number
      pointer_mode: string
    }>(`
      select release.release_id, release.version,
        release.curriculum_manifest_sha256,
        metadata.curriculum_binding_version,
        (select count(*)::integer
          from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name in (
              'academy_curriculum_releases',
              'academy_curriculum_active_pointers'
            )
            and grantee in ('anon', 'authenticated', 'service_role'))
          as browser_grants,
        to_regclass('academy_private.study_curriculum_release_approvals')::text
          as private_approval,
        pointer.revision as pointer_revision,
        pointer.binding_mode as pointer_mode
      from public.academy_curriculum_releases as release
      cross join academy_private.study_persistence_metadata as metadata
      join public.academy_curriculum_active_pointers as pointer
        on pointer.release_id = release.release_id
       and pointer.environment = 'production'
       and pointer.revision = 2
      where metadata.singleton and release.version = '1.0.0'
    `)
    expect(custody.rows).toEqual([{
      release_id: RELEASE_ID,
      version: '1.0.0',
      curriculum_manifest_sha256: MANIFEST_SHA,
      curriculum_binding_version: 2,
      browser_grants: 0,
      private_approval: null,
      pointer_revision: 2,
      pointer_mode: 'study_new_sessions',
    }])
    await expect(database.exec(`
      update public.academy_curriculum_releases
      set version = '1.0.1'
      where release_id = '${RELEASE_ID}'::uuid
    `)).rejects.toThrow(/immutable/i)
    await expect(database.exec(`
      update public.academy_curriculum_active_pointers
      set release_id = '${RELEASE_2_ID}'::uuid
      where environment = 'production' and revision = 2
    `)).rejects.toThrow(/immutable/i)
    await expect(database.exec(`
      insert into public.academy_curriculum_active_pointers (
        environment, release_id, revision, change_kind, binding_mode,
        registered_at
      ) values (
        'production', '${RELEASE_ID}', 4, 'activate',
        'study_new_sessions', '2026-08-10T15:31:00Z'
      )
    `)).rejects.toThrow(/revision/i)
  })

  it('resolves and snapshots a new session binding on the trusted server', async () => {
    const result = await sessionBegin('session-bound-a', '1.0.0')
    expect(result).toMatchObject({
      schemaVersion: 1,
      status: 'ok',
      operation: 'session:begin',
      body: {
        status: 'created',
        curriculumBinding: {
          schemaVersion: 1,
          status: 'bound',
          releaseId: RELEASE_ID,
          packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
          releaseVersion: '1.0.0',
          curriculumManifestSha256: MANIFEST_SHA,
        },
      },
    })
    const stored = await database.query<{
      curriculum_binding_schema_version: number
      curriculum_release_id: string
      curriculum_package_id: string
      curriculum_release_version: string
      curriculum_manifest_sha256: string
    }>(`
      select curriculum_binding_schema_version, curriculum_release_id,
        curriculum_package_id, curriculum_release_version,
        curriculum_manifest_sha256
      from public.academy_study_sessions
      where id = 'session-bound-a'
    `)
    expect(stored.rows[0]).toEqual({
      curriculum_binding_schema_version: 1,
      curriculum_release_id: RELEASE_ID,
      curriculum_package_id: 'manuel-academy-grades-5-7-8-curriculum-v1',
      curriculum_release_version: '1.0.0',
      curriculum_manifest_sha256: MANIFEST_SHA,
    })
    await expect(database.exec(`
      insert into public.academy_study_sessions (
        id, schema_version, household_id, student_id, lesson_id, subject_id,
        study_plan_id, state, started_at, completed_at,
        intended_local_date, household_timezone, created_by,
        curriculum_binding_schema_version, curriculum_release_id,
        curriculum_package_id, curriculum_release_version,
        curriculum_manifest_sha256
      )
      select
        'session-forged-manifest', schema_version, household_id, student_id,
        'lesson-forged-manifest', subject_id, study_plan_id, state, started_at,
        completed_at, intended_local_date, household_timezone, created_by,
        curriculum_binding_schema_version, curriculum_release_id,
        curriculum_package_id, curriculum_release_version, '${'f'.repeat(64)}'
      from public.academy_study_sessions
      where id = 'session-bound-a'
    `)).rejects.toThrow(/foreign key|constraint/i)
    expect((await database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_study_sessions
      where id = 'session-forged-manifest'
    `)).rows[0].count).toBe(0)
  })

  it('returns bounded missing, unsupported, unavailable, and mismatch results', async () => {
    const missing = await guardian(GUARDIAN_A, () => rpc<Record<string, unknown>>(`
      select public.academy_study_create_session(
        jsonb_build_object(
          'id', 'session-missing-release', 'schema_version', 1,
          'student_id', '${STUDENT_A}', 'lesson_id', 'lesson-missing',
          'subject_id', 'math', 'study_plan_id', null, 'state', 'active',
          'started_at', '2026-08-10T15:00:00Z', 'completed_at', null,
          'intended_local_date', '2026-08-10'
        ), 'session-missing-release-create'
      ) as result
    `))
    expect(missing).toEqual({
      schemaVersion: 1,
      status: 'unavailable',
      reasonCode: 'curriculum-release-missing',
    })
    await expect(sessionBegin('session-unsupported', '9.9.9')).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-unsupported' },
    })
    await expect(database.exec(`
      insert into public.academy_curriculum_releases (
        release_id, package_id, version, status, registered_at,
        provenance_class, source_commit, source_root,
        package_manifest_sha256, checksum_manifest_sha256,
        curriculum_manifest_sha256, file_inventory_sha256,
        file_count, byte_count, course_count, unit_count, lesson_count,
        assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      )
      select
        '36000000-0000-4000-8000-000000000003', 'draft-package',
        '3.0.0', 'draft', '2026-08-10T15:34:00Z',
        provenance_class, '${'3'.repeat(40)}',
        'curriculum-content/manuel-academy/3.0.0',
        package_manifest_sha256, checksum_manifest_sha256,
        curriculum_manifest_sha256, file_inventory_sha256,
        file_count, byte_count, course_count, unit_count, lesson_count,
        assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      from public.academy_curriculum_releases where version = '1.0.0'
    `)).rejects.toThrow()
    await expect(sessionBegin('session-draft', '3.0.0')).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-unsupported' },
    })

    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = null
      where id = '15000000-0000-4000-8000-000000000001'::uuid
    `)
    const unavailable = await guardian(GUARDIAN_A, () => rpc<Record<string, unknown>>(`
      select public.academy_study_resolve_curriculum_binding_v1(
        '${STUDENT_A}', 'math', '2026-08-10', '1.0.0'
      ) as result
    `))
    expect(unavailable).toMatchObject({
      status: 'unavailable', reasonCode: 'curriculum-release-unavailable',
    })
    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '1.0.0'
      where id = '15000000-0000-4000-8000-000000000001'::uuid;
    `)
    await registerRelease2()
    await expect(sessionBegin('session-mismatch', '2.0.0')).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    expect((await database.query<{ count: number }>(`
      select count(*)::integer as count from public.academy_study_sessions
      where id in (
        'session-missing-release', 'session-unsupported', 'session-draft',
        'session-mismatch'
      )
    `)).rows[0].count).toBe(0)
  })

  it('never repins and requires the original release for resume operations', async () => {
    await expect(database.exec(`
      update public.academy_study_sessions
      set curriculum_release_version = '2.0.0'
      where id = 'session-bound-a'
    `)).rejects.toThrow(/immutable/i)
    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '2.0.0'
      where id = '15000000-0000-4000-8000-000000000001'::uuid;
      insert into public.academy_study_calendar_blocks (
        id, household_id, student_id, block_type, source_reference,
        scheduled_start, intended_local_date, household_timezone,
        explicit_offset, duration_minutes, completion_units, required_units,
        resume_session_id, resume_segment_id, state, idempotency_key
      ) values (
        'calendar-bound-resume', '${HOUSEHOLD_A}', '${STUDENT_A}',
        'resume', 'session-bound-a', '2026-08-10T16:00:00Z',
        '2026-08-10', 'America/New_York', -240, 30, 0, 1,
        'session-bound-a', 'segment-bound-a', 'scheduled',
        'calendar-bound-resume-create'
      )
    `)
    await appendProductionPointer(
      RELEASE_2_ID, 3, 'activate', '2026-08-10T15:40:00Z',
    )

    await expect(runtime('student:progress:read', 'checkpoint:read', {
      sessionId: 'session-bound-a',
      curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    await expect(runtime('student:progress:read', 'checkpoint:read', {
      sessionId: 'session-bound-a',
      curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'not-found',
        curriculumBinding: { status: 'bound', releaseVersion: '1.0.0' },
      },
    })
    const calendar = await runtime('student:assignments:read', 'calendar:read', {
      cursor: null,
    })
    expect((calendar.body.blocks as Array<Record<string, unknown>>)
      .find(({ blockId }) => blockId === 'calendar-bound-resume')).toMatchObject({
      resumeSessionId: 'session-bound-a',
      resumeCurriculumBinding: { status: 'bound', releaseVersion: '1.0.0' },
    })
    await expect(sessionBegin('session-after-update-old', '1.0.0')).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    await expect(sessionBegin('session-after-update-new', '2.0.0')).resolves.toMatchObject({
      body: {
        status: 'created',
        curriculumBinding: { status: 'bound', releaseVersion: '2.0.0' },
      },
    })
    await appendProductionPointer(
      RELEASE_ID, 4, 'rollback', '2026-08-10T15:50:00Z',
    )
    const pointer = await service(() => rpc<Record<string, unknown>>(`
      select public.academy_admin_read_curriculum_production_pointer_v1(
        'curriculum:read'
      ) as result
    `))
    expect(pointer).toMatchObject({
      releaseVersion: '1.0.0',
      revision: 4,
      changeKind: 'rollback',
      bindingMode: 'study_new_sessions',
      registryOnly: false,
      runtimeBinding: 'study-new-sessions',
    })
    await database.exec(`
      update public.academy_subject_enrollments
      set curriculum_version = '1.0.0'
      where id = '15000000-0000-4000-8000-000000000001'::uuid
    `)
    await expect(runtime('student:progress:read', 'checkpoint:read', {
      sessionId: 'session-after-update-new',
      curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: {
        curriculumBinding: { status: 'bound', releaseVersion: '2.0.0' },
      },
    })
    await expect(sessionBegin('session-after-rollback-newer', '2.0.0')).resolves.toMatchObject({
      body: { status: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    await expect(sessionBegin('session-after-rollback-restored', '1.0.0')).resolves.toMatchObject({
      body: {
        status: 'created',
        curriculumBinding: { status: 'bound', releaseVersion: '1.0.0' },
      },
    })
    const pinned = await database.query<{
      id: string
      curriculum_release_version: string
    }>(`
      select id, curriculum_release_version
      from public.academy_study_sessions
      where id in (
        'session-bound-a', 'session-after-update-new',
        'session-after-rollback-restored'
      )
      order by id
    `)
    expect(pinned.rows).toEqual([
      { id: 'session-after-rollback-restored', curriculum_release_version: '1.0.0' },
      { id: 'session-after-update-new', curriculum_release_version: '2.0.0' },
      { id: 'session-bound-a', curriculum_release_version: '1.0.0' },
    ])
  })

  it('classifies legacy sessions for manual review without fabricating a release', async () => {
    const dashboard = await runtime(
      'student:progress:read', 'dashboard:read', {},
    )
    const sessions = dashboard.body.sessions as Array<Record<string, unknown>>
    expect(sessions.find(({ sessionId }) => sessionId === 'session-a')).toMatchObject({
      curriculumBinding: {
        schemaVersion: 1,
        status: 'manual-review',
        reasonCode: 'legacy-curriculum-binding-ambiguous',
      },
    })
    expect(sessions.find(({ sessionId }) => sessionId === 'session-bound-a')).toMatchObject({
      curriculumBinding: { status: 'bound', releaseVersion: '1.0.0' },
    })
    await expect(runtime('student:progress:read', 'checkpoint:read', {
      sessionId: 'session-a',
      curriculumReleaseVersion: '2.0.0',
    })).resolves.toMatchObject({
      body: {
        status: 'manual-review',
        reasonCode: 'legacy-curriculum-binding-ambiguous',
      },
    })
  })

  it('keeps adult-review lineage on the same immutable source session binding', async () => {
    await service(() => rpc(`
      select public.academy_study_create_adult_review_proposal_v1($1::jsonb)
        as result
    `, [JSON.stringify({
      schemaVersion: 1,
      proposalId: 'proposal-bound-a',
      householdId: HOUSEHOLD_A,
      studentId: STUDENT_A,
      sessionId: 'session-bound-a',
      category: 'student-support',
      classification: 'uncertain',
      urgency: 'uncertain',
      reasonCodes: ['binding-review-required'],
      classifierVersion: 'binding-classifier-v1',
      occurredAt: '2026-08-10T15:10:00.000Z',
      idempotencyKey: 'proposal-bound-a-create',
      deliveryState: 'proposed-not-delivered',
      authorizedRecipientResolutionState: 'pending',
    })]))
    const lineage = await database.query<{
      session_id: string
      release_version: string
      proposal_binding_columns: number
    }>(`
      select proposal.session_id,
        session.curriculum_release_version as release_version,
        (select count(*)::integer
          from information_schema.columns
          where table_schema = 'academy_private'
            and table_name = 'study_adult_review_proposals_v1'
            and column_name like 'curriculum%') as proposal_binding_columns
      from academy_private.study_adult_review_proposals_v1 as proposal
      join public.academy_study_sessions as session
        on session.id = proposal.session_id
       and session.household_id = proposal.household_id
       and session.student_id = proposal.student_id
      where proposal.proposal_id = 'proposal-bound-a'
    `)
    expect(lineage.rows).toEqual([{
      session_id: 'session-bound-a',
      release_version: '1.0.0',
      proposal_binding_columns: 0,
    }])
  })

  it('keeps authority private and Effective Settings V2 ready', async () => {
    await expect(guardian(GUARDIAN_B, () => rpc(`
      select public.academy_study_resolve_curriculum_binding_v1(
        '${STUDENT_A}', 'math', '2026-08-10', '2.0.0'
      ) as result
    `))).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(asRole('anon', null, () => rpc(`
      select public.academy_study_resolve_curriculum_binding_v1(
        '${STUDENT_A}', 'math', '2026-08-10', '2.0.0'
      ) as result
    `))).rejects.toThrow()
    for (const role of ['authenticated', 'service_role'] as const) {
      await expect(asRole(role, role === 'authenticated' ? GUARDIAN_A : null, () =>
        database.exec(`
          insert into public.academy_curriculum_active_pointers (
            environment, release_id, revision, change_kind, binding_mode,
            registered_at
          ) values (
            'production', '${RELEASE_2_ID}', 5, 'activate',
            'study_new_sessions', '2026-08-10T16:00:00Z'
          )
        `))).rejects.toThrow()
    }

    const settings = await guardian(GUARDIAN_A, () => rpc<Record<string, unknown>>(`
      select public.academy_study_effective_settings_v2(
        '${STUDENT_A}', '2026-08-10'
      ) as result
    `))
    expect(settings).toMatchObject({
      schemaVersion: 2,
      status: 'ready',
      studentId: STUDENT_A,
    })
    expect(JSON.stringify(settings)).not.toMatch(/curriculum|release|manifest/i)
  })
})

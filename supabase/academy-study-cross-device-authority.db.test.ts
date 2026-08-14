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
  './migrations/20260810120200_academy_study_effective_settings_v2.sql',
  './migrations/20260810150000_academy_study_curriculum_binding.sql',
  './migrations/20260810151000_academy_study_session_semantics_v2.sql',
  './migrations/20260810153000_academy_study_release_registry_bridge.sql',
  './migrations/20260813170000_academy_study_actor_authority_convergence.sql',
  './migrations/20260813171000_academy_study_cross_device_authority.sql',
] as const

const sql = Promise.all(files.map((filename) =>
  readFile(new URL(filename, import.meta.url), 'utf8')))

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const SIBLING_A = '00000000-0000-0000-0000-000000000102'

let database: PGlite
let digestA: string
let digestB: string
let grantA: string

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
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub',
        ''
      )::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  principalKind: 'guardian' | 'student' | null,
  operation: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({
    role,
    ...(subject ? { sub: subject } : {}),
    ...(principalKind === 'student'
      ? { academy_principal_kind: 'student_session_grant' }
      : {}),
  }).replaceAll("'", "''")
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    select set_config('request.jwt.claim.role', '${role}', false);
    set role ${role};
  `)
  try {
    return await operation()
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

function guardian<T>(guardianId: string, operation: () => Promise<T>) {
  return asRole('authenticated', guardianId, 'guardian', operation)
}

function student<T>(grantId: string, operation: () => Promise<T>) {
  return asRole('authenticated', grantId, 'student', operation)
}

function service<T>(operation: () => Promise<T>) {
  return asRole('service_role', null, null, operation)
}

async function issue(guardianId: string, studentId: string) {
  return guardian(guardianId, () => rpc<{
    sessionReference: string
    grantId: string
  }>(
    'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
    ['academy-student-id', studentId],
  ))
}

async function write(
  tokenDigest: string,
  studentId: string,
  assignmentRef: string,
  sessionId: string,
  expectedRevision: number,
  clientOperationId: string,
  operation: string,
  payload: Record<string, unknown>,
) {
  return rpc<Record<string, unknown>>(`
    select public.academy_study_sync_write_v1(
      $1::text, $2::uuid, $3::text, $4::text,
      $5::bigint, $6::uuid, $7::text, $8::jsonb
    ) as result
  `, [
    tokenDigest,
    studentId,
    assignmentRef,
    sessionId,
    expectedRevision,
    clientOperationId,
    operation,
    JSON.stringify(payload),
  ])
}

async function hydrate(studentId: string, assignmentRef: string, sessionId: string) {
  return rpc<Record<string, unknown>>(`
    select public.academy_study_sync_hydrate_v1(
      $1::uuid, $2::text, $3::text
    ) as result
  `, [studentId, assignmentRef, sessionId])
}

function checkpoint(revision: number) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint-sync-a',
    revision,
    createdAt: '2026-08-13T14:01:00.000Z',
    updatedAt: '2026-08-13T14:02:00.000Z',
    sessionId: 'session-a',
    lessonId: 'lesson-a',
    segmentId: 'segment-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: ['segment-a'],
    perSegmentActiveTime: [{ segmentId: 'segment-a', activeSeconds: 15 }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:session-a',
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-a',
    technicalInterruption: {
      status: 'none',
      interruptionId: null,
      category: 'none',
      startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const [index, source] of (await sql).entries()) {
    try {
      await database.exec(source)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in (
      '00000000-0000-0000-0000-0000000001a1',
      '00000000-0000-0000-0000-0000000001b1'
    );
    insert into public.academy_students (
      id, household_id, display_name, lifecycle_status, created_by
    ) values (
      '${SIBLING_A}',
      '00000000-0000-0000-0000-000000000011',
      'Study Sibling A',
      'active',
      '${GUARDIAN_A}'
    );
    insert into public.academy_guardian_student_access (
      id, household_id, student_id, membership_id, permission_level,
      status, granted_by
    ) values (
      '00000000-0000-0000-0000-0000000001a2',
      '00000000-0000-0000-0000-000000000011',
      '${SIBLING_A}',
      '00000000-0000-0000-0000-0000000000a2',
      'identity_manager',
      'active',
      '${GUARDIAN_A}'
    );
    insert into public.academy_study_sessions (
      id, household_id, student_id, lesson_id, subject_id, state,
      started_at, intended_local_date, household_timezone, created_by
    ) values (
      'session-a-sibling',
      '00000000-0000-0000-0000-000000000011',
      '${SIBLING_A}',
      'lesson-a-sibling',
      'math',
      'active',
      '2026-08-01T14:00:00Z',
      '2026-08-01',
      'UTC',
      '${GUARDIAN_A}'
    );
  `)
  const launchA = await issue(GUARDIAN_A, STUDENT_A)
  const launchB = await issue(GUARDIAN_B, STUDENT_B)
  digestA = createHash('sha256')
    .update(launchA.sessionReference, 'ascii')
    .digest('hex')
  digestB = createHash('sha256')
    .update(launchB.sessionReference, 'ascii')
    .digest('hex')
  const storedGrant = await database.query<{ id: string }>(`
    select id
    from academy_private.student_session_grants
    where token_digest = $1
  `, [digestA])
  grantA = storedGrant.rows[0].id
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study hosted cross-device database authority', () => {
  it('applies the new leases with forced RLS and narrow function ACLs', async () => {
    const result = await database.query<{
      actor_binding_version: number
      cross_device_authority_version: number
      row_security: boolean
      forced_row_security: boolean
      policy_count: number
      authenticated_hydrate: boolean
      authenticated_write: boolean
      service_write: boolean
      actor_verifier: string
      runtime_actor_overload: string
      lifecycle_actor_overload: string
    }>(`
      select
        metadata.actor_binding_version,
        metadata.cross_device_authority_version,
        relation.relrowsecurity as row_security,
        relation.relforcerowsecurity as forced_row_security,
        (
          select count(*)::integer
          from pg_catalog.pg_policy
          where polrelid = relation.oid
        ) as policy_count,
        has_function_privilege(
          'authenticated',
          'public.academy_study_sync_hydrate_v1(uuid,text,text)',
          'execute'
        ) as authenticated_hydrate,
        has_function_privilege(
          'authenticated',
          'public.academy_study_sync_write_v1(text,uuid,text,text,bigint,uuid,text,jsonb)',
          'execute'
        ) as authenticated_write,
        has_function_privilege(
          'service_role',
          'public.academy_study_sync_write_v1(text,uuid,text,text,bigint,uuid,text,jsonb)',
          'execute'
        ) as service_write,
        to_regprocedure(
          'public.academy_study_verify_session_v1(text,text,uuid)'
        )::text as actor_verifier,
        to_regprocedure(
          'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb,uuid)'
        )::text as runtime_actor_overload,
        to_regprocedure(
          'public.academy_study_execute_session_lifecycle_v2(text,text,text,jsonb,uuid)'
        )::text as lifecycle_actor_overload
      from academy_private.study_persistence_metadata as metadata
      cross join pg_catalog.pg_class as relation
      where metadata.singleton
        and relation.oid = 'public.academy_study_session_authority'::regclass
    `)

    expect(result.rows[0]).toMatchObject({
      actor_binding_version: 1,
      cross_device_authority_version: 1,
      row_security: true,
      forced_row_security: true,
      policy_count: 4,
      authenticated_hydrate: true,
      authenticated_write: true,
      service_write: false,
    })
    expect(result.rows[0].actor_verifier).toContain('uuid')
    expect(result.rows[0].runtime_actor_overload).toContain('uuid')
    expect(result.rows[0].lifecycle_actor_overload).toContain('uuid')
  })

  it('retains the legacy verifier while binding the actor-aware verifier', async () => {
    const correct = await service(() => rpc<Record<string, unknown>>(`
      select public.academy_study_verify_session_v1(
        $1::text, 'student:progress:read', $2::uuid
      ) as result
    `, [digestA, GUARDIAN_A]))
    const wrong = await service(() => rpc<Record<string, unknown>>(`
      select public.academy_study_verify_session_v1(
        $1::text, 'student:progress:read', $2::uuid
      ) as result
    `, [digestA, GUARDIAN_B]))
    const missing = await service(() => rpc<Record<string, unknown>>(`
      select public.academy_study_verify_session_v1(
        $1::text, 'student:progress:read', null::uuid
      ) as result
    `, [digestA]))

    expect(correct).toMatchObject({
      status: 'verified',
      studentId: STUDENT_A,
    })
    expect(wrong).toMatchObject({
      status: 'denied',
      code: 'student-session-invalid',
    })
    expect(missing).toMatchObject({
      status: 'denied',
      code: 'student-session-invalid',
    })

    const retained = await database.query<{ retained: boolean }>(`
      select to_regprocedure(
        'public.academy_study_verify_session_v1(text,text)'
      ) is not null as retained
    `)
    expect(retained.rows[0].retained).toBe(true)
  })

  it('uses RLS to isolate guardians and current student principals', async () => {
    const guardianA = await guardian(GUARDIAN_A, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))
    const guardianB = await guardian(GUARDIAN_B, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))
    const learnerA = await student(grantA, () => database.query<{ session_id: string }>(`
      select session_id from public.academy_study_session_authority order by session_id
    `))

    expect(guardianA.rows.map(({ session_id }) => session_id)).toEqual([
      'session-a',
      'session-a-sibling',
    ])
    expect(guardianB.rows.map(({ session_id }) => session_id)).toEqual(['session-b'])
    expect(learnerA.rows.map(({ session_id }) => session_id)).toEqual(['session-a'])

    const crossHousehold = await guardian(GUARDIAN_A, () =>
      hydrate(STUDENT_B, 'lesson-b', 'session-b'))
    const sibling = await student(grantA, () =>
      hydrate(SIBLING_A, 'lesson-a-sibling', 'session-a-sibling'))
    expect(crossHousehold).toMatchObject({ status: 'unavailable' })
    expect(sibling).toMatchObject({ status: 'unavailable' })
  })

  it('fails closed on missing actor and wrong household, student, assignment or session binding', async () => {
    await expect(asRole('authenticated', null, 'guardian', () =>
      hydrate(STUDENT_A, 'lesson-a', 'session-a')))
      .rejects.toThrow(/STUDY_AUTH_REQUIRED/)
    await database.exec('rollback')

    await expect(guardian(GUARDIAN_A, () => rpc(`
      select public.academy_study_sync_write_v1(
        $1::text, $2::uuid, 'lesson-a', 'session-a', 1,
        '10000000-0000-4000-8000-000000000000'::uuid,
        null::text, '{}'::jsonb
      ) as result
    `, [digestA, STUDENT_A])))
      .rejects.toThrow(/STUDY_SYNC_REQUEST_INVALID/)
    await database.exec('rollback')

    const wrongHousehold = await guardian(GUARDIAN_B, () => write(
      digestB,
      STUDENT_A,
      'lesson-a',
      'session-a',
      1,
      '10000000-0000-4000-8000-000000000001',
      'safety:stop',
      {},
    ))
    const wrongAssignment = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'assignment-not-a',
      'session-a',
      1,
      '10000000-0000-4000-8000-000000000002',
      'safety:stop',
      {},
    ))
    const wrongSession = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-b',
      1,
      '10000000-0000-4000-8000-000000000003',
      'safety:stop',
      {},
    ))

    expect(wrongHousehold).toMatchObject({ status: 'denied' })
    expect(wrongAssignment).toMatchObject({ status: 'denied' })
    expect(wrongSession).toMatchObject({ status: 'denied' })
  })

  it('enforces authority CAS, operation idempotency and guardian-only transitions', async () => {
    const stopOperation = '20000000-0000-4000-8000-000000000001'
    const stopped = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      1,
      stopOperation,
      'safety:stop',
      {},
    ))
    const replay = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      1,
      stopOperation,
      'safety:stop',
      {},
    ))
    const collision = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      2,
      stopOperation,
      'safety:stop',
      {},
    ))
    const stale = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      1,
      '20000000-0000-4000-8000-000000000002',
      'safety:stop',
      {},
    ))
    const studentClear = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      2,
      '20000000-0000-4000-8000-000000000003',
      'safety:clear',
      {},
    ))
    const studentAttest = await student(grantA, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      2,
      '20000000-0000-4000-8000-000000000004',
      'guardian-attestation:attest',
      {},
    ))

    expect(stopped).toMatchObject({
      status: 'stored',
      serverRevision: 2,
      safetyState: 'stopped',
    })
    expect(replay).toEqual(stopped)
    expect(collision).toMatchObject({ status: 'idempotency-collision' })
    expect(stale).toMatchObject({
      status: 'revision-conflict',
      serverRevision: 2,
    })
    expect(studentClear).toMatchObject({
      status: 'denied',
      code: 'actor-not-authorized',
    })
    expect(studentAttest).toMatchObject({
      status: 'denied',
      code: 'actor-not-authorized',
    })

    const cleared = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      2,
      '20000000-0000-4000-8000-000000000005',
      'safety:clear',
      {},
    ))
    const attested = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      3,
      '20000000-0000-4000-8000-000000000006',
      'guardian-attestation:attest',
      {},
    ))

    expect(cleared).toMatchObject({
      status: 'stored',
      serverRevision: 3,
      safetyState: 'clear',
    })
    expect(attested).toMatchObject({
      status: 'stored',
      serverRevision: 4,
      guardianAttestationState: 'attested',
    })
  })

  it('hydrates minimized progress and rejects stale checkpoint writes', async () => {
    const checkpointOperation = '30000000-0000-4000-8000-000000000001'
    const stored = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      0,
      checkpointOperation,
      'checkpoint:compare-and-swap',
      { checkpoint: checkpoint(1) },
    ))
    const replay = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      0,
      checkpointOperation,
      'checkpoint:compare-and-swap',
      { checkpoint: checkpoint(1) },
    ))
    const stale = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      0,
      '30000000-0000-4000-8000-000000000002',
      'checkpoint:compare-and-swap',
      { checkpoint: checkpoint(1) },
    ))

    expect(stored).toMatchObject({ status: 'stored', serverRevision: 1 })
    expect(replay).toEqual(stored)
    expect(stale).toMatchObject({
      status: 'revision-conflict',
      serverRevision: 1,
    })

    const hydrated = await guardian(GUARDIAN_A, () =>
      hydrate(STUDENT_A, 'lesson-a', 'session-a'))
    expect(hydrated).toMatchObject({
      status: 'ready',
      document: {
        studentRef: STUDENT_A,
        assignmentRef: 'lesson-a',
        studySessionId: 'session-a',
        revisions: {
          authority: 4,
          checkpoint: 1,
        },
        progress: {
          currentSegmentRef: 'segment-a',
          completedSegmentRefs: ['segment-a'],
        },
        safety: { state: 'clear' },
        guardianAttestation: { state: 'attested' },
      },
    })
    expect(JSON.stringify(hydrated)).not.toMatch(/rawAnswer|transcript|emotion|diagnos/i)
  })

  it('rejects writes and RLS reads after Study grant revocation', async () => {
    const revoked = await service(() => rpc<Record<string, unknown>>(`
      select public.academy_study_revoke_session_v1($1::text) as result
    `, [digestA]))
    expect(revoked).toMatchObject({ status: 'revoked' })

    const denied = await guardian(GUARDIAN_A, () => write(
      digestA,
      STUDENT_A,
      'lesson-a',
      'session-a',
      4,
      '40000000-0000-4000-8000-000000000001',
      'safety:stop',
      {},
    ))
    expect(denied).toMatchObject({
      status: 'denied',
      code: 'study-session-invalid',
    })

    const learnerRows = await student(grantA, () => database.query<{ count: number }>(`
      select count(*)::integer as count
      from public.academy_study_session_authority
    `))
    expect(learnerRows.rows[0].count).toBe(0)
  })
})

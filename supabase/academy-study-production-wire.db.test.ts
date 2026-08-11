import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const PRODUCTION_WIRE_MIGRATION =
  './migrations/20260810120000_academy_study_production_wire_contract_v1.sql'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260806120000_academy_study_in_app_receipt_timestamp.sql',
  './migrations/20260806140000_academy_study_c2_operations_contract.sql',
  './migrations/20260808120000_academy_study_actor_bound_session_verification.sql',
  './migrations/20260808150000_academy_study_academic_readiness_contract.sql',
  './migrations/20260809120000_academy_study_learner_runtime_operations.sql',
  PRODUCTION_WIRE_MIGRATION,
  './tests/study_engine_fixtures.sql',
] as const

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
const HOUSEHOLD_B = '00000000-0000-0000-0000-000000000022'

const ATTEMPTS = 'student:attempts:create'
const PROGRESS = 'student:progress:read'
const ASSIGNMENTS = 'student:assignments:read'

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

interface RuntimeEnvelope {
  schemaVersion: number
  status: string
  operation: string
  body?: Record<string, unknown>
}

let database: PGlite
let digestA: string
let digestB: string
let nowIso: string

async function asRole<T>(
  role: 'authenticated' | 'service_role',
  subject: string | null,
  run: () => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) }).replaceAll("'", "''")
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

async function issueDigest(guardian: string, student: string): Promise<string> {
  const issued = await asRole('authenticated', guardian, async () => {
    const result = await database.query<{ result: Record<string, unknown> }>(
      'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
      ['academy-student-id', student],
    )
    return result.rows[0].result
  })
  return createHash('sha256').update(String(issued.sessionReference), 'ascii').digest('hex')
}

async function execute(
  digest: string,
  capability: string,
  operation: string,
  request: unknown,
): Promise<RuntimeEnvelope> {
  return asRole('service_role', null, async () => {
    const result = await database.query<{ result: RuntimeEnvelope }>(
      `select public.academy_study_execute_verified_runtime_v2(
        $1::text, $2::text, $3::text, $4::jsonb
      ) as result`,
      [digest, capability, operation, JSON.stringify(request)],
    )
    return result.rows[0].result
  })
}

function sessionRequest(sessionRef: string, overrides: Record<string, unknown> = {}) {
  return {
    sessionRef,
    lessonRef: 'lesson.production.1',
    subjectRef: 'math',
    studyPlanRef: null,
    segmentRef: 'segment.1',
    startedAt: nowIso,
    intendedLocalDate: nowIso.slice(0, 10),
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

async function begin(
  digest: string,
  sessionRef: string,
  mutationRef = `mutation.begin.${sessionRef}`,
  overrides: Record<string, unknown> = {},
) {
  return execute(digest, ATTEMPTS, 'session:begin', {
    session: sessionRequest(sessionRef, overrides),
    mutationRef,
  })
}

function checkpointRequest(
  sessionRef: string,
  revision: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    checkpointRef: `checkpoint.${sessionRef}.${revision}`,
    sessionRef,
    lessonRef: 'lesson.production.1',
    segmentRef: `segment.${revision}`,
    revision,
    capturedAt: nowIso,
    completedSegmentRefs: revision === 1 ? [] : ['segment.1'],
    elapsedActiveSecondsInSegment: revision * 10,
    responseDraftRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

async function seedBlock(
  blockRef: string,
  household: string,
  student: string,
  state = 'scheduled',
  requiredUnits = 2,
) {
  await database.query(
    `insert into public.academy_study_calendar_blocks (
       id, household_id, student_id, block_type, source_reference,
       scheduled_start, intended_local_date, household_timezone,
       explicit_offset, duration_minutes, completion_units, required_units,
       resume_session_id, resume_segment_id, state, idempotency_key
     )
     select
       $1, settings.household_id, $3::uuid, 'lesson', 'lesson.production.1',
       start_at, (start_at at time zone settings.household_timezone)::date,
       settings.household_timezone,
       (extract(epoch from (
         (start_at at time zone settings.household_timezone)
         - (start_at at time zone 'UTC')
       ))::integer / 60),
       30, 0, $5::integer, null, null, $4::text, $1
     from public.academy_study_household_settings as settings
     cross join (select clock_timestamp() as start_at) as anchor
     where settings.household_id = $2::uuid`,
    [blockRef, household, student, state, requiredUnits],
  )
}

async function transitionBlock(
  digest: string,
  blockRef: string,
  expectedRevision: number,
  transition: 'start' | 'pause' | 'resume' | 'complete',
  mutationRef: string,
  pauseCategory: string | null = null,
) {
  return execute(digest, ATTEMPTS, 'calendar:transition', {
    blockRef,
    expectedRevision,
    transition,
    at: nowIso,
    pauseCategory,
    mutationRef,
  })
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  const sources = await Promise.all(
    files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
  )
  for (const [index, migration] of sources.entries()) {
    try {
      await database.exec(migration)
    } catch (error) {
      throw new Error(`Failed to apply ${files[index]}`, { cause: error })
    }
  }
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in (
      '00000000-0000-0000-0000-0000000001a1'::uuid,
      '00000000-0000-0000-0000-0000000001b1'::uuid
    )
  `)
  digestA = await issueDigest(GUARDIAN_A, STUDENT_A)
  digestB = await issueDigest(GUARDIAN_B, STUDENT_B)
  const clock = await database.query<{ now: string }>(`
    select to_char(
      clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as now
  `)
  nowIso = clock.rows[0].now
})

afterAll(async () => {
  await database?.close()
})

describe('production session wire', () => {
  it('begins a server-bound session and performs an exact narrow read', async () => {
    const created = await begin(digestA, 'session.production.exact')
    expect(created).toMatchObject({
      schemaVersion: 2,
      status: 'ok',
      operation: 'session:begin',
      body: { status: 'saved', sessionRef: 'session.production.exact', revision: 1 },
    })

    const read = await execute(digestA, PROGRESS, 'session:read', {
      sessionRef: 'session.production.exact',
    })
    expect(read.body).toEqual({
      status: 'found',
      session: {
        sessionRef: 'session.production.exact',
        lessonRef: 'lesson.production.1',
        segmentRef: 'segment.1',
        status: 'active',
        updatedAt: expect.any(String),
        lastAcceptedEventRef: null,
        revision: 1,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      },
    })
    expect(JSON.stringify(read)).not.toMatch(/household_id|student_id|approved_break|technical_interruption/)
  })

  it('returns the stable original result on duplicate replay and refuses a mutation collision', async () => {
    const request = sessionRequest('session.production.replay')
    const first = await execute(digestA, ATTEMPTS, 'session:begin', {
      session: request,
      mutationRef: 'mutation.session.replay',
    })
    const replay = await execute(digestA, ATTEMPTS, 'session:begin', {
      session: request,
      mutationRef: 'mutation.session.replay',
    })
    expect(replay.body).toEqual(first.body)

    const collision = await execute(digestA, ATTEMPTS, 'session:begin', {
      session: { ...request, segmentRef: 'segment.other' },
      mutationRef: 'mutation.session.replay',
    })
    expect(collision.body).toEqual({ status: 'idempotency-collision' })
  })

  it('enforces expected revision and a legal explicit state machine', async () => {
    await begin(digestA, 'session.production.transitions')
    const conflict = await execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef: 'session.production.transitions',
      expectedRevision: 9,
      transition: 'pause',
      segmentRef: 'segment.1',
      lastAcceptedEventRef: null,
      at: nowIso,
      mutationRef: 'mutation.session.conflict',
    })
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })

    const paused = await execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef: 'session.production.transitions',
      expectedRevision: 1,
      transition: 'pause',
      segmentRef: 'segment.1',
      lastAcceptedEventRef: null,
      at: nowIso,
      mutationRef: 'mutation.session.pause',
    })
    expect(paused.body).toEqual({ status: 'saved', revision: 2 })

    await expect(execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef: 'session.production.transitions',
      expectedRevision: 2,
      transition: 'pause',
      segmentRef: 'segment.1',
      lastAcceptedEventRef: null,
      at: nowIso,
      mutationRef: 'mutation.session.illegal',
    })).rejects.toThrow(/STUDY_PRODUCTION_SESSION_TRANSITION_ILLEGAL/)
  })
})

describe('minimal checkpoint CAS', () => {
  it('stores, exactly reads, replays and refuses revision and mutation conflicts', async () => {
    await begin(digestA, 'session.checkpoint.main')
    const checkpoint = checkpointRequest('session.checkpoint.main', 1)
    const first = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.main',
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint,
    })
    expect(first.body).toEqual({ status: 'saved', revision: 1 })

    const replay = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.main',
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint,
    })
    expect(replay.body).toEqual(first.body)

    const collision = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.main',
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint: { ...checkpoint, segmentRef: 'segment.collision' },
    })
    expect(collision.body).toEqual({ status: 'idempotency-collision' })

    const conflict = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.main',
      expectedRevision: 5,
      mutationRef: 'mutation.checkpoint.conflict',
      checkpoint: checkpointRequest('session.checkpoint.main', 6),
    })
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })

    const read = await execute(digestA, PROGRESS, 'checkpoint:read', {
      sessionRef: 'session.checkpoint.main',
    })
    expect(read.body).toEqual({ status: 'found', checkpoint })
    const canonicalDraft = await database.query<{
      stored_draft_ref: string | null
      fingerprint_draft_type: string
    }>(`
      select checkpoint.response_draft_ref as stored_draft_ref,
             jsonb_typeof(receipt.request_fingerprint #>
               '{checkpoint,responseDraftRef}') as fingerprint_draft_type
      from academy_private.study_production_session_checkpoints as checkpoint
      join academy_private.study_mutation_receipts as receipt
        on receipt.actor_scope = 'session:' || checkpoint.session_id
       and receipt.operation_kind = 'production_checkpoint_cas_v1'
       and receipt.idempotency_key = 'mutation.checkpoint.main'
      where checkpoint.session_id = 'session.checkpoint.main'
    `)
    expect(canonicalDraft.rows[0]).toEqual({
      stored_draft_ref: null,
      fingerprint_draft_type: 'null',
    })
  })

  it('has no storage path for private learner content and quarantines malformed input', async () => {
    await begin(digestA, 'session.checkpoint.privacy')
    const poisoned = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.privacy',
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.poisoned',
      checkpoint: {
        ...checkpointRequest('session.checkpoint.privacy', 1),
        rawAnswer: 'learner answer must never persist',
      },
    })
    expect(poisoned.body).toEqual({ status: 'quarantined' })

    const columns = await database.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'academy_private'
        and table_name = 'study_production_session_checkpoints'
      order by ordinal_position
    `)
    expect(columns.rows.map((row) => row.column_name)).not.toEqual(expect.arrayContaining([
      'raw_answer', 'transcript', 'conversation', 'learner_audio',
      'emotional_label', 'personality_label', 'diagnostic_label', 'adult_work',
    ]))
    const count = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_production_session_checkpoints
      where session_id = 'session.checkpoint.privacy'
    `)
    expect(count.rows[0].count).toBe(0)
  })

  it('rejects caller-controlled response draft references without persisting or echoing them', async () => {
    const sessionRef = 'session.checkpoint.raw-draft'
    const mutationRef = 'mutation.checkpoint.raw-draft'
    const rawDraftRef = 'draft:my_raw_answer_is_four'
    await begin(digestA, sessionRef)

    const rejected = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef,
      checkpoint: checkpointRequest(sessionRef, 1, { responseDraftRef: rawDraftRef }),
    })
    const durable = await database.query<{
      checkpoints: number
      receipts: number
      audits: number
      leaked: boolean
    }>(`
      select
        (
          select count(*)::integer
          from academy_private.study_production_session_checkpoints
          where session_id = $1
        ) as checkpoints,
        (
          select count(*)::integer
          from academy_private.study_mutation_receipts
          where actor_scope = 'session:' || $1
            and operation_kind = 'production_checkpoint_cas_v1'
            and idempotency_key = $2
        ) as receipts,
        (
          select count(*)::integer
          from public.academy_study_audit_events
          where event_type = 'checkpoint.save'
            and target_id = $3
        ) as audits,
        exists (
          select 1
          from academy_private.study_production_session_checkpoints
          where response_draft_ref = $4
          union all
          select 1
          from academy_private.study_mutation_receipts
          where strpos(request_fingerprint::text, $4) > 0
             or strpos(result::text, $4) > 0
          union all
          select 1
          from public.academy_study_audit_events
          where strpos(metadata::text, $4) > 0
             or strpos(coalesce(reason_code, ''), $4) > 0
        ) as leaked
    `, [sessionRef, mutationRef, `checkpoint.${sessionRef}.1`, rawDraftRef])

    expect(rejected.body).toEqual({ status: 'quarantined' })
    expect(JSON.stringify(rejected)).not.toContain(rawDraftRef)
    expect(durable.rows[0]).toEqual({
      checkpoints: 0,
      receipts: 0,
      audits: 0,
      leaked: false,
    })
  })

  it('quarantines a checkpoint whose stored integrity no longer verifies', async () => {
    await begin(digestA, 'session.checkpoint.integrity')
    await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.checkpoint.integrity',
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.integrity',
      checkpoint: checkpointRequest('session.checkpoint.integrity', 1),
    })
    await database.exec(`
      alter table academy_private.study_production_session_checkpoints
        disable trigger study_production_checkpoint_20_integrity;
      update academy_private.study_production_session_checkpoints
      set elapsed_active_seconds_in_segment = 999
      where session_id = 'session.checkpoint.integrity';
      alter table academy_private.study_production_session_checkpoints
        enable trigger study_production_checkpoint_20_integrity;
    `)
    const read = await execute(digestA, PROGRESS, 'checkpoint:read', {
      sessionRef: 'session.checkpoint.integrity',
    })
    expect(read.body).toEqual({ status: 'quarantined', reasonCode: 'integrity-failed' })
  })

  it('refuses checkpoint writes when the core session diverges from its projection', async () => {
    const sessionRef = 'session.checkpoint.core-divergence'
    const mutationRef = 'mutation.checkpoint.core-divergence'
    const checkpointRef = `checkpoint.${sessionRef}.1`
    await begin(digestA, sessionRef)
    await database.exec(`
      update public.academy_study_sessions
      set lesson_id = 'lesson.production.diverged',
          state = 'paused'
      where id = '${sessionRef}';
    `)

    const exactRead = await execute(digestA, PROGRESS, 'session:read', { sessionRef })
    const rejected = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef,
      checkpoint: checkpointRequest(sessionRef, 1),
    })
    const state = await database.query<{
      core_lesson: string
      projection_lesson: string
      core_state: string
      projection_state: string
      core_revision: number
      projection_revision: number
      checkpoints: number
      receipts: number
      audits: number
    }>(`
      select
        core.lesson_id as core_lesson,
        projection.lesson_ref as projection_lesson,
        core.state as core_state,
        projection.status as projection_state,
        core.revision::integer as core_revision,
        projection.revision::integer as projection_revision,
        (
          select count(*)::integer
          from academy_private.study_production_session_checkpoints
          where session_id = $1
        ) as checkpoints,
        (
          select count(*)::integer
          from academy_private.study_mutation_receipts
          where actor_scope = 'session:' || $1
            and operation_kind = 'production_checkpoint_cas_v1'
            and idempotency_key = $2
        ) as receipts,
        (
          select count(*)::integer
          from public.academy_study_audit_events
          where event_type = 'checkpoint.save'
            and target_id = $3
        ) as audits
      from public.academy_study_sessions as core
      join academy_private.study_production_sessions as projection
        on projection.session_id = core.id
      where core.id = $1
    `, [sessionRef, mutationRef, checkpointRef])

    expect(exactRead.body).toEqual({
      status: 'quarantined',
      reasonCode: 'integrity-failed',
    })
    expect(rejected.body).toEqual({ status: 'quarantined' })
    expect(state.rows[0]).toEqual({
      core_lesson: 'lesson.production.diverged',
      projection_lesson: 'lesson.production.1',
      core_state: 'paused',
      projection_state: 'active',
      core_revision: 2,
      projection_revision: 1,
      checkpoints: 0,
      receipts: 0,
      audits: 0,
    })
  })
})

describe('production calendar state and completion', () => {
  it('persists a real paused state and resumes only through the legal edge', async () => {
    await seedBlock('block.production.pause', HOUSEHOLD_A, STUDENT_A)
    expect((await transitionBlock(
      digestA, 'block.production.pause', 1, 'start', 'mutation.block.start',
    )).body).toEqual({ status: 'saved', revision: 2 })
    expect((await transitionBlock(
      digestA, 'block.production.pause', 2, 'pause', 'mutation.block.pause', 'planned_break',
    )).body).toEqual({ status: 'saved', revision: 3 })

    const paused = await execute(digestA, ASSIGNMENTS, 'calendar:read', {
      blockRef: 'block.production.pause',
    })
    expect((paused.body?.block as Record<string, unknown>).state).toBe('paused')
    const stored = await database.query<{ state: string }>(`
      select state from public.academy_study_calendar_blocks
      where id = 'block.production.pause'
    `)
    expect(stored.rows[0].state).toBe('paused')

    expect((await transitionBlock(
      digestA, 'block.production.pause', 3, 'resume', 'mutation.block.resume',
    )).body).toEqual({ status: 'saved', revision: 4 })
  })

  it('keeps segment completion distinct from block completion', async () => {
    await seedBlock('block.production.segment', HOUSEHOLD_A, STUDENT_A, 'scheduled', 1)
    await transitionBlock(
      digestA, 'block.production.segment', 1, 'start', 'mutation.segment.start',
    )
    await expect(transitionBlock(
      digestA, 'block.production.segment', 2, 'complete', 'mutation.segment.too-early',
    )).rejects.toThrow(/STUDY_CALENDAR_TRANSITION_ILLEGAL/)

    const segment = await execute(digestA, ATTEMPTS, 'calendar:complete-segment', {
      blockRef: 'block.production.segment',
      segmentRef: 'segment.1',
      expectedRevision: 2,
      at: nowIso,
      mutationRef: 'mutation.segment.complete',
    })
    expect(segment.body).toEqual({ status: 'saved', revision: 3 })
    const replay = await execute(digestA, ATTEMPTS, 'calendar:complete-segment', {
      blockRef: 'block.production.segment',
      segmentRef: 'segment.1',
      expectedRevision: 2,
      at: nowIso,
      mutationRef: 'mutation.segment.complete',
    })
    expect(replay.body).toEqual(segment.body)

    const afterSegment = await database.query<{
      state: string
      completion_units: number
      required_units: number
    }>(`
      select state, completion_units, required_units
      from public.academy_study_calendar_blocks
      where id = 'block.production.segment'
    `)
    expect(afterSegment.rows[0]).toEqual({
      state: 'in_progress', completion_units: 1, required_units: 1,
    })
    expect((await transitionBlock(
      digestA, 'block.production.segment', 3, 'complete', 'mutation.segment.block-complete',
    )).body).toEqual({ status: 'saved', revision: 4 })
  })

  it('returns revision conflicts, idempotency collisions, exact reads and learner-filtered lists', async () => {
    await seedBlock('block.production.cas', HOUSEHOLD_A, STUDENT_A)
    const conflict = await transitionBlock(
      digestA, 'block.production.cas', 7, 'start', 'mutation.block.conflict',
    )
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })
    const first = await transitionBlock(
      digestA, 'block.production.cas', 1, 'start', 'mutation.block.collision',
    )
    expect(first.body).toEqual({ status: 'saved', revision: 2 })
    const collision = await transitionBlock(
      digestA, 'block.production.cas', 2, 'pause', 'mutation.block.collision', 'requested_break',
    )
    expect(collision.body).toEqual({ status: 'idempotency-collision' })

    await seedBlock('block.production.foreign', HOUSEHOLD_B, STUDENT_B)
    const listed = await execute(digestA, ASSIGNMENTS, 'calendar:list', { cursor: null })
    const refs = (listed.body?.blocks as Array<Record<string, unknown>>)
      .map((block) => block.blockRef)
    expect(refs).toContain('block.production.cas')
    expect(refs).not.toContain('block.production.foreign')
    await expect(execute(digestA, ASSIGNMENTS, 'calendar:read', {
      blockRef: 'block.production.foreign',
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
  })
})

describe('authority, isolation and readiness', () => {
  it('denies an invalid grant and refuses direct operation execution', async () => {
    const denied = await execute('0'.repeat(64), ATTEMPTS, 'session:begin', {
      session: sessionRequest('session.denied'),
      mutationRef: 'mutation.denied',
    })
    expect(denied).toEqual({
      schemaVersion: 2,
      status: 'denied',
      operation: 'session:begin',
    })

    await expect(asRole('service_role', null, () => database.query(`
      select public.academy_study_begin_production_session_v1(
        '{}'::jsonb, 'mutation.direct'
      )
    `))).rejects.toThrow(/permission denied/i)
  })

  it('fails closed when trusted-server auth infrastructure is misconfigured', async () => {
    await database.exec(`
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '{"role":"authenticated"}', false);
      select set_config('request.jwt.claim.role', 'authenticated', false);
      set role service_role;
    `)
    try {
      await expect(database.query(`
        select public.academy_study_execute_verified_runtime_v2(
          '${digestA}', '${PROGRESS}', 'session:read',
          '{"sessionRef":"session.production.exact"}'::jsonb
        )
      `)).rejects.toThrow(/STUDY_TRUSTED_SERVER_REQUIRED/)
    } finally {
      await database.exec(`
        reset role;
        select set_config('request.jwt.claim.sub', '', false);
        select set_config('request.jwt.claims', '', false);
        select set_config('request.jwt.claim.role', '', false);
      `)
    }
  })

  it('isolates sessions and checkpoints across learners and sessions', async () => {
    await begin(digestB, 'session.foreign.learner')
    await expect(begin(
      digestA,
      'session.foreign.learner',
      'mutation.begin.session.foreign.learner',
    )).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await execute(digestB, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.foreign.learner',
      expectedRevision: null,
      mutationRef: 'mutation.foreign.checkpoint',
      checkpoint: checkpointRequest('session.foreign.learner', 1),
    })
    await expect(execute(digestA, PROGRESS, 'session:read', {
      sessionRef: 'session.foreign.learner',
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(execute(digestA, PROGRESS, 'checkpoint:read', {
      sessionRef: 'session.foreign.learner',
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)

    await begin(digestA, 'session.cross.one')
    await begin(digestA, 'session.cross.two')
    const crossSession = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: 'session.cross.one',
      expectedRevision: null,
      mutationRef: 'mutation.cross.session',
      checkpoint: checkpointRequest('session.cross.two', 1),
    })
    expect(crossSession.body).toEqual({ status: 'quarantined' })
  })

  it('reports database contract presence but remains false before adapter composition', async () => {
    const readiness = await asRole('service_role', null, async () => {
      const result = await database.query<{ result: Record<string, unknown> }>(`
        select public.academy_study_production_wire_readiness_v1() as result
      `)
      return result.rows[0].result
    })
    expect(readiness).toMatchObject({
      schemaVersion: 1,
      status: 'not-ready',
      ready: false,
      databaseContractReady: true,
      downstreamAdaptersComposed: false,
      productionCompositionReady: false,
    })
  })
})

const POSTGRES_CLEANUP_TIMEOUT_MS = 10_000
const POSTGRES_CLEANUP_RETRY_MS = 100

function postgresDelay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function waitForPostgresProcessExit(process: ChildProcess) {
  if (process.exitCode !== null || process.signalCode !== null) return
  await new Promise<void>((resolve, reject) => {
    const exited = () => {
      clearTimeout(timeout)
      resolve()
    }
    const timeout = setTimeout(() => {
      process.removeListener('exit', exited)
      reject(new Error('Production wire PostgreSQL process did not exit in time.'))
    }, POSTGRES_CLEANUP_TIMEOUT_MS)
    process.once('exit', exited)
    if (process.exitCode !== null || process.signalCode !== null) {
      process.removeListener('exit', exited)
      clearTimeout(timeout)
      resolve()
    }
  })
  if (process.exitCode === null && process.signalCode === null) {
    throw new Error('Production wire PostgreSQL process still appears to be running.')
  }
}

async function removePostgresDirectory(databaseDir: string) {
  const deadline = Date.now() + POSTGRES_CLEANUP_TIMEOUT_MS
  while (true) {
    try {
      await rm(databaseDir, { recursive: true, force: true })
      try {
        await access(databaseDir)
      } catch (cause) {
        if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return
        throw cause
      }
      throw new Error('Production wire PostgreSQL directory still exists after removal.')
    } catch (cause) {
      const code = (cause as NodeJS.ErrnoException).code
      if (
        !['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code ?? '') ||
        Date.now() >= deadline
      ) {
        throw cause
      }
      await postgresDelay(POSTGRES_CLEANUP_RETRY_MS)
    }
  }
}

async function availablePostgresPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Could not allocate a production wire PostgreSQL test port.'))
        return
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

describe('production session begin on independent PostgreSQL backends', () => {
  let databaseDir: string
  let server: EmbeddedPostgres
  let controller: pg.Client
  let clientA: pg.Client
  let clientB: pg.Client
  let serverProcess: ChildProcess | undefined
  let cleanupPromise: Promise<void> | null = null
  let postgresDigestA: string
  let postgresNowIso: string

  async function cleanupServer() {
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      const errors: unknown[] = []
      const clients = await Promise.allSettled([
        controller?.end(),
        clientA?.end(),
        clientB?.end(),
      ])
      for (const result of clients) {
        if (result.status === 'rejected') errors.push(result.reason)
      }
      try {
        if (server) await server.stop()
      } catch (cause) {
        errors.push(cause)
      }
      try {
        if (serverProcess) await waitForPostgresProcessExit(serverProcess)
      } catch (cause) {
        errors.push(cause)
      }
      try {
        if (databaseDir) await removePostgresDirectory(databaseDir)
      } catch (cause) {
        errors.push(cause)
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, 'Production wire PostgreSQL cleanup failed.')
      }
    })()
    return cleanupPromise
  }

  async function configurePostgresRole(
    client: pg.Client,
    role: 'authenticated' | 'service_role',
    subject: string | null,
  ) {
    const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}) })
    await client.query(
      `select set_config('request.jwt.claim.sub', $1, false),
              set_config('request.jwt.claims', $2, false),
              set_config('request.jwt.claim.role', $3, false)`,
      [subject ?? '', claims, role],
    )
    await client.query(`set role ${role}`)
  }

  async function resetPostgresRole(client: pg.Client) {
    await client.query(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false),
             set_config('request.jwt.claims', '', false),
             set_config('request.jwt.claim.role', '', false)
    `)
  }

  async function executePostgresBegin(
    client: pg.Client,
    sessionRef: string,
    mutationRef: string,
    overrides: Record<string, unknown> = {},
  ): Promise<RuntimeEnvelope> {
    const request = {
      session: {
        sessionRef,
        lessonRef: 'lesson.production.1',
        subjectRef: 'math',
        studyPlanRef: null,
        segmentRef: 'segment.1',
        startedAt: postgresNowIso,
        intendedLocalDate: postgresNowIso.slice(0, 10),
        lastAcceptedEventRef: null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
        ...overrides,
      },
      mutationRef,
    }
    const result = await client.query<{ result: RuntimeEnvelope }>(
      `select public.academy_study_execute_verified_runtime_v2(
        $1::text, $2::text, 'session:begin', $3::jsonb
      ) as result`,
      [postgresDigestA, ATTEMPTS, JSON.stringify(request)],
    )
    return result.rows[0].result
  }

  async function waitForSerializedBackends(pids: number[], controllerPid: number) {
    const deadline = Date.now() + 10_000
    let lastActivity: Array<{
      pid: number
      wait_event_type: string | null
      wait_event: string | null
    }> = []
    let lastAdvisory: Array<{ pid: number; granted: boolean }> = []
    while (Date.now() < deadline) {
      const activity = await controller.query<{
        pid: number
        wait_event_type: string | null
        wait_event: string | null
      }>(`
        select pid, wait_event_type, wait_event
        from pg_catalog.pg_stat_activity
        where pid = any($1::integer[])
      `, [pids])
      const advisoryLocks = await controller.query<{ pid: number; granted: boolean }>(`
        select pid, granted
        from pg_catalog.pg_locks
        where locktype = 'advisory'
          and pid = any($1::integer[])
        order by granted, pid
      `, [[...pids, controllerPid]])
      lastActivity = activity.rows
      lastAdvisory = advisoryLocks.rows
      if (
        activity.rows.length === pids.length &&
        activity.rows.every((row) => row.wait_event_type === 'Lock') &&
        advisoryLocks.rows.length === 3 &&
        advisoryLocks.rows[0].granted === false &&
        advisoryLocks.rows[1].granted === false &&
        advisoryLocks.rows[2].pid === controllerPid &&
        advisoryLocks.rows[2].granted === true
      ) {
        return [
          { granted: false, count: 2 },
          { granted: true, count: 1 },
        ]
      }
      await postgresDelay(20)
    }
    throw new Error(
      `Production session begin backends did not reach the serialized barrier: activity=${JSON.stringify(lastActivity)} advisory=${JSON.stringify(lastAdvisory)}`,
    )
  }

  async function runBeginBarrier(
    sessionRef: string,
    mutationRefA: string,
    mutationRefB: string,
    overridesA: Record<string, unknown> = {},
    overridesB: Record<string, unknown> = {},
  ) {
    let barrierOpen = false
    let settledPromise: Promise<PromiseSettledResult<RuntimeEnvelope>[]> | undefined
    try {
      await controller.query('begin')
      barrierOpen = true
      await controller.query(
        `select pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtext('academy:study:production-session:v1'),
          pg_catalog.hashtext($1)
        )`,
        [sessionRef],
      )
      const [controllerPidResult, ...pids] = await Promise.all([
        controller.query<{ pid: number }>('select pg_backend_pid() as pid'),
        clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
        clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
      ])
      settledPromise = Promise.allSettled([
        executePostgresBegin(clientA, sessionRef, mutationRefA, overridesA),
        executePostgresBegin(clientB, sessionRef, mutationRefB, overridesB),
      ])
      const backendPids = pids.map((result) => result.rows[0].pid)
      const advisory = await waitForSerializedBackends(
        backendPids,
        controllerPidResult.rows[0].pid,
      )
      await controller.query('commit')
      barrierOpen = false
      const settled = await settledPromise
      return { advisory, backendPids, settled }
    } finally {
      if (barrierOpen) await controller.query('rollback')
      if (settledPromise) await settledPromise
    }
  }

  async function sessionWriteCounts(sessionRef: string) {
    const result = await controller.query<{
      core_rows: number
      projection_rows: number
      receipt_rows: number
      audit_rows: number
    }>(`
      select
        (select count(*)::integer from public.academy_study_sessions
          where id = $1) as core_rows,
        (select count(*)::integer from academy_private.study_production_sessions
          where session_id = $1) as projection_rows,
        (select count(*)::integer from academy_private.study_mutation_receipts
          where actor_scope = 'session:' || $1
            and operation_kind = 'production_session_begin_v1') as receipt_rows,
        (select count(*)::integer from public.academy_study_audit_events
          where event_type = 'session.start' and target_id = $1) as audit_rows
    `, [sessionRef])
    return result.rows[0]
  }

  beforeAll(async () => {
    try {
      databaseDir = await mkdtemp(join(tmpdir(), 'academy-production-wire-postgres-'))
      server = new EmbeddedPostgres({
        databaseDir,
        port: await availablePostgresPort(),
        user: 'postgres',
        password: 'academy-test-only',
        persistent: true,
        initdbFlags: ['--encoding=UTF8', '--locale=C'],
        postgresFlags: [
          '-c',
          'listen_addresses=127.0.0.1',
          '-c',
          'io_method=sync',
        ],
        onLog: () => undefined,
        onError: () => undefined,
      })
      await server.initialise()
      await server.start()
      serverProcess = (server as unknown as { process?: ChildProcess }).process
      if (!serverProcess?.pid) {
        throw new Error('Production wire PostgreSQL child process was not tracked.')
      }
      controller = server.getPgClient()
      clientA = server.getPgClient()
      clientB = server.getPgClient()
      await Promise.all([controller.connect(), clientA.connect(), clientB.connect()])
      await controller.query(bootstrap)
      const sources = await Promise.all(
        files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
      )
      for (const [index, migration] of sources.entries()) {
        try {
          await controller.query(migration)
        } catch (error) {
          throw new Error(`Failed to apply ${files[index]} to PostgreSQL`, { cause: error })
        }
      }
      await controller.query(`
        update public.academy_guardian_student_access
        set permission_level = 'identity_manager'
        where id = '00000000-0000-0000-0000-0000000001a1'::uuid
      `)
      await configurePostgresRole(controller, 'authenticated', GUARDIAN_A)
      const issued = await controller.query<{ result: Record<string, unknown> }>(
        'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
        ['academy-student-id', STUDENT_A],
      )
      postgresDigestA = createHash('sha256')
        .update(String(issued.rows[0].result.sessionReference), 'ascii')
        .digest('hex')
      await resetPostgresRole(controller)
      const clock = await controller.query<{ now: string }>(`
        select to_char(
          clock_timestamp() at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as now
      `)
      postgresNowIso = clock.rows[0].now
      await Promise.all([
        configurePostgresRole(clientA, 'service_role', null),
        configurePostgresRole(clientB, 'service_role', null),
      ])
    } catch (cause) {
      try {
        await cleanupServer()
      } catch (cleanupCause) {
        throw new AggregateError(
          [cause, cleanupCause],
          'Production wire PostgreSQL setup and cleanup both failed.',
        )
      }
      throw cause
    }
  }, 120_000)

  afterAll(async () => {
    await cleanupServer()
  }, 60_000)

  it('uses three genuinely independent PostgreSQL backends', async () => {
    const pids = await Promise.all([
      controller.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
    ])
    expect(new Set(pids.map((result) => result.rows[0].pid)).size).toBe(3)
  })

  it('serializes identical simultaneous begins into one saved result and one replay', async () => {
    const sessionRef = 'session.production.concurrent-identical'
    const mutationRef = 'mutation.session.concurrent-identical'
    const { advisory, backendPids, settled } = await runBeginBarrier(
      sessionRef,
      mutationRef,
      mutationRef,
    )
    console.info(
      `Production begin identical outcomes: ${settled.map((result) =>
        result.status === 'fulfilled'
          ? `fulfilled:${result.value.body?.status}`
          : `rejected:${String((result.reason as { code?: unknown }).code ?? 'unknown')}`
      ).join(',')}`,
    )
    expect(advisory).toEqual([
      { granted: false, count: 2 },
      { granted: true, count: 1 },
    ])
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true)
    const bodies = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value.body
    })
    expect(bodies).toEqual([
      { status: 'saved', sessionRef, revision: 1 },
      { status: 'saved', sessionRef, revision: 1 },
    ])
    expect(await sessionWriteCounts(sessionRef)).toEqual({
      core_rows: 1,
      projection_rows: 1,
      receipt_rows: 1,
      audit_rows: 1,
    })
    console.info(
      `Production begin identical concurrency: backends=${backendPids.join(',')} advisory=${JSON.stringify(advisory)}`,
    )
  }, 30_000)

  it('collides simultaneous different intent under the same mutation identity', async () => {
    const sessionRef = 'session.production.concurrent-different-intent'
    const mutationRef = 'mutation.session.concurrent-different-intent'
    const { advisory, settled } = await runBeginBarrier(
      sessionRef,
      mutationRef,
      mutationRef,
      { segmentRef: 'segment.concurrent.a' },
      { segmentRef: 'segment.concurrent.b' },
    )
    expect(advisory).toEqual([
      { granted: false, count: 2 },
      { granted: true, count: 1 },
    ])
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true)
    const bodies = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value.body
    })
    expect(bodies.map((body) => body?.status).sort()).toEqual([
      'idempotency-collision',
      'saved',
    ])
    expect(await sessionWriteCounts(sessionRef)).toEqual({
      core_rows: 1,
      projection_rows: 1,
      receipt_rows: 1,
      audit_rows: 1,
    })
  }, 30_000)

  it('rechecks missing-session state after serialization for distinct mutations', async () => {
    const sessionRef = 'session.production.concurrent-distinct'
    const { advisory, settled } = await runBeginBarrier(
      sessionRef,
      'mutation.session.concurrent-distinct-a',
      'mutation.session.concurrent-distinct-b',
    )
    console.info(
      `Production begin distinct-mutation outcomes: ${settled.map((result) =>
        result.status === 'fulfilled'
          ? `fulfilled:${result.value.body?.status}`
          : `rejected:${String((result.reason as { code?: unknown }).code ?? 'unknown')}`
      ).join(',')}`,
    )
    expect(advisory).toEqual([
      { granted: false, count: 2 },
      { granted: true, count: 1 },
    ])
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true)
    const bodies = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value.body
    })
    expect(bodies.map((body) => body?.status).sort()).toEqual([
      'idempotency-collision',
      'saved',
    ])
    expect(await sessionWriteCounts(sessionRef)).toEqual({
      core_rows: 1,
      projection_rows: 1,
      receipt_rows: 2,
      audit_rows: 1,
    })
  }, 30_000)
})

describe('RPC census and migration custody', () => {
  const expected = new Map<string, {
    names: string[] | null
    types: string
    defaults: number
    defaultExpr: string | null
    volatility: 's' | 'v'
    fingerprint: string
  }>([
    ['academy_study_begin_production_session_v1(jsonb,text)', {
      names: ['p_session', 'p_mutation_ref'], types: 'jsonb, text', defaults: 0,
      defaultExpr: null, volatility: 'v',
      fingerprint: '952ce152c0ccd1283fb64559f68c66a50942eb8edaf9c17bbc42cc243a7272c9',
    }],
    ['academy_study_read_production_session_v1(text)', {
      names: ['p_session_ref'], types: 'text', defaults: 0,
      defaultExpr: null, volatility: 's',
      fingerprint: '819043867ed4351b54fe492c2b34180e93eeb41d8032c8267e6a03eba62d0fa7',
    }],
    ['academy_study_transition_production_session_v1(text,bigint,text,text,text,timestamp with time zone,text)', {
      names: ['p_session_ref', 'p_expected_revision', 'p_transition', 'p_segment_ref',
        'p_last_accepted_event_ref', 'p_at', 'p_mutation_ref'],
      types: 'text, bigint, text, text, text, timestamp with time zone, text',
      defaults: 0, defaultExpr: null, volatility: 'v',
      fingerprint: '7395c0a41466d02d5f12db8d9f4e363d6bc84ddab566e2d5202a8df309902a4c',
    }],
    ['academy_study_read_session_checkpoint_v1(text)', {
      names: ['p_session_ref'], types: 'text', defaults: 0,
      defaultExpr: null, volatility: 's',
      fingerprint: 'c69aaf497c921a4b56b3f3c867a60053557c9c95d2e8ce7f7fd4124d981f43c6',
    }],
    ['academy_study_compare_and_swap_session_checkpoint_v1(text,bigint,text,jsonb)', {
      names: ['p_session_ref', 'p_expected_revision', 'p_mutation_ref', 'p_checkpoint'],
      types: 'text, bigint, text, jsonb', defaults: 0,
      defaultExpr: null, volatility: 'v',
      fingerprint: 'a0664dc9eb7a1db5f6d0c344344d0fc114694655b612ab931892ac44ea1c2952',
    }],
    ['academy_study_list_production_calendar_v1(text)', {
      names: ['p_cursor'], types: 'text', defaults: 1,
      defaultExpr: 'NULL::text', volatility: 's',
      fingerprint: '4ca0064f8e6ab919d4479ae6cb6ab25602334a93a5aa8927ccd10e14366f52ee',
    }],
    ['academy_study_read_production_calendar_block_v1(text)', {
      names: ['p_block_ref'], types: 'text', defaults: 0,
      defaultExpr: null, volatility: 's',
      fingerprint: 'cdca4554f6f23c30318ea67f1238957b44f29146eff153b7a8b939b2c5a3cce6',
    }],
    ['academy_study_transition_calendar_block_v2(text,bigint,text,timestamp with time zone,text,text)', {
      names: ['p_block_ref', 'p_expected_revision', 'p_transition', 'p_at',
        'p_pause_category', 'p_mutation_ref'],
      types: 'text, bigint, text, timestamp with time zone, text, text',
      defaults: 0, defaultExpr: null, volatility: 'v',
      fingerprint: '0933f00044b6c18108b818ded152df1fc1b5d83641216f48e1ada96b6de88bd8',
    }],
    ['academy_study_complete_calendar_segment_v1(text,text,bigint,timestamp with time zone,text)', {
      names: ['p_block_ref', 'p_segment_ref', 'p_expected_revision', 'p_at', 'p_mutation_ref'],
      types: 'text, text, bigint, timestamp with time zone, text',
      defaults: 0, defaultExpr: null, volatility: 'v',
      fingerprint: '5bf3dfa1cfcfe8bdab24933ddf59bdf0d8c5f7cb47fc5529bfb16faabe6c8a6f',
    }],
    ['academy_study_execute_verified_runtime_v2(text,text,text,jsonb)', {
      names: ['p_token_digest', 'p_required_capability', 'p_operation', 'p_request'],
      types: 'text, text, text, jsonb', defaults: 0,
      defaultExpr: null, volatility: 'v',
      fingerprint: 'f29638444d53c46b33ae77ca5585fa56d0a02ad0e6841c5e6c311142b4547e23',
    }],
    ['academy_study_production_wire_readiness_v1()', {
      names: null, types: '', defaults: 0,
      defaultExpr: null, volatility: 's',
      fingerprint: '221a9e1eed1926d5281bc6a23ee2d71004fc6023a918640c73ab25c007b0eafa',
    }],
  ])

  it('pins all eleven RPC signatures, modes, defaults, return, language, volatility, posture, path and bodies', async () => {
    const result = await database.query<{
      signature: string
      proargnames: string[] | null
      types: string
      proargmodes: string[] | null
      pronargdefaults: number
      default_expr: string | null
      returns: string
      lanname: string
      provolatile: 's' | 'v'
      prosecdef: boolean
      proconfig: string[] | null
      fingerprint: string
    }>(`
      select p.oid::regprocedure::text as signature,
        p.proargnames,
        oidvectortypes(p.proargtypes) as types,
        p.proargmodes,
        p.pronargdefaults,
        pg_get_expr(p.proargdefaults, 0) as default_expr,
        p.prorettype::regtype::text as returns,
        language.lanname,
        p.provolatile,
        p.prosecdef,
        p.proconfig,
        encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex') as fingerprint
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as namespace on namespace.oid = p.pronamespace
      join pg_catalog.pg_language as language on language.oid = p.prolang
      where namespace.nspname = 'public'
        and p.proname in (
          'academy_study_begin_production_session_v1',
          'academy_study_read_production_session_v1',
          'academy_study_transition_production_session_v1',
          'academy_study_read_session_checkpoint_v1',
          'academy_study_compare_and_swap_session_checkpoint_v1',
          'academy_study_list_production_calendar_v1',
          'academy_study_read_production_calendar_block_v1',
          'academy_study_transition_calendar_block_v2',
          'academy_study_complete_calendar_segment_v1',
          'academy_study_execute_verified_runtime_v2',
          'academy_study_production_wire_readiness_v1'
        )
      order by p.proname
    `)
    expect(result.rows).toHaveLength(11)
    expect(new Set(result.rows.map((row) => row.signature))).toEqual(new Set(expected.keys()))
    for (const row of result.rows) {
      const pin = expected.get(row.signature)!
      expect(row.proargnames, row.signature).toEqual(pin.names)
      expect(row.types, row.signature).toBe(pin.types)
      expect(row.proargmodes, row.signature).toBeNull()
      expect(row.pronargdefaults, row.signature).toBe(pin.defaults)
      expect(row.default_expr, row.signature).toBe(pin.defaultExpr)
      expect(row.returns, row.signature).toBe('jsonb')
      expect(row.lanname, row.signature).toBe('plpgsql')
      expect(row.provolatile, row.signature).toBe(pin.volatility)
      expect(row.prosecdef, row.signature).toBe(true)
      expect(row.proconfig, row.signature).toEqual(['search_path=pg_catalog'])
      expect(row.fingerprint, row.signature).toBe(pin.fingerprint)
    }
  })

  it('grants only executor/readiness to service_role and leaves v1 executor semantics untouched', async () => {
    const grants = await database.query<Record<string, boolean>>(`
      select
        has_function_privilege('service_role',
          'public.academy_study_execute_verified_runtime_v2(text,text,text,jsonb)', 'execute') as executor_service,
        has_function_privilege('authenticated',
          'public.academy_study_execute_verified_runtime_v2(text,text,text,jsonb)', 'execute') as executor_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_production_wire_readiness_v1()', 'execute') as readiness_service,
        has_function_privilege('authenticated',
          'public.academy_study_production_wire_readiness_v1()', 'execute') as readiness_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_transition_calendar_block_v2(text,bigint,text,timestamptz,text,text)', 'execute') as operation_service
    `)
    expect(grants.rows[0]).toEqual({
      executor_service: true,
      executor_authenticated: false,
      readiness_service: true,
      readiness_authenticated: false,
      operation_service: false,
    })
    const v1 = await database.query<{ fingerprint: string }>(`
      select encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') as fingerprint
      from pg_catalog.pg_proc
      where oid = 'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)'::regprocedure
    `)
    expect(v1.rows[0].fingerprint)
      .toBe('309643cf3abae40bc926ee6ead20d8e569c6370e2f4af49c1fbd3e161ce7b953')
  })

  it('records the marker, honest readiness facts and refuses a second apply', async () => {
    const marker = await database.query<{
      version: number
      names: string[]
      manifest: Record<string, unknown>
    }>(`
      select production_wire_version as version, migration_names as names,
        security_manifest as manifest
      from academy_private.study_persistence_metadata
      where singleton
    `)
    expect(marker.rows[0].version).toBe(1)
    expect(marker.rows[0].names)
      .toContain('20260810120000_academy_study_production_wire_contract_v1')
    expect(marker.rows[0].manifest).toMatchObject({
      production_wire_version: 1,
      production_wire_rpc_count: 11,
      production_wire_browser_authority_fields: false,
      production_wire_checkpoint_raw_answer_persisted: false,
      production_wire_checkpoint_transcript_persisted: false,
      production_wire_calendar_paused_state_real: true,
      production_wire_segment_completion_separate: true,
      production_wire_readiness_ready: false,
      production_wire_hosted_application_claim: false,
    })
    const source = await readFile(new URL(PRODUCTION_WIRE_MIGRATION, import.meta.url), 'utf8')
    await expect(database.exec(source)).rejects.toThrow(/STUDY_PRODUCTION_WIRE already applied/)
  })
})

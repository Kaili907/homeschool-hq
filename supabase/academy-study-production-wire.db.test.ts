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
const STUDENT_A2 = '00000000-0000-0000-0000-000000000103'
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
// The session insert trigger compares intended_local_date against started_at
// rendered in the HOUSEHOLD's timezone, and household A is America/New_York.
// A UTC date is the same calendar day only for part of the day, so the local
// date is read from the household's own settings rather than sliced off nowIso.
let localDateA: string
let localDateB: string

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

// A begin request carries no session identity: the reference is issued by
// academy_private.study_production_session_ref and comes back in the result.
function sessionRequest(overrides: Record<string, unknown> = {}) {
  return {
    lessonRef: 'lesson.production.1',
    subjectRef: 'math',
    studyPlanRef: null,
    segmentRef: 'segment.1',
    startedAt: nowIso,
    intendedLocalDate: localDateA,
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

async function begin(
  digest: string,
  mutationRef: string,
  overrides: Record<string, unknown> = {},
) {
  return execute(digest, ATTEMPTS, 'session:begin', {
    session: sessionRequest(overrides),
    mutationRef,
  })
}

/** Begins and returns the reference the server issued, which is the only way to get one. */
async function beginRef(
  digest: string,
  mutationRef: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const created = await begin(digest, mutationRef, overrides)
  const issued = (created.body as { sessionRef?: unknown } | undefined)?.sessionRef
  if (typeof issued !== 'string') {
    throw new Error(`Begin did not issue a session reference: ${JSON.stringify(created)}`)
  }
  return issued
}

/** The learner receipt scope, read from the authority that writes it. */
async function learnerScope(
  client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ scope: string }> }> },
  student: string,
): Promise<string> {
  const result = await client.query(
    'select academy_private.study_learner_ref($1::uuid) as scope',
    [student],
  )
  return result.rows[0].scope
}

/**
 * The issuing authority itself, read rather than re-implemented.
 *
 * The concurrency barrier has to take the same advisory lock the begin operation
 * takes, and that lock is keyed on the issued reference. Deriving it here from a
 * second copy of the formula would make the barrier agree with a formula instead
 * of with the database.
 */
async function issuedSessionRef(
  client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ ref: string }> }> },
  household: string,
  student: string,
  mutationRef: string,
): Promise<string> {
  const result = await client.query(
    `select academy_private.study_production_session_ref(
      $1::uuid, $2::uuid, $3::text
    ) as ref`,
    [household, student, mutationRef],
  )
  return result.rows[0].ref
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
  const clock = await database.query<{ now: string; local_a: string; local_b: string }>(`
    select to_char(
      clock_timestamp() at time zone 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ) as now,
    to_char(
      (clock_timestamp() at time zone (
        select household_timezone from public.academy_study_household_settings
        where household_id = '${'00000000-0000-0000-0000-000000000011'}'::uuid
      ))::date, 'YYYY-MM-DD'
    ) as local_a,
    to_char(
      (clock_timestamp() at time zone (
        select household_timezone from public.academy_study_household_settings
        where household_id = '${'00000000-0000-0000-0000-000000000022'}'::uuid
      ))::date, 'YYYY-MM-DD'
    ) as local_b
  `)
  nowIso = clock.rows[0].now
  localDateA = clock.rows[0].local_a
  localDateB = clock.rows[0].local_b
})

afterAll(async () => {
  await database?.close()
})

describe('production session wire', () => {
  it('issues the session reference itself and performs an exact narrow read', async () => {
    const created = await begin(digestA, 'mutation.begin.exact')
    const sessionRef = (created.body as { sessionRef: string }).sessionRef
    expect(created).toMatchObject({
      schemaVersion: 2,
      status: 'ok',
      operation: 'session:begin',
      body: { status: 'saved', sessionRef, revision: 1 },
    })
    // Server-owned: the reference is this wire's namespace plus a digest, and it
    // is not anything the caller sent or could have predicted from its own input.
    expect(sessionRef).toMatch(/^aca\.study\.session\.v1\.[0-9a-f]{64}$/)
    expect(sessionRef).toBe(
      await issuedSessionRef(database, HOUSEHOLD_A, STUDENT_A, 'mutation.begin.exact'),
    )
    expect(sessionRef).not.toContain('mutation.begin.exact')

    const read = await execute(digestA, PROGRESS, 'session:read', { sessionRef })
    expect(read.body).toEqual({
      status: 'found',
      session: {
        sessionRef,
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

  it('refuses a begin that tries to name its own session', async () => {
    // The exact-key set has no sessionRef, so a caller proposing one is refused
    // by the same rule that refuses any unknown key -- it is never ignored.
    await expect(execute(digestA, ATTEMPTS, 'session:begin', {
      session: { ...sessionRequest(), sessionRef: 'session.caller.named' },
      mutationRef: 'mutation.begin.caller-named',
    })).rejects.toThrow(/STUDY_PRODUCTION_SESSION_INVALID/)
    const named = await database.query<{ count: number }>(`
      select count(*)::integer as count from public.academy_study_sessions
      where id = 'session.caller.named'
    `)
    expect(named.rows[0].count).toBe(0)
  })

  it('returns the stable original result on duplicate replay and refuses a mutation collision', async () => {
    const request = sessionRequest()
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

  it('keeps two mutation references from collapsing into one session', async () => {
    // Distinct operations must stay distinct: two begins that differ only in
    // their mutation reference are two begins, not one replayed.
    const first = await beginRef(digestA, 'mutation.session.distinct.a')
    const second = await beginRef(digestA, 'mutation.session.distinct.b')
    expect(first).not.toBe(second)
    const rows = await database.query<{ sessions: number; receipts: number }>(`
      select
        (select count(*)::integer from public.academy_study_sessions
          where id = any($1::text[])) as sessions,
        (select count(*)::integer from academy_private.study_mutation_receipts
          where actor_scope = $2::text
            and operation_kind = 'production_session_begin_v1'
            and idempotency_key = any($3::text[])) as receipts
    `, [
      [first, second],
      await learnerScope(database, STUDENT_A),
      ['mutation.session.distinct.a', 'mutation.session.distinct.b'],
    ])
    expect(rows.rows[0]).toEqual({ sessions: 2, receipts: 2 })
  })

  it('never surfaces a raw unique-constraint failure when another lane already holds the reference', async () => {
    // public.academy_study_create_session is still granted to authenticated and
    // still inserts into public.academy_study_sessions without taking this
    // wire's advisory lock. It can therefore, in principle, occupy a reference
    // this authority would issue. When it has, begin must answer on its own
    // closed terms -- never with a duplicate-key error naming a database object.
    const mutationRef = 'mutation.session.foreign-lane'
    const contested = await issuedSessionRef(database, HOUSEHOLD_A, STUDENT_A, mutationRef)
    await database.query(`
      insert into public.academy_study_sessions (
        id, schema_version, household_id, student_id, lesson_id, subject_id,
        study_plan_id, state, started_at, completed_at, intended_local_date,
        household_timezone, created_by
      ) values (
        $1, 1, $2::uuid, $3::uuid, 'lesson.production.1', 'math', null,
        'active', $4::timestamptz, null, $5::date, 'UTC', null
      )
    `, [contested, HOUSEHOLD_A, STUDENT_A, nowIso, localDateA])

    const blocked = await begin(digestA, mutationRef)
    expect(blocked.body).toEqual({ status: 'idempotency-collision' })
    expect(JSON.stringify(blocked)).not.toMatch(/duplicate key|unique constraint|23505|_pkey/)

    const projection = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_production_sessions where session_id = $1
    `, [contested])
    expect(projection.rows[0].count).toBe(0)
  })

  it('enforces expected revision and a legal explicit state machine', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.transitions')
    const conflict = await execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef,
      expectedRevision: 9,
      transition: 'pause',
      segmentRef: 'segment.1',
      lastAcceptedEventRef: null,
      at: nowIso,
      mutationRef: 'mutation.session.conflict',
    })
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })

    const paused = await execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef,
      expectedRevision: 1,
      transition: 'pause',
      segmentRef: 'segment.1',
      lastAcceptedEventRef: null,
      at: nowIso,
      mutationRef: 'mutation.session.pause',
    })
    expect(paused.body).toEqual({ status: 'saved', revision: 2 })

    await expect(execute(digestA, ATTEMPTS, 'session:transition', {
      sessionRef,
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
    const sessionRef = await beginRef(digestA, 'mutation.begin.checkpoint-main')
    const checkpoint = checkpointRequest(sessionRef, 1)
    const first = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint,
    })
    expect(first.body).toEqual({ status: 'saved', revision: 1 })

    const replay = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint,
    })
    expect(replay.body).toEqual(first.body)

    const collision = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.main',
      checkpoint: checkpointRequest(sessionRef, 1, { segmentRef: 'segment.other' }),
    })
    expect(collision.body).toEqual({ status: 'idempotency-collision' })

    const conflict = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: 5,
      mutationRef: 'mutation.checkpoint.conflict',
      checkpoint: checkpointRequest(sessionRef, 6),
    })
    expect(conflict.body).toEqual({ status: 'revision-conflict', currentRevision: 1 })

    const read = await execute(digestA, PROGRESS, 'checkpoint:read', { sessionRef })
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
      where checkpoint.session_id = $1
    `, [sessionRef])
    expect(canonicalDraft.rows[0]).toEqual({
      stored_draft_ref: null,
      fingerprint_draft_type: 'null',
    })
  })

  it('has no storage path for private learner content and quarantines malformed input', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.checkpoint-privacy')
    const poisoned = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.poisoned',
      checkpoint: {
        ...checkpointRequest(sessionRef, 1),
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
      where session_id = $1
    `, [sessionRef])
    expect(count.rows[0].count).toBe(0)
  })

  it('refuses a response draft reference on its own closed terms, not as a quarantine', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.raw-draft')
    const mutationRef = 'mutation.checkpoint.raw-draft'
    // High-entropy, so a substring scan over every durable text and jsonb column
    // in the schema is a real search rather than a coincidence hunt.
    const rawDraftRef = 'draft:zq7x4m2v9k1t6r8w3n5p0j-my-raw-answer-is-four'

    const rejected = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef,
      checkpoint: checkpointRequest(sessionRef, 1, { responseDraftRef: rawDraftRef }),
    })

    // Explicit closed semantics: its own status, naming the field and nothing else.
    expect(rejected.body).toEqual({
      status: 'unsupported-field',
      field: 'responseDraftRef',
    })
    // Distinguishable from integrity quarantine, which is what the wire says when
    // stored state disagrees with itself and no caller can act on it.
    expect((rejected.body as { status: string }).status).not.toBe('quarantined')
    // Never echoed.
    expect(JSON.stringify(rejected)).not.toContain(rawDraftRef)
    expect(JSON.stringify(rejected)).not.toContain('my-raw-answer-is-four')

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
             or strpos(request_digest, $4) > 0
          union all
          select 1
          from public.academy_study_audit_events
          where strpos(metadata::text, $4) > 0
             or strpos(coalesce(reason_code, ''), $4) > 0
        ) as leaked
    `, [sessionRef, mutationRef, `checkpoint.${sessionRef}.1`, rawDraftRef])

    expect(durable.rows[0]).toEqual({
      checkpoints: 0,
      receipts: 0,
      audits: 0,
      leaked: false,
    })
  })

  it('leaves the refused draft reference in no text or jsonb column anywhere', async () => {
    // The targeted scan above knows where to look. This one does not: it asks the
    // catalogue for every text and jsonb column the study surface owns and greps
    // all of them, so a future column cannot become a quiet storage path.
    const sessionRef = await beginRef(digestA, 'mutation.begin.raw-draft-sweep')
    const rawDraftRef = 'draft:h3f8q1s5d9g2k7l4z0b6c-answer-text-sentinel'
    await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.raw-draft-sweep',
      checkpoint: checkpointRequest(sessionRef, 1, { responseDraftRef: rawDraftRef }),
    })

    const columns = await database.query<{
      table_schema: string
      table_name: string
      column_name: string
    }>(`
      select columns.table_schema, columns.table_name, columns.column_name
      from information_schema.columns as columns
      join information_schema.tables as tables
        on tables.table_schema = columns.table_schema
       and tables.table_name = columns.table_name
       and tables.table_type = 'BASE TABLE'
      where columns.table_schema in ('academy_private', 'public')
        and columns.data_type in ('text', 'jsonb', 'character varying', 'ARRAY')
      order by columns.table_schema, columns.table_name, columns.column_name
    `)
    expect(columns.rows.length).toBeGreaterThan(50)

    const hits: string[] = []
    for (const column of columns.rows) {
      const found = await database.query<{ hit: boolean }>(`
        select exists (
          select 1 from "${column.table_schema}"."${column.table_name}"
          where strpos("${column.column_name}"::text, $1) > 0
        ) as hit
      `, [rawDraftRef])
      if (found.rows[0].hit) {
        hits.push(`${column.table_schema}.${column.table_name}.${column.column_name}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('fails closed on a refused draft reference at the null initial revision and at an established one', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.raw-draft-closed')
    const rawDraftRef = 'draft:p2w8e4r6t0y1u5i9o3a7s-closed'

    // Null initial checkpoint revision: nothing exists, and the refusal creates nothing.
    const atNull = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.closed.null',
      checkpoint: checkpointRequest(sessionRef, 1, { responseDraftRef: rawDraftRef }),
    })
    expect(atNull.body).toEqual({ status: 'unsupported-field', field: 'responseDraftRef' })
    const empty = await execute(digestA, PROGRESS, 'checkpoint:read', { sessionRef })
    expect(empty.body).toEqual({ status: 'not-found' })

    // Establish a real checkpoint, then refuse again and prove the revision did not move.
    const saved = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.closed.saved',
      checkpoint: checkpointRequest(sessionRef, 1),
    })
    expect(saved.body).toEqual({ status: 'saved', revision: 1 })

    const before = await database.query<{ revision: number; digest: string }>(`
      select revision::integer as revision, integrity_digest as digest
      from academy_private.study_production_session_checkpoints where session_id = $1
    `, [sessionRef])
    const atOne = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: 1,
      mutationRef: 'mutation.checkpoint.closed.established',
      checkpoint: checkpointRequest(sessionRef, 2, { responseDraftRef: rawDraftRef }),
    })
    expect(atOne.body).toEqual({ status: 'unsupported-field', field: 'responseDraftRef' })
    const after = await database.query<{ revision: number; digest: string }>(`
      select revision::integer as revision, integrity_digest as digest
      from academy_private.study_production_session_checkpoints where session_id = $1
    `, [sessionRef])
    expect(after.rows[0]).toEqual(before.rows[0])
  })

  it('still saves and exactly reads a checkpoint whose response draft reference is null', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.raw-draft-null')
    const checkpoint = checkpointRequest(sessionRef, 1)
    const saved = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.null-draft',
      checkpoint,
    })
    expect(saved.body).toEqual({ status: 'saved', revision: 1 })
    const read = await execute(digestA, PROGRESS, 'checkpoint:read', { sessionRef })
    expect(read.body).toEqual({ status: 'found', checkpoint })

    // Omitting the key entirely is a shape violation, not an unsupported field,
    // and stays on the quarantine token it has always used.
    const { responseDraftRef: _omitted, ...withoutKey } = checkpointRequest(sessionRef, 2)
    const missing = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: 1,
      mutationRef: 'mutation.checkpoint.absent-draft',
      checkpoint: withoutKey,
    })
    expect(missing.body).toEqual({ status: 'quarantined' })
  })

  it('quarantines a checkpoint whose stored integrity no longer verifies', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.checkpoint-integrity')
    await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.integrity',
      checkpoint: checkpointRequest(sessionRef, 1),
    })
    // The digest is trigger-maintained, so corrupting it means moving the data
    // out from under it rather than writing a wrong digest.
    await database.exec(`
      alter table academy_private.study_production_session_checkpoints
        disable trigger study_production_checkpoint_20_integrity;
      update academy_private.study_production_session_checkpoints
      set elapsed_active_seconds_in_segment = 999
      where session_id = '${sessionRef}';
      alter table academy_private.study_production_session_checkpoints
        enable trigger study_production_checkpoint_20_integrity;
    `)
    const stored = await database.query<{ revision: number }>(`
      select revision::integer as revision
      from academy_private.study_production_session_checkpoints where session_id = $1
    `, [sessionRef])
    const revision = stored.rows[0].revision

    const read = await execute(digestA, PROGRESS, 'checkpoint:read', { sessionRef })
    expect(read.body).toEqual({ status: 'quarantined', reasonCode: 'integrity-failed' })
    const rejected = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef,
      expectedRevision: revision,
      mutationRef: 'mutation.checkpoint.integrity.write',
      checkpoint: checkpointRequest(sessionRef, revision + 1),
    })
    // Integrity disagreement stays fail-closed on the quarantine token, and that
    // token is not the one an unsupported field gets.
    expect(rejected.body).toEqual({ status: 'quarantined' })
    expect((rejected.body as { status: string }).status).not.toBe('unsupported-field')
  })

  it('refuses checkpoint writes when the core session diverges from its projection', async () => {
    const sessionRef = await beginRef(digestA, 'mutation.begin.core-divergence')
    const mutationRef = 'mutation.checkpoint.core-divergence'
    const checkpointRef = `checkpoint.${sessionRef}.1`
    await database.query(`
      update public.academy_study_sessions
      set lesson_id = 'lesson.production.diverged',
          state = 'paused'
      where id = $1
    `, [sessionRef])

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
      session: sessionRequest(),
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
          '{"sessionRef":"aca.study.session.v1.probe"}'::jsonb
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
    // Household B keeps its own timezone, so its local date is its own too.
    const foreignRef = await beginRef(digestB, 'mutation.begin.foreign-learner', {
      intendedLocalDate: localDateB,
    })

    // Two learners reusing one mutation reference are still two begins: the
    // reference is issued out of each learner's own binding, so learner A cannot
    // land on learner B's session even by naming B's mutation identity.
    const ownRef = await beginRef(digestA, 'mutation.begin.foreign-learner')
    expect(ownRef).not.toBe(foreignRef)
    expect(foreignRef).toBe(
      await issuedSessionRef(database, HOUSEHOLD_B, STUDENT_B, 'mutation.begin.foreign-learner'),
    )

    await execute(digestB, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: foreignRef,
      expectedRevision: null,
      mutationRef: 'mutation.foreign.checkpoint',
      checkpoint: checkpointRequest(foreignRef, 1),
    })
    await expect(execute(digestA, PROGRESS, 'session:read', {
      sessionRef: foreignRef,
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(execute(digestA, PROGRESS, 'checkpoint:read', {
      sessionRef: foreignRef,
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)

    const one = await beginRef(digestA, 'mutation.begin.cross-one')
    const two = await beginRef(digestA, 'mutation.begin.cross-two')
    const crossSession = await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: one,
      expectedRevision: null,
      mutationRef: 'mutation.cross.session',
      checkpoint: checkpointRequest(two, 1),
    })
    expect(crossSession.body).toEqual({ status: 'quarantined' })
  })

  it('issues a different reference to each learner of one household under one mutation reference', async () => {
    // The cross-learner case above varies household and learner together, so it
    // would still hold if the derivation ignored the learner entirely. This one
    // holds the household and the mutation reference fixed and varies only the
    // learner, which is the only arrangement that can observe the student_id
    // component of academy_private.study_production_session_ref.
    //
    // The second learner is seeded here rather than in study_engine_fixtures.sql:
    // that fixture is shared by every study suite and carries one learner per
    // household, and a second one belongs to this proof rather than to all of them.
    await database.query(
      `insert into public.academy_students (
         id, household_id, display_name, lifecycle_status, created_by
       ) values ($1::uuid, $2::uuid, 'Study Student A2', 'active', $3::uuid)`,
      [STUDENT_A2, HOUSEHOLD_A, GUARDIAN_A],
    )
    // Same guardian, same membership. The launch issuer resolves a learner only
    // through an active identity_manager grant on that membership, which is the
    // level beforeAll upgrades the fixture's own grants to.
    await database.query(
      `insert into public.academy_guardian_student_access (
         id, household_id, student_id, membership_id, permission_level,
         status, granted_by
       ) values (
         '00000000-0000-0000-0000-0000000001a4'::uuid, $1::uuid, $2::uuid,
         '00000000-0000-0000-0000-0000000000a2'::uuid, 'identity_manager',
         'active', $3::uuid
       )`,
      [HOUSEHOLD_A, STUDENT_A2, GUARDIAN_A],
    )
    // The issuer also requires an active pin credential. The verifier is the
    // fixture's own synthetic shape, which is all the format check inspects.
    await database.query(
      `insert into academy_private.student_access_credentials (
         id, household_id, student_id, credential_kind, credential_version,
         verifier_scheme, verifier_digest, status, created_actor_kind, created_by,
         creation_reason, correlation_id
       ) values (
         '00000000-0000-0000-0000-000000009103'::uuid, $1::uuid, $2::uuid, 'pin', 1,
         'argon2id', $4::text, 'active', 'guardian', $3::uuid,
         'Synthetic Study credential for the second household A learner',
         '00000000-0000-0000-0000-00000000d103'::uuid
       )`,
      [
        HOUSEHOLD_A,
        STUDENT_A2,
        GUARDIAN_A,
        '$argon2id$v=19$m=65536,t=3,p=1$dGVzdHRlc3R0ZXN0dGVzdA$YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI',
      ],
    )
    const digestA2 = await issueDigest(GUARDIAN_A, STUDENT_A2)

    const mutationRef = 'mutation.begin.same-household-two-learners'
    const firstRef = await beginRef(digestA, mutationRef)
    const second = await begin(digestA2, mutationRef)
    // A begin by the second learner under a mutation reference the first learner
    // has already spent is a begin, not a replay: the replay identity is the
    // learner plus the mutation reference, so this one finds no receipt of its
    // own and lands on no session of anyone else's.
    expect(second.body).toEqual({
      status: 'saved',
      sessionRef: expect.any(String),
      revision: 1,
    })
    const secondRef = (second.body as { sessionRef: string }).sessionRef
    // The decisive comparison: two references the server actually issued, out of
    // one household and one mutation reference. Only the learner differs, so they
    // can only differ because the learner is inside the derivation.
    expect(secondRef).not.toBe(firstRef)
    // The same statement made against the issuing authority directly, so the
    // proof does not depend on the shape of the begin operation around it.
    expect(await issuedSessionRef(database, HOUSEHOLD_A, STUDENT_A2, mutationRef))
      .not.toBe(await issuedSessionRef(database, HOUSEHOLD_A, STUDENT_A, mutationRef))

    // Each session belongs to the learner who began it, in the core row and in
    // the private projection alike.
    const owners = await database.query<{
      core_first: string
      projection_first: string
      core_second: string
      projection_second: string
    }>(`
      select
        (select student_id::text from public.academy_study_sessions
          where id = $1) as core_first,
        (select student_id::text from academy_private.study_production_sessions
          where session_id = $1) as projection_first,
        (select student_id::text from public.academy_study_sessions
          where id = $2) as core_second,
        (select student_id::text from academy_private.study_production_sessions
          where session_id = $2) as projection_second
    `, [firstRef, secondRef])
    expect(owners.rows[0]).toEqual({
      core_first: STUDENT_A,
      projection_first: STUDENT_A,
      core_second: STUDENT_A2,
      projection_second: STUDENT_A2,
    })

    // Neither learner can act under the other's reference, in either direction,
    // even though one household holds both and one guardian issued both.
    await expect(execute(digestA2, PROGRESS, 'session:read', {
      sessionRef: firstRef,
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(execute(digestA, PROGRESS, 'session:read', {
      sessionRef: secondRef,
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(execute(digestA2, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: firstRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.same-household-cross',
      checkpoint: checkpointRequest(firstRef, 1),
    })).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    // That last refusal is only about the learner if the same call by the owner
    // goes through. Compare-and-swap resolves authority through the projection's
    // learner and answers STUDY_OPERATION_NOT_AVAILABLE for a reference that does
    // not exist at all, so the refusal above is attributable only next to this.
    expect((await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: firstRef,
      expectedRevision: null,
      mutationRef: 'mutation.checkpoint.same-household-owner',
      checkpoint: checkpointRequest(firstRef, 1),
    })).body).toEqual({ status: 'saved', revision: 1 })

    // One mutation reference, two receipts, each under its own learner token and
    // each carrying back that learner's own reference.
    const firstScope = await learnerScope(database, STUDENT_A)
    const secondScope = await learnerScope(database, STUDENT_A2)
    expect(firstScope).not.toBe(secondScope)
    const receipts = await database.query<{
      actor_scope: string
      status: string
      session_ref: string
    }>(`
      select actor_scope, result ->> 'status' as status,
        result ->> 'sessionRef' as session_ref
      from academy_private.study_mutation_receipts
      where operation_kind = 'production_session_begin_v1'
        and idempotency_key = $1
    `, [mutationRef])
    expect(receipts.rows).toHaveLength(2)
    const byScope = new Map(receipts.rows.map((row) => [row.actor_scope, row]))
    expect(byScope.get(firstScope)).toEqual({
      actor_scope: firstScope, status: 'saved', session_ref: firstRef,
    })
    expect(byScope.get(secondScope)).toEqual({
      actor_scope: secondScope, status: 'saved', session_ref: secondRef,
    })
  })

  it('adds no idempotency contract over an identifier a caller can already name', async () => {
    // Condition 1's sixth clause, proved against a real row of the older
    // contract rather than by inference. academy_study_create_session is the
    // begin the learner lane already had; it is still granted to authenticated
    // and it keys session_create_v1 on 'session:' plus an id its caller picked.
    const learner = await learnerScope(database, STUDENT_A)
    const beganRef = await beginRef(digestA, 'mutation.census.begin')
    await execute(digestA, ATTEMPTS, 'checkpoint:compare-and-swap', {
      sessionRef: beganRef,
      expectedRevision: null,
      mutationRef: 'mutation.census.checkpoint',
      checkpoint: checkpointRequest(beganRef, 1),
    })
    await asRole('authenticated', GUARDIAN_A, () => database.query(`
      select public.academy_study_create_session($1::jsonb, $2::text)
    `, [
      JSON.stringify({
        id: 'session.legacy.census',
        schema_version: '1',
        student_id: STUDENT_A,
        lesson_id: 'lesson.production.1',
        subject_id: 'math',
        study_plan_id: null,
        state: 'active',
        started_at: nowIso,
        completed_at: null,
        intended_local_date: localDateA,
      }),
      'mutation.legacy.census',
    ]))

    const rows = await database.query<{ actor_scope: string; operation_kind: string }>(`
      select distinct actor_scope, operation_kind
      from academy_private.study_mutation_receipts
      where operation_kind in ('session_create_v1', 'production_session_begin_v1')
      order by operation_kind, actor_scope
    `)
    const legacy = rows.rows.filter((row) => row.operation_kind === 'session_create_v1')
    const wire = rows.rows.filter((row) => row.operation_kind === 'production_session_begin_v1')
    expect(legacy.length).toBeGreaterThan(0)
    expect(wire.length).toBeGreaterThan(0)

    // The older contract addresses a caller-chosen identifier; this one does not
    // address an identifier at all. Disjoint key spaces, so neither can be
    // reached by replaying the other's key.
    expect(legacy.every((row) => row.actor_scope.startsWith('session:'))).toBe(true)
    // Every begin receipt on this wire -- both learners' -- lives under a learner
    // token, never under an identifier. Learner A's is A's own.
    expect(wire.every((row) => /^learner:[0-9a-f]{64}$/.test(row.actor_scope))).toBe(true)
    expect(wire.map((row) => row.actor_scope)).toContain(learner)
    expect(learner).toMatch(/^learner:[0-9a-f]{64}$/)
    expect(
      legacy.some((row) => wire.some((other) => other.actor_scope === row.actor_scope)),
    ).toBe(false)

    // And the learner scope carries this one contract and nothing else.
    const underLearner = await database.query<{ operation_kind: string }>(`
      select distinct operation_kind from academy_private.study_mutation_receipts
      where actor_scope = $1
    `, [learner])
    expect(underLearner.rows.map((row) => row.operation_kind))
      .toEqual(['production_session_begin_v1'])
  })

  it('dispatches every operation the production authority admits', async () => {
    // A map entry with no CASE arm falls out of the executor as case_not_found
    // (20000), which is a different failure from a refused request. Every
    // admitted operation must reach its own arm and refuse this one on its own
    // terms, so an operation cannot be added to the map and go unrouted -- which
    // is what keeps two operations from quietly sharing one arm.
    const authority = await database.query<{ contract: Record<string, string> }>(
      'select academy_private.study_production_runtime_operation_contract() as contract',
    )
    const contract = authority.rows[0].contract
    expect(Object.keys(contract).length).toBe(10)
    for (const [operation, capability] of Object.entries(contract)) {
      await expect(
        execute(digestA, capability, operation, { unroutableKey: 1 }),
        operation,
      ).rejects.toThrow(/STUDY_RUNTIME_REQUEST_INVALID/)
    }
  })

  it('leaves the wire helpers executable by nobody', async () => {
    const helpers = await database.query<{ name: string; anon: boolean; auth: boolean; svc: boolean }>(`
      select p.oid::regprocedure::text as name,
        has_function_privilege('anon', p.oid, 'execute') as anon,
        has_function_privilege('authenticated', p.oid, 'execute') as auth,
        has_function_privilege('service_role', p.oid, 'execute') as svc
      from pg_catalog.pg_proc as p
      join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'academy_private' and p.proname like 'study_production_%'
      order by 1
    `)
    // Postgres grants EXECUTE to PUBLIC by default, so a helper added without a
    // revoke would be reachable. Every one of them is named here by catalogue.
    expect(helpers.rows.length).toBe(10)
    expect(helpers.rows.filter((row) => row.anon || row.auth || row.svc)).toEqual([])
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
  let postgresLocalDateA: string

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
    mutationRef: string,
    overrides: Record<string, unknown> = {},
  ): Promise<RuntimeEnvelope> {
    const request = {
      session: {
        lessonRef: 'lesson.production.1',
        subjectRef: 'math',
        studyPlanRef: null,
        segmentRef: 'segment.1',
        startedAt: postgresNowIso,
        intendedLocalDate: postgresLocalDateA,
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

  async function waitForSerializedBackends(
    pids: number[],
    controllerPid: number,
    controllerLocks: number,
  ) {
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
      const ungranted = advisoryLocks.rows.filter((row) => !row.granted)
      const granted = advisoryLocks.rows.filter((row) => row.granted)
      if (
        activity.rows.length === pids.length &&
        activity.rows.every((row) => row.wait_event_type === 'Lock') &&
        ungranted.length === pids.length &&
        granted.length === controllerLocks &&
        granted.every((row) => row.pid === controllerPid)
      ) {
        return [
          { granted: false, count: ungranted.length },
          { granted: true, count: granted.length },
        ]
      }
      await postgresDelay(20)
    }
    throw new Error(
      `Production session begin backends did not reach the serialized barrier: activity=${JSON.stringify(lastActivity)} advisory=${JSON.stringify(lastAdvisory)}`,
    )
  }

  /**
   * Holds the begin lock for each reference the two callers will be issued, so
   * both backends are inside the operation and blocked before either is released.
   *
   * The lock key is read from academy_private.study_production_session_ref rather
   * than recomputed here: the barrier has to contend with the operation, not with
   * a second copy of the operation's formula.
   */
  async function runBeginBarrier(
    mutationRefA: string,
    mutationRefB: string,
    overridesA: Record<string, unknown> = {},
    overridesB: Record<string, unknown> = {},
  ) {
    const refs = [
      await issuedSessionRef(controller, HOUSEHOLD_A, STUDENT_A, mutationRefA),
      await issuedSessionRef(controller, HOUSEHOLD_A, STUDENT_A, mutationRefB),
    ]
    const distinctRefs = [...new Set(refs)]
    let barrierOpen = false
    let settledPromise: Promise<PromiseSettledResult<RuntimeEnvelope>[]> | undefined
    try {
      await controller.query('begin')
      barrierOpen = true
      for (const ref of distinctRefs) {
        await controller.query(
          `select pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtext('academy:study:production-session:v1'),
            pg_catalog.hashtext($1)
          )`,
          [ref],
        )
      }
      const [controllerPidResult, ...pids] = await Promise.all([
        controller.query<{ pid: number }>('select pg_backend_pid() as pid'),
        clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
        clientB.query<{ pid: number }>('select pg_backend_pid() as pid'),
      ])
      settledPromise = Promise.allSettled([
        executePostgresBegin(clientA, mutationRefA, overridesA),
        executePostgresBegin(clientB, mutationRefB, overridesB),
      ])
      const backendPids = pids.map((result) => result.rows[0].pid)
      const advisory = await waitForSerializedBackends(
        backendPids,
        controllerPidResult.rows[0].pid,
        distinctRefs.length,
      )
      await controller.query('commit')
      barrierOpen = false
      const settled = await settledPromise
      return { advisory, backendPids, settled, refs, distinctRefs }
    } finally {
      if (barrierOpen) await controller.query('rollback')
      if (settledPromise) await settledPromise
    }
  }

  async function sessionWriteCounts(sessionRefs: string[], mutationRefs: string[]) {
    const result = await controller.query<{
      core_rows: number
      projection_rows: number
      receipt_rows: number
      audit_rows: number
    }>(`
      select
        (select count(*)::integer from public.academy_study_sessions
          where id = any($1::text[])) as core_rows,
        (select count(*)::integer from academy_private.study_production_sessions
          where session_id = any($1::text[])) as projection_rows,
        (select count(*)::integer from academy_private.study_mutation_receipts
          where actor_scope = $2::text
            and operation_kind = 'production_session_begin_v1'
            and idempotency_key = any($3::text[])) as receipt_rows,
        (select count(*)::integer from public.academy_study_audit_events
          where event_type = 'session.start' and target_id = any($1::text[])) as audit_rows
    `, [sessionRefs, await learnerScope(controller, STUDENT_A), mutationRefs])
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
      const clock = await controller.query<{ now: string; local_a: string }>(`
        select to_char(
          clock_timestamp() at time zone 'UTC',
          'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
        ) as now,
        to_char(
          (clock_timestamp() at time zone (
            select household_timezone from public.academy_study_household_settings
            where household_id = $1::uuid
          ))::date, 'YYYY-MM-DD'
        ) as local_a
      `, [HOUSEHOLD_A])
      postgresNowIso = clock.rows[0].now
      postgresLocalDateA = clock.rows[0].local_a
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
    const mutationRef = 'mutation.session.concurrent-identical'
    const { advisory, backendPids, settled, distinctRefs } = await runBeginBarrier(
      mutationRef,
      mutationRef,
    )
    const sessionRef = distinctRefs[0]
    console.info(
      `Production begin identical outcomes: ${settled.map((result) =>
        result.status === 'fulfilled'
          ? `fulfilled:${result.value.body?.status}`
          : `rejected:${String((result.reason as { code?: unknown }).code ?? 'unknown')}`
      ).join(',')}`,
    )
    expect(distinctRefs).toHaveLength(1)
    expect(advisory).toEqual([
      { granted: false, count: 2 },
      { granted: true, count: 1 },
    ])
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true)
    const bodies = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value.body
    })
    // Both callers are told the same thing, including the same server-issued
    // reference: the second is a replay of the first, not a second session.
    expect(bodies).toEqual([
      { status: 'saved', sessionRef, revision: 1 },
      { status: 'saved', sessionRef, revision: 1 },
    ])
    expect(await sessionWriteCounts([sessionRef], [mutationRef])).toEqual({
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
    const mutationRef = 'mutation.session.concurrent-different-intent'
    const { advisory, settled, distinctRefs } = await runBeginBarrier(
      mutationRef,
      mutationRef,
      { segmentRef: 'segment.concurrent.a' },
      { segmentRef: 'segment.concurrent.b' },
    )
    const sessionRef = distinctRefs[0]
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
    expect(await sessionWriteCounts([sessionRef], [mutationRef])).toEqual({
      core_rows: 1,
      projection_rows: 1,
      receipt_rows: 1,
      audit_rows: 1,
    })
  }, 30_000)

  it('keeps two simultaneous mutation identities from collapsing into one session', async () => {
    const mutationRefA = 'mutation.session.concurrent-distinct-a'
    const mutationRefB = 'mutation.session.concurrent-distinct-b'
    const { advisory, settled, refs, distinctRefs } = await runBeginBarrier(
      mutationRefA,
      mutationRefB,
    )
    console.info(
      `Production begin distinct-mutation outcomes: ${settled.map((result) =>
        result.status === 'fulfilled'
          ? `fulfilled:${result.value.body?.status}`
          : `rejected:${String((result.reason as { code?: unknown }).code ?? 'unknown')}`
      ).join(',')}`,
    )
    // Two mutation identities are two begins. They are issued different
    // references, so they contend with the barrier and never with each other.
    expect(distinctRefs).toHaveLength(2)
    expect(advisory).toEqual([
      { granted: false, count: 2 },
      { granted: true, count: 2 },
    ])
    expect(settled.every((result) => result.status === 'fulfilled')).toBe(true)
    const bodies = settled.map((result) => {
      if (result.status === 'rejected') throw result.reason
      return result.value.body
    })
    expect(bodies).toEqual([
      { status: 'saved', sessionRef: refs[0], revision: 1 },
      { status: 'saved', sessionRef: refs[1], revision: 1 },
    ])
    expect(await sessionWriteCounts(distinctRefs, [mutationRefA, mutationRefB])).toEqual({
      core_rows: 2,
      projection_rows: 2,
      receipt_rows: 2,
      audit_rows: 2,
    })
  }, 30_000)

  it('answers closed, never with a duplicate-key error, when another lane wins the reference', async () => {
    // The one race this wire cannot lock away: public.academy_study_create_session
    // is granted to authenticated and inserts into public.academy_study_sessions
    // without taking this lock. Here it wins -- the row lands while a begin is
    // already inside the operation and blocked -- and the begin still has to
    // answer on its own terms rather than re-raise SQLSTATE 23505.
    const mutationRef = 'mutation.session.concurrent-foreign-lane'
    const contested = await issuedSessionRef(
      controller, HOUSEHOLD_A, STUDENT_A, mutationRef,
    )
    let barrierOpen = false
    let pending: Promise<RuntimeEnvelope> | undefined
    let settled: PromiseSettledResult<RuntimeEnvelope>
    try {
      await controller.query('begin')
      barrierOpen = true
      await controller.query(
        `select pg_catalog.pg_advisory_xact_lock(
          pg_catalog.hashtext('academy:study:production-session:v1'),
          pg_catalog.hashtext($1)
        )`,
        [contested],
      )
      const [controllerPid, backendPid] = await Promise.all([
        controller.query<{ pid: number }>('select pg_backend_pid() as pid'),
        clientA.query<{ pid: number }>('select pg_backend_pid() as pid'),
      ])
      pending = executePostgresBegin(clientA, mutationRef)
      await waitForSerializedBackends(
        [backendPid.rows[0].pid],
        controllerPid.rows[0].pid,
        1,
      )
      // The other lane's row, written exactly as academy_study_create_session
      // writes it, while the begin is blocked and cannot see it yet.
      await controller.query(`
        insert into public.academy_study_sessions (
          id, schema_version, household_id, student_id, lesson_id, subject_id,
          study_plan_id, state, started_at, completed_at, intended_local_date,
          household_timezone, created_by
        ) values (
          $1, 1, $2::uuid, $3::uuid, 'lesson.production.1', 'math', null,
          'active', $4::timestamptz, null, $5::date, 'UTC', null
        )
      `, [contested, HOUSEHOLD_A, STUDENT_A, postgresNowIso, postgresLocalDateA])
      await controller.query('commit')
      barrierOpen = false
      settled = (await Promise.allSettled([pending]))[0]
    } finally {
      if (barrierOpen) await controller.query('rollback')
      if (pending) await Promise.allSettled([pending])
    }

    expect(settled.status).toBe('fulfilled')
    if (settled.status === 'rejected') throw settled.reason
    expect(settled.value.body).toEqual({ status: 'idempotency-collision' })
    expect(JSON.stringify(settled.value))
      .not.toMatch(/duplicate key|unique constraint|23505|_pkey/)

    const rows = await controller.query<{ core: number; projection: number }>(`
      select
        (select count(*)::integer from public.academy_study_sessions
          where id = $1) as core,
        (select count(*)::integer from academy_private.study_production_sessions
          where session_id = $1) as projection
    `, [contested])
    expect(rows.rows[0]).toEqual({ core: 1, projection: 0 })
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
      fingerprint: '82bf3ebaec1d334bbf3f2ac6c3b914d896cf06b9262d33dbfd56d6a86ab7d7f5',
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
      fingerprint: '139e61032e5b0752a0f07f5ae71271bae72c796668c15209d6fb1bcef574c4b1',
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
      production_wire_session_ref_owner: 'server',
      production_wire_begin_replay_scope: 'learner_mutation_ref',
      production_wire_checkpoint_response_draft_supported: false,
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

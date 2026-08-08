import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_HOUSEHOLD_ID = '10000000-0000-4000-8000-000000000002'
const LEARNER_ID = '20000000-0000-4000-8000-000000000001'
const OTHER_LEARNER_ID = '20000000-0000-4000-8000-000000000002'
const RESTRICTED_LEARNER_ID = '20000000-0000-4000-8000-000000000003'
const GUARDIAN_ID = '30000000-0000-4000-8000-000000000001'
const STRANGER_ID = '30000000-0000-4000-8000-000000000002'
const EVENT_ID = '40000000-0000-4000-8000-000000000001'

const migrationSql = readFile(
  new URL('./migrations/20260808120000_academy_operational_events.sql', import.meta.url),
  'utf8',
)

const bootstrapSql = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth authorization postgres;
  create schema academy_private authorization postgres;

  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = pg_catalog
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb)->>'sub',
        ''
      )::uuid
    )
  $$;

  create table public.academy_households (
    id uuid primary key,
    status text not null
  );
  create table public.academy_household_memberships (
    id uuid primary key,
    household_id uuid not null references public.academy_households (id),
    user_id uuid not null,
    member_role text not null,
    status text not null,
    revoked_at timestamptz
  );
  create table public.academy_students (
    id uuid primary key,
    household_id uuid not null references public.academy_households (id),
    status text not null,
    unique (id, household_id)
  );
  create table public.academy_guardian_student_access (
    id uuid primary key,
    household_id uuid not null references public.academy_households (id),
    membership_id uuid not null references public.academy_household_memberships (id),
    student_id uuid not null references public.academy_students (id),
    permission_level text not null,
    status text not null,
    revoked_at timestamptz
  );

  create or replace function public.academy_is_active_household_guardian(
    target_household_id uuid
  )
  returns boolean
  language sql
  stable
  security definer
  set search_path = pg_catalog
  as $$
    select auth.uid() is not null and exists (
      select 1
      from public.academy_households as household
      join public.academy_household_memberships as membership
        on membership.household_id = household.id
      where household.id = target_household_id
        and household.status = 'active'
        and membership.user_id = auth.uid()
        and membership.member_role = 'guardian'
        and membership.status = 'active'
        and membership.revoked_at is null
    )
  $$;

  create or replace function public.academy_has_student_permission(
    target_student_id uuid,
    required_permission text default 'viewer'
  )
  returns boolean
  language sql
  stable
  security definer
  set search_path = pg_catalog
  as $$
    select auth.uid() is not null
      and required_permission = 'viewer'
      and exists (
        select 1
        from public.academy_guardian_student_access as access
        join public.academy_household_memberships as membership
          on membership.id = access.membership_id
         and membership.household_id = access.household_id
        join public.academy_students as student
          on student.id = access.student_id
         and student.household_id = access.household_id
        join public.academy_households as household
          on household.id = access.household_id
        where access.student_id = target_student_id
          and household.status = 'active'
          and student.status = 'active'
          and membership.user_id = auth.uid()
          and membership.member_role = 'guardian'
          and membership.status = 'active'
          and membership.revoked_at is null
          and access.status = 'active'
          and access.revoked_at is null
      )
  $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;

  insert into public.academy_households (id, status) values
    ('${HOUSEHOLD_ID}', 'active'),
    ('${OTHER_HOUSEHOLD_ID}', 'active');
  insert into public.academy_household_memberships (
    id, household_id, user_id, member_role, status
  ) values (
    '50000000-0000-4000-8000-000000000001',
    '${HOUSEHOLD_ID}',
    '${GUARDIAN_ID}',
    'guardian',
    'active'
  );
  insert into public.academy_students (id, household_id, status) values
    ('${LEARNER_ID}', '${HOUSEHOLD_ID}', 'active'),
    ('${OTHER_LEARNER_ID}', '${OTHER_HOUSEHOLD_ID}', 'active'),
    ('${RESTRICTED_LEARNER_ID}', '${HOUSEHOLD_ID}', 'active');
  insert into public.academy_guardian_student_access (
    id, household_id, membership_id, student_id, permission_level, status
  ) values (
    '60000000-0000-4000-8000-000000000001',
    '${HOUSEHOLD_ID}',
    '50000000-0000-4000-8000-000000000001',
    '${LEARNER_ID}',
    'viewer',
    'active'
  );
`

const databases: PGlite[] = []

type DatabaseRole = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(
  database: PGlite,
  role: DatabaseRole,
  userId: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [
    userId ?? '',
  ])
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

function operationalEvent(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    event_id: EVENT_ID,
    occurred_at: '2026-08-08T14:30:00.000Z',
    household_id: HOUSEHOLD_ID,
    learner_id: LEARNER_ID,
    engine: 'study',
    engine_version: 'study-runtime.v1',
    application_version: '0.1.0',
    curriculum_version: 'math-r1',
    course_ref: 'math-5',
    unit_ref: 'unit-1',
    lesson_ref: 'lesson-2',
    skill_ref: 'fractions.compare',
    event_type: 'session.lifecycle',
    result: 'success',
    duration_ms: 1_250,
    metadata: { phase: 'completed' },
    ...overrides,
  }
}

async function record(database: PGlite, event: Record<string, unknown>) {
  return database.query<{ result: { status: string; eventId: string } }>(
    'select public.academy_record_operational_event_v1($1::jsonb) as result',
    [JSON.stringify(event)],
  )
}

async function recordAsService(database: PGlite, event: Record<string, unknown>) {
  return asRole(database, 'service_role', null, () => record(database, event))
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrapSql)
  await database.exec(await migrationSql)
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy operational event database contract', () => {
  it('accepts a valid guardian-scoped event and returns it through the safe reader', async () => {
    const database = databases[0]
    const written = await asRole(database, 'authenticated', GUARDIAN_ID, () =>
      record(database, operationalEvent()),
    )
    expect(written.rows[0].result).toEqual({ status: 'recorded', eventId: EVENT_ID })

    const read = await asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query<{ events: unknown[] }>(
        'select public.academy_list_operational_events_v1($1, $2, $3) as events',
        [HOUSEHOLD_ID, LEARNER_ID, 10],
      ),
    )
    expect(read.rows[0].events).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        eventId: EVENT_ID,
        householdRef: HOUSEHOLD_ID,
        learnerRef: LEARNER_ID,
        metadata: { phase: 'completed' },
      }),
    ])
  })

  it.each([
    ['engine', { engine: 'jarvis' }],
    ['result', { result: 'mostly-ok' }],
    ['timestamp', { occurred_at: '2026-02-30T10:00:00.000Z' }],
  ])('rejects an invalid %s', async (_name, override) => {
    await expect(recordAsService(databases[0], operationalEvent(override))).rejects.toThrow()
  })

  it('enforces duration bounds', async () => {
    const database = databases[0]
    await expect(
      recordAsService(database, operationalEvent({ duration_ms: -1 })),
    ).rejects.toThrow()
    await expect(
      recordAsService(database, operationalEvent({ duration_ms: 86_400_001 })),
    ).rejects.toThrow()
    await expect(
      recordAsService(database, operationalEvent({ duration_ms: 0 })),
    ).resolves.toBeDefined()
  })

  it('rejects excessive, unknown, and prohibited content metadata', async () => {
    const database = databases[0]
    await expect(recordAsService(database, operationalEvent({
      metadata: { phase: 'completed', padding: 'x'.repeat(2_000) },
    }))).rejects.toThrow()
    await expect(recordAsService(database, operationalEvent({
      metadata: { phase: 'completed', attempt: 1 },
    }))).rejects.toThrow()
    await expect(recordAsService(database, operationalEvent({
      metadata: { phase: 'completed', rawTutorConversation: 'private' },
    }))).rejects.toThrow()
    await expect(recordAsService(database, {
      ...operationalEvent(),
      assessment_answer_content: 'private',
    })).rejects.toThrow()
  })

  it('accepts a legitimate learner-less infrastructure event', async () => {
    const database = databases[0]
    await expect(recordAsService(database, operationalEvent({
      learner_id: null,
      engine: 'infrastructure',
      engine_version: 'health-probe.v1',
      curriculum_version: null,
      course_ref: null,
      unit_ref: null,
      lesson_ref: null,
      skill_ref: null,
      event_type: 'infrastructure.health',
      result: 'unavailable',
      metadata: { component: 'database', state: 'unavailable' },
    }))).resolves.toBeDefined()
  })

  it('rejects missing and cross-household learner scope', async () => {
    const database = databases[0]
    await expect(recordAsService(database, operationalEvent({ learner_id: null }))).rejects.toThrow()
    await expect(recordAsService(database, operationalEvent({
      learner_id: OTHER_LEARNER_ID,
    }))).rejects.toThrow()
  })

  it('denies direct student/anonymous reads and non-guardian RPC reads', async () => {
    const database = databases[0]
    await recordAsService(database, operationalEvent())
    await recordAsService(database, operationalEvent({
      event_id: '40000000-0000-4000-8000-000000000002',
      learner_id: RESTRICTED_LEARNER_ID,
    }))

    await expect(asRole(database, 'anon', null, () =>
      database.query('select * from public.academy_operational_events'),
    )).rejects.toThrow()
    await expect(asRole(database, 'anon', null, () =>
      database.query(
        'select public.academy_list_operational_events_v1($1, null, 10)',
        [HOUSEHOLD_ID],
      ),
    )).rejects.toThrow()
    await expect(asRole(database, 'authenticated', STRANGER_ID, () =>
      database.query(
        'select public.academy_list_operational_events_v1($1, null, 10)',
        [HOUSEHOLD_ID],
      ),
    )).rejects.toThrow()
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query('select * from public.academy_operational_events'),
    )).rejects.toThrow()

    const permittedFeed = await asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query<{ events: Array<{ learnerRef: string | null }> }>(
        'select public.academy_list_operational_events_v1($1, null, 10) as events',
        [HOUSEHOLD_ID],
      ),
    )
    expect(permittedFeed.rows[0].events.map((event) => event.learnerRef)).toEqual([
      LEARNER_ID,
    ])
    await expect(asRole(database, 'authenticated', GUARDIAN_ID, () =>
      database.query(
        'select public.academy_list_operational_events_v1($1, $2, 10)',
        [HOUSEHOLD_ID, RESTRICTED_LEARNER_ID],
      ),
    )).rejects.toThrow()
  })

  it('rejects colliding IDs without overwriting the original row', async () => {
    const database = databases[0]
    await recordAsService(database, operationalEvent())
    await expect(recordAsService(database, operationalEvent({ result: 'failure' }))).rejects.toThrow()
    const stored = await asRole(database, 'service_role', null, () =>
      database.query<{ result: string }>(
        'select result from public.academy_operational_events where event_id = $1',
        [EVENT_ID],
      ),
    )
    expect(stored.rows).toEqual([{ result: 'success' }])
  })
})

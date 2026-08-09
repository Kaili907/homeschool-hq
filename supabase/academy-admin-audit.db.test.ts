import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OWNER_ID = '00000000-0000-4000-8000-000000000101'
const ADMIN_ID = '00000000-0000-4000-8000-000000000102'
const REVOKED_ID = '00000000-0000-4000-8000-000000000103'
const EXPIRED_ID = '00000000-0000-4000-8000-000000000104'
const STUDENT_ID = '00000000-0000-4000-8000-000000000105'
const GUARDIAN_ID = '00000000-0000-4000-8000-000000000106'
const databases: PGlite[] = []

type Role = 'anon' | 'authenticated' | 'service_role'

async function asRole<T>(
  database: PGlite,
  role: Role,
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
    create schema academy_private authorization postgres;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values
      ('${OWNER_ID}'), ('${ADMIN_ID}'), ('${REVOKED_ID}'),
      ('${EXPIRED_ID}'), ('${STUDENT_ID}'), ('${GUARDIAN_ID}');
    create function auth.uid()
    returns uuid language sql stable set search_path = pg_catalog as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  await database.exec(await readFile(
    new URL('./migrations/20260808120000_academy_admin_authorization.sql', import.meta.url),
    'utf8',
  ))
  await database.exec(`
    create function academy_private.operational_is_trusted_server()
    returns boolean language sql stable security definer set search_path = pg_catalog as $$
      select auth.uid() is null
        and current_setting('request.jwt.claim.role', true) = 'service_role'
    $$;
    alter function academy_private.operational_is_trusted_server() owner to postgres;
    revoke all on function academy_private.operational_is_trusted_server()
      from public, anon, authenticated, service_role;
    grant execute on function academy_private.operational_is_trusted_server()
      to service_role;

    insert into public.academy_admin_role_assignments
      (user_id, role, assignment_reason_code)
    values
      ('${OWNER_ID}', 'owner', 'admin.bootstrap'),
      ('${ADMIN_ID}', 'admin', 'admin.bootstrap');
    insert into public.academy_admin_role_assignments
      (user_id, role, status, revision, assigned_at, revoked_at, revoked_by,
       revoked_by_role, assignment_reason_code, revocation_reason_code,
       revocation_correlation_id)
    values
      ('${REVOKED_ID}', 'viewer', 'revoked', 2, now() - interval '2 days',
       now() - interval '1 day', '${OWNER_ID}', 'owner', 'admin.bootstrap',
       'access.revoked', gen_random_uuid());
    insert into public.academy_admin_role_assignments
      (user_id, role, assigned_at, expires_at, assignment_reason_code)
    values
      ('${EXPIRED_ID}', 'viewer', now() - interval '2 days',
       now() - interval '1 day', 'access.temporary');
  `)
  await database.exec(await readFile(
    new URL('./migrations/20260809130000_academy_admin_audit_foundation.sql', import.meta.url),
    'utf8',
  ))
  await database.exec(`
    create function public.test_admin_audit_append(
      p_action text,
      p_resource_type text,
      p_resource_ref text,
      p_previous_value jsonb,
      p_new_value jsonb,
      p_reason_code text default null,
      p_correlation_id uuid default null
    ) returns uuid
    language sql volatile security definer set search_path = pg_catalog as $$
      select academy_private.append_admin_audit_event_v1(
        p_action, p_resource_type, p_resource_ref, null, null,
        p_previous_value, p_new_value, p_reason_code, p_correlation_id
      )
    $$;
    alter function public.test_admin_audit_append(
      text, text, text, jsonb, jsonb, text, uuid
    ) owner to postgres;
    grant execute on function public.test_admin_audit_append(
      text, text, text, jsonb, jsonb, text, uuid
    ) to authenticated;

    create table public.test_privileged_mutation (id text primary key);
    create function public.test_admin_mutation_with_audit(
      p_id text,
      p_new_value jsonb
    ) returns void
    language plpgsql volatile security definer set search_path = pg_catalog as $$
    begin
      insert into public.test_privileged_mutation (id) values (p_id);
      perform academy_private.append_admin_audit_event_v1(
        'configuration.update', 'configuration', p_id,
        null, null, jsonb_build_object('value', false), p_new_value,
        'configuration.changed', null
      );
    end
    $$;
    alter function public.test_admin_mutation_with_audit(text, jsonb) owner to postgres;
    grant execute on function public.test_admin_mutation_with_audit(text, jsonb)
      to authenticated;
  `)
  return database
}

async function append(
  database: PGlite,
  userId: string,
  values: {
    action?: string
    resourceType?: string
    resourceRef?: string
    previousValue?: unknown
    newValue?: unknown
    reasonCode?: string | null
    correlationId?: string | null
  } = {},
) {
  return asRole(database, 'authenticated', userId, () => database.query<{ event_id: string }>(`
    select public.test_admin_audit_append(
      $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::uuid
    ) as event_id
  `, [
    values.action ?? 'configuration.update',
    values.resourceType ?? 'configuration',
    values.resourceRef ?? 'ai.enabled',
    JSON.stringify(values.previousValue ?? { value: false }),
    JSON.stringify(values.newValue ?? { value: true }),
    values.reasonCode === undefined ? 'configuration.changed' : values.reasonCode,
    values.correlationId ?? null,
  ]))
}

async function readAudit(
  database: PGlite,
  values: unknown[] = [50, null, null, null, null, null, 'audit:read'],
) {
  return asRole(database, 'service_role', null, () => database.query<{ projection: any }>(`
    select public.academy_admin_read_audit_events_v1(
      $1, $2, $3, $4, $5, $6, $7
    ) as projection
  `, values))
}

beforeEach(async () => { await createDatabase() })
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('ADMIN-15 append-only Admin audit database foundation', () => {
  it('derives the authenticated actor role and assignment in the database', async () => {
    const database = databases[0]
    const eventId = (await append(database, ADMIN_ID)).rows[0].event_id
    const rows = await database.query<{
      actor_user_ref: string
      actor_role: string
      assignment_matches: boolean
    }>(`
      select event.actor_user_ref, event.actor_role,
        event.actor_assignment_ref = assignment.id as assignment_matches
      from academy_private.admin_audit_events event
      join public.academy_admin_role_assignments assignment
        on assignment.user_id = '${ADMIN_ID}'
      where event.event_id = $1
    `, [eventId])
    expect(rows.rows).toEqual([{
      actor_user_ref: ADMIN_ID,
      actor_role: 'admin',
      assignment_matches: true,
    }])
  })

  it.each([
    ['unauthenticated', null],
    ['student', STUDENT_ID],
    ['guardian', GUARDIAN_ID],
    ['revoked Admin', REVOKED_ID],
    ['expired Admin', EXPIRED_ID],
  ])('denies %s audit append attempts', async (_label, userId) => {
    const database = databases[0]
    const operation = () => database.query(`select public.test_admin_audit_append(
      'configuration.update', 'configuration', 'ai.enabled',
      '{"value":false}'::jsonb, '{"value":true}'::jsonb,
      'configuration.changed', null
    )`)
    if (userId === null) {
      await expect(asRole(database, 'anon', null, operation)).rejects.toThrow()
    } else {
      await expect(asRole(database, 'authenticated', userId, operation))
        .rejects.toThrow(/ADMIN_AUDIT_ACTOR_REQUIRED/)
    }
  })

  it('ignores forged browser role and capability claims', async () => {
    const database = databases[0]
    await database.query(`select set_config('request.jwt.claim.role', 'owner', false)`)
    await database.query(`select set_config('request.jwt.claim.capabilities', 'audit:write', false)`)
    await expect(append(database, STUDENT_ID)).rejects.toThrow(/ADMIN_AUDIT_ACTOR_REQUIRED/)
  })

  it('denies direct browser table insert, read, update, and delete', async () => {
    const database = databases[0]
    const operations = [
      `select * from academy_private.admin_audit_events`,
      `insert into academy_private.admin_audit_events (
        actor_user_ref, actor_role, actor_assignment_ref, action, resource_type,
        resource_ref, previous_value, correlation_id
      ) select '${ADMIN_ID}', 'admin', id, 'configuration.update',
        'configuration', 'forged', '{"value":false}', gen_random_uuid()
        from public.academy_admin_role_assignments where user_id = '${ADMIN_ID}'`,
      `update academy_private.admin_audit_events set actor_role = 'owner'`,
      `delete from academy_private.admin_audit_events`,
    ]
    for (const sql of operations) {
      await expect(asRole(database, 'authenticated', ADMIN_ID, () => database.exec(sql)))
        .rejects.toThrow()
    }
  })

  it('keeps forced RLS default-deny after an accidental application-role grant', async () => {
    const database = databases[0]
    await append(database, ADMIN_ID)
    await database.exec(`grant usage on schema academy_private to authenticated;
      grant select on academy_private.admin_audit_events to authenticated;`)
    const result = await asRole(database, 'authenticated', ADMIN_ID, () =>
      database.query('select * from academy_private.admin_audit_events'))
    expect(result.rows).toEqual([])
  })

  it('rejects update and delete even for the table owner', async () => {
    const database = databases[0]
    await append(database, ADMIN_ID)
    await expect(database.exec(`update academy_private.admin_audit_events
      set reason_code = 'operator.request'`)).rejects.toThrow(/append-only/)
    await expect(database.exec(`delete from academy_private.admin_audit_events`))
      .rejects.toThrow(/append-only/)
  })

  it('validates canonical actions and their exact resource pairing', async () => {
    const database = databases[0]
    await expect(append(database, ADMIN_ID, { action: 'configuration.delete' }))
      .rejects.toThrow(/ACTION_RESOURCE_INVALID/)
    await expect(append(database, ADMIN_ID, { resourceType: 'engine' }))
      .rejects.toThrow(/ACTION_RESOURCE_INVALID/)
    await expect(append(database, ADMIN_ID, {
      action: 'engine.control', resourceType: 'engine', resourceRef: 'tts',
      previousValue: { state: 'enabled' }, newValue: { state: 'disabled' },
      reasonCode: 'engine.controlled',
    })).resolves.toBeDefined()
  })

  it('enforces the local exact reason allowlist and permits a null reason', async () => {
    const database = databases[0]
    await expect(append(database, ADMIN_ID, { reasonCode: 'free text because I wanted to' }))
      .rejects.toThrow(/REASON_INVALID/)
    await expect(append(database, ADMIN_ID, { reasonCode: 'unreviewed.reason' }))
      .rejects.toThrow(/REASON_INVALID/)
    await expect(append(database, ADMIN_ID, { reasonCode: null })).resolves.toBeDefined()
  })

  it.each([
    [{ credential: 'secret' }],
    [{ value: { nested: true } }],
    [{ value: 'https://example.test?token=secret' }],
    [{ value: 'Bearer-secret' }],
    [{ value: 'secret' }],
    [{ value: 'a learner conversation' }],
    [{ value: ['safe', { nested: true }] }],
  ])('rejects prohibited, nested, URL, credential, or free-content value %j', async (newValue) => {
    await expect(append(databases[0], ADMIN_ID, { newValue }))
      .rejects.toThrow(/VALUE_INVALID/)
  })

  it('accepts only bounded minimized flat values', async () => {
    const database = databases[0]
    await expect(append(database, ADMIN_ID, {
      previousValue: { value: false, model_tiers: ['sonnet', 'haiku'] },
      newValue: { value: 50, state: 'enabled' },
    })).resolves.toBeDefined()
    await expect(append(database, ADMIN_ID, { newValue: { value: 'x'.repeat(129) } }))
      .rejects.toThrow(/VALUE_INVALID/)
    await expect(append(database, ADMIN_ID, { newValue: { value: '9'.repeat(3000) } }))
      .rejects.toThrow(/VALUE_INVALID/)
    await expect(append(database, ADMIN_ID, { newValue: { value: Array(17).fill('safe') } }))
      .rejects.toThrow(/VALUE_INVALID/)
  })

  it('preserves the actor snapshot after later authorization loss', async () => {
    const database = databases[0]
    const eventId = (await append(database, ADMIN_ID)).rows[0].event_id
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = now(),
          revoked_by = '${OWNER_ID}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${ADMIN_ID}'
    `)
    const snapshot = await database.query(`select actor_user_ref, actor_role
      from academy_private.admin_audit_events where event_id = $1`, [eventId])
    expect(snapshot.rows).toEqual([{ actor_user_ref: ADMIN_ID, actor_role: 'admin' }])
    await expect(append(database, ADMIN_ID)).rejects.toThrow(/ACTOR_REQUIRED/)
  })

  it('uses a supplied correlation ID or generates one when absent', async () => {
    const database = databases[0]
    const supplied = '90000000-0000-4000-8000-000000000001'
    const suppliedEvent = (await append(database, OWNER_ID, { correlationId: supplied })).rows[0].event_id
    const generatedEvent = (await append(database, OWNER_ID)).rows[0].event_id
    const result = await database.query<{ correlation_id: string }>(`
      select correlation_id from academy_private.admin_audit_events
      where event_id in ($1, $2) order by event_id
    `, [suppliedEvent, generatedEvent])
    expect(result.rows.map((row) => row.correlation_id)).toContain(supplied)
    expect(result.rows.every((row) => /^[0-9a-f-]{36}$/.test(row.correlation_id))).toBe(true)
  })

  it('exposes only the bounded service read RPC with safe actor role', async () => {
    const database = databases[0]
    await append(database, OWNER_ID)
    await expect(asRole(database, 'anon', null, () => database.query(
      `select public.academy_admin_read_audit_events_v1(50,null,null,null,null,null,'audit:read')`,
    ))).rejects.toThrow()
    await expect(asRole(database, 'authenticated', OWNER_ID, () => database.query(
      `select public.academy_admin_read_audit_events_v1(50,null,null,null,null,null,'audit:read')`,
    ))).rejects.toThrow()
    await expect(readAudit(database, [50, null, null, null, null, null, 'overview:read']))
      .rejects.toThrow(/AUDIT_READ_REQUIRED/)
    const projection = (await readAudit(database)).rows[0].projection
    expect(projection.events[0]).toMatchObject({ actorRole: 'owner', action: 'configuration.update' })
    expect(JSON.stringify(projection)).not.toMatch(/actorUser|assignment|bearer|capabilit/i)
  })

  it('enforces max 100 and validates cursor and filters', async () => {
    const database = databases[0]
    await expect(readAudit(database, [101, null, null, null, null, null, 'audit:read']))
      .rejects.toThrow(/QUERY_INVALID/)
    await expect(readAudit(database, [50, new Date().toISOString(), null, null, null, null, 'audit:read']))
      .rejects.toThrow(/QUERY_INVALID/)
    await expect(readAudit(database, [50, null, null, 'wildcard.*', null, null, 'audit:read']))
      .rejects.toThrow(/QUERY_INVALID/)
  })

  it('orders equal timestamps by event ID and paginates deterministically', async () => {
    const database = databases[0]
    const assignment = await database.query<{ id: string }>(`
      select id from public.academy_admin_role_assignments where user_id = '${OWNER_ID}'
    `)
    const assignmentId = assignment.rows[0].id
    await database.exec(`insert into academy_private.admin_audit_events (
      event_id, occurred_at, actor_user_ref, actor_role, actor_assignment_ref,
      action, resource_type, resource_ref, previous_value, new_value,
      reason_code, correlation_id
    ) values
      ('a0000000-0000-4000-8000-000000000001', '2026-08-09T13:00:00Z',
       '${OWNER_ID}', 'owner', '${assignmentId}', 'engine.control', 'engine',
       'tts', '{"state":"enabled"}', '{"state":"disabled"}',
       'engine.controlled', gen_random_uuid()),
      ('a0000000-0000-4000-8000-000000000002', '2026-08-09T13:00:00Z',
       '${OWNER_ID}', 'owner', '${assignmentId}', 'engine.control', 'engine',
       'study', '{"state":"enabled"}', '{"state":"disabled"}',
       'engine.controlled', gen_random_uuid()),
      ('a0000000-0000-4000-8000-000000000003', '2026-08-09T13:00:00Z',
       '${OWNER_ID}', 'owner', '${assignmentId}', 'engine.control', 'engine',
       'tutor', '{"state":"enabled"}', '{"state":"disabled"}',
       'engine.controlled', gen_random_uuid())`)
    const first = (await readAudit(database, [2, null, null, 'engine.control', 'engine', null, 'audit:read'])).rows[0].projection
    expect(first.events.map((event: any) => event.eventId)).toEqual([
      'a0000000-0000-4000-8000-000000000003',
      'a0000000-0000-4000-8000-000000000002',
    ])
    expect(first.hasMore).toBe(true)
    const last = first.events.at(-1)
    const second = (await readAudit(database, [
      2, last.occurredAt, last.eventId, 'engine.control', 'engine', null, 'audit:read',
    ])).rows[0].projection
    expect(second.events.map((event: any) => event.eventId)).toEqual([
      'a0000000-0000-4000-8000-000000000001',
    ])
    expect(second.hasMore).toBe(false)
  })

  it('rolls the caller mutation back when audit append fails', async () => {
    const database = databases[0]
    await expect(asRole(database, 'authenticated', OWNER_ID, () => database.query(
      `select public.test_admin_mutation_with_audit('ai.enabled', '{"prompt":"private"}'::jsonb)`,
    ))).rejects.toThrow(/VALUE_INVALID/)
    expect((await database.query('select * from public.test_privileged_mutation')).rows).toEqual([])
  })

  it('records a caller mutation and audit event in one successful transaction', async () => {
    const database = databases[0]
    await asRole(database, 'authenticated', OWNER_ID, () => database.query(
      `select public.test_admin_mutation_with_audit('ai.enabled', '{"value":true}'::jsonb)`,
    ))
    expect((await database.query('select id from public.test_privileged_mutation')).rows)
      .toEqual([{ id: 'ai.enabled' }])
    expect((await database.query(`select resource_ref from academy_private.admin_audit_events`)).rows)
      .toEqual([{ resource_ref: 'ai.enabled' }])
  })
})

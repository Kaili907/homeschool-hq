import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OWNER_ID = '00000000-0000-4000-8000-000000000201'
const ADMIN_ID = '00000000-0000-4000-8000-000000000202'
const VIEWER_ID = '00000000-0000-4000-8000-000000000203'
const STUDENT_ID = '00000000-0000-4000-8000-000000000204'
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
      ('${OWNER_ID}'), ('${ADMIN_ID}'), ('${VIEWER_ID}'), ('${STUDENT_ID}');
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
      ('${ADMIN_ID}', 'admin', 'admin.bootstrap'),
      ('${VIEWER_ID}', 'viewer', 'admin.bootstrap');
  `)
  await database.exec(await readFile(
    new URL('./migrations/20260809130000_academy_admin_audit_foundation.sql', import.meta.url),
    'utf8',
  ))
  await database.exec(await readFile(
    new URL('./migrations/20260809140000_academy_admin_configuration_core.sql', import.meta.url),
    'utf8',
  ))
  return database
}

function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function preview(
  database: PGlite,
  values: {
    actor?: string
    key?: string
    expectedRevision?: number
    value?: unknown
    reason?: string
    token?: string
  } = {},
) {
  const token = values.token ?? crypto.randomUUID()
  const result = await asRole(database, 'authenticated', values.actor ?? OWNER_ID, () =>
    database.query<{ projection: any }>(`
      select public.academy_admin_preview_configuration_change_v1(
        $1, $2::bigint, $3::jsonb, $4, $5, 'configuration:manage'
      ) as projection
    `, [
      values.key ?? 'runtime.ai.enabled',
      values.expectedRevision ?? 1,
      JSON.stringify(values.value ?? true),
      values.reason ?? 'operator.request',
      tokenDigest(token),
    ]))
  return { token, projection: result.rows[0].projection }
}

async function commit(
  database: PGlite,
  values: {
    actor?: string
    key?: string
    expectedRevision?: number
    value?: unknown
    reason?: string
    requestId?: string
    token: string
  },
) {
  return asRole(database, 'authenticated', values.actor ?? OWNER_ID, () =>
    database.query<{ projection: any }>(`
      select public.academy_admin_commit_configuration_change_v1(
        $1, $2::bigint, $3::jsonb, $4, $5::uuid, $6, 'configuration:manage'
      ) as projection
    `, [
      values.key ?? 'runtime.ai.enabled',
      values.expectedRevision ?? 1,
      JSON.stringify(values.value ?? true),
      values.reason ?? 'operator.request',
      values.requestId ?? crypto.randomUUID(),
      tokenDigest(values.token),
    ]))
}

beforeEach(async () => { await createDatabase() })
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('ADMIN-14A durable configuration database core', () => {
  it('seeds only the eight approved keys with immutable registry metadata', async () => {
    const database = databases[0]
    const rows = await database.query<any>(`
      select setting_key, required_capability, protective_capability,
        warning_level, deployment_ceiling_type, registry_version, integration_status
      from academy_private.admin_configuration_registry order by setting_key
    `)
    expect(rows.rows.map((row) => row.setting_key)).toEqual([
      'ai.approved_tiers', 'ai.default_tier', 'cost.critical.monthly_micros',
      'cost.warning.monthly_micros', 'quota.ai.requests_per_account_day',
      'quota.tts.requests_per_account_day', 'runtime.ai.enabled', 'runtime.tts.enabled',
    ])
    expect(rows.rows.every((row) => row.required_capability === 'configuration:manage')).toBe(true)
    expect(rows.rows.filter((row) => row.protective_capability !== null)
      .map((row) => row.setting_key)).toEqual(['runtime.ai.enabled', 'runtime.tts.enabled'])
    expect(rows.rows.every((row) => row.integration_status === 'pending_runtime_integration')).toBe(true)
    await expect(database.exec(`update academy_private.admin_configuration_registry
      set warning_level = 'warning' where setting_key = 'runtime.ai.enabled'`))
      .rejects.toThrow(/deployment-owned and immutable/)
    await expect(database.exec(`delete from academy_private.admin_configuration_registry
      where setting_key = 'runtime.ai.enabled'`)).rejects.toThrow(/deployment-owned and immutable/)
  })

  it('keeps all five tables behind forced default-deny RLS and exact RPC grants', async () => {
    const database = databases[0]
    const rls = await database.query<{ relname: string, relrowsecurity: boolean, relforcerowsecurity: boolean }>(`
      select relname, relrowsecurity, relforcerowsecurity from pg_class
      where relkind = 'r' and relnamespace = 'academy_private'::regnamespace
        and (relname like 'admin_%configuration%'
          or relname in ('admin_change_confirmations', 'admin_mutation_receipts'))
      order by relname
    `)
    expect(rls.rows).toHaveLength(5)
    expect(rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity)).toBe(true)
    await database.exec(`grant usage on schema academy_private to authenticated;
      grant select on academy_private.admin_configuration_registry to authenticated;`)
    expect((await asRole(database, 'authenticated', OWNER_ID, () => database.query(
      `select * from academy_private.admin_configuration_registry`,
    ))).rows).toEqual([])
    const grants = await database.query<any>(`
      select
        has_function_privilege('authenticated',
          'public.academy_admin_preview_configuration_change_v1(text,bigint,jsonb,text,text,text)', 'execute') as preview_auth,
        has_function_privilege('authenticated',
          'public.academy_admin_commit_configuration_change_v1(text,bigint,jsonb,text,uuid,text,text)', 'execute') as commit_auth,
        has_function_privilege('service_role',
          'public.academy_admin_read_configuration_v1(text)', 'execute') as read_service,
        has_function_privilege('authenticated',
          'public.academy_admin_read_configuration_v1(text)', 'execute') as read_auth,
        has_function_privilege('service_role',
          'public.academy_admin_commit_configuration_change_v1(text,bigint,jsonb,text,uuid,text,text)', 'execute') as commit_service
    `)
    expect(grants.rows[0]).toEqual({
      preview_auth: true, commit_auth: true, read_service: true,
      read_auth: false, commit_service: false,
    })
  })

  it('returns a sanitized configuration:read projection with decimal-string revisions and money', async () => {
    const database = databases[0]
    await expect(asRole(database, 'authenticated', VIEWER_ID, () => database.query(
      `select public.academy_admin_read_configuration_v1('configuration:read')`,
    ))).rejects.toThrow()
    const result = await asRole(database, 'service_role', null, () => database.query<{ projection: any }>(
      `select public.academy_admin_read_configuration_v1('configuration:read') as projection`,
    ))
    const projection = result.rows[0].projection
    expect(projection.schemaVersion).toBe(2)
    expect(projection.integrationStatus).toBe('pending_runtime_integration')
    expect(projection.settings).toHaveLength(8)
    expect(projection.settings.find((item: any) => item.key === 'cost.warning.monthly_micros'))
      .toMatchObject({ value: '10000000', revision: '1', integrationStatus: 'pending_runtime_integration' })
    expect(JSON.stringify(projection)).not.toMatch(/token|secret|actor|assignment|requestId/i)
    await expect(asRole(database, 'service_role', null, () => database.query(
      `select public.academy_admin_read_configuration_v1('overview:read')`,
    ))).rejects.toThrow(/READ_REQUIRED/)
  })

  it('denies Admin, Viewer, and non-Admin mutation while allowing Owner preview', async () => {
    const database = databases[0]
    await expect(preview(database, { actor: ADMIN_ID })).rejects.toThrow(/MANAGE_REQUIRED/)
    await expect(preview(database, { actor: VIEWER_ID })).rejects.toThrow(/MANAGE_REQUIRED/)
    await expect(preview(database, { actor: STUDENT_ID })).rejects.toThrow(/MANAGE_REQUIRED/)
    await expect(preview(database)).resolves.toMatchObject({
      projection: { expectedRevision: '1', integrationStatus: 'pending_runtime_integration' },
    })
  })

  it('rejects unknown keys and every wrong type or bound', async () => {
    const database = databases[0]
    await expect(preview(database, { key: 'arbitrary.key' })).rejects.toThrow(/UNKNOWN_KEY/)
    await expect(preview(database, { reason: 'access.granted' }))
      .rejects.toThrow(/REQUEST_INVALID/)
    const invalid: Array<[string, unknown]> = [
      ['runtime.ai.enabled', 'true'],
      ['quota.ai.requests_per_account_day', 0],
      ['quota.ai.requests_per_account_day', 201],
      ['quota.ai.requests_per_account_day', 1.5],
      ['quota.tts.requests_per_account_day', 0],
      ['quota.tts.requests_per_account_day', 1001],
      ['cost.warning.monthly_micros', 1000000],
      ['cost.warning.monthly_micros', '01'],
      ['cost.warning.monthly_micros', '1000000000001'],
      ['ai.approved_tiers', []],
      ['ai.approved_tiers', ['sonnet', 'sonnet']],
      ['ai.approved_tiers', ['opus']],
      ['ai.default_tier', 'opus'],
    ]
    for (const [key, value] of invalid) {
      await expect(preview(database, { key, value, token: `${key}:${JSON.stringify(value)}` }))
        .rejects.toThrow(/VALUE_INVALID/)
    }
    await expect(preview(database, { key: 'quota.ai.requests_per_account_day', value: 1 }))
      .resolves.toBeDefined()
    await expect(preview(database, { key: 'quota.ai.requests_per_account_day', value: 200 }))
      .resolves.toBeDefined()
    await expect(preview(database, { key: 'quota.tts.requests_per_account_day', value: 1000 }))
      .resolves.toBeDefined()
  })

  it('enforces cost and model cross-setting invariants', async () => {
    const database = databases[0]
    await expect(preview(database, { key: 'cost.warning.monthly_micros', value: '25000000' }))
      .rejects.toThrow(/CROSS_SETTING_INVALID/)
    await expect(preview(database, { key: 'cost.critical.monthly_micros', value: '10000000' }))
      .rejects.toThrow(/CROSS_SETTING_INVALID/)
    await expect(preview(database, { key: 'ai.default_tier', value: 'haiku' }))
      .resolves.toBeDefined()
    await expect(preview(database, { key: 'ai.approved_tiers', value: ['haiku'] }))
      .rejects.toThrow(/CROSS_SETTING_INVALID/)
  })

  it('commits revision N+1, advances the head, consumes confirmation, and appends audit atomically', async () => {
    const database = databases[0]
    const change = await preview(database)
    const requestId = '10000000-0000-4000-8000-000000000001'
    const result = await commit(database, { token: change.token, requestId })
    expect(result.rows[0].projection).toEqual({
      schemaVersion: 2, settingKey: 'runtime.ai.enabled', value: true,
      revision: '2', idempotencyResult: 'created',
      integrationStatus: 'pending_runtime_integration',
    })
    expect((await database.query(`select revision, value from academy_private.admin_configuration_revisions
      where setting_key = 'runtime.ai.enabled' order by revision`)).rows)
      .toEqual([{ revision: 1, value: false }, { revision: 2, value: true }])
    expect((await database.query(`select current_revision from academy_private.admin_configuration_heads
      where setting_key = 'runtime.ai.enabled'`)).rows).toEqual([{ current_revision: 2 }])
    expect((await database.query<any>(`select consumed_at is not null as consumed,
      token_digest from academy_private.admin_change_confirmations`)).rows[0])
      .toMatchObject({ consumed: true, token_digest: tokenDigest(change.token) })
    expect(JSON.stringify((await database.query(`select * from academy_private.admin_change_confirmations`)).rows))
      .not.toContain(change.token)
    expect((await database.query<any>(`select action, resource_ref, resource_revision, correlation_id
      from academy_private.admin_audit_events`)).rows).toEqual([{
      action: 'configuration.update', resource_ref: 'runtime.ai.enabled',
      resource_revision: '2', correlation_id: requestId,
    }])
  })

  it('returns a 409-class revision conflict instead of last-write-wins', async () => {
    const database = databases[0]
    const first = await preview(database, { token: 'first' })
    const stale = await preview(database, { token: 'stale' })
    await commit(database, { token: first.token })
    await expect(commit(database, { token: stale.token }))
      .rejects.toThrow(/REVISION_CONFLICT/)
    expect((await database.query(`select count(*)::integer as count
      from academy_private.admin_configuration_revisions
      where setting_key = 'runtime.ai.enabled'`)).rows).toEqual([{ count: 2 }])
  })

  it('replays the same actor/request/payload and rejects changed immutable payload', async () => {
    const database = databases[0]
    const change = await preview(database)
    const requestId = '10000000-0000-4000-8000-000000000002'
    await commit(database, { token: change.token, requestId })
    const later = await preview(database, {
      token: 'later', expectedRevision: 2, value: false,
    })
    await commit(database, { token: later.token, expectedRevision: 2, value: false })
    const replay = await commit(database, { token: change.token, requestId })
    expect(replay.rows[0].projection).toMatchObject({
      value: true, revision: '2', idempotencyResult: 'replayed',
    })
    await expect(commit(database, { token: change.token, requestId, value: false }))
      .rejects.toThrow(/IDEMPOTENCY_CONFLICT/)
    expect((await database.query(`select count(*)::integer as count
      from academy_private.admin_audit_events`)).rows).toEqual([{ count: 2 }])
  })

  it('rejects expired and reused confirmations', async () => {
    const database = databases[0]
    const expired = await preview(database, { token: 'expired' })
    await database.exec(`update academy_private.admin_change_confirmations
      set issued_at = now() - interval '10 minutes', expires_at = now() - interval '5 minutes'
      where token_digest = '${tokenDigest(expired.token)}'`)
    await expect(commit(database, { token: expired.token })).rejects.toThrow(/CONFIRMATION_EXPIRED/)

    const used = await preview(database, { token: 'used' })
    await commit(database, { token: used.token })
    await expect(commit(database, { token: used.token,
      requestId: '10000000-0000-4000-8000-000000000003' }))
      .rejects.toThrow(/CONFIRMATION_REUSED/)
  })

  it('rolls revision, head, confirmation, and receipt back when the ADMIN-15 audit append fails', async () => {
    const database = databases[0]
    const change = await preview(database)
    await database.exec(`
      create or replace function academy_private.append_admin_audit_event_v1(
        p_action text, p_resource_type text, p_resource_ref text,
        p_resource_version text default null, p_resource_revision text default null,
        p_previous_value jsonb default null, p_new_value jsonb default null,
        p_reason_code text default null, p_correlation_id uuid default null
      ) returns uuid language plpgsql volatile security definer set search_path = pg_catalog as $$
      begin raise exception 'FORCED_AUDIT_FAILURE'; end $$;
    `)
    await expect(commit(database, { token: change.token,
      requestId: '10000000-0000-4000-8000-000000000004' }))
      .rejects.toThrow(/FORCED_AUDIT_FAILURE/)
    expect((await database.query(`select current_revision from academy_private.admin_configuration_heads
      where setting_key = 'runtime.ai.enabled'`)).rows).toEqual([{ current_revision: 1 }])
    expect((await database.query(`select count(*)::integer as count
      from academy_private.admin_configuration_revisions
      where setting_key = 'runtime.ai.enabled'`)).rows).toEqual([{ count: 1 }])
    expect((await database.query(`select consumed_at from academy_private.admin_change_confirmations`)).rows)
      .toEqual([{ consumed_at: null }])
    expect((await database.query(`select * from academy_private.admin_mutation_receipts`)).rows).toEqual([])
  })

  it('refuses revision update/delete and models rollback as another accepted revision', async () => {
    const database = databases[0]
    await expect(database.exec(`update academy_private.admin_configuration_revisions
      set value = 'true' where setting_key = 'runtime.ai.enabled' and revision = 1`))
      .rejects.toThrow(/append-only/)
    await expect(database.exec(`delete from academy_private.admin_configuration_revisions
      where setting_key = 'runtime.ai.enabled'`)).rejects.toThrow(/append-only/)
    const enable = await preview(database, { token: 'enable' })
    await commit(database, { token: enable.token })
    const rollback = await preview(database, {
      token: 'rollback', expectedRevision: 2, value: false,
    })
    await commit(database, {
      token: rollback.token, expectedRevision: 2, value: false,
      requestId: '10000000-0000-4000-8000-000000000005',
    })
    expect((await database.query(`select revision, value
      from academy_private.admin_configuration_revisions
      where setting_key = 'runtime.ai.enabled' order by revision`)).rows)
      .toEqual([
        { revision: 1, value: false },
        { revision: 2, value: true },
        { revision: 3, value: false },
      ])
  })
})

import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const OWNER_ID = '00000000-0000-4000-8000-000000000201'
const ADMIN_ID = '00000000-0000-4000-8000-000000000202'
const VIEWER_ID = '00000000-0000-4000-8000-000000000203'
const SECOND_OWNER_ID = '00000000-0000-4000-8000-000000000204'
const OWNER_ASSIGNMENT = '10000000-0000-4000-8000-000000000201'
const ADMIN_ASSIGNMENT = '10000000-0000-4000-8000-000000000202'
const VIEWER_ASSIGNMENT = '10000000-0000-4000-8000-000000000203'
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
    create schema academy_private authorization postgres;
    create table auth.users (id uuid primary key, email text);
    insert into auth.users (id, email) values
      ('${OWNER_ID}', 'owner-private@example.test'),
      ('${ADMIN_ID}', 'admin-private@example.test'),
      ('${VIEWER_ID}', 'viewer-private@example.test'),
      ('${SECOND_OWNER_ID}', 'second-owner-private@example.test');
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
      (id, user_id, role, assignment_reason_code)
    values
      ('${OWNER_ASSIGNMENT}', '${OWNER_ID}', 'owner', 'admin.bootstrap'),
      ('${ADMIN_ASSIGNMENT}', '${ADMIN_ID}', 'admin', 'admin.bootstrap'),
      ('${VIEWER_ASSIGNMENT}', '${VIEWER_ID}', 'viewer', 'admin.bootstrap');
  `)
  await database.exec(await readFile(
    new URL('./migrations/20260809130000_academy_admin_audit_foundation.sql', import.meta.url),
    'utf8',
  ))
  await database.exec(await readFile(
    new URL('./migrations/20260810144700_academy_admin_access_management.sql', import.meta.url),
    'utf8',
  ))
  return database
}

async function readAccess(database: PGlite, userId: string, capability = 'overview:read') {
  return asRole(database, 'authenticated', userId, () => database.query<{ projection: any }>(`
    select public.academy_admin_read_access_v1($1) as projection
  `, [capability]))
}

async function mutate(
  database: PGlite,
  userId: string,
  values: {
    assignmentRef?: string
    expectedRevision?: number
    newRole?: 'owner' | 'admin' | 'viewer' | null
    reasonCode?: string
    requestId?: string
    capability?: string
  } = {},
) {
  return asRole(database, 'authenticated', userId, () => database.query<{ projection: any }>(`
    select public.academy_admin_mutate_access_v1(
      $1::uuid, $2::bigint, $3::text, $4::text, $5::uuid, $6::text
    ) as projection
  `, [
    values.assignmentRef ?? VIEWER_ASSIGNMENT,
    values.expectedRevision ?? 1,
    values.newRole === undefined ? 'admin' : values.newRole,
    values.reasonCode ?? 'operator.request',
    values.requestId ?? '20000000-0000-4000-8000-000000000201',
    values.capability ?? 'admin_roles:manage',
  ]))
}

beforeEach(async () => { await createDatabase() })
afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('Admin access management database contract', () => {
  it.each([
    ['owner', OWNER_ID],
    ['admin', ADMIN_ID],
    ['viewer', VIEWER_ID],
  ] as const)('allows the canonical %s role to inspect the minimized active-principal projection', async (_role, userId) => {
    const projection = (await readAccess(databases[0], userId)).rows[0].projection
    expect(projection.schemaVersion).toBe(2)
    expect(projection.principals).toHaveLength(3)
    expect(projection.principals.filter((principal: any) => principal.isCurrent)).toHaveLength(1)
    expect(JSON.stringify(projection)).not.toMatch(/email|password|token|session|assignedBy/i)
    expect(JSON.stringify(projection)).not.toContain('private@example.test')
  })

  it('requires the exact read capability marker and a current assignment', async () => {
    await expect(readAccess(databases[0], VIEWER_ID, 'admin_roles:manage'))
      .rejects.toThrow(/ADMIN_ACCESS_READ_REQUIRED/)
    await expect(asRole(databases[0], 'anon', null, () => databases[0].query(
      `select public.academy_admin_read_access_v1('overview:read')`,
    ))).rejects.toThrow()
  })

  it('allows only an owner to change a role and derives a new canonical assignment', async () => {
    const database = databases[0]
    const projection = (await mutate(database, OWNER_ID)).rows[0].projection
    expect(projection).toMatchObject({
      schemaVersion: 2,
      role: 'admin',
      status: 'active',
      revision: '1',
      idempotencyResult: 'applied',
    })
    const history = await database.query<{ role: string; status: string; revision: number }>(`
      select role, status, revision
      from public.academy_admin_role_assignments
      where user_id = '${VIEWER_ID}' order by assigned_at, id
    `)
    expect(history.rows).toEqual([
      { role: 'viewer', status: 'revoked', revision: 2 },
      { role: 'admin', status: 'active', revision: 1 },
    ])
  })

  it.each([
    ['admin', ADMIN_ID],
    ['viewer', VIEWER_ID],
  ] as const)('denies %s privilege elevation and mutation attempts', async (_role, userId) => {
    await expect(mutate(databases[0], userId, { newRole: 'owner' }))
      .rejects.toThrow(/ADMIN_ACCESS_MANAGE_REQUIRED/)
  })

  it('ignores forged browser role and capability claims', async () => {
    const database = databases[0]
    await database.query(`select set_config('request.jwt.claim.admin_role', 'owner', false)`)
    await database.query(`select set_config('request.jwt.claim.capabilities', 'admin_roles:manage', false)`)
    await expect(mutate(database, VIEWER_ID, { newRole: 'owner' }))
      .rejects.toThrow(/ADMIN_ACCESS_MANAGE_REQUIRED/)
  })

  it('protects the sole owner from revocation and demotion without writing audit or history', async () => {
    const database = databases[0]
    for (const newRole of [null, 'admin'] as const) {
      await expect(mutate(database, OWNER_ID, {
        assignmentRef: OWNER_ASSIGNMENT,
        newRole,
        requestId: newRole === null
          ? '20000000-0000-4000-8000-000000000202'
          : '20000000-0000-4000-8000-000000000203',
      })).rejects.toThrow(/ADMIN_ACCESS_SOLE_OWNER_PROTECTED/)
    }
    const owner = await database.query<{ status: string; role: string }>(`
      select status, role from public.academy_admin_role_assignments
      where id = '${OWNER_ASSIGNMENT}'
    `)
    expect(owner.rows).toEqual([{ status: 'active', role: 'owner' }])
    expect((await database.query('select * from academy_private.admin_audit_events')).rows).toEqual([])
  })

  it('permits self-demotion only when another valid owner remains', async () => {
    const database = databases[0]
    await database.exec(`
      insert into public.academy_admin_role_assignments
        (user_id, role, assignment_reason_code)
      values ('${SECOND_OWNER_ID}', 'owner', 'admin.bootstrap')
    `)
    const result = (await mutate(database, OWNER_ID, {
      assignmentRef: OWNER_ASSIGNMENT,
      newRole: 'viewer',
      requestId: '20000000-0000-4000-8000-000000000204',
    })).rows[0].projection
    expect(result).toMatchObject({ role: 'viewer', status: 'active' })
    expect((await readAccess(database, SECOND_OWNER_ID)).rows[0].projection.principals
      .filter((principal: any) => principal.role === 'owner')).toHaveLength(1)
  })

  it('revokes access without accepting a noncanonical replacement role', async () => {
    const database = databases[0]
    const result = (await mutate(database, OWNER_ID, {
      assignmentRef: ADMIN_ASSIGNMENT,
      newRole: null,
      requestId: '20000000-0000-4000-8000-000000000205',
    })).rows[0].projection
    expect(result).toMatchObject({ role: 'admin', status: 'revoked', revision: '2' })
    await expect(mutate(database, OWNER_ID, {
      assignmentRef: VIEWER_ASSIGNMENT,
      newRole: 'superuser' as never,
      requestId: '20000000-0000-4000-8000-000000000206',
    })).rejects.toThrow(/ADMIN_ACCESS_REQUEST_INVALID/)
  })

  it('replays the same immutable request and rejects conflicting reuse or stale revisions', async () => {
    const database = databases[0]
    const values = { requestId: '20000000-0000-4000-8000-000000000207' }
    expect((await mutate(database, OWNER_ID, values)).rows[0].projection.idempotencyResult)
      .toBe('applied')
    expect((await mutate(database, OWNER_ID, values)).rows[0].projection.idempotencyResult)
      .toBe('replayed')
    await expect(mutate(database, OWNER_ID, { ...values, newRole: 'owner' }))
      .rejects.toThrow(/ADMIN_ACCESS_IDEMPOTENCY_CONFLICT/)
    await expect(mutate(database, OWNER_ID, {
      assignmentRef: ADMIN_ASSIGNMENT,
      expectedRevision: 2,
      requestId: '20000000-0000-4000-8000-000000000208',
    })).rejects.toThrow(/ADMIN_ACCESS_REVISION_CONFLICT/)
  })

  it('writes minimized revoke and assign audit events in the mutation transaction', async () => {
    const database = databases[0]
    const requestId = '20000000-0000-4000-8000-000000000209'
    await mutate(database, OWNER_ID, { requestId, newRole: 'admin' })
    const events = await database.query<{
      actor_user_ref: string
      actor_role: string
      action: string
      resource_ref: string
      previous_value: any
      new_value: any
      correlation_id: string
    }>(`
      select actor_user_ref, actor_role, action, resource_ref,
        previous_value, new_value, correlation_id
      from academy_private.admin_audit_events
      order by action desc
    `)
    expect(events.rows).toHaveLength(2)
    expect(events.rows.every((event) => event.actor_user_ref === OWNER_ID
      && event.actor_role === 'owner'
      && event.correlation_id === requestId)).toBe(true)
    expect(events.rows.map((event) => event.action).sort()).toEqual([
      'admin_role.assign', 'admin_role.revoke',
    ])
    expect(JSON.stringify(events.rows)).not.toMatch(/email|password|token|session/i)
  })

  it('keeps receipts and role assignments inaccessible to application roles', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      await expect(asRole(database, role, VIEWER_ID, () => database.query(
        'select * from academy_private.admin_access_mutation_receipts',
      ))).rejects.toThrow()
    }
    await expect(asRole(database, 'service_role', null, () => database.query(
      `select public.academy_admin_mutate_access_v1(
        '${VIEWER_ASSIGNMENT}', 1, 'owner', 'operator.request',
        '20000000-0000-4000-8000-000000000210', 'admin_roles:manage'
      )`,
    ))).rejects.toThrow()
  })
})

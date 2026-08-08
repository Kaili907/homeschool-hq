import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const VIEWER_ID = '00000000-0000-4000-8000-000000000001'
const ADMIN_ID = '00000000-0000-4000-8000-000000000002'
const databases: PGlite[] = []

async function createDatabase() {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth authorization postgres;
    create table auth.users (id uuid primary key);
    insert into auth.users (id) values ('${VIEWER_ID}'), ('${ADMIN_ID}');
  `)
  const migration = await readFile(
    new URL('./migrations/20260808120000_academy_admin_authorization.sql', import.meta.url),
    'utf8',
  )
  await database.exec(migration)
  await database.exec(`
    insert into public.academy_admin_role_assignments
      (user_id, role, assignment_reason)
    values
      ('${VIEWER_ID}', 'viewer', 'local authorization test'),
      ('${ADMIN_ID}', 'admin', 'local authorization test');
  `)
  return database
}

beforeEach(async () => {
  await createDatabase()
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy admin role assignment RLS', () => {
  it('uses the exact fixed role vocabulary and one-active-assignment invariant', async () => {
    const database = databases[0]
    await expect(database.exec(`
      insert into public.academy_admin_role_assignments
        (user_id, role, assignment_reason)
      values ('${VIEWER_ID}', 'owner', 'duplicate active assignment');
    `)).rejects.toThrow()
    await expect(database.exec(`
      update public.academy_admin_role_assignments
      set role = 'superuser'
      where user_id = '${ADMIN_ID}';
    `)).rejects.toThrow()
  })

  it('denies anonymous and authenticated reads and all client mutations', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated']) {
      await database.exec(`set role ${role};`)
      await expect(database.query(
        'select * from public.academy_admin_role_assignments',
      )).rejects.toThrow()
      await expect(database.exec(`
        insert into public.academy_admin_role_assignments
          (user_id, role, assignment_reason)
        values ('${VIEWER_ID}', 'owner', 'forged browser role');
      `)).rejects.toThrow()
      await database.exec('reset role;')
    }
  })

  it('has no client policy, so RLS still hides rows after an accidental SELECT grant', async () => {
    const database = databases[0]
    await database.exec('grant select on public.academy_admin_role_assignments to authenticated;')
    await database.exec('set role authenticated;')
    const rows = await database.query('select * from public.academy_admin_role_assignments')
    expect(rows.rows).toEqual([])
    await database.exec('reset role;')
  })

  it('allows service-role reads but not role assignment or revocation writes', async () => {
    const database = databases[0]
    await database.exec('set role service_role;')
    const roles = await database.query<{ role: string }>(`
      select role from public.academy_admin_role_assignments order by role
    `)
    expect(roles.rows).toEqual([{ role: 'admin' }, { role: 'viewer' }])
    await expect(database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revoked_at = now(), revocation_reason = 'forged revoke'
      where user_id = '${ADMIN_ID}';
    `)).rejects.toThrow()
    await database.exec('reset role;')
  })

  it('removes a revoked assignment from the active server lookup', async () => {
    const database = databases[0]
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked',
          revoked_at = now(),
          revocation_reason = 'access removed by local test'
      where user_id = '${VIEWER_ID}';
    `)
    await database.exec('set role service_role;')
    const active = await database.query<{ role: string }>(`
      select role
      from public.academy_admin_role_assignments
      where user_id = '${VIEWER_ID}'
        and status = 'active'
        and revoked_at is null
    `)
    expect(active.rows).toEqual([])
    await database.exec('reset role;')
  })

  it('forces RLS and grants service_role SELECT only', async () => {
    const database = databases[0]
    const catalog = await database.query<{
      rls: boolean
      force_rls: boolean
      service_select: boolean
      service_insert: boolean
      authenticated_select: boolean
    }>(`
      select
        relation.relrowsecurity as rls,
        relation.relforcerowsecurity as force_rls,
        has_table_privilege('service_role', relation.oid, 'select') as service_select,
        has_table_privilege('service_role', relation.oid, 'insert') as service_insert,
        has_table_privilege('authenticated', relation.oid, 'select') as authenticated_select
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'academy_admin_role_assignments'
    `)
    expect(catalog.rows).toEqual([{
      rls: true,
      force_rls: true,
      service_select: true,
      service_insert: false,
      authenticated_select: false,
    }])
  })
})

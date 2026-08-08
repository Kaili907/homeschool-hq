import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const VIEWER_ID = '00000000-0000-4000-8000-000000000001'
const OWNER_ID = '00000000-0000-4000-8000-000000000002'
const EXPIRED_ID = '00000000-0000-4000-8000-000000000003'
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
    insert into auth.users (id) values ('${VIEWER_ID}'), ('${OWNER_ID}'), ('${EXPIRED_ID}');
    create function auth.uid()
    returns uuid
    language sql
    stable
    set search_path = pg_catalog
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  const migration = await readFile(
    new URL('./migrations/20260808120000_academy_admin_authorization.sql', import.meta.url),
    'utf8',
  )
  await database.exec(migration)
  await database.exec(`
    insert into public.academy_admin_role_assignments
      (user_id, role, assignment_reason_code)
    values
      ('${VIEWER_ID}', 'viewer', 'admin.bootstrap'),
      ('${OWNER_ID}', 'owner', 'admin.bootstrap');
    insert into public.academy_admin_role_assignments
      (user_id, role, assigned_at, expires_at, assignment_reason_code)
    values
      ('${EXPIRED_ID}', 'admin', now() - interval '2 days', now() - interval '1 day', 'access.temporary');
  `)
  return database
}

async function asRole<T>(
  database: PGlite,
  role: 'anon' | 'authenticated' | 'service_role',
  userId: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  await database.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  await database.exec(`set role ${role};`)
  try {
    return await operation()
  } finally {
    await database.exec('reset role;')
    await database.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

async function currentAuthorization(database: PGlite, userId: string) {
  return asRole(database, 'authenticated', userId, () =>
    database.query<{ role: string }>('select role from public.academy_admin_authorization_v2()'))
}

beforeEach(async () => {
  await createDatabase()
})

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
})

describe('Academy admin authorization v2 database boundary', () => {
  it('uses the fixed roles and one-active-assignment invariant', async () => {
    const database = databases[0]
    await expect(database.exec(`
      insert into public.academy_admin_role_assignments
        (user_id, role, assignment_reason_code)
      values ('${VIEWER_ID}', 'owner', 'duplicate.active');
    `)).rejects.toThrow()
    await expect(database.exec(`
      insert into public.academy_admin_role_assignments
        (user_id, role, assignment_reason_code)
      values ('${EXPIRED_ID}', 'superuser', 'invalid.role');
    `)).rejects.toThrow()
  })

  it('derives auth.uid through the narrow function and exposes no user selector', async () => {
    const database = databases[0]
    expect((await currentAuthorization(database, VIEWER_ID)).rows).toEqual([{ role: 'viewer' }])
    expect((await currentAuthorization(database, OWNER_ID)).rows).toEqual([{ role: 'owner' }])
    const signature = await database.query<{ arguments: string }>(`
      select pg_catalog.pg_get_function_identity_arguments(procedure.oid) as arguments
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'academy_admin_authorization_v2'
    `)
    expect(signature.rows).toEqual([{ arguments: '' }])
  })

  it('rejects expired assignments on every authorization lookup', async () => {
    const database = databases[0]
    expect((await currentAuthorization(database, EXPIRED_ID)).rows).toEqual([])
  })

  it('rejects revoked assignments and preserves their history', async () => {
    const database = databases[0]
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked',
          revision = 2,
          revoked_at = now(),
          revoked_by = '${OWNER_ID}',
          revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${VIEWER_ID}';
    `)
    expect((await currentAuthorization(database, VIEWER_ID)).rows).toEqual([])
    const history = await database.query<{ status: string; revision: number }>(`
      select status, revision
      from public.academy_admin_role_assignments
      where user_id = '${VIEWER_ID}'
    `)
    expect(history.rows).toEqual([{ status: 'revoked', revision: 2 }])
    await expect(database.exec(`
      delete from public.academy_admin_role_assignments where user_id = '${VIEWER_ID}';
    `)).rejects.toThrow(/history cannot be deleted/)
  })

  it('permits no assignment edits other than the one-way audited revocation shape', async () => {
    const database = databases[0]
    await expect(database.exec(`
      update public.academy_admin_role_assignments
      set role = 'owner'
      where user_id = '${VIEWER_ID}';
    `)).rejects.toThrow(/only an audited revocation transition/)
    await expect(database.exec(`
      update public.academy_admin_role_assignments
      set expires_at = now() + interval '1 day'
      where user_id = '${VIEWER_ID}';
    `)).rejects.toThrow(/only an audited revocation transition/)
  })

  it('denies direct table reads and mutations to every application role', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      await expect(asRole(database, role, VIEWER_ID, () =>
        database.query('select * from public.academy_admin_role_assignments'))).rejects.toThrow()
      await expect(asRole(database, role, VIEWER_ID, () => database.exec(`
        insert into public.academy_admin_role_assignments
          (user_id, role, assignment_reason_code)
        values ('${VIEWER_ID}', 'owner', 'forged.browser');
      `))).rejects.toThrow()
    }
  })

  it('keeps RLS default-deny after an accidental authenticated SELECT grant', async () => {
    const database = databases[0]
    await database.exec('grant select on public.academy_admin_role_assignments to authenticated;')
    const rows = await asRole(database, 'authenticated', VIEWER_ID, () =>
      database.query('select * from public.academy_admin_role_assignments'))
    expect(rows.rows).toEqual([])
  })

  it('grants only authenticated execution on the fixed-search-path security definer', async () => {
    const database = databases[0]
    await expect(asRole(database, 'anon', null, () =>
      database.query('select * from public.academy_admin_authorization_v2()'))).rejects.toThrow()
    await expect(asRole(database, 'service_role', null, () =>
      database.query('select * from public.academy_admin_authorization_v2()'))).rejects.toThrow()

    const catalog = await database.query<{
      security_definer: boolean
      volatility: string
      configuration: string[]
      owner: string
      authenticated_execute: boolean
      anon_execute: boolean
      service_execute: boolean
    }>(`
      select
        procedure.prosecdef as security_definer,
        procedure.provolatile as volatility,
        procedure.proconfig as configuration,
        pg_catalog.pg_get_userbyid(procedure.proowner) as owner,
        has_function_privilege('authenticated', procedure.oid, 'execute') as authenticated_execute,
        has_function_privilege('anon', procedure.oid, 'execute') as anon_execute,
        has_function_privilege('service_role', procedure.oid, 'execute') as service_execute
      from pg_catalog.pg_proc as procedure
      join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
        and procedure.proname = 'academy_admin_authorization_v2'
    `)
    expect(catalog.rows).toEqual([{
      security_definer: true,
      volatility: 's',
      configuration: ['search_path=pg_catalog'],
      owner: 'postgres',
      authenticated_execute: true,
      anon_execute: false,
      service_execute: false,
    }])
  })

  it('forces table RLS, grants no direct access, and includes canonical audit preparation', async () => {
    const database = databases[0]
    const catalog = await database.query<{
      rls: boolean
      force_rls: boolean
      service_select: boolean
      authenticated_select: boolean
    }>(`
      select
        relation.relrowsecurity as rls,
        relation.relforcerowsecurity as force_rls,
        has_table_privilege('service_role', relation.oid, 'select') as service_select,
        has_table_privilege('authenticated', relation.oid, 'select') as authenticated_select
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = 'academy_admin_role_assignments'
    `)
    expect(catalog.rows).toEqual([{
      rls: true,
      force_rls: true,
      service_select: false,
      authenticated_select: false,
    }])
    const columns = await database.query<{ column_name: string }>(`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'academy_admin_role_assignments'
        and column_name in (
          'revision', 'assigned_by', 'assigned_by_role', 'assignment_reason_code',
          'assignment_correlation_id', 'revoked_by', 'revoked_by_role',
          'revocation_reason_code', 'revocation_correlation_id'
        )
      order by column_name
    `)
    expect(columns.rows.map((row) => row.column_name)).toEqual([
      'assigned_by',
      'assigned_by_role',
      'assignment_correlation_id',
      'assignment_reason_code',
      'revision',
      'revocation_correlation_id',
      'revocation_reason_code',
      'revoked_by',
      'revoked_by_role',
    ])
  })
})

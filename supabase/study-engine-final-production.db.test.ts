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
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
let database: PGlite

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

async function asRole<T>(role: 'authenticated' | 'service_role', subject: string | null, run: () => Promise<T>) {
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

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  const sources = await sql
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
    where id = '00000000-0000-0000-0000-0000000001a1'::uuid
  `)
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Session 19 final production reconciliation', () => {
  it('records one final marker and keeps policy private and not approved', async () => {
    const result = await database.query<{
      final_production_version: number
      migration_names: string[]
      policy: string
      policy_grants: number
    }>(`
      select metadata.final_production_version, metadata.migration_names,
        policy.adult_review_in_app_delivery_policy as policy,
        (select count(*)::integer from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name = 'study_production_policy'
            and grantee in ('anon', 'authenticated', 'service_role')) as policy_grants
      from academy_private.study_persistence_metadata as metadata
      cross join academy_private.study_production_policy as policy
      where metadata.singleton and policy.singleton
    `)
    expect(result.rows[0]).toMatchObject({
      final_production_version: 1,
      policy: 'not-approved',
      policy_grants: 0,
    })
    expect(result.rows[0].migration_names.at(-1)).toBe(
      '20260801190000_academy_study_final_production_reconciliation',
    )
  })

  it('projects guardian issuance to the exact opaque browser envelope', async () => {
    const issued = await asRole('authenticated', GUARDIAN_A, () => rpc<Record<string, unknown>>(
      'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
      ['academy-student-id', STUDENT_A],
    ))
    expect(Object.keys(issued).sort()).toEqual(['expiresAt', 'schemaVersion', 'sessionReference', 'status'])
    expect(issued).toMatchObject({ schemaVersion: 1, status: 'issued' })
    expect(issued.sessionReference).toMatch(/^[A-Za-z0-9_-]{32,256}$/)
  })

  it('rebinds an opaque grant for every academic operation and restores claims', async () => {
    const issued = await asRole('authenticated', GUARDIAN_A, () => rpc<Record<string, unknown>>(
      'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
      ['academy-student-id', STUDENT_A],
    ))
    const digest = createHash('sha256').update(String(issued.sessionReference), 'ascii').digest('hex')
    const result = await asRole('service_role', null, () => rpc<Record<string, unknown>>(
      `select public.academy_study_execute_verified_runtime_v1(
        $1::text, 'student:progress:read', 'dashboard:read', '{}'::jsonb
      ) as result`,
      [digest],
    ))
    expect(result).toMatchObject({ schemaVersion: 1, status: 'ok', operation: 'dashboard:read' })
    expect(JSON.stringify(result)).toContain('session-a')
    expect(JSON.stringify(result)).not.toContain('session-b')

    const restored = await database.query<{ claims: string }>(
      "select current_setting('request.jwt.claims', true) as claims",
    )
    expect(restored.rows[0].claims).toBe('')
    const definition = await database.query<{ definition: string }>(`
      select pg_get_functiondef(
        'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)'::regprocedure
      ) as definition
    `)
    expect(definition.rows[0].definition.toLowerCase()).toContain(
      'for share of session_grant, student, household, credential, membership, access',
    )
  })

  it('keeps final readiness not-ready without Director policy approval', async () => {
    const readiness = await asRole('service_role', null, () => rpc<Record<string, unknown>>(
      'select public.academy_study_final_production_readiness_v1() as result',
    ))
    expect(readiness).toEqual({
      schemaVersion: 1,
      status: 'not-ready',
      staffAuthorization: 'disabled',
    })
    const definition = await database.query<{ definition: string }>(`
      select pg_get_functiondef(
        'public.academy_study_deliver_in_app_notification_v2(text,jsonb)'::regprocedure
      ) as definition
    `)
    expect(definition.rows[0].definition).toContain('STUDY_ADULT_REVIEW_POLICY_NOT_APPROVED')
    expect(definition.rows[0].definition).toContain('study_production_policy')
  })

  it('uses correct volatility and narrow execute grants for final security definers', async () => {
    const result = await database.query<{
      immutable_time_functions: number
      runtime_authenticated: boolean
      runtime_service: boolean
      launch_anon: boolean
      launch_authenticated: boolean
    }>(`
      select
        (select count(*)::integer from pg_proc as procedure
          join pg_namespace as namespace on namespace.oid = procedure.pronamespace
          where namespace.nspname in ('public', 'academy_private')
            and procedure.proname like '%study%'
            and procedure.provolatile = 'i'
            and pg_get_functiondef(procedure.oid) ~ '(clock_timestamp\\(\\)|transaction_timestamp\\(\\)|[^a-z_]now\\(\\))')
          as immutable_time_functions,
        has_function_privilege('authenticated',
          'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)', 'execute')
          as runtime_authenticated,
        has_function_privilege('service_role',
          'public.academy_study_execute_verified_runtime_v1(text,text,text,jsonb)', 'execute')
          as runtime_service,
        has_function_privilege('anon',
          'public.academy_study_issue_guardian_launch_v1(text,text)', 'execute') as launch_anon,
        has_function_privilege('authenticated',
          'public.academy_study_issue_guardian_launch_v1(text,text)', 'execute')
          as launch_authenticated
    `)
    expect(result.rows[0]).toEqual({
      immutable_time_functions: 0,
      runtime_authenticated: false,
      runtime_service: true,
      launch_anon: false,
      launch_authenticated: true,
    })
  })
})

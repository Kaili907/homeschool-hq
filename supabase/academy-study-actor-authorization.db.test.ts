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
  './migrations/20260816160000_academy_study_actor_authorization.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const VIEWER_A = '00000000-0000-0000-0000-0000000000a3'
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

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
  extraClaims: Record<string, unknown> = {},
): Promise<T> {
  const claims = JSON.stringify({ role, ...(subject ? { sub: subject } : {}), ...extraClaims })
    .replaceAll("'", "''")
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

async function authorize(
  actor: string,
  digest: string,
  capability = 'student:attempts:create',
  claims: Record<string, unknown> = {},
) {
  return asRole('authenticated', actor, () => rpc<Record<string, unknown>>(
    `select public.academy_study_authorize_guardian_session_v1(
      $1::text, $2::text
    ) as result`,
    [digest, capability],
  ), claims)
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const source of await sql) await database.exec(source)
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id = '00000000-0000-0000-0000-0000000001a1';
  `)
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Study actor authorization migration', () => {
  let digest: string

  it('exposes only the authenticated actor check and records its security marker', async () => {
    const result = await database.query<{
      authenticated_execute: boolean
      anon_execute: boolean
      service_execute: boolean
      action_authenticated_execute: boolean
      action_service_execute: boolean
      marker: number
      migration_names: string[]
    }>(`
      select
        has_function_privilege(
          'authenticated',
          'public.academy_study_authorize_guardian_session_v1(text,text)',
          'execute'
        ) as authenticated_execute,
        has_function_privilege(
          'anon',
          'public.academy_study_authorize_guardian_session_v1(text,text)',
          'execute'
        ) as anon_execute,
        has_function_privilege(
          'service_role',
          'public.academy_study_authorize_guardian_session_v1(text,text)',
          'execute'
        ) as service_execute,
        has_function_privilege(
          'authenticated',
          'public.academy_study_authorize_guardian_action_v1(text)',
          'execute'
        ) as action_authenticated_execute,
        has_function_privilege(
          'service_role',
          'public.academy_study_authorize_guardian_action_v1(text)',
          'execute'
        ) as action_service_execute,
        (security_manifest ->> 'study_actor_authorization_version')::integer as marker,
        migration_names
      from academy_private.study_persistence_metadata
      where singleton
    `)
    expect(result.rows[0]).toMatchObject({
      authenticated_execute: true,
      anon_execute: false,
      service_execute: false,
      action_authenticated_execute: true,
      action_service_execute: false,
      marker: 1,
    })
    expect(result.rows[0].migration_names.at(-1)).toBe(
      '20260816160000_academy_study_actor_authorization',
    )
  })

  it('authorizes only the verified guardian who owns the current exact-capability grant', async () => {
    const issued = await asRole('authenticated', GUARDIAN_A, () => rpc<{
      sessionReference: string
    }>(
      'select public.academy_study_issue_guardian_launch_v1($1, $2) as result',
      ['academy-student-id', STUDENT_A],
    ))
    digest = createHash('sha256').update(issued.sessionReference, 'ascii').digest('hex')

    await expect(authorize(GUARDIAN_A, digest)).resolves.toEqual({
      schemaVersion: 1,
      status: 'authorized',
    })
    await expect(authorize(GUARDIAN_A, digest, 'student:assignments:read')).resolves.toEqual({
      schemaVersion: 1,
      status: 'authorized',
    })
    await expect(authorize(GUARDIAN_A, digest, 'study:manage')).resolves.toEqual({
      schemaVersion: 1,
      status: 'denied',
    })
  })

  it('denies cross-household, viewer, and caller-authored authority claims', async () => {
    const forgedClaims = {
      role: 'owner',
      household_id: '00000000-0000-0000-0000-000000000011',
      student_id: STUDENT_A,
      capabilities: ['student:attempts:create'],
    }
    await expect(authorize(GUARDIAN_B, digest, 'student:attempts:create', forgedClaims))
      .resolves.toEqual({ schemaVersion: 1, status: 'denied' })
    await expect(authorize(VIEWER_A, digest, 'student:attempts:create', forgedClaims))
      .resolves.toEqual({ schemaVersion: 1, status: 'denied' })
  })

  it('checks the exact pre-session guardian capability without trusting role claims', async () => {
    const guardianAction = (actor: string, capability: string, claims = {}) =>
      asRole('authenticated', actor, () => rpc<Record<string, unknown>>(
        'select public.academy_study_authorize_guardian_action_v1($1::text) as result',
        [capability],
      ), claims)
    await expect(guardianAction(GUARDIAN_A, 'study:production-readiness:read'))
      .resolves.toEqual({ schemaVersion: 1, status: 'authorized' })
    await expect(guardianAction(GUARDIAN_A, 'study:production-readiness:write'))
      .resolves.toEqual({ schemaVersion: 1, status: 'denied' })
    await expect(guardianAction(VIEWER_A, 'study:production-readiness:read', {
      role: 'owner',
      capabilities: ['study:production-readiness:read'],
    })).resolves.toEqual({ schemaVersion: 1, status: 'denied' })
  })

  it('does not let service-role execution substitute for actor authorization', async () => {
    await expect(asRole('service_role', null, () => rpc(
      `select public.academy_study_authorize_guardian_session_v1(
        $1::text, 'student:attempts:create'
      ) as result`,
      [digest],
    ))).rejects.toThrow(/permission denied/i)
    await database.exec('rollback')
    await expect(asRole('service_role', null, () => rpc(
      `select public.academy_study_authorize_guardian_action_v1(
        'study:production-readiness:read'
      ) as result`,
    ))).rejects.toThrow(/permission denied/i)
    await database.exec('rollback')
  })

  it('rechecks membership and student access on every authorization', async () => {
    await database.exec(`
      update public.academy_guardian_student_access
      set status = 'revoked', revoked_at = clock_timestamp(),
          revoked_by = '${GUARDIAN_A}', revocation_reason = 'security regression'
      where id = '00000000-0000-0000-0000-0000000001a1';
    `)
    await expect(authorize(GUARDIAN_A, digest)).resolves.toEqual({
      schemaVersion: 1,
      status: 'denied',
    })
  })
})

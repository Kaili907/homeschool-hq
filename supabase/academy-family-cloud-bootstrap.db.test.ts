import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const manifest = JSON.parse(await readFile(new URL('../docs/study-engine-final-production/migration-manifest.json', import.meta.url), 'utf8')) as {
  migrations: readonly { filename: string }[]
}
const sources = Promise.all(manifest.migrations.map(({ filename }) =>
  readFile(new URL(`./migrations/${filename}`, import.meta.url), 'utf8')))

const PARENT_A = '91000000-0000-4000-8000-000000000001'
const PARENT_B = '92000000-0000-4000-8000-000000000002'
let database: PGlite

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key, email text);
  create or replace function auth.uid()
  returns uuid language sql stable set search_path = pg_catalog as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub', '')::uuid
    )
  $$;
  revoke all on schema auth from public;
  grant usage on schema auth to anon, authenticated, service_role;
  revoke all on function auth.uid() from public;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  revoke all on schema public from public, anon, authenticated, service_role;
  grant usage on schema public to public, anon, authenticated, service_role;
`

async function asAuthenticated<T>(subject: string, studentPrincipal: boolean, operation: () => Promise<T>): Promise<T> {
  const claims = JSON.stringify({ role: 'authenticated', sub: subject,
    ...(studentPrincipal ? { academy_principal_kind: 'student_session_grant' } : {}) }).replaceAll("'", "''")
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject}', false);
    select set_config('request.jwt.claims', '${claims}', false);
    set role authenticated;
  `)
  try { return await operation() } finally {
    await database.exec(`
      reset role;
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
    `)
  }
}

async function call(subject: string, learners: unknown) {
  return asAuthenticated(subject, false, async () => {
    const result = await database.query<{ value: Record<string, unknown> }>(
      'select public.academy_family_cloud_bootstrap_r1($1::jsonb) as value',
      [JSON.stringify(learners)],
    )
    return result.rows[0].value
  })
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const [index, source] of (await sources).entries()) {
    try { await database.exec(source) } catch (cause) {
      throw new Error(`Failed to apply ${manifest.migrations[index]?.filename}`, { cause })
    }
  }
  await database.exec(`
    insert into auth.users(id,email) values
      ('${PARENT_A}','a@example.test'),
      ('${PARENT_B}','b@example.test');
  `)
}, 120_000)

afterAll(async () => database?.close())

describe.sequential('Family Cloud authenticated household bootstrap R1', () => {
  it('creates exactly one auth.uid-bound household, membership, learner access, and ephemeral grants', async () => {
    const learners = [
      { learnerRef: 'student:ada', displayName: 'Ada', gradeLevel: '5' },
      { learnerRef: 'student:bea', displayName: 'Bea', gradeLevel: '8' },
    ]
    const first = await call(PARENT_A, learners)
    const second = await call(PARENT_A, learners)
    expect(first).toMatchObject({ schemaVersion: 1, status: 'ready' })
    expect((first.learners as { learnerRef: string; hostedAssignmentRef: string }[])
      .map(({ learnerRef, hostedAssignmentRef }) => ({ learnerRef, hostedAssignmentRef }))
      .sort((a, b) => a.learnerRef.localeCompare(b.learnerRef))).toEqual([
        { learnerRef: 'student:ada', hostedAssignmentRef: 'family-cloud:learner-authority' },
        { learnerRef: 'student:bea', hostedAssignmentRef: 'family-cloud:learner-authority' },
      ])
    expect(second.householdRef).toBe(first.householdRef)
    const counts = await database.query<{ households: number; memberships: number; students: number; access_rows: number }>(`
      select
        (select count(*)::int from public.academy_households where created_by='${PARENT_A}') as households,
        (select count(*)::int from public.academy_household_memberships where user_id='${PARENT_A}' and status='active') as memberships,
        (select count(*)::int from public.academy_students where household_id='${first.householdRef}') as students,
        (select count(*)::int from public.academy_guardian_student_access where household_id='${first.householdRef}' and status='active') as access_rows
    `)
    expect(counts.rows[0]).toEqual({ households: 1, memberships: 1, students: 2, access_rows: 2 })
    expect(JSON.stringify(first)).not.toMatch(/pin|verifier|password|accessToken|refreshToken|service.?role|sessionReference/i)
    expect((first.learners as { tokenDigest: string }[]).every((item) => /^[0-9a-f]{64}$/.test(item.tokenDigest))).toBe(true)
  })

  it('cannot join or write another household and cannot nominate a role or user', async () => {
    const other = await call(PARENT_B, [])
    const first = await call(PARENT_A, [{ learnerRef: 'student:new', displayName: 'New', gradeLevel: null }])
    expect(other.householdRef).not.toBe(first.householdRef)
    const cross = await database.query<{ count: number }>(`
      select count(*)::int as count
      from public.academy_household_memberships
      where household_id='${other.householdRef}' and user_id='${PARENT_A}'
    `)
    expect(cross.rows[0].count).toBe(0)
    await expect(call(PARENT_A, [{ learnerRef: 'student:bad', displayName: 'Bad', gradeLevel: null, role: 'admin' }]))
      .rejects.toThrow()
  })

  it('denies anonymous and student-principal execution', async () => {
    const anon = await database.query<{ allowed: boolean }>(`
      select has_function_privilege('anon','public.academy_family_cloud_bootstrap_r1(jsonb)','EXECUTE') as allowed
    `)
    expect(anon.rows[0].allowed).toBe(false)
    await expect(asAuthenticated(PARENT_A, true, () => database.query(
      `select public.academy_family_cloud_bootstrap_r1('[]'::jsonb)`,
    ))).rejects.toThrow()
  })
})

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
  './tests/study_engine_fixtures.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))
const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const VIEWER_A = '00000000-0000-0000-0000-0000000000a3'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'
const TOKEN_PATTERN = /^aca_stu_v1_[A-Za-z0-9_-]{43}$/

let database: PGlite

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth authorization postgres;
  create table auth.users (id uuid primary key);
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  set search_path = pg_catalog
  as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
      nullif(
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'sub',
        ''
      )::uuid
    )
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`

function claims(role: 'authenticated' | 'service_role', subject: string | null) {
  return JSON.stringify({ role, ...(subject ? { sub: subject } : {}) })
}

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const roleClaims = claims(role === 'anon' ? 'authenticated' : role, subject)
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${subject ?? ''}', false);
    select set_config('request.jwt.claims', '${roleClaims.replaceAll("'", "''")}', false);
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

async function rpc<T>(statement: string, parameters: unknown[] = []) {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

async function issue(
  guardianId: string,
  selectorValue: string,
  selectorKind: 'academy-student-id' | 'legacy-profile-id' = 'academy-student-id',
) {
  return asRole('authenticated', guardianId, () => rpc<Record<string, unknown>>(
    'select public.academy_study_issue_guardian_launch_v1($1::text, $2::text) as result',
    [selectorKind, selectorValue],
  ))
}

async function verify(token: string, capability = 'student:progress:read') {
  const digest = createHash('sha256').update(token, 'ascii').digest('hex')
  return asRole('service_role', null, () => rpc<Record<string, unknown>>(
    'select public.academy_study_verify_session_v1($1::text, $2::text) as result',
    [digest, capability],
  ))
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const source of await sql) await database.exec(source)
  // Study learner-session issuance is identity administration, which is
  // intentionally stricter than ordinary learning management.
  await database.exec(`
    update public.academy_guardian_student_access
    set permission_level = 'identity_manager'
    where id in (
      '00000000-0000-0000-0000-0000000001a1',
      '00000000-0000-0000-0000-0000000001b1'
    );
    update public.academy_students
    set legacy_profile_id = case id
      when '${STUDENT_A}'::uuid then 'legacy-learner-a'
      when '${STUDENT_B}'::uuid then 'legacy-learner-b'
      else legacy_profile_id
    end
    where id in ('${STUDENT_A}'::uuid, '${STUDENT_B}'::uuid);
  `)
}, 120_000)

afterAll(async () => {
  await database?.close()
})

describe.sequential('Academy Study verified identity migration', () => {
  it('records the additive marker and exposes only the narrow execute surface', async () => {
    const result = await database.query<{
      verified_identity_version: number
      migration_names: string[]
      issue_authenticated: boolean
      issue_anon: boolean
      verify_authenticated: boolean
      verify_service: boolean
      revoke_service: boolean
      staff_functions: number
    }>(`
      select
        metadata.verified_identity_version,
        metadata.migration_names,
        has_function_privilege(
          'authenticated',
          'public.academy_study_issue_guardian_launch_v1(text,text)',
          'execute'
        ) as issue_authenticated,
        has_function_privilege(
          'anon',
          'public.academy_study_issue_guardian_launch_v1(text,text)',
          'execute'
        ) as issue_anon,
        has_function_privilege(
          'authenticated',
          'public.academy_study_verify_session_v1(text,text)',
          'execute'
        ) as verify_authenticated,
        has_function_privilege(
          'service_role',
          'public.academy_study_verify_session_v1(text,text)',
          'execute'
        ) as verify_service,
        has_function_privilege(
          'service_role',
          'public.academy_study_revoke_session_v1(text)',
          'execute'
        ) as revoke_service,
        (
          select count(*)::integer
          from pg_catalog.pg_proc as procedure
          join pg_catalog.pg_namespace as namespace
            on namespace.oid = procedure.pronamespace
          where namespace.nspname in ('public', 'academy_private')
            and procedure.proname like '%study%staff%authoriz%'
        ) as staff_functions
      from academy_private.study_persistence_metadata as metadata
      where metadata.singleton
    `)
    expect(result.rows[0]).toMatchObject({
      verified_identity_version: 1,
      issue_authenticated: true,
      issue_anon: false,
      verify_authenticated: false,
      verify_service: true,
      revoke_service: true,
      staff_functions: 0,
    })
    expect(result.rows[0].migration_names.at(-1)).toBe(
      '20260801160000_academy_study_verified_identity',
    )
  })

  it('derives exact guardian authority and rejects cross-household and viewer issuance', async () => {
    await expect(issue(GUARDIAN_A, STUDENT_B)).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await database.exec('rollback')
    await expect(issue(VIEWER_A, STUDENT_A)).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await database.exec('rollback')

    const grant = await issue(GUARDIAN_A, STUDENT_A)
    expect(grant).toMatchObject({
      schemaVersion: 1,
      status: 'issued',
      studentId: STUDENT_A,
      contractVersion: 1,
      issuerVersion: 'academy-student-session-issuer.v1',
    })
    expect(grant.sessionReference).toMatch(TOKEN_PATTERN)

    const stored = await database.query<{
      household_id: string
      student_id: string
      issued_by: string
      issuing_membership_id: string
      issuing_access_id: string
      grant_purpose: string
      token_digest: string
      session_reference_present: boolean
    }>(`
      select household_id, student_id, issued_by, issuing_membership_id,
        issuing_access_id, grant_purpose, token_digest,
        token_digest = $1 as session_reference_present
      from academy_private.student_session_grants
      where id = $2::uuid
    `, [grant.sessionReference, grant.grantId])
    expect(stored.rows[0]).toMatchObject({
      household_id: '00000000-0000-0000-0000-000000000011',
      student_id: STUDENT_A,
      issued_by: GUARDIAN_A,
      issuing_membership_id: '00000000-0000-0000-0000-0000000000a2',
      issuing_access_id: '00000000-0000-0000-0000-0000000001a1',
      grant_purpose: 'study',
      session_reference_present: false,
    })
    expect(stored.rows[0].token_digest).toBe(
      createHash('sha256').update(String(grant.sessionReference), 'ascii').digest('hex'),
    )
  })

  it('resolves a legacy profile id only inside server-derived guardian authority', async () => {
    await expect(issue(GUARDIAN_A, 'legacy-learner-b', 'legacy-profile-id'))
      .rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await database.exec('rollback')

    const grant = await issue(GUARDIAN_A, 'legacy-learner-a', 'legacy-profile-id')
    expect(grant).toMatchObject({ status: 'issued', studentId: STUDENT_A })
  })

  it('rotates on reissue, verifies one exact learner/scope, and rejects replay', async () => {
    const first = await issue(GUARDIAN_B, STUDENT_B)
    const second = await issue(GUARDIAN_B, STUDENT_B)
    expect(second.sessionReference).not.toBe(first.sessionReference)

    await expect(verify(String(first.sessionReference))).resolves.toMatchObject({
      schemaVersion: 1,
      status: 'denied',
      code: 'student-session-invalid',
    })
    await expect(verify(String(second.sessionReference))).resolves.toMatchObject({
      schemaVersion: 1,
      status: 'verified',
      householdId: '00000000-0000-0000-0000-000000000022',
      studentId: STUDENT_B,
      learnerSessionId: second.learnerSessionId,
    })
    await expect(verify(String(second.sessionReference), 'study:manage')).resolves.toMatchObject({
      status: 'denied',
    })

    const counts = await database.query<{ current_count: number; revoked_count: number }>(`
      select
        count(*) filter (where revoked_at is null)::integer as current_count,
        count(*) filter (where revoked_at is not null)::integer as revoked_count
      from academy_private.student_session_grants
      where student_id = $1::uuid and issued_by = $2::uuid
        and grant_purpose = 'study'
    `, [STUDENT_B, GUARDIAN_B])
    expect(counts.rows[0]).toEqual({ current_count: 1, revoked_count: 1 })
  })

  it('fails expiration and relationship-revocation checks on every verification', async () => {
    const expiredToken = `aca_stu_v1_${'Z'.repeat(43)}`
    const expiredDigest = createHash('sha256').update(expiredToken, 'ascii').digest('hex')
    await database.query(`
      insert into academy_private.student_session_grants (
        household_id, student_id, token_digest, capabilities, credential_id,
        credential_version, session_version, issuance_flow, issued_actor_kind,
        issuance_reason, correlation_id, issued_at, expires_at, grant_purpose,
        authorization_revision
      ) select
        student.household_id, student.id, $1,
        array['student:progress:read']::text[],
        '00000000-0000-0000-0000-000000009101', 1,
        student.session_version, 'student_credential', 'trusted_server',
        'Synthetic expired Study grant', gen_random_uuid(),
        now() - interval '20 minutes', now() - interval '5 minutes',
        'study', student.session_version
      from public.academy_students as student
      where student.id = $2::uuid
    `, [expiredDigest, STUDENT_A])
    expect(await verify(expiredToken)).toMatchObject({ status: 'denied' })

    const current = await issue(GUARDIAN_A, STUDENT_A)
    await database.exec(`
      update public.academy_guardian_student_access
      set status = 'revoked', revoked_at = now(), revoked_by = '${GUARDIAN_A}',
        revocation_reason = 'Synthetic relationship revocation'
      where id = '00000000-0000-0000-0000-0000000001a1';
    `)
    expect(await verify(String(current.sessionReference))).toMatchObject({ status: 'denied' })
  })

  it('revokes idempotently without enumeration and leaves no token or PIN in audit evidence', async () => {
    const current = await issue(GUARDIAN_B, STUDENT_B)
    const digest = createHash('sha256').update(String(current.sessionReference), 'ascii').digest('hex')
    const revoke = () => asRole('service_role', null, () => rpc<Record<string, unknown>>(
      'select public.academy_study_revoke_session_v1($1::text) as result',
      [digest],
    ))
    expect(await revoke()).toEqual({ schemaVersion: 1, status: 'revoked' })
    expect(await revoke()).toEqual({ schemaVersion: 1, status: 'revoked' })
    expect(await verify(String(current.sessionReference))).toMatchObject({ status: 'denied' })

    const audit = await database.query<{ audit_text: string; audit_reasons: string }>(`
      select coalesce(string_agg(
        event_type || ' ' || coalesce(reason, '') || ' ' || details::text,
        E'\n'
      ), '') as audit_text,
      coalesce(string_agg(coalesce(reason, ''), E'\n'), '') as audit_reasons
      from public.academy_audit_events
      where target_id = $1::uuid
    `, [current.grantId])
    expect(audit.rows[0].audit_text).toContain('student_session.issued')
    expect(audit.rows[0].audit_text).toContain('student_session.revoked')
    expect(audit.rows[0].audit_text).not.toContain(String(current.sessionReference))
    expect(audit.rows[0].audit_text).not.toContain(digest)
    expect(audit.rows[0].audit_text).not.toMatch(/\bpin\b/i)
    expect(audit.rows[0].audit_reasons).not.toMatch(/\b[0-9]{4}\b/)
  })

  it('rejects an ambiguous legacy selector across two authorized households', async () => {
    await database.exec(`
      update public.academy_guardian_student_access
      set status = 'active', revoked_at = null, revoked_by = null,
        revocation_reason = null, permission_level = 'identity_manager'
      where id = '00000000-0000-0000-0000-0000000001a1';
      update public.academy_students
      set legacy_profile_id = 'shared-legacy-learner'
      where id in ('${STUDENT_A}'::uuid, '${STUDENT_B}'::uuid);
      insert into public.academy_household_memberships (
        id, household_id, user_id, member_role, status, activated_at
      ) values (
        '00000000-0000-0000-0000-0000000000c2',
        '00000000-0000-0000-0000-000000000022',
        '${GUARDIAN_A}', 'guardian', 'active', now()
      );
      insert into public.academy_guardian_student_access (
        id, household_id, student_id, membership_id, permission_level,
        status, granted_by
      ) values (
        '00000000-0000-0000-0000-0000000001c2',
        '00000000-0000-0000-0000-000000000022', '${STUDENT_B}',
        '00000000-0000-0000-0000-0000000000c2', 'identity_manager',
        'active', '${GUARDIAN_A}'
      );
    `)
    await expect(issue(GUARDIAN_A, 'shared-legacy-learner', 'legacy-profile-id'))
      .rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await database.exec('rollback')
  })
})

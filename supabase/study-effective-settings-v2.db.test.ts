import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './migrations/20260801160000_academy_study_verified_identity.sql',
  './migrations/20260801170000_academy_study_adult_review_operations.sql',
  './migrations/20260801190000_academy_study_final_production_reconciliation.sql',
  './migrations/20260810120000_academy_study_effective_settings_v2.sql',
  './tests/study_engine_fixtures.sql',
] as const

const sql = Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')))

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const HOUSEHOLD_A = '00000000-0000-0000-0000-000000000011'
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

function claims(subject: string) {
  return JSON.stringify({ sub: subject, role: 'authenticated' })
}

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  subject: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const roleClaims = subject ? claims(subject) : JSON.stringify({ role })
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

async function rpc<T>(statement: string, parameters: unknown[] = []): Promise<T> {
  const result = await database.query<{ result: T }>(statement, parameters)
  return result.rows[0].result
}

function effectiveSettings(subject = GUARDIAN_A, student = STUDENT_A) {
  return asRole('authenticated', subject, () => rpc<Record<string, any>>(
    'select public.academy_study_effective_settings_v2($1::uuid, $2::date) as result',
    [student, '2026-08-10'],
  ))
}

async function insertGuardianSettings(overrides = '') {
  await database.exec(`
    insert into public.academy_study_parent_settings (
      household_id, student_id, timer_mode, maximum_work_minutes,
      break_minimum_minutes, break_maximum_minutes, required_breaks,
      reduced_motion, no_audio, large_text, read_aloud,
      speech_input_allowed, parent_override, updated_by
    ) values (
      '${HOUSEHOLD_A}', '${STUDENT_A}', 'visible', 30,
      5, 15, 1, false, false, false, false, false, true, '${GUARDIAN_A}'
    );
    ${overrides}
  `)
}

async function insertAccommodation(input: {
  id: string
  maximumWork?: number
  breakInterval?: number
  breakDuration?: number
  timerVisibility?: 'follow_parent' | 'visible' | 'hidden'
  presentation?: Record<string, boolean>
}) {
  const presentation = JSON.stringify(input.presentation ?? {}).replaceAll("'", "''")
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${GUARDIAN_A}', false);
    select set_config(
      'request.jwt.claims',
      '${claims(GUARDIAN_A).replaceAll("'", "''")}',
      false
    );
  `)
  try {
    await database.query(`
      insert into public.academy_study_accommodations (
        id, household_id, student_id, maximum_duration_minutes,
        required_break_interval_minutes, required_break_duration_minutes,
        timer_visibility, presentation_accommodations, source_kind,
        provenance_reference, authorized_by, effective_from, state
      ) values (
        $1, $2::uuid, $3::uuid, $4::integer, $5::integer, $6::integer,
        $7, $8::jsonb, 'guardian', 'synthetic-functional-policy',
        $9::uuid, '2026-08-01', 'active'
      )
    `, [
      input.id,
      HOUSEHOLD_A,
      STUDENT_A,
      input.maximumWork ?? null,
      input.breakInterval ?? null,
      input.breakDuration ?? null,
      input.timerVisibility ?? 'follow_parent',
      presentation,
      GUARDIAN_A,
    ])
  } finally {
    await database.exec(`
      select set_config('request.jwt.claim.sub', '', false);
      select set_config('request.jwt.claims', '', false);
    `)
  }
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
}, 120_000)

beforeEach(async () => {
  await database.exec(`
    delete from public.academy_study_accommodations;
    delete from public.academy_study_parent_settings;
    delete from academy_private.study_effective_settings_admin_defaults;
    insert into academy_private.study_effective_settings_admin_defaults (
      timer_mode, maximum_work_minutes, break_minimum_minutes,
      break_maximum_minutes, required_break_interval_minutes,
      reduced_motion, no_audio, large_text, read_aloud, speech_input_allowed
    ) values ('visible', 30, 5, 15, 30, false, false, false, false, false);
    delete from academy_private.study_effective_settings_safety_policy;
    insert into academy_private.study_effective_settings_safety_policy (
      minimum_work_minutes, maximum_work_minutes,
      break_minimum_minutes, break_maximum_minutes,
      required_break_interval_minutes
    ) values (1, 240, 1, 120, 240);
  `)
})

afterAll(async () => database?.close())

describe.sequential('Study Effective Settings V2 database authority', () => {
  it('records the V2 marker and exposes only the narrow authenticated RPC', async () => {
    const result = await database.query<{
      version: number
      forced_tables: number
      browser_table_grants: number
      authenticated_execute: boolean
      anon_execute: boolean
      service_execute: boolean
    }>(`
      select
        metadata.effective_settings_version as version,
        (select count(*)::integer
          from pg_catalog.pg_class as relation
          join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
          where namespace.nspname = 'academy_private'
            and relation.relname in (
              'study_effective_settings_admin_defaults',
              'study_effective_settings_safety_policy'
            )
            and relation.relrowsecurity and relation.relforcerowsecurity) as forced_tables,
        (select count(*)::integer
          from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name like 'study_effective_settings_%'
            and grantee in ('anon', 'authenticated', 'service_role')) as browser_table_grants,
        has_function_privilege(
          'authenticated',
          'public.academy_study_effective_settings_v2(uuid,date)',
          'execute'
        ) as authenticated_execute,
        has_function_privilege(
          'anon',
          'public.academy_study_effective_settings_v2(uuid,date)',
          'execute'
        ) as anon_execute,
        has_function_privilege(
          'service_role',
          'public.academy_study_effective_settings_v2(uuid,date)',
          'execute'
        ) as service_execute
      from academy_private.study_persistence_metadata as metadata
      where singleton
    `)
    expect(result.rows).toEqual([{
      version: 2,
      forced_tables: 2,
      browser_table_grants: 0,
      authenticated_execute: true,
      anon_execute: false,
      service_execute: false,
    }])
  })

  it('resolves the Admin-default-only state without inventing a break count', async () => {
    const result = await effectiveSettings()
    expect(result).toMatchObject({
      schemaVersion: 2,
      status: 'ready',
      studentId: STUDENT_A,
      effectiveDate: '2026-08-10',
      settings: {
        maximumWorkMinutes: 30,
        minimumBreakCount: 0,
        requiredBreakIntervalMinutes: 30,
      },
      provenance: {
        maximumWorkMinutes: ['admin_default'],
        minimumBreakCount: [],
        requiredBreakIntervalMinutes: ['admin_default'],
      },
    })
  })

  it('lets guardian settings override Admin defaults, including a less restrictive maximum', async () => {
    await insertGuardianSettings(`
      update public.academy_study_parent_settings
      set timer_mode = 'count_up', maximum_work_minutes = 60,
          break_minimum_minutes = 8, break_maximum_minutes = 20,
          required_breaks = 3, reduced_motion = true
      where student_id = '${STUDENT_A}';
    `)
    const result = await effectiveSettings()
    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        timerMode: 'count_up',
        maximumWorkMinutes: 60,
        breakMinimumMinutes: 8,
        breakMaximumMinutes: 20,
        minimumBreakCount: 3,
        requiredBreakIntervalMinutes: 30,
        reducedMotion: true,
      },
      provenance: {
        maximumWorkMinutes: ['guardian'],
        minimumBreakCount: ['guardian'],
        requiredBreakIntervalMinutes: ['admin_default'],
      },
    })
  })

  it('preserves a guardian setting stricter than Admin and applies accommodations above it', async () => {
    await database.exec(`
      update academy_private.study_effective_settings_admin_defaults
      set maximum_work_minutes = 90;
    `)
    await insertGuardianSettings(`
      update public.academy_study_parent_settings
      set maximum_work_minutes = 25, required_breaks = 2
      where student_id = '${STUDENT_A}';
    `)
    await insertAccommodation({
      id: 'accommodation-functional-a',
      maximumWork: 20,
      breakInterval: 18,
      breakDuration: 10,
      timerVisibility: 'hidden',
      presentation: { large_text: true },
    })
    const result = await effectiveSettings()
    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 20,
        minimumBreakCount: 2,
        requiredBreakIntervalMinutes: 18,
        breakMinimumMinutes: 10,
        timerMode: 'hidden',
        largeText: true,
      },
      provenance: {
        maximumWorkMinutes: ['accommodation'],
        minimumBreakCount: ['guardian'],
        requiredBreakIntervalMinutes: ['accommodation'],
      },
    })
  })

  it('does not let Admin or guardian weaken safety constraints', async () => {
    await database.exec(`
      update academy_private.study_effective_settings_admin_defaults
      set maximum_work_minutes = 120,
          required_break_interval_minutes = 90;
      update academy_private.study_effective_settings_safety_policy
      set maximum_work_minutes = 18,
          required_break_interval_minutes = 12,
          break_minimum_minutes = 9,
          timer_visibility = 'hidden',
          no_audio = true;
    `)
    await insertGuardianSettings(`
      update public.academy_study_parent_settings
      set maximum_work_minutes = 80, break_minimum_minutes = 3,
          break_maximum_minutes = 20, no_audio = false
      where student_id = '${STUDENT_A}';
    `)
    const result = await effectiveSettings()
    expect(result).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 12,
        breakMinimumMinutes: 9,
        timerMode: 'hidden',
        noAudio: true,
      },
      provenance: {
        maximumWorkMinutes: ['safety'],
        requiredBreakIntervalMinutes: ['safety'],
        breakMinimumMinutes: ['safety'],
        noAudio: ['safety'],
      },
    })
  })

  it('returns manual_review for an empty safe break range', async () => {
    await insertAccommodation({
      id: 'accommodation-conflict-a',
      breakDuration: 20,
    })
    const result = await effectiveSettings()
    expect(result).toEqual({
      schemaVersion: 2,
      status: 'manual_review',
      studentId: STUDENT_A,
      effectiveDate: '2026-08-10',
      reasonCodes: ['break_duration_conflict'],
      sourceCategories: ['admin_default', 'accommodation'],
    })
  })

  it('returns unavailable if a required authoritative source is absent', async () => {
    await database.exec('delete from academy_private.study_effective_settings_admin_defaults')
    expect(await effectiveSettings()).toMatchObject({
      status: 'unavailable', reasonCode: 'admin_defaults_unavailable',
    })
  })

  it('denies unauthenticated and cross-household access without exposing settings', async () => {
    await expect(asRole('anon', null, () => rpc(
      'select public.academy_study_effective_settings_v2($1::uuid, $2::date) as result',
      [STUDENT_A, '2026-08-10'],
    ))).rejects.toThrow()
    await expect(effectiveSettings(GUARDIAN_B, STUDENT_A))
      .rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
  })

  it('rejects malformed persisted values and a malformed effective date', async () => {
    await expect(database.exec(`
      update academy_private.study_effective_settings_admin_defaults
      set required_break_interval_minutes = 0
    `)).rejects.toThrow()
    await expect(insertAccommodation({
      id: 'accommodation-invalid-a',
      breakInterval: 0,
    })).rejects.toThrow()
    await expect(asRole('authenticated', GUARDIAN_A, () => rpc(
      'select public.academy_study_effective_settings_v2($1::uuid, null::date) as result',
      [STUDENT_A],
    ))).rejects.toThrow(/STUDY_EFFECTIVE_DATE_INVALID/)
  })

  it('is deterministic across accommodation insertion order', async () => {
    const first = {
      id: 'accommodation-order-a',
      maximumWork: 24,
      breakInterval: 20,
      presentation: { reduced_motion: false, large_text: true },
    } as const
    const second = {
      id: 'accommodation-order-b',
      maximumWork: 18,
      breakInterval: 25,
      presentation: { reduced_motion: true, large_text: false },
    } as const
    await insertAccommodation(first)
    await insertAccommodation(second)
    const forward = await effectiveSettings()

    await database.exec('delete from public.academy_study_accommodations')
    await insertAccommodation({ ...second, id: 'accommodation-order-c' })
    await insertAccommodation({ ...first, id: 'accommodation-order-d' })
    const reverse = await effectiveSettings()

    expect(reverse).toEqual(forward)
    expect(forward).toMatchObject({
      status: 'ready',
      settings: {
        maximumWorkMinutes: 18,
        requiredBreakIntervalMinutes: 20,
        reducedMotion: true,
        largeText: true,
      },
    })
  })
})

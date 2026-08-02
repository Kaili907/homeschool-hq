import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const files = [
  './schema.sql',
  './migrations/20260724230000_academy_student_identity_foundation.sql',
  './migrations/20260801010000_academy_study_engine_storage.sql',
  './migrations/20260801011000_academy_study_engine_authorization.sql',
  './migrations/20260801012000_academy_study_engine_production_reconciliation.sql',
  './tests/study_engine_fixtures.sql',
  './tests/study_engine_rls_probes.sql',
] as const

const sql = Promise.all(
  files.map((path) => readFile(new URL(path, import.meta.url), 'utf8')),
)

const GUARDIAN_A = '00000000-0000-0000-0000-0000000000a1'
const GUARDIAN_B = '00000000-0000-0000-0000-0000000000b1'
const VIEWER_A = '00000000-0000-0000-0000-0000000000a3'
const INACTIVE_A = '00000000-0000-0000-0000-0000000000a4'
const MISSING_A = '00000000-0000-0000-0000-0000000000a5'
const GRANT_A = '00000000-0000-0000-0000-000000008101'
const GRANT_B = '00000000-0000-0000-0000-000000008201'
const STUDENT_A = '00000000-0000-0000-0000-000000000101'
const STUDENT_B = '00000000-0000-0000-0000-000000000201'

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

function guardianClaims(id: string) {
  return JSON.stringify({ sub: id, role: 'authenticated' })
}

function studentClaims(grantId: string) {
  return JSON.stringify({
    sub: grantId,
    role: 'authenticated',
    academy_principal_kind: 'student_session_grant',
  })
}

async function asRole<T>(
  role: 'anon' | 'authenticated' | 'service_role',
  sub: string | null,
  claims: string,
  operation: () => Promise<T>,
): Promise<T> {
  await database.exec(`
    select set_config('request.jwt.claim.sub', '${sub ?? ''}', false);
    select set_config('request.jwt.claims', '${claims.replaceAll("'", "''")}', false);
    select set_config(
      'request.jwt.claim.role',
      '${role === 'service_role' ? 'service_role' : role}',
      false
    );
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

function checkpoint(revision: number, activeSeconds = 10) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint-a',
    revision,
    createdAt: '2026-08-01T14:01:00Z',
    updatedAt: `2026-08-01T14:0${revision + 1}:00Z`,
    sessionId: 'session-a',
    lessonId: 'lesson-a',
    segmentId: 'segment-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [{ segmentId: 'segment-a', activeSeconds }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:session-a',
    lastAcceptedEventId: 'event-a',
    eventVersion: 1,
    tutorInteractionRef: 'interaction-a',
    technicalInterruption: {
      status: 'none',
      interruptionId: null,
      category: 'none',
      startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

beforeAll(async () => {
  database = await PGlite.create()
  await database.exec(bootstrap)
  for (const migration of await sql) await database.exec(migration)
}, 120_000)

afterAll(async () => {
  await database.close()
})

describe.sequential('Study Engine persistence and RLS', () => {
  it('forces RLS, covers all public commands, and keeps private ACLs closed', async () => {
    const catalog = await database.query<{
      public_count: number
      forced_count: number
      policy_count: number
      private_browser_grants: number
    }>(`
      with study_tables as (
        select relation.oid, namespace.nspname, relation.relname,
          relation.relrowsecurity, relation.relforcerowsecurity
        from pg_catalog.pg_class as relation
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = relation.relnamespace
        where relation.relkind = 'r'
          and (
            (namespace.nspname = 'public' and relation.relname like 'academy_study_%')
            or (namespace.nspname = 'academy_private' and relation.relname like 'study_%')
          )
      )
      select
        count(*) filter (where nspname = 'public')::integer as public_count,
        count(*) filter (where relrowsecurity and relforcerowsecurity)::integer
          as forced_count,
        (select count(*)::integer from pg_catalog.pg_policy
          where polrelid in (select oid from study_tables where nspname = 'public'))
          as policy_count,
        (select count(*)::integer
          from information_schema.role_table_grants
          where table_schema = 'academy_private'
            and table_name like 'study_%'
            and grantee in ('anon', 'authenticated')) as private_browser_grants
      from study_tables
    `)
    expect(catalog.rows[0]).toEqual({
      public_count: 9,
      forced_count: 25,
      policy_count: 36,
      private_browser_grants: 0,
    })
  })

  it('isolates households, permission levels, inactive users, and direct writes', async () => {
    const guardianACount = await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => database.query<{ count: number }>(
        `select count(*)::integer as count from public.academy_study_sessions`,
      ),
    )
    expect(guardianACount.rows[0].count).toBe(1)

    const guardianBCount = await asRole(
      'authenticated', GUARDIAN_B, guardianClaims(GUARDIAN_B),
      () => database.query<{ count: number }>(
        `select count(*)::integer as count from public.academy_study_sessions`,
      ),
    )
    expect(guardianBCount.rows[0].count).toBe(1)

    for (const user of [VIEWER_A, INACTIVE_A, MISSING_A]) {
      const settings = await asRole(
        'authenticated', user, guardianClaims(user),
        () => database.query<{ count: number }>(
          `select count(*)::integer as count from public.academy_study_parent_settings`,
        ),
      )
      expect(settings.rows[0].count).toBe(0)
    }

    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => database.exec(`delete from public.academy_study_sessions where id = 'session-a'`),
    )).rejects.toThrow()
    await expect(asRole(
      'anon', null, '{}',
      () => database.exec(`select * from academy_private.study_outbox`),
    )).rejects.toThrow()
  })

  it('binds signed student principals to current private grants', async () => {
    const own = await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => database.query<{ id: string }>(
        `select id from public.academy_study_sessions order by id`,
      ),
    )
    expect(own.rows.map((row) => row.id)).toEqual(['session-a'])

    const other = await asRole(
      'authenticated', GRANT_B, studentClaims(GRANT_B),
      () => database.query<{ id: string }>(
        `select id from public.academy_study_sessions order by id`,
      ),
    )
    expect(other.rows.map((row) => row.id)).toEqual(['session-b'])

    const forged = await asRole(
      'authenticated', GUARDIAN_A, studentClaims(GUARDIAN_A),
      () => database.query<{ count: number }>(
        `select count(*)::integer as count from public.academy_study_sessions`,
      ),
    )
    expect(forged.rows[0].count).toBe(0)

    const parentSettings = await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => database.query<{ count: number }>(
        `select count(*)::integer as count from public.academy_study_parent_settings`,
      ),
    )
    expect(parentSettings.rows[0].count).toBe(0)
  })

  it('appends, replays, and collision-detects events without losing the audit', async () => {
    const append = () => rpc<{ status: string }>(
      `select public.academy_study_append_event($1, $2, $3, $4) as result`,
      ['session-a', 'event-a', 1, 'event-key-a'],
    )
    expect(await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A), append,
    )).toEqual({ status: 'appended' })
    expect(await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A), append,
    )).toEqual({ status: 'duplicate-ignored' })
    const collision = await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc<{ status: string }>(
        `select public.academy_study_append_event($1, $2, $3, $4) as result`,
        ['session-a', 'event-a', 1, 'different-key'],
      ),
    )
    expect(collision).toEqual({ status: 'idempotency-collision' })
    const counts = await database.query<{ events: number; collisions: number }>(`
      select
        (select count(*) from public.academy_study_event_ledger
          where session_id = 'session-a')::integer as events,
        (select count(*) from public.academy_study_audit_events
          where event_type = 'event.collision')::integer as collisions
    `)
    expect(counts.rows[0]).toEqual({ events: 1, collisions: 1 })
    await expect(asRole(
      'authenticated', GUARDIAN_B, guardianClaims(GUARDIAN_B), append,
    )).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
  })

  it('stores checkpoint CAS receipts, detects collisions/conflicts, and verifies integrity', async () => {
    const cas = (
      expected: number | null,
      mutation: string,
      value: ReturnType<typeof checkpoint>,
    ) => rpc<Record<string, unknown>>(
      `select public.academy_study_compare_and_swap_checkpoint(
        $1, $2::bigint, $3, $4::jsonb
      ) as result`,
      ['session-a', expected, mutation, JSON.stringify(value)],
    )
    expect(await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => cas(null, 'checkpoint-mutation-a1', checkpoint(1)),
    )).toEqual({ status: 'stored', revision: 1 })
    expect(await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => cas(null, 'checkpoint-mutation-a1', checkpoint(1)),
    )).toEqual({ status: 'stored', revision: 1 })
    const collision = await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => cas(null, 'checkpoint-mutation-a1', checkpoint(1, 11)),
    )
    expect(collision.status).toBe('quarantined')
    expect(await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => cas(1, 'checkpoint-mutation-a2', checkpoint(2, 20)),
    )).toEqual({ status: 'stored', revision: 2 })
    expect(await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => cas(1, 'checkpoint-mutation-stale', checkpoint(2, 30)),
    )).toEqual({ status: 'revision-conflict', currentRevision: 2 })

    const restored = await asRole(
      'authenticated', GRANT_A, studentClaims(GRANT_A),
      () => rpc<Record<string, unknown>>(
        `select public.academy_study_read_checkpoint($1) as result`,
        ['session-a'],
      ),
    )
    expect(restored.revision).toBe(2)
    const integrity = await database.query<{ valid: boolean }>(`
      select integrity_digest = academy_private.study_checkpoint_integrity(checkpoint)
        as valid
      from public.academy_study_checkpoints as checkpoint
      where session_id = 'session-a'
    `)
    expect(integrity.rows[0].valid).toBe(true)
  })

  it('rejects forged record IDs and null expected revisions in definer RPCs', async () => {
    await asRole(
      'authenticated', GUARDIAN_B, guardianClaims(GUARDIAN_B),
      () => rpc(
        `select public.academy_study_upsert_adult_managed_record(
          'review', $1::jsonb, 0, 'review-b-key'
        ) as result`,
        [JSON.stringify({
          id: 'review-b', student_id: STUDENT_B, skill_id: 'skill-b',
          source_session_id: 'session-b', review_kind: 'spaced',
          due_at: '2026-08-02T14:00:00Z', intended_local_date: '2026-08-02',
          priority: 50, state: 'scheduled', attempt_count: 0,
          interval_days: 1, reteaching_required: false,
          prerequisite_remediation_required: false,
        })],
      ),
    )
    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc(
        `select public.academy_study_upsert_adult_managed_record(
          'review', $1::jsonb, 1, 'forged-review-key'
        ) as result`,
        [JSON.stringify({
          id: 'review-b', student_id: STUDENT_A, skill_id: 'skill-a',
          source_session_id: 'session-a', review_kind: 'spaced',
          due_at: '2026-08-02T14:00:00Z', intended_local_date: '2026-08-02',
          priority: 50, state: 'scheduled', attempt_count: 0,
          interval_days: 1, reteaching_required: false,
          prerequisite_remediation_required: false,
        })],
      ),
    )).rejects.toThrow(/STUDY_OPERATION_NOT_AVAILABLE/)
    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc(
        `select public.academy_study_transition_session(
          'session-a', null, 'paused', null, 'null-revision-key'
        ) as result`,
      ),
    )).rejects.toThrow(/STUDY_SESSION_TRANSITION_INVALID/)
  })

  it('uses canonical IANA timezone snapshots and rejects overlap/gap offset ambiguity', async () => {
    const calendar = (id: string, start: string, date: string, offset: number, key: string) =>
      asRole(
        'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
        () => rpc<Record<string, unknown>>(
          `select public.academy_study_upsert_adult_managed_record(
            'calendar', $1::jsonb, 0, $2
          ) as result`,
          [JSON.stringify({
            id, student_id: STUDENT_A, block_type: 'lesson',
            source_reference: 'lesson-a', scheduled_start: start,
            intended_local_date: date, explicit_offset: offset,
            duration_minutes: 30, completion_units: 0, required_units: 1,
            resume_session_id: null, resume_segment_id: null, state: 'scheduled',
          }), key],
        ),
      )
    expect(await calendar(
      'calendar-overlap-early', '2026-11-01T05:30:00Z',
      '2026-11-01', -240, 'calendar-overlap-key',
    )).toEqual({ status: 'stored', revision: 1 })
    const zone = await database.query<{ zone: string }>(`
      select household_timezone as zone from public.academy_study_calendar_blocks
      where id = 'calendar-overlap-early'
    `)
    expect(zone.rows[0].zone).toBe('America/New_York')
    await expect(calendar(
      'calendar-gap-invalid', '2026-03-08T07:30:00Z',
      '2026-03-08', -300, 'calendar-gap-key',
    )).rejects.toThrow(/STUDY_EXPLICIT_OFFSET_MISMATCH/)
  })

  it('retires the legacy unbound delivery RPCs from every application role', async () => {
    for (const [role, claims] of [
      ['authenticated', guardianClaims(GUARDIAN_A)],
      ['service_role', JSON.stringify({ role: 'service_role' })],
    ] as const) {
      await expect(asRole(
        role,
        role === 'authenticated' ? GUARDIAN_A : null,
        claims,
        () => rpc(`select public.academy_study_transition_outbox(
          '{}'::jsonb
        ) as result`),
      )).rejects.toThrow(/permission denied/)
    }
  })

  it('permits scoped crypto erasure only after retention expiry', async () => {
    await database.exec(`
      insert into academy_private.study_protected_learner_work (
        id, revision, household_id, student_id, session_id,
        kms_key_reference, wrapped_data_key, nonce, authentication_tag,
        encrypted_payload, keyed_integrity_tag, created_at, expires_at
      ) values (
        'work-expired', 1,
        '00000000-0000-0000-0000-000000000011',
        '${STUDENT_A}', 'session-a', 'kms-key-a',
        decode(repeat('01', 16), 'hex'), decode(repeat('02', 12), 'hex'),
        decode(repeat('03', 16), 'hex'), decode('04', 'hex'),
        decode(repeat('05', 32), 'hex'),
        now() - interval '2 days', now() - interval '1 day'
      )
    `)
    const erase = (studentId: string) => asRole(
      'service_role', null, JSON.stringify({ role: 'service_role' }),
      () => rpc(`select public.academy_study_confirm_crypto_erasure(
        'protected_work', $1, 'work-expired', 1, 'destroy-receipt-a'
      ) as result`, [studentId]),
    )
    await expect(erase(STUDENT_B)).rejects.toThrow(
      /STUDY_RETENTION_TARGET_NOT_DUE/,
    )
    await expect(asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc(`select public.academy_study_confirm_crypto_erasure(
        'protected_work', $1, 'work-expired', 1, 'destroy-receipt-a'
      ) as result`, [STUDENT_A]),
    )).rejects.toThrow(/permission denied/)
    expect(await erase(STUDENT_A)).toEqual({
      status: 'deleted-after-crypto-erasure',
    })
    const remaining = await database.query<{ count: number }>(`
      select count(*)::integer as count
      from academy_private.study_protected_learner_work
      where student_id = '${STUDENT_A}' and id = 'work-expired'
    `)
    expect(remaining.rows[0].count).toBe(0)
    const audit = await database.query<{ metadata: string }>(`
      select metadata::text
      from public.academy_study_audit_events
      where event_type = 'retention.delete' and target_id = 'work-expired'
    `)
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].metadata).not.toMatch(/kms|payload|data_key/i)
  })

  it('keeps encrypted adult notes private and audits body access without body data', async () => {
    const expires = new Date(Date.now() + 100 * 86_400_000).toISOString()
    const note = {
      note_id: 'note-a', student_id: STUDENT_A, expected_revision: 0,
      category: 'instructional', encrypted_body_base64: 'AQ==',
      kms_key_reference: 'kms-key-a', wrapped_data_key_base64: 'AQ==',
      nonce_base64: 'AAAAAAAAAAAAAAAA',
      authentication_tag_base64: 'AAAAAAAAAAAAAAAAAAAAAA==',
      keyed_integrity_tag_base64:
        'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      expires_at: expires,
    }
    expect(await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc(`select public.academy_study_append_adult_note($1::jsonb) as result`,
        [JSON.stringify(note)]),
    )).toEqual({ status: 'stored', revision: 1 })
    const body = await asRole(
      'authenticated', GUARDIAN_A, guardianClaims(GUARDIAN_A),
      () => rpc<Record<string, unknown>>(
        `select public.academy_study_read_adult_note($1, $2, $3, $4) as result`,
        [STUDENT_A, 'note-a', 1, '00000000-0000-0000-0000-00000000c101'],
      ),
    )
    expect(body.encrypted_body_base64).toBe('AQ==')
    for (const [actor, claims] of [
      [VIEWER_A, guardianClaims(VIEWER_A)],
      [GRANT_A, studentClaims(GRANT_A)],
      [GUARDIAN_B, guardianClaims(GUARDIAN_B)],
    ] as const) {
      await expect(asRole(
        'authenticated', actor, claims,
        () => rpc(`select public.academy_study_read_adult_note(
          $1, 'note-a', 1, '00000000-0000-0000-0000-00000000c102'
        ) as result`, [STUDENT_A]),
      )).rejects.toThrow(/STUDY_ADULT_NOTE_NOT_AVAILABLE/)
    }
    const audits = await database.query<{ metadata: string }>(`
      select metadata::text from public.academy_study_audit_events
      where event_type = 'adult_note.access'
    `)
    expect(audits.rows).toHaveLength(1)
    expect(audits.rows[0].metadata).not.toMatch(
      /AQ==|encrypted_body_base64|encrypted_payload_base64/i,
    )
  })
})

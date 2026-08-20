import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrations = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810140100_academy_curriculum_human_approval.sql',
].map((path) => new URL(path, import.meta.url))

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)
const databases: PGlite[] = []

const course = {
  schema_set_version: '2.0.0',
  course_id: 'course:math-5',
  grade: 5,
  subject: 'mathematics',
  title: 'Private curriculum title must never enter approval metadata.',
  description: 'A complete fifth grade mathematics course.',
  days: 180,
  order: 1,
  unit_refs: ['unit:math-5-1'],
  standards: [{ framework_ref: 'framework:legacy', legacy_label: '5.NBT', mapping_status: 'canonical' }],
}

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema academy_private;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create function academy_private.operational_is_trusted_server()
  returns boolean language sql stable set search_path = pg_catalog as $$
    select auth.uid() is null
      and coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('role', true), '')) = 'service_role';
  $$;
  insert into auth.users (id) values ('${OWNER}'), ('${ADMIN}'), ('${VIEWER}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

async function createDraft(database: PGlite, request = crypto.randomUUID()) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', '2.0.0-draft.1', '2.0.0', $2, $3,
        'curriculum:drafts:write'
      ) as value
    `, [ADMIN, request, HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function recordValidation(
  database: PGlite,
  draftId: string,
  revision: number,
  values: { status?: string; publicationReady?: boolean; blocking?: number; human?: number; digest?: string } = {},
) {
  const status = values.status ?? 'valid'
  const blocking = values.blocking ?? 0
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_record_curriculum_validation_v1(
        $1, $2, $3, 'curriculum-validation-v2', $4, $5,
        $6, $7, $7, $8, 'curriculum:read'
      ) as value
    `, [ADMIN, draftId, revision, values.digest ?? HASH_A, status,
      values.publicationReady ?? (status === 'valid' && blocking === 0 && (values.human ?? 0) === 0),
      blocking, values.human ?? 0])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function decide(
  database: PGlite,
  draftId: string,
  revision: number,
  validationSnapshotId: string | null,
  values: { actor?: string; decision?: string; reason?: string; request?: string; digest?: string } = {},
) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_decide_curriculum_approval_v1(
        $1, $2, $3, $4, $5, $6, $7, $8, 'curriculum:approve'
      ) as value
    `, [values.actor ?? OWNER, draftId, revision, values.decision ?? 'approved',
      values.reason ?? 'approval.ready', validationSnapshotId,
      values.request ?? '10000000-0000-4000-8000-000000000001',
      values.digest ?? HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

beforeEach(async () => {
  const database = await PGlite.create()
  databases.push(database)
  await database.exec(bootstrap)
  for (const migration of migrations) await database.exec(await readFile(migration, 'utf8'))
  await database.exec(`
    insert into public.academy_admin_role_assignments (user_id, role, assignment_reason_code)
    values
      ('${OWNER}', 'owner', 'test.owner'),
      ('${ADMIN}', 'admin', 'test.admin'),
      ('${VIEWER}', 'viewer', 'test.viewer');
  `)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum human approval database boundary', () => {
  it('records valid approval and exposes the exact machine-readable publish gate', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    const result = await decide(database, draft.draftId, 1, validation.validationSnapshotId)
    expect(result).toMatchObject({
      replayed: false,
      status: 'approved',
      currentDecision: {
        draftRevision: 1,
        decision: 'approved',
        validationSnapshotId: validation.validationSnapshotId,
        validationResultDigest: HASH_A,
      },
      publishGate: {
        eligible: true,
        reason: 'approved',
        draftRevision: 1,
        validationSnapshotId: validation.validationSnapshotId,
      },
    })
    const gate = (await database.query<{ value: any }>(`
      select academy_private.curriculum_approval_publish_gate_v1($1, 1) as value
    `, [draft.draftId])).rows[0].value
    expect(gate).toMatchObject({ eligible: true, reason: 'approved' })
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_releases')).rows[0])
      .toEqual({ count: 1 })
  })

  it.each([
    ['blocked validation', { status: 'invalid', publicationReady: false, blocking: 1, human: 0 }],
    ['incomplete validation', { status: 'incomplete', publicationReady: false, blocking: 1, human: 0 }],
    ['unavailable validation', { status: 'unavailable', publicationReady: false, blocking: 0, human: 0 }],
    ['errored validation', { status: 'error', publicationReady: false, blocking: 0, human: 0 }],
    ['unresolved human review', { status: 'invalid', publicationReady: false, blocking: 1, human: 1 }],
  ])('rejects approval for %s', async (_label, state) => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1, state)
    await expect(decide(database, draft.draftId, 1, validation.validationSnapshotId))
      .rejects.toThrow('CURRICULUM_APPROVAL_VALIDATION_BLOCKED')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_draft_approval_decisions')).rows[0])
      .toEqual({ count: 0 })
  })

  it('rejects stale revision approval and marks an approval stale after a material mutation', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    await expect(decide(database, draft.draftId, 2, validation.validationSnapshotId))
      .rejects.toThrow('CURRICULUM_APPROVAL_CAS_CONFLICT')
    await decide(database, draft.draftId, 1, validation.validationSnapshotId)

    await setService(database)
    await database.query(`select public.academy_admin_create_curriculum_draft_entity_v1(
      $1, $2, 'course', 'course:math-5', 'base_override', 1,
      $3::jsonb, $4, 1, $5, $6, 'curriculum:drafts:write'
    )`, [ADMIN, draft.draftId, JSON.stringify(course), HASH_B,
      '20000000-0000-4000-8000-000000000001', HASH_B])
    const status = (await database.query<{ value: any }>(`
      select public.academy_admin_read_curriculum_approval_v1(
        $1, $2, 'curriculum:read'
      ) as value
    `, [VIEWER, draft.draftId])).rows[0].value
    await reset(database)
    expect(status).toMatchObject({
      draftRevision: 2,
      status: 'stale',
      staleApproval: { decision: 'approved', draftRevision: 1, bindingStatus: 'superseded' },
      publishGate: { eligible: false, reason: 'approval_stale' },
    })
  })

  it('stales approval when the exact validation identity changes and allows the newest valid result', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const firstValidation = await recordValidation(database, draft.draftId, 1)
    await decide(database, draft.draftId, 1, firstValidation.validationSnapshotId)
    await recordValidation(database, draft.draftId, 1, {
      status: 'invalid', publicationReady: false, blocking: 1, digest: HASH_B,
    })

    await setService(database)
    const stale = (await database.query<{ value: any }>(`
      select public.academy_admin_read_curriculum_approval_v1(
        $1, $2, 'curriculum:read'
      ) as value
    `, [VIEWER, draft.draftId])).rows[0].value
    await reset(database)
    expect(stale).toMatchObject({
      status: 'stale',
      currentDecision: { approvalId: expect.any(String), bindingStatus: 'superseded' },
      staleApproval: { draftRevision: 1, bindingStatus: 'superseded' },
      publishGate: { eligible: false, reason: 'approval_stale' },
    })
    expect(stale.currentDecision.approvalId).toBe(stale.staleApproval.approvalId)

    const newestValidation = await recordValidation(database, draft.draftId, 1, { digest: HASH_C })
    const reapproved = await decide(database, draft.draftId, 1, newestValidation.validationSnapshotId, {
      request: '10000000-0000-4000-8000-000000000002', digest: HASH_C,
    })
    expect(reapproved).toMatchObject({
      status: 'approved',
      currentDecision: {
        validationSnapshotId: newestValidation.validationSnapshotId,
        bindingStatus: 'current',
      },
      publishGate: { eligible: true, reason: 'approved' },
    })
    expect(reapproved.history).toHaveLength(2)
    expect(reapproved.history[1]).toMatchObject({
      validationSnapshotId: firstValidation.validationSnapshotId,
      bindingStatus: 'superseded',
    })
  })

  it('records changes requested and prevents approval until the draft revision changes', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const result = await decide(database, draft.draftId, 1, null, {
      decision: 'changes_requested', reason: 'changes.content_quality',
    })
    expect(result).toMatchObject({
      status: 'changes_requested',
      currentDecision: { decision: 'changes_requested', reasonCode: 'changes.content_quality' },
      publishGate: { eligible: false, reason: 'changes_requested' },
    })
    const validation = await recordValidation(database, draft.draftId, 1)
    await expect(decide(database, draft.draftId, 1, validation.validationSnapshotId, {
      request: '10000000-0000-4000-8000-000000000002', digest: HASH_B,
    })).rejects.toThrow('CURRICULUM_APPROVAL_TRANSITION_CONFLICT')
  })

  it('replays an exact decision safely and rejects conflicting request reuse', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    const first = await decide(database, draft.draftId, 1, validation.validationSnapshotId)
    const replay = await decide(database, draft.draftId, 1, validation.validationSnapshotId)
    expect(replay).toEqual({ ...first, replayed: true })
    await expect(decide(database, draft.draftId, 1, validation.validationSnapshotId, {
      decision: 'changes_requested', reason: 'changes.other', digest: HASH_B,
    })).rejects.toThrow('CURRICULUM_APPROVAL_REPLAY_CONFLICT')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_draft_approval_decisions')).rows[0])
      .toEqual({ count: 1 })
  })

  it('requires curriculum:approve and independently reauthorizes in the database', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    await expect(decide(database, draft.draftId, 1, validation.validationSnapshotId, { actor: ADMIN }))
      .rejects.toThrow('CURRICULUM_APPROVAL_REQUIRED')

    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = statement_timestamp(),
          revoked_by = '${OWNER}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${OWNER}';
    `)
    await expect(decide(database, draft.draftId, 1, validation.validationSnapshotId))
      .rejects.toThrow('CURRICULUM_APPROVAL_REQUIRED')
  })

  it('audits decisions atomically with bounded metadata and no curriculum payload', async () => {
    const database = databases[0]
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    await decide(database, draft.draftId, 1, validation.validationSnapshotId)
    const event = (await database.query<any>(`
      select action, resource_type, resource_ref, resource_revision,
        previous_value, new_value, reason_code
      from academy_private.admin_audit_events
      where action = 'curriculum_approval.approve'
    `)).rows[0]
    expect(event).toMatchObject({
      action: 'curriculum_approval.approve',
      resource_type: 'curriculum_approval',
      resource_ref: draft.draftId,
      resource_revision: '1',
      previous_value: { state: 'pending_review', status: 'review.pending', revision: 1 },
      new_value: { state: 'approved', status: 'approval.ready', revision: 1 },
      reason_code: 'curriculum.approved',
    })
    const serialized = JSON.stringify(event)
    expect(serialized).not.toContain(course.title)
    expect(serialized).not.toMatch(/payload|learning_objectives|scoring_guidance/i)
  })

  it('keeps approval storage private, payload-free, append-only, and migration-hash pinned', async () => {
    const database = databases[0]
    const columns = (await database.query<{ column_name: string }>(`
      select column_name from information_schema.columns
      where table_schema = 'public'
        and table_name in (
          'academy_curriculum_draft_validation_snapshots',
          'academy_curriculum_draft_approval_decisions'
        )
    `)).rows.map((row) => row.column_name)
    expect(columns).not.toContain('payload')
    expect(columns).not.toContain('findings')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const privilege = await database.query<{ allowed: boolean }>(
        `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as allowed`,
        [role, 'public.academy_curriculum_draft_approval_decisions'],
      )
      expect(privilege.rows[0].allowed, role).toBe(false)
    }
    const draft = await createDraft(database)
    const validation = await recordValidation(database, draft.draftId, 1)
    await decide(database, draft.draftId, 1, validation.validationSnapshotId)
    await expect(database.exec('delete from public.academy_curriculum_draft_approval_decisions'))
      .rejects.toThrow('append-only')

    const migrationBytes = (await readFile(migrations.at(-1)!, 'utf8')).replace(/\r\n/gu, '\n')
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-human-approval-migration.json', import.meta.url),
      'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})

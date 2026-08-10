import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrations = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810140000_academy_curriculum_human_approval.sql',
  './migrations/20260810150000_academy_curriculum_release_staging.sql',
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
  title: 'Private payload must never enter the staging audit.',
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

async function createDraft(database: PGlite, target: string, request = crypto.randomUUID()) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', $2, '2.0.0', $3, $4, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, target, request, HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function recordValidation(
  database: PGlite,
  draftId: string,
  revision: number,
  values: { status?: string; ready?: boolean; blocking?: number; errors?: number; human?: number; digest?: string } = {},
) {
  const status = values.status ?? 'valid'
  const blocking = values.blocking ?? 0
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_record_curriculum_validation_v1(
        $1, $2, $3, 'curriculum-validation-v2', $4, $5,
        $6, $7, $8, $9, 'curriculum:read'
      ) as value
    `, [ADMIN, draftId, revision, values.digest ?? HASH_A, status,
      values.ready ?? (status === 'valid' && blocking === 0 && (values.human ?? 0) === 0),
      blocking, values.errors ?? blocking, values.human ?? 0])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function decide(
  database: PGlite,
  draftId: string,
  revision: number,
  validationId: string | null,
  values: { decision?: string; reason?: string; request?: string; digest?: string } = {},
) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_decide_curriculum_approval_v1(
        $1, $2, $3, $4, $5, $6, $7, $8, 'curriculum:approve'
      ) as value
    `, [OWNER, draftId, revision, values.decision ?? 'approved',
      values.reason ?? 'approval.ready', validationId,
      values.request ?? crypto.randomUUID(), values.digest ?? HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

function packageInput(draftId: string, revision: number, target: string, validationId: string, approvalId: string) {
  const canonicalContent = '{}'
  const files = [{ relativePath: 'snapshot/manifest.json', byteCount: 2, sha256: HASH_A }]
  const manifest = {
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: { packageId: 'manuel-academy-grades-5-7-8-curriculum-v1', version: target },
    baseReleaseVersion: '1.0.0',
    targetVersion: target,
    schemaSetVersion: '2.0.0',
    draft: { id: draftId, revision },
    validation: { id: validationId, resultDigest: HASH_A },
    approval: { id: approvalId },
    entityCounts: { courses: 1 },
    fileCount: 1,
    byteCount: 2,
    files,
    contentHash: HASH_A,
  }
  return {
    manifest,
    manifestCanonical: JSON.stringify(manifest),
    artifacts: [{ ...files[0], canonicalContent }],
  }
}

async function stage(
  database: PGlite,
  input: {
    draftId: string; revision: number; target: string; validationId: string; approvalId: string;
    actor?: string; request?: string; requestDigest?: string; packageHash?: string; mutate?: (value: any) => void;
  },
) {
  const value = packageInput(input.draftId, input.revision, input.target, input.validationId, input.approvalId)
  input.mutate?.(value)
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_stage_curriculum_release_v1(
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8::jsonb,
        $9, $10, $11, $12, $13, 'curriculum:publish'
      ) as value
    `, [input.actor ?? OWNER, input.draftId, input.revision, input.validationId,
      input.approvalId, JSON.stringify(value.manifest), value.manifestCanonical,
      JSON.stringify(value.artifacts), HASH_A, HASH_B, input.packageHash ?? HASH_C,
      input.request ?? '50000000-0000-4000-8000-000000000001', input.requestDigest ?? HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function eligible(database: PGlite, target: string) {
  const draft = await createDraft(database, target)
  const validation = await recordValidation(database, draft.draftId, 1)
  const approval = await decide(database, draft.draftId, 1, validation.validationSnapshotId)
  return { draft, validation, approval }
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

describe('curriculum release staging database boundary', () => {
  it('atomically stages one exact approved revision as STAGED, not PUBLISHED', async () => {
    const database = databases[0]
    const { draft, validation, approval } = await eligible(database, '2.0.0-rc.1')
    const beforePointer = (await database.query('select * from public.academy_curriculum_active_pointers')).rows
    const beforeRelease = (await database.query('select release_id, version, status from public.academy_curriculum_releases')).rows
    const result = await stage(database, {
      draftId: draft.draftId, revision: 1, target: '2.0.0-rc.1',
      validationId: validation.validationSnapshotId,
      approvalId: approval.currentDecision.approvalId,
    })
    expect(result).toMatchObject({
      replayed: false,
      stageState: 'staged',
      eligible: false,
      blockingReasons: [],
      candidate: {
        status: 'staged',
        publicationStatus: 'not_published',
        validationSnapshotId: validation.validationSnapshotId,
        approvalId: approval.currentDecision.approvalId,
        fileCount: 1,
        contentHash: HASH_A,
        manifestHash: HASH_B,
        packageHash: HASH_C,
        authority: 'curriculum:publish',
      },
    })
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_staged_release_artifacts')).rows[0])
      .toEqual({ count: 1 })
    expect((await database.query('select release_id, version, status from public.academy_curriculum_releases')).rows).toEqual(beforeRelease)
    expect((await database.query('select * from public.academy_curriculum_active_pointers')).rows).toEqual(beforePointer)
    expect((await database.query("select count(*)::integer as count from public.academy_curriculum_releases where version = '2.0.0-rc.1'")).rows[0])
      .toEqual({ count: 0 })
  })

  it('fails closed for missing, invalid, incomplete, human-blocked, changes-requested, and stale approval states', async () => {
    const database = databases[0]
    const missing = await createDraft(database, '2.0.0-block.1')
    const missingStatus = await readStatus(database, missing.draftId)
    expect(missingStatus.blockingReasons).toContain('validation_missing')
    await expect(stage(database, {
      draftId: missing.draftId, revision: 1, target: '2.0.0-block.1',
      validationId: crypto.randomUUID(), approvalId: crypto.randomUUID(),
      request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_STAGING_GATE_BLOCKED')

    for (const [suffix, state] of [
      ['invalid', { status: 'invalid', ready: false, blocking: 1 }],
      ['incomplete', { status: 'incomplete', ready: false, blocking: 1 }],
      ['human', { status: 'invalid', ready: false, blocking: 1, human: 1 }],
    ] as const) {
      const draft = await createDraft(database, `2.0.0-${suffix}.1`)
      const validation = await recordValidation(database, draft.draftId, 1, state)
      const blocked = await readStatus(database, draft.draftId)
      expect(blocked.blockingReasons, suffix).toContain('validation_blocked')
      await expect(stage(database, {
        draftId: draft.draftId, revision: 1, target: `2.0.0-${suffix}.1`,
        validationId: validation.validationSnapshotId, approvalId: crypto.randomUUID(),
        request: crypto.randomUUID(),
      })).rejects.toThrow('CURRICULUM_STAGING_GATE_BLOCKED')
    }

    const changes = await createDraft(database, '2.0.0-changes.1')
    const changesDecision = await decide(database, changes.draftId, 1, null, {
      decision: 'changes_requested', reason: 'changes.content_quality',
    })
    expect((await readStatus(database, changes.draftId)).blockingReasons).toContain('changes_requested')
    await expect(stage(database, {
      draftId: changes.draftId, revision: 1, target: '2.0.0-changes.1',
      validationId: crypto.randomUUID(), approvalId: changesDecision.currentDecision.approvalId,
      request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_STAGING_GATE_BLOCKED')

    const stale = await eligible(database, '2.0.0-stale.1')
    await setService(database)
    await database.query(`select public.academy_admin_create_curriculum_draft_entity_v1(
      $1, $2, 'course', 'course:math-5', 'base_override', 1,
      $3::jsonb, $4, 1, $5, $6, 'curriculum:drafts:write'
    )`, [ADMIN, stale.draft.draftId, JSON.stringify(course), HASH_B, crypto.randomUUID(), HASH_B])
    await reset(database)
    expect((await readStatus(database, stale.draft.draftId)).blockingReasons).toContain('approval_stale')
    await expect(stage(database, {
      draftId: stale.draft.draftId, revision: 2, target: '2.0.0-stale.1',
      validationId: stale.validation.validationSnapshotId,
      approvalId: stale.approval.currentDecision.approvalId,
      request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_STAGING_GATE_BLOCKED')
  })

  it('rejects revision mismatch and target-version collision without overwriting a candidate', async () => {
    const database = databases[0]
    const first = await eligible(database, '2.0.0-collision.1')
    await expect(stage(database, {
      draftId: first.draft.draftId, revision: 2, target: '2.0.0-collision.1',
      validationId: first.validation.validationSnapshotId,
      approvalId: first.approval.currentDecision.approvalId,
    })).rejects.toThrow('CURRICULUM_STAGING_REVISION_CONFLICT')
    await stage(database, {
      draftId: first.draft.draftId, revision: 1, target: '2.0.0-collision.1',
      validationId: first.validation.validationSnapshotId,
      approvalId: first.approval.currentDecision.approvalId,
    })
    const second = await eligible(database, '2.0.0-collision.1')
    expect((await readStatus(database, second.draft.draftId)).blockingReasons).toContain('target_version_collision')
    await expect(stage(database, {
      draftId: second.draft.draftId, revision: 1, target: '2.0.0-collision.1',
      validationId: second.validation.validationSnapshotId,
      approvalId: second.approval.currentDecision.approvalId,
      request: crypto.randomUUID(), packageHash: 'd'.repeat(64),
    })).rejects.toThrow('CURRICULUM_STAGING_TARGET_COLLISION')
    expect((await database.query("select count(*)::integer as count from public.academy_curriculum_staged_releases where target_version = '2.0.0-collision.1'")).rows[0])
      .toEqual({ count: 1 })
  })

  it('supports exact replay, cross-request semantic replay, and rejects conflicting request reuse', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-replay.1')
    const input = {
      draftId: ready.draft.draftId, revision: 1, target: '2.0.0-replay.1',
      validationId: ready.validation.validationSnapshotId,
      approvalId: ready.approval.currentDecision.approvalId,
    }
    const first = await stage(database, input)
    const exact = await stage(database, input)
    const semantic = await stage(database, { ...input, request: crypto.randomUUID() })
    expect(first.replayed).toBe(false)
    expect(exact.replayed).toBe(true)
    expect(semantic.replayed).toBe(true)
    expect(semantic.candidate.stagingId).toBe(first.candidate.stagingId)
    await expect(stage(database, { ...input, requestDigest: HASH_B }))
      .rejects.toThrow('CURRICULUM_STAGING_REPLAY_CONFLICT')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_staged_releases')).rows[0])
      .toEqual({ count: 1 })
  })

  it('independently reauthorizes curriculum:publish and requires a current owner assignment', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-auth.1')
    const input = {
      draftId: ready.draft.draftId, revision: 1, target: '2.0.0-auth.1',
      validationId: ready.validation.validationSnapshotId,
      approvalId: ready.approval.currentDecision.approvalId,
    }
    await expect(stage(database, { ...input, actor: ADMIN })).rejects.toThrow('CURRICULUM_STAGING_REQUIRED')
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = statement_timestamp(),
          revoked_by = '${OWNER}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${OWNER}';
    `)
    await expect(stage(database, input)).rejects.toThrow('CURRICULUM_STAGING_REQUIRED')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_staged_releases')).rows[0])
      .toEqual({ count: 0 })
  })

  it('audits bounded operational facts and rolls back incomplete artifact sets', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-atomic.1')
    const input = {
      draftId: ready.draft.draftId, revision: 1, target: '2.0.0-atomic.1',
      validationId: ready.validation.validationSnapshotId,
      approvalId: ready.approval.currentDecision.approvalId,
    }
    await expect(stage(database, {
      ...input,
      mutate: (value) => { value.artifacts[0].byteCount = 3 },
    })).rejects.toThrow('CURRICULUM_STAGING_INPUT_INVALID')
    expect((await database.query('select count(*)::integer as count from public.academy_curriculum_staged_releases')).rows[0])
      .toEqual({ count: 0 })
    expect((await database.query("select count(*)::integer as count from academy_private.admin_audit_events where action = 'curriculum_release.stage'")).rows[0])
      .toEqual({ count: 0 })

    await stage(database, input)
    const event = (await database.query<any>(`
      select action, resource_type, resource_ref, resource_version,
        resource_revision, previous_value, new_value, reason_code, correlation_id
      from academy_private.admin_audit_events
      where action = 'curriculum_release.stage'
    `)).rows[0]
    expect(event).toMatchObject({
      action: 'curriculum_release.stage',
      resource_type: 'curriculum_release',
      resource_ref: ready.draft.draftId,
      resource_version: '2.0.0-atomic.1',
      resource_revision: '1',
      previous_value: { state: 'approved', revision: 1 },
      new_value: { state: 'staged', revision: 1, value: HASH_B },
      reason_code: 'curriculum.staged',
    })
    expect(event.correlation_id).toBe('50000000-0000-4000-8000-000000000001')
    expect(JSON.stringify(event)).not.toContain(course.title)
    expect(JSON.stringify(event)).not.toMatch(/payload|learning_objectives|scoring_guidance/i)
  })

  it('keeps storage forced-RLS, append-only, runtime-isolated, and migration-hash pinned', async () => {
    const database = databases[0]
    for (const table of [
      'public.academy_curriculum_staged_releases',
      'public.academy_curriculum_staged_release_artifacts',
      'academy_private.curriculum_staging_request_receipts',
    ]) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privilege = await database.query<{ allowed: boolean }>(
          `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as allowed`,
          [role, table],
        )
        expect(privilege.rows[0].allowed, `${role}:${table}`).toBe(false)
      }
    }
    const ready = await eligible(database, '2.0.0-immutable.1')
    await stage(database, {
      draftId: ready.draft.draftId, revision: 1, target: '2.0.0-immutable.1',
      validationId: ready.validation.validationSnapshotId,
      approvalId: ready.approval.currentDecision.approvalId,
    })
    await expect(database.exec('delete from public.academy_curriculum_staged_releases'))
      .rejects.toThrow('immutable')
    await expect(database.exec('update public.academy_curriculum_staged_release_artifacts set byte_count = 3'))
      .rejects.toThrow('immutable')

    const runtime = await readFile(new URL('../src/academy/contentClient.ts', import.meta.url), 'utf8')
    const runtimeTypes = await readFile(new URL('../src/academy/contentTypes.ts', import.meta.url), 'utf8')
    const compiler = await readFile(new URL('../scripts/build-curriculum.mjs', import.meta.url), 'utf8')
    expect(runtime).not.toMatch(/staged_releases|read_curriculum_staging/i)
    expect(runtimeTypes).toContain("ACADEMY_RELEASE_VERSION = '1.0.0'")
    expect(runtimeTypes).not.toMatch(/staged_releases|read_curriculum_staging/i)
    expect(compiler).toContain("const VERSION = '1.0.0'")
    expect(compiler).not.toMatch(/staged_releases|read_curriculum_staging/i)

    const migrationBytes = await readFile(migrations.at(-1)!)
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-release-staging-migration.json', import.meta.url),
      'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})

async function readStatus(database: PGlite, draftId: string) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_read_curriculum_staging_v1(
        $1, $2, 'curriculum:read'
      ) as value
    `, [VIEWER, draftId])).rows[0].value
  } finally {
    await reset(database)
  }
}

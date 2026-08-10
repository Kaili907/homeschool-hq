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
  './migrations/20260810160000_academy_curriculum_release_publishing.sql',
].map((path) => new URL(path, import.meta.url))

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const databases: PGlite[] = []

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

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

async function createDraft(database: PGlite, target: string) {
  await setService(database)
  try {
    const value = (await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', $2, '2.0.0', $3, $4, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, target, crypto.randomUUID(), HASH_A])).rows[0].value
    return { ...value, targetVersion: target }
  } finally {
    await reset(database)
  }
}

async function recordValidation(
  database: PGlite,
  draftId: string,
  values: { digest?: string; status?: string; ready?: boolean; blocking?: number; errors?: number; human?: number } = {},
) {
  const status = values.status ?? 'valid'
  const blocking = values.blocking ?? 0
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_record_curriculum_validation_v1(
        $1, $2, 1, 'curriculum-validation-v2', $3, $4,
        $5, $6, $7, $8, 'curriculum:read'
      ) as value
    `, [ADMIN, draftId, values.digest ?? HASH_A, status,
      values.ready ?? (status === 'valid' && blocking === 0 && (values.human ?? 0) === 0),
      blocking, values.errors ?? blocking, values.human ?? 0])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function approve(database: PGlite, draftId: string, validationId: string) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_decide_curriculum_approval_v1(
        $1, $2, 1, 'approved', 'approval.ready', $3, $4, $5, 'curriculum:approve'
      ) as value
    `, [OWNER, draftId, validationId, crypto.randomUUID(), HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

function packageInput(draftId: string, target: string, validationId: string, approvalId: string) {
  const relativePath = 'snapshot/manifest.json'
  const canonicalContent = '{}'
  const artifactHash = sha256(canonicalContent)
  const contentHash = sha256(`${relativePath}\u00002\u0000${artifactHash}\n`)
  const manifest = {
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: { packageId: 'manuel-academy-grades-5-7-8-curriculum-v1', version: target },
    baseReleaseVersion: '1.0.0',
    targetVersion: target,
    schemaSetVersion: '2.0.0',
    draft: { id: draftId, revision: 1 },
    validation: { id: validationId, resultDigest: HASH_A },
    approval: { id: approvalId },
    entityCounts: { courses: 1 },
    fileCount: 1,
    byteCount: 2,
    files: [{ relativePath, byteCount: 2, sha256: artifactHash }],
    contentHash,
  }
  const manifestCanonical = JSON.stringify(manifest)
  const manifestHash = sha256(manifestCanonical)
  const packageHash = sha256(`manuel-academy-curriculum-staged-v1\n${contentHash}\n${manifestHash}\n`)
  return {
    manifest,
    manifestCanonical,
    artifacts: [{ relativePath, byteCount: 2, sha256: artifactHash, canonicalContent }],
    contentHash,
    manifestHash,
    packageHash,
  }
}

async function stage(database: PGlite, ready: Awaited<ReturnType<typeof eligible>>, request = crypto.randomUUID()) {
  const value = packageInput(
    ready.draft.draftId,
    ready.draft.targetVersion,
    ready.validation.validationSnapshotId,
    ready.approval.currentDecision.approvalId,
  )
  await setService(database)
  try {
    const result = (await database.query<{ value: any }>(`
      select public.academy_admin_stage_curriculum_release_v1(
        $1, $2, 1, $3, $4, $5::jsonb, $6, $7::jsonb,
        $8, $9, $10, $11, $12, 'curriculum:publish'
      ) as value
    `, [OWNER, ready.draft.draftId, ready.validation.validationSnapshotId,
      ready.approval.currentDecision.approvalId, JSON.stringify(value.manifest),
      value.manifestCanonical, JSON.stringify(value.artifacts), value.contentHash,
      value.manifestHash, value.packageHash, request, HASH_A])).rows[0].value
    return { result, value, stagingId: result.candidate.stagingId }
  } finally {
    await reset(database)
  }
}

async function publish(
  database: PGlite,
  stagingId: string,
  values: { actor?: string; request?: string; digest?: string } = {},
) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_publish_curriculum_release_v1(
        $1, $2, $3, $4, 'curriculum:publish'
      ) as value
    `, [values.actor ?? OWNER, stagingId,
      values.request ?? '90000000-0000-4000-8000-000000000001',
      values.digest ?? HASH_A])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function eligible(database: PGlite, target: string) {
  const draft = await createDraft(database, target)
  const validation = await recordValidation(database, draft.draftId)
  const approval = await approve(database, draft.draftId, validation.validationSnapshotId)
  return { draft, validation, approval }
}

async function readPublication(database: PGlite, draftId: string) {
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_read_curriculum_publication_v1(
        $1, $2, 'curriculum:read'
      ) as value
    `, [VIEWER, draftId])).rows[0].value
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
    create table public.profiles (
      household_id uuid not null,
      profile_id text not null,
      data jsonb not null,
      primary key (household_id, profile_id)
    );
    insert into public.profiles values (
      '${OWNER}', 'learner-one', '{"academy":{"releaseVersion":"1.0.0"}}'
    );
  `)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum release publication database boundary', () => {
  it('publishes exact staged bytes while leaving 1.0.0, active pointer, and learner pins unchanged', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-rc.1')
    const staged = await stage(database, ready)
    const baseBefore = (await database.query<any>(`
      select release_id, version, status, source_commit, file_count, byte_count
      from public.academy_curriculum_releases where version = '1.0.0'
    `)).rows[0]
    const pointerBefore = (await database.query<any>('select * from public.academy_curriculum_active_pointers')).rows
    const learnersBefore = (await database.query<any>('select * from public.profiles order by profile_id')).rows

    const preflight = await readPublication(database, ready.draft.draftId)
    expect(preflight).toMatchObject({
      publicationState: 'eligible', eligible: true,
      candidate: {
        stagingId: staged.stagingId,
        validationStatus: 'publication_ready', approvalStatus: 'current',
        humanReviewStatus: 'clear',
        verification: {
          artifactSetComplete: true, contentVerified: true,
          manifestVerified: true, packageVerified: true,
        },
      },
    })

    const result = await publish(database, staged.stagingId)
    expect(result).toMatchObject({
      replayed: false,
      publicationState: 'published', eligible: false, blockingReasons: [],
      published: {
        releaseId: staged.stagingId,
        version: '2.0.0-rc.1', status: 'published', activationStatus: 'not_active',
        stagingId: staged.stagingId, packageHash: staged.value.packageHash,
        authority: 'curriculum:publish',
      },
    })
    const release = (await database.query<any>(`
      select version, status, provenance_class, staging_id, published_by,
        publication_content_sha256, publication_manifest_sha256,
        publication_package_sha256, file_count, byte_count
      from public.academy_curriculum_releases where version = '2.0.0-rc.1'
    `)).rows[0]
    expect(release).toMatchObject({
      version: '2.0.0-rc.1', status: 'published', provenance_class: 'staged_publish',
      staging_id: staged.stagingId, published_by: OWNER,
      publication_content_sha256: staged.value.contentHash,
      publication_manifest_sha256: staged.value.manifestHash,
      publication_package_sha256: staged.value.packageHash,
      file_count: 1,
    })
    const artifact = (await database.query<any>(`
      select relative_path, byte_count, sha256, safe_classification,
        immutable_locator, canonical_content
      from public.academy_curriculum_release_files where release_id = $1
    `, [staged.stagingId])).rows[0]
    expect(artifact).toEqual({
      relative_path: 'snapshot/manifest.json', byte_count: 2,
      sha256: sha256('{}'), safe_classification: 'immutable_embedded_json',
      immutable_locator: `curriculum_registry:${staged.stagingId}:snapshot/manifest.json`,
      canonical_content: '{}',
    })
    expect((await database.query<any>(`
      select release_id, version, status, source_commit, file_count, byte_count
      from public.academy_curriculum_releases where version = '1.0.0'
    `)).rows[0]).toEqual(baseBefore)
    expect((await database.query<any>('select * from public.academy_curriculum_active_pointers')).rows).toEqual(pointerBefore)
    expect((await database.query<any>('select * from public.profiles order by profile_id')).rows).toEqual(learnersBefore)
  })

  it('fails closed for missing staging and independently detects artifact, manifest, and package tamper', async () => {
    const database = databases[0]
    await expect(publish(database, crypto.randomUUID())).rejects.toThrow('CURRICULUM_PUBLICATION_NOT_FOUND')

    const artifactReady = await eligible(database, '2.0.0-artifact.1')
    const artifactStage = await stage(database, artifactReady)
    await database.exec('alter table public.academy_curriculum_staged_release_artifacts disable trigger academy_curriculum_staged_artifacts_immutable')
    await database.query(`
      update public.academy_curriculum_staged_release_artifacts
      set canonical_content = '[]', content = '[]'::jsonb
      where staging_id = $1
    `, [artifactStage.stagingId])
    await expect(publish(database, artifactStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_ARTIFACT_INVALID')

    const manifestReady = await eligible(database, '2.0.0-manifest.1')
    const manifestStage = await stage(database, manifestReady)
    await database.exec('alter table public.academy_curriculum_staged_releases disable trigger academy_curriculum_staged_releases_immutable')
    await database.query(`
      update public.academy_curriculum_staged_releases
      set manifest_canonical = '{"tampered":true}'
      where staging_id = $1
    `, [manifestStage.stagingId])
    await expect(publish(database, manifestStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_MANIFEST_MISMATCH')

    const packageReady = await eligible(database, '2.0.0-package.1')
    const packageStage = await stage(database, packageReady)
    await database.query(`
      update public.academy_curriculum_staged_releases
      set package_sha256 = $2 where staging_id = $1
    `, [packageStage.stagingId, HASH_B])
    await expect(publish(database, packageStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_PACKAGE_MISMATCH')
    expect((await database.query<any>(`
      select count(*)::integer as count from public.academy_curriculum_releases
      where provenance_class = 'staged_publish'
    `)).rows[0]).toEqual({ count: 0 })
  })

  it('rejects stale approval, invalid validation, and a reappeared human-review blocker', async () => {
    const database = databases[0]
    const stale = await eligible(database, '2.0.0-stale.1')
    const staleStage = await stage(database, stale)
    await recordValidation(database, stale.draft.draftId, { digest: HASH_B })
    await expect(publish(database, staleStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_APPROVAL_STALE')

    const invalid = await eligible(database, '2.0.0-invalid.1')
    const invalidStage = await stage(database, invalid)
    await recordValidation(database, invalid.draft.draftId, {
      digest: HASH_B, status: 'invalid', ready: false, blocking: 1, errors: 1,
    })
    await expect(publish(database, invalidStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_VALIDATION_BLOCKED')

    const human = await eligible(database, '2.0.0-human.1')
    const humanStage = await stage(database, human)
    await recordValidation(database, human.draft.draftId, {
      digest: HASH_B, status: 'invalid', ready: false, blocking: 1, errors: 1, human: 1,
    })
    await expect(publish(database, humanStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_HUMAN_REVIEW_BLOCKED')
  })

  it('rejects a version collision, preserves immutable releases, and supports exact replay only', async () => {
    const database = databases[0]
    const collision = await eligible(database, '2.0.0-collision.1')
    const collisionStage = await stage(database, collision)
    await database.query(`
      insert into public.academy_curriculum_releases (
        release_id, package_id, version, status, registered_at, authored_on,
        provenance_class, source_commit, source_root,
        package_manifest_sha256, checksum_manifest_sha256, curriculum_manifest_sha256,
        file_inventory_sha256, file_count, byte_count,
        course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      )
      select gen_random_uuid(), package_id, $1, status, statement_timestamp(), authored_on,
        provenance_class, source_commit, 'curriculum-content/manuel-academy/2.0.0',
        package_manifest_sha256, checksum_manifest_sha256, curriculum_manifest_sha256,
        file_inventory_sha256, file_count, byte_count,
        course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      from public.academy_curriculum_releases where version = '1.0.0'
    `, [collision.draft.targetVersion])
    await expect(publish(database, collisionStage.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_TARGET_COLLISION')

    const ready = await eligible(database, '2.0.0-replay.1')
    const staged = await stage(database, ready)
    const request = '90000000-0000-4000-8000-000000000001'
    expect((await publish(database, staged.stagingId, { request })).replayed).toBe(false)
    expect((await publish(database, staged.stagingId, { request })).replayed).toBe(true)
    expect((await publish(database, staged.stagingId, { request: crypto.randomUUID() })).replayed).toBe(true)
    await expect(publish(database, staged.stagingId, { request, digest: HASH_B }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_REPLAY_CONFLICT')
    expect((await database.query<any>(`
      select count(*)::integer as count from public.academy_curriculum_releases
      where version = '2.0.0-replay.1'
    `)).rows[0]).toEqual({ count: 1 })
    await expect(database.exec(`update public.academy_curriculum_releases set status = 'published' where version = '1.0.0'`))
      .rejects.toThrow('immutable')
    await expect(database.exec(`delete from public.academy_curriculum_releases where version = '2.0.0-replay.1'`))
      .rejects.toThrow('immutable')
    await expect(database.exec(`update public.academy_curriculum_release_files set byte_count = byte_count where release_id = '${staged.stagingId}'`))
      .rejects.toThrow('immutable')
  })

  it('reauthorizes in the database and records only bounded publication audit facts', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-auth.1')
    const staged = await stage(database, ready)
    await expect(publish(database, staged.stagingId, { actor: ADMIN, request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_REQUIRED')
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = statement_timestamp(),
          revoked_by = '${OWNER}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${OWNER}';
    `)
    await expect(publish(database, staged.stagingId, { request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_PUBLICATION_REQUIRED')

    const secondDatabase = await PGlite.create()
    databases.push(secondDatabase)
    await secondDatabase.exec(bootstrap)
    for (const migration of migrations) await secondDatabase.exec(await readFile(migration, 'utf8'))
    await secondDatabase.exec(`
      insert into public.academy_admin_role_assignments (user_id, role, assignment_reason_code)
      values ('${OWNER}', 'owner', 'test.owner'), ('${ADMIN}', 'admin', 'test.admin'), ('${VIEWER}', 'viewer', 'test.viewer');
    `)
    const auditReady = await eligible(secondDatabase, '2.0.0-audit.1')
    const auditStage = await stage(secondDatabase, auditReady)
    await publish(secondDatabase, auditStage.stagingId)
    const event = (await secondDatabase.query<any>(`
      select action, resource_type, resource_ref, resource_version,
        resource_revision, actor_assignment_ref, previous_value, new_value,
        reason_code, correlation_id
      from academy_private.admin_audit_events where action = 'curriculum.publish'
    `)).rows[0]
    expect(event).toMatchObject({
      action: 'curriculum.publish', resource_type: 'curriculum_release',
      resource_ref: auditStage.stagingId, resource_version: '2.0.0-audit.1',
      resource_revision: '1', reason_code: 'curriculum.published',
      previous_value: { state: 'staged', status: 'verified', value: auditStage.stagingId },
      new_value: {
        state: 'published', status: 'not_active',
        version: auditStage.value.manifestHash, value: auditStage.value.packageHash,
      },
    })
    expect(event.actor_assignment_ref).toMatch(/^[0-9a-f-]{36}$/)
    expect(event.correlation_id).toBe('90000000-0000-4000-8000-000000000001')
    expect(JSON.stringify(event)).not.toMatch(/payload|canonicalContent|learning_objectives/i)
  })

  it('rolls back release, artifacts, audit, and receipt when artifact delivery fails mid-transaction', async () => {
    const database = databases[0]
    const ready = await eligible(database, '2.0.0-atomic.1')
    const staged = await stage(database, ready)
    await database.exec(`
      create function public.test_publication_artifact_failure()
      returns trigger language plpgsql as $$
      begin raise exception 'forced artifact plane failure'; end;
      $$;
      create trigger test_publication_artifact_failure
      before insert on public.academy_curriculum_release_files
      for each row when (new.release_id = '${staged.stagingId}')
      execute function public.test_publication_artifact_failure();
    `)
    await expect(publish(database, staged.stagingId)).rejects.toThrow('forced artifact plane failure')
    expect((await database.query<any>(`
      select count(*)::integer as count from public.academy_curriculum_releases
      where version = '2.0.0-atomic.1'
    `)).rows[0]).toEqual({ count: 0 })
    expect((await database.query<any>(`
      select count(*)::integer as count from public.academy_curriculum_release_files
      where release_id = $1
    `, [staged.stagingId])).rows[0]).toEqual({ count: 0 })
    expect((await database.query<any>(`
      select count(*)::integer as count from academy_private.admin_audit_events
      where action = 'curriculum.publish' and resource_ref = $1
    `, [staged.stagingId])).rows[0]).toEqual({ count: 0 })
    expect((await database.query<any>(`
      select count(*)::integer as count from academy_private.curriculum_publication_request_receipts
      where staging_id = $1
    `, [staged.stagingId])).rows[0]).toEqual({ count: 0 })
  })

  it('keeps publication service-only, runtime-isolated, and migration-hash pinned', async () => {
    const database = databases[0]
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const privilege = await database.query<{ allowed: boolean }>(
        `select has_table_privilege($1, 'academy_private.curriculum_publication_request_receipts', 'SELECT,INSERT,UPDATE,DELETE') as allowed`,
        [role],
      )
      expect(privilege.rows[0].allowed, role).toBe(false)
    }
    for (const role of ['anon', 'authenticated']) {
      const privilege = await database.query<{ allowed: boolean }>(
        `select has_function_privilege($1, 'public.academy_admin_publish_curriculum_release_v1(uuid,uuid,uuid,text,text)', 'EXECUTE') as allowed`,
        [role],
      )
      expect(privilege.rows[0].allowed, role).toBe(false)
    }
    expect((await database.query<{ allowed: boolean }>(`
      select has_function_privilege(
        'service_role',
        'public.academy_admin_publish_curriculum_release_v1(uuid,uuid,uuid,text,text)',
        'EXECUTE'
      ) as allowed
    `)).rows[0].allowed).toBe(true)

    const runtimeTypes = await readFile(new URL('../src/academy/contentTypes.ts', import.meta.url), 'utf8')
    const compiler = await readFile(new URL('../scripts/build-curriculum.mjs', import.meta.url), 'utf8')
    expect(runtimeTypes).toContain("ACADEMY_RELEASE_VERSION = '1.0.0'")
    expect(compiler).toContain("const VERSION = '1.0.0'")
    expect(runtimeTypes).not.toMatch(/read_curriculum_publication|staged_publish/i)
    expect(compiler).not.toMatch(/read_curriculum_publication|staged_publish/i)

    const migrationBytes = await readFile(migrations.at(-1)!)
    const migrationText = migrationBytes.toString('utf8')
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-release-publishing-migration.json', import.meta.url),
      'utf8',
    ))
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
    expect(migrationText).not.toMatch(/(?:insert into|update|delete from)\s+public\.academy_curriculum_active_pointers/i)
    expect(migrationText).not.toMatch(/(?:insert into|update|delete from)\s+public\.profiles/i)
  })
})

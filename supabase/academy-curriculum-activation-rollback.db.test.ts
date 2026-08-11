import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  canonicalJson,
  verifyStagedCandidate,
} from '../netlify/functions/_shared/admin-curriculum-integrity.js'

const migrations = [
  './migrations/20260808120000_academy_admin_authorization.sql',
  './migrations/20260809130000_academy_admin_audit_foundation.sql',
  './migrations/20260809160000_academy_curriculum_release_registry.sql',
  './migrations/20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  './migrations/20260810120000_academy_curriculum_draft_authoring.sql',
  './migrations/20260810140100_academy_curriculum_human_approval.sql',
  './migrations/20260810150100_academy_curriculum_release_staging.sql',
  './migrations/20260810160000_academy_curriculum_release_publishing.sql',
  './migrations/20260810170000_academy_curriculum_activation_rollback.sql',
].map((path) => new URL(path, import.meta.url))

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ADMIN = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const VIEWER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const LEARNER_HOUSEHOLD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const RELEASE_1 = '16000000-0000-4000-8000-000000000001'
const RELEASE_2 = '26000000-0000-4000-8000-000000000002'
const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const databases: PGlite[] = []
const COLLECTIONS = [
  'courses', 'units', 'lessons', 'assessments', 'assessment_interpretations',
  'schedules', 'standard_frameworks', 'resources', 'policy_sets',
] as const

const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create schema academy_private;
  create table auth.users (id uuid primary key);
  create table public.profiles (
    household_id uuid not null,
    profile_id text not null,
    data jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (household_id, profile_id)
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  create function academy_private.operational_is_trusted_server()
  returns boolean language sql stable set search_path = pg_catalog as $$
    select auth.uid() is null
      and coalesce(
        nullif(current_setting('request.jwt.claim.role', true), ''),
        nullif(current_setting('role', true), '')
      ) = 'service_role';
  $$;
  insert into auth.users (id) values
    ('${OWNER}'), ('${ADMIN}'), ('${VIEWER}'), ('${LEARNER_HOUSEHOLD}');
`

async function setService(database: PGlite) {
  await database.exec("set role service_role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', 'service_role', false)")
}

async function reset(database: PGlite) {
  await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); select set_config('request.jwt.claim.role', '', false)")
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function stagedPackage(
  draftId: string,
  targetVersion: string,
  validationSnapshotId: string,
  approvalId: string,
) {
  const values = Object.fromEntries(COLLECTIONS.map((name) => [
    name,
    name === 'courses' ? [{ course_id: 'course-1' }] : [],
  ]))
  const contentByPath = {
    'snapshot/manifest.json': { schema_set_version: '2.0.0' },
    ...Object.fromEntries(COLLECTIONS.map((name) => [`snapshot/${name}.json`, values[name]])),
  }
  const artifacts = Object.entries(contentByPath).map(([relativePath, content]) => {
    const canonicalContent = canonicalJson(content)
    return {
      relativePath,
      byteCount: Buffer.byteLength(canonicalContent),
      sha256: sha256(canonicalContent),
      canonicalContent,
    }
  }).sort((left, right) => left.relativePath.localeCompare(right.relativePath))
  const entityCounts = Object.fromEntries(COLLECTIONS.map((name) => [name, values[name].length]))
  const byteCount = artifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0)
  const contentHash = sha256(artifacts.map((artifact) => (
    `${artifact.relativePath}\0${artifact.byteCount}\0${artifact.sha256}\n`
  )).join(''))
  const manifest = {
    schemaVersion: 1,
    packageFormat: 'manuel-academy-curriculum-staged-v1',
    releaseIdentity: {
      packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
      version: targetVersion,
    },
    baseReleaseVersion: '1.0.0',
    targetVersion,
    schemaSetVersion: '2.0.0',
    draft: { id: draftId, revision: 1 },
    validation: { id: validationSnapshotId, resultDigest: HASH_A },
    approval: { id: approvalId },
    entityCounts,
    fileCount: artifacts.length,
    byteCount,
    files: artifacts.map(({ relativePath, byteCount: bytes, sha256: digest }) => ({
      relativePath,
      byteCount: bytes,
      sha256: digest,
    })),
    contentHash,
  }
  const manifestCanonical = canonicalJson(manifest)
  const manifestHash = sha256(manifestCanonical)
  return {
    artifacts,
    byteCount,
    contentHash,
    entityCounts,
    manifest,
    manifestCanonical,
    manifestHash,
    packageHash: sha256(
      `manuel-academy-curriculum-staged-v1\n${contentHash}\n${manifestHash}\n`,
    ),
  }
}

async function stageVerifyPublish(database: PGlite, targetVersion: string) {
  const stageRequest = crypto.randomUUID()
  const publishRequest = crypto.randomUUID()
  await setService(database)
  try {
    const draft = (await database.query<{ value: any }>(`
      select public.academy_admin_create_curriculum_draft_v1(
        $1, '1.0.0', $2, '2.0.0', $3, $4, 'curriculum:drafts:write'
      ) as value
    `, [ADMIN, targetVersion, crypto.randomUUID(), HASH_A])).rows[0].value
    const validation = (await database.query<{ value: any }>(`
      select public.academy_admin_record_curriculum_validation_v1(
        $1, $2, 1, 'curriculum-validation-v2', $3, 'valid',
        true, 0, 0, 0, 'curriculum:read'
      ) as value
    `, [ADMIN, draft.draftId, HASH_A])).rows[0].value
    const approval = (await database.query<{ value: any }>(`
      select public.academy_admin_decide_curriculum_approval_v1(
        $1, $2, 1, 'approved', 'approval.ready', $3, $4, $5,
        'curriculum:approve'
      ) as value
    `, [OWNER, draft.draftId, validation.validationSnapshotId, crypto.randomUUID(), HASH_A])).rows[0].value
    const packageValue = stagedPackage(
      draft.draftId,
      targetVersion,
      validation.validationSnapshotId,
      approval.currentDecision.approvalId,
    )
    const stageArgs = [
      OWNER, draft.draftId, validation.validationSnapshotId,
      approval.currentDecision.approvalId, JSON.stringify(packageValue.manifest),
      packageValue.manifestCanonical, JSON.stringify(packageValue.artifacts),
      packageValue.contentHash, packageValue.manifestHash, packageValue.packageHash,
      stageRequest, HASH_A,
    ]
    const staged = (await database.query<{ value: any }>(`
      select public.academy_admin_stage_curriculum_release_v1(
        $1, $2, 1, $3, $4, $5::jsonb, $6, $7::jsonb,
        $8, $9, $10, $11, $12, 'curriculum:publish'
      ) as value
    `, stageArgs)).rows[0].value
    const stagingId = staged.candidate.stagingId
    const evidence = (await database.query<{ value: any }>(`
      select public.academy_admin_read_curriculum_staging_integrity_v1(
        $1, 'curriculum:read'
      ) as value
    `, [VIEWER])).rows[0].value.candidates.find(
      (candidate: any) => candidate.stagingId === stagingId,
    )
    const publication = (await database.query<{ value: any }>(`
      select public.academy_admin_publish_curriculum_release_v1(
        $1, $2, $3, $4, 'curriculum:publish'
      ) as value
    `, [OWNER, stagingId, publishRequest, HASH_A])).rows[0].value
    return {
      draft,
      evidence,
      packageValue,
      publication,
      publishRequest,
      stageArgs,
      stageRequest,
      staged,
      stagingId,
    }
  } finally {
    await reset(database)
  }
}

async function transition(database: PGlite, input: {
  actor?: string
  target?: string
  expected?: number
  kind?: 'activation' | 'rollback'
  request?: string
  digest?: string
}) {
  const kind = input.kind ?? 'activation'
  await setService(database)
  try {
    return (await database.query<{ value: any }>(`
      select public.academy_admin_transition_curriculum_pointer_v1(
        $1, $2, $3, $4, $5, $6, $7, 'releases:manage'
      ) as value
    `, [
      input.actor ?? OWNER,
      input.target ?? '2.0.0',
      input.expected ?? 1,
      kind,
      kind === 'activation' ? 'release.activated' : 'release.rolled_back',
      input.request ?? '50000000-0000-4000-8000-000000000001',
      input.digest ?? HASH_A,
    ])).rows[0].value
  } finally {
    await reset(database)
  }
}

async function immutableReleaseSnapshot(database: PGlite, version: string) {
  return {
    release: (await database.query(`
      select release.*
      from public.academy_curriculum_releases as release
      where release.version = $1
    `, [version])).rows,
    artifacts: (await database.query(`
      select file.*
      from public.academy_curriculum_release_files as file
      join public.academy_curriculum_releases as release
        on release.release_id = file.release_id
      where release.version = $1
      order by file.relative_path
    `, [version])).rows,
  }
}

async function insertPublishedRelease(database: PGlite) {
  await database.exec(`
    insert into public.academy_curriculum_releases
    select
      '${RELEASE_2}'::uuid, package_id, '2.0.0', status,
      '2026-08-10 16:00:00+00'::timestamptz, '2026-08-10'::date,
      provenance_class, '${'b'.repeat(40)}',
      'curriculum-content/manuel-academy/2.0.0',
      '${'a'.repeat(64)}', '${'b'.repeat(64)}', '${'c'.repeat(64)}', '${'f'.repeat(64)}',
      5, 60,
      course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
      grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
      grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
      grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
      grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
      grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
      grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
    from public.academy_curriculum_releases where version = '1.0.0';

    insert into public.academy_curriculum_release_files (
      release_id, relative_path, byte_count, sha256, content_type,
      safe_classification, immutable_locator
    ) values
      ('${RELEASE_2}', 'MANIFEST.json', 10, '${'a'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/MANIFEST.json'),
      ('${RELEASE_2}', 'SHA256SUMS.txt', 11, '${'b'.repeat(64)}', 'text/plain;charset=utf-8',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/SHA256SUMS.txt'),
      ('${RELEASE_2}', 'curriculum-manifest.json', 12, '${'c'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/curriculum-manifest.json'),
      ('${RELEASE_2}', 'validation/manifest-verification.txt', 13, '${'d'.repeat(64)}', 'text/plain;charset=utf-8',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/validation/manifest-verification.txt'),
      ('${RELEASE_2}', 'validation/validation.json', 14, '${'e'.repeat(64)}', 'application/json',
       'metadata_only_internal_source', 'git_commit_path:${'b'.repeat(40)}:curriculum-content/manuel-academy/2.0.0/validation/validation.json');
  `)
}

async function insertStagedOnlyRelease(database: PGlite) {
  await database.exec(`
    insert into public.academy_curriculum_drafts (
      draft_id, base_release_id, target_version, authoring_schema_version,
      lifecycle_state, created_by, updated_by, create_request_id
    ) values (
      '31000000-0000-4000-8000-000000000001', '${RELEASE_1}', '3.0.0',
      '2.0.0', 'draft', '${ADMIN}', '${ADMIN}',
      '31000000-0000-4000-8000-000000000002'
    );
    insert into public.academy_curriculum_draft_validation_snapshots (
      validation_snapshot_id, draft_id, draft_revision, base_release_id,
      target_version, schema_set_version, engine_version, result_sha256,
      validation_status, publication_ready, blocking_count,
      blocking_error_count, human_review_blocker_count, validated_by
    ) values (
      '32000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', 'test-engine', '${HASH_A}', 'valid', true, 0, 0, 0, '${ADMIN}'
    );
    insert into public.academy_curriculum_draft_approval_decisions (
      approval_id, draft_id, draft_revision, base_release_id, target_version,
      schema_set_version, validation_snapshot_id, validation_result_sha256,
      decision, reason_code, decided_by, reviewer_role, request_id
    ) values (
      '33000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', '32000000-0000-4000-8000-000000000001', '${HASH_A}',
      'approved', 'approval.ready', '${OWNER}', 'owner',
      '33000000-0000-4000-8000-000000000002'
    );
    insert into public.academy_curriculum_staged_releases (
      staging_id, draft_id, draft_revision, base_release_id, target_version,
      schema_set_version, validation_snapshot_id, validation_result_sha256,
      approval_id, entity_counts, file_count, byte_count, content_sha256,
      manifest_sha256, package_sha256, manifest, manifest_canonical,
      staged_by, request_id
    ) values (
      '34000000-0000-4000-8000-000000000001',
      '31000000-0000-4000-8000-000000000001', 1, '${RELEASE_1}', '3.0.0',
      '2.0.0', '32000000-0000-4000-8000-000000000001', '${HASH_A}',
      '33000000-0000-4000-8000-000000000001', '{}'::jsonb, 1, 2,
      '${HASH_A}', '${HASH_B}', '${'c'.repeat(64)}', '{}'::jsonb, '{}',
      '${OWNER}', '34000000-0000-4000-8000-000000000002'
    );
  `)
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
    insert into public.profiles (household_id, profile_id, data)
    values (
      '${LEARNER_HOUSEHOLD}', 'learner-one',
      '{"academy":{"releaseVersion":"1.0.0"}}'::jsonb
    );
  `)
  await insertPublishedRelease(database)
})

afterEach(async () => Promise.all(databases.splice(0).map((database) => database.close())))

describe('curriculum activation and rollback database boundary', () => {
  it('rehearses two local pointer transitions and rollback without changing learner pins or immutable releases', async () => {
    const database = databases[0]
    const firstVersion = '3.2.0-rehearsal.1'
    const secondVersion = '3.3.0-rehearsal.1'
    const learnerBefore = (await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]

    const first = await stageVerifyPublish(database, firstVersion)
    expect(verifyStagedCandidate(first.evidence)).toMatchObject({
      state: 'STAGED', status: 'VERIFIED', packageStatus: 'VERIFIED',
    })
    expect(first.publication).toMatchObject({
      publicationState: 'published',
      published: {
        version: firstVersion,
        status: 'published',
        activationStatus: 'not_active',
      },
    })
    expect((await database.query<any>(`
      select release.version, pointer.revision
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({ version: '1.0.0', revision: 1 })
    const firstImmutableBefore = await immutableReleaseSnapshot(database, firstVersion)

    const firstActivation = await transition(database, {
      target: firstVersion,
      expected: 1,
      request: '5a000000-0000-4000-8000-000000000001',
    })
    expect(firstActivation.pointer).toMatchObject({
      releaseVersion: firstVersion,
      revision: 2,
      transitionKind: 'activation',
    })
    expect(firstActivation.existingLearnersRepinned).toBe(false)
    expect((await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]).toEqual(learnerBefore)

    const second = await stageVerifyPublish(database, secondVersion)
    expect(verifyStagedCandidate(second.evidence).status).toBe('VERIFIED')
    expect(second.publication.published.activationStatus).toBe('not_active')
    const secondImmutableBefore = await immutableReleaseSnapshot(database, secondVersion)
    const secondActivation = await transition(database, {
      target: secondVersion,
      expected: 2,
      request: '5a000000-0000-4000-8000-000000000002',
    })
    expect(secondActivation.pointer).toMatchObject({
      releaseVersion: secondVersion,
      revision: 3,
      transitionKind: 'activation',
    })

    const rollback = await transition(database, {
      target: firstVersion,
      expected: 3,
      kind: 'rollback',
      request: '5a000000-0000-4000-8000-000000000003',
    })
    expect(rollback.pointer).toMatchObject({
      releaseVersion: firstVersion,
      revision: 4,
      transitionKind: 'rollback',
    })
    expect(rollback.history.map((entry: any) => [
      entry.pointerRevision,
      entry.transitionKind,
      entry.newReleaseVersion,
    ])).toEqual([
      [4, 'rollback', firstVersion],
      [3, 'activation', secondVersion],
      [2, 'activation', firstVersion],
      [1, 'migration_seed', '1.0.0'],
    ])
    expect((await database.query(
      'select count(*)::integer as count from public.academy_curriculum_releases',
    )).rows[0]).toEqual({ count: 4 })
    expect((await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]).toEqual(learnerBefore)
    expect(await immutableReleaseSnapshot(database, firstVersion)).toEqual(firstImmutableBefore)
    expect(await immutableReleaseSnapshot(database, secondVersion)).toEqual(secondImmutableBefore)
  })

  it('runs stage → verify → publish → activate with independent exact replay and continuous provenance', async () => {
    const database = databases[0]
    const targetVersion = '3.0.0-rc.1'
    const learnerBefore = (await database.query<any>(`
      select data from public.profiles where profile_id = 'learner-one'
    `)).rows[0]
    const pipeline = await stageVerifyPublish(database, targetVersion)

    expect(verifyStagedCandidate(pipeline.evidence)).toMatchObject({
      state: 'STAGED',
      status: 'VERIFIED',
      packageStatus: 'VERIFIED',
      provenance: { status: 'VERIFIED' },
    })
    expect(pipeline.publication).toMatchObject({
      replayed: false,
      publicationState: 'published',
      published: {
        version: targetVersion,
        status: 'published',
        activationStatus: 'not_active',
        stagingId: pipeline.stagingId,
        contentHash: pipeline.packageValue.contentHash,
        manifestHash: pipeline.packageValue.manifestHash,
        packageHash: pipeline.packageValue.packageHash,
      },
    })
    expect((await database.query<any>(`
      select release.version, pointer.revision
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({ version: '1.0.0', revision: 1 })

    await setService(database)
    try {
      const stageReplay = (await database.query<{ value: any }>(`
        select public.academy_admin_stage_curriculum_release_v1(
          $1, $2, 1, $3, $4, $5::jsonb, $6, $7::jsonb,
          $8, $9, $10, $11, $12, 'curriculum:publish'
        ) as value
      `, pipeline.stageArgs)).rows[0].value
      const publishReplay = (await database.query<{ value: any }>(`
        select public.academy_admin_publish_curriculum_release_v1(
          $1, $2, $3, $4, 'curriculum:publish'
        ) as value
      `, [OWNER, pipeline.stagingId, pipeline.publishRequest, HASH_A])).rows[0].value
      expect(stageReplay.replayed).toBe(true)
      expect(publishReplay.replayed).toBe(true)
    } finally {
      await reset(database)
    }

    const activationRequest = '59000000-0000-4000-8000-000000000001'
    const activated = await transition(database, {
      target: targetVersion,
      request: activationRequest,
    })
    const activationReplay = await transition(database, {
      target: targetVersion,
      request: activationRequest,
    })
    expect(activated).toMatchObject({
      replayed: false,
      existingLearnersRepinned: false,
      pointer: {
        releaseVersion: targetVersion,
        revision: 2,
        transitionKind: 'activation',
      },
    })
    expect(activationReplay).toMatchObject({
      replayed: true,
      pointer: { releaseVersion: targetVersion, revision: 2 },
    })
    expect((await database.query<any>(`
      select staged.draft_id, staged.draft_revision,
        staged.validation_snapshot_id, staged.approval_id,
        release.staging_id, release.publication_content_sha256,
        release.publication_manifest_sha256, release.publication_package_sha256,
        pointer.revision as pointer_revision
      from public.academy_curriculum_releases as release
      join public.academy_curriculum_staged_releases as staged
        on staged.staging_id = release.staging_id
      join public.academy_curriculum_active_pointers as pointer
        on pointer.release_id = release.release_id
      where release.version = $1
    `, [targetVersion])).rows[0]).toMatchObject({
      draft_id: pipeline.draft.draftId,
      draft_revision: 1,
      validation_snapshot_id: pipeline.evidence.validationSnapshotId,
      approval_id: pipeline.evidence.approvalId,
      staging_id: pipeline.stagingId,
      publication_content_sha256: pipeline.packageValue.contentHash,
      publication_manifest_sha256: pipeline.packageValue.manifestHash,
      publication_package_sha256: pipeline.packageValue.packageHash,
      pointer_revision: 2,
    })
    expect((await database.query<any>(`
      select data from public.profiles where profile_id = 'learner-one'
    `)).rows[0]).toEqual(learnerBefore)
  })

  it('rejects activation when immutable staged-publish evidence is tampered', async () => {
    const database = databases[0]
    const pipeline = await stageVerifyPublish(database, '3.1.0')
    await database.exec(`
      alter table public.academy_curriculum_release_files
        disable trigger academy_curriculum_release_files_immutable;
    `)
    await database.query(`
      update public.academy_curriculum_release_files
      set sha256 = $2
      where release_id = $1 and relative_path = 'snapshot/manifest.json'
    `, [pipeline.stagingId, HASH_B])
    await expect(transition(database, { target: '3.1.0', request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE')
    expect((await database.query<any>(`
      select release.version, pointer.revision
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({ version: '1.0.0', revision: 1 })
  })

  it('rejects activation when staged-publish release metadata no longer matches its manifest', async () => {
    const database = databases[0]
    const pipeline = await stageVerifyPublish(database, '3.1.1')
    await database.exec(`
      alter table public.academy_curriculum_releases
        disable trigger academy_curriculum_releases_immutable;
    `)
    await database.query(`
      update public.academy_curriculum_releases
      set package_id = 'tampered-curriculum-package'
      where release_id = $1
    `, [pipeline.stagingId])
    await expect(transition(database, { target: '3.1.1', request: crypto.randomUUID() }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE')
    expect((await database.query<any>(`
      select release.version, pointer.revision
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({ version: '1.0.0', revision: 1 })
  })

  it('activates only an artifact-complete immutable PUBLISHED release with pointer CAS', async () => {
    const database = databases[0]
    const releaseBefore = (await database.query(
      "select * from public.academy_curriculum_releases where version = '2.0.0'",
    )).rows[0]
    const result = await transition(database, {})
    expect(result).toMatchObject({
      replayed: false,
      existingLearnersRepinned: false,
      pointer: {
        releaseVersion: '2.0.0', revision: 2,
        transitionKind: 'activation', bindingMode: 'default_authority',
      },
      transition: {
        state: 'transitioned', transitionKind: 'activation',
        previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        pointerRevision: 2,
      },
    })
    expect((await database.query(
      "select * from public.academy_curriculum_releases where version = '2.0.0'",
    )).rows[0]).toEqual(releaseBefore)
    await expect(transition(database, {
      target: '1.0.0', expected: 1, kind: 'rollback', request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_ACTIVATION_POINTER_CONFLICT')
  })

  it('rejects staged-only, nonexistent, and missing-artifact targets', async () => {
    const database = databases[0]
    await expect(transition(database, {
      target: '2.0.0', kind: 'rollback', request: crypto.randomUUID(),
    })).rejects.toThrow('CURRICULUM_ACTIVATION_KIND_CONFLICT')
    await insertStagedOnlyRelease(database)
    await expect(transition(database, { target: '3.0.0' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_TARGET_NOT_PUBLISHED')
    await expect(transition(database, { target: '9.9.9' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_TARGET_NOT_FOUND')

    await database.exec(`
      insert into public.academy_curriculum_releases
      select
        '46000000-0000-4000-8000-000000000004'::uuid, package_id, '4.0.0', status,
        registered_at, authored_on, provenance_class, source_commit,
        'curriculum-content/manuel-academy/4.0.0',
        package_manifest_sha256, checksum_manifest_sha256, curriculum_manifest_sha256,
        file_inventory_sha256, file_count, byte_count,
        course_count, unit_count, lesson_count, assessment_count, text_count, schedule_count,
        grade_5_course_count, grade_5_unit_count, grade_5_lesson_count,
        grade_5_assessment_count, grade_5_text_count, grade_5_schedule_count,
        grade_7_course_count, grade_7_unit_count, grade_7_lesson_count,
        grade_7_assessment_count, grade_7_text_count, grade_7_schedule_count,
        grade_8_course_count, grade_8_unit_count, grade_8_lesson_count,
        grade_8_assessment_count, grade_8_text_count, grade_8_schedule_count
      from public.academy_curriculum_releases where version = '1.0.0';
    `)
    await expect(transition(database, { target: '4.0.0' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE')
  })

  it('makes exact replay safe, rejects changed reuse, and returns an already-active no-op', async () => {
    const database = databases[0]
    const noop = await transition(database, { target: '1.0.0' })
    const noopReplay = await transition(database, { target: '1.0.0' })
    expect(noop.transition.state).toBe('no_op')
    expect(noop.pointer.revision).toBe(1)
    expect(noopReplay).toMatchObject({ replayed: true, transition: { state: 'no_op' } })
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_pointer_transitions',
    )).rows[0]).toEqual({ count: 1 })
    await expect(transition(database, { target: '1.0.0', digest: HASH_B }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_REPLAY_CONFLICT')
    await expect(transition(database, { target: '2.0.0' }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_REPLAY_CONFLICT')
  })

  it('allows one concurrent CAS winner and rejects the stale contender', async () => {
    const database = databases[0]
    const outcomes = await Promise.allSettled([
      transition(database, { request: '51000000-0000-4000-8000-000000000001' }),
      transition(database, { request: '51000000-0000-4000-8000-000000000002' }),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
    expect(String((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason))
      .toContain('CURRICULUM_ACTIVATION_POINTER_CONFLICT')
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_pointer_transitions',
    )).rows[0]).toEqual({ count: 2 })
  })

  it('rolls back as a new revision and preserves releases, history, and learner pins', async () => {
    const database = databases[0]
    const learnerBefore = (await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]
    await transition(database, {})
    const rollback = await transition(database, {
      target: '1.0.0', expected: 2, kind: 'rollback',
      request: '52000000-0000-4000-8000-000000000002',
    })
    expect(rollback).toMatchObject({
      pointer: { releaseVersion: '1.0.0', revision: 3, transitionKind: 'rollback' },
      transition: {
        state: 'transitioned', transitionKind: 'rollback',
        previousReleaseVersion: '2.0.0', newReleaseVersion: '1.0.0',
      },
    })
    expect(rollback.history.map((entry: any) => [entry.pointerRevision, entry.transitionKind]))
      .toEqual([[3, 'rollback'], [2, 'activation'], [1, 'migration_seed']])
    expect((await database.query(
      'select count(*)::integer count from public.academy_curriculum_releases',
    )).rows[0]).toEqual({ count: 2 })
    expect((await database.query(
      "select data from public.profiles where profile_id = 'learner-one'",
    )).rows[0]).toEqual(learnerBefore)
  })

  it('rejects a stale success receipt after the pointer has advanced again', async () => {
    const database = databases[0]
    const activationRequest = '53000000-0000-4000-8000-000000000001'
    await transition(database, { request: activationRequest })
    await transition(database, {
      target: '1.0.0', expected: 2, kind: 'rollback',
      request: '53000000-0000-4000-8000-000000000002',
    })

    await expect(transition(database, { request: activationRequest }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_POINTER_CONFLICT')
    expect((await database.query<any>(`
      select release.version, pointer.revision
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({ version: '1.0.0', revision: 3 })
  })

  it('reauthorizes releases:manage in the DB and requires a current assignment', async () => {
    const database = databases[0]
    await expect(transition(database, { actor: ADMIN }))
      .rejects.toThrow('CURRICULUM_ACTIVATION_REQUIRED')
    await database.exec(`
      update public.academy_admin_role_assignments
      set status = 'revoked', revision = 2, revoked_at = statement_timestamp(),
          revoked_by = '${OWNER}', revoked_by_role = 'owner',
          revocation_reason_code = 'access.revoked',
          revocation_correlation_id = gen_random_uuid()
      where user_id = '${OWNER}';
    `)
    await expect(transition(database, {})).rejects.toThrow('CURRICULUM_ACTIVATION_REQUIRED')
    expect((await database.query(
      'select revision from public.academy_curriculum_active_pointers where environment = \'production\'',
    )).rows[0]).toEqual({ revision: 1 })
  })

  it('writes bounded audit metadata and keeps history/receipts append-only and private', async () => {
    const database = databases[0]
    const result = await transition(database, {})
    const event = (await database.query<any>(`
      select action, resource_type, resource_ref, resource_version,
        resource_revision, previous_value, new_value, reason_code, correlation_id
      from academy_private.admin_audit_events
      where action = 'release.activate'
    `)).rows[0]
    expect(event).toMatchObject({
      action: 'release.activate',
      resource_type: 'application_release',
      resource_ref: 'curriculum:production',
      resource_version: '2.0.0',
      resource_revision: '2',
      previous_value: { state: 'active', release: '1.0.0', revision: 1 },
      new_value: { state: 'active', release: '2.0.0', revision: 2, status: 'activation' },
      reason_code: 'release.activated',
      correlation_id: '50000000-0000-4000-8000-000000000001',
    })
    expect(JSON.stringify(event)).not.toMatch(/payload|lesson|assessment|profile/i)
    expect(result.history[0].correlationId).toBe(event.correlation_id)

    await expect(database.exec(`
      update public.academy_curriculum_active_pointers
      set revision = revision + 1
      where environment = 'production'
    `)).rejects.toThrow('governed forward transition')
    await expect(database.exec(`
      delete from public.academy_curriculum_active_pointers
      where environment = 'production'
    `)).rejects.toThrow('cannot be deleted')
    await expect(database.exec('delete from public.academy_curriculum_pointer_transitions'))
      .rejects.toThrow('append-only')
    await expect(database.exec('update public.academy_curriculum_pointer_transitions set revision = revision'))
      .rejects.toThrow('append-only')
    await expect(database.exec('update academy_private.curriculum_pointer_request_receipts set response = response'))
      .rejects.toThrow('append-only')
    for (const table of [
      'public.academy_curriculum_pointer_transitions',
      'academy_private.curriculum_pointer_request_receipts',
    ]) {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const privilege = await database.query<{ allowed: boolean }>(
          "select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') allowed",
          [role, table],
        )
        expect(privilege.rows[0].allowed, `${role}:${table}`).toBe(false)
      }
    }
  })

  it('rolls back pointer, history, audit, and receipt together on audit failure', async () => {
    const database = databases[0]
    await database.exec(`
      create function public.test_pointer_audit_failure()
      returns trigger language plpgsql as $$
      begin raise exception 'forced pointer audit failure'; end;
      $$;
      create trigger test_activation_audit_failure
      before insert on academy_private.admin_audit_events
      for each row when (new.action = 'release.activate')
      execute function public.test_pointer_audit_failure();
    `)
    await expect(transition(database, {
      request: '57000000-0000-4000-8000-000000000001',
    })).rejects.toThrow('forced pointer audit failure')
    expect((await database.query<any>(`
      select release.version, pointer.revision,
        (select count(*) from public.academy_curriculum_pointer_transitions)::integer as history_count,
        (select count(*) from academy_private.curriculum_pointer_request_receipts)::integer as receipt_count,
        (select count(*) from academy_private.admin_audit_events
          where action = 'release.activate')::integer as audit_count
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({
      version: '1.0.0', revision: 1, history_count: 1,
      receipt_count: 0, audit_count: 0,
    })

    await database.exec('drop trigger test_activation_audit_failure on academy_private.admin_audit_events')
    await transition(database, {
      request: '57000000-0000-4000-8000-000000000002',
    })
    await database.exec(`
      create trigger test_rollback_audit_failure
      before insert on academy_private.admin_audit_events
      for each row when (new.action = 'release.rollback')
      execute function public.test_pointer_audit_failure();
    `)
    await expect(transition(database, {
      target: '1.0.0', expected: 2, kind: 'rollback',
      request: '57000000-0000-4000-8000-000000000003',
    })).rejects.toThrow('forced pointer audit failure')
    expect((await database.query<any>(`
      select release.version, pointer.revision,
        (select count(*) from public.academy_curriculum_pointer_transitions)::integer as history_count,
        (select count(*) from academy_private.curriculum_pointer_request_receipts)::integer as receipt_count,
        (select count(*) from academy_private.admin_audit_events
          where action = 'release.rollback')::integer as rollback_audit_count
      from public.academy_curriculum_active_pointers as pointer
      join public.academy_curriculum_releases as release
        on release.release_id = pointer.release_id
      where pointer.environment = 'production'
    `)).rows[0]).toEqual({
      version: '2.0.0', revision: 2, history_count: 2,
      receipt_count: 1, rollback_audit_count: 0,
    })
  })

  it('pins the repository-only migration custody hash', async () => {
    const migrationBytes = await readFile(migrations.at(-1)!)
    const custody = JSON.parse(await readFile(
      new URL('../docs/admin-console/curriculum-activation-rollback-migration.json', import.meta.url),
      'utf8',
    ))
    expect(custody.status).toBe('repository-only-not-applied-hosted')
    expect(createHash('sha256').update(migrationBytes).digest('hex')).toBe(custody.sha256)
  })
})

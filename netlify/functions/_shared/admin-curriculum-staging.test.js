import { describe, expect, it, vi } from 'vitest'
import { importImmutableV1 } from '../../../src/curriculum-authoring/v2/v1Importer.node.ts'
import {
  buildCurriculumStagedCandidate,
  canonicalJson,
  createAdminCurriculumStagingPersistence,
} from './admin-curriculum-staging.js'
import { createAdminCurriculumStudioService } from './admin-curriculum-studio.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DRAFT = '10000000-0000-4000-8000-000000000001'
const VALIDATION = '20000000-0000-4000-8000-000000000001'
const APPROVAL = '30000000-0000-4000-8000-000000000001'
const REQUEST = '40000000-0000-4000-8000-000000000001'
const HASH = 'a'.repeat(64)

function approval() {
  return {
    schemaVersion: 1,
    draftId: DRAFT,
    draftRevision: 4,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    status: 'approved',
    latestValidation: {
      validationSnapshotId: VALIDATION,
      draftRevision: 4,
      engineVersion: 'curriculum-validation-v2',
      resultDigest: HASH,
      status: 'valid',
      publicationReady: true,
      blockingCount: 0,
      blockingErrorCount: 0,
      humanReviewBlockerCount: 0,
      validatedAt: '2026-08-10T12:00:00Z',
    },
    currentDecision: {
      approvalId: APPROVAL,
      draftRevision: 4,
      decision: 'approved',
      reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION,
      validationResultDigest: HASH,
      reviewerRole: 'owner',
      decidedAt: '2026-08-10T12:01:00Z',
      bindingStatus: 'current',
    },
    staleApproval: null,
    history: [],
    publishGate: {
      eligible: true,
      reason: 'approved',
      approvalId: APPROVAL,
      draftRevision: 4,
      validationSnapshotId: VALIDATION,
    },
  }
}

function status(candidate = null) {
  return {
    schemaVersion: 1,
    draftId: DRAFT,
    draftRevision: 4,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-rc.1',
    schemaSetVersion: '2.0.0',
    stageState: candidate ? 'staged' : 'eligible',
    eligible: !candidate,
    blockingReasons: [],
    validation: { status: 'valid', validationSnapshotId: VALIDATION },
    approval: { status: 'approved', approvalId: APPROVAL },
    candidate,
  }
}

describe('curriculum release staging materialization', () => {
  it('canonicalizes object keys and keeps hashes stable without operational timestamps', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}')
    const snapshot = {
      manifest: { status: 'draft', draft_version: '2.0.0-rc.1' },
      courses: [{ course_id: 'course:one', title: 'Stable' }],
      units: [], lessons: [], assessments: [], assessment_interpretations: [],
      schedules: [], standard_frameworks: [], resources: [], policy_sets: [],
    }
    const draft = {
      draftId: DRAFT, revision: 4, baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-rc.1', authoringSchemaVersion: '2.0.0',
    }
    const first = buildCurriculumStagedCandidate({ draft, snapshot, approval: approval() })
    const second = buildCurriculumStagedCandidate({ draft, snapshot: structuredClone(snapshot), approval: approval() })
    expect(second.contentHash).toBe(first.contentHash)
    expect(second.manifestHash).toBe(first.manifestHash)
    expect(second.packageHash).toBe(first.packageHash)
    expect(first.manifestCanonical).not.toMatch(/createdAt|stagedAt|2026-08-10T/)
    expect(first.manifest).toMatchObject({
      draft: { id: DRAFT, revision: 4 },
      validation: { id: VALIDATION, resultDigest: HASH },
      approval: { id: APPROVAL },
      fileCount: 10,
    })
  })

  it('materializes base + override + draft-created - tombstone into an isolated full snapshot', async () => {
    const immutable = importImmutableV1().draft
    const originalCourse = immutable.courses[0]
    const originalResourceCount = immutable.resources.length
    const override = { ...originalCourse, title: 'Approved staged title' }
    const created = {
      schema_set_version: '2.0.0',
      resource_id: 'draft-resource',
      kind: 'text',
      title: 'Draft-created resource',
      locator: 'draft-resource.txt',
      rights: 'Locally authored.',
      required: false,
      text_fallback: 'Readable fallback.',
    }
    const summaries = [
      { entityType: 'course', entityRef: originalCourse.course_id, origin: 'base_override', revision: 1, position: 0, tombstoned: false, digest: HASH },
      { entityType: 'media_resource', entityRef: created.resource_id, origin: 'draft_created', revision: 1, position: 99, tombstoned: false, digest: HASH },
      { entityType: 'media_resource', entityRef: immutable.resources[0].resource_id, origin: 'base_override', revision: 1, position: 0, tombstoned: true, digest: HASH },
    ]
    const details = new Map([
      [`course:${originalCourse.course_id}`, override],
      [`media_resource:${created.resource_id}`, created],
      [`media_resource:${immutable.resources[0].resource_id}`, immutable.resources[0]],
    ])
    const draft = {
      schemaVersion: 1, draftId: DRAFT, baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-rc.1', authoringSchemaVersion: '2.0.0',
      lifecycleState: 'draft', revision: 4, createdAt: '2026-08-10T12:00:00Z',
      updatedAt: '2026-08-10T12:00:00Z', entities: summaries,
    }
    const authoring = {
      read: vi.fn(async () => draft),
      readEntity: vi.fn(async (_actor, _draft, entityType, entityRef) => {
        const entity = summaries.find((summary) => summary.entityType === entityType && summary.entityRef === entityRef)
        return {
          schemaVersion: 1,
          draftId: DRAFT,
          ...entity,
          payload: details.get(`${entityType}:${entityRef}`),
        }
      }),
    }
    let staged
    const staging = {
      read: vi.fn(),
      stage: vi.fn(async (_actor, candidate) => {
        staged = candidate
        return { ...status(), replayed: false }
      }),
    }
    const service = createAdminCurriculumStudioService({
      authoring,
      approval: { read: vi.fn(async () => approval()) },
      staging,
    })
    await service.stageDraft(ACTOR, DRAFT, 4, REQUEST)
    const courses = JSON.parse(staged.artifacts.find((entry) => entry.relativePath === 'snapshot/courses.json').canonicalContent)
    const resources = JSON.parse(staged.artifacts.find((entry) => entry.relativePath === 'snapshot/resources.json').canonicalContent)
    expect(courses.find((course) => course.course_id === originalCourse.course_id).title).toBe('Approved staged title')
    expect(resources.some((resource) => resource.resource_id === 'draft-resource')).toBe(true)
    expect(resources.some((resource) => resource.resource_id === immutable.resources[0].resource_id)).toBe(false)
    expect(resources).toHaveLength(originalResourceCount)
    expect(immutable.courses[0].title).toBe(originalCourse.title)
    expect(immutable.resources).toHaveLength(originalResourceCount)
  })

  it('fails closed before materialization when the exact publish gate is not eligible', async () => {
    const blocked = approval()
    blocked.publishGate = { ...blocked.publishGate, eligible: false, reason: 'approval_stale' }
    const authoring = { read: vi.fn(), readEntity: vi.fn() }
    const service = createAdminCurriculumStudioService({
      authoring,
      approval: { read: vi.fn(async () => blocked) },
      staging: { read: vi.fn(), stage: vi.fn() },
    })
    await expect(service.stageDraft(ACTOR, DRAFT, 4, REQUEST)).rejects.toMatchObject({ code: 'gate-blocked' })
    expect(authoring.read).not.toHaveBeenCalled()
  })
})

describe('curriculum staging persistence boundary', () => {
  it('uses only narrow read/stage RPCs with exact capability markers', async () => {
    const stagedCandidate = {
      stagingId: REQUEST,
      status: 'staged', publicationStatus: 'not_published',
      validationSnapshotId: VALIDATION, approvalId: APPROVAL,
      entityCounts: { courses: 1 }, fileCount: 1, byteCount: 2,
      contentHash: HASH, manifestHash: HASH, packageHash: HASH,
      stagedAt: '2026-08-10T12:02:00Z', authority: 'curriculum:publish',
    }
    const rpc = vi.fn()
      .mockReturnValueOnce({ abortSignal: vi.fn().mockResolvedValue({ data: status(), error: null }) })
      .mockReturnValueOnce({ abortSignal: vi.fn().mockResolvedValue({ data: { ...status(stagedCandidate), replayed: false }, error: null }) })
    const persistence = createAdminCurriculumStagingPersistence({ client: { rpc } })
    await persistence.read(ACTOR, DRAFT)
    const candidateValue = {
      draftId: DRAFT, draftRevision: 4, validationSnapshotId: VALIDATION,
      approvalId: APPROVAL, manifest: { fileCount: 1 }, manifestCanonical: '{"fileCount":1}',
      artifacts: [{ relativePath: 'snapshot/manifest.json', byteCount: 2, sha256: HASH, canonicalContent: '{}' }],
      contentHash: HASH, manifestHash: HASH, packageHash: HASH,
    }
    await persistence.stage(ACTOR, candidateValue, REQUEST)
    expect(rpc.mock.calls[0]).toEqual(['academy_admin_read_curriculum_staging_v1', {
      p_actor_user_ref: ACTOR, p_draft_id: DRAFT, p_required_capability: 'curriculum:read',
    }])
    expect(rpc.mock.calls[1][0]).toBe('academy_admin_stage_curriculum_release_v1')
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_actor_user_ref: ACTOR,
      p_draft_id: DRAFT,
      p_draft_revision: 4,
      p_required_capability: 'curriculum:publish',
      p_manifest_canonical: '{"fileCount":1}',
      p_request_id: REQUEST,
    })
  })
})

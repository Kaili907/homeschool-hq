import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumPreviewService } from './admin-curriculum-preview.js'
import { createAdminCurriculumStudioService } from './admin-curriculum-studio.js'
import { adaptCurriculumPreview } from '../../../src/admin/curriculum-authoring/httpSource.ts'
import { buildCurriculumStandardsReviewQueue } from '../../../src/admin/curriculum-standards-review/model.ts'

const DRAFT_ID = '10000000-0000-4000-8000-000000000001'
const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function summary(entityType, entityRef, origin, position, tombstoned = false, revision = 1) {
  return {
    entityType, entityRef, origin, revision, position, tombstoned,
    digest: 'a'.repeat(64), createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z',
  }
}

function draft(entities, revision = 7) {
  return {
    schemaVersion: 1,
    draftId: DRAFT_ID,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-draft.1',
    authoringSchemaVersion: '2.0.0',
    lifecycleState: 'draft',
    revision,
    createdAt: '2026-08-10T12:00:00Z',
    updatedAt: '2026-08-10T12:00:00Z',
    entities,
  }
}

function fixture() {
  const base = createAdminCurriculumStudioService({ authoring: {} })
  const index = base.readBaseIndex('1.0.0')
  const pick = (entityType) => index.entities.find((entity) => entity.entityType === entityType)
  const courseEntry = pick('course')
  const unitEntry = pick('unit')
  const lessonEntry = pick('lesson')
  const assessmentEntry = pick('assessment')
  const course = base.readBaseEntity('1.0.0', 'course', courseEntry.entityRef).payload
  const lesson = base.readBaseEntity('1.0.0', 'lesson', lessonEntry.entityRef).payload
  const assessment = base.readBaseEntity('1.0.0', 'assessment', assessmentEntry.entityRef).payload
  const createdResource = {
    schema_set_version: '2.0.0', resource_id: 'draft-resource', kind: 'document',
    title: 'Draft handbook', locator: 'https://private.example/signed?secret=never-return',
    rights: 'Internal curriculum use.', required: false, text_fallback: 'Draft handbook text.',
  }
  const summaries = [
    summary('course', courseEntry.entityRef, 'base_override', courseEntry.position + 1, false, 2),
    summary('unit', unitEntry.entityRef, 'base_override', unitEntry.position, true, 2),
    summary('lesson', lessonEntry.entityRef, 'base_override', lessonEntry.position, false, 2),
    summary('assessment', assessmentEntry.entityRef, 'base_override', assessmentEntry.position, false, 2),
    summary('media_resource', createdResource.resource_id, 'draft_created', 99),
  ]
  const payloads = new Map([
    [`course:${courseEntry.entityRef}`, {
      ...course,
      title: `${course.title} — revised`,
      extensions: [
        ...(course.extensions ?? []),
        {
          namespace: 'manuel.academy/private', key: 'review_note', schema_ref: 'schema:review-note',
          projection: 'protected', value: { type: 'string', value: 'private note must never be returned' },
        },
      ],
    }],
    [`lesson:${lessonEntry.entityRef}`, lesson],
    [`assessment:${assessmentEntry.entityRef}`, {
      ...assessment,
      protected_interpretation_ref: 'interpretation:protected-new',
      prompts: assessment.prompts.map((prompt, index) => index === 0 ? { ...prompt, points: prompt.points + 1 } : prompt),
      total_points: assessment.total_points + 1,
    }],
    [`media_resource:${createdResource.resource_id}`, createdResource],
  ])
  const authoring = {
    read: vi.fn(async () => draft(summaries)),
    readEntity: vi.fn(async (_actor, _draftId, entityType, entityRef) => ({
      schemaVersion: 1,
      draftId: DRAFT_ID,
      ...summaries.find((entity) => entity.entityType === entityType && entity.entityRef === entityRef),
      payload: payloads.get(`${entityType}:${entityRef}`),
    })),
  }
  return { authoring, index, entries: { courseEntry, unitEntry, lessonEntry, assessmentEntry } }
}

describe('ADMIN-19 revision-bound curriculum preview service', () => {
  it('materializes base + overrides + created - tombstoned and classifies the exact candidate deterministically', async () => {
    const { authoring, index, entries } = fixture()
    const service = createAdminCurriculumPreviewService({ authoring })
    const first = await service.read(ACTOR, DRAFT_ID, 7)
    const second = await service.read(ACTOR, DRAFT_ID, 7)

    expect(first.authority).toMatchObject({
      draftId: DRAFT_ID,
      draftRevision: 7,
      baseReleaseVersion: '1.0.0',
      targetVersion: '2.0.0-draft.1',
      schemaSetVersion: '2.0.0',
    })
    expect(first.authority.candidateDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(second.authority.candidateDigest).toBe(first.authority.candidateDigest)
    expect(first.previewRef).toBe(second.previewRef)

    const byKey = new Map(first.entities.map((entity) => [`${entity.entityType}:${entity.entityRef}`, entity]))
    const baseOnly = index.entities.find((entity) => entity.entityType === 'course' && entity.entityRef !== entries.courseEntry.entityRef)
    expect(byKey.get(`course:${baseOnly.entityRef}`)).toMatchObject({ changeType: 'unchanged' })
    expect(byKey.get(`course:${entries.courseEntry.entityRef}`)).toMatchObject({ changeType: 'modified' })
    expect(byKey.get(`unit:${entries.unitEntry.entityRef}`)).toMatchObject({ changeType: 'removed' })
    expect(byKey.get(`lesson:${entries.lessonEntry.entityRef}`)).toMatchObject({ changeType: 'unchanged' })
    expect(byKey.get('media_resource:draft-resource')).toMatchObject({ changeType: 'added' })
    expect(first.entities.filter((entity) => entity.entityType === 'course' && entity.entityRef === entries.courseEntry.entityRef)).toHaveLength(1)

    expect(first.summary.baseEntities).toBe(index.entities.length)
    expect(first.summary.candidateEntities).toBe(index.entities.length)
    expect(first.summary.totalCompared).toBe(index.entities.length + 1)
    expect(first.summary).toMatchObject({ added: 1, modified: 2, removed: 1 })
    expect(first.summary.unchanged + first.summary.modified + first.summary.removed).toBe(first.summary.baseEntities)
    expect(first.summary.unchanged + first.summary.modified + first.summary.added).toBe(first.summary.candidateEntities)
    expect(adaptCurriculumPreview(first, DRAFT_ID, 7)).not.toBeNull()
  })

  it('returns structured meaningful fields while excluding private and protected payload values', async () => {
    const { authoring, entries } = fixture()
    const result = await createAdminCurriculumPreviewService({ authoring }).read(ACTOR, DRAFT_ID, 7)
    const course = result.entities.find((entity) => entity.entityType === 'course' && entity.entityRef === entries.courseEntry.entityRef)
    const assessment = result.entities.find((entity) => entity.entityType === 'assessment' && entity.entityRef === entries.assessmentEntry.entityRef)
    const resource = result.entities.find((entity) => entity.entityRef === 'draft-resource')

    expect(course.fieldChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'position', category: 'navigation' }),
      expect.objectContaining({ path: 'title', category: 'identity' }),
      expect.objectContaining({ path: 'protected_metadata', category: 'protected' }),
    ]))
    expect(assessment.fieldChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'prompts', category: 'assessment-structure' }),
      expect.objectContaining({ path: 'total_points', category: 'assessment-structure' }),
      expect.objectContaining({ path: 'protected_metadata', category: 'protected' }),
    ]))
    const promptChange = assessment.fieldChanges.find((change) => change.path === 'prompts')
    expect(promptChange.before.display).not.toBe(promptChange.after.display)
    expect(resource.fieldChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'protected_metadata' }),
    ]))
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('private note must never be returned')
    expect(serialized).not.toContain('secret=never-return')
    expect(serialized).not.toContain('interpretation:protected-new')
    expect(serialized).not.toContain('payload')
  })

  it('binds validation to the same revision and keeps unresolved Michigan PE standards publication-blocking', async () => {
    const { authoring } = fixture()
    const result = await createAdminCurriculumPreviewService({ authoring }).read(ACTOR, DRAFT_ID, 7)
    expect(result.validation.state).toBe('current')
    expect(result.validation.draftRevision).toBe(7)
    expect(result.validation.run.source.snapshotId).toBe(`${DRAFT_ID}@7`)
    expect(result.validation.run.publicationReady).toBe(false)
    expect(result.summary.standardsBlockers).toBeGreaterThan(0)
    expect(result.validation.run.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'standards.human_review_required', blocking: true }),
    ]))
  })

  it('uses the same exact approved mapping evidence as draft validation', async () => {
    const { authoring } = fixture()
    let decisions = []
    const standardsReview = { list: vi.fn(async () => ({ schemaVersion: 1, decisions })) }
    const studio = createAdminCurriculumStudioService({ authoring, standardsReview })
    const workspace = await studio.readStandardsReview(ACTOR, DRAFT_ID, 7)
    const queue = buildCurriculumStandardsReviewQueue(
      workspace.occurrences,
      { kind: 'draft', ref: DRAFT_ID },
      [],
    )
    decisions = queue.map((item) => ({
      schemaVersion: 1,
      reviewKey: item.reviewKey,
      contextKind: item.contextKind,
      contextRef: item.contextRef,
      sourceLabel: item.sourceLabel,
      grade: item.grade,
      courseRef: item.courseRef,
      findingRule: item.findingRule,
      affectedCount: item.affectedCount,
      findingIds: item.entities.map((entity) => entity.findingId),
      status: 'approved_mapping',
      canonicalStandardId: `canonical:${item.sourceLabel}`,
      frameworkVersion: 'MI-2026',
      canonicalTitle: item.sourceLabel,
      evidenceSource: 'Official state framework',
      reviewerNote: 'Verified for the exact finding set.',
      revision: 1,
      updatedAt: '2026-08-10T12:00:00Z',
    }))

    const result = await createAdminCurriculumPreviewService({ authoring, standardsReview })
      .read(ACTOR, DRAFT_ID, 7)
    expect(result.authority).toMatchObject({ draftId: DRAFT_ID, draftRevision: 7 })
    expect(result.summary.humanReviewBlockers).toBe(0)
    expect(result.validation.run.findings.some((finding) => (
      finding.rule === 'standards.human_review_required' && finding.blocking
    ))).toBe(false)
  })

  it('rejects a stale requested revision before entity reads and performs no mutation', async () => {
    const { authoring } = fixture()
    await expect(createAdminCurriculumPreviewService({ authoring }).read(ACTOR, DRAFT_ID, 6))
      .rejects.toMatchObject({ code: 'conflict' })
    expect(authoring.readEntity).not.toHaveBeenCalled()
    expect(Object.keys(authoring).sort()).toEqual(['read', 'readEntity'])
  })

  it('rejects a concurrent revision change during preview materialization', async () => {
    const { authoring } = fixture()
    authoring.read
      .mockResolvedValueOnce(draft((await authoring.read()).entities, 7))
      .mockResolvedValueOnce(draft([], 8))
    await expect(createAdminCurriculumPreviewService({ authoring }).read(ACTOR, DRAFT_ID, 7))
      .rejects.toMatchObject({ code: 'conflict' })
  })
})

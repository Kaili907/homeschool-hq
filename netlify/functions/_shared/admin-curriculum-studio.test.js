import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumStudioService } from './admin-curriculum-studio.js'

const DRAFT_ID = '10000000-0000-4000-8000-000000000001'

function detail(entities = [], revision = 1) {
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

function summary(entityType, entityRef, origin, position, tombstoned = false, revision = 1) {
  return {
    entityType, entityRef, origin, revision, position, tombstoned,
    digest: 'a'.repeat(64), createdAt: '2026-08-10T12:00:00Z', updatedAt: '2026-08-10T12:00:00Z',
  }
}

describe('Curriculum Studio materialization service', () => {
  it('exposes a stable, supported-class-only immutable index', () => {
    const service = createAdminCurriculumStudioService({ authoring: {} })
    const result = service.readBaseIndex('1.0.0')
    expect(result.entities).toHaveLength(30 + 232 + 2736 + 232 + 18)
    expect(new Set(result.entities.map((entity) => `${entity.entityType}:${entity.entityRef}`)).size)
      .toBe(result.entities.length)
    expect(new Set(result.entities.map((entity) => entity.entityType))).toEqual(new Set([
      'course', 'unit', 'lesson', 'assessment', 'media_resource',
    ]))
    expect(result.entities.some((entity) => entity.entityType === 'policy_set')).toBe(false)
    expect(result.resourceLibrary).toMatchObject({
      schemaVersion: 1,
      source: { origin: 'published-release', baseReleaseVersion: '1.0.0', draftId: null },
      totals: { resources: 18, active: 18, referenced: 0, unreferenced: 18 },
    })
    expect(result.resourceLibrary.items.every((item) => item.metadata?.schema_set_version === '2.0.0')).toBe(true)
  })

  it('composes base plus one override plus draft-created entities minus tombstones without duplication', async () => {
    const bootstrap = createAdminCurriculumStudioService({ authoring: {} })
    const index = bootstrap.readBaseIndex('1.0.0')
    const courseEntry = index.entities.find((entity) => entity.entityType === 'course')
    const unitEntry = index.entities.find((entity) => entity.entityType === 'unit')
    const course = bootstrap.readBaseEntity('1.0.0', 'course', courseEntry.entityRef).payload
    const courseSummary = summary('course', courseEntry.entityRef, 'base_override', courseEntry.position, false, 2)
    const unitSummary = summary('unit', unitEntry.entityRef, 'base_override', unitEntry.position, true, 2)
    const resourceSummary = summary('media_resource', 'draft-resource', 'draft_created', 99)
    const createdResource = {
      schema_set_version: '2.0.0', resource_id: 'draft-resource', kind: 'text',
      title: 'Draft-created resource', locator: 'draft-resource.txt', rights: 'Internal draft.',
      required: false, text_fallback: 'Draft-created text fallback.',
    }
    const entities = [courseSummary, unitSummary, resourceSummary]
    const authoring = {
      read: vi.fn(async () => detail(entities, 8)),
      readEntity: vi.fn(async (_actor, _draft, type, ref) => ({
        schemaVersion: 1, draftId: DRAFT_ID,
        ...(type === 'course' ? courseSummary : resourceSummary),
        payload: type === 'course' ? { ...course, title: 'Overridden course title' } : createdResource,
      })),
    }
    const service = createAdminCurriculumStudioService({ authoring })
    const result = await service.readMaterialization('actor', DRAFT_ID, 8)
    expect(result.entities.filter((entity) => entity.entityType === 'course' && entity.entityRef === courseEntry.entityRef)).toHaveLength(1)
    expect(result.entities.find((entity) => entity.entityRef === courseEntry.entityRef)).toMatchObject({
      origin: 'base_override', revision: 2, label: 'Overridden course title',
    })
    expect(result.entities.some((entity) => entity.entityType === 'unit' && entity.entityRef === unitEntry.entityRef)).toBe(false)
    expect(result.entities.find((entity) => entity.entityRef === 'draft-resource')).toMatchObject({
      origin: 'draft_created', label: 'Draft-created resource',
    })
    expect(authoring.readEntity).toHaveBeenCalledTimes(2)
  })

  it('binds validation to the exact draft revision and preserves Michigan PE human-review blockers', async () => {
    const authoring = { read: vi.fn(async () => detail([], 3)), readEntity: vi.fn() }
    const service = createAdminCurriculumStudioService({ authoring })
    const result = await service.validateDraft('actor', DRAFT_ID, 3)
    expect(result.draftRevision).toBe(3)
    expect(result.run.source.snapshotId).toBe(`${DRAFT_ID}@3`)
    expect(result.run.publicationReady).toBe(false)
    expect(result.run.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rule: 'standards.human_review_required', blocking: true,
        entity: expect.objectContaining({ id: expect.stringContaining('physical-education') }),
      }),
    ]))
  })

  it('projects exact-revision resource references, missing targets, and tombstoned resources without protected payload fields', async () => {
    const bootstrap = createAdminCurriculumStudioService({ authoring: {} })
    const index = bootstrap.readBaseIndex('1.0.0')
    const lessonEntry = index.entities.filter((entity) => entity.entityType === 'lesson')[17]
    const resourceEntry = index.entities.find((entity) => entity.entityType === 'media_resource')
    const lesson = bootstrap.readBaseEntity('1.0.0', 'lesson', lessonEntry.entityRef).payload
    const resource = bootstrap.readBaseEntity('1.0.0', 'media_resource', resourceEntry.entityRef).payload
    const lessonSummary = summary('lesson', lessonEntry.entityRef, 'base_override', lessonEntry.position, false, 2)
    const resourceSummary = summary('media_resource', resourceEntry.entityRef, 'base_override', resourceEntry.position, true, 2)
    const entities = [lessonSummary, resourceSummary]
    const authoring = {
      read: vi.fn(async () => detail(entities, 11)),
      readEntity: vi.fn(async (_actor, _draft, type) => ({
        schemaVersion: 1,
        draftId: DRAFT_ID,
        ...(type === 'lesson' ? lessonSummary : resourceSummary),
        payload: type === 'lesson'
          ? {
            ...lesson,
            resource_refs: [resourceEntry.entityRef, 'missing-resource'],
            scoring_guidance: 'protected guidance must not enter the library',
          }
          : { ...resource, private_note: 'not a Schema v2 media field' },
      })),
    }
    const service = createAdminCurriculumStudioService({ authoring })
    const result = await service.readMaterialization('actor', DRAFT_ID, 11)
    expect(result.resourceLibrary.source).toMatchObject({
      origin: 'draft', draftId: DRAFT_ID, draftRevision: 11,
    })
    const tombstoned = result.resourceLibrary.items.find((item) => item.resourceId === resourceEntry.entityRef)
    expect(tombstoned).toMatchObject({
      lifecycle: 'tombstoned', referenceStatus: 'tombstoned-but-referenced', validationStatus: 'invalid',
    })
    const missing = result.resourceLibrary.items.find((item) => item.resourceId === 'missing-resource')
    expect(missing).toMatchObject({
      lifecycle: 'missing', referenceStatus: 'missing-reference', validationStatus: 'invalid',
    })
    expect(tombstoned.validationFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'resources.reference_integrity', path: 'lessons[17].resource_refs[0]' }),
    ]))
    expect(missing.validationFindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ rule: 'resources.reference_integrity', path: 'lessons[17].resource_refs[1]' }),
    ]))
    const serialized = JSON.stringify(result.resourceLibrary)
    expect(serialized).not.toContain('protected guidance')
    expect(serialized).not.toContain('private_note')
    expect(authoring.readEntity).toHaveBeenCalledTimes(2)
  })

  it('rejects stale materialization before reading entity payloads', async () => {
    const authoring = { read: vi.fn(async () => detail([], 4)), readEntity: vi.fn() }
    const service = createAdminCurriculumStudioService({ authoring })
    await expect(service.readMaterialization('actor', DRAFT_ID, 3)).rejects.toMatchObject({ code: 'conflict' })
    expect(authoring.readEntity).not.toHaveBeenCalled()
  })
})

import { describe, expect, it } from 'vitest'
import type { CurriculumValidationFinding } from '../curriculum-validation/engine'
import {
  CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT,
  buildCurriculumResourceLibrary,
  filterCurriculumResourceLibrary,
  type CurriculumResourceAnalysisEntity,
} from './resourceLibraryModel'

function resource(resourceId: string, title = resourceId, kind = 'text') {
  return {
    schema_set_version: '2.0.0', resource_id: resourceId, kind,
    title, locator: `curriculum/${resourceId}`, rights: 'Locally authored.',
    required: false, text_fallback: `${title} fallback.`,
  }
}

function entity(
  entityType: CurriculumResourceAnalysisEntity['entityType'],
  entityRef: string,
  payload: unknown,
  options: Partial<Omit<CurriculumResourceAnalysisEntity, 'entityType' | 'entityRef' | 'payload'>> = {},
): CurriculumResourceAnalysisEntity {
  return {
    entityType, entityRef, payload, origin: 'base', revision: null,
    position: 0, tombstoned: false, ...options,
  }
}

function library(entities: readonly CurriculumResourceAnalysisEntity[], findings: readonly CurriculumValidationFinding[] = []) {
  return buildCurriculumResourceLibrary({
    origin: 'draft', baseReleaseVersion: '1.0.0', draftId: 'draft-id', draftRevision: 9,
    entities, validation: { findings },
  })
}

describe('Curriculum Resource Library analysis', () => {
  it('classifies published resources as referenced or orphaned and preserves only safe Schema v2 metadata', () => {
    const result = library([
      entity('media_resource', 'source-used', {
        ...resource('source-used', 'Used source'), private_note: 'do not expose', provider_token: 'secret',
      }),
      entity('media_resource', 'source-orphan', resource('source-orphan', 'Orphan source')),
      entity('lesson', 'lesson-one', {
        lesson_id: 'lesson-one', title: 'Lesson one', resource_refs: ['source-used'],
        scoring_guidance: 'protected-scoring-secret', student_work: 'learner-secret',
      }),
    ])
    expect(result.source).toMatchObject({ origin: 'draft', draftRevision: 9 })
    expect(result.totals).toMatchObject({ resources: 2, referenced: 1, unreferenced: 1, referenceOccurrences: 1 })
    expect(result.items.find((item) => item.resourceId === 'source-used')).toMatchObject({
      origin: 'base', lifecycle: 'active', referenceStatus: 'referenced',
      referenceCount: 1, referencingEntityCount: 1, validationStatus: 'valid',
    })
    expect(result.items.find((item) => item.resourceId === 'source-orphan')?.referenceStatus).toBe('unreferenced')
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('private_note')
    expect(serialized).not.toContain('provider_token')
    expect(serialized).not.toContain('protected-scoring-secret')
    expect(serialized).not.toContain('learner-secret')
  })

  it('tracks overrides, draft-created resources, tombstones, missing targets, and exact referencing entities', () => {
    const result = library([
      entity('media_resource', 'base-overridden', resource('base-overridden', 'Overridden'), {
        origin: 'base_override', revision: 3,
      }),
      entity('media_resource', 'draft-created', resource('draft-created', 'Draft-created'), {
        origin: 'draft_created', revision: 1, position: 1,
      }),
      entity('media_resource', 'removed-resource', resource('removed-resource', 'Removed'), {
        origin: 'base_override', revision: 2, position: 2, tombstoned: true,
      }),
      entity('lesson', 'lesson-one', {
        lesson_id: 'lesson-one', title: 'Referencing lesson', resource_refs: ['removed-resource', 'missing-resource'],
      }),
      entity('assessment', 'assessment-one', {
        assessment_id: 'assessment-one', title: 'Referencing assessment',
        prompts: [{ prompt_id: 'prompt-one', prompt: 'withheld', resource_refs: ['draft-created'] }],
      }),
    ])
    expect(result.totals).toMatchObject({
      resources: 3, active: 2, overridden: 2, draftCreated: 1, tombstoned: 1, missingReferences: 1,
    })
    expect(result.items.find((item) => item.resourceId === 'removed-resource')).toMatchObject({
      lifecycle: 'tombstoned', referenceStatus: 'tombstoned-but-referenced', validationStatus: 'invalid',
    })
    expect(result.items.find((item) => item.resourceId === 'missing-resource')).toMatchObject({
      lifecycle: 'missing', referenceStatus: 'missing-reference', validationStatus: 'invalid',
    })
    expect(result.items.find((item) => item.resourceId === 'draft-created')?.references[0]).toMatchObject({
      entityType: 'assessment', entityRef: 'assessment-one', promptRef: 'prompt-one',
      navigationId: 'assessment:assessment-one',
    })
    expect(JSON.stringify(result)).not.toContain('withheld')
  })

  it('identifies malformed and duplicate references without exposing an invalid raw value or silently repairing it', () => {
    const result = library([
      entity('media_resource', 'valid-resource', resource('valid-resource')),
      entity('lesson', 'lesson-invalid', {
        lesson_id: 'lesson-invalid', title: 'Invalid reference lesson',
        resource_refs: ['valid-resource', 'valid-resource', { secret: 'raw-invalid-secret' }],
      }),
    ])
    expect(result.totals.invalidReferences).toBe(2)
    expect(result.items.find((item) => item.resourceId === 'valid-resource')).toMatchObject({
      referenceStatus: 'invalid-reference', referenceCount: 2, validationStatus: 'invalid',
    })
    const invalid = result.items.find((item) => item.lifecycle === 'invalid')
    expect(invalid).toMatchObject({ resourceId: null, title: 'Invalid resource reference', referenceCount: 1 })
    expect(JSON.stringify(result)).not.toContain('raw-invalid-secret')
  })

  it('integrates existing validation findings by stable resource and reference paths', () => {
    const findings: readonly CurriculumValidationFinding[] = [{
      id: 'resource-finding', severity: 'error', category: 'accessibility',
      entity: { type: 'resource', id: 'image-resource' }, path: 'resources[0]',
      rule: 'accessibility.required_support', explanation: 'Image requires alternative text.', blocking: true,
    }, {
      id: 'reference-finding', severity: 'error', category: 'resources',
      entity: { type: 'lesson', id: 'lesson-one' }, path: 'lessons[0].resource_refs[0]',
      rule: 'resources.reference_integrity', explanation: 'Resource does not exist.', blocking: true,
    }]
    const result = library([
      entity('media_resource', 'image-resource', resource('image-resource', 'Image', 'image')),
      entity('lesson', 'lesson-one', { lesson_id: 'lesson-one', title: 'Lesson', resource_refs: ['missing-one'] }),
    ], findings)
    expect(result.items.find((item) => item.resourceId === 'image-resource')?.validationFindings.map((item) => item.id))
      .toEqual(['resource-finding'])
    expect(result.items.find((item) => item.resourceId === 'missing-one')?.validationFindings.map((item) => item.id))
      .toEqual(['reference-finding'])
  })

  it('searches and filters metadata/reference state while keeping every rendered page bounded', () => {
    const entities = Array.from({ length: 720 }, (_, index) => entity(
      'media_resource',
      `resource-${String(index).padStart(3, '0')}`,
      { ...resource(`resource-${String(index).padStart(3, '0')}`, `Resource ${index}`, index % 2 ? 'image' : 'text'), required: index % 3 === 0 },
      { origin: index % 5 === 0 ? 'draft_created' : 'base', revision: index % 5 === 0 ? 1 : null, position: index },
    ))
    const result = library(entities)
    const filtered = filterCurriculumResourceLibrary(result, {
      query: 'resource', kind: 'image', origin: 'all', status: 'unreferenced', requirement: 'required', validation: 'valid',
    })
    expect(filtered.total).toBeGreaterThan(CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT)
    expect(filtered.items).toHaveLength(CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT)
    expect(filtered.limited).toBe(true)
    expect(filtered.items.every((item) => item.kind === 'image' && item.required === true)).toBe(true)
    const nextPage = filterCurriculumResourceLibrary(result, { kind: 'all' }, 100, 100)
    expect(nextPage.items).toHaveLength(100)
    expect(nextPage.items[0]?.key).not.toBe(result.items[0]?.key)
  })
})

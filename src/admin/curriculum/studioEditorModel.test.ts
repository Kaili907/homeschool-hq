import { describe, expect, it } from 'vitest'
import type { Course, Lesson } from '../../curriculum-authoring/v2/contracts'
import {
  CURRICULUM_DRAFT_ENTITY_TYPES,
  validateCurriculumDraftEntity,
  type CurriculumStudioEntityIndexEntry,
} from '../curriculum-authoring/contracts'
import {
  authoringFieldOptions,
  createDraftEntityPayload,
  isProtectedAuthoringPath,
  updateAuthoringValue,
} from './studioEditorModel'

const entries: readonly CurriculumStudioEntityIndexEntry[] = [
  {
    entityType: 'course', entityRef: 'base-course', origin: 'base', revision: null, position: 0,
    parentId: 'grade:5', grade: 5, subject: 'mathematics', label: 'Base course', context: 'mathematics',
  },
  {
    entityType: 'unit', entityRef: 'base-unit', origin: 'base', revision: null, position: 0,
    parentId: 'course:base-course', grade: 5, subject: 'mathematics', courseRef: 'base-course',
    label: 'Base unit', context: 'one lesson',
  },
]

describe('Curriculum Studio structured editor model', () => {
  it('creates entity-local valid structured Schema v2 payloads for every supported class', () => {
    CURRICULUM_DRAFT_ENTITY_TYPES.forEach((entityType) => {
      const ref = `draft-${entityType.replace('_', '-')}`
      const payload = createDraftEntityPayload(entityType, ref, entries[1], entries)
      expect(validateCurriculumDraftEntity(entityType, ref, payload)).toMatchObject({ success: true })
      expect(JSON.stringify(payload)).not.toContain('official_standard_id')
    })
  })

  it('preserves unresolved standard ambiguity as human-review without inventing an official ID', () => {
    const payload = createDraftEntityPayload('lesson', 'draft-lesson', entries[1], entries) as Lesson
    const standard = payload.standards[0]
    expect(standard).toEqual(expect.objectContaining({ mapping_status: 'human-review' }))
    expect(standard).not.toHaveProperty('standard_id')
  })

  it('protects system identity/schema fields while exposing structured enum choices', () => {
    expect(isProtectedAuthoringPath(['schema_set_version'])).toBe(true)
    expect(isProtectedAuthoringPath(['lesson_id'])).toBe(true)
    expect(isProtectedAuthoringPath(['lesson_flow', 0, 'segment_id'])).toBe(true)
    expect(isProtectedAuthoringPath(['title'])).toBe(false)
    expect(authoringFieldOptions(['subject'])).toContain('physical-education')
    expect(authoringFieldOptions(['mapping_status'])).toEqual(['canonical', 'unverified', 'human-review'])
  })

  it('updates a structured leaf without mutating the saved payload', () => {
    const payload = createDraftEntityPayload('course', 'draft-course', null, entries) as Course
    const changed = updateAuthoringValue(payload, ['title'], 'Changed title') as Course
    expect(changed.title).toBe('Changed title')
    expect(payload.title).toBe('New course')
  })
})

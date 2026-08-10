import { describe, expect, it } from 'vitest'
import { createHumanStandardsReviewFinding } from '../curriculum-validation/engine'
import {
  KNOWN_STANDARDS_REVIEW_CONTEXT,
  knownAmbiguousStandardsCounts,
  knownCurriculumStandardsReviewOccurrences,
} from './knownEvidence'
import {
  buildCurriculumStandardsReviewQueue,
  collectCurriculumStandardsReviewOccurrences,
  filterCurriculumStandardsReviewQueue,
  groupCurriculumStandardsReviewQueue,
} from './model'

describe('curriculum standards review queue', () => {
  it('reuses the exact ADMIN-18 finding identity for Schema v2 draft occurrences', () => {
    const snapshot = {
      courses: [{
        course_id: 'course:pe-5', grade: 5,
        standards: [{ framework_ref: 'framework:legacy', legacy_label: '2', mapping_status: 'human-review' }],
      }],
      units: [], lessons: [], assessments: [],
    } as never
    const occurrence = collectCurriculumStandardsReviewOccurrences(snapshot)[0]
    const expected = createHumanStandardsReviewFinding({
      entity: { type: 'course', id: 'course:pe-5' }, path: 'courses[0].standards[0]', legacyLabel: '2',
    })
    expect(occurrence).toMatchObject({ sourceLabel: '2', grade: 5, courseRef: 'course:pe-5' })
    expect(occurrence.finding.id).toBe(expected.id)
  })

  it('projects exact repository evidence without inventing canonical standards facts', () => {
    const occurrences = knownCurriculumStandardsReviewOccurrences()
    expect(knownAmbiguousStandardsCounts()).toEqual({ '2': 154, '3': 84, '4': 182, '5': 238 })
    expect(occurrences).toHaveLength(658)
    expect(new Set(occurrences.map((item) => item.sourceLabel))).toEqual(new Set(['2', '3', '4', '5']))
    expect(JSON.stringify(occurrences)).not.toMatch(/canonicalStandardId|frameworkVersion|evidenceSource/)
  })

  it('groups unresolved findings by source label, grade, course, draft, and status', () => {
    const queue = buildCurriculumStandardsReviewQueue(
      knownCurriculumStandardsReviewOccurrences(), KNOWN_STANDARDS_REVIEW_CONTEXT,
    )
    expect(queue).toHaveLength(12)
    expect(queue.reduce((total, item) => total + item.affectedCount, 0)).toBe(658)
    expect(groupCurriculumStandardsReviewQueue(queue, 'source-label').map((group) => [group.key, group.affectedCount]))
      .toEqual([['2', 154], ['3', 84], ['4', 182], ['5', 238]])
    expect(groupCurriculumStandardsReviewQueue(queue, 'grade').map((group) => group.label))
      .toEqual(['Grade 5', 'Grade 7', 'Grade 8'])
    expect(groupCurriculumStandardsReviewQueue(queue, 'course')).toHaveLength(3)
    expect(groupCurriculumStandardsReviewQueue(queue, 'draft')).toHaveLength(1)
    expect(groupCurriculumStandardsReviewQueue(queue, 'affected-count').length).toBeGreaterThan(1)
    expect(groupCurriculumStandardsReviewQueue(queue, 'status')[0]).toMatchObject({ key: 'unreviewed', affectedCount: 658 })
  })

  it('filters across query, grade, course, and lifecycle status and exposes entity drill-down', () => {
    const candidates = buildCurriculumStandardsReviewQueue(
      knownCurriculumStandardsReviewOccurrences(), KNOWN_STANDARDS_REVIEW_CONTEXT,
    )
    const target = candidates.find((item) => item.sourceLabel === '2' && item.grade === 5)!
    const approved = {
      schemaVersion: 1 as const,
      ...target,
      findingIds: target.entities.map((entity) => entity.findingId),
      status: 'approved_mapping' as const,
      canonicalStandardId: 'human-verified-id',
      frameworkVersion: 'human-verified-version',
      canonicalTitle: 'Human verified title',
      evidenceSource: 'Verified source reference',
      reviewerNote: 'Evidence checked by reviewer.',
      revision: 1,
      updatedAt: '2026-08-10T12:00:00Z',
    }
    const queue = buildCurriculumStandardsReviewQueue(
      knownCurriculumStandardsReviewOccurrences(), KNOWN_STANDARDS_REVIEW_CONTEXT, [approved],
    )
    expect(filterCurriculumStandardsReviewQueue(queue, { status: 'approved_mapping' })).toHaveLength(1)
    expect(filterCurriculumStandardsReviewQueue(queue, { grade: 5, query: 'u01' }).length).toBeGreaterThan(0)
    expect(filterCurriculumStandardsReviewQueue(queue, { courseRef: 'ma-g7-physical-education' })).toHaveLength(4)
    expect(target.entities.some((entity) => entity.entityType === 'lesson')).toBe(true)
    expect(target.entities.some((entity) => entity.entityType === 'unit')).toBe(true)
    expect(target.entities.some((entity) => entity.entityType === 'assessment')).toBe(true)
  })

  it('ignores decisions whose exact finding set no longer matches the candidate', () => {
    const occurrence = {
      sourceLabel: '2', grade: 5, courseRef: 'course:pe-5',
      finding: createHumanStandardsReviewFinding({
        entity: { type: 'lesson', id: 'lesson:one' }, path: 'lessons[0].standards[0]', legacyLabel: '2',
      }),
    }
    const candidate = buildCurriculumStandardsReviewQueue([occurrence], { kind: 'draft', ref: 'draft:one' })[0]
    const stale = {
      schemaVersion: 1 as const, ...candidate, findingIds: ['cvf-0000000000000000'],
      status: 'approved_mapping' as const, canonicalStandardId: 'id', frameworkVersion: 'version',
      canonicalTitle: 'title', evidenceSource: 'source ref', reviewerNote: 'review note', revision: 1,
      updatedAt: '2026-08-10T12:00:00Z',
    }
    expect(buildCurriculumStandardsReviewQueue([occurrence], { kind: 'draft', ref: 'draft:one' }, [stale])[0].status)
      .toBe('unreviewed')
  })
})

import grade5UnitsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/units.json?raw'
import grade5AssessmentsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/physical-education/assessments.json?raw'
import grade7UnitsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/units.json?raw'
import grade7AssessmentsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/physical-education/assessments.json?raw'
import grade8UnitsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/units.json?raw'
import grade8AssessmentsText from '../../../curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/physical-education/assessments.json?raw'
import { createHumanStandardsReviewFinding } from '../curriculum-validation/engine'
import type { CurriculumStandardsReviewOccurrence } from './model'

export const KNOWN_STANDARDS_REVIEW_CONTEXT = Object.freeze({
  kind: 'published_release' as const,
  ref: '1.0.0',
})

export const KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS = Object.freeze(['2', '3', '4', '5'] as const)

interface LegacyStandardsEntity {
  readonly unit_id?: string
  readonly assessment_id?: string
  readonly course_id: string
  readonly grade: number
  readonly standards: readonly string[]
  readonly lesson_ids?: readonly string[]
}

function ambiguous(label: string): label is (typeof KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS)[number] {
  return KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS.includes(label as (typeof KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS)[number])
}

function parsedEntities(text: string): readonly LegacyStandardsEntity[] {
  const value = JSON.parse(text) as unknown
  if (!Array.isArray(value)) throw new Error('Known curriculum standards evidence is malformed.')
  return value as readonly LegacyStandardsEntity[]
}

function unitAndLessonOccurrences(
  text: string,
  grade: number,
  courseRef: string,
): CurriculumStandardsReviewOccurrence[] {
  return parsedEntities(text).flatMap((item) => {
    if (!item.unit_id || !item.lesson_ids) return []
    const unitId = item.unit_id
    const lessonIds = item.lesson_ids
    return item.standards.flatMap((sourceLabel, standardIndex) => {
      if (!ambiguous(sourceLabel)) return []
      const unit: CurriculumStandardsReviewOccurrence = {
        sourceLabel,
        grade,
        courseRef,
        finding: createHumanStandardsReviewFinding({
          entity: { type: 'unit', id: unitId },
          path: `units[${unitId}].standards[${standardIndex}]`,
          legacyLabel: sourceLabel,
        }),
      }
      const lessons = lessonIds.map((lessonId) => ({
        sourceLabel,
        grade,
        courseRef,
        finding: createHumanStandardsReviewFinding({
          entity: { type: 'lesson' as const, id: lessonId },
          path: `lessons[${lessonId}].standards[${standardIndex}]`,
          legacyLabel: sourceLabel,
        }),
      }))
      return [unit, ...lessons]
    })
  })
}

function entityOccurrences(
  text: string,
  entityType: 'unit' | 'assessment',
  grade: number,
  courseRef: string,
): CurriculumStandardsReviewOccurrence[] {
  return parsedEntities(text).flatMap((item) => {
    const entityRef = entityType === 'unit' ? item.unit_id : item.assessment_id
    if (!entityRef) return []
    return item.standards.flatMap((sourceLabel, standardIndex) => {
      if (!ambiguous(sourceLabel)) return []
      return [{
        sourceLabel,
        grade,
        courseRef,
        finding: createHumanStandardsReviewFinding({
          entity: { type: entityType, id: entityRef },
          path: `${entityType}s[${entityRef}].standards[${standardIndex}]`,
          legacyLabel: sourceLabel,
        }),
      }]
    })
  })
}

/** Repository evidence only. No canonical ID, wording, version, or URL is inferred. */
export function knownCurriculumStandardsReviewOccurrences(): readonly CurriculumStandardsReviewOccurrence[] {
  return Object.freeze([
    ...unitAndLessonOccurrences(grade5UnitsText, 5, 'ma-g5-physical-education'),
    ...entityOccurrences(grade5AssessmentsText, 'assessment', 5, 'ma-g5-physical-education'),
    ...unitAndLessonOccurrences(grade7UnitsText, 7, 'ma-g7-physical-education'),
    ...entityOccurrences(grade7AssessmentsText, 'assessment', 7, 'ma-g7-physical-education'),
    ...unitAndLessonOccurrences(grade8UnitsText, 8, 'ma-g8-physical-education'),
    ...entityOccurrences(grade8AssessmentsText, 'assessment', 8, 'ma-g8-physical-education'),
  ])
}

export function knownAmbiguousStandardsCounts(): Readonly<Record<string, number>> {
  const occurrences = knownCurriculumStandardsReviewOccurrences()
  return Object.freeze(Object.fromEntries(KNOWN_AMBIGUOUS_MICHIGAN_PE_LABELS.map((label) => [
    label,
    occurrences.filter((occurrence) => occurrence.sourceLabel === label).length,
  ])))
}

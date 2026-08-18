/**
 * ELA Production R3 — lesson document adapter.
 *
 * The authored artifact is the `.lesson.json` file under
 * `curriculum-production/final/english-language-arts/r3/lessons/`. That file is
 * the single source of truth for lesson content. This adapter lifts it into the
 * `ElaProductionLesson` record that `validateElaProductionLesson` checks, so the
 * contract gate runs against the shipped artifact rather than a TypeScript copy
 * of it.
 *
 * `passageWordCount` is read from the document's recorded metadata, never
 * recomputed from the body, so the validator's word-count check stays a real
 * comparison between what the document claims and what it delivers.
 */
import type { LearnerMaterialDto } from '../final-app/learner-response'
import { ELA_R3_GRADES } from './contract'
import type { ElaProductionGrade } from './contract'
import type { ElaProductionLesson, ElaProductionReadability } from './types'

export interface ElaProductionLessonDocument {
  readonly schemaVersion: number
  readonly namespace: string
  readonly productionMetadata: {
    readonly grade: number
    readonly courseRef: string
    readonly lessonRef: string
    readonly unitNumber: number
    readonly unitTitle: string
    readonly dayInUnit: number
    readonly courseDay: number
    readonly standards: readonly string[]
    readonly textType: string
    readonly topic: string
    readonly status: string
    readonly reading: { readonly title: string; readonly wordCount: number; readonly sha256: string }
    readonly readability: ElaProductionReadability
  }
  readonly learnerMaterial: LearnerMaterialDto
}

export function elaProductionLessonFromDocument(
  document: ElaProductionLessonDocument,
): ElaProductionLesson {
  const meta = document.productionMetadata
  if (!(ELA_R3_GRADES as readonly number[]).includes(meta.grade)) {
    throw new Error(`Lesson document declares unsupported grade ${meta.grade}.`)
  }
  const grade = meta.grade as ElaProductionGrade
  const sections = document.learnerMaterial.sections ?? []
  const guidedItemRef = sections.find((section) => section.sectionKind === 'guided-practice')?.items?.[0]?.itemRef ?? ''
  const independentItemRef = sections.find((section) => section.sectionKind === 'independent-practice')?.items?.[0]?.itemRef ?? ''
  const feedbackRefs = sections
    .filter((section) => (section.sectionKind ?? '').startsWith('remediation'))
    .map((section) => section.sectionRef ?? '')

  return Object.freeze({
    lessonId: meta.lessonRef,
    courseId: meta.courseRef,
    courseTitle: `Grade ${grade} English Language Arts`,
    grade,
    placement: Object.freeze({
      lessonId: meta.lessonRef,
      courseId: meta.courseRef,
      grade,
      unitNumber: meta.unitNumber,
      unitTitle: meta.unitTitle,
      dayInUnit: meta.dayInUnit,
      courseDay: meta.courseDay,
    }),
    topic: meta.topic,
    standards: Object.freeze([...meta.standards]),
    textType: meta.textType,
    passageTitle: meta.reading.title,
    passageWordCount: meta.reading.wordCount,
    responseTypes: Object.freeze(['CHOICE', 'CONSTRUCTED_RESPONSE', 'RUBRIC_REVIEW_PENDING'] as const),
    feedbackLinks: Object.freeze([
      Object.freeze({ responseItemRef: guidedItemRef, feedbackSectionRef: feedbackRefs[0] ?? '' }),
      Object.freeze({ responseItemRef: independentItemRef, feedbackSectionRef: feedbackRefs[1] ?? '' }),
    ]),
    readability: Object.freeze(meta.readability),
    reviewPresent: true,
    parentReviewRequired: true,
    material: document.learnerMaterial,
  })
}

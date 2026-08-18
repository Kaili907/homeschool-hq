import type { LearnerLessonReview, LearnerMaterialDto } from '../family-pilot/final-app/learner-response'

import waveManifest from '../../../curriculum-production/wave-1/science/grade-03/GRADE-3-SCIENCE-WAVE-1.manifest.json'
import grade3SeasonalPatterns from '../../../curriculum-production/wave-1/science/grade-03/lessons/ma-g3-science-u08-l03.lesson.json'

export const SCIENCE_R3_PREVIEW_PATH = '/curriculum-preview/science-r3'

export interface ScienceR3PreviewLesson {
  readonly lessonRef: string
  readonly grade: number
  readonly course: string
  readonly unitTitle: string
  readonly title: string
  readonly standards: readonly string[]
  readonly phase: string
  readonly courseDay: number
  readonly courseLessonCount: number
  readonly lessonPath: string
  readonly material: LearnerMaterialDto
}

const authoredMaterials = new Map<string, LearnerMaterialDto>([
  [grade3SeasonalPatterns.lessonRef, grade3SeasonalPatterns as unknown as LearnerMaterialDto],
])

function sectionBody(material: LearnerMaterialDto, title: RegExp): string | null {
  const body = material.sections?.find((section) => title.test(section.title))?.body?.trim()
  return body || null
}

function sentences(body: string): readonly string[] {
  return body.split(/(?<=\.)\s+/).map((sentence) => sentence.trim()).filter(Boolean)
}

/**
 * The frozen Science lesson schema carries `lessonReview` as a seven-key attestation block,
 * while the player consumes the `LearnerLessonReview` DTO. This projects one onto the other
 * from the lesson's own review sections. It is preview-only: where a production normalizer
 * belongs is Open question 1 in the Science R3 contract.
 */
function previewLessonReview(material: LearnerMaterialDto): LearnerLessonReview {
  const learned = sectionBody(material, /^WHAT YOU LEARNED$/)
  const progress = sectionBody(material, /^COURSE PROGRESS$/)
  const next = sectionBody(material, /^NEXT ACTION$/) ?? ''
  return Object.freeze({
    whatYouLearned: Object.freeze(learned ? sentences(learned) : [`You worked through ${material.title}.`]),
    courseProgress: progress ?? 'This preview does not change a course record.',
    nextAction: /waiting for parent/i.test(next)
      ? 'Waiting for Parent'
      : /continue/i.test(next)
        ? 'Continue required work'
        : 'Done for today',
    reviewActionLabel: 'Review this lesson',
  })
}

function previewLesson(lessonRef: string): ScienceR3PreviewLesson {
  const entry = waveManifest.lessons.find((lesson) => lesson.lessonRef === lessonRef)
  const unit = waveManifest.units.find((candidate) => candidate.unitNumber === entry?.unitNumber)
  const material = authoredMaterials.get(lessonRef)
  if (!entry?.lessonPath || !unit || !material) {
    throw new Error(`Science R3 preview lesson ${lessonRef} is not an authored Wave 1 lesson.`)
  }
  return Object.freeze({
    lessonRef,
    grade: waveManifest.grade,
    course: waveManifest.course,
    unitTitle: unit.unitTitle,
    title: entry.title,
    standards: Object.freeze([...entry.standards]),
    phase: entry.phase,
    courseDay: entry.courseDay,
    courseLessonCount: waveManifest.lessonCount,
    lessonPath: entry.lessonPath,
    material: Object.freeze({ ...material, lessonReview: previewLessonReview(material) }),
  })
}

/** Every lesson the Wave 1 manifest reports as authored, in canonical sequence order. */
export const SCIENCE_R3_PREVIEW_LESSONS: readonly ScienceR3PreviewLesson[] = Object.freeze(
  waveManifest.authoredLessonRefs.map(previewLesson),
)

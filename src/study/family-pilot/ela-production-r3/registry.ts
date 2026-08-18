/**
 * ELA Production R3 — authored-lesson registry.
 *
 * THIS REGISTRY IS INTENTIONALLY EMPTY.
 *
 * The R3 harness ships before any ELA lesson body is authored. Authoring waits
 * on the Mathematics reference lesson being reviewed in the real player and the
 * house style being confirmed; writing ELA lessons first risks a whole grade
 * band in a style that is then rejected.
 *
 * To add an authored lesson: build it with `buildElaProductionLesson`, add it
 * here, and the gate in `elaProductionR3.test.ts` validates it automatically.
 * Nothing else needs to change.
 */
import type { ElaProductionGrade } from './contract'
import type { ElaProductionFinding, ElaProductionLesson } from './types'
import { validateElaProductionLesson } from './validateElaProductionLesson'

export const ELA_PRODUCTION_R3_LESSONS: readonly ElaProductionLesson[] = Object.freeze([])

export function elaProductionR3LessonsForGrade(grade: ElaProductionGrade): readonly ElaProductionLesson[] {
  return ELA_PRODUCTION_R3_LESSONS.filter((lesson) => lesson.grade === grade)
}

/**
 * Whole-registry gate: per-lesson contract findings, plus the cross-lesson
 * checks a single lesson cannot see.
 *
 * Cross-lesson duplicate copy is an `error` because the freeze rule is explicit
 * that the approved samples "must not be ... replaced by a generic lesson
 * template", and identical copy across two lessons is that template. Whether
 * *near*-duplicate copy should also fail is undecided — see OPEN-QUESTIONS Q9.
 */
export function validateElaProductionR3Registry(): readonly ElaProductionFinding[] {
  const findings: ElaProductionFinding[] = []

  for (const lesson of ELA_PRODUCTION_R3_LESSONS) {
    const result = validateElaProductionLesson(lesson)
    findings.push(...result.errors, ...result.observations)
  }

  const seenLessonIds = new Set<string>()
  for (const lesson of ELA_PRODUCTION_R3_LESSONS) {
    if (seenLessonIds.has(lesson.lessonId)) {
      findings.push({
        severity: 'error',
        code: 'duplicate-lesson-id',
        derivedFrom: 'Canonical corpus identity: one package per lesson id',
        message: `Lesson id ${lesson.lessonId} is registered more than once.`,
        lessonId: lesson.lessonId,
      })
    }
    seenLessonIds.add(lesson.lessonId)
  }

  const copyOwners = new Map<string, string>()
  for (const lesson of ELA_PRODUCTION_R3_LESSONS) {
    const copy = (lesson.material.sections ?? []).flatMap((section) => [
      section.body,
      section.directions,
    ]).filter((value): value is string => Boolean(value?.trim())).map((value) => value.trim())
    for (const entry of copy) {
      const owner = copyOwners.get(entry)
      if (owner && owner !== lesson.lessonId) {
        findings.push({
          severity: 'error',
          code: 'cross-lesson-duplicate-copy',
          derivedFrom: 'DIRECTOR-SAMPLES-R2-APPROVED.md freeze rule: not "replaced by a generic lesson template"',
          message: `Instructional copy is identical to ${owner}.`,
          lessonId: lesson.lessonId,
        })
        continue
      }
      copyOwners.set(entry, lesson.lessonId)
    }
  }

  return Object.freeze(findings)
}

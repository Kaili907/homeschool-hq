import type {
  FamilyPilotCatalog,
  PilotCourseRef,
  PilotLessonRef,
  PilotStudentRef,
  PilotUnitRef,
} from '../../../curriculum/family-pilot/types'
import { getLesson } from '../../../curriculum/family-pilot/catalog'
import { adaptHostLessonToStudyPlan } from '../../curriculumAdapter'
import { calendarDraftForPlan } from '../../calendarAdapter'
import { deriveStudyHouseholdRef, deriveStudyLearnerRef } from '../../hostContext'
import type { StudyCalendarDraft, StudyLearnerScope, StudyLessonPlan } from '../../types'

/**
 * FAMILY-PILOT-CONTENT-BRIDGE-1 — translates the frozen Family Pilot
 * curriculum catalog into the existing Study Engine's lesson/plan/calendar
 * input shape. It never re-derives Study's own segment model: segments come
 * from the existing curriculumAdapter mapping. Full lesson bodies stay in
 * curriculum-content behind the existing production content pipeline
 * (src/study/contracts/production/content.ts) — this bridge only carries
 * catalog refs and display metadata (see curriculum/family-pilot/types.ts).
 */

export type PilotContentBlockedReason = 'lesson-not-found' | 'lesson-not-adaptable'

export interface PilotContentBlocked {
  readonly status: 'blocked'
  readonly reason: PilotContentBlockedReason
  readonly lessonRef: string
}

export interface PilotLessonReady {
  readonly status: 'ready'
  readonly lesson: PilotLessonRef
  readonly unit: PilotUnitRef
  readonly course: PilotCourseRef
}

export type PilotLessonResolution = PilotLessonReady | PilotContentBlocked

export interface PilotStudyPlanReady {
  readonly status: 'ready'
  readonly plan: StudyLessonPlan
  readonly lesson: PilotLessonRef
}

export type PilotStudyPlanResult = PilotStudyPlanReady | PilotContentBlocked

export interface PilotCalendarDraftReady {
  readonly status: 'ready'
  readonly draft: StudyCalendarDraft
}

export type PilotCalendarDraftResult = PilotCalendarDraftReady | PilotContentBlocked

function blocked(lessonRef: string, reason: PilotContentBlockedReason): PilotContentBlocked {
  return { status: 'blocked', reason, lessonRef }
}

/** Resolves a catalog lessonRef to its lesson/unit/course identity, or a
 * blocked result when the ref (or its supporting unit/course) is not in the
 * frozen catalog. Only ever reads refs and display metadata — never the
 * lesson body. */
export function resolvePilotLessonContent(
  catalog: FamilyPilotCatalog,
  lessonRef: string,
): PilotLessonResolution {
  const lesson = getLesson(catalog, lessonRef)
  if (!lesson) return blocked(lessonRef, 'lesson-not-found')
  const course = catalog.courses.find((candidate) => candidate.courseId === lesson.courseId)
  const unit = course?.units.find((candidate) => candidate.unitId === lesson.unitId)
  if (!course || !unit) return blocked(lessonRef, 'lesson-not-found')
  return { status: 'ready', lesson, unit, course }
}

const FAMILY_PILOT_STUDY_KIND = 'math' as const

/** Adapts a single catalog lesson into the Study Engine's own lesson/plan
 * model via the existing curriculumAdapter. Returns a blocked result instead
 * of throwing when the lesson can't be opened by Study. */
export function buildPilotStudyPlan(
  catalog: FamilyPilotCatalog,
  lessonRef: string,
): PilotStudyPlanResult {
  const resolution = resolvePilotLessonContent(catalog, lessonRef)
  if (resolution.status === 'blocked') return resolution
  try {
    const plan = adaptHostLessonToStudyPlan({
      lessonRef: resolution.lesson.lessonId,
      title: resolution.lesson.title,
      kind: FAMILY_PILOT_STUDY_KIND,
      skillRefs: [resolution.lesson.lessonId],
    })
    return { status: 'ready', plan, lesson: resolution.lesson }
  } catch {
    return blocked(lessonRef, 'lesson-not-adaptable')
  }
}

/** Confirms a catalog lesson can actually be opened by the existing Study
 * Engine — the PILOT_BLOCKER check callers should run before presenting a
 * lesson as available. */
export function validatePilotLessonForStudy(
  catalog: FamilyPilotCatalog,
  lessonRef: string,
): PilotLessonResolution {
  const result = buildPilotStudyPlan(catalog, lessonRef)
  return result.status === 'blocked' ? result : resolvePilotLessonContent(catalog, lessonRef)
}

function pilotLearnerScope(student: PilotStudentRef): StudyLearnerScope {
  return {
    householdRef: deriveStudyHouseholdRef(student.studentRef),
    learnerRef: deriveStudyLearnerRef(student.studentRef, student.studentRef),
  }
}

/** Builds a calendar draft for one student/lesson pair via the existing
 * calendarAdapter. Assignment policy (e.g. whether a lesson's grade matches
 * the student's grade) belongs to the host, not this content bridge. */
export function buildPilotCalendarDraft(
  catalog: FamilyPilotCatalog,
  student: PilotStudentRef,
  lessonRef: string,
  options: {
    readonly householdTimeZone: string
    readonly instant: Date
    readonly timerHidden: boolean
  },
): PilotCalendarDraftResult {
  const built = buildPilotStudyPlan(catalog, lessonRef)
  if (built.status === 'blocked') return built
  const draft = calendarDraftForPlan({
    scope: pilotLearnerScope(student),
    plan: built.plan,
    householdTimeZone: options.householdTimeZone,
    instant: options.instant,
    timerHidden: options.timerHidden,
  })
  return { status: 'ready', draft }
}

import type { AcademyGrade, Profile, SchoolYear } from '../../../types'
import { isoToday } from '../../../appState'
import {
  buildCalendar,
  calendarWeekIndex,
  derivedScopeWeek,
  isSchoolYearConfigured,
  isTravelWeek,
} from '../../../curriculum/pacing'
import type { AcademyRoute } from '../../../academy/academyRoute'
import { isStaleAttempt } from '../../../academy/academyState'
import type { AcademyCatalog, AcademyCatalogCourse, AcademySchedule } from '../../../academy/contentTypes'

export type DashboardLessonStatus = 'complete' | 'in-progress' | 'not-started' | 'ready-to-retry'
export type DashboardCalendarState =
  | 'normal-weekday'
  | 'weekend'
  | 'unconfigured'
  | 'before-year'
  | 'off-week'
  | 'after-year'

export interface DashboardLesson {
  lessonId: string
  title: string
  course: AcademyCatalogCourse | null
  unitNumber: number | null
  level: AcademyGrade | null
  status: DashboardLessonStatus
  requiresRestart: boolean
}

export interface StudentDashboardData {
  week: number
  schoolYearConfigured: boolean
  calendarState: DashboardCalendarState
  lessons: DashboardLesson[]
  completedCount: number
  hasScheduledWork: boolean
  allWorkComplete: boolean
  upNext: DashboardLesson | null
  restartRequiredLesson: DashboardLesson | null
}

function statusFor(profile: Profile, lessonId: string): DashboardLessonStatus {
  const status = profile.academy?.lessons[lessonId]?.status
  if (status === 'complete') return 'complete'
  if (status === 'in-progress') return 'in-progress'
  if (status === 'reteach') return 'ready-to-retry'
  return 'not-started'
}

function findLesson(catalog: AcademyCatalog, lessonId: string) {
  for (const course of catalog.courses) {
    for (const unit of course.units) {
      if (unit.lessonIds.includes(lessonId)) return { course, unitNumber: unit.unitNumber }
    }
  }
  return null
}

/** Labels/explanations only; lesson selection remains in the existing block below. */
function calendarStateFor(
  schoolYear: SchoolYear | undefined,
  today: string,
  dayOfWeek: number,
): DashboardCalendarState {
  if (!isSchoolYearConfigured(schoolYear)) return 'unconfigured'
  const calendarWeek = calendarWeekIndex(schoolYear, today)
  if (calendarWeek < 0) return 'before-year'
  const finalCalendarWeek = buildCalendar(schoolYear).length - 1
  if (calendarWeek > finalCalendarWeek) return 'after-year'
  if (isTravelWeek(schoolYear, today)) return 'off-week'
  if (dayOfWeek === 0 || dayOfWeek === 6) return 'weekend'
  return 'normal-weekday'
}

/** Presentation-only view of the existing schedule and lesson-state authority. */
export function buildStudentDashboardData({
  profile,
  catalog,
  schedule,
  levelOf,
  schoolYear,
  today = isoToday(),
}: {
  profile: Profile
  catalog: AcademyCatalog
  schedule: AcademySchedule
  levelOf: Record<string, AcademyGrade>
  schoolYear: SchoolYear | undefined
  today?: string
}): StudentDashboardData {
  const schoolYearConfigured = isSchoolYearConfigured(schoolYear)
  const week = schoolYearConfigured ? derivedScopeWeek(schoolYear, today) : 1
  const dayOfWeek = new Date(`${today}T12:00:00`).getDay()
  const calendarState = calendarStateFor(schoolYear, today, dayOfWeek)
  const day = dayOfWeek >= 1 && dayOfWeek <= 5
    ? schedule.days.find((item) => item.week === week && item.day === dayOfWeek)
    : undefined
  const lessons = (day?.lessons ?? []).map(({ lessonId, title }) => {
    const location = findLesson(catalog, lessonId)
    const status = statusFor(profile, lessonId)
    return {
      lessonId,
      title,
      course: location?.course ?? null,
      unitNumber: location?.unitNumber ?? null,
      level: location ? levelOf[location.course.courseId] ?? null : null,
      status,
      requiresRestart: status !== 'complete' && isStaleAttempt(profile, lessonId),
    }
  })
  const completedCount = lessons.filter((lesson) => lesson.status === 'complete').length
  // Preserve today's schedule order inside each canonical priority group.
  const upNext = lessons.find((lesson) => lesson.status === 'in-progress' && !lesson.requiresRestart)
    ?? lessons.find((lesson) => lesson.status === 'not-started' || lesson.status === 'ready-to-retry')
    ?? null
  const restartRequiredLesson = lessons.find(
    (lesson) => lesson.status === 'in-progress' && lesson.requiresRestart,
  ) ?? null

  return {
    week,
    schoolYearConfigured,
    calendarState,
    lessons,
    completedCount,
    hasScheduledWork: lessons.length > 0,
    allWorkComplete: lessons.length > 0 && completedCount === lessons.length,
    upNext,
    restartRequiredLesson,
  }
}

/** Existing Academy routing remains the only route authority for a lesson. */
export function dashboardLessonRoute(lesson: DashboardLesson): AcademyRoute | null {
  if (!lesson.course || lesson.unitNumber === null) return null
  return {
    kind: 'lesson',
    courseId: lesson.course.courseId,
    unitNumber: lesson.unitNumber,
    lessonId: lesson.lessonId,
  }
}

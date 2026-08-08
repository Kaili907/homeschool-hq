import type { AcademyGrade, Profile, SchoolYear } from '../../../types'
import { isoToday } from '../../../appState'
import { derivedScopeWeek, isSchoolYearConfigured } from '../../../curriculum/pacing'
import type { AcademyRoute } from '../../../academy/academyRoute'
import type { AcademyCatalog, AcademyCatalogCourse, AcademySchedule } from '../../../academy/contentTypes'

export type DashboardLessonStatus = 'complete' | 'in-progress' | 'not-started' | 'ready-to-revisit'

export interface DashboardLesson {
  lessonId: string
  title: string
  course: AcademyCatalogCourse | null
  unitNumber: number | null
  level: AcademyGrade | null
  status: DashboardLessonStatus
}

export interface StudentDashboardData {
  week: number
  schoolYearConfigured: boolean
  lessons: DashboardLesson[]
  completedCount: number
  hasScheduledWork: boolean
  allWorkComplete: boolean
  upNext: DashboardLesson | null
}

function statusFor(profile: Profile, lessonId: string): DashboardLessonStatus {
  const status = profile.academy?.lessons[lessonId]?.status
  if (status === 'complete') return 'complete'
  if (status === 'in-progress') return 'in-progress'
  if (status === 'reteach') return 'ready-to-revisit'
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
  const day = dayOfWeek >= 1 && dayOfWeek <= 5
    ? schedule.days.find((item) => item.week === week && item.day === dayOfWeek)
    : undefined
  const lessons = (day?.lessons ?? []).map(({ lessonId, title }) => {
    const location = findLesson(catalog, lessonId)
    return {
      lessonId,
      title,
      course: location?.course ?? null,
      unitNumber: location?.unitNumber ?? null,
      level: location ? levelOf[location.course.courseId] ?? null : null,
      status: statusFor(profile, lessonId),
    }
  })
  const completedCount = lessons.filter((lesson) => lesson.status === 'complete').length
  // Existing in-progress attempts are intentionally preferred over later untouched work.
  const upNext = lessons.find((lesson) => lesson.status === 'in-progress')
    ?? lessons.find((lesson) => lesson.status !== 'complete')
    ?? null

  return {
    week,
    schoolYearConfigured,
    lessons,
    completedCount,
    hasScheduledWork: lessons.length > 0,
    allWorkComplete: lessons.length > 0 && completedCount === lessons.length,
    upNext,
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

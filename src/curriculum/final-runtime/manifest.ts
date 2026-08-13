import type { AdmittedRelease, SupportedSubject } from '../release-admission/types.ts'
import { ADMITTED_RELEASE } from '../release-admission/types.ts'
import { isFinalCurriculumGrade } from './grades.ts'
import type {
  FinalCatalogCourse,
  FinalCatalogSchedule,
  FinalCatalogUnit,
  FinalCurriculumGrade,
  FinalRuntimeManifest,
} from './types.ts'

function admitted(release: AdmittedRelease): void {
  if (release?.[ADMITTED_RELEASE] !== true) {
    throw new Error('final-runtime: release was not admitted by admitCandidate')
  }
}

function grade(value: number, ref: string): FinalCurriculumGrade {
  if (!isFinalCurriculumGrade(value)) {
    throw new Error(`final-runtime: ${ref} has unsupported Grade ${value}`)
  }
  return value
}

function subject(value: string): SupportedSubject {
  return value as SupportedSubject
}

/**
 * Extracts only the eager browser index. Lesson bodies remain behind the
 * caller-supplied per-course loaders and are never retained by this manifest.
 */
export function buildFinalRuntimeManifest(release: AdmittedRelease): FinalRuntimeManifest {
  admitted(release)
  const set = release.candidate.authoring_set
  const unitsByCourse = new Map<string, typeof set.units>()
  for (const course of set.courses) {
    unitsByCourse.set(
      course.course_id,
      Object.freeze(
        set.units
          .filter((unit) => unit.course_ref === course.course_id)
          .sort((left, right) => left.order - right.order),
      ),
    )
  }

  const courses: FinalCatalogCourse[] = [...set.courses]
    .sort((left, right) =>
      left.grade - right.grade || left.order - right.order ||
      left.course_id.localeCompare(right.course_id),
    )
    .map((course) => {
      const units = unitsByCourse.get(course.course_id) ?? []
      return Object.freeze({
        courseRef: course.course_id,
        grade: grade(course.grade, course.course_id),
        subject: subject(course.subject),
        title: course.title,
        days: course.days,
        unitCount: units.length,
        lessonCount: units.reduce((count, unit) => count + unit.lesson_refs.length, 0),
      })
    })

  const units: FinalCatalogUnit[] = set.units
    .map((unit) => Object.freeze({
      unitRef: unit.unit_id,
      courseRef: unit.course_ref,
      grade: grade(unit.grade, unit.unit_id),
      subject: subject(unit.subject),
      unitNumber: unit.order,
      title: unit.title,
      days: unit.days,
      essentialQuestion: unit.essential_question,
      assessmentRef: unit.assessment_ref ?? null,
      lessonRefs: Object.freeze([...unit.lesson_refs]),
    }))
    .sort((left, right) =>
      left.grade - right.grade || left.courseRef.localeCompare(right.courseRef) ||
      left.unitNumber - right.unitNumber,
    )

  const schedules: FinalCatalogSchedule[] = set.schedules
    .map((schedule) => Object.freeze({
      scheduleRef: schedule.schedule_id,
      grade: grade(schedule.grade, schedule.schedule_id),
      weeks: schedule.weeks,
      instructionalDays: schedule.instructional_days,
      entries: Object.freeze(schedule.entries.map((entry) => Object.freeze({
        week: entry.week,
        day: entry.day,
        lessonRefs: Object.freeze([...entry.lesson_refs]),
      }))),
    }))
    .sort((left, right) =>
      left.grade - right.grade || left.scheduleRef.localeCompare(right.scheduleRef),
    )

  return Object.freeze({
    releaseVersion: release.candidate.release_version,
    courses: Object.freeze(courses),
    units: Object.freeze(units),
    schedules: Object.freeze(schedules),
  })
}

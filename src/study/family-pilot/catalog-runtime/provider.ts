import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import type {
  CatalogCourse,
  CatalogLesson,
  CatalogUnit,
  CourseRef,
  FamilyPilotCatalogProvider,
  LessonRef,
  UnitRef,
} from './types'
import type { CourseLessonLoader } from './loaders'
import { COURSE_LESSON_LOADERS } from './loaders'
import { COURSES, RELEASE_VERSION, UNITS } from './generated/index'

/**
 * FF-M11 — the browser-safe catalog provider.
 *
 * Nothing here touches node:fs, a filesystem path, or the network beyond the
 * app's own hashed chunks: the eager course/unit index is imported statically,
 * and each course's lessons arrive through a static import() that Vite splits
 * into its own chunk. Reading the built curriculum therefore needs no server,
 * no localhost, and no fetch of an unversioned public/ path.
 */

export interface CatalogProviderSource {
  readonly releaseVersion: string
  readonly courses: readonly CatalogCourse[]
  readonly units: readonly CatalogUnit[]
  readonly loaders: Readonly<Record<CourseRef, CourseLessonLoader>>
}

const GRADE_ORDER: readonly AcademyGrade[] = ['5', '7', '8']

const EMPTY_UNITS: readonly CatalogUnit[] = Object.freeze([])
const EMPTY_LESSONS: readonly CatalogLesson[] = Object.freeze([])

export function createCatalogProvider(source: CatalogProviderSource): FamilyPilotCatalogProvider {
  // Frozen copies: a caller that sorts or splices a returned array must not be
  // able to reorder the catalog for everyone else.
  const allCourses: readonly CatalogCourse[] = Object.freeze([...source.courses])
  const courseByRef = new Map(allCourses.map((course) => [course.courseRef, course]))
  const unitByRef = new Map(source.units.map((unit) => [unit.unitRef, unit]))

  const mutableUnitsByCourse = new Map<CourseRef, CatalogUnit[]>()
  for (const unit of source.units) {
    const bucket = mutableUnitsByCourse.get(unit.courseRef)
    if (bucket) bucket.push(unit)
    else mutableUnitsByCourse.set(unit.courseRef, [unit])
  }
  const unitsByCourse = new Map<CourseRef, readonly CatalogUnit[]>()
  for (const [courseRef, bucket] of mutableUnitsByCourse) {
    bucket.sort((a, b) => a.unitNumber - b.unitNumber)
    unitsByCourse.set(courseRef, Object.freeze(bucket))
  }

  // lessonRef -> owning unit, so getLesson loads exactly one course's payload.
  // Built once, from the eager index, on the first lesson lookup — grade,
  // subject, and course listings never pay for it.
  let unitByLessonRef: Map<LessonRef, CatalogUnit> | undefined
  const lessonIndex = (): Map<LessonRef, CatalogUnit> => {
    if (!unitByLessonRef) {
      unitByLessonRef = new Map()
      for (const unit of source.units) {
        for (const lessonRef of unit.lessonRefs) unitByLessonRef.set(lessonRef, unit)
      }
    }
    return unitByLessonRef
  }

  // One in-flight promise per course, so concurrent readers share a single load.
  const loaded = new Map<CourseRef, Promise<readonly CatalogLesson[]>>()

  const loadCourseLessons = (courseRef: CourseRef): Promise<readonly CatalogLesson[]> => {
    const cached = loaded.get(courseRef)
    if (cached) return cached
    const course = courseByRef.get(courseRef)
    // An unknown ref is a legitimate miss. A course the index knows about but
    // whose payload is unreachable is the partial catalog this module exists to
    // prevent, so it fails loudly instead of reading as an empty course.
    if (!course) return Promise.resolve(EMPTY_LESSONS)
    const loader = source.loaders[courseRef]
    if (!loader) {
      return Promise.reject(
        new Error(`catalog-runtime: ${courseRef} is in the index but has no lesson payload loader`),
      )
    }

    const unitRefByNumber = new Map(
      (unitsByCourse.get(courseRef) ?? []).map((unit) => [unit.unitNumber, unit.unitRef]),
    )
    const pending = loader()
      .then((module) =>
        Object.freeze(module.default.map((row): CatalogLesson => {
          const unitRef = unitRefByNumber.get(row.unitNumber)
          if (!unitRef) {
            throw new Error(
              `catalog-runtime: ${row.lessonRef} references unit ${row.unitNumber}, absent from the ${courseRef} index`,
            )
          }
          return {
            lessonRef: row.lessonRef,
            courseRef,
            unitRef,
            grade: course.grade,
            subject: course.subject,
            unitNumber: row.unitNumber,
            dayInUnit: row.dayInUnit,
            courseDay: row.courseDay,
            title: row.title,
            estimatedMinutes: row.estimatedMinutes,
          }
        })),
      )
      .catch((cause: unknown) => {
        // A failed chunk must not poison the cache — the next read retries.
        loaded.delete(courseRef)
        throw cause
      })
    loaded.set(courseRef, pending)
    return pending
  }

  return {
    releaseVersion: source.releaseVersion,

    listGrades: () => GRADE_ORDER.filter((grade) => allCourses.some((c) => c.grade === grade)),

    listSubjects: (grade) => {
      const present = new Set(allCourses.filter((c) => c.grade === grade).map((c) => c.subject))
      return ACADEMY_SUBJECTS.filter((subject: AcademySubject) => present.has(subject))
    },

    listCourses: (grade) =>
      grade === undefined ? allCourses : allCourses.filter((course) => course.grade === grade),

    getCourse: (courseRef: CourseRef) => courseByRef.get(courseRef),

    listUnits: (courseRef: CourseRef) => unitsByCourse.get(courseRef) ?? EMPTY_UNITS,

    getUnit: (unitRef: UnitRef) => unitByRef.get(unitRef),

    listLessons: (courseRef: CourseRef) => loadCourseLessons(courseRef),

    getLesson: async (lessonRef: LessonRef) => {
      const unit = lessonIndex().get(lessonRef)
      if (!unit) return undefined
      const lessons = await loadCourseLessons(unit.courseRef)
      return lessons.find((lesson) => lesson.lessonRef === lessonRef)
    },
  }
}

/** The release the app ships. Built from the generated index; no I/O at import. */
export const familyPilotCatalog: FamilyPilotCatalogProvider = createCatalogProvider({
  releaseVersion: RELEASE_VERSION,
  courses: COURSES,
  units: UNITS,
  loaders: COURSE_LESSON_LOADERS,
})

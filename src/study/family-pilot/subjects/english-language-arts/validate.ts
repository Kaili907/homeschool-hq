import { adaptElaLessonToStudy } from './adapter'
import { ElaContentError } from './source.node'
import type { AcademyGrade } from '../../../../types'
import type { ElaCatalog } from './types'

const EXPECTED_GRADES: readonly AcademyGrade[] = ['5', '7', '8']
const EXPECTED_LESSONS_PER_GRADE = 180
const EXPECTED_UNITS_PER_GRADE = 10

export interface ElaValidationReport {
  readonly releaseVersion: string
  readonly lessonsByGrade: Readonly<Record<AcademyGrade, number>>
  readonly unitsByGrade: Readonly<Record<AcademyGrade, number>>
  readonly totalLessons: number
}

/**
 * FAMILY-PILOT-SUBJECT-ELA — a fail-closed, exhaustive self-check of an
 * already-loaded catalog: the exact grade/unit/lesson counts this lane
 * promises, gapless completion order, unique refs, and — by adapting every
 * single lesson — that every ELA lesson in the catalog resolves to a valid
 * Study contract without throwing. Throws ElaContentError with the first
 * problem found rather than returning a partial report.
 */
export function validateElaSubjectLane(catalog: ElaCatalog): ElaValidationReport {
  const catalogGrades = catalog.courses.map((course) => course.grade)
  if (catalogGrades.length !== EXPECTED_GRADES.length || catalogGrades.some((g, i) => g !== EXPECTED_GRADES[i])) {
    throw new ElaContentError(`ELA catalog must cover exactly grades ${EXPECTED_GRADES.join(', ')}, got ${catalogGrades.join(', ')}`)
  }

  const lessonsByGrade = {} as Record<AcademyGrade, number>
  const unitsByGrade = {} as Record<AcademyGrade, number>
  const allLessonRefs: string[] = []
  const allUnitRefs: string[] = []

  for (const course of catalog.courses) {
    if (course.lessons.length !== EXPECTED_LESSONS_PER_GRADE) {
      throw new ElaContentError(
        `Grade ${course.grade} ELA must have ${EXPECTED_LESSONS_PER_GRADE} lessons, got ${course.lessons.length}`,
      )
    }
    if (course.units.length !== EXPECTED_UNITS_PER_GRADE) {
      throw new ElaContentError(
        `Grade ${course.grade} ELA must have ${EXPECTED_UNITS_PER_GRADE} units, got ${course.units.length}`,
      )
    }

    const days = course.lessons.map((lesson) => lesson.courseDay)
    const expectedDays = Array.from({ length: days.length }, (_unused, i) => i + 1)
    if (days.some((day, i) => day !== expectedDays[i])) {
      throw new ElaContentError(`Grade ${course.grade} ELA course_day sequence is not a gapless 1..N order`)
    }

    for (const lesson of course.lessons) {
      // Fails closed (throws) if this lesson cannot become a valid StudyLessonPlan.
      adaptElaLessonToStudy(lesson)
      allLessonRefs.push(lesson.lessonId)
    }
    for (const unit of course.units) allUnitRefs.push(unit.unitId)

    lessonsByGrade[course.grade] = course.lessons.length
    unitsByGrade[course.grade] = course.units.length
  }

  if (new Set(allLessonRefs).size !== allLessonRefs.length) {
    throw new ElaContentError('ELA catalog has duplicate lesson refs across grades')
  }
  if (new Set(allUnitRefs).size !== allUnitRefs.length) {
    throw new ElaContentError('ELA catalog has duplicate unit refs across grades')
  }

  return {
    releaseVersion: catalog.releaseVersion,
    lessonsByGrade,
    unitsByGrade,
    totalLessons: allLessonRefs.length,
  }
}

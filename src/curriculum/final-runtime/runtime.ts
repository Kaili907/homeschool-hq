import { SUPPORTED_SUBJECTS, type SupportedSubject } from '../release-admission/types.ts'
import { FINAL_CURRICULUM_GRADES, isFinalCurriculumGrade } from './grades.ts'
import type {
  FinalCatalogLesson,
  FinalCatalogSchedule,
  FinalCatalogUnit,
  FinalCourseLessonRow,
  FinalCourseRef,
  FinalCurriculumGrade,
  FinalCurriculumRuntime,
  FinalCurriculumRuntimeSource,
  FinalLessonRef,
  ProductionMaterialLookup,
  ProductionMaterialLookupResult,
  ResolvedScheduleEntry,
  StudyContentPlanBridge,
  StudyContentPlanResolution,
} from './types.ts'

const EMPTY_UNITS: readonly FinalCatalogUnit[] = Object.freeze([])
const EMPTY_LESSONS: readonly FinalCatalogLesson[] = Object.freeze([])
const EMPTY_RESOLVED_ENTRIES: readonly ResolvedScheduleEntry[] = Object.freeze([])

export function createFinalCurriculumRuntime<TMaterial>(
  source: FinalCurriculumRuntimeSource<TMaterial>,
): FinalCurriculumRuntime<TMaterial> {
  const { manifest } = source
  const unsupported = [
    ...manifest.courses.map((item) => ({ ref: item.courseRef, grade: item.grade })),
    ...manifest.units.map((item) => ({ ref: item.unitRef, grade: item.grade })),
    ...manifest.schedules.map((item) => ({ ref: item.scheduleRef, grade: item.grade })),
  ].find((item) => !isFinalCurriculumGrade(item.grade))
  if (unsupported) {
    throw new Error(`final-runtime: ${unsupported.ref} has unsupported Grade ${unsupported.grade}`)
  }
  const courses = Object.freeze([...manifest.courses])
  const courseByRef = new Map(courses.map((course) => [course.courseRef, course]))
  const unitByRef = new Map(manifest.units.map((unit) => [unit.unitRef, unit]))
  const scheduleByRef = new Map(
    manifest.schedules.map((schedule) => [schedule.scheduleRef, schedule]),
  )

  const mutableUnitsByCourse = new Map<FinalCourseRef, FinalCatalogUnit[]>()
  const unitByLessonRef = new Map<FinalLessonRef, FinalCatalogUnit>()
  for (const unit of manifest.units) {
    const bucket = mutableUnitsByCourse.get(unit.courseRef)
    if (bucket) bucket.push(unit)
    else mutableUnitsByCourse.set(unit.courseRef, [unit])
    for (const lessonRef of unit.lessonRefs) unitByLessonRef.set(lessonRef, unit)
  }
  const unitsByCourse = new Map<FinalCourseRef, readonly FinalCatalogUnit[]>()
  for (const [courseRef, units] of mutableUnitsByCourse) {
    units.sort((left, right) => left.unitNumber - right.unitNumber)
    unitsByCourse.set(courseRef, Object.freeze(units))
  }

  const loaded = new Map<FinalCourseRef, Promise<readonly FinalCatalogLesson[]>>()

  const hydrateCourse = (
    courseRef: FinalCourseRef,
    rows: readonly FinalCourseLessonRow[],
  ): readonly FinalCatalogLesson[] => {
    const course = courseByRef.get(courseRef)
    if (!course) return EMPTY_LESSONS
    const expected = new Set(
      (unitsByCourse.get(courseRef) ?? []).flatMap((unit) => unit.lessonRefs),
    )
    const seen = new Set<string>()
    const lessons = rows.map((row): FinalCatalogLesson => {
      const unit = unitByRef.get(row.unitRef)
      if (!unit || unit.courseRef !== courseRef || !expected.has(row.lessonRef)) {
        throw new Error(
          `final-runtime: ${row.lessonRef} does not belong to ${row.unitRef} in ${courseRef}`,
        )
      }
      if (!unit.lessonRefs.includes(row.lessonRef) || seen.has(row.lessonRef)) {
        throw new Error(`final-runtime: duplicate or misplaced lesson ${row.lessonRef}`)
      }
      seen.add(row.lessonRef)
      return Object.freeze({
        ...row,
        resourceRefs: Object.freeze([...row.resourceRefs]),
        sourceReadiness: Object.freeze({
          ...row.sourceReadiness,
          sourceRefs: Object.freeze([...row.sourceReadiness.sourceRefs]),
        }),
        courseRef,
        grade: course.grade,
        subject: course.subject,
        unitNumber: unit.unitNumber,
      })
    })
    const missing = [...expected].filter((lessonRef) => !seen.has(lessonRef))
    if (missing.length > 0 || lessons.length !== course.lessonCount) {
      throw new Error(
        `final-runtime: ${courseRef} payload is incomplete (${lessons.length}/${course.lessonCount})`,
      )
    }
    lessons.sort((left, right) => left.courseDay - right.courseDay)
    return Object.freeze(lessons)
  }

  const loadCourse = (courseRef: FinalCourseRef): Promise<readonly FinalCatalogLesson[]> => {
    const cached = loaded.get(courseRef)
    if (cached) return cached
    if (!courseByRef.has(courseRef)) return Promise.resolve(EMPTY_LESSONS)
    const loader = source.lessonLoaders[courseRef]
    if (!loader) {
      return Promise.reject(
        new Error(`final-runtime: ${courseRef} has no browser lesson loader`),
      )
    }
    const pending = loader()
      .then((module) => hydrateCourse(courseRef, module.default))
      .catch((cause: unknown) => {
        loaded.delete(courseRef)
        throw cause
      })
    loaded.set(courseRef, pending)
    return pending
  }

  const getLesson = async (lessonRef: FinalLessonRef): Promise<FinalCatalogLesson | undefined> => {
    const unit = unitByLessonRef.get(lessonRef)
    if (!unit) return undefined
    const lessons = await loadCourse(unit.courseRef)
    return lessons.find((lesson) => lesson.lessonRef === lessonRef)
  }

  const lookupProductionMaterial = async (
    lookup: ProductionMaterialLookup,
  ): Promise<ProductionMaterialLookupResult<TMaterial>> => {
    const lesson = await getLesson(lookup.lessonRef)
    if (!lesson) return { status: 'lesson-not-found', lessonRef: lookup.lessonRef }
    return source.productionMaterialResolver.resolve({
      ...lookup,
      releaseVersion: manifest.releaseVersion,
      courseRef: lesson.courseRef,
      unitRef: lesson.unitRef,
      grade: lesson.grade,
      subject: lesson.subject,
      sourceReadiness: lesson.sourceReadiness,
    })
  }

  const buildStudyContentPlan = async <TPlan>(
    lessonRef: FinalLessonRef,
    bridge: StudyContentPlanBridge<TMaterial, TPlan>,
  ): Promise<StudyContentPlanResolution<TPlan>> => {
    const lesson = await getLesson(lessonRef)
    if (!lesson) return { status: 'lesson-not-found', lessonRef }
    const plan = await bridge.build({
      releaseVersion: manifest.releaseVersion,
      lesson,
      lookupProductionMaterial: (lookup) =>
        lookupProductionMaterial({ ...lookup, lessonRef }),
    })
    return { status: 'ready', lesson, plan }
  }

  return Object.freeze({
    releaseVersion: manifest.releaseVersion,
    listGrades: () =>
      Object.freeze(
        FINAL_CURRICULUM_GRADES.filter(
          (grade) => courses.some((course) => course.grade === grade),
        ),
      ),
    listSubjects: (grade: FinalCurriculumGrade) => {
      const present = new Set(
        courses.filter((course) => course.grade === grade).map((course) => course.subject),
      )
      return Object.freeze(
        SUPPORTED_SUBJECTS.filter((item: SupportedSubject) => present.has(item)),
      )
    },
    listCourses: (grade?: FinalCurriculumGrade) =>
      grade === undefined
        ? courses
        : Object.freeze(courses.filter((course) => course.grade === grade)),
    getCourse: (courseRef: FinalCourseRef) => courseByRef.get(courseRef),
    listUnits: (courseRef: FinalCourseRef) => unitsByCourse.get(courseRef) ?? EMPTY_UNITS,
    getUnit: (unitRef: string) => unitByRef.get(unitRef),
    listLessons: (courseRef: FinalCourseRef) => loadCourse(courseRef),
    getLesson,
    listSchedules: (grade?: FinalCurriculumGrade) =>
      grade === undefined
        ? manifest.schedules
        : Object.freeze(manifest.schedules.filter((schedule) => schedule.grade === grade)),
    getSchedule: (scheduleRef: string) => scheduleByRef.get(scheduleRef),
    resolveScheduleEntry: async (scheduleRef: string, week: number, day: number) => {
      const schedule = scheduleByRef.get(scheduleRef)
      if (!schedule) return EMPTY_RESOLVED_ENTRIES
      const matching = schedule.entries.filter((entry) => entry.week === week && entry.day === day)
      const resolved = await Promise.all(matching.map(async (entry): Promise<ResolvedScheduleEntry> => {
        const lessons = await Promise.all(entry.lessonRefs.map(getLesson))
        if (lessons.some((lesson) => lesson === undefined)) {
          const missing = entry.lessonRefs.filter((_ref, index) => lessons[index] === undefined)
          throw new Error(`final-runtime: schedule ${scheduleRef} cannot resolve ${missing.join(', ')}`)
        }
        return Object.freeze({ ...entry, lessons: Object.freeze(lessons as FinalCatalogLesson[]) })
      }))
      return Object.freeze(resolved)
    },
    lookupProductionMaterial,
    buildStudyContentPlan,
  })
}

import type { CanonicalGrade, SupportedSubject } from '../release-admission/types.ts'

export type FinalCourseRef = string
export type FinalUnitRef = string
export type FinalLessonRef = string
export type FinalScheduleRef = string

/** Browser catalog name for release admission's canonical grade authority. */
export type FinalCurriculumGrade = CanonicalGrade

export interface FinalCatalogCourse {
  readonly courseRef: FinalCourseRef
  readonly grade: FinalCurriculumGrade
  readonly subject: SupportedSubject
  readonly title: string
  readonly days: number
  readonly unitCount: number
  readonly lessonCount: number
}

export interface FinalCatalogUnit {
  readonly unitRef: FinalUnitRef
  readonly courseRef: FinalCourseRef
  readonly grade: FinalCurriculumGrade
  readonly subject: SupportedSubject
  readonly unitNumber: number
  readonly title: string
  readonly days: number
  readonly essentialQuestion: string
  readonly assessmentRef: string | null
  readonly lessonRefs: readonly FinalLessonRef[]
}

/**
 * Source state travels with the lazy lesson row. Dynamic sources (for example,
 * a current-events source chosen on the day of instruction) are explicit and
 * can never be mistaken for an already-vetted static source.
 */
export type LessonSourceReadiness =
  | {
      readonly state: 'ready'
      readonly dynamicSource: false
      readonly sourceRefs: readonly string[]
    }
  | {
      readonly state: 'dynamic'
      readonly dynamicSource: true
      readonly sourceRefs: readonly string[]
      readonly resolverKey: string
    }
  | {
      readonly state: 'unavailable'
      readonly dynamicSource: boolean
      readonly sourceRefs: readonly string[]
      readonly reason: string
    }

/** One browser-safe row in a per-course lazy module. No lesson body is here. */
export interface FinalCourseLessonRow {
  readonly lessonRef: FinalLessonRef
  readonly unitRef: FinalUnitRef
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly estimatedMinutes: string
  readonly resourceRefs: readonly string[]
  readonly sourceReadiness: LessonSourceReadiness
}

export interface FinalCatalogLesson extends FinalCourseLessonRow {
  readonly courseRef: FinalCourseRef
  readonly grade: FinalCurriculumGrade
  readonly subject: SupportedSubject
  readonly unitNumber: number
}

export interface FinalScheduleEntry {
  readonly week: number
  readonly day: number
  readonly lessonRefs: readonly FinalLessonRef[]
}

export interface FinalCatalogSchedule {
  readonly scheduleRef: FinalScheduleRef
  readonly grade: FinalCurriculumGrade
  readonly weeks: number
  readonly instructionalDays: number
  readonly entries: readonly FinalScheduleEntry[]
}

/** Small eager projection made from a branded admitted release. */
export interface FinalRuntimeManifest {
  readonly releaseVersion: string
  readonly courses: readonly FinalCatalogCourse[]
  readonly units: readonly FinalCatalogUnit[]
  readonly schedules: readonly FinalCatalogSchedule[]
}

export type FinalCourseLessonModule = {
  readonly default: readonly FinalCourseLessonRow[]
}

/** A static import() per course is the intended production implementation. */
export type FinalCourseLessonLoader = () => Promise<FinalCourseLessonModule>

export type ProductionMaterialKind =
  | 'student-work'
  | 'answer-key'
  | 'teacher-guide'
  | 'source'
  | 'other'

export interface ProductionMaterialLookup {
  readonly lessonRef: FinalLessonRef
  readonly kind: ProductionMaterialKind
  readonly materialRef?: string
}

export interface ProductionMaterialResolverRequest extends ProductionMaterialLookup {
  readonly releaseVersion: string
  readonly courseRef: FinalCourseRef
  readonly unitRef: FinalUnitRef
  readonly grade: FinalCurriculumGrade
  readonly subject: SupportedSubject
  readonly sourceReadiness: LessonSourceReadiness
}

export type ProductionMaterialResolution<TMaterial> =
  | {
      readonly status: 'ready'
      readonly material: TMaterial
      readonly sourceReadiness: LessonSourceReadiness
    }
  | {
      readonly status: 'dynamic-source'
      readonly sourceReadiness: Extract<LessonSourceReadiness, { readonly state: 'dynamic' }>
    }
  | {
      readonly status: 'not-found' | 'unavailable'
      readonly reason: string
      readonly sourceReadiness?: LessonSourceReadiness
    }

export interface ProductionMaterialResolver<TMaterial> {
  readonly resolve: (
    request: ProductionMaterialResolverRequest,
  ) => Promise<ProductionMaterialResolution<TMaterial>>
}

export type ProductionMaterialLookupResult<TMaterial> =
  | ProductionMaterialResolution<TMaterial>
  | { readonly status: 'lesson-not-found'; readonly lessonRef: FinalLessonRef }

export interface StudyContentPlanBridgeInput<TMaterial> {
  readonly releaseVersion: string
  readonly lesson: FinalCatalogLesson
  readonly lookupProductionMaterial: (
    lookup: Omit<ProductionMaterialLookup, 'lessonRef'>,
  ) => Promise<ProductionMaterialLookupResult<TMaterial>>
}

/**
 * Final convergence supplies the established Study adapter here. Keeping it a
 * port avoids making this browser catalog depend on Study's moving plan type.
 */
export interface StudyContentPlanBridge<TMaterial, TPlan> {
  readonly build: (input: StudyContentPlanBridgeInput<TMaterial>) => TPlan | Promise<TPlan>
}

export type StudyContentPlanResolution<TPlan> =
  | { readonly status: 'ready'; readonly lesson: FinalCatalogLesson; readonly plan: TPlan }
  | { readonly status: 'lesson-not-found'; readonly lessonRef: FinalLessonRef }

export interface ResolvedScheduleEntry extends Omit<FinalScheduleEntry, 'lessonRefs'> {
  readonly lessonRefs: readonly FinalLessonRef[]
  readonly lessons: readonly FinalCatalogLesson[]
}

export interface FinalCurriculumRuntime<TMaterial> {
  readonly releaseVersion: string

  readonly listGrades: () => readonly FinalCurriculumGrade[]
  readonly listSubjects: (grade: FinalCurriculumGrade) => readonly SupportedSubject[]
  readonly listCourses: (grade?: FinalCurriculumGrade) => readonly FinalCatalogCourse[]
  readonly getCourse: (courseRef: FinalCourseRef) => FinalCatalogCourse | undefined
  readonly listUnits: (courseRef: FinalCourseRef) => readonly FinalCatalogUnit[]
  readonly getUnit: (unitRef: FinalUnitRef) => FinalCatalogUnit | undefined
  readonly listLessons: (courseRef: FinalCourseRef) => Promise<readonly FinalCatalogLesson[]>
  readonly getLesson: (lessonRef: FinalLessonRef) => Promise<FinalCatalogLesson | undefined>

  readonly listSchedules: (grade?: FinalCurriculumGrade) => readonly FinalCatalogSchedule[]
  readonly getSchedule: (scheduleRef: FinalScheduleRef) => FinalCatalogSchedule | undefined
  readonly resolveScheduleEntry: (
    scheduleRef: FinalScheduleRef,
    week: number,
    day: number,
  ) => Promise<readonly ResolvedScheduleEntry[]>

  readonly lookupProductionMaterial: (
    lookup: ProductionMaterialLookup,
  ) => Promise<ProductionMaterialLookupResult<TMaterial>>

  readonly buildStudyContentPlan: <TPlan>(
    lessonRef: FinalLessonRef,
    bridge: StudyContentPlanBridge<TMaterial, TPlan>,
  ) => Promise<StudyContentPlanResolution<TPlan>>
}

export interface FinalCurriculumRuntimeSource<TMaterial> {
  readonly manifest: FinalRuntimeManifest
  readonly lessonLoaders: Readonly<Record<FinalCourseRef, FinalCourseLessonLoader>>
  readonly productionMaterialResolver: ProductionMaterialResolver<TMaterial>
}

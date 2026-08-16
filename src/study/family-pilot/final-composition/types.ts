import type { AcademySubject, Profile } from '../../../types'
import type { AcademySupportedGrade } from '../../../curriculum/grade-authority'
import type { HostLessonDescriptor } from '../../curriculumAdapter'
import type { HostStudyLaunchContext, StudyLessonPlan, StudySubject } from '../../types'
import type { FamilyPilotStudyResult, FamilyPilotStudySnapshot } from '../study'

export const FINAL_FAMILY_PILOT_RELEASE_VERSION = '2.0.0' as const

export type FinalFamilyPilotSourceReadiness =
  | { readonly state: 'ready'; readonly dynamicSource: false; readonly sourceRefs: readonly string[] }
  | { readonly state: 'dynamic'; readonly dynamicSource: true; readonly sourceRefs: readonly string[]; readonly resolverKey: string }
  | { readonly state: 'unavailable'; readonly dynamicSource: boolean; readonly sourceRefs: readonly string[]; readonly reason: string }

export interface FinalFamilyPilotCatalogLesson {
  readonly lessonRef: string
  readonly courseRef: string
  readonly unitRef: string
  readonly grade: AcademySupportedGrade
  readonly subject: AcademySubject
  readonly unitNumber: number
  readonly dayInUnit: number
  readonly courseDay: number
  readonly title: string
  readonly estimatedMinutes: string
  readonly resourceRefs: readonly string[]
  readonly sourceReadiness: FinalFamilyPilotSourceReadiness
}

export type FinalFamilyPilotMaterialLookupResult<TMaterial> =
  | { readonly status: 'ready'; readonly material: TMaterial; readonly sourceReadiness: FinalFamilyPilotSourceReadiness }
  | { readonly status: 'dynamic-source'; readonly sourceReadiness: Extract<FinalFamilyPilotSourceReadiness, { readonly state: 'dynamic' }> }
  | { readonly status: 'not-found' | 'unavailable'; readonly reason: string; readonly sourceReadiness?: FinalFamilyPilotSourceReadiness }
  | { readonly status: 'lesson-not-found'; readonly lessonRef: string }

/** Structural port implemented by src/curriculum/final-runtime. */
export interface FinalFamilyPilotCurriculumRuntime<TMaterial> {
  readonly releaseVersion: string
  listGrades(): readonly AcademySupportedGrade[]
  listSubjects(grade: AcademySupportedGrade): readonly AcademySubject[]
  getLesson(lessonRef: string): Promise<FinalFamilyPilotCatalogLesson | undefined>
  lookupProductionMaterial(input: { readonly lessonRef: string; readonly kind: 'student-work' }): Promise<FinalFamilyPilotMaterialLookupResult<TMaterial>>
}

export interface FinalFamilyPilotProductionMaterial<TMaterial> {
  readonly materialRef: string
  readonly mediaAvailable: boolean
  readonly content: TMaterial
}

export interface FinalFamilyPilotLessonExecution<TMaterial> {
  readonly releaseVersion: typeof FINAL_FAMILY_PILOT_RELEASE_VERSION
  readonly dashboardGrade: AcademySupportedGrade
  readonly studySubject: StudySubject
  readonly lesson: FinalFamilyPilotCatalogLesson
  readonly descriptor: HostLessonDescriptor
  readonly plan: StudyLessonPlan
  readonly material: FinalFamilyPilotProductionMaterial<TMaterial>
}

export type FinalFamilyPilotBindingReason =
  | 'unsupported-dashboard-grade'
  | 'release-mismatch'
  | 'curriculum-matrix-incomplete'
  | 'lesson-not-found'
  | 'lesson-grade-mismatch'
  | 'lesson-subject-unsupported'
  | 'source-not-ready'
  | 'material-unavailable'
  | 'material-binding-invalid'
  | 'study-runtime-rejected'

export type FinalFamilyPilotBindingResult<TMaterial> =
  | { readonly status: 'ready'; readonly execution: FinalFamilyPilotLessonExecution<TMaterial> }
  | { readonly status: 'blocked'; readonly reason: FinalFamilyPilotBindingReason; readonly detailCode?: string }

export interface FinalFamilyPilotMaterialIdentity<TMaterial> {
  readonly materialRef: string
  readonly mediaAvailable: boolean
  readonly content: TMaterial
}

export interface CreateFinalFamilyPilotCurriculumBindingOptions<TMaterial> {
  readonly runtime: FinalFamilyPilotCurriculumRuntime<TMaterial>
  readonly materialIdentity?: (material: TMaterial, lesson: FinalFamilyPilotCatalogLesson) => FinalFamilyPilotMaterialIdentity<TMaterial> | null
}

export interface FinalFamilyPilotCurriculumBinding<TMaterial> {
  readonly releaseVersion: typeof FINAL_FAMILY_PILOT_RELEASE_VERSION
  resolve(input: { readonly profile: Pick<Profile, 'grade'>; readonly lessonRef: string }): Promise<FinalFamilyPilotBindingResult<TMaterial>>
}

export type FinalFamilyPilotStudyStartResult<TMaterial> =
  | { readonly status: 'ok'; readonly study: FamilyPilotStudySnapshot; readonly execution: FinalFamilyPilotLessonExecution<TMaterial> }
  | { readonly status: 'blocked'; readonly reason: FinalFamilyPilotBindingReason; readonly detailCode?: string }

export interface FinalFamilyPilotStudyExecutionInput<TMaterial> {
  readonly binding: FinalFamilyPilotCurriculumBinding<TMaterial>
  readonly profile: Pick<Profile, 'grade'>
  readonly lessonRef: string
  readonly context: HostStudyLaunchContext
  startAssignment(input: {
    readonly context: HostStudyLaunchContext
    readonly assignment: { readonly kind: 'static-curriculum'; readonly lesson: HostLessonDescriptor }
  }): Promise<FamilyPilotStudyResult>
}

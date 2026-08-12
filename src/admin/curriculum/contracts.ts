import type { AcademySupportedGrade } from '../../curriculum/grade-authority'

export const CURRICULUM_READ_CAPABILITY = 'curriculum:read' as const
export const CURRICULUM_SEARCH_LIMIT = 100 as const

/**
 * Grades the admin curriculum read model can surface. Aliased to the canonical
 * authority rather than re-listed, so admin can never disagree with the rest of
 * the app about which grades curriculum exists for.
 */
export type CurriculumGrade = AcademySupportedGrade

export type CurriculumReadAuthorization =
  | { readonly status: 'checking' }
  | { readonly status: 'denied'; readonly message?: string }
  | { readonly status: 'authorized'; readonly capabilities: readonly AdminCapability[] }

export interface CurriculumSourceIdentity {
  readonly packageId: string
  readonly version: string
  readonly authoredOn: string
  readonly status: string
  readonly lifecycle: 'published'
  readonly validationStatus: 'passed' | 'unavailable'
}

export interface CurriculumCourseSummary {
  readonly courseId: string
  readonly grade: CurriculumGrade
  readonly subject: string
  readonly title: string
  readonly days: number
  readonly description?: string
  readonly capstone?: string
}

export interface CurriculumUnitSummary {
  readonly unitId: string
  readonly courseId: string
  readonly grade: CurriculumGrade
  readonly subject: string
  readonly unitNumber: number
  readonly title: string
  readonly days: number
  readonly standards: readonly string[]
  readonly essentialQuestion?: string
  readonly topics: readonly string[]
  readonly performanceTask?: string
  readonly lessonIds: readonly string[]
  readonly assessmentId?: string
}

export interface CurriculumLessonSummary {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: CurriculumGrade
  readonly subject: string
  readonly courseDay: number
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly title: string
  readonly phase?: string
  readonly focus?: string
  readonly standards: readonly string[]
}

export interface CurriculumAssessmentEvidence {
  readonly assessmentId: string
  readonly courseId: string
  readonly unitNumber: number
  readonly unitTitle: string
  readonly standards: readonly string[]
  readonly totalPoints?: number
}

export interface CurriculumCatalog {
  readonly source: CurriculumSourceIdentity
  readonly grades: readonly CurriculumGrade[]
  readonly courses: readonly CurriculumCourseSummary[]
  readonly units: readonly CurriculumUnitSummary[]
  readonly lessons: readonly CurriculumLessonSummary[]
  readonly assessments: readonly CurriculumAssessmentEvidence[]
}

export interface CurriculumLessonFlowSegment {
  readonly segment: string
  readonly minutes?: string
  readonly teacherOrTutorAction: string
}

export interface CurriculumTutorRoute {
  readonly signal: string
  readonly action: string
}

export interface CurriculumMediaGuidance {
  readonly required?: boolean
  readonly description?: string
  readonly suggestion?: string
  readonly fallback?: string
}

export interface CurriculumLessonDetail extends CurriculumLessonSummary {
  readonly schemaVersion: string
  readonly estimatedMinutes?: string
  readonly essentialQuestion?: string
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly materials: readonly string[]
  readonly lessonFlow: readonly CurriculumLessonFlowSegment[]
  readonly studentActivity?: string
  readonly formativeCheck: string
  readonly scoringGuidance?: string
  readonly masteryRule?: string
  readonly adaptiveTutorRoutes: readonly CurriculumTutorRoute[]
  readonly extension?: string
  readonly accommodations: readonly string[]
  readonly safetyAndPrivacy: readonly string[]
  readonly media?: CurriculumMediaGuidance | string
  readonly parentVisibility?: string
  readonly homeConnection?: string
  readonly assessment?: CurriculumAssessmentEvidence
  readonly source: CurriculumSourceIdentity
}

export interface CurriculumBrowserSource {
  loadIdentity(): Promise<CurriculumSourceIdentity>
  loadCatalog(): Promise<CurriculumCatalog>
  loadLesson(lessonId: string): Promise<CurriculumLessonDetail>
}

export interface CurriculumSearchFilters {
  readonly grade?: CurriculumGrade
  readonly courseId?: string
  readonly unitNumber?: number
  readonly standard?: string
  readonly keyword?: string
}

export interface CurriculumSearchResult {
  readonly lessons: readonly CurriculumLessonSummary[]
  readonly totalMatches: number
  readonly limited: boolean
}

export interface CurriculumStandardCoverage {
  readonly standard: string
  readonly lessons: readonly CurriculumLessonSummary[]
  readonly assessmentEvidence: readonly CurriculumAssessmentEvidence[]
}

export class CurriculumSourceError extends Error {
  readonly code: 'malformed' | 'inconsistent' | 'not-found' | 'unavailable'

  constructor(code: CurriculumSourceError['code'], message: string) {
    super(message)
    this.name = 'CurriculumSourceError'
    this.code = code
  }
}
import type { AdminCapability } from '../contracts'

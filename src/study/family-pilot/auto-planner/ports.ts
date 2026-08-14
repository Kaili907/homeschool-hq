import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { AcademyGrade } from '../../../types'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerHoldFact,
  FamilyAutoPlannerLearner,
  FamilyAutoPlannerMaterializationIntent,
  FamilyAutoPlannerScope,
  FamilyAutoPlannerStorePort,
} from './types'

/** Existing Family Setup/Profile projection. No planner method may mutate it. */
export interface FamilyAutoPlannerLearnerPort {
  read(scope: FamilyAutoPlannerScope): Promise<FamilyAutoPlannerLearner | null>
}

/** Browser-safe final curriculum catalog in release order. */
export interface FamilyAutoPlannerCatalogPort {
  listCourses(grade: AcademyGrade): readonly FinalCatalogCourse[]
  listUnits(courseRef: string): readonly FinalCatalogUnit[]
  listLessons(courseRef: string): Promise<readonly FinalCatalogLesson[]>
}

/** Existing Core assignment lifecycle. `materializeLesson` must retain Core's
 * deterministic duplicate-ref/no-reset behavior. */
export interface FamilyAutoPlannerAssignmentPort {
  list(scope: FamilyAutoPlannerScope): Promise<readonly FamilyAutoPlannerAssignmentFact[]>
  materializeLesson(
    scope: FamilyAutoPlannerScope,
    intent: Extract<FamilyAutoPlannerMaterializationIntent, { readonly kind: 'LESSON' }>,
  ): Promise<FamilyAutoPlannerAssignmentFact>
}

/** Existing production assessment assignment workflow. The planner never
 * scores, certifies, or changes assessment status. */
export interface FamilyAutoPlannerAssessmentPort {
  list(scope: FamilyAutoPlannerScope): Promise<readonly FamilyAutoPlannerAssessmentFact[]>
  materializeAssessment(
    scope: FamilyAutoPlannerScope,
    intent: Extract<FamilyAutoPlannerMaterializationIntent, { readonly kind: 'ASSESSMENT' }>,
  ): Promise<FamilyAutoPlannerAssessmentFact>
}

/** Existing safety holds, already minimized to refs/status/reason. */
export interface FamilyAutoPlannerHoldPort {
  list(scope: FamilyAutoPlannerScope): Promise<readonly FamilyAutoPlannerHoldFact[]>
}

export interface FamilyAutoPlannerPorts {
  readonly learners: FamilyAutoPlannerLearnerPort
  readonly catalog: FamilyAutoPlannerCatalogPort
  readonly assignments: FamilyAutoPlannerAssignmentPort
  readonly assessments: FamilyAutoPlannerAssessmentPort
  readonly holds: FamilyAutoPlannerHoldPort
  readonly store: FamilyAutoPlannerStorePort
}

export const emptyFamilyAutoPlannerHoldPort: FamilyAutoPlannerHoldPort = Object.freeze({
  list: async () => Object.freeze([]),
})

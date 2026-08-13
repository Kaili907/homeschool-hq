import type { SupportedSubject } from '../release-admission/types'
import type {
  FinalCourseLessonRow,
  FinalCurriculumRuntime,
  FinalRuntimeManifest,
} from '../final-runtime'
import type { FinalFamilyPilotCompletionAuthority } from '../../study/family-pilot/final-composition'

export interface FinalLearnerMaterialSection {
  readonly sectionRef?: string
  readonly sectionKind?: string
  readonly title: string
  readonly body?: string
  readonly prompts: readonly string[]
  readonly items?: readonly {
    readonly itemRef: string
    readonly sourceItemRef?: string
    readonly itemKind?: string
    readonly itemType?: string
    readonly prompt?: string
    readonly responseType?: string
    readonly responseKind?: 'NONE' | 'READ' | 'CHOICE' | 'TEXT' | 'NUMERIC' | 'CONSTRUCTED_RESPONSE' | 'ACTIVITY_EVIDENCE' | 'RUBRIC_REVIEW_PENDING' | 'GUARDIAN_ATTESTATION'
    readonly choices?: readonly string[]
  }[]
}

export type FinalLearnerProductionMaterial = {
  readonly materialRef: string
  readonly lessonRef: string
  readonly title: string
  readonly subject: SupportedSubject
} & (
  | {
      readonly format: 'structured'
      readonly sections: readonly FinalLearnerMaterialSection[]
    }
  | {
      readonly format: 'markdown'
      readonly markdown: string
      readonly sections?: readonly FinalLearnerMaterialSection[]
    }
)

export interface FinalProductionBinding {
  readonly lessonRef: string
  readonly courseRef: string
  readonly grade: number
  readonly subject: SupportedSubject
  readonly productionPackageRef: string
  readonly productionSourceCommit: string
  readonly completionAuthority: FinalFamilyPilotCompletionAuthority
  readonly sourceReadinessKind: 'STATIC_READY' | 'STATIC_VERIFIED_SOURCE' | 'DYNAMIC_SOURCE_REQUIRED'
  readonly sourceRuntimeState: 'READY' | 'PENDING_SOURCE_ATTACHMENT'
}

export interface FinalLearnerAssessmentTask {
  readonly taskRef: string
  readonly kind: string
  readonly prompt: string
  readonly directions?: string
  readonly choices?: readonly string[]
  readonly responseUnit?: string
  readonly standardRef?: string
  readonly possiblePoints?: number
}

export interface FinalLearnerAssessmentMaterial {
  readonly schemaVersion: '1.0'
  readonly kind: 'canonical-learner-assessment-package'
  readonly assessmentRef: string
  readonly courseRef: string
  readonly grade: number
  readonly subject: SupportedSubject
  readonly location: {
    readonly unitRef: string
    readonly unitNumber: number
    readonly unitTitle: string
    readonly courseTitle: string
    readonly assessmentLessonRef: string | null
  }
  readonly standards: readonly string[]
  readonly instructions: readonly string[]
  readonly learnerTasks: readonly FinalLearnerAssessmentTask[]
  readonly responseMode: string
  readonly completionScoringAuthorityClass: 'AUTO_SCOREABLE' | 'RUBRIC_REQUIRED' | 'GUARDIAN_REQUIRED' | 'COMPLETION_ONLY'
  readonly learnerSuccessCriteria: readonly string[]
  readonly accommodations: string
  readonly productionReadiness: {
    readonly status: 'READY'
    readonly structuralOnly: false
    readonly answerMaterialIncluded: false
    readonly requiresSourceAttachment?: boolean
    readonly sourceResolverKey?: string | null
  }
}

export interface FinalAssessmentBinding {
  readonly assessmentRef: string
  readonly courseRef: string
  readonly unitRef: string
  readonly grade: number
  readonly subject: SupportedSubject
  readonly authorityClass: FinalLearnerAssessmentMaterial['completionScoringAuthorityClass']
  readonly responseMode: string
  readonly state: 'BOUND'
}

export interface FinalBrowserCoursePayload {
  readonly courseRef: string
  readonly lessons: readonly FinalCourseLessonRow[]
  readonly bindings: Readonly<Record<string, FinalProductionBinding>>
  readonly materials: Readonly<Record<string, FinalLearnerProductionMaterial>>
  readonly assessmentBindings: Readonly<Record<string, FinalAssessmentBinding>>
  readonly assessments: Readonly<Record<string, FinalLearnerAssessmentMaterial>>
}

export interface FinalBrowserManifestDocument {
  readonly releaseId: 'family-pilot-r1'
  readonly classification: 'ADMITTED_PRODUCTION_BOUND_FAMILY_PILOT_R1'
  readonly admissionStatus: 'ADMITTED'
  readonly counts: {
    readonly grades: 9
    readonly courses: 90
    readonly units: 698
    readonly lessons: 8292
    readonly assessments: 699
  }
  readonly productionBindings: 8292
  readonly assessmentBindings: 699
  readonly assessments: readonly Omit<FinalAssessmentBinding, 'state'>[]
  readonly dynamicSocialSources: {
    readonly admitted: 12
    readonly runtimeState: 'PENDING_SOURCE_ATTACHMENT'
    readonly readyTransition: 'ATTACHED_SATISFIED'
  }
  readonly runtime: FinalRuntimeManifest
}

export interface FinalFamilyPilotCatalog {
  readonly manifest: FinalBrowserManifestDocument
  readonly runtime: FinalCurriculumRuntime<FinalLearnerProductionMaterial>
  readonly loadCoursePayload: (courseRef: string) => Promise<FinalBrowserCoursePayload>
  readonly getBinding: (lessonRef: string) => Promise<FinalProductionBinding | null>
  readonly getMaterial: (lessonRef: string) => Promise<FinalLearnerProductionMaterial | null>
  readonly getAssessment: (assessmentRef: string) => Promise<FinalLearnerAssessmentMaterial | null>
  readonly listAssessments: (courseRef?: string) => readonly Omit<FinalAssessmentBinding, 'state'>[]
}

import type { SupportedSubject } from '../release-admission/types'
import type {
  FinalCourseLessonRow,
  FinalCurriculumRuntime,
  FinalRuntimeManifest,
} from '../final-runtime'
import type { FinalFamilyPilotCompletionAuthority } from '../../study/family-pilot/final-composition'

export interface FinalLearnerMaterialSection {
  readonly title: string
  readonly body?: string
  readonly prompts: readonly string[]
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

export interface FinalBrowserCoursePayload {
  readonly courseRef: string
  readonly lessons: readonly FinalCourseLessonRow[]
  readonly bindings: Readonly<Record<string, FinalProductionBinding>>
  readonly materials: Readonly<Record<string, FinalLearnerProductionMaterial>>
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
}

import type { AcademyGrade } from '../../../types'
import type { StudyPortBundle } from '../../ports'

export const FINAL_E2E_PERSISTENCE_KEY = 'manuel-academy.family-pilot.final-e2e.v1'
export const FINAL_E2E_STATE_VERSION = 1 as const

export type FinalE2ECompletionAuthority = 'learner' | 'guardian'
export type FinalE2ECompletionState = 'in-progress' | 'pending-attestation' | 'certified'
export type FinalE2EAssignmentState =
  | 'not-started'
  | 'active'
  | 'paused'
  | 'blocked-source'
  | FinalE2ECompletionState

export interface FinalE2EStudentFixture {
  readonly studentRef: string
  readonly displayName: string
  readonly grade: AcademyGrade
}

export interface FinalE2ESourceFixture {
  readonly sourceRef: string
  readonly kind: 'article' | 'primary-source' | 'reference'
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
}

export interface FinalE2ELessonFixture {
  readonly lessonRef: string
  readonly grade: AcademyGrade
  readonly subject: 'mathematics' | 'science' | 'social-studies' | 'ready-for-life'
  readonly title: string
  readonly completionAuthority: FinalE2ECompletionAuthority
  readonly materialRef: string
  readonly requiresDynamicSource: boolean
}

export interface FinalE2EFixtureModel {
  readonly students: readonly FinalE2EStudentFixture[]
  readonly sources: readonly FinalE2ESourceFixture[]
}

export interface FinalE2ECurriculumProvider {
  readonly listLessons: (grade: AcademyGrade) => readonly FinalE2ELessonFixture[]
}

export type FinalE2EMaterialResolution =
  | {
      readonly status: 'ready'
      readonly materialRef: string
      readonly segmentRefs: readonly string[]
    }
  | {
      readonly status: 'blocked-source'
      readonly reasonCode: 'qualifying-source-required'
    }

export interface FinalE2EProductionMaterialProvider {
  readonly resolve: (input: {
    readonly lesson: FinalE2ELessonFixture
    readonly sourceRef: string | null
  }) => FinalE2EMaterialResolution
  readonly qualifySource: (input: {
    readonly lesson: FinalE2ELessonFixture
    readonly source: FinalE2ESourceFixture
  }) => { readonly qualified: boolean; readonly reasonCode?: string }
}

export interface FinalE2ECompletionPolicy {
  readonly learnerFinish: (input: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly authority: FinalE2ECompletionAuthority
    readonly at: string
  }) => FinalE2ECompletionState
  readonly adultAttest: (input: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly authority: FinalE2ECompletionAuthority
    readonly at: string
  }) => FinalE2ECompletionState
}

export type FinalE2ESafetyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reasonCode: string }

export interface FinalE2ESafetyPort {
  readonly checkEntry: (input: {
    readonly studentRef: string
    readonly assignmentRef: string
  }) => FinalE2ESafetyDecision
  /** Deterministic acceptance-only trigger; production adapters may seed their real hold ledger. */
  readonly placeHold: (input: {
    readonly studentRef: string
    readonly reasonCode: string
    readonly at: string
  }) => void
  readonly clearHold: (input: { readonly studentRef: string; readonly at: string }) => void
}

export interface FinalE2EBackupArtifact {
  readonly format: 'family-pilot-final-e2e-backup-v1'
  readonly payload: string
}

export interface FinalE2EBackupRecoveryPort {
  readonly exportState: (serializedState: string) => FinalE2EBackupArtifact
  readonly recoverState: (artifact: FinalE2EBackupArtifact) =>
    | { readonly status: 'ok'; readonly serializedState: string }
    | { readonly status: 'refused'; readonly reasonCode: string }
}

export interface FinalE2EPersistencePort {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
  readonly removeItem: (key: string) => void
  readonly entries: () => readonly (readonly [string, string])[]
}

export interface FinalE2EAssignmentSnapshot {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly studentRef: string
  readonly subject: FinalE2ELessonFixture['subject']
  readonly state: FinalE2EAssignmentState
  readonly segmentRefs: readonly string[]
  readonly completedSegmentRefs: readonly string[]
  readonly currentSegmentRef: string | null
  readonly checkpointRevision: number
  readonly sourceRef: string | null
  readonly completedAt: string | null
  readonly attestedAt: string | null
  readonly rawAnswerIncluded: false
  readonly audioIncluded: false
  readonly transcriptIncluded: false
}

export interface FinalE2EStudentSnapshot {
  readonly studentRef: string
  readonly displayName: string
  readonly grade: AcademyGrade
  readonly assignments: readonly FinalE2EAssignmentSnapshot[]
}

export interface FinalE2ERuntimeSnapshot {
  readonly status: 'ready' | 'refused'
  readonly refusalReason: string | null
  readonly activeStudentRef: string | null
  readonly students: readonly FinalE2EStudentSnapshot[]
}

export type FinalE2EActionResult =
  | { readonly status: 'ok'; readonly snapshot: FinalE2ERuntimeSnapshot }
  | { readonly status: 'blocked'; readonly reasonCode: string; readonly snapshot: FinalE2ERuntimeSnapshot }
  | { readonly status: 'refused'; readonly reasonCode: string; readonly snapshot: FinalE2ERuntimeSnapshot }

export interface FinalFamilyPilotRuntime {
  readonly snapshot: () => FinalE2ERuntimeSnapshot
  readonly selectStudent: (studentRef: string) => FinalE2EActionResult
  readonly start: (studentRef: string, lessonRef: string) => Promise<FinalE2EActionResult>
  readonly completeSegments: (
    studentRef: string,
    lessonRef: string,
    count: number,
  ) => Promise<FinalE2EActionResult>
  readonly checkpoint: (studentRef: string, lessonRef: string) => Promise<FinalE2EActionResult>
  readonly finishLesson: (studentRef: string, lessonRef: string) => Promise<FinalE2EActionResult>
  readonly adultAttest: (studentRef: string, lessonRef: string) => Promise<FinalE2EActionResult>
  readonly attachSource: (
    studentRef: string,
    lessonRef: string,
    source: FinalE2ESourceFixture,
  ) => Promise<FinalE2EActionResult>
  readonly clearSafetyHold: (studentRef: string) => Promise<FinalE2EActionResult>
  readonly exportBackup: () => Promise<FinalE2EBackupArtifact>
  readonly reset: () => Promise<void>
  readonly restore: (artifact: FinalE2EBackupArtifact) => Promise<FinalE2EActionResult>
  readonly destroy: () => void
}

export interface FinalFamilyPilotRuntimeInput {
  readonly fixtures: FinalE2EFixtureModel
  readonly curriculumProvider: FinalE2ECurriculumProvider
  readonly productionMaterialProvider: FinalE2EProductionMaterialProvider
  readonly studyPorts: StudyPortBundle
  readonly completionPolicy: FinalE2ECompletionPolicy
  readonly safetyPort: FinalE2ESafetyPort
  readonly backupRecovery: FinalE2EBackupRecoveryPort
  readonly persistence: FinalE2EPersistencePort
  readonly now: () => Date
}

export interface FinalFamilyPilotRuntimeFactory {
  readonly create: (input: FinalFamilyPilotRuntimeInput) => FinalFamilyPilotRuntime
}

/** The only release-facing seam. Final convergence supplies these adapters. */
export interface FinalFamilyPilotHarnessInjection {
  readonly fixtures: FinalE2EFixtureModel
  readonly curriculumProvider: FinalE2ECurriculumProvider
  readonly productionMaterialProvider: FinalE2EProductionMaterialProvider
  readonly createStudyPorts: () => StudyPortBundle
  readonly completionPolicy: FinalE2ECompletionPolicy
  readonly safetyPort: FinalE2ESafetyPort
  readonly backupRecovery: FinalE2EBackupRecoveryPort
  readonly createPersistence: () => FinalE2EPersistencePort
  readonly runtimeFactory: FinalFamilyPilotRuntimeFactory
  readonly now: () => Date
}

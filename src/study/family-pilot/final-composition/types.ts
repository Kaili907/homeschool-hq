import type { HostLessonDescriptor } from '../../curriculumAdapter'
import type { StudyPortBundle } from '../../ports'
import type { HostStudyLaunchContext } from '../../types'
import type {
  FamilyPilotStudyActionResult,
  FamilyPilotStudySession,
  FamilyPilotStudySnapshot,
} from '../study'
import type {
  FamilyPilotHelpSession,
  FamilyPilotHelpStep,
  FamilyPilotHelpSummary,
} from '../tutor'

export type FinalFamilyPilotCompletionAuthority =
  | 'LEARNER_AUTHORITY'
  | 'GUARDIAN_ATTESTATION_REQUIRED'

export type FinalFamilyPilotCompletionStatus =
  | 'NOT_COMPLETE'
  | 'PENDING_GUARDIAN_ATTESTATION'
  | 'CERTIFIED'

export interface FinalFamilyPilotAssignmentBinding {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
}

export interface FinalFamilyPilotAssignmentStatePort {
  resolve(input: {
    readonly studentRef: string
    readonly assignmentRef: string
  }): Promise<FinalFamilyPilotAssignmentBinding | null> | FinalFamilyPilotAssignmentBinding | null
}

/** Browser catalog/content bridge. Full lesson bodies remain outside this layer. */
export interface FinalFamilyPilotCurriculumLessonResolver {
  resolveLesson(input: FinalFamilyPilotAssignmentBinding):
    | Promise<HostLessonDescriptor | null>
    | HostLessonDescriptor
    | null
}

export interface FinalFamilyPilotProductionMaterial {
  /** Opaque release/material identity; never learner-authored text. */
  readonly materialRef: string
  readonly mediaAvailable: boolean
}

export type FinalFamilyPilotMaterialResolution =
  | { readonly status: 'ready'; readonly material: FinalFamilyPilotProductionMaterial }
  | { readonly status: 'unavailable'; readonly reasonCode: string }

export interface FinalFamilyPilotProductionMaterialResolver {
  resolve(input: FinalFamilyPilotAssignmentBinding & { readonly lesson: HostLessonDescriptor }):
    | Promise<FinalFamilyPilotMaterialResolution>
    | FinalFamilyPilotMaterialResolution
}

export type FinalFamilyPilotSourceReadiness =
  | { readonly status: 'ready' }
  | { readonly status: 'blocked'; readonly reasonCode: string }

/** Per-lesson by contract: one dynamic source failure must never become a subject/global hold. */
export interface FinalFamilyPilotSourceReadinessResolver {
  check(input: FinalFamilyPilotAssignmentBinding & { readonly lesson: HostLessonDescriptor }):
    | Promise<FinalFamilyPilotSourceReadiness>
    | FinalFamilyPilotSourceReadiness
}

export type FinalFamilyPilotSafetyDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false
      readonly reasonCode: string
      readonly studentMessage: string
      readonly holdRef?: string
    }

export interface FinalFamilyPilotSafetyHoldPort {
  /** Exact student/session lookup. sessionRef is null only before a first launch exists. */
  checkStudyEntry(input: FinalFamilyPilotAssignmentBinding & {
    readonly sessionRef: string | null
  }): Promise<FinalFamilyPilotSafetyDecision> | FinalFamilyPilotSafetyDecision
  clear(input: {
    readonly householdRef: string
    readonly studentRef: string
    readonly sessionRef: string
    readonly holdRef: string
    readonly clearedByRef: string
    readonly clearedAt: string
  }): Promise<{ readonly status: 'cleared' | 'not-found' | 'not-authorized' }>
}

export interface FinalFamilyPilotCompletionAuthorityPort {
  authorityFor(input: FinalFamilyPilotAssignmentBinding):
    | Promise<FinalFamilyPilotCompletionAuthority>
    | FinalFamilyPilotCompletionAuthority
}

/**
 * Minimized adult-attestation record. There is deliberately nowhere for a
 * note, answer, transcript, reflection, photo, recording, name or address.
 */
export interface FinalFamilyPilotAttestationRecord {
  readonly studentRef: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly sessionRef: string
  readonly authority: 'GUARDIAN_ATTESTATION_REQUIRED'
  readonly status: 'PENDING_GUARDIAN_ATTESTATION' | 'CERTIFIED'
  readonly learnerAssertedAt: string
  readonly attestedAt: string | null
  readonly attestedByRef: string | null
  readonly evidenceMode: 'adult-observed' | 'simulated-alternative' | null
}

export interface FinalFamilyPilotGuardianAttestationPort {
  /** Must be durable: pending/certified state is expected to survive a cold reopen. */
  read(input: FinalFamilyPilotAssignmentBinding & { readonly sessionRef: string }):
    | Promise<FinalFamilyPilotAttestationRecord | null>
    | FinalFamilyPilotAttestationRecord
    | null
  recordLearnerCompletion(input: FinalFamilyPilotAssignmentBinding & {
    readonly sessionRef: string
    readonly learnerAssertedAt: string
  }): Promise<FinalFamilyPilotAttestationRecord>
  attest(input: FinalFamilyPilotAssignmentBinding & {
    readonly sessionRef: string
    readonly attestedAt: string
    readonly attestedByRef: string
    readonly evidenceMode: 'adult-observed' | 'simulated-alternative'
  }): Promise<FinalFamilyPilotAttestationRecord>
}

export interface FinalFamilyPilotStorageHealth {
  readonly backend: 'indexeddb' | 'injected'
  readonly ready: boolean
  readonly reasonCode: string | null
  readonly previousWriteFailed: boolean
  readonly pendingWrites: number
  readonly migrationStatus: string
}

/** Injection path for an already-open accepted bundle; not another bundle semantic. */
export interface FinalFamilyPilotStoragePort {
  readonly ports: StudyPortBundle
  /** Forwarded when an already-open storage composition performed migration. */
  readonly migration?: unknown
  health(): Promise<FinalFamilyPilotStorageHealth> | FinalFamilyPilotStorageHealth
  close?(): void
}

export interface FinalFamilyPilotContext {
  readonly studentRef: string
  /** The accepted host launch context; identity fields are validated at composition. */
  readonly study: HostStudyLaunchContext
}

export type FinalFamilyPilotRejection =
  | 'assignment-not-found'
  | 'assignment-binding-mismatch'
  | 'lesson-not-found'
  | 'lesson-binding-mismatch'
  | 'source-not-ready'
  | 'material-unavailable'
  | 'safety-hold'
  | 'storage-unavailable'
  | 'guardian-attestation-unavailable'
  | 'attestation-not-pending'
  | 'adult-not-authorized'
  | 'identity-mismatch'
  | 'runtime-rejected'

export interface FinalFamilyPilotReadyStudy {
  readonly status: 'ok'
  readonly study: FamilyPilotStudySnapshot
  readonly material: FinalFamilyPilotProductionMaterial
  readonly completionStatus: FinalFamilyPilotCompletionStatus
}

export interface FinalFamilyPilotRejected {
  readonly status: 'rejected'
  readonly reason: FinalFamilyPilotRejection
  readonly message: string
  readonly detailCode?: string
}

export type FinalFamilyPilotResult = FinalFamilyPilotReadyStudy | FinalFamilyPilotRejected

export type FinalFamilyPilotAction =
  | {
      readonly status: 'ok'
      readonly action: Exclude<FamilyPilotStudyActionResult, { readonly status: 'rejected' }>
      readonly material: FinalFamilyPilotProductionMaterial
    }
  | FinalFamilyPilotRejected

export type FinalFamilyPilotTutorResult =
  | { readonly status: 'ok'; readonly step: FamilyPilotHelpStep }
  | FinalFamilyPilotRejected

export type FinalFamilyPilotAttestationResult =
  | {
      readonly status: 'ok'
      readonly study: FamilyPilotStudySnapshot
      readonly completion: FinalFamilyPilotAttestationRecord
    }
  | FinalFamilyPilotRejected

export interface FinalFamilyPilotStudyRuntimeApi {
  readonly label: 'FAMILY PILOT — FINAL STUDY COMPOSITION'
  readonly studentRef: string
  readonly ports: StudyPortBundle
  readonly migration: unknown
  start(assignmentRef: string): Promise<FinalFamilyPilotResult>
  reopen(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  snapshot(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  pause(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  resume(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  checkpoint(
    assignmentRef: string,
    session: FamilyPilotStudySession,
    responseDraftRef?: string | null,
  ): Promise<FinalFamilyPilotResult>
  completeSegment(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  submitStudyAction(input: {
    readonly assignmentRef: string
    readonly session: FamilyPilotStudySession
    readonly transientLearnerText: string
  }): Promise<FinalFamilyPilotAction>
  complete(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotResult>
  attest(input: {
    readonly assignmentRef: string
    readonly session: FamilyPilotStudySession
    readonly adultAuthorized: boolean
    readonly adultHouseholdRef: string
    readonly attestedByRef: string
    readonly evidenceMode: 'adult-observed' | 'simulated-alternative'
  }): Promise<FinalFamilyPilotAttestationResult>
  clearSafetyHold(input: {
    readonly assignmentRef: string
    readonly session: FamilyPilotStudySession
    readonly holdRef: string
    readonly adultAuthorized: boolean
    readonly adultHouseholdRef: string
    readonly clearedByRef: string
  }): Promise<{ readonly status: 'cleared' } | FinalFamilyPilotRejected>
  startTutor(assignmentRef: string, session: FamilyPilotStudySession): Promise<FinalFamilyPilotTutorResult>
  submitTutorTurn(session: FamilyPilotHelpSession, transientMessage: string): Promise<FamilyPilotHelpStep>
  closeTutor(session: FamilyPilotHelpSession): {
    readonly session: FamilyPilotHelpSession
    readonly summary: FamilyPilotHelpSummary
    readonly presentation: FamilyPilotHelpStep['presentation']
  }
  storageHealth(): Promise<FinalFamilyPilotStorageHealth>
  close(): void
}

export interface FinalFamilyPilotPreparedBinding {
  readonly binding: FinalFamilyPilotAssignmentBinding
  readonly lesson: HostLessonDescriptor
  readonly material: FinalFamilyPilotProductionMaterial
}

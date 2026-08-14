import { createHostedSyncRpcAdapter } from '../../src/study/hosted-sync/v2/client/rpcAdapter'
import { createLocalDbRpcEmulator, type LocalDbRpcEmulator } from '../../src/study/hosted-sync/v2/client/testing/localDbRpcEmulator'
import type { HostedSyncFirstLinkImport, HostedSyncRpcAdapter, HostedSyncWriteInput, HostedSyncWriteOperation } from '../../src/study/hosted-sync/v2/client/types'

export const NOW = '2026-08-13T18:00:00.000Z'
export const GUARDIAN_DIGEST = 'a'.repeat(64)
export const STUDENT_DIGEST = 'b'.repeat(64)
export const STUDENT_ID = '00000000-0000-4000-8000-000000000101'
export const OTHER_STUDENT_ID = '00000000-0000-4000-8000-000000000102'
export const ASSIGNMENT = 'assignment-math'
export const SESSION = 'session-math'
export const LOCAL_SCOPE = Object.freeze({ householdRef: 'household:alpha', studentRef: 'student:ada', assignmentRef: 'local:assignment:math', sessionRef: 'local:session:math' })

export function checkpoint(revision: number, completedSegmentIds: readonly string[] = []): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contract: 'study-core-bridge.recovery-checkpoint.v1', contractVersion: 1,
    checkpointId: 'checkpoint-math', revision, createdAt: NOW, updatedAt: NOW,
    sessionId: LOCAL_SCOPE.sessionRef, lessonId: 'lesson-math', segmentId: `segment-${revision}`,
    safeInstructionalCursor: { tutorPhase: 'guided-practice', cycleNumber: 2, currentItemId: 'item-2', currentItemIndex: 1, teachingTurnIndex: 4 },
    completedSegmentIds: [...completedSegmentIds], perSegmentActiveTime: completedSegmentIds.map((segmentId) => ({ segmentId, activeSeconds: 91 })),
    pausedSeconds: 8, breakSeconds: 12, protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:math', lastAcceptedEventId: null, eventVersion: 1,
    tutorInteractionRef: 'interaction-math', technicalInterruption: { status: 'none', interruptionId: null, category: 'none', startedAt: null },
    rawAnswerIncluded: false, transcriptIncluded: false,
  })
}

export function firstLinkImport(): HostedSyncFirstLinkImport {
  return Object.freeze({
    localScope: LOCAL_SCOPE,
    hostedScope: { assignmentRef: ASSIGNMENT, sessionRef: SESSION },
    session: { lessonRef: 'lesson-math', subjectRef: 'mathematics', state: 'active', startedAt: NOW, completedAt: null, intendedLocalDate: '2026-08-13' },
    checkpoint: checkpoint(1), socialSource: null, guardianAttestation: null,
    safetyState: { schemaVersion: 1, holds: [] }, assessment: null,
  })
}

export function operationId(index: number): string {
  return `10000000-0000-4000-8000-${index.toString().padStart(12, '0')}`
}

export class ConvergedR2Harness {
  readonly provider: LocalDbRpcEmulator
  readonly a: HostedSyncRpcAdapter
  readonly b: HostedSyncRpcAdapter
  private onlineA = true
  private onlineB = true

  constructor() {
    this.provider = createLocalDbRpcEmulator({ now: () => new Date(NOW) })
    this.provider.setRole(GUARDIAN_DIGEST, 'guardian')
    this.provider.setRole(STUDENT_DIGEST, 'student')
    const auth = { acquire: async () => ({ status: 'AUTHORIZED' as const, lease: { clientKind: 'AUTHENTICATED_USER' as const, expiresAt: '2027-08-13T00:00:00.000Z', provider: this.provider } }) }
    this.a = createHostedSyncRpcAdapter({ authorization: auth, isOnline: () => this.onlineA, now: () => new Date(NOW) })
    this.b = createHostedSyncRpcAdapter({ authorization: auth, isOnline: () => this.onlineB, now: () => new Date(NOW) })
  }

  setOnline(device: 'a' | 'b', online: boolean): void { if (device === 'a') this.onlineA = online; else this.onlineB = online }

  firstLink(client = this.a, id = operationId(1), imported = firstLinkImport()) {
    return client.firstLink({ tokenDigest: GUARDIAN_DIGEST, studentId: STUDENT_ID, clientOperationId: id, import: imported })
  }

  resolve(client = this.a, localScope = LOCAL_SCOPE, studentId = STUDENT_ID) {
    return client.resolveMapping({ tokenDigest: GUARDIAN_DIGEST, studentId, localScope })
  }

  hydrate(client = this.a, studentId = STUDENT_ID) {
    return client.hydrate({ tokenDigest: GUARDIAN_DIGEST, studentId, assignmentRef: ASSIGNMENT, sessionId: SESSION })
  }

  write(client: HostedSyncRpcAdapter, values: { revision: number; id: number; operation: HostedSyncWriteOperation; payload: Readonly<Record<string, unknown>>; tokenDigest?: string }) {
    const input: HostedSyncWriteInput = {
      tokenDigest: values.tokenDigest ?? GUARDIAN_DIGEST, studentId: STUDENT_ID,
      assignmentRef: ASSIGNMENT, sessionId: SESSION, expectedRevision: values.revision,
      clientOperationId: operationId(values.id), operation: values.operation, payload: values.payload,
    }
    return client.write(input)
  }
}

export const SOURCE = Object.freeze({ studentRef: LOCAL_SCOPE.studentRef, assignmentRef: LOCAL_SCOPE.assignmentRef, lessonRef: 'lesson-math', sourceRef: 'source:constitution', title: 'The Constitution', publisher: 'National Archives', publishedAt: NOW, attachedAt: NOW, status: 'ATTACHED_SATISFIED' })
export const ASSERTION = Object.freeze({ studentRef: LOCAL_SCOPE.studentRef, assignmentRef: LOCAL_SCOPE.assignmentRef, lessonRef: 'lesson-math', sessionRef: LOCAL_SCOPE.sessionRef, authority: 'GUARDIAN_ATTESTATION_REQUIRED', status: 'PENDING_GUARDIAN_ATTESTATION', learnerAssertedAt: NOW, attestedAt: null, attestedByRef: null, evidenceMode: null })
export const CERTIFIED = Object.freeze({ ...ASSERTION, status: 'CERTIFIED', attestedAt: NOW, attestedByRef: 'adult:guardian', evidenceMode: 'adult-observed' })
export const HOLD = Object.freeze({ schemaVersion: 1, holdRef: 'hold:math', studentRef: LOCAL_SCOPE.studentRef, sessionRef: LOCAL_SCOPE.sessionRef, createdAt: NOW, status: 'open', reasonCode: 'study-safety-uncertain', source: 'study-safety', dedupeKey: 'student:ada|session:math|uncertain' })
export const ASSESSMENT = Object.freeze({ assignmentRef: LOCAL_SCOPE.assignmentRef, assessmentRef: 'assessment:math', studentRef: LOCAL_SCOPE.studentRef, courseRef: 'course:math', subject: 'mathematics', grade: 5, title: 'Math assessment', authorityClass: 'AUTO_SCOREABLE', status: 'ACTIVE', createdAt: NOW, updatedAt: NOW, completedAt: null })

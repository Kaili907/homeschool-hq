import { digestLocalPin } from '../../src/study/family-pilot/final-app/state'
import type { FinalAssessmentAttemptV1 } from '../../src/study/family-pilot/final-app/assessment'
import type { LearnerAssessmentReceipt, LearnerResponseRecord } from '../../src/study/family-pilot/final-app/learner-response/types'
import type { FinalFamilyPilotAssessmentAssignment } from '../../src/study/family-pilot/final-app/state'
import type { FinalFamilyPilotAttestationRecord } from '../../src/study/family-pilot/final-composition'
import type { SafetyHoldV1 } from '../../src/study/family-pilot/safety'
import {
  ASSESSMENT_ASSIGNMENT,
  ASSESSMENT_MATH,
  ASSIGNMENT_MATH,
  FIXED_NOW,
  HOUSEHOLD_ALPHA,
  HOUSEHOLD_BETA,
  LESSON_MATH,
  R2_SCHEMA_VERSION,
  SEGMENTS_MATH,
  SESSION_MATH,
  STUDENT_ADA,
  STUDENT_GRACE,
  assignmentFixture,
  clone,
  createEmptyDeviceState,
  createLearnerDocument,
  fullAppState,
  fullCoreState,
  hasOpenSafetyHold,
  parseHouseholdSnapshot,
  validateLearnerDocument,
  type FirstLinkRequestR2,
  type HouseholdSnapshotR2,
  type LearnerSyncDocumentR2,
  type PullRequestR2,
  type PushRequestR2,
  type R2RpcRequest,
  type R2RpcResponse,
  type R2Session,
  type SyncMutationR2,
  type SyncOperationR2,
} from './model'

type Failure = 'offline' | '401' | '403' | '500' | 'lost-ack' | 'corrupt-remote' | 'reordered-response'

interface PendingMutation {
  request: SyncMutationR2
  attempts: number
}

function replaceBy<T>(values: readonly T[], key: (value: T) => string, next: T): readonly T[] {
  return Object.freeze([...values.filter((value) => key(value) !== key(next)), clone(next)])
}

function updateAssignment(
  document: LearnerSyncDocumentR2,
  assignmentRef: string,
  updater: (assignment: LearnerSyncDocumentR2['coreStudent']['assignments'][number]) => LearnerSyncDocumentR2['coreStudent']['assignments'][number],
): LearnerSyncDocumentR2 {
  const assignments = document.coreStudent.assignments.map((assignment) =>
    assignment.assignmentRef === assignmentRef ? updater(assignment) : assignment)
  return {
    ...document,
    coreStudent: { ...document.coreStudent, assignments: Object.freeze(assignments) },
  }
}

function nextSegment(completed: readonly string[]): string {
  return SEGMENTS_MATH.find((segmentRef) => !completed.includes(segmentRef)) ?? SEGMENTS_MATH.at(-1)!
}

/** Applies one domain mutation to current learner-release records. Server receipt time is authoritative. */
export function applyOperation(
  current: LearnerSyncDocumentR2,
  operation: SyncOperationR2,
  acceptedAt: string,
): LearnerSyncDocumentR2 {
  let next = clone(current)
  if (operation.type === 'assign') {
    if (!next.coreStudent.assignments.some((item) => item.assignmentRef === operation.assignment.assignmentRef)) {
      next = {
        ...next,
        coreStudent: {
          ...next.coreStudent,
          activeAssignmentRef: operation.assignment.assignmentRef,
          assignments: Object.freeze([...next.coreStudent.assignments, clone(operation.assignment)]),
          updatedAt: acceptedAt,
        },
      }
    }
  } else if (operation.type === 'start') {
    if (hasOpenSafetyHold(next)) throw new Error('safety-hold')
    if (operation.lessonRef.includes('social-studies') && !next.app.sourceAttachments.some((item) =>
      item.assignmentRef === operation.assignmentRef && item.status === 'ATTACHED_SATISFIED')) {
      throw new Error('qualifying-source-required')
    }
    next = updateAssignment(next, operation.assignmentRef, (assignment) => ({
      ...assignment,
      state: assignment.state === 'completed' ? 'completed' : 'active',
      sessionRef: operation.sessionRef,
      updatedAt: acceptedAt,
    }))
    const session = {
      scope: { householdRef: next.householdRef, learnerRef: next.studentRef, sessionRef: operation.sessionRef },
      lessonRef: operation.lessonRef,
      segmentRef: nextSegment([]),
      status: 'active' as const,
      updatedAt: acceptedAt,
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false as const,
      transcriptIncluded: false as const,
    }
    next = {
      ...next,
      app: {
        ...next.app,
        sessions: replaceBy(next.app.sessions, (item) => item.assignmentRef, {
          studentRef: next.studentRef,
          assignmentRef: operation.assignmentRef,
          session: { householdRef: next.householdRef, learnerRef: next.studentRef, blockRef: `block:${operation.assignmentRef}`, sessionRef: operation.sessionRef },
        }),
      },
      durableStudy: {
        ...next.durableStudy,
        updatedAt: acceptedAt,
        sessions: replaceBy(next.durableStudy.sessions, (item) => item.scope.sessionRef, session),
      },
    }
  } else if (operation.type === 'complete-segment') {
    if (hasOpenSafetyHold(next)) throw new Error('safety-hold')
    const held = next.coreStudent.assignments.find((item) => item.assignmentRef === operation.assignmentRef)
    if (!held) throw new Error('assignment-not-found')
    const completed = Object.freeze([...new Set([...held.progress.completedSegmentRefs, operation.segmentRef])])
    next = updateAssignment(next, operation.assignmentRef, (assignment) => ({
      ...assignment,
      state: assignment.state === 'completed' ? 'completed' : 'active',
      sessionRef: operation.sessionRef,
      progress: {
        ...assignment.progress,
        completedSegmentRefs: completed,
        lastSegmentRef: operation.segmentRef,
        activeSeconds: Math.max(assignment.progress.activeSeconds, operation.activeSeconds),
      },
      updatedAt: acceptedAt,
    }))
    const checkpoint = {
      checkpointRef: `checkpoint:${operation.sessionRef}`,
      householdRef: next.householdRef,
      learnerRef: next.studentRef,
      sessionRef: operation.sessionRef,
      lessonRef: operation.lessonRef,
      segmentRef: nextSegment(completed),
      revision: (next.durableStudy.checkpoints.find((item) => item.sessionRef === operation.sessionRef)?.revision ?? 0) + 1,
      capturedAt: acceptedAt,
      completedSegmentRefs: completed,
      elapsedActiveSecondsInSegment: operation.activeSeconds,
      responseDraftRef: null,
      rawAnswerIncluded: false as const,
      transcriptIncluded: false as const,
    }
    const sessions = next.durableStudy.sessions.map((session) => session.scope.sessionRef === operation.sessionRef
      ? { ...session, segmentRef: checkpoint.segmentRef, updatedAt: acceptedAt }
      : session)
    next = {
      ...next,
      durableStudy: {
        ...next.durableStudy,
        updatedAt: acceptedAt,
        sessions: Object.freeze(sessions),
        checkpoints: replaceBy(next.durableStudy.checkpoints, (item) => item.sessionRef, checkpoint),
      },
    }
  } else if (operation.type === 'save-response') {
    if (operation.response.studentRef !== next.studentRef) throw new Error('student-scope-forbidden')
    next = {
      ...next,
      learnerResponses: replaceBy(
        next.learnerResponses,
        (item) => `${item.attemptRef}|${item.itemRef}`,
        { ...operation.response, savedAt: acceptedAt },
      ),
    }
  } else if (operation.type === 'score-response') {
    if (!operation.receipt.assessorRef.startsWith('trusted:')) throw new Error('answer-authority-forbidden')
    const found = next.learnerResponses.find((item) => item.itemRef === operation.itemRef)
    if (!found) throw new Error('response-not-found')
    next = {
      ...next,
      learnerResponses: replaceBy(next.learnerResponses, (item) => `${item.attemptRef}|${item.itemRef}`, {
        ...found,
        status: 'ASSESSED',
        assessment: { ...operation.receipt, assessedAt: acceptedAt },
      }),
    }
  } else if (operation.type === 'assign-assessment') {
    next = {
      ...next,
      app: {
        ...next.app,
        assessmentAssignments: replaceBy(next.app.assessmentAssignments, (item) => item.assignmentRef, {
          ...operation.assignment,
          updatedAt: acceptedAt,
        }),
      },
    }
  } else if (operation.type === 'set-assessment-attempt') {
    if (operation.attempt.studentRef !== next.studentRef) throw new Error('student-scope-forbidden')
    next = {
      ...next,
      assessmentAttempts: replaceBy(next.assessmentAttempts, (item) => item.assignmentRef, {
        ...operation.attempt,
        updatedAt: acceptedAt,
      }),
      app: {
        ...next.app,
        assessmentAssignments: next.app.assessmentAssignments.map((item) => item.assignmentRef === operation.attempt.assignmentRef
          ? { ...item, status: operation.attempt.status, updatedAt: acceptedAt, completedAt: operation.attempt.status === 'CERTIFIED' ? acceptedAt : item.completedAt }
          : item),
      },
    }
  } else if (operation.type === 'finish') {
    if (hasOpenSafetyHold(next)) throw new Error('safety-hold')
    if (operation.authority === 'STANDARD') {
      next = updateAssignment(next, operation.assignmentRef, (assignment) => ({
        ...assignment,
        state: 'completed',
        completedAt: assignment.completedAt ?? acceptedAt,
        updatedAt: acceptedAt,
      }))
      next = {
        ...next,
        durableStudy: {
          ...next.durableStudy,
          updatedAt: acceptedAt,
          sessions: next.durableStudy.sessions.map((session) => session.scope.sessionRef === SESSION_MATH
            ? { ...session, status: 'completed' as const, updatedAt: acceptedAt }
            : session),
        },
      }
    } else {
      const assignment = next.coreStudent.assignments.find((item) => item.assignmentRef === operation.assignmentRef)
      if (!assignment?.sessionRef) throw new Error('session-not-found')
      const pending: FinalFamilyPilotAttestationRecord = {
        studentRef: next.studentRef,
        assignmentRef: operation.assignmentRef,
        lessonRef: assignment.lessonRef,
        sessionRef: assignment.sessionRef,
        authority: 'GUARDIAN_ATTESTATION_REQUIRED',
        status: 'PENDING_GUARDIAN_ATTESTATION',
        learnerAssertedAt: acceptedAt,
        attestedAt: null,
        attestedByRef: null,
        evidenceMode: null,
      }
      next = { ...next, app: { ...next.app, attestations: replaceBy(next.app.attestations, (item) => item.assignmentRef, pending) } }
    }
  } else if (operation.type === 'attest') {
    if (operation.attestation.status !== 'CERTIFIED') throw new Error('attestation-not-certified')
    next = updateAssignment(next, operation.attestation.assignmentRef, (assignment) => ({
      ...assignment,
      state: 'completed',
      completedAt: assignment.completedAt ?? acceptedAt,
      updatedAt: acceptedAt,
    }))
    next = { ...next, app: { ...next.app, attestations: replaceBy(next.app.attestations, (item) => item.assignmentRef, { ...operation.attestation, attestedAt: acceptedAt }) } }
  } else if (operation.type === 'attach-source') {
    if (operation.attachment.studentRef !== next.studentRef) throw new Error('student-scope-forbidden')
    next = { ...next, app: { ...next.app, sourceAttachments: replaceBy(next.app.sourceAttachments, (item) => item.assignmentRef, { ...operation.attachment, attachedAt: acceptedAt }) } }
  } else if (operation.type === 'place-safety-hold') {
    if (operation.hold.studentRef !== next.studentRef) throw new Error('student-scope-forbidden')
    next = { ...next, app: { ...next.app, safetyHolds: replaceBy(next.app.safetyHolds, (item) => item.holdRef, { ...operation.hold, createdAt: acceptedAt }) } }
  } else if (operation.type === 'clear-safety-hold') {
    const found = next.app.safetyHolds.find((item) => item.holdRef === operation.holdRef)
    if (!found) throw new Error('hold-not-found')
    next = {
      ...next,
      app: {
        ...next.app,
        safetyHolds: replaceBy(next.app.safetyHolds, (item) => item.holdRef, {
          ...found,
          status: 'cleared',
          clearedAt: acceptedAt,
          clearedBy: operation.clearedBy,
        }),
      },
    }
  }
  return clone(next)
}

export class IndependentDeviceStore {
  readonly storageIdentity = Object.freeze({})
  householdRef: string | null = null
  learners = new Map<string, LearnerSyncDocumentR2>()
  pending: PendingMutation[] = []
  cursor = 0
  lastError: R2RpcResponse['status'] | null = null
  core = createEmptyDeviceState().core
  app = createEmptyDeviceState().app

  seed(householdRef: string, learners: readonly LearnerSyncDocumentR2[], pinDigests: Readonly<Record<string, string>> = {}): void {
    this.householdRef = householdRef
    this.learners = new Map(learners.map((learner) => [learner.studentRef, clone(learner)]))
    this.reproject(pinDigests)
  }

  replace(snapshot: HouseholdSnapshotR2): void {
    const pinDigests = this.app.pinDigests
    this.householdRef = snapshot.householdRef
    this.learners = new Map(snapshot.learners.map((learner) => [learner.studentRef, clone(learner)]))
    this.cursor = snapshot.cursor
    this.reproject(pinDigests)
  }

  replaceLearner(learner: LearnerSyncDocumentR2): void {
    this.learners.set(learner.studentRef, clone(learner))
    this.reproject(this.app.pinDigests)
  }

  private reproject(pinDigests: Readonly<Record<string, string>>): void {
    const learners = [...this.learners.values()]
    const now = learners.reduce((latest, learner) => learner.serverAcceptedAt > latest ? learner.serverAcceptedAt : latest, FIXED_NOW)
    this.core = fullCoreState(learners, now)
    this.app = { ...fullAppState(learners, this.householdRef ?? HOUSEHOLD_ALPHA, now), pinDigests: Object.freeze({ ...pinDigests }) }
  }

  persistedCanary(): string {
    return JSON.stringify({ householdRef: this.householdRef, core: this.core, app: this.app, learners: [...this.learners.values()], pending: this.pending })
  }
}

export class InMemoryR2Server {
  private households = new Map<string, Map<string, LearnerSyncDocumentR2>>()
  private cursorByHousehold = new Map<string, number>()
  private idempotent = new Map<string, R2RpcResponse>()
  private linkedDevices = new Set<string>()
  private invalidSessions = new Set<string>()
  readonly received: Array<{ session: R2Session; request: R2RpcRequest }> = []
  private tick = 0

  now(): string {
    return new Date(Date.parse(FIXED_NOW) + this.tick++ * 1_000).toISOString()
  }

  invalidate(sessionRef: string): void {
    this.invalidSessions.add(sessionRef)
  }

  private authorized(session: R2Session, householdRef: string): R2RpcResponse | null {
    if (this.invalidSessions.has(session.sessionRef) || Date.parse(session.expiresAt) <= Date.parse(this.now())) {
      return { status: 'auth-error', requestRef: '', reasonCode: 'session-expired' }
    }
    if (session.householdRef !== householdRef) return { status: 'forbidden', requestRef: '', reasonCode: 'wrong-household' }
    return null
  }

  private household(householdRef: string): Map<string, LearnerSyncDocumentR2> {
    let found = this.households.get(householdRef)
    if (!found) {
      found = new Map()
      this.households.set(householdRef, found)
      this.cursorByHousehold.set(householdRef, 0)
    }
    return found
  }

  private visible(session: R2Session, householdRef: string): HouseholdSnapshotR2 {
    const all = [...this.household(householdRef).values()]
    const learners = session.role === 'parent' ? all : all.filter((learner) => session.authorizedStudentRefs.includes(learner.studentRef))
    return { schemaVersion: R2_SCHEMA_VERSION, householdRef, learners: clone(learners), cursor: this.cursorByHousehold.get(householdRef) ?? 0 }
  }

  private bump(householdRef: string): void {
    this.cursorByHousehold.set(householdRef, (this.cursorByHousehold.get(householdRef) ?? 0) + 1)
  }

  async receive(session: R2Session, request: R2RpcRequest): Promise<R2RpcResponse> {
    this.received.push({ session: clone(session), request: clone(request) })
    const auth = this.authorized(session, request.householdRef)
    if (auth) return { ...auth, requestRef: request.requestRef } as R2RpcResponse
    if (request.rpc === 'family_pilot_sync_first_link_r2') return this.firstLink(session, request)
    if (request.rpc === 'family_pilot_sync_pull_r2') {
      return { status: 'ok', requestRef: request.requestRef, snapshot: this.visible(session, request.householdRef), duplicate: false }
    }
    return this.push(session, request)
  }

  private firstLink(session: R2Session, request: FirstLinkRequestR2): R2RpcResponse {
    const key = `${request.householdRef}|${request.deviceInstallRef}`
    const duplicate = this.linkedDevices.has(key)
    const household = this.household(request.householdRef)
    if (!duplicate) {
      for (const candidate of request.localLearners) {
        if (candidate.householdRef !== request.householdRef || !validateLearnerDocument(candidate)) {
          return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'corrupt-remote-state' }
        }
        if (session.role === 'student' && !session.authorizedStudentRefs.includes(candidate.studentRef)) {
          return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'student-scope-forbidden' }
        }
        if (!household.has(candidate.studentRef)) {
          household.set(candidate.studentRef, { ...clone(candidate), serverRevision: 1, serverAcceptedAt: this.now() })
          this.bump(request.householdRef)
        }
      }
      this.linkedDevices.add(key)
    }
    return { status: 'ok', requestRef: request.requestRef, snapshot: this.visible(session, request.householdRef), duplicate }
  }

  private push(session: R2Session, request: PushRequestR2): R2RpcResponse {
    const serialized = JSON.stringify(request)
    if (/pinDigest|bearerToken|transcript(?!Included)|adultScoringAuthorityRef|answerKey|correctAnswer|rubric/i.test(serialized)) {
      return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'malformed-response' }
    }
    for (const mutation of request.mutations) {
      const prior = this.idempotent.get(mutation.idempotencyKey)
      if (prior) return { ...clone(prior), requestRef: request.requestRef, duplicate: true } as R2RpcResponse
      if (mutation.householdRef !== request.householdRef) return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'wrong-household' }
      if (session.role === 'student' && !session.authorizedStudentRefs.includes(mutation.studentRef)) {
        return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'student-scope-forbidden' }
      }
      if ((mutation.operation.type === 'attest' || mutation.operation.type === 'clear-safety-hold') && session.role !== 'parent') {
        return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'parent-role-required' }
      }
      const current = this.household(request.householdRef).get(mutation.studentRef)
      if (!current) return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'corrupt-remote-state' }
      if (mutation.baseRevision !== current.serverRevision) return { status: 'stale', requestRef: request.requestRef, remote: clone(current) }
      let applied: LearnerSyncDocumentR2
      try {
        applied = applyOperation(current, mutation.operation, this.now())
      } catch (error) {
        if (error instanceof Error && error.message === 'student-scope-forbidden') {
          return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'student-scope-forbidden' }
        }
        return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'malformed-response' }
      }
      const authoritative = { ...applied, serverRevision: current.serverRevision + 1, serverAcceptedAt: this.now() }
      if (!validateLearnerDocument(authoritative)) return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'corrupt-remote-state' }
      this.household(request.householdRef).set(mutation.studentRef, authoritative)
      this.bump(request.householdRef)
      const result: R2RpcResponse = { status: 'ok', requestRef: request.requestRef, snapshot: this.visible(session, request.householdRef), duplicate: false }
      this.idempotent.set(mutation.idempotencyKey, clone(result))
    }
    return { status: 'ok', requestRef: request.requestRef, snapshot: this.visible(session, request.householdRef), duplicate: false }
  }

  snapshot(householdRef = HOUSEHOLD_ALPHA): HouseholdSnapshotR2 {
    const parent = sessionFor('parent-alpha', 'server-inspection')
    return this.visible(parent, householdRef)
  }

  corruptLearner(studentRef: string): void {
    const learner = this.household(HOUSEHOLD_ALPHA).get(studentRef)
    if (learner) this.household(HOUSEHOLD_ALPHA).set(studentRef, { ...learner, durableStudy: { ...learner.durableStudy, schemaVersion: 99 } as never })
  }
}

function sessionFor(credential: string, deviceRef: string): R2Session {
  if (credential === 'parent-alpha') return {
    sessionRef: `auth:${deviceRef}:alpha`, householdRef: HOUSEHOLD_ALPHA, actorRef: 'parent:alpha', role: 'parent',
    authorizedStudentRefs: [STUDENT_ADA, STUDENT_GRACE], bearerToken: `secret-bearer:${deviceRef}`, expiresAt: '2027-08-13T00:00:00.000Z',
  }
  if (credential === 'student-ada') return {
    sessionRef: `auth:${deviceRef}:ada`, householdRef: HOUSEHOLD_ALPHA, actorRef: STUDENT_ADA, role: 'student',
    authorizedStudentRefs: [STUDENT_ADA], bearerToken: `secret-bearer:${deviceRef}`, expiresAt: '2027-08-13T00:00:00.000Z',
  }
  return {
    sessionRef: `auth:${deviceRef}:beta`, householdRef: HOUSEHOLD_BETA, actorRef: 'parent:beta', role: 'parent',
    authorizedStudentRefs: ['student:beta'], bearerToken: `secret-bearer:${deviceRef}`, expiresAt: '2027-08-13T00:00:00.000Z',
  }
}

export class HostedSyncDeviceR2 {
  private session: R2Session | null = null
  private online = true
  private failures: Failure[] = []
  private sequence = 0
  readonly tutorTranscript: string[] = []

  constructor(
    readonly deviceRef: string,
    readonly store: IndependentDeviceStore,
    readonly server: InMemoryR2Server,
    readonly clockOffsetMs = 0,
  ) {}

  get authorized(): boolean { return this.session !== null }
  get state() { return this.store }

  setupLocalHousehold(includeSibling = true): void {
    const learners = [createLearnerDocument(STUDENT_ADA)]
    if (includeSibling) learners.push(createLearnerDocument(STUDENT_GRACE))
    const math = assignmentFixture({ assignmentRef: ASSIGNMENT_MATH, lessonRef: LESSON_MATH, subject: 'mathematics', title: 'Place Value Reasoning' })
    learners[0] = applyOperation(learners[0]!, { type: 'assign', assignment: math }, FIXED_NOW)
    this.store.seed(HOUSEHOLD_ALPHA, learners, { [STUDENT_ADA]: digestLocalPin('2468') })
  }

  async signIn(credential: 'parent-alpha' | 'student-ada' | 'parent-beta'): Promise<void> {
    this.session = sessionFor(credential, this.deviceRef)
  }

  async firstLink(): Promise<R2RpcResponse> {
    const session = this.requireSession()
    const request: FirstLinkRequestR2 = {
      rpc: 'family_pilot_sync_first_link_r2', requestRef: this.ref('link'), deviceInstallRef: this.deviceRef,
      householdRef: session.householdRef, localLearners: clone([...this.store.learners.values()]),
    }
    return this.sendAndAccept(request)
  }

  async hydrate(householdRef = this.requireSession().householdRef): Promise<R2RpcResponse> {
    const request: PullRequestR2 = { rpc: 'family_pilot_sync_pull_r2', requestRef: this.ref('pull'), householdRef, afterCursor: this.store.cursor }
    return this.sendAndAccept(request)
  }

  mutate(studentRef: string, operation: SyncOperationR2): { status: 'queued' | 'forbidden' | 'safety-blocked'; reasonCode?: string } {
    const session = this.requireSession()
    if (!session.authorizedStudentRefs.includes(studentRef)) return { status: 'forbidden', reasonCode: 'student-scope-forbidden' }
    if ((operation.type === 'attest' || operation.type === 'clear-safety-hold') && session.role !== 'parent') return { status: 'forbidden', reasonCode: 'parent-role-required' }
    const current = this.store.learners.get(studentRef)
    if (!current) return { status: 'forbidden', reasonCode: 'student-scope-forbidden' }
    let local: LearnerSyncDocumentR2
    try { local = applyOperation(current, operation, this.deviceNow()) } catch (error) {
      const reasonCode = error instanceof Error ? error.message : 'mutation-refused'
      return reasonCode === 'qualifying-source-required'
        ? { status: 'forbidden', reasonCode }
        : { status: 'safety-blocked', reasonCode }
    }
    const request: SyncMutationR2 = {
      requestRef: this.ref('mutation'), idempotencyKey: `${this.deviceRef}:idem:${this.sequence}`,
      householdRef: session.householdRef, studentRef, baseRevision: current.serverRevision,
      deviceOccurredAt: this.deviceNow(), operation: clone(operation),
    }
    this.store.replaceLearner(local)
    this.store.pending.push({ request, attempts: 0 })
    return { status: 'queued' }
  }

  async sync(): Promise<R2RpcResponse> {
    const session = this.requireSession()
    const pending = this.store.pending[0]
    if (!pending) return this.hydrate()
    const request: PushRequestR2 = { rpc: 'family_pilot_sync_push_r2', requestRef: pending.request.requestRef, householdRef: session.householdRef, mutations: [pending.request] }
    const response = await this.send(request)
    pending.attempts += 1
    if (response.status === 'stale') {
      // Server revision and receipt order decide truth. Reapply the semantic operation to the remote state.
      this.store.replaceLearner(response.remote)
      let rebased: LearnerSyncDocumentR2
      try {
        rebased = applyOperation(response.remote, pending.request.operation, this.deviceNow())
      } catch (error) {
        if (error instanceof Error && error.message === 'safety-hold') {
          this.store.pending.shift()
          this.store.lastError = 'safety-blocked'
          return { status: 'safety-blocked', requestRef: request.requestRef, reasonCode: 'safety-hold' }
        }
        throw error
      }
      this.store.replaceLearner(rebased)
      pending.request = { ...pending.request, requestRef: this.ref('retry'), baseRevision: response.remote.serverRevision }
      return this.sync()
    }
    if (response.status === 'ok') {
      this.store.pending.shift()
      this.acceptSnapshot(response.snapshot, request.requestRef)
    } else if (response.status === 'auth-error') {
      this.session = null
      this.store.lastError = response.status
    } else {
      this.store.lastError = response.status
    }
    return response
  }

  async logout(): Promise<void> { this.session = null }
  expireAuth(): void { if (this.session) this.server.invalidate(this.session.sessionRef) }
  setOnline(online: boolean): void { this.online = online }
  injectNext(failure: Failure): void { this.failures.push(failure) }
  addTutorTurn(text: string): void { this.tutorTranscript.push(text) }

  document(studentRef = STUDENT_ADA): LearnerSyncDocumentR2 {
    const value = this.store.learners.get(studentRef)
    if (!value) throw new Error(`learner-not-found:${studentRef}`)
    return clone(value)
  }

  private ref(kind: string): string { return `${this.deviceRef}:${kind}:${++this.sequence}` }
  private deviceNow(): string { return new Date(Date.parse(FIXED_NOW) + this.clockOffsetMs + this.sequence * 1_000).toISOString() }
  private requireSession(): R2Session { if (!this.session) throw new Error('device-auth-required'); return this.session }

  private async send(request: R2RpcRequest): Promise<R2RpcResponse> {
    if (!this.online) return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'offline' }
    const injected = this.failures.shift()
    if (injected === '401') { this.expireAuth() }
    if (injected === '403') return { status: 'forbidden', requestRef: request.requestRef, reasonCode: 'wrong-household' }
    if (injected === '500') return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'server-error' }
    if (injected === 'reordered-response') return { status: 'invalid-response', requestRef: request.requestRef, reasonCode: 'reordered-response' }
    if (injected === 'corrupt-remote') this.server.corruptLearner(STUDENT_ADA)
    const response = await this.server.receive(this.requireSession(), request)
    if (injected === 'lost-ack' && response.status === 'ok') return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'lost-ack' }
    return response
  }

  private async sendAndAccept(request: R2RpcRequest): Promise<R2RpcResponse> {
    const response = await this.send(request)
    if (response.status === 'ok') this.acceptSnapshot(response.snapshot, request.requestRef)
    else this.store.lastError = response.status
    return response
  }

  private acceptSnapshot(value: unknown, requestRef: string): void {
    const session = this.requireSession()
    const parsed = parseHouseholdSnapshot(value, session.householdRef)
    if (!parsed) {
      this.store.lastError = 'invalid-response'
      throw new Error(`corrupt-remote-state:${requestRef}`)
    }
    this.store.replace(parsed)
    this.store.lastError = null
  }
}

export class HostedSyncHarnessR2 {
  readonly server = new InMemoryR2Server()
  readonly devices: HostedSyncDeviceR2[] = []

  createDevice(deviceRef: string, options: { clockOffsetMs?: number; store?: IndependentDeviceStore } = {}): HostedSyncDeviceR2 {
    const store = options.store ?? new IndependentDeviceStore()
    if (this.devices.some((device) => device.store.storageIdentity === store.storageIdentity)) throw new Error('shared-device-storage-detected')
    const device = new HostedSyncDeviceR2(deviceRef, store, this.server, options.clockOffsetMs ?? 0)
    this.devices.push(device)
    return device
  }

  assertUploadCanaries(): void {
    const requests = JSON.stringify(this.server.received.map((entry) => entry.request))
    if (/2468|pinDigest|secret-bearer|transcript(?!Included)|adultScoringAuthorityRef|answerKey|correctAnswer|rubric/i.test(requests)) {
      throw new Error('forbidden-upload-detected')
    }
    if (!requests.includes('learnerResponses') && !requests.includes('save-response')) throw new Error('learner-response-sync-not-exercised')
  }
}

export function mathResponse(overrides: Partial<LearnerResponseRecord> = {}): LearnerResponseRecord {
  return {
    schemaVersion: 1,
    lessonRef: LESSON_MATH,
    studentRef: STUDENT_ADA,
    assignmentRef: ASSIGNMENT_MATH,
    attemptRef: SESSION_MATH,
    sectionRef: `${LESSON_MATH}:practice`,
    itemRef: `${LESSON_MATH}:item:place-value-1`,
    segmentRef: SEGMENTS_MATH[1]!,
    responseType: 'NUMERIC',
    evidenceMode: 'INDEPENDENT',
    response: { kind: 'NUMERIC', text: '420' },
    status: 'PENDING_ASSESSMENT',
    savedAt: FIXED_NOW,
    assessment: null,
    ...overrides,
  }
}

export function assessmentAssignment(status: FinalFamilyPilotAssessmentAssignment['status'] = 'PLANNED'): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef: ASSESSMENT_ASSIGNMENT,
    assessmentRef: ASSESSMENT_MATH,
    studentRef: STUDENT_ADA,
    courseRef: 'ma-g5-mathematics',
    subject: 'mathematics',
    grade: 5,
    title: 'Grade 5 Mathematics Unit 1 Assessment',
    authorityClass: 'AUTO_SCOREABLE',
    status,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    completedAt: status === 'CERTIFIED' ? FIXED_NOW : null,
  }
}

export function assessmentAttempt(status: FinalAssessmentAttemptV1['status'] = 'PENDING_ASSESSMENT'): FinalAssessmentAttemptV1 {
  return {
    schemaVersion: 1,
    assignmentRef: ASSESSMENT_ASSIGNMENT,
    assessmentRef: ASSESSMENT_MATH,
    studentRef: STUDENT_ADA,
    status,
    responses: Object.freeze({
      'task:1': Object.freeze({ taskRef: 'task:1', value: 42, savedAt: FIXED_NOW }),
    }),
    updatedAt: FIXED_NOW,
  }
}

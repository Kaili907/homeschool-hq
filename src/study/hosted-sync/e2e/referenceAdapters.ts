import type {
  FinalE2EAssignmentSnapshot,
  FinalE2ESourceFixture,
  FinalE2EStudentFixture,
} from '../../family-pilot/final-e2e/contracts'
import {
  HOSTED_STUDY_E2E_SCHEMA_VERSION,
  type HostedFailureInjection,
  type HostedHouseholdSnapshot,
  type HostedHydrateRequest,
  type HostedIdentitySession,
  type HostedMutationRequest,
  type HostedReadStudentRequest,
  type HostedStudyDocument,
  type HostedStudyOperation,
  type HostedStudyRepository,
  type HostedSyncHarnessInjection,
  type HostedSyncRequest,
  type HostedSyncResponse,
  type IdentityProvider,
  type LocalHostedStudyState,
  type LocalStudyStore,
  type NetworkController,
  type PendingHostedMutation,
  type ReconciliationPolicy,
  type TestClockScheduler,
} from './contracts'
import { clone, hasOpenSafetyHold } from './model'

export const E2E_HOUSEHOLD = 'synthetic:household:alpha'
export const E2E_OTHER_HOUSEHOLD = 'synthetic:household:other'
export const E2E_STUDENT_A = 'synthetic:student:a'
export const E2E_STUDENT_B = 'synthetic:student:b'

export const E2E_LESSONS = Object.freeze({
  math: 'synthetic:lesson:math:fractions',
  rfl: 'synthetic:lesson:rfl:planning',
  social: 'synthetic:lesson:social:source-inquiry',
  safety: 'synthetic:lesson:math:safety',
})

export const E2E_SOURCE: FinalE2ESourceFixture = Object.freeze({
  sourceRef: 'synthetic:source:history:001',
  kind: 'primary-source',
  title: 'Synthetic State History Source',
  publisher: 'Example Public Archive',
  publishedAt: '2026-01-05T00:00:00.000Z',
})

const STUDENTS: readonly FinalE2EStudentFixture[] = Object.freeze([
  Object.freeze({ studentRef: E2E_STUDENT_A, displayName: 'Synthetic Learner A', grade: '5' }),
  Object.freeze({ studentRef: E2E_STUDENT_B, displayName: 'Synthetic Learner B', grade: '7' }),
])

function segments(lessonRef: string): readonly string[] {
  return Object.freeze([1, 2, 3, 4].map((ordinal) => `${lessonRef}:segment:${ordinal}`))
}

function assignment(
  studentRef: string,
  lessonRef: string,
  subject: FinalE2EAssignmentSnapshot['subject'],
  state: FinalE2EAssignmentSnapshot['state'] = 'not-started',
): FinalE2EAssignmentSnapshot {
  const segmentRefs = segments(lessonRef)
  return Object.freeze({
    assignmentRef: `synthetic:assignment:${studentRef.split(':').at(-1)}:${lessonRef.split(':').at(-1)}`,
    lessonRef,
    studentRef,
    subject,
    state,
    segmentRefs,
    completedSegmentRefs: Object.freeze([]),
    currentSegmentRef: segmentRefs[0] ?? null,
    checkpointRevision: 0,
    sourceRef: null,
    completedAt: null,
    attestedAt: null,
    rawAnswerIncluded: false,
    audioIncluded: false,
    transcriptIncluded: false,
  })
}

function document(
  studentRef: string,
  lessonRef: string,
  subject: FinalE2EAssignmentSnapshot['subject'],
  authority: 'learner' | 'guardian',
  now: string,
  state: FinalE2EAssignmentSnapshot['state'] = 'not-started',
): HostedStudyDocument {
  const heldAssignment = assignment(studentRef, lessonRef, subject, state)
  return Object.freeze({
    schemaVersion: HOSTED_STUDY_E2E_SCHEMA_VERSION,
    documentRef: `synthetic:document:${heldAssignment.assignmentRef}`,
    householdRef: E2E_HOUSEHOLD,
    studentRef,
    assignment: heldAssignment,
    completion: Object.freeze({
      authority,
      status: 'in-progress',
      learnerFinishedAt: null,
      attestedAt: null,
      attestedByRef: null,
    }),
    sourceAttachment: null,
    safetyHolds: Object.freeze([]),
    serverRevision: 0,
    serverAcceptedAt: now,
    rawTutorConversationIncluded: false,
    privateResponseIncluded: false,
  })
}

export function createHostedFixtureDocuments(now: string): readonly HostedStudyDocument[] {
  return Object.freeze([
    document(E2E_STUDENT_A, E2E_LESSONS.math, 'mathematics', 'learner', now),
    document(E2E_STUDENT_A, E2E_LESSONS.rfl, 'ready-for-life', 'guardian', now),
    document(E2E_STUDENT_A, E2E_LESSONS.social, 'social-studies', 'learner', now, 'blocked-source'),
    document(E2E_STUDENT_A, E2E_LESSONS.safety, 'mathematics', 'learner', now),
    document(E2E_STUDENT_B, E2E_LESSONS.math, 'mathematics', 'learner', now),
  ])
}

export class DeterministicClock implements TestClockScheduler {
  #milliseconds: number

  constructor(start = '2026-08-13T12:00:00.000Z') {
    this.#milliseconds = Date.parse(start)
  }

  now = (): string => new Date(this.#milliseconds).toISOString()

  advance = (milliseconds: number): void => {
    this.#milliseconds += milliseconds
  }
}

export class ScriptedNetworkController implements NetworkController {
  #online = true
  #failures: HostedFailureInjection[] = []

  isOnline = (): boolean => this.#online
  setOnline = (online: boolean): void => { this.#online = online }
  injectNext = (failure: HostedFailureInjection): void => { this.#failures.push(failure) }
  takeNext = (): HostedFailureInjection | null => this.#failures.shift() ?? null
}

export class MemoryLocalStudyStore implements LocalStudyStore {
  #state: LocalHostedStudyState = Object.freeze({ household: null, pending: Object.freeze([]), lastError: null })

  read = (): LocalHostedStudyState => clone(this.#state)

  replaceHousehold = (household: HostedHouseholdSnapshot): void => {
    this.#state = Object.freeze({ ...this.#state, household: clone(household) })
  }

  replaceDocument = (document: HostedStudyDocument): void => {
    const household = this.#state.household
    if (!household) throw new Error('device-not-hydrated')
    const documents = household.documents.some((item) => item.documentRef === document.documentRef)
      ? household.documents.map((item) => item.documentRef === document.documentRef ? clone(document) : item)
      : [...household.documents, clone(document)]
    this.#state = Object.freeze({
      ...this.#state,
      household: Object.freeze({ ...household, documents: Object.freeze(documents) }),
    })
  }

  enqueue = (pending: PendingHostedMutation): void => {
    this.#state = Object.freeze({ ...this.#state, pending: Object.freeze([...this.#state.pending, clone(pending)]) })
  }

  replacePending = (pending: readonly PendingHostedMutation[]): void => {
    this.#state = Object.freeze({ ...this.#state, pending: Object.freeze(clone(pending)) })
  }

  setLastError = (lastError: HostedSyncResponse['status'] | null): void => {
    this.#state = Object.freeze({ ...this.#state, lastError })
  }

  clearEphemeralAuthorization = (): void => {
    // Authorization is intentionally never accepted by this persistence adapter.
  }

  persistedCanary = (): string => JSON.stringify(this.#state)
}

type Credential = {
  readonly credentialRef: string
  readonly pin?: string
  readonly householdRef: string
  readonly actorRef: string
  readonly role: HostedIdentitySession['role']
  readonly studentRefs: readonly string[]
}

export class MemoryIdentityProvider implements IdentityProvider {
  readonly #clock: TestClockScheduler
  readonly #credentials: readonly Credential[]
  readonly signedOut = new Set<string>()
  readonly signIns: { readonly deviceRef: string; readonly credentialRef: string; readonly pin?: string }[] = []

  constructor(clock: TestClockScheduler, credentials: readonly Credential[] = [
    { credentialRef: 'parent-alpha', householdRef: E2E_HOUSEHOLD, actorRef: 'synthetic:parent:alpha', role: 'parent', studentRefs: [E2E_STUDENT_A, E2E_STUDENT_B] },
    { credentialRef: 'student-a', pin: '2468', householdRef: E2E_HOUSEHOLD, actorRef: E2E_STUDENT_A, role: 'student', studentRefs: [E2E_STUDENT_A] },
    { credentialRef: 'student-b', pin: '1357', householdRef: E2E_HOUSEHOLD, actorRef: E2E_STUDENT_B, role: 'student', studentRefs: [E2E_STUDENT_B] },
    { credentialRef: 'parent-other', householdRef: E2E_OTHER_HOUSEHOLD, actorRef: 'synthetic:parent:other', role: 'parent', studentRefs: ['synthetic:student:other'] },
  ]) {
    this.#clock = clock
    this.#credentials = credentials
  }

  signIn = async (input: { deviceRef: string; credentialRef: string; pin?: string }): Promise<HostedIdentitySession> => {
    this.signIns.push(clone(input))
    const credential = this.#credentials.find((item) => item.credentialRef === input.credentialRef)
    if (!credential || credential.pin !== input.pin) throw new Error('identity-refused')
    return Object.freeze({
      sessionRef: `synthetic:session:${input.deviceRef}:${this.signIns.length}`,
      householdRef: credential.householdRef,
      actorRef: credential.actorRef,
      role: credential.role,
      authorizedStudentRefs: Object.freeze([...credential.studentRefs]),
      bearerToken: `e2e-bearer-${input.deviceRef}-${this.signIns.length}`,
      expiresAt: new Date(Date.parse(this.#clock.now()) + 3_600_000).toISOString(),
    })
  }

  logout = async (sessionRef: string): Promise<void> => { this.signedOut.add(sessionRef) }
}

function responseForbidden(requestRef: string, reasonCode: string): HostedSyncResponse {
  return { status: 'forbidden', requestRef, httpStatus: 403, reasonCode }
}

export class InMemoryHostedStudyRepository implements HostedStudyRepository {
  readonly #clock: TestClockScheduler
  readonly #students: readonly FinalE2EStudentFixture[]
  #documents: HostedStudyDocument[]
  #householdRevision = 0
  readonly #idempotency = new Map<string, HostedSyncResponse>()
  applyCount = 0

  constructor(clock: TestClockScheduler, documents = createHostedFixtureDocuments(clock.now()), students = STUDENTS) {
    this.#clock = clock
    this.#documents = [...clone(documents)]
    this.#students = clone(students)
  }

  snapshot(): HostedHouseholdSnapshot {
    return clone({ householdRef: E2E_HOUSEHOLD, students: this.#students, documents: this.#documents, serverRevision: this.#householdRevision })
  }

  replaceForNegativeControl(document: HostedStudyDocument): void {
    this.#documents = this.#documents.map((item) => item.documentRef === document.documentRef ? clone(document) : item)
  }

  #auth(session: HostedIdentitySession, householdRef: string): HostedSyncResponse | null {
    if (Date.parse(session.expiresAt) <= Date.parse(this.#clock.now())) {
      return { status: 'auth-error', requestRef: '', httpStatus: 401, reasonCode: 'session-expired' }
    }
    if (session.householdRef !== householdRef || householdRef !== E2E_HOUSEHOLD) return responseForbidden('', 'wrong-household')
    return null
  }

  hydrateHousehold = async (session: HostedIdentitySession, request: HostedHydrateRequest): Promise<HostedSyncResponse> => {
    const refused = this.#auth(session, request.householdRef)
    if (refused) return { ...refused, requestRef: request.requestRef } as HostedSyncResponse
    const allowed = new Set(session.authorizedStudentRefs)
    return {
      status: 'ok', requestRef: request.requestRef, duplicate: false,
      snapshot: clone({
        householdRef: E2E_HOUSEHOLD,
        students: this.#students.filter((student) => allowed.has(student.studentRef)),
        documents: this.#documents.filter((held) => allowed.has(held.studentRef)),
        serverRevision: this.#householdRevision,
      }),
    }
  }

  readStudent = async (session: HostedIdentitySession, request: HostedReadStudentRequest): Promise<HostedSyncResponse> => {
    const refused = this.#auth(session, request.householdRef)
    if (refused) return { ...refused, requestRef: request.requestRef } as HostedSyncResponse
    if (!session.authorizedStudentRefs.includes(request.studentRef)) return responseForbidden(request.requestRef, 'student-scope-forbidden')
    const document = this.#documents.find((item) => item.studentRef === request.studentRef)
    return document
      ? { status: 'ok', requestRef: request.requestRef, document: clone(document), duplicate: false }
      : responseForbidden(request.requestRef, 'student-not-found')
  }

  applyMutation = async (session: HostedIdentitySession, request: HostedMutationRequest): Promise<HostedSyncResponse> => {
    this.applyCount += 1
    const cached = this.#idempotency.get(request.idempotencyKey)
    if (cached) return cached.status === 'ok' ? { ...clone(cached), duplicate: true } : clone(cached)
    const refused = this.#auth(session, request.householdRef)
    if (refused) return { ...refused, requestRef: request.requestRef } as HostedSyncResponse
    if (!session.authorizedStudentRefs.includes(request.studentRef)) return responseForbidden(request.requestRef, 'student-scope-forbidden')
    const index = this.#documents.findIndex((item) => item.documentRef === request.documentRef)
    if (index < 0 || this.#documents[index]?.studentRef !== request.studentRef) return responseForbidden(request.requestRef, 'document-scope-forbidden')
    const current = this.#documents[index] as HostedStudyDocument
    if (request.baseRevision !== current.serverRevision) {
      return { status: 'stale', requestRef: request.requestRef, remote: clone(current) }
    }
    const applied = this.#applyOperation(session, current, request.operation, request.deviceOccurredAt)
    if ('status' in applied) return { ...applied, requestRef: request.requestRef } as HostedSyncResponse
    const next: HostedStudyDocument = Object.freeze({
      ...applied,
      serverRevision: current.serverRevision + 1,
      serverAcceptedAt: this.#clock.now(),
    })
    this.#documents[index] = next
    this.#householdRevision += 1
    const response: HostedSyncResponse = { status: 'ok', requestRef: request.requestRef, document: clone(next), duplicate: false }
    this.#idempotency.set(request.idempotencyKey, clone(response))
    return response
  }

  #applyOperation(
    session: HostedIdentitySession,
    current: HostedStudyDocument,
    operation: HostedStudyOperation,
    occurredAt: string,
  ): HostedStudyDocument |
    { readonly status: 'forbidden'; readonly httpStatus: 403; readonly reasonCode: string } |
    { readonly status: 'safety-blocked'; readonly reasonCode: string; readonly remote: HostedStudyDocument } {
    const openHold = hasOpenSafetyHold(current)
    if (openHold && ['start', 'advance', 'finish'].includes(operation.type)) {
      return { status: 'safety-blocked', reasonCode: 'open-safety-hold', remote: clone(current) }
    }
    if (current.completion.status === 'certified' && ['start', 'advance', 'finish'].includes(operation.type)) {
      return clone(current)
    }
    if (operation.type === 'start') {
      if (current.assignment.state === 'blocked-source' && !current.sourceAttachment) {
        return { status: 'forbidden', httpStatus: 403, reasonCode: 'qualifying-source-required' }
      }
      return { ...current, assignment: { ...current.assignment, state: 'active' } }
    }
    if (operation.type === 'advance') {
      if (!current.assignment.segmentRefs.includes(operation.segmentRef)) {
        return { status: 'forbidden', httpStatus: 403, reasonCode: 'unknown-segment' }
      }
      const completed = current.assignment.completedSegmentRefs.includes(operation.segmentRef)
        ? current.assignment.completedSegmentRefs
        : [...current.assignment.completedSegmentRefs, operation.segmentRef]
      const nextSegment = current.assignment.segmentRefs.find((ref) => !completed.includes(ref)) ?? null
      return {
        ...current,
        assignment: {
          ...current.assignment,
          state: 'active',
          completedSegmentRefs: Object.freeze(completed),
          currentSegmentRef: nextSegment,
          checkpointRevision: current.assignment.checkpointRevision + 1,
        },
      }
    }
    if (operation.type === 'finish') {
      const pending = current.completion.authority === 'guardian'
      const status = pending ? 'pending-attestation' : 'certified'
      return {
        ...current,
        assignment: {
          ...current.assignment,
          state: status,
          completedSegmentRefs: current.assignment.segmentRefs,
          currentSegmentRef: null,
          completedAt: pending ? null : occurredAt,
        },
        completion: { ...current.completion, status, learnerFinishedAt: occurredAt },
      }
    }
    if (operation.type === 'attest') {
      if (session.role !== 'parent') return { status: 'forbidden', httpStatus: 403, reasonCode: 'parent-role-required' }
      if (current.completion.status !== 'pending-attestation') return { status: 'forbidden', httpStatus: 403, reasonCode: 'attestation-not-pending' }
      return {
        ...current,
        assignment: { ...current.assignment, state: 'certified', completedAt: occurredAt, attestedAt: occurredAt },
        completion: { ...current.completion, status: 'certified', attestedAt: occurredAt, attestedByRef: session.actorRef },
      }
    }
    if (operation.type === 'attach-source') {
      if (operation.source.kind !== 'primary-source') return { status: 'forbidden', httpStatus: 403, reasonCode: 'source-does-not-qualify' }
      return {
        ...current,
        assignment: { ...current.assignment, state: 'not-started', sourceRef: operation.source.sourceRef },
        sourceAttachment: { ...operation.source, attachedAt: occurredAt, status: 'ATTACHED_SATISFIED' },
      }
    }
    if (operation.type === 'place-safety-hold') {
      if (current.safetyHolds.some((hold) => hold.holdRef === operation.holdRef)) return clone(current)
      return {
        ...current,
        safetyHolds: Object.freeze([...current.safetyHolds, Object.freeze({
          holdRef: operation.holdRef,
          reasonCode: operation.reasonCode,
          status: 'open' as const,
          createdAt: occurredAt,
          createdByRole: session.role,
          clearedAt: null,
          clearedByRef: null,
        })]),
      }
    }
    if (session.role !== 'parent') return { status: 'forbidden', httpStatus: 403, reasonCode: 'parent-role-required' }
    const target = current.safetyHolds.find((hold) => hold.holdRef === operation.holdRef)
    if (!target || target.status !== 'open') return { status: 'forbidden', httpStatus: 403, reasonCode: 'open-hold-not-found' }
    return {
      ...current,
      safetyHolds: Object.freeze(current.safetyHolds.map((hold) => hold.holdRef === operation.holdRef
        ? { ...hold, status: 'cleared' as const, clearedAt: occurredAt, clearedByRef: session.actorRef }
        : hold)),
    }
  }
}

export class ScriptedHostedSyncTransport {
  readonly #repository: HostedStudyRepository
  readonly #network: NetworkController
  readonly sent: { readonly session: HostedIdentitySession; readonly request: HostedSyncRequest }[] = []
  #previousResponse: unknown = null

  constructor(repository: HostedStudyRepository, network: NetworkController) {
    this.#repository = repository
    this.#network = network
  }

  send = async (session: HostedIdentitySession, request: HostedSyncRequest): Promise<unknown> => {
    this.sent.push({ session: clone(session), request: clone(request) })
    if (!this.#network.isOnline()) return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'offline' }
    const failure = this.#network.takeNext()
    if (failure === 'offline' || failure === 'timeout') return { status: 'retryable', requestRef: request.requestRef, reasonCode: failure }
    if (failure === '401') return { status: 'auth-error', requestRef: request.requestRef, httpStatus: 401, reasonCode: 'session-expired' }
    if (failure === '403') return responseForbidden(request.requestRef, 'injected-forbidden')
    if (failure === '429') return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'rate-limited', httpStatus: 429 }
    if (failure === '500' || failure === '503') return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'server-error', httpStatus: Number(failure) }
    if (failure === 'malformed-response') return { nonsense: true }
    const effective = failure === 'stale-revision' && request.kind === 'mutate'
      ? { ...request, baseRevision: Math.max(-1, request.baseRevision - 1) }
      : request
    const response = effective.kind === 'hydrate-household'
      ? await this.#repository.hydrateHousehold(session, effective)
      : effective.kind === 'read-student'
        ? await this.#repository.readStudent(session, effective)
        : await this.#repository.applyMutation(session, effective)
    if (failure === 'duplicate-request' && effective.kind === 'mutate') {
      const duplicate = await this.#repository.applyMutation(session, effective)
      this.#previousResponse = clone(duplicate)
      return duplicate
    }
    if (failure === 'lost-ack') {
      this.#previousResponse = clone(response)
      return { status: 'retryable', requestRef: request.requestRef, reasonCode: 'lost-ack' }
    }
    if (failure === 'reordered-response') {
      const previous = this.#previousResponse
      this.#previousResponse = clone(response)
      return previous ?? { ...clone(response as Record<string, unknown>), requestRef: 'synthetic:request:older' }
    }
    if (failure === 'corrupt-remote-state') {
      if (response.status === 'ok' && response.document) {
        return { ...response, document: { ...response.document, privateResponseIncluded: true } }
      }
      if (response.status === 'ok' && response.snapshot) {
        return { ...response, snapshot: { ...response.snapshot, documents: response.snapshot.documents.map((item, index) => index === 0 ? { ...item, rawTutorConversationIncluded: true } : item) } }
      }
    }
    this.#previousResponse = clone(response)
    return failure === 'duplicate-response' ? clone(response) : response
  }
}

export const safeReconciliationPolicy: ReconciliationPolicy = {
  reconcile: (input) => {
    const { session, local, remote, rejected, nextRequestRef } = input
    if (remote.completion.status === 'certified') {
      return { status: 'accept-remote', remote: clone(remote), reasonCode: 'certified-is-terminal' }
    }
    if (hasOpenSafetyHold(remote) && ['start', 'advance', 'finish'].includes(rejected.operation.type)) {
      return { status: 'accept-remote', remote: clone(remote), reasonCode: 'remote-safety-hold-wins' }
    }
    if ((rejected.operation.type === 'attest' || rejected.operation.type === 'clear-safety-hold') && session.role !== 'parent') {
      return { status: 'conflict', remote: clone(remote), reasonCode: 'parent-role-required' }
    }
    if (rejected.operation.type === 'advance' && remote.assignment.completedSegmentRefs.includes(rejected.operation.segmentRef)) {
      return { status: 'accept-remote', remote: clone(remote), reasonCode: 'operation-already-present' }
    }
    if (rejected.operation.type === 'place-safety-hold') {
      const holdRef = rejected.operation.holdRef
      if (remote.safetyHolds.some((hold) => hold.holdRef === holdRef)) {
        return { status: 'accept-remote', remote: clone(remote), reasonCode: 'operation-already-present' }
      }
    }
    const request: HostedMutationRequest = Object.freeze({
      ...rejected,
      requestRef: nextRequestRef,
      baseRevision: remote.serverRevision,
    })
    const completed = [...new Set([...remote.assignment.completedSegmentRefs, ...local.assignment.completedSegmentRefs])]
    return {
      status: 'retry',
      request,
      local: clone({
        ...remote,
        assignment: {
          ...remote.assignment,
          completedSegmentRefs: completed,
          currentSegmentRef: remote.assignment.segmentRefs.find((item) => !completed.includes(item)) ?? null,
        },
      }),
    }
  },
}

export interface ReferenceHostedHarness extends HostedSyncHarnessInjection {
  readonly identityProvider: MemoryIdentityProvider
  readonly hostedRepository: InMemoryHostedStudyRepository
  readonly transport: ScriptedHostedSyncTransport
  readonly clock: DeterministicClock
  readonly network: ScriptedNetworkController
  readonly stores: ReadonlyMap<string, MemoryLocalStudyStore>
}

export function createReferenceHostedHarness(): ReferenceHostedHarness {
  const clock = new DeterministicClock()
  const network = new ScriptedNetworkController()
  const hostedRepository = new InMemoryHostedStudyRepository(clock)
  const identityProvider = new MemoryIdentityProvider(clock)
  const transport = new ScriptedHostedSyncTransport(hostedRepository, network)
  const stores = new Map<string, MemoryLocalStudyStore>()
  return {
    clock,
    network,
    hostedRepository,
    identityProvider,
    transport,
    reconciliationPolicy: safeReconciliationPolicy,
    createLocalStudyStore: (deviceRef) => {
      const store = new MemoryLocalStudyStore()
      stores.set(deviceRef, store)
      return store
    },
    stores,
  }
}

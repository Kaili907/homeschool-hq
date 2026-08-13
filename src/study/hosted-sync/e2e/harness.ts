import type {
  DeviceSyncOutcome,
  HostedHouseholdSnapshot,
  HostedIdentitySession,
  HostedMutationRequest,
  HostedStudyDocument,
  HostedStudyOperation,
  HostedSyncHarnessInjection,
  HostedSyncRequest,
  HostedSyncResponse,
  HostedSyncTraceEntry,
  LocalStudyStore,
  PendingHostedMutation,
} from './contracts'
import { clone, parseHostedSyncResponse } from './model'

function localApply(
  document: HostedStudyDocument,
  operation: HostedStudyOperation,
  occurredAt: string,
  actorRef: string,
  actorRole: HostedIdentitySession['role'],
): HostedStudyDocument {
  if (operation.type === 'start') {
    return clone({ ...document, assignment: { ...document.assignment, state: 'active' } })
  }
  if (operation.type === 'advance') {
    const completed = document.assignment.completedSegmentRefs.includes(operation.segmentRef)
      ? document.assignment.completedSegmentRefs
      : [...document.assignment.completedSegmentRefs, operation.segmentRef]
    return clone({
      ...document,
      assignment: {
        ...document.assignment,
        state: 'active',
        completedSegmentRefs: completed,
        currentSegmentRef: document.assignment.segmentRefs.find((item) => !completed.includes(item)) ?? null,
        checkpointRevision: document.assignment.checkpointRevision + 1,
      },
    })
  }
  if (operation.type === 'finish') {
    const pending = document.completion.authority === 'guardian'
    return clone({
      ...document,
      assignment: {
        ...document.assignment,
        state: pending ? 'pending-attestation' : 'certified',
        completedSegmentRefs: document.assignment.segmentRefs,
        currentSegmentRef: null,
        completedAt: pending ? null : occurredAt,
      },
      completion: {
        ...document.completion,
        status: pending ? 'pending-attestation' : 'certified',
        learnerFinishedAt: occurredAt,
      },
    })
  }
  if (operation.type === 'attest') {
    return clone({
      ...document,
      assignment: { ...document.assignment, state: 'certified', completedAt: occurredAt, attestedAt: occurredAt },
      completion: { ...document.completion, status: 'certified', attestedAt: occurredAt, attestedByRef: actorRef },
    })
  }
  if (operation.type === 'attach-source') {
    return clone({
      ...document,
      assignment: { ...document.assignment, state: 'not-started', sourceRef: operation.source.sourceRef },
      sourceAttachment: { ...operation.source, attachedAt: occurredAt, status: 'ATTACHED_SATISFIED' },
    })
  }
  if (operation.type === 'place-safety-hold') {
    if (document.safetyHolds.some((hold) => hold.holdRef === operation.holdRef)) return clone(document)
    return clone({
      ...document,
      safetyHolds: [...document.safetyHolds, {
        holdRef: operation.holdRef,
        reasonCode: operation.reasonCode,
        status: 'open',
        createdAt: occurredAt,
        createdByRole: actorRole,
        clearedAt: null,
        clearedByRef: null,
      }],
    })
  }
  return clone({
    ...document,
    safetyHolds: document.safetyHolds.map((hold) => hold.holdRef === operation.holdRef
      ? { ...hold, status: 'cleared', clearedAt: occurredAt, clearedByRef: actorRef }
      : hold),
  }) as HostedStudyDocument
}

export interface CreateDeviceOptions {
  readonly clockOffsetMilliseconds?: number
}

export class HostedStudyDevice {
  readonly deviceRef: string
  readonly #injection: HostedSyncHarnessInjection
  readonly #store: LocalStudyStore
  readonly #trace: HostedSyncTraceEntry[]
  readonly #clockOffset: number
  #session: HostedIdentitySession | null = null
  #requestOrdinal = 0

  constructor(
    deviceRef: string,
    injection: HostedSyncHarnessInjection,
    trace: HostedSyncTraceEntry[],
    options: CreateDeviceOptions = {},
  ) {
    this.deviceRef = deviceRef
    this.#injection = injection
    this.#store = injection.createLocalStudyStore(deviceRef)
    this.#trace = trace
    this.#clockOffset = options.clockOffsetMilliseconds ?? 0
  }

  get authorized(): boolean { return this.#session !== null }
  get role(): HostedIdentitySession['role'] | null { return this.#session?.role ?? null }
  get state() { return this.#store.read() }
  get persistedCanary(): string { return this.#store.persistedCanary() }

  document(documentRef: string): HostedStudyDocument {
    const found = this.state.household?.documents.find((item) => item.documentRef === documentRef)
    if (!found) throw new Error(`document-not-local:${documentRef}`)
    return found
  }

  documentFor(studentRef: string, lessonRef: string): HostedStudyDocument {
    const found = this.state.household?.documents.find(
      (item) => item.studentRef === studentRef && item.assignment.lessonRef === lessonRef,
    )
    if (!found) throw new Error(`document-not-local:${studentRef}:${lessonRef}`)
    return found
  }

  signIn = async (credentialRef: string, pin?: string): Promise<void> => {
    this.#session = await this.#injection.identityProvider.signIn({ deviceRef: this.deviceRef, credentialRef, ...(pin ? { pin } : {}) })
  }

  logout = async (): Promise<DeviceSyncOutcome> => {
    if (this.#session) await this.#injection.identityProvider.logout(this.#session.sessionRef)
    this.#session = null
    this.#store.clearEphemeralAuthorization()
    return { status: 'logged-out' }
  }

  hydrate = async (): Promise<DeviceSyncOutcome> => {
    const session = this.#requireSession()
    const request = Object.freeze({
      kind: 'hydrate-household' as const,
      requestRef: this.#nextRef('hydrate'),
      householdRef: session.householdRef,
    })
    const response = await this.#send(session, request)
    if (response.status === 'ok' && response.snapshot) {
      this.#store.replaceHousehold(response.snapshot)
      this.#store.setLastError(null)
      return { status: 'hydrated' }
    }
    if (response.status === 'ok') return { status: 'invalid-response', reasonCode: 'malformed-response' }
    return this.#nonSuccess(response)
  }

  readStudent = async (studentRef: string, householdRef?: string): Promise<DeviceSyncOutcome> => {
    const session = this.#requireSession()
    const request = Object.freeze({
      kind: 'read-student' as const,
      requestRef: this.#nextRef('read'),
      householdRef: householdRef ?? session.householdRef,
      studentRef,
    })
    const response = await this.#send(session, request)
    if (response.status === 'ok' && response.document) {
      this.#store.replaceDocument(response.document)
      return { status: 'hydrated' }
    }
    if (response.status === 'ok') return { status: 'invalid-response', reasonCode: 'malformed-response' }
    return this.#nonSuccess(response)
  }

  mutate = (documentRef: string, operation: HostedStudyOperation): DeviceSyncOutcome => {
    const session = this.#requireSession()
    if (operation.type === 'attest' && session.role !== 'parent') return { status: 'forbidden', reasonCode: 'parent-role-required' }
    if (operation.type === 'clear-safety-hold' && session.role !== 'parent') return { status: 'forbidden', reasonCode: 'parent-role-required' }
    const current = this.document(documentRef)
    if (current.studentRef !== session.actorRef && !session.authorizedStudentRefs.includes(current.studentRef)) {
      return { status: 'forbidden', reasonCode: 'student-scope-forbidden' }
    }
    if (current.safetyHolds.some((hold) => hold.status === 'open') && ['start', 'advance', 'finish'].includes(operation.type)) {
      return { status: 'safety-blocked', reasonCode: 'open-safety-hold' }
    }
    if (operation.type === 'start' && current.assignment.state === 'blocked-source' && !current.sourceAttachment) {
      return { status: 'forbidden', reasonCode: 'qualifying-source-required' }
    }
    const occurredAt = this.#deviceNow()
    const request: HostedMutationRequest = Object.freeze({
      kind: 'mutate',
      requestRef: this.#nextRef('mutation'),
      idempotencyKey: `${this.deviceRef}:idempotency:${this.#requestOrdinal}`,
      householdRef: current.householdRef,
      studentRef: current.studentRef,
      documentRef,
      baseRevision: current.serverRevision,
      deviceOccurredAt: occurredAt,
      operation: clone(operation),
    })
    this.#store.replaceDocument(localApply(current, operation, occurredAt, session.actorRef, session.role))
    this.#store.enqueue({ request, attempts: 0 })
    return { status: 'queued', reasonCode: 'pending-upload' }
  }

  /**
   * Acceptance-only server authorization probe. It bypasses the device guard,
   * never changes local state, and proves the hosted adapter independently
   * rejects a forged protected operation.
   */
  probeServerAuthorization = async (
    documentRef: string,
    operation: HostedStudyOperation,
  ): Promise<DeviceSyncOutcome> => {
    const session = this.#requireSession()
    const current = this.document(documentRef)
    const request: HostedMutationRequest = Object.freeze({
      kind: 'mutate',
      requestRef: this.#nextRef('authorization-probe'),
      idempotencyKey: `${this.deviceRef}:authorization-probe:${this.#requestOrdinal}`,
      householdRef: current.householdRef,
      studentRef: current.studentRef,
      documentRef,
      baseRevision: current.serverRevision,
      deviceOccurredAt: this.#deviceNow(),
      operation: clone(operation),
    })
    const response = await this.#send(session, request)
    if (response.status === 'forbidden') return { status: 'forbidden', reasonCode: response.reasonCode }
    if (response.status === 'auth-error') return { status: 'auth-required', reasonCode: response.reasonCode }
    return response.status === 'ok'
      ? { status: 'synced' }
      : { status: 'invalid-response', reasonCode: `authorization-probe:${response.status}` }
  }

  sync = async (): Promise<DeviceSyncOutcome> => {
    const session = this.#requireSession()
    let processed = false
    while (this.state.pending.length > 0) {
      const pending = this.state.pending[0] as PendingHostedMutation
      const response = await this.#send(session, pending.request)
      const rest = this.state.pending.slice(1)
      if (response.status === 'ok' && response.document) {
        this.#store.replaceDocument(response.document)
        this.#store.replacePending(rest)
        this.#store.setLastError(null)
        processed = true
        continue
      }
      if (response.status === 'stale') {
        const local = this.document(pending.request.documentRef)
        const decision = this.#injection.reconciliationPolicy.reconcile({
          session,
          local,
          remote: response.remote,
          rejected: pending.request,
          nextRequestRef: this.#nextRef('reconcile'),
        })
        if (decision.status === 'retry') {
          this.#store.replaceDocument(decision.local)
          this.#store.replacePending([{ request: decision.request, attempts: pending.attempts + 1 }, ...rest])
          if (pending.attempts >= 4) return { status: 'conflict', reasonCode: 'reconciliation-attempts-exhausted' }
          continue
        }
        this.#store.replaceDocument(decision.remote)
        this.#store.replacePending(rest)
        return decision.status === 'conflict'
          ? { status: 'conflict', reasonCode: decision.reasonCode }
          : { status: 'synced' }
      }
      if (response.status === 'safety-blocked') {
        this.#store.replaceDocument(response.remote)
        this.#store.replacePending(rest)
        this.#store.setLastError(response.status)
        return { status: 'safety-blocked', reasonCode: response.reasonCode }
      }
      if (response.status === 'retryable') {
        this.#store.replacePending([{ ...pending, attempts: pending.attempts + 1 }, ...rest])
        this.#store.setLastError(response.status)
        return { status: 'queued', reasonCode: response.reasonCode }
      }
      if (response.status === 'auth-error') {
        this.#session = null
        this.#store.clearEphemeralAuthorization()
        this.#store.setLastError(response.status)
        return { status: 'auth-required', reasonCode: response.reasonCode }
      }
      if (response.status === 'forbidden') {
        this.#store.replacePending(rest)
        this.#store.setLastError(response.status)
        return { status: 'forbidden', reasonCode: response.reasonCode }
      }
      if (response.status === 'ok') {
        this.#store.setLastError('invalid-response')
        return { status: 'invalid-response', reasonCode: 'malformed-response' }
      }
      this.#store.setLastError(response.status)
      return { status: 'invalid-response', reasonCode: response.reasonCode }
    }
    return { status: 'synced', duplicate: processed }
  }

  #deviceNow(): string {
    return new Date(Date.parse(this.#injection.clock.now()) + this.#clockOffset).toISOString()
  }

  #nextRef(kind: string): string {
    this.#requestOrdinal += 1
    return `synthetic:request:${this.deviceRef}:${kind}:${this.#requestOrdinal}`
  }

  #requireSession(): HostedIdentitySession {
    if (!this.#session) throw new Error('device-auth-required')
    return this.#session
  }

  async #send(session: HostedIdentitySession, request: HostedSyncRequest): Promise<HostedSyncResponse> {
    const raw = await this.#injection.transport.send(session, request)
    this.#trace.push(Object.freeze({ deviceRef: this.deviceRef, request: clone(request), response: clone(raw) }))
    return parseHostedSyncResponse(raw, request.requestRef)
  }

  #nonSuccess(response: Exclude<HostedSyncResponse, { status: 'ok' }>): DeviceSyncOutcome {
    this.#store.setLastError(response.status)
    if (response.status === 'auth-error') {
      this.#session = null
      return { status: 'auth-required', reasonCode: response.reasonCode }
    }
    if (response.status === 'forbidden') return { status: 'forbidden', reasonCode: response.reasonCode }
    if (response.status === 'safety-blocked') return { status: 'safety-blocked', reasonCode: response.reasonCode }
    if (response.status === 'invalid-response') return { status: 'invalid-response', reasonCode: response.reasonCode }
    return { status: 'queued', reasonCode: response.status === 'retryable' ? response.reasonCode : 'stale-read' }
  }
}

export class HostedStudyE2EHarness {
  readonly #injection: HostedSyncHarnessInjection
  readonly trace: HostedSyncTraceEntry[] = []
  readonly devices = new Map<string, HostedStudyDevice>()

  constructor(injection: HostedSyncHarnessInjection) {
    this.#injection = injection
  }

  createDevice(deviceRef: string, options: CreateDeviceOptions = {}): HostedStudyDevice {
    if (this.devices.has(deviceRef)) throw new Error(`duplicate-device:${deviceRef}`)
    const device = new HostedStudyDevice(deviceRef, this.#injection, this.trace, options)
    this.devices.set(deviceRef, device)
    return device
  }

  serverSnapshot(): HostedHouseholdSnapshot | null {
    const repository = this.#injection.hostedRepository as { snapshot?: () => HostedHouseholdSnapshot }
    return repository.snapshot?.() ?? null
  }

  assertSecurityCanaries(): void {
    const serializedTrace = JSON.stringify(this.trace.map((entry) => entry.request))
    if (/\bpin\b/i.test(serializedTrace)) throw new Error('pin-reached-sync-transport')
    if (/rawTutorConversation|privateResponse|rawAnswer|transcript/i.test(serializedTrace)) {
      throw new Error('private-tutor-content-reached-server-request')
    }
    for (const device of this.devices.values()) {
      if (/bearer|token/i.test(device.persistedCanary)) throw new Error('bearer-persisted-locally')
    }
    const server = this.serverSnapshot()
    if (server && server.documents.some((document) => document.rawTutorConversationIncluded || document.privateResponseIncluded)) {
      throw new Error('private-tutor-content-reached-server-fixture')
    }
  }
}

import { HOSTED_SYNC_RPC, type HostedSyncAuthenticatedRpcProvider, type HostedSyncRpcName, type HostedSyncRpcProviderResult } from '../types'

type Json = Record<string, unknown>

interface HeldSession {
  mapping: Json
  document: Json
  revisions: { authority: number; session: number; checkpoint: number }
  authorityCheckpoint?: Json
  authorityCheckpointRevision?: number
  learnerResponseCheckpoint?: Json
  learnerResponseCheckpointRevision?: number
  familyPlanCheckpoint?: Json
  familyPlanCheckpointRevision?: number
}

function clone<T>(value: T): T { return structuredClone(value) }
function data(value: unknown): HostedSyncRpcProviderResult { return { data: value, error: null } }
function keys(value: Json, expected: readonly string[]): boolean {
  const held = Object.keys(value)
  return held.length === expected.length && held.every((key) => expected.includes(key))
}
function asJson(value: unknown): Json | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : null }
function key(studentId: unknown, assignmentRef: unknown, sessionRef: unknown): string { return `${studentId}\u0000${assignmentRef}\u0000${sessionRef}` }
function localKey(scope: Json): string { return `${scope.householdRef}\u0000${scope.studentRef}\u0000${scope.assignmentRef}\u0000${scope.sessionRef}` }

export interface LocalDbRpcEmulator extends HostedSyncAuthenticatedRpcProvider {
  readonly calls: readonly Readonly<{ name: HostedSyncRpcName; args: Readonly<Record<string, unknown>> }>[]
  dropNextCommittedResponse(name: typeof HOSTED_SYNC_RPC.firstLink | typeof HOSTED_SYNC_RPC.write): void
  setRole(tokenDigest: string, role: 'guardian' | 'student'): void
}

/** Local deterministic emulation of the four SQL RPCs; it is not a production provider. */
export function createLocalDbRpcEmulator(input: { now?: () => Date; hostedHouseholdId?: string } = {}): LocalDbRpcEmulator {
  const now = input.now ?? (() => new Date())
  const hostedHouseholdId = input.hostedHouseholdId ?? '00000000-0000-4000-8000-000000000011'
  const sessions = new Map<string, HeldSession>()
  const mappings = new Map<string, Json>()
  const receipts = new Map<string, { fingerprint: string; response: Json }>()
  const roles = new Map<string, 'guardian' | 'student'>()
  const drops = new Set<HostedSyncRpcName>()
  const calls: Array<{ name: HostedSyncRpcName; args: Readonly<Record<string, unknown>> }> = []

  function responseAfterCommit(name: HostedSyncRpcName, value: Json): HostedSyncRpcProviderResult {
    if (drops.delete(name)) return { data: null, error: { code: 'NETWORK_UNAVAILABLE', reasonCode: 'RESPONSE_LOST_AFTER_COMMIT' } }
    return data(clone(value))
  }

  function firstLink(args: Json): HostedSyncRpcProviderResult {
    if (!keys(args, ['p_token_digest', 'p_student_id', 'p_client_operation_id', 'p_import'])) return data({ schemaVersion: 2, status: 'denied', code: 'invalid-import' })
    if (roles.get(String(args.p_token_digest)) === 'student') return data({ schemaVersion: 2, status: 'denied', code: 'actor-not-authorized' })
    const imported = asJson(args.p_import)
    const localScope = asJson(imported?.localScope)
    const hostedScope = asJson(imported?.hostedScope)
    if (!imported || !localScope || !hostedScope) return data({ schemaVersion: 2, status: 'denied', code: 'invalid-import' })
    for (const field of ['authorityCheckpoint', 'learnerResponseCheckpoint', 'familyPlanCheckpoint'] as const) {
      const checkpoint = asJson(imported[field])
      if (!checkpoint) continue
      const sync = asJson(checkpoint.sync)
      if (!sync || sync.operationId !== args.p_client_operation_id ||
          (field === 'authorityCheckpoint' && sync.idempotencyKey !== args.p_client_operation_id) ||
          (field !== 'authorityCheckpoint' && (sync.baseRevision !== 0 || sync.revision !== 0))) {
        return data({ schemaVersion: 2, status: 'denied', code: 'invalid-import' })
      }
    }
    const receiptKey = `first:${args.p_client_operation_id}`
    const fingerprint = JSON.stringify(args)
    const prior = receipts.get(receiptKey)
    if (prior) return prior.fingerprint === fingerprint ? data(clone(prior.response)) : data({ schemaVersion: 2, status: 'idempotency-collision' })
    const sessionKey = key(args.p_student_id, hostedScope.assignmentRef, hostedScope.sessionRef)
    const existing = sessions.get(sessionKey)
    const mapped = {
      localHouseholdRef: localScope.householdRef, localStudentRef: localScope.studentRef,
      localAssignmentRef: localScope.assignmentRef, localSessionRef: localScope.sessionRef,
      hostedHouseholdId, hostedStudentId: args.p_student_id,
      hostedAssignmentRef: hostedScope.assignmentRef, hostedSessionRef: hostedScope.sessionRef,
    }
    const heldLocal = mappings.get(localKey(localScope))
    if (heldLocal && JSON.stringify(heldLocal) !== JSON.stringify(mapped)) return data({ schemaVersion: 2, status: 'mapping-conflict' })
    if (existing && JSON.stringify(existing.mapping) !== JSON.stringify(mapped)) return data({ schemaVersion: 2, status: 'mapping-conflict' })
    if (!existing) {
      const session = asJson(imported.session) ?? {}
      const checkpoint = asJson(imported.checkpoint)
      const revisions = { authority: 2, session: 1, checkpoint: Number(checkpoint?.revision ?? 0) }
      const document = {
        studentRef: localScope.studentRef, assignmentRef: localScope.assignmentRef,
        lessonRef: session.lessonRef, studySessionId: localScope.sessionRef,
        completion: { state: session.state, startedAt: session.startedAt ?? null, completedAt: session.completedAt ?? null },
        revisions, checkpoint: imported.checkpoint ?? null,
        socialSource: imported.socialSource ?? null,
        guardianAttestation: imported.guardianAttestation ?? null,
        safetyState: imported.safetyState,
        assessment: imported.assessment ?? null,
        syncMetadata: { lastAuthorityClientOperationId: args.p_client_operation_id, serverAcceptedAt: now().toISOString() },
      }
      const authorityCheckpoint = asJson(imported.authorityCheckpoint)
      const learnerResponseCheckpoint = asJson(imported.learnerResponseCheckpoint)
      const familyPlanCheckpoint = asJson(imported.familyPlanCheckpoint)
      sessions.set(sessionKey, {
        mapping: clone(mapped), document, revisions,
        ...(authorityCheckpoint ? {
          authorityCheckpoint: clone(authorityCheckpoint),
          authorityCheckpointRevision: Number(asJson(authorityCheckpoint.sync)?.serverRevision ?? 0),
        } : {}),
        ...(learnerResponseCheckpoint ? {
          learnerResponseCheckpoint: clone(learnerResponseCheckpoint),
          learnerResponseCheckpointRevision: Number(asJson(learnerResponseCheckpoint.sync)?.revision ?? 0),
        } : {}),
        ...(familyPlanCheckpoint ? {
          familyPlanCheckpoint: clone(familyPlanCheckpoint),
          familyPlanCheckpointRevision: Number(asJson(familyPlanCheckpoint.sync)?.revision ?? 0),
        } : {}),
      })
      mappings.set(localKey(localScope), clone(mapped))
    }
    const held = sessions.get(sessionKey)!
    const response = {
      schemaVersion: 2, status: existing ? 'linked-existing' : 'imported', mapping: mapped,
      revisions: {
        ...held.revisions,
        ...(held.authorityCheckpointRevision === undefined ? {} : { authorityCheckpoint: held.authorityCheckpointRevision }),
        ...(held.learnerResponseCheckpointRevision === undefined ? {} : { learnerResponseCheckpoint: held.learnerResponseCheckpointRevision }),
        ...(held.familyPlanCheckpointRevision === undefined ? {} : { familyPlanCheckpoint: held.familyPlanCheckpointRevision }),
      },
    }
    receipts.set(receiptKey, { fingerprint, response: clone(response) })
    return responseAfterCommit(HOSTED_SYNC_RPC.firstLink, response)
  }

  function resolve(args: Json): HostedSyncRpcProviderResult {
    if (!keys(args, ['p_token_digest', 'p_student_id', 'p_local_scope'])) return data({ schemaVersion: 2, status: 'unavailable' })
    const scope = asJson(args.p_local_scope)
    const mapped = scope ? mappings.get(localKey(scope)) : null
    return mapped && mapped.hostedStudentId === args.p_student_id
      ? data({ schemaVersion: 2, status: 'mapped', mapping: clone(mapped) })
      : data({ schemaVersion: 2, status: 'unavailable' })
  }

  function hydrate(args: Json): HostedSyncRpcProviderResult {
    if (!keys(args, ['p_token_digest', 'p_student_id', 'p_assignment_ref', 'p_session_id'])) return data({ schemaVersion: 2, status: 'unavailable' })
    const held = sessions.get(key(args.p_student_id, args.p_assignment_ref, args.p_session_id))
    return held ? data({
      schemaVersion: 2, status: 'ready', mapping: clone(held.mapping), document: clone(held.document),
      ...(held.authorityCheckpoint ? {
        authorityCheckpoint: clone(held.authorityCheckpoint),
        authorityCheckpointRevision: held.authorityCheckpointRevision,
      } : {}),
      ...(held.learnerResponseCheckpoint ? {
        learnerResponseCheckpoint: clone(held.learnerResponseCheckpoint),
        learnerResponseCheckpointRevision: held.learnerResponseCheckpointRevision,
      } : {}),
      ...(held.familyPlanCheckpoint ? {
        familyPlanCheckpoint: clone(held.familyPlanCheckpoint),
        familyPlanCheckpointRevision: held.familyPlanCheckpointRevision,
      } : {}),
      courseEnrollments: [],
    }) : data({ schemaVersion: 2, status: 'unavailable' })
  }

  function write(args: Json): HostedSyncRpcProviderResult {
    if (!keys(args, ['p_token_digest', 'p_student_id', 'p_assignment_ref', 'p_session_id', 'p_expected_revision', 'p_client_operation_id', 'p_operation', 'p_payload'])) return data({ schemaVersion: 2, status: 'denied', code: 'study-session-invalid' })
    const operation = String(args.p_operation)
    const held = sessions.get(key(args.p_student_id, args.p_assignment_ref, args.p_session_id))
    if (!held) return data({ schemaVersion: 2, status: 'denied', code: 'study-session-invalid' })
    if (roles.get(String(args.p_token_digest)) === 'student' && ['rfl:attest', 'safety:clear', 'family-plan-checkpoint:compare-and-swap'].includes(operation)) return data({ schemaVersion: 2, status: 'denied', code: 'actor-not-authorized' })
    const domain = operation === 'authority-checkpoint:compare-and-swap' ? 'authority-checkpoint' :
      operation === 'learner-response-checkpoint:compare-and-swap' ? 'learner-response-checkpoint' :
        operation === 'family-plan-checkpoint:compare-and-swap' ? 'family-plan-checkpoint' :
      operation === 'checkpoint:compare-and-swap' ? 'checkpoint' : operation === 'session:complete' ? 'session' : 'authority'
    const receiptKey = `write:${args.p_client_operation_id}`
    const fingerprint = JSON.stringify(args)
    const prior = receipts.get(receiptKey)
    if (prior) return prior.fingerprint === fingerprint ? data(clone(prior.response)) : data({ schemaVersion: 2, status: 'idempotency-collision', operation })
    const revision = domain === 'authority-checkpoint' ? held.authorityCheckpointRevision
      : domain === 'learner-response-checkpoint' ? held.learnerResponseCheckpointRevision
        : domain === 'family-plan-checkpoint' ? held.familyPlanCheckpointRevision
          : held.revisions[domain]
    if (revision === undefined) return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'authority-checkpoint-unavailable' })
    if (args.p_expected_revision !== revision) return data({ schemaVersion: 2, status: 'revision-conflict', operation, revisionDomain: domain, serverRevision: revision })
    const payload = asJson(args.p_payload) ?? {}
    const openHolds = ((asJson(held.document.safetyState)?.holds as Json[] | undefined) ?? []).filter((item) => item.status !== 'cleared')
    if (openHolds.length && (operation === 'session:complete' || operation === 'rfl:attest' || (operation === 'assessment:set-state' && asJson(payload.assessment)?.status === 'CERTIFIED'))) {
      const response = { schemaVersion: 2, status: 'denied', code: 'safety-hold-active' }
      receipts.set(receiptKey, { fingerprint, response })
      return data(response)
    }
    let extra: Json = {}
    if (operation === 'authority-checkpoint:compare-and-swap') {
      const candidate = asJson(payload.authorityCheckpoint)
      const sync = asJson(candidate?.sync)
      if (!candidate || sync?.baseRevision !== revision || sync.serverRevision !== revision + 1 ||
          sync.operationId !== args.p_client_operation_id || sync.idempotencyKey !== args.p_client_operation_id) {
        return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'invalid-authority-checkpoint' })
      }
      held.authorityCheckpoint = clone(candidate)
      held.authorityCheckpointRevision = revision + 1
    } else if (operation === 'learner-response-checkpoint:compare-and-swap') {
      const candidate = asJson(payload.learnerResponseCheckpoint)
      const sync = asJson(candidate?.sync)
      if (!candidate || sync?.baseRevision !== revision || sync.revision !== revision + 1 ||
          sync.operationId !== args.p_client_operation_id) {
        return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'invalid-learner-response-checkpoint' })
      }
      held.learnerResponseCheckpoint = clone(candidate)
      held.learnerResponseCheckpointRevision = revision + 1
    } else if (operation === 'family-plan-checkpoint:compare-and-swap') {
      const candidate = asJson(payload.familyPlanCheckpoint)
      const sync = asJson(candidate?.sync)
      if (!candidate || sync?.baseRevision !== revision || sync.revision !== revision + 1 ||
          sync.operationId !== args.p_client_operation_id) {
        return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'invalid-family-plan-checkpoint' })
      }
      held.familyPlanCheckpoint = clone(candidate)
      held.familyPlanCheckpointRevision = revision + 1
    } else if (operation === 'checkpoint:compare-and-swap') {
      const checkpoint = asJson(payload.checkpoint)
      if (!checkpoint || checkpoint.revision !== revision + 1) return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'invalid-checkpoint' })
      held.document.checkpoint = clone(checkpoint)
    } else if (operation === 'session:complete') {
      const completion = asJson(held.document.completion)!
      completion.state = 'completed'; completion.completedAt = payload.completedAt
      extra = { completionState: 'completed', completedAt: payload.completedAt }
    } else if (operation === 'social-source:attach') {
      if (held.document.socialSource) return data({ schemaVersion: 2, status: 'invalid-write', operation, reasonCode: 'remote-state-exists' })
      held.document.socialSource = clone(payload.source)
    } else if (operation === 'rfl:assert' || operation === 'rfl:attest') {
      held.document.guardianAttestation = clone(payload.attestation)
      extra = { guardianAttestationStatus: asJson(payload.attestation)?.status }
    } else if (operation === 'safety:hold') {
      const safety = asJson(held.document.safetyState)!
      safety.holds = [...(safety.holds as Json[]), clone(payload.hold)]
      extra = { safetyState: 'stopped' }
    } else if (operation === 'safety:clear') {
      const safety = asJson(held.document.safetyState)!
      safety.holds = (safety.holds as Json[]).map((item) => item.holdRef === payload.holdRef ? { ...item, status: 'cleared', clearedAt: payload.clearedAt, clearedBy: payload.clearedByRef } : item)
      extra = { safetyState: (safety.holds as Json[]).some((item) => item.status !== 'cleared') ? 'stopped' : 'clear' }
    } else if (operation === 'assessment:set-state') {
      held.document.assessment = clone(payload.assessment)
      extra = { assessmentStatus: asJson(payload.assessment)?.status }
    }
    if (!['authority-checkpoint', 'learner-response-checkpoint', 'family-plan-checkpoint'].includes(domain)) {
      const legacyDomain = domain as keyof HeldSession['revisions']
      held.revisions[legacyDomain] += 1
      asJson(held.document.revisions)![legacyDomain] = held.revisions[legacyDomain]
    }
    held.document.syncMetadata = { lastAuthorityClientOperationId: args.p_client_operation_id, serverAcceptedAt: now().toISOString() }
    const response = { schemaVersion: 2, status: 'stored', operation, revisionDomain: domain,
      serverRevision: domain === 'authority-checkpoint' ? held.authorityCheckpointRevision!
        : domain === 'learner-response-checkpoint' ? held.learnerResponseCheckpointRevision!
          : domain === 'family-plan-checkpoint' ? held.familyPlanCheckpointRevision!
            : held.revisions[domain as keyof HeldSession['revisions']], ...extra }
    receipts.set(receiptKey, { fingerprint, response: clone(response) })
    return responseAfterCommit(HOSTED_SYNC_RPC.write, response)
  }

  const provider: LocalDbRpcEmulator = {
    get calls() { return calls },
    async rpc(name: HostedSyncRpcName, rawArgs: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<HostedSyncRpcProviderResult> {
      const args = clone(rawArgs) as Json
      calls.push(Object.freeze({ name, args }))
      if (signal?.aborted) return { data: null, error: { code: 'ABORTED' as const } }
      if (name === HOSTED_SYNC_RPC.firstLink) return firstLink(args)
      if (name === HOSTED_SYNC_RPC.resolveMapping) return resolve(args)
      if (name === HOSTED_SYNC_RPC.hydrate) return hydrate(args)
      return write(args)
    },
    dropNextCommittedResponse(name: typeof HOSTED_SYNC_RPC.firstLink | typeof HOSTED_SYNC_RPC.write) { drops.add(name) },
    setRole(tokenDigest: string, role: 'guardian' | 'student') { roles.set(tokenDigest, role) },
  }
  return Object.freeze(provider)
}

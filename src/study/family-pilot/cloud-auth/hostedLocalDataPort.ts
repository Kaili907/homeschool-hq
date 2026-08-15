import type { VerifiedAuthContext } from '../../../auth/supabaseSession'
import {
  authorityCheckpointFromHydrateR1,
  authorityCheckpointWritePayloadR1,
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
  restampFamilyPlanCheckpointR1,
  restampFamilyResponseCheckpointR1,
  withAuthorityCheckpointR1,
  type FamilyPlanCheckpointR1,
  type FamilyResponseCheckpointR1,
  type HostedSyncFirstLinkImport,
  type HostedSyncHostedScope,
  type HostedSyncRpcAdapter,
} from '../../hosted-sync/v2/client'
import { parseHostedSyncStateSnapshotR2, type HostedSyncStateSnapshotR2 } from '../../hosted-sync/v2/contracts'
import type { FamilyCloudLocalDataPort, FamilyCloudReconcileResult } from './types'

export interface FamilyCloudRemoteLearnerR1 {
  readonly learnerRef: string
  readonly hostedStudentId: string
  readonly tokenDigest: string
  readonly hostedScope: HostedSyncHostedScope
}

export type FamilyCloudRemoteDirectoryResultR1 =
  | Readonly<{ status: 'READY'; learners: readonly FamilyCloudRemoteLearnerR1[] }>
  | Readonly<{ status: 'OFFLINE' | 'UNAVAILABLE' }>

/** Resolves only current, household-authorized, ephemeral Study grants. */
export interface FamilyCloudRemoteDirectoryPortR1 {
  resolve(input: Readonly<{
    householdRef: string
    authorization: VerifiedAuthContext
    signal?: AbortSignal
  }>): Promise<FamilyCloudRemoteDirectoryResultR1>
}

export interface FamilyCloudLinkedLearnerMetadataR1 {
  readonly hostedStudentId: string
  readonly hostedScope: HostedSyncHostedScope
  readonly authorityRevision: number
  readonly learnerResponseRevision: number
  readonly familyPlanRevision: number
}

export interface FamilyCloudLocalLearnerStateR1 {
  readonly learnerRef: string
  readonly firstLinkBase: Omit<HostedSyncFirstLinkImport,
    'hostedScope' | 'authorityCheckpoint' | 'learnerResponseCheckpoint' | 'familyPlanCheckpoint'>
  readonly authorityCheckpoint: HostedSyncStateSnapshotR2
  readonly learnerResponseCheckpoint: FamilyResponseCheckpointR1
  readonly familyPlanCheckpoint: FamilyPlanCheckpointR1
  readonly courseEnrollments: readonly Readonly<Record<string, unknown>>[]
  readonly linked: FamilyCloudLinkedLearnerMetadataR1 | null
}

export interface FamilyCloudConflictR1 {
  readonly householdRef: string
  readonly learnerRef: string
  readonly domain: 'FIRST_LINK' | 'AUTHORITY' | 'LEARNER_RESPONSE' | 'FAMILY_PLAN'
  readonly local: FamilyCloudLocalLearnerStateR1
  readonly remote: FamilyCloudLocalLearnerStateR1 | null
}

/**
 * One adapter over the canonical Family Pilot stores. Implementations must
 * stage all learners, verify the staged bytes, then atomically publish them to
 * the existing local authority. No second client-side database is permitted.
 */
export interface FamilyCloudCheckpointRepositoryR1 {
  hasHousehold(householdRef: string): boolean
  readHousehold(householdRef: string): Promise<readonly FamilyCloudLocalLearnerStateR1[]>
  commitVerifiedHydration(input: Readonly<{
    householdRef: string
    learners: readonly FamilyCloudLocalLearnerStateR1[]
    expectedLocal: readonly FamilyCloudLocalLearnerStateR1[]
  }>): Promise<boolean>
  retainConflict(conflict: FamilyCloudConflictR1): Promise<void>
}

export interface HostedFamilyCloudLocalDataPortOptionsR1 {
  readonly directory: FamilyCloudRemoteDirectoryPortR1
  readonly repository: FamilyCloudCheckpointRepositoryR1
  readonly client: HostedSyncRpcAdapter
  readonly deviceRef: string
  readonly now?: () => Date
  readonly newOperationId?: () => string
}

interface ActiveHousehold {
  readonly householdRef: string
  readonly authorization: VerifiedAuthContext
  readonly directory: readonly FamilyCloudRemoteLearnerR1[]
  readonly remote: readonly FamilyCloudLocalLearnerStateR1[]
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const DIGEST = /^[0-9a-f]{64}$/

function exact(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(exact).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const held = value as Record<string, unknown>
    return `{${Object.keys(held).sort().map((key) => `${JSON.stringify(key)}:${exact(held[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function withoutSync<T extends { readonly sync: unknown }>(value: T): Omit<T, 'sync'> {
  const { sync: _sync, ...rest } = value
  return rest
}

function sameContent(a: { readonly sync: unknown }, b: { readonly sync: unknown }): boolean {
  return exact(withoutSync(a)) === exact(withoutSync(b))
}

function validDirectory(householdRef: string, learners: readonly FamilyCloudRemoteLearnerR1[]): boolean {
  if (new Set(learners.map((item) => item.learnerRef)).size !== learners.length ||
      new Set(learners.map((item) => item.hostedStudentId)).size !== learners.length) return false
  return learners.every((item) => REF.test(householdRef) && REF.test(item.learnerRef) && UUID.test(item.hostedStudentId) &&
    DIGEST.test(item.tokenDigest) && REF.test(item.hostedScope.assignmentRef) && REF.test(item.hostedScope.sessionRef))
}

function validLocal(householdRef: string, state: FamilyCloudLocalLearnerStateR1): boolean {
  const authority = parseHostedSyncStateSnapshotR2(state.authorityCheckpoint, state.authorityCheckpoint.identity)
  const response = parseFamilyResponseCheckpointR1(state.learnerResponseCheckpoint)
  const plan = parseFamilyPlanCheckpointR1(state.familyPlanCheckpoint)
  return authority.status === 'ready' && Boolean(response) && Boolean(plan) &&
    authority.status === 'ready' && authority.snapshot.identity.householdRef === householdRef &&
    authority.snapshot.identity.learnerRef === state.learnerRef &&
    response!.identity.householdRef === householdRef && response!.identity.learnerRef === state.learnerRef &&
    response!.identity.studentRef === authority.snapshot.identity.studentRef &&
    plan!.identity.householdRef === householdRef && plan!.identity.learnerRef === state.learnerRef &&
    plan!.identity.studentRef === authority.snapshot.identity.studentRef &&
    state.firstLinkBase.localScope.householdRef === householdRef &&
    state.firstLinkBase.localScope.studentRef === authority.snapshot.identity.studentRef
}

function firstLinkAuthorityCandidate(
  checkpoint: HostedSyncStateSnapshotR2,
  operationId: string,
  deviceRef: string,
  createdAt: string,
): HostedSyncStateSnapshotR2 {
  const candidate = {
    ...checkpoint,
    sync: {
      ...checkpoint.sync,
      operationId,
      idempotencyKey: operationId,
      operationKind: 'FIRST_LINK_IMPORT' as const,
      deviceRef,
      localSequence: checkpoint.sync.localSequence + 1,
      createdAt,
    },
  }
  const parsed = parseHostedSyncStateSnapshotR2(candidate, checkpoint.identity)
  if (parsed.status !== 'ready') throw new Error(`First-link authority checkpoint refused: ${parsed.reason}`)
  return parsed.snapshot
}

function firstLinkResponseCandidate(
  checkpoint: FamilyResponseCheckpointR1,
  operationId: string,
): FamilyResponseCheckpointR1 {
  const parsed = parseFamilyResponseCheckpointR1({
    ...checkpoint,
    sync: { ...checkpoint.sync, baseRevision: 0, revision: 0, operationId },
  })
  if (!parsed) throw new Error('First-link learner-response checkpoint refused.')
  return parsed
}

function firstLinkPlanCandidate(
  checkpoint: FamilyPlanCheckpointR1,
  operationId: string,
): FamilyPlanCheckpointR1 {
  const parsed = parseFamilyPlanCheckpointR1({
    ...checkpoint,
    sync: { ...checkpoint.sync, baseRevision: 0, revision: 0, operationId },
  })
  if (!parsed) throw new Error('First-link Family Plan checkpoint refused.')
  return parsed
}

function restampAuthority(
  checkpoint: HostedSyncStateSnapshotR2,
  expectedRevision: number,
  operationId: string,
  deviceRef: string,
  createdAt: string,
): HostedSyncStateSnapshotR2 {
  const candidate = {
    ...checkpoint,
    sync: {
      ...checkpoint.sync,
      baseRevision: expectedRevision,
      serverRevision: expectedRevision + 1,
      operationId,
      idempotencyKey: operationId,
      operationKind: 'CHECKPOINT' as const,
      deviceRef,
      localSequence: checkpoint.sync.localSequence + 1,
      createdAt,
    },
  }
  const parsed = parseHostedSyncStateSnapshotR2(candidate, checkpoint.identity)
  if (parsed.status !== 'ready') throw new Error(`Authority checkpoint CAS candidate refused: ${parsed.reason}`)
  return parsed.snapshot
}

function normalizedPlanCandidate(
  local: FamilyPlanCheckpointR1,
  remote: FamilyPlanCheckpointR1,
  expectedRevision: number,
  operationId: string,
  savedAt: string,
): FamilyPlanCheckpointR1 {
  const planner = Object.freeze({
    ...local.planner,
    revision: remote.planner.revision + 1,
    updatedAt: Date.parse(local.planner.updatedAt) >= Date.parse(remote.planner.updatedAt)
      ? local.planner.updatedAt : savedAt,
  })
  return restampFamilyPlanCheckpointR1(Object.freeze({ ...local, planner }), expectedRevision, operationId, savedAt)
}

export class HostedFamilyCloudLocalDataPortR1 implements FamilyCloudLocalDataPort {
  readonly #options: HostedFamilyCloudLocalDataPortOptionsR1
  readonly #now: () => Date
  readonly #newOperationId: () => string
  readonly #issuedOperationIds = new Set<string>()
  #active: ActiveHousehold | null = null
  #generation = 0

  constructor(options: HostedFamilyCloudLocalDataPortOptionsR1) {
    if (!REF.test(options.deviceRef)) throw new Error('Invalid Family Cloud device ref.')
    this.#options = options
    this.#now = options.now ?? (() => new Date())
    this.#newOperationId = options.newOperationId ?? (() => crypto.randomUUID())
  }

  clearCloudAuthority(): void {
    ++this.#generation
    this.#active = null
  }

  hasLocalHousehold(householdRef: string): boolean {
    try { return this.#options.repository.hasHousehold(householdRef) } catch { return false }
  }

  async establish(input: Readonly<{ householdRef: string; authorization: VerifiedAuthContext; signal?: AbortSignal }>): Promise<'READY' | 'OFFLINE' | 'UNAVAILABLE'> {
    const generation = ++this.#generation
    const resolved = await this.#options.directory.resolve(input).catch(() => ({ status: 'UNAVAILABLE' as const }))
    if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
    if (resolved.status !== 'READY') return resolved.status
    if (!validDirectory(input.householdRef, resolved.learners)) return 'UNAVAILABLE'
    const local = await this.#options.repository.readHousehold(input.householdRef).catch(() => null)
    if (!local || local.some((item) => !validLocal(input.householdRef, item))) return 'UNAVAILABLE'
    const localByLearner = new Map(local.map((item) => [item.learnerRef, item]))
    if ([...localByLearner.keys()].some((learnerRef) => !resolved.learners.some((entry) => entry.learnerRef === learnerRef))) return 'UNAVAILABLE'
    // A reconnect or provider-session refresh must reconcile the active
    // device before any remote hydration can publish. Otherwise a bootstrap
    // after an offline save could replace newer local work with the last
    // hosted snapshot.
    if (
      this.#active?.householdRef === input.householdRef &&
      this.#active.authorization.user.id === input.authorization.user.id
    ) {
      const reconciled = await this.reconcile(input)
      return reconciled === 'UP_TO_DATE' ? 'READY' : reconciled === 'OFFLINE' ? 'OFFLINE' : 'UNAVAILABLE'
    }
    const hydrated: FamilyCloudLocalLearnerStateR1[] = []
    for (const entry of resolved.learners) {
      const current = localByLearner.get(entry.learnerRef)
      const next = current?.linked
        ? await this.#hydrate(entry, current, input.signal)
        : current
          ? await this.#firstLink(entry, current, input.signal)
          : await this.#hydrate(entry, null, input.signal)
      if (next.status === 'OFFLINE') return 'OFFLINE'
      if (next.status !== 'READY') {
        if (current) await this.#options.repository.retainConflict({
          householdRef: input.householdRef, learnerRef: entry.learnerRef,
          domain: 'FIRST_LINK', local: current, remote: next.remote,
        }).catch(() => undefined)
        return 'UNAVAILABLE'
      }
      hydrated.push(next.state)
    }
    if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
    const committed = await this.#options.repository.commitVerifiedHydration({
      householdRef: input.householdRef, learners: Object.freeze(hydrated), expectedLocal: local,
    }).catch(() => false)
    if (!committed) return 'UNAVAILABLE'
    this.#active = Object.freeze({
      householdRef: input.householdRef, authorization: input.authorization,
      directory: Object.freeze([...resolved.learners]), remote: Object.freeze(hydrated),
    })
    return 'READY'
  }

  async reconcile(input: Readonly<{ householdRef: string; authorization: VerifiedAuthContext; signal?: AbortSignal }>): Promise<FamilyCloudReconcileResult> {
    const generation = this.#generation
    const active = this.#active
    if (!active || active.householdRef !== input.householdRef || active.authorization.user.id !== input.authorization.user.id) return 'UNAVAILABLE'
    const resolved = await this.#options.directory.resolve(input).catch(() => ({ status: 'UNAVAILABLE' as const }))
    if (resolved.status === 'OFFLINE') return 'OFFLINE'
    if (resolved.status !== 'READY' || !validDirectory(input.householdRef, resolved.learners)) return 'UNAVAILABLE'
    const local = await this.#options.repository.readHousehold(input.householdRef).catch(() => null)
    if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
    if (!local || local.some((item) => !validLocal(input.householdRef, item))) return 'UNAVAILABLE'
    const remoteByLearner = new Map(active.remote.map((item) => [item.learnerRef, item]))
    const directoryByLearner = new Map(resolved.learners.map((item) => [item.learnerRef, item]))
    for (const current of local) {
      const remote = remoteByLearner.get(current.learnerRef)
      const entry = directoryByLearner.get(current.learnerRef)
      if (!entry) return 'UNAVAILABLE'
      if (!remote || !remote.linked) {
        const firstLinked = await this.#firstLink(entry, current, input.signal)
        if (firstLinked.status === 'OFFLINE') return 'OFFLINE'
        if (firstLinked.status !== 'READY') return 'CONFLICT'
        remoteByLearner.set(current.learnerRef, firstLinked.state)
        continue
      }
      let conflict = await this.#writeChangedDomains(entry, current, remote, input.signal)
      let conflictRemote = remote
      for (let attempt = 0; conflict && conflict !== 'OFFLINE' && attempt < 3; attempt += 1) {
        const fresh = await this.#hydrate(entry, current, input.signal)
        if (fresh.status !== 'READY' || !this.#wasIssuedHere(fresh.state, conflict)) break
        conflictRemote = fresh.state
        remoteByLearner.set(current.learnerRef, fresh.state)
        conflict = await this.#writeChangedDomains(entry, current, fresh.state, input.signal)
      }
      if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
      if (conflict === 'OFFLINE') return 'OFFLINE'
      if (conflict) {
        await this.#options.repository.retainConflict({
          householdRef: input.householdRef, learnerRef: current.learnerRef,
          domain: conflict, local: current, remote: conflictRemote,
        }).catch(() => undefined)
        return 'CONFLICT'
      }
    }
    const refreshed: FamilyCloudLocalLearnerStateR1[] = []
    for (const entry of resolved.learners) {
      const current = local.find((item) => item.learnerRef === entry.learnerRef) ?? null
      const hydrated = await this.#hydrate(entry, current, input.signal)
      if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
      if (hydrated.status === 'OFFLINE') return 'OFFLINE'
      if (hydrated.status !== 'READY') return 'UNAVAILABLE'
      refreshed.push(hydrated.state)
    }
    const committed = await this.#options.repository.commitVerifiedHydration({
      householdRef: input.householdRef, learners: Object.freeze(refreshed), expectedLocal: local,
    }).catch(() => false)
    if (input.signal?.aborted || generation !== this.#generation) return 'UNAVAILABLE'
    if (!committed) return 'CONFLICT'
    this.#active = Object.freeze({ ...active, authorization: input.authorization, directory: Object.freeze([...resolved.learners]), remote: Object.freeze(refreshed) })
    return 'UP_TO_DATE'
  }

  async #firstLink(entry: FamilyCloudRemoteLearnerR1, local: FamilyCloudLocalLearnerStateR1, signal?: AbortSignal) {
    const operationId = this.#operationId()
    const createdAt = this.#now().toISOString()
    const authorityCheckpoint = firstLinkAuthorityCandidate(
      local.authorityCheckpoint, operationId, this.#options.deviceRef, createdAt,
    )
    const learnerResponseCheckpoint = firstLinkResponseCandidate(local.learnerResponseCheckpoint, operationId)
    const familyPlanCheckpoint = firstLinkPlanCandidate(local.familyPlanCheckpoint, operationId)
    const importDocument = withAuthorityCheckpointR1(Object.freeze({
      ...local.firstLinkBase,
      hostedScope: entry.hostedScope,
      learnerResponseCheckpoint,
      familyPlanCheckpoint,
    }), authorityCheckpoint)
    const outcome = await this.#options.client.firstLink({
      tokenDigest: entry.tokenDigest, studentId: entry.hostedStudentId,
      clientOperationId: operationId, import: importDocument,
    }, signal)
    if (outcome.code === 'OFFLINE') return { status: 'OFFLINE' as const }
    if (outcome.code !== 'SUCCESS' || !['imported', 'linked-existing'].includes(outcome.value.status)) {
      return { status: 'CONFLICT' as const, remote: null }
    }
    const hydrated = await this.#hydrate(entry, local, signal)
    if (hydrated.status !== 'READY') return hydrated
    if (exact(hydrated.state.authorityCheckpoint) !== exact(authorityCheckpoint) ||
        exact(hydrated.state.learnerResponseCheckpoint) !== exact(learnerResponseCheckpoint) ||
        exact(hydrated.state.familyPlanCheckpoint) !== exact(familyPlanCheckpoint)) {
      return { status: 'CONFLICT' as const, remote: hydrated.state }
    }
    return hydrated
  }

  async #hydrate(entry: FamilyCloudRemoteLearnerR1, local: FamilyCloudLocalLearnerStateR1 | null, signal?: AbortSignal) {
    const outcome = await this.#options.client.hydrate({
      tokenDigest: entry.tokenDigest, studentId: entry.hostedStudentId,
      assignmentRef: entry.hostedScope.assignmentRef, sessionId: entry.hostedScope.sessionRef,
    }, signal)
    if (outcome.code === 'OFFLINE') return { status: 'OFFLINE' as const }
    if (outcome.code !== 'SUCCESS' || outcome.value.status !== 'ready' ||
        !outcome.value.learnerResponseCheckpoint || outcome.value.learnerResponseCheckpointRevision === undefined ||
        !outcome.value.familyPlanCheckpoint || outcome.value.familyPlanCheckpointRevision === undefined ||
        !outcome.value.authorityCheckpoint || outcome.value.authorityCheckpointRevision === undefined) {
      return { status: 'UNAVAILABLE' as const, remote: null }
    }
    const identity = parseHostedSyncStateSnapshotR2(outcome.value.authorityCheckpoint)
    if (identity.status !== 'ready' || identity.snapshot.identity.learnerRef !== entry.learnerRef ||
        outcome.value.mapping.hostedStudentId !== entry.hostedStudentId ||
        outcome.value.mapping.hostedAssignmentRef !== entry.hostedScope.assignmentRef ||
        outcome.value.mapping.hostedSessionRef !== entry.hostedScope.sessionRef) {
      return { status: 'UNAVAILABLE' as const, remote: null }
    }
    const authority = authorityCheckpointFromHydrateR1(outcome.value, identity.snapshot.identity)
    const firstLinkBase = local?.firstLinkBase ?? Object.freeze({
      localScope: {
        householdRef: identity.snapshot.identity.householdRef,
        studentRef: identity.snapshot.identity.studentRef,
        assignmentRef: outcome.value.mapping.localAssignmentRef,
        sessionRef: outcome.value.mapping.localSessionRef,
      },
      session: outcome.value.document,
      checkpoint: null,
      socialSource: null,
      guardianAttestation: null,
      safetyState: { schemaVersion: 1 as const, holds: [] },
      assessment: null,
    })
    const state: FamilyCloudLocalLearnerStateR1 = Object.freeze({
      learnerRef: entry.learnerRef,
      firstLinkBase,
      authorityCheckpoint: authority,
      learnerResponseCheckpoint: outcome.value.learnerResponseCheckpoint,
      familyPlanCheckpoint: outcome.value.familyPlanCheckpoint,
      courseEnrollments: Object.freeze([...(outcome.value.courseEnrollments ?? [])]),
      linked: Object.freeze({
        hostedStudentId: entry.hostedStudentId,
        hostedScope: entry.hostedScope,
        authorityRevision: outcome.value.authorityCheckpointRevision,
        learnerResponseRevision: outcome.value.learnerResponseCheckpointRevision,
        familyPlanRevision: outcome.value.familyPlanCheckpointRevision,
      }),
    })
    if (!validLocal(identity.snapshot.identity.householdRef, state)) {
      return { status: 'UNAVAILABLE' as const, remote: null }
    }
    return { status: 'READY' as const, state }
  }

  async #writeChangedDomains(
    entry: FamilyCloudRemoteLearnerR1,
    local: FamilyCloudLocalLearnerStateR1,
    remote: FamilyCloudLocalLearnerStateR1,
    signal?: AbortSignal,
  ): Promise<FamilyCloudConflictR1['domain'] | 'OFFLINE' | null> {
    const linked = remote.linked!
    if (!sameContent(local.authorityCheckpoint, remote.authorityCheckpoint)) {
      const operationId = this.#operationId()
      const candidate = restampAuthority(local.authorityCheckpoint, linked.authorityRevision, operationId, this.#options.deviceRef, this.#now().toISOString())
      const result = await this.#options.client.write({
        tokenDigest: entry.tokenDigest, studentId: entry.hostedStudentId,
        assignmentRef: entry.hostedScope.assignmentRef, sessionId: entry.hostedScope.sessionRef,
        expectedRevision: linked.authorityRevision, clientOperationId: operationId,
        operation: 'authority-checkpoint:compare-and-swap',
        payload: authorityCheckpointWritePayloadR1({ checkpoint: candidate, expectedRevision: linked.authorityRevision, clientOperationId: operationId }),
      }, signal)
      if (result.code === 'OFFLINE') return 'OFFLINE'
      if (result.code !== 'SUCCESS' || result.value.status !== 'stored') return 'AUTHORITY'
    }
    if (!sameContent(local.learnerResponseCheckpoint, remote.learnerResponseCheckpoint)) {
      const operationId = this.#operationId()
      const candidate = restampFamilyResponseCheckpointR1(local.learnerResponseCheckpoint, linked.learnerResponseRevision, operationId, this.#now().toISOString())
      const result = await this.#options.client.write({
        tokenDigest: entry.tokenDigest, studentId: entry.hostedStudentId,
        assignmentRef: entry.hostedScope.assignmentRef, sessionId: entry.hostedScope.sessionRef,
        expectedRevision: linked.learnerResponseRevision, clientOperationId: operationId,
        operation: 'learner-response-checkpoint:compare-and-swap', payload: { learnerResponseCheckpoint: candidate },
      }, signal)
      if (result.code === 'OFFLINE') return 'OFFLINE'
      if (result.code !== 'SUCCESS' || result.value.status !== 'stored') return 'LEARNER_RESPONSE'
    }
    if (!sameContent(local.familyPlanCheckpoint, remote.familyPlanCheckpoint)) {
      const operationId = this.#operationId()
      const candidate = normalizedPlanCandidate(local.familyPlanCheckpoint, remote.familyPlanCheckpoint, linked.familyPlanRevision, operationId, this.#now().toISOString())
      const result = await this.#options.client.write({
        tokenDigest: entry.tokenDigest, studentId: entry.hostedStudentId,
        assignmentRef: entry.hostedScope.assignmentRef, sessionId: entry.hostedScope.sessionRef,
        expectedRevision: linked.familyPlanRevision, clientOperationId: operationId,
        operation: 'family-plan-checkpoint:compare-and-swap', payload: { familyPlanCheckpoint: candidate },
      }, signal)
      if (result.code === 'OFFLINE') return 'OFFLINE'
      if (result.code !== 'SUCCESS' || result.value.status !== 'stored') return 'FAMILY_PLAN'
    }
    return null
  }

  #operationId(): string {
    const operationId = this.#newOperationId()
    if (!UUID.test(operationId)) throw new Error('Family Cloud operation ID is invalid.')
    this.#issuedOperationIds.add(operationId)
    if (this.#issuedOperationIds.size > 64) this.#issuedOperationIds.delete(this.#issuedOperationIds.values().next().value!)
    return operationId
  }

  #wasIssuedHere(state: FamilyCloudLocalLearnerStateR1, domain: FamilyCloudConflictR1['domain']): boolean {
    const operationId = domain === 'AUTHORITY'
      ? state.authorityCheckpoint.sync.operationId
      : domain === 'LEARNER_RESPONSE'
        ? state.learnerResponseCheckpoint.sync.operationId
        : domain === 'FAMILY_PLAN'
          ? state.familyPlanCheckpoint.sync.operationId
          : ''
    return this.#issuedOperationIds.has(operationId)
  }
}

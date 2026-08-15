import type { BrowserContext, Page } from '@playwright/test'
import {
  FAMILY_PILOT_STATE_KEY,
  loadFamilyPilotState,
  type FamilyPilotStateV1,
} from '../../src/study/family-pilot/core'
import {
  FAMILY_PILOT_DURABLE_DATABASE_NAME,
  FAMILY_PILOT_DURABLE_OBJECT_STORE,
} from '../../src/study/family-pilot/durable-indexeddb'
import {
  durableStudyDocumentKey,
  emptyDurableStudyDocument,
  parseDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../../src/study/family-pilot/durable-ports'
import {
  familyAutoPlannerRecordKey,
  parseFamilyAutoPlannerRecord,
} from '../../src/study/family-pilot/auto-planner/indexedDbStore'
import {
  FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX,
} from '../../src/study/family-pilot/final-app/learner-response/store'
import type {
  LearnerResponseRecord,
} from '../../src/study/family-pilot/final-app/learner-response/types'
import {
  digestLocalPin,
  FINAL_FAMILY_PILOT_APP_STATE_KEY,
  loadFinalFamilyPilotAppState,
  parseFinalFamilyPilotAppState,
  type FinalFamilyPilotAppStateV1,
} from '../../src/study/family-pilot/final-app/state'
import {
  exportLocalBundleToHostedSyncStateR2,
  importHostedSyncStateToLocalBundleR2,
} from '../../src/study/hosted-sync/v2/contracts/localConversion'
import {
  parseHostedSyncStateSnapshotR2,
  type HostedSyncStateMetadataR2,
  type HostedSyncStateOperationKind,
  type HostedSyncStateSnapshotR2,
} from '../../src/study/hosted-sync/v2/contracts'
import {
  authorityCheckpointFromHydrateR1,
  authorityCheckpointWritePayloadR1,
  withAuthorityCheckpointR1,
} from '../../src/study/hosted-sync/v2/client/authorityCheckpoint'
import { createHostedSyncRpcAdapter } from '../../src/study/hosted-sync/v2/client/rpcAdapter'
import { assertHostedSyncPrivacyAllowlistR1 } from '../../src/study/hosted-sync/v2/client/privacyGate'
import {
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
  restampFamilyPlanCheckpointR1,
  restampFamilyResponseCheckpointR1,
  type FamilyPlanCheckpointR1,
  type FamilyResponseCheckpointR1,
} from '../../src/study/hosted-sync/v2/client/familyCheckpoints'
import {
  createLocalDbRpcEmulator,
  type LocalDbRpcEmulator,
} from '../../src/study/hosted-sync/v2/client/testing/localDbRpcEmulator'
import type {
  HostedSyncFirstLinkImport,
  HostedSyncRpcAdapter,
} from '../../src/study/hosted-sync/v2/client/types'

export const FAMILY_CLOUD_DEVICE_KEY = 'manuel-academy.family-cloud.device-ref.r1'
export const FAMILY_CLOUD_FIRST_LINK_KEY = 'manuel-academy.family-cloud.first-link.r1'
export const FAMILY_CLOUD_AUTH_COOKIE = 'manuel_academy_family_cloud_session_r1'

const GUARDIAN_TOKEN_DIGEST = 'a'.repeat(64)
const FIXED_HOSTED_HOUSEHOLD_ID = '00000000-0000-4000-8000-000000000011'
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/

interface IndexedDbEntry {
  readonly key: string
  readonly value: unknown
}

interface LearnerResponseDocumentV1 {
  readonly schemaVersion: 1
  readonly lessonRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly attemptRef: string
  readonly records: readonly LearnerResponseRecord[]
}

export interface FamilyCloudLearnerBundleR1 {
  readonly contract: 'family-pilot.cross-device-learner-bundle.r1'
  readonly contractVersion: 1
  readonly learner: HostedSyncStateSnapshotR2
  readonly planner: FamilyPlanCheckpointR1
  readonly responses: readonly FamilyResponseCheckpointR1[]
}

export interface FamilyCloudRequestEvidence {
  readonly deviceRef: string
  readonly operation: 'authenticate' | 'first-link' | 'hydrate' | 'compare-and-swap'
  readonly householdRef: string
  readonly learnerRef: string | null
  readonly payload: unknown
}

export type FamilyCloudMutationResult =
  | Readonly<{ status: 'stored'; revision: number; readBackVerified: boolean }>
  | Readonly<{ status: 'revision-conflict'; serverRevision: number; remote: FamilyCloudLearnerBundleR1 }>
  | Readonly<{ status: 'offline' }>
  | Readonly<{ status: 'refused'; reasonCode: string }>

export type FamilyCloudHydrateResult =
  | Readonly<{ status: 'ready'; revision: number; bundle: FamilyCloudLearnerBundleR1 }>
  | Readonly<{ status: 'offline' | 'unavailable' }>
  | Readonly<{ status: 'refused'; reasonCode: string }>

export interface FamilyCloudScenarioAdapter {
  readonly requests: readonly FamilyCloudRequestEvidence[]
  readonly providerCalls: readonly Readonly<{ args: unknown }>[]
  authenticate(deviceRef: string, householdRef: string): Promise<{ readonly status: 'authenticated'; readonly householdRef: string }>
  firstLink(deviceRef: string, bundle: FamilyCloudLearnerBundleR1): Promise<FamilyCloudMutationResult>
  hydrate(deviceRef: string, householdRef: string, learnerRef: string): Promise<FamilyCloudHydrateResult>
  compareAndSwap(deviceRef: string, bundle: FamilyCloudLearnerBundleR1, expectedRevision: number): Promise<FamilyCloudMutationResult>
  setOnline(deviceRef: string, online: boolean): void
  nextOperationId(): string
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const held = value as Record<string, unknown>
    return `{${Object.keys(held).sort().map((key) => `${JSON.stringify(key)}:${canonical(held[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function checkpointBody<T extends { readonly sync: unknown }>(value: T): Omit<T, 'sync'> {
  const { sync: _sync, ...body } = value
  return body
}

function sameCheckpointBody(a: { readonly sync: unknown }, b: { readonly sync: unknown }): boolean {
  return canonical(checkpointBody(a)) === canonical(checkpointBody(b))
}

function responseDocument(value: unknown, learnerRef: string): LearnerResponseDocumentV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const held = value as Partial<LearnerResponseDocumentV1>
  if (held.schemaVersion !== 1 || held.studentRef !== learnerRef || typeof held.lessonRef !== 'string' ||
      typeof held.assignmentRef !== 'string' || typeof held.attemptRef !== 'string' || !Array.isArray(held.records)) return null
  if (!held.records.every((record) => record && record.schemaVersion === 1 && record.studentRef === learnerRef &&
      record.lessonRef === held.lessonRef && record.assignmentRef === held.assignmentRef && record.attemptRef === held.attemptRef &&
      typeof record.itemRef === 'string' && typeof record.sectionRef === 'string' && typeof record.segmentRef === 'string' &&
      ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(record.responseType) &&
      (record.status === 'PENDING_ASSESSMENT' || record.status === 'ASSESSED'))) return null
  return clone(held as LearnerResponseDocumentV1)
}

function validateBundle(bundle: FamilyCloudLearnerBundleR1): FamilyCloudLearnerBundleR1 {
  if (bundle.contract !== 'family-pilot.cross-device-learner-bundle.r1' || bundle.contractVersion !== 1) {
    throw new Error('unknown-family-cloud-bundle')
  }
  const parsed = parseHostedSyncStateSnapshotR2(bundle.learner, bundle.learner.identity)
  if (parsed.status !== 'ready') throw new Error(`learner-checkpoint-${parsed.reason.toLowerCase()}`)
  const identity = parsed.snapshot.identity
  const planner = parseFamilyPlanCheckpointR1(bundle.planner)
  const responses = bundle.responses.map(parseFamilyResponseCheckpointR1)
  if (!planner || planner.identity.householdRef !== identity.householdRef ||
      planner.identity.studentRef !== identity.studentRef || planner.identity.learnerRef !== identity.learnerRef) {
    throw new Error('planner-checkpoint-identity-mismatch')
  }
  if (responses.length !== 1 || responses.some((checkpoint) => !checkpoint ||
      checkpoint.identity.householdRef !== identity.householdRef ||
      checkpoint.identity.studentRef !== identity.studentRef || checkpoint.identity.learnerRef !== identity.learnerRef)) {
    throw new Error('response-checkpoint-identity-mismatch')
  }
  return Object.freeze({
    contract: bundle.contract,
    contractVersion: bundle.contractVersion,
    learner: parsed.snapshot,
    planner,
    responses: Object.freeze(responses as FamilyResponseCheckpointR1[]),
  })
}

function legacyImport(
  snapshot: HostedSyncStateSnapshotR2,
  response: FamilyResponseCheckpointR1,
  plan: FamilyPlanCheckpointR1,
): HostedSyncFirstLinkImport {
  const assignmentRef = response.identity.assignmentRef
  const sessionRef = response.identity.sessionRef
  const base: HostedSyncFirstLinkImport = Object.freeze({
    localScope: {
      householdRef: snapshot.identity.householdRef,
      studentRef: snapshot.identity.studentRef,
      assignmentRef,
      sessionRef,
    },
    hostedScope: { assignmentRef, sessionRef },
    session: {
      lessonRef: response.attempt.lessonRef,
      subjectRef: 'family-cloud',
      state: 'active',
      startedAt: snapshot.sync.createdAt,
      completedAt: null,
      intendedLocalDate: snapshot.sync.createdAt.slice(0, 10),
    },
    checkpoint: null,
    socialSource: null,
    guardianAttestation: null,
    safetyState: { schemaVersion: 1, holds: [] },
    assessment: null,
    learnerResponseCheckpoint: response,
    familyPlanCheckpoint: plan,
  })
  return withAuthorityCheckpointR1(base, snapshot)
}

interface HeldLearner {
  readonly householdRef: string
  readonly learnerRef: string
  readonly studentId: string
  readonly assignmentRef: string
  readonly sessionRef: string
  bundle: FamilyCloudLearnerBundleR1
}

/**
 * Shared local server/database authority for browser E2E. The canonical learner
 * document uses the repository's four-RPC emulator. Planner and response
 * checkpoints are deliberately typed extensions and never a general JSON bag.
 */
export class LocalFamilyCloudScenarioAdapter implements FamilyCloudScenarioAdapter {
  readonly provider = createLocalDbRpcEmulator({ hostedHouseholdId: FIXED_HOSTED_HOUSEHOLD_ID })
  readonly requests: FamilyCloudRequestEvidence[] = []
  readonly #online = new Map<string, boolean>()
  readonly #clients = new Map<string, HostedSyncRpcAdapter>()
  readonly #authenticatedHousehold = new Map<string, string>()
  readonly #learners = new Map<string, HeldLearner>()
  #operationSequence = 1
  #studentSequence = 101

  constructor() {
    this.provider.setRole(GUARDIAN_TOKEN_DIGEST, 'guardian')
  }

  get providerCalls(): readonly Readonly<{ args: unknown }>[] {
    return this.provider.calls
  }

  nextOperationId(): string {
    return `20000000-0000-4000-8000-${(this.#operationSequence++).toString().padStart(12, '0')}`
  }

  setOnline(deviceRef: string, online: boolean): void {
    this.#online.set(deviceRef, online)
  }

  async authenticate(deviceRef: string, householdRef: string) {
    if (!REF.test(deviceRef) || !REF.test(householdRef)) throw new Error('invalid-local-auth-scope')
    this.#authenticatedHousehold.set(deviceRef, householdRef)
    this.requests.push({ deviceRef, operation: 'authenticate', householdRef, learnerRef: null, payload: { clientKind: 'AUTHENTICATED_USER' } })
    return { status: 'authenticated' as const, householdRef }
  }

  async firstLink(deviceRef: string, rawBundle: FamilyCloudLearnerBundleR1): Promise<FamilyCloudMutationResult> {
    if (!this.#online.get(deviceRef)) return { status: 'offline' }
    let bundle: FamilyCloudLearnerBundleR1
    try { bundle = validateBundle(rawBundle) } catch (error) { return { status: 'refused', reasonCode: String(error) } }
    const { householdRef, learnerRef } = bundle.learner.identity
    if (!this.#authorized(deviceRef, householdRef)) return { status: 'refused', reasonCode: 'household-authority-required' }
    this.requests.push({ deviceRef, operation: 'first-link', householdRef, learnerRef, payload: bundle })
    const existing = this.#learners.get(learnerRef)
    if (existing) {
      if (existing.householdRef !== householdRef) return { status: 'refused', reasonCode: 'learner-household-conflict' }
      return { status: 'revision-conflict', serverRevision: existing.bundle.learner.sync.serverRevision, remote: clone(existing.bundle) }
    }
    const studentId = `00000000-0000-4000-8000-${(this.#studentSequence++).toString().padStart(12, '0')}`
    const imported = legacyImport(bundle.learner, bundle.responses[0]!, bundle.planner)
    try { assertHostedSyncPrivacyAllowlistR1(imported) }
    catch (error) { return { status: 'refused', reasonCode: error instanceof Error ? error.message : String(error) } }
    const outcome = await this.#client(deviceRef).firstLink({
      tokenDigest: GUARDIAN_TOKEN_DIGEST,
      studentId,
      clientOperationId: bundle.learner.sync.operationId,
      import: imported,
    })
    if (outcome.code !== 'SUCCESS' || !['imported', 'linked-existing'].includes(outcome.value.status)) {
      return { status: 'refused', reasonCode: outcome.code === 'SUCCESS' ? outcome.value.status : outcome.code }
    }
    const assignmentRef = imported.hostedScope.assignmentRef
    const sessionRef = imported.hostedScope.sessionRef
    const held: HeldLearner = { householdRef, learnerRef, studentId, assignmentRef, sessionRef, bundle: clone(bundle) }
    this.#learners.set(learnerRef, held)
    const hydrated = await this.#hydrateHeld(deviceRef, held)
    const verified = hydrated.status === 'ready' && canonical(hydrated.bundle) === canonical(bundle)
    if (!verified) return { status: 'refused', reasonCode: 'first-link-readback-mismatch' }
    return { status: 'stored', revision: bundle.learner.sync.serverRevision, readBackVerified: true }
  }

  async hydrate(deviceRef: string, householdRef: string, learnerRef: string): Promise<FamilyCloudHydrateResult> {
    if (!this.#online.get(deviceRef)) return { status: 'offline' }
    if (!this.#authorized(deviceRef, householdRef)) return { status: 'refused', reasonCode: 'household-authority-required' }
    this.requests.push({ deviceRef, operation: 'hydrate', householdRef, learnerRef, payload: { householdRef, learnerRef } })
    const held = this.#learners.get(learnerRef)
    if (!held || held.householdRef !== householdRef) return { status: 'unavailable' }
    return this.#hydrateHeld(deviceRef, held)
  }

  async compareAndSwap(deviceRef: string, rawBundle: FamilyCloudLearnerBundleR1, expectedRevision: number): Promise<FamilyCloudMutationResult> {
    if (!this.#online.get(deviceRef)) return { status: 'offline' }
    let bundle: FamilyCloudLearnerBundleR1
    try { bundle = validateBundle(rawBundle) } catch (error) { return { status: 'refused', reasonCode: String(error) } }
    const { householdRef, learnerRef } = bundle.learner.identity
    if (!this.#authorized(deviceRef, householdRef)) return { status: 'refused', reasonCode: 'household-authority-required' }
    this.requests.push({ deviceRef, operation: 'compare-and-swap', householdRef, learnerRef, payload: bundle })
    const held = this.#learners.get(learnerRef)
    if (!held || held.householdRef !== householdRef) return { status: 'refused', reasonCode: 'mapping-unavailable' }
    const payload = authorityCheckpointWritePayloadR1({
      checkpoint: bundle.learner,
      expectedRevision,
      clientOperationId: bundle.learner.sync.operationId,
    })
    const outcome = await this.#client(deviceRef).write({
      tokenDigest: GUARDIAN_TOKEN_DIGEST,
      studentId: held.studentId,
      assignmentRef: held.assignmentRef,
      sessionId: held.sessionRef,
      expectedRevision,
      clientOperationId: bundle.learner.sync.operationId,
      operation: 'authority-checkpoint:compare-and-swap',
      payload,
    })
    if (outcome.code !== 'SUCCESS') return { status: 'refused', reasonCode: outcome.code }
    if (outcome.value.status === 'revision-conflict') {
      const remote = await this.#hydrateHeld(deviceRef, held)
      if (remote.status !== 'ready') return { status: 'refused', reasonCode: 'conflict-readback-unavailable' }
      return { status: 'revision-conflict', serverRevision: outcome.value.serverRevision, remote: remote.bundle }
    }
    if (outcome.value.status !== 'stored') return { status: 'refused', reasonCode: outcome.value.status }
    const storedBundle = clone({
      ...bundle,
      planner: held.bundle.planner,
      responses: held.bundle.responses,
    })
    const response = bundle.responses[0]!
    const heldResponse = held.bundle.responses[0]!
    if (!sameCheckpointBody(response, heldResponse)) {
      const operationId = this.nextOperationId()
      const candidate = restampFamilyResponseCheckpointR1(
        response, heldResponse.sync.revision, operationId, response.sync.savedAt,
      )
      const responseWrite = await this.#client(deviceRef).write({
        tokenDigest: GUARDIAN_TOKEN_DIGEST, studentId: held.studentId,
        assignmentRef: held.assignmentRef, sessionId: held.sessionRef,
        expectedRevision: heldResponse.sync.revision, clientOperationId: operationId,
        operation: 'learner-response-checkpoint:compare-and-swap',
        payload: { learnerResponseCheckpoint: candidate },
      })
      if (responseWrite.code !== 'SUCCESS') return { status: 'refused', reasonCode: responseWrite.code }
      if (responseWrite.value.status === 'revision-conflict') {
        const remote = await this.#hydrateHeld(deviceRef, held)
        if (remote.status !== 'ready') return { status: 'refused', reasonCode: 'conflict-readback-unavailable' }
        return { status: 'revision-conflict', serverRevision: remote.revision, remote: remote.bundle }
      }
      if (responseWrite.value.status !== 'stored') return { status: 'refused', reasonCode: responseWrite.value.status }
      storedBundle.responses = [candidate]
    }
    if (!sameCheckpointBody(bundle.planner, held.bundle.planner)) {
      const operationId = this.nextOperationId()
      const planner = parseFamilyPlanCheckpointR1({
        ...bundle.planner,
        planner: {
          ...bundle.planner.planner,
          revision: held.bundle.planner.planner.revision + 1,
        },
      })
      if (!planner) return { status: 'refused', reasonCode: 'planner-checkpoint-malformed' }
      const candidate = restampFamilyPlanCheckpointR1(
        planner, held.bundle.planner.sync.revision, operationId, bundle.planner.sync.savedAt,
      )
      const planWrite = await this.#client(deviceRef).write({
        tokenDigest: GUARDIAN_TOKEN_DIGEST, studentId: held.studentId,
        assignmentRef: held.assignmentRef, sessionId: held.sessionRef,
        expectedRevision: held.bundle.planner.sync.revision, clientOperationId: operationId,
        operation: 'family-plan-checkpoint:compare-and-swap',
        payload: { familyPlanCheckpoint: candidate },
      })
      if (planWrite.code !== 'SUCCESS') return { status: 'refused', reasonCode: planWrite.code }
      if (planWrite.value.status === 'revision-conflict') {
        const remote = await this.#hydrateHeld(deviceRef, held)
        if (remote.status !== 'ready') return { status: 'refused', reasonCode: 'conflict-readback-unavailable' }
        return { status: 'revision-conflict', serverRevision: remote.revision, remote: remote.bundle }
      }
      if (planWrite.value.status !== 'stored') return { status: 'refused', reasonCode: planWrite.value.status }
      storedBundle.planner = candidate
    }
    held.bundle = validateBundle(storedBundle)
    const readBack = await this.#hydrateHeld(deviceRef, held)
    // Response and plan domains receive their own CAS operation IDs/revisions;
    // verify the exact server-restamped aggregate, not the pre-CAS candidate.
    const verified = readBack.status === 'ready' && canonical(readBack.bundle) === canonical(storedBundle)
    if (!verified) return { status: 'refused', reasonCode: 'write-readback-mismatch' }
    return { status: 'stored', revision: outcome.value.serverRevision, readBackVerified: true }
  }

  #authorized(deviceRef: string, householdRef: string): boolean {
    return this.#authenticatedHousehold.get(deviceRef) === householdRef
  }

  #client(deviceRef: string): HostedSyncRpcAdapter {
    let client = this.#clients.get(deviceRef)
    if (client) return client
    this.#online.set(deviceRef, this.#online.get(deviceRef) ?? true)
    const authorization = {
      acquire: async () => ({
        status: 'AUTHORIZED' as const,
        lease: {
          clientKind: 'AUTHENTICATED_USER' as const,
          expiresAt: '2099-01-01T00:00:00.000Z',
          provider: this.provider,
        },
      }),
    }
    client = createHostedSyncRpcAdapter({ authorization, isOnline: () => this.#online.get(deviceRef) !== false })
    this.#clients.set(deviceRef, client)
    return client
  }

  async #hydrateHeld(deviceRef: string, held: HeldLearner): Promise<FamilyCloudHydrateResult> {
    const outcome = await this.#client(deviceRef).hydrate({
      tokenDigest: GUARDIAN_TOKEN_DIGEST,
      studentId: held.studentId,
      assignmentRef: held.assignmentRef,
      sessionId: held.sessionRef,
    })
    if (outcome.code !== 'SUCCESS') return outcome.code === 'OFFLINE' ? { status: 'offline' } : { status: 'refused', reasonCode: outcome.code }
    if (outcome.value.status !== 'ready' || !outcome.value.learnerResponseCheckpoint || !outcome.value.familyPlanCheckpoint) {
      return { status: 'unavailable' }
    }
    let snapshot: HostedSyncStateSnapshotR2
    try { snapshot = authorityCheckpointFromHydrateR1(outcome.value, held.bundle.learner.identity) }
    catch (error) { return { status: 'refused', reasonCode: String(error) } }
    const bundle = validateBundle({
      ...clone(held.bundle), learner: snapshot,
      planner: outcome.value.familyPlanCheckpoint,
      responses: [outcome.value.learnerResponseCheckpoint],
    })
    return { status: 'ready', revision: snapshot.sync.serverRevision, bundle }
  }
}

async function indexedDbEntries(page: Page): Promise<readonly IndexedDbEntry[]> {
  return page.evaluate(async ({ databaseName, storeName }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const result = await new Promise<Array<{ key: string; value: unknown }>>((resolve, reject) => {
      const store = db.transaction(storeName).objectStore(storeName)
      const keys = store.getAllKeys()
      const values = store.getAll()
      let heldKeys: IDBValidKey[] | null = null
      let heldValues: unknown[] | null = null
      const finish = () => {
        if (heldKeys && heldValues) resolve(heldValues.map((value, index) => ({ key: String(heldKeys![index]), value })))
      }
      keys.onsuccess = () => { heldKeys = keys.result; finish() }
      values.onsuccess = () => { heldValues = values.result; finish() }
      keys.onerror = () => reject(keys.error)
      values.onerror = () => reject(values.error)
    })
    db.close()
    return result
  }, { databaseName: FAMILY_PILOT_DURABLE_DATABASE_NAME, storeName: FAMILY_PILOT_DURABLE_OBJECT_STORE })
}

async function localState(page: Page): Promise<{ core: FamilyPilotStateV1; app: FinalFamilyPilotAppStateV1; entries: readonly IndexedDbEntry[] }> {
  const raw = await page.evaluate(({ coreKey, appKey }) => ({
    core: localStorage.getItem(coreKey),
    app: localStorage.getItem(appKey),
  }), { coreKey: FAMILY_PILOT_STATE_KEY, appKey: FINAL_FAMILY_PILOT_APP_STATE_KEY })
  const memory = new Map<string, string>()
  if (raw.core !== null) memory.set(FAMILY_PILOT_STATE_KEY, raw.core)
  if (raw.app !== null) memory.set(FINAL_FAMILY_PILOT_APP_STATE_KEY, raw.app)
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
  }
  const core = loadFamilyPilotState({ storage })
  const app = loadFinalFamilyPilotAppState({ storage })
  if (core.status !== 'ready' || app.status !== 'ready') throw new Error('browser-local-family-state-unavailable')
  return { core: core.state, app: app.state, entries: await indexedDbEntries(page) }
}

function durableDocument(state: Awaited<ReturnType<typeof localState>>, householdRef: string, learnerRef: string): DurableStudyDocumentV1 {
  const scope = { householdRef, learnerRef }
  const key = durableStudyDocumentKey(scope)
  const envelope = state.entries.find((entry) => entry.key === key)?.value as { value?: unknown } | undefined
  if (!envelope) return emptyDurableStudyDocument(scope, state.app.updatedAt)
  if (typeof envelope.value !== 'string') throw new Error('browser-study-envelope-unreadable')
  let parsed: unknown
  try { parsed = JSON.parse(envelope.value) } catch { throw new Error('browser-study-document-unreadable') }
  const result = parseDurableStudyDocument(parsed, scope)
  if (result.status !== 'current') throw new Error(`browser-study-document-${result.reasonCode}`)
  return result.document
}

function responseCheckpoints(
  state: Awaited<ReturnType<typeof localState>>,
  householdRef: string,
  learnerRef: string,
  operationId: string,
): readonly FamilyResponseCheckpointR1[] {
  const entries = state.entries.filter((entry) => entry.key.startsWith(`${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:student:${encodeURIComponent(learnerRef)}:`))
  const checkpoints = entries.map((entry) => {
    const document = responseDocument(entry.value, learnerRef)
    if (!document) throw new Error('browser-response-document-unreadable')
    return Object.freeze({
      contract: 'family-pilot.learner-response-checkpoint.r1' as const,
      contractVersion: 1 as const,
      identity: Object.freeze({
        householdRef,
        studentRef: learnerRef,
        learnerRef,
        assignmentRef: document.assignmentRef,
        sessionRef: document.attemptRef,
      }),
      attempt: Object.freeze({ attemptRef: document.attemptRef, lessonRef: document.lessonRef }),
      sync: Object.freeze({ baseRevision: 0, revision: 0, operationId, savedAt: document.records.at(-1)?.savedAt ?? state.app.updatedAt }),
      responses: Object.freeze(document.records.map((record) => Object.freeze({
        itemRef: record.itemRef,
        sectionRef: record.sectionRef,
        segmentRef: record.segmentRef,
        responseType: record.responseType,
        evidenceMode: record.evidenceMode,
        response: clone(record.response),
        status: record.status,
        savedAt: record.savedAt,
        assessment: clone(record.assessment),
      }))),
    })
  })
  if (checkpoints.length === 0) {
    const assignment = state.core.students.find((student) => student.studentRef === learnerRef)?.assignments[0]
    if (!assignment) throw new Error('browser-response-anchor-unavailable')
    const calendar = durableDocument(state, householdRef, learnerRef).calendar.find(
      (entry) => entry.plan.lessonRef === assignment.lessonRef,
    )
    const sessionRef = assignment.sessionRef ?? (calendar ? `${calendar.block.internalBlockId}:session` : null)
    if (!sessionRef) throw new Error('browser-response-session-anchor-unavailable')
    checkpoints.push(Object.freeze({
      contract: 'family-pilot.learner-response-checkpoint.r1' as const,
      contractVersion: 1 as const,
      identity: Object.freeze({
        householdRef, studentRef: learnerRef, learnerRef,
        assignmentRef: assignment.assignmentRef, sessionRef,
      }),
      attempt: Object.freeze({ attemptRef: sessionRef, lessonRef: assignment.lessonRef }),
      sync: Object.freeze({ baseRevision: 0, revision: 0, operationId, savedAt: state.app.updatedAt }),
      responses: Object.freeze([]),
    }))
  }
  // The response RPC revision is scoped to the one Study session selected at
  // first link. Other continuable-session responses travel in the minimized
  // authority checkpoint's instructionalInputs collection.
  checkpoints.sort((a, b) => a.sync.savedAt.localeCompare(b.sync.savedAt))
  return Object.freeze([checkpoints[0]!])
}

export async function captureLearnerBundle(
  page: Page,
  learnerRef: string,
  sync: HostedSyncStateMetadataR2,
): Promise<FamilyCloudLearnerBundleR1> {
  const state = await localState(page)
  const householdRef = state.app.householdRef
  const identity = Object.freeze({ householdRef, studentRef: learnerRef, learnerRef })
  const plannerScope = Object.freeze({ householdRef, learnerRef })
  const document = durableDocument(state, householdRef, learnerRef)
  const plannerKey = familyAutoPlannerRecordKey(plannerScope)
  const rawPlanner = state.entries.find((entry) => entry.key === plannerKey)?.value
  const plannerRecord = rawPlanner === undefined ? null : parseFamilyAutoPlannerRecord(rawPlanner, plannerScope)
  if (rawPlanner !== undefined && !plannerRecord) throw new Error('browser-planner-document-unreadable')
  const responseRecords = state.entries
    .filter((entry) => entry.key.startsWith(`${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:student:${encodeURIComponent(learnerRef)}:`))
    .flatMap((entry) => responseDocument(entry.value, learnerRef)?.records ?? [])
  const learner = exportLocalBundleToHostedSyncStateR2({
    identity,
    sync,
    local: {
      core: state.core, app: state.app, indexedDb: document,
      ...(plannerRecord ? { plannerDocument: plannerRecord.document } : {}),
      learnerResponses: responseRecords,
    },
  })
  return validateBundle(Object.freeze({
    contract: 'family-pilot.cross-device-learner-bundle.r1',
    contractVersion: 1,
    learner,
    planner: Object.freeze({
      contract: 'family-pilot.family-plan-checkpoint.r1',
      contractVersion: 1,
      identity: Object.freeze({ householdRef, studentRef: learnerRef, learnerRef }),
      sync: Object.freeze({ baseRevision: 0, revision: 0, operationId: sync.operationId, savedAt: learner.plannerDocument.updatedAt }),
      planner: learner.plannerDocument,
    }),
    responses: responseCheckpoints(state, householdRef, learnerRef, sync.operationId),
  }))
}

async function writeIndexedDb(
  page: Page,
  learnerRef: string,
  bundle: FamilyCloudLearnerBundleR1,
  authorityResponses: readonly LearnerResponseRecord[],
): Promise<void> {
  const scope = bundle.learner.identity
  const studyKey = durableStudyDocumentKey(scope)
  const plannerKey = familyAutoPlannerRecordKey(scope)
  const studyEnvelope = {
    envelopeVersion: 1,
    key: studyKey,
    value: JSON.stringify(bundle.learner.indexedDbDocument),
  }
  const responseRecords = [
    ...bundle.responses.flatMap((checkpoint) => checkpoint.responses.map((record) => ({
        schemaVersion: 1,
        lessonRef: checkpoint.attempt.lessonRef,
        studentRef: learnerRef,
        assignmentRef: checkpoint.identity.assignmentRef,
        attemptRef: checkpoint.attempt.attemptRef,
        ...record,
      }))),
    ...authorityResponses.map((record) => clone(record)),
  ]
  const unique = new Map<string, LearnerResponseRecord>()
  for (const record of responseRecords) unique.set(`${record.attemptRef}\u0000${record.itemRef}`, record)
  const grouped = new Map<string, LearnerResponseRecord[]>()
  for (const record of unique.values()) {
    const key = `${record.assignmentRef}\u0000${record.attemptRef}\u0000${record.lessonRef}`
    grouped.set(key, [...(grouped.get(key) ?? []), record])
  }
  const responseEntries = [...grouped.values()].map((records) => {
    const first = records[0]!
    return {
      key: `${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:student:${encodeURIComponent(learnerRef)}` +
        `:assignment:${encodeURIComponent(first.assignmentRef)}:attempt:${encodeURIComponent(first.attemptRef)}` +
        `:lesson:${encodeURIComponent(first.lessonRef)}`,
      value: {
        schemaVersion: 1, lessonRef: first.lessonRef, studentRef: learnerRef,
        assignmentRef: first.assignmentRef, attemptRef: first.attemptRef,
        records: records.map((record) => clone(record)),
      },
    }
  })
  await page.evaluate(async ({ databaseName, storeName, learnerPrefix, studyKey, studyEnvelope, plannerKey, plannerRecord, responseEntries }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      const cursor = store.openCursor()
      cursor.onsuccess = () => {
        const held = cursor.result
        if (!held) return
        if (String(held.key).startsWith(learnerPrefix)) held.delete()
        held.continue()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite')
      const store = transaction.objectStore(storeName)
      store.put(studyEnvelope, studyKey)
      store.put(plannerRecord, plannerKey)
      responseEntries.forEach((entry) => store.put(entry.value, entry.key))
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    db.close()
  }, {
    databaseName: FAMILY_PILOT_DURABLE_DATABASE_NAME,
    storeName: FAMILY_PILOT_DURABLE_OBJECT_STORE,
    learnerPrefix: `${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:student:${encodeURIComponent(learnerRef)}:`,
    studyKey,
    studyEnvelope,
    plannerKey,
    plannerRecord: { envelopeVersion: 1, key: plannerKey, document: bundle.planner.planner },
    responseEntries,
  })
}

export async function applyLearnerBundle(page: Page, bundle: FamilyCloudLearnerBundleR1, localParentPin: string | null): Promise<void> {
  const validated = validateBundle(bundle)
  const state = await localState(page)
  const targetDocument = durableDocument(
    state,
    validated.learner.identity.householdRef,
    validated.learner.identity.learnerRef,
  )
  const imported = importHostedSyncStateToLocalBundleR2({
    snapshot: validated.learner,
    target: { core: state.core, app: state.app, indexedDb: targetDocument },
    expectedIdentity: validated.learner.identity,
  })
  const appCandidate = {
    ...imported.app,
    activeStudentRef: null,
    parentAccessVerifier: state.app.parentAccessVerifier ?? (localParentPin === null ? null : digestLocalPin(localParentPin)),
  }
  const parsedApp = parseFinalFamilyPilotAppState(appCandidate)
  if (!parsedApp.state) throw new Error('hydrated-app-state-unreadable')
  await page.evaluate(({ coreKey, appKey, householdKey, core, app, householdRef }) => {
    localStorage.setItem(coreKey, JSON.stringify(core))
    localStorage.setItem(appKey, JSON.stringify(app))
    localStorage.setItem(householdKey, householdRef)
  }, {
    coreKey: FAMILY_PILOT_STATE_KEY,
    appKey: FINAL_FAMILY_PILOT_APP_STATE_KEY,
    householdKey: 'manuel-academy.family-pilot-household-ref',
    core: imported.core,
    app: parsedApp.state,
    householdRef: validated.learner.identity.householdRef,
  })
  await writeIndexedDb(
    page,
    validated.learner.identity.learnerRef,
    validated,
    imported.learnerResponses ?? [],
  )
}

export interface DeviceSyncConflict {
  readonly learnerRef: string
  readonly expectedRevision: number
  readonly serverRevision: number
  readonly localBundle: FamilyCloudLearnerBundleR1
  readonly remoteBundle: FamilyCloudLearnerBundleR1
}

export class BrowserFamilyCloudDevice {
  readonly revisions = new Map<string, number>()
  readonly pending = new Map<string, { readonly bundle: FamilyCloudLearnerBundleR1; readonly expectedRevision: number }>()
  readonly conflicts: DeviceSyncConflict[] = []
  #sequence = 1

  constructor(
    readonly context: BrowserContext,
    readonly page: Page,
    readonly adapter: FamilyCloudScenarioAdapter,
    readonly deviceRef: string,
    readonly parentPin: string | null,
  ) {}

  async initialize(): Promise<void> {
    await this.page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: FAMILY_CLOUD_DEVICE_KEY, value: this.deviceRef })
    this.adapter.setOnline(this.deviceRef, true)
  }

  async authenticate(householdRef: string): Promise<void> {
    const result = await this.adapter.authenticate(this.deviceRef, householdRef)
    if (result.status !== 'authenticated') throw new Error('family-cloud-authentication-failed')
    const url = new URL(this.page.url())
    await this.context.addCookies([{ name: FAMILY_CLOUD_AUTH_COOKIE, value: `${this.deviceRef}:authenticated`, domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Strict' }])
  }

  async firstLink(learnerRef: string): Promise<FamilyCloudMutationResult> {
    const operationId = this.adapter.nextOperationId()
    const bundle = await captureLearnerBundle(this.page, learnerRef, this.#metadata(0, 0, operationId, 'FIRST_LINK_IMPORT'))
    const result = await this.adapter.firstLink(this.deviceRef, bundle)
    if (result.status === 'stored' && result.readBackVerified) {
      this.revisions.set(learnerRef, result.revision)
      await this.page.evaluate(({ key, deviceRef, householdRef, learnerRef, revision }) => {
        const prior = JSON.parse(localStorage.getItem(key) ?? '{"learners":{}}')
        prior.deviceRef = deviceRef
        prior.householdRef = householdRef
        prior.learners = { ...(prior.learners ?? {}), [learnerRef]: { revision, readBackVerified: true } }
        localStorage.setItem(key, JSON.stringify(prior))
      }, { key: FAMILY_CLOUD_FIRST_LINK_KEY, deviceRef: this.deviceRef, householdRef: bundle.learner.identity.householdRef, learnerRef, revision: result.revision })
    }
    return result
  }

  async hydrate(householdRef: string, learnerRef: string): Promise<FamilyCloudHydrateResult> {
    const result = await this.adapter.hydrate(this.deviceRef, householdRef, learnerRef)
    if (result.status === 'ready') {
      await applyLearnerBundle(this.page, result.bundle, this.parentPin)
      this.revisions.set(learnerRef, result.revision)
    }
    return result
  }

  async push(learnerRef: string, operationKind: HostedSyncStateOperationKind = 'CHECKPOINT'): Promise<FamilyCloudMutationResult> {
    const expectedRevision = this.revisions.get(learnerRef)
    if (expectedRevision === undefined) return { status: 'refused', reasonCode: 'device-revision-unavailable' }
    const operationId = this.adapter.nextOperationId()
    const bundle = await captureLearnerBundle(
      this.page,
      learnerRef,
      this.#metadata(expectedRevision, expectedRevision + 1, operationId, operationKind),
    )
    const result = await this.adapter.compareAndSwap(this.deviceRef, bundle, expectedRevision)
    if (result.status === 'offline') this.pending.set(learnerRef, { bundle, expectedRevision })
    if (result.status === 'stored') {
      this.revisions.set(learnerRef, result.revision)
      this.pending.delete(learnerRef)
    }
    if (result.status === 'revision-conflict') {
      this.conflicts.push({ learnerRef, expectedRevision, serverRevision: result.serverRevision, localBundle: bundle, remoteBundle: result.remote })
    }
    return result
  }

  async flush(learnerRef: string): Promise<FamilyCloudMutationResult> {
    const held = this.pending.get(learnerRef)
    if (!held) return { status: 'refused', reasonCode: 'no-pending-write' }
    const result = await this.adapter.compareAndSwap(this.deviceRef, held.bundle, held.expectedRevision)
    if (result.status === 'stored') {
      this.revisions.set(learnerRef, result.revision)
      this.pending.delete(learnerRef)
    }
    if (result.status === 'revision-conflict') {
      this.conflicts.push({ learnerRef, expectedRevision: held.expectedRevision, serverRevision: result.serverRevision, localBundle: held.bundle, remoteBundle: result.remote })
    }
    return result
  }

  setOnline(online: boolean): void {
    this.adapter.setOnline(this.deviceRef, online)
  }

  #metadata(baseRevision: number, serverRevision: number, operationId: string, operationKind: HostedSyncStateOperationKind): HostedSyncStateMetadataR2 {
    return Object.freeze({
      serverRevision,
      baseRevision,
      operationId,
      idempotencyKey: operationId,
      operationKind,
      deviceRef: this.deviceRef,
      localSequence: this.#sequence++,
      createdAt: new Date().toISOString(),
    })
  }
}

export async function browserStorageEvidence(page: Page): Promise<{
  readonly deviceRef: string | null
  readonly householdRef: string | null
  readonly core: FamilyPilotStateV1 | null
  readonly app: FinalFamilyPilotAppStateV1 | null
  readonly indexedDb: readonly IndexedDbEntry[]
}> {
  const local = await page.evaluate(({ deviceKey, coreKey, appKey }) => ({
    deviceRef: localStorage.getItem(deviceKey),
    core: JSON.parse(localStorage.getItem(coreKey) ?? 'null'),
    app: JSON.parse(localStorage.getItem(appKey) ?? 'null'),
  }), { deviceKey: FAMILY_CLOUD_DEVICE_KEY, coreKey: FAMILY_PILOT_STATE_KEY, appKey: FINAL_FAMILY_PILOT_APP_STATE_KEY })
  return {
    deviceRef: local.deviceRef,
    householdRef: local.app?.householdRef ?? null,
    core: local.core,
    app: local.app,
    indexedDb: await indexedDbEntries(page),
  }
}

export function exactJson(value: unknown): string {
  return canonical(value)
}

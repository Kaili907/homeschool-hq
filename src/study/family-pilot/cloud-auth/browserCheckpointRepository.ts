import {
  loadFamilyPilotState,
  saveFamilyPilotState,
  type FamilyPilotStateV1,
} from '../core'
import {
  durableStudyDocumentKey,
  emptyDurableStudyDocument,
  loadDurableStudyDocument,
  saveDurableStudyDocument,
  type DurableStudyDocumentV1,
} from '../durable-ports'
import { openFamilyPilotIndexedDbStudyStorage } from '../durable-indexeddb'
import {
  familyAutoPlannerRecordKey,
  openFamilyAutoPlannerIndexedDbStore,
  type FamilyAutoPlannerDocumentV1,
} from '../auto-planner'
import {
  BrowserLearnerResponseStore,
  learnerResponseDocumentKey,
} from '../final-app/learner-response/store'
import type { LearnerResponseRecord } from '../final-app/learner-response/types'
import { openIndexedDbRecordStore } from '../durable-indexeddb'
import {
  FINAL_FAMILY_PILOT_APP_STATE_KEY,
  emptyFinalFamilyPilotAppState,
  loadFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
  type FinalFamilyPilotAppStateV1,
} from '../final-app/state'
import { FAMILY_PILOT_STATE_KEY } from '../core/store'
import {
  FAMILY_PLAN_CHECKPOINT_CONTRACT_R1,
  FAMILY_RESPONSE_CHECKPOINT_CONTRACT_R1,
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
  type FamilyPlanCheckpointR1,
  type FamilyResponseCheckpointR1,
} from '../../hosted-sync/v2/client'
import {
  exportLocalBundleToHostedSyncStateR2,
  importHostedSyncStateToLocalBundleR2,
  type HostedSyncLocalBundleR2,
  type HostedSyncStateMetadataR2,
} from '../../hosted-sync/v2/contracts'
import type {
  FamilyCloudBootstrapLearnerR1,
} from './browserTransport'
import { createBrowserHouseholdScopedStorage } from './scopedStorage'
import type {
  FamilyCloudCheckpointRepositoryR1,
  FamilyCloudConflictR1,
  FamilyCloudLinkedLearnerMetadataR1,
  FamilyCloudLocalLearnerStateR1,
} from './hostedLocalDataPort'

const META_KEY = 'manuel-academy.family-cloud.checkpoint-metadata.r1'
const CONFLICT_KEY = 'manuel-academy.family-cloud.conflicts.r1'
const PLACEHOLDER_ASSIGNMENT = 'family-cloud:learner-authority'
const PLACEHOLDER_LESSON = 'family-cloud:learner-authority'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

interface RepositoryMetadataR1 {
  readonly schemaVersion: 1
  readonly householdRef: string
  readonly initialized: boolean
  readonly operationIds: Readonly<Record<string, string>>
  readonly linked: Readonly<Record<string, FamilyCloudLinkedLearnerMetadataR1>>
}

interface IndexedDbPublicationBackup {
  readonly key: string
  readonly prior: unknown
  readonly published: unknown
}

function clone<T>(value: T): T { return structuredClone(value) }

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const held = value as Record<string, unknown>
    return `{${Object.keys(held).sort().map((key) => `${JSON.stringify(key)}:${canonical(held[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function replaceRef<T>(value: T, from: string, to: string): T {
  if (from === to) return clone(value)
  if (value === from) return to as T
  if (Array.isArray(value)) return value.map((item) => replaceRef(item, from, to)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key, replaceRef(item, from, to)])) as T
  }
  return value
}

function browserStorage(): StorageLike {
  if (typeof window === 'undefined') throw new Error('Browser storage unavailable.')
  return window.localStorage
}

function parseMetadata(value: string | null, householdRef: string): RepositoryMetadataR1 | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<RepositoryMetadataR1>
    if (parsed.schemaVersion !== 1 || parsed.householdRef !== householdRef || parsed.initialized !== true ||
      !parsed.operationIds || typeof parsed.operationIds !== 'object' || !parsed.linked || typeof parsed.linked !== 'object') return null
    if (!Object.values(parsed.operationIds).every((item) => typeof item === 'string' && UUID.test(item))) return null
    return parsed as RepositoryMetadataR1
  } catch { return null }
}

function sourceStorage(householdRef: string): { storage: StorageLike; app: FinalFamilyPilotAppStateV1 } {
  const scoped = createBrowserHouseholdScopedStorage(householdRef)
  const scopedApp = loadFinalFamilyPilotAppState({ storage: scoped, householdRef })
  const published = parseMetadata(scoped.getItem(META_KEY), householdRef)?.initialized === true
  if (published && scoped.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY) !== null && scopedApp.status === 'ready') {
    return { storage: scoped, app: scopedApp.state }
  }
  const local = browserStorage()
  const localApp = loadFinalFamilyPilotAppState({ storage: local })
  return { storage: local, app: localApp.state }
}

function checkpointSync(revision: number, operationId: string, savedAt: string) {
  return Object.freeze({ baseRevision: revision, revision, operationId, savedAt })
}

function metadataSync(revision: number, operationId: string, deviceRef: string, createdAt: string): HostedSyncStateMetadataR2 {
  return Object.freeze({
    serverRevision: revision,
    baseRevision: revision,
    operationId,
    idempotencyKey: operationId,
    operationKind: revision === 0 ? 'FIRST_LINK_IMPORT' as const : 'CHECKPOINT' as const,
    deviceRef,
    localSequence: revision,
    createdAt,
  })
}

function placeholderSessionRef(learnerRef: string): string {
  return `family-cloud:session:${learnerRef}`.slice(0, 192)
}

function responseCheckpoint(input: {
  householdRef: string
  learnerRef: string
  operationId: string
  revision: number
  savedAt: string
  records: readonly LearnerResponseRecord[]
}): FamilyResponseCheckpointR1 {
  const primary = input.records[0]
  const assignmentRef = primary?.assignmentRef ?? PLACEHOLDER_ASSIGNMENT
  const sessionRef = primary?.attemptRef ?? placeholderSessionRef(input.learnerRef)
  const lessonRef = primary?.lessonRef ?? PLACEHOLDER_LESSON
  const records = input.records.filter((record) => record.assignmentRef === assignmentRef && record.attemptRef === sessionRef)
  const checkpoint = {
    contract: FAMILY_RESPONSE_CHECKPOINT_CONTRACT_R1,
    contractVersion: 1 as const,
    identity: { householdRef: input.householdRef, studentRef: input.learnerRef, learnerRef: input.learnerRef, assignmentRef, sessionRef },
    attempt: { attemptRef: sessionRef, lessonRef },
    sync: checkpointSync(input.revision, input.operationId, input.savedAt),
    responses: records.map((record) => ({
      itemRef: record.itemRef, sectionRef: record.sectionRef, segmentRef: record.segmentRef,
      responseType: record.responseType, evidenceMode: record.evidenceMode,
      response: record.response, status: record.status, savedAt: record.savedAt, assessment: record.assessment,
    })),
  }
  const parsed = parseFamilyResponseCheckpointR1(checkpoint)
  if (!parsed) throw new Error('Local learner response checkpoint was refused.')
  return parsed
}

function planCheckpoint(input: {
  householdRef: string
  learnerRef: string
  operationId: string
  revision: number
  savedAt: string
  planner: FamilyAutoPlannerDocumentV1
}): FamilyPlanCheckpointR1 {
  const parsed = parseFamilyPlanCheckpointR1({
    contract: FAMILY_PLAN_CHECKPOINT_CONTRACT_R1,
    contractVersion: 1,
    identity: { householdRef: input.householdRef, studentRef: input.learnerRef, learnerRef: input.learnerRef },
    sync: checkpointSync(input.revision, input.operationId, input.savedAt),
    planner: input.planner,
  })
  if (!parsed) throw new Error('Local Family Plan checkpoint was refused.')
  return parsed
}

async function durableDocument(sourceHouseholdRef: string, targetHouseholdRef: string, learnerRef: string, fallbackAt: string): Promise<DurableStudyDocumentV1> {
  const storage = await openFamilyPilotIndexedDbStudyStorage({ scope: { householdRef: sourceHouseholdRef, learnerRef } })
  try {
    const loaded = loadDurableStudyDocument({ householdRef: sourceHouseholdRef, learnerRef }, {
      storage: storage.storage,
      now: () => fallbackAt,
    })
    if (!['ready', 'unavailable'].includes(loaded.status)) throw new Error('Saved Study state is not readable for Family Cloud.')
    return replaceRef(loaded.document, sourceHouseholdRef, targetHouseholdRef)
  } finally { storage.close() }
}

async function plannerDocument(sourceHouseholdRef: string, targetHouseholdRef: string, learnerRef: string, fallbackAt: string) {
  const store = await openFamilyAutoPlannerIndexedDbStore({ now: () => new Date(fallbackAt) })
  try {
    const loaded = await store.load({ householdRef: sourceHouseholdRef, learnerRef })
    if (loaded.status !== 'ready') throw new Error('Saved Family Plan is not readable for Family Cloud.')
    return replaceRef(loaded.document, sourceHouseholdRef, targetHouseholdRef)
  } finally { store.close() }
}

async function learnerResponses(app: FinalFamilyPilotAppStateV1, core: FamilyPilotStateV1, learnerRef: string): Promise<readonly LearnerResponseRecord[]> {
  const responseStore = new BrowserLearnerResponseStore()
  const records: LearnerResponseRecord[] = []
  for (const saved of app.sessions.filter((item) => item.studentRef === learnerRef)) {
    const lessonRef = core.students.find((item) => item.studentRef === learnerRef)?.assignments
      .find((item) => item.assignmentRef === saved.assignmentRef)?.lessonRef ?? saved.assignmentRef
    records.push(...await responseStore.list({
      studentRef: learnerRef,
      assignmentRef: saved.assignmentRef,
      attemptRef: saved.session.sessionRef,
      lessonRef,
    }))
  }
  return Object.freeze(records)
}

function sameLearnerContent(a: FamilyCloudLocalLearnerStateR1, b: FamilyCloudLocalLearnerStateR1): boolean {
  const body = (value: FamilyCloudLocalLearnerStateR1) => ({
    learnerRef: value.learnerRef,
    authorityCheckpoint: { ...value.authorityCheckpoint, sync: null },
    learnerResponseCheckpoint: { ...value.learnerResponseCheckpoint, sync: null },
    familyPlanCheckpoint: { ...value.familyPlanCheckpoint, sync: null },
    courseEnrollments: value.courseEnrollments,
    linked: value.linked,
  })
  return canonical(body(a)) === canonical(body(b))
}

export class BrowserFamilyCloudCheckpointRepositoryR1 implements FamilyCloudCheckpointRepositoryR1 {
  readonly #deviceRef: string
  readonly #operationIds = new Map<string, string>()

  constructor(deviceRef: string) { this.#deviceRef = deviceRef }

  listBootstrapLearners(householdRef: string): readonly FamilyCloudBootstrapLearnerR1[] {
    const { app } = sourceStorage(householdRef)
    return Object.freeze(app.setup.students.map((student) => Object.freeze({
      learnerRef: student.studentRef,
      displayName: student.displayName,
      gradeLevel: student.nominalGrade,
    })))
  }

  hasHousehold(householdRef: string): boolean {
    const scoped = createBrowserHouseholdScopedStorage(householdRef)
    return parseMetadata(scoped.getItem(META_KEY), householdRef)?.initialized === true
  }

  async readHousehold(householdRef: string): Promise<readonly FamilyCloudLocalLearnerStateR1[]> {
    const source = sourceStorage(householdRef)
    const sourceHouseholdRef = source.app.householdRef
    const scoped = createBrowserHouseholdScopedStorage(householdRef)
    const metadata = parseMetadata(scoped.getItem(META_KEY), householdRef)
    const coreSnapshot = loadFamilyPilotState({ storage: source.storage })
    if (!['ready', 'recovered'].includes(coreSnapshot.status)) throw new Error('Family Pilot Core state is not readable for Family Cloud.')
    const app = replaceRef(source.app, sourceHouseholdRef, householdRef)
    const core = replaceRef(coreSnapshot.state, sourceHouseholdRef, householdRef)
    const learners: FamilyCloudLocalLearnerStateR1[] = []
    for (const profile of app.setup.students) {
      const learnerRef = profile.studentRef
      const linked = metadata?.linked[learnerRef] ?? null
      const operationId = metadata?.operationIds[learnerRef] ?? this.#operationIds.get(learnerRef) ?? crypto.randomUUID()
      this.#operationIds.set(learnerRef, operationId)
      const durable = await durableDocument(sourceHouseholdRef, householdRef, learnerRef, app.updatedAt)
      const planner = await plannerDocument(sourceHouseholdRef, householdRef, learnerRef, app.updatedAt)
      const responses = await learnerResponses(source.app, coreSnapshot.state, learnerRef)
      const savedAt = app.updatedAt
      const revision = linked?.authorityRevision ?? 0
      const authorityCheckpoint = exportLocalBundleToHostedSyncStateR2({
        identity: { householdRef, studentRef: learnerRef, learnerRef },
        sync: metadataSync(revision, operationId, this.#deviceRef, savedAt),
        local: { core, app, indexedDb: durable, plannerDocument: planner, learnerResponses: responses },
      })
      const response = responseCheckpoint({
        householdRef, learnerRef, operationId,
        revision: linked?.learnerResponseRevision ?? 0,
        savedAt, records: responses,
      })
      const plan = planCheckpoint({
        householdRef, learnerRef, operationId,
        revision: linked?.familyPlanRevision ?? 0,
        savedAt, planner,
      })
      learners.push(Object.freeze({
        learnerRef,
        firstLinkBase: Object.freeze({
          localScope: Object.freeze({
            householdRef, studentRef: learnerRef,
            assignmentRef: response.identity.assignmentRef,
            sessionRef: response.identity.sessionRef,
          }),
          session: Object.freeze({
            lessonRef: response.attempt.lessonRef,
            subjectRef: 'family-cloud',
            state: 'planned', startedAt: null, completedAt: null,
            intendedLocalDate: savedAt.slice(0, 10),
          }),
          checkpoint: null, socialSource: null, guardianAttestation: null,
          safetyState: Object.freeze({ schemaVersion: 1 as const, holds: Object.freeze([]) }),
          assessment: null,
        }),
        authorityCheckpoint,
        learnerResponseCheckpoint: response,
        familyPlanCheckpoint: plan,
        courseEnrollments: Object.freeze([]),
        linked,
      }))
    }
    return Object.freeze(learners)
  }

  async commitVerifiedHydration(input: {
    householdRef: string
    learners: readonly FamilyCloudLocalLearnerStateR1[]
    expectedLocal: readonly FamilyCloudLocalLearnerStateR1[]
  }): Promise<boolean> {
    const before = await this.readHousehold(input.householdRef)
    if (before.length !== input.expectedLocal.length || before.some((item, index) => !sameLearnerContent(item, input.expectedLocal[index]!))) return false

    const scoped = createBrowserHouseholdScopedStorage(input.householdRef)
    const source = sourceStorage(input.householdRef)
    const sourceHouseholdRef = source.app.householdRef
    const sourceCore = loadFamilyPilotState({ storage: source.storage })
    if (!['ready', 'recovered'].includes(sourceCore.status)) return false
    let combined: HostedSyncLocalBundleR2 = {
      // Device-only access verifiers are deliberately absent from hosted checkpoints.
      // Start hydration from the active local source so a first link keeps them.
      core: replaceRef(sourceCore.state, sourceHouseholdRef, input.householdRef),
      app: replaceRef(source.app, sourceHouseholdRef, input.householdRef),
      indexedDb: emptyDurableStudyDocument({ householdRef: input.householdRef, learnerRef: input.learners[0]?.learnerRef ?? 'family-cloud:empty' }, new Date().toISOString()),
    }
    const hydrated = new Map<string, HostedSyncLocalBundleR2>()
    for (const learner of input.learners) {
      const target: HostedSyncLocalBundleR2 = { ...combined, indexedDb: emptyDurableStudyDocument({ householdRef: input.householdRef, learnerRef: learner.learnerRef }, learner.authorityCheckpoint.appUpdatedAt) }
      const imported = importHostedSyncStateToLocalBundleR2({
        snapshot: learner.authorityCheckpoint,
        target,
        expectedIdentity: learner.authorityCheckpoint.identity,
      })
      const localVerifier = target.app.studentAccessVerifiers[learner.learnerRef]
      const deviceSafe = Object.freeze({
        ...imported,
        core: Object.freeze({ ...imported.core, activeStudentRef: target.core.activeStudentRef }),
        app: Object.freeze({
          ...imported.app,
          activeStudentRef: target.app.activeStudentRef,
          setup: Object.freeze({
            ...imported.app.setup,
            students: Object.freeze(imported.app.setup.students.map((student) => student.studentRef === learner.learnerRef
              ? Object.freeze({ ...student, pinRequired: Boolean(localVerifier) })
              : student)),
          }),
        }),
      })
      combined = deviceSafe
      hydrated.set(learner.learnerRef, deviceSafe)
    }

    const priorCore = scoped.getItem(FAMILY_PILOT_STATE_KEY)
    const priorApp = scoped.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY)
    const priorMetadata = scoped.getItem(META_KEY)
    let publishedCore: string | null = null
    let publishedApp: string | null = null
    let publishedMetadata: string | null = null
    const recordBackups = new Map<string, IndexedDbPublicationBackup>()
    const recordStore = await openIndexedDbRecordStore()
    const capturePublishedRecord = async (key: string, publish: () => Promise<void>) => {
      const existing = recordBackups.get(key)
      const prior = existing?.prior ?? (await recordStore.read([key])).get(key)
      await publish()
      const published = (await recordStore.read([key])).get(key)
      if (published === undefined) throw new Error('IndexedDB publication did not verify.')
      recordBackups.set(key, { key, prior, published })
    }
    try {
      // Invalidate publication before touching any canonical bytes. Readers
      // fall back to the prior unscoped authority until the final marker lands.
      scoped.removeItem(META_KEY)
      if (scoped.getItem(META_KEY) !== null) throw new Error('Family Cloud publication could not be staged.')
      for (const [learnerRef, imported] of hydrated) {
        const studyKey = durableStudyDocumentKey({ householdRef: input.householdRef, learnerRef })
        const studyPrior = (await recordStore.read([studyKey])).get(studyKey)
        const handle = await openFamilyPilotIndexedDbStudyStorage({ scope: { householdRef: input.householdRef, learnerRef } })
        try {
          const prior = loadDurableStudyDocument({ householdRef: input.householdRef, learnerRef }, { storage: handle.storage })
          const written = saveDurableStudyDocument({ householdRef: input.householdRef, learnerRef }, imported.indexedDb, { storage: handle.storage, expectedRaw: prior.raw })
          if (written.reasonCode) throw new Error(`Study hydration was refused: ${written.reasonCode}`)
          await handle.flush()
        } finally { handle.close() }
        const studyPublished = (await recordStore.read([studyKey])).get(studyKey)
        if (studyPublished === undefined) throw new Error('Study IndexedDB publication did not verify.')
        recordBackups.set(studyKey, { key: studyKey, prior: studyPrior, published: studyPublished })

        const key = familyAutoPlannerRecordKey({ householdRef: input.householdRef, learnerRef })
        const envelope = Object.freeze({ envelopeVersion: 1 as const, key, document: imported.plannerDocument })
        await capturePublishedRecord(key, async () => {
          const previous = (await recordStore.read([key])).get(key)
          await recordStore.write(key, envelope, (held) => canonical(held) === canonical(previous))
        })
        if (canonical((await recordStore.read([key])).get(key)) !== canonical(envelope)) throw new Error('Family Plan hydration did not verify.')

        const responseStore = new BrowserLearnerResponseStore()
        for (const response of imported.learnerResponses ?? []) {
          const responseKey = learnerResponseDocumentKey(response)
          await capturePublishedRecord(responseKey, () => responseStore.save(response))
        }
      }
      // IndexedDB staging can overlap a foreground Family Pilot save. Refuse
      // publication if either canonical localStorage document changed after
      // the initial CAS snapshot; the record-store rollback below is itself
      // compare-and-swap guarded and therefore preserves the newer writer.
      if (scoped.getItem(FAMILY_PILOT_STATE_KEY) !== priorCore ||
          scoped.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY) !== priorApp) {
        throw new Error('Family Cloud hydration lost its local publication lease.')
      }
      if (saveFamilyPilotState(combined.core, { storage: scoped }).status !== 'ready') throw new Error('Core hydration was refused.')
      publishedCore = scoped.getItem(FAMILY_PILOT_STATE_KEY)
      if (saveFinalFamilyPilotAppState(combined.app, { storage: scoped }).status !== 'saved') throw new Error('App hydration was refused.')
      publishedApp = scoped.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY)

      const operationIds = Object.fromEntries(input.learners.map((learner) => [learner.learnerRef, learner.authorityCheckpoint.sync.operationId]))
      const linked = Object.fromEntries(input.learners.flatMap((learner) => learner.linked ? [[learner.learnerRef, learner.linked]] : []))
      const metadata: RepositoryMetadataR1 = Object.freeze({ schemaVersion: 1, householdRef: input.householdRef, initialized: true, operationIds, linked })
      publishedMetadata = JSON.stringify(metadata)
      scoped.setItem(META_KEY, publishedMetadata)
      if (scoped.getItem(META_KEY) !== publishedMetadata) throw new Error('Family Cloud publication marker did not verify.')
      const readback = await this.readHousehold(input.householdRef)
      if (readback.length !== input.learners.length || !readback.every((item, index) => sameLearnerContent(item, input.learners[index]!))) {
        throw new Error('Family Cloud publication read-back did not verify.')
      }
      return true
    } catch {
      for (const backup of [...recordBackups.values()].reverse()) {
        try {
          const current = (await recordStore.read([backup.key])).get(backup.key)
          if (canonical(current) !== canonical(backup.published)) continue
          const matchesPublished = (held: unknown) => canonical(held) === canonical(backup.published)
          if (backup.prior === undefined) await recordStore.remove(backup.key, matchesPublished)
          else await recordStore.write(backup.key, backup.prior, matchesPublished)
        } catch {
          // The publication marker remains absent, so this partial copy can
          // never become linked authority. A concurrent writer is preserved.
        }
      }
      try {
        if (publishedCore !== null && scoped.getItem(FAMILY_PILOT_STATE_KEY) === publishedCore) {
          if (priorCore === null) scoped.removeItem(FAMILY_PILOT_STATE_KEY); else scoped.setItem(FAMILY_PILOT_STATE_KEY, priorCore)
        }
        if (publishedApp !== null && scoped.getItem(FINAL_FAMILY_PILOT_APP_STATE_KEY) === publishedApp) {
          if (priorApp === null) scoped.removeItem(FINAL_FAMILY_PILOT_APP_STATE_KEY); else scoped.setItem(FINAL_FAMILY_PILOT_APP_STATE_KEY, priorApp)
        }
        const currentMetadata = scoped.getItem(META_KEY)
        if (currentMetadata === null || currentMetadata === publishedMetadata) {
          if (priorMetadata === null) scoped.removeItem(META_KEY); else scoped.setItem(META_KEY, priorMetadata)
        }
      } catch {
        // A refused localStorage rollback still cannot acquire authority: a
        // fresh device has no valid publication marker, and callers get false.
      }
      return false
    } finally { recordStore.close() }
  }

  async retainConflict(conflict: FamilyCloudConflictR1): Promise<void> {
    const scoped = createBrowserHouseholdScopedStorage(conflict.householdRef)
    let current: unknown[] = []
    try { current = JSON.parse(scoped.getItem(CONFLICT_KEY) ?? '[]') as unknown[] } catch { current = [] }
    const next = Object.freeze([...current.slice(-7), clone(conflict)])
    scoped.setItem(CONFLICT_KEY, JSON.stringify(next))
    if (scoped.getItem(CONFLICT_KEY) !== JSON.stringify(next)) throw new Error('Conflict recovery copy did not verify.')
  }
}

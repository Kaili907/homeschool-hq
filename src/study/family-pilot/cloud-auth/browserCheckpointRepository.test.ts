import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HostedSyncRpcAdapter } from '../../hosted-sync/v2/client'
import { createFamilyPilotStudent, emptyFamilyPilotState, saveFamilyPilotState } from '../core'
import { familyAutoPlannerRecordKey } from '../auto-planner'
import { createFakeIndexedDb } from '../durable-indexeddb/testing/fakeIndexedDb'
import {
  digestLocalPin,
  emptyFinalFamilyPilotAppState,
  loadFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
} from '../final-app/state'
import { createBrowserHouseholdScopedStorage } from './scopedStorage'
import { BrowserFamilyCloudCheckpointRepositoryR1 } from './browserCheckpointRepository'
import { HostedFamilyCloudLocalDataPortR1, type FamilyCloudLocalLearnerStateR1 } from './hostedLocalDataPort'

const NOW = '2026-08-15T12:00:00.000Z'
const LOCAL_HOUSEHOLD = 'household:local-device-a'
const HOSTED_HOUSEHOLD = '00000000-0000-4000-8000-000000000201'
const LEARNER = 'student:ada'
const HOSTED_STUDENT = '00000000-0000-4000-8000-000000000301'
const RETRY_OPERATION = '00000000-0000-4000-8000-000000000401'
const AUTHORIZATION = Object.freeze({
  kind: 'supabase-access-token' as const,
  verifiedAt: Date.now(),
  user: Object.freeze({ id: '00000000-0000-4000-8000-000000000101', email: 'parent@example.test' }),
  accessToken: 'header.payload.signature',
})

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

function device(seed: boolean) {
  const localStorage = new MemoryStorage()
  const indexedDb = createFakeIndexedDb()
  vi.stubGlobal('window', { localStorage })
  vi.stubGlobal('indexedDB', indexedDb.factory)
  vi.stubGlobal('navigator', { onLine: true, storage: indexedDb.storageManager })
  if (seed) {
    const core = createFamilyPilotStudent(
      emptyFamilyPilotState(NOW),
      { studentRef: LEARNER, displayName: 'Ada' },
      NOW,
    )
    const initial = emptyFinalFamilyPilotAppState(NOW, LOCAL_HOUSEHOLD)
    const app = Object.freeze({
      ...initial,
      setup: Object.freeze({
        completedAt: NOW,
        students: Object.freeze([Object.freeze({
          studentRef: LEARNER,
          displayName: 'Ada',
          nominalGrade: '4' as const,
          workingGradeBySubject: Object.freeze({}),
          enabledSubjects: Object.freeze(['mathematics' as const]),
          pinRequired: true,
          createdAt: NOW,
          updatedAt: NOW,
        })]),
      }),
      studentAccessVerifiers: Object.freeze({ [LEARNER]: digestLocalPin('1234') }),
      parentAccessVerifier: digestLocalPin('8642'),
    })
    expect(saveFamilyPilotState(core, { storage: localStorage }).status).toBe('ready')
    expect(saveFinalFamilyPilotAppState(app, { storage: localStorage }).status).toBe('saved')
  }
  return { localStorage, indexedDb }
}

function activate(held: ReturnType<typeof device>) {
  vi.stubGlobal('window', { localStorage: held.localStorage })
  vi.stubGlobal('indexedDB', held.indexedDb.factory)
  vi.stubGlobal('navigator', { onLine: true, storage: held.indexedDb.storageManager })
}

afterEach(() => { vi.unstubAllGlobals() })

describe('canonical browser checkpoint repository', () => {
  it('recovers an already-imported mapping only after all checkpoint content verifies', async () => {
    device(true)
    const canonical = new BrowserFamilyCloudCheckpointRepositoryR1('device:a')
    const local = await canonical.readHousehold(HOSTED_HOUSEHOLD)
    const held = local[0]!
    const hostedScope = Object.freeze({
      assignmentRef: 'family-cloud:learner-authority',
      sessionRef: `family-cloud:session:${HOSTED_STUDENT}`,
    })
    const committed: FamilyCloudLocalLearnerStateR1[][] = []
    const repository = {
      hasHousehold: () => false,
      readHousehold: vi.fn(async () => local),
      commitVerifiedHydration: vi.fn(async ({ learners }: { learners: readonly FamilyCloudLocalLearnerStateR1[] }) => {
        committed.push([...learners])
        return true
      }),
      retainConflict: vi.fn(async () => undefined),
    }
    const directory = { resolve: vi.fn(async () => Object.freeze({
      status: 'READY' as const,
      learners: Object.freeze([Object.freeze({
        learnerRef: LEARNER,
        hostedStudentId: HOSTED_STUDENT,
        tokenDigest: 'a'.repeat(64),
        hostedScope,
      })]),
    })) }
    const client = {
      firstLink: vi.fn(async () => Object.freeze({
        code: 'SUCCESS' as const,
        value: Object.freeze({ schemaVersion: 2 as const, status: 'mapping-conflict' as const }),
      })),
      hydrate: vi.fn(async () => Object.freeze({
        code: 'SUCCESS' as const,
        value: Object.freeze({
          schemaVersion: 2 as const,
          status: 'ready' as const,
          mapping: Object.freeze({
            localHouseholdRef: held.firstLinkBase.localScope.householdRef,
            localStudentRef: held.firstLinkBase.localScope.studentRef,
            localAssignmentRef: held.firstLinkBase.localScope.assignmentRef,
            localSessionRef: held.firstLinkBase.localScope.sessionRef,
            hostedHouseholdId: HOSTED_HOUSEHOLD,
            hostedStudentId: HOSTED_STUDENT,
            hostedAssignmentRef: hostedScope.assignmentRef,
            hostedSessionRef: hostedScope.sessionRef,
          }),
          document: held.firstLinkBase.session,
          authorityCheckpoint: held.authorityCheckpoint,
          authorityCheckpointRevision: 0,
          learnerResponseCheckpoint: held.learnerResponseCheckpoint,
          learnerResponseCheckpointRevision: 0,
          familyPlanCheckpoint: held.familyPlanCheckpoint,
          familyPlanCheckpointRevision: 0,
          courseEnrollments: Object.freeze([]),
        }),
      })),
      write: vi.fn(),
    } as unknown as HostedSyncRpcAdapter
    const port = new HostedFamilyCloudLocalDataPortR1({
      repository, directory, client, deviceRef: 'device:a', newOperationId: () => RETRY_OPERATION,
    })

    await expect(port.establish({ householdRef: HOSTED_HOUSEHOLD, authorization: AUTHORIZATION }))
      .resolves.toBe('READY')
    expect(client.firstLink).toHaveBeenCalledOnce()
    expect(client.hydrate).toHaveBeenCalledOnce()
    expect(repository.commitVerifiedHydration).toHaveBeenCalledOnce()
    expect(committed[0]?.[0]?.linked).toMatchObject({ hostedStudentId: HOSTED_STUDENT, hostedScope })
  })

  it('first-links through canonical stores, preserves Device A PINs, and hydrates Device B without inventing them', async () => {
    const deviceA = device(true)
    const repositoryA = new BrowserFamilyCloudCheckpointRepositoryR1('device:a')
    const exported = await repositoryA.readHousehold(HOSTED_HOUSEHOLD)
    expect(exported).toHaveLength(1)
    expect(JSON.stringify(exported)).not.toMatch(/1234|8642|studentAccessVerifiers|parentAccessVerifier/i)
    await expect(repositoryA.commitVerifiedHydration({
      householdRef: HOSTED_HOUSEHOLD,
      learners: exported,
      expectedLocal: exported,
    })).resolves.toBe(true)
    const linkedA = loadFinalFamilyPilotAppState({
      storage: createBrowserHouseholdScopedStorage(HOSTED_HOUSEHOLD),
      householdRef: HOSTED_HOUSEHOLD,
    })
    expect(linkedA.state.setup.students[0]).toMatchObject({ studentRef: LEARNER, pinRequired: true })
    expect(linkedA.state.studentAccessVerifiers[LEARNER]).toBe(digestLocalPin('1234'))

    const currentA = await repositoryA.readHousehold(HOSTED_HOUSEHOLD)
    const recordsBeforeRefusal = JSON.stringify([...deviceA.indexedDb.records().entries()])
    const storageBeforeRefusal = JSON.stringify([...deviceA.localStorage.values.entries()])
    deviceA.indexedDb.failNextWritesOf(familyAutoPlannerRecordKey({
      householdRef: HOSTED_HOUSEHOLD,
      learnerRef: LEARNER,
    }), 1)
    await expect(repositoryA.commitVerifiedHydration({
      householdRef: HOSTED_HOUSEHOLD,
      learners: currentA,
      expectedLocal: currentA,
    })).resolves.toBe(false)
    expect(JSON.stringify([...deviceA.indexedDb.records().entries()])).toBe(recordsBeforeRefusal)
    expect(JSON.stringify([...deviceA.localStorage.values.entries()])).toBe(storageBeforeRefusal)

    const deviceB = device(false)
    const repositoryB = new BrowserFamilyCloudCheckpointRepositoryR1('device:b')
    await expect(repositoryB.commitVerifiedHydration({
      householdRef: HOSTED_HOUSEHOLD,
      learners: exported,
      expectedLocal: [],
    })).resolves.toBe(true)
    const hydratedB = loadFinalFamilyPilotAppState({
      storage: createBrowserHouseholdScopedStorage(HOSTED_HOUSEHOLD),
      householdRef: HOSTED_HOUSEHOLD,
    })
    expect(hydratedB.state.setup.students[0]).toMatchObject({ studentRef: LEARNER, pinRequired: false })
    expect(hydratedB.state.studentAccessVerifiers).toEqual({})
    expect(hydratedB.state.parentAccessVerifier).toBeNull()

    activate(deviceA)
    expect(loadFinalFamilyPilotAppState({
      storage: createBrowserHouseholdScopedStorage(HOSTED_HOUSEHOLD),
      householdRef: HOSTED_HOUSEHOLD,
    }).state.studentAccessVerifiers[LEARNER]).toBe(digestLocalPin('1234'))
  })
})

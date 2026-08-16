import { describe, expect, it } from 'vitest'
import {
  addFamilyPilotAssignment,
  createFamilyPilotStudent,
  emptyFamilyPilotState,
  loadFamilyPilotState,
  recordFamilyPilotProgress,
  saveFamilyPilotState,
} from '../core'
import { createFakeIndexedDb } from '../durable-indexeddb/testing/fakeIndexedDb'
import { openIndexedDbRecordStore } from '../durable-indexeddb'
import {
  FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
  familyAutoPlannerRecordKey,
} from '../auto-planner'
import { EMPTY_FAMILY_SETUP_STATE, completeSetup, createStudent } from '../setup'
import {
  digestLocalPin,
  emptyFinalFamilyPilotAppState,
  loadFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
} from './state'
import {
  FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION,
  FINAL_FAMILY_PILOT_PRE_RESTORE_PREFIX,
  exportFinalFamilyPilotBackup,
  previewFinalFamilyPilotRestore,
  restoreFinalFamilyPilotBackup,
  serializeFinalFamilyPilotBackup,
  validateFinalFamilyPilotBackup,
} from './backup'

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const CREATED = '2026-08-14T12:00:00.000Z'
const LATER = '2026-08-14T12:05:00.000Z'

async function seedFamily(studentRefs = ['student:a', 'student:b'], householdRef = 'household:family-a') {
  const storage = new MemoryStorage()
  const indexedDb = createFakeIndexedDb()
  let setup = EMPTY_FAMILY_SETUP_STATE
  let core = emptyFamilyPilotState(CREATED)
  for (const [index, studentRef] of studentRefs.entries()) {
    const displayName = index === 0 ? 'Ada' : 'Bo'
    const created = createStudent(setup, {
      studentRef,
      displayName,
      nominalGrade: index === 0 ? '5' : '7',
      enabledSubjects: ['mathematics'],
    }, CREATED)
    if (created.status !== 'ok') throw new Error(created.reason)
    setup = created.state
    core = createFamilyPilotStudent(core, { studentRef, displayName }, CREATED)
    core = addFamilyPilotAssignment(core, studentRef, {
      assignmentRef: `assignment:${index + 1}`,
      lessonRef: `lesson:${index + 1}`,
      subject: 'Mathematics',
      title: `Lesson ${index + 1}`,
      totalSegments: 3,
    }, CREATED)
  }
  core = recordFamilyPilotProgress(core, studentRefs[0]!, 'assignment:1', { segmentRef: 'segment:1', activeSeconds: 90 }, LATER)
  expect(saveFamilyPilotState(core, { storage }).status).toBe('ready')
  const completed = completeSetup(setup, CREATED)
  if (completed.status !== 'ok') throw new Error(completed.reason)
  const app = Object.freeze({
    ...emptyFinalFamilyPilotAppState(CREATED, householdRef),
    setup: completed.state,
    parentAccessVerifier: digestLocalPin('2468'),
  })
  expect(saveFinalFamilyPilotAppState(app, { storage }).status).toBe('saved')

  const scope = { householdRef, learnerRef: studentRefs[0]! }
  const key = familyAutoPlannerRecordKey(scope)
  const planner = Object.freeze({
    envelopeVersion: 1,
    key,
    document: Object.freeze({
      schemaVersion: FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
      scope: Object.freeze(scope),
      revision: 1,
      updatedAt: LATER,
      schoolPlan: Object.freeze({
        schemaVersion: FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
        householdTimeZone: 'America/Detroit',
        schoolYearStart: '2026-08-17',
        schoolYearEnd: '2027-05-28',
        schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const),
        nonSchoolDates: Object.freeze([]),
        addedSchoolDates: Object.freeze([]),
        allowWorkAhead: true,
        subjects: Object.freeze([{ subject: 'mathematics' as const, order: 0, paused: false, schoolWeekdays: [1, 3, 5] as const, lessonsPerDay: 1, startLocalTime: '09:00' }]),
        configuredAt: CREATED,
        updatedAt: LATER,
      }),
      materializations: Object.freeze([{
        materializationRef: 'work-ahead:mathematics:fixture', kind: 'LESSON' as const,
        localDate: '2026-08-14', subject: 'mathematics' as const, workingGrade: '5' as const,
        courseRef: 'ma-g5-mathematics', unitRef: 'ma-g5-mathematics-u01', itemRef: 'lesson:1',
        assignmentRef: 'assignment:1', title: 'Lesson 1', createdAt: LATER,
        provenance: 'LEARNER_WORK_AHEAD' as const,
      }]),
    }),
  })
  const records = await openIndexedDbRecordStore({ factory: indexedDb.factory, storageManager: indexedDb.storageManager })
  await records.write(key, planner)
  records.close()
  return { storage, indexedDb, core, app }
}

function dbOptions(indexedDb: ReturnType<typeof createFakeIndexedDb>) {
  return { factory: indexedDb.factory, storageManager: indexedDb.storageManager }
}

describe('final Family Pilot backup and recovery R1', () => {
  it('round-trips the family, planner, assignment progress, and creates a pre-restore snapshot', async () => {
    const source = await seedFamily()
    const backup = await exportFinalFamilyPilotBackup({
      coreStore: { storage: source.storage }, appStore: { storage: source.storage }, indexedDb: dbOptions(source.indexedDb), now: () => LATER,
    })
    expect(backup.recordCounts).toMatchObject({ learners: 2, assignments: 2, schoolPlans: 1 })
    expect(backup.plannerDocuments[0]?.record?.document).toMatchObject({
      schoolPlan: { allowWorkAhead: true, subjects: [{ schoolWeekdays: [1, 3, 5] }] },
      materializations: [{ provenance: 'LEARNER_WORK_AHEAD' }],
    })
    expect((await validateFinalFamilyPilotBackup(backup)).status).toBe('valid')

    const storage = new MemoryStorage()
    const indexedDb = createFakeIndexedDb()
    const options = { coreStore: { storage }, appStore: { storage, householdRef: 'household:new-device' }, indexedDb: dbOptions(indexedDb) }
    const preview = await previewFinalFamilyPilotRestore(serializeFinalFamilyPilotBackup(backup), options)
    expect(preview.status).toBe('ready')
    if (preview.status !== 'ready') throw new Error(preview.reasonCode)
    expect(preview.changes.mode).toBe('replace-family')
    expect(preview.requiresNewParentPin).toBe(true)
    expect(loadFinalFamilyPilotAppState({ storage, householdRef: 'household:new-device' }).state.setup.students).toHaveLength(0)

    const restored = await restoreFinalFamilyPilotBackup(serializeFinalFamilyPilotBackup(backup), {
      ...options, preview, authority: { newParentPin: '8642' }, now: () => '2026-08-14T12:10:00.000Z',
    })
    expect(restored).toMatchObject({ status: 'restored', studentCount: 2 })
    expect(loadFamilyPilotState({ storage }).state.students[0]?.assignments[0]?.progress.completedSegmentRefs).toEqual(['segment:1'])
    expect(loadFinalFamilyPilotAppState({ storage }).state.householdRef).toBe('household:family-a')
    expect(loadFinalFamilyPilotAppState({ storage }).state.parentAccessVerifier).toBe(digestLocalPin('8642'))
    expect(indexedDb.records().get(familyAutoPlannerRecordKey({ householdRef: 'household:family-a', learnerRef: 'student:a' }))).toEqual(source.indexedDb.records().get(familyAutoPlannerRecordKey({ householdRef: 'household:family-a', learnerRef: 'student:a' })))
    expect([...indexedDb.records().keys()].some((key) => key.startsWith(FINAL_FAMILY_PILOT_PRE_RESTORE_PREFIX))).toBe(true)
  })

  it('serializes deterministically and exports one selected learner without the sibling', async () => {
    const source = await seedFamily()
    const options = { coreStore: { storage: source.storage }, appStore: { storage: source.storage }, indexedDb: dbOptions(source.indexedDb), now: () => LATER }
    const first = await exportFinalFamilyPilotBackup(options)
    const second = await exportFinalFamilyPilotBackup(options)
    const serialized = serializeFinalFamilyPilotBackup(first)
    expect(serialized).toBe(serializeFinalFamilyPilotBackup(second))
    expect(serialized).not.toContain('2468')
    expect(serialized).not.toContain(digestLocalPin('2468'))
    expect(serialized).not.toMatch(/answerKey|correctAnswer|scoringAuthorityRef|"responses"|"transcript"/i)
    const learner = await exportFinalFamilyPilotBackup({ ...options, learnerRef: 'student:a' })
    expect(learner.scope).toMatchObject({ kind: 'learner', learnerRefs: ['student:a'] })
    expect(learner.recordCounts).toMatchObject({ learners: 1, assignments: 1, schoolPlans: 1 })
    expect(serializeFinalFamilyPilotBackup(learner)).not.toContain('student:b')
    expect((await validateFinalFamilyPilotBackup(learner)).status).toBe('valid')
  })

  it('fails closed when any covered byte is changed or a future version is supplied', async () => {
    const source = await seedFamily(['student:a'])
    const backup = await exportFinalFamilyPilotBackup({ coreStore: { storage: source.storage }, appStore: { storage: source.storage }, indexedDb: dbOptions(source.indexedDb), now: () => LATER })
    const corrupt = { ...backup, recordCounts: { ...backup.recordCounts, assignments: 99 } }
    expect(await validateFinalFamilyPilotBackup(corrupt)).toEqual({ status: 'invalid', reasonCode: 'integrity-mismatch' })
    const future = { ...backup, backupSchemaVersion: FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION + 1 }
    expect(await validateFinalFamilyPilotBackup(future)).toEqual({ status: 'invalid', reasonCode: 'backup-version-ahead' })
  })

  it('previews without writing and refuses wrong household authority', async () => {
    const source = await seedFamily(['student:a'])
    const backup = await exportFinalFamilyPilotBackup({ coreStore: { storage: source.storage }, appStore: { storage: source.storage }, indexedDb: dbOptions(source.indexedDb), now: () => LATER })
    const target = await seedFamily(['student:other'], 'household:family-b')
    const beforeStorage = new Map(target.storage.values)
    const beforeRecords = new Map(target.indexedDb.records())
    const preview = await previewFinalFamilyPilotRestore(backup, { coreStore: { storage: target.storage }, appStore: { storage: target.storage }, indexedDb: dbOptions(target.indexedDb) })
    expect(preview).toEqual({ status: 'rejected', reasonCode: 'wrong-household-authority' })
    expect(target.storage.values).toEqual(beforeStorage)
    expect(target.indexedDb.records()).toEqual(beforeRecords)
  })

  it('requires Parent authority and invalidates a preview when device data changes', async () => {
    const source = await seedFamily(['student:a'])
    const backup = await exportFinalFamilyPilotBackup({ coreStore: { storage: source.storage }, appStore: { storage: source.storage }, indexedDb: dbOptions(source.indexedDb), now: () => LATER })
    const storage = new MemoryStorage()
    const indexedDb = createFakeIndexedDb()
    const options = { coreStore: { storage }, appStore: { storage, householdRef: 'household:new' }, indexedDb: dbOptions(indexedDb) }
    const preview = await previewFinalFamilyPilotRestore(backup, options)
    if (preview.status !== 'ready') throw new Error(preview.reasonCode)
    expect(await restoreFinalFamilyPilotBackup(backup, { ...options, preview })).toEqual({ status: 'rejected', reasonCode: 'parent-authorization-required' })
    expect([...indexedDb.records().keys()].some((key) => key.startsWith(FINAL_FAMILY_PILOT_PRE_RESTORE_PREFIX))).toBe(false)

    saveFamilyPilotState(createFamilyPilotStudent(emptyFamilyPilotState('2026-08-14T12:09:00.000Z'), {
      studentRef: 'student:local-change', displayName: 'Local change',
    }, '2026-08-14T12:09:00.000Z'), { storage })
    expect(await restoreFinalFamilyPilotBackup(backup, { ...options, preview, authority: { newParentPin: '8642' } })).toEqual({ status: 'rejected', reasonCode: 'preview-stale' })
  })
})

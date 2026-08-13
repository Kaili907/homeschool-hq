import {
  exportFamilyPilotBackup,
  validateFamilyPilotBackup,
  type FamilyPilotBackupV1,
} from '../backup'
import {
  loadFamilyPilotState,
  saveFamilyPilotState,
  type FamilyPilotStoreOptions,
} from '../core'
import {
  openIndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from '../durable-indexeddb'
import {
  durableStudyDocumentKey,
  parseDurableStudyDocument,
} from '../durable-ports'
import {
  loadFinalFamilyPilotAppState,
  parseFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
  type FinalFamilyPilotAppStateV1,
  type FinalFamilyPilotAppStoreOptions,
} from './state'

export const FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION = 1 as const

export interface FinalFamilyPilotPortableBackupV1 {
  readonly backupSchemaVersion: typeof FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION
  readonly createdAt: string
  readonly releaseRef: 'family-pilot-r1'
  readonly core: FamilyPilotBackupV1
  readonly appState: FinalFamilyPilotAppStateV1
  readonly studyDocuments: readonly FinalFamilyPilotStudyDocumentBackup[]
  readonly learnerTextIncluded: false
  readonly tutorTranscriptIncluded: false
}

export interface FinalFamilyPilotStudyDocumentBackup {
  readonly studentRef: string
  readonly documentKey: string
  /** Null means the student had not started Study when the backup was made. */
  readonly record: {
    readonly envelopeVersion: 1
    readonly key: string
    readonly value: string
  } | null
}

export type FinalFamilyPilotBackupValidation =
  | { readonly status: 'valid'; readonly backup: FinalFamilyPilotPortableBackupV1 }
  | { readonly status: 'invalid'; readonly reasonCode: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function studyRecord(
  raw: unknown,
  studentRef: string,
  householdRef: string,
  documentKey: string,
): FinalFamilyPilotStudyDocumentBackup['record'] | undefined {
  if (raw === undefined) return null
  if (!isRecord(raw) || raw.envelopeVersion !== 1 || raw.key !== documentKey || typeof raw.value !== 'string') return undefined
  let document: unknown
  try { document = JSON.parse(raw.value) } catch { return undefined }
  if (parseDurableStudyDocument(document, { householdRef, learnerRef: studentRef }).status !== 'current') return undefined
  return Object.freeze({ envelopeVersion: 1, key: documentKey, value: raw.value })
}

export async function exportFinalFamilyPilotBackup(options: {
  readonly coreStore?: FamilyPilotStoreOptions
  readonly appStore?: FinalFamilyPilotAppStoreOptions
  readonly now?: () => string
  readonly indexedDb?: IndexedDbRecordStoreOptions
} = {}): Promise<FinalFamilyPilotPortableBackupV1> {
  const now = options.now ?? (() => new Date().toISOString())
  const createdAt = now()
  const core = loadFamilyPilotState(options.coreStore).state
  const app = loadFinalFamilyPilotAppState(options.appStore)
  if (app.status === 'read-only' || app.status === 'unavailable') {
    throw new Error('Family Pilot supporting state is not available for a safe backup.')
  }
  const store = await openIndexedDbRecordStore(options.indexedDb)
  let studyDocuments: FinalFamilyPilotStudyDocumentBackup[]
  try {
    const keys = app.state.setup.students.map((student) => durableStudyDocumentKey({
      householdRef: app.state.householdRef,
      learnerRef: student.studentRef,
    }))
    const records = await store.read(keys)
    studyDocuments = app.state.setup.students.map((student, index) => {
      const documentKey = keys[index] as string
      const record = studyRecord(records.get(documentKey), student.studentRef, app.state.householdRef, documentKey)
      if (record === undefined) throw new Error(`Study state for ${student.studentRef} is unreadable and cannot be backed up safely.`)
      return Object.freeze({ studentRef: student.studentRef, documentKey, record })
    })
  } finally {
    store.close()
  }
  return Object.freeze({
    backupSchemaVersion: FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION,
    createdAt,
    releaseRef: 'family-pilot-r1',
    core: exportFamilyPilotBackup(core, createdAt),
    appState: app.state,
    studyDocuments: Object.freeze(studyDocuments),
    learnerTextIncluded: false,
    tutorTranscriptIncluded: false,
  })
}

export function validateFinalFamilyPilotBackup(value: unknown): FinalFamilyPilotBackupValidation {
  if (!isRecord(value)) return { status: 'invalid', reasonCode: 'wrong-shape' }
  if (Number.isSafeInteger(value.backupSchemaVersion) && Number(value.backupSchemaVersion) > 1) {
    return { status: 'invalid', reasonCode: 'backup-version-ahead' }
  }
  if (
    value.backupSchemaVersion !== FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION ||
    value.releaseRef !== 'family-pilot-r1' ||
    value.learnerTextIncluded !== false || value.tutorTranscriptIncluded !== false ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    !Array.isArray(value.studyDocuments)
  ) return { status: 'invalid', reasonCode: 'wrong-shape' }
  const core = validateFamilyPilotBackup(value.core)
  if (core.status !== 'valid') return { status: 'invalid', reasonCode: core.reasonCode }
  const app = parseFinalFamilyPilotAppState(value.appState)
  if (!app.state || app.safetyRecovery !== 'available') {
    return { status: 'invalid', reasonCode: app.state ? 'safety-state-incomplete' : 'app-state-unreadable' }
  }
  const coreStudents = new Set(core.backup.familyPilotState.students.map((item) => item.studentRef))
  const appStudents = new Set(app.state.setup.students.map((item) => item.studentRef))
  if (coreStudents.size !== appStudents.size || [...coreStudents].some((ref) => !appStudents.has(ref))) {
    return { status: 'invalid', reasonCode: 'student-binding-mismatch' }
  }
  if (value.studyDocuments.length !== appStudents.size) return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }
  const seen = new Set<string>()
  const studyDocuments: FinalFamilyPilotStudyDocumentBackup[] = []
  for (const candidate of value.studyDocuments) {
    if (!isRecord(candidate) || typeof candidate.studentRef !== 'string' || !appStudents.has(candidate.studentRef) || seen.has(candidate.studentRef)) {
      return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }
    }
    seen.add(candidate.studentRef)
    const documentKey = durableStudyDocumentKey({ householdRef: app.state.householdRef, learnerRef: candidate.studentRef })
    if (candidate.documentKey !== documentKey) return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }
    const record = studyRecord(candidate.record === null ? undefined : candidate.record, candidate.studentRef, app.state.householdRef, documentKey)
    if (record === undefined) return { status: 'invalid', reasonCode: 'study-document-unreadable' }
    studyDocuments.push(Object.freeze({ studentRef: candidate.studentRef, documentKey, record }))
  }
  return {
    status: 'valid',
    backup: Object.freeze({
      backupSchemaVersion: FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION,
      createdAt: value.createdAt,
      releaseRef: 'family-pilot-r1',
      core: core.backup,
      appState: app.state,
      studyDocuments: Object.freeze(studyDocuments),
      learnerTextIncluded: false,
      tutorTranscriptIncluded: false,
    }),
  }
}

/**
 * Validates both documents before the first write and rolls both documents back
 * if either verified write refuses. Study's IndexedDB document is not replaced;
 * a missing portable Study document is rebuilt through accepted transitions
 * from Core's exact completed-segment record on first reopen.
 */
export async function restoreFinalFamilyPilotBackup(
  input: unknown,
  options: {
    readonly coreStore?: FamilyPilotStoreOptions
    readonly appStore?: FinalFamilyPilotAppStoreOptions
    readonly indexedDb?: IndexedDbRecordStoreOptions
  } = {},
): Promise<{ readonly status: 'restored'; readonly studentCount: number } | { readonly status: 'rejected'; readonly reasonCode: string }> {
  let value: unknown = input
  if (typeof input === 'string') {
    try { value = JSON.parse(input) } catch { return { status: 'rejected', reasonCode: 'malformed-json' } }
  }
  const validated = validateFinalFamilyPilotBackup(value)
  if (validated.status !== 'valid') return { status: 'rejected', reasonCode: validated.reasonCode }
  const beforeCore = loadFamilyPilotState(options.coreStore).state
  const beforeApp = loadFinalFamilyPilotAppState(options.appStore).state
  let store
  try {
    store = await openIndexedDbRecordStore(options.indexedDb)
  } catch {
    return { status: 'rejected', reasonCode: 'study-storage-unavailable' }
  }
  const documentKeys = validated.backup.studyDocuments.map((item) => item.documentKey)
  let beforeDocuments: ReadonlyMap<string, unknown>
  try {
    beforeDocuments = await store.read(documentKeys)
  } catch {
    store.close()
    return { status: 'rejected', reasonCode: 'study-storage-unavailable' }
  }
  try {
    for (const document of validated.backup.studyDocuments) {
      if (document.record) await store.write(document.documentKey, document.record)
      else await store.remove(document.documentKey)
    }
    const appSaved = saveFinalFamilyPilotAppState(validated.backup.appState, options.appStore)
    if (appSaved.status !== 'saved') throw new Error(appSaved.reasonCode)
    const coreSaved = saveFamilyPilotState(validated.backup.core.familyPilotState, options.coreStore)
    if (coreSaved.status !== 'ready') throw new Error(coreSaved.reasonCode ?? 'core-write-refused')
    store.close()
    return { status: 'restored', studentCount: validated.backup.appState.setup.students.length }
  } catch {
    // Best-effort rollback of both verified pre-images. If a device refuses even
    // the rollback, the load paths surface unavailable/recovered; they never
    // claim the partial restore succeeded.
    saveFinalFamilyPilotAppState(beforeApp, options.appStore)
    saveFamilyPilotState(beforeCore, options.coreStore)
    for (const key of documentKeys) {
      try {
        if (beforeDocuments.has(key)) await store.write(key, beforeDocuments.get(key))
        else await store.remove(key)
      } catch { /* load paths will surface the refusal */ }
    }
    store.close()
    return { status: 'rejected', reasonCode: 'atomic-write-refused' }
  }
}

export function downloadFinalFamilyPilotBackup(backup: FinalFamilyPilotPortableBackupV1): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `manuel-academy-family-pilot-${backup.createdAt.replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

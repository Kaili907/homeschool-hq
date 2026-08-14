import type { FamilyPilotStateV1, FamilyPilotStudentRecordV1 } from '../core'
import {
  loadFamilyPilotState,
  saveFamilyPilotState,
  upgradeFamilyPilotState,
  type FamilyPilotStoreOptions,
} from '../core'
import {
  openIndexedDbRecordStore,
  type IndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from '../durable-indexeddb'
import {
  durableStudyDocumentKey,
  parseDurableStudyDocument,
} from '../durable-ports'
import {
  familyAutoPlannerRecordKey,
  parseFamilyAutoPlannerRecord,
  type FamilyAutoPlannerRecordV1,
} from '../auto-planner/indexedDbStore'
import type { FamilyAutoPlannerScope } from '../auto-planner/types'
import {
  digestLocalPin,
  loadFinalFamilyPilotAppState,
  parseFinalFamilyPilotAppState,
  saveFinalFamilyPilotAppState,
  type FinalFamilyPilotAppStateV1,
  type FinalFamilyPilotAppStoreOptions,
} from './state'

export const FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION = 2 as const
export const FINAL_FAMILY_PILOT_BACKUP_FORMAT = 'manuel-academy-family-pilot-backup' as const
export const FINAL_FAMILY_PILOT_PRE_RESTORE_PREFIX = 'family-pilot:pre-restore-snapshot:v1' as const

export interface FinalFamilyPilotStudyDocumentBackup {
  readonly studentRef: string
  readonly documentKey: string
  /** Null means the learner had not started Study when the backup was made. */
  readonly record: {
    readonly envelopeVersion: 1
    readonly key: string
    readonly value: string
  } | null
}

export interface FinalFamilyPilotPlannerDocumentBackup {
  readonly studentRef: string
  readonly documentKey: string
  /** Null means no School Plan has been saved for this learner. */
  readonly record: FamilyAutoPlannerRecordV1 | null
}

export interface FinalFamilyPilotBackupCounts {
  readonly learners: number
  readonly assignments: number
  readonly completedAssignments: number
  readonly studySessions: number
  readonly studyDocuments: number
  readonly assessmentStates: number
  readonly schoolPlans: number
  readonly plannerMaterializations: number
  readonly safetyHolds: number
  readonly attestations: number
  readonly sourceAttachments: number
}

export interface FinalFamilyPilotPortableBackupV2 {
  readonly format: typeof FINAL_FAMILY_PILOT_BACKUP_FORMAT
  readonly backupSchemaVersion: typeof FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION
  readonly createdAt: string
  readonly source: {
    readonly application: 'Manuel Academy Family Pilot'
    readonly applicationVersion: string
    readonly releaseRef: 'family-pilot-r1'
  }
  readonly scope: {
    readonly kind: 'family' | 'learner'
    readonly householdRef: string
    readonly learnerRefs: readonly string[]
  }
  readonly recordCounts: FinalFamilyPilotBackupCounts
  readonly coreState: FamilyPilotStateV1
  readonly appState: FinalFamilyPilotAppStateV1
  readonly studyDocuments: readonly FinalFamilyPilotStudyDocumentBackup[]
  readonly plannerDocuments: readonly FinalFamilyPilotPlannerDocumentBackup[]
  readonly privacy: {
    readonly rawPinIncluded: false
    readonly networkSecretIncluded: false
    readonly learnerAnswerIncluded: false
    readonly answerAuthorityIncluded: false
    readonly tutorTranscriptIncluded: false
  }
  readonly integrity: {
    readonly algorithm: 'SHA-256'
    readonly digest: string
  }
}

/** Kept as a source-compatible name for callers of the first portable draft. */
export type FinalFamilyPilotPortableBackupV1 = FinalFamilyPilotPortableBackupV2

export type FinalFamilyPilotBackupReasonCode =
  | 'malformed-json'
  | 'wrong-shape'
  | 'backup-version-unsupported'
  | 'backup-version-ahead'
  | 'integrity-unavailable'
  | 'integrity-mismatch'
  | 'core-state-unreadable'
  | 'app-state-unreadable'
  | 'safety-state-incomplete'
  | 'student-binding-mismatch'
  | 'study-document-binding-mismatch'
  | 'study-document-unreadable'
  | 'planner-document-binding-mismatch'
  | 'planner-document-unreadable'
  | 'record-count-mismatch'
  | 'wrong-household-authority'
  | 'learner-revision-conflict'
  | 'current-state-unavailable'
  | 'study-storage-unavailable'
  | 'parent-authorization-required'
  | 'preview-required'
  | 'preview-stale'
  | 'pre-restore-snapshot-failed'
  | 'atomic-write-refused'

export type FinalFamilyPilotBackupValidation =
  | { readonly status: 'valid'; readonly backup: FinalFamilyPilotPortableBackupV2 }
  | { readonly status: 'invalid'; readonly reasonCode: FinalFamilyPilotBackupReasonCode }

export interface FinalFamilyPilotRestorePreview {
  readonly status: 'ready'
  readonly backup: FinalFamilyPilotPortableBackupV2
  readonly currentFingerprint: string
  readonly learners: readonly { readonly studentRef: string; readonly displayName: string }[]
  readonly changes: {
    readonly mode: 'replace-family' | 'add-learner' | 'replace-learner' | 'no-change'
    readonly learnersAdded: readonly string[]
    readonly learnersReplaced: readonly string[]
    readonly learnersRemoved: readonly string[]
  }
  readonly requiresNewParentPin: boolean
}

export type FinalFamilyPilotRestorePreviewResult =
  | FinalFamilyPilotRestorePreview
  | { readonly status: 'rejected'; readonly reasonCode: FinalFamilyPilotBackupReasonCode }

export interface FinalFamilyPilotBackupOptions {
  readonly coreStore?: FamilyPilotStoreOptions
  readonly appStore?: FinalFamilyPilotAppStoreOptions
  readonly now?: () => string
  readonly indexedDb?: IndexedDbRecordStoreOptions
  /** When present, produces a learner-scoped archive. */
  readonly learnerRef?: string
}

type UnsignedBackup = Omit<FinalFamilyPilotPortableBackupV2, 'integrity'>

interface CurrentRestoreImage {
  readonly coreState: FamilyPilotStateV1
  readonly appState: FinalFamilyPilotAppStateV1
  readonly records: ReadonlyMap<string, unknown>
  readonly fingerprint: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

/** Deep alphabetical key sort. Array order remains record order. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key])
    return sorted
  }
  return value
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

async function sha256(value: string): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle
    if (!subtle) return null
    const bytes = new TextEncoder().encode(value)
    const digest = await subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

function studyRecord(
  raw: unknown,
  studentRef: string,
  householdRef: string,
  documentKey: string,
): FinalFamilyPilotStudyDocumentBackup['record'] | undefined {
  if (raw === undefined || raw === null) return null
  if (!isRecord(raw) || raw.envelopeVersion !== 1 || raw.key !== documentKey || typeof raw.value !== 'string') return undefined
  let document: unknown
  try { document = JSON.parse(raw.value) } catch { return undefined }
  if (parseDurableStudyDocument(document, { householdRef, learnerRef: studentRef }).status !== 'current') return undefined
  return Object.freeze({ envelopeVersion: 1, key: documentKey, value: canonicalJson(document) })
}

function scopeFor(householdRef: string, learnerRef: string): FamilyAutoPlannerScope {
  return Object.freeze({ householdRef, learnerRef })
}

function filterCore(state: FamilyPilotStateV1, learnerRef?: string): FamilyPilotStateV1 {
  if (!learnerRef) return state
  return Object.freeze({
    ...state,
    activeStudentRef: state.activeStudentRef === learnerRef ? learnerRef : null,
    students: Object.freeze(state.students.filter((student) => student.studentRef === learnerRef)),
  })
}

function filterApp(state: FinalFamilyPilotAppStateV1, learnerRef?: string): FinalFamilyPilotAppStateV1 {
  if (!learnerRef) return Object.freeze({
    ...state,
    studentAccessVerifiers: Object.freeze({}),
    parentAccessVerifier: null,
  })
  const keep = <T extends { readonly studentRef: string }>(items: readonly T[]) =>
    Object.freeze(items.filter((item) => item.studentRef === learnerRef))
  return Object.freeze({
    ...state,
    setup: Object.freeze({ ...state.setup, students: keep(state.setup.students) }),
    activeStudentRef: state.activeStudentRef === learnerRef ? learnerRef : null,
    sessions: keep(state.sessions),
    sourceAttachments: keep(state.sourceAttachments),
    assessmentAssignments: keep(state.assessmentAssignments),
    attestations: keep(state.attestations),
    safety: Object.freeze({ ...state.safety, holds: keep(state.safety.holds) }),
    studentAccessVerifiers: Object.freeze({}),
    parentAccessVerifier: null,
  })
}

function counts(
  coreState: FamilyPilotStateV1,
  appState: FinalFamilyPilotAppStateV1,
  studyDocuments: readonly FinalFamilyPilotStudyDocumentBackup[],
  plannerDocuments: readonly FinalFamilyPilotPlannerDocumentBackup[],
): FinalFamilyPilotBackupCounts {
  const assignments = coreState.students.flatMap((student) => student.assignments)
  return Object.freeze({
    learners: coreState.students.length,
    assignments: assignments.length,
    completedAssignments: assignments.filter((assignment) => assignment.state === 'completed').length,
    studySessions: appState.sessions.length,
    studyDocuments: studyDocuments.filter((item) => item.record !== null).length,
    assessmentStates: appState.assessmentAssignments.length,
    schoolPlans: plannerDocuments.filter((item) => item.record?.document.schoolPlan !== null && item.record !== null).length,
    plannerMaterializations: plannerDocuments.reduce((sum, item) => sum + (item.record?.document.materializations.length ?? 0), 0),
    safetyHolds: appState.safety.holds.length,
    attestations: appState.attestations.length,
    sourceAttachments: appState.sourceAttachments.length,
  })
}

function unsignedFrom(value: FinalFamilyPilotPortableBackupV2): UnsignedBackup {
  const { integrity: _integrity, ...unsigned } = value
  return unsigned
}

export function serializeFinalFamilyPilotBackup(backup: FinalFamilyPilotPortableBackupV2): string {
  return canonicalJson(backup)
}

export async function exportFinalFamilyPilotBackup(options: FinalFamilyPilotBackupOptions = {}): Promise<FinalFamilyPilotPortableBackupV2> {
  const now = options.now ?? (() => new Date().toISOString())
  const createdAt = now()
  if (!isInstant(createdAt)) throw new Error('A valid backup timestamp is required.')
  const coreLoad = loadFamilyPilotState(options.coreStore)
  const appLoad = loadFinalFamilyPilotAppState(options.appStore)
  if (coreLoad.status !== 'ready' || appLoad.status !== 'ready' || appLoad.safetyRecovery !== 'available') {
    throw new Error('Family Pilot state is not available for a safe backup.')
  }
  const learnerRefs = options.learnerRef
    ? [options.learnerRef]
    : appLoad.state.setup.students.map((student) => student.studentRef)
  if (options.learnerRef && !learnerRefs.every((ref) => appLoad.state.setup.students.some((student) => student.studentRef === ref))) {
    throw new Error('That learner is not part of this household.')
  }
  const coreState = filterCore(coreLoad.state, options.learnerRef)
  const appState = filterApp(appLoad.state, options.learnerRef)
  const coreRefs = new Set(coreState.students.map((student) => student.studentRef))
  if (coreRefs.size !== learnerRefs.length || learnerRefs.some((ref) => !coreRefs.has(ref))) {
    throw new Error('Learner records do not agree, so the backup was stopped.')
  }

  const store = await openIndexedDbRecordStore(options.indexedDb)
  let studyDocuments: FinalFamilyPilotStudyDocumentBackup[] = []
  let plannerDocuments: FinalFamilyPilotPlannerDocumentBackup[] = []
  try {
    const studyKeys = learnerRefs.map((studentRef) => durableStudyDocumentKey({ householdRef: appState.householdRef, learnerRef: studentRef }))
    const plannerKeys = learnerRefs.map((studentRef) => familyAutoPlannerRecordKey(scopeFor(appState.householdRef, studentRef)))
    const records = await store.read([...studyKeys, ...plannerKeys])
    studyDocuments = learnerRefs.map((studentRef, index) => {
      const documentKey = studyKeys[index] as string
      const record = studyRecord(records.get(documentKey), studentRef, appState.householdRef, documentKey)
      if (record === undefined) throw new Error(`Study state for ${studentRef} is unreadable and cannot be backed up safely.`)
      return Object.freeze({ studentRef, documentKey, record })
    })
    plannerDocuments = learnerRefs.map((studentRef, index) => {
      const documentKey = plannerKeys[index] as string
      const raw = records.get(documentKey)
      const record = raw === undefined ? null : parseFamilyAutoPlannerRecord(raw, scopeFor(appState.householdRef, studentRef))
      if (raw !== undefined && !record) throw new Error(`School Plan state for ${studentRef} is unreadable and cannot be backed up safely.`)
      return Object.freeze({ studentRef, documentKey, record })
    })
  } finally {
    store.close()
  }

  const unsigned: UnsignedBackup = Object.freeze({
    format: FINAL_FAMILY_PILOT_BACKUP_FORMAT,
    backupSchemaVersion: FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION,
    createdAt,
    source: Object.freeze({ application: 'Manuel Academy Family Pilot', applicationVersion: '0.1.0', releaseRef: 'family-pilot-r1' }),
    scope: Object.freeze({ kind: options.learnerRef ? 'learner' : 'family', householdRef: appState.householdRef, learnerRefs: Object.freeze([...learnerRefs]) }),
    recordCounts: counts(coreState, appState, studyDocuments, plannerDocuments),
    coreState,
    appState,
    studyDocuments: Object.freeze(studyDocuments),
    plannerDocuments: Object.freeze(plannerDocuments),
    privacy: Object.freeze({ rawPinIncluded: false, networkSecretIncluded: false, learnerAnswerIncluded: false, answerAuthorityIncluded: false, tutorTranscriptIncluded: false }),
  })
  const digest = await sha256(canonicalJson(unsigned))
  if (!digest) throw new Error('This browser could not calculate backup integrity safely.')
  return Object.freeze({ ...unsigned, integrity: Object.freeze({ algorithm: 'SHA-256', digest }) })
}

function shapeReason(value: Record<string, unknown>): FinalFamilyPilotBackupReasonCode | null {
  if (Number.isSafeInteger(value.backupSchemaVersion) && Number(value.backupSchemaVersion) > FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION) return 'backup-version-ahead'
  if (value.backupSchemaVersion !== FINAL_FAMILY_PILOT_PORTABLE_BACKUP_VERSION) return 'backup-version-unsupported'
  return null
}

export async function validateFinalFamilyPilotBackup(value: unknown): Promise<FinalFamilyPilotBackupValidation> {
  if (!isRecord(value)) return { status: 'invalid', reasonCode: 'wrong-shape' }
  const versionReason = shapeReason(value)
  if (versionReason) return { status: 'invalid', reasonCode: versionReason }
  if (
    value.format !== FINAL_FAMILY_PILOT_BACKUP_FORMAT || !isInstant(value.createdAt) ||
    !isRecord(value.source) || value.source.application !== 'Manuel Academy Family Pilot' ||
    typeof value.source.applicationVersion !== 'string' || !value.source.applicationVersion || value.source.applicationVersion.length > 64 || value.source.releaseRef !== 'family-pilot-r1' ||
    !isRecord(value.scope) || !['family', 'learner'].includes(String(value.scope.kind)) ||
    typeof value.scope.householdRef !== 'string' || !Array.isArray(value.scope.learnerRefs) ||
    !value.scope.learnerRefs.every((ref) => typeof ref === 'string') ||
    !isRecord(value.recordCounts) || !Array.isArray(value.studyDocuments) || !Array.isArray(value.plannerDocuments) ||
    !isRecord(value.privacy) || value.privacy.rawPinIncluded !== false || value.privacy.networkSecretIncluded !== false ||
    value.privacy.learnerAnswerIncluded !== false || value.privacy.answerAuthorityIncluded !== false || value.privacy.tutorTranscriptIncluded !== false ||
    !isRecord(value.integrity) || value.integrity.algorithm !== 'SHA-256' || !/^[a-f0-9]{64}$/.test(String(value.integrity.digest))
  ) return { status: 'invalid', reasonCode: 'wrong-shape' }

  const suppliedDigest = String(value.integrity.digest)
  const calculatedDigest = await sha256(canonicalJson(unsignedFrom(value as unknown as FinalFamilyPilotPortableBackupV2)))
  if (!calculatedDigest) return { status: 'invalid', reasonCode: 'integrity-unavailable' }
  if (calculatedDigest !== suppliedDigest) return { status: 'invalid', reasonCode: 'integrity-mismatch' }

  const coreLoad = upgradeFamilyPilotState(value.coreState)
  if (coreLoad.status !== 'current' || canonicalJson(coreLoad.state) !== canonicalJson(value.coreState)) {
    return { status: 'invalid', reasonCode: 'core-state-unreadable' }
  }
  const appLoad = parseFinalFamilyPilotAppState(value.appState)
  if (!appLoad.state || canonicalJson(appLoad.state) !== canonicalJson(value.appState)) {
    return { status: 'invalid', reasonCode: 'app-state-unreadable' }
  }
  if (appLoad.state.parentAccessVerifier !== null || Object.keys(appLoad.state.studentAccessVerifiers).length !== 0) {
    return { status: 'invalid', reasonCode: 'app-state-unreadable' }
  }
  if (appLoad.safetyRecovery !== 'available') return { status: 'invalid', reasonCode: 'safety-state-incomplete' }

  const learnerRefs = value.scope.learnerRefs as string[]
  if (new Set(learnerRefs).size !== learnerRefs.length || (value.scope.kind === 'learner' && learnerRefs.length !== 1)) {
    return { status: 'invalid', reasonCode: 'student-binding-mismatch' }
  }
  const appRefs = new Set(appLoad.state.setup.students.map((student) => student.studentRef))
  const coreRefs = new Set(coreLoad.state.students.map((student) => student.studentRef))
  if (appLoad.state.householdRef !== value.scope.householdRef || appRefs.size !== learnerRefs.length || coreRefs.size !== learnerRefs.length || learnerRefs.some((ref) => !appRefs.has(ref) || !coreRefs.has(ref))) {
    return { status: 'invalid', reasonCode: 'student-binding-mismatch' }
  }

  const studyDocuments: FinalFamilyPilotStudyDocumentBackup[] = []
  const studySeen = new Set<string>()
  for (const candidate of value.studyDocuments) {
    if (!isRecord(candidate) || typeof candidate.studentRef !== 'string' || !appRefs.has(candidate.studentRef) || studySeen.has(candidate.studentRef)) return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }
    studySeen.add(candidate.studentRef)
    const documentKey = durableStudyDocumentKey({ householdRef: appLoad.state.householdRef, learnerRef: candidate.studentRef })
    if (candidate.documentKey !== documentKey) return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }
    const record = studyRecord(candidate.record, candidate.studentRef, appLoad.state.householdRef, documentKey)
    if (record === undefined) return { status: 'invalid', reasonCode: 'study-document-unreadable' }
    studyDocuments.push(Object.freeze({ studentRef: candidate.studentRef, documentKey, record }))
  }
  if (studySeen.size !== learnerRefs.length) return { status: 'invalid', reasonCode: 'study-document-binding-mismatch' }

  const plannerDocuments: FinalFamilyPilotPlannerDocumentBackup[] = []
  const plannerSeen = new Set<string>()
  for (const candidate of value.plannerDocuments) {
    if (!isRecord(candidate) || typeof candidate.studentRef !== 'string' || !appRefs.has(candidate.studentRef) || plannerSeen.has(candidate.studentRef)) return { status: 'invalid', reasonCode: 'planner-document-binding-mismatch' }
    plannerSeen.add(candidate.studentRef)
    const scope = scopeFor(appLoad.state.householdRef, candidate.studentRef)
    const documentKey = familyAutoPlannerRecordKey(scope)
    if (candidate.documentKey !== documentKey) return { status: 'invalid', reasonCode: 'planner-document-binding-mismatch' }
    const record = candidate.record === null ? null : parseFamilyAutoPlannerRecord(candidate.record, scope)
    if (candidate.record !== null && !record) return { status: 'invalid', reasonCode: 'planner-document-unreadable' }
    plannerDocuments.push(Object.freeze({ studentRef: candidate.studentRef, documentKey, record }))
  }
  if (plannerSeen.size !== learnerRefs.length) return { status: 'invalid', reasonCode: 'planner-document-binding-mismatch' }

  const recordCounts = counts(coreLoad.state, appLoad.state, studyDocuments, plannerDocuments)
  if (canonicalJson(recordCounts) !== canonicalJson(value.recordCounts)) return { status: 'invalid', reasonCode: 'record-count-mismatch' }
  return { status: 'valid', backup: Object.freeze({
    ...value,
    coreState: coreLoad.state,
    appState: appLoad.state,
    studyDocuments: Object.freeze(studyDocuments),
    plannerDocuments: Object.freeze(plannerDocuments),
    recordCounts,
  }) as unknown as FinalFamilyPilotPortableBackupV2 }
}

async function parseAndValidate(input: unknown): Promise<FinalFamilyPilotBackupValidation> {
  let value = input
  if (typeof input === 'string') {
    try { value = JSON.parse(input) } catch { return { status: 'invalid', reasonCode: 'malformed-json' } }
  }
  return validateFinalFamilyPilotBackup(value)
}

function allManagedKeys(app: FinalFamilyPilotAppStateV1, backup: FinalFamilyPilotPortableBackupV2): string[] {
  const refs = new Set([...app.setup.students.map((student) => student.studentRef), ...backup.scope.learnerRefs])
  const households = new Set([app.householdRef, backup.scope.householdRef])
  const keys = new Set<string>()
  for (const householdRef of households) for (const learnerRef of refs) {
    keys.add(durableStudyDocumentKey({ householdRef, learnerRef }))
    keys.add(familyAutoPlannerRecordKey(scopeFor(householdRef, learnerRef)))
  }
  return [...keys].sort()
}

async function currentImage(
  backup: FinalFamilyPilotPortableBackupV2,
  store: IndexedDbRecordStore,
  options: Pick<FinalFamilyPilotBackupOptions, 'coreStore' | 'appStore'>,
): Promise<CurrentRestoreImage | null> {
  const core = loadFamilyPilotState(options.coreStore)
  const app = loadFinalFamilyPilotAppState(options.appStore)
  if (core.status === 'read-only' || core.status === 'unavailable' || app.status === 'read-only' || app.status === 'unavailable') return null
  const records = await store.read(allManagedKeys(app.state, backup))
  // Empty-state timestamps are generated at read time when no document exists.
  // Normalize only that truly empty case so a preview does not become stale
  // merely because validation crossed a millisecond boundary.
  const fingerprintCore = core.state.students.length === 0
    ? { ...core.state, updatedAt: 'empty' }
    : core.state
  const fingerprintApp = app.state.setup.students.length === 0 && app.state.setup.completedAt === null
    ? { ...app.state, updatedAt: 'empty' }
    : app.state
  const fingerprint = await sha256(canonicalJson({ coreState: fingerprintCore, appState: fingerprintApp, records: [...records.entries()].sort(([a], [b]) => a.localeCompare(b)) }))
  return fingerprint ? { coreState: core.state, appState: app.state, records, fingerprint } : null
}

function learnerRevision(app: FinalFamilyPilotAppStateV1, learnerRef: string): number {
  const times: string[] = []
  const student = app.setup.students.find((item) => item.studentRef === learnerRef)
  if (student) times.push(student.updatedAt)
  for (const item of [...app.sourceAttachments, ...app.assessmentAssignments, ...app.attestations, ...app.safety.holds]) {
    if (item.studentRef !== learnerRef) continue
    for (const value of Object.values(item)) if (typeof value === 'string' && Number.isFinite(Date.parse(value))) times.push(value)
  }
  return Math.max(0, ...times.map((value) => Date.parse(value)))
}

function learnerProjection(core: FamilyPilotStateV1, app: FinalFamilyPilotAppStateV1, learnerRef: string): unknown {
  return { core: core.students.find((item) => item.studentRef === learnerRef), app: filterApp(app, learnerRef) }
}

export async function previewFinalFamilyPilotRestore(
  input: unknown,
  options: Pick<FinalFamilyPilotBackupOptions, 'coreStore' | 'appStore' | 'indexedDb'> = {},
): Promise<FinalFamilyPilotRestorePreviewResult> {
  const validated = await parseAndValidate(input)
  if (validated.status !== 'valid') return { status: 'rejected', reasonCode: validated.reasonCode }
  let store: IndexedDbRecordStore
  try { store = await openIndexedDbRecordStore(options.indexedDb) } catch { return { status: 'rejected', reasonCode: 'study-storage-unavailable' } }
  try {
    const current = await currentImage(validated.backup, store, options)
    if (!current) return { status: 'rejected', reasonCode: 'current-state-unavailable' }
    const targetHasFamily = current.appState.setup.students.length > 0 || current.appState.setup.completedAt !== null
    if (targetHasFamily && current.appState.householdRef !== validated.backup.scope.householdRef) {
      return { status: 'rejected', reasonCode: 'wrong-household-authority' }
    }
    const backupRefs = validated.backup.scope.learnerRefs
    const currentRefs = current.appState.setup.students.map((student) => student.studentRef)
    let mode: FinalFamilyPilotRestorePreview['changes']['mode'] = 'replace-family'
    let learnersAdded = backupRefs.filter((ref) => !currentRefs.includes(ref))
    let learnersReplaced = backupRefs.filter((ref) => currentRefs.includes(ref))
    let learnersRemoved = validated.backup.scope.kind === 'family' ? currentRefs.filter((ref) => !backupRefs.includes(ref)) : []
    if (validated.backup.scope.kind === 'learner') {
      const learnerRef = backupRefs[0] as string
      const currentStudent = current.coreState.students.find((student) => student.studentRef === learnerRef)
      if (!currentStudent) mode = 'add-learner'
      else {
        const same = canonicalJson(learnerProjection(current.coreState, current.appState, learnerRef)) === canonicalJson(learnerProjection(validated.backup.coreState, validated.backup.appState, learnerRef))
        if (same) mode = 'no-change'
        else {
          const backupStudent = validated.backup.coreState.students[0] as FamilyPilotStudentRecordV1
          const currentPlanner = parseFamilyAutoPlannerRecord(current.records.get(familyAutoPlannerRecordKey(scopeFor(current.appState.householdRef, learnerRef))), scopeFor(current.appState.householdRef, learnerRef))
          const backupPlanner = validated.backup.plannerDocuments[0]?.record
          const revisionsSafe = Date.parse(backupStudent.updatedAt) >= Date.parse(currentStudent.updatedAt) &&
            learnerRevision(validated.backup.appState, learnerRef) >= learnerRevision(current.appState, learnerRef) &&
            (backupPlanner?.document.revision ?? 0) >= (currentPlanner?.document.revision ?? 0)
          if (!revisionsSafe) return { status: 'rejected', reasonCode: 'learner-revision-conflict' }
          mode = 'replace-learner'
        }
      }
      learnersAdded = mode === 'add-learner' ? [learnerRef] : []
      learnersReplaced = mode === 'replace-learner' ? [learnerRef] : []
      learnersRemoved = []
    }
    return Object.freeze({
      status: 'ready',
      backup: validated.backup,
      currentFingerprint: current.fingerprint,
      learners: Object.freeze(validated.backup.appState.setup.students.map((student) => Object.freeze({ studentRef: student.studentRef, displayName: student.displayName }))),
      changes: Object.freeze({ mode, learnersAdded: Object.freeze(learnersAdded), learnersReplaced: Object.freeze(learnersReplaced), learnersRemoved: Object.freeze(learnersRemoved) }),
      requiresNewParentPin: !targetHasFamily,
    })
  } catch {
    return { status: 'rejected', reasonCode: 'study-storage-unavailable' }
  } finally {
    store.close()
  }
}

function mergeCore(current: FamilyPilotStateV1, backup: FinalFamilyPilotPortableBackupV2): FamilyPilotStateV1 {
  if (backup.scope.kind === 'family') return backup.coreState
  const learnerRef = backup.scope.learnerRefs[0] as string
  const replacement = backup.coreState.students[0] as FamilyPilotStudentRecordV1
  const found = current.students.some((student) => student.studentRef === learnerRef)
  return Object.freeze({
    ...current,
    updatedAt: backup.coreState.updatedAt,
    students: Object.freeze(found ? current.students.map((student) => student.studentRef === learnerRef ? replacement : student) : [...current.students, replacement]),
  })
}

function mergeApp(
  current: FinalFamilyPilotAppStateV1,
  backup: FinalFamilyPilotPortableBackupV2,
  newParentPin?: string,
): FinalFamilyPilotAppStateV1 {
  if (backup.scope.kind === 'family') {
    const studentAccessVerifiers: Record<string, string> = {}
    for (const student of backup.appState.setup.students) {
      const held = current.studentAccessVerifiers[student.studentRef]
      if (held) studentAccessVerifiers[student.studentRef] = held
    }
    return Object.freeze({
      ...backup.appState,
      setup: Object.freeze({
        ...backup.appState.setup,
        students: Object.freeze(backup.appState.setup.students.map((student) => Object.freeze({
          ...student,
          pinRequired: student.pinRequired && Boolean(studentAccessVerifiers[student.studentRef]),
        }))),
      }),
      studentAccessVerifiers: Object.freeze(studentAccessVerifiers),
      parentAccessVerifier: newParentPin ? digestLocalPin(newParentPin) : current.parentAccessVerifier,
    })
  }
  const learnerRef = backup.scope.learnerRefs[0] as string
  const source = backup.appState
  const replacement = source.setup.students[0]!
  const mergeItems = <T extends { readonly studentRef: string }>(held: readonly T[], incoming: readonly T[]) =>
    Object.freeze([...held.filter((item) => item.studentRef !== learnerRef), ...incoming])
  const found = current.setup.students.some((student) => student.studentRef === learnerRef)
  const studentAccessVerifiers = { ...current.studentAccessVerifiers }
  const verifier = studentAccessVerifiers[learnerRef]
  if (!verifier) delete studentAccessVerifiers[learnerRef]
  const safeReplacement = Object.freeze({ ...replacement, pinRequired: replacement.pinRequired && Boolean(verifier) })
  return Object.freeze({
    ...current,
    updatedAt: source.updatedAt,
    setup: Object.freeze({ ...current.setup, students: Object.freeze(found ? current.setup.students.map((student) => student.studentRef === learnerRef ? safeReplacement : student) : [...current.setup.students, safeReplacement]) }),
    sessions: mergeItems(current.sessions, source.sessions),
    sourceAttachments: mergeItems(current.sourceAttachments, source.sourceAttachments),
    assessmentAssignments: mergeItems(current.assessmentAssignments, source.assessmentAssignments),
    attestations: mergeItems(current.attestations, source.attestations),
    safety: Object.freeze({ ...current.safety, holds: mergeItems(current.safety.holds, source.safety.holds) }),
    studentAccessVerifiers: Object.freeze(studentAccessVerifiers),
  })
}

function authorized(
  preview: FinalFamilyPilotRestorePreview,
  current: FinalFamilyPilotAppStateV1,
  authority: { readonly parentAuthorized?: boolean; readonly parentPin?: string; readonly newParentPin?: string } | undefined,
): boolean {
  if (preview.requiresNewParentPin) return Boolean(authority?.newParentPin && /^\d{4}$/.test(authority.newParentPin))
  if (authority?.parentAuthorized === true) return true
  if (!authority?.parentPin || !/^\d{4}$/.test(authority.parentPin)) return false
  const verifier = current.parentAccessVerifier
  return Boolean(verifier && digestLocalPin(authority.parentPin) === verifier)
}

async function writeSnapshot(store: IndexedDbRecordStore, current: CurrentRestoreImage, createdAt: string): Promise<string | null> {
  const snapshotKey = `${FINAL_FAMILY_PILOT_PRE_RESTORE_PREFIX}:${createdAt.replace(/[:.]/g, '-')}:${current.fingerprint.slice(0, 12)}`
  const snapshot = Object.freeze({ schemaVersion: 1, createdAt, fingerprint: current.fingerprint, coreState: current.coreState, appState: current.appState, records: Object.freeze([...current.records.entries()].sort(([a], [b]) => a.localeCompare(b))) })
  try {
    await store.write(snapshotKey, snapshot, (held) => held === undefined)
    if (canonicalJson((await store.read([snapshotKey])).get(snapshotKey)) !== canonicalJson(snapshot)) return null
    return snapshotKey
  } catch {
    return null
  }
}

export async function restoreFinalFamilyPilotBackup(
  input: unknown,
  options: Pick<FinalFamilyPilotBackupOptions, 'coreStore' | 'appStore' | 'indexedDb' | 'now'> & {
    readonly preview?: FinalFamilyPilotRestorePreview
    readonly authority?: { readonly parentAuthorized?: boolean; readonly parentPin?: string; readonly newParentPin?: string }
  } = {},
): Promise<
  | { readonly status: 'restored'; readonly studentCount: number; readonly preRestoreSnapshotKey: string }
  | { readonly status: 'rejected'; readonly reasonCode: FinalFamilyPilotBackupReasonCode }
> {
  if (!options.preview) return { status: 'rejected', reasonCode: 'preview-required' }
  const validated = await parseAndValidate(input)
  if (validated.status !== 'valid') return { status: 'rejected', reasonCode: validated.reasonCode }
  if (validated.backup.integrity.digest !== options.preview.backup.integrity.digest) return { status: 'rejected', reasonCode: 'preview-stale' }
  const authoritativePreview = await previewFinalFamilyPilotRestore(input, options)
  if (authoritativePreview.status !== 'ready') return authoritativePreview
  if (
    authoritativePreview.currentFingerprint !== options.preview.currentFingerprint ||
    authoritativePreview.requiresNewParentPin !== options.preview.requiresNewParentPin ||
    canonicalJson(authoritativePreview.changes) !== canonicalJson(options.preview.changes)
  ) return { status: 'rejected', reasonCode: 'preview-stale' }
  let store: IndexedDbRecordStore
  try { store = await openIndexedDbRecordStore(options.indexedDb) } catch { return { status: 'rejected', reasonCode: 'study-storage-unavailable' } }
  let current: CurrentRestoreImage | null = null
  try { current = await currentImage(validated.backup, store, options) } catch { /* rejected below */ }
  if (!current) { store.close(); return { status: 'rejected', reasonCode: 'current-state-unavailable' } }
  if (current.fingerprint !== options.preview.currentFingerprint) { store.close(); return { status: 'rejected', reasonCode: 'preview-stale' } }
  if (!authorized(authoritativePreview, current.appState, options.authority)) { store.close(); return { status: 'rejected', reasonCode: 'parent-authorization-required' } }

  const now = options.now ?? (() => new Date().toISOString())
  const snapshotKey = await writeSnapshot(store, current, now())
  if (!snapshotKey) { store.close(); return { status: 'rejected', reasonCode: 'pre-restore-snapshot-failed' } }
  const nextCore = mergeCore(current.coreState, validated.backup)
  const nextApp = mergeApp(current.appState, validated.backup, options.authority?.newParentPin)
  const targetRecords = new Map<string, unknown>()
  for (const item of validated.backup.studyDocuments) if (item.record) targetRecords.set(item.documentKey, item.record)
  for (const item of validated.backup.plannerDocuments) if (item.record) targetRecords.set(item.documentKey, item.record)
  const affectedKeys = validated.backup.scope.kind === 'family'
    ? allManagedKeys(current.appState, validated.backup)
    : [validated.backup.studyDocuments[0]!.documentKey, validated.backup.plannerDocuments[0]!.documentKey]
  try {
    for (const key of affectedKeys) {
      if (targetRecords.has(key)) await store.write(key, targetRecords.get(key))
      else await store.remove(key)
    }
    const appSaved = saveFinalFamilyPilotAppState(nextApp, options.appStore)
    if (appSaved.status !== 'saved') throw new Error(appSaved.reasonCode)
    const coreSaved = saveFamilyPilotState(nextCore, options.coreStore)
    if (coreSaved.status !== 'ready') throw new Error(coreSaved.reasonCode ?? 'core-write-refused')
    store.close()
    return { status: 'restored', studentCount: nextApp.setup.students.length, preRestoreSnapshotKey: snapshotKey }
  } catch {
    saveFinalFamilyPilotAppState(current.appState, options.appStore)
    saveFamilyPilotState(current.coreState, options.coreStore)
    for (const key of affectedKeys) {
      try {
        if (current.records.has(key)) await store.write(key, current.records.get(key))
        else await store.remove(key)
      } catch { /* load paths surface a refused rollback */ }
    }
    store.close()
    return { status: 'rejected', reasonCode: 'atomic-write-refused' }
  }
}

export function parentBackupMessage(reasonCode: FinalFamilyPilotBackupReasonCode): string {
  const messages: Record<FinalFamilyPilotBackupReasonCode, string> = {
    'malformed-json': 'This file is not valid JSON.',
    'wrong-shape': 'This file is not a Manuel Academy Family Pilot backup.',
    'backup-version-unsupported': 'This backup version is not supported by this app.',
    'backup-version-ahead': 'This backup was created by a newer app. Update Manuel Academy before restoring it.',
    'integrity-unavailable': 'This browser could not verify the backup checksum.',
    'integrity-mismatch': 'The backup checksum does not match. The file may be damaged or changed.',
    'core-state-unreadable': 'The learner and assignment records in this backup cannot be read safely.',
    'app-state-unreadable': 'The supporting Family Pilot records in this backup cannot be read safely.',
    'safety-state-incomplete': 'The backup does not contain a complete, readable safety record.',
    'student-binding-mismatch': 'The learner records in this backup do not agree with each other.',
    'study-document-binding-mismatch': 'Study progress is attached to the wrong learner or household.',
    'study-document-unreadable': 'Study progress in this backup cannot be read safely.',
    'planner-document-binding-mismatch': 'A School Plan is attached to the wrong learner or household.',
    'planner-document-unreadable': 'A School Plan in this backup cannot be read safely.',
    'record-count-mismatch': 'The backup record totals do not match its contents.',
    'wrong-household-authority': 'This backup belongs to a different household. No data was changed.',
    'learner-revision-conflict': 'This learner has newer or conflicting work on this device. It was not replaced.',
    'current-state-unavailable': 'Current device data cannot be read safely, so restore was stopped.',
    'study-storage-unavailable': 'This browser could not open local Study storage.',
    'parent-authorization-required': 'Parent authorization is required before any data can be replaced.',
    'preview-required': 'Preview this backup before restoring it.',
    'preview-stale': 'Family data changed after the preview. Review the backup again before restoring.',
    'pre-restore-snapshot-failed': 'A local safety snapshot could not be created, so no data was replaced.',
    'atomic-write-refused': 'The device refused part of the restore. The app rolled back to the pre-restore data.',
  }
  return messages[reasonCode]
}

export function downloadFinalFamilyPilotBackup(backup: FinalFamilyPilotPortableBackupV2): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([serializeFinalFamilyPilotBackup(backup)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  const scope = backup.scope.kind === 'learner' ? `learner-${backup.scope.learnerRefs[0]}` : 'family'
  anchor.download = `manuel-academy-${scope}-${backup.createdAt.replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

import {
  IndexedDbRecordError,
  openIndexedDbRecordStore,
  type IndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from '../../durable-indexeddb'
import type { LearnerResponseAttemptContext, LearnerResponseRecord, LearnerResponseStore } from './types'

/** Pre-R1 authority. Read only for the one-time IndexedDB migration. */
export const FAMILY_PILOT_LEARNER_RESPONSES_KEY = 'manuel-academy:family-pilot:learner-responses:v1' as const
export const FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX = 'family-pilot:learner-response-attempt:v1' as const
export const FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY = `${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:migration:localstorage-v1` as const

interface LearnerResponseDocumentV1 extends LearnerResponseAttemptContext {
  readonly schemaVersion: 1
  readonly records: readonly LearnerResponseRecord[]
}

interface LearnerResponseMigrationMarkerV1 {
  readonly schemaVersion: 1
  readonly status: 'complete'
  readonly sourceKey: typeof FAMILY_PILOT_LEARNER_RESPONSES_KEY
  readonly migratedAt: string
  readonly recordCount: number
}

export interface BrowserLearnerResponseStoreOptions extends IndexedDbRecordStoreOptions {
  /** Existing localStorage authority. Removed only after verified migration. */
  readonly legacyStorage?: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'removeItem'>>
  readonly now?: () => string
}

function browserLegacyStorage(): (Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'removeItem'>>) | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

function sameAttempt(record: LearnerResponseRecord, context: LearnerResponseAttemptContext): boolean {
  return record.lessonRef === context.lessonRef &&
    record.studentRef === context.studentRef &&
    record.assignmentRef === context.assignmentRef &&
    record.attemptRef === context.attemptRef
}

function isRecord(value: unknown): value is LearnerResponseRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<LearnerResponseRecord>
  const response = record.response as Partial<LearnerResponseRecord['response']> | undefined
  const validResponse = response?.kind === 'CHOICE'
    ? typeof (response as { choiceRef?: unknown }).choiceRef === 'string'
    : ['TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(response?.kind ?? '') &&
      typeof (response as { text?: unknown }).text === 'string'
  const validAssessment = record.status === 'PENDING_ASSESSMENT'
    ? record.assessment === null
    : Boolean(record.assessment && typeof record.assessment.assessmentRef === 'string' &&
      typeof record.assessment.assessorRef === 'string' && typeof record.assessment.assessedAt === 'string' &&
      ['CORRECT', 'INCORRECT', 'PARTIAL', 'REVIEW_REQUIRED'].includes(record.assessment.decision))
  return record.schemaVersion === 1 && typeof record.lessonRef === 'string' && typeof record.studentRef === 'string' &&
    typeof record.assignmentRef === 'string' && typeof record.attemptRef === 'string' && typeof record.sectionRef === 'string' &&
    typeof record.itemRef === 'string' && typeof record.segmentRef === 'string' &&
    ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(record.responseType ?? '') &&
    response?.kind === record.responseType && typeof record.savedAt === 'string' && validResponse && validAssessment &&
    (record.status === 'PENDING_ASSESSMENT' || record.status === 'ASSESSED')
}

function isContext(value: unknown): value is LearnerResponseAttemptContext {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<LearnerResponseAttemptContext>
  return typeof context.lessonRef === 'string' && typeof context.studentRef === 'string' &&
    typeof context.assignmentRef === 'string' && typeof context.attemptRef === 'string'
}

function isDocument(value: unknown, context?: LearnerResponseAttemptContext): value is LearnerResponseDocumentV1 {
  if (!isContext(value)) return false
  const document = value as Partial<LearnerResponseDocumentV1>
  if (document.schemaVersion !== 1 || !Array.isArray(document.records) ||
    !document.records.every((record) => isRecord(record) && sameAttempt(record, document as LearnerResponseAttemptContext))) return false
  return context === undefined || document.lessonRef === context.lessonRef && document.studentRef === context.studentRef &&
    document.assignmentRef === context.assignmentRef && document.attemptRef === context.attemptRef
}

function isMigrationMarker(value: unknown): value is LearnerResponseMigrationMarkerV1 {
  if (!value || typeof value !== 'object') return false
  const marker = value as Partial<LearnerResponseMigrationMarkerV1>
  return marker.schemaVersion === 1 && marker.status === 'complete' &&
    marker.sourceKey === FAMILY_PILOT_LEARNER_RESPONSES_KEY && typeof marker.migratedAt === 'string' &&
    Number.isSafeInteger(marker.recordCount) && Number(marker.recordCount) >= 0
}

export function learnerResponseDocumentKey(context: LearnerResponseAttemptContext): string {
  return `${FAMILY_PILOT_LEARNER_RESPONSE_RECORD_PREFIX}:student:${encodeURIComponent(context.studentRef)}` +
    `:assignment:${encodeURIComponent(context.assignmentRef)}:attempt:${encodeURIComponent(context.attemptRef)}` +
    `:lesson:${encodeURIComponent(context.lessonRef)}`
}

function exact(value: unknown): string {
  return JSON.stringify(value)
}

function document(context: LearnerResponseAttemptContext, records: readonly LearnerResponseRecord[]): LearnerResponseDocumentV1 {
  return Object.freeze({
    schemaVersion: 1,
    lessonRef: context.lessonRef,
    studentRef: context.studentRef,
    assignmentRef: context.assignmentRef,
    attemptRef: context.attemptRef,
    records: Object.freeze([...records]),
  })
}

function mergeRecords(
  legacy: readonly LearnerResponseRecord[],
  current: readonly LearnerResponseRecord[],
): readonly LearnerResponseRecord[] {
  const merged = new Map<string, LearnerResponseRecord>()
  for (const record of legacy) merged.set(record.itemRef, record)
  // IndexedDB is authoritative once a record lands; a stale legacy copy cannot replace it.
  for (const record of current) merged.set(record.itemRef, record)
  return Object.freeze([...merged.values()])
}

async function writeVerified(
  store: IndexedDbRecordStore,
  key: string,
  next: unknown,
  previous: unknown,
): Promise<void> {
  const expected = previous === undefined ? undefined : exact(previous)
  await store.write(key, next, (held) => held === undefined ? expected === undefined : exact(held) === expected)
  const readback = (await store.read([key])).get(key)
  if (exact(readback) !== exact(next)) throw new Error('Learner response durable readback verification failed.')
}

/** IndexedDB authority for final Family Pilot lesson-item responses. */
export class BrowserLearnerResponseStore implements LearnerResponseStore {
  readonly #options: IndexedDbRecordStoreOptions
  readonly #legacyStorage: (Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'removeItem'>>) | undefined
  readonly #now: () => string
  #migration: Promise<void> | null = null

  constructor(options: BrowserLearnerResponseStoreOptions = {}) {
    const { legacyStorage, now, ...indexedDb } = options
    this.#options = indexedDb
    this.#legacyStorage = legacyStorage ?? browserLegacyStorage()
    this.#now = now ?? (() => new Date().toISOString())
  }

  async list(context: LearnerResponseAttemptContext): Promise<readonly LearnerResponseRecord[]> {
    await this.#ensureMigration()
    const key = learnerResponseDocumentKey(context)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      const held = (await store.read([key])).get(key)
      if (held === undefined) return Object.freeze([])
      if (!isDocument(held, context)) throw new Error('Saved learner responses cannot be safely read.')
      return Object.freeze([...held.records])
    } finally {
      store.close()
    }
  }

  async save(record: LearnerResponseRecord): Promise<void> {
    if (!isRecord(record)) throw new Error('Invalid learner response rejected.')
    await this.#ensureMigration()
    const key = learnerResponseDocumentKey(record)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = (await store.read([key])).get(key)
        if (current !== undefined && !isDocument(current, record)) {
          throw new Error('Saved learner responses cannot be safely read.')
        }
        const currentRecords = current === undefined ? [] : current.records
        const next = document(record, [...currentRecords.filter((held) => held.itemRef !== record.itemRef), record])
        try {
          await writeVerified(store, key, next, current)
          return
        } catch (error) {
          if (!(error instanceof IndexedDbRecordError) || error.kind !== 'conflict' || attempt === 2) throw error
        }
      }
    } finally {
      store.close()
    }
  }

  async commitAssessment(pending: LearnerResponseRecord, assessed: LearnerResponseRecord): Promise<{
    readonly status: 'accepted' | 'duplicate' | 'stale'
    readonly record: LearnerResponseRecord
  }> {
    if (!isRecord(pending) || pending.status !== 'PENDING_ASSESSMENT' ||
      !isRecord(assessed) || assessed.status !== 'ASSESSED' ||
      exact({ ...assessed, status: pending.status, assessment: pending.assessment }) !== exact(pending)) {
      throw new Error('Invalid trusted assessment transition rejected.')
    }
    await this.#ensureMigration()
    const key = learnerResponseDocumentKey(pending)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = (await store.read([key])).get(key)
        if (!isDocument(current, pending)) throw new Error('Saved learner responses cannot be safely read.')
        const held = current.records.find((record) => record.itemRef === pending.itemRef)
        if (exact(held) === exact(assessed)) return { status: 'duplicate', record: assessed }
        if (exact(held) !== exact(pending)) return { status: 'stale', record: held ?? pending }
        const next = document(pending, [
          ...current.records.filter((record) => record.itemRef !== pending.itemRef),
          assessed,
        ])
        try {
          await writeVerified(store, key, next, current)
          return { status: 'accepted', record: assessed }
        } catch (error) {
          if (!(error instanceof IndexedDbRecordError) || error.kind !== 'conflict' || attempt === 2) throw error
        }
      }
      return { status: 'stale', record: pending }
    } finally {
      store.close()
    }
  }

  async #ensureMigration(): Promise<void> {
    this.#migration ??= this.#migrateLegacy()
    return this.#migration
  }

  async #migrateLegacy(): Promise<void> {
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      const existingMarker = (await store.read([FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY]))
        .get(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)
      if (existingMarker !== undefined) {
        if (!isMigrationMarker(existingMarker)) throw new Error('Learner response migration state is unreadable.')
        this.#removeVerifiedLegacySource()
        return
      }

      let raw: string | null = null
      if (this.#legacyStorage) raw = this.#legacyStorage.getItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY)
      let legacy: LearnerResponseRecord[] = []
      if (raw !== null) {
        let parsed: unknown
        try { parsed = JSON.parse(raw) } catch { throw new Error('Existing learner responses cannot be safely migrated.') }
        if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
          throw new Error('Existing learner responses cannot be safely migrated.')
        }
        legacy = parsed
      }

      const groups = new Map<string, { context: LearnerResponseAttemptContext; records: LearnerResponseRecord[] }>()
      for (const record of legacy) {
        const key = learnerResponseDocumentKey(record)
        const group = groups.get(key) ?? { context: record, records: [] }
        group.records.push(record)
        groups.set(key, group)
      }
      for (const [key, group] of groups) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const current = (await store.read([key])).get(key)
          if (current !== undefined && !isDocument(current, group.context)) {
            throw new Error('IndexedDB learner responses cannot be safely merged with legacy data.')
          }
          const next = document(group.context, mergeRecords(group.records, current === undefined ? [] : current.records))
          if (current !== undefined && exact(current) === exact(next)) break
          try {
            await writeVerified(store, key, next, current)
            break
          } catch (error) {
            if (!(error instanceof IndexedDbRecordError) || error.kind !== 'conflict' || attempt === 2) throw error
          }
        }
      }

      const marker: LearnerResponseMigrationMarkerV1 = Object.freeze({
        schemaVersion: 1,
        status: 'complete',
        sourceKey: FAMILY_PILOT_LEARNER_RESPONSES_KEY,
        migratedAt: this.#now(),
        recordCount: legacy.length,
      })
      try {
        await writeVerified(store, FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY, marker, undefined)
      } catch (error) {
        if (!(error instanceof IndexedDbRecordError) || error.kind !== 'conflict') throw error
        const raced = (await store.read([FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY]))
          .get(FAMILY_PILOT_LEARNER_RESPONSE_MIGRATION_KEY)
        if (!isMigrationMarker(raced)) throw error
      }
      this.#removeVerifiedLegacySource()
    } finally {
      store.close()
    }
  }

  #removeVerifiedLegacySource(): void {
    if (!this.#legacyStorage?.removeItem || this.#legacyStorage.getItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY) === null) return
    this.#legacyStorage.removeItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY)
    if (this.#legacyStorage.getItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY) !== null) {
      throw new Error('Migrated local learner-response data could not be removed.')
    }
  }
}

export class MemoryLearnerResponseStore implements LearnerResponseStore {
  readonly #records = new Map<string, LearnerResponseRecord>()

  async list(context: LearnerResponseAttemptContext): Promise<readonly LearnerResponseRecord[]> {
    return Object.freeze([...this.#records.values()].filter((record) => sameAttempt(record, context)))
  }

  async save(record: LearnerResponseRecord): Promise<void> {
    this.#records.set(`${record.studentRef}|${record.assignmentRef}|${record.attemptRef}|${record.itemRef}`, record)
  }

  async commitAssessment(pending: LearnerResponseRecord, assessed: LearnerResponseRecord): Promise<{
    readonly status: 'accepted' | 'duplicate' | 'stale'
    readonly record: LearnerResponseRecord
  }> {
    const key = `${pending.studentRef}|${pending.assignmentRef}|${pending.attemptRef}|${pending.itemRef}`
    const current = this.#records.get(key)
    if (exact(current) === exact(assessed)) return { status: 'duplicate', record: assessed }
    if (exact(current) !== exact(pending)) return { status: 'stale', record: current ?? pending }
    this.#records.set(key, assessed)
    return { status: 'accepted', record: assessed }
  }
}

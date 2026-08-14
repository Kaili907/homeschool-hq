import {
  IndexedDbRecordError,
  openIndexedDbRecordStore,
  type IndexedDbRecordStore,
  type IndexedDbRecordStoreOptions,
} from '../../durable-indexeddb'
import type { FinalAssessmentAssignmentStatus } from '../state'

export const FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION = 1 as const

export interface FinalAssessmentResponseRecord {
  readonly taskRef: string
  readonly value: string | number | readonly string[]
  readonly savedAt: string
}

export interface FinalAssessmentAttemptV1 {
  readonly schemaVersion: typeof FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly studentRef: string
  readonly status: FinalAssessmentAssignmentStatus
  readonly responses: Readonly<Record<string, FinalAssessmentResponseRecord>>
  readonly updatedAt: string
}

export function assessmentAttemptDocumentKey(studentRef: string, assignmentRef: string): string {
  return `family-pilot:assessment-attempt:${studentRef}:${assignmentRef}`
}

function isAttempt(value: unknown, studentRef: string, assignmentRef: string, assessmentRef: string): value is FinalAssessmentAttemptV1 {
  if (!value || typeof value !== 'object') return false
  const held = value as Partial<FinalAssessmentAttemptV1>
  if (held.schemaVersion !== FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION ||
    held.studentRef !== studentRef || held.assignmentRef !== assignmentRef || held.assessmentRef !== assessmentRef ||
    !['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION', 'CERTIFIED'].includes(held.status ?? '') ||
    typeof held.responses !== 'object' || held.responses === null || Array.isArray(held.responses) || typeof held.updatedAt !== 'string') return false
  return Object.entries(held.responses).every(([taskRef, response]) => {
    if (!response || typeof response !== 'object') return false
    const record = response as Partial<FinalAssessmentResponseRecord>
    const validValue = typeof record.value === 'string' || typeof record.value === 'number' ||
      Array.isArray(record.value) && record.value.every((item) => typeof item === 'string')
    return record.taskRef === taskRef && validValue && typeof record.savedAt === 'string'
  })
}

function exact(value: unknown): string { return JSON.stringify(value) }

/** Durable assessment response/evidence storage. Metadata alone is mirrored to app state. */
export class BrowserAssessmentRuntime {
  readonly #options: IndexedDbRecordStoreOptions
  readonly #now: () => string

  constructor(options: IndexedDbRecordStoreOptions = {}, now = () => new Date().toISOString()) {
    this.#options = options
    this.#now = now
  }

  async load(input: { readonly studentRef: string; readonly assignmentRef: string; readonly assessmentRef: string }): Promise<FinalAssessmentAttemptV1> {
    const key = assessmentAttemptDocumentKey(input.studentRef, input.assignmentRef)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      const current = (await store.read([key])).get(key)
      if (isAttempt(current, input.studentRef, input.assignmentRef, input.assessmentRef)) return current
      if (current !== undefined) throw new Error('Saved assessment responses cannot be safely read.')
      return Object.freeze({
        schemaVersion: FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION,
        ...input,
        status: 'ACTIVE',
        responses: Object.freeze({}),
        updatedAt: this.#now(),
      })
    } finally {
      store.close()
    }
  }

  async saveResponse(input: {
    readonly studentRef: string
    readonly assignmentRef: string
    readonly assessmentRef: string
    readonly taskRef: string
    readonly value: string | number | readonly string[]
  }): Promise<FinalAssessmentAttemptV1> {
    const key = assessmentAttemptDocumentKey(input.studentRef, input.assignmentRef)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      for (let retry = 0; retry < 3; retry += 1) {
        const held = (await store.read([key])).get(key)
        if (held !== undefined && !isAttempt(held, input.studentRef, input.assignmentRef, input.assessmentRef)) {
          throw new Error('Saved assessment responses cannot be safely read.')
        }
        const current: FinalAssessmentAttemptV1 = held === undefined ? Object.freeze({
          schemaVersion: FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION,
          studentRef: input.studentRef,
          assignmentRef: input.assignmentRef,
          assessmentRef: input.assessmentRef,
          status: 'ACTIVE',
          responses: Object.freeze({}),
          updatedAt: this.#now(),
        }) : held
        const next = Object.freeze({
          ...current,
          status: 'ACTIVE' as const,
          responses: Object.freeze({
            ...current.responses,
            [input.taskRef]: Object.freeze({ taskRef: input.taskRef, value: input.value, savedAt: this.#now() }),
          }),
          updatedAt: this.#now(),
        })
        try {
          await this.#write(store, next, held)
          return next
        } catch (error) {
          if (!(error instanceof IndexedDbRecordError) || error.kind !== 'conflict' || retry === 2) throw error
        }
      }
      throw new Error('Assessment response could not be saved.')
    } finally {
      store.close()
    }
  }

  async setStatus(attempt: FinalAssessmentAttemptV1, status: FinalAssessmentAssignmentStatus): Promise<FinalAssessmentAttemptV1> {
    const next = Object.freeze({ ...attempt, status, updatedAt: this.#now() })
    const key = assessmentAttemptDocumentKey(attempt.studentRef, attempt.assignmentRef)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      const current = (await store.read([key])).get(key)
      if (!isAttempt(current, attempt.studentRef, attempt.assignmentRef, attempt.assessmentRef)) {
        throw new Error('Saved assessment responses cannot be safely read.')
      }
      if (exact(current) !== exact(attempt)) throw new Error('Saved assessment responses changed in another session.')
      await this.#write(store, next, current)
      return next
    } finally {
      store.close()
    }
  }

  async #write(store: IndexedDbRecordStore, attempt: FinalAssessmentAttemptV1, previous: unknown): Promise<void> {
    const key = assessmentAttemptDocumentKey(attempt.studentRef, attempt.assignmentRef)
    const expected = previous === undefined ? undefined : exact(previous)
    await store.write(key, attempt, (held) => held === undefined ? expected === undefined : exact(held) === expected)
    const verified = (await store.read([key])).get(key)
    if (!isAttempt(verified, attempt.studentRef, attempt.assignmentRef, attempt.assessmentRef) || exact(verified) !== exact(attempt)) {
      throw new Error('Assessment response verification failed.')
    }
  }
}

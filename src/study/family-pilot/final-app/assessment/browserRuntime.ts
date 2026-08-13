import { openIndexedDbRecordStore, type IndexedDbRecordStoreOptions } from '../../durable-indexeddb'
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

function attemptKey(studentRef: string, assignmentRef: string): string {
  return `family-pilot:assessment-attempt:${studentRef}:${assignmentRef}`
}

function isAttempt(value: unknown, studentRef: string, assignmentRef: string, assessmentRef: string): value is FinalAssessmentAttemptV1 {
  if (!value || typeof value !== 'object') return false
  const held = value as Partial<FinalAssessmentAttemptV1>
  return held.schemaVersion === FINAL_ASSESSMENT_ATTEMPT_SCHEMA_VERSION &&
    held.studentRef === studentRef && held.assignmentRef === assignmentRef && held.assessmentRef === assessmentRef &&
    typeof held.responses === 'object' && held.responses !== null && typeof held.updatedAt === 'string'
}

/** Durable assessment response/evidence storage. Metadata alone is mirrored to app state. */
export class BrowserAssessmentRuntime {
  readonly #options: IndexedDbRecordStoreOptions
  readonly #now: () => string

  constructor(options: IndexedDbRecordStoreOptions = {}, now = () => new Date().toISOString()) {
    this.#options = options
    this.#now = now
  }

  async load(input: { readonly studentRef: string; readonly assignmentRef: string; readonly assessmentRef: string }): Promise<FinalAssessmentAttemptV1> {
    const key = attemptKey(input.studentRef, input.assignmentRef)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      const current = (await store.read([key])).get(key)
      if (isAttempt(current, input.studentRef, input.assignmentRef, input.assessmentRef)) return current
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
    const current = await this.load(input)
    const next = Object.freeze({
      ...current,
      status: 'ACTIVE' as const,
      responses: Object.freeze({
        ...current.responses,
        [input.taskRef]: Object.freeze({ taskRef: input.taskRef, value: input.value, savedAt: this.#now() }),
      }),
      updatedAt: this.#now(),
    })
    await this.#write(next)
    return next
  }

  async setStatus(attempt: FinalAssessmentAttemptV1, status: FinalAssessmentAssignmentStatus): Promise<FinalAssessmentAttemptV1> {
    const next = Object.freeze({ ...attempt, status, updatedAt: this.#now() })
    await this.#write(next)
    return next
  }

  async #write(attempt: FinalAssessmentAttemptV1): Promise<void> {
    const key = attemptKey(attempt.studentRef, attempt.assignmentRef)
    const store = await openIndexedDbRecordStore(this.#options)
    try {
      await store.write(key, attempt)
      const verified = (await store.read([key])).get(key)
      if (!isAttempt(verified, attempt.studentRef, attempt.assignmentRef, attempt.assessmentRef) || verified.updatedAt !== attempt.updatedAt) {
        throw new Error('Assessment response verification failed.')
      }
    } finally {
      store.close()
    }
  }
}

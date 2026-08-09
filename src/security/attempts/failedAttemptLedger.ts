import {
  hasExactKeys,
  isPlainRecord,
  parseCanonicalTimestamp,
  requireSafeTimestamp,
  safeRemove,
  type SecurityClock,
  type SecurityStorage,
  systemSecurityClock,
} from '../session/runtime'

export const FAILED_ATTEMPT_LEDGER_SCHEMA_VERSION = 2 as const
// Retain the original key so schema-v1 history fails closed in place instead of disappearing.
export const FAILED_ATTEMPT_STORAGE_PREFIX = 'manuel-academy.security.failed-attempt.v1:'

const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS

/** The single source for the approved progressive client-side friction schedule. */
export const FAILED_ATTEMPT_POLICY = Object.freeze({
  genericFailureThroughAttempt: 2,
  cooldownMsByAttempt: Object.freeze({
    3: 5 * SECOND_MS,
    4: 15 * SECOND_MS,
    5: 30 * SECOND_MS,
    6: 60 * SECOND_MS,
    7: 60 * SECOND_MS,
    8: 60 * SECOND_MS,
    9: 60 * SECOND_MS,
  } as Readonly<Record<number, number>>),
  temporaryLockAtAttempt: 10,
  temporaryLockMs: Object.freeze({
    learner: 15 * MINUTE_MS,
    parent: 30 * MINUTE_MS,
  }),
})

export type FailedAttemptSubject = Readonly<
  | { kind: 'learner'; profileId: string }
  | { kind: 'parent'; householdId: string }
>

interface FailedAttemptRecord {
  readonly schemaVersion: typeof FAILED_ATTEMPT_LEDGER_SCHEMA_VERSION
  readonly failedAttempts: number
  readonly lastFailureAt: string
  readonly maxObservedAt: string
  readonly retryAt: string | null
  readonly lockedUntil: string | null
}

export type FailedAttemptStatus =
  | Readonly<{ status: 'ready'; failedAttempts: number }>
  | Readonly<{ status: 'cooldown'; failedAttempts: number; retryAt: string; remainingMs: number }>
  | Readonly<{ status: 'temporarily-locked'; failedAttempts: number; lockedUntil: string; remainingMs: number }>
  | Readonly<{ status: 'ledger-invalid'; failedAttempts: number }>

export interface FailedAttemptLedgerOptions {
  readonly storage: SecurityStorage
  readonly clock?: SecurityClock
}

const RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'failedAttempts',
  'lastFailureAt',
  'maxObservedAt',
  'retryAt',
  'lockedUntil',
] as const)

function subjectStorageKey(subject: FailedAttemptSubject): string {
  const id = subject.kind === 'learner' ? subject.profileId : subject.householdId
  if (!id || id.trim() !== id) throw new Error('Attempt subject ID is required.')
  return `${FAILED_ATTEMPT_STORAGE_PREFIX}${subject.kind}:${encodeURIComponent(id)}`
}

function parseNullableTimestamp(value: unknown): number | null | undefined {
  if (value === null) return null
  return parseCanonicalTimestamp(value) ?? undefined
}

function parseRecord(serialized: string): FailedAttemptRecord | null {
  try {
    const value: unknown = JSON.parse(serialized)
    if (!isPlainRecord(value) || !hasExactKeys(value, RECORD_KEYS)) return null
    if (value.schemaVersion !== FAILED_ATTEMPT_LEDGER_SCHEMA_VERSION) return null
    if (!Number.isSafeInteger(value.failedAttempts) || Number(value.failedAttempts) < 1) return null
    if (parseCanonicalTimestamp(value.lastFailureAt) === null) return null
    const maxObservedAt = parseCanonicalTimestamp(value.maxObservedAt)
    if (maxObservedAt === null || maxObservedAt < Date.parse(String(value.lastFailureAt))) return null
    const retryAt = parseNullableTimestamp(value.retryAt)
    const lockedUntil = parseNullableTimestamp(value.lockedUntil)
    if (retryAt === undefined || lockedUntil === undefined) return null
    if (retryAt !== null && lockedUntil !== null) return null
    return value as unknown as FailedAttemptRecord
  } catch {
    return null
  }
}

function cooldownForAttempt(attempt: number): number {
  return FAILED_ATTEMPT_POLICY.cooldownMsByAttempt[attempt] ?? 0
}

/** Durable non-secret counters; this is friction, not a server security boundary. */
export class FailedAttemptLedger {
  readonly #storage: SecurityStorage
  readonly #clock: SecurityClock

  constructor(options: FailedAttemptLedgerOptions) {
    this.#storage = options.storage
    this.#clock = options.clock ?? systemSecurityClock
  }

  status(subject: FailedAttemptSubject): FailedAttemptStatus {
    const now = requireSafeTimestamp(this.#clock)
    return this.#statusAt(subject, now)
  }

  recordFailure(subject: FailedAttemptSubject): FailedAttemptStatus {
    const now = requireSafeTimestamp(this.#clock)
    const current = this.#statusAt(subject, now)
    if (current.status !== 'ready') return current
    const failedAttempts = current.failedAttempts + 1
    const lockMs = subject.kind === 'learner'
      ? FAILED_ATTEMPT_POLICY.temporaryLockMs.learner
      : FAILED_ATTEMPT_POLICY.temporaryLockMs.parent
    const lockedUntil = failedAttempts >= FAILED_ATTEMPT_POLICY.temporaryLockAtAttempt
      ? new Date(now + lockMs).toISOString()
      : null
    const cooldownMs = cooldownForAttempt(failedAttempts)
    const retryAt = lockedUntil === null && cooldownMs > 0
      ? new Date(now + cooldownMs).toISOString()
      : null
    const observedAt = new Date(now).toISOString()
    const record: FailedAttemptRecord = Object.freeze({
      schemaVersion: FAILED_ATTEMPT_LEDGER_SCHEMA_VERSION,
      failedAttempts,
      lastFailureAt: observedAt,
      maxObservedAt: observedAt,
      retryAt,
      lockedUntil,
    })
    this.#storage.setItem(subjectStorageKey(subject), JSON.stringify(record))
    if (lockedUntil) {
      return Object.freeze({
        status: 'temporarily-locked',
        failedAttempts,
        lockedUntil,
        remainingMs: lockMs,
      })
    }
    if (retryAt) {
      return Object.freeze({ status: 'cooldown', failedAttempts, retryAt, remainingMs: cooldownMs })
    }
    return Object.freeze({ status: 'ready', failedAttempts })
  }

  recordSuccess(subject: FailedAttemptSubject): void {
    safeRemove(this.#storage, subjectStorageKey(subject))
  }

  #statusAt(subject: FailedAttemptSubject, now: number): FailedAttemptStatus {
    const key = subjectStorageKey(subject)
    let serialized: string | null
    try {
      serialized = this.#storage.getItem(key)
    } catch {
      return Object.freeze({ status: 'ledger-invalid', failedAttempts: 0 })
    }
    if (serialized === null) return Object.freeze({ status: 'ready', failedAttempts: 0 })
    const record = parseRecord(serialized)
    if (!record) return Object.freeze({ status: 'ledger-invalid', failedAttempts: 0 })
    const lastFailureAt = Date.parse(record.lastFailureAt)
    const maxObservedAt = Date.parse(record.maxObservedAt)
    if (now < lastFailureAt || now < maxObservedAt) {
      return Object.freeze({ status: 'ledger-invalid', failedAttempts: record.failedAttempts })
    }
    if (now > maxObservedAt) {
      try {
        const observedRecord = JSON.stringify({
          ...record,
          maxObservedAt: new Date(now).toISOString(),
        } satisfies FailedAttemptRecord)
        this.#storage.setItem(key, observedRecord)
        if (this.#storage.getItem(key) !== observedRecord) {
          return Object.freeze({ status: 'ledger-invalid', failedAttempts: record.failedAttempts })
        }
      } catch {
        return Object.freeze({ status: 'ledger-invalid', failedAttempts: record.failedAttempts })
      }
    }
    if (record.lockedUntil) {
      const lockedUntil = Date.parse(record.lockedUntil)
      if (now < lockedUntil) {
        return Object.freeze({
          status: 'temporarily-locked',
          failedAttempts: record.failedAttempts,
          lockedUntil: record.lockedUntil,
          remainingMs: lockedUntil - now,
        })
      }
      return Object.freeze({ status: 'ready', failedAttempts: record.failedAttempts })
    }
    if (record.retryAt) {
      const retryAt = Date.parse(record.retryAt)
      if (now < retryAt) {
        return Object.freeze({
          status: 'cooldown',
          failedAttempts: record.failedAttempts,
          retryAt: record.retryAt,
          remainingMs: retryAt - now,
        })
      }
    }
    return Object.freeze({ status: 'ready', failedAttempts: record.failedAttempts })
  }
}

export function createBrowserFailedAttemptLedger(): FailedAttemptLedger {
  if (typeof window === 'undefined') throw new Error('Browser attempt storage is unavailable.')
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    throw new Error('Browser attempt storage is unavailable.')
  }
  return new FailedAttemptLedger({ storage })
}

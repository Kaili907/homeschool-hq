import { isUuidV4 } from '../contracts/identifiers'
import { parseProfileId, type ProfileId } from '../contracts/profileId'
import {
  hasExactKeys,
  isPlainRecord,
  parseCanonicalTimestamp,
  requireSafeTimestamp,
  type SecurityClock,
  type SecurityStorage,
  systemSecurityClock,
} from '../session/runtime'

export const FAILED_ATTEMPT_LEDGER_SCHEMA_VERSION = 2 as const
// Retain the original key so schema-v1 history fails closed in place instead of disappearing.
export const FAILED_ATTEMPT_STORAGE_PREFIX = 'manuel-academy.security.failed-attempt.v1:'
export const FAILED_ATTEMPT_LOCK_PREFIX = 'manuel-academy.security.failed-attempt.v1:lock:'

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
  | { kind: 'learner'; profileId: ProfileId }
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
  readonly lockManager?: AttemptLockManager
}

export interface AttemptLockManager {
  request<T>(
    name: string,
    options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T>
}

const RECORD_KEYS = Object.freeze([
  'schemaVersion',
  'failedAttempts',
  'lastFailureAt',
  'maxObservedAt',
  'retryAt',
  'lockedUntil',
] as const)

const LEARNER_SUBJECT_KEYS = Object.freeze(['kind', 'profileId'] as const)
const PARENT_SUBJECT_KEYS = Object.freeze(['kind', 'householdId'] as const)

function requireFailedAttemptSubject(value: unknown): FailedAttemptSubject {
  if (!isPlainRecord(value)) throw new Error('Attempt subject ID is invalid.')
  if (value.kind === 'learner' && hasExactKeys(value, LEARNER_SUBJECT_KEYS)) {
    const profileId = parseProfileId(value.profileId)
    if (profileId) return Object.freeze({ kind: 'learner', profileId })
  }
  if (
    value.kind === 'parent' &&
    hasExactKeys(value, PARENT_SUBJECT_KEYS) &&
    isUuidV4(value.householdId)
  ) {
    return Object.freeze({ kind: 'parent', householdId: value.householdId })
  }
  throw new Error('Attempt subject ID is invalid.')
}

function subjectIdentity(subject: FailedAttemptSubject): { readonly id: string; readonly scope: 'profile' | 'household' } {
  const id = subject.kind === 'learner' ? subject.profileId : subject.householdId
  return { id, scope: subject.kind === 'learner' ? 'profile' : 'household' }
}

function encodedSubject(subject: FailedAttemptSubject): string {
  const { id, scope } = subjectIdentity(subject)
  const encoded = encodeURIComponent(id)
  return `pin:${subject.kind}:${scope}:${encoded.length}:${encoded}`
}

function subjectStorageKey(subject: FailedAttemptSubject): string {
  const { id } = subjectIdentity(subject)
  // Preserve the accepted durable key so existing attempt history remains in
  // force; only the coordination lock uses the stronger structured identity.
  return `${FAILED_ATTEMPT_STORAGE_PREFIX}${subject.kind}:${encodeURIComponent(id)}`
}

export function failedAttemptLockName(subject: FailedAttemptSubject): string {
  return `${FAILED_ATTEMPT_LOCK_PREFIX}${encodedSubject(requireFailedAttemptSubject(subject))}`
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

/**
 * Durable non-secret counters; this is friction, not a server security boundary.
 * Every operation requires subject-scoped Web-Lock-style coordination and
 * rejects when no coordinator is supplied; there is no unlocked fallback.
 */
export class FailedAttemptLedger {
  readonly #storage: SecurityStorage
  readonly #clock: SecurityClock
  readonly #lockManager?: AttemptLockManager

  constructor(options: FailedAttemptLedgerOptions) {
    this.#storage = options.storage
    this.#clock = options.clock ?? systemSecurityClock
    this.#lockManager = options.lockManager
  }

  async status(subject: FailedAttemptSubject): Promise<FailedAttemptStatus> {
    return this.#withSubjectLock(subject, (validSubject) => {
      const now = requireSafeTimestamp(this.#clock)
      return this.#statusAt(validSubject, now)
    })
  }

  async recordFailure(subject: FailedAttemptSubject): Promise<FailedAttemptStatus> {
    return this.#withSubjectLock(subject, (validSubject) => {
      const now = requireSafeTimestamp(this.#clock)
      const current = this.#statusAt(validSubject, now)
      if (current.status === 'ledger-invalid') return current
      if (current.failedAttempts === Number.MAX_SAFE_INTEGER) {
        return Object.freeze({ status: 'ledger-invalid', failedAttempts: current.failedAttempts })
      }
      // A failure represents an authentication operation that already ran. It
      // must be counted even if another tab established a cooldown while this
      // operation was in flight.
      const failedAttempts = current.failedAttempts + 1
      const lockMs = validSubject.kind === 'learner'
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
      if (!this.#writeVerified(subjectStorageKey(validSubject), record)) {
        return Object.freeze({ status: 'ledger-invalid', failedAttempts })
      }
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
    })
  }

  async recordSuccess(subject: FailedAttemptSubject): Promise<void> {
    return this.#withSubjectLock(subject, (validSubject) => {
      const now = requireSafeTimestamp(this.#clock)
      const current = this.#statusAt(validSubject, now)
      if (current.status === 'ledger-invalid') throw new Error('Failed-attempt ledger is invalid.')
      const key = subjectStorageKey(validSubject)
      try {
        this.#storage.removeItem(key)
        if (this.#storage.getItem(key) !== null) throw new Error('Failed-attempt reset could not be verified.')
      } catch {
        throw new Error('Failed-attempt reset could not be verified.')
      }
    })
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
        const observedRecord = {
          ...record,
          maxObservedAt: new Date(now).toISOString(),
        } satisfies FailedAttemptRecord
        if (!this.#writeVerified(key, observedRecord)) {
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

  #writeVerified(key: string, record: FailedAttemptRecord): boolean {
    try {
      const serialized = JSON.stringify(record)
      this.#storage.setItem(key, serialized)
      return this.#storage.getItem(key) === serialized
    } catch {
      return false
    }
  }

  #withSubjectLock<T>(
    subject: FailedAttemptSubject,
    operation: (validSubject: FailedAttemptSubject) => T | Promise<T>,
  ): Promise<T> {
    const validSubject = requireFailedAttemptSubject(subject)
    const lockName = `${FAILED_ATTEMPT_LOCK_PREFIX}${encodedSubject(validSubject)}`
    if (!this.#lockManager) {
      return Promise.reject(new Error('Failed-attempt coordination is unavailable.'))
    }
    return this.#lockManager.request(
      lockName,
      { mode: 'exclusive' },
      () => operation(validSubject),
    )
  }
}

/** Requires Web Locks; unsupported browsers fail closed instead of racing localStorage. */
export function createBrowserFailedAttemptLedger(): FailedAttemptLedger {
  if (typeof window === 'undefined') throw new Error('Browser attempt storage is unavailable.')
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    throw new Error('Browser attempt storage is unavailable.')
  }
  const lockManager = (navigator as Navigator & { locks?: AttemptLockManager }).locks
  if (!lockManager) throw new Error('Browser failed-attempt coordination is unavailable.')
  return new FailedAttemptLedger({ storage, lockManager })
}

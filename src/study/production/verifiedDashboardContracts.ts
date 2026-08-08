/**
 * STUDY-A1-PROD-DASH-1 — exact response contracts for the two verified academic
 * runtime reads a production learner surface may honestly render.
 *
 * Every shape here is transcribed from the server, not from the preview Study
 * types: the body builders in
 * `supabase/migrations/20260801190000_academy_study_final_production_reconciliation.sql`
 * (`academy_study_execute_verified_runtime_v1`), and the column constraints in
 * `supabase/migrations/20260801010000_academy_study_engine_storage.sql`.
 * `verifiedDashboardContracts.sqlDrift.test.ts` re-derives the enums, the
 * identifier pattern and the row caps from those files, so a server change that
 * moves an enum fails here rather than silently widening the browser.
 *
 * These parsers refuse; they never repair. A missing field, an unknown enum
 * value, an unsafe revision or an unparseable timestamp rejects the whole body.
 * Nothing is defaulted, coerced or filled in, because a learner reading an
 * invented plan is worse than a learner told the plan could not be loaded.
 */

/** `academy_study_sessions.state`. */
export const VERIFIED_STUDY_SESSION_STATES = Object.freeze([
  'planned',
  'active',
  'paused',
  'approved_break',
  'student_requested_break',
  'technical_interruption',
  'completed',
  'abandoned',
] as const)

/** `academy_study_calendar_blocks.block_type`. */
export const VERIFIED_STUDY_BLOCK_TYPES = Object.freeze([
  'lesson',
  'review',
  'resume',
  'break',
  'assessment',
] as const)

/** `academy_study_calendar_blocks.state`. */
export const VERIFIED_STUDY_BLOCK_STATES = Object.freeze([
  'scheduled',
  'available',
  'in_progress',
  'completed',
  'cancelled',
] as const)

export type VerifiedStudySessionState = typeof VERIFIED_STUDY_SESSION_STATES[number]
export type VerifiedStudyBlockType = typeof VERIFIED_STUDY_BLOCK_TYPES[number]
export type VerifiedStudyBlockState = typeof VERIFIED_STUDY_BLOCK_STATES[number]

/** `public.academy_study_identifier_is_valid(text)`. */
export const VERIFIED_STUDY_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

/** `limit 50` / `limit 100` in the two body builders. */
export const VERIFIED_DASHBOARD_SESSION_LIMIT = 50
export const VERIFIED_CALENDAR_BLOCK_LIMIT = 100

export const VERIFIED_DASHBOARD_SESSION_KEYS = Object.freeze([
  'sessionId',
  'state',
  'lessonId',
  'revision',
  'updatedAt',
] as const)

export const VERIFIED_CALENDAR_BLOCK_KEYS = Object.freeze([
  'blockId',
  'blockType',
  'sourceReference',
  'scheduledStart',
  'intendedLocalDate',
  'state',
  'revision',
] as const)

export type VerifiedStudyContractCode =
  | 'dashboard-body-invalid'
  | 'calendar-body-invalid'

/**
 * A refused body. It names the operation whose contract failed and nothing else
 * — no field values, no server text, nothing that could carry protected data
 * into a log or onto a screen.
 */
export class VerifiedStudyContractError extends Error {
  readonly code: VerifiedStudyContractCode

  constructor(code: VerifiedStudyContractCode) {
    super(code)
    this.name = 'VerifiedStudyContractError'
    this.code = code
  }
}

export interface VerifiedStudySessionRecord {
  readonly sessionId: string
  readonly state: VerifiedStudySessionState
  readonly lessonId: string
  readonly revision: number
  readonly updatedAt: string
}

export interface VerifiedStudyCalendarBlock {
  readonly blockId: string
  readonly blockType: VerifiedStudyBlockType
  readonly sourceReference: string
  readonly scheduledStart: string
  readonly intendedLocalDate: string
  readonly state: VerifiedStudyBlockState
  readonly revision: number
}

export interface VerifiedStudyDashboard {
  readonly sessions: readonly VerifiedStudySessionRecord[]
}

export interface VerifiedStudyCalendar {
  readonly blocks: readonly VerifiedStudyCalendarBlock[]
}

/** A Postgres `timestamptz` as jsonb renders ISO 8601 with an explicit offset. */
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/
/** A Postgres `date` as jsonb renders `YYYY-MM-DD`. */
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Exactly these keys, no more and no fewer. The count check is what refuses an
 * unknown or protected field the runtime boundary let through, so it must stay
 * an equality and never become a superset test.
 */
function exactKeys(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== keys.length) return null
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) return null
  }
  return record
}

function identifier(value: unknown): string | null {
  return typeof value === 'string' && VERIFIED_STUDY_IDENTIFIER_PATTERN.test(value) ? value : null
}

function member<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? value as T
    : null
}

function revision(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function instant(value: unknown): string | null {
  return typeof value === 'string' &&
    INSTANT_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value))
    ? value
    : null
}

function localDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parts = LOCAL_DATE_PATTERN.exec(value)
  if (!parts) return null
  // A well-formed but impossible day (2026-02-31) is rejected rather than rolled
  // forward into a date the household never scheduled.
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) &&
    parsed.getUTCFullYear() === Number(parts[1]) &&
    parsed.getUTCMonth() + 1 === Number(parts[2]) &&
    parsed.getUTCDate() === Number(parts[3])
    ? value
    : null
}

function rows(body: unknown, key: string, limit: number): readonly unknown[] | null {
  const envelope = exactKeys(body, [key])
  if (!envelope) return null
  const list = envelope[key]
  if (!Array.isArray(list) || list.length > limit) return null
  return list
}

/** `dashboard:read` — `{ sessions: [{ sessionId, state, lessonId, revision, updatedAt }] }`. */
export function parseVerifiedStudyDashboard(body: unknown): VerifiedStudyDashboard {
  const refuse = (): never => { throw new VerifiedStudyContractError('dashboard-body-invalid') }
  const list = rows(body, 'sessions', VERIFIED_DASHBOARD_SESSION_LIMIT) ?? refuse()

  const sessions: VerifiedStudySessionRecord[] = []
  for (const entry of list) {
    const row = exactKeys(entry, VERIFIED_DASHBOARD_SESSION_KEYS) ?? refuse()
    const sessionId = identifier(row.sessionId) ?? refuse()
    const state = member(row.state, VERIFIED_STUDY_SESSION_STATES) ?? refuse()
    const lessonId = identifier(row.lessonId) ?? refuse()
    const sessionRevision = revision(row.revision) ?? refuse()
    const updatedAt = instant(row.updatedAt) ?? refuse()
    // Built fresh, never the caller's object: nothing the server sent stays
    // reachable through the value this returns.
    sessions.push(Object.freeze({ sessionId, state, lessonId, revision: sessionRevision, updatedAt }))
  }
  return Object.freeze({ sessions: Object.freeze(sessions) })
}

/**
 * `calendar:read` — `{ blocks: [{ blockId, blockType, sourceReference,
 * scheduledStart, intendedLocalDate, state, revision }] }`.
 */
export function parseVerifiedStudyCalendar(body: unknown): VerifiedStudyCalendar {
  const refuse = (): never => { throw new VerifiedStudyContractError('calendar-body-invalid') }
  const list = rows(body, 'blocks', VERIFIED_CALENDAR_BLOCK_LIMIT) ?? refuse()

  const blocks: VerifiedStudyCalendarBlock[] = []
  for (const entry of list) {
    const row = exactKeys(entry, VERIFIED_CALENDAR_BLOCK_KEYS) ?? refuse()
    const blockId = identifier(row.blockId) ?? refuse()
    const blockType = member(row.blockType, VERIFIED_STUDY_BLOCK_TYPES) ?? refuse()
    const sourceReference = identifier(row.sourceReference) ?? refuse()
    const scheduledStart = instant(row.scheduledStart) ?? refuse()
    const intendedLocalDate = localDate(row.intendedLocalDate) ?? refuse()
    const state = member(row.state, VERIFIED_STUDY_BLOCK_STATES) ?? refuse()
    const blockRevision = revision(row.revision) ?? refuse()
    blocks.push(Object.freeze({
      blockId,
      blockType,
      sourceReference,
      scheduledStart,
      intendedLocalDate,
      state,
      revision: blockRevision,
    }))
  }
  return Object.freeze({ blocks: Object.freeze(blocks) })
}

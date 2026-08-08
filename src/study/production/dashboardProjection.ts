/**
 * STUDY-PROD-DASH-PROJECTION-1 — production response projection for the two
 * read-only verified academic runtime operations that exist end to end today:
 * `dashboard:read` and `calendar:read`.
 *
 * The input is the `body` that `StudyIdentityClient.executeAcademicOperation`
 * returns, i.e. the value the browser receives from
 * `/api/study/academic-runtime` after the envelope check. It is typed `unknown`
 * there and is untrusted here: these decoders are total, they never throw on a
 * malformed response, and they never place an untrusted object into the value
 * they return.
 *
 * The shapes below are transcribed from the operation bodies built in
 * `public.academy_study_execute_verified_runtime_v1`
 * (supabase/migrations/20260801190000_academy_study_final_production_reconciliation.sql),
 * and the per-field constraints from the column definitions in
 * supabase/migrations/20260801010000_academy_study_engine_storage.sql.
 *
 * Nothing else is projected. The server selects `subject_id`, `duration_minutes`,
 * `completion_units` and `required_units` into its row sources but deliberately
 * does not put them in the response, so no title, subject, segment list or
 * completion percentage exists to project and none is synthesised here.
 *
 * These types are intentionally independent of the preview Study data contracts
 * in `../types` and `../ports`. They describe the wire, not a component's wish
 * list, and the two disagree materially — the preview calendar entry carries a
 * learner reference the server's own response guard would reject, and a
 * different set of state values.
 */

/* ------------------------------------------------------------------ *
 * Result
 * ------------------------------------------------------------------ */

export type StudyProductionProjectionFailureCode =
  | 'response-not-object'
  | 'response-keys-unexpected'
  | 'rows-not-array'
  | 'rows-over-limit'
  | 'row-not-object'
  | 'row-keys-unexpected'
  | 'identifier-invalid'
  | 'enumeration-invalid'
  | 'revision-invalid'
  | 'timestamp-invalid'
  | 'local-date-invalid'

export interface StudyProductionProjectionFailure {
  readonly ok: false
  readonly code: StudyProductionProjectionFailureCode
  /**
   * Where in the contract the response stopped being the contract, built only
   * from constant field names and the row index. It deliberately carries no
   * value from the payload, so a rejected response cannot smuggle server text
   * into a log, a message or application state through the failure itself.
   */
  readonly at: string
}

export interface StudyProductionProjectionSuccess<Value> {
  readonly ok: true
  readonly value: Value
}

export type StudyProductionProjectionResult<Value> =
  | StudyProductionProjectionSuccess<Value>
  | StudyProductionProjectionFailure

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

/** `academy_study_sessions.state` check constraint. */
export type VerifiedStudySessionState =
  | 'planned'
  | 'active'
  | 'paused'
  | 'approved_break'
  | 'student_requested_break'
  | 'technical_interruption'
  | 'completed'
  | 'abandoned'

/** `academy_study_calendar_blocks.block_type` check constraint. */
export type VerifiedStudyCalendarBlockType =
  | 'lesson'
  | 'review'
  | 'resume'
  | 'break'
  | 'assessment'

/** `academy_study_calendar_blocks.state` check constraint. */
export type VerifiedStudyCalendarBlockState =
  | 'scheduled'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

/** One row of the `dashboard:read` body. Every field is `not null` at source. */
export interface VerifiedStudyDashboardSessionView {
  readonly sessionId: string
  readonly state: VerifiedStudySessionState
  readonly lessonId: string
  readonly revision: number
  readonly updatedAt: string
}

export interface VerifiedStudyDashboardView {
  readonly sessions: readonly VerifiedStudyDashboardSessionView[]
}

/** One row of the `calendar:read` body. Every field is `not null` at source. */
export interface VerifiedStudyCalendarBlockView {
  readonly blockId: string
  readonly blockType: VerifiedStudyCalendarBlockType
  readonly sourceReference: string
  readonly scheduledStart: string
  readonly intendedLocalDate: string
  readonly state: VerifiedStudyCalendarBlockState
  readonly revision: number
}

export interface VerifiedStudyCalendarView {
  readonly blocks: readonly VerifiedStudyCalendarBlockView[]
}

/* ------------------------------------------------------------------ *
 * Wire vocabulary
 * ------------------------------------------------------------------ */

/**
 * Exact-wire discipline: a response is the contract or it is rejected. Extra
 * keys are a rejection, not something to ignore, which is the policy the
 * production Study clients already hold on both sides of this call —
 * `parseStudySessionGrant` and `parseVerifiedStudySession` count keys, the
 * academic-runtime envelope check requires exactly four, and the server itself
 * gates every request through `academy_study_json_has_exact_keys`. An
 * unrecognised key means the wire moved and this build no longer knows what it
 * is reading.
 */
function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** `academy_study_identifier_is_valid`, which also bounds the string at 160. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

/** Postgres renders a `timestamptz` into JSON in ISO 8601 with a real offset. */
const WIRE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/

/** Postgres renders a `date` into JSON as `YYYY-MM-DD`. */
const WIRE_LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/

const SESSION_STATES: ReadonlySet<string> = new Set([
  'planned', 'active', 'paused', 'approved_break',
  'student_requested_break', 'technical_interruption',
  'completed', 'abandoned',
])
const CALENDAR_BLOCK_TYPES: ReadonlySet<string> = new Set([
  'lesson', 'review', 'resume', 'break', 'assessment',
])
const CALENDAR_BLOCK_STATES: ReadonlySet<string> = new Set([
  'scheduled', 'available', 'in_progress', 'completed', 'cancelled',
])

const DASHBOARD_ROOT_KEYS = ['sessions']
const DASHBOARD_ROW_KEYS = ['sessionId', 'state', 'lessonId', 'revision', 'updatedAt']
const CALENDAR_ROOT_KEYS = ['blocks']
const CALENDAR_ROW_KEYS = [
  'blockId', 'blockType', 'sourceReference',
  'scheduledStart', 'intendedLocalDate', 'state', 'revision',
]

/** The `limit` the operation applies to its own row source. */
const DASHBOARD_ROW_LIMIT = 50
const CALENDAR_ROW_LIMIT = 100

function isIdentifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
}

function isSessionState(value: unknown): value is VerifiedStudySessionState {
  return typeof value === 'string' && SESSION_STATES.has(value)
}

function isCalendarBlockType(value: unknown): value is VerifiedStudyCalendarBlockType {
  return typeof value === 'string' && CALENDAR_BLOCK_TYPES.has(value)
}

function isCalendarBlockState(value: unknown): value is VerifiedStudyCalendarBlockState {
  return typeof value === 'string' && CALENDAR_BLOCK_STATES.has(value)
}

/**
 * `revision bigint not null check (revision > 0)`. A value past the safe integer
 * range has already lost precision in `JSON.parse`, so it is refused rather than
 * carried forward as a number that no longer equals what the server sent.
 */
function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * Format only. The string is validated and then kept exactly as the server sent
 * it; these decoders never reformat, normalise or convert a moment the server
 * owns, and never hand back a `Date`.
 */
function isWireTimestamp(value: unknown): value is string {
  return typeof value === 'string' &&
    WIRE_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value))
}

/** Format, plus a round trip that refuses a well-formed impossible day. */
function isWireLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !WIRE_LOCAL_DATE.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) && new Date(parsed).toISOString().startsWith(value)
}

function succeed<Value>(value: Value): StudyProductionProjectionSuccess<Value> {
  return Object.freeze({ ok: true, value })
}

function fail(
  code: StudyProductionProjectionFailureCode,
  at: string,
): StudyProductionProjectionFailure {
  return Object.freeze({ ok: false, code, at })
}

/* ------------------------------------------------------------------ *
 * Decoders
 * ------------------------------------------------------------------ */

function decodeDashboardSession(
  value: unknown,
  at: string,
): StudyProductionProjectionResult<VerifiedStudyDashboardSessionView> {
  if (!isRecord(value)) return fail('row-not-object', at)
  if (!hasExactKeys(value, DASHBOARD_ROW_KEYS)) return fail('row-keys-unexpected', at)
  const { sessionId, state, lessonId, revision, updatedAt } = value
  if (!isIdentifier(sessionId)) return fail('identifier-invalid', `${at}.sessionId`)
  if (!isSessionState(state)) return fail('enumeration-invalid', `${at}.state`)
  if (!isIdentifier(lessonId)) return fail('identifier-invalid', `${at}.lessonId`)
  if (!isRevision(revision)) return fail('revision-invalid', `${at}.revision`)
  if (!isWireTimestamp(updatedAt)) return fail('timestamp-invalid', `${at}.updatedAt`)
  // Rebuilt field by field. The untrusted row is never spread, aliased or cast.
  return succeed(Object.freeze({ sessionId, state, lessonId, revision, updatedAt }))
}

function decodeCalendarBlock(
  value: unknown,
  at: string,
): StudyProductionProjectionResult<VerifiedStudyCalendarBlockView> {
  if (!isRecord(value)) return fail('row-not-object', at)
  if (!hasExactKeys(value, CALENDAR_ROW_KEYS)) return fail('row-keys-unexpected', at)
  const {
    blockId, blockType, sourceReference,
    scheduledStart, intendedLocalDate, state, revision,
  } = value
  if (!isIdentifier(blockId)) return fail('identifier-invalid', `${at}.blockId`)
  if (!isCalendarBlockType(blockType)) return fail('enumeration-invalid', `${at}.blockType`)
  if (!isIdentifier(sourceReference)) return fail('identifier-invalid', `${at}.sourceReference`)
  if (!isWireTimestamp(scheduledStart)) return fail('timestamp-invalid', `${at}.scheduledStart`)
  if (!isWireLocalDate(intendedLocalDate)) return fail('local-date-invalid', `${at}.intendedLocalDate`)
  if (!isCalendarBlockState(state)) return fail('enumeration-invalid', `${at}.state`)
  if (!isRevision(revision)) return fail('revision-invalid', `${at}.revision`)
  return succeed(Object.freeze({
    blockId, blockType, sourceReference,
    scheduledStart, intendedLocalDate, state, revision,
  }))
}

/**
 * Projects the `dashboard:read` body. The operation always builds its root key,
 * falling back to an empty array, so an absent `sessions` is a broken response
 * rather than an empty dashboard.
 */
export function decodeVerifiedStudyDashboardResponse(
  value: unknown,
): StudyProductionProjectionResult<VerifiedStudyDashboardView> {
  if (!isRecord(value)) return fail('response-not-object', 'body')
  if (!hasExactKeys(value, DASHBOARD_ROOT_KEYS)) return fail('response-keys-unexpected', 'body')
  const rows = value.sessions
  if (!Array.isArray(rows)) return fail('rows-not-array', 'body.sessions')
  if (rows.length > DASHBOARD_ROW_LIMIT) return fail('rows-over-limit', 'body.sessions')
  const sessions: VerifiedStudyDashboardSessionView[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = decodeDashboardSession(rows[index], `body.sessions[${index}]`)
    if (!row.ok) return row
    sessions.push(row.value)
  }
  return succeed(Object.freeze({ sessions: Object.freeze(sessions) }))
}

/** Projects the `calendar:read` body, on the same terms. */
export function decodeVerifiedStudyCalendarResponse(
  value: unknown,
): StudyProductionProjectionResult<VerifiedStudyCalendarView> {
  if (!isRecord(value)) return fail('response-not-object', 'body')
  if (!hasExactKeys(value, CALENDAR_ROOT_KEYS)) return fail('response-keys-unexpected', 'body')
  const rows = value.blocks
  if (!Array.isArray(rows)) return fail('rows-not-array', 'body.blocks')
  if (rows.length > CALENDAR_ROW_LIMIT) return fail('rows-over-limit', 'body.blocks')
  const blocks: VerifiedStudyCalendarBlockView[] = []
  for (let index = 0; index < rows.length; index += 1) {
    const row = decodeCalendarBlock(rows[index], `body.blocks[${index}]`)
    if (!row.ok) return row
    blocks.push(row.value)
  }
  return succeed(Object.freeze({ blocks: Object.freeze(blocks) }))
}

/**
 * ADMIN-2 implementation of ADMIN-0-R1 contract version 2.
 *
 * These values intentionally match commit 73693f9e12a4a02546a4245bfea71143262e2df9.
 * The integration branch can replace these declarations with imports from
 * `src/admin/contracts` once the sibling ADMIN-0 commit is present.
 */
export const ADMIN_CONTRACT_VERSION = 2 as const

export const ADMIN_ENGINE_IDS = [
  'tutor',
  'study',
  'assessment',
  'curriculum',
  'jarvis',
  'tts',
  'gateway',
  'sync',
] as const

export const ADMIN_OPERATIONAL_RESULTS = [
  'success',
  'fallback',
  'rejected',
  'timeout',
  'provider_error',
  'validation_error',
  'safety_stop',
] as const

export const ADMIN_TELEMETRY_EVENT_TYPES = [
  'tutor.turn',
  'study.session',
  'assessment.attempt',
  'curriculum.load',
  'jarvis.turn',
  'tts.synthesis',
  'gateway.request',
  'sync.operation',
  'safety.classification',
  'persistence.operation',
] as const

export const ADMIN_TELEMETRY_METADATA_KEYS = [
  'attempt',
  'cache_hit',
  'failure_stage',
  'feature_flag',
  'http_status',
  'operation',
  'provider',
  'reason_code',
  'retryable',
  'route',
  'severity',
  'source',
  'voice_ref',
] as const

export const ADMIN_PROHIBITED_TELEMETRY_FIELDS = [
  'messages',
  'conversation',
  'transcript',
  'prompt',
  'response',
  'student_audio',
  'audio',
  'emotional_label',
  'emotion',
  'personality_judgment',
  'diagnostic_inference',
  'assessment_answer',
  'answer_content',
  'raw_answer',
] as const
export type AdminProhibitedTelemetryField =
  (typeof ADMIN_PROHIBITED_TELEMETRY_FIELDS)[number]

export const OPERATIONAL_TELEMETRY_MAX_DURATION_MS = 86_400_000
export const OPERATIONAL_TELEMETRY_MAX_METADATA_BYTES = 2_048
export const OPERATIONAL_TELEMETRY_MAX_METADATA_STRING_LENGTH = 128
export const OPERATIONAL_TELEMETRY_MAX_READ_LIMIT = 500

export const OPERATIONAL_RETENTION_CATEGORIES = [
  'diagnostic_short',
  'operational_standard',
  'safety_extended',
] as const

export type AdminEngineId = (typeof ADMIN_ENGINE_IDS)[number]
export type AdminOperationalResult = (typeof ADMIN_OPERATIONAL_RESULTS)[number]
export type AdminTelemetryEventType = (typeof ADMIN_TELEMETRY_EVENT_TYPES)[number]
export type AdminTelemetryMetadataKey =
  (typeof ADMIN_TELEMETRY_METADATA_KEYS)[number]
export type AdminTelemetryMetadataValue = string | number | boolean | null
export type AdminTelemetryMetadata = Readonly<
  Partial<Record<AdminTelemetryMetadataKey, AdminTelemetryMetadataValue>>
>
export type OperationalRetentionCategory =
  (typeof OPERATIONAL_RETENTION_CATEGORIES)[number]

export interface AdminVersionSnapshot {
  readonly appVersion: string
  readonly engineVersion: string
  readonly curriculumVersion: string | null
}

interface AdminOperationalEventBase extends AdminVersionSnapshot {
  readonly schemaVersion: typeof ADMIN_CONTRACT_VERSION
  readonly eventId: string
  readonly occurredAt: string
  readonly engine: AdminEngineId
  readonly courseRef: string | null
  readonly unitRef: string | null
  readonly lessonRef: string | null
  readonly skillRef: string | null
  readonly eventType: AdminTelemetryEventType
  readonly result: AdminOperationalResult
  readonly durationMs: number | null
  readonly metadata: AdminTelemetryMetadata
}

export interface AdminHouseholdOperationalEvent extends AdminOperationalEventBase {
  readonly scope: 'household'
  readonly householdRef: string
  readonly learnerRef: string | null
}

export interface AdminSystemOperationalEvent extends AdminOperationalEventBase {
  readonly scope: 'system'
  readonly householdRef: null
  readonly learnerRef: null
}

export type AdminOperationalEvent =
  | AdminHouseholdOperationalEvent
  | AdminSystemOperationalEvent

interface TrustedOperationalEventInputBase extends AdminVersionSnapshot {
  /** Stable server-derived execution key. It is not the durable event ID. */
  readonly executionKey: string
  readonly engine: AdminEngineId
  readonly courseRef: string | null
  readonly unitRef: string | null
  readonly lessonRef: string | null
  readonly skillRef: string | null
  readonly eventType: AdminTelemetryEventType
  readonly result: AdminOperationalResult
  readonly durationMs: number | null
  readonly metadata: AdminTelemetryMetadata
}

export type TrustedOperationalEventInput =
  | (TrustedOperationalEventInputBase & {
      readonly scope: 'household'
      readonly householdRef: string
      readonly learnerRef: string | null
    })
  | (TrustedOperationalEventInputBase & {
      readonly scope: 'system'
      readonly householdRef: null
      readonly learnerRef: null
    })

export type AcceptedOperationalEventFacts = Omit<
  AdminOperationalEvent,
  'eventId' | 'occurredAt'
>

export type OperationalTelemetryValidationCode =
  | 'telemetry_input_invalid'
  | 'telemetry_field_not_allowed'
  | 'telemetry_prohibited_field'
  | 'telemetry_execution_key_invalid'
  | 'telemetry_event_id_invalid'
  | 'telemetry_occurred_at_invalid'
  | 'telemetry_scope_invalid'
  | 'telemetry_household_ref_invalid'
  | 'telemetry_learner_ref_invalid'
  | 'telemetry_engine_invalid'
  | 'telemetry_app_version_invalid'
  | 'telemetry_engine_version_invalid'
  | 'telemetry_curriculum_version_invalid'
  | 'telemetry_result_invalid'
  | 'telemetry_event_type_invalid'
  | 'telemetry_event_engine_mismatch'
  | 'telemetry_duration_invalid'
  | 'telemetry_reference_invalid'
  | 'telemetry_metadata_invalid'
  | 'telemetry_metadata_too_large'
  | 'telemetry_metadata_field_not_allowed'
  | 'telemetry_metadata_value_invalid'
  | 'telemetry_stored_value_invalid'
  | 'telemetry_read_authorization_invalid'
  | 'telemetry_read_filter_invalid'

export class OperationalTelemetryValidationError extends Error {
  constructor(readonly code: OperationalTelemetryValidationCode) {
    super(code)
    this.name = 'OperationalTelemetryValidationError'
  }
}

const INPUT_FIELDS = new Set([
  'appVersion',
  'courseRef',
  'curriculumVersion',
  'durationMs',
  'engine',
  'engineVersion',
  'eventType',
  'executionKey',
  'householdRef',
  'learnerRef',
  'lessonRef',
  'metadata',
  'result',
  'scope',
  'skillRef',
  'unitRef',
])

const STORED_FIELDS = new Set([
  ...INPUT_FIELDS,
  'eventId',
  'occurredAt',
  'schemaVersion',
])
STORED_FIELDS.delete('executionKey')

const METADATA_KEYS = new Set<string>(ADMIN_TELEMETRY_METADATA_KEYS)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const SAFE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const PROHIBITED_FIELD = /(?:raw|messages?|conversation|transcript|prompt|response|audio|speech|emotion|personality|psycholog|diagnos|answer|journal|secret|credential|bearer|token|password|api.?key|contact|email|phone|protected.?work|body|content)/i
const SECRET_LIKE_VALUE = /(?:^|[._:-])(?:sk|pk|secret|credential|bearer|token|password|jwt|api.?key)(?:[._:-]|$)/i

const eventEngines: Readonly<Record<AdminTelemetryEventType, ReadonlySet<AdminEngineId>>> = {
  'tutor.turn': new Set(['tutor']),
  'study.session': new Set(['study']),
  'assessment.attempt': new Set(['assessment']),
  'curriculum.load': new Set(['curriculum']),
  'jarvis.turn': new Set(['jarvis']),
  'tts.synthesis': new Set(['tts']),
  'gateway.request': new Set(['gateway']),
  'sync.operation': new Set(['sync']),
  'safety.classification': new Set([
    'tutor',
    'study',
    'assessment',
    'jarvis',
    'gateway',
  ]),
  'persistence.operation': new Set(ADMIN_ENGINE_IDS),
}

type PlainRecord = Record<string, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactFields(value: PlainRecord, fields: ReadonlySet<string>): void {
  for (const field of Object.keys(value)) {
    if (fields.has(field)) continue
    if (PROHIBITED_FIELD.test(field)) {
      throw new OperationalTelemetryValidationError('telemetry_prohibited_field')
    }
    throw new OperationalTelemetryValidationError('telemetry_field_not_allowed')
  }
  if ([...fields].some((field) => !Object.hasOwn(value, field))) {
    throw new OperationalTelemetryValidationError('telemetry_input_invalid')
  }
}

function requiredUuid(value: unknown, code: OperationalTelemetryValidationCode): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new OperationalTelemetryValidationError(code)
  }
  return value.toLowerCase()
}

function optionalUuid(value: unknown): string | null {
  if (value === null) return null
  return requiredUuid(value, 'telemetry_learner_ref_invalid')
}

function instant(value: unknown): string {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new OperationalTelemetryValidationError('telemetry_occurred_at_invalid')
  }
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new OperationalTelemetryValidationError('telemetry_occurred_at_invalid')
  }
  return value
}

function requiredVersion(
  value: unknown,
  code: 'telemetry_app_version_invalid' | 'telemetry_engine_version_invalid',
): string {
  if (typeof value !== 'string' || !SAFE_VERSION.test(value)) {
    throw new OperationalTelemetryValidationError(code)
  }
  return value
}

function curriculumVersion(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !SAFE_VERSION.test(value)) {
    throw new OperationalTelemetryValidationError('telemetry_curriculum_version_invalid')
  }
  return value
}

function reference(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !SAFE_REFERENCE.test(value)) {
    throw new OperationalTelemetryValidationError('telemetry_reference_invalid')
  }
  return value
}

function duration(value: unknown): number | null {
  if (value === null) return null
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
    || value > OPERATIONAL_TELEMETRY_MAX_DURATION_MS
  ) {
    throw new OperationalTelemetryValidationError('telemetry_duration_invalid')
  }
  return value
}

function metadataToken(value: string): string {
  if (
    value.length > OPERATIONAL_TELEMETRY_MAX_METADATA_STRING_LENGTH
    || !SAFE_TOKEN.test(value)
    || SECRET_LIKE_VALUE.test(value)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
  }
  return value
}

function normalizedMetadata(value: unknown): AdminTelemetryMetadata {
  if (!isPlainRecord(value)) {
    throw new OperationalTelemetryValidationError('telemetry_metadata_invalid')
  }
  if (
    new TextEncoder().encode(JSON.stringify(value)).byteLength
      > OPERATIONAL_TELEMETRY_MAX_METADATA_BYTES
  ) {
    throw new OperationalTelemetryValidationError('telemetry_metadata_too_large')
  }
  const result: Record<string, AdminTelemetryMetadataValue> = {}
  for (const [key, candidate] of Object.entries(value)) {
    if (PROHIBITED_FIELD.test(key)) {
      throw new OperationalTelemetryValidationError('telemetry_prohibited_field')
    }
    if (!METADATA_KEYS.has(key)) {
      throw new OperationalTelemetryValidationError(
        'telemetry_metadata_field_not_allowed',
      )
    }
    if (candidate === null) {
      result[key] = null
    } else if (key === 'attempt') {
      if (!Number.isSafeInteger(candidate) || (candidate as number) < 0) {
        throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
      }
      result[key] = candidate as number
    } else if (key === 'http_status') {
      if (!Number.isSafeInteger(candidate) || (candidate as number) < 100 || (candidate as number) > 599) {
        throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
      }
      result[key] = candidate as number
    } else if (key === 'cache_hit' || key === 'retryable') {
      if (typeof candidate !== 'boolean') {
        throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
      }
      result[key] = candidate
    } else {
      if (typeof candidate !== 'string') {
        throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
      }
      const token = metadataToken(candidate)
      if (key === 'severity' && !['info', 'warning', 'error', 'critical'].includes(token)) {
        throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
      }
      result[key] = token
    }
  }
  return Object.freeze(result)
}

function normalizedFacts(value: PlainRecord): AcceptedOperationalEventFacts {
  if (value.scope !== 'household' && value.scope !== 'system') {
    throw new OperationalTelemetryValidationError('telemetry_scope_invalid')
  }
  const scope = value.scope
  const householdRef = scope === 'household'
    ? requiredUuid(value.householdRef, 'telemetry_household_ref_invalid')
    : value.householdRef === null
      ? null
      : (() => {
          throw new OperationalTelemetryValidationError('telemetry_household_ref_invalid')
        })()
  const learnerRef = scope === 'household'
    ? optionalUuid(value.learnerRef)
    : value.learnerRef === null
      ? null
      : (() => {
          throw new OperationalTelemetryValidationError('telemetry_learner_ref_invalid')
        })()

  if (
    typeof value.engine !== 'string'
    || !ADMIN_ENGINE_IDS.includes(value.engine as AdminEngineId)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_engine_invalid')
  }
  const engine = value.engine as AdminEngineId
  if (
    typeof value.eventType !== 'string'
    || !ADMIN_TELEMETRY_EVENT_TYPES.includes(value.eventType as AdminTelemetryEventType)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_event_type_invalid')
  }
  const eventType = value.eventType as AdminTelemetryEventType
  if (!eventEngines[eventType].has(engine)) {
    throw new OperationalTelemetryValidationError('telemetry_event_engine_mismatch')
  }
  if (
    typeof value.result !== 'string'
    || !ADMIN_OPERATIONAL_RESULTS.includes(value.result as AdminOperationalResult)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_result_invalid')
  }

  const normalizedCurriculumVersion = curriculumVersion(value.curriculumVersion)
  const courseRef = reference(value.courseRef)
  const unitRef = reference(value.unitRef)
  const lessonRef = reference(value.lessonRef)
  const skillRef = reference(value.skillRef)
  if (
    (eventType === 'curriculum.load'
      || [courseRef, unitRef, lessonRef, skillRef].some((candidate) => candidate !== null))
    && normalizedCurriculumVersion === null
  ) {
    throw new OperationalTelemetryValidationError('telemetry_curriculum_version_invalid')
  }

  const base = {
    schemaVersion: ADMIN_CONTRACT_VERSION,
    engine,
    appVersion: requiredVersion(value.appVersion, 'telemetry_app_version_invalid'),
    engineVersion: requiredVersion(
      value.engineVersion,
      'telemetry_engine_version_invalid',
    ),
    curriculumVersion: normalizedCurriculumVersion,
    courseRef,
    unitRef,
    lessonRef,
    skillRef,
    eventType,
    result: value.result as AdminOperationalResult,
    durationMs: duration(value.durationMs),
    metadata: normalizedMetadata(value.metadata),
  }

  return scope === 'household'
    ? Object.freeze({ ...base, scope, householdRef: householdRef as string, learnerRef })
    : Object.freeze({ ...base, scope, householdRef: null, learnerRef: null })
}

export function validateTrustedOperationalEventInput(
  input: TrustedOperationalEventInput,
): { readonly executionKey: string; readonly facts: AcceptedOperationalEventFacts } {
  if (!isPlainRecord(input)) {
    throw new OperationalTelemetryValidationError('telemetry_input_invalid')
  }
  assertExactFields(input, INPUT_FIELDS)
  if (typeof input.executionKey !== 'string' || !SAFE_REFERENCE.test(input.executionKey)) {
    throw new OperationalTelemetryValidationError('telemetry_execution_key_invalid')
  }
  return Object.freeze({
    executionKey: input.executionKey,
    facts: normalizedFacts(input),
  })
}

function normalizedStoredEvent(value: unknown): AdminOperationalEvent {
  if (!isPlainRecord(value)) {
    throw new OperationalTelemetryValidationError('telemetry_stored_value_invalid')
  }
  assertExactFields(value, STORED_FIELDS)
  if (value.schemaVersion !== ADMIN_CONTRACT_VERSION) {
    throw new OperationalTelemetryValidationError('telemetry_stored_value_invalid')
  }
  const facts = normalizedFacts(value)
  const eventId = requiredUuid(value.eventId, 'telemetry_event_id_invalid')
  const occurredAt = instant(value.occurredAt)
  return Object.freeze({ ...facts, eventId, occurredAt }) as AdminOperationalEvent
}

export interface OperationalTelemetryReadAuthorization {
  readonly kind: 'server-resolved-admin'
  readonly capability: 'engines:read'
}

export interface OperationalTelemetryReadFilter {
  readonly scope: 'household' | 'system' | null
  readonly householdRef: string | null
  readonly learnerRef: string | null
  readonly limit: number
}

export type OperationalTelemetryAppendResult =
  | {
      readonly status: 'created' | 'replayed'
      readonly event: AdminOperationalEvent
    }
  | { readonly status: 'reconciliation_conflict' }

export interface OperationalTelemetryStore {
  append(
    executionKey: string,
    facts: AcceptedOperationalEventFacts,
  ): Promise<OperationalTelemetryAppendResult>
  list(
    filter: OperationalTelemetryReadFilter,
    authorization: OperationalTelemetryReadAuthorization,
  ): Promise<unknown>
}

export interface OperationalTelemetryFailureNotice {
  readonly code: 'telemetry_persistence_failed'
  readonly engine: AdminEngineId
  readonly eventType: AdminTelemetryEventType
  readonly executionKey: string
}

export interface OperationalTelemetryDependencies {
  readonly store: OperationalTelemetryStore
  readonly onPersistenceFailure?: (
    notice: OperationalTelemetryFailureNotice,
  ) => void | Promise<void>
}

export interface DecodedOperationalEvents {
  readonly events: readonly AdminOperationalEvent[]
  readonly rejectedRows: number
}

export function decodeStoredOperationalEvents(value: unknown): DecodedOperationalEvents {
  if (!Array.isArray(value)) return Object.freeze({ events: [], rejectedRows: 1 })
  const events: AdminOperationalEvent[] = []
  let rejectedRows = 0
  for (const candidate of value) {
    try {
      events.push(normalizedStoredEvent(candidate))
    } catch {
      rejectedRows += 1
    }
  }
  return Object.freeze({ events: Object.freeze(events), rejectedRows })
}

function normalizedAuthorization(
  authorization: OperationalTelemetryReadAuthorization,
): OperationalTelemetryReadAuthorization {
  if (
    !isPlainRecord(authorization)
    || Object.keys(authorization).length !== 2
    || authorization.kind !== 'server-resolved-admin'
    || authorization.capability !== 'engines:read'
  ) {
    throw new OperationalTelemetryValidationError(
      'telemetry_read_authorization_invalid',
    )
  }
  return Object.freeze({
    kind: 'server-resolved-admin',
    capability: 'engines:read',
  })
}

function normalizedReadFilter(
  filter: OperationalTelemetryReadFilter,
): OperationalTelemetryReadFilter {
  if (!isPlainRecord(filter)) {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  const fields = new Set(['scope', 'householdRef', 'learnerRef', 'limit'])
  assertExactFields(filter, fields)
  if (filter.scope !== null && filter.scope !== 'household' && filter.scope !== 'system') {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  if (
    !Number.isSafeInteger(filter.limit)
    || filter.limit < 1
    || filter.limit > OPERATIONAL_TELEMETRY_MAX_READ_LIMIT
  ) {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  const householdRef = filter.householdRef === null
    ? null
    : requiredUuid(filter.householdRef, 'telemetry_household_ref_invalid')
  const learnerRef = filter.learnerRef === null
    ? null
    : requiredUuid(filter.learnerRef, 'telemetry_learner_ref_invalid')
  if (
    (filter.scope === 'system' && (householdRef !== null || learnerRef !== null))
    || (learnerRef !== null && householdRef === null)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  return Object.freeze({ scope: filter.scope, householdRef, learnerRef, limit: filter.limit })
}

/**
 * Telemetry is observational. Unsafe facts are rejected before dispatch;
 * persistence failure never rolls back a successful learner action. Safety,
 * protected persistence, and administrative audit keep their stricter rails.
 */
export function createOperationalTelemetry(dependencies: OperationalTelemetryDependencies) {
  async function record(input: TrustedOperationalEventInput): Promise<
    | { readonly status: 'recorded' | 'replayed'; readonly event: AdminOperationalEvent }
    | { readonly status: 'reconciliation_conflict' }
    | { readonly status: 'not-recorded'; readonly executionKey: string }
  > {
    const validated = validateTrustedOperationalEventInput(input)
    try {
      const result = await dependencies.store.append(
        validated.executionKey,
        validated.facts,
      )
      if (result.status === 'reconciliation_conflict') {
        return Object.freeze({ status: 'reconciliation_conflict' })
      }
      return Object.freeze({
        status: result.status === 'created' ? 'recorded' : 'replayed',
        event: result.event,
      })
    } catch {
      const notice = Object.freeze({
        code: 'telemetry_persistence_failed' as const,
        engine: validated.facts.engine,
        eventType: validated.facts.eventType,
        executionKey: validated.executionKey,
      })
      try {
        await dependencies.onPersistenceFailure?.(notice)
      } catch {
        // Failure reporting is observational too.
      }
      return Object.freeze({
        status: 'not-recorded',
        executionKey: validated.executionKey,
      })
    }
  }

  async function list(
    filter: OperationalTelemetryReadFilter,
    authorization: OperationalTelemetryReadAuthorization,
  ): Promise<DecodedOperationalEvents> {
    return decodeStoredOperationalEvents(
      await dependencies.store.list(
        normalizedReadFilter(filter),
        normalizedAuthorization(authorization),
      ),
    )
  }

  return Object.freeze({ list, record })
}

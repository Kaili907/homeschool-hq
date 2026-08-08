export const OPERATIONAL_TELEMETRY_SCHEMA_VERSION = 1 as const
export const OPERATIONAL_TELEMETRY_MAX_DURATION_MS = 86_400_000
export const OPERATIONAL_TELEMETRY_MAX_READ_LIMIT = 500

export const OPERATIONAL_ENGINES = [
  'study',
  'tutor',
  'assessment',
  'sync',
  'application',
  'infrastructure',
] as const

export const OPERATIONAL_RESULTS = [
  'success',
  'failure',
  'cancelled',
  'rejected',
  'timeout',
  'unavailable',
  'duplicate',
] as const

export type OperationalEngine = (typeof OPERATIONAL_ENGINES)[number]
export type OperationalResult = (typeof OPERATIONAL_RESULTS)[number]

type SessionLifecycleMetadata = {
  readonly phase: 'launched' | 'paused' | 'resumed' | 'completed' | 'stopped'
}

type PersistenceOperationMetadata = {
  readonly operation: 'learner-state' | 'checkpoint' | 'event-ledger' | 'sync-state'
  readonly retryable: boolean
}

type SyncLifecycleMetadata = {
  readonly phase: 'started' | 'completed' | 'conflict' | 'recovered'
  readonly direction: 'push' | 'pull' | 'bidirectional'
}

type SafetyDecisionMetadata = {
  readonly decision: 'clear' | 'stop' | 'uncertain' | 'invalid'
}

type AssessmentLifecycleMetadata = {
  readonly phase: 'started' | 'submitted' | 'completed' | 'abandoned'
}

type ApplicationLifecycleMetadata = {
  readonly phase: 'started' | 'ready' | 'backgrounded' | 'stopped'
}

type InfrastructureHealthMetadata = {
  readonly component: 'database' | 'network' | 'study-worker' | 'sync-worker'
  readonly state: 'healthy' | 'degraded' | 'unavailable'
}

export interface OperationalEventContext {
  readonly applicationVersion?: string | null
  readonly curriculumVersion?: string | null
  readonly courseRef?: string | null
  readonly unitRef?: string | null
  readonly lessonRef?: string | null
  readonly skillRef?: string | null
}

interface OperationalEventBase extends OperationalEventContext {
  readonly eventId?: string
  readonly occurredAt?: string
  readonly householdRef: string
  readonly engineVersion: string
  readonly result: OperationalResult
  readonly durationMs?: number | null
}

export type OperationalEventInput =
  | (OperationalEventBase & {
      readonly learnerRef: string
      readonly engine: 'study' | 'tutor'
      readonly eventType: 'session.lifecycle'
      readonly metadata: SessionLifecycleMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef?: string | null
      readonly engine: OperationalEngine
      readonly eventType: 'persistence.operation'
      readonly metadata: PersistenceOperationMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef?: string | null
      readonly engine: 'sync'
      readonly eventType: 'sync.lifecycle'
      readonly metadata: SyncLifecycleMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef: string
      readonly engine: 'study' | 'tutor'
      readonly eventType: 'safety.decision'
      readonly metadata: SafetyDecisionMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef: string
      readonly engine: 'assessment'
      readonly eventType: 'assessment.lifecycle'
      readonly metadata: AssessmentLifecycleMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef?: string | null
      readonly engine: 'application'
      readonly eventType: 'application.lifecycle'
      readonly metadata: ApplicationLifecycleMetadata
    })
  | (OperationalEventBase & {
      readonly learnerRef?: null
      readonly engine: 'infrastructure'
      readonly eventType: 'infrastructure.health'
      readonly metadata: InfrastructureHealthMetadata
    })

export type OperationalEventType = OperationalEventInput['eventType']

export type OperationalEvent = OperationalEventInput & {
  readonly schemaVersion: typeof OPERATIONAL_TELEMETRY_SCHEMA_VERSION
  readonly eventId: string
  readonly occurredAt: string
  readonly learnerRef: string | null
  readonly applicationVersion: string | null
  readonly curriculumVersion: string | null
  readonly courseRef: string | null
  readonly unitRef: string | null
  readonly lessonRef: string | null
  readonly skillRef: string | null
  readonly durationMs: number | null
}

export type OperationalTelemetryValidationCode =
  | 'telemetry_input_invalid'
  | 'telemetry_field_not_allowed'
  | 'telemetry_prohibited_field'
  | 'telemetry_event_id_invalid'
  | 'telemetry_occurred_at_invalid'
  | 'telemetry_household_ref_invalid'
  | 'telemetry_learner_ref_invalid'
  | 'telemetry_engine_invalid'
  | 'telemetry_engine_version_invalid'
  | 'telemetry_result_invalid'
  | 'telemetry_event_type_invalid'
  | 'telemetry_event_engine_mismatch'
  | 'telemetry_learner_scope_invalid'
  | 'telemetry_duration_invalid'
  | 'telemetry_version_invalid'
  | 'telemetry_reference_invalid'
  | 'telemetry_metadata_invalid'
  | 'telemetry_metadata_too_large'
  | 'telemetry_metadata_field_not_allowed'
  | 'telemetry_metadata_value_invalid'
  | 'telemetry_stored_value_invalid'
  | 'telemetry_read_filter_invalid'

export class OperationalTelemetryValidationError extends Error {
  constructor(readonly code: OperationalTelemetryValidationCode) {
    super(code)
    this.name = 'OperationalTelemetryValidationError'
  }
}

const INPUT_FIELDS = new Set([
  'applicationVersion',
  'courseRef',
  'curriculumVersion',
  'durationMs',
  'engine',
  'engineVersion',
  'eventId',
  'eventType',
  'householdRef',
  'learnerRef',
  'lessonRef',
  'metadata',
  'occurredAt',
  'result',
  'skillRef',
  'unitRef',
])

const STORED_FIELDS = new Set([...INPUT_FIELDS, 'schemaVersion'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const PROHIBITED_FIELD = /(?:raw|conversation|transcript|prompt|response|audio|speech|emotion|personality|psycholog|diagnos|answer|journal|message|body|content)/i

const metadataRules = {
  'session.lifecycle': {
    engines: new Set<OperationalEngine>(['study', 'tutor']),
    learner: 'required',
    values: {
      phase: new Set(['launched', 'paused', 'resumed', 'completed', 'stopped']),
    },
  },
  'persistence.operation': {
    engines: new Set<OperationalEngine>(OPERATIONAL_ENGINES),
    learner: 'optional',
    values: {
      operation: new Set(['learner-state', 'checkpoint', 'event-ledger', 'sync-state']),
      retryable: 'boolean',
    },
  },
  'sync.lifecycle': {
    engines: new Set<OperationalEngine>(['sync']),
    learner: 'optional',
    values: {
      phase: new Set(['started', 'completed', 'conflict', 'recovered']),
      direction: new Set(['push', 'pull', 'bidirectional']),
    },
  },
  'safety.decision': {
    engines: new Set<OperationalEngine>(['study', 'tutor']),
    learner: 'required',
    values: { decision: new Set(['clear', 'stop', 'uncertain', 'invalid']) },
  },
  'assessment.lifecycle': {
    engines: new Set<OperationalEngine>(['assessment']),
    learner: 'required',
    values: { phase: new Set(['started', 'submitted', 'completed', 'abandoned']) },
  },
  'application.lifecycle': {
    engines: new Set<OperationalEngine>(['application']),
    learner: 'optional',
    values: { phase: new Set(['started', 'ready', 'backgrounded', 'stopped']) },
  },
  'infrastructure.health': {
    engines: new Set<OperationalEngine>(['infrastructure']),
    learner: 'forbidden',
    values: {
      component: new Set(['database', 'network', 'study-worker', 'sync-worker']),
      state: new Set(['healthy', 'degraded', 'unavailable']),
    },
  },
} as const

type PlainRecord = Record<string, unknown>

function isPlainRecord(value: unknown): value is PlainRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function assertExactFields(
  value: PlainRecord,
  fields: ReadonlySet<string>,
): void {
  for (const field of Object.keys(value)) {
    if (fields.has(field)) continue
    if (PROHIBITED_FIELD.test(field)) {
      throw new OperationalTelemetryValidationError('telemetry_prohibited_field')
    }
    throw new OperationalTelemetryValidationError('telemetry_field_not_allowed')
  }
}

function requiredUuid(value: unknown, code: OperationalTelemetryValidationCode): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new OperationalTelemetryValidationError(code)
  }
  return value.toLowerCase()
}

function optionalUuid(value: unknown): string | null {
  if (value === undefined || value === null) return null
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

function version(value: unknown, required: boolean): string | null {
  if (value === undefined || value === null) {
    if (required) {
      throw new OperationalTelemetryValidationError('telemetry_engine_version_invalid')
    }
    return null
  }
  if (typeof value !== 'string' || !SAFE_VERSION.test(value)) {
    throw new OperationalTelemetryValidationError(
      required ? 'telemetry_engine_version_invalid' : 'telemetry_version_invalid',
    )
  }
  return value
}

function reference(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !SAFE_REFERENCE.test(value)) {
    throw new OperationalTelemetryValidationError('telemetry_reference_invalid')
  }
  return value
}

function duration(value: unknown): number | null {
  if (value === undefined || value === null) return null
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

function metadata(
  eventType: OperationalEventType,
  value: unknown,
): Readonly<Record<string, string | boolean>> {
  if (!isPlainRecord(value)) {
    throw new OperationalTelemetryValidationError('telemetry_metadata_invalid')
  }
  if (JSON.stringify(value).length > 512) {
    throw new OperationalTelemetryValidationError('telemetry_metadata_too_large')
  }
  const rules = metadataRules[eventType].values as Record<
    string,
    ReadonlySet<string> | 'boolean'
  >
  const expected = Object.keys(rules).sort()
  const actual = Object.keys(value).sort()
  for (const field of actual) {
    if (PROHIBITED_FIELD.test(field)) {
      throw new OperationalTelemetryValidationError('telemetry_prohibited_field')
    }
  }
  if (
    expected.length !== actual.length
    || expected.some((field, index) => field !== actual[index])
  ) {
    throw new OperationalTelemetryValidationError(
      'telemetry_metadata_field_not_allowed',
    )
  }
  for (const field of expected) {
    const rule = rules[field]
    const candidate = value[field]
    if (
      (rule === 'boolean' && typeof candidate !== 'boolean')
      || (rule !== 'boolean' && !rule.has(candidate as string))
    ) {
      throw new OperationalTelemetryValidationError('telemetry_metadata_value_invalid')
    }
  }
  return Object.freeze({ ...value }) as Readonly<Record<string, string | boolean>>
}

function eventType(value: unknown): OperationalEventType {
  if (typeof value !== 'string' || !(value in metadataRules)) {
    throw new OperationalTelemetryValidationError('telemetry_event_type_invalid')
  }
  return value as OperationalEventType
}

function normalizedEvent(
  input: unknown,
  dependencies: Pick<OperationalTelemetryDependencies, 'now' | 'randomUuid'> = {},
  stored = false,
): OperationalEvent {
  if (!isPlainRecord(input)) {
    throw new OperationalTelemetryValidationError('telemetry_input_invalid')
  }
  assertExactFields(input, stored ? STORED_FIELDS : INPUT_FIELDS)
  if (
    stored
    && input.schemaVersion !== OPERATIONAL_TELEMETRY_SCHEMA_VERSION
  ) {
    throw new OperationalTelemetryValidationError('telemetry_stored_value_invalid')
  }

  const type = eventType(input.eventType)
  if (
    typeof input.engine !== 'string'
    || !OPERATIONAL_ENGINES.includes(input.engine as OperationalEngine)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_engine_invalid')
  }
  const engine = input.engine as OperationalEngine
  const rules = metadataRules[type]
  if (!rules.engines.has(engine)) {
    throw new OperationalTelemetryValidationError('telemetry_event_engine_mismatch')
  }
  if (
    typeof input.result !== 'string'
    || !OPERATIONAL_RESULTS.includes(input.result as OperationalResult)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_result_invalid')
  }

  const learnerRef = optionalUuid(input.learnerRef)
  if (
    (rules.learner === 'required' && learnerRef === null)
    || (rules.learner === 'forbidden' && learnerRef !== null)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_learner_scope_invalid')
  }

  const curriculumVersion = version(input.curriculumVersion, false)
  const courseRef = reference(input.courseRef)
  const unitRef = reference(input.unitRef)
  const lessonRef = reference(input.lessonRef)
  const skillRef = reference(input.skillRef)
  if (
    curriculumVersion === null
    && [courseRef, unitRef, lessonRef, skillRef].some((candidate) => candidate !== null)
  ) {
    throw new OperationalTelemetryValidationError('telemetry_version_invalid')
  }

  const uuidFactory = dependencies.randomUuid ?? (() => globalThis.crypto.randomUUID())
  const clock = dependencies.now ?? (() => new Date())
  const eventIdValue = input.eventId === undefined
    ? uuidFactory()
    : requiredUuid(input.eventId, 'telemetry_event_id_invalid')
  const occurredAtValue = input.occurredAt === undefined
    ? clock().toISOString()
    : instant(input.occurredAt)

  return Object.freeze({
    schemaVersion: OPERATIONAL_TELEMETRY_SCHEMA_VERSION,
    eventId: requiredUuid(eventIdValue, 'telemetry_event_id_invalid'),
    occurredAt: instant(occurredAtValue),
    householdRef: requiredUuid(
      input.householdRef,
      'telemetry_household_ref_invalid',
    ),
    learnerRef,
    engine,
    engineVersion: version(input.engineVersion, true) as string,
    applicationVersion: version(input.applicationVersion, false),
    curriculumVersion,
    courseRef,
    unitRef,
    lessonRef,
    skillRef,
    eventType: type,
    result: input.result as OperationalResult,
    durationMs: duration(input.durationMs),
    metadata: metadata(type, input.metadata),
  }) as OperationalEvent
}

export function createOperationalEvent(
  input: OperationalEventInput,
  dependencies: Pick<OperationalTelemetryDependencies, 'now' | 'randomUuid'> = {},
): OperationalEvent {
  return normalizedEvent(input, dependencies)
}

export interface OperationalTelemetryReadFilter {
  readonly householdRef: string
  readonly learnerRef?: string | null
  readonly limit?: number
}

export interface OperationalTelemetryStore {
  append(event: OperationalEvent): Promise<void>
  list(filter: Required<OperationalTelemetryReadFilter>): Promise<unknown>
}

export interface OperationalTelemetryFailureNotice {
  readonly code: 'telemetry_persistence_failed'
  readonly eventId: string
  readonly engine: OperationalEngine
  readonly eventType: OperationalEventType
}

export interface OperationalTelemetryDependencies {
  readonly store: OperationalTelemetryStore
  readonly now?: () => Date
  readonly randomUuid?: () => string
  readonly onPersistenceFailure?: (
    notice: OperationalTelemetryFailureNotice,
  ) => void | Promise<void>
}

export interface DecodedOperationalEvents {
  readonly events: readonly OperationalEvent[]
  readonly rejectedRows: number
}

export function decodeStoredOperationalEvents(value: unknown): DecodedOperationalEvents {
  if (!Array.isArray(value)) return Object.freeze({ events: [], rejectedRows: 1 })
  const events: OperationalEvent[] = []
  let rejectedRows = 0
  for (const candidate of value) {
    try {
      events.push(normalizedEvent(candidate, {}, true))
    } catch {
      rejectedRows += 1
    }
  }
  return Object.freeze({ events: Object.freeze(events), rejectedRows })
}

function readFilter(filter: OperationalTelemetryReadFilter): Required<OperationalTelemetryReadFilter> {
  if (!isPlainRecord(filter)) {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  const fields = new Set(['householdRef', 'learnerRef', 'limit'])
  assertExactFields(filter, fields)
  const limit = filter.limit ?? 100
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > OPERATIONAL_TELEMETRY_MAX_READ_LIMIT
  ) {
    throw new OperationalTelemetryValidationError('telemetry_read_filter_invalid')
  }
  return Object.freeze({
    householdRef: requiredUuid(
      filter.householdRef,
      'telemetry_household_ref_invalid',
    ),
    learnerRef: optionalUuid(filter.learnerRef),
    limit,
  })
}

/**
 * Telemetry is observational. Validation rejects unsafe caller input, while a
 * store outage returns `not-recorded` and never rolls back the learner action
 * that already succeeded. Safety/security code must keep its own fail-closed
 * persistence rail and must not rely on this best-effort service.
 */
export function createOperationalTelemetry(dependencies: OperationalTelemetryDependencies) {
  async function record(input: OperationalEventInput): Promise<
    | { readonly status: 'recorded'; readonly event: OperationalEvent }
    | { readonly status: 'not-recorded'; readonly eventId: string }
  > {
    const event = createOperationalEvent(input, dependencies)
    try {
      await dependencies.store.append(event)
      return Object.freeze({ status: 'recorded', event })
    } catch {
      const notice = Object.freeze({
        code: 'telemetry_persistence_failed' as const,
        eventId: event.eventId,
        engine: event.engine,
        eventType: event.eventType,
      })
      try {
        await dependencies.onPersistenceFailure?.(notice)
      } catch {
        // Failure reporting is observational too; never replace learner state.
      }
      return Object.freeze({ status: 'not-recorded', eventId: event.eventId })
    }
  }

  async function list(
    filter: OperationalTelemetryReadFilter,
  ): Promise<DecodedOperationalEvents> {
    return decodeStoredOperationalEvents(
      await dependencies.store.list(readFilter(filter)),
    )
  }

  return Object.freeze({ list, record })
}

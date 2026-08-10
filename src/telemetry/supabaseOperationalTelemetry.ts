import type {
  AcceptedOperationalEventFacts,
  OperationalTelemetryAppendResult,
  OperationalTelemetryReadAuthorization,
  OperationalTelemetryReadFilter,
  OperationalTelemetryStore,
} from './operationalTelemetry.ts'
import { decodeStoredOperationalEvents } from './operationalTelemetry.ts'

interface DatabaseErrorLike {
  readonly code?: string
}

export interface OperationalTelemetrySupabaseClient {
  rpc(
    name: string,
    parameters?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: DatabaseErrorLike | null }>
}

export class OperationalTelemetryStoreError extends Error {
  constructor(
    readonly code:
      | 'unauthorized'
      | 'invalid-event'
      | 'database-contract'
      | 'temporarily-unavailable',
  ) {
    super(`Operational telemetry store failed: ${code}`)
    this.name = 'OperationalTelemetryStoreError'
  }
}

function mappedError(error: DatabaseErrorLike): OperationalTelemetryStoreError {
  switch (error.code) {
    case '42501':
      return new OperationalTelemetryStoreError('unauthorized')
    case '22023':
    case '22P02':
    case '23503':
    case '23514':
      return new OperationalTelemetryStoreError('invalid-event')
    case '40001':
    case '40P01':
    case '55P03':
    case '57014':
      return new OperationalTelemetryStoreError('temporarily-unavailable')
    default:
      return new OperationalTelemetryStoreError('database-contract')
  }
}

function databaseFacts(facts: AcceptedOperationalEventFacts): Record<string, unknown> {
  return {
    schema_version: facts.schemaVersion,
    scope: facts.scope,
    household_id: facts.householdRef,
    learner_id: facts.learnerRef,
    engine: facts.engine,
    app_version: facts.appVersion,
    engine_version: facts.engineVersion,
    curriculum_version: facts.curriculumVersion,
    course_ref: facts.courseRef,
    unit_ref: facts.unitRef,
    lesson_ref: facts.lessonRef,
    skill_ref: facts.skillRef,
    event_type: facts.eventType,
    result: facts.result,
    duration_ms: facts.durationMs,
    metadata: facts.metadata,
  }
}

async function rpc(
  client: OperationalTelemetrySupabaseClient,
  name: string,
  parameters: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(name, parameters)
  if (error) throw mappedError(error)
  return data
}

function appendResult(value: unknown): OperationalTelemetryAppendResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new OperationalTelemetryStoreError('database-contract')
  }
  const result = value as Record<string, unknown>
  if (
    result.status === 'reconciliation_conflict'
    && Object.keys(result).length === 1
  ) {
    return Object.freeze({ status: 'reconciliation_conflict' })
  }
  if (
    (result.status === 'created' || result.status === 'replayed')
    && Object.keys(result).length === 2
    && typeof result.event === 'object'
    && result.event !== null
    && !Array.isArray(result.event)
  ) {
    const decoded = decodeStoredOperationalEvents([result.event])
    if (decoded.rejectedRows !== 0 || decoded.events.length !== 1) {
      throw new OperationalTelemetryStoreError('database-contract')
    }
    return Object.freeze({
      status: result.status,
      event: decoded.events[0],
    })
  }
  throw new OperationalTelemetryStoreError('database-contract')
}

/** Server-only adapter. The client must be isolated service-role infrastructure. */
export function createSupabaseOperationalTelemetryStore(
  client: OperationalTelemetrySupabaseClient,
): OperationalTelemetryStore {
  return Object.freeze({
    async append(
      executionKey: string,
      facts: AcceptedOperationalEventFacts,
    ): Promise<OperationalTelemetryAppendResult> {
      return appendResult(await rpc(client, 'academy_record_operational_event_v2', {
        p_execution_key: executionKey,
        p_facts: databaseFacts(facts),
      }))
    },

    async list(
      filter: OperationalTelemetryReadFilter,
      authorization: OperationalTelemetryReadAuthorization,
    ): Promise<unknown> {
      return rpc(client, 'academy_list_operational_events_v2', {
        p_scope: filter.scope,
        p_household_id: filter.householdRef,
        p_learner_id: filter.learnerRef,
        p_limit: filter.limit,
        p_required_capability: authorization.capability,
      })
    },
  })
}

import type {
  OperationalEvent,
  OperationalTelemetryReadFilter,
  OperationalTelemetryStore,
} from './operationalTelemetry'

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
      | 'event-id-collision'
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
    case '23505':
      return new OperationalTelemetryStoreError('event-id-collision')
    case '40001':
    case '40P01':
    case '55P03':
    case '57014':
      return new OperationalTelemetryStoreError('temporarily-unavailable')
    default:
      return new OperationalTelemetryStoreError('database-contract')
  }
}

function databaseEvent(event: OperationalEvent): Record<string, unknown> {
  return {
    schema_version: event.schemaVersion,
    event_id: event.eventId,
    occurred_at: event.occurredAt,
    household_id: event.householdRef,
    learner_id: event.learnerRef,
    engine: event.engine,
    engine_version: event.engineVersion,
    application_version: event.applicationVersion,
    curriculum_version: event.curriculumVersion,
    course_ref: event.courseRef,
    unit_ref: event.unitRef,
    lesson_ref: event.lessonRef,
    skill_ref: event.skillRef,
    event_type: event.eventType,
    result: event.result,
    duration_ms: event.durationMs,
    metadata: event.metadata,
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

/** Database details stay in this adapter; engine callers use the generic store. */
export function createSupabaseOperationalTelemetryStore(
  client: OperationalTelemetrySupabaseClient,
): OperationalTelemetryStore {
  return Object.freeze({
    async append(event: OperationalEvent): Promise<void> {
      const result = await rpc(client, 'academy_record_operational_event_v1', {
        p_event: databaseEvent(event),
      })
      if (
        typeof result !== 'object'
        || result === null
        || Array.isArray(result)
        || Object.keys(result).length !== 2
        || (result as Record<string, unknown>).status !== 'recorded'
        || (result as Record<string, unknown>).eventId !== event.eventId
      ) {
        throw new OperationalTelemetryStoreError('database-contract')
      }
    },

    async list(filter: Required<OperationalTelemetryReadFilter>): Promise<unknown> {
      return rpc(client, 'academy_list_operational_events_v1', {
        p_household_id: filter.householdRef,
        p_learner_id: filter.learnerRef,
        p_limit: filter.limit,
      })
    },
  })
}

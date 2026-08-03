import { randomUUID } from 'node:crypto';

const MONITORING_SCHEMA_VERSION = 2;

const MONITORING_EVENT_NAMES = Object.freeze({
  PROPOSAL_BACKLOG: 'study.adult_review.proposal_backlog',
  OUTBOX_BACKLOG: 'study.adult_review.outbox_backlog',
  OLDEST_PENDING_JOB: 'study.adult_review.oldest_pending_job',
  LEASE_EXPIRATION: 'study.adult_review.lease_expiration',
  REPEATED_WORKER_CRASH: 'study.adult_review.repeated_worker_crash',
  REPEATED_RETRY: 'study.adult_review.repeated_retry',
  INDETERMINATE_JOB: 'study.adult_review.indeterminate_job',
  RECEIPT_VERIFICATION_FAILURE: 'study.adult_review.receipt_verification_failure',
  RECIPIENT_RESOLUTION_FAILURE: 'study.adult_review.recipient_resolution_failure',
  PERMISSION_REVOCATION: 'study.adult_review.permission_revocation',
  DUPLICATE_SUPPRESSION: 'study.adult_review.duplicate_suppression',
  RATE_LIMIT_THRESHOLD: 'study.adult_review.rate_limit_threshold',
  PROVIDER_NOT_READY: 'study.adult_review.provider_not_ready',
  PROVIDER_TIMEOUT: 'study.adult_review.provider_timeout',
  PROVIDER_CIRCUIT_OPEN: 'study.adult_review.provider_circuit_open',
  DELIVERY_PERMANENT_FAILURE: 'study.adult_review.delivery_permanent_failure',
  UNAUTHORIZED_WORKER: 'study.adult_review.unauthorized_worker',
  CROSS_HOUSEHOLD_ATTEMPT: 'study.adult_review.cross_household_attempt',
});

const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;
const SAFE_REFERENCE = /^[a-z0-9][a-z0-9_-]{7,127}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const CONTACT_OR_FREE_TEXT = /(?:@|\s|\+|:\/\/|[<>]|\r|\n)/;
const PHONE_LIKE = /^\d{7,15}$/;
const SENSITIVE_FIELD = /(?:raw|disclosure|transcript|prompt|response|body|contact|email|phone|secret|token|bearer|jwt|note|message|payload|address)/i;
const INPUT_FIELDS = new Set([
  'dimensions',
  'environment',
  'eventId',
  'occurredAt',
  'occurrences',
  'value',
]);

class MonitoringValidationError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MonitoringValidationError';
    this.code = code;
  }
}

class MonitoringUnavailableError extends Error {
  constructor(code) {
    super(code);
    this.name = 'MonitoringUnavailableError';
    this.code = code;
  }
}

function freezeDefinition(definition) {
  return Object.freeze({
    schemaVersion: MONITORING_SCHEMA_VERSION,
    eventName: definition.eventName,
    severity: definition.severity,
    dimensions: Object.freeze(['environment', ...definition.dimensions]),
    measurement: Object.freeze({
      name: definition.measurement.name,
      unit: definition.measurement.unit,
    }),
    threshold: Object.freeze({
      basis: definition.threshold.basis,
      operator: 'gte',
      value: definition.threshold.value,
      windowSeconds: definition.threshold.windowSeconds,
    }),
    suggestedDashboard: definition.suggestedDashboard,
    runbookAction: definition.runbookAction,
    retentionDays: definition.retentionDays,
  });
}

const DEFINITIONS = [
  {
    eventName: MONITORING_EVENT_NAMES.PROPOSAL_BACKLOG,
    severity: 'warning',
    dimensions: ['household_ref'],
    measurement: { name: 'proposal_count', unit: 'count' },
    threshold: { basis: 'value', value: 25, windowSeconds: 900 },
    suggestedDashboard: 'Adult review proposal health',
    runbookAction: 'Check proposal acceptance and recipient-resolution throughput.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.OUTBOX_BACKLOG,
    severity: 'warning',
    dimensions: ['route'],
    measurement: { name: 'job_count', unit: 'count' },
    threshold: { basis: 'value', value: 50, windowSeconds: 600 },
    suggestedDashboard: 'Adult review delivery health',
    runbookAction: 'Check worker claims, route readiness, and retry pressure.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.OLDEST_PENDING_JOB,
    severity: 'critical',
    dimensions: ['route'],
    measurement: { name: 'age_seconds', unit: 'seconds' },
    threshold: { basis: 'value', value: 900, windowSeconds: 300 },
    suggestedDashboard: 'Adult review delivery latency',
    runbookAction: 'Inspect the oldest job without exposing its recipient or content.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.LEASE_EXPIRATION,
    severity: 'warning',
    dimensions: ['route', 'worker_ref'],
    measurement: { name: 'lease_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 300 },
    suggestedDashboard: 'Worker lease and recovery',
    runbookAction: 'Recover the expired lease and verify the prior attempt state before delivery.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.REPEATED_WORKER_CRASH,
    severity: 'critical',
    dimensions: ['worker_ref', 'route'],
    measurement: { name: 'crash_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 3, windowSeconds: 900 },
    suggestedDashboard: 'Worker lease and recovery',
    runbookAction: 'Disable the unhealthy worker identity and reconcile its leased jobs.',
    retentionDays: 180,
  },
  {
    eventName: MONITORING_EVENT_NAMES.REPEATED_RETRY,
    severity: 'warning',
    dimensions: ['route', 'provider', 'reason_code'],
    measurement: { name: 'retry_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 3, windowSeconds: 1800 },
    suggestedDashboard: 'Adult review retry pressure',
    runbookAction: 'Review retry policy and move unresolved submissions to reconciliation.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.INDETERMINATE_JOB,
    severity: 'critical',
    dimensions: ['route', 'provider', 'job_ref'],
    measurement: { name: 'job_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Indeterminate delivery reconciliation',
    runbookAction: 'Do not resend; reconcile provider status against the immutable attempt.',
    retentionDays: 365,
  },
  {
    eventName: MONITORING_EVENT_NAMES.RECEIPT_VERIFICATION_FAILURE,
    severity: 'critical',
    dimensions: ['route', 'provider', 'reason_code'],
    measurement: { name: 'failure_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 300 },
    suggestedDashboard: 'Receipt integrity',
    runbookAction: 'Quarantine the receipt and inspect attempt binding and replay evidence.',
    retentionDays: 365,
  },
  {
    eventName: MONITORING_EVENT_NAMES.RECIPIENT_RESOLUTION_FAILURE,
    severity: 'warning',
    dimensions: ['route', 'reason_code'],
    measurement: { name: 'failure_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 5, windowSeconds: 300 },
    suggestedDashboard: 'Recipient authorization health',
    runbookAction: 'Check permission revisions and relationship state using authorized server tooling.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.PERMISSION_REVOCATION,
    severity: 'info',
    dimensions: ['route', 'reason_code'],
    measurement: { name: 'revocation_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Recipient authorization changes',
    runbookAction: 'Cancel undelivered jobs and preserve the revocation audit record.',
    retentionDays: 365,
  },
  {
    eventName: MONITORING_EVENT_NAMES.DUPLICATE_SUPPRESSION,
    severity: 'info',
    dimensions: ['route', 'source'],
    measurement: { name: 'suppression_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 300 },
    suggestedDashboard: 'Delivery idempotency',
    runbookAction: 'Confirm the existing route job or verified receipt owns the idempotency key.',
    retentionDays: 180,
  },
  {
    eventName: MONITORING_EVENT_NAMES.RATE_LIMIT_THRESHOLD,
    severity: 'warning',
    dimensions: ['scope', 'route', 'reason_code'],
    measurement: { name: 'violation_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 5, windowSeconds: 300 },
    suggestedDashboard: 'Study rate limits',
    runbookAction: 'Review the durable counter and reject bypass attempts without inspecting payloads.',
    retentionDays: 90,
  },
  {
    eventName: MONITORING_EVENT_NAMES.PROVIDER_NOT_READY,
    severity: 'error',
    dimensions: ['route', 'provider'],
    measurement: { name: 'blocked_job_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Delivery provider readiness',
    runbookAction: 'Keep the route blocked until an approved provider configuration is ready.',
    retentionDays: 180,
  },
  {
    eventName: MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT,
    severity: 'error',
    dimensions: ['route', 'provider'],
    measurement: { name: 'timeout_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 3, windowSeconds: 300 },
    suggestedDashboard: 'Delivery provider latency',
    runbookAction: 'Mark submitted outcomes indeterminate and use receipt reconciliation.',
    retentionDays: 180,
  },
  {
    eventName: MONITORING_EVENT_NAMES.PROVIDER_CIRCUIT_OPEN,
    severity: 'critical',
    dimensions: ['route', 'provider', 'reason_code'],
    measurement: { name: 'open_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Delivery provider health',
    runbookAction: 'Keep the circuit open and reconcile accepted or indeterminate attempts before recovery.',
    retentionDays: 180,
  },
  {
    eventName: MONITORING_EVENT_NAMES.DELIVERY_PERMANENT_FAILURE,
    severity: 'critical',
    dimensions: ['route', 'provider', 'reason_code'],
    measurement: { name: 'failure_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Adult review terminal delivery',
    runbookAction: 'Verify allowed fallback routes and preserve immutable attempt evidence.',
    retentionDays: 365,
  },
  {
    eventName: MONITORING_EVENT_NAMES.UNAUTHORIZED_WORKER,
    severity: 'critical',
    dimensions: ['source', 'reason_code'],
    measurement: { name: 'attempt_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Worker authorization incidents',
    runbookAction: 'Reject the invocation, rotate affected credentials, and inspect authorization audit evidence.',
    retentionDays: 365,
  },
  {
    eventName: MONITORING_EVENT_NAMES.CROSS_HOUSEHOLD_ATTEMPT,
    severity: 'critical',
    dimensions: ['operation', 'source', 'route'],
    measurement: { name: 'attempt_count', unit: 'count' },
    threshold: { basis: 'occurrences', value: 1, windowSeconds: 60 },
    suggestedDashboard: 'Study authorization incidents',
    runbookAction: 'Deny the request and inspect relationship and permission audit evidence.',
    retentionDays: 365,
  },
];

const MONITORING_EVENT_CATALOG = Object.freeze(
  Object.fromEntries(DEFINITIONS.map((definition) => {
    const frozen = freezeDefinition(definition);
    return [frozen.eventName, frozen];
  })),
);

const MONITORING_EVENT_ALLOWLIST = Object.freeze(Object.keys(MONITORING_EVENT_CATALOG));

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function rejectSensitiveOrUnexpectedField(field, allowedFields) {
  if (SENSITIVE_FIELD.test(field)) {
    throw new MonitoringValidationError('monitoring_sensitive_field_rejected');
  }
  if (!allowedFields.has(field)) {
    throw new MonitoringValidationError('monitoring_schema_field_not_allowed');
  }
}

function assertSafeToken(value, code) {
  if (
    typeof value !== 'string'
    || !SAFE_TOKEN.test(value)
    || CONTACT_OR_FREE_TEXT.test(value)
    || PHONE_LIKE.test(value)
  ) {
    throw new MonitoringValidationError(code);
  }
  return value;
}

function assertSafeReference(value) {
  if (
    typeof value !== 'string'
    || !SAFE_REFERENCE.test(value)
    || CONTACT_OR_FREE_TEXT.test(value)
    || PHONE_LIKE.test(value)
  ) {
    throw new MonitoringValidationError('monitoring_dimension_value_rejected');
  }
  return value;
}

function sanitizeDimensions(definition, dimensions, environment) {
  if (!isPlainRecord(dimensions)) {
    throw new MonitoringValidationError('monitoring_dimensions_invalid');
  }

  const allowed = new Set(definition.dimensions);
  const safe = { environment: assertSafeToken(environment, 'monitoring_environment_invalid') };

  for (const key of Object.keys(dimensions)) {
    rejectSensitiveOrUnexpectedField(key, allowed);
    const value = dimensions[key];
    safe[key] = key.endsWith('_ref')
      ? assertSafeReference(value)
      : assertSafeToken(value, 'monitoring_dimension_value_rejected');
  }

  return Object.freeze(safe);
}

function normalizeInstant(value) {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) {
    throw new MonitoringValidationError('monitoring_occurred_at_invalid');
  }
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== value) {
    throw new MonitoringValidationError('monitoring_occurred_at_invalid');
  }
  return value;
}

function normalizeNonNegativeInteger(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new MonitoringValidationError(code);
  }
  return value;
}

function evaluateIncidentThreshold(eventName, { value = 1, occurrences = 1 } = {}) {
  const definition = MONITORING_EVENT_CATALOG[eventName];
  if (!definition) {
    throw new MonitoringValidationError('monitoring_event_not_allowed');
  }
  const normalizedValue = normalizeNonNegativeInteger(value, 'monitoring_measurement_invalid');
  const normalizedOccurrences = normalizeNonNegativeInteger(
    occurrences,
    'monitoring_occurrences_invalid',
  );
  const observed = definition.threshold.basis === 'occurrences'
    ? normalizedOccurrences
    : normalizedValue;

  return Object.freeze({
    basis: definition.threshold.basis,
    observed,
    operator: definition.threshold.operator,
    value: definition.threshold.value,
    windowSeconds: definition.threshold.windowSeconds,
    triggered: observed >= definition.threshold.value,
  });
}

function createMonitoringEvent(eventName, input = {}) {
  const definition = MONITORING_EVENT_CATALOG[eventName];
  if (!definition) {
    throw new MonitoringValidationError('monitoring_event_not_allowed');
  }
  if (!isPlainRecord(input)) {
    throw new MonitoringValidationError('monitoring_input_invalid');
  }
  for (const key of Object.keys(input)) {
    rejectSensitiveOrUnexpectedField(key, INPUT_FIELDS);
  }

  const value = normalizeNonNegativeInteger(
    input.value === undefined ? 1 : input.value,
    'monitoring_measurement_invalid',
  );
  const occurrences = normalizeNonNegativeInteger(
    input.occurrences === undefined ? 1 : input.occurrences,
    'monitoring_occurrences_invalid',
  );
  const threshold = evaluateIncidentThreshold(eventName, { value, occurrences });
  const eventId = input.eventId === undefined ? randomUUID() : assertSafeReference(input.eventId);
  const occurredAt = normalizeInstant(input.occurredAt || new Date().toISOString());
  const dimensions = sanitizeDimensions(
    definition,
    input.dimensions || {},
    input.environment || 'production',
  );

  return Object.freeze({
    schemaVersion: MONITORING_SCHEMA_VERSION,
    eventName,
    eventId,
    occurredAt,
    severity: definition.severity,
    retentionDays: definition.retentionDays,
    dimensions,
    measurement: Object.freeze({
      name: definition.measurement.name,
      unit: definition.measurement.unit,
      value,
      occurrences,
    }),
    threshold,
  });
}

function validateMonitoringEvent(event) {
  if (!isPlainRecord(event)) return false;
  const fields = Object.keys(event).sort();
  const expected = [
    'dimensions',
    'eventId',
    'eventName',
    'measurement',
    'occurredAt',
    'retentionDays',
    'schemaVersion',
    'severity',
    'threshold',
  ].sort();
  if (fields.length !== expected.length || fields.some((field, index) => field !== expected[index])) {
    return false;
  }
  try {
    const recreated = createMonitoringEvent(event.eventName, {
      dimensions: Object.fromEntries(
        Object.entries(event.dimensions || {}).filter(([key]) => key !== 'environment'),
      ),
      environment: event.dimensions && event.dimensions.environment,
      eventId: event.eventId,
      occurredAt: event.occurredAt,
      occurrences: event.measurement && event.measurement.occurrences,
      value: event.measurement && event.measurement.value,
    });
    return JSON.stringify(recreated) === JSON.stringify(event);
  } catch {
    return false;
  }
}

function sinkWriter(sink) {
  return sink && typeof sink.write === 'function' ? sink.write : null;
}

function logWriter(serverLog) {
  if (serverLog && typeof serverLog.write === 'function') return serverLog.write;
  if (serverLog && typeof serverLog.log === 'function') return serverLog.log;
  return null;
}

function assessMonitoringReadiness({ durableSink, serverLog } = {}) {
  const reasonCodes = [];
  if (!durableSink) {
    reasonCodes.push('monitoring_sink_missing');
  } else {
    if (durableSink.durable !== true) reasonCodes.push('monitoring_sink_not_durable');
    if (!sinkWriter(durableSink)) reasonCodes.push('monitoring_sink_invalid');
    if (typeof durableSink.isReady === 'function' && durableSink.isReady() !== true) {
      reasonCodes.push('monitoring_sink_not_ready');
    }
  }
  if (!serverLog) {
    reasonCodes.push('structured_server_log_missing');
  } else if (!logWriter(serverLog)) {
    reasonCodes.push('structured_server_log_invalid');
  }
  return Object.freeze({
    ready: reasonCodes.length === 0,
    state: reasonCodes.length === 0 ? 'ready' : 'not-ready',
    reasonCodes: Object.freeze(reasonCodes),
    schemaVersion: MONITORING_SCHEMA_VERSION,
  });
}

function createDurableMonitoringSink(write, name = 'database') {
  if (isPlainRecord(write)) {
    name = write.name || name;
    write = write.write;
  }
  if (typeof write !== 'function') {
    throw new MonitoringValidationError('monitoring_sink_writer_invalid');
  }
  assertSafeToken(name, 'monitoring_sink_name_invalid');
  return Object.freeze({ durable: true, name, write });
}

function createVolatileMonitoringSink(write, name = 'memory') {
  if (typeof write !== 'function') {
    throw new MonitoringValidationError('monitoring_sink_writer_invalid');
  }
  assertSafeToken(name, 'monitoring_sink_name_invalid');
  return Object.freeze({ durable: false, name, write });
}

function createStructuredServerLog(write, name = 'server_log') {
  if (isPlainRecord(write)) {
    name = write.name || name;
    write = write.write;
  }
  if (typeof write !== 'function') {
    throw new MonitoringValidationError('structured_server_log_writer_invalid');
  }
  assertSafeToken(name, 'structured_server_log_name_invalid');
  return Object.freeze({ name, structured: true, write });
}

function createMonitoringService({
  durableSink,
  serverLog,
  logger,
  environment = 'production',
  now = () => new Date(),
} = {}) {
  const selectedLog = serverLog || logger;
  const readiness = assessMonitoringReadiness({ durableSink, serverLog: selectedLog });
  assertSafeToken(environment, 'monitoring_environment_invalid');
  if (typeof now !== 'function') {
    throw new MonitoringValidationError('monitoring_clock_invalid');
  }

  async function emit(eventName, input = {}) {
    if (!readiness.ready) {
      throw new MonitoringUnavailableError('monitoring_not_ready');
    }
    if (!isPlainRecord(input)) {
      throw new MonitoringValidationError('monitoring_input_invalid');
    }

    const event = createMonitoringEvent(eventName, {
      ...input,
      environment,
      occurredAt: input.occurredAt || now().toISOString(),
    });

    try {
      await sinkWriter(durableSink).call(durableSink, event);
    } catch {
      throw new MonitoringUnavailableError('monitoring_durable_write_failed');
    }

    try {
      await logWriter(selectedLog).call(selectedLog, event);
    } catch {
      throw new MonitoringUnavailableError('monitoring_structured_log_write_failed');
    }

    return event;
  }

  return Object.freeze({
    emit,
    record: emit,
    readiness,
    ready: () => Object.freeze({ ready: readiness.ready }),
    isReady: () => readiness.ready,
  });
}

export {
  MONITORING_EVENT_ALLOWLIST,
  MONITORING_EVENT_CATALOG,
  MONITORING_EVENT_NAMES,
  MONITORING_SCHEMA_VERSION,
  MonitoringUnavailableError,
  MonitoringValidationError,
  assessMonitoringReadiness,
  createDurableMonitoringSink,
  createMonitoringEvent,
  createMonitoringService,
  createStructuredServerLog,
  createVolatileMonitoringSink,
  evaluateIncidentThreshold,
  validateMonitoringEvent,
};

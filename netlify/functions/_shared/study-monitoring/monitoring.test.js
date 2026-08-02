import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  MONITORING_EVENT_ALLOWLIST,
  MONITORING_EVENT_CATALOG,
  MONITORING_EVENT_NAMES,
  MONITORING_SCHEMA_VERSION,
  assessMonitoringReadiness,
  createDurableMonitoringSink,
  createMonitoringEvent,
  createMonitoringService,
  createStructuredServerLog,
  createVolatileMonitoringSink,
  evaluateIncidentThreshold,
  validateMonitoringEvent,
} from './monitoring.js';

const EXPECTED_EVENT_NAMES = Object.freeze([
  'study.adult_review.proposal_backlog',
  'study.adult_review.outbox_backlog',
  'study.adult_review.oldest_pending_job',
  'study.adult_review.lease_expiration',
  'study.adult_review.repeated_worker_crash',
  'study.adult_review.repeated_retry',
  'study.adult_review.indeterminate_job',
  'study.adult_review.receipt_verification_failure',
  'study.adult_review.recipient_resolution_failure',
  'study.adult_review.permission_revocation',
  'study.adult_review.duplicate_suppression',
  'study.adult_review.rate_limit_threshold',
  'study.adult_review.provider_not_ready',
  'study.adult_review.provider_timeout',
  'study.adult_review.provider_circuit_open',
  'study.adult_review.delivery_permanent_failure',
  'study.adult_review.unauthorized_worker',
  'study.adult_review.cross_household_attempt',
]);

test('schema v2 exposes the exact Session 17 event allowlist', () => {
  assert.equal(MONITORING_SCHEMA_VERSION, 2);
  assert.deepEqual(MONITORING_EVENT_ALLOWLIST, EXPECTED_EVENT_NAMES);
  assert.deepEqual(Object.values(MONITORING_EVENT_NAMES), EXPECTED_EVENT_NAMES);
  assert.equal(new Set(MONITORING_EVENT_ALLOWLIST).size, 18);
  assert.throws(
    () => createMonitoringEvent('study.adult_review.raw_payload', {}),
    { code: 'monitoring_event_not_allowed' },
  );
});

test('every allowed event has immutable operational metadata', () => {
  const severities = new Set(['info', 'warning', 'error', 'critical']);
  for (const eventName of EXPECTED_EVENT_NAMES) {
    const definition = MONITORING_EVENT_CATALOG[eventName];
    assert.ok(definition);
    assert.equal(definition.schemaVersion, 2);
    assert.equal(definition.eventName, eventName);
    assert.ok(severities.has(definition.severity));
    assert.ok(definition.dimensions.includes('environment'));
    assert.equal(new Set(definition.dimensions).size, definition.dimensions.length);
    assert.match(definition.measurement.name, /^[a-z_]+$/);
    assert.ok(['count', 'seconds'].includes(definition.measurement.unit));
    assert.ok(['value', 'occurrences'].includes(definition.threshold.basis));
    assert.equal(definition.threshold.operator, 'gte');
    assert.ok(Number.isSafeInteger(definition.threshold.value));
    assert.ok(definition.threshold.value >= 1);
    assert.ok(Number.isSafeInteger(definition.threshold.windowSeconds));
    assert.ok(definition.threshold.windowSeconds >= 1);
    assert.ok(definition.suggestedDashboard.length > 0);
    assert.ok(definition.runbookAction.length > 0);
    assert.ok(definition.retentionDays >= 90);
    assert.ok(Object.isFrozen(definition));
    assert.ok(Object.isFrozen(definition.dimensions));
    assert.ok(Object.isFrozen(definition.threshold));
  }
});

test('a monitoring event has only the closed schema and per-event dimensions', () => {
  const event = createMonitoringEvent(MONITORING_EVENT_NAMES.REPEATED_RETRY, {
    environment: 'test',
    eventId: 'event_00000001',
    occurredAt: '2026-08-01T17:00:00.000Z',
    dimensions: {
      route: 'in_app',
      provider: 'durable_in_app',
      reason_code: 'transient_failure',
    },
    value: 1,
    occurrences: 3,
  });

  assert.deepEqual(Object.keys(event), [
    'schemaVersion',
    'eventName',
    'eventId',
    'occurredAt',
    'severity',
    'retentionDays',
    'dimensions',
    'measurement',
    'threshold',
  ]);
  assert.deepEqual(event.dimensions, {
    environment: 'test',
    route: 'in_app',
    provider: 'durable_in_app',
    reason_code: 'transient_failure',
  });
  assert.equal(event.threshold.triggered, true);
  assert.equal(event.retentionDays, MONITORING_EVENT_CATALOG[event.eventName].retentionDays);
  assert.equal(validateMonitoringEvent(event), true);
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.dimensions));
  assert.ok(Object.isFrozen(event.measurement));
  assert.ok(Object.isFrozen(event.threshold));
});

test('event validation rejects additional or modified schema fields', () => {
  const valid = createMonitoringEvent(MONITORING_EVENT_NAMES.OUTBOX_BACKLOG, {
    eventId: 'event_00000002',
    occurredAt: '2026-08-01T17:00:00.000Z',
    dimensions: { route: 'in_app' },
    value: 50,
  });
  assert.equal(validateMonitoringEvent({ ...valid, payload: 'not_allowed' }), false);
  assert.equal(validateMonitoringEvent({ ...valid, severity: 'info' }), false);
  assert.equal(validateMonitoringEvent({ ...valid, schemaVersion: 1 }), false);
  assert.equal(validateMonitoringEvent({
    ...valid,
    dimensions: { environment: 'test', route: 'email', provider: 'forged' },
  }), false);
});

test('repeated incident thresholds fire only at the catalog boundary', () => {
  const crash = MONITORING_EVENT_NAMES.REPEATED_WORKER_CRASH;
  assert.equal(evaluateIncidentThreshold(crash, { value: 99, occurrences: 2 }).triggered, false);
  assert.equal(evaluateIncidentThreshold(crash, { value: 1, occurrences: 3 }).triggered, true);

  const retry = MONITORING_EVENT_NAMES.REPEATED_RETRY;
  assert.equal(evaluateIncidentThreshold(retry, { occurrences: 2 }).triggered, false);
  assert.equal(evaluateIncidentThreshold(retry, { occurrences: 3 }).triggered, true);

  const rateLimit = MONITORING_EVENT_NAMES.RATE_LIMIT_THRESHOLD;
  assert.equal(evaluateIncidentThreshold(rateLimit, { occurrences: 4 }).triggered, false);
  assert.equal(evaluateIncidentThreshold(rateLimit, { occurrences: 5 }).triggered, true);
});

test('gauge incident thresholds use measurement value rather than occurrences', () => {
  const backlog = MONITORING_EVENT_NAMES.OUTBOX_BACKLOG;
  assert.equal(evaluateIncidentThreshold(backlog, { value: 49, occurrences: 100 }).triggered, false);
  assert.equal(evaluateIncidentThreshold(backlog, { value: 50, occurrences: 1 }).triggered, true);

  const oldest = MONITORING_EVENT_NAMES.OLDEST_PENDING_JOB;
  assert.equal(evaluateIncidentThreshold(oldest, { value: 899 }).triggered, false);
  assert.equal(evaluateIncidentThreshold(oldest, { value: 900 }).triggered, true);
});

test('readiness is false for a non-durable sink even with structured server logging', () => {
  const readiness = assessMonitoringReadiness({
    durableSink: createVolatileMonitoringSink(async () => {}),
    serverLog: createStructuredServerLog(async () => {}),
  });
  assert.equal(readiness.ready, false);
  assert.equal(readiness.state, 'not-ready');
  assert.deepEqual(readiness.reasonCodes, ['monitoring_sink_not_durable']);
});

test('readiness reports missing and malformed dependencies without exposing values', () => {
  assert.deepEqual(assessMonitoringReadiness().reasonCodes, [
    'monitoring_sink_missing',
    'structured_server_log_missing',
  ]);
  assert.deepEqual(assessMonitoringReadiness({
    durableSink: { durable: true },
    serverLog: {},
  }).reasonCodes, [
    'monitoring_sink_invalid',
    'structured_server_log_invalid',
  ]);
});

test('the service writes the same minimized event to durable storage and injected structured logging', async () => {
  const durableEvents = [];
  const structuredLogs = [];
  const service = createMonitoringService({
    durableSink: createDurableMonitoringSink(async (event) => durableEvents.push(event)),
    serverLog: createStructuredServerLog(async (event) => structuredLogs.push(event)),
    environment: 'test',
    now: () => new Date('2026-08-01T17:01:00.000Z'),
  });

  assert.equal(service.readiness.ready, true);
  const result = await service.emit(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT, {
    eventId: 'event_00000003',
    dimensions: { route: 'email', provider: 'approved_adapter' },
    occurrences: 3,
  });

  assert.equal(durableEvents.length, 1);
  assert.equal(structuredLogs.length, 1);
  assert.strictEqual(durableEvents[0], result);
  assert.strictEqual(structuredLogs[0], result);
  assert.equal(result.dimensions.environment, 'test');
  assert.equal(result.threshold.triggered, true);
});

test('a not-ready service refuses emission before either output is touched', async () => {
  let sinkCalls = 0;
  let logCalls = 0;
  const service = createMonitoringService({
    durableSink: createVolatileMonitoringSink(async () => { sinkCalls += 1; }),
    serverLog: createStructuredServerLog(async () => { logCalls += 1; }),
  });

  await assert.rejects(
    service.emit(MONITORING_EVENT_NAMES.PROPOSAL_BACKLOG, { value: 25 }),
    { code: 'monitoring_not_ready', message: 'monitoring_not_ready' },
  );
  assert.equal(sinkCalls, 0);
  assert.equal(logCalls, 0);
});

test('sink and logger failures are converted to non-sensitive structured reason codes', async () => {
  const providerLeak = 'synthetic provider response body with recipient@example.invalid';
  const durableFailure = createMonitoringService({
    durableSink: createDurableMonitoringSink(async () => { throw new Error(providerLeak); }),
    serverLog: createStructuredServerLog(async () => {}),
  });
  await assert.rejects(
    durableFailure.emit(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT),
    (error) => {
      assert.equal(error.code, 'monitoring_durable_write_failed');
      assert.equal(error.message, 'monitoring_durable_write_failed');
      assert.equal(JSON.stringify(error).includes(providerLeak), false);
      return true;
    },
  );

  const logFailure = createMonitoringService({
    durableSink: createDurableMonitoringSink(async () => {}),
    serverLog: createStructuredServerLog(async () => { throw new Error(providerLeak); }),
  });
  await assert.rejects(
    logFailure.emit(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT),
    { code: 'monitoring_structured_log_write_failed' },
  );
});

test('adversarial raw disclosure, transcript, contact, and provider-body fields are rejected', () => {
  const attempts = [
    { rawDisclosure: 'synthetic disclosure' },
    { transcript: 'synthetic transcript' },
    { providerBody: '{ synthetic provider body }' },
    { recipientEmail: 'recipient@example.invalid' },
    { phone: '+15555550100' },
    { adultPrivateNote: 'synthetic adult note' },
    { payload: { raw: 'synthetic disclosure' } },
  ];
  for (const extra of attempts) {
    assert.throws(
      () => createMonitoringEvent(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT, extra),
      { code: 'monitoring_sensitive_field_rejected' },
    );
  }
});

test('adversarial sensitive dimension names are rejected before logging', () => {
  const sensitiveDimensions = [
    { recipient_email: 'recipient@example.invalid' },
    { recipient_phone: '15555550100' },
    { raw_text: 'synthetic' },
    { transcript_body: 'synthetic' },
    { provider_response_body: 'synthetic' },
    { secret_token: 'synthetic' },
  ];
  for (const dimensions of sensitiveDimensions) {
    assert.throws(
      () => createMonitoringEvent(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT, { dimensions }),
      { code: 'monitoring_sensitive_field_rejected' },
    );
  }
});

test('adversarial contact and free-text values cannot hide in allowed dimensions', () => {
  const attempts = [
    { route: 'recipient@example.invalid', provider: 'approved_adapter' },
    { route: '+15555550100', provider: 'approved_adapter' },
    { route: 'email', provider: 'synthetic provider body' },
    { route: 'email', provider: 'https://provider.invalid/body' },
    { route: 'email', provider: '<raw-disclosure>' },
    { route: '15555550100', provider: 'approved_adapter' },
  ];
  for (const dimensions of attempts) {
    assert.throws(
      () => createMonitoringEvent(MONITORING_EVENT_NAMES.PROVIDER_TIMEOUT, { dimensions }),
      { code: 'monitoring_dimension_value_rejected' },
    );
  }
});

test('opaque references are accepted but contact-shaped references are rejected', () => {
  const event = createMonitoringEvent(MONITORING_EVENT_NAMES.INDETERMINATE_JOB, {
    dimensions: { route: 'in_app', provider: 'durable_in_app', job_ref: 'job_00000001' },
  });
  assert.equal(event.dimensions.job_ref, 'job_00000001');

  assert.throws(
    () => createMonitoringEvent(MONITORING_EVENT_NAMES.INDETERMINATE_JOB, {
      dimensions: { route: 'in_app', provider: 'durable_in_app', job_ref: 'recipient@example.invalid' },
    }),
    { code: 'monitoring_dimension_value_rejected' },
  );
  assert.throws(
    () => createMonitoringEvent(MONITORING_EVENT_NAMES.INDETERMINATE_JOB, {
      dimensions: { route: 'in_app', provider: 'durable_in_app', job_ref: '15555550100' },
    }),
    { code: 'monitoring_dimension_value_rejected' },
  );
});

test('arbitrary dimension expansion is rejected by each event definition', () => {
  assert.throws(
    () => createMonitoringEvent(MONITORING_EVENT_NAMES.OUTBOX_BACKLOG, {
      dimensions: { route: 'in_app', provider: 'durable_in_app' },
    }),
    { code: 'monitoring_schema_field_not_allowed' },
  );
  assert.throws(
    () => createMonitoringEvent(MONITORING_EVENT_NAMES.PERMISSION_REVOCATION, {
      dimensions: { route: 'in_app', job_ref: 'job_00000001' },
    }),
    { code: 'monitoring_schema_field_not_allowed' },
  );
});

test('invalid timestamps, counters, event references, and environments are rejected', () => {
  const eventName = MONITORING_EVENT_NAMES.PROPOSAL_BACKLOG;
  assert.throws(
    () => createMonitoringEvent(eventName, { occurredAt: 'yesterday' }),
    { code: 'monitoring_occurred_at_invalid' },
  );
  assert.throws(
    () => createMonitoringEvent(eventName, { value: -1 }),
    { code: 'monitoring_measurement_invalid' },
  );
  assert.throws(
    () => createMonitoringEvent(eventName, { occurrences: 1.5 }),
    { code: 'monitoring_occurrences_invalid' },
  );
  assert.throws(
    () => createMonitoringEvent(eventName, { eventId: 'short' }),
    { code: 'monitoring_dimension_value_rejected' },
  );
  assert.throws(
    () => createMonitoringEvent(eventName, { environment: 'prod environment' }),
    { code: 'monitoring_environment_invalid' },
  );
});

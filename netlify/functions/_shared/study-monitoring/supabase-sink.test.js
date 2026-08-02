import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  MONITORING_EVENT_NAMES,
  createMonitoringEvent,
} from './monitoring.js';
import { createSupabaseAdultReviewMonitoringSink } from './supabase-sink.js';

test('persists only a validated v2 event through the worker-scoped RPC', async () => {
  const calls = [];
  const sink = createSupabaseAdultReviewMonitoringSink({
    workerIdentity: 'worker:synthetic',
    rpc: {
      isConfigured: () => true,
      async call(name, input) {
        calls.push({ name, input });
        return { recorded: true };
      },
    },
  });
  const event = createMonitoringEvent(MONITORING_EVENT_NAMES.OUTBOX_BACKLOG, {
    eventId: 'event_00000009',
    occurredAt: '2026-08-01T17:00:00.000Z',
    dimensions: { route: 'in_app' },
    value: 50,
  });
  await sink.write(event);
  assert.equal(sink.isReady(), true);
  assert.deepEqual(calls, [{
    name: 'academy_study_record_adult_review_monitoring_v2',
    input: { p_worker_id: 'worker:synthetic', p_event: event },
  }]);
});

test('is explicitly not-ready without durable RPC configuration', async () => {
  const sink = createSupabaseAdultReviewMonitoringSink({
    workerIdentity: 'worker:synthetic',
    rpc: { isConfigured: () => false, call: async () => ({ recorded: true }) },
  });
  assert.equal(sink.isReady(), false);
  await assert.rejects(() => sink.write({}), /not_ready/);
});

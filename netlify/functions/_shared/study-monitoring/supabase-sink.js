import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js';
import { createDurableMonitoringSink, validateMonitoringEvent } from './monitoring.js';

const WORKER_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

export function createSupabaseAdultReviewMonitoringSink(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options);
  const workerIdentity = options.workerIdentity;
  const configured = () => typeof workerIdentity === 'string'
    && WORKER_ID.test(workerIdentity)
    && rpc?.isConfigured?.() === true
    && typeof rpc.call === 'function';

  const sink = createDurableMonitoringSink(async (event) => {
    if (!configured()) throw new Error('adult_review_monitoring_sink_not_ready');
    if (!validateMonitoringEvent(event)) throw new Error('adult_review_monitoring_event_invalid');
    const result = await rpc.call('academy_study_record_adult_review_monitoring_v2', {
      p_worker_id: workerIdentity,
      p_event: event,
    });
    if (!result || result.recorded !== true || Object.keys(result).length !== 1) {
      throw new Error('adult_review_monitoring_persistence_contract');
    }
  }, 'supabase-adult-review');

  return Object.freeze({ ...sink, isReady: configured });
}

import { describe, expect, it } from 'vitest'
import { createAdminStudyOperationsSource } from './admin-study-operations-source.js'

const NOW = new Date('2026-08-10T16:00:00.000Z')
const SESSION_DEPENDENCIES = [
  'study-session-adapter', 'checkpoint-adapter', 'calendar-adapter',
  'parent-settings-adapter', 'event-ledger',
]

function readiness(status = 'ready') {
  return {
    check: async () => ({
      status,
      checkedAtMs: NOW.getTime() - 1_000,
      registrations: SESSION_DEPENDENCIES.map((dependency) => ({ dependency, status })),
    }),
  }
}

function probe(status = 'ready', contractVersion = 'future-authority.v1') {
  return { read: async () => ({ status, contractVersion, lastVerifiedAt: NOW.toISOString() }) }
}

function allEvidence(status = 'ready') {
  return {
    effectiveSettingsV2: probe(status),
    curriculumReleaseBinding: probe(status),
    boundContentRuntime: probe(status),
    providerCostAccounting: probe(status, 'admin-usage-cost.v2'),
    providerAttemptCoverage: probe(status),
    productionMount: probe(status, 'study-production.v1'),
  }
}

function workerEvidence(overrides = {}) {
  return {
    schemaVersion: 1,
    configuredState: 'configured',
    latestRunTimestamp: '2026-08-10T15:55:00.000Z',
    latestSuccessfulRunTimestamp: '2026-08-10T15:55:00.000Z',
    latestResultCategory: 'processed',
    stalenessClassification: 'healthy',
    workerVersion: 'adult-review-worker.v2',
    ...overrides,
  }
}

function workerSource(value = workerEvidence()) {
  return { read: async () => value }
}

describe('Admin Study Operations server source', () => {
  it('keeps unfinished integrations unavailable while preserving the configured schedule', async () => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness('not-ready'),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
    })
    const projection = await source.read()
    const byId = Object.fromEntries(projection.gates.map((gate) => [gate.id, gate]))

    expect(byId.effective_settings_v2).toMatchObject({
      status: 'unavailable', reasonCode: 'effective_settings_v2_not_integrated',
    })
    expect(byId.session_semantics).toMatchObject({ status: 'blocked', reasonCode: 'session_semantics_not_ready' })
    expect(byId.adult_review_worker_composition).toMatchObject({
      status: 'unavailable', reasonCode: 'source_unavailable',
    })
    expect(byId.adult_review_worker_schedule).toMatchObject({
      status: 'ready', reasonCode: 'adult_review_worker_schedule_configured',
    })
    expect(byId.adult_review_worker_run_evidence).toMatchObject({
      status: 'unavailable', reasonCode: 'source_unavailable', lastVerifiedAt: null,
    })
    expect(byId.provider_cost_accounting.reasonCode).toBe('provider_cost_accounting_not_integrated')
    expect(byId.provider_attempt_coverage.reasonCode).toBe('provider_attempt_coverage_not_integrated')
    expect(byId.production_mount).toMatchObject({ status: 'blocked', reasonCode: 'production_mount_blocked' })
    expect(projection.overallStatus).toBe('blocked')
  })

  it('represents independent ready, partial, manual-review, and unknown evidence', async () => {
    const evidence = allEvidence('ready')
    evidence.boundContentRuntime = probe('partial')
    evidence.curriculumReleaseBinding = probe('manual_review')
    evidence.providerAttemptCoverage = probe('unknown')
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: {
        list: async () => ({
          events: [{
            engine: 'study', eventType: 'study.session', occurredAt: '2026-08-10T15:55:00.000Z',
          }],
          rejectedRows: 0,
          sourceTruncated: false,
        }),
      },
      workerEvidenceSource: workerSource(),
      evidence,
    })
    const projection = await source.read()
    const byId = Object.fromEntries(projection.gates.map((gate) => [gate.id, gate]))
    expect(byId.session_semantics.status).toBe('ready')
    expect(byId.study_telemetry).toMatchObject({
      status: 'ready',
      reasonCode: 'study_telemetry_verified',
      lastVerifiedAt: '2026-08-10T15:55:00.000Z',
    })
    expect(byId.bound_content_runtime.status).toBe('partial')
    expect(byId.curriculum_release_binding.status).toBe('manual_review')
    expect(byId.provider_attempt_coverage.status).toBe('unknown')
    expect(byId.provider_cost_accounting.status).toBe('ready')
    expect(projection.overallStatus).toBe('partial')
  })

  it('does not leak learner, provider error, or telemetry payload data', async () => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: {
        list: async () => ({
          events: [{
            engine: 'study',
            eventType: 'study.session',
            occurredAt: '2026-08-10T15:55:00.000Z',
            learnerRef: 'learner-SECRET',
            transcript: 'private Tutor chat',
            metadata: { rawProviderError: 'provider SECRET' },
          }],
          rejectedRows: 0,
          sourceTruncated: false,
        }),
      },
      workerEvidenceSource: workerSource(),
      evidence: allEvidence(),
    })
    const serialized = JSON.stringify(await source.read())
    expect(serialized).not.toMatch(/learner|transcript|chat|provider SECRET|rawProviderError/i)
  })

  it('marks telemetry partial when bounded source evidence is incomplete', async () => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: {
        list: async () => ({ events: [], rejectedRows: 1, sourceTruncated: false }),
      },
      evidence: allEvidence(),
    })
    const telemetry = (await source.read()).gates.find((gate) => gate.id === 'study_telemetry')
    expect(telemetry).toMatchObject({ status: 'partial', reasonCode: 'study_telemetry_partial' })
  })

  it('keeps a disabled production mount explicitly not configured', async () => {
    const source = createAdminStudyOperationsSource({
      env: {},
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
    })
    const mount = (await source.read()).gates.find((gate) => gate.id === 'production_mount')
    expect(mount).toMatchObject({ status: 'not_configured', reasonCode: 'study_feature_disabled' })
  })

  it.each([
    ['no run evidence', workerEvidence({
      latestRunTimestamp: null,
      latestSuccessfulRunTimestamp: null,
      latestResultCategory: null,
      stalenessClassification: 'unknown',
      workerVersion: null,
    }), 'unknown', 'adult_review_worker_no_run_evidence'],
    ['fresh no_work', workerEvidence({ latestResultCategory: 'no_work' }), 'ready', 'adult_review_worker_no_work'],
    ['fresh processed', workerEvidence(), 'ready', 'adult_review_worker_processed'],
    ['fresh partial', workerEvidence({
      latestSuccessfulRunTimestamp: null,
      latestResultCategory: 'partial_with_retryable_failures',
      stalenessClassification: 'degraded',
    }), 'partial', 'adult_review_worker_partial'],
    ['failed', workerEvidence({
      latestSuccessfulRunTimestamp: null,
      latestResultCategory: 'failed',
      stalenessClassification: 'degraded',
    }), 'blocked', 'adult_review_worker_failed'],
    ['unavailable', workerEvidence({
      latestSuccessfulRunTimestamp: null,
      latestResultCategory: 'unavailable',
      stalenessClassification: 'unavailable',
    }), 'unavailable', 'adult_review_worker_unavailable'],
    ['greater-than-15-minute stale result', workerEvidence({
      stalenessClassification: 'degraded',
    }), 'partial', 'adult_review_worker_run_stale'],
  ])('maps %s conservatively from server-derived evidence', async (
    _label,
    evidenceValue,
    expectedStatus,
    expectedReason,
  ) => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
      workerEvidenceSource: workerSource(evidenceValue),
    })
    const projection = await source.read()
    const byId = Object.fromEntries(projection.gates.map((item) => [item.id, item]))
    expect(byId.adult_review_worker_composition.status).toBe('ready')
    expect(byId.adult_review_worker_schedule.status).toBe('ready')
    expect(byId.adult_review_worker_run_evidence).toMatchObject({
      status: expectedStatus,
      reasonCode: expectedReason,
      lastVerifiedAt: evidenceValue.latestRunTimestamp,
    })
    expect(projection.workerEvidence).toEqual(evidenceValue)
  })

  it('keeps schedule configuration independent from durable run health', async () => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
      workerEvidenceSource: workerSource(workerEvidence({
        latestRunTimestamp: null,
        latestSuccessfulRunTimestamp: null,
        latestResultCategory: null,
        stalenessClassification: 'unknown',
        workerVersion: null,
      })),
    })
    const byId = Object.fromEntries((await source.read()).gates.map((item) => [item.id, item]))
    expect(byId.adult_review_worker_schedule.status).toBe('ready')
    expect(byId.adult_review_worker_run_evidence.status).toBe('unknown')
  })

  it('reports a missing schedule without collapsing configured worker evidence', async () => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
      workerEvidenceSource: workerSource(),
      workerSchedule: null,
    })
    const byId = Object.fromEntries((await source.read()).gates.map((item) => [item.id, item]))
    expect(byId.adult_review_worker_composition.status).toBe('ready')
    expect(byId.adult_review_worker_schedule).toMatchObject({
      status: 'not_configured', reasonCode: 'adult_review_worker_schedule_absent',
    })
    expect(byId.adult_review_worker_run_evidence.status).toBe('ready')
  })

  it.each([
    ['malformed projection', { read: async () => ({ ...workerEvidence(), learnerId: 'private' }) }],
    ['permission denied', { read: async () => { throw new Error('permission denied: private SQL') } }],
  ])('fails closed for %s without exposing source detail', async (_label, workerEvidenceSource) => {
    const source = createAdminStudyOperationsSource({
      env: { ACADEMY_STUDY_ENABLED: 'true' },
      now: () => NOW,
      readinessService: readiness(),
      telemetrySource: { list: async () => ({ events: [], rejectedRows: 0, sourceTruncated: false }) },
      workerEvidenceSource,
    })
    const projection = await source.read()
    const byId = Object.fromEntries(projection.gates.map((item) => [item.id, item]))
    expect(projection.workerEvidence).toBeNull()
    expect(byId.adult_review_worker_composition.reasonCode).toBe('source_unavailable')
    expect(byId.adult_review_worker_schedule.status).toBe('ready')
    expect(byId.adult_review_worker_run_evidence.reasonCode).toBe('source_unavailable')
    expect(JSON.stringify(projection)).not.toMatch(/learner|private SQL|permission denied/i)
  })
})

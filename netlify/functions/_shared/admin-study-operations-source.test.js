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
    workerHealth: {
      read: async () => ({ composition: await probe(status).read(), schedule: await probe(status).read() }),
    },
    providerCostAccounting: probe(status, 'admin-usage-cost.v2'),
    providerAttemptCoverage: probe(status),
    productionMount: probe(status, 'study-production.v1'),
  }
}

describe('Admin Study Operations server source', () => {
  it('keeps unfinished integrations unavailable and worker schedule absent', async () => {
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
      status: 'unavailable', reasonCode: 'adult_review_worker_not_composed',
    })
    expect(byId.adult_review_worker_schedule).toMatchObject({
      status: 'unavailable', reasonCode: 'adult_review_worker_schedule_absent', lastVerifiedAt: null,
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
})

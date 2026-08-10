import { describe, expect, it, vi } from 'vitest'
import { ADMIN_OVERVIEW_ENDPOINT, AdminOverviewReadError, parseAdminOverview, readAdminOverview } from './overviewHttpSource'
import { providerAccountingCoverageFixture } from './costsTestFixtures'

const metric = <T,>(value: T) => ({ status: 'available', value })
const unavailable = { status: 'unavailable' }

function domain(data: unknown, overrides: Record<string, unknown> = {}) {
  return {
    availability: 'available', freshness: 'current', completeness: 'complete', observationStatus: 'current', reasonCode: null,
    window: { kind: 'fixed', label: 'Fixed source window', startInclusive: null, endExclusive: null, observedAt: '2026-08-09T14:20:00.000Z' },
    data,
    ...overrides,
  }
}

function wire() {
  const engine = {
    engineId: 'tutor', health: 'healthy', freshness: 'current', observedAt: '2026-08-09T14:20:00.000Z',
    windowStart: '2026-08-09T14:15:00.000Z', windowEnd: '2026-08-09T14:30:00.000Z', appVersion: 'build-1',
    engineVersion: 'tutor-1', curriculumVersion: '1.0.0', eventCount: 1, eligibleEventCount: 1, successCount: 1,
    successRatePercent: 100, fallbackCount: 0, fallbackRatePercent: 0, rejectedCount: 0, timeoutCount: 0,
    timeoutRatePercent: 0, providerErrorCount: 0, providerErrorRatePercent: 0, validationErrorCount: 0,
    safetyStopCount: 0, p50LatencyMs: 120, p95LatencyMs: 120, reasonCodes: ['operating_normally'],
  }
  return {
    contractVersion: 2,
    generatedAt: '2026-08-09T14:30:00.000Z',
    range: { kind: '7-days', start: '2026-08-03', end: '2026-08-09', startInclusive: '2026-08-03T00:00:00.000Z', endExclusive: '2026-08-10T00:00:00.000Z', days: 7, timezone: 'UTC' },
    academy: domain({ environment: metric('production'), appVersion: metric('build-1'), curriculumVersion: metric('1.0.0'), overallTechnicalHealth: metric('healthy'), lastSuccessfulRefresh: unavailable }),
    learners: domain({ activeLearners: metric(3), lessonsStarted: unavailable, lessonsCompleted: unavailable, studySessions: unavailable, instructionalMinutes: unavailable }),
    engineHealth: domain({ overallHealth: 'healthy', overallReasonCodes: [], historyMetrics: { p50LatencyMs: 120 }, engines: [engine], services: [] }),
    enginePerformance: domain({ engines: [{ engineId: 'tutor', evidenceState: 'partial' }], qualityScore: unavailable }, { freshness: 'unknown', observationStatus: 'unknown' }),
    costs: domain({
      currency: 'USD', requests: metric(2), inputTokens: metric(10), outputTokens: metric(4), cachedInputReadTokens: metric(3),
      cachedInputWriteTokens: metric(2), ttsCharacters: metric(0), calculatedCost: { status: 'available', micros: '9007199254740993', currency: 'USD' },
      reconciledCost: { status: 'available', micros: '2100000', currency: 'USD' }, billingDispositionCounts: { billable: 2, notBillable: 0, unknown: 0 },
      reasons: [], providerAccountingCoverage: providerAccountingCoverageFixture(),
    }, { freshness: 'unknown', observationStatus: 'unknown', window: { kind: 'requested', label: 'Requested UTC range', startInclusive: '2026-08-03T00:00:00.000Z', endExclusive: '2026-08-10T00:00:00.000Z', observedAt: null } }),
    safety: domain({ openSafetyStops: metric(0), adultReviewsPending: metric(1), failClosedEvents: metric(0) }, { freshness: 'unknown', observationStatus: 'unknown' }),
    system: domain({ apiErrorRatePercent: unavailable, medianLatencyMs: metric(120), syncFailures: metric(0), persistenceFailures: metric(0) }),
    curriculum: domain({ publishedVersion: metric('1.0.0'), validationState: metric('passed'), validatedAt: metric('2026-08-08T00:00:00.000Z'), validationArtifactVersion: metric('validation-v1'), coverageWarning: unavailable }, { freshness: 'unknown', observationStatus: 'unknown' }),
  }
}

describe('Admin Overview HTTP source', () => {
  it('loads the real overview endpoint with the bearer and maps composed domains', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => wire() }))
    const model = await readAdminOverview({ kind: 'preset', preset: '7-days' }, {
      getAccessToken: async () => 'trusted-token', fetchImpl,
    })
    expect(fetchImpl).toHaveBeenCalledWith(`${ADMIN_OVERVIEW_ENDPOINT}?range=7-days`, expect.objectContaining({
      method: 'GET', headers: { Authorization: 'Bearer trusted-token' }, cache: 'no-store',
    }))
    expect(model.learners.activeLearners).toEqual(metric(3))
    expect(model.ai.spend).toMatchObject({ status: 'available', costMicros: '9007199254740993', costKind: 'calculated' })
    expect(model.ai.reconciledSpend).toMatchObject({ status: 'available', costMicros: '2100000', costKind: 'reconciled' })
    expect(model.ai.providerAccounting).toMatchObject({
      status: 'partial', journalStatus: 'complete_for_journaled_attempts',
      invoiceCompletenessClaim: false,
    })
    expect(model.enginePerformance).toEqual([{ engineId: 'tutor', evidenceState: 'partial' }])
    expect(model.curriculum?.coverageWarning).toEqual(unavailable)
  })

  it('encodes custom dates and rejects malformed or unauthorized responses', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, json: async () => wire() }))
    await readAdminOverview({ kind: 'custom', start: '2026-08-01', end: '2026-08-09' }, {
      getAccessToken: async () => 'token', fetchImpl,
    })
    const [requestedUrl] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(requestedUrl).toBe(`${ADMIN_OVERVIEW_ENDPOINT}?range=custom&start=2026-08-01&end=2026-08-09`)
    expect(parseAdminOverview({ ...wire(), contractVersion: 1 })).toBeNull()
    await expect(readAdminOverview({ kind: 'preset', preset: 'today' }, {
      getAccessToken: async () => 'token', fetchImpl: async () => ({ status: 403, json: async () => ({}) }),
    })).rejects.toEqual(expect.objectContaining<Partial<AdminOverviewReadError>>({ code: 'overview_unauthorized' }))
  })
})

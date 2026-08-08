import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { AdminEngineId } from '../../admin/admin0Vocabulary'
import { adaptAdminOverview, type AdminOverviewSource } from '../../admin/overviewAdapter'
import type { AdminConsoleProps, EngineObservation } from '../../admin/overviewModel'
import { AdminConsole } from './AdminConsole'

const OBSERVED_AT = '2026-08-08T14:00:00.000Z'

function engine(engineId: AdminEngineId, health: EngineObservation['health'] = 'healthy'): EngineObservation {
  return {
    engineId,
    health,
    appVersion: 'build-2026.08.08.1',
    engineVersion: `${engineId}-v1`,
    observedAt: OBSERVED_AT,
    windowStart: '2026-08-08T13:00:00.000Z',
    windowEnd: OBSERVED_AT,
    reasonCodes: health === 'degraded' ? ['elevated_latency'] : health === 'disabled' ? ['feature_disabled'] : [],
  }
}

function completeSource(overrides: Partial<AdminOverviewSource> = {}): AdminOverviewSource {
  return {
    range: { kind: 'preset', preset: 'today' },
    observedAt: OBSERVED_AT,
    freshness: 'current',
    academy: {
      environment: 'Production', appVersion: 'build-2026.08.08.1', curriculumVersion: '1.0.0',
      overallHealth: 'healthy', lastSuccessfulDataRefresh: '2026-08-08T13:55:00.000Z',
    },
    learners: { activeLearners: 4, lessonsStarted: 8, lessonsCompleted: 5, studySessions: 3, instructionalMinutes: 126 },
    engines: [
      engine('tutor'), engine('study', 'degraded'), engine('assessment'), engine('curriculum'),
      engine('jarvis', 'unknown'), engine('tts', 'disabled'), engine('gateway'), engine('sync', 'unavailable'),
    ],
    ai: {
      requests: 42, inputTokens: 12000, outputTokens: 3600, ttsCharacters: 8000,
      spend: { costMicros: '1840000', costKind: 'calculated', currency: 'USD' },
    },
    safety: {
      openSafetyStops: { evidence: 'complete', value: 1 },
      adultReviewsPending: { evidence: 'complete', value: 2 },
      safeguardFailures: { evidence: 'complete', value: 0 },
    },
    system: { apiErrorRatePercent: 0.35, latencyMs: 284, syncFailures: 0, persistenceFailures: 1 },
    ...overrides,
  }
}

const AUTHORIZED = {
  status: 'authorized', role: 'viewer', capabilities: ['overview:read'],
} as const

function authorized(
  source = completeSource(),
  extra: Partial<Extract<AdminConsoleProps, { authorization: { status: 'authorized' } }>> = {},
) {
  const model = adaptAdminOverview(source)
  return renderToStaticMarkup(
    <AdminConsole
      authorization={AUTHORIZED}
      overview={{ status: 'ready', model }}
      selectedRange={source.range}
      onRangeChange={() => {}}
      {...extra}
    />,
  )
}

describe('AdminConsole authorization and load states', () => {
  it('does not render sensitive content while authorization is unresolved', () => {
    const props = {
      authorization: { status: 'resolving' },
      overview: { status: 'ready', model: adaptAdminOverview(completeSource()) },
    } as unknown as AdminConsoleProps
    const markup = renderToStaticMarkup(<AdminConsole {...props} />)
    expect(markup).toContain('Verifying access')
    expect(markup).not.toContain('Production')
    expect(markup).not.toContain('Active learners')
  })

  it('renders only vetted copy for an unauthorized server result', () => {
    const props = {
      authorization: {
        status: 'unauthorized', reasonCode: 'admin_assignment_required',
        rawMessage: 'raw learner transcript: SECRET',
      },
    } as unknown as AdminConsoleProps
    const markup = renderToStaticMarkup(<AdminConsole {...props} />)
    expect(markup).toContain('active Admin assignment')
    expect(markup).not.toContain('SECRET')
    expect(markup).not.toContain('Academy status')
  })

  it('requires overview:read even after server-resolved role authorization', () => {
    const secretModel = adaptAdminOverview(completeSource({ academy: {
      environment: 'SENSITIVE ENVIRONMENT', appVersion: 'build-1', curriculumVersion: '1.0.0',
      overallHealth: 'healthy', lastSuccessfulDataRefresh: OBSERVED_AT,
    } }))
    const markup = renderToStaticMarkup(
      <AdminConsole
        authorization={{ status: 'authorized', role: 'admin', capabilities: ['engines:operate'] }}
        overview={{ status: 'ready', model: secretModel }}
        selectedRange={{ kind: 'preset', preset: 'today' }}
        onRangeChange={() => {}}
      />,
    )
    expect(markup).toContain('does not include overview access')
    expect(markup).not.toContain('SENSITIVE ENVIRONMENT')
    expect(markup).not.toContain('Active learners')
  })

  it('renders loading without numeric-looking metric placeholders', () => {
    const markup = renderToStaticMarkup(
      <AdminConsole authorization={AUTHORIZED} overview={{ status: 'loading' }} selectedRange={{ kind: 'preset', preset: 'today' }} onRangeChange={() => {}} />,
    )
    expect(markup).toContain('Loading academy overview')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('Active learners')
  })

  it('maps an error code to vetted copy and never renders injected exception text', () => {
    const overview = {
      status: 'error', code: 'overview_timeout', rawException: 'SECRET raw database exception',
    } as const
    const markup = renderToStaticMarkup(
      <AdminConsole authorization={AUTHORIZED} overview={overview} selectedRange={{ kind: 'preset', preset: 'today' }} onRangeChange={() => {}} />,
    )
    expect(markup).toContain('overview request timed out')
    expect(markup).not.toContain('SECRET')
  })
})

describe('AdminConsole canonical overview presentation', () => {
  it('renders all eight canonical engines through separate display labels', () => {
    const markup = authorized()
    for (const label of ['Tutor', 'Study', 'Assessment', 'Curriculum', 'Jarvis', 'TTS', 'Gateway', 'Sync']) {
      expect(markup).toContain(`>${label}<`)
    }
    expect(markup).toContain('View Gateway engine details')
  })

  it('renders valid data, observation time, and exact calculated spend wording', () => {
    const markup = authorized()
    for (const label of ['Academy status', 'Learners', 'Engine health', 'AI &amp; speech', 'Safety', 'System']) {
      expect(markup).toContain(label)
    }
    expect(markup).toContain('Observed at')
    expect(markup).toContain(OBSERVED_AT)
    expect(markup).toContain('$1.84')
    expect(markup).toContain('Estimated spend')
    expect(markup).toContain('not reconciled provider invoices')
  })

  it('labels reconciled cost explicitly', () => {
    const source = completeSource({ ai: {
      requests: 1, inputTokens: 1, outputTokens: 1, ttsCharacters: 0,
      spend: { costMicros: '2000000', costKind: 'reconciled', currency: 'USD' },
    } })
    const markup = authorized(source)
    expect(markup).toContain('Reconciled spend')
    expect(markup).toContain('$2.00')
  })

  it('renders real zeros as zero', () => {
    const source = completeSource({
      learners: { activeLearners: 0, lessonsStarted: 0, lessonsCompleted: 0, studySessions: 0, instructionalMinutes: 0 },
      safety: {
        openSafetyStops: { evidence: 'complete', value: 0 },
        adultReviewsPending: { evidence: 'complete', value: 0 },
        safeguardFailures: { evidence: 'complete', value: 0 },
      },
      system: { apiErrorRatePercent: 0, latencyMs: 0, syncFailures: 0, persistenceFailures: 0 },
      ai: { requests: 0, inputTokens: 0, outputTokens: 0, ttsCharacters: 0, spend: { costMicros: '0', costKind: 'calculated', currency: 'USD' } },
    })
    const markup = authorized(source)
    expect(markup).toContain('$0.00')
    expect(markup).toContain('0 min')
  })

  it('keeps unavailable and unknown evidence distinct without fake costs', () => {
    const source = completeSource({
      learners: { activeLearners: 2, lessonsStarted: null, lessonsCompleted: null, studySessions: null, instructionalMinutes: null },
      ai: { requests: null, inputTokens: null, outputTokens: null, ttsCharacters: null, spend: { costMicros: null, costKind: 'unavailable', currency: 'USD' } },
      safety: {
        openSafetyStops: { evidence: 'incomplete' },
        adultReviewsPending: { evidence: 'unavailable' },
        safeguardFailures: { evidence: 'complete', value: 0 },
      },
    })
    const markup = authorized(source)
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('Unknown')
    expect(markup).not.toContain('$0.00')
  })

  it('maps stale and engine reason codes to safe display copy', () => {
    const unsafeEngine = {
      ...engine('tutor', 'degraded'),
      reasonCodes: ['raw learner transcript: SECRET'],
    } as unknown as EngineObservation
    const markup = authorized(completeSource({
      freshness: 'stale', staleReasonCode: 'telemetry_incomplete', engines: [unsafeEngine],
    }))
    expect(markup).toContain('Data may be out of date')
    expect(markup).toContain('Current operational evidence is incomplete')
    expect(markup).toContain('Additional operational detail is unavailable')
    expect(markup).not.toContain('SECRET')
  })

  it('distinguishes unknown, disabled, unavailable, and healthy with text labels', () => {
    const markup = authorized()
    expect(markup).toMatch(/Jarvis[\s\S]*?Unknown/)
    expect(markup).toMatch(/TTS[\s\S]*?Disabled/)
    expect(markup).toMatch(/Sync[\s\S]*?Unavailable/)
    expect(markup).not.toMatch(/Jarvis[\s\S]{0,200}?Healthy/)
  })

  it('retains accessibility and keyboard affordances', () => {
    const markup = authorized()
    expect(markup).toContain('Skip to overview')
    expect(markup).toContain('aria-label="Admin sections"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('aria-label="Overview time range"')
    expect(markup).toContain('Viewer operator session')
  })

  it('renders the custom range editor without calculating data locally', () => {
    const range = { kind: 'custom', start: '2026-08-01', end: '2026-08-08' } as const
    const markup = authorized(completeSource({ range }), { selectedRange: range })
    expect(markup).toContain('type="date"')
    expect(markup).toContain('value="2026-08-01"')
    expect(markup).toContain('value="2026-08-08"')
  })
})

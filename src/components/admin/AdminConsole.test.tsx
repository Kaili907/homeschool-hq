import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminEngineId } from '../../admin/admin0Vocabulary'
import { adaptAdminOverview, type AdminOverviewSource, type CostSource } from '../../admin/overviewAdapter'
import type { AdminConsoleProps, EngineObservation } from '../../admin/overviewModel'
import { AdminConsole, AdminShell, applyAdminRoutePresentation } from './AdminConsole'

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

function costSource(overrides: Partial<CostSource> = {}): CostSource {
  return {
    costMicros: '1840000', costKind: 'calculated', billingDisposition: 'billable', currency: 'USD',
    completeness: 'complete', result: 'success', resultReasonCode: null, ...overrides,
  }
}

function completeSource(overrides: Partial<AdminOverviewSource> = {}): AdminOverviewSource {
  return {
    contractVersion: 2,
    range: { kind: 'preset', preset: 'today' },
    observedAt: OBSERVED_AT,
    freshness: 'current',
    academy: {
      environment: 'Production', appVersion: 'build-2026.08.08.1',
      curriculumVersion: { applicability: 'trusted', version: '1.0.0' },
      overallHealth: 'healthy', lastSuccessfulDataRefresh: '2026-08-08T13:55:00.000Z',
    },
    learners: { activeLearners: 4, lessonsStarted: 8, lessonsCompleted: 5, studySessions: 3, instructionalMinutes: 126 },
    engines: [
      engine('tutor'), engine('study', 'degraded'), engine('assessment'), engine('curriculum'),
      engine('jarvis', 'unknown'), engine('tts', 'disabled'), engine('gateway'), engine('sync', 'unavailable'),
    ],
    ai: {
      requests: 42, inputTokens: 12000, outputTokens: 3600,
      cachedInputReadTokens: 2100, cachedInputWriteTokens: 425, ttsCharacters: 8000,
      spend: costSource(),
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
    expect(markup).toContain('href="/academy"')
    expect(markup).not.toContain('SECRET')
    expect(markup).not.toContain('Academy status')
  })

  it('requires overview:read even after server-resolved role authorization', () => {
    const secretModel = adaptAdminOverview(completeSource({ academy: {
      environment: 'SENSITIVE ENVIRONMENT', appVersion: 'build-1',
      curriculumVersion: { applicability: 'trusted', version: '1.0.0' },
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

  it('shows only capability-authorized operational destinations in the canonical shell', () => {
    const markup = renderToStaticMarkup(
      <AdminShell
        authorization={{ status: 'authorized', role: 'viewer', capabilities: ['costs:read', 'health:read'] }}
        activeSection="costs"
        title="AI & Costs"
      >
        <p>Authorized cost surface</p>
      </AdminShell>,
    )
    expect(markup).toContain('AI &amp; Costs')
    expect(markup).toContain('System Health')
    expect(markup).toContain('aria-current="page"')
    expect(markup).not.toContain('>Overview<')
    expect(markup).not.toContain('>Learners<')
    expect(markup).not.toContain('Configuration')
    expect(markup).not.toContain('Audit Log')
    expect(markup).not.toContain('Releases')
  })

  it('keeps exactly one named main landmark and accessible nav names in the shell', () => {
    const markup = renderToStaticMarkup(
      <AdminShell
        authorization={{ status: 'authorized', role: 'viewer', capabilities: ['overview:read', 'learners:read', 'engines:read'] }}
        activeSection="overview"
        title="Overview"
      >
        <section>Authorized surface</section>
      </AdminShell>,
    )
    expect(markup.match(/<main\b/g)).toHaveLength(1)
    expect(markup.match(/id="admin-main"/g)).toHaveLength(1)
    for (const label of ['Overview', 'Learners', 'Engine Performance']) {
      expect(markup).toContain('aria-label="' + label + '"')
    }
  })

  it('includes Configuration navigation only with the server-resolved read capability', () => {
    const markup = renderToStaticMarkup(
      <AdminShell
        authorization={{ status: 'authorized', role: 'viewer', capabilities: ['configuration:read'] }}
        activeSection="configuration"
        title="Configuration"
      ><section>Configuration surface</section></AdminShell>,
    )
    expect(markup).toContain('aria-label="Configuration"')
    expect(markup).toContain('aria-current="page"')
  })

  it('includes the safe Access & Permissions view for the canonical baseline read capability', () => {
    const markup = renderToStaticMarkup(
      <AdminShell
        authorization={{ status: 'authorized', role: 'viewer', capabilities: ['overview:read'] }}
        activeSection="access"
        title="Access & Permissions"
      ><section>Safe access surface</section></AdminShell>,
    )
    expect(markup).toContain('aria-label="Access &amp; Permissions"')
    expect(markup).toContain('aria-current="page"')
  })

  it('updates the route title and moves focus to the route heading', () => {
    const focus = vi.fn()
    const documentTarget = { title: '' }
    applyAdminRoutePresentation('System Health', documentTarget, { focus })
    expect(documentTarget.title).toBe('System Health | Manuel Academy Admin')
    expect(focus).toHaveBeenCalledOnce()
  })

  it('contains tablet accessible-name and mobile overflow safeguards', () => {
    const css = readFileSync(new URL('./admin-console.css', import.meta.url), 'utf8')
    const tablet = css.slice(css.indexOf('@media (max-width: 1120px)'), css.indexOf('@media (max-width: 820px)'))
    const mobile = css.slice(css.indexOf('@media (max-width: 600px)'), css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(tablet).toContain('.admin-nav-text')
    expect(tablet).toContain('clip: rect(0, 0, 0, 0)')
    expect(tablet).not.toMatch(/\.admin-nav-text[^}]*display:\s*none/)
    expect(mobile).toContain('.admin-sidebar nav::after')
    expect(mobile).toContain('overflow-x: auto')
    expect(mobile).toContain('.admin-main { padding: 1rem .75rem 2.5rem; }')
    expect(css).toContain('overflow-x: clip')
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
      <AdminConsole authorization={AUTHORIZED} overview={overview} selectedRange={{ kind: 'preset', preset: 'today' }} onRangeChange={() => {}} onRetry={() => {}} />,
    )
    expect(markup).toContain('overview request timed out')
    expect(markup).not.toContain('SECRET')
    expect(markup).toContain('Try again')
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
    expect(markup).toContain('Calculated provider cost (estimate)')
    expect(markup).toContain('Billable usage')
    expect(markup).toContain('Cached input read tokens')
    expect(markup).toContain('2,100')
    expect(markup).toContain('Cached input write tokens')
    expect(markup).toContain('425')
    expect(markup).toContain('not reconciled provider invoices')
  })

  it('labels reconciled cost explicitly', () => {
    const source = completeSource({ ai: {
      requests: 1, inputTokens: 1, outputTokens: 1, cachedInputReadTokens: 0,
      cachedInputWriteTokens: 0, ttsCharacters: 0,
      spend: costSource({ costMicros: '2000000', costKind: 'reconciled' }),
    } })
    const markup = authorized(source)
    expect(markup).toContain('Reconciled provider cost')
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
      ai: {
        requests: 0, inputTokens: 0, outputTokens: 0, cachedInputReadTokens: 0,
        cachedInputWriteTokens: 0, ttsCharacters: 0, spend: costSource({ costMicros: '0' }),
      },
    })
    const markup = authorized(source)
    expect(markup).toContain('$0.00')
    expect(markup).toContain('Billable usage')
    expect(markup).toContain('0 min')
  })

  it('distinguishes calculated billable zero from explicitly non-billable zero', () => {
    const billable = authorized(completeSource({ ai: {
      requests: 0, inputTokens: 0, outputTokens: 0, cachedInputReadTokens: 0,
      cachedInputWriteTokens: 0, ttsCharacters: 0,
      spend: costSource({ costMicros: '0', billingDisposition: 'billable' }),
    } }))
    const notBillable = authorized(completeSource({ ai: {
      requests: 0, inputTokens: 0, outputTokens: 0, cachedInputReadTokens: 0,
      cachedInputWriteTokens: 0, ttsCharacters: 0,
      spend: costSource({ costMicros: '0', billingDisposition: 'not_billable' }),
    } }))
    expect(billable).toContain('Billable usage')
    expect(notBillable).toContain('Explicitly not billable')
  })

  it('keeps unavailable and unknown evidence distinct without fake costs', () => {
    const source = completeSource({
      learners: { activeLearners: 2, lessonsStarted: null, lessonsCompleted: null, studySessions: null, instructionalMinutes: null },
      ai: {
        requests: null, inputTokens: null, outputTokens: null, cachedInputReadTokens: null,
        cachedInputWriteTokens: null, ttsCharacters: null,
        spend: costSource({
          costMicros: null, costKind: 'unavailable', billingDisposition: 'unknown',
          completeness: 'partial_usage_unavailable', resultReasonCode: 'missing_provider_usage',
        }),
      },
      safety: {
        openSafetyStops: { evidence: 'incomplete' },
        adultReviewsPending: { evidence: 'unavailable' },
        safeguardFailures: { evidence: 'complete', value: 0 },
      },
    })
    const markup = authorized(source)
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('Unknown')
    expect(markup).toContain('Billing disposition unknown')
    expect(markup).toContain('Aggregate is partial because some trustworthy usage was unavailable')
    expect(markup).toContain('Trustworthy provider usage was unavailable')
    expect(markup).not.toContain('$0.00')
  })

  it('renders version inapplicability separately from unknown curriculum evidence', () => {
    const engines = completeSource().engines.map((item) => item.engineId === 'gateway' ? { ...item, engineVersion: null } : item)
    const notApplicable = authorized(completeSource({
      engines,
      academy: {
        environment: 'Production', appVersion: 'build-2026.08.08.1',
        curriculumVersion: { applicability: 'not_applicable' }, overallHealth: 'healthy',
        lastSuccessfulDataRefresh: OBSERVED_AT,
      },
    }))
    const unknown = authorized(completeSource({ academy: {
      environment: 'Production', appVersion: 'build-2026.08.08.1',
      curriculumVersion: { applicability: 'unknown' }, overallHealth: 'healthy',
      lastSuccessfulDataRefresh: OBSERVED_AT,
    } }))
    expect(notApplicable).toContain('Version not applicable')
    expect(notApplicable).toContain('Not applicable')
    expect(unknown).toContain('Unknown')
  })

  it('never renders a raw cost reason or attribution identity', () => {
    const source = completeSource({ ai: {
      requests: 1, inputTokens: 1, outputTokens: 1, cachedInputReadTokens: 0,
      cachedInputWriteTokens: 0, ttsCharacters: 0,
      spend: { ...costSource({ completeness: 'partial_attribution_ambiguous' }), resultReasonCode: 'raw provider SECRET' } as unknown as CostSource,
    } })
    const markup = authorized(source)
    expect(markup).toContain('attribution was ambiguous')
    expect(markup).toContain('Additional cost detail is unavailable')
    expect(markup).not.toContain('SECRET')
    expect(markup).not.toContain('accountRef')
    expect(markup).not.toContain('householdRef')
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

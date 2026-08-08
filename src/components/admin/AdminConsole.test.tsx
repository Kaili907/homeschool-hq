import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { adaptAdminOverview, type AdminOverviewSource } from '../../admin/overviewAdapter'
import type { AdminConsoleProps } from '../../admin/overviewModel'
import { AdminConsole } from './AdminConsole'

function completeSource(overrides: Partial<AdminOverviewSource> = {}): AdminOverviewSource {
  return {
    range: { kind: 'preset', preset: 'today' },
    freshness: 'current',
    academy: {
      environment: 'Production', appVersion: '2.8.1', curriculumVersion: '1.0.0',
      overallHealth: 'healthy', lastSuccessfulDataRefresh: 'Aug 8, 2026 at 9:42 AM',
    },
    learners: {
      activeLearners: 4, lessonsStarted: 8, lessonsCompleted: 5,
      studySessions: 3, instructionalMinutes: 126,
    },
    engines: [
      { name: 'Tutor', health: 'healthy', href: '/academy/admin/engines/tutor' },
      { name: 'Study', health: 'degraded', detail: 'Elevated latency' },
      { name: 'Assessment', health: 'healthy' },
      { name: 'Jarvis', health: 'unknown' },
      { name: 'TTS', health: 'disabled' },
      { name: 'Sync', health: 'unavailable' },
    ],
    ai: {
      requests: 42, inputTokens: 12000, outputTokens: 3600, ttsCharacters: 8000,
      spend: { amountUsd: 1.84, basis: 'estimated' },
    },
    safety: { openSafetyStops: 1, adultReviewsPending: 2, safeguardFailures: 0 },
    system: { apiErrorRatePercent: 0.35, latencyMs: 284, syncFailures: 0, persistenceFailures: 1 },
    ...overrides,
  }
}

function authorized(source = completeSource(), extra: Partial<Extract<AdminConsoleProps, { authorization: 'authorized' }>> = {}) {
  const model = adaptAdminOverview(source)
  return renderToStaticMarkup(
    <AdminConsole
      authorization="authorized"
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
      authorization: 'resolving',
      overview: { status: 'ready', model: adaptAdminOverview(completeSource()) },
    } as unknown as AdminConsoleProps
    const markup = renderToStaticMarkup(<AdminConsole {...props} />)
    expect(markup).toContain('Verifying access')
    expect(markup).not.toContain('Production')
    expect(markup).not.toContain('Active learners')
  })

  it('renders an unauthorized state without an overview payload', () => {
    const markup = renderToStaticMarkup(<AdminConsole authorization="unauthorized" reason="Administrator role required." />)
    expect(markup).toContain('Access unavailable')
    expect(markup).toContain('Administrator role required.')
    expect(markup).not.toContain('Academy status')
  })

  it('renders a labeled loading state without metric placeholders that look numeric', () => {
    const markup = renderToStaticMarkup(
      <AdminConsole authorization="authorized" overview={{ status: 'loading' }} selectedRange={{ kind: 'preset', preset: 'today' }} onRangeChange={() => {}} />,
    )
    expect(markup).toContain('Loading academy overview')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('Active learners')
  })

  it('renders a recoverable error state', () => {
    const retry = vi.fn()
    const markup = renderToStaticMarkup(
      <AdminConsole authorization="authorized" overview={{ status: 'error', message: 'Telemetry timed out.' }} selectedRange={{ kind: 'preset', preset: 'today' }} onRangeChange={() => {}} onRetry={retry} />,
    )
    expect(markup).toContain('Overview unavailable')
    expect(markup).toContain('Telemetry timed out.')
    expect(markup).toContain('Try again')
  })
})
describe('AdminConsole overview states and meaning', () => {
  it('renders valid data and all required overview surfaces', () => {
    const markup = authorized()
    for (const label of ['Academy status', 'Learners', 'Engine health', 'AI &amp; speech', 'Safety', 'System']) {
      expect(markup).toContain(label)
    }
    expect(markup).toContain('126 min')
    expect(markup).toContain('$1.84')
    expect(markup).toContain('Not a reconciled provider invoice')
  })

  it('renders real zeros as zero', () => {
    const source = completeSource({
      learners: { activeLearners: 0, lessonsStarted: 0, lessonsCompleted: 0, studySessions: 0, instructionalMinutes: 0 },
      safety: { openSafetyStops: 0, adultReviewsPending: 0, safeguardFailures: 0 },
      system: { apiErrorRatePercent: 0, latencyMs: 0, syncFailures: 0, persistenceFailures: 0 },
      ai: { requests: 0, inputTokens: 0, outputTokens: 0, ttsCharacters: 0, spend: { amountUsd: 0, basis: 'calculated' } },
    })
    const markup = authorized(source)
    expect(markup).toContain('Calculated spend')
    expect(markup).toContain('$0.00')
    expect(markup).toContain('0 min')
  })

  it('labels partial and unavailable metrics without fabricated fallbacks', () => {
    const source = completeSource({
      learners: { activeLearners: 2, lessonsStarted: null, lessonsCompleted: undefined, studySessions: null, instructionalMinutes: undefined },
      ai: { requests: undefined, inputTokens: null, outputTokens: undefined, ttsCharacters: null, spend: undefined },
    })
    const markup = authorized(source)
    expect(markup).toContain('Unavailable')
    expect(markup).toContain('Unknown')
    expect(markup).not.toContain('$0.00')
    expect(markup).not.toContain('Estimated spend</dt><dd>$')
  })

  it('announces stale data and the supplied reason', () => {
    const markup = authorized(completeSource({ freshness: 'stale', staleReason: 'Last successful refresh was 47 minutes ago.' }))
    expect(markup).toContain('Data may be out of date')
    expect(markup).toContain('Last successful refresh was 47 minutes ago.')
  })

  it('never presents unknown health as healthy and distinguishes disabled from unavailable', () => {
    const markup = authorized()
    expect(markup).toMatch(/Jarvis[\s\S]*?Unknown/)
    expect(markup).toMatch(/TTS[\s\S]*?Disabled/)
    expect(markup).toMatch(/Sync[\s\S]*?Unavailable/)
    expect(markup).not.toMatch(/Jarvis[\s\S]{0,200}?Healthy/)
  })

  it('includes text labels, landmarks, native controls, and keyboard affordances', () => {
    const markup = authorized()
    expect(markup).toContain('Skip to overview')
    expect(markup).toContain('aria-label="Admin sections"')
    expect(markup).toContain('aria-current="page"')
    expect(markup).toContain('aria-label="Overview time range"')
    expect(markup).toContain('aria-label="View Tutor engine details"')
    for (const label of ['Healthy', 'Degraded', 'Unknown', 'Disabled', 'Unavailable']) expect(markup).toContain(label)
  })

  it('renders a custom range editor without calculating data locally', () => {
    const range = { kind: 'custom', start: '2026-08-01', end: '2026-08-08' } as const
    const markup = authorized(completeSource({ range }), { selectedRange: range })
    expect(markup).toContain('type="date"')
    expect(markup).toContain('value="2026-08-01"')
    expect(markup).toContain('value="2026-08-08"')
    expect(markup).toContain('Apply')
  })
})

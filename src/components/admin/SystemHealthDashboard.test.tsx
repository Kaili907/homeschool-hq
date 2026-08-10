import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ADMIN_ROLE_CAPABILITIES, type AdminOperationalEvent } from '../../admin/contracts'
import {
  buildSystemHealthProjection,
  buildSystemHealthProjectionFromAggregates,
  type SystemHealthProjection,
} from '../../admin/systemHealth'
import { SystemHealthDashboard } from './SystemHealthDashboard'

const NOW = new Date('2026-08-08T12:00:00.000Z')
const AUTHORIZED = { status: 'authorized', role: 'viewer', capabilities: ADMIN_ROLE_CAPABILITIES.viewer } as const

function projection(): SystemHealthProjection {
  const event: AdminOperationalEvent = {
    schemaVersion: 2, eventId: '00000000-0000-4000-8000-000000000001',
    occurredAt: '2026-08-08T11:59:00.000Z', scope: 'system', householdRef: null, learnerRef: null,
    engine: 'gateway', appVersion: 'deploy.safe', engineVersion: 'gateway.safe', curriculumVersion: null,
    courseRef: null, unitRef: null, lessonRef: null, skillRef: null,
    eventType: 'gateway.request', result: 'timeout', durationMs: 900,
    metadata: { reason_code: 'upstream_timeout' },
  }
  return buildSystemHealthProjection([event], { now: NOW, selectedWindow: '1h' })
}

function renderReady(value = projection()) {
  return renderToStaticMarkup(<SystemHealthDashboard authorization={AUTHORIZED} readState={{ status: 'ready', projection: value }} selectedWindow="1h" onWindowChange={() => {}} />)
}

describe('System Health dashboard states and privacy', () => {
  it('does not expose health evidence while authorization is unresolved or denied', () => {
    const secret = projection()
    const resolving = renderToStaticMarkup(<SystemHealthDashboard authorization={{ status: 'resolving' }} readState={{ status: 'ready', projection: secret }} selectedWindow="1h" onWindowChange={() => {}} />)
    const denied = renderToStaticMarkup(<SystemHealthDashboard authorization={{ status: 'authorized', role: 'admin', capabilities: ['engines:operate'] }} readState={{ status: 'ready', projection: secret }} selectedWindow="1h" onWindowChange={() => {}} />)
    expect(resolving).toContain('Verifying health access')
    expect(denied).toContain('health:read')
    expect(resolving).not.toContain('deploy.safe')
    expect(denied).not.toContain('deploy.safe')
  })

  it('renders loading, error, and revoked-between-requests denial states safely', () => {
    const loading = renderToStaticMarkup(<SystemHealthDashboard authorization={AUTHORIZED} readState={{ status: 'loading' }} selectedWindow="1h" onWindowChange={() => {}} />)
    const error = renderToStaticMarkup(<SystemHealthDashboard authorization={AUTHORIZED} readState={{ status: 'error', code: 'health_timeout' }} selectedWindow="1h" onWindowChange={() => {}} />)
    const denied = renderToStaticMarkup(<SystemHealthDashboard authorization={AUTHORIZED} readState={{ status: 'denied' }} selectedWindow="1h" onWindowChange={() => {}} />)
    expect(loading).toContain('Loading System Health')
    expect(error).toContain('projection timed out')
    expect(denied).toContain('health:read')
  })

  it('renders all engines, service signals, metrics, freshness, time controls, and drilldown', () => {
    const markup = renderReady()
    for (const label of ['Tutor', 'Study', 'Assessment', 'Curriculum', 'Jarvis', 'TTS', 'Gateway', 'Sync']) expect(markup).toContain(`>${label}<`)
    for (const label of ['Admin API', 'Supabase / persistence', 'Anthropic gateway', 'ElevenLabs / TTS gateway', 'Curriculum read service']) expect(markup).toContain(label)
    expect(markup).toContain('System Health history window')
    expect(markup).toContain('Last hour')
    expect(markup).toContain('Today (UTC)')
    expect(markup).toContain('Engine drilldown')
    expect(markup).toContain('P50 latency')
    expect(markup).toContain('P95 latency')
    expect(markup).toContain('Provider error')
    expect(markup).toContain('Safety stops (not infrastructure failures)')
  })

  it('distinguishes evidence observation time from projection generation time', () => {
    const markup = renderReady()
    expect(markup).toContain('Evidence observed')
    expect(markup).toContain('2026-08-08T11:59:00.000Z')
    expect(markup).toContain('Projection generated')
    expect(markup).toContain('2026-08-08T12:00:00.000Z')
  })

  it('uses textual labels for unknown, disabled, stale, unavailable, degraded, and healthy states', () => {
    const base = projection()
    const states = ['healthy', 'degraded', 'unavailable', 'disabled', 'unknown'] as const
    const engines = base.engines.map((engine, index) => ({
      ...engine,
      health: states[index % states.length],
      freshness: index === 1 ? 'stale' as const : engine.freshness,
      reasonCodes: index === 3 ? ['feature_disabled' as const] : engine.reasonCodes,
    }))
    const markup = renderReady({ ...base, engines })
    for (const label of ['Healthy', 'Degraded', 'Unavailable', 'Disabled', 'Unknown', 'Stale evidence']) expect(markup).toContain(label)
  })

  it('maps unknown reason codes to generic safe copy and never renders raw text', () => {
    const base = projection()
    const unsafe = {
      ...base,
      overallReasonCodes: ['raw exception SECRET provider body'],
      engines: base.engines.map((engine, index) => index === 0
        ? { ...engine, reasonCodes: ['raw SQL SECRET'] }
        : engine),
      incidents: base.incidents.map((incident) => ({ ...incident, reasonCode: 'raw provider SECRET' })),
    } as unknown as SystemHealthProjection
    const markup = renderReady(unsafe)
    expect(markup).toContain('Additional operational detail is unavailable')
    expect(markup).not.toContain('SECRET')
  })

  it('states that an empty degradation window does not prove health and retains accessibility basics', () => {
    const markup = renderReady(buildSystemHealthProjection([], { now: NOW }))
    expect(markup).toContain('does not by itself prove health')
    expect(markup).toContain('No evidence')
    expect(markup).toContain('aria-label="System Health history window"')
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain('id="admin-main"')
  })

  it.each([
    ['partial', 'Partial aggregate evidence'],
    ['retention_limited', 'Retention-limited evidence'],
    ['malformed', 'Malformed aggregate evidence'],
    ['unavailable', 'Aggregate evidence unavailable'],
    ['timeout', 'Aggregate evidence timed out'],
    ['group_incomplete', 'Aggregate groups incomplete'],
  ] as const)('renders truthful %s evidence status without a healthy ruling', (evidenceCompleteness, label) => {
    const value = buildSystemHealthProjectionFromAggregates(null, { now: NOW, evidenceCompleteness })
    const markup = renderReady(value)
    expect(markup).toContain(label)
    expect(markup).toContain('Unknown')
    expect(markup).not.toContain('health-badge--healthy')
  })
})

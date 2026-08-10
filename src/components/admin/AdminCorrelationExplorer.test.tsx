import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminIncidentFilters, AdminIncidentPage } from '../../admin/incidentExplorerModel'
import { AdminCorrelationExplorer, IncidentDrawer } from './AdminCorrelationExplorer'

const FILTERS: AdminIncidentFilters = {
  correlationId: '20000000-0000-4000-8000-000000000001',
  occurredFrom: '2026-08-10T14:00:00.000Z', occurredTo: '2026-08-10T16:00:00.000Z',
  domain: 'all', limit: 50,
}

const RUNTIME_EVENT = {
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-10T15:00:00.000Z', correlationId: FILTERS.correlationId!,
  source: 'runtime',
  facts: {
    engine: 'gateway', eventType: 'gateway.request', result: 'timeout', durationMs: 500,
    operation: 'anthropic_messages', reasonCode: 'provider_timeout', provider: 'anthropic',
    httpStatus: 504, failureStage: 'provider_request', retryable: true,
  },
} as const

const AUDIT_EVENT = {
  eventId: '10000000-0000-4000-8000-000000000002',
  occurredAt: '2026-08-10T15:01:00.000Z', correlationId: FILTERS.correlationId!,
  source: 'admin-audit',
  facts: {
    actorRole: 'admin', action: 'incident.acknowledge', resourceType: 'incident',
    resourceRef: 'incident-42', resourceVersion: null, resourceRevision: '2',
    previousValue: { status: 'open' }, newValue: { status: 'acknowledged' },
    reasonCode: 'incident.acknowledged',
  },
} as const

const PAGE: AdminIncidentPage = {
  schemaVersion: 2, generatedAt: '2026-08-10T16:00:00.000Z', sortOrder: 'chronological',
  query: FILTERS,
  events: [RUNTIME_EVENT, AUDIT_EVENT],
  sources: { runtime: 'available', 'admin-audit': 'available', 'provider-accounting': 'unauthorized' },
  evidence: { status: 'partial', reasons: ['provider_accounting_unauthorized'], rejectedEntries: 0 },
  nextCursor: 'safe_cursor',
}

function render(page: AdminIncidentPage = PAGE) {
  return renderToStaticMarkup(<AdminCorrelationExplorer
    authorized
    state={{ status: 'ready', page }}
    filters={FILTERS}
    pageNumber={1}
    canGoBack={false}
    onFiltersChange={vi.fn()}
    onNext={vi.fn()}
    onPrevious={vi.fn()}
    onRetry={vi.fn()}
  />)
}

describe('Admin correlation explorer UI', () => {
  it('renders correlation search, bounded filters, source badges, and chronological timeline semantics', () => {
    const markup = render()
    expect(markup).toContain('Correlation and incident explorer')
    expect(markup).toContain('This is not a raw log viewer')
    expect(markup).toContain('Correlation ID')
    expect(markup).toContain('type="datetime-local"')
    expect(markup).toContain('Runtime event')
    expect(markup).toContain('Admin audit')
    expect(markup).toContain('Provider accounting')
    expect(markup).toContain('aria-label="Incident evidence timeline"')
    const timeline = markup.slice(markup.indexOf('aria-label="Incident evidence timeline"'))
    expect(timeline.indexOf('gateway · request')).toBeLessThan(timeline.indexOf('incident · acknowledge'))
    expect(markup).toContain(`Copy correlation ID ${FILTERS.correlationId}`)
    expect(markup).toContain('View bounded details')
  })

  it('surfaces partial authorization without inventing unavailable events', () => {
    const markup = render()
    expect(markup).toContain('Partial evidence')
    expect(markup).toContain('lacks cost read access')
    expect(markup).toContain('is-unauthorized')
    expect(markup.match(/<li/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it('renders an accessible field-by-field detail drawer without raw JSON or protected content', () => {
    const markup = renderToStaticMarkup(<IncidentDrawer event={AUDIT_EVENT} onClose={vi.fn()} />)
    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('Close incident details')
    expect(markup).toContain('Previous state')
    expect(markup).toContain('New state')
    expect(markup).toContain('acknowledged')
    expect(markup).not.toContain('{&quot;')
    expect(markup).not.toMatch(/prompt|response|learner|transcript|raw error/i)
  })

  it('renders a safe missing-correlation state and bounded pagination controls', () => {
    const markup = render({ ...PAGE, events: [], nextCursor: null, evidence: { status: 'complete', reasons: [], rejectedEntries: 0 } })
    expect(markup).toContain('No safe operational evidence matched')
    expect(markup).toContain('Newer page')
    expect(markup).toContain('Older page')
    expect(markup).not.toContain('not found for learner')
  })

  it('fails closed when no evidence capability is authorized', () => {
    const markup = renderToStaticMarkup(<AdminCorrelationExplorer
      authorized={false}
      state={{ status: 'ready', page: PAGE }}
      filters={FILTERS}
      pageNumber={1}
      canGoBack={false}
      onFiltersChange={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      onRetry={vi.fn()}
    />)
    expect(markup).toContain('Incident evidence unavailable')
    expect(markup).not.toContain(FILTERS.correlationId)
  })

  it('includes responsive, focus-visible, and reduced-motion safeguards', () => {
    const css = readFileSync(new URL('./admin-correlation-explorer.css', import.meta.url), 'utf8')
    expect(css).toContain('@media (max-width: 960px)')
    expect(css).toContain('@media (max-width: 640px)')
    expect(css).toContain('grid-template-columns: 1fr')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('width: min(460px, 94vw)')
  })
})

import { readFileSync } from 'node:fs'
import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminAuditFilters, AdminAuditReadState } from '../../admin/auditLogModel'
import {
  activeAuditFilterCount,
  AdminAuditLog,
  EventDetailPanel,
  hasActiveAuditFilters,
  isAuditPanelCloseKey,
  resetAuditFilters,
} from './AdminAuditLog'

const EVENT = {
  schemaVersion: 2 as const,
  eventId: '10000000-0000-4000-8000-000000000001',
  occurredAt: '2026-08-09T13:00:00.000Z',
  actorRole: 'owner' as const,
  action: 'engine.control' as const,
  resourceType: 'engine' as const,
  resourceRef: 'tts',
  resourceVersion: 'tts-v2',
  resourceRevision: '7',
  previousValue: { state: 'enabled', model_tiers: ['sonnet', 'haiku'] },
  newValue: { state: 'disabled', status: 'stopped', value: false },
  reasonCode: 'engine.controlled',
  correlationId: '20000000-0000-4000-8000-000000000001',
}

function render(
  state: AdminAuditReadState,
  authorized = true,
  canGoBack = false,
  filters: AdminAuditFilters = { limit: 50 },
) {
  return renderToStaticMarkup(<AdminAuditLog
    authorized={authorized}
    state={state}
    filters={filters}
    pageNumber={canGoBack ? 2 : 1}
    canGoBack={canGoBack}
    onFiltersChange={() => {}}
    onNext={() => {}}
    onPrevious={() => {}}
    onRetry={() => {}}
  />)
}

describe('production Admin Audit Log experience', () => {
  it('renders loading, unfiltered empty, filtered-empty, source errors, malformed fallback, and permission denied', () => {
    expect(render({ status: 'loading' })).toContain('Loading audit history')
    expect(render({ status: 'empty' })).toContain('No audit events yet')
    expect(render({ status: 'empty' }, true, false, { actorRole: 'admin', limit: 50 }))
      .toContain('No events match these filters')
    expect(render({ status: 'empty' }, true, false, { actorRole: 'admin', limit: 50 }))
      .toContain('Clear all filters')
    expect(render({ status: 'error', code: 'audit_unavailable' })).toContain('Audit history unavailable')
    expect(render({ status: 'error', code: 'audit_timeout' })).toContain('Audit read timed out')
    const malformed = render({ status: 'error', code: 'audit_malformed' })
    expect(malformed).toContain('could not be displayed safely')
    expect(malformed).toContain('No partial or raw data was shown')
    expect(render({ status: 'unauthorized' }, false)).toContain('Permission denied')
    expect(render({ status: 'unauthorized' }, false)).toContain('audit:read')
  })

  it('renders a compact semantic event table without mutation controls or hidden actor identity', () => {
    const markup = render({ status: 'ready', page: { events: [EVENT], nextCursor: null } })
    expect(markup).toContain('<table')
    expect(markup).toContain('<caption')
    expect(markup).toContain('newest first')
    expect(markup).toContain('scope="col"')
    expect(markup).toContain('data-label="Occurred"')
    expect(markup).toContain('engine.control')
    expect(markup).toContain('engine.controlled')
    expect(markup).toContain('Actor category')
    expect(markup).toContain('View event')
    expect(markup).not.toMatch(/Delete|Edit|Update event|raw JSON|actorUserRef|assignmentRef/i)
  })

  it('renders exact safe event details and explicitly avoids inventing a diff', () => {
    const markup = renderToStaticMarkup(<EventDetailPanel
      event={EVENT}
      panelId="audit-detail"
      headingId="audit-detail-heading"
      closeRef={createRef<HTMLButtonElement>()}
      onClose={() => {}}
    />)
    expect(markup).toContain('<aside')
    expect(markup).toContain('Event details')
    expect(markup).toContain('tts-v2')
    expect(markup).toContain('Resource revision')
    expect(markup).toContain('Before')
    expect(markup).toContain('After')
    expect(markup).toContain('sonnet')
    expect(markup).toContain('haiku')
    expect(markup).toContain('stopped')
    expect(markup).toContain('Missing values and differences are not inferred')
    expect(markup).toContain(EVENT.correlationId)
  })

  it('preserves intentionally minimized events in the detail panel', () => {
    const markup = renderToStaticMarkup(<EventDetailPanel
      event={{ ...EVENT, previousValue: null, newValue: null }}
      panelId="audit-detail"
      headingId="audit-detail-heading"
      closeRef={createRef<HTMLButtonElement>()}
      onClose={() => {}}
    />)
    expect(markup).toContain('intentionally minimized')
    expect(markup).not.toContain('Before</strong>')
    expect(markup).not.toContain('After</strong>')
  })

  it('safely renders granular curriculum actions and structural facts', () => {
    const entityEvent = {
      ...EVENT,
      action: 'curriculum_entity.tombstone' as const,
      resourceType: 'curriculum_entity' as const,
      resourceRef: 'draft-1/lesson-1',
      resourceRevision: '4',
      previousValue: {
        entity_ref: 'lesson-1',
        entity_type: 'lesson',
        draft_revision: 3,
        position: 2,
        status: 'active',
        tombstoned: false,
      },
      newValue: {
        entity_ref: 'lesson-1',
        entity_type: 'lesson',
        draft_revision: 4,
        position: 2,
        status: 'tombstoned',
        tombstoned: true,
        digest: 'a'.repeat(64),
      },
      reasonCode: 'curriculum.authored',
    }
    const markup = renderToStaticMarkup(<EventDetailPanel
      event={entityEvent}
      panelId="curriculum-audit-detail"
      headingId="curriculum-audit-detail-heading"
      closeRef={createRef<HTMLButtonElement>()}
      onClose={() => {}}
    />)
    expect(markup).toContain('curriculum_entity.tombstone')
    expect(markup).toContain('curriculum_entity')
    expect(markup).toContain('Entity ref')
    expect(markup).toContain('Draft revision')
    expect(markup).toContain('lesson-1')
    expect(markup).not.toMatch(/raw JSON|lesson body|assessment prompt/i)
  })

  it('renders cursor pagination and a non-destructive page-loading state', () => {
    const first = render({ status: 'ready', page: { events: [EVENT], nextCursor: 'opaque' } })
    expect(first).toContain('Newer events')
    expect(first).toContain('Older events')
    expect(first).toContain('Page 1')
    const loading = render({
      status: 'loading-page',
      page: { events: [EVENT], nextCursor: 'opaque' },
      direction: 'older',
    }, true, true)
    expect(loading).toContain('Loading older audit events')
    expect(loading).toContain('Page 2 remains visible')
    expect(loading).toContain('aria-busy="true"')
    expect(loading).toMatch(/disabled=""[^>]*>Older events/)
  })

  it('offers every safe DTO-backed server filter and a deterministic reset', () => {
    const filters = {
      occurredFrom: '2026-08-01T00:00:00.000Z',
      occurredTo: '2026-08-09T23:59:00.000Z',
      action: 'engine.control',
      resourceType: 'engine',
      resourceRef: 'tts',
      actorRole: 'owner',
      reasonCode: 'engine.controlled',
      correlationId: EVENT.correlationId,
      limit: 50,
    } as const
    const markup = render({ status: 'empty' }, true, false, filters)
    expect(markup).toContain('From (local time)')
    expect(markup).toContain('Through (local time)')
    expect(markup).toContain('Actor category')
    expect(markup).toContain('Exact resource reference')
    expect(markup).toContain('Exact reason code')
    expect(markup).toContain('Correlation ID')
    expect(markup).toContain('8 active filters')
    expect(hasActiveAuditFilters(filters)).toBe(true)
    expect(activeAuditFilterCount(filters)).toBe(8)
    expect(resetAuditFilters(filters)).toEqual({ limit: 50 })
    expect(resetAuditFilters({ limit: 25 })).toEqual({ limit: 25 })
  })

  it('does not dump unexpected raw fields or protected content', () => {
    const unsafe = {
      ...EVENT,
      actorUserRef: 'private-user',
      actorAssignmentRef: 'private-assignment',
      bearerToken: 'SECRET',
      rawPrompt: 'learner prompt',
      rawJson: { learnerConversation: 'SECRET transcript' },
    }
    const markup = render({
      status: 'ready',
      page: { events: [unsafe] as unknown as [typeof EVENT], nextCursor: null },
    })
    expect(markup).not.toMatch(/private-user|private-assignment|SECRET|learner|transcript|bearerToken/)
  })

  it('provides native keyboard controls, visible focus rules, and a mobile card presentation', () => {
    const markup = render({ status: 'ready', page: { events: [EVENT], nextCursor: null } })
    expect(markup).toContain('<button type="button"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('aria-controls=')
    expect(isAuditPanelCloseKey('Escape')).toBe(true)
    expect(isAuditPanelCloseKey('Enter')).toBe(false)
    const css = readFileSync(new URL('./admin-audit-log.css', import.meta.url), 'utf8')
    expect(css).toContain(':focus-visible')
    expect(css).toContain('@media (max-width: 700px)')
    expect(css).toContain('content: attr(data-label)')
  })

  it('does not invoke callbacks while rendering', () => {
    const onFiltersChange = vi.fn()
    renderToStaticMarkup(<AdminAuditLog
      authorized
      state={{ status: 'empty' }}
      filters={{ limit: 50 }}
      pageNumber={1}
      canGoBack={false}
      onFiltersChange={onFiltersChange}
      onNext={() => {}}
      onPrevious={() => {}}
      onRetry={() => {}}
    />)
    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})

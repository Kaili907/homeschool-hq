import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AdminAuditReadState } from '../../admin/auditLogModel'
import { AdminAuditLog } from './AdminAuditLog'

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
  newValue: { state: 'disabled', value: false },
  reasonCode: 'engine.controlled',
  correlationId: '20000000-0000-4000-8000-000000000001',
}

function render(state: AdminAuditReadState, authorized = true, canGoBack = false) {
  return renderToStaticMarkup(<AdminAuditLog
    authorized={authorized}
    state={state}
    filters={{ limit: 50 }}
    pageNumber={canGoBack ? 2 : 1}
    canGoBack={canGoBack}
    onFiltersChange={() => {}}
    onNext={() => {}}
    onPrevious={() => {}}
    onRetry={() => {}}
  />)
}

describe('read-only Admin Audit Log', () => {
  it('renders clear loading, empty, error, and authorization states', () => {
    expect(render({ status: 'loading' })).toContain('Loading audit history')
    expect(render({ status: 'empty' })).toContain('No audit events found')
    expect(render({ status: 'error', code: 'audit_unavailable' })).toContain('Audit history unavailable')
    expect(render({ status: 'error', code: 'audit_timeout' })).toContain('Audit read timed out')
    expect(render({ status: 'unauthorized' }, false)).toContain('Audit access unavailable')
  })

  it('renders chronological audit facts as a semantic table without mutation controls', () => {
    const markup = render({ status: 'ready', page: { events: [EVENT], nextCursor: null } })
    expect(markup).toContain('<table')
    expect(markup).toContain('<caption')
    expect(markup).toContain('newest first')
    expect(markup).toContain('engine.control')
    expect(markup).toContain('tts-v2')
    expect(markup).toContain('sonnet, haiku')
    expect(markup).toContain('engine.controlled')
    expect(markup).toContain('Read only')
    expect(markup).not.toMatch(/Delete|Edit|Update event|raw JSON/i)
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
    const markup = render({
      status: 'ready',
      page: { events: [entityEvent], nextCursor: null },
    })
    expect(markup).toContain('curriculum_entity.tombstone')
    expect(markup).toContain('curriculum_entity')
    expect(markup).toContain('entity ref')
    expect(markup).toContain('draft revision')
    expect(markup).toContain('lesson-1')
    expect(markup).not.toMatch(/raw JSON|lesson body|assessment prompt/i)
  })

  it('renders deterministic older/newer pagination affordances', () => {
    const first = render({ status: 'ready', page: { events: [EVENT], nextCursor: 'opaque' } })
    expect(first).toMatch(/Newer<\/button>/)
    expect(first).toMatch(/Older<\/button>/)
    expect(first).toContain('Page 1')
    const second = render({ status: 'ready', page: { events: [EVENT], nextCursor: null } }, true, true)
    expect(second).toContain('Page 2')
  })

  it('does not dump unexpected raw fields or private actor identity', () => {
    const unsafe = {
      ...EVENT,
      actorUserRef: 'private-user',
      actorAssignmentRef: 'private-assignment',
      bearerToken: 'SECRET',
      rawJson: { learnerConversation: 'SECRET' },
    }
    const markup = render({
      status: 'ready',
      page: { events: [unsafe] as unknown as [typeof EVENT], nextCursor: null },
    })
    expect(markup).not.toMatch(/private-user|private-assignment|SECRET|learnerConversation|bearerToken/)
  })

  it('exposes only safe exact filters and invokes no callback while rendering', () => {
    const onFiltersChange = vi.fn()
    const markup = renderToStaticMarkup(<AdminAuditLog
      authorized
      state={{ status: 'empty' }}
      filters={{ action: 'engine.control', resourceType: 'engine', resourceRef: 'tts', limit: 50 }}
      pageNumber={1}
      canGoBack={false}
      onFiltersChange={onFiltersChange}
      onNext={() => {}}
      onPrevious={() => {}}
      onRetry={() => {}}
    />)
    expect(markup).toContain('All canonical actions')
    expect(markup).toContain('Exact resource reference')
    expect(markup).not.toContain('Search')
    expect(onFiltersChange).not.toHaveBeenCalled()
  })
})

import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readStudySafetyEvents } from '../../study/client/studySafetyEventsClient'
import { noteClientSideSafetyFailure, recordSafetyStop } from '../../study/safety/stopLedger'
import type { StudyScope } from '../../study/types'
import {
  StudySafetyEventsSurface,
  STUDY_SAFETY_NO_EVENTS_NOTICE,
  STUDY_SAFETY_SERVER_UNREADABLE_NOTICE,
} from './StudySafetyEventsPanel'

// A6-5-C — the adult record. A stop that failed to reach the server, or never
// got near it, must still be visible here. A parent must never be shown an
// empty safety panel after a stop actually happened.

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const SCOPE: StudyScope = {
  householdRef: 'household:a',
  learnerRef: 'learner:mm',
  sessionRef: 'block:math-1:session',
}

const DELIVERED = Object.freeze({
  notificationId: `notification:${'a'.repeat(64)}`,
  title: 'Study check-in needs your review',
  reasonCategory: 'immediate-safety',
  urgency: 'urgent',
  createdAt: '2026-08-04T14:05:00.000Z',
  deliveredAt: '2026-08-04T14:05:02.000Z',
  read: false,
  actionRef: 'adult-review:proposal-1',
})

async function view(body: unknown, status = 200) {
  return readStudySafetyEvents({
    getAccessToken: async () => 'header.payload.signature',
    fetchImpl: async () => ({ status, json: async () => body }),
  })
}

function rendered(resolved: Awaited<ReturnType<typeof readStudySafetyEvents>>) {
  return renderToStaticMarkup(<StudySafetyEventsSurface view={resolved} />)
}

describe('A6-5-C Parent Hub safety events surface', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new MemStorage())
  })

  it('shows nothing-recorded only when the server read succeeded and no stop exists', async () => {
    const html = rendered(await view({ notifications: [] }))
    expect(html).toContain(STUDY_SAFETY_NO_EVENTS_NOTICE)
    expect(html).not.toContain(STUDY_SAFETY_SERVER_UNREADABLE_NOTICE)
  })

  it('never renders an empty successful list when a local stop exists', async () => {
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    // The server list is empty and the read succeeded — exactly the case that
    // used to render a clean "nothing happened" panel after a real stop.
    const resolved = await view({ notifications: [] })
    expect(resolved.events).toHaveLength(1)
    expect(resolved.localStopCount).toBe(1)
    const html = rendered(resolved)
    expect(html).not.toContain(STUDY_SAFETY_NO_EVENTS_NOTICE)
    expect(html).toContain('Immediate safety check')
    expect(html).toContain('learner:mm')
  })

  it('shows a stop whose server proposal capture failed, marked as locally recorded only', async () => {
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
    })
    const resolved = await view({ notifications: [] })
    expect(resolved.events[0]).toMatchObject({ kind: 'local', captureStatus: 'not-confirmed' })
    const html = rendered(resolved)
    expect(html).toContain('Recorded on this device only')
    expect(html).toContain('the server did not confirm it was saved')
    expect(html).toContain('Review required')
  })

  it.each([
    'client-auth-unavailable',
    'client-network-error',
    'client-gateway-error',
    'client-malformed-response',
  ])('shows a stop caused by the client-side failure %s, with no server record at all', async (reasonCode) => {
    noteClientSideSafetyFailure(SCOPE, reasonCode)
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'invalid',
      deliveryStatus: 'not-confirmed',
    })
    const resolved = await view({ notifications: [] })
    expect(resolved.events[0]).toMatchObject({ kind: 'local', captureStatus: 'never-attempted' })
    const html = rendered(resolved)
    expect(html).toContain('the safety service was never reached')
    expect(html).toContain(`Reason: ${reasonCode}.`)
  })

  it('distinguishes a server-delivered event from a locally recorded one', async () => {
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'uncertain',
      deliveryStatus: 'not-confirmed',
    })
    const resolved = await view({ notifications: [DELIVERED] })
    expect(resolved.events.map((event) => event.kind)).toEqual(['local', 'delivered'])
    const html = rendered(resolved)
    expect(html).toContain('Delivered to you')
    expect(html).toContain('Recorded on this device only')
  })

  it('marks a stop the server did capture as captured, not as locally recorded only', async () => {
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    const html = rendered(await view({ notifications: [] }))
    expect(html).toContain('the server also captured it for review')
    expect(html).not.toContain('Recorded on this device only')
  })

  it.each([
    ['a gateway error', { notifications: [] }, 503, 'client-gateway-error'],
    ['a malformed body', { unexpected: true }, 200, 'client-malformed-response'],
  ])('reports %s as unreadable rather than as an empty record, and still lists local stops', async (
    _label, body, status, reasonCode,
  ) => {
    recordSafetyStop({
      scope: SCOPE,
      occurredAt: '2026-08-05T09:30:00.000Z',
      classification: 'urgent',
      deliveryStatus: 'proposed-not-delivered',
    })
    const resolved = await view(body, status as number)
    expect(resolved).toMatchObject({ serverReadable: false, serverReasonCode: reasonCode })
    const html = rendered(resolved)
    expect(html).toContain(STUDY_SAFETY_SERVER_UNREADABLE_NOTICE)
    expect(html).not.toContain(STUDY_SAFETY_NO_EVENTS_NOTICE)
    expect(html).toContain('Immediate safety check')
  })

  it('reports an unreadable server record even when this device holds no stop', async () => {
    const html = rendered(await view({ notifications: [] }, 500))
    expect(html).toContain(STUDY_SAFETY_SERVER_UNREADABLE_NOTICE)
  })
})

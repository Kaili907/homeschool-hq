import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  readStudySafetyEvents,
  STUDY_SAFETY_EVENTS_ENDPOINT,
} from '../../study/client/studySafetyEventsClient'
import {
  StudySafetyEventsSurface,
  STUDY_SAFETY_EVENTS_PENDING_NOTICE,
  STUDY_SAFETY_EVENTS_UNAVAILABLE_NOTICE,
} from './StudySafetyEventsPanel'

// A6-5 — the adult-only safety record. These tests drive the real browser
// client against server-shaped bodies and assert the rendered adult surface.

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

const CAPTURED = Object.freeze({
  reviewId: `safety-proposal-${'b'.repeat(32)}`,
  learnerRef: 'learner:mm',
  reasonCategory: 'possible-safety',
  urgency: 'uncertain',
  occurredAt: '2026-08-05T09:30:00.000Z',
  deliveryState: 'proposed',
})

function stubbedGet(body: unknown, status = 200) {
  const calls: string[] = []
  const fetchImpl = async (url: string) => {
    calls.push(url)
    return { status, json: async () => body }
  }
  return { calls, fetchImpl }
}

async function view(body: unknown, status = 200) {
  const { fetchImpl } = stubbedGet(body, status)
  return readStudySafetyEvents({ getAccessToken: async () => 'header.payload.signature', fetchImpl })
}

function rendered(resolved: Awaited<ReturnType<typeof readStudySafetyEvents>>) {
  return renderToStaticMarkup(<StudySafetyEventsSurface view={resolved} />)
}

describe('A6-5 Parent Hub safety events surface', () => {
  it('renders captured and delivered safety events with time, student, type and reason', async () => {
    const resolved = await view({
      schemaVersion: 1,
      notifications: [DELIVERED],
      capture: { state: 'available', pendingReviews: [CAPTURED] },
      delivery: { policy: 'approved', state: 'delivering' },
    })
    expect(resolved.events).toHaveLength(2)
    const html = rendered(resolved)

    expect(html).toContain('Safety events')
    expect(html).toContain('Immediate safety check')
    expect(html).toContain('Possible safety check')
    expect(html).toContain('2026-08-05T09:30:00.000Z')
    expect(html).toContain('2026-08-04T14:05:00.000Z')
    expect(html).toContain('learner:mm')
    expect(html).toContain('The lesson stopped and an adult was asked for straight away.')
    expect(html).toContain('Captured, not delivered')
    expect(html).not.toContain(STUDY_SAFETY_EVENTS_PENDING_NOTICE)
  })

  it('shows delivery as pending, never silently, while the policy is not approved', async () => {
    const resolved = await view({
      schemaVersion: 1,
      notifications: [],
      capture: { state: 'unavailable', reasonCode: 'capture-read-path-not-authorized' },
      delivery: { policy: 'not-approved', state: 'pending-approval' },
    })
    expect(resolved.deliveryPolicy).toBe('not-approved')
    expect(resolved.deliveryState).toBe('pending-approval')

    const html = rendered(resolved)
    expect(html).toContain(STUDY_SAFETY_EVENTS_PENDING_NOTICE)
    expect(html).toContain('capture-read-path-not-authorized')
    expect(html).toContain('Captured-but-undelivered events are not readable yet')
  })

  it('treats an unreadable policy as not approved and still warns the adult', async () => {
    const resolved = await view({
      schemaVersion: 1,
      notifications: [],
      capture: { state: 'unavailable', reasonCode: 'capture-read-path-unavailable' },
      delivery: { policy: 'unknown', state: 'pending-approval' },
    })
    const html = rendered(resolved)
    expect(html).toContain(STUDY_SAFETY_EVENTS_PENDING_NOTICE)
    expect(html).toContain('The delivery policy could not be read, so it is treated as not approved.')
  })

  it('reports a failed read as unavailable rather than as an empty safety record', async () => {
    const resolved = await view({ notifications: [] }, 503)
    expect(resolved.unavailable).toBe(true)
    const html = rendered(resolved)
    expect(html).toContain(STUDY_SAFETY_EVENTS_UNAVAILABLE_NOTICE)
    expect(html).toContain('client-gateway-error')
  })

  it('reads the guardian-authenticated endpoint and sends no learner text', async () => {
    const { calls, fetchImpl } = stubbedGet({
      schemaVersion: 1,
      notifications: [],
      capture: { state: 'available', pendingReviews: [] },
      delivery: { policy: 'not-approved', state: 'pending-approval' },
    })
    await readStudySafetyEvents({ getAccessToken: async () => 'header.payload.signature', fetchImpl })
    expect(calls).toEqual([STUDY_SAFETY_EVENTS_ENDPOINT])
  })

  it('is unavailable rather than empty when the adult is not authenticated', async () => {
    const resolved = await readStudySafetyEvents({
      getAccessToken: async () => null,
      fetchImpl: async () => { throw new Error('must not be called') },
    })
    expect(resolved).toMatchObject({ unavailable: true, captureReasonCode: 'client-unauthenticated' })
    expect(rendered(resolved)).toContain(STUDY_SAFETY_EVENTS_UNAVAILABLE_NOTICE)
  })
})

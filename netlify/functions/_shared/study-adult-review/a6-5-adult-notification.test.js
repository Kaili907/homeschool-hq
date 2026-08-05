import { describe, expect, it, vi } from 'vitest'
import { createConfiguredInAppProvider } from '../study-delivery/composition.js'
import { createGuardianNotificationPort } from './guardian-notifications.js'
import { createStudyParentNotificationsHandler } from '../../study-parent-notifications.js'

// A6-5 — the adult half of the safety stop. Delivery must fail closed and stay
// visible while the Director-owned policy is unapproved, and the composition
// root must take the policy from the database rather than from code.

const ENV = Object.freeze({ ACADEMY_STUDY_ENABLED: 'true' })

function readyPort(port) {
  return { isReady: () => true, ...port }
}

function persistenceSpy() {
  return {
    isDurable: true,
    isReady: () => true,
    insertNotification: vi.fn(async () => { throw new Error('must not be reached') }),
    verifyNotificationReceipt: vi.fn(async () => { throw new Error('must not be reached') }),
  }
}

const DELIVERY_REQUEST = Object.freeze({
  delivery: {
    idempotencyKey: `study-safety-delivery:${'a'.repeat(64)}`,
    jobId: 'job:1',
    attemptId: 'attempt:1',
    proposalId: 'proposal:1',
    householdId: 'household:1',
    studentId: 'student:1',
    routeRef: 'in-app-route:1',
    templateCode: 'study-safety-adult-review-v1',
  },
  recipient: { recipientRef: 'recipient:1' },
  workerContext: {},
  trigger: 'scheduled',
  onAttemptSubmitted: async () => undefined,
})

describe('A6-5 in-app delivery composition root', () => {
  it('takes the delivery policy from the database, not from code', async () => {
    const persistence = persistenceSpy()
    const approved = await createConfiguredInAppProvider({
      env: ENV,
      persistence,
      ports: { readAdultReviewReadiness: async () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'approved' }) },
    })
    expect(approved.policy).toBe('approved')
    expect(approved.provider.adultReviewInAppDeliveryPolicy).toBe('approved')
    expect(approved.provider.isReady()).toBe(true)
    expect(approved.reasonCode).toBe(null)
  })

  it('fails closed and names the reason while the policy is unapproved', async () => {
    const persistence = persistenceSpy()
    const configured = await createConfiguredInAppProvider({
      env: ENV,
      persistence,
      ports: { readAdultReviewReadiness: async () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved' }) },
    })
    expect(configured.policy).toBe('not-approved')
    expect(configured.reasonCode).toBe('director-policy-approval-required')
    expect(configured.provider.isReady()).toBe(false)
    await expect(configured.provider.deliver(DELIVERY_REQUEST))
      .rejects.toThrow('adult_review_in_app_delivery_policy_not_approved')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })

  it('fails closed when the policy cannot be read at all', async () => {
    const persistence = persistenceSpy()
    const configured = await createConfiguredInAppProvider({
      env: ENV,
      persistence,
      ports: { readAdultReviewReadiness: async () => { throw new Error('durable_port_unavailable') } },
    })
    expect(configured.policy).toBe('not-approved')
    expect(configured.reasonCode).toBe('adult-review-readiness-unavailable')
    await expect(configured.provider.deliver(DELIVERY_REQUEST))
      .rejects.toThrow('adult_review_in_app_delivery_policy_not_approved')
    expect(persistence.insertNotification).not.toHaveBeenCalled()
  })
})

describe('A6-5 guardian safety-event read path', () => {
  function port(response) {
    return createGuardianNotificationPort({
      env: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon-key' },
      fetchImpl: async () => response,
    })
  }

  it('reports captured-but-undelivered reviews when the hosted read path exists', async () => {
    const reviews = [{
      reviewId: `safety-proposal-${'b'.repeat(32)}`,
      learnerRef: 'learner:mm',
      reasonCategory: 'possible-safety',
      urgency: 'uncertain',
      occurredAt: '2026-08-05T09:30:00.000Z',
      deliveryState: 'proposed',
    }]
    const result = await port({ ok: true, json: async () => ({ pendingReviews: reviews }) })
      .listPendingReviews({ accessToken: 'token' })
    expect(result).toEqual({ state: 'available', pendingReviews: reviews })
  })

  it('reports the read path as unavailable, never as an empty list, before the hosted change lands', async () => {
    const result = await port({ ok: false, json: async () => ({}) })
      .listPendingReviews({ accessToken: 'token' })
    expect(result).toEqual({ state: 'unavailable', reasonCode: 'capture-read-path-not-authorized' })
  })
})

describe('A6-5 parent notifications endpoint', () => {
  function handler(overrides) {
    return createStudyParentNotificationsHandler({
      env: ENV,
      authVerifier: async () => ({ ok: true, user: { id: 'guardian' }, accessToken: 'token' }),
      rateLimiter: readyPort({ isDurable: true, reserve: async () => ({ allowed: true }) }),
      ...overrides,
    })
  }

  const GET = { httpMethod: 'GET', path: '/api/study/parent-notifications', headers: {} }

  it('tells the adult that delivery is pending while the policy is unapproved', async () => {
    const response = await handler({
      notifications: readyPort({
        isDurable: true,
        list: async () => ({ notifications: [] }),
        listPendingReviews: async () => ({ state: 'unavailable', reasonCode: 'capture-read-path-not-authorized' }),
        markRead: async () => ({ read: true }),
      }),
      adultReviewReadiness: async () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'not-approved' }),
    })(GET)
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      notifications: [],
      capture: { state: 'unavailable', reasonCode: 'capture-read-path-not-authorized' },
      delivery: { policy: 'not-approved', state: 'pending-approval' },
    })
  })

  it('treats an unreadable policy as pending rather than as delivering', async () => {
    const response = await handler({
      notifications: readyPort({
        isDurable: true,
        list: async () => ({ notifications: [] }),
        listPendingReviews: async () => ({ state: 'available', pendingReviews: [] }),
        markRead: async () => ({ read: true }),
      }),
      adultReviewReadiness: async () => { throw new Error('durable_port_unavailable') },
    })(GET)
    expect(JSON.parse(response.body).delivery).toEqual({ policy: 'unknown', state: 'pending-approval' })
  })

  it('reports delivering only when the policy is approved and the route is ready', async () => {
    const response = await handler({
      notifications: readyPort({
        isDurable: true,
        list: async () => ({ notifications: [] }),
        listPendingReviews: async () => ({ state: 'available', pendingReviews: [] }),
        markRead: async () => ({ read: true }),
      }),
      adultReviewReadiness: async () => ({ state: 'ready', adultReviewInAppDeliveryPolicy: 'approved' }),
    })(GET)
    expect(JSON.parse(response.body).delivery).toEqual({ policy: 'approved', state: 'delivering' })
  })
})

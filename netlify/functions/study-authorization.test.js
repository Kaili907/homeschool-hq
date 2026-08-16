import { describe, expect, it, vi } from 'vitest'
import { createStudyAdultReviewDeliverHandler } from './study-adult-review-deliver.js'
import { createStudyAdultReviewHandler } from './study-adult-review.js'
import { createStudyParentNotificationsHandler } from './study-parent-notifications.js'
import { createStudySessionIssueHandler } from './study-session-issue.js'
import { createStudySessionVerifyHandler } from './study-session-verify.js'

const ENV = Object.freeze({ ACADEMY_STUDY_ENABLED: 'true' })
const USER_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

function jsonBody(response) {
  return JSON.parse(response.body)
}

function ready(extra = {}) {
  return { isDurable: true, isReady: () => true, ...extra }
}

describe('Study session issue and verify authorization boundaries', () => {
  it('stops session issuance when bearer verification fails', async () => {
    const issue = vi.fn()
    const handler = createStudySessionIssueHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: false,
        response: { statusCode: 401, body: '{"error":{"code":"unauthenticated"}}' },
      }),
      issuer: ready({ issue }),
    })
    const response = await handler({
      httpMethod: 'POST', path: '/api/study/session/issue', headers: {}, body: '{}',
    })
    expect(response.statusCode).toBe(401)
    expect(issue).not.toHaveBeenCalled()
  })

  it('passes only the verified bearer and bounded selector to guardian issuance', async () => {
    const issue = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'issued',
      sessionReference: SESSION_REFERENCE,
      expiresAt: '2026-08-16T14:05:00.000Z',
    }))
    const handler = createStudySessionIssueHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: true,
        user: { id: USER_ID },
        accessToken: 'verified.guardian.token',
      }),
      issuer: ready({ issue }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/session/issue',
      headers: {
        authorization: 'Bearer untrusted.header.token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schemaVersion: 1,
        selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
      }),
    })
    expect(response.statusCode).toBe(201)
    expect(issue).toHaveBeenCalledWith({
      accessToken: 'verified.guardian.token',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
    })
    expect(JSON.stringify(issue.mock.calls)).not.toMatch(/household|role|capabilities/i)
  })

  it('rejects caller household, role, and capability claims before issuance', async () => {
    const issue = vi.fn()
    const handler = createStudySessionIssueHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: true, user: { id: USER_ID }, accessToken: 'verified.guardian.token',
      }),
      issuer: ready({ issue }),
    })
    for (const claim of [
      { householdId: 'forged-household' },
      { role: 'owner' },
      { capabilities: ['student:attempts:create'] },
    ]) {
      const response = await handler({
        httpMethod: 'POST',
        path: '/api/study/session/issue',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          schemaVersion: 1,
          selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
          ...claim,
        }),
      })
      expect(response.statusCode).toBe(400)
    }
    expect(issue).not.toHaveBeenCalled()
  })

  it('maps cross-household issuance refusal to a bounded denial', async () => {
    const handler = createStudySessionIssueHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: true, user: { id: USER_ID }, accessToken: 'verified.guardian.token',
      }),
      issuer: ready({ issue: async () => ({ status: 'denied' }) }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/session/issue',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
      }),
    })
    expect(response.statusCode).toBe(403)
    expect(jsonBody(response)).toEqual({ error: { code: 'learner_unavailable' } })
  })

  it('requires a Study bearer and passes one exact requested capability to verification', async () => {
    const verify = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'denied',
    }))
    const verifier = ready({ verify, revoke: vi.fn(), readiness: vi.fn() })
    const handler = createStudySessionVerifyHandler({ env: ENV, verifier })
    const missing = await handler({
      httpMethod: 'POST',
      path: '/api/study/session/verify',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, requiredCapability: 'student:progress:read' }),
    })
    expect(missing.statusCode).toBe(401)
    expect(verify).not.toHaveBeenCalled()

    const denied = await handler({
      httpMethod: 'POST',
      path: '/api/study/session/verify',
      headers: {
        authorization: `Bearer ${SESSION_REFERENCE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, requiredCapability: 'student:progress:read' }),
    })
    expect(denied.statusCode).toBe(401)
    expect(verify).toHaveBeenCalledWith({
      sessionReference: SESSION_REFERENCE,
      requiredCapability: 'student:progress:read',
    })
  })
})

describe('Study guardian and staff consumer authorization', () => {
  it('stops parent notification work when bearer verification fails', async () => {
    const notifications = ready({ list: vi.fn(), markRead: vi.fn() })
    const reserve = vi.fn()
    const handler = createStudyParentNotificationsHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: false,
        response: { statusCode: 401, body: '{"error":{"code":"unauthenticated"}}' },
      }),
      notifications,
      rateLimiter: ready({ reserve }),
    })
    const response = await handler({
      httpMethod: 'GET', path: '/api/study/parent-notifications', headers: {},
    })
    expect(response.statusCode).toBe(401)
    expect(reserve).not.toHaveBeenCalled()
    expect(notifications.list).not.toHaveBeenCalled()
  })

  it('uses only the verified guardian bearer and maps cross-household notification IDOR to 403', async () => {
    const markRead = vi.fn(async () => { throw new Error('guardian_notification_not_available') })
    const notifications = ready({ list: vi.fn(), markRead })
    const handler = createStudyParentNotificationsHandler({
      env: ENV,
      authVerifier: async () => ({
        ok: true, user: { id: USER_ID }, accessToken: 'verified.guardian.token',
      }),
      notifications,
      rateLimiter: ready({ reserve: async () => ({ allowed: true }) }),
    })
    const notificationRef = `notification:${'b'.repeat(64)}`
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/parent-notifications',
      headers: {
        authorization: 'Bearer caller.header.token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, action: 'mark-read', notificationId: notificationRef }),
    })
    expect(response.statusCode).toBe(403)
    expect(markRead).toHaveBeenCalledWith({
      accessToken: 'verified.guardian.token',
      notificationRef,
    })
    expect(response.body).not.toContain(notificationRef)
  })

  it('requires exact staff capabilities before adult-review readiness or processing', async () => {
    const requireAuthorization = vi.fn(async (_event, capability) => ({
      ok: capability === 'health:read',
      ...(capability === 'health:read'
        ? { principal: { userId: USER_ID }, accessToken: 'verified.staff.token' }
        : { response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' } }),
    }))
    const authorizeWorker = vi.fn()
    const process = vi.fn()
    const handler = createStudyAdultReviewHandler({
      env: ENV,
      authorization: { require: requireAuthorization },
      workerAuthorization: ready({ isDurable: true, authorize: authorizeWorker }),
      worker: ready({ isDurable: true, process }),
    })

    const readiness = await handler({
      httpMethod: 'GET', path: '/api/study/adult-review/readiness', headers: {},
    })
    expect(readiness.statusCode).toBe(200)
    const processResponse = await handler({
      httpMethod: 'POST',
      path: '/api/study/adult-review/process',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, action: 'process-pending' }),
    })
    expect(processResponse.statusCode).toBe(403)
    expect(requireAuthorization.mock.calls.map(([, capability]) => capability)).toEqual([
      'health:read',
      'engines:operate',
    ])
    expect(authorizeWorker).not.toHaveBeenCalled()
    expect(process).not.toHaveBeenCalled()
  })

  it('binds adult-review domain authorization to the verified staff principal', async () => {
    const authorizeWorker = vi.fn(async () => true)
    const process = vi.fn(async () => undefined)
    const handler = createStudyAdultReviewHandler({
      env: ENV,
      authorization: {
        require: async (_event, capability) => ({
          ok: capability === 'engines:operate',
          principal: { userId: USER_ID },
          accessToken: 'verified.staff.token',
        }),
      },
      workerAuthorization: ready({ isDurable: true, authorize: authorizeWorker }),
      worker: ready({ isDurable: true, process }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/adult-review/process',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ schemaVersion: 1, action: 'process-pending' }),
    })
    expect(response.statusCode).toBe(200)
    expect(authorizeWorker).toHaveBeenCalledWith({
      actorUserId: USER_ID,
      accessToken: 'verified.staff.token',
    })
    expect(process).toHaveBeenCalledOnce()
  })

  it('stops adult-review delivery before reconciliation when worker auth fails', async () => {
    const reconcile = vi.fn()
    const recordDenied = vi.fn(async () => undefined)
    const handler = createStudyAdultReviewDeliverHandler({
      env: ENV,
      workerAuthorization: ready({
        isDurable: true,
        authorize: async () => ({ authorized: false }),
        recordDenied,
      }),
      delivery: ready({ isDurable: true, reconcile }),
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/adult-review/deliver',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 2,
        action: 'reconcile-indeterminate',
        jobId: 'job:authorized-shape-only',
      }),
    })
    expect(response.statusCode).toBe(403)
    expect(reconcile).not.toHaveBeenCalled()
    expect(recordDenied).toHaveBeenCalledWith({
      eventName: 'study.adult_review.unauthorized_worker',
      reasonCode: 'worker-auth-failed',
    })
  })
})

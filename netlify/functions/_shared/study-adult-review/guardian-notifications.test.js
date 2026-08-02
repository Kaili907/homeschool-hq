import { describe, expect, it, vi } from 'vitest'
import { createGuardianNotificationPort } from './guardian-notifications.js'

const ENV = {
  SUPABASE_URL: 'https://synthetic-project.supabase.co',
  SUPABASE_ANON_KEY: 'synthetic-anon-key',
}
const ACCESS_TOKEN = 'synthetic.access.token'

function response(body, ok = true) {
  return { ok, json: async () => structuredClone(body) }
}

describe('guardian notification authorization boundary', () => {
  it('sends only the bearer session and server-RPC parameters', async () => {
    const notification = {
      notificationId: `notification:${'a'.repeat(64)}`,
      title: 'Study check-in needs your review',
      reasonCategory: 'immediate-safety',
      urgency: 'urgent',
      createdAt: '2026-08-01T12:00:01.000Z',
      deliveredAt: '2026-08-01T12:00:00.000Z',
      read: false,
      actionRef: `adult-review:proposal:${'b'.repeat(64)}`,
    }
    const fetchImpl = vi.fn(async () => response({ notifications: [notification] }))
    const port = createGuardianNotificationPort({ env: ENV, fetchImpl })
    await expect(port.list({ accessToken: ACCESS_TOKEN, limit: 25 })).resolves.toEqual({ notifications: [notification] })
    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://synthetic-project.supabase.co/rest/v1/rpc/academy_study_list_parent_notifications_v1')
    expect(request.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
    expect(JSON.parse(request.body)).toEqual({ p_limit: 25 })
    expect(request.body).not.toContain('household')
    expect(request.body).not.toContain('student')
    expect(request.body).not.toContain('permission')
  })

  it('rejects caller-expanded list inputs and malformed server evidence', async () => {
    const fetchImpl = vi.fn(async () => response({ notifications: [], householdRef: 'caller-value' }))
    const port = createGuardianNotificationPort({ env: ENV, fetchImpl })
    await expect(port.list({ accessToken: ACCESS_TOKEN, limit: 0 })).rejects.toThrow('invalid_guardian_notification_limit')
    await expect(port.list({ accessToken: ACCESS_TOKEN, limit: 50 })).rejects.toThrow('guardian_notification_port_contract')
  })

  it('accepts only an opaque notification reference and exact read receipt', async () => {
    const notificationRef = `notification:${'a'.repeat(64)}`
    const fetchImpl = vi.fn(async () => response({ read: true }))
    const port = createGuardianNotificationPort({ env: ENV, fetchImpl })
    await expect(port.markRead({ accessToken: ACCESS_TOKEN, notificationRef })).resolves.toEqual({ read: true })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ p_notification_ref: notificationRef })
    await expect(port.markRead({
      accessToken: ACCESS_TOKEN,
      notificationRef: 'guardian@example.test',
    })).rejects.toThrow('invalid_guardian_notification_ref')
  })
})

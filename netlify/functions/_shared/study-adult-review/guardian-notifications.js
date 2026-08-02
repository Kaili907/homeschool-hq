function config(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !anonKey) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

export function createGuardianNotificationPort(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const configured = config(env)

  async function call(name, parameters, accessToken) {
    if (!configured || typeof fetchImpl !== 'function' || typeof accessToken !== 'string') {
      throw new Error('guardian_notification_port_not_ready')
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchImpl(`${configured.url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: {
          apikey: configured.anonKey,
          Authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(parameters),
      })
      if (!response.ok) throw new Error('guardian_notification_not_available')
      const value = await response.json()
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('guardian_notification_port_contract')
      }
      return value
    } catch (error) {
      if (error instanceof Error && error.message === 'guardian_notification_not_available') throw error
      throw new Error('guardian_notification_port_unavailable')
    } finally {
      clearTimeout(timer)
    }
  }

  return Object.freeze({
    isDurable: true,
    isReady: () => configured !== null && typeof fetchImpl === 'function',
    list: ({ accessToken, limit = 50 }) => call(
      'academy_study_list_parent_notifications_v1', { p_limit: limit }, accessToken,
    ),
    markRead: ({ accessToken, notificationRef }) => call(
      'academy_study_mark_parent_notification_read_v1',
      { p_notification_ref: notificationRef }, accessToken,
    ),
  })
}

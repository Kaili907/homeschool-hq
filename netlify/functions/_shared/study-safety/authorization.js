import { validUuid } from './contracts.js'

function supabaseConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !anonKey) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

export function createSupabaseLearnerAuthorizationPort(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const config = supabaseConfig(env)
  return Object.freeze({
    isReady: () => config !== null,
    isDurable: true,
    // The base identity schema has no canonical Study-session ownership table.
    verifiesSession: false,
    async resolve({ actorUserId, accessToken, studentRef, sessionId }) {
      if (!config || !validUuid(actorUserId) || typeof accessToken !== 'string' || accessToken.length < 1) {
        return { status: 'unavailable', code: 'learner-authorization-unavailable' }
      }
      const column = studentRef.kind === 'academy-student-id' ? 'id' : 'legacy_profile_id'
      const query = new URLSearchParams({
        select: 'id,household_id,lifecycle_status',
        [column]: `eq.${studentRef.value}`,
        limit: '2',
      })
      let response
      try {
        response = await fetchImpl(`${config.url}/rest/v1/academy_students?${query.toString()}`, {
          method: 'GET',
          redirect: 'error',
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${accessToken}`,
            accept: 'application/json',
          },
        })
      } catch {
        return { status: 'unavailable', code: 'learner-authorization-unavailable' }
      }
      if (!response.ok) return { status: 'unavailable', code: 'learner-authorization-unavailable' }
      let rows
      try {
        rows = await response.json()
      } catch {
        return { status: 'unavailable', code: 'learner-authorization-unavailable' }
      }
      if (
        !Array.isArray(rows) ||
        rows.length !== 1 ||
        rows[0]?.lifecycle_status !== 'active' ||
        !validUuid(rows[0]?.id) ||
        !validUuid(rows[0]?.household_id)
      ) {
        return { status: 'denied', code: 'learner-not-authorized' }
      }
      return {
        status: 'authorized',
        context: Object.freeze({
          actorUserId,
          householdId: rows[0].household_id,
          studentId: rows[0].id,
          sessionId,
        }),
      }
    },
  })
}

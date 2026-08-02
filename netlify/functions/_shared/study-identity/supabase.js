import {
  digestStudySessionReference,
  isIssuedGrant,
  isVerifiedGrant,
  STUDY_IDENTITY_SCHEMA_VERSION,
} from './contracts.js'

function supabaseConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  const serviceKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null
    return {
      url: url.toString().replace(/\/+$/, ''),
      anonKey: anonKey || null,
      serviceKey: serviceKey || null,
    }
  } catch {
    return null
  }
}

async function postRpc({ fetchImpl, url, key, bearer, name, parameters, timeoutMs }) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      redirect: 'error',
      signal: controller.signal,
      headers: {
        apikey: key,
        Authorization: `Bearer ${bearer}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(parameters),
    })
  } finally {
    clearTimeout(timer)
  }
}

export function createGuardianStudySessionIssuer(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const config = supabaseConfig(env)

  return Object.freeze({
    isReady: () => Boolean(config?.anonKey && typeof fetchImpl === 'function'),
    isDurable: true,
    async issue({ accessToken, selectedStudentRef }) {
      if (
        !config?.anonKey ||
        typeof accessToken !== 'string' ||
        !selectedStudentRef?.kind ||
        !selectedStudentRef?.value
      ) {
        return { status: 'unavailable' }
      }
      let response
      try {
        response = await postRpc({
          fetchImpl,
          url: config.url,
          key: config.anonKey,
          bearer: accessToken,
          name: 'academy_study_issue_guardian_launch_v1',
          parameters: {
            p_selector_kind: selectedStudentRef.kind,
            p_selector_value: selectedStudentRef.value,
          },
          timeoutMs,
        })
      } catch {
        return { status: 'unavailable' }
      }
      if ([401, 403].includes(response.status)) return { status: 'denied' }
      if (!response.ok) return { status: 'unavailable' }
      let grant
      try {
        grant = await response.json()
      } catch {
        return { status: 'unavailable' }
      }
      return isIssuedGrant(grant) ? grant : { status: 'unavailable' }
    },
  })
}

export function createTrustedStudySessionVerifier(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 3_000
  const config = supabaseConfig(env)
  const configured = () => Boolean(config?.serviceKey && typeof fetchImpl === 'function')

  async function serviceRpc(name, parameters) {
    if (!configured()) return null
    let response
    try {
      response = await postRpc({
        fetchImpl,
        url: config.url,
        key: config.serviceKey,
        bearer: config.serviceKey,
        name,
        parameters,
        timeoutMs,
      })
    } catch {
      return null
    }
    if (!response.ok) return null
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  return Object.freeze({
    isReady: configured,
    isDurable: true,
    async verify({ sessionReference, requiredCapability }) {
      const digest = digestStudySessionReference(sessionReference)
      if (!digest) return { status: 'denied' }
      const result = await serviceRpc('academy_study_verify_session_v1', {
        p_token_digest: digest,
        p_required_capability: requiredCapability,
      })
      if (result?.status === 'denied' && result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION) {
        return { status: 'denied' }
      }
      return isVerifiedGrant(result) ? result : { status: 'unavailable' }
    },
    async revoke({ sessionReference }) {
      const digest = digestStudySessionReference(sessionReference)
      if (!digest) return { status: 'revoked', schemaVersion: STUDY_IDENTITY_SCHEMA_VERSION }
      const result = await serviceRpc('academy_study_revoke_session_v1', { p_token_digest: digest })
      return result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION && result?.status === 'revoked'
        ? result
        : { status: 'unavailable' }
    },
    async readiness() {
      const result = await serviceRpc('academy_study_verified_identity_readiness_v1', {})
      return result?.schemaVersion === STUDY_IDENTITY_SCHEMA_VERSION && result?.status === 'ready'
        ? { status: 'ready' }
        : { status: 'not-ready' }
    },
  })
}

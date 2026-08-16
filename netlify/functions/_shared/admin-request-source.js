export const ADMIN_REQUEST_SOURCE_FAILURE_CODE = 'invalid_request_source'
export const ACADEMY_TRUSTED_ORIGIN_ENV = 'ACADEMY_TRUSTED_ORIGIN'
export const ACADEMY_DEV_TRUSTED_ORIGINS_ENV = 'ACADEMY_DEV_TRUSTED_ORIGINS'

const NETLIFY_DEVELOPMENT_CONTEXT = 'dev'
const MAX_HEADER_LENGTH = 2_048
const MAX_DEVELOPMENT_ORIGINS = 16
const MAX_DEVELOPMENT_ORIGINS_CONFIG_LENGTH = 8_192
const LOCAL_DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** @typedef {{ ok: true }} AdminRequestSourcePass */
/** @typedef {{ ok: false, code: 'invalid_request_source' }} AdminRequestSourceFailure */
/** @typedef {AdminRequestSourcePass | AdminRequestSourceFailure} AdminRequestSourceResult */

const PASS = Object.freeze({ ok: true })
const FAILURE = Object.freeze({ ok: false, code: ADMIN_REQUEST_SOURCE_FAILURE_CODE })

function canonicalOrigin(value, { production = false, localhost = false } = {}) {
  if (typeof value !== 'string' || value === '' || value.length > MAX_HEADER_LENGTH || value.includes('*')) {
    return null
  }

  try {
    const url = new URL(value)
    if (url.username || url.password) return null
    if (production && url.protocol !== 'https:') return null
    if (production && LOCAL_DEVELOPMENT_HOSTS.has(url.hostname)) return null
    if (!production && !['http:', 'https:'].includes(url.protocol)) return null
    if (localhost && !LOCAL_DEVELOPMENT_HOSTS.has(url.hostname)) return null

    // URL.origin removes paths, queries, fragments, default ports, and other
    // non-canonical spellings. Requiring the original value to equal it keeps
    // both configuration and request comparison exact and unambiguous.
    return value === url.origin ? url.origin : null
  } catch {
    return null
  }
}

function developmentOrigins(value) {
  if (value === undefined) return []
  if (
    typeof value !== 'string' ||
    value === '' ||
    value.length > MAX_DEVELOPMENT_ORIGINS_CONFIG_LENGTH
  ) {
    return null
  }

  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_DEVELOPMENT_ORIGINS) return null

  const origins = []
  const seen = new Set()
  for (const candidate of parsed) {
    const origin = canonicalOrigin(candidate, { localhost: true })
    if (!origin || seen.has(origin)) return null
    seen.add(origin)
    origins.push(origin)
  }
  return origins
}

/**
 * Parse the fail-closed deploy configuration used by the request-source guard.
 * Development origins are validated in every context but are trusted only in
 * Netlify's explicit `dev` context.
 */
export function parseAdminRequestSourceConfig(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return null

  const productionOrigin = canonicalOrigin(env[ACADEMY_TRUSTED_ORIGIN_ENV], { production: true })
  if (!productionOrigin) return null

  const configuredDevelopmentOrigins = developmentOrigins(env[ACADEMY_DEV_TRUSTED_ORIGINS_ENV])
  if (configuredDevelopmentOrigins === null) return null

  const includeDevelopmentOrigins = env.CONTEXT === NETLIFY_DEVELOPMENT_CONTEXT
  const trustedOrigins = includeDevelopmentOrigins
    ? [productionOrigin, ...configuredDevelopmentOrigins]
    : [productionOrigin]

  if (new Set(trustedOrigins).size !== trustedOrigins.length) return null
  return Object.freeze({
    development: includeDevelopmentOrigins,
    trustedOrigins: Object.freeze(trustedOrigins),
  })
}

function matchingHeaderEntries(headers, wantedName) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return []
  return Object.entries(headers).filter(([name]) => name.toLowerCase() === wantedName)
}

function singleHeaderValue(event, name) {
  const wantedName = name.toLowerCase()
  const headerEntries = matchingHeaderEntries(event?.headers, wantedName)
  if (headerEntries.length > 1) return null
  if (headerEntries.length === 1 && typeof headerEntries[0][1] !== 'string') return null

  const multiValueEntries = matchingHeaderEntries(event?.multiValueHeaders, wantedName)
  if (multiValueEntries.length > 1) return null
  if (multiValueEntries.length === 1) {
    const values = multiValueEntries[0][1]
    if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') return null
  }

  const headerValue = headerEntries.length === 1 ? headerEntries[0][1] : undefined
  const multiValue = multiValueEntries.length === 1 ? multiValueEntries[0][1][0] : undefined
  if (headerValue !== undefined && multiValue !== undefined && headerValue !== multiValue) return null

  const value = headerValue ?? multiValue
  if (typeof value !== 'string' || value === '' || value.length > MAX_HEADER_LENGTH || value.includes(',')) {
    return null
  }
  return value
}

/**
 * Verify browser provenance for a sensitive Admin mutation request.
 *
 * This helper intentionally does not inspect the method, Host, forwarded host,
 * Referer, URL, bearer, session, role, capability, AAL, or step-up state.
 * Callers must compose all authorization layers separately.
 *
 * @returns {AdminRequestSourceResult}
 */
export function guardAdminRequestSource(event, { env = process.env } = {}) {
  try {
    const config = parseAdminRequestSourceConfig(env)
    if (!config) return FAILURE

    const origin = singleHeaderValue(event, 'origin')
    if (!origin || canonicalOrigin(origin) !== origin || !config.trustedOrigins.includes(origin)) {
      return FAILURE
    }

    const fetchSite = singleHeaderValue(event, 'sec-fetch-site')
    if (fetchSite !== 'same-origin') return FAILURE

    return PASS
  } catch {
    return FAILURE
  }
}

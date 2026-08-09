import { createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  assertExactObject,
  boundedString,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  reject,
  responseForError,
} from './_shared/http.js'
import { createParentInstallationPort } from './_shared/parent-installations.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const GRANT_TOKEN = /^pit_v1_[A-Za-z0-9_-]{43}$/
const API_PREFIX = '/api/parent/installations/'
const FUNCTION_PREFIX = '/.netlify/functions/parent-installations/'
const ENDPOINTS = new Set([
  'status',
  'enrollment-grant',
  'claim',
  'recovery-grant',
  'recover',
  'revoke',
])

function endpoint(path) {
  if (typeof path !== 'string') return null
  const prefix = path.startsWith(API_PREFIX)
    ? API_PREFIX
    : path.startsWith(FUNCTION_PREFIX)
      ? FUNCTION_PREFIX
      : null
  if (!prefix) return null
  const candidate = path.slice(prefix.length)
  return ENDPOINTS.has(candidate) ? candidate : null
}

function uuidV4(value) {
  if (typeof value !== 'string' || !UUID_V4.test(value)) {
    reject(400, 'invalid_request')
  }
  return value
}

function commonBody(event, keys) {
  const body = assertExactObject(readJsonBody(event, 2_048), [
    'schemaVersion',
    ...keys,
  ])
  if (body.schemaVersion !== 1) reject(400, 'invalid_request')
  return body
}

function digestGrant(rawGrant) {
  return createHash('sha256').update(rawGrant, 'utf8').digest('hex')
}

export function createParentInstallationsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authVerifier = overrides.authVerifier ?? verifySupabaseBearer
  const installations = overrides.installations
    ?? createParentInstallationPort({ env, fetchImpl })
  const createGrant = overrides.createGrant
    ?? (() => `pit_v1_${randomBytes(32).toString('base64url')}`)
  const createCorrelationId = overrides.createCorrelationId ?? randomUUID

  return async (event) => {
    const operation = endpoint(event?.path)
    if (!operation) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (event?.httpMethod !== 'POST') {
      return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    }

    try {
      const auth = await authVerifier(event, { env, fetchImpl, timeoutMs: 3_000 })
      if (!auth.ok) return auth.response
      if (
        installations?.isDurable !== true ||
        installations?.isReady?.() !== true
      ) return errorResponse(503, 'service_not_ready')

      if (operation === 'status') {
        const body = commonBody(event, ['householdId', 'installationId'])
        const result = await installations.status({
          accessToken: auth.accessToken,
          householdId: uuidV4(body.householdId),
          installationId: uuidV4(body.installationId),
        })
        return jsonResponse(200, result)
      }

      if (operation === 'enrollment-grant' || operation === 'recovery-grant') {
        const requestedKeys = operation === 'enrollment-grant'
          ? ['householdId', 'installationId', 'datasetEpoch', 'purpose']
          : ['householdId', 'installationId', 'datasetEpoch']
        const body = commonBody(event, requestedKeys)
        const purpose = operation === 'recovery-grant'
          ? 'recovery'
          : boundedString(body.purpose, { max: 32, singleLine: true })
        if (
          operation === 'enrollment-grant' &&
          !['first_claim', 'legacy_upgrade'].includes(purpose)
        ) reject(400, 'invalid_request')

        const rawGrant = createGrant()
        if (typeof rawGrant !== 'string' || !GRANT_TOKEN.test(rawGrant)) {
          return errorResponse(503, 'service_not_ready')
        }
        const result = await installations.issue({
          accessToken: auth.accessToken,
          householdId: uuidV4(body.householdId),
          installationId: uuidV4(body.installationId),
          datasetEpoch: uuidV4(body.datasetEpoch),
          purpose,
          tokenDigest: digestGrant(rawGrant),
          correlationId: uuidV4(createCorrelationId()),
        })
        return jsonResponse(201, { ...result, grantToken: rawGrant })
      }

      if (operation === 'claim') {
        const body = commonBody(event, [
          'installationId', 'datasetEpoch', 'purpose', 'grantToken',
        ])
        const purpose = boundedString(body.purpose, { max: 32, singleLine: true })
        if (!['first_claim', 'legacy_upgrade'].includes(purpose)) {
          reject(400, 'invalid_request')
        }
        const grantToken = boundedString(body.grantToken, {
          min: 50,
          max: 50,
          singleLine: true,
        })
        if (!GRANT_TOKEN.test(grantToken)) {
          reject(400, 'invalid_request')
        }
        const result = await installations.claim({
          accessToken: auth.accessToken,
          installationId: uuidV4(body.installationId),
          datasetEpoch: uuidV4(body.datasetEpoch),
          purpose,
          tokenDigest: digestGrant(grantToken),
          correlationId: uuidV4(createCorrelationId()),
        })
        return jsonResponse(200, result)
      }

      if (operation === 'recover') {
        const body = commonBody(event, [
          'installationId',
          'datasetEpoch',
          'grantToken',
          'localCredentialEnrollmentId',
        ])
        const grantToken = boundedString(body.grantToken, {
          min: 50,
          max: 50,
          singleLine: true,
        })
        if (!GRANT_TOKEN.test(grantToken)) {
          reject(400, 'invalid_request')
        }
        const result = await installations.recover({
          accessToken: auth.accessToken,
          installationId: uuidV4(body.installationId),
          datasetEpoch: uuidV4(body.datasetEpoch),
          tokenDigest: digestGrant(grantToken),
          localCredentialEnrollmentId: uuidV4(
            body.localCredentialEnrollmentId,
          ),
          correlationId: uuidV4(createCorrelationId()),
        })
        return jsonResponse(200, result)
      }

      const body = commonBody(event, [
        'householdId', 'installationId', 'datasetEpoch',
      ])
      const result = await installations.revoke({
        accessToken: auth.accessToken,
        householdId: uuidV4(body.householdId),
        installationId: uuidV4(body.installationId),
        datasetEpoch: uuidV4(body.datasetEpoch),
        correlationId: uuidV4(createCorrelationId()),
      })
      return jsonResponse(200, result)
    } catch (error) {
      if (error instanceof Error && error.message === 'parent_installation_denied') {
        return errorResponse(403, 'not_authorized')
      }
      if (
        error instanceof Error &&
        error.message === 'parent_installation_unavailable'
      ) return errorResponse(503, 'service_unavailable')
      return responseForError(error)
    }
  }
}

export const handler = createParentInstallationsHandler()

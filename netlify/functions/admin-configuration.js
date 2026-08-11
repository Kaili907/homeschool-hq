import { createHash, randomBytes } from 'node:crypto'
import {
  isAdminConfigurationKey,
  isAdminConfigurationValue,
} from '../../src/admin/configurationModel.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminConfigurationSourceError,
  createAdminConfigurationSource,
} from './_shared/admin-configuration-source.js'
import {
  projectAdminRuntimeConfiguration,
  resolveEffectiveRuntimeConfiguration,
} from './_shared/admin-runtime-configuration.js'
import { TTS_VOICE_CATALOG } from './_shared/tts-catalog.js'
import {
  assertExactObject,
  errorResponse,
  hasBody,
  hasQuery,
  jsonResponse,
  readJsonBody,
  reject,
  responseForError,
} from './_shared/http.js'

const READ_PATHS = new Set([
  '/api/admin/v1/configuration',
  '/.netlify/functions/admin-configuration',
])
const PREVIEW_PATH = '/api/admin/v1/configuration/preview'
const COMMIT_PATH = '/api/admin/v1/configuration/commit'
const REVISION = /^[1-9]\d{0,18}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONFIRMATION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const MAX_BIGINT = 9_223_372_036_854_775_807n
const REASONS = new Set([
  'operator.request',
  'scheduled.change',
  'policy.enforcement',
  'incident.response',
  'corrective.action',
  'emergency.response',
  'configuration.changed',
])

function parseRevision(value) {
  if (typeof value !== 'string' || !REVISION.test(value) || BigInt(value) > MAX_BIGINT) {
    reject(400, 'invalid_request')
  }
  return value
}

function commonRequest(body, optionalKeys = []) {
  assertExactObject(body, ['settingKey', 'expectedRevision', 'newValue', 'reasonCode'], optionalKeys)
  if (!isAdminConfigurationKey(body.settingKey)
    || !isAdminConfigurationValue(body.settingKey, body.newValue)
    || typeof body.reasonCode !== 'string'
    || !REASONS.has(body.reasonCode)) reject(400, 'invalid_request')
  return {
    settingKey: body.settingKey,
    expectedRevision: parseRevision(body.expectedRevision),
    newValue: body.newValue,
    reasonCode: body.reasonCode,
  }
}

export function parseConfigurationPreviewRequest(event) {
  return Object.freeze(commonRequest(readJsonBody(event, 4_096)))
}

export function parseConfigurationCommitRequest(event) {
  const body = readJsonBody(event, 4_096)
  const common = commonRequest(body, ['requestId', 'confirmationToken'])
  if (typeof body.requestId !== 'string' || !UUID.test(body.requestId)
    || typeof body.confirmationToken !== 'string'
    || !CONFIRMATION_TOKEN.test(body.confirmationToken)) reject(400, 'invalid_request')
  return Object.freeze({
    ...common,
    requestId: body.requestId.toLowerCase(),
    confirmationToken: body.confirmationToken,
  })
}

function digest(token) {
  return createHash('sha256').update(token).digest('hex')
}

function errorForSource(error) {
  if (!(error instanceof AdminConfigurationSourceError)) return responseForError(error)
  if (error.code === 'source_timeout') return errorResponse(504, 'configuration_source_timeout')
  if (error.code === 'source_unavailable' || error.code === 'read_required') {
    return errorResponse(503, 'configuration_source_unavailable')
  }
  if (error.code === 'manage_required') return errorResponse(403, 'admin_access_denied')
  if ([
    'revision_conflict', 'idempotency_conflict', 'confirmation_expired',
    'confirmation_reused', 'request_in_progress',
  ].includes(error.code)) return errorResponse(409, error.code)
  if ([
    'confirmation_invalid', 'confirmation_mismatch', 'cross_setting_invalid',
    'value_invalid', 'unknown_key', 'invalid_request',
  ].includes(error.code)) return errorResponse(400, error.code)
  return errorResponse(503, 'configuration_source_unavailable')
}

export function createAdminConfigurationHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminConfigurationSource({
    env,
    fetchImpl,
    serviceClient: overrides.serviceClient,
    mutationClientFactory: overrides.mutationClientFactory,
  })
  const catalog = overrides.catalog ?? TTS_VOICE_CATALOG
  const effectiveResolver = overrides.effectiveResolver
    ?? ((projection) => resolveEffectiveRuntimeConfiguration(projection, { env, catalog }))
  const tokenFactory = overrides.tokenFactory ?? (() => randomBytes(32).toString('base64url'))

  return async (event) => {
    const path = event?.path ?? ''
    const isRead = event?.httpMethod === 'GET' && READ_PATHS.has(path)
    const isPreview = event?.httpMethod === 'POST' && path === PREVIEW_PATH
    const isCommit = event?.httpMethod === 'POST' && path === COMMIT_PATH
    if (!isRead && !isPreview && !isCommit) {
      if (READ_PATHS.has(path)) return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
      if (path === PREVIEW_PATH || path === COMMIT_PATH) {
        return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
      }
      return errorResponse(404, 'not_found')
    }
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (isRead && hasBody(event)) return errorResponse(400, 'invalid_request')

    const capability = isRead ? 'configuration:read' : 'configuration:manage'
    const authorized = await authorization.require(event, capability)
    if (!authorized.ok) return authorized.response
    try {
      if (isRead) {
        const saved = await source.read()
        try {
          return jsonResponse(200, projectAdminRuntimeConfiguration(
            saved,
            await effectiveResolver(saved),
          ))
        } catch {
          throw new AdminConfigurationSourceError('source_unavailable')
        }
      }
      if (isPreview) {
        const request = parseConfigurationPreviewRequest(event)
        const confirmationToken = tokenFactory()
        if (typeof confirmationToken !== 'string' || !CONFIRMATION_TOKEN.test(confirmationToken)) {
          throw new AdminConfigurationSourceError('source_unavailable')
        }
        const projection = await source.preview(
          authorized.accessToken,
          request,
          digest(confirmationToken),
        )
        return jsonResponse(200, { ...projection, confirmationToken })
      }
      const request = parseConfigurationCommitRequest(event)
      const { confirmationToken, ...immutableRequest } = request
      return jsonResponse(200, await source.commit(
        authorized.accessToken,
        immutableRequest,
        digest(confirmationToken),
      ))
    } catch (error) {
      return errorForSource(error)
    }
  }
}

export const handler = createAdminConfigurationHandler()

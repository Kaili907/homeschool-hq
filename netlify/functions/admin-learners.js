import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminLearnerProjectionError,
  createAdminLearnerReader,
} from './_shared/admin-learner-reader.js'
import { hasOnlyLearnerOperationsFields } from '../../src/admin/learnerAnalyticsModel.ts'
import { errorResponse, jsonResponse } from './_shared/http.js'

const API_PREFIX = '/api/admin/v1/learners'
const FUNCTION_PREFIX = '/.netlify/functions/admin-learners'

function routeFromPath(path) {
  if (path === API_PREFIX || path === FUNCTION_PREFIX) return { kind: 'snapshot' }
  const prefix = path?.startsWith(`${API_PREFIX}/`)
    ? `${API_PREFIX}/`
    : path?.startsWith(`${FUNCTION_PREFIX}/`)
      ? `${FUNCTION_PREFIX}/`
      : null
  if (!prefix) return null
  const learnerRef = path.slice(prefix.length)
  return /^p[1-5]$/.test(learnerRef) ? { kind: 'detail', learnerRef } : null
}

function todayFromEvent(event) {
  const query = event?.queryStringParameters
  const multi = event?.multiValueQueryStringParameters
  if (multi && typeof multi === 'object' && Object.keys(multi).length > 0) return { ok: false }
  if (!query || typeof query !== 'object' || Object.keys(query).length === 0) {
    if ((event?.rawQuery ?? event?.rawQueryString ?? '') !== '') return { ok: false }
    return { ok: true }
  }
  if (Object.keys(query).length !== 1 || typeof query.today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(query.today)) {
    return { ok: false }
  }
  const parsed = new Date(`${query.today}T00:00:00.000Z`)
  return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== query.today
    ? { ok: false }
    : { ok: true, today: query.today }
}

export function createAdminLearnersHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const reader = overrides.reader ?? createAdminLearnerReader({
    env,
    fetchImpl,
    clientFactory: overrides.learnerClientFactory,
    catalogSource: overrides.catalogSource,
    clock: overrides.clock,
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    const date = todayFromEvent(event)
    if (!date.ok || (typeof event?.body === 'string' && event.body !== '')) {
      return errorResponse(400, 'invalid_request')
    }
    const route = routeFromPath(event?.path)
    if (!route) return errorResponse(404, 'not_found')

    // Independent endpoint enforcement. UI state, request bodies, query
    // strings, and browser role/capability claims are not consulted.
    const authorized = await authorization.require(event, 'learners:read')
    if (!authorized.ok) return authorized.response
    if (typeof authorized.accessToken !== 'string' || authorized.accessToken === '') {
      return errorResponse(503, 'authorization_unavailable')
    }

    try {
      const projection = route.kind === 'snapshot'
        ? await reader.readSnapshot({
            accessToken: authorized.accessToken,
            ...(date.today ? { today: date.today } : {}),
          })
        : await reader.readDetail({
            accessToken: authorized.accessToken,
            learnerRef: route.learnerRef,
            ...(date.today ? { today: date.today } : {}),
          })
      if (!hasOnlyLearnerOperationsFields(projection)) {
        return errorResponse(503, 'learner_source_unavailable')
      }
      return jsonResponse(200, projection)
    } catch (error) {
      if (error instanceof AdminLearnerProjectionError && error.code === 'learner_not_found') {
        return errorResponse(404, 'learner_not_found')
      }
      return errorResponse(503, 'learner_source_unavailable')
    }
  }
}

export const handler = createAdminLearnersHandler()

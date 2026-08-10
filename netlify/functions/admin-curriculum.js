import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminCurriculumRegistryReader } from './_shared/admin-curriculum-registry-reader.js'
import { errorResponse, hasQuery, jsonResponse } from './_shared/http.js'
import { createFilesystemCurriculumSource } from '../../src/admin/curriculum/filesystemSource.node.ts'
import { loadAdminCurriculumValidationEvidence } from './_shared/admin-curriculum-evidence.js'

const API_PREFIX = '/api/admin/curriculum/'
const FUNCTION_PREFIX = '/.netlify/functions/admin-curriculum/'
const LESSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/

function routeFromPath(path) {
  if (typeof path !== 'string') return null
  const prefix = path.startsWith(API_PREFIX)
    ? API_PREFIX
    : path.startsWith(FUNCTION_PREFIX)
      ? FUNCTION_PREFIX
      : null
  if (!prefix) return null
  const resource = path.slice(prefix.length)
  if (resource === 'catalog') return { kind: 'catalog' }
  if (resource === 'validation') return { kind: 'validation' }
  if (resource === 'releases') return { kind: 'releases' }
  if (resource === 'production-pointer') return { kind: 'production-pointer' }
  if (resource.startsWith('releases/')) {
    try {
      const version = decodeURIComponent(resource.slice('releases/'.length))
      return RELEASE_VERSION.test(version) ? { kind: 'release', version } : null
    } catch {
      return null
    }
  }
  if (!resource.startsWith('lessons/')) return null
  try {
    const lessonRef = decodeURIComponent(resource.slice('lessons/'.length))
    return LESSON_REF.test(lessonRef) ? { kind: 'lesson', lessonRef } : null
  } catch {
    return null
  }
}

export function createAdminCurriculumHandler(overrides = {}) {
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.client,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? {
    ...createFilesystemCurriculumSource(),
    loadValidationEvidence: loadAdminCurriculumValidationEvidence,
  }
  const registry = overrides.registry ?? createAdminCurriculumRegistryReader({
    env: overrides.env ?? process.env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.registryClient,
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    const route = routeFromPath(event?.path)
    if (!route) return errorResponse(404, 'not_found')

    const authorized = await authorization.require(event, 'curriculum:read')
    if (!authorized.ok) return authorized.response
    try {
      const value = route.kind === 'catalog'
        ? await source.loadCatalog()
        : route.kind === 'validation'
          ? await source.loadValidationEvidence()
          : route.kind === 'lesson'
            ? await source.loadLesson(route.lessonRef)
            : route.kind === 'releases'
              ? await registry.list()
              : route.kind === 'release'
                ? await registry.details(route.version)
                : await registry.productionPointer()
      return jsonResponse(200, value)
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      if (code === 'not-found') return errorResponse(
        404,
        route.kind === 'release' ? 'curriculum_release_unavailable' : 'curriculum_record_unavailable',
      )
      return errorResponse(503, 'curriculum_source_unavailable')
    }
  }
}

export const handler = createAdminCurriculumHandler()

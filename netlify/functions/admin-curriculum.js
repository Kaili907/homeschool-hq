import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { errorResponse, hasQuery, jsonResponse } from './_shared/http.js'
import { createFilesystemCurriculumSource } from '../../src/admin/curriculum/filesystemSource.node.ts'
import { readFile } from 'node:fs/promises'

const API_PREFIX = '/api/admin/curriculum/'
const FUNCTION_PREFIX = '/.netlify/functions/admin-curriculum/'
const LESSON_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

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
  if (!resource.startsWith('lessons/')) return null
  try {
    const lessonRef = decodeURIComponent(resource.slice('lessons/'.length))
    return LESSON_REF.test(lessonRef) ? { kind: 'lesson', lessonRef } : null
  } catch {
    return null
  }
}

async function loadValidationEvidence() {
  const root = new URL('../../curriculum-content/manuel-academy/1.0.0/', import.meta.url)
  const [validation, curriculumManifest, packageManifest, checksumManifest, manifestVerification] = await Promise.all([
    readFile(new URL('validation/validation.json', root), 'utf8'),
    readFile(new URL('curriculum-manifest.json', root), 'utf8'),
    readFile(new URL('MANIFEST.json', root), 'utf8'),
    readFile(new URL('SHA256SUMS.txt', root), 'utf8'),
    readFile(new URL('validation/manifest-verification.txt', root), 'utf8'),
  ])
  return {
    validation: JSON.parse(validation),
    curriculumManifest: JSON.parse(curriculumManifest),
    packageManifest: JSON.parse(packageManifest),
    checksumManifest,
    manifestVerification,
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
    loadValidationEvidence,
  }

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
          : await source.loadLesson(route.lessonRef)
      return jsonResponse(200, value)
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null
      if (code === 'not-found') return errorResponse(404, 'curriculum_record_unavailable')
      return errorResponse(503, 'curriculum_source_unavailable')
    }
  }
}

export const handler = createAdminCurriculumHandler()

import {
  assertExactObject,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { readStudySessionBearer } from './_shared/study-identity/contracts.js'
import {
  createStudyBoundContentResolver,
  isStudyBoundContentRequest,
  StudyBoundContentAuthorityDeniedError,
} from './_shared/study-content/resolver.js'

const PATHS = new Set([
  '/api/study/bound-content',
  '/.netlify/functions/study-bound-content',
])

export function createStudyBoundContentHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const resolver = overrides.resolver ?? createStudyBoundContentResolver(overrides)
  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (resolver?.isReady?.() !== true) return errorResponse(503, 'service_not_ready')
    const sessionReference = readStudySessionBearer(event)
    if (!sessionReference) return errorResponse(401, 'student_session_invalid')
    try {
      const body = assertExactObject(readJsonBody(event, 16_384), [
        'schemaVersion', 'sessionId', 'lessonRef', 'skillRefs',
      ])
      const request = {
        sessionId: body.sessionId,
        lessonRef: body.lessonRef,
        skillRefs: body.skillRefs,
      }
      if (body.schemaVersion !== 1 || !isStudyBoundContentRequest(request)) {
        return errorResponse(400, 'invalid_request')
      }
      return jsonResponse(200, await resolver.resolve({ sessionReference, ...request }))
    } catch (error) {
      if (error instanceof StudyBoundContentAuthorityDeniedError) {
        return errorResponse(401, 'student_session_invalid')
      }
      return responseForError(error)
    }
  }
}

export const handler = createStudyBoundContentHandler()

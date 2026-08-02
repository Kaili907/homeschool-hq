import {
  assertExactObject,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { readStudySessionBearer } from './_shared/study-identity/contracts.js'
import {
  createVerifiedAcademicRuntimeGateway,
  VerifiedAcademicRuntimeDeniedError,
} from './_shared/study-runtime/verified-academic-runtime.js'

const PATHS = new Set([
  '/api/study/academic-runtime',
  '/.netlify/functions/study-academic-runtime',
])

export function createStudyAcademicRuntimeHandler(overrides = {}) {
  const gateway = overrides.gateway ?? createVerifiedAcademicRuntimeGateway(overrides)
  return async (event) => {
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (gateway?.isReady?.() !== true) return errorResponse(503, 'service_not_ready')
    const sessionReference = readStudySessionBearer(event)
    if (!sessionReference) return errorResponse(401, 'student_session_invalid')
    try {
      const body = assertExactObject(readJsonBody(event, 16_384), [
        'schemaVersion', 'operation', 'request',
      ])
      if (body.schemaVersion !== 1 || typeof body.operation !== 'string') {
        return errorResponse(400, 'invalid_request')
      }
      const result = await gateway.execute({
        sessionReference,
        operation: body.operation,
        request: body.request,
      })
      return jsonResponse(200, result)
    } catch (error) {
      if (error instanceof VerifiedAcademicRuntimeDeniedError) {
        return errorResponse(401, 'student_session_invalid')
      }
      return responseForError(error)
    }
  }
}

export const handler = createStudyAcademicRuntimeHandler()

import {
  assertExactObject,
  boundedJsonResponse,
  envFlagEnabled,
  errorResponse,
  hasQuery,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import { readStudySessionBearer } from './_shared/study-identity/contracts.js'
import { createProductionItemAssessmentService } from './production-item-resolver.js'

const PATHS = new Set([
  '/api/study/production-item-assessment',
  '/.netlify/functions/production-item-assessment',
])
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/

function ref(value) {
  return typeof value === 'string' && REF.test(value)
}

export function familyPilotTrustedScorerEnabled(env) {
  return env?.ACADEMY_FAMILY_PILOT_TRUSTED_SCORER_ENABLED === 'true' &&
    ['local', 'test', 'staging'].includes(env?.ACADEMY_DEPLOYMENT_ENV ?? '')
}

function parseIdentityRequest(value) {
  const request = assertExactObject(value, [
    'schemaVersion', 'releaseId', 'assignmentRef', 'lessonRef', 'sectionRef', 'itemRef',
  ], ['attemptRef', 'response'])
  if (request.schemaVersion !== 1 || ![request.releaseId, request.assignmentRef, request.lessonRef,
    request.sectionRef, request.itemRef].every(ref)) throw new Error('invalid_request')
  return request
}

function parseResponse(value) {
  if (value?.kind === 'choice') {
    const response = assertExactObject(value, ['kind', 'choiceRef'])
    if (!ref(response.choiceRef)) throw new Error('invalid_request')
    return Object.freeze({ kind: 'choice', choiceRef: response.choiceRef })
  }
  if (value?.kind === 'text') {
    const response = assertExactObject(value, ['kind', 'text'])
    if (typeof response.text !== 'string' || response.text.trim().length === 0 ||
        response.text.length > 20_000 || response.text.includes('\u0000')) throw new Error('invalid_request')
    return Object.freeze({ kind: 'text', text: response.text })
  }
  if (value?.kind === 'completion') {
    const response = assertExactObject(value, ['kind', 'completed'])
    if (response.completed !== true) throw new Error('invalid_request')
    return Object.freeze({ kind: 'completion', completed: true })
  }
  throw new Error('invalid_request')
}

function parseOperationRequest(operation, value) {
  const identity = parseIdentityRequest(value)
  if (operation === 'project') {
    if (Object.hasOwn(identity, 'attemptRef') || Object.hasOwn(identity, 'response')) {
      throw new Error('invalid_request')
    }
    return identity
  }
  if (operation !== 'assess' || !Object.hasOwn(identity, 'attemptRef') ||
      !Object.hasOwn(identity, 'response') || !ref(identity.attemptRef)) throw new Error('invalid_request')
  return Object.freeze({ ...identity, response: parseResponse(identity.response) })
}

export function createProductionItemAssessmentHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const service = overrides.service ?? createProductionItemAssessmentService(overrides)
  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (!familyPilotTrustedScorerEnabled(env)) return errorResponse(503, 'gateway_disabled')
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (event?.httpMethod !== 'POST') return errorResponse(405, 'method_not_allowed', { allow: 'POST' })
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')
    if (service?.isReady?.() !== true) return errorResponse(503, 'service_not_ready')
    const sessionReference = readStudySessionBearer(event)
    if (!sessionReference) return errorResponse(401, 'student_session_invalid')
    try {
      const body = assertExactObject(readJsonBody(event, 24_576), [
        'schemaVersion', 'operation', 'request',
      ])
      if (body.schemaVersion !== 1 || !['project', 'assess'].includes(body.operation)) {
        return errorResponse(400, 'invalid_request')
      }
      const request = parseOperationRequest(body.operation, body.request)
      const outcome = body.operation === 'project'
        ? await service.project({ sessionReference, request })
        : await service.assess({ sessionReference, request })
      if (outcome.status === 'denied') return errorResponse(401, 'student_session_invalid')
      if (outcome.status === 'not-found') return errorResponse(404, 'production_item_not_found')
      if (outcome.status !== 'ready') return errorResponse(503, 'assessment_unavailable')
      return boundedJsonResponse(200, body.operation === 'project' ? outcome.item : outcome.result, 32_768)
    } catch (error) {
      if (['invalid_request', 'response_kind_mismatch', 'choice_binding_mismatch',
        'invalid_scoring_input'].includes(error?.message)) return errorResponse(400, 'invalid_request')
      if (['adult_review_unavailable', 'evidence_unavailable'].includes(error?.message)) {
        return errorResponse(503, 'assessment_unavailable')
      }
      return responseForError(error)
    }
  }
}

export const handler = createProductionItemAssessmentHandler()

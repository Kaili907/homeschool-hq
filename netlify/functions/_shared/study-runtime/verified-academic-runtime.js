import { digestStudySessionReference } from '../study-identity/contracts.js'
import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'

/** The complete academic capability surface this production server exposes. */
export const VERIFIED_ACADEMIC_RUNTIME_OPERATIONS = Object.freeze({
  'dashboard:read': 'student:progress:read',
  'calendar:read': 'student:assignments:read',
  'session:begin': 'student:attempts:create',
  'session:transition': 'student:attempts:create',
  'checkpoint:read': 'student:progress:read',
  'checkpoint:compare-and-swap': 'student:attempts:create',
})

const CALLER_AUTHORITY_KEY = /^(?:household|household_?id|student|student_?id|learner|learner_?ref|grant|grant_?id|session_?epoch|authorization_?revision|membership|relationship)$/i
const PROTECTED_RESPONSE_KEY = /(?:raw.?answer|transcript|adult.?private|credential|service.?role|token.?digest)/i
const NON_PRODUCTION_SENTINEL = /(?:^|[._:/-])(sentinel|demo|preview|fixture|synthetic|local-release-candidate)(?:$|[._:/-])/i

export class VerifiedAcademicRuntimeDeniedError extends Error {}
export class VerifiedAcademicRuntimeUnavailableError extends Error {}

function assertSafeTree(value, { response = false, depth = 0 } = {}) {
  if (depth > 8) throw new VerifiedAcademicRuntimeDeniedError('runtime_payload_depth')
  if (typeof value === 'string' && NON_PRODUCTION_SENTINEL.test(value)) {
    throw new VerifiedAcademicRuntimeDeniedError('production_sentinel_rejected')
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new VerifiedAcademicRuntimeDeniedError('runtime_payload_size')
    for (const item of value) assertSafeTree(item, { response, depth: depth + 1 })
    return
  }
  if (!value || typeof value !== 'object') return
  const entries = Object.entries(value)
  if (entries.length > 100) throw new VerifiedAcademicRuntimeDeniedError('runtime_payload_size')
  for (const [key, nested] of entries) {
    if (CALLER_AUTHORITY_KEY.test(key) || (response && PROTECTED_RESPONSE_KEY.test(key))) {
      throw new VerifiedAcademicRuntimeDeniedError('runtime_authority_boundary')
    }
    assertSafeTree(nested, { response, depth: depth + 1 })
  }
}

export function createVerifiedAcademicRuntimeGateway(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  return Object.freeze({
    operations: Object.freeze(Object.keys(VERIFIED_ACADEMIC_RUNTIME_OPERATIONS)),
    isReady: () => rpc?.isConfigured?.() === true,
    async execute({ sessionReference, operation, request }) {
      const tokenDigest = digestStudySessionReference(sessionReference)
      const requiredCapability = VERIFIED_ACADEMIC_RUNTIME_OPERATIONS[operation]
      if (!tokenDigest || !requiredCapability || !request || typeof request !== 'object' || Array.isArray(request)) {
        throw new VerifiedAcademicRuntimeDeniedError('runtime_request_invalid')
      }
      assertSafeTree(request)
      let result
      try {
        result = await rpc.call('academy_study_execute_verified_runtime_v1', {
          p_token_digest: tokenDigest,
          p_required_capability: requiredCapability,
          p_operation: operation,
          p_request: request,
        })
      } catch {
        throw new VerifiedAcademicRuntimeUnavailableError('runtime_unavailable')
      }
      if (result?.schemaVersion !== 1 || result?.operation !== operation) {
        throw new VerifiedAcademicRuntimeUnavailableError('runtime_contract')
      }
      if (result.status === 'denied') throw new VerifiedAcademicRuntimeDeniedError('runtime_authority_denied')
      if (result.status !== 'ok' || !Object.hasOwn(result, 'body')) {
        throw new VerifiedAcademicRuntimeUnavailableError('runtime_contract')
      }
      assertSafeTree(result.body, { response: true })
      return Object.freeze({ schemaVersion: 1, status: 'ok', operation, body: result.body })
    },
  })
}

import { digestStudySessionReference } from '../study-identity/contracts.js'
import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'

const OPERATIONS = Object.freeze({
  'dashboard:read': 'student:progress:read',
  'calendar:read': 'student:assignments:read',
  'session:begin': 'student:attempts:create',
  'session:resume': 'student:progress:read',
  'session:transition': 'student:attempts:create',
  'checkpoint:read': 'student:progress:read',
  'checkpoint:compare-and-swap': 'student:attempts:create',
})

const SESSION_LIFECYCLE_OPERATIONS = new Set([
  'session:begin',
  'session:resume',
  'session:transition',
  'checkpoint:read',
  'checkpoint:compare-and-swap',
])
const CALLER_AUTHORITY_KEY = /^(?:household|household_?id|student|student_?id|learner|learner_?ref|grant|grant_?id|session_?epoch|authorization_?revision|membership|relationship|role|accepted_?at|completed_?at|started_?at)$/i
const PROTECTED_RESPONSE_KEY = /(?:private.?notes?|raw.?safety|tutor.?chat|raw.?answer|assessment.?answers?|transcript|emotional.?inference|personality.?inference|diagnostic.?inference|adult.?private|credential|service.?role|token.?digest|raw.?db|secret)/i
const NON_PRODUCTION_SENTINEL = /(?:^|[._:/-])(sentinel|demo|preview|fixture|synthetic|local-release-candidate)(?:$|[._:/-])/i
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const SHA256 = /^[0-9a-f]{64}$/
const SESSION_STATES = new Set([
  'active', 'paused', 'approved-break', 'student-requested-break',
  'technical-interruption', 'completed', 'abandoned',
])
const TRANSITION_TYPES = new Set([
  'session-started', 'segment-started', 'segment-completed', 'pause-started',
  'session-resumed', 'break-requested', 'break-started', 'break-ended',
  'technical-interruption-started', 'technical-interruption-ended',
  'session-completed', 'session-abandoned',
])
const MUTATION_TRANSITION_TYPES = new Set(
  [...TRANSITION_TYPES].filter((type) => type !== 'session-started'),
)
const BINDING_REASONS = new Set([
  'curriculum-release-missing', 'curriculum-release-unsupported',
  'curriculum-release-unavailable', 'curriculum-release-mismatch',
  'legacy-curriculum-binding-ambiguous', 'study-session-unavailable',
])
const SETTINGS_UNAVAILABLE_REASONS = new Set([
  'admin_defaults_unavailable', 'safety_constraints_unavailable',
  'required_settings_unavailable', 'authoritative_source_unavailable',
])
const SETTINGS_MANUAL_REASONS = new Set([
  'malformed_admin_default', 'malformed_guardian_setting',
  'malformed_accommodation', 'malformed_safety_constraint',
  'work_duration_conflict', 'break_duration_conflict',
])
const SETTINGS_SOURCES = new Set([
  'admin_default', 'guardian', 'accommodation', 'safety',
])

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
    if ((!response && CALLER_AUTHORITY_KEY.test(key)) ||
        (response && PROTECTED_RESPONSE_KEY.test(key))) {
      throw new VerifiedAcademicRuntimeDeniedError('runtime_authority_boundary')
    }
    assertSafeTree(nested, { response, depth: depth + 1 })
  }
}

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function safeRef(value) {
  return typeof value === 'string' && SAFE_REF.test(value)
}

function releaseVersion(value) {
  return typeof value === 'string' && RELEASE_VERSION.test(value)
}

function denyInvalidRequest() {
  throw new VerifiedAcademicRuntimeDeniedError('runtime_request_invalid')
}

/**
 * The Academy context is a bounded proposal only. The trusted RPC injects the
 * verified student and resolves release authority independently.
 */
function assertOperationRequest(operation, request) {
  if (operation === 'dashboard:read') {
    if (!exactObject(request, [])) denyInvalidRequest()
    return
  }
  if (operation === 'calendar:read') {
    if (!exactObject(request, ['cursor']) ||
        (request.cursor !== null && !safeRef(request.cursor))) denyInvalidRequest()
    return
  }
  if (operation === 'session:begin') {
    if (!exactObject(request, [
      'idempotencyKey', 'lessonId', 'subjectId', 'studyPlanId',
      'intendedLocalDate', 'initialSegmentId', 'curriculumContext',
    ]) ||
      !exactObject(request.curriculumContext, ['releaseVersion', 'lessonRef', 'skillRefs'])) {
      denyInvalidRequest()
    }
    const context = request.curriculumContext
    if (!safeRef(request.idempotencyKey) || !safeRef(request.lessonId) ||
        !safeRef(request.subjectId) || !safeRef(request.initialSegmentId) ||
        (request.studyPlanId !== null && !safeRef(request.studyPlanId)) ||
        typeof request.intendedLocalDate !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(request.intendedLocalDate) ||
        !releaseVersion(context.releaseVersion) || !safeRef(context.lessonRef) ||
        context.lessonRef !== request.lessonId || !Array.isArray(context.skillRefs) ||
        context.skillRefs.length > 64 || context.skillRefs.some((ref) => !safeRef(ref)) ||
        new Set(context.skillRefs).size !== context.skillRefs.length) denyInvalidRequest()
    return
  }
  if (operation === 'session:resume' || operation === 'checkpoint:read') {
    if (!exactObject(request, ['sessionId', 'curriculumReleaseVersion']) ||
        !safeRef(request.sessionId) || !releaseVersion(request.curriculumReleaseVersion)) {
      denyInvalidRequest()
    }
    return
  }
  if (operation === 'session:transition') {
    if (!exactObject(request, [
      'sessionId', 'expectedRevision', 'idempotencyKey',
      'curriculumReleaseVersion', 'transition',
    ]) || !exactObject(request.transition, ['type', 'segmentId']) ||
        !safeRef(request.sessionId) || !safeRef(request.idempotencyKey) ||
        !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 1 ||
        !releaseVersion(request.curriculumReleaseVersion) ||
        !MUTATION_TRANSITION_TYPES.has(request.transition.type) ||
        (request.transition.segmentId !== null && !safeRef(request.transition.segmentId))) {
      denyInvalidRequest()
    }
    return
  }
  if (operation === 'checkpoint:compare-and-swap') {
    if (!exactObject(request, [
      'sessionId', 'expectedRevision', 'mutationId', 'checkpoint',
      'curriculumReleaseVersion',
    ]) || !safeRef(request.sessionId) || !safeRef(request.mutationId) ||
        !Number.isSafeInteger(request.expectedRevision) || request.expectedRevision < 0 ||
        !releaseVersion(request.curriculumReleaseVersion) ||
        !request.checkpoint || typeof request.checkpoint !== 'object' ||
        Array.isArray(request.checkpoint)) denyInvalidRequest()
    return
  }
  denyInvalidRequest()
}

function isBindingResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  if (value.status === 'bound') return exactObject(value, [
    'schemaVersion', 'status', 'releaseId', 'packageId', 'releaseVersion',
    'curriculumManifestSha256',
  ]) && value.schemaVersion === 1 && safeRef(value.releaseId) &&
    safeRef(value.packageId) && releaseVersion(value.releaseVersion) &&
    typeof value.curriculumManifestSha256 === 'string' &&
    SHA256.test(value.curriculumManifestSha256)
  return (value.status === 'unavailable' || value.status === 'manual-review') &&
    value.schemaVersion === 1 && exactObject(value, ['schemaVersion', 'status', 'reasonCode']) &&
    BINDING_REASONS.has(value.reasonCode)
}

function isSettings(value) {
  const exact = exactObject(value, [
    'timerMode', 'maximumWorkMinutes', 'breakMinimumMinutes',
    'breakMaximumMinutes', 'minimumBreakCount', 'requiredBreakIntervalMinutes',
    'reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed',
  ])
  return exact && ['visible', 'hidden', 'count_up', 'count_down'].includes(value.timerMode) &&
    ['maximumWorkMinutes', 'breakMinimumMinutes', 'breakMaximumMinutes',
      'minimumBreakCount', 'requiredBreakIntervalMinutes']
      .every((key) => Number.isSafeInteger(value[key]) && value[key] >= 0) &&
    ['reducedMotion', 'noAudio', 'largeText', 'readAloud', 'speechInputAllowed']
      .every((key) => typeof value[key] === 'boolean')
}

function isCheckpoint(value) {
  return value === null || (exactObject(value, [
    'contract', 'contractVersion', 'checkpointId', 'revision', 'createdAt',
    'updatedAt', 'sessionId', 'lessonId', 'segmentId',
    'safeInstructionalCursor', 'completedSegmentIds', 'perSegmentActiveTime',
    'pausedSeconds', 'breakSeconds', 'protectedDraftRef',
    'protectedTutorStateRef', 'lastAcceptedEventId', 'eventVersion',
    'tutorInteractionRef', 'technicalInterruption', 'rawAnswerIncluded',
    'transcriptIncluded',
  ]) && value.rawAnswerIncluded === false && value.transcriptIncluded === false)
}

function isSessionProjection(value, statuses, resume = false) {
  const keys = [
    'schemaVersion', 'status', 'sessionId', 'state', 'revision', 'acceptedAt',
    'updatedAt', 'lessonId', 'subjectId', 'studyPlanId', 'intendedLocalDate',
    'currentSegmentId', 'completedAt', 'lastTransition', 'curriculumBinding',
    'effectiveSettings', ...(resume ? ['checkpoint'] : []),
  ]
  return exactObject(value, keys) && value.schemaVersion === 2 &&
    statuses.includes(value.status) && safeRef(value.sessionId) &&
    SESSION_STATES.has(value.state) &&
    Number.isSafeInteger(value.revision) && value.revision >= 1 &&
    exactObject(value.lastTransition, ['type', 'acceptedAt']) &&
    TRANSITION_TYPES.has(value.lastTransition.type) &&
    isBindingResult(value.curriculumBinding) &&
    value.curriculumBinding.status === 'bound' && isSettings(value.effectiveSettings) &&
    (!resume || isCheckpoint(value.checkpoint))
}

function isUnavailable(value) {
  return (isBindingResult(value) && value.status !== 'bound') ||
    (value?.schemaVersion === 2 && value?.status === 'unavailable' &&
      exactObject(value, ['schemaVersion', 'status', 'reasonCode']) &&
      SETTINGS_UNAVAILABLE_REASONS.has(value.reasonCode)) ||
    (value?.schemaVersion === 2 && value?.status === 'manual_review' &&
      exactObject(value, ['schemaVersion', 'status', 'reasonCodes', 'sourceCategories']) &&
      Array.isArray(value.reasonCodes) && value.reasonCodes.length > 0 &&
      value.reasonCodes.every((reason) => SETTINGS_MANUAL_REASONS.has(reason)) &&
      Array.isArray(value.sourceCategories) &&
      value.sourceCategories.every((source) => SETTINGS_SOURCES.has(source)))
}

function assertLifecycleResponse(operation, value) {
  if (isUnavailable(value)) return
  if (value?.schemaVersion === 2 && value?.status === 'idempotency-collision' &&
      exactObject(value, ['schemaVersion', 'status'])) return
  if (operation === 'session:begin' && isSessionProjection(value, ['begun'])) return
  if (operation === 'session:resume' &&
      isSessionProjection(value, ['resumable', 'closed'], true)) return
  if (operation === 'session:transition') {
    if (isSessionProjection(value, ['stored'])) return
    if (value?.schemaVersion === 2 && value?.status === 'revision-conflict' &&
        exactObject(value, ['schemaVersion', 'status', 'currentRevision', 'currentState'])) return
    if (value?.schemaVersion === 2 && value?.status === 'invalid-transition' &&
        exactObject(value, [
          'schemaVersion', 'status', 'currentRevision', 'currentState', 'transitionType',
        ])) return
  }
  if (operation === 'checkpoint:read' && value?.schemaVersion === 2 &&
      ['found', 'not-found', 'integrity-failed'].includes(value.status) &&
      exactObject(value, [
        'schemaVersion', 'status', 'sessionRevision', 'currentState',
        'curriculumBinding', 'checkpoint',
      ]) && isBindingResult(value.curriculumBinding) && isCheckpoint(value.checkpoint)) return
  if (operation === 'checkpoint:compare-and-swap') {
    if (value?.schemaVersion === 2 && value?.status === 'stored' && exactObject(value, [
      'schemaVersion', 'status', 'checkpointRevision', 'sessionRevision',
      'currentState', 'curriculumBinding',
    ]) && isBindingResult(value.curriculumBinding)) return
    if (value?.schemaVersion === 2 && value?.status === 'revision-conflict' &&
        exactObject(value, [
          'schemaVersion', 'status', 'currentCheckpointRevision',
          'sessionRevision', 'currentState',
        ])) return
    if (value?.schemaVersion === 2 && value?.status === 'invalid-checkpoint' &&
        exactObject(value, ['schemaVersion', 'status', 'reasonCode'])) return
    if (value?.schemaVersion === 2 && value?.status === 'invalid-transition' &&
        exactObject(value, [
          'schemaVersion', 'status', 'currentRevision', 'currentState', 'transitionType',
        ])) return
  }
  throw new VerifiedAcademicRuntimeUnavailableError('runtime_contract')
}

export function createVerifiedAcademicRuntimeGateway(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)
  return Object.freeze({
    isReady: () => rpc?.isConfigured?.() === true,
    async execute({ sessionReference, operation, request }) {
      const tokenDigest = digestStudySessionReference(sessionReference)
      const requiredCapability = OPERATIONS[operation]
      if (!tokenDigest || !requiredCapability || !request || typeof request !== 'object' || Array.isArray(request)) {
        throw new VerifiedAcademicRuntimeDeniedError('runtime_request_invalid')
      }
      assertSafeTree(request)
      assertOperationRequest(operation, request)
      let result
      try {
        const rpcName = SESSION_LIFECYCLE_OPERATIONS.has(operation)
          ? 'academy_study_execute_session_lifecycle_v2'
          : 'academy_study_execute_verified_runtime_v1'
        result = await rpc.call(rpcName, {
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
      if (SESSION_LIFECYCLE_OPERATIONS.has(operation)) {
        assertLifecycleResponse(operation, result.body)
      }
      assertSafeTree(result.body, { response: true })
      return Object.freeze({ schemaVersion: 1, status: 'ok', operation, body: result.body })
    },
  })
}

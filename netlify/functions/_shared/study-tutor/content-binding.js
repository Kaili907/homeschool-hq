/**
 * Fail-closed server composition for binding one authorized Study operation to
 * either reviewed Tutor content or ordinary static Academy content.
 *
 * This module is deliberately not a handler. It reads no event, mounts no
 * route, accepts no learner text, calls no provider, executes no Tutor turn,
 * and writes no ledger. A future reviewed handler must resolve the browser's
 * existing Study credential transport before calling this capability.
 */
import {
  isVerifiedGrant,
  STUDY_SESSION_REFERENCE,
} from '../study-identity/contracts.js'
import { createTrustedStudySessionVerifier } from '../study-identity/supabase.js'
import {
  createProductionServerTutorArtifactCustody,
  isTestServerTutorArtifactCapability,
  isVerifiedServerTutorArtifactCapability,
} from './artifact-custody.js'

export const SERVER_TUTOR_OPERATION_REQUEST_SCHEMA_VERSION = 1
export const SERVER_TUTOR_REQUIRED_CAPABILITY = 'student:attempts:create'

export const SERVER_TUTOR_CONTENT_BINDING_STATUSES = Object.freeze([
  'eligible',
  'ordinary-content-ineligible',
  'auth-refused',
  'auth-infrastructure-unavailable',
  'mapping-integrity-failed',
  'mapping-stale',
  'host-content-integrity-failed',
  'server-unavailable',
  'safety-failure',
])

export const SERVER_TUTOR_FORBIDDEN_BROWSER_FIELDS = Object.freeze([
  'student',
  'household',
  'grade',
  'working level',
  'course',
  'lesson',
  'segment',
  'mapping',
  'program',
  'skill',
  'routing',
  'release',
  'digest',
  'custody',
])

const REQUEST_KEYS = Object.freeze(['operationLocator', 'schemaVersion'])
const CALL_KEYS = Object.freeze(['request', 'sessionReference'])
const OPERATION_KEYS = Object.freeze([
  'contentReference',
  'operationLocator',
  'operationRevision',
  'schemaVersion',
  'sessionEpoch',
])
const CONTENT_KEYS = Object.freeze([
  'academySourcePins',
  'contentReference',
  'lessonRef',
  'operationLocator',
  'operationRevision',
  'schemaVersion',
  'segmentRef',
  'sessionEpoch',
  'subject',
  'taskType',
])

const TRUSTED_PRODUCTION_TUTOR_BINDINGS = new WeakSet()
const TRUSTED_TEST_TUTOR_BINDINGS = new WeakSet()
const TRUSTED_PRODUCTION_STATIC_ACADEMY_PERMITS = new WeakSet()
const TRUSTED_TEST_STATIC_ACADEMY_PERMITS = new WeakSet()
const PRIVATE_TUTOR_BINDING_STATE = new WeakMap()
const PRIVATE_STATIC_PERMIT_STATE = new WeakMap()

const CLOSED_RESULTS = Object.freeze(
  SERVER_TUTOR_CONTENT_BINDING_STATUSES
    .filter((status) => status !== 'eligible' && status !== 'ordinary-content-ineligible')
    .reduce((results, status) => {
      results[status] = Object.freeze({ schemaVersion: 1, status })
      return results
    }, Object.create(null)),
)

function closed(status) {
  return CLOSED_RESULTS[status] ?? CLOSED_RESULTS['server-unavailable']
}

/**
 * Takes one descriptor snapshot and rebuilds a plain frozen value. Accessors,
 * symbols, non-enumerable fields, non-plain prototypes and hostile proxy traps
 * are refusals. No value is trimmed, coerced or normalized.
 */
function snapshotExactRecord(value, expectedKeys) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const keys = Reflect.ownKeys(descriptors)
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== 'string' || !expectedKeys.includes(key))
    ) return null
    const rebuilt = Object.create(null)
    for (const key of expectedKeys) {
      const descriptor = descriptors[key]
      if (
        descriptor === undefined ||
        !Object.hasOwn(descriptor, 'value') ||
        Object.hasOwn(descriptor, 'get') ||
        Object.hasOwn(descriptor, 'set') ||
        descriptor.enumerable !== true
      ) return null
      rebuilt[key] = descriptor.value
    }
    return Object.freeze(rebuilt)
  } catch {
    return null
  }
}

const INVALID_DATA_SNAPSHOT = Symbol('invalid-data-snapshot')

function snapshotDataValue(value, state, depth) {
  try {
    state.nodes += 1
    if (state.nodes > 2_000 || depth > 24) return INVALID_DATA_SNAPSHOT
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value : INVALID_DATA_SNAPSHOT
    if (typeof value !== 'object') return INVALID_DATA_SNAPSHOT

    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) return INVALID_DATA_SNAPSHOT
      const descriptors = Object.getOwnPropertyDescriptors(value)
      const keys = Reflect.ownKeys(descriptors)
      const lengthDescriptor = descriptors.length
      if (
        !lengthDescriptor ||
        !Object.hasOwn(lengthDescriptor, 'value') ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0 ||
        lengthDescriptor.value > 2_000
      ) return INVALID_DATA_SNAPSHOT
      const expected = Array.from({ length: lengthDescriptor.value }, (_, index) => String(index))
      if (
        keys.length !== expected.length + 1 ||
        keys.some((key) => typeof key !== 'string' || (key !== 'length' && !expected.includes(key)))
      ) return INVALID_DATA_SNAPSHOT
      const rebuilt = []
      for (const key of expected) {
        const descriptor = descriptors[key]
        if (
          !descriptor ||
          !Object.hasOwn(descriptor, 'value') ||
          Object.hasOwn(descriptor, 'get') ||
          Object.hasOwn(descriptor, 'set') ||
          descriptor.enumerable !== true
        ) return INVALID_DATA_SNAPSHOT
        const child = snapshotDataValue(descriptor.value, state, depth + 1)
        if (child === INVALID_DATA_SNAPSHOT) return INVALID_DATA_SNAPSHOT
        rebuilt.push(child)
      }
      return Object.freeze(rebuilt)
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return INVALID_DATA_SNAPSHOT
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const keys = Reflect.ownKeys(descriptors)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_DATA_SNAPSHOT
    const rebuilt = Object.create(null)
    for (const key of keys) {
      const descriptor = descriptors[key]
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, 'value') ||
        Object.hasOwn(descriptor, 'get') ||
        Object.hasOwn(descriptor, 'set') ||
        descriptor.enumerable !== true
      ) return INVALID_DATA_SNAPSHOT
      const child = snapshotDataValue(descriptor.value, state, depth + 1)
      if (child === INVALID_DATA_SNAPSHOT) return INVALID_DATA_SNAPSHOT
      rebuilt[key] = child
    }
    return Object.freeze(rebuilt)
  } catch {
    return INVALID_DATA_SNAPSHOT
  }
}

function snapshotDataTree(value) {
  const snapshot = snapshotDataValue(value, { nodes: 0 }, 0)
  return snapshot === INVALID_DATA_SNAPSHOT ? null : snapshot
}

export function parseServerTutorOperationRequest(raw) {
  const request = snapshotExactRecord(raw, REQUEST_KEYS)
  if (
    request === null ||
    request.schemaVersion !== SERVER_TUTOR_OPERATION_REQUEST_SCHEMA_VERSION ||
    typeof request.operationLocator !== 'string'
  ) return null
  return Object.freeze({
    schemaVersion: SERVER_TUTOR_OPERATION_REQUEST_SCHEMA_VERSION,
    operationLocator: request.operationLocator,
  })
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function resolvedOperation(raw, request, authorizedSession) {
  const envelope = snapshotExactRecord(raw, ['operation', 'status'])
  if (envelope?.status !== 'resolved') return null
  const operation = snapshotExactRecord(envelope.operation, OPERATION_KEYS)
  if (
    operation === null ||
    operation.schemaVersion !== 1 ||
    operation.operationLocator !== request.operationLocator ||
    operation.sessionEpoch !== authorizedSession.sessionEpoch ||
    !positiveInteger(operation.operationRevision) ||
    typeof operation.contentReference !== 'string'
  ) return null
  return Object.freeze({
    schemaVersion: 1,
    operationLocator: operation.operationLocator,
    sessionEpoch: operation.sessionEpoch,
    operationRevision: operation.operationRevision,
    contentReference: operation.contentReference,
  })
}

function resolvedHostContent(raw, operation) {
  const envelope = snapshotExactRecord(raw, ['content', 'status'])
  if (envelope?.status !== 'resolved') return null
  const candidate = snapshotExactRecord(envelope.content, CONTENT_KEYS)
  if (
    candidate === null ||
    candidate.schemaVersion !== 1 ||
    candidate.operationLocator !== operation.operationLocator ||
    candidate.sessionEpoch !== operation.sessionEpoch ||
    candidate.operationRevision !== operation.operationRevision ||
    candidate.contentReference !== operation.contentReference ||
    typeof candidate.lessonRef !== 'string' ||
    typeof candidate.segmentRef !== 'string' ||
    typeof candidate.subject !== 'string' ||
    typeof candidate.taskType !== 'string'
  ) return null
  const academySourcePins = snapshotDataTree(candidate.academySourcePins)
  if (academySourcePins === null || typeof academySourcePins !== 'object') return null
  return Object.freeze({
    schemaVersion: 1,
    operationLocator: candidate.operationLocator,
    sessionEpoch: candidate.sessionEpoch,
    operationRevision: candidate.operationRevision,
    contentReference: candidate.contentReference,
    academySourcePins,
    lessonRef: candidate.lessonRef,
    segmentRef: candidate.segmentRef,
    subject: candidate.subject,
    taskType: candidate.taskType,
  })
}

function exactStatus(raw, status) {
  const snapshot = snapshotExactRecord(raw, ['status'])
  return snapshot?.status === status
}

function mintTutorBinding(state, trustSet) {
  const binding = Object.freeze(Object.create(null))
  PRIVATE_TUTOR_BINDING_STATE.set(binding, Object.freeze(state))
  trustSet.add(binding)
  return binding
}

function mintStaticAcademyPermit(state, trustSet) {
  const permit = Object.freeze(Object.create(null))
  PRIVATE_STATIC_PERMIT_STATE.set(permit, Object.freeze(state))
  trustSet.add(permit)
  return permit
}

export function isTrustedServerTutorBinding(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    TRUSTED_PRODUCTION_TUTOR_BINDINGS.has(value),
  )
}

export function isTrustedStaticAcademyPermit(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    TRUSTED_PRODUCTION_STATIC_ACADEMY_PERMITS.has(value),
  )
}

export function isTestServerTutorBinding(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    TRUSTED_TEST_TUTOR_BINDINGS.has(value),
  )
}

export function isTestStaticAcademyPermit(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    TRUSTED_TEST_STATIC_ACADEMY_PERMITS.has(value),
  )
}

function portReady(port) {
  try {
    return Boolean(port && typeof port.isReady === 'function' && port.isReady() === true)
  } catch {
    return false
  }
}

async function verifyAuthorizedSession(sessionVerifier, sessionReference) {
  if (!portReady(sessionVerifier)) return closed('auth-infrastructure-unavailable')
  let raw
  try {
    raw = await sessionVerifier.verify({
      sessionReference,
      requiredCapability: SERVER_TUTOR_REQUIRED_CAPABILITY,
    })
  } catch {
    return closed('auth-infrastructure-unavailable')
  }
  if (exactStatus(raw, 'denied')) return closed('auth-refused')
  if (exactStatus(raw, 'unavailable')) return closed('auth-infrastructure-unavailable')
  const authorizedSession = snapshotDataTree(raw)
  try {
    if (!authorizedSession || !isVerifiedGrant(authorizedSession)) {
      return closed('auth-infrastructure-unavailable')
    }
    return authorizedSession.scope.includes(SERVER_TUTOR_REQUIRED_CAPABILITY)
      ? authorizedSession
      : closed('auth-refused')
  } catch {
    return closed('auth-infrastructure-unavailable')
  }
}

function isExactEligibleDecision(value) {
  const decision = snapshotExactRecord(value, ['eligible', 'gradeBand', 'programRef'])
  return Boolean(
    decision &&
    decision.eligible === true &&
    typeof decision.gradeBand === 'string' &&
    typeof decision.programRef === 'string',
  )
}

/**
 * The only two contractual shapes for `resolveApprovedMapping`'s result are
 * exact `null` (no approved row) and a frozen plain object (an opaque
 * selection token). `undefined`, `0`, `''`, `false`, a Promise, or any other
 * non-plain value is a broken custody contract, not "no selection" and not
 * "selected" — it must fail closed rather than silently pass `!== null`.
 */
function isExactApprovedSelection(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null) && Object.isFrozen(value)
}

function createBindingService({
  sessionVerifier,
  operationResolver,
  hostContentResolver,
  artifactCustody,
  hostAuthority,
  testComposition = false,
}) {
  async function resolve(input) {
    // Stage 1: parse the credential and the exact browser request together.
    const call = snapshotExactRecord(input, CALL_KEYS)
    const request = call && parseServerTutorOperationRequest(call.request)
    if (
      call === null ||
      request === null ||
      typeof call.sessionReference !== 'string' ||
      !STUDY_SESSION_REFERENCE.test(call.sessionReference)
    ) return closed('auth-refused')

    // Stage 2: authorize exactly the capability needed to create an attempt.
    const authorized = await verifyAuthorizedSession(sessionVerifier, call.sessionReference)
    if (!isVerifiedGrant(authorized)) return authorized

    // Stage 3: resolve only beneath that exact verified session.
    if (!portReady(operationResolver)) return closed('server-unavailable')
    let operationResult
    try {
      operationResult = await operationResolver.resolve({
        authorizedSession: authorized,
        operationLocator: request.operationLocator,
      })
    } catch {
      return closed('server-unavailable')
    }
    if (exactStatus(operationResult, 'refused')) return closed('auth-refused')
    if (exactStatus(operationResult, 'unavailable')) return closed('server-unavailable')
    const operation = resolvedOperation(operationResult, request, authorized)
    if (operation === null) return closed('server-unavailable')

    // Stage 4: obtain server-authoritative Academy metadata; no caller content
    // or path is admitted to this resolver.
    if (!portReady(hostContentResolver)) return closed('server-unavailable')
    let contentResult
    try {
      contentResult = await hostContentResolver.resolve({
        authorizedSession: authorized,
        operation,
      })
    } catch {
      return closed('server-unavailable')
    }
    if (exactStatus(contentResult, 'integrity-failed')) {
      return closed('host-content-integrity-failed')
    }
    if (exactStatus(contentResult, 'stale')) return closed('mapping-stale')
    if (exactStatus(contentResult, 'unavailable')) return closed('server-unavailable')
    const content = resolvedHostContent(contentResult, operation)
    if (content === null) return closed('host-content-integrity-failed')

    // Stage 5: load only the fixed generated artifact pair and retain only its
    // verified private capability.
    let artifactResult
    try {
      artifactResult = await artifactCustody?.verify?.()
    } catch {
      return closed('server-unavailable')
    }
    if (exactStatus(artifactResult, 'mapping-integrity-failed')) {
      return closed('mapping-integrity-failed')
    }
    if (exactStatus(artifactResult, 'server-unavailable')) return closed('server-unavailable')
    const artifactEnvelope = snapshotExactRecord(artifactResult, ['capability', 'status'])
    const artifact = artifactEnvelope?.status === 'verified'
      ? artifactEnvelope.capability
      : null
    const artifactTrusted = testComposition
      ? isTestServerTutorArtifactCapability(artifact)
      : isVerifiedServerTutorArtifactCapability(artifact)
    if (!artifactTrusted) {
      return closed('mapping-integrity-failed')
    }

    // Stages 6 and 7: bind the authoritative Academy source and the already
    // custodied frozen Tutor source to the embedded reviewed mapping.
    let academyPinsCurrent = false
    try {
      academyPinsCurrent = artifact.verifyAcademySourcePins(content.academySourcePins) === true
    } catch {
      return closed('mapping-integrity-failed')
    }
    if (!academyPinsCurrent) return closed('mapping-stale')

    let frozenPinsCurrent = false
    try {
      frozenPinsCurrent = artifact.verifyFrozenTutorPins() === true
    } catch {
      return closed('mapping-integrity-failed')
    }
    if (!frozenPinsCurrent) return closed('mapping-stale')

    // Stage 8: exact lesson + segment + task lookup. A null lookup is the
    // production truth today and must not touch any Tutor selector. The
    // embedded static capability's lookup is a synchronous, side-effect-free
    // data read (proven by the census equivalence check in
    // artifact-custody.js's verifyEmbeddedArtifacts); it is deliberately not
    // awaited, so any Promise it might return is left un-awaited and is
    // rejected below by isExactApprovedSelection rather than resolved.
    let selection
    try {
      selection = artifact.resolveApprovedMapping({
        hostLessonRef: content.lessonRef,
        hostSegmentRef: content.segmentRef,
        taskType: content.taskType,
      })
    } catch {
      return closed('mapping-integrity-failed')
    }
    if (selection !== null && !isExactApprovedSelection(selection)) {
      return closed('mapping-integrity-failed')
    }

    let learnerPseudonym = null
    if (selection !== null) {
      // Stage 9: an approved row is still not authority to use a Tutor program;
      // the frozen static evaluator must independently agree.
      let eligibility
      try {
        eligibility = artifact.evaluateApprovedMapping(selection, {
          subject: content.subject,
          lessonRef: content.lessonRef,
          taskType: content.taskType,
        })
      } catch {
        return closed('mapping-integrity-failed')
      }
      if (!isExactEligibleDecision(eligibility)) {
        return closed('mapping-stale')
      }

      // Derivation is deliberately after exact lookup + eligibility, so every
      // current zero-mapping request performs zero pseudonym work.
      try {
        learnerPseudonym = await artifact.deriveLearnerPseudonym(authorized.learnerSessionId)
      } catch {
        return closed('server-unavailable')
      }
      if (typeof learnerPseudonym !== 'string' || !/^learner:[0-9a-f]{32}$/.test(learnerPseudonym)) {
        return closed('server-unavailable')
      }
    }

    // Stage 10: the final await rechecks safety and live authority after all
    // content, custody, selection and (eligible-only) pseudonym work.
    if (!portReady(hostAuthority)) return closed('safety-failure')
    let authorityResult
    try {
      authorityResult = await hostAuthority.check({
        authorizedSession: authorized,
        operation,
        content,
      })
    } catch {
      return closed('safety-failure')
    }
    const current = snapshotExactRecord(authorityResult, [
      'operationRevision',
      'sessionEpoch',
      'status',
    ])
    if (
      current?.status !== 'safe-current' ||
      current.sessionEpoch !== operation.sessionEpoch ||
      current.operationRevision !== operation.operationRevision
    ) return closed('safety-failure')

    // Stage 11: mint an identity-bound, nonserializable private capability.
    if (selection === null) {
      const staticPermit = mintStaticAcademyPermit(
        {
          operationRevision: operation.operationRevision,
          contentReference: operation.contentReference,
        },
        testComposition
          ? TRUSTED_TEST_STATIC_ACADEMY_PERMITS
          : TRUSTED_PRODUCTION_STATIC_ACADEMY_PERMITS,
      )
      return Object.freeze({
        schemaVersion: 1,
        status: 'ordinary-content-ineligible',
        staticPermit,
      })
    }

    const binding = mintTutorBinding(
      {
        selection,
        learnerPseudonym,
        operationRevision: operation.operationRevision,
      },
      testComposition
        ? TRUSTED_TEST_TUTOR_BINDINGS
        : TRUSTED_PRODUCTION_TUTOR_BINDINGS,
    )
    return Object.freeze({ schemaVersion: 1, status: 'eligible', binding })
  }

  return Object.freeze({ bind: resolve, resolve })
}

/**
 * Production composition fixes both credential verification and artifact paths.
 * The three host capabilities remain explicit because product wiring for them
 * does not exist in this authorized slice.
 */
export function createServerTutorContentBindingService(options = {}) {
  return createBindingService({
    sessionVerifier: createTrustedStudySessionVerifier({
      env: options.env,
      fetchImpl: options.fetchImpl,
    }),
    operationResolver: options.operationResolver,
    hostContentResolver: options.hostContentResolver,
    artifactCustody: createProductionServerTutorArtifactCustody(),
    hostAuthority: options.hostAuthority,
  })
}

/** Explicit test composition; production never admits substitute custody. */
export function createTestServerTutorContentBindingService(options = {}) {
  return createBindingService({ ...options, testComposition: true })
}

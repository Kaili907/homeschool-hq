import { createVerifiedAcademicRuntimeGateway } from '../study-runtime/verified-academic-runtime.js'

/**
 * Server-side readiness for the seven Session 13 academic dependencies.
 *
 * The one academic capability this production server composes is the verified
 * academic runtime gateway. A dependency is only reported ready when every
 * method its production specification requires is reachable through that
 * composed gateway. Dependencies whose required methods have no server
 * operation are reached solely by the authenticated browser client, so this
 * probe cannot observe them and never reports them ready.
 *
 * The probe reads configuration and the composed operation surface only. It
 * issues no RPC, so a readiness GET performs no academic work of any kind.
 */

/**
 * Mirror of PRODUCTION_DEPENDENCY_SPECIFICATIONS[key].requiredMethods for the
 * seven academic keys in src/study/contracts/production/readiness.ts.
 * academic-readiness.test.js pins this mirror against that specification.
 */
export const ACADEMIC_SESSION_13_REQUIRED_METHODS = Object.freeze({
  'study-session-adapter': Object.freeze(['createSession', 'transitionSession']),
  'checkpoint-adapter': Object.freeze(['readCheckpoint', 'compareAndSwapCheckpoint']),
  'review-queue': Object.freeze(['upsertReview']),
  'calendar-adapter': Object.freeze(['upsertCalendarBlock']),
  'parent-settings-adapter': Object.freeze(['upsertParentSettings', 'effectiveSettings']),
  'adult-private-adapter': Object.freeze([
    'storeProtectedWork', 'readProtectedWork', 'appendAdultNote',
    'listAdultNoteMetadata', 'readAdultNote',
  ]),
  'event-ledger': Object.freeze(['appendAcceptedEvent']),
})

export const ACADEMIC_SESSION_13_DEPENDENCIES = Object.freeze(
  Object.keys(ACADEMIC_SESSION_13_REQUIRED_METHODS),
)

/**
 * The verified academic runtime operation that exercises each required method.
 * null records a method the production server exposes no operation for; the
 * calendar surface for example is read-only server-side, so the adapter's
 * upsertCalendarBlock contract is not server-provable.
 */
export const ACADEMIC_METHOD_RUNTIME_OPERATIONS = Object.freeze({
  createSession: 'session:begin',
  transitionSession: 'session:transition',
  readCheckpoint: 'checkpoint:read',
  compareAndSwapCheckpoint: 'checkpoint:compare-and-swap',
  upsertReview: null,
  upsertCalendarBlock: null,
  upsertParentSettings: null,
  effectiveSettings: null,
  storeProtectedWork: null,
  readProtectedWork: null,
  appendAdultNote: null,
  listAdultNoteMetadata: null,
  readAdultNote: null,
  appendAcceptedEvent: null,
})

function dependencyIsProvable(dependency, supportedOperations) {
  const methods = ACADEMIC_SESSION_13_REQUIRED_METHODS[dependency]
  // An empty required-method set must never satisfy `every` vacuously.
  if (!Array.isArray(methods) || methods.length === 0) return false
  return methods.every((method) => {
    const operation = ACADEMIC_METHOD_RUNTIME_OPERATIONS[method]
    return typeof operation === 'string' && supportedOperations.has(operation)
  })
}

function composedOperations(gateway) {
  try {
    if (gateway?.isReady?.() !== true || !Array.isArray(gateway.operations)) return new Set()
    return new Set(gateway.operations.filter((operation) => typeof operation === 'string'))
  } catch {
    return new Set()
  }
}

/**
 * Builds the academic readiness probe over the real server academic runtime.
 * Returns one closed-vocabulary state per academic dependency; an unconfigured,
 * malformed, or throwing gateway yields not-ready for all seven.
 */
export function createAcademicRuntimeReadinessProbe(options = {}) {
  const gateway = options.gateway ?? createVerifiedAcademicRuntimeGateway(options)
  return async function academicRuntimeReadiness() {
    const supportedOperations = composedOperations(gateway)
    return Object.freeze(Object.fromEntries(ACADEMIC_SESSION_13_DEPENDENCIES.map((dependency) => [
      dependency,
      dependencyIsProvable(dependency, supportedOperations) ? 'ready' : 'not-ready',
    ])))
  }
}

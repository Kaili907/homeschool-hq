import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'

/**
 * Server-only durable probe for the Study academic contract.
 *
 * Study production readiness names seven academic dependencies. Two of them are
 * provable from the Netlify operation surface, because the verified runtime
 * gateway exposes session and checkpoint operations. The other five have no
 * operation there at all — and calendar's one operation, `calendar:read`, is a
 * read that never touches the mutation contract the calendar adapter requires.
 *
 * This module reads the consolidated read-only readiness RPC through the same
 * service-role boundary every other durable Study port uses. It is side-effect
 * free: the RPC executes no academic operation and writes nothing, and nothing
 * here retries, caches or mutates.
 *
 * The result is DB-side evidence only. It is deliberately not sufficient on its
 * own — `combineAcademicReadiness` requires the operation surface to agree
 * before any dependency reads ready.
 */

export const ACADEMIC_DEPENDENCIES = Object.freeze([
  'study-session-adapter',
  'checkpoint-adapter',
  'review-queue',
  'calendar-adapter',
  'parent-settings-adapter',
  'adult-private-adapter',
  'event-ledger',
])

export const ACADEMIC_READINESS_SCHEMA_VERSION = 1
export const ACADEMIC_READINESS_CONTRACT_VERSION = 1

/** The closed state vocabulary the RPC may use. Anything else is malformed. */
const DATABASE_STATES = Object.freeze(['ready', 'not-ready'])

/** Every dependency not-ready. The result of any failure, of every kind. */
export function academicDependenciesUnavailable() {
  return Object.freeze(Object.fromEntries(
    ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, 'not-ready']),
  ))
}

/**
 * A dependency map is believed only when it is exactly the seven closed keys
 * carrying closed states. Anything else — a partial map, an extra key, an
 * unknown state — is no evidence at all.
 *
 * Applied both to what the RPC returns and to whatever a caller injects as the
 * durable probe. A partial map is the dangerous shape: reading it key by key
 * would let the one dependency it does mention pass while the six it omits fail,
 * so a truncated result would open a dependency rather than close all of them.
 */
export function academicDependencyMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return academicDependenciesUnavailable()
  }
  const keys = Object.keys(value)
  if (
    keys.length !== ACADEMIC_DEPENDENCIES.length ||
    !keys.every((key) => ACADEMIC_DEPENDENCIES.includes(key)) ||
    !keys.every((key) => DATABASE_STATES.includes(value[key]))
  ) return academicDependenciesUnavailable()
  return Object.freeze(Object.fromEntries(
    ACADEMIC_DEPENDENCIES.map((dependency) => [dependency, value[dependency]]),
  ))
}

/**
 * Strict, closed validation. A result that is not exactly the contract — wrong
 * schema or contract version, a missing or extra dependency key, a state outside
 * the closed vocabulary, an aggregate that disagrees with its own parts — is
 * treated as no evidence at all rather than partially believed.
 */
export function parseAcademicReadinessResult(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return academicDependenciesUnavailable()
  }
  const keys = Object.keys(result)
  if (
    keys.length !== 4 ||
    !keys.every((key) =>
      ['schemaVersion', 'contractVersion', 'status', 'dependencies'].includes(key)) ||
    result.schemaVersion !== ACADEMIC_READINESS_SCHEMA_VERSION ||
    result.contractVersion !== ACADEMIC_READINESS_CONTRACT_VERSION ||
    !DATABASE_STATES.includes(result.status)
  ) return academicDependenciesUnavailable()

  const dependencies = academicDependencyMap(result.dependencies)

  // The aggregate is redundant with the parts by construction. If they disagree
  // the record was not produced by the contract, so none of it is believed.
  const allReady = ACADEMIC_DEPENDENCIES.every((key) => dependencies[key] === 'ready')
  if ((result.status === 'ready') !== allReady) return academicDependenciesUnavailable()

  return dependencies
}

/**
 * Defence in depth. The operation surface proves Netlify composition supports a
 * dependency; the durable probe proves the underlying server contract exists.
 * Neither alone may report ready, so a missing probe on either side keeps the
 * dependency closed.
 */
export function combineAcademicReadiness(operationSurfaceState, databaseState) {
  if (operationSurfaceState !== 'ready' && operationSurfaceState !== 'degraded') return 'not-ready'
  if (databaseState !== 'ready') return 'not-ready'
  return operationSurfaceState === 'degraded' ? 'degraded' : 'ready'
}

/**
 * Reads the consolidated contract through the trusted server boundary. Never
 * throws: transport absence, an unconfigured environment, a rejected call and a
 * malformed body all resolve to every dependency not-ready.
 */
export function createSupabaseStudyAcademicReadiness(options = {}) {
  const rpc = options.rpc ?? createSupabaseServiceRpc(options)

  return Object.freeze({
    isConfigured: () => rpc?.isConfigured?.() === true,
    async read() {
      if (rpc?.isConfigured?.() !== true) return academicDependenciesUnavailable()
      try {
        return parseAcademicReadinessResult(
          await rpc.call('academy_study_academic_readiness_v1'),
        )
      } catch {
        return academicDependenciesUnavailable()
      }
    },
  })
}

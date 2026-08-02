import type { StudyProductionAuthority } from '../contracts/production/identity'
import { isCurrentStudyProductionAuthority } from '../contracts/production/identity'
import {
  evaluateProductionReadiness,
  productionStudyIsAvailable,
  readinessWireResult,
  type StudyProductionReadiness,
} from '../contracts/production/readiness'
import {
  isStudyProductionPortRegistry,
  productionPortReadiness,
  type StudyProductionPortRegistry,
} from '../contracts/production/ports'
import {
  STUDY_PRODUCTION_CONTRACT_VERSION,
  STUDY_READINESS_SCHEMA_VERSION,
} from '../contracts/production/versions'
import {
  lifecycleBindingFromProductionAuthority,
  StudyLifecycleBoundary,
} from './lifecycleBoundary'

export interface VerifiedLearnerAcademicRuntime {
  readonly deployment: 'production'
  readonly runtimeVersion: string
  readonly acceptsVerifiedStudentIdentity: true
  readonly containsSyntheticLearnerSentinel: false
  readonly execute: (input: {
    readonly authority: StudyProductionAuthority
    readonly operation: 'dashboard' | 'calendar' | 'session'
    readonly signal: AbortSignal
  }) => Promise<unknown>
}

const VERIFIED_ACADEMIC_RUNTIMES = new WeakSet<object>()

export function brandVerifiedLearnerAcademicRuntime(
  runtime: VerifiedLearnerAcademicRuntime,
): VerifiedLearnerAcademicRuntime {
  if (
    runtime.deployment !== 'production' ||
    runtime.acceptsVerifiedStudentIdentity !== true ||
    runtime.containsSyntheticLearnerSentinel !== false ||
    !runtime.runtimeVersion.trim() ||
    typeof runtime.execute !== 'function'
  ) throw new Error('Verified learner academic runtime is invalid.')
  Object.freeze(runtime)
  VERIFIED_ACADEMIC_RUNTIMES.add(runtime)
  return runtime
}

export function isVerifiedLearnerAcademicRuntime(
  value: unknown,
): value is VerifiedLearnerAcademicRuntime {
  return Boolean(value && typeof value === 'object' && VERIFIED_ACADEMIC_RUNTIMES.has(value))
}

export interface StudyProductionCompositionInput {
  readonly featureFlagValue?: string
  readonly authenticatedHostSession: boolean
  readonly selectedLearnerAuthorized: boolean
  readonly authority: StudyProductionAuthority | null
  readonly registry: StudyProductionPortRegistry | null
  readonly academicRuntime: VerifiedLearnerAcademicRuntime | null
  /** Host-owned boundary; supplying it keeps one epoch across rerenders. */
  readonly lifecycle?: StudyLifecycleBoundary
}

export interface StudyProductionComposition {
  readonly contractVersion: typeof STUDY_PRODUCTION_CONTRACT_VERSION
  readonly status: 'ready' | 'not-ready' | 'degraded'
  readonly available: boolean
  /** Server/internal detail. Send only clientReadiness across a browser boundary. */
  readonly readiness: StudyProductionReadiness | null
  readonly clientReadiness: {
    readonly schemaVersion: typeof STUDY_READINESS_SCHEMA_VERSION
    readonly status: 'ready' | 'not-ready' | 'degraded'
  }
  readonly lifecycle: StudyLifecycleBoundary
  readonly registry: StudyProductionPortRegistry | null
  readonly authority: StudyProductionAuthority | null
  readonly academicRuntime: VerifiedLearnerAcademicRuntime | null
  readonly blocker:
    | 'feature-disabled'
    | 'authentication'
    | 'learner-authorization'
    | 'registry'
    | 'identity'
    | 'academic-runtime'
    | 'readiness'
    | null
}

const NOT_READY_WIRE = Object.freeze({
  schemaVersion: STUDY_READINESS_SCHEMA_VERSION,
  status: 'not-ready' as const,
})

/**
 * The sole production composition root. It has no import path to preview/local
 * ports and refuses the frozen RC1 sentinel runtime until a verified-identity
 * bridge is approved.
 */
export function createStudyProductionComposition(
  input: StudyProductionCompositionInput,
): StudyProductionComposition {
  const lifecycle = input.lifecycle ?? new StudyLifecycleBoundary()
  const unavailable = (
    blocker: Exclude<StudyProductionComposition['blocker'], null>,
    authority: StudyProductionAuthority | null = input.authority,
  ): StudyProductionComposition => Object.freeze({
    contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
    status: 'not-ready',
    available: false,
    readiness: null,
    clientReadiness: NOT_READY_WIRE,
    lifecycle,
    registry: null,
    authority,
    academicRuntime: null,
    blocker,
  })

  // Keep the gate order fail-closed: no dependency health call occurs until
  // host session and learner authority gates have succeeded.
  if (input.featureFlagValue !== 'true') return unavailable('feature-disabled', null)
  if (!input.authenticatedHostSession) return unavailable('authentication', null)
  if (!input.selectedLearnerAuthorized) return unavailable('learner-authorization', null)
  const authorityValid = isCurrentStudyProductionAuthority(input.authority)
  if (!authorityValid) return unavailable('identity', null)
  if (!isStudyProductionPortRegistry(input.registry)) return unavailable('registry')
  const runtimeValid = isVerifiedLearnerAcademicRuntime(input.academicRuntime) && Boolean(
    input.academicRuntime.deployment === 'production' &&
    input.academicRuntime.acceptsVerifiedStudentIdentity === true &&
    input.academicRuntime.containsSyntheticLearnerSentinel === false &&
    input.academicRuntime.runtimeVersion.trim(),
  )
  if (!runtimeValid) return unavailable('academic-runtime')

  const registry = input.registry
  let readiness: StudyProductionReadiness
  try {
    readiness = evaluateProductionReadiness(productionPortReadiness(registry))
  } catch {
    // Dependency exceptions are server-internal diagnostics. Host render and
    // the browser-facing projection fail closed without exposing which probe.
    return unavailable('readiness')
  }
  const available = authorityValid && runtimeValid && productionStudyIsAvailable({
    featureFlagValue: input.featureFlagValue,
    authenticatedHostSession: input.authenticatedHostSession,
    selectedLearnerAuthorized: input.selectedLearnerAuthorized,
    readiness,
  })
  if (available) {
    lifecycle.beginEpoch(lifecycleBindingFromProductionAuthority(input.authority))
  }
  return Object.freeze({
    contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
    status: available ? 'ready' : readiness.status === 'degraded' ? 'degraded' : 'not-ready',
    available,
    readiness,
    clientReadiness: readinessWireResult(readiness),
    lifecycle,
    registry,
    authority: input.authority,
    academicRuntime: input.academicRuntime,
    blocker: !available ? 'readiness' : null,
  })
}

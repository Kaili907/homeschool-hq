import type { StudyProductionAuthority } from '../contracts/production/identity'
import { isCurrentStudyProductionAuthority } from '../contracts/production/identity'
import {
  evaluateProductionReadiness,
  productionStudyIsAvailable,
  type StudyProductionReadiness,
} from '../contracts/production/readiness'
import {
  productionPortReadiness,
  type StudyProductionPortRegistry,
} from '../contracts/production/ports'
import { STUDY_PRODUCTION_CONTRACT_VERSION } from '../contracts/production/versions'
import { StudyLifecycleBoundary } from './lifecycleBoundary'

export interface VerifiedLearnerAcademicRuntime {
  readonly deployment: 'production'
  readonly runtimeVersion: string
  readonly acceptsVerifiedStudentIdentity: true
  readonly containsSyntheticLearnerSentinel: false
}

export interface StudyProductionCompositionInput {
  readonly featureFlagValue?: string
  readonly authenticatedHostSession: boolean
  readonly selectedLearnerAuthorized: boolean
  readonly authority: StudyProductionAuthority | null
  readonly registry: StudyProductionPortRegistry | null
  readonly academicRuntime: VerifiedLearnerAcademicRuntime | null
}

export interface StudyProductionComposition {
  readonly contractVersion: typeof STUDY_PRODUCTION_CONTRACT_VERSION
  readonly status: 'ready' | 'not-ready' | 'degraded'
  readonly available: boolean
  readonly readiness: StudyProductionReadiness | null
  readonly lifecycle: StudyLifecycleBoundary
  readonly registry: StudyProductionPortRegistry | null
  readonly authority: StudyProductionAuthority | null
  readonly blocker: 'registry' | 'identity' | 'academic-runtime' | 'readiness' | null
}

/**
 * The sole production composition root. It has no import path to preview/local
 * ports and refuses the frozen RC1 sentinel runtime until a verified-identity
 * bridge is approved.
 */
export function createStudyProductionComposition(
  input: StudyProductionCompositionInput,
): StudyProductionComposition {
  const lifecycle = new StudyLifecycleBoundary()
  if (!input.registry) return Object.freeze({
    contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
    status: 'not-ready',
    available: false,
    readiness: null,
    lifecycle,
    registry: null,
    authority: input.authority,
    blocker: 'registry',
  })
  const readiness = evaluateProductionReadiness(productionPortReadiness(input.registry))
  const authorityValid = isCurrentStudyProductionAuthority(input.authority)
  const runtimeValid = Boolean(
    input.academicRuntime &&
    input.academicRuntime.deployment === 'production' &&
    input.academicRuntime.acceptsVerifiedStudentIdentity === true &&
    input.academicRuntime.containsSyntheticLearnerSentinel === false &&
    input.academicRuntime.runtimeVersion.trim(),
  )
  const available = authorityValid && runtimeValid && productionStudyIsAvailable({
    featureFlagValue: input.featureFlagValue,
    authenticatedHostSession: input.authenticatedHostSession,
    selectedLearnerAuthorized: input.selectedLearnerAuthorized,
    readiness,
  })
  return Object.freeze({
    contractVersion: STUDY_PRODUCTION_CONTRACT_VERSION,
    status: available ? 'ready' : readiness.status === 'degraded' ? 'degraded' : 'not-ready',
    available,
    readiness,
    lifecycle,
    registry: input.registry,
    authority: input.authority,
    blocker: !authorityValid ? 'identity' : !runtimeValid ? 'academic-runtime' : !available ? 'readiness' : null,
  })
}

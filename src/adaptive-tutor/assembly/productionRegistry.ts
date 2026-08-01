import { createSubjectRegistry } from './subjectRegistry'

// Deliberately empty for TUTOR-ASSEMBLY-1. Frozen Math R1 is probe-only and is
// not installed or registered into the production host by this foundation.
const productionRegistryResult = createSubjectRegistry([])

if (!productionRegistryResult.ok) {
  throw new Error('The empty Adaptive Tutor production registry could not be created.')
}

export const productionAdaptiveTutorRegistry = productionRegistryResult.value

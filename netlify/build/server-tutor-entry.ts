/**
 * Server-only Tutor execution surface.
 *
 * This is content/runtime composition, not transport. It reads no request,
 * mounts no handler, owns no credential, contacts no provider and persists
 * nothing by itself. A future reviewed Netlify handler may supply host-owned
 * ports to this factory after its authorization and content-mapping gates.
 */
import { STUDY_TUTOR_CONTRACT_VERSION } from '../../src/study/contracts/tutor'
import {
  ProductionStudyTutorRuntime,
  type ProductionStudyTutorRuntimeDependencies,
} from '../../src/study/production/tutorRuntime'

export const SERVER_TUTOR_ADAPTER_CONTRACT_VERSION = STUDY_TUTOR_CONTRACT_VERSION

export function createProductionServerTutorRuntime(
  dependencies: ProductionStudyTutorRuntimeDependencies,
): ProductionStudyTutorRuntime {
  return new ProductionStudyTutorRuntime(dependencies)
}

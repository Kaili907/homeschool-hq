// FAMILY-PILOT-PRODUCTION-STORAGE: the public entry point.
//
// One factory. Everything else on this surface is a type, so a later
// convergence has exactly one call to make and no assembly to repeat.

export {
  FAMILY_PILOT_PRODUCTION_STUDY_PORTS_LABEL,
  createFamilyPilotProductionStudyPorts,
  type FamilyPilotProductionStorageHealth,
  type FamilyPilotProductionStudent,
  type FamilyPilotProductionStudentHealth,
  type FamilyPilotProductionStudyPorts,
  type FamilyPilotProductionStudyPortsOptions,
} from './productionStudyPorts'

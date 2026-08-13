// FAMILY-PILOT-INTEGRATION: the integration layer's public surface.
//
// PRODUCTION BOUNDARY WARNING. This barrel re-exports FamilyPilotController,
// which imports the Study runtime facade. Importing this file from anything a
// production client bundle can reach pulls that facade — and the markers
// src/study/production/providerBundleSecurity.test.ts forbids — back into the
// bundle. Routed components should import the specific module they need
// (./identity, ./curriculum, ./safety are all production-safe) and reach the
// Study path only through FamilyPilotHost's development-gated lazy import.

export {
  FAMILY_PILOT_HOUSEHOLD_REF,
  fromStudentSelector,
  launchContextFor,
  learnerOptionFor,
  learnerScopeFor,
  toStudentSelector,
} from './identity'
export {
  assignmentRefFor,
  catalogCurriculumPort,
  hostLessonCurriculumPort,
  lessonSegments,
  type FamilyPilotCurriculumPort,
} from './curriculum'
// Production-safe: the completion policy seam imports Core and nothing else.
export {
  computeFamilyPilotCompletionStatus,
  familyPilotCompletionAuthority,
  guardianAttestationCompletionPolicy,
  learnerAuthorityCompletionPolicy,
  resolveCompletionAuthority,
  type CurriculumCompletionAuthority,
  type FamilyPilotAttestationRejection,
  type FamilyPilotAttestationRequest,
  type FamilyPilotAttestationResult,
  type FamilyPilotCompletionPolicyPort,
  type FamilyPilotPendingAttestation,
} from '../completion/policy'
export { toAssignmentStatus, toStudentAssignment, toStudentAssignments } from './assignments'
export {
  checkStudyEntry,
  checkTutorEntry,
  type FamilyPilotSafetyDecision,
  type FamilyPilotSafetyPort,
} from './safety'
export {
  FamilyPilotController,
  type FamilyPilotControllerOptions,
  type FamilyPilotOperationResult,
} from './controller'

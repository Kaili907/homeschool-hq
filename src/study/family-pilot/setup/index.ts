export type {
  FamilySetupBlockReason,
  FamilySetupMutationResult,
  FamilySetupRemovalContext,
  FamilySetupState,
  FamilySetupStudent,
  FamilySetupStudentRef,
  FamilySetupValidationIssue,
  FamilySetupValidationResult,
} from './types'
export { EMPTY_FAMILY_SETUP_STATE } from './types'

export { generateStudentRef, isValidStudentRef } from './identifiers'

export type { CreateFamilySetupStudentInput, UpdateFamilySetupStudentPatch } from './operations'
export {
  MAX_STUDENTS,
  completeSetup,
  createStudent,
  removeStudent,
  setPinRequirement,
  setWorkingGrade,
  updateStudent,
  validateFamilySetup,
} from './operations'

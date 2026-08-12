/**
 * Browser-safe barrel only. loadHealthCatalog (rawContent.node.ts) is
 * deliberately NOT re-exported here: it touches node:fs and must be imported
 * directly by node-only callers (tests, server code) — mirroring how
 * src/curriculum/family-pilot/source.node.ts is kept out of catalog.ts's
 * exports so a browser bundle never statically pulls in node:fs.
 */

export type {
  HealthAdaptiveTutorRoute,
  HealthAdaptiveTutorSignal,
  HealthCatalog,
  HealthCourse,
  HealthGrade,
  HealthGuardianVisibility,
  HealthLesson,
  HealthLessonFlowSegment,
  HealthLessonMedia,
  HealthUnit,
} from './types'

export {
  getHealthCourse,
  getHealthLesson,
  getHealthUnit,
  getHealthUnitById,
  getUnitForLesson,
  listHealthLessons,
  listHealthLessonsForUnit,
  listHealthUnits,
  nextHealthLesson,
} from './lookup'

export { deriveGuardianVisibility, isSafetyCriticalUnit } from './guardianVisibility'

export {
  HealthPrivacyViolationError,
  assertNoDisallowedHealthFields,
  projectHealthLessonForGuardian,
  projectHealthLessonForStudy,
  type HealthLessonGuardianProjection,
  type HealthLessonStudentProjection,
} from './privacyProjection'

export {
  healthCanHelp,
  healthStaticHelp,
  healthTutorGuidanceForSignal,
  type HealthHelpEligibility,
  type HealthHelpPath,
} from './tutorHelp'

export {
  healthLessonSegments,
  healthLessonStudyPlan,
  toFamilyPilotAssignment,
  toHostLessonDescriptor,
} from './studyAdapter'

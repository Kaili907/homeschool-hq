// Note: the Node-only curriculum loader (curriculumSource.node.ts) is
// deliberately NOT re-exported here. It reads the frozen curriculum tree
// with node:fs and cannot run in a browser bundle — the same reason
// src/curriculum/family-pilot/source.node.ts stays out of any browser-safe
// barrel (see src/study/family-pilot/integration/curriculum.ts). Server and
// test code should import it directly: `./curriculumSource.node`.
export {
  listLessonsForGrade,
  listUnitsForGrade,
  getLesson,
  getUnit,
  listLessonsForUnit,
  getNextLesson,
  totalLessonCount,
  totalUnitCount,
} from './catalog'
export { toActivity, type PhysicalEducationActivity, type PhysicalEducationActivityPhase } from './activity'
export {
  adaptPhysicalEducationLessonToStudyPlan,
  physicalEducationCalendarDraft,
} from './studyAdapter'
export {
  buildCompletionEvidence,
  type PhysicalEducationCompletionEvidence,
} from './completionEvidence'
export {
  buildGuardianProjection,
  type PhysicalEducationGuardianProjection,
} from './guardianProjection'
export {
  staticTutorExplanation,
  type PhysicalEducationStaticExplanation,
  type PhysicalEducationStaticExplanationStep,
} from './tutorExplanation'
export type {
  PhysicalEducationCatalog,
  PhysicalEducationCourse,
  PhysicalEducationLesson,
  PhysicalEducationLessonFlowPhase,
  PhysicalEducationMedia,
  PhysicalEducationUnit,
} from './types'

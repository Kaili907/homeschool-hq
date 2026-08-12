// FAMILY-PILOT-SCIENCE-1 — the Science subject lane's public surface.
//
// This barrel is safe to import from a browser bundle EXCEPT for the
// loadScienceCatalog/source.node re-export: that loader reads the frozen
// curriculum tree with node:fs (see source.node.ts), the same constraint the
// math pilot's curriculum port already documents. A browser caller should
// load a catalog once (Node-side, e.g. at build or test time) and pass it
// into the pure functions below — none of getScienceCourse, listScienceUnits,
// listScienceLessons, getScienceLesson, getScienceUnitAssessment,
// adaptScienceLessonToStudy, getScienceTutorCapability, or
// scienceLessonSafetyRequirements touches the filesystem.

export {
  getScienceCourse,
  getScienceLesson,
  getScienceUnitAssessment,
  listScienceLessons,
  listScienceUnits,
} from './catalog'
export { scienceLessonSafetyRequirements, type ScienceLessonSafetyRequirements } from './safety'
export { ScienceContentError, loadScienceCatalog } from './source.node'
export { adaptScienceLessonToStudy } from './studyAdapter'
export {
  getScienceTutorCapability,
  type ScienceTutorCapability,
  type ScienceTutorCapabilityOptions,
} from './tutorCapability'
export {
  SCIENCE_GRADES,
  SCIENCE_SUBJECT,
  type ScienceAssessmentPrompt,
  type ScienceCatalog,
  type ScienceCourseRef,
  type ScienceLessonDetail,
  type ScienceLessonFlowStep,
  type ScienceLessonRef,
  type ScienceLessonSafety,
  type ScienceUnitAssessment,
  type ScienceUnitRef,
} from './types'
export { validateScienceSubjectLane, type ScienceSubjectLaneValidationReport } from './validate'

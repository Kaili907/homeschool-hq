export {
  TECH_CS_SUBJECT,
  type TechCsCatalog,
  type TechCsCourseRef,
  type TechCsDayPhase,
  type TechCsLessonRef,
  type TechCsUnitRef,
} from './catalog/types'
// catalog/source.node.ts (loadTechCsCatalog) is deliberately NOT re-exported
// here: it uses node:fs and must stay out of any browser bundle, mirroring
// src/curriculum/family-pilot's equally node-only, un-barreled source.node.ts.
// Import it directly from './catalog/source.node' in Node-only contexts.
export {
  getNextTechCsLesson,
  getTechCsAssignments,
  getTechCsCourseForGrade,
  getTechCsLesson,
  getTechCsUnit,
  isCodeOrLogicFocus,
} from './catalog/catalog'
export {
  accessibilityNotesFor,
  containsCredentialLikeContent,
  safetyAndPrivacyNotesFor,
  textContainsCredentialLikeContent,
} from './accessibility/metadata'
export { techCsLessonPlan, techCsLessonSegments, techCsSegmentRef } from './segments/studySegments'
export {
  isProjectCheckpointLesson,
  projectDescriptorForUnit,
  TechCsCheckpointError,
  toTechCsStudyCheckpoint,
  type TechCsCheckpointInput,
  type TechCsProjectDescriptor,
} from './project/checkpointProjection'
export {
  staticTechCsExplanation,
  techCsHelpContext,
  type TechCsHelpRequest,
  type TechCsHelpResponse,
} from './tutor/staticExplanation'

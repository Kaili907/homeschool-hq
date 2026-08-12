// Host-neutral surface only. loadElaCatalog (./source.node) is Node-only —
// like src/curriculum/family-pilot/source.node.ts, it is imported directly
// by whichever host runs on Node, never through this barrel, so a browser
// build never pulls in node:fs.
export { ELA_SUBJECT } from './types'
export type { ElaCatalog, ElaCourseRef, ElaLessonRef, ElaUnitRef } from './types'
export { classifyElaLessonKind, ElaPhaseError } from './lessonKind'
export { getElaCourse, getElaLesson, listElaLessons, listElaUnits } from './catalog'
export { adaptElaLessonToStudy, elaCurriculumPort } from './adapter'
export { getElaTutorCapability } from './tutorCapability'
export { validateElaSubjectLane, type ElaValidationReport } from './validate'

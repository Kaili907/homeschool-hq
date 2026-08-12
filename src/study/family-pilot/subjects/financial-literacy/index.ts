export { FINANCIAL_LITERACY_SUBJECT } from './types'
export type {
  FinancialLiteracyCatalog,
  FinLitCourseRef,
  FinLitLessonRef,
  FinLitStudentRef,
  FinLitUnitRef,
} from './types'

export { FinancialLiteracyContentError, loadFinancialLiteracyCatalog } from './source.node'

export { getAssignments, getLesson, getNextLesson, getUnit, getUnitForLesson } from './catalog'

export {
  assignmentRefFor,
  financialLiteracyCurriculumPort,
  hostLessonFor,
  lessonStudyPlan,
} from './studyAdapter'
export type { FinancialLiteracyCurriculumPort } from './studyAdapter'

export { practiceForUnit } from './practiceBridge'
export type { FinLitPracticeAvailability, FinLitPracticeAvailable, FinLitPracticeUnsupported } from './practiceBridge'

export { checkFinancialLiteracyAnswer, financialLiteracyAssessmentItem } from './answerChecking'
export type { FinLitAnswerCheckResult } from './answerChecking'

export { financialLiteracyHelpEligibility, financialLiteracyHelpText } from './tutorHelp'

export { completionEvidenceFromEntry, parentLessonSummary } from './progressMetadata'
export type { FinLitCompletionEvidence, FinLitParentLessonSummary } from './progressMetadata'

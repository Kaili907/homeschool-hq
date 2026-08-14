import type { FinalCurriculumGrade, FinalCurriculumRuntime } from '../../../curriculum/final-runtime'
import { ACADEMY_COURSE_ID_PATTERN } from '../../../curriculum/grade-authority'
import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject, type Profile } from '../../../types'
import type { FamilyPilotStateV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app/state'
import type { FamilySetupStudent } from '../setup'
import type { FamilyPilotSafetyStateV1 } from '../safety'
import type { FamilyAutoPlannerCatalogPort } from './ports'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerHoldFact,
  FamilyAutoPlannerLearner,
} from './types'

/** Read-only bridge from the existing Family Setup learner/profile contract. */
export function learnerFromFamilySetup(
  learner: FamilySetupStudent,
  assignedCourseRefs: readonly string[] = [],
): FamilyAutoPlannerLearner {
  return Object.freeze({
    learnerRef: learner.studentRef,
    displayName: learner.displayName,
    nominalGrade: learner.nominalGrade,
    workingGradeBySubject: Object.freeze({ ...learner.workingGradeBySubject }),
    enabledSubjects: Object.freeze([...learner.enabledSubjects]),
    assignedCourseRefs: Object.freeze([...assignedCourseRefs]),
  })
}

/** Read-only bridge for the established AppState Profile contract. Existing
 * academy courseIds are the course-assignment authority; workingLevels are
 * copied as inputs and Profile.grade remains untouched reporting truth. */
export function learnerFromProfile(
  profile: Profile,
  enabledSubjects?: readonly AcademySubject[],
): FamilyAutoPlannerLearner {
  const assignedCourseRefs = Object.freeze([...(profile.academy?.courseIds ?? [])])
  const derivedSubjects = assignedCourseRefs.flatMap((courseRef) => {
    const match = ACADEMY_COURSE_ID_PATTERN.exec(courseRef)
    const subject = match?.[2] as AcademySubject | undefined
    return subject && ACADEMY_SUBJECTS.includes(subject) ? [subject] : []
  })
  return Object.freeze({
    learnerRef: profile.id,
    displayName: profile.name,
    nominalGrade: profile.grade,
    workingGradeBySubject: Object.freeze({ ...(profile.workingLevels ?? {}) }),
    enabledSubjects: Object.freeze([...(enabledSubjects ?? [...new Set(derivedSubjects)])]),
    assignedCourseRefs,
  })
}

/** Read-only bridge from Family Pilot Core. Unknown/non-Academy legacy subjects
 * stay outside this planner rather than being reinterpreted. */
export function assignmentFactsFromFamilyPilotCore(
  state: FamilyPilotStateV1,
  learnerRef: string,
): readonly FamilyAutoPlannerAssignmentFact[] {
  const learner = state.students.find((student) => student.studentRef === learnerRef)
  if (!learner) return Object.freeze([])
  return Object.freeze(learner.assignments.flatMap((assignment) => {
    if (!ACADEMY_SUBJECTS.includes(assignment.subject as AcademySubject)) return []
    return [Object.freeze({
      assignmentRef: assignment.assignmentRef,
      learnerRef,
      lessonRef: assignment.lessonRef,
      subject: assignment.subject as AcademySubject,
      title: assignment.title,
      state: assignment.state,
      sessionRef: assignment.sessionRef,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      completedAt: assignment.completedAt,
      optional: false,
    })]
  }))
}

/** Read-only bridge from the existing final assessment assignment metadata. */
export function assessmentFactsFromFinalFamilyPilot(
  assignments: readonly FinalFamilyPilotAssessmentAssignment[],
  learnerRef: string,
): readonly FamilyAutoPlannerAssessmentFact[] {
  return Object.freeze(assignments.filter((entry) => entry.studentRef === learnerRef).map((entry) => Object.freeze({
    assignmentRef: entry.assignmentRef,
    learnerRef,
    assessmentRef: entry.assessmentRef,
    courseRef: entry.courseRef,
    subject: entry.subject,
    title: entry.title,
    status: entry.status,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    completedAt: entry.completedAt,
  })))
}

/** Read-only bridge from existing minimized safety state. */
export function holdFactsFromFamilyPilotSafety(
  state: FamilyPilotSafetyStateV1,
  learnerRef: string,
): readonly FamilyAutoPlannerHoldFact[] {
  return Object.freeze(state.holds.filter((hold) => hold.studentRef === learnerRef).map((hold) => Object.freeze({
    learnerRef,
    sessionRef: hold.sessionRef,
    status: hold.status,
    reasonCode: hold.reasonCode,
  })))
}

/** Direct read adapter over the admitted final curriculum runtime. */
export function autoPlannerCatalogFromFinalRuntime(
  runtime: Pick<FinalCurriculumRuntime<unknown>, 'listGrades' | 'listCourses' | 'listUnits' | 'listLessons'>,
): FamilyAutoPlannerCatalogPort {
  return Object.freeze({
    listGrades: () => Object.freeze(runtime.listGrades().map((grade) => String(grade) as AcademyGrade)),
    listCourses: (grade: AcademyGrade) => runtime.listCourses(Number(grade) as FinalCurriculumGrade),
    listUnits: (courseRef: string) => runtime.listUnits(courseRef),
    listLessons: (courseRef: string) => runtime.listLessons(courseRef),
  })
}

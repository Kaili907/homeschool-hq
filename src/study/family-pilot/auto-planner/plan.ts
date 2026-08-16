import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import { schoolDayReason, schoolLocalDate, isIsoDate, assertTimeZone, weekdayOf } from './clock'
import { resolveFamilyCourseNextEligible } from './nextEligible'
import {
  FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
  type FamilyAutoPlannerAssessmentFact,
  type FamilyAutoPlannerAssignmentFact,
  type FamilyAutoPlannerBlocker,
  type FamilyAutoPlannerComputation,
  type FamilyAutoPlannerCourseCompletion,
  type FamilyAutoPlannerCourseBundle,
  type FamilyAutoPlannerDocumentV1,
  type FamilyAutoPlannerHoldFact,
  type FamilyAutoPlannerLearner,
  type FamilyAutoPlannerMaterializationIntent,
  type FamilyAutoPlannerMaterializationV1,
  type FamilyAutoPlannerReason,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerScope,
  type FamilyAutoPlannerStatus,
  type FamilyAutoPlannerSubjectPlanV1,
  type FamilyAutoPlannerTodayItem,
  type FamilyAutoPlannerTodayPlan,
} from './types'

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const OPEN_ASSIGNMENT_STATES = new Set(['planned', 'active', 'paused'])

export interface ComputeFamilyAutoPlannerInput {
  readonly scope: FamilyAutoPlannerScope
  readonly instant: Date
  readonly document: FamilyAutoPlannerDocumentV1
  readonly learner: FamilyAutoPlannerLearner | null
  readonly assignments: readonly FamilyAutoPlannerAssignmentFact[]
  readonly assessments: readonly FamilyAutoPlannerAssessmentFact[]
  readonly holds: readonly FamilyAutoPlannerHoldFact[]
  /** null means the catalog could not be reached. Materialized work remains usable. */
  readonly catalog: readonly FamilyAutoPlannerCourseBundle[] | null
}

export function emptyFamilyAutoPlannerDocument(
  scope: FamilyAutoPlannerScope,
  now: string,
): FamilyAutoPlannerDocumentV1 {
  return Object.freeze({
    schemaVersion: FAMILY_AUTO_PLANNER_SCHEMA_VERSION,
    scope: Object.freeze({ ...scope }),
    revision: 0,
    updatedAt: now,
    schoolPlan: null,
    materializations: Object.freeze([]),
  })
}

export function validateFamilyAutoPlannerSchoolPlan(plan: FamilyAutoPlannerSchoolPlanV1): boolean {
  try {
    if (plan.schemaVersion !== FAMILY_AUTO_PLANNER_SCHEMA_VERSION) return false
    assertTimeZone(plan.householdTimeZone)
    if (!isIsoDate(plan.schoolYearStart) || !isIsoDate(plan.schoolYearEnd) || plan.schoolYearEnd < plan.schoolYearStart) return false
    if (!Number.isFinite(Date.parse(plan.configuredAt)) || !Number.isFinite(Date.parse(plan.updatedAt))) return false
    if (!plan.schoolWeekdays.length || new Set(plan.schoolWeekdays).size !== plan.schoolWeekdays.length) return false
    if (plan.schoolWeekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) return false
    for (const dates of [plan.nonSchoolDates, plan.addedSchoolDates]) {
      if (new Set(dates).size !== dates.length || dates.some((date) => !isIsoDate(date))) return false
    }
    if (plan.nonSchoolDates.some((date) => plan.addedSchoolDates.includes(date))) return false
    if (plan.allowWorkAhead !== undefined && typeof plan.allowWorkAhead !== 'boolean') return false
    if (!plan.subjects.length || new Set(plan.subjects.map((entry) => entry.subject)).size !== plan.subjects.length) return false
    if (new Set(plan.subjects.map((entry) => entry.order)).size !== plan.subjects.length) return false
    return plan.subjects.every((entry) =>
      ACADEMY_SUBJECTS.includes(entry.subject) &&
      Number.isSafeInteger(entry.order) && entry.order >= 0 &&
      typeof entry.paused === 'boolean' &&
      (entry.schoolWeekdays === undefined || (
        entry.schoolWeekdays.length > 0 &&
        new Set(entry.schoolWeekdays).size === entry.schoolWeekdays.length &&
        entry.schoolWeekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      )) &&
      Number.isSafeInteger(entry.lessonsPerDay) && entry.lessonsPerDay >= 1 && entry.lessonsPerDay <= 5 &&
      TIME.test(entry.startLocalTime) &&
      (entry.courseRef === undefined || entry.courseRef.length > 0))
  } catch {
    return false
  }
}

export function familyAutoPlannerAllowsWorkAhead(plan: FamilyAutoPlannerSchoolPlanV1): boolean {
  return plan.allowWorkAhead !== false
}

export function familyAutoPlannerSubjectScheduled(
  plan: FamilyAutoPlannerSchoolPlanV1,
  subject: AcademySubject,
  localDate: string,
): boolean {
  const subjectPlan = plan.subjects.find((entry) => entry.subject === subject)
  if (!subjectPlan) return false
  if (plan.addedSchoolDates.includes(localDate)) return true
  const weekdays = subjectPlan.schoolWeekdays ?? plan.schoolWeekdays
  return weekdays.includes(weekdayOf(localDate))
}

function localDateOf(instant: string | null, timeZone: string): string | null {
  if (!instant) return null
  const parsed = new Date(instant)
  return Number.isFinite(parsed.getTime()) ? schoolLocalDate(parsed, timeZone) : null
}

function workingGrade(
  learner: FamilyAutoPlannerLearner,
  subject: AcademySubject,
): AcademyGrade | null {
  const grade = learner.workingGradeBySubject[subject] ?? learner.nominalGrade
  return ACADEMY_GRADES.includes(grade as AcademyGrade) ? grade as AcademyGrade : null
}

function assignmentItemState(state: FamilyAutoPlannerAssignmentFact['state']): FamilyAutoPlannerTodayItem['state'] {
  if (state === 'active') return 'IN_PROGRESS'
  if (state === 'paused') return 'PAUSED'
  return 'NOT_STARTED'
}

function assessmentReason(status: FamilyAutoPlannerAssessmentFact['status']): FamilyAutoPlannerReason {
  if (status === 'ADULT_REVIEW_REQUIRED') return 'ASSESSMENT_REVIEW_REQUIRED'
  if (status === 'PENDING_GUARDIAN_ATTESTATION') return 'ASSESSMENT_GUARDIAN_REQUIRED'
  return 'ASSESSMENT_PENDING'
}

function materializationByAssignment(
  document: FamilyAutoPlannerDocumentV1,
): ReadonlyMap<string, FamilyAutoPlannerMaterializationV1> {
  return new Map(document.materializations.map((entry) => [entry.assignmentRef, entry]))
}

function blocker(
  reason: FamilyAutoPlannerReason,
  subject: AcademySubject | null,
  detail: string,
): FamilyAutoPlannerBlocker {
  return Object.freeze({ reason, subject, detail })
}

function basePlan(input: ComputeFamilyAutoPlannerInput, localDate: string, timeZone: string | null): FamilyAutoPlannerTodayPlan {
  return Object.freeze({
    status: 'BLOCKED',
    reason: 'NONE',
    scope: Object.freeze({ ...input.scope }),
    householdTimeZone: timeZone,
    localDate,
    generatedAt: input.instant.toISOString(),
    items: Object.freeze([]),
    blockers: Object.freeze([]),
    completedCourses: Object.freeze([]),
    manualOverrideActive: false,
    offlineMaterializedWorkAvailable: false,
  })
}

function finish(
  base: FamilyAutoPlannerTodayPlan,
  status: FamilyAutoPlannerStatus,
  reason: FamilyAutoPlannerReason,
  items: readonly FamilyAutoPlannerTodayItem[],
  blockers: readonly FamilyAutoPlannerBlocker[],
  manualOverrideActive: boolean,
  offlineMaterializedWorkAvailable: boolean,
  completedCourses: readonly FamilyAutoPlannerCourseCompletion[] = base.completedCourses,
): FamilyAutoPlannerTodayPlan {
  return Object.freeze({
    ...base,
    status,
    reason,
    items: Object.freeze([...items]),
    blockers: Object.freeze([...blockers]),
    completedCourses: Object.freeze([...completedCourses]),
    manualOverrideActive,
    offlineMaterializedWorkAvailable,
  })
}

function authoritativeCourseCompletion(
  bundle: FamilyAutoPlannerCourseBundle,
  learnerRef: string,
  assignments: readonly FamilyAutoPlannerAssignmentFact[],
  assessments: readonly FamilyAutoPlannerAssessmentFact[],
): FamilyAutoPlannerCourseCompletion | null {
  const lessonRefs = [...new Set(bundle.lessons.map((lesson) => lesson.lessonRef))]
  if (lessonRefs.length === 0) return null
  const assessmentRefs = [...new Set(bundle.units.flatMap((unit) => unit.assessmentRef ? [unit.assessmentRef] : []))]
  const lessonFacts = lessonRefs.map((lessonRef) => assignments.filter((entry) =>
    entry.learnerRef === learnerRef && entry.lessonRef === lessonRef && entry.state === 'completed'))
  const assessmentFacts = assessmentRefs.map((assessmentRef) => assessments.filter((entry) =>
    entry.learnerRef === learnerRef && entry.courseRef === bundle.course.courseRef &&
    entry.assessmentRef === assessmentRef && entry.status === 'CERTIFIED'))
  if (lessonFacts.some((facts) => facts.length === 0) || assessmentFacts.some((facts) => facts.length === 0)) return null

  const firstDates = [...lessonFacts, ...assessmentFacts].map((facts) => facts
    .map((fact) => fact.completedAt)
    .filter((completedAt): completedAt is string => completedAt !== null && Number.isFinite(Date.parse(completedAt)))
    .sort()[0] ?? null)
  const completedAt = firstDates.every((date): date is string => date !== null)
    ? [...firstDates].sort().at(-1) ?? null
    : null
  return Object.freeze({
    courseRef: bundle.course.courseRef,
    title: bundle.course.title,
    subject: bundle.course.subject,
    workingGrade: String(bundle.course.grade) as AcademyGrade,
    completedAt,
  })
}

function pickCourse(
  learner: FamilyAutoPlannerLearner,
  subjectPlan: FamilyAutoPlannerSubjectPlanV1,
  grade: AcademyGrade,
  catalog: readonly FamilyAutoPlannerCourseBundle[],
): { readonly bundle: FamilyAutoPlannerCourseBundle | null; readonly reason: FamilyAutoPlannerReason | null } {
  const matching = catalog.filter((entry) => String(entry.course.grade) === grade && entry.course.subject === subjectPlan.subject)
  if (subjectPlan.courseRef) {
    return { bundle: matching.find((entry) => entry.course.courseRef === subjectPlan.courseRef) ?? null, reason: 'COURSE_ASSIGNMENT_UNAVAILABLE' }
  }
  const enrolled = matching.filter((entry) => learner.assignedCourseRefs.includes(entry.course.courseRef))
  if (enrolled.length === 1) return { bundle: enrolled[0], reason: null }
  if (enrolled.length > 1) return { bundle: null, reason: 'COURSE_ASSIGNMENT_AMBIGUOUS' }
  if (matching.length === 1) return { bundle: matching[0], reason: null }
  return {
    bundle: null,
    reason: matching.length === 0 ? 'COURSE_ASSIGNMENT_UNAVAILABLE' : 'COURSE_ASSIGNMENT_AMBIGUOUS',
  }
}

function materializationRef(intent: FamilyAutoPlannerMaterializationIntent): string {
  const itemRef = intent.kind === 'LESSON' ? intent.lesson.lessonRef : intent.assessmentRef
  let hash = 0x811c9dc5
  for (const character of itemRef) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `auto:${intent.localDate}:${intent.subject}:${(hash >>> 0).toString(36)}`
}

export function learnerWorkAheadMaterializationRef(subject: AcademySubject, itemRef: string): string {
  let hash = 0x811c9dc5
  for (const character of itemRef) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `work-ahead:${subject}:${(hash >>> 0).toString(36)}`
}

/** Exported for the coordinator and tests. It is stable and contains no random component. */
export function autoPlannerMaterializationRef(intent: FamilyAutoPlannerMaterializationIntent): string {
  return materializationRef(intent)
}

/**
 * Pure Auto Planner decision. All authority arrives as facts and every clock is
 * explicit, so identical input is byte-for-byte deterministic. The only writes
 * it proposes are narrow materialization intents; Core, assessments, and Study
 * still decide whether their own transitions are accepted.
 */
export function computeFamilyAutoPlanner(input: ComputeFamilyAutoPlannerInput): FamilyAutoPlannerComputation {
  const configured = input.document.schoolPlan
  const provisionalDate = configured
    ? (() => {
        try { return schoolLocalDate(input.instant, configured.householdTimeZone) } catch { return input.instant.toISOString().slice(0, 10) }
      })()
    : input.instant.toISOString().slice(0, 10)
  const base = basePlan(input, provisionalDate, configured?.householdTimeZone ?? null)
  if (!configured) {
    return { plan: finish(base, 'NEEDS_PLAN_SETUP', 'SCHOOL_PLAN_MISSING', [], [], false, false), intents: [] }
  }
  if (!validateFamilyAutoPlannerSchoolPlan(configured)) {
    return { plan: finish(base, 'NEEDS_PLAN_SETUP', 'SCHOOL_PLAN_INVALID', [], [], false, false), intents: [] }
  }
  const localDate = schoolLocalDate(input.instant, configured.householdTimeZone)
  const datedBase = { ...base, localDate }
  if (!input.learner || input.learner.learnerRef !== input.scope.learnerRef) {
    return { plan: finish(datedBase, 'BLOCKED', 'LEARNER_NOT_FOUND', [], [blocker('LEARNER_NOT_FOUND', null, 'The learner profile is unavailable.')], false, false), intents: [] }
  }
  const day = schoolDayReason(configured, localDate)
  if (day !== 'SCHOOL_DAY') {
    const reason = day === 'OUTSIDE_SCHOOL_YEAR' ? 'OUTSIDE_SCHOOL_YEAR' : 'NON_SCHOOL_DAY'
    return { plan: finish(datedBase, 'NO_SCHOOL_TODAY', reason, [], [], false, false), intents: [] }
  }

  const learner = input.learner
  const planBySubject = new Map(configured.subjects.map((entry) => [entry.subject, entry]))
  const missing = learner.enabledSubjects.filter((subject) => !planBySubject.has(subject))
  if (missing.length) {
    const blockers = missing.map((subject) => blocker('SUBJECT_PLAN_MISSING', subject, 'This enabled subject is not configured in the school plan.'))
    return { plan: finish(datedBase, 'NEEDS_PLAN_SETUP', 'SUBJECT_PLAN_MISSING', [], blockers, false, false), intents: [] }
  }

  const materials = materializationByAssignment(input.document)
  const assignmentByRef = new Map(input.assignments.map((entry) => [entry.assignmentRef, entry]))
  const assessmentByRef = new Map(input.assessments.map((entry) => [entry.assignmentRef, entry]))
  const items: FamilyAutoPlannerTodayItem[] = []
  const blockers: FamilyAutoPlannerBlocker[] = []
  const intents: FamilyAutoPlannerMaterializationIntent[] = []
  const completedCourses: FamilyAutoPlannerCourseCompletion[] = []
  const subjectsWithOpenWork = new Set<AcademySubject>()
  let manualOverrideActive = false

  const orderedSubjects = [...learner.enabledSubjects].sort((a, b) => {
    const left = planBySubject.get(a)!
    const right = planBySubject.get(b)!
    return left.order - right.order || a.localeCompare(b)
  })
  const scheduledSubjects = new Set(orderedSubjects.filter((subject) =>
    familyAutoPlannerSubjectScheduled(configured, subject, localDate)))

  // Existing unfinished work is projected before any catalog read is needed.
  const openAssignments = input.assignments
    .filter((entry) => entry.learnerRef === learner.learnerRef && OPEN_ASSIGNMENT_STATES.has(entry.state))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.assignmentRef.localeCompare(b.assignmentRef))
  for (const assignment of openAssignments) {
    const subjectPlan = planBySubject.get(assignment.subject)
    const materialized = materials.get(assignment.assignmentRef)
    const isWorkAhead = materialized?.provenance === 'LEARNER_WORK_AHEAD'
    // Learner-started work stays optional for the date on which it was chosen.
    // A later scheduled day adopts the same assignment without replacing its
    // identity or Study state.
    if (isWorkAhead && (
      !scheduledSubjects.has(assignment.subject) || materialized.localDate >= localDate
    )) continue
    const isManual = !materialized
    manualOverrideActive ||= isManual
    subjectsWithOpenWork.add(assignment.subject)
    const held = assignment.sessionRef !== null && input.holds.some((hold) =>
      hold.learnerRef === learner.learnerRef && hold.sessionRef === assignment.sessionRef && hold.status !== 'cleared')
    const paused = Boolean(subjectPlan?.paused)
    const blockedReason = held ? 'SAFETY_HOLD' : paused ? 'SUBJECT_PAUSED' : null
    if (blockedReason) blockers.push(blocker(blockedReason, assignment.subject, held
      ? 'An unresolved safety hold blocks this exact Study session.'
      : 'The parent paused this subject; unfinished work was preserved.'))
    items.push(Object.freeze({
      kind: 'LESSON',
      origin: isManual ? 'MANUAL_OVERRIDE' : isWorkAhead ? 'LEARNER_WORK_AHEAD' : 'AUTO',
      learnerRef: learner.learnerRef,
      assignmentRef: assignment.assignmentRef,
      itemRef: assignment.lessonRef,
      lessonRef: assignment.lessonRef,
      assessmentRef: null,
      courseRef: materialized?.courseRef ?? null,
      unitRef: materialized?.unitRef ?? null,
      subject: assignment.subject,
      workingGrade: materialized?.workingGrade ?? workingGrade(learner, assignment.subject),
      title: assignment.title,
      state: blockedReason ? 'BLOCKED' : assignmentItemState(assignment.state),
      scheduledLocalTime: subjectPlan?.startLocalTime ?? '09:00',
      materializedForDate: materialized?.localDate ?? null,
      carriedForwardFromDate: materialized && materialized.localDate < localDate ? materialized.localDate : null,
      blockedReason,
    }))
  }

  // Assessment assignments have their own existing lifecycle authority. Open
  // ones are also materialized work and must remain usable without loading a
  // catalog chunk (including while offline).
  const openAssessments = input.assessments
    .filter((entry) => entry.learnerRef === learner.learnerRef && entry.status !== 'CERTIFIED')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.assignmentRef.localeCompare(b.assignmentRef))
  for (const assessment of openAssessments) {
    const subjectPlan = planBySubject.get(assessment.subject)
    const materialized = materials.get(assessment.assignmentRef)
    const isManual = !materialized
    manualOverrideActive ||= isManual
    subjectsWithOpenWork.add(assessment.subject)
    const paused = Boolean(subjectPlan?.paused)
    const waiting = !['PLANNED', 'ACTIVE'].includes(assessment.status)
    const blockedReason = paused ? 'SUBJECT_PAUSED' : waiting ? assessmentReason(assessment.status) : null
    if (blockedReason) blockers.push(blocker(blockedReason, assessment.subject, paused
      ? 'The parent paused this subject; unfinished assessment work was preserved.'
      : 'The next lesson waits for the existing assessment authority to finish.'))
    items.push(Object.freeze({
      kind: 'ASSESSMENT',
      origin: isManual ? 'MANUAL_OVERRIDE' : 'AUTO',
      learnerRef: learner.learnerRef,
      assignmentRef: assessment.assignmentRef,
      itemRef: assessment.assessmentRef,
      lessonRef: null,
      assessmentRef: assessment.assessmentRef,
      courseRef: assessment.courseRef,
      unitRef: materialized?.unitRef ?? null,
      subject: assessment.subject,
      workingGrade: materialized?.workingGrade ?? workingGrade(learner, assessment.subject),
      title: assessment.title,
      state: paused ? 'BLOCKED' : waiting ? 'WAITING' : assessment.status === 'ACTIVE' ? 'IN_PROGRESS' : 'NOT_STARTED',
      scheduledLocalTime: subjectPlan?.startLocalTime ?? '09:00',
      materializedForDate: materialized?.localDate ?? null,
      carriedForwardFromDate: materialized && materialized.localDate < localDate ? materialized.localDate : null,
      blockedReason,
    }))
  }

  for (const subject of orderedSubjects) {
    const subjectPlan = planBySubject.get(subject)!
    const grade = workingGrade(learner, subject)
    if (!grade) {
      blockers.push(blocker('WORKING_GRADE_UNSUPPORTED', subject, `Nominal Grade ${learner.nominalGrade} has no published course; assign an explicit supported working level.`))
      continue
    }
    if (subjectsWithOpenWork.has(subject)) continue
    if (!scheduledSubjects.has(subject)) continue
    if (subjectPlan.paused) {
      blockers.push(blocker('SUBJECT_PAUSED', subject, 'The parent paused this subject. No new work was assigned.'))
      continue
    }

    // A required manual completion is today's override and consumes one daily slot.
    const manualCompletedToday = input.assignments.filter((entry) =>
      entry.learnerRef === learner.learnerRef && entry.subject === subject && entry.state === 'completed' && !entry.optional &&
      !materials.has(entry.assignmentRef) && localDateOf(entry.completedAt, configured.householdTimeZone) === localDate).length
    const autoCompletedToday = input.document.materializations.filter((entry) => {
      if (entry.kind !== 'LESSON' || entry.subject !== subject || entry.provenance === 'LEARNER_WORK_AHEAD') return false
      const fact = assignmentByRef.get(entry.assignmentRef)
      return fact?.state === 'completed' && localDateOf(fact.completedAt, configured.householdTimeZone) === localDate
    }).length
    const dailyCapReached = manualCompletedToday + autoCompletedToday >= subjectPlan.lessonsPerDay

    // A failed prior materialization must never be replaced by a second one.
    const dangling = input.document.materializations.find((entry) =>
      entry.subject === subject && entry.localDate === localDate &&
      (entry.kind === 'LESSON' ? !assignmentByRef.has(entry.assignmentRef) : !assessmentByRef.has(entry.assignmentRef)))
    if (dangling) {
      const reason = dangling.kind === 'LESSON' ? 'ASSIGNMENT_MATERIALIZATION_FAILED' : 'ASSESSMENT_MATERIALIZATION_FAILED'
      blockers.push(blocker(reason, subject, 'Automatic work was recorded but its authoritative assignment is unavailable; parent review is required.'))
      continue
    }

    if (!input.catalog) {
      if (dailyCapReached) continue
      blockers.push(blocker('CATALOG_UNAVAILABLE', subject, 'New catalog work cannot be selected offline. Already materialized work remains available.'))
      continue
    }
    const selected = pickCourse(learner, subjectPlan, grade, input.catalog)
    if (!selected.bundle) {
      blockers.push(blocker(selected.reason ?? 'COURSE_ASSIGNMENT_UNAVAILABLE', subject, 'A single eligible course assignment could not be resolved.'))
      continue
    }
    const { course, units } = selected.bundle
    const courseCompletion = authoritativeCourseCompletion(selected.bundle, learner.learnerRef, input.assignments, input.assessments)
    if (courseCompletion) {
      completedCourses.push(courseCompletion)
      continue
    }
    if (dailyCapReached) continue
    const lessons = [...selected.bundle.lessons].sort((a, b) => a.courseDay - b.courseDay || a.lessonRef.localeCompare(b.lessonRef))
    let selectedIntent: FamilyAutoPlannerMaterializationIntent | null = null
    let subjectWaiting = false
    const abandonedAuto = input.assignments.find((entry) =>
      entry.learnerRef === learner.learnerRef && entry.subject === subject &&
      entry.state === 'abandoned' && materials.has(entry.assignmentRef))
    if (abandonedAuto) {
      blockers.push(blocker('AUTO_ASSIGNMENT_ABANDONED', subject, `Automatic assignment ${abandonedAuto.assignmentRef} was abandoned and requires parent resolution.`))
      subjectWaiting = true
    } else {
      const next = resolveFamilyCourseNextEligible({
        learnerRef: learner.learnerRef,
        bundle: selected.bundle,
        assignments: input.assignments,
        assessments: input.assessments,
        holds: input.holds,
      })
      if (next.status === 'LESSON') {
        selectedIntent = Object.freeze({
          kind: 'LESSON', localDate, subject, workingGrade: grade,
          courseRef: course.courseRef, unitRef: next.unitRef, lesson: next.lesson,
        })
      } else if (next.gate === 'ASSESSMENT_REQUIRED') {
        const unit = units.find((item) => item.assessmentRef && `${item.title} assessment` === next.title)
        if (unit?.assessmentRef) {
          selectedIntent = Object.freeze({
            kind: 'ASSESSMENT', localDate, subject, workingGrade: grade,
            courseRef: course.courseRef, unitRef: unit.unitRef,
            assessmentRef: unit.assessmentRef, title: next.title,
          })
        }
      } else if (next.gate !== 'COURSE_COMPLETE') {
        const reason: FamilyAutoPlannerReason = next.gate === 'SAFETY_HOLD'
          ? 'SAFETY_HOLD'
          : next.gate === 'PARENT_REVIEW'
            ? 'ASSESSMENT_REVIEW_REQUIRED'
            : next.gate === 'GUARDIAN_CERTIFICATION'
              ? 'ASSESSMENT_GUARDIAN_REQUIRED'
              : 'ASSESSMENT_PENDING'
        blockers.push(blocker(reason, subject, 'The next lesson waits for the existing course authority to finish.'))
        subjectWaiting = true
      }
    }
    if (selectedIntent) {
      // The same semantic intent may already be in the document due to another
      // call/tab. Do not propose it again even before the assignment fact arrives.
      const ref = materializationRef(selectedIntent)
      if (!input.document.materializations.some((entry) => entry.materializationRef === ref)) intents.push(selectedIntent)
    } else if (!subjectWaiting && lessons.length === 0) {
      blockers.push(blocker('COURSE_ASSIGNMENT_UNAVAILABLE', subject, 'The assigned course has no ordered lessons.'))
    }
  }

  const orderOf = (subject: AcademySubject) => planBySubject.get(subject)?.order ?? Number.MAX_SAFE_INTEGER
  items.sort((a, b) => orderOf(a.subject) - orderOf(b.subject) ||
    (a.origin === b.origin ? 0 : a.origin === 'MANUAL_OVERRIDE' ? -1 : 1) ||
    a.assignmentRef.localeCompare(b.assignmentRef))

  const usable = items.some((item) => item.state !== 'BLOCKED' && item.state !== 'WAITING') || intents.length > 0
  const waiting = items.some((item) => item.state === 'WAITING') || blockers.some((entry) =>
    ['ASSESSMENT_PENDING', 'ASSESSMENT_REVIEW_REQUIRED', 'ASSESSMENT_GUARDIAN_REQUIRED'].includes(entry.reason))
  const status: FamilyAutoPlannerStatus = usable
    ? 'READY'
    : waiting
      ? 'WAITING_FOR_ASSESSMENT'
      : blockers.length
        ? blockers.every((entry) => entry.reason === 'WORKING_GRADE_UNSUPPORTED' || entry.reason === 'COURSE_ASSIGNMENT_AMBIGUOUS' || entry.reason === 'COURSE_ASSIGNMENT_UNAVAILABLE')
          ? 'NEEDS_PLAN_SETUP'
          : 'BLOCKED'
        : completedCourses.length > 0
          ? 'COURSE_COMPLETE'
          : 'COMPLETE_FOR_TODAY'
  const reason: FamilyAutoPlannerReason = status === 'COURSE_COMPLETE'
    ? 'COURSE_COMPLETE'
    : status === 'READY' || status === 'COMPLETE_FOR_TODAY'
      ? 'NONE'
    : blockers[0]?.reason ?? 'NONE'
  const offlineAvailable = input.catalog === null && items.some((item) => item.origin === 'AUTO')
  return {
    plan: finish(datedBase, status, reason, items, blockers, manualOverrideActive, offlineAvailable, completedCourses),
    intents: Object.freeze(intents),
  }
}

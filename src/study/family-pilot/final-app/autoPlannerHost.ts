import type { FamilyPilotAssignmentRecordV1 } from '../core'
import type { AcademyGrade, AcademySubject } from '../../../types'
import { buildDailySchedule, type ScheduleItemV1 } from '../schedule'
import {
  FamilyAutoPlanner,
  assessmentFactsFromFinalFamilyPilot,
  assignmentFactsFromFamilyPilotCore,
  autoPlannerCatalogFromFinalRuntime,
  familyAutoPlannerAllowsWorkAhead,
  familyAutoPlannerSubjectScheduled,
  learnerWorkAheadMaterializationRef,
  resolveFamilyCourseNextEligible,
  createFamilyAutoPlannerDashboardPort,
  holdFactsFromFamilyPilotSafety,
  learnerFromFamilySetup,
  openFamilyAutoPlannerIndexedDbStore,
  schoolLocalDate,
  toExistingDailyScheduleInput,
  type ConfigureFamilyAutoPlannerResult,
  type FamilyAutoPlannerDashboardPort,
  type FamilyAutoPlannerDocumentV1,
  type FamilyAutoPlannerIndexedDbStore,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerScope,
  type FamilyAutoPlannerStoreLoad,
  type FamilyAutoPlannerStorePort,
  type FamilyAutoPlannerStoreSave,
  type FamilyAutoPlannerTodayPlan,
  type FamilyCourseGate,
} from '../auto-planner'
import type { FinalFamilyPilotController } from './controller'

export interface FinalFamilyAutoPlannerDashboardResult {
  readonly plan: FamilyAutoPlannerTodayPlan
  readonly schedule: readonly ScheduleItemV1[]
}

export interface FinalFamilyAutoPlannerHostOptions {
  readonly store?: FamilyAutoPlannerStorePort
  readonly openStore?: () => Promise<FamilyAutoPlannerIndexedDbStore>
  readonly now?: () => Date
}

export interface FinalLearnerCourseView {
  readonly courseRef: string
  readonly courseTitle: string
  readonly subject: AcademySubject
  readonly workingGrade: AcademyGrade
  readonly completedLessons: number
  readonly totalLessons: number
  readonly currentPosition: string
  readonly todayStatus: 'REQUIRED_TODAY' | 'TODAY_COMPLETE' | 'NOT_REQUIRED_TODAY' | 'NO_SCHOOL_TODAY'
  readonly workAheadAllowed: boolean
  readonly next: {
    readonly lessonRef: string
    readonly title: string
    readonly assignmentRef: string | null
    readonly state: FamilyPilotAssignmentRecordV1['state'] | null
  } | null
  readonly gate: { readonly kind: FamilyCourseGate; readonly message: string } | null
  readonly action: {
    readonly type: 'OPEN_ASSIGNMENT' | 'START_WORK_AHEAD'
    readonly label: string
    readonly assignmentRef: string | null
    readonly lessonRef: string
  } | null
}

class LazyPlannerStore implements FamilyAutoPlannerStorePort {
  readonly #open: () => Promise<FamilyAutoPlannerIndexedDbStore>
  #store: Promise<FamilyAutoPlannerIndexedDbStore> | null = null

  constructor(open: () => Promise<FamilyAutoPlannerIndexedDbStore>) {
    this.#open = open
  }

  #get(): Promise<FamilyAutoPlannerIndexedDbStore> {
    this.#store ??= this.#open()
    return this.#store
  }

  async load(scope: FamilyAutoPlannerScope): Promise<FamilyAutoPlannerStoreLoad> {
    try {
      return await (await this.#get()).load(scope)
    } catch (error) {
      return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Auto Planner storage is unavailable.' }
    }
  }

  async save(
    scope: FamilyAutoPlannerScope,
    document: FamilyAutoPlannerDocumentV1,
    expectedRevision: number,
  ): Promise<FamilyAutoPlannerStoreSave> {
    try {
      return await (await this.#get()).save(scope, document, expectedRevision)
    } catch (error) {
      return { status: 'unavailable', reason: error instanceof Error ? error.message : 'Auto Planner storage is unavailable.' }
    }
  }

  close(): void {
    void this.#store?.then((store) => store.close()).catch(() => undefined)
  }
}

function completedOnLocalDate(
  completedAt: string | null,
  localDate: string,
  timeZone: string | null,
): boolean {
  if (!completedAt || !timeZone) return false
  const instant = new Date(completedAt)
  return Number.isFinite(instant.getTime()) && schoolLocalDate(instant, timeZone) === localDate
}

/**
 * Final Family Pilot orchestration seam. The accepted planner owns selection;
 * the accepted controller remains the only assignment, assessment, and Study
 * authority. No planner policy reaches React presentation components.
 */
export class FinalFamilyAutoPlannerHost {
  readonly #controller: FinalFamilyPilotController
  readonly #store: FamilyAutoPlannerStorePort
  readonly #lazyStore: LazyPlannerStore | null
  readonly #dashboard: FamilyAutoPlannerDashboardPort
  readonly #now: () => Date

  constructor(controller: FinalFamilyPilotController, options: FinalFamilyAutoPlannerHostOptions = {}) {
    this.#controller = controller
    const lazyStore = options.store ? null : new LazyPlannerStore(options.openStore ?? openFamilyAutoPlannerIndexedDbStore)
    this.#lazyStore = lazyStore
    this.#store = options.store ?? lazyStore as LazyPlannerStore
    this.#now = options.now ?? (() => new Date())

    const planner = new FamilyAutoPlanner({
      store: this.#store,
      catalog: autoPlannerCatalogFromFinalRuntime(controller.catalog.runtime),
      learners: {
        read: async (scope) => {
          if (scope.householdRef !== controller.appSnapshot.state.householdRef) return null
          const student = controller.appSnapshot.state.setup.students.find((item) => item.studentRef === scope.learnerRef)
          return student ? learnerFromFamilySetup(student, controller.coursesFor(student).map((course) => course.courseRef)) : null
        },
      },
      assignments: {
        list: async (scope) => assignmentFactsFromFamilyPilotCore(controller.coreSnapshot.state, scope.learnerRef),
        materializeLesson: async (scope, intent) => {
          await controller.assignLesson(scope.learnerRef, intent.lesson.lessonRef)
          const fact = assignmentFactsFromFamilyPilotCore(controller.coreSnapshot.state, scope.learnerRef)
            .find((item) => item.lessonRef === intent.lesson.lessonRef)
          if (!fact) throw new Error('The existing assignment authority did not retain the automatic lesson.')
          return fact
        },
      },
      assessments: {
        list: async (scope) => assessmentFactsFromFinalFamilyPilot(controller.assessmentAssignments(scope.learnerRef), scope.learnerRef),
        materializeAssessment: async (scope, intent) => {
          await controller.assignAssessment(scope.learnerRef, intent.assessmentRef)
          const fact = assessmentFactsFromFinalFamilyPilot(controller.assessmentAssignments(scope.learnerRef), scope.learnerRef)
            .find((item) => item.assessmentRef === intent.assessmentRef)
          if (!fact) throw new Error('The existing assessment authority did not retain the automatic assessment.')
          return fact
        },
      },
      holds: {
        list: async (scope) => holdFactsFromFamilyPilotSafety(controller.appSnapshot.state.safety, scope.learnerRef),
      },
    }, this.#now)
    this.#dashboard = createFamilyAutoPlannerDashboardPort(planner)
    this.configure = planner.configure.bind(planner)
  }

  scope(learnerRef: string): FamilyAutoPlannerScope {
    return Object.freeze({
      householdRef: this.#controller.appSnapshot.state.householdRef,
      learnerRef,
    })
  }

  readonly configure: (
    scope: FamilyAutoPlannerScope,
    plan: FamilyAutoPlannerSchoolPlanV1,
  ) => Promise<ConfigureFamilyAutoPlannerResult>

  async loadDocument(learnerRef: string): Promise<FamilyAutoPlannerStoreLoad> {
    return this.#store.load(this.scope(learnerRef))
  }

  async dashboardFor(learnerRef: string, instant?: Date): Promise<FinalFamilyAutoPlannerDashboardResult> {
    const scope = this.scope(learnerRef)
    const plan = await this.#dashboard.getTodayWork(scope, instant)
    return Object.freeze({ plan, schedule: await this.#schedule(plan) })
  }

  async courseViewFor(
    learnerRef: string,
    courseRef: string,
    today: FamilyAutoPlannerTodayPlan,
  ): Promise<FinalLearnerCourseView> {
    const student = this.#controller.appSnapshot.state.setup.students.find((item) => item.studentRef === learnerRef)
    const course = student ? this.#controller.coursesFor(student).find((item) => item.courseRef === courseRef) : null
    if (!student || !course) throw new Error('That course is unavailable for this learner.')
    const loaded = await this.#store.load(this.scope(learnerRef))
    if (loaded.status !== 'ready') throw new Error('The learner School Plan is unavailable on this device.')
    const lessons = await this.#controller.catalog.runtime.listLessons(courseRef)
    const units = this.#controller.catalog.runtime.listUnits(courseRef)
    const assignments = assignmentFactsFromFamilyPilotCore(this.#controller.coreSnapshot.state, learnerRef)
    const assessments = assessmentFactsFromFinalFamilyPilot(this.#controller.assessmentAssignments(learnerRef), learnerRef)
    const holds = holdFactsFromFamilyPilotSafety(this.#controller.appSnapshot.state.safety, learnerRef)
    const pendingGuardianAssignmentRefs = new Set(this.#controller.appSnapshot.state.attestations
      .filter((item) => item.studentRef === learnerRef && item.status === 'PENDING_GUARDIAN_ATTESTATION')
      .map((item) => item.assignmentRef))
    const next = resolveFamilyCourseNextEligible({
      learnerRef,
      bundle: Object.freeze({ course, units: Object.freeze([...units]), lessons: Object.freeze([...lessons]) }),
      assignments,
      assessments,
      holds,
      pendingGuardianAssignmentRefs,
    })
    const lessonRefs = new Set(lessons.map((item) => item.lessonRef))
    const courseAssignments = assignments.filter((item) => lessonRefs.has(item.lessonRef))
    const completedLessons = new Set(courseAssignments
      .filter((item) => item.state === 'completed').map((item) => item.lessonRef)).size
    const required = today.items.find((item) =>
      item.kind === 'LESSON' && item.subject === course.subject &&
      (item.courseRef === null || item.courseRef === courseRef))
    const plan = loaded.document.schoolPlan
    const subjectPlan = plan?.subjects.find((item) => item.subject === course.subject)
    const provenanceByAssignment = new Map(loaded.document.materializations.map((item) => [item.assignmentRef, item]))
    const completedToday = courseAssignments.some((assignment) => {
      if (assignment.state !== 'completed' ||
        !completedOnLocalDate(assignment.completedAt, today.localDate, today.householdTimeZone)) return false
      const materialized = provenanceByAssignment.get(assignment.assignmentRef)
      return materialized?.provenance !== 'LEARNER_WORK_AHEAD' || materialized.localDate < today.localDate &&
        Boolean(plan && familyAutoPlannerSubjectScheduled(plan, course.subject, today.localDate))
    })
    const workAheadAllowed = Boolean(plan && familyAutoPlannerAllowsWorkAhead(plan) && !subjectPlan?.paused)
    const todayStatus: FinalLearnerCourseView['todayStatus'] = required
      ? 'REQUIRED_TODAY'
      : completedToday
        ? 'TODAY_COMPLETE'
        : today.status === 'NO_SCHOOL_TODAY'
          ? 'NO_SCHOOL_TODAY'
          : 'NOT_REQUIRED_TODAY'
    const currentPosition = next.status === 'LESSON'
      ? `Lesson ${next.lesson.courseDay} of ${lessons.length}`
      : next.gate === 'COURSE_COMPLETE'
        ? 'Course complete'
        : next.title

    if (required?.lessonRef) {
      const fact = assignments.find((item) => item.assignmentRef === required.assignmentRef)
      const lesson = lessons.find((item) => item.lessonRef === required.lessonRef)
      const sourceReady = lesson?.sourceReadiness.state !== 'dynamic' || Boolean(fact &&
        this.#controller.appSnapshot.state.sourceAttachments.some((item) =>
          item.studentRef === learnerRef && item.assignmentRef === fact.assignmentRef &&
          item.lessonRef === fact.lessonRef && item.status === 'ATTACHED_SATISFIED'))
      const held = Boolean(fact?.sessionRef && holds.some((item) =>
        item.learnerRef === learnerRef && item.sessionRef === fact.sessionRef && item.status !== 'cleared'))
      const gate: FinalLearnerCourseView['gate'] = held || required.blockedReason === 'SAFETY_HOLD'
        ? Object.freeze({ kind: 'SAFETY_HOLD', message: courseGateMessage('SAFETY_HOLD') })
        : fact && pendingGuardianAssignmentRefs.has(fact.assignmentRef)
          ? Object.freeze({ kind: 'GUARDIAN_CERTIFICATION', message: courseGateMessage('GUARDIAN_CERTIFICATION') })
          : !sourceReady
            ? Object.freeze({ kind: 'PREREQUISITE', message: 'A parent must attach the approved source before this lesson can open.' })
            : null
      return Object.freeze({
        courseRef, courseTitle: course.title, subject: course.subject,
        workingGrade: String(course.grade) as AcademyGrade,
        completedLessons, totalLessons: lessons.length, currentPosition, todayStatus,
        workAheadAllowed, next: fact ? Object.freeze({
          lessonRef: fact.lessonRef, title: fact.title, assignmentRef: fact.assignmentRef, state: fact.state,
        }) : null,
        gate,
        action: fact && !gate ? Object.freeze({
          type: 'OPEN_ASSIGNMENT',
          label: fact.state === 'planned' ? `Start today's lesson: ${fact.title}` : `Continue today's lesson: ${fact.title}`,
          assignmentRef: fact.assignmentRef, lessonRef: fact.lessonRef,
        }) : null,
      })
    }

    if (next.status === 'GATED') {
      return Object.freeze({
        courseRef, courseTitle: course.title, subject: course.subject,
        workingGrade: String(course.grade) as AcademyGrade,
        completedLessons, totalLessons: lessons.length, currentPosition, todayStatus,
        workAheadAllowed, next: null,
        gate: Object.freeze({ kind: next.gate, message: courseGateMessage(next.gate) }),
        action: null,
      })
    }

    const assignment = next.assignment
    const canOpenExisting = Boolean(assignment)
    const existingIsWorkAhead = Boolean(assignment &&
      provenanceByAssignment.get(assignment.assignmentRef)?.provenance === 'LEARNER_WORK_AHEAD')
    const existingAuthorized = canOpenExisting && (!existingIsWorkAhead || workAheadAllowed)
    const sourceReady = next.lesson.sourceReadiness.state !== 'dynamic' || Boolean(assignment &&
      this.#controller.appSnapshot.state.sourceAttachments.some((item) =>
        item.studentRef === learnerRef && item.assignmentRef === assignment.assignmentRef &&
        item.lessonRef === next.lesson.lessonRef && item.status === 'ATTACHED_SATISFIED'))
    return Object.freeze({
      courseRef, courseTitle: course.title, subject: course.subject,
      workingGrade: String(course.grade) as AcademyGrade,
      completedLessons, totalLessons: lessons.length, currentPosition, todayStatus,
      workAheadAllowed,
      next: Object.freeze({
        lessonRef: next.lesson.lessonRef, title: next.lesson.title,
        assignmentRef: assignment?.assignmentRef ?? null, state: assignment?.state ?? null,
      }),
      gate: !sourceReady
        ? Object.freeze({ kind: 'PREREQUISITE' as const, message: 'A parent must attach the approved source before this lesson can open.' })
        : !workAheadAllowed && (!canOpenExisting || existingIsWorkAhead)
        ? Object.freeze({ kind: 'PREREQUISITE' as const, message: 'You’re caught up. Your next lesson will appear according to your School Plan.' })
        : null,
      action: !sourceReady ? null : existingAuthorized ? Object.freeze({
        type: 'OPEN_ASSIGNMENT' as const,
        label: assignment!.state === 'planned' ? `Start ${assignment!.title}` : `Continue ${assignment!.title}`,
        assignmentRef: assignment!.assignmentRef, lessonRef: assignment!.lessonRef,
      }) : workAheadAllowed ? Object.freeze({
        type: 'START_WORK_AHEAD' as const,
        label: `Work ahead: start ${next.lesson.title}`,
        assignmentRef: null, lessonRef: next.lesson.lessonRef,
      }) : null,
    })
  }

  async startWorkAhead(learnerRef: string, courseRef: string, lessonRef: string): Promise<string> {
    const scope = this.scope(learnerRef)
    const student = this.#controller.appSnapshot.state.setup.students.find((item) => item.studentRef === learnerRef)
    const course = student ? this.#controller.coursesFor(student).find((item) => item.courseRef === courseRef) : null
    if (!student || !course) throw new Error('That course is unavailable for this learner.')
    const loaded = await this.#store.load(scope)
    if (loaded.status !== 'ready' || !loaded.document.schoolPlan) throw new Error('A Parent School Plan is required before working ahead.')
    const plan = loaded.document.schoolPlan
    const subjectPlan = plan.subjects.find((item) => item.subject === course.subject)
    if (!familyAutoPlannerAllowsWorkAhead(plan) || subjectPlan?.paused) throw new Error('Work ahead is not enabled for this learner.')
    const lessons = await this.#controller.catalog.runtime.listLessons(courseRef)
    const next = resolveFamilyCourseNextEligible({
      learnerRef,
      bundle: Object.freeze({ course, units: this.#controller.catalog.runtime.listUnits(courseRef), lessons }),
      assignments: assignmentFactsFromFamilyPilotCore(this.#controller.coreSnapshot.state, learnerRef),
      assessments: assessmentFactsFromFinalFamilyPilot(this.#controller.assessmentAssignments(learnerRef), learnerRef),
      holds: holdFactsFromFamilyPilotSafety(this.#controller.appSnapshot.state.safety, learnerRef),
      pendingGuardianAssignmentRefs: new Set(this.#controller.appSnapshot.state.attestations
        .filter((item) => item.studentRef === learnerRef && item.status === 'PENDING_GUARDIAN_ATTESTATION')
        .map((item) => item.assignmentRef)),
    })
    if (next.status !== 'LESSON' || next.lesson.lessonRef !== lessonRef) {
      throw new Error(next.status === 'GATED' ? courseGateMessage(next.gate) : 'The next eligible lesson changed. Reopen the course and try again.')
    }
    if (next.lesson.sourceReadiness.state === 'dynamic') {
      throw new Error('A parent must prepare this lesson’s approved source before it can be started as work ahead.')
    }
    if (next.assignment) return next.assignment.assignmentRef
    const assignment = await this.#controller.assignLesson(learnerRef, lessonRef)
    const now = this.#now()
    const entry = Object.freeze({
      materializationRef: learnerWorkAheadMaterializationRef(course.subject, lessonRef),
      kind: 'LESSON' as const,
      localDate: schoolLocalDate(now, plan.householdTimeZone),
      subject: course.subject,
      workingGrade: String(course.grade) as AcademyGrade,
      courseRef, unitRef: next.unitRef, itemRef: lessonRef,
      assignmentRef: assignment.assignmentRef, title: assignment.title,
      createdAt: now.toISOString(), provenance: 'LEARNER_WORK_AHEAD' as const,
    })
    let current = loaded.document
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = current.materializations.find((item) =>
        item.assignmentRef === assignment.assignmentRef || item.materializationRef === entry.materializationRef)
      if (existing) return assignment.assignmentRef
      const candidate: FamilyAutoPlannerDocumentV1 = Object.freeze({
        ...current,
        revision: current.revision + 1,
        updatedAt: entry.createdAt,
        materializations: Object.freeze([...current.materializations, entry]),
      })
      const saved = await this.#store.save(scope, candidate, current.revision)
      if (saved.status === 'saved') return assignment.assignmentRef
      if (saved.status !== 'conflict') throw new Error('Work-ahead authorization could not be saved safely.')
      const reloaded = await this.#store.load(scope)
      if (reloaded.status !== 'ready') throw new Error('Work-ahead authorization could not be reloaded safely.')
      current = reloaded.document
    }
    throw new Error('Another device changed this School Plan repeatedly. Reopen the course and try again.')
  }

  close(): void {
    this.#lazyStore?.close()
  }

  async #schedule(plan: FamilyAutoPlannerTodayPlan): Promise<readonly ScheduleItemV1[]> {
    if (plan.status === 'NO_SCHOOL_TODAY') return Object.freeze([])

    const scope = plan.scope
    const coreStudent = this.#controller.coreSnapshot.state.students.find((item) => item.studentRef === scope.learnerRef)
    const assignments = coreStudent?.assignments ?? Object.freeze([])

    // Parent-created work remains a usable explicit override even before the
    // one-time automatic School Plan is configured. This does not choose or
    // create normal curriculum work; it only projects existing Core authority.
    if (plan.status === 'NEEDS_PLAN_SETUP') {
      const manualLessons = assignments.filter((item) =>
        ['planned', 'active', 'paused'].includes(item.state) ||
        (item.state === 'completed' && item.completedAt?.slice(0, 10) === plan.localDate))
      const lessonSchedule = buildDailySchedule({
        studentRef: scope.learnerRef,
        date: plan.localDate,
        items: manualLessons.map((item) => Object.freeze({
          kind: 'assignment' as const,
          assignmentRef: item.assignmentRef,
          lessonRef: item.lessonRef,
          title: item.title,
          state: item.state,
        })),
      })
      const assessmentSchedule = this.#controller.assessmentAssignments(scope.learnerRef)
        .filter((item) => item.status !== 'CERTIFIED' || item.completedAt?.slice(0, 10) === plan.localDate)
        .map((item, index): ScheduleItemV1 => Object.freeze({
          scheduleItemRef: `schedule|${scope.learnerRef}|${plan.localDate}|${item.assignmentRef}`,
          studentRef: scope.learnerRef,
          date: plan.localDate,
          title: item.title,
          kind: 'assignment',
          order: lessonSchedule.length + index,
          status: item.status === 'CERTIFIED' ? 'completed' : item.status === 'PLANNED' ? 'pending' : 'in-progress',
          assignmentRef: item.assignmentRef,
          lessonRef: null,
        }))
      return Object.freeze([...lessonSchedule, ...assessmentSchedule])
    }

    const loaded = await this.#store.load(scope)
    const provenance = loaded.status === 'ready'
      ? loaded.document.materializations.filter((item) => item.localDate === plan.localDate)
      : []
    const allProvenance = loaded.status === 'ready' ? loaded.document.materializations : []
    const provenanceByAssignment = new Map(allProvenance.map((item) => [item.assignmentRef, item]))
    const selectedRefs = new Set([
      ...plan.items.map((item) => item.assignmentRef),
      ...provenance.filter((item) => item.provenance !== 'LEARNER_WORK_AHEAD').map((item) => item.assignmentRef),
    ])
    // A required manual assignment completed on this school-local date counts as
    // today's override in the accepted planner, so retain it in Today's Work.
    for (const assignment of assignments) {
      if (assignment.state === 'completed' && completedOnLocalDate(assignment.completedAt, plan.localDate, plan.householdTimeZone)) {
        const materialized = provenanceByAssignment.get(assignment.assignmentRef)
        const adoptedWorkAhead = materialized?.provenance === 'LEARNER_WORK_AHEAD' &&
          materialized.localDate < plan.localDate && loaded.status === 'ready' && Boolean(loaded.document.schoolPlan) &&
          familyAutoPlannerSubjectScheduled(loaded.document.schoolPlan!, materialized.subject, plan.localDate)
        if (materialized?.provenance !== 'LEARNER_WORK_AHEAD' || adoptedWorkAhead) {
          selectedRefs.add(assignment.assignmentRef)
        }
      }
    }

    const base = toExistingDailyScheduleInput(plan)
    const already = new Set(base.items.flatMap((item) => item.kind === 'assignment' ? [item.assignmentRef] : []))
    const completedLessons = assignments.filter((item) => selectedRefs.has(item.assignmentRef) && !already.has(item.assignmentRef))
    const lessonSchedule = buildDailySchedule({
      ...base,
      items: Object.freeze([
        ...base.items,
        ...completedLessons.map((item: FamilyPilotAssignmentRecordV1) => Object.freeze({
          kind: 'assignment' as const,
          assignmentRef: item.assignmentRef,
          lessonRef: item.lessonRef,
          title: item.title,
          state: item.state,
        })),
      ]),
    })

    const assessmentSchedule: ScheduleItemV1[] = []
    for (const assessment of this.#controller.assessmentAssignments(scope.learnerRef)) {
      if (!selectedRefs.has(assessment.assignmentRef)) continue
      assessmentSchedule.push(Object.freeze({
        scheduleItemRef: `schedule|${scope.learnerRef}|${plan.localDate}|${assessment.assignmentRef}`,
        studentRef: scope.learnerRef,
        date: plan.localDate,
        title: assessment.title,
        kind: 'assignment',
        order: lessonSchedule.length + assessmentSchedule.length,
        status: assessment.status === 'CERTIFIED' ? 'completed' : assessment.status === 'PLANNED' ? 'pending' : 'in-progress',
        assignmentRef: assessment.assignmentRef,
        lessonRef: null,
      }))
    }
    return Object.freeze([...lessonSchedule, ...assessmentSchedule])
  }
}

function courseGateMessage(gate: FamilyCourseGate): string {
  if (gate === 'SAFETY_HOLD') return 'Please get a parent before continuing this course.'
  if (gate === 'ASSESSMENT_REQUIRED') return 'The next course step is a required assessment. It must appear through the School Plan or Parent assignment authority.'
  if (gate === 'PENDING_ASSESSMENT') return 'This course is waiting for assessment scoring.'
  if (gate === 'PARENT_REVIEW') return 'This course is waiting for Parent review.'
  if (gate === 'GUARDIAN_CERTIFICATION') return 'This course is waiting for guardian certification.'
  if (gate === 'COURSE_COMPLETE') return 'Course complete. A parent chooses what course comes next.'
  if (gate === 'COURSE_UNAVAILABLE') return 'The next course item is unavailable.'
  return 'The next lesson is waiting for its prerequisite.'
}

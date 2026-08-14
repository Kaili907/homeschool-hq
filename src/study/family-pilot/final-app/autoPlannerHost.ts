import type { FamilyPilotAssignmentRecordV1 } from '../core'
import { buildDailySchedule, type ScheduleItemV1 } from '../schedule'
import {
  FamilyAutoPlanner,
  assessmentFactsFromFinalFamilyPilot,
  assignmentFactsFromFamilyPilotCore,
  autoPlannerCatalogFromFinalRuntime,
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

  constructor(controller: FinalFamilyPilotController, options: FinalFamilyAutoPlannerHostOptions = {}) {
    this.#controller = controller
    const lazyStore = options.store ? null : new LazyPlannerStore(options.openStore ?? openFamilyAutoPlannerIndexedDbStore)
    this.#lazyStore = lazyStore
    this.#store = options.store ?? lazyStore as LazyPlannerStore

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
    }, options.now)
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
    const selectedRefs = new Set([
      ...plan.items.map((item) => item.assignmentRef),
      ...provenance.map((item) => item.assignmentRef),
    ])
    // A required manual assignment completed on this school-local date counts as
    // today's override in the accepted planner, so retain it in Today's Work.
    for (const assignment of assignments) {
      if (assignment.state === 'completed' && completedOnLocalDate(assignment.completedAt, plan.localDate, plan.householdTimeZone)) {
        selectedRefs.add(assignment.assignmentRef)
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

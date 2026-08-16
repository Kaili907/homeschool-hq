import type { AcademyGrade } from '../../../types'
import { autoPlannerMaterializationRef, computeFamilyAutoPlanner, emptyFamilyAutoPlannerDocument, validateFamilyAutoPlannerSchoolPlan } from './plan'
import type { FamilyAutoPlannerPorts } from './ports'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerBlocker,
  FamilyAutoPlannerCourseBundle,
  FamilyAutoPlannerDocumentV1,
  FamilyAutoPlannerHoldFact,
  FamilyAutoPlannerLearner,
  FamilyAutoPlannerMaterializationIntent,
  FamilyAutoPlannerMaterializationV1,
  FamilyAutoPlannerReason,
  FamilyAutoPlannerSchoolPlanV1,
  FamilyAutoPlannerScope,
  FamilyAutoPlannerTodayPlan,
} from './types'

export type ConfigureFamilyAutoPlannerResult =
  | { readonly status: 'saved'; readonly document: FamilyAutoPlannerDocumentV1 }
  | { readonly status: 'rejected'; readonly reason: FamilyAutoPlannerReason }

function failurePlan(
  scope: FamilyAutoPlannerScope,
  instant: Date,
  reason: FamilyAutoPlannerReason,
  detail: string,
): FamilyAutoPlannerTodayPlan {
  const blocker: FamilyAutoPlannerBlocker = Object.freeze({ reason, subject: null, detail })
  return Object.freeze({
    status: 'BLOCKED',
    reason,
    scope: Object.freeze({ ...scope }),
    householdTimeZone: null,
    localDate: instant.toISOString().slice(0, 10),
    generatedAt: instant.toISOString(),
    items: Object.freeze([]),
    blockers: Object.freeze([blocker]),
    completedCourses: Object.freeze([]),
    manualOverrideActive: false,
    offlineMaterializedWorkAvailable: false,
  })
}

function appendBlockers(
  plan: FamilyAutoPlannerTodayPlan,
  added: readonly FamilyAutoPlannerBlocker[],
): FamilyAutoPlannerTodayPlan {
  if (!added.length) return plan
  const usable = plan.items.some((item) => item.state !== 'BLOCKED' && item.state !== 'WAITING')
  return Object.freeze({
    ...plan,
    status: usable ? plan.status : 'BLOCKED',
    reason: usable && plan.reason === 'NONE' ? added[0].reason : plan.reason === 'NONE' ? added[0].reason : plan.reason,
    blockers: Object.freeze([...plan.blockers, ...added]),
  })
}

function materialization(
  intent: FamilyAutoPlannerMaterializationIntent,
  assignmentRef: string,
  createdAt: string,
): FamilyAutoPlannerMaterializationV1 {
  return Object.freeze({
    materializationRef: autoPlannerMaterializationRef(intent),
    kind: intent.kind,
    localDate: intent.localDate,
    subject: intent.subject,
    workingGrade: intent.workingGrade,
    courseRef: intent.courseRef,
    unitRef: intent.unitRef,
    itemRef: intent.kind === 'LESSON' ? intent.lesson.lessonRef : intent.assessmentRef,
    assignmentRef,
    title: intent.kind === 'LESSON' ? intent.lesson.title : intent.title,
    createdAt,
    provenance: 'AUTO_PLANNER',
  })
}

/** Production orchestrator over existing authorities. It selects; the provided
 * Core and assessment ports materialize; the Study Engine remains untouched. */
export class FamilyAutoPlanner {
  readonly #ports: FamilyAutoPlannerPorts
  readonly #now: () => Date

  constructor(ports: FamilyAutoPlannerPorts, now: () => Date = () => new Date()) {
    this.#ports = ports
    this.#now = now
  }

  async configure(
    scope: FamilyAutoPlannerScope,
    schoolPlan: FamilyAutoPlannerSchoolPlanV1,
  ): Promise<ConfigureFamilyAutoPlannerResult> {
    if (!validateFamilyAutoPlannerSchoolPlan(schoolPlan)) return { status: 'rejected', reason: 'SCHOOL_PLAN_INVALID' }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let loaded
      try {
        loaded = await this.#ports.store.load(scope)
      } catch {
        return { status: 'rejected', reason: 'PERSISTENCE_UNAVAILABLE' }
      }
      if (loaded.status !== 'ready') {
        return { status: 'rejected', reason: loaded.status === 'read-only' ? 'PERSISTENCE_READ_ONLY' : 'PERSISTENCE_UNAVAILABLE' }
      }
      const now = this.#now().toISOString()
      const candidate: FamilyAutoPlannerDocumentV1 = Object.freeze({
        ...loaded.document,
        revision: loaded.document.revision + 1,
        updatedAt: now,
        schoolPlan: Object.freeze({
          ...schoolPlan,
          configuredAt: loaded.document.schoolPlan?.configuredAt ?? schoolPlan.configuredAt,
          updatedAt: now,
        }),
      })
      let saved
      try {
        saved = await this.#ports.store.save(scope, candidate, loaded.document.revision)
      } catch {
        return { status: 'rejected', reason: 'PERSISTENCE_UNAVAILABLE' }
      }
      if (saved.status === 'saved') return saved
      if (saved.status !== 'conflict') {
        return { status: 'rejected', reason: saved.status === 'read-only' ? 'PERSISTENCE_READ_ONLY' : 'PERSISTENCE_UNAVAILABLE' }
      }
    }
    return { status: 'rejected', reason: 'CONCURRENT_UPDATE' }
  }

  async today(scope: FamilyAutoPlannerScope, instant = this.#now()): Promise<FamilyAutoPlannerTodayPlan> {
    let loaded
    try {
      loaded = await this.#ports.store.load(scope)
    } catch {
      return failurePlan(scope, instant, 'PERSISTENCE_UNAVAILABLE', 'Auto Planner storage could not be read on this device.')
    }
    if (loaded.status !== 'ready') {
      return failurePlan(
        scope,
        instant,
        loaded.status === 'read-only' ? 'PERSISTENCE_READ_ONLY' : 'PERSISTENCE_UNAVAILABLE',
        loaded.status === 'read-only'
          ? 'Auto Planner data was written by a newer app and is read-only.'
          : 'Auto Planner storage is unavailable on this device.',
      )
    }
    if (loaded.document.scope.householdRef !== scope.householdRef || loaded.document.scope.learnerRef !== scope.learnerRef) {
      return failurePlan(scope, instant, 'PERSISTENCE_READ_ONLY', 'Auto Planner storage returned a document for a different learner scope.')
    }
    let document = loaded.document
    let learner: FamilyAutoPlannerLearner | null
    let assignments: readonly FamilyAutoPlannerAssignmentFact[]
    let assessments: readonly FamilyAutoPlannerAssessmentFact[]
    let holds: readonly FamilyAutoPlannerHoldFact[]
    try {
      const facts = await Promise.all([
        this.#ports.learners.read(scope),
        this.#ports.assignments.list(scope),
        this.#ports.assessments.list(scope),
        this.#ports.holds.list(scope),
      ])
      learner = facts[0]
      assignments = facts[1]
      assessments = facts[2]
      holds = facts[3]
    } catch {
      return failurePlan(scope, instant, 'PERSISTENCE_UNAVAILABLE', 'Existing learner, assignment, assessment, or safety facts could not be read safely.')
    }

    let catalog: readonly FamilyAutoPlannerCourseBundle[] | null = null
    if (document.schoolPlan && learner) {
      try {
        const admittedGrades = new Set(this.#ports.catalog.listGrades())
        const grades = new Set<AcademyGrade>()
        for (const subject of learner.enabledSubjects) {
          const grade = learner.workingGradeBySubject[subject] ?? learner.nominalGrade
          if (admittedGrades.has(grade as AcademyGrade)) grades.add(grade as AcademyGrade)
        }
        const courses = [...grades].flatMap((grade) => this.#ports.catalog.listCourses(grade))
        catalog = Object.freeze(await Promise.all(courses.map(async (course): Promise<FamilyAutoPlannerCourseBundle> => Object.freeze({
          course,
          units: Object.freeze([...this.#ports.catalog.listUnits(course.courseRef)]),
          lessons: Object.freeze([...(await this.#ports.catalog.listLessons(course.courseRef))]),
        }))))
      } catch {
        // Explicit null is an input fact. The pure planner decides whether any
        // already-materialized work remains safe to use offline.
        catalog = null
      }
    }

    let assignmentFacts = [...assignments]
    let assessmentFacts = [...assessments]
    let computed = computeFamilyAutoPlanner({ scope, instant, document, learner, assignments: assignmentFacts, assessments: assessmentFacts, holds, catalog })
    const failures: FamilyAutoPlannerBlocker[] = []

    for (const intent of computed.intents) {
      try {
        if (intent.kind === 'LESSON') {
          const created = await this.#ports.assignments.materializeLesson(scope, intent)
          if (created.learnerRef !== scope.learnerRef || created.lessonRef !== intent.lesson.lessonRef || created.subject !== intent.subject) {
            throw new Error('Existing assignment authority returned a mismatched learner or lesson binding.')
          }
          assignmentFacts = replaceFact(assignmentFacts, created)
          const persisted = await this.#persistMaterialization(scope, document, materialization(intent, created.assignmentRef, instant.toISOString()))
          document = persisted.document
          if (persisted.blocker) failures.push(persisted.blocker)
        } else {
          const created = await this.#ports.assessments.materializeAssessment(scope, intent)
          if (created.learnerRef !== scope.learnerRef || created.assessmentRef !== intent.assessmentRef || created.subject !== intent.subject) {
            throw new Error('Existing assessment authority returned a mismatched learner or assessment binding.')
          }
          assessmentFacts = replaceAssessmentFact(assessmentFacts, created)
          const persisted = await this.#persistMaterialization(scope, document, materialization(intent, created.assignmentRef, instant.toISOString()))
          document = persisted.document
          if (persisted.blocker) failures.push(persisted.blocker)
        }
      } catch (error) {
        const reason = intent.kind === 'LESSON' ? 'ASSIGNMENT_MATERIALIZATION_FAILED' : 'ASSESSMENT_MATERIALIZATION_FAILED'
        failures.push(Object.freeze({
          reason,
          subject: intent.subject,
          detail: error instanceof Error ? error.message : 'Existing assignment authority refused automatic materialization.',
        }))
      }
    }

    computed = computeFamilyAutoPlanner({ scope, instant, document, learner, assignments: assignmentFacts, assessments: assessmentFacts, holds, catalog })
    return appendBlockers(computed.plan, failures)
  }

  async #persistMaterialization(
    scope: FamilyAutoPlannerScope,
    starting: FamilyAutoPlannerDocumentV1,
    entry: FamilyAutoPlannerMaterializationV1,
  ): Promise<{ readonly document: FamilyAutoPlannerDocumentV1; readonly blocker: FamilyAutoPlannerBlocker | null }> {
    let current = starting
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const already = current.materializations.find((held) => held.materializationRef === entry.materializationRef)
      if (already) return { document: current, blocker: null }
      const candidate: FamilyAutoPlannerDocumentV1 = Object.freeze({
        ...current,
        revision: current.revision + 1,
        updatedAt: entry.createdAt,
        materializations: Object.freeze([...current.materializations, entry]),
      })
      const saved = await this.#ports.store.save(scope, candidate, current.revision)
      if (saved.status === 'saved') return { document: saved.document, blocker: null }
      if (saved.status !== 'conflict') {
        return {
          document: current,
          blocker: Object.freeze({
            reason: saved.status === 'read-only' ? 'PERSISTENCE_READ_ONLY' : 'PERSISTENCE_UNAVAILABLE',
            subject: entry.subject,
            detail: 'The assignment exists, but automatic provenance could not be saved. It remains visible as a manual override.',
          }),
        }
      }
      const reloaded = await this.#ports.store.load(scope)
      if (reloaded.status !== 'ready') break
      current = reloaded.document
    }
    return {
      document: current,
      blocker: Object.freeze({
        reason: 'CONCURRENT_UPDATE',
        subject: entry.subject,
        detail: 'Another tab changed this learner plan repeatedly; the existing assignment was preserved.',
      }),
    }
  }
}

function replaceFact(
  facts: readonly FamilyAutoPlannerAssignmentFact[],
  created: FamilyAutoPlannerAssignmentFact,
): FamilyAutoPlannerAssignmentFact[] {
  return [...facts.filter((fact) => fact.assignmentRef !== created.assignmentRef), created]
}

function replaceAssessmentFact(
  facts: readonly FamilyAutoPlannerAssessmentFact[],
  created: FamilyAutoPlannerAssessmentFact,
): FamilyAutoPlannerAssessmentFact[] {
  return [...facts.filter((fact) => fact.assignmentRef !== created.assignmentRef), created]
}

/** Small helper for tests and hosts that want a new scoped document before a
 * configured plan exists; production IndexedDB creates the same value. */
export function newFamilyAutoPlannerDocument(scope: FamilyAutoPlannerScope, now: string): FamilyAutoPlannerDocumentV1 {
  return emptyFamilyAutoPlannerDocument(scope, now)
}

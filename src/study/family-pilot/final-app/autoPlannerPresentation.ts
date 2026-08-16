import type { FamilyPilotStudentDashboardModel } from '../dashboard-adapter'
import type { FamilyAutoPlannerReason, FamilyAutoPlannerTodayPlan } from '../auto-planner'
import type {
  StudentDashboardDayStatus,
  StudentDashboardMissionState,
  StudentDashboardModel,
} from '../student-dashboard'

const PARENT_WAIT_REASONS = new Set<FamilyAutoPlannerReason>([
  'ASSESSMENT_REVIEW_REQUIRED',
  'ASSESSMENT_GUARDIAN_REQUIRED',
])
const SCORING_WAIT_REASONS = new Set<FamilyAutoPlannerReason>(['ASSESSMENT_PENDING'])

interface RequiredItemFact {
  readonly ref: string
  completed: boolean
  waitingOnParent: boolean
  waitingForScoring: boolean
  assessment: boolean
  carriedForward: boolean
}

function itemLabel(count: number): string {
  return `${count} required ${count === 1 ? 'item' : 'items'}`
}

function formatLocalDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric',
  }).format(parsed)
}

function appendSentence(first: string | undefined, second: string): string {
  if (!second) return first ?? ''
  return first ? `${first} ${second}` : second
}

function plannerBlockedLabel(reason: FamilyAutoPlannerReason | null): string {
  if (reason === 'SUBJECT_PAUSED') return 'Paused in your School Plan'
  if (reason === 'SAFETY_HOLD') return 'Waiting for a grown-up safety check'
  if (PARENT_WAIT_REASONS.has(reason ?? 'NONE')) return 'Waiting for Parent review'
  if (SCORING_WAIT_REASONS.has(reason ?? 'NONE')) return 'Waiting for trusted scoring'
  return 'This required work needs attention'
}

function requiredFacts(
  model: StudentDashboardModel,
  plan: FamilyAutoPlannerTodayPlan,
  authority?: Pick<FamilyPilotStudentDashboardModel, 'today'>,
): {
  readonly facts: readonly RequiredItemFact[]
  readonly requiredCount: number
  readonly completedCount: number
  readonly remainingCount: number
  readonly omittedCount: number
} {
  const facts = new Map<string, RequiredItemFact>()
  if (authority) {
    for (const item of authority.today.items) {
      if (item.kind === 'BREAK') continue
      facts.set(item.assignmentRef ?? item.scheduleItemRef, {
        ref: item.assignmentRef ?? item.scheduleItemRef,
        completed: item.status === 'COMPLETED',
        waitingOnParent: item.blocked?.kind === 'GUARDIAN_PENDING' || item.blocked?.kind === 'ADULT_REVIEW_REQUIRED',
        waitingForScoring: item.blocked?.kind === 'ASSESSMENT_SCORING_PENDING',
        assessment: item.kind === 'ASSESSMENT',
        carriedForward: false,
      })
    }
  } else {
    for (const item of model.todayItems) {
      facts.set(item.workRef, {
        ref: item.workRef,
        completed: item.state === 'complete',
        waitingOnParent: false,
        waitingForScoring: false,
        assessment: false,
        carriedForward: false,
      })
    }
  }

  for (const item of plan.items) {
    const existing = facts.get(item.assignmentRef)
    facts.set(item.assignmentRef, {
      ref: item.assignmentRef,
      completed: false,
      waitingOnParent: existing?.waitingOnParent || PARENT_WAIT_REASONS.has(item.blockedReason ?? 'NONE'),
      waitingForScoring: existing?.waitingForScoring || SCORING_WAIT_REASONS.has(item.blockedReason ?? 'NONE'),
      assessment: existing?.assessment || item.kind === 'ASSESSMENT',
      carriedForward: Boolean(item.carriedForwardFromDate),
    })
  }

  const held = [...facts.values()]
  const completedCount = authority?.today.completedAcademicCount ?? held.filter((item) => item.completed).length
  const knownRemaining = held.filter((item) => !item.completed).length
  const sourceRequired = authority?.today.academicCount ?? held.length
  const remainingCount = Math.max(sourceRequired - completedCount, knownRemaining)
  return {
    facts: Object.freeze(held),
    requiredCount: Math.max(sourceRequired, completedCount + remainingCount),
    completedCount,
    remainingCount,
    omittedCount: authority?.today.omittedCount ?? 0,
  }
}

function decoratePlannerItems(
  model: StudentDashboardModel,
  plan: FamilyAutoPlannerTodayPlan,
): StudentDashboardModel['todayItems'] {
  const plannerItems = new Map(plan.items.map((item) => [item.assignmentRef, item]))
  return model.todayItems.map((item) => {
    const planner = plannerItems.get(item.workRef)
    if (!planner) return item
    const carried = planner.carriedForwardFromDate
      ? `Carried forward from ${formatLocalDate(planner.carriedForwardFromDate)}`
      : null
    const context = carried && !item.context.includes(carried) ? `${item.context} · ${carried}` : item.context
    if (planner.state !== 'BLOCKED' && planner.state !== 'WAITING') return { ...item, context }
    return {
      ...item,
      context,
      state: planner.state === 'WAITING' ? 'pending' as const : 'blocked' as const,
      stateLabel: item.state === 'blocked' || item.state === 'pending'
        ? item.stateLabel
        : plannerBlockedLabel(planner.blockedReason),
      actionable: false,
      actionLabel: undefined,
    }
  })
}

function dayStatus(
  state: StudentDashboardDayStatus['state'],
  counts: ReturnType<typeof requiredFacts>,
): StudentDashboardDayStatus {
  const remaining = counts.facts.filter((item) => !item.completed)
  return Object.freeze({
    state,
    requiredCount: counts.requiredCount,
    completedCount: counts.completedCount,
    remainingCount: counts.remainingCount,
    waitingOnParentCount: remaining.filter((item) => item.waitingOnParent).length,
    carryForwardCount: remaining.filter((item) => item.carriedForward).length,
    assessmentCount: counts.facts.filter((item) => item.assessment).length,
  })
}

/**
 * Learner-safe school-day projection over accepted Auto Planner plus assignment
 * truth. Completion is deliberately fail-closed: both authorities must report
 * no required work remaining. Internal planner reasons never reach the UI.
 */
export function applyAutoPlannerPresentation(
  model: StudentDashboardModel,
  plan: FamilyAutoPlannerTodayPlan,
  authority?: Pick<FamilyPilotStudentDashboardModel, 'today'>,
): StudentDashboardModel {
  const decoratedItems = decoratePlannerItems(model, plan)
  const decorated = Object.freeze({ ...model, todayItems: Object.freeze(decoratedItems) })
  const counts = requiredFacts(decorated, plan, authority)
  const remaining = counts.facts.filter((item) => !item.completed)
  const waitingOnParentCount = remaining.filter((item) => item.waitingOnParent).length
  const waitingForScoringCount = remaining.filter((item) => item.waitingForScoring).length
  const allLearnerWorkSubmitted = counts.remainingCount > 0 && counts.omittedCount === 0 &&
    counts.remainingCount === waitingOnParentCount + waitingForScoringCount

  if (plan.status === 'COURSE_COMPLETE') {
    const titles = plan.completedCourses.map((course) => course.title)
    return Object.freeze({
      ...decorated,
      progressLabel: titles.length === 1 ? `${titles[0]} complete` : `${titles.length} courses complete`,
      mission: Object.freeze({
        state: 'course-complete' as const,
        eyebrow: 'Course progress',
        title: 'Course complete',
        statusLabel: titles.length === 1 ? titles[0] : 'All terminal courses are complete',
        description: 'Every required lesson and assessment in this course is complete. A parent can review canonical next-course choices; your working level has not changed.',
      }),
      todayEmptyLabel: 'Course complete. No next lesson was generated.',
    })
  }

  if (plan.status === 'NO_SCHOOL_TODAY') {
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('no-school', counts),
      progressLabel: 'No school scheduled today',
      mission: Object.freeze({
        state: 'no-school' as const,
        eyebrow: 'Today’s school plan',
        title: 'No school today',
        statusLabel: 'Your school calendar is clear',
        description: 'No new daily work is scheduled for this school-local date.',
      }),
      todayEmptyLabel: 'No ordinary schoolwork is scheduled today.',
    })
  }

  if (plan.status === 'NEEDS_PLAN_SETUP' && decorated.todayItems.length === 0) {
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('needs-plan', counts),
      progressLabel: 'School plan setup needed',
      mission: Object.freeze({
        state: 'no-work' as const,
        eyebrow: 'Today’s schoolwork',
        title: 'Today’s schoolwork isn’t ready yet.',
        statusLabel: 'A parent needs to finish the School Plan',
        description: 'Ask a parent to unlock the Parent Hub and review this learner’s School Plan.',
      }),
      todayEmptyLabel: 'A parent can prepare today’s work in Parent Hub → School Plan.',
    })
  }

  if (allLearnerWorkSubmitted && waitingOnParentCount > 0) {
    const scoringNote = waitingForScoringCount > 0
      ? ` ${waitingForScoringCount} ${waitingForScoringCount === 1 ? 'assessment is' : 'assessments are'} also waiting for trusted scoring.`
      : ''
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('waiting-on-parent', counts),
      progressLabel: `${itemLabel(waitingOnParentCount)} waiting for Parent review`,
      mission: Object.freeze({
        state: 'waiting-on-parent' as const,
        eyebrow: 'Waiting for review',
        title: 'Your work is done — waiting for Parent review',
        statusLabel: `${itemLabel(waitingOnParentCount)} ${waitingOnParentCount === 1 ? 'is' : 'are'} waiting for Parent review`,
        description: `You finished everything you can do right now. A parent or guardian must review this work before Study can continue.${scoringNote}`,
      }),
    })
  }

  if (allLearnerWorkSubmitted && waitingForScoringCount > 0) {
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('waiting-for-assessment', counts),
      progressLabel: `${waitingForScoringCount} ${waitingForScoringCount === 1 ? 'assessment' : 'assessments'} submitted`,
      mission: Object.freeze({
        state: 'assessment-pending' as const,
        eyebrow: 'Assessment submitted',
        title: 'Your work is submitted',
        statusLabel: `${waitingForScoringCount} ${waitingForScoringCount === 1 ? 'assessment is' : 'assessments are'} waiting for trusted scoring`,
        description: 'There is nothing more to answer right now. This school day is not marked complete until the required assessment authority finishes.',
      }),
    })
  }

  const plannerHasNoUnfinished = plan.items.length === 0 && plan.blockers.length === 0
  if (plan.status === 'COMPLETE_FOR_TODAY' && plannerHasNoUnfinished && counts.remainingCount === 0) {
    const completeLabel = counts.requiredCount > 0
      ? `${itemLabel(counts.requiredCount)} complete`
      : 'No required items were scheduled'
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('complete', counts),
      progressLabel: counts.requiredCount > 0
        ? `${counts.completedCount} of ${counts.requiredCount} required items complete today`
        : '0 required items today',
      mission: Object.freeze({
        state: 'day-complete' as const,
        eyebrow: 'Today’s school day',
        title: 'You’re done for today',
        statusLabel: completeLabel,
        description: counts.requiredCount > 0
          ? 'Everything required for this school day is complete.'
          : 'Your School Plan had no required work for this school day.',
      }),
      todayEmptyLabel: decorated.todayItems.length === 0
        ? 'You had no required work scheduled for this school day.'
        : decorated.todayEmptyLabel,
    })
  }

  if (plan.status === 'BLOCKED' && plan.items.length === 0 && counts.remainingCount === 0) {
    return Object.freeze({
      ...decorated,
      dayStatus: dayStatus('unfinished', counts),
      progressLabel: 'Today’s required work needs attention',
      mission: Object.freeze({
        state: 'work-remaining' as const,
        eyebrow: 'Today’s schoolwork',
        title: 'You still have work',
        statusLabel: 'Required work cannot open yet',
        description: 'Ask a parent to unlock the Parent Hub and review the School Plan or device storage. No new work was opened.',
      }),
      todayEmptyLabel: 'No new work was added. Existing saved Study work remains unchanged.',
    })
  }

  const carryForwardCount = remaining.filter((item) => item.carriedForward).length
  const next = decorated.mission
  const nextPlannerItem = next.workRef ? plan.items.find((item) => item.assignmentRef === next.workRef) : undefined
  const nextIsBlocked = nextPlannerItem?.state === 'BLOCKED' || nextPlannerItem?.state === 'WAITING'
  const preservedState: StudentDashboardMissionState = [
    'safety-blocked', 'storage-unavailable', 'social-source-blocked', 'guardian-pending', 'assessment-pending',
  ].includes(next.state) ? next.state : 'work-remaining'
  const countLabel = counts.remainingCount > 0
    ? `${itemLabel(counts.remainingCount)} remaining`
    : 'Required work still needs attention'
  const carryCopy = carryForwardCount > 0
    ? `${carryForwardCount} unfinished ${carryForwardCount === 1 ? 'item was' : 'items were'} carried forward from an earlier school day.`
    : ''
  return Object.freeze({
    ...decorated,
    dayStatus: dayStatus('unfinished', counts),
    progressLabel: counts.remainingCount > 0
      ? `${counts.completedCount > 0 ? `${counts.completedCount} complete · ` : ''}${counts.remainingCount} remaining${carryForwardCount ? ` · ${carryForwardCount} carried forward` : ''}`
      : 'Today’s required work needs attention',
    mission: Object.freeze({
      state: preservedState,
      eyebrow: 'Today’s schoolwork',
      title: 'You still have work',
      context: next.title === 'You still have work'
        ? next.context
        : [next.title, next.context].filter(Boolean).join(' · ') || undefined,
      statusLabel: countLabel,
      description: appendSentence(next.description, carryCopy),
      ...(!nextIsBlocked && next.workRef && next.actionLabel
        ? { workRef: next.workRef, actionLabel: next.actionLabel }
        : {}),
    }),
  })
}

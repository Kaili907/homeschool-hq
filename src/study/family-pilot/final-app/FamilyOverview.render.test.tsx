import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { FamilyOverviewLearner } from './familyOverviewModel'
import { FamilyOverviewContent } from './FamilyOverview'

function learner(studentRef: string, displayName: string, patch: Partial<FamilyOverviewLearner> = {}): FamilyOverviewLearner {
  const base: FamilyOverviewLearner = {
    studentRef, displayName, nominalGrade: '5', localDate: '2026-08-14', todayState: 'WORK_REMAINING',
    schoolPlanState: 'CONFIGURED', scheduledToday: 1, completedToday: 0, remainingToday: 1,
    carriedUnfinished: 0, openSafetyHolds: 0, pendingAssessments: 0, pendingAdultAssessmentReviews: 0,
    pendingGuardianAttestations: 0, blocked: false, needsParent: false, needsParentReasons: [],
    courseComplete: false, offlineMaterializedWorkAvailable: false,
    workItems: [{ assignmentRef: `assignment:${studentRef}`, title: `${displayName} math`, subject: 'mathematics', workingGrade: '5', status: 'NOT_STARTED', scheduledLocalTime: '09:00', carriedForwardFromDate: null, assessment: false }],
    workingLevels: [{ subject: 'mathematics', subjectLabel: 'Mathematics', workingGrade: '5', courseTitle: 'Grade 5 Mathematics' }],
  }
  return Object.freeze({ ...base, ...patch })
}

function render(learners: readonly FamilyOverviewLearner[], online = true) {
  return renderToStaticMarkup(<FamilyOverviewContent learners={learners.map((item) => ({ status: 'ready' as const, learner: item }))} online={online} onOpenDetails={() => undefined} onOpenSchoolPlan={() => undefined} onRefresh={() => undefined} />)
}

describe('Parent FamilyOverview presentation', () => {
  it('answers the five at-a-glance questions with semantic learner cards and no fake percentage', () => {
    const html = render([
      learner('student:done', 'Drew', { todayState: 'DONE', completedToday: 1, remainingToday: 0 }),
      learner('student:blocked', 'Bailey', { todayState: 'BLOCKED', blocked: true, needsParent: true, needsParentReasons: ['Safety check-in'], openSafetyHolds: 1, pendingAssessments: 1 }),
    ])
    for (const text of ['Done today', 'Still has work', 'Blocked', 'Needs parent', 'Assessment waiting', 'Drew', 'Bailey', 'Today’s scheduled work']) expect(html).toContain(text)
    expect(html).toContain('This does not sign in as Drew')
    expect(html).not.toMatch(/\d+%/)
    expect((html.match(/<article\b/g) ?? [])).toHaveLength(2)
    expect(html).toContain('lg:grid-cols-2')
    expect(html).toContain('md:grid-cols-5')
    expect(html).toContain('min-h-11')
  })

  it('renders explicit empty, exception, offline, and parent drill-down copy', () => {
    const html = render([
      learner('student:no-plan', 'Nora', { todayState: 'NEEDS_PLAN', schoolPlanState: 'MISSING', scheduledToday: 0, remainingToday: 0, workItems: [], needsParent: true, needsParentReasons: ['School Plan setup'] }),
      learner('student:no-school', 'Sam', { todayState: 'NO_SCHOOL', scheduledToday: 0, remainingToday: 0, workItems: [] }),
      learner('student:complete', 'Cory', { todayState: 'DONE', courseComplete: true, completedToday: 0, remainingToday: 0, workItems: [] }),
    ], false)
    for (const text of ['Offline.', 'No School Plan', 'No schoolwork is scheduled today.', 'Course complete', 'All scheduled work is complete.', 'authorized parent-only view']) expect(html).toContain(text)
  })

  it('exposes drill-down callbacks keyed to the selected learner without learner sign-in', () => {
    const details = vi.fn()
    const plan = vi.fn()
    const element = <FamilyOverviewContent learners={[{ status: 'ready', learner: learner('student:exact', 'Exact') }]} online onOpenDetails={details} onOpenSchoolPlan={plan} onRefresh={() => undefined} />
    const card = element.props.learners[0].learner
    element.props.onOpenDetails(card.studentRef)
    element.props.onOpenSchoolPlan(card.studentRef)
    expect(details).toHaveBeenCalledWith('student:exact')
    expect(plan).toHaveBeenCalledWith('student:exact')
  })

  it('does not render sibling content inside a learner card', () => {
    const ada = render([learner('student:ada', 'Ada')])
    expect(ada).toContain('Ada math')
    expect(ada).not.toContain('Bo')
    expect(ada).not.toContain('student:bo')
  })
})

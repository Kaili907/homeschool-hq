import { describe, expect, it } from 'vitest'
import { buildFamilyWeeklySummary, buildStudentDailyReport, buildStudentWeeklyReport } from './buildReports'
import type { FamilyPilotLearnerOption, FamilyPilotReviewItem, FamilyPilotStudentSnapshot, FamilyPilotWorkItem } from '../parent/types'

function workItem(overrides: Partial<FamilyPilotWorkItem> = {}): FamilyPilotWorkItem {
  return {
    blockRef: 'block:one',
    title: 'Fractions practice',
    status: 'in-progress',
    scheduledLocalDate: '2026-08-10',
    requiredWorkCompletionPercent: 50,
    currentSegmentTitle: 'Step two',
    currentSegmentOrdinal: 2,
    totalSegments: 3,
    completedSegmentCount: 1,
    timeOnTaskSeconds: 120,
    pauseState: null,
    ...overrides,
  }
}

function reviewItem(overrides: Partial<FamilyPilotReviewItem> = {}): FamilyPilotReviewItem {
  return {
    recommendationRef: 'recommendation:one',
    dueDate: '2026-08-10',
    reasonCodes: ['engine-review-due'],
    status: 'pending-parent',
    ...overrides,
  }
}

function learner(overrides: Partial<FamilyPilotLearnerOption> = {}): FamilyPilotLearnerOption {
  return { hostProfileRef: 'host:ada', learnerRef: 'learner:ada', displayName: 'Ada', ...overrides }
}

function snapshot(overrides: Partial<FamilyPilotStudentSnapshot> = {}): FamilyPilotStudentSnapshot {
  return {
    learner: learner(),
    workItems: [],
    reviewItems: [],
    safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
    counts: { notStarted: 0, inProgress: 0, paused: 0, completed: 0 },
    ...overrides,
  }
}

describe('buildStudentDailyReport — one student, one day', () => {
  it('scopes work items to the requested date and carries the learner identity through', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [
          workItem({ blockRef: 'block:today', scheduledLocalDate: '2026-08-10', status: 'in-progress' }),
          workItem({ blockRef: 'block:tomorrow', scheduledLocalDate: '2026-08-11', status: 'not-started' }),
        ],
      }),
      '2026-08-10',
    )
    expect(report.learnerRef).toBe('learner:ada')
    expect(report.displayName).toBe('Ada')
    expect(report.date).toBe('2026-08-10')
    expect(report.items.map((item) => item.blockRef)).toEqual(['block:today'])
  })
})

describe('buildStudentWeeklyReport — one student, one week', () => {
  it('scopes work items to the inclusive date range', () => {
    const report = buildStudentWeeklyReport(
      snapshot({
        workItems: [
          workItem({ blockRef: 'block:mon', scheduledLocalDate: '2026-08-10' }),
          workItem({ blockRef: 'block:wed', scheduledLocalDate: '2026-08-12' }),
          workItem({ blockRef: 'block:next-mon', scheduledLocalDate: '2026-08-17' }),
        ],
      }),
      { startDate: '2026-08-10', endDate: '2026-08-16' },
    )
    expect(report.startDate).toBe('2026-08-10')
    expect(report.endDate).toBe('2026-08-16')
    expect(report.items.map((item) => item.blockRef)).toEqual(['block:mon', 'block:wed'])
  })
})

describe('buildFamilyWeeklySummary — two students', () => {
  it('keeps a distinct report per student with no blended totals', () => {
    const summary = buildFamilyWeeklySummary(
      [
        snapshot({
          learner: learner({ learnerRef: 'learner:ada', displayName: 'Ada' }),
          workItems: [workItem({ blockRef: 'block:ada-1', status: 'completed', scheduledLocalDate: '2026-08-10' })],
        }),
        snapshot({
          learner: learner({ learnerRef: 'learner:beatrice', displayName: 'Beatrice' }),
          workItems: [
            workItem({ blockRef: 'block:bea-1', status: 'completed', scheduledLocalDate: '2026-08-10' }),
            workItem({ blockRef: 'block:bea-2', status: 'completed', scheduledLocalDate: '2026-08-11' }),
          ],
        }),
      ],
      { startDate: '2026-08-10', endDate: '2026-08-16' },
    )

    expect(summary.studentReports).toHaveLength(2)
    // No aggregate/blended field exists on the summary at all — only the
    // per-student array. Assert that shape explicitly.
    expect(Object.keys(summary).sort()).toEqual(['endDate', 'startDate', 'studentReports'])

    const ada = summary.studentReports.find((r) => r.learnerRef === 'learner:ada')
    const beatrice = summary.studentReports.find((r) => r.learnerRef === 'learner:beatrice')
    expect(ada?.assignmentsCompleted).toBe(1)
    expect(beatrice?.assignmentsCompleted).toBe(2)
    expect(ada?.items.map((item) => item.blockRef)).toEqual(['block:ada-1'])
    expect(beatrice?.items.map((item) => item.blockRef)).toEqual(['block:bea-1', 'block:bea-2'])
  })
})

describe('buildFamilyWeeklySummary — same-name students remain separate', () => {
  it('never blends two students that share a display name, keying strictly on learnerRef', () => {
    const summary = buildFamilyWeeklySummary(
      [
        snapshot({
          learner: { hostProfileRef: 'host:a', learnerRef: 'learner:twin-a', displayName: 'Jordan' },
          workItems: [workItem({ blockRef: 'block:twin-a-1', status: 'completed', scheduledLocalDate: '2026-08-10' })],
        }),
        snapshot({
          learner: { hostProfileRef: 'host:b', learnerRef: 'learner:twin-b', displayName: 'Jordan' },
          workItems: [
            workItem({ blockRef: 'block:twin-b-1', status: 'paused', scheduledLocalDate: '2026-08-10' }),
            workItem({ blockRef: 'block:twin-b-2', status: 'not-started', scheduledLocalDate: '2026-08-10' }),
          ],
        }),
      ],
      { startDate: '2026-08-10', endDate: '2026-08-16' },
    )

    expect(summary.studentReports).toHaveLength(2)
    const twinA = summary.studentReports.find((r) => r.learnerRef === 'learner:twin-a')
    const twinB = summary.studentReports.find((r) => r.learnerRef === 'learner:twin-b')
    expect(twinA?.displayName).toBe('Jordan')
    expect(twinB?.displayName).toBe('Jordan')
    expect(twinA?.assignmentsCompleted).toBe(1)
    expect(twinB?.assignmentsCompleted).toBe(0)
    expect(twinA?.items.map((item) => item.blockRef)).toEqual(['block:twin-a-1'])
    expect(twinB?.items.map((item) => item.blockRef)).toEqual(['block:twin-b-1', 'block:twin-b-2'])
  })
})

describe('buildStudentDailyReport — no completed work', () => {
  it('reports zero completions and null completion when nothing is scheduled that day', () => {
    const report = buildStudentDailyReport(snapshot({ workItems: [] }), '2026-08-10')
    expect(report.assignmentsCompleted).toBe(0)
    expect(report.lessonsCompleted).toBe(0)
    expect(report.completionPercent).toBeNull()
    expect(report.currentLesson).toBeNull()
  })
})

describe('buildStudentDailyReport — partial progress', () => {
  it('does not turn unlike segment percentages into a fabricated completion average', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [
          workItem({ blockRef: 'block:a', requiredWorkCompletionPercent: 20, scheduledLocalDate: '2026-08-10' }),
          workItem({ blockRef: 'block:b', requiredWorkCompletionPercent: 80, scheduledLocalDate: '2026-08-10' }),
        ],
      }),
      '2026-08-10',
    )
    expect(report.completionPercent).toBe(0)
  })
})

describe('buildStudentDailyReport — completed work', () => {
  it('counts completed items and clears their current segment', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [
          workItem({
            blockRef: 'block:done',
            status: 'completed',
            requiredWorkCompletionPercent: 100,
            currentSegmentTitle: null,
            currentSegmentOrdinal: null,
            scheduledLocalDate: '2026-08-10',
          }),
        ],
      }),
      '2026-08-10',
    )
    expect(report.assignmentsCompleted).toBe(1)
    expect(report.lessonsCompleted).toBe(1)
    expect(report.completionPercent).toBe(100)
  })
})

describe('buildStudentDailyReport — time on task present', () => {
  it('sums the recorded time-on-task across in-scope items', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [
          workItem({ blockRef: 'block:a', timeOnTaskSeconds: 90, scheduledLocalDate: '2026-08-10' }),
          workItem({ blockRef: 'block:b', timeOnTaskSeconds: 30, scheduledLocalDate: '2026-08-10' }),
        ],
      }),
      '2026-08-10',
    )
    expect(report.timeOnTaskSeconds).toBe(120)
  })
})

describe('buildStudentDailyReport — time on task absent', () => {
  it('is null, not zero, when no in-scope item has recorded time', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [workItem({ blockRef: 'block:a', timeOnTaskSeconds: null, scheduledLocalDate: '2026-08-10' })],
      }),
      '2026-08-10',
    )
    expect(report.timeOnTaskSeconds).toBeNull()
  })
})

describe('buildStudentDailyReport — paused assignment', () => {
  it('surfaces a paused item in both the paused count and the attention list', () => {
    const report = buildStudentDailyReport(
      snapshot({
        workItems: [
          workItem({
            blockRef: 'block:paused',
            title: 'Long division',
            status: 'paused',
            scheduledLocalDate: '2026-08-10',
            pauseState: { blockRef: 'block:paused', category: 'technical' },
          }),
        ],
      }),
      '2026-08-10',
    )
    expect(report.pausedWorkCount).toBe(1)
    expect(report.openWorkCount).toBe(1)
    expect(report.itemsNeedingParentAttention).toContainEqual({
      kind: 'paused-work',
      blockRef: 'block:paused',
      recommendationRef: null,
      title: 'Long division',
      reasonCodes: null,
      dueDate: null,
    })
  })
})

describe('buildStudentDailyReport — parent-attention item from a pending review', () => {
  it('includes a due-or-overdue pending review in the attention list', () => {
    const report = buildStudentDailyReport(
      snapshot({
        reviewItems: [reviewItem({ recommendationRef: 'recommendation:due', dueDate: '2026-08-09', reasonCodes: ['engine-review-due'] })],
      }),
      '2026-08-10',
    )
    expect(report.itemsNeedingParentAttention).toContainEqual({
      kind: 'review-needed',
      blockRef: null,
      recommendationRef: 'recommendation:due',
      title: null,
      reasonCodes: ['engine-review-due'],
      dueDate: '2026-08-09',
    })
  })

  it('excludes a review that is not yet due', () => {
    const report = buildStudentDailyReport(
      snapshot({ reviewItems: [reviewItem({ dueDate: '2026-08-20' })] }),
      '2026-08-10',
    )
    expect(report.itemsNeedingParentAttention).toHaveLength(0)
  })
})

function forbiddenKeyNames(value: unknown, seen = new Set<unknown>()): string[] {
  if (value === null || typeof value !== 'object' || seen.has(value)) return []
  seen.add(value)
  const forbidden = ['rawanswer', 'transcript', 'answertext', 'emotionallabel', 'diagnostic', 'personality']
  const found: string[] = []
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.includes(key.toLowerCase())) found.push(key)
    found.push(...forbiddenKeyNames(nested, seen))
  }
  return found
}

describe('buildStudentDailyReport / buildStudentWeeklyReport — no raw content', () => {
  it('never introduces raw-answer, transcript, or diagnostic/emotional fields anywhere in the report shape', () => {
    const daily = buildStudentDailyReport(
      snapshot({
        workItems: [workItem({ scheduledLocalDate: '2026-08-10' })],
        reviewItems: [reviewItem({ dueDate: '2026-08-10' })],
      }),
      '2026-08-10',
    )
    const weekly = buildStudentWeeklyReport(
      snapshot({
        workItems: [workItem({ scheduledLocalDate: '2026-08-10' })],
        reviewItems: [reviewItem({ dueDate: '2026-08-10' })],
      }),
      { startDate: '2026-08-10', endDate: '2026-08-16' },
    )
    expect(forbiddenKeyNames(daily)).toEqual([])
    expect(forbiddenKeyNames(weekly)).toEqual([])
  })
})

describe('buildStudentDailyReport / buildStudentWeeklyReport — deterministic output', () => {
  it('produces a deep-equal result across repeated calls with the same input', () => {
    const input = snapshot({
      workItems: [workItem({ blockRef: 'block:a', scheduledLocalDate: '2026-08-10' })],
      reviewItems: [reviewItem({ dueDate: '2026-08-10' })],
    })
    expect(buildStudentDailyReport(input, '2026-08-10')).toEqual(buildStudentDailyReport(input, '2026-08-10'))
    expect(buildStudentWeeklyReport(input, { startDate: '2026-08-10', endDate: '2026-08-16' })).toEqual(
      buildStudentWeeklyReport(input, { startDate: '2026-08-10', endDate: '2026-08-16' }),
    )
  })
})

import { describe, expect, it } from 'vitest'
import { reportToCsv, reportToPrintableText } from './exportReport'
import { buildStudentDailyReport, buildStudentWeeklyReport } from './buildReports'
import type { FamilyPilotStudentSnapshot } from '../parent/types'

function snapshotFor(learnerRef: string, displayName: string): FamilyPilotStudentSnapshot {
  return {
    learner: { hostProfileRef: `host:${learnerRef}`, learnerRef, displayName },
    workItems: [
      {
        blockRef: `block:${learnerRef}`,
        title: 'Fractions practice',
        status: 'paused',
        scheduledLocalDate: '2026-08-10',
        requiredWorkCompletionPercent: 40,
        currentSegmentTitle: 'Step two',
        currentSegmentOrdinal: 2,
        totalSegments: 3,
        completedSegmentCount: 1,
        timeOnTaskSeconds: 90,
        pauseState: { blockRef: `block:${learnerRef}`, category: 'unspecified' },
      },
    ],
    reviewItems: [
      { recommendationRef: `recommendation:${learnerRef}`, dueDate: '2026-08-09', reasonCodes: ['engine-review-due'], status: 'pending-parent' },
    ],
    safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
    counts: { notStarted: 0, inProgress: 0, paused: 1, completed: 0 },
  }
}

describe('reportToPrintableText', () => {
  it('renders a daily report as readable plain text with the paused and review attention lines', () => {
    const report = buildStudentDailyReport(snapshotFor('learner:ada', 'Ada'), '2026-08-10')
    const text = reportToPrintableText(report)
    expect(text).toContain('Ada — 2026-08-10')
    expect(text).toContain('Assignments started: 1')
    expect(text).toContain('Study time recorded: 1m 30s')
    expect(text).toContain('  - Paused: Fractions practice')
    expect(text).toContain('  - Review needed (due 2026-08-09): engine-review-due')
  })

  it('renders a weekly report with a date-range period label', () => {
    const report = buildStudentWeeklyReport(snapshotFor('learner:ada', 'Ada'), { startDate: '2026-08-10', endDate: '2026-08-16' })
    const text = reportToPrintableText(report)
    expect(text).toContain('Ada — 2026-08-10 to 2026-08-16')
  })

  it('says time was not recorded rather than fabricating a zero', () => {
    const snapshot = snapshotFor('learner:ada', 'Ada')
    const noTime = { ...snapshot, workItems: snapshot.workItems.map((item) => ({ ...item, timeOnTaskSeconds: null })) }
    const report = buildStudentDailyReport(noTime, '2026-08-10')
    expect(reportToPrintableText(report)).toContain('Study time recorded: Not recorded')
  })
})

describe('reportToCsv', () => {
  it('emits a header row plus one row per report, keeping each learner on its own row', () => {
    const reportA = buildStudentDailyReport(snapshotFor('learner:ada', 'Ada'), '2026-08-10')
    const reportB = buildStudentDailyReport(snapshotFor('learner:beatrice', 'Beatrice'), '2026-08-10')
    const csv = reportToCsv([reportA, reportB])
    const rows = csv.split('\n')
    expect(rows[0]).toBe(
      'learnerRef,displayName,period,assignmentsStarted,assignmentsCompleted,lessonsCompleted,currentLesson,currentSegment,timeOnTaskSeconds,openWorkCount,pausedWorkCount,completionPercent,itemsNeedingParentAttentionCount',
    )
    expect(rows).toHaveLength(3)
    expect(rows[1]).toContain('learner:ada')
    expect(rows[1]).toContain('Ada')
    expect(rows[2]).toContain('learner:beatrice')
    expect(rows[2]).toContain('Beatrice')
  })

  it('accepts a single report without wrapping it in an array', () => {
    const report = buildStudentDailyReport(snapshotFor('learner:ada', 'Ada'), '2026-08-10')
    const csv = reportToCsv(report)
    expect(csv.split('\n')).toHaveLength(2)
  })

  it('quotes a field that contains a comma so the row still parses as one row per report', () => {
    const snapshot = snapshotFor('learner:ada', 'Ada')
    const withComma: FamilyPilotStudentSnapshot = {
      ...snapshot,
      workItems: snapshot.workItems.map((item) => ({ ...item, title: 'Reading, chapter 2' })),
    }
    const report = buildStudentDailyReport(withComma, '2026-08-10')
    const csv = reportToCsv(report)
    const rows = csv.split('\n')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toContain('"Reading, chapter 2"')
  })
})

describe('reportToPrintableText / reportToCsv — no raw content', () => {
  it('never contains a reason code label leaking beyond the structured codes already present on the review item', () => {
    const report = buildStudentDailyReport(snapshotFor('learner:ada', 'Ada'), '2026-08-10')
    const text = reportToPrintableText(report)
    const csv = reportToCsv(report)
    for (const forbidden of ['rawAnswer', 'transcript', 'answerText', 'emotionalLabel', 'diagnostic', 'personality']) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase())
      expect(csv.toLowerCase()).not.toContain(forbidden.toLowerCase())
    }
  })
})

describe('reportToPrintableText / reportToCsv — deterministic output', () => {
  it('produces identical text and CSV across repeated calls with the same report', () => {
    const report = buildStudentDailyReport(snapshotFor('learner:ada', 'Ada'), '2026-08-10')
    expect(reportToPrintableText(report)).toBe(reportToPrintableText(report))
    expect(reportToCsv(report)).toBe(reportToCsv(report))
  })
})

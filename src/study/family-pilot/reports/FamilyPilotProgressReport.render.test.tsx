import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FamilyPilotProgressReport } from './FamilyPilotProgressReport'
import { buildStudentDailyReport } from './buildReports'
import type { FamilyPilotStudentSnapshot } from '../parent/types'

function snapshotFor(learnerRef: string, displayName: string, blockRef: string, recommendationRef: string): FamilyPilotStudentSnapshot {
  return {
    learner: { hostProfileRef: `host:${learnerRef}`, learnerRef, displayName },
    workItems: [
      {
        blockRef,
        title: `Assignment ${blockRef}`,
        status: 'paused',
        scheduledLocalDate: '2026-08-10',
        requiredWorkCompletionPercent: 40,
        currentSegmentTitle: 'Step one',
        currentSegmentOrdinal: 1,
        totalSegments: 2,
        completedSegmentCount: 0,
        timeOnTaskSeconds: 90,
        pauseState: { blockRef, category: 'unspecified' },
      },
    ],
    reviewItems: [{ recommendationRef, dueDate: '2026-08-09', reasonCodes: [recommendationRef], status: 'pending-parent' }],
    safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
    counts: { notStarted: 0, inProgress: 0, paused: 1, completed: 0 },
  }
}

function render(snapshot: FamilyPilotStudentSnapshot): string {
  return renderToStaticMarkup(<FamilyPilotProgressReport report={buildStudentDailyReport(snapshot, '2026-08-10')} />)
}

describe('FamilyPilotProgressReport — never blends another learner\'s content', () => {
  it('renders only this learner\'s name, blockRef-derived title, and recommendationRef-derived text', () => {
    const htmlA = render(snapshotFor('learner:a', 'Ada', 'block:ada-only', 'recommendation:ada-only'))
    const htmlB = render(snapshotFor('learner:b', 'Beatrice', 'block:beatrice-only', 'recommendation:beatrice-only'))

    expect(htmlA).toContain('Ada')
    expect(htmlA).toContain('Assignment block:ada-only')
    expect(htmlA).toContain('recommendation:ada-only')
    expect(htmlB).toContain('Beatrice')
    expect(htmlB).toContain('Assignment block:beatrice-only')
    expect(htmlB).toContain('recommendation:beatrice-only')

    expect(htmlA).not.toContain('Beatrice')
    expect(htmlA).not.toContain('block:beatrice-only')
    expect(htmlA).not.toContain('recommendation:beatrice-only')
    expect(htmlB).not.toContain('Ada')
    expect(htmlB).not.toContain('block:ada-only')
    expect(htmlB).not.toContain('recommendation:ada-only')
  })
})

describe('FamilyPilotProgressReport — empty state copy', () => {
  it('shows empty-state copy when nothing is in progress and nothing needs attention', () => {
    const snapshot: FamilyPilotStudentSnapshot = {
      learner: { hostProfileRef: 'host:ada', learnerRef: 'learner:ada', displayName: 'Ada' },
      workItems: [],
      reviewItems: [],
      safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
      counts: { notStarted: 0, inProgress: 0, paused: 0, completed: 0 },
    }
    const html = render(snapshot)
    expect(html).toContain('Nothing in progress for Ada.')
    expect(html).toContain('Nothing needs attention for Ada in this period.')
    expect(html).toContain('Study time recorded: Not recorded')
  })
})

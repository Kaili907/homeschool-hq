import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FamilyPilotStudentCard } from './FamilyPilotStudentCard'
import type { FamilyPilotLearnerOption, FamilyPilotStudentSnapshot } from './types'

// The card never renders a work item's blockRef or a review item's
// recommendationRef as literal text (they are only used as React `key`s), so
// to make "never renders another learner's ... blockRef" a meaningful check,
// these fixtures fold each ref into a field the card does render (title /
// reasonCodes). That way a real leak — e.g. swapping in the wrong learner's
// work/review array — would show up as a string comparison failure below.

const learnerA: FamilyPilotLearnerOption = { hostProfileRef: 'host:a', learnerRef: 'learner:a', displayName: 'Ada' }
const learnerB: FamilyPilotLearnerOption = { hostProfileRef: 'host:b', learnerRef: 'learner:b', displayName: 'Beatrice' }

function snapshotFor(learner: FamilyPilotLearnerOption, blockRef: string, recommendationRef: string): FamilyPilotStudentSnapshot {
  return {
    learner,
    workItems: [
      {
        blockRef,
        title: `Assignment ${blockRef}`,
        status: 'in-progress',
        scheduledLocalDate: '2026-08-01',
        requiredWorkCompletionPercent: 40,
        currentSegmentTitle: 'Step one',
        currentSegmentOrdinal: 1,
        totalSegments: 2,
        completedSegmentCount: 0,
        timeOnTaskSeconds: 90,
        pauseState: null,
      },
    ],
    reviewItems: [
      {
        recommendationRef,
        dueDate: '2026-08-05',
        reasonCodes: [recommendationRef],
        status: 'pending-parent',
      },
    ],
    safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
    counts: { notStarted: 0, inProgress: 1, paused: 0, completed: 0 },
  }
}

function emptySnapshot(learner: FamilyPilotLearnerOption): FamilyPilotStudentSnapshot {
  return {
    learner,
    workItems: [],
    reviewItems: [],
    safety: { hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' },
    counts: { notStarted: 0, inProgress: 0, paused: 0, completed: 0 },
  }
}

function render(snapshot: FamilyPilotStudentSnapshot): string {
  return renderToStaticMarkup(
    <FamilyPilotStudentCard snapshot={snapshot} onAllowResume={() => {}} onReviewDecision={() => {}} />,
  )
}

describe('FamilyPilotStudentCard — never blends another learner\'s content', () => {
  it('renders only this learner\'s name, blockRef-derived title, and recommendationRef-derived text', () => {
    const htmlA = render(snapshotFor(learnerA, 'block:ada-only', 'recommendation:ada-only'))
    const htmlB = render(snapshotFor(learnerB, 'block:beatrice-only', 'recommendation:beatrice-only'))

    // Sanity: each card does contain its own identifying content.
    expect(htmlA).toContain('Ada')
    expect(htmlA).toContain('block:ada-only')
    expect(htmlA).toContain('recommendation:ada-only')
    expect(htmlB).toContain('Beatrice')
    expect(htmlB).toContain('block:beatrice-only')
    expect(htmlB).toContain('recommendation:beatrice-only')

    // The actual guarantee: no cross-learner leakage in either direction.
    expect(htmlA).not.toContain('Beatrice')
    expect(htmlA).not.toContain('block:beatrice-only')
    expect(htmlA).not.toContain('recommendation:beatrice-only')
    expect(htmlB).not.toContain('Ada')
    expect(htmlB).not.toContain('block:ada-only')
    expect(htmlB).not.toContain('recommendation:ada-only')
  })
})

describe('FamilyPilotStudentCard — empty state copy', () => {
  it('shows empty-state copy for both sections when there is no work or review data', () => {
    const html = render(emptySnapshot(learnerA))
    expect(html).toContain('No study work is assigned to Ada yet.')
    expect(html).toContain('No review is waiting for Ada.')
  })
})

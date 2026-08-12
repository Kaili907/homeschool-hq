import { describe, expect, it } from 'vitest'
import { deriveSafetyStatus, deriveStudentSnapshot } from './deriveSnapshot'
import type { LocalSafetyStopLedgerView } from '../../safety/localStopLedger'
import type {
  StudyCalendarEntry,
  StudyParentSettings,
  StudyPlanSegment,
  StudyReviewRecommendation,
} from '../../types'
import type { FamilyPilotLearnerOption } from './types'

function planSegment(segmentRef: string, title: string): StudyPlanSegment {
  return {
    segmentRef,
    title,
    taskType: 'independent-practice',
    estimatedMinutes: 10,
    required: true,
  }
}

function calendarEntry(overrides: Partial<StudyCalendarEntry> = {}): StudyCalendarEntry {
  return {
    blockRef: 'block:one',
    externalItemRef: 'external:one',
    learnerRef: 'learner:ada',
    title: 'Synthetic block',
    lessonRef: 'lesson:one',
    subject: 'math',
    skillRefs: [],
    source: 'manuel-academy',
    masteryAuthority: 'completion-only',
    blockKind: 'independent_practice',
    scheduledStart: '2026-08-01T13:00:00.000Z',
    intendedLocalDate: '2026-08-01',
    householdTimeZone: 'America/New_York',
    timerVisibility: 'shown',
    state: 'scheduled',
    segments: [planSegment('seg:1', 'Step one'), planSegment('seg:2', 'Step two')],
    completedSegmentRefs: [],
    requiredWorkCompletionPercent: 0,
    estimatedRemainingMinutes: 20,
    ...overrides,
  }
}

function reviewRecommendation(overrides: Partial<StudyReviewRecommendation> = {}): StudyReviewRecommendation {
  return {
    recommendationRef: 'recommendation:one',
    householdRef: 'household:one',
    learnerRef: 'learner:ada',
    sourceEvidenceRef: 'evidence:one',
    lessonRef: 'lesson:one',
    dueDate: '2026-08-05',
    reasonCodes: ['engine-review-due'],
    status: 'pending-parent',
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function parentSettings(overrides: Partial<StudyParentSettings> = {}): StudyParentSettings {
  return {
    maximumWorkMinutes: 30,
    breakMinutes: 5,
    timerHidden: false,
    accommodations: [],
    recommendationDecisions: [],
    interruptions: [],
    reschedules: [],
    adultReviewRequests: [],
    revision: 0,
    ...overrides,
  }
}

function safetyLedger(overrides: Partial<LocalSafetyStopLedgerView> = {}): LocalSafetyStopLedgerView {
  return { records: [], historyState: 'available', ...overrides }
}

const learner: FamilyPilotLearnerOption = {
  hostProfileRef: 'host:ada',
  learnerRef: 'learner:ada',
  displayName: 'Ada',
}

describe('deriveStudentSnapshot — status bucket mapping', () => {
  it.each([
    ['scheduled', 'not-started'],
    ['active', 'in-progress'],
    ['paused', 'paused'],
    ['completed', 'completed'],
  ] as const)('maps calendar state %s to work status %s', (state, status) => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [calendarEntry({ state })],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.status).toBe(status)
  })
})

describe('deriveStudentSnapshot — current segment derivation', () => {
  it('uses the resume point segment and its own ordinal when it matches a known segment', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'paused',
          segments: [planSegment('seg:1', 'Step one'), planSegment('seg:2', 'Step two')],
          resumePoint: {
            segmentRef: 'seg:2',
            segmentOrdinal: 2,
            elapsedActiveSecondsInSegment: 45,
            completedSegmentRefs: ['seg:1'],
            remainingSegmentRefs: ['seg:2'],
            capturedAt: '2026-08-01T13:10:00.000Z',
          },
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.currentSegmentTitle).toBe('Step two')
    expect(snapshot.workItems[0]?.currentSegmentOrdinal).toBe(2)
  })

  it('falls back to the raw resume-point segmentRef as title when it does not match any segment', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'paused',
          segments: [planSegment('seg:1', 'Step one')],
          resumePoint: {
            segmentRef: 'seg:missing',
            segmentOrdinal: 5,
            elapsedActiveSecondsInSegment: 10,
            completedSegmentRefs: [],
            remainingSegmentRefs: ['seg:missing'],
            capturedAt: '2026-08-01T13:10:00.000Z',
          },
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.currentSegmentTitle).toBe('seg:missing')
    expect(snapshot.workItems[0]?.currentSegmentOrdinal).toBe(5)
  })

  it('falls back to the first incomplete segment when there is no resume point', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'active',
          segments: [planSegment('seg:1', 'Step one'), planSegment('seg:2', 'Step two'), planSegment('seg:3', 'Step three')],
          completedSegmentRefs: ['seg:1'],
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.currentSegmentTitle).toBe('Step two')
    expect(snapshot.workItems[0]?.currentSegmentOrdinal).toBe(2)
  })

  it('has no current segment when every segment is already complete and there is no resume point', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'active',
          segments: [planSegment('seg:1', 'Step one')],
          completedSegmentRefs: ['seg:1'],
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.currentSegmentTitle).toBeNull()
    expect(snapshot.workItems[0]?.currentSegmentOrdinal).toBeNull()
  })

  it('nulls out the current segment for completed work even if a resume point is still present', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'completed',
          segments: [planSegment('seg:1', 'Step one'), planSegment('seg:2', 'Step two')],
          completedSegmentRefs: ['seg:1', 'seg:2'],
          resumePoint: {
            segmentRef: 'seg:2',
            segmentOrdinal: 2,
            elapsedActiveSecondsInSegment: 45,
            completedSegmentRefs: ['seg:1'],
            remainingSegmentRefs: ['seg:2'],
            capturedAt: '2026-08-01T13:10:00.000Z',
          },
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.currentSegmentTitle).toBeNull()
    expect(snapshot.workItems[0]?.currentSegmentOrdinal).toBeNull()
  })
})

describe('deriveStudentSnapshot — time on task', () => {
  it('reports elapsedActiveSecondsInSegment from the resume point', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({
          state: 'paused',
          resumePoint: {
            segmentRef: 'seg:1',
            segmentOrdinal: 1,
            elapsedActiveSecondsInSegment: 125,
            completedSegmentRefs: [],
            remainingSegmentRefs: ['seg:1', 'seg:2'],
            capturedAt: '2026-08-01T13:10:00.000Z',
          },
        }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.timeOnTaskSeconds).toBe(125)
  })

  it('is null when there is no resume point', () => {
    const snapshot = deriveStudentSnapshot(learner, [calendarEntry({ state: 'active' })], [], parentSettings(), safetyLedger())
    expect(snapshot.workItems[0]?.timeOnTaskSeconds).toBeNull()
  })
})

describe('deriveStudentSnapshot — pause category', () => {
  it('takes the category from a matching parent-settings interruption entry', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [calendarEntry({ blockRef: 'block:paused-one', state: 'paused' })],
      [],
      parentSettings({ interruptions: [{ blockRef: 'block:paused-one', kind: 'technical', at: '2026-08-01T13:05:00.000Z' }] }),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.pauseState).toEqual({ blockRef: 'block:paused-one', category: 'technical' })
  })

  it('is unspecified when no interruption entry matches the blockRef', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [calendarEntry({ blockRef: 'block:paused-two', state: 'paused' })],
      [],
      parentSettings({ interruptions: [{ blockRef: 'block:some-other-block', kind: 'outside', at: '2026-08-01T13:05:00.000Z' }] }),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.pauseState).toEqual({ blockRef: 'block:paused-two', category: 'unspecified' })
  })

  it('is unspecified when parent settings are unavailable', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [calendarEntry({ blockRef: 'block:paused-three', state: 'paused' })],
      [],
      null,
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.pauseState).toEqual({ blockRef: 'block:paused-three', category: 'unspecified' })
  })

  it('is null for a block that is not currently paused, even if an interruption entry matches', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [calendarEntry({ blockRef: 'block:active-one', state: 'active' })],
      [],
      parentSettings({ interruptions: [{ blockRef: 'block:active-one', kind: 'technical', at: '2026-08-01T13:05:00.000Z' }] }),
      safetyLedger(),
    )
    expect(snapshot.workItems[0]?.pauseState).toBeNull()
  })
})

describe('deriveStudentSnapshot — review item filtering', () => {
  it('keeps only this learner\'s pending-parent recommendations', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [],
      [
        reviewRecommendation({ recommendationRef: 'rec:pending-mine', learnerRef: 'learner:ada', status: 'pending-parent' }),
        reviewRecommendation({ recommendationRef: 'rec:accepted-mine', learnerRef: 'learner:ada', status: 'accepted' }),
        reviewRecommendation({ recommendationRef: 'rec:rejected-mine', learnerRef: 'learner:ada', status: 'rejected' }),
        reviewRecommendation({ recommendationRef: 'rec:pending-other-learner', learnerRef: 'learner:beatrice', status: 'pending-parent' }),
      ],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.reviewItems).toHaveLength(1)
    expect(snapshot.reviewItems[0]?.recommendationRef).toBe('rec:pending-mine')
  })
})

describe('deriveStudentSnapshot — counts tally', () => {
  it('tallies each work status bucket', () => {
    const snapshot = deriveStudentSnapshot(
      learner,
      [
        calendarEntry({ blockRef: 'block:1', state: 'scheduled' }),
        calendarEntry({ blockRef: 'block:2', state: 'active' }),
        calendarEntry({ blockRef: 'block:3', state: 'active' }),
        calendarEntry({ blockRef: 'block:4', state: 'paused' }),
        calendarEntry({ blockRef: 'block:5', state: 'completed' }),
        calendarEntry({ blockRef: 'block:6', state: 'completed' }),
      ],
      [],
      parentSettings(),
      safetyLedger(),
    )
    expect(snapshot.counts).toEqual({ notStarted: 1, inProgress: 2, paused: 1, completed: 2 })
  })
})

describe('deriveSafetyStatus', () => {
  it('reports the most recent stop for this learner and passes through historyState', () => {
    const status = deriveSafetyStatus(
      {
        records: [
          { schemaVersion: 2, recordId: 'r1', occurredAt: '2026-07-01T00:00:00.000Z', studentRef: 'learner:ada', serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' },
          { schemaVersion: 2, recordId: 'r2', occurredAt: '2026-08-01T00:00:00.000Z', studentRef: 'learner:ada', serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' },
          { schemaVersion: 2, recordId: 'r3', occurredAt: '2026-08-05T00:00:00.000Z', studentRef: 'learner:beatrice', serverCaptureStatus: 'server-answered-stop', captureOrigin: 'local-session-stop' },
        ],
        historyState: 'incomplete',
      },
      'learner:ada',
    )
    expect(status).toEqual({ hasActiveStop: true, mostRecentStopAt: '2026-08-01T00:00:00.000Z', historyState: 'incomplete' })
  })

  it('reports no active stop when this learner has no records', () => {
    const status = deriveSafetyStatus({ records: [], historyState: 'available' }, 'learner:ada')
    expect(status).toEqual({ hasActiveStop: false, mostRecentStopAt: null, historyState: 'available' })
  })
})

describe('deriveStudentSnapshot — student switching must never blend records', () => {
  it('never lets one learner\'s work items or review items leak into another learner\'s snapshot', () => {
    const learnerA: FamilyPilotLearnerOption = { hostProfileRef: 'host:a', learnerRef: 'learner:a', displayName: 'Ada' }
    const learnerB: FamilyPilotLearnerOption = { hostProfileRef: 'host:b', learnerRef: 'learner:b', displayName: 'Beatrice' }

    // Deliberately mixed, as ports.calendar.list would never actually hand
    // back — the point is to prove deriveStudentSnapshot's own learnerRef
    // filter holds even if it were ever handed unfiltered/mixed data.
    const mixedCalendar: StudyCalendarEntry[] = [
      calendarEntry({ blockRef: 'block:a-1', learnerRef: 'learner:a', state: 'active' }),
      calendarEntry({ blockRef: 'block:a-2', learnerRef: 'learner:a', state: 'paused' }),
      calendarEntry({ blockRef: 'block:b-1', learnerRef: 'learner:b', state: 'active' }),
      calendarEntry({ blockRef: 'block:b-2', learnerRef: 'learner:b', state: 'completed' }),
    ]
    const mixedReviews: StudyReviewRecommendation[] = [
      reviewRecommendation({ recommendationRef: 'rec:a-1', learnerRef: 'learner:a', status: 'pending-parent' }),
      reviewRecommendation({ recommendationRef: 'rec:b-1', learnerRef: 'learner:b', status: 'pending-parent' }),
    ]

    const snapshotA = deriveStudentSnapshot(learnerA, mixedCalendar, mixedReviews, parentSettings(), safetyLedger())
    const snapshotB = deriveStudentSnapshot(learnerB, mixedCalendar, mixedReviews, parentSettings(), safetyLedger())

    const blockRefsA = snapshotA.workItems.map((item) => item.blockRef)
    const blockRefsB = snapshotB.workItems.map((item) => item.blockRef)
    const recommendationRefsA = snapshotA.reviewItems.map((item) => item.recommendationRef)
    const recommendationRefsB = snapshotB.reviewItems.map((item) => item.recommendationRef)

    expect(blockRefsA).toEqual(['block:a-1', 'block:a-2'])
    expect(blockRefsB).toEqual(['block:b-1', 'block:b-2'])
    expect(recommendationRefsA).toEqual(['rec:a-1'])
    expect(recommendationRefsB).toEqual(['rec:b-1'])

    for (const ref of blockRefsB) expect(blockRefsA).not.toContain(ref)
    for (const ref of blockRefsA) expect(blockRefsB).not.toContain(ref)
    for (const ref of recommendationRefsB) expect(recommendationRefsA).not.toContain(ref)
    for (const ref of recommendationRefsA) expect(recommendationRefsB).not.toContain(ref)
  })
})

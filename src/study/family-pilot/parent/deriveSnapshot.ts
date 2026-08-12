import type { StudyCalendarEntry, StudyParentSettings, StudyReviewRecommendation } from '../../types'
import type { LocalSafetyStopLedgerView } from '../../safety/localStopLedger'
import type {
  FamilyPilotLearnerOption,
  FamilyPilotPauseState,
  FamilyPilotReviewItem,
  FamilyPilotSafetyStatus,
  FamilyPilotStudentSnapshot,
  FamilyPilotWorkItem,
  FamilyPilotWorkStatus,
} from './types'

/**
 * Pure derivations only — plain typed values in, plain typed values out. No
 * reflection over unknown objects, so there is nothing here for a hostile
 * prototype to attach to.
 */

function statusForEntryState(state: StudyCalendarEntry['state']): FamilyPilotWorkStatus {
  if (state === 'scheduled') return 'not-started'
  if (state === 'active') return 'in-progress'
  if (state === 'paused') return 'paused'
  return 'completed'
}

function currentSegment(entry: StudyCalendarEntry): { readonly title: string | null; readonly ordinal: number | null } {
  if (entry.resumePoint) {
    const segment = entry.segments.find((candidate) => candidate.segmentRef === entry.resumePoint?.segmentRef)
    return { title: segment?.title ?? entry.resumePoint.segmentRef, ordinal: entry.resumePoint.segmentOrdinal }
  }
  const next = entry.segments.find((candidate) => !entry.completedSegmentRefs.includes(candidate.segmentRef))
  if (!next) return { title: null, ordinal: null }
  return { title: next.title, ordinal: entry.segments.indexOf(next) + 1 }
}

function pauseStateFor(entry: StudyCalendarEntry, settings: StudyParentSettings | null): FamilyPilotPauseState | null {
  if (entry.state !== 'paused') return null
  const interruption = settings?.interruptions.find((candidate) => candidate.blockRef === entry.blockRef)
  return { blockRef: entry.blockRef, category: interruption?.kind ?? 'unspecified' }
}

function workItemFor(entry: StudyCalendarEntry, settings: StudyParentSettings | null): FamilyPilotWorkItem {
  const segment = entry.state === 'completed' ? { title: null, ordinal: null } : currentSegment(entry)
  return {
    blockRef: entry.blockRef,
    title: entry.title,
    status: statusForEntryState(entry.state),
    scheduledLocalDate: entry.intendedLocalDate,
    requiredWorkCompletionPercent: entry.requiredWorkCompletionPercent,
    currentSegmentTitle: segment.title,
    currentSegmentOrdinal: segment.ordinal,
    totalSegments: entry.segments.length,
    completedSegmentCount: entry.completedSegmentRefs.length,
    timeOnTaskSeconds: entry.resumePoint?.elapsedActiveSecondsInSegment ?? null,
    pauseState: pauseStateFor(entry, settings),
  }
}

function reviewItemFor(recommendation: StudyReviewRecommendation): FamilyPilotReviewItem {
  return {
    recommendationRef: recommendation.recommendationRef,
    dueDate: recommendation.dueDate,
    reasonCodes: recommendation.reasonCodes,
    status: recommendation.status,
  }
}

export function deriveSafetyStatus(ledger: LocalSafetyStopLedgerView, learnerRef: string): FamilyPilotSafetyStatus {
  const records = ledger.records.filter((record) => record.studentRef === learnerRef)
  const mostRecentStopAt = records.reduce<string | null>(
    (latest, record) => (!latest || record.occurredAt > latest ? record.occurredAt : latest),
    null,
  )
  return { hasActiveStop: records.length > 0, mostRecentStopAt, historyState: ledger.historyState }
}

/**
 * Builds one student's snapshot from that student's own data only. The
 * explicit `learnerRef` filters below are the guarantee that a caller who
 * accidentally hands in another learner's calendar/review rows can never
 * have them appear against this learner — student switching must never
 * blend records.
 */
export function deriveStudentSnapshot(
  learner: FamilyPilotLearnerOption,
  calendar: readonly StudyCalendarEntry[],
  reviews: readonly StudyReviewRecommendation[],
  settings: StudyParentSettings | null,
  safetyLedger: LocalSafetyStopLedgerView,
): FamilyPilotStudentSnapshot {
  const workItems = calendar
    .filter((entry) => entry.learnerRef === learner.learnerRef)
    .map((entry) => workItemFor(entry, settings))
  const reviewItems = reviews
    .filter((recommendation) => recommendation.learnerRef === learner.learnerRef && recommendation.status === 'pending-parent')
    .map(reviewItemFor)
  const counts = {
    notStarted: workItems.filter((item) => item.status === 'not-started').length,
    inProgress: workItems.filter((item) => item.status === 'in-progress').length,
    paused: workItems.filter((item) => item.status === 'paused').length,
    completed: workItems.filter((item) => item.status === 'completed').length,
  }
  return {
    learner,
    workItems,
    reviewItems,
    safety: deriveSafetyStatus(safetyLedger, learner.learnerRef),
    counts,
  }
}

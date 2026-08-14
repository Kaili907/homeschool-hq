import type { FamilyPilotReviewItem, FamilyPilotStudentSnapshot, FamilyPilotWorkItem } from '../parent/types'
import type { FamilyWeeklySummary, ReportAttentionItem, ReportTotals, StudentDailyReport, StudentWeeklyReport } from './types'

/**
 * Pure report builders only — plain typed values in, plain typed values
 * out. Every count/aggregate below is derived directly from the work and
 * review items already filtered to one learner by deriveStudentSnapshot;
 * nothing here reaches into a store, a clock, or unknown/untrusted input.
 */

function attentionFromPausedItem(item: FamilyPilotWorkItem): ReportAttentionItem {
  return { kind: 'paused-work', blockRef: item.blockRef, recommendationRef: null, title: item.title, reasonCodes: null, dueDate: null }
}

function attentionFromReview(review: FamilyPilotReviewItem): ReportAttentionItem {
  return { kind: 'review-needed', blockRef: null, recommendationRef: review.recommendationRef, title: null, reasonCodes: review.reasonCodes, dueDate: review.dueDate }
}

function totalsFor(items: readonly FamilyPilotWorkItem[], reviews: readonly FamilyPilotReviewItem[]): ReportTotals {
  const assignmentsCompleted = items.filter((item) => item.status === 'completed').length
  const current = items.find((item) => item.status === 'in-progress') ?? items.find((item) => item.status === 'paused') ?? null
  const timeValues = items.map((item) => item.timeOnTaskSeconds).filter((value): value is number => value !== null)

  return {
    assignmentsStarted: items.filter((item) => item.status !== 'not-started').length,
    assignmentsCompleted,
    // Each calendar block is bound to exactly one lesson, so lesson and
    // assignment completion counts coincide in this data model.
    lessonsCompleted: assignmentsCompleted,
    currentLesson: current?.title ?? null,
    currentSegment: current?.currentSegmentTitle ?? null,
    timeOnTaskSeconds: timeValues.length > 0 ? timeValues.reduce((sum, value) => sum + value, 0) : null,
    openWorkCount: items.filter((item) => item.status === 'in-progress' || item.status === 'paused').length,
    pausedWorkCount: items.filter((item) => item.status === 'paused').length,
    // Scheduled-work completion only. Do not average segment percentages from
    // unlike lessons or present that average as course/subject completion.
    completionPercent:
      items.length > 0 ? Math.round(assignmentsCompleted / items.length * 100) : null,
    itemsNeedingParentAttention: [
      ...items.filter((item) => item.status === 'paused').map(attentionFromPausedItem),
      ...reviews.map(attentionFromReview),
    ],
    items,
  }
}

export function buildStudentDailyReport(snapshot: FamilyPilotStudentSnapshot, date: string): StudentDailyReport {
  const items = snapshot.workItems.filter((item) => item.scheduledLocalDate === date)
  const reviews = snapshot.reviewItems.filter((review) => review.dueDate <= date)
  return {
    learnerRef: snapshot.learner.learnerRef,
    displayName: snapshot.learner.displayName,
    date,
    ...totalsFor(items, reviews),
  }
}

export function buildStudentWeeklyReport(
  snapshot: FamilyPilotStudentSnapshot,
  range: { readonly startDate: string; readonly endDate: string },
): StudentWeeklyReport {
  const items = snapshot.workItems.filter(
    (item) => item.scheduledLocalDate >= range.startDate && item.scheduledLocalDate <= range.endDate,
  )
  const reviews = snapshot.reviewItems.filter((review) => review.dueDate <= range.endDate)
  return {
    learnerRef: snapshot.learner.learnerRef,
    displayName: snapshot.learner.displayName,
    startDate: range.startDate,
    endDate: range.endDate,
    ...totalsFor(items, reviews),
  }
}

export function buildFamilyWeeklySummary(
  snapshots: readonly FamilyPilotStudentSnapshot[],
  range: { readonly startDate: string; readonly endDate: string },
): FamilyWeeklySummary {
  return {
    startDate: range.startDate,
    endDate: range.endDate,
    studentReports: snapshots.map((snapshot) => buildStudentWeeklyReport(snapshot, range)),
  }
}

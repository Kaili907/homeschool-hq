import type { FamilyPilotWorkItem } from '../parent/types'

/**
 * Parent-facing progress report contracts. Built entirely from the same
 * minimized fields already exposed on FamilyPilotStudentSnapshot — no raw
 * learner answers, tutor transcripts, or emotional/diagnostic inference, and
 * nothing here introduces a new persistence store.
 */

export type ReportAttentionKind = 'paused-work' | 'review-needed'

export interface ReportAttentionItem {
  readonly kind: ReportAttentionKind
  readonly blockRef: string | null
  readonly recommendationRef: string | null
  readonly title: string | null
  readonly reasonCodes: readonly string[] | null
  readonly dueDate: string | null
}

export interface ReportTotals {
  readonly assignmentsStarted: number
  readonly assignmentsCompleted: number
  readonly lessonsCompleted: number
  readonly currentLesson: string | null
  readonly currentSegment: string | null
  readonly timeOnTaskSeconds: number | null
  readonly openWorkCount: number
  readonly pausedWorkCount: number
  readonly completionPercent: number | null
  readonly itemsNeedingParentAttention: readonly ReportAttentionItem[]
  readonly items: readonly FamilyPilotWorkItem[]
}

export interface StudentDailyReport extends ReportTotals {
  readonly learnerRef: string
  readonly displayName: string
  readonly date: string
}

export interface StudentWeeklyReport extends ReportTotals {
  readonly learnerRef: string
  readonly displayName: string
  readonly startDate: string
  readonly endDate: string
}

export interface FamilyWeeklySummary {
  readonly startDate: string
  readonly endDate: string
  readonly studentReports: readonly StudentWeeklyReport[]
}

export type StudentReport = StudentDailyReport | StudentWeeklyReport

// MA — fixed-form assessment player. Self-contained types (no dependency on the
// main app types beyond what's re-exported into Profile as an OPTIONAL field).

export type ItemKind = 'numeric' | 'text' | 'choice' | 'longtext'

export interface Item {
  id: string
  prompt: string
  kind: ItemKind
  choices?: string[]
  /** Machine key. Absent = human-graded. string[] = every value must appear (order-free). */
  key?: string | string[]
  /** Grading guidance transcribed from the source, shown to Dad on the results screen. */
  keyNote?: string
}

export interface Section {
  name: string
  /** Rendered on-screen above the section's questions (reading passages). */
  passage?: string
  items: Item[]
}

export interface FixedTest {
  id: string
  title: string
  /** Verbatim intro shown before the start-code gate. */
  intro?: string
  sections: Section[]
  forGrades: string[]
  /** Essay/longtext timing. Absent = untimed. */
  timerSec?: number
  /** true = timer warns but never locks (senior Part 3B); false/absent = hard lock. */
  softTimer?: boolean
  /** Flagged as not graded (senior 3B, survey). */
  ungraded?: boolean
  /** Show the scratch-work photo reminder on intro/outro (math tests). */
  scratchReminder?: boolean
}

export interface ItemAnswer {
  value: string
  skipped: boolean
  msOnItem: number
}

export interface Attempt {
  testId: string
  profileId: string
  startedAt: string
  finishedAt?: string
  answers: Record<string, ItemAnswer>
  autoScore?: AutoScore
}

export interface AutoScore {
  bySection: Record<string, { correct: number; of: number }>
  /** items needing human grading (no key, or answered but not confidently matched) */
  gradedItems: number
  skips: number
}

export interface Assignment {
  testId: string
  startCode: string
  assignedAt: string
}

/** New OPTIONAL Profile field (no schemaVersion bump; runtime default below). */
export interface AssessmentState {
  assigned: Assignment[]
  attempts: Attempt[]
  /** testIds Dad has unlocked for one more attempt (consumed when a new attempt starts). */
  retakeUnlocked?: string[]
}

export const emptyAssessmentState = (): AssessmentState => ({
  assigned: [],
  attempts: [],
  retakeUnlocked: [],
})

export type ScoreVerdict = 'correct' | 'incorrect' | 'unmatched' | 'ungraded' | 'skip'

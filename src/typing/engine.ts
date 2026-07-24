import type { Grade, ISODate, Profile, TypingLessonState, TypingState } from '../types'
import { LESSONS, type Lesson } from './lessons'

/**
 * SE-A typing trainer "MK" — pure logic over the additive optional Profile.typing
 * field (see types.ts). No schemaVersion bump; every read defaults gracefully.
 *
 * Design rules (per SE-A cycle):
 *  - Accuracy gates advancement (90%). Speed is pacing guidance only, never a gate.
 *  - Errors are not penalties — they simply don't count toward correct chars.
 *  - Drill text comes only from the neutral lesson banks (src/typing/lessons.ts),
 *    never from assessment/curriculum content.
 */

/** A lesson is mastered (and the next unlocks) at 90% accuracy. */
export const MASTERY_ACCURACY = 90

/** A drill session lasts five minutes. */
export const DRILL_SECONDS = 5 * 60

export interface DrillResult {
  lessonId: string
  /** characters typed that matched the target text. */
  correctChars: number
  /** total characters the girl typed (correct + mistyped). */
  typedChars: number
  /** elapsed active drill time in milliseconds. */
  elapsedMs: number
}

/**
 * Standard WPM: one "word" = 5 characters, counted on CORRECT characters only,
 * over elapsed minutes. Guards against zero/negative elapsed. Rounded to a whole
 * number (kid-facing).
 */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0 || correctChars <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round(correctChars / 5 / minutes)
}

/**
 * Accuracy as a whole percentage of typed characters that were correct.
 * With nothing typed yet we show a friendly 100 (no errors to report).
 */
export function computeAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars <= 0) return 100
  const clampedCorrect = Math.max(0, Math.min(correctChars, typedChars))
  return Math.round((clampedCorrect / typedChars) * 100)
}

/** Year-end WPM goal by grade (pacing guidance, shown as a growing goal bar). */
export function gradeWpmTarget(grade: Grade): number {
  if (grade === '3') return 15
  if (grade === '4') return 20
  if (grade === '6') return 30
  return 20
}

/** Accuracy mastery test — the only advancement gate. */
export function isMastered(accuracy: number): boolean {
  return accuracy >= MASTERY_ACCURACY
}

export function defaultTypingState(): TypingState {
  return { unlockedIndex: 0, lessons: {}, drillsCompleted: 0 }
}

/** Read typing state off a profile with a graceful default (old profiles have none). */
export function getTypingState(p: Profile): TypingState {
  return p.typing ?? defaultTypingState()
}

export function lessonIndexById(id: string): number {
  return LESSONS.findIndex((l) => l.id === id)
}

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id)
}

/** Lessons the girl may currently play (0..unlockedIndex, clamped to the ladder). */
export function unlockedLessons(state: TypingState): Lesson[] {
  const top = Math.min(state.unlockedIndex, LESSONS.length - 1)
  return LESSONS.slice(0, top + 1)
}

/** True once every lesson on the ladder has been passed. */
export function ladderComplete(state: TypingState): boolean {
  return LESSONS.every((l) => state.lessons[l.id]?.passed)
}

/**
 * Build neutral drill text for a lesson by drawing from its bank. Deterministic
 * when `pick` is supplied (tests pass a seeded picker); defaults to Math.random.
 * 'keys' lessons string short key-groups together; 'words'/'sentences' join the
 * chosen bank entries with spaces. `targetChars` keeps a 5-minute drill supplied.
 */
export function buildDrillText(
  lesson: Lesson,
  targetChars = 320,
  pick: (n: number) => number = (n) => Math.floor(Math.random() * n),
): string {
  const bank = lesson.bank
  if (bank.length === 0) return ''
  const parts: string[] = []
  let len = 0
  let guard = 0
  while (len < targetChars && guard < 5000) {
    guard++
    const token = bank[pick(bank.length)]
    parts.push(token)
    len += token.length + 1
  }
  return parts.join(' ').trim()
}

/**
 * Fold a finished drill into typing state — PURE and FUNCTIONAL (prev => next).
 * Per-lesson best stats only ever improve; `passed` latches once 90% is hit.
 * The frontier advances (next lesson unlocks) only when the mastered lesson is
 * the current top unlocked lesson, so mastery is earned in ladder order.
 */
export function applyDrillResult(
  prev: TypingState,
  result: DrillResult,
  today: ISODate,
): TypingState {
  const idx = lessonIndexById(result.lessonId)
  if (idx < 0) return prev // unknown lesson: leave state untouched

  const accuracy = computeAccuracy(result.correctChars, result.typedChars)
  const wpm = computeWpm(result.correctChars, result.elapsedMs)
  const mastered = isMastered(accuracy)

  const before: TypingLessonState =
    prev.lessons[result.lessonId] ?? { bestAccuracy: 0, bestWpm: 0, passed: false }

  const nextLesson: TypingLessonState = {
    bestAccuracy: Math.max(before.bestAccuracy, accuracy),
    bestWpm: Math.max(before.bestWpm, wpm),
    passed: before.passed || mastered,
    lastSeen: today,
  }

  const advances = mastered && idx === prev.unlockedIndex
  const unlockedIndex = advances
    ? Math.min(prev.unlockedIndex + 1, LESSONS.length - 1)
    : prev.unlockedIndex

  return {
    ...prev,
    unlockedIndex,
    lessons: { ...prev.lessons, [result.lessonId]: nextLesson },
    drillsCompleted: prev.drillsCompleted + 1,
    lastPracticedDate: today,
  }
}

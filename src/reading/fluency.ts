import type { ISODate, Profile, ReadingCalibration, ReadingMode, ReadingSessionLog, ReadingState } from '../types'
import { passagesForGrade, type Passage, type ReadingGrade } from './passages'
import type { AlignmentResult } from './align'

/**
 * MR reading fluency — pure logic over the additive optional `Profile.reading`
 * field (see types.ts). No schemaVersion bump; every read defaults gracefully.
 *
 * Everything WCPM here is an ESTIMATE (browser recognition + alignment) unless
 * the mode is 'manual' (Dad counted by hand). The UI labels it "estimated"
 * wherever a number renders; trends are the product, single readings are noise.
 */

// ---------- state accessors ----------

export function defaultReadingState(): ReadingState {
  return { sessions: [], seenPassageIds: [], calibrations: [] }
}

export function getReadingState(p: Profile): ReadingState {
  return p.reading ?? defaultReadingState()
}

/** Keep the seen-list bounded; the spacing window only needs recent history. */
const SEEN_CAP = 100

// ---------- WCPM ----------

/** words-correct-per-minute, rounded, guarding zero/negative time. Always an estimate. */
export function estimateWcpm(correct: number, durationSec: number): number {
  if (durationSec <= 0 || correct <= 0) return 0
  return Math.round(correct / (durationSec / 60))
}

/** Build a session log from an alignment result + elapsed time (the estimated path). */
export function sessionFromAlignment(
  date: ISODate,
  passageId: string,
  align: AlignmentResult,
  durationSec: number,
): ReadingSessionLog {
  return {
    date,
    passageId,
    mode: 'estimated',
    wcpm: estimateWcpm(align.correct, durationSec),
    wordsPracticed: align.practiceWords,
    durationSec,
  }
}

/** Build a session log for the offline / Dad-scored path (manual words-correct). */
export function manualSession(
  date: ISODate,
  passageId: string,
  wordsCorrect: number,
  durationSec: number,
): ReadingSessionLog {
  return {
    date,
    passageId,
    mode: 'manual',
    wcpm: estimateWcpm(wordsCorrect, durationSec),
    wordsPracticed: [],
    durationSec,
  }
}

// ---------- functional state folds (prev => next) ----------

/** Fold a finished reading session into profile state — PURE and FUNCTIONAL. */
export function recordReadingSession(p: Profile, log: ReadingSessionLog): Profile {
  const prev = getReadingState(p)
  const seen = [...prev.seenPassageIds, log.passageId].slice(-SEEN_CAP)
  const next: ReadingState = {
    ...prev,
    sessions: [...prev.sessions, log],
    seenPassageIds: seen,
    lastReadDate: log.date,
  }
  return { ...p, reading: next }
}

/** Record that a passage was served (for spacing) WITHOUT logging a completed read. */
export function markPassageServed(p: Profile, passageId: string): Profile {
  const prev = getReadingState(p)
  const seen = [...prev.seenPassageIds, passageId].slice(-SEEN_CAP)
  return { ...p, reading: { ...prev, seenPassageIds: seen } }
}

/** Add a Dad calibration check (ground-truth WCPM). */
export function addCalibration(p: Profile, cal: ReadingCalibration): Profile {
  const prev = getReadingState(p)
  return { ...p, reading: { ...prev, calibrations: [...prev.calibrations, cal] } }
}

// ---------- passage selection (spacing / no-repeat) ----------

/**
 * Pick the next passage for a grade. Fluency-check days want a FRESH unseen
 * passage; dailies pick the least-recently-seen (so nothing repeats until the
 * whole grade pool has cycled — the spacing window). `pick` breaks ties
 * deterministically (tests pass a fixed picker; default is first).
 */
export function selectPassage(
  state: ReadingState,
  grade: ReadingGrade,
  opts: { fluencyCheck?: boolean } = {},
  pick: (n: number) => number = () => 0,
): Passage | undefined {
  const pool = passagesForGrade(grade)
  if (pool.length === 0) return undefined
  const lastSeen = (id: string) => state.seenPassageIds.lastIndexOf(id)

  const unseen = pool.filter((p) => lastSeen(p.id) === -1)
  const candidates = opts.fluencyCheck ? (unseen.length > 0 ? unseen : pool) : pool

  const minIdx = Math.min(...candidates.map((p) => lastSeen(p.id)))
  const leastRecent = candidates.filter((p) => lastSeen(p.id) === minIdx)
  return leastRecent[pick(leastRecent.length) % leastRecent.length]
}

// ---------- benchmarks (Dad-only trend context, never a kid-facing bar) ----------

export interface Benchmark {
  /** approximate entering-year WCPM for the grade. */
  entering: number
  /** approximate year-end target (a band above entering). */
  yearEnd: number
}

/** Oral-reading fluency context lines for the Grown-Ups chart. Display-only. */
export function benchmarkFor(grade: ReadingGrade): Benchmark {
  switch (grade) {
    case '3':
      return { entering: 80, yearEnd: 110 }
    case '4':
      return { entering: 95, yearEnd: 125 }
    case '6':
      return { entering: 130, yearEnd: 160 }
  }
}

// ---------- trends, streaks, practice words ----------

export interface TrendPoint {
  date: ISODate
  wcpm: number
  mode: ReadingMode
  /** false only for manual/assessed ground-truth points. */
  estimated: boolean
}

/** Session WCPM series (estimates + manual), oldest first. */
export function wcpmTrend(state: ReadingState): TrendPoint[] {
  return state.sessions.map((s) => ({
    date: s.date,
    wcpm: s.wcpm,
    mode: s.mode,
    estimated: s.mode === 'estimated',
  }))
}

/** Dad's calibration series (ground truth), oldest first. */
export function calibrationTrend(state: ReadingState): { date: ISODate; wcpm: number }[] {
  return state.calibrations.map((c) => ({ date: c.date, wcpm: c.wcpm }))
}

function addDays(iso: ISODate, delta: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function toDate(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86_400_000)
}

/** Consecutive reading days ending at the most recent reading day. */
export function readingStreak(state: ReadingState): number {
  const days = new Set(state.sessions.map((s) => s.date))
  if (days.size === 0) return 0
  const latest = [...days].sort()[days.size - 1]
  let streak = 0
  let cursor = latest
  while (days.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export interface WordFreq {
  word: string
  count: number
}

/** Practice-word frequency across all sessions (a recurring word = a phonics signal). */
export function practiceWordFrequency(state: ReadingState): WordFreq[] {
  const counts = new Map<string, number>()
  for (const s of state.sessions) {
    for (const w of s.wordsPracticed) {
      const key = w.toLowerCase()
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
}

/**
 * "Words I conquered" — words flagged for practice in an earlier session that did
 * NOT reappear in the latest session (she read them cleanly since). Celebrate these.
 */
export function conqueredWords(state: ReadingState): string[] {
  if (state.sessions.length < 2) return []
  const lastIdx = state.sessions.length - 1
  const lastPracticedAt = new Map<string, number>()
  for (let i = 0; i < state.sessions.length; i++) {
    for (const w of state.sessions[i].wordsPracticed) {
      lastPracticedAt.set(w.toLowerCase(), i)
    }
  }
  const conquered: string[] = []
  for (const [word, idx] of lastPracticedAt) {
    if (idx < lastIdx) conquered.push(word)
  }
  return conquered.sort()
}

// ---------- calibration reminder ----------

/** ~2-week manual-check cadence. */
export const CALIBRATION_INTERVAL_DAYS = 14

/**
 * True when Dad is due for a manual 1-minute calibration: she has read at least
 * once, and either he has never calibrated or it has been ≥2 weeks.
 */
export function needsCalibration(state: ReadingState, today: ISODate): boolean {
  if (state.sessions.length === 0) return false
  if (state.calibrations.length === 0) return true
  const last = state.calibrations[state.calibrations.length - 1].date
  return daysBetween(last, today) >= CALIBRATION_INTERVAL_DAYS
}

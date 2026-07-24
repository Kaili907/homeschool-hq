import type { AppState, MindsetState, MindsetWeekState, MissionItem, Profile } from '../types'
import { MINDSET_TOTAL_WEEKS, MINDSET_WEEKS, mindsetWeek, type MindsetWeek } from './content'

/**
 * MM — pure mindset logic. Imports ONLY types + content (never appState/missions),
 * so it stays side-effect-free and unit-testable, and so appState can import the
 * export sanitizer from here without a cycle.
 *
 * Two load-bearing rules live here:
 *  1. Weekly unlock — one idea per week; earlier weeks revisitable, future weeks locked.
 *  2. PRIVACY — journal/reflection text is private to the profile. `sanitizeStateForExport`
 *     strips it from the standard export-all, and `mindsetCompletionSummary` (the only
 *     thing the Grown-Ups panel reads) exposes completion booleans, never text.
 */

// ---------- band (which variant this girl sees) ----------

export type MindsetBand = 'littles' | 'core' | 'teens'

/**
 * littles = playful-theme profiles (grades 3–4): large type, read-aloud, emoji/one-word.
 * teens = grades 10–12: core + extension + journal.
 * core = everyone else (grade 6): core + journal.
 */
export function mindsetBand(p: Profile): MindsetBand {
  if (p.grade === '10' || p.grade === '12') return 'teens'
  if (p.theme === 'playful') return 'littles'
  return 'core'
}

/** littles reflect with an emoji/word; 6th+ and teens journal. */
export const bandUsesJournal = (band: MindsetBand): boolean => band !== 'littles'
/** littles get read-aloud auto-offered (speechSynthesis via the MT-V "mindset" slot). */
export const bandReadAloud = (band: MindsetBand): boolean => band === 'littles'

// ---------- date helpers (local calendar, matches missions.isFridayDate) ----------

const pad = (n: number) => String(n).padStart(2, '0')
const dateOf = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const toISO = (dt: Date): string => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return toISO(new Date(y, m - 1, d + n))
}
function daysBetween(aISO: string, bISO: string): number {
  return Math.round((dateOf(bISO).getTime() - dateOf(aISO).getTime()) / 86_400_000)
}

// ---------- weekly unlock ----------

/** The first Friday on or after the school-start date. Week 1 unlocks here. */
export function firstFridayOnOrAfter(startISO: string): string {
  const dow = dateOf(startISO).getDay() // Sun=0 … Fri=5 … Sat=6
  const offset = (5 - dow + 7) % 7
  return addDaysISO(startISO, offset)
}

/** The date week N (1-based) unlocks: the Nth Friday of the school year. */
export function weekUnlockDate(startISO: string, week: number): string {
  return addDaysISO(firstFridayOnOrAfter(startISO), (week - 1) * 7)
}

/**
 * How many weeks are unlocked as of `today`, given the Dad-set start date.
 * 0 when no start date, or when today precedes the first Friday. Capped at the
 * number of weeks in the loaded curriculum — no binging past what exists.
 */
export function unlockedWeekCount(startISO: string | undefined, todayISO: string): number {
  if (!startISO) return 0
  const ff = firstFridayOnOrAfter(startISO)
  const d = daysBetween(ff, todayISO)
  if (d < 0) return 0
  return Math.min(MINDSET_TOTAL_WEEKS, Math.floor(d / 7) + 1)
}

/** A week is playable iff it is 1..unlockedWeekCount. Future weeks are locked. */
export function isWeekUnlocked(startISO: string | undefined, todayISO: string, week: number): boolean {
  return week >= 1 && week <= unlockedWeekCount(startISO, todayISO)
}

/** The latest unlocked week — drives the mission item and the home habit card. 0 = none yet. */
export function currentWeek(startISO: string | undefined, todayISO: string): number {
  return unlockedWeekCount(startISO, todayISO)
}

/** Every week she may open right now (earlier weeks stay revisitable). */
export function openableWeeks(startISO: string | undefined, todayISO: string): number[] {
  const n = unlockedWeekCount(startISO, todayISO)
  return Array.from({ length: n }, (_, i) => i + 1)
}

/**
 * The lesson content for a week — but ONLY if it is unlocked. Locked weeks return
 * undefined regardless of any injected profile state, so a hand-edited store cannot
 * surface future content by navigation or state editing.
 */
export function getUnlockedLesson(
  startISO: string | undefined,
  todayISO: string,
  week: number,
): MindsetWeek | undefined {
  return isWeekUnlocked(startISO, todayISO, week) ? mindsetWeek(week) : undefined
}

// ---------- per-week progress ----------

export function getWeekState(p: Profile, week: number): MindsetWeekState {
  return p.mindset?.weeks?.[week] ?? {}
}

export const isWeekComplete = (p: Profile, week: number): boolean => !!getWeekState(p, week).completedAt

function withWeek(p: Profile, week: number, next: MindsetWeekState): Profile {
  const prev = p.mindset ?? { weeks: {} }
  return { ...p, mindset: { weeks: { ...prev.weeks, [week]: next } } }
}

/** viewed && reflected → completed (stamp today, once). */
function recompute(ws: MindsetWeekState, todayISO: string): MindsetWeekState {
  if (ws.viewed && ws.reflected && !ws.completedAt) return { ...ws, completedAt: todayISO }
  return ws
}

/** She reached the end of the lesson text. Idempotent. */
export function markViewed(p: Profile, week: number, todayISO: string): Profile {
  const ws = getWeekState(p, week)
  return withWeek(p, week, recompute({ ...ws, viewed: true }, todayISO))
}

/**
 * Autosave a journal draft as she types — persists the text WITHOUT completing.
 * "Done" (submitReflection) is the deliberate act that marks it reflected.
 */
export function saveJournalDraft(p: Profile, week: number, text: string): Profile {
  const ws = getWeekState(p, week)
  return withWeek(p, week, { ...ws, reflection: text })
}

/**
 * Submit the reflection. For littles a non-empty value (emoji or one word) is required;
 * for 6th+/teens journaling, tapping Done is enough even with empty text — we never force
 * disclosure to a text box. Returns the profile unchanged if a littles value is empty.
 */
export function submitReflection(
  p: Profile,
  week: number,
  band: MindsetBand,
  value: string,
  todayISO: string,
): Profile {
  const text = value ?? ''
  if (band === 'littles' && !text.trim()) return p // must tap an emoji / type a word
  const ws = getWeekState(p, week)
  return withWeek(p, week, recompute({ ...ws, reflection: text, reflected: true }, todayISO))
}

// ---------- mission item seam (Session C owns missions.ts; this is the ready hook) ----------

export const MINDSET_MISSION_ID = 'mindset-lesson'
export const MINDSET_MISSION_LABEL = '🧠 Mindset lesson'

/**
 * The Morning-Mission representation of the current week's lesson. `present` is true
 * once at least one week is unlocked; `item.done` mirrors week completion. missions.ts
 * (Session C) can splice `item` into buildMissionDay so it auto-checks on completion —
 * that wiring is intentionally DEFERRED this cycle; the lesson stays openable from the
 * dedicated home card meanwhile.
 */
export function mindsetMissionItem(
  p: Profile,
  startISO: string | undefined,
  todayISO: string,
): { present: boolean; item: MissionItem } {
  const week = currentWeek(startISO, todayISO)
  return {
    present: week >= 1,
    item: { id: MINDSET_MISSION_ID, label: MINDSET_MISSION_LABEL, done: week >= 1 && isWeekComplete(p, week) },
  }
}

// ---------- PRIVACY: completion-only panel view + export sanitizer ----------

export interface MindsetCompletionRow {
  week: number
  title: string
  completed: boolean
}

/**
 * The ONLY mindset data the Grown-Ups panel may read: completion status per week.
 * By construction it carries no reflection text, no excerpts, and no word counts.
 */
export function mindsetCompletionSummary(p: Profile): MindsetCompletionRow[] {
  return MINDSET_WEEKS.map((w) => ({ week: w.week, title: w.title, completed: isWeekComplete(p, w.week) }))
}

/** Strip a single profile's journal/reflection text, keeping only completion signals. */
function sanitizeProfileMindset(m: MindsetState | undefined): MindsetState | undefined {
  if (!m) return m
  const weeks: Record<number, MindsetWeekState> = {}
  for (const [k, ws] of Object.entries(m.weeks)) {
    // drop `reflection` entirely; keep viewed/reflected/completedAt
    const { reflection: _omit, ...rest } = ws
    void _omit
    weeks[Number(k)] = rest
  }
  return { weeks }
}

/**
 * Produce an export-safe copy of the whole app state: every profile's private mindset
 * reflection text is removed. The standard export-all serializes THIS, never the raw
 * state — so no journal text can ride out in a Dad backup.
 */
export function sanitizeStateForExport(state: AppState): AppState {
  return {
    ...state,
    profiles: Object.fromEntries(
      Object.entries(state.profiles).map(([id, p]) => [
        id,
        p.mindset ? { ...p, mindset: sanitizeProfileMindset(p.mindset) } : p,
      ]),
    ),
  }
}

// ---------- the girl's own "export MY journal" (positive control — includes text) ----------

/**
 * Serialize THIS girl's journal, text included. Called only from inside her own
 * signed-in mindset view (never from the Grown-Ups panel or the standard export).
 */
export function serializeMyJournal(p: Profile): string {
  const entries = MINDSET_WEEKS.map((w) => {
    const ws = getWeekState(p, w.week)
    const prompt = mindsetBand(p) === 'littles' ? w.reflectLittles.prompt : w.reflect[0]
    return {
      week: w.week,
      title: w.title,
      prompt,
      reflection: ws.reflection ?? '',
      completed: !!ws.completedAt,
    }
  }).filter((e) => e.reflection.trim() !== '' || e.completed)
  return JSON.stringify({ profile: p.name, kind: 'mindset-journal', entries }, null, 2)
}

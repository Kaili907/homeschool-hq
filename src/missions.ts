import type {
  AutoKind,
  Grade,
  MissionDay,
  MissionTemplate,
  MissionTemplateItem,
  Profile,
  Weekday,
} from './types'
import { isoToday } from './appState'

// ============================================================================
// SE-B owns this file this wave (Sessions A/B must not touch it). It carries the
// mission-template system: grade defaults, cadence-aware day building, the auto-
// check hooks that flip items when an in-app activity finishes, and the per-girl
// "apply new defaults" merge.
// ============================================================================

// ---------- shared item builders ----------

/** The daily 5-minute typing drill (SE-A). Flips when a drill completes. First after sign-in. */
const TYPING_ITEM: MissionTemplateItem = {
  id: 'typing',
  label: 'Typing — 5 minutes',
  auto: true,
  autoKind: 'typing',
}

/** Littles' Tue/Thu paper handwriting (SE card #5). Manual — graded only by "did it happen". */
const HANDWRITING_ITEM: MissionTemplateItem = {
  id: 'handwriting',
  label: 'Handwriting ✋ (Tue/Thu)',
  days: [2, 4],
}

/** The 11:30 Japanese block the 6th grader now joins (SE card #3). Manual, daily. */
const JAPANESE_ITEM: MissionTemplateItem = {
  id: 'japanese',
  label: 'Japanese ✋',
}

/** One 10-minute weekly news item (SE card #14), 6th grade and up. Manual, once/week. */
const CURRENT_EVENTS_ITEM: MissionTemplateItem = {
  id: 'current-events',
  label: 'Current events ✋ (1×/week)',
  weeklyOnce: true,
}

/** Senior SAT-prep block (SE card #4): 3×/week, fall term only. Mon/Tue/Wed (off the light Friday). */
const SAT_PREP_ITEM: MissionTemplateItem = {
  id: 'sat-prep',
  label: 'SAT prep ✋ (3×/week, fall)',
  days: [1, 2, 3],
  season: 'fall',
}

/** MR reading-fluency session (grades 3/4/6). Auto-checks when an in-app reading
 *  session completes (wired in ReadingView → autoCompleteReading). Daily. */
const READING_ITEM: MissionTemplateItem = {
  id: 'reading-session',
  label: '📖 Reading',
  auto: true,
  autoKind: 'reading',
}

/** MM weekly mindset lesson (all grades). Auto-checks when the week's lesson is
 *  reflected (wired in MindsetLesson → autoCompleteMindset). Once per week. */
const MINDSET_ITEM: MissionTemplateItem = {
  id: 'mindset-lesson',
  label: '🧠 Mindset lesson (1×/week)',
  auto: true,
  autoKind: 'mindset',
  weeklyOnce: true,
}

// ---------- default templates (Dad edits these in the Grown-Ups panel) ----------

export function defaultTemplateFor(grade: Grade): MissionTemplate {
  switch (grade) {
    case '3':
      return {
        weekday: [
          TYPING_ITEM,
          { id: 'math-lesson', label: 'Math lesson with Dad' },
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-aloud', label: 'Read aloud 15 minutes' },
          READING_ITEM,
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'writing', label: 'Writing or Spelling' },
          HANDWRITING_ITEM,
          { id: 'science-ss', label: 'Science or Social Studies' },
          MINDSET_ITEM,
        ],
        friday: [
          TYPING_ITEM,
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          READING_ITEM,
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'fun-project', label: 'Fun Friday project' },
        ],
      }
    case '4':
      return {
        weekday: [
          TYPING_ITEM,
          { id: 'math-lesson', label: 'Math lesson with Dad' },
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-aloud', label: 'Read aloud 15 minutes' },
          READING_ITEM,
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'writing', label: 'Writing or Spelling' },
          HANDWRITING_ITEM,
          { id: 'science-ss', label: 'Science or Social Studies' },
          MINDSET_ITEM,
        ],
        friday: [
          TYPING_ITEM,
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          READING_ITEM,
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'fun-project', label: 'Fun Friday project' },
        ],
      }
    case '6':
      return {
        weekday: [
          TYPING_ITEM,
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'math-check', label: 'Check answers with Dad' },
          { id: 'reading', label: 'Reading 20 minutes' },
          READING_ITEM,
          { id: 'writing', label: 'Writing' },
          JAPANESE_ITEM,
          CURRENT_EVENTS_ITEM,
          { id: 'science-ss', label: 'Science or Social Studies' },
          { id: 'planner', label: 'Plan tomorrow in your planner' },
          MINDSET_ITEM,
        ],
        friday: [
          TYPING_ITEM,
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'reading', label: 'Reading 20 minutes' },
          READING_ITEM,
          { id: 'project', label: 'Friday project time' },
        ],
      }
    // CURR-1: Grades 5/7/8 run on the Manuel Academy curriculum — the daily work
    // comes from the academy schedule, so the mission list stays light: the
    // academy block plus the shared habits every grade keeps.
    case '5':
    case '7':
    case '8':
      return {
        weekday: [
          { id: 'academy-lessons', label: "Today's Academy lessons" },
          { id: 'reading', label: 'Reading 20 minutes' },
          { id: 'planner', label: 'Plan tomorrow in your planner' },
          MINDSET_ITEM,
        ],
        friday: [
          { id: 'academy-lessons', label: "Today's Academy lessons" },
          { id: 'reading', label: 'Reading 20 minutes' },
          { id: 'project', label: 'Friday project time' },
        ],
      }
    case '9':
    case '10':
      return {
        weekday: [
          { id: 'geometry', label: 'Geometry block 45 minutes' },
          { id: 'english', label: 'English' },
          { id: 'science', label: 'Science' },
          { id: 'social-studies', label: 'Social Studies' },
          CURRENT_EVENTS_ITEM,
          { id: 'elective', label: 'Elective' },
          MINDSET_ITEM,
        ],
        friday: [
          { id: 'geometry', label: 'Geometry review 30 minutes' },
          { id: 'english', label: 'English' },
          { id: 'catch-up', label: 'Catch-up or elective' },
        ],
      }
    case '11':
    case '12':
      return {
        // math block pinned first by default order
        weekday: [
          { id: 'math-block', label: 'Math block 60–75 minutes' },
          { id: 'english', label: 'English' },
          { id: 'gov-econ', label: 'Government / Economics' },
          { id: 'science', label: 'Science' },
          SAT_PREP_ITEM,
          CURRENT_EVENTS_ITEM,
          { id: 'college-app', label: 'College-app task of the day' },
          MINDSET_ITEM,
        ],
        friday: [
          { id: 'math-block', label: 'Math block 60 minutes' },
          { id: 'college-app', label: 'College-app task of the day' },
          { id: 'catch-up', label: 'Catch-up' },
        ],
      }
  }
}

export const templateFor = (p: Profile): MissionTemplate =>
  p.template ?? defaultTemplateFor(p.grade)

// ---------- calendar helpers ----------

/** ISO weekday, Mon=1 … Sun=7, for a local YYYY-MM-DD. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  const js = new Date(y, m - 1, d).getDay() // Sun=0 … Sat=6
  return js === 0 ? 7 : js
}

export function isFridayDate(iso: string): boolean {
  return weekdayOf(iso) === 5
}

/** Fall term = August–December, when the senior SAT-prep block runs. */
export function isFallTerm(iso: string): boolean {
  const month = Number(iso.split('-')[1])
  return month >= 8 && month <= 12
}

/** Weekly-once items surface on this weekday (Wednesday — most reliably a school day). */
const WEEKLY_ANCHOR: Weekday = 3

export function isoYesterday(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// ---------- day building ----------

/**
 * Does a template item occur on this date? Cadence flags (days / weeklyOnce /
 * season) narrow an item to specific school days; an item with no flags appears
 * every school day (the legacy behaviour). Combined flags all have to pass.
 */
export function itemOccursOn(item: MissionTemplateItem, iso: string): boolean {
  const wd = weekdayOf(iso)
  if (item.season === 'fall' && !isFallTerm(iso)) return false
  if (item.days && !item.days.includes(wd as Weekday)) return false
  if (item.weeklyOnce && wd !== WEEKLY_ANCHOR) return false
  return true
}

/**
 * Build a mission day for a specific date. The Friday light-day list still swaps
 * in on Fridays; then each item is filtered by its cadence (see itemOccursOn).
 */
export function buildMissionDay(t: MissionTemplate, iso: string): MissionDay {
  const src = isFridayDate(iso) && t.friday.length > 0 ? t.friday : t.weekday
  return {
    items: src
      .filter((i) => itemOccursOn(i, iso))
      .map((i) => ({
        id: i.id,
        label: i.label,
        done: false,
        ...(i.auto ? { auto: true } : {}),
        ...(i.autoKind ? { autoKind: i.autoKind } : {}),
      })),
  }
}

/** Make sure today's mission exists (generated from the template on first view). */
export function ensureToday(p: Profile, today: string = isoToday()): Profile {
  if (p.missions[today]) return p
  return {
    ...p,
    missions: {
      ...p.missions,
      [today]: buildMissionDay(templateFor(p), today),
    },
  }
}

export function isDayComplete(day: MissionDay | undefined): boolean {
  return !!day && day.items.length > 0 && day.items.every((i) => i.done)
}

// ---------- updates ----------

/** Day just completed → consecutive-day streak bump (counts once per day). */
function maybeBumpStreak(p: Profile, today: string): Profile {
  if (!isDayComplete(p.missions[today])) return p
  if (p.streaks.lastActiveDate === today) return p
  const current = p.streaks.lastActiveDate === isoYesterday(today) ? p.streaks.current + 1 : 1
  return {
    ...p,
    streaks: {
      current,
      best: Math.max(p.streaks.best, current),
      lastActiveDate: today,
    },
  }
}

/** Check/uncheck a manual item. */
export function setItemDone(
  p: Profile,
  itemId: string,
  done: boolean,
  today: string = isoToday(),
): Profile {
  const withDay = ensureToday(p, today)
  const day = withDay.missions[today]
  const items = day.items.map((i) => (i.id === itemId ? { ...i, done } : i))
  return maybeBumpStreak(
    { ...withDay, missions: { ...withDay.missions, [today]: { items } } },
    today,
  )
}

/** The effective auto-kind of a mission item — a bare `auto` item is legacy 'math'. */
const kindOf = (i: { auto?: boolean; autoKind?: AutoKind }): AutoKind | null =>
  i.auto ? i.autoKind ?? 'math' : null

/**
 * An in-app activity of `kind` finished → flip every matching auto item for today.
 * Generic so one mechanism serves math, typing, and the (unwired) reading/mindset
 * leave hooks. A no-op when nothing of that kind is open.
 */
export function autoCompleteKind(
  p: Profile,
  kind: AutoKind,
  today: string = isoToday(),
): Profile {
  const withDay = ensureToday(p, today)
  const day = withDay.missions[today]
  if (!day.items.some((i) => kindOf(i) === kind && !i.done)) return withDay
  const items = day.items.map((i) => (kindOf(i) === kind ? { ...i, done: true } : i))
  return maybeBumpStreak(
    { ...withDay, missions: { ...withDay.missions, [today]: { items } } },
    today,
  )
}

/** A finished math practice/placement session flips the math auto item(s). */
export const autoCompletePractice = (p: Profile, today: string = isoToday()): Profile =>
  autoCompleteKind(p, 'math', today)

/** A finished 5-minute typing drill (SE-A) flips the typing auto item. */
export const autoCompleteTyping = (p: Profile, today: string = isoToday()): Profile =>
  autoCompleteKind(p, 'typing', today)

// ---------- MR/MM auto-check hooks (item 4 — WIRED at the SE-B merge) ----------
// The MR (reading) and MM (mindset) modules can't touch this file, so SE-B owns
// their plumbing. These are now connected: autoCompleteReading fires from
// ReadingView.onComplete (a finished fluency session), autoCompleteMindset from
// MindsetLesson's markReflected sites (the week's lesson reflected — NOT mere
// viewing). Their template items (READING_ITEM / MINDSET_ITEM) ship in the grade
// defaults above.

/** A finished MR reading-fluency session flips the '📖 Reading' auto item. */
export const autoCompleteReading = (p: Profile, today: string = isoToday()): Profile =>
  autoCompleteKind(p, 'reading', today)

/** A reflected MM mindset lesson flips the '🧠 Mindset lesson' auto item. */
export const autoCompleteMindset = (p: Profile, today: string = isoToday()): Profile =>
  autoCompleteKind(p, 'mindset', today)

// ---------- apply new defaults (respecting Dad's edits) ----------

/** Merge a fresh default list into an existing one: keep every existing item as-is
 *  (Dad may have relabelled/reordered it), and append only default items whose id
 *  the list is missing. Never removes or rewrites what's already there. */
function mergeList(
  existing: MissionTemplateItem[],
  defaults: MissionTemplateItem[],
): { list: MissionTemplateItem[]; added: string[] } {
  const have = new Set(existing.map((i) => i.id))
  const additions = defaults.filter((d) => !have.has(d.id))
  return { list: [...existing, ...additions], added: additions.map((d) => d.id) }
}

export interface ApplyDefaultsResult {
  profile: Profile
  /** item ids newly added to weekday / friday (for the "added N items" confirmation). */
  added: string[]
}

/**
 * One-click "apply new defaults" for one girl. Brings in any grade-default items
 * her template is missing WITHOUT disturbing her existing items (labels, order,
 * auto flags). A girl on the bare grade default just materialises the current
 * default template. Idempotent: re-running once caught up changes nothing.
 */
export function applyDefaultsToProfile(p: Profile): ApplyDefaultsResult {
  const current = templateFor(p)
  const def = defaultTemplateFor(p.grade)
  const weekday = mergeList(current.weekday, def.weekday)
  const friday = mergeList(current.friday, def.friday)
  return {
    profile: { ...p, template: { weekday: weekday.list, friday: friday.list } },
    added: [...weekday.added, ...friday.added],
  }
}

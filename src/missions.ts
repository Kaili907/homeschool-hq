import type {
  Grade,
  MissionDay,
  MissionTemplate,
  Profile,
} from './types'
import { isoToday } from './appState'

// ---------- default templates (Dad edits these in the Grown-Ups panel) ----------

export function defaultTemplateFor(grade: Grade): MissionTemplate {
  switch (grade) {
    case '3':
      return {
        weekday: [
          { id: 'math-lesson', label: 'Math lesson with Dad' },
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-aloud', label: 'Read aloud 15 minutes' },
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'writing', label: 'Writing or Spelling' },
          { id: 'science-ss', label: 'Science or Social Studies' },
        ],
        friday: [
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'fun-project', label: 'Fun Friday project' },
        ],
      }
    case '4':
      return {
        weekday: [
          { id: 'math-lesson', label: 'Math lesson with Dad' },
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-aloud', label: 'Read aloud 15 minutes' },
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'writing', label: 'Writing or Spelling' },
          { id: 'science-ss', label: 'Science or Social Studies' },
        ],
        friday: [
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'read-self', label: 'Read to self 15 minutes' },
          { id: 'fun-project', label: 'Fun Friday project' },
        ],
      }
    case '6':
      return {
        weekday: [
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'math-check', label: 'Check answers with Dad' },
          { id: 'reading', label: 'Reading 20 minutes' },
          { id: 'writing', label: 'Writing' },
          { id: 'science-ss', label: 'Science or Social Studies' },
          { id: 'planner', label: 'Plan tomorrow in your planner' },
        ],
        friday: [
          { id: 'math-practice', label: 'Math practice (15 questions)', auto: true },
          { id: 'reading', label: 'Reading 20 minutes' },
          { id: 'project', label: 'Friday project time' },
        ],
      }
    case '10':
      return {
        weekday: [
          { id: 'geometry', label: 'Geometry block 45 minutes' },
          { id: 'english', label: 'English' },
          { id: 'science', label: 'Science' },
          { id: 'social-studies', label: 'Social Studies' },
          { id: 'elective', label: 'Elective' },
        ],
        friday: [
          { id: 'geometry', label: 'Geometry review 30 minutes' },
          { id: 'english', label: 'English' },
          { id: 'catch-up', label: 'Catch-up or elective' },
        ],
      }
    case '12':
      return {
        // math block pinned first by default order
        weekday: [
          { id: 'math-block', label: 'Math block 60–75 minutes' },
          { id: 'english', label: 'English' },
          { id: 'gov-econ', label: 'Government / Economics' },
          { id: 'science', label: 'Science' },
          { id: 'college-app', label: 'College-app task of the day' },
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

// ---------- day building ----------

export function isFridayDate(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay() === 5
}

export function isoYesterday(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export function buildMissionDay(t: MissionTemplate, friday: boolean): MissionDay {
  const src = friday && t.friday.length > 0 ? t.friday : t.weekday
  return {
    items: src.map((i) => ({
      id: i.id,
      label: i.label,
      done: false,
      ...(i.auto ? { auto: true } : {}),
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
      [today]: buildMissionDay(templateFor(p), isFridayDate(today)),
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

/** An in-app math session finished → flip every auto item for today. */
export function autoCompletePractice(p: Profile, today: string = isoToday()): Profile {
  const withDay = ensureToday(p, today)
  const day = withDay.missions[today]
  if (!day.items.some((i) => i.auto && !i.done)) return withDay
  const items = day.items.map((i) => (i.auto ? { ...i, done: true } : i))
  return maybeBumpStreak(
    { ...withDay, missions: { ...withDay.missions, [today]: { items } } },
    today,
  )
}

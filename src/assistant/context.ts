import type { Grade, ISODate, Profile } from '../types'
import { getHsStat, sortedCollegeTasks, courseProgress } from '../hs/hsState'
import { GEOMETRY_UNITS, ALGEBRA_TOPICS } from '../hs/hsCatalog'
import { getState, startStatus } from '../assessment/attempts'
import { TEST_BY_ID } from '../assessment/banks'

/**
 * MJ HS-assistant — the per-turn READ-ONLY context snapshot.
 *
 * SAFETY BOUNDARY (hardcoded, not left to the model): this builder takes exactly
 * ONE profile and reads only her own school-day facts. It is structurally
 * incapable of seeing another girl's data (no AppState parameter), it reads only
 * assessment *status* (never a question prompt, choice, answer key, or start
 * code), and it never touches journal text (which lives outside AppState in
 * journalStore) or any API key (never on the profile). The exclusion test
 * (context.test.ts) locks these guarantees.
 */

export interface AssistantContext {
  name: string
  grade: Grade
  today: ISODate
  /** today's mission items (label + completion). */
  mission: { label: string; done: boolean }[]
  /** senior college-app deadlines (label + due + overdue). Absent for non-seniors. */
  deadlines?: { label: string; due: string; overdue: boolean }[]
  /** whole-year course progress. */
  courses: { name: string; done: number; total: number }[]
  /** geometry unit practice stats (started units only). */
  geometry: { name: string; attempts: number; accuracy: number | null }[]
  /** algebra topic practice stats (started topics only). */
  algebra: { name: string; attempts: number; accuracy: number | null }[]
  /** assessment EXISTENCE + STATUS only — never item content or answers. */
  assessments: { title: string; status: string }[]
}

const acc = (attempts: number, correct: number): number | null =>
  attempts > 0 ? Math.round((correct / attempts) * 100) : null

const STATUS_WORD: Record<string, string> = {
  'not-started': 'assigned (not started)',
  'in-progress': 'in progress',
  'completed-locked': 'completed',
  'retake-ready': 'completed (retake unlocked)',
}

/** Build the read-only context object from HER profile only. */
export function buildAssistantContext(profile: Profile, today: ISODate): AssistantContext {
  const mission = (profile.missions[today]?.items ?? []).map((i) => ({ label: i.label, done: i.done }))

  const isSenior = profile.grade === '12'
  const deadlines = isSenior
    ? sortedCollegeTasks(profile.collegeTasks ?? [], today).map(({ task, overdue }) => ({
        label: task.label,
        due: task.due,
        overdue,
      }))
    : undefined

  const courses = (profile.courses ?? []).map((c) => {
    const { done, total } = courseProgress(c)
    return { name: c.name, done, total }
  })

  const geometry = GEOMETRY_UNITS.map((u) => {
    const s = getHsStat(profile, u.id)
    return { name: u.name, attempts: s.attempts, accuracy: acc(s.attempts, s.correct) }
  }).filter((g) => g.attempts > 0)

  const algebra = ALGEBRA_TOPICS.map((u) => {
    const s = getHsStat(profile, u.id)
    return { name: u.name, attempts: s.attempts, accuracy: acc(s.attempts, s.correct) }
  }).filter((g) => g.attempts > 0)

  // Assessment STATUS ONLY. We read the profile's assigned list + attempt status,
  // and the test TITLE from the catalog — never the items, choices, keys, or the
  // start code, and never her submitted answer values.
  const astate = getState(profile.assessments)
  const assessments = astate.assigned.map((a) => {
    const title = TEST_BY_ID[a.testId]?.title ?? a.testId
    return { title, status: STATUS_WORD[startStatus(astate, a.testId)] ?? 'assigned' }
  })

  return {
    name: profile.name,
    grade: profile.grade,
    today,
    mission,
    deadlines,
    courses,
    geometry,
    algebra,
    assessments,
  }
}

/** Render the context into a compact plaintext block for the system prompt. */
export function renderAssistantContext(ctx: AssistantContext): string {
  const lines: string[] = []
  lines.push(`Student: ${ctx.name} (grade ${ctx.grade}). Today: ${ctx.today}.`)

  if (ctx.mission.length > 0) {
    const items = ctx.mission.map((m) => `${m.done ? '[x]' : '[ ]'} ${m.label}`).join('; ')
    lines.push(`Today's mission: ${items}`)
  } else {
    lines.push(`Today's mission: (none set yet)`)
  }

  if (ctx.deadlines && ctx.deadlines.length > 0) {
    const d = ctx.deadlines
      .map((x) => `${x.label}${x.due ? ` — due ${x.due}` : ''}${x.overdue ? ' (OVERDUE)' : ''}`)
      .join('; ')
    lines.push(`College-app deadlines: ${d}`)
  }

  if (ctx.courses.length > 0) {
    lines.push(`Course progress: ${ctx.courses.map((c) => `${c.name} ${c.done}/${c.total}`).join('; ')}`)
  }

  if (ctx.geometry.length > 0) {
    lines.push(
      `Geometry practice: ${ctx.geometry
        .map((g) => `${g.name} ${g.accuracy ?? 0}% (${g.attempts} tried)`)
        .join('; ')}`,
    )
  }
  if (ctx.algebra.length > 0) {
    lines.push(
      `Algebra practice: ${ctx.algebra
        .map((g) => `${g.name} ${g.accuracy ?? 0}% (${g.attempts} tried)`)
        .join('; ')}`,
    )
  }

  if (ctx.assessments.length > 0) {
    lines.push(
      `Assessments (status only — you do NOT have the questions or answers): ${ctx.assessments
        .map((a) => `${a.title} — ${a.status}`)
        .join('; ')}`,
    )
  }

  return lines.join('\n')
}

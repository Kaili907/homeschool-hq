import type { Grade } from '../types'

/**
 * MP — curriculum parser. Turns a plan markdown doc (the `## Week N` convention with a
 * light front-matter) into a typed {subject, grades, week → items[]} structure. PURE
 * (string in, data out) so it round-trips under test without Vite. The glob loader that
 * ships the real docs lives in loader.ts; adding a plan later = drop an md in plans/.
 *
 * Doc shape:
 *   ---
 *   subject: Personal Finance
 *   subjectId: personal-finance
 *   grades: 10,12            # or the word: all
 *   ---
 *   ## Week 1 — Topic
 *   - an independent/app item
 *   - ✋ a Dad-taught item
 *   - (Tue) an item that only appears on Tuesdays
 */

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export const WEEKDAYS: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface PlanItem {
  /** the item text (✋ marker and any (Day) tag stripped off). */
  text: string
  /** true when the source bullet began with ✋ — Dad teaches/leads this. */
  dadTaught: boolean
  /** optional day tag: the item only surfaces on Today for this weekday. */
  day?: Weekday
}

export interface PlanDoc {
  subject: string
  subjectId: string
  /** the grades this plan applies to, or 'all'. */
  grades: Grade[] | 'all'
  /** week number (1-based) → its items. Weeks may be sparse (e.g. quarter-anchored). */
  weeks: Record<number, PlanItem[]>
  /** count of `## Week N` sections parsed (for round-trip count verification). */
  weekCount: number
}

const VALID_GRADES: Grade[] = ['3', '4', '6', '10', '12']

function parseGrades(raw: string): Grade[] | 'all' {
  const v = raw.trim().toLowerCase()
  if (v === 'all' || v === '') return 'all'
  const gs = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Grade => (VALID_GRADES as string[]).includes(s))
  return gs.length ? gs : 'all'
}

/** Split leading `---`…`---` front-matter from the body. */
function splitFrontMatter(md: string): { fm: Record<string, string>; body: string } {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const fm: Record<string, string> = {}
  if (lines[0]?.trim() === '---') {
    let i = 1
    for (; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        i++
        break
      }
      const m = lines[i].match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
      if (m) fm[m[1].trim().toLowerCase()] = m[2].trim()
    }
    return { fm, body: lines.slice(i).join('\n') }
  }
  return { fm, body: md.replace(/\r\n/g, '\n') }
}

// `## Week 12 — Title`  (em-dash or hyphen, title optional)
const WEEK_RE = /^##\s+Week\s+(\d+)\b\s*(?:[—–-]\s*(.*))?$/i
const DAY_RE = new RegExp(`^\\((${WEEKDAYS.join('|')})\\)\\s*(.*)$`, 'i')

function parseItem(line: string): PlanItem {
  // strip the leading "- " / "* " bullet marker
  let text = line.replace(/^[-*]\s+/, '').trim()
  let dadTaught = false
  if (text.startsWith('✋')) {
    dadTaught = true
    text = text.replace(/^✋\s*/, '').trim()
  }
  let day: Weekday | undefined
  const dm = text.match(DAY_RE)
  if (dm) {
    const wd = (dm[1][0].toUpperCase() + dm[1].slice(1).toLowerCase()) as Weekday
    day = wd
    text = dm[2].trim()
  }
  return day ? { text, dadTaught, day } : { text, dadTaught }
}

/** Parse one plan doc. Unknown/missing front-matter degrades gracefully. */
export function parsePlanDoc(md: string, fallbackId = 'plan'): PlanDoc {
  const { fm, body } = splitFrontMatter(md)
  const subjectId = (fm.subjectid || fm.subject || fallbackId).trim() || fallbackId
  const subject = (fm.subject || subjectId).trim()
  const grades = parseGrades(fm.grades ?? 'all')

  const weeks: Record<number, PlanItem[]> = {}
  let current: number | null = null
  for (const raw of body.split('\n')) {
    const line = raw.trimEnd()
    const wm = line.match(WEEK_RE)
    if (wm) {
      current = Number(wm[1])
      if (!weeks[current]) weeks[current] = []
      continue
    }
    if (current != null && /^[-*]\s+/.test(line.trim())) {
      weeks[current].push(parseItem(line.trim()))
    }
  }
  return { subject, subjectId, grades, weeks, weekCount: Object.keys(weeks).length }
}

// ---------- queries over parsed docs ----------

export const planAppliesToGrade = (doc: PlanDoc, grade: Grade): boolean =>
  doc.grades === 'all' || doc.grades.includes(grade)

export function plansForGrade(docs: PlanDoc[], grade: Grade): PlanDoc[] {
  return docs.filter((d) => planAppliesToGrade(d, grade))
}

/** Items for a subject at a given week ([] when that week isn't defined in the doc). */
export function itemsForWeek(doc: PlanDoc, week: number): PlanItem[] {
  return doc.weeks[week] ?? []
}

/** Today's items for a week: day-tagged items only on their day; untagged every day. */
export function itemsForDay(doc: PlanDoc, week: number, weekday: Weekday): PlanItem[] {
  return itemsForWeek(doc, week).filter((it) => !it.day || it.day === weekday)
}

/** Sorted list of defined week numbers (handles sparse/quarter-anchored docs). */
export function definedWeeks(doc: PlanDoc): number[] {
  return Object.keys(doc.weeks)
    .map(Number)
    .sort((a, b) => a - b)
}

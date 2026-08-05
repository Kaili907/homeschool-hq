import type { Grade, Profile, SchoolYear } from '../types'
import {
  itemsForDay,
  planAppliesToGrade,
  type PlanDoc,
  type PlanItem,
} from './parser'
import { derivedScopeWeek, isTravelWeek, pointerDrift, resolvePointer, weekdayOf } from './pacing'

/**
 * MP — the pure view model the four hub views render from. Combines the pacing engine,
 * the parsed plans and the subjects that apply to each girl's grade. Plan front matter
 * is the source of truth, so a new plan file becomes available without a code change.
 */

export interface ExpectedSubject {
  id: string
  label: string
}

/** What the hub tracks per grade, in deterministic loader order. */
export function expectedSubjects(docs: PlanDoc[], grade: Grade): ExpectedSubject[] {
  const seen = new Set<string>()
  return docs.flatMap((doc) => {
    if (!planAppliesToGrade(doc, grade) || seen.has(doc.subjectId)) return []
    seen.add(doc.subjectId)
    return [{ id: doc.subjectId, label: doc.subject }]
  })
}

/** The plan doc for a subject id that applies to this grade, or null (missing scope). */
export function docForSubject(docs: PlanDoc[], subjectId: string, grade: Grade): PlanDoc | null {
  return docs.find((d) => d.subjectId === subjectId && planAppliesToGrade(d, grade)) ?? null
}

export interface SubjectPlan {
  subject: ExpectedSubject
  /** null = no scope yet → render the "awaiting placement results" placeholder. */
  doc: PlanDoc | null
  /** resolved weekPointer (calendar-derived unless Dad nudged it). */
  pointer: number
  /** pointer − calendar week; nonzero → show the ± drift badge. */
  drift: number
  missing: boolean
}

/** Every subject with an applicable plan for a girl, with its resolved pointer. */
export function subjectPlansFor(
  p: Profile,
  docs: PlanDoc[],
  sy: SchoolYear,
  todayISO: string,
): SubjectPlan[] {
  return expectedSubjects(docs, p.grade).map((subject) => {
    const doc = docForSubject(docs, subject.id, p.grade)
    return {
      subject,
      doc,
      pointer: resolvePointer(p, subject.id, sy, todayISO),
      drift: pointerDrift(p, subject.id, sy, todayISO),
      missing: !doc,
    }
  })
}

export interface TodaySubject {
  subject: ExpectedSubject
  missing: boolean
  pointer: number
  /** items for today (day-tagged filtered to today's weekday); empty on a travel week. */
  items: PlanItem[]
}

export interface TodayForGirl {
  travelWeek: boolean
  scopeWeek: number
  subjects: TodaySubject[]
}

/**
 * Today's teaching picture for one girl: derived from (weekPointer × day-of-week) per
 * subject. On a travel week: the badge shows and NO items render (expectations paused).
 */
export function todayForGirl(
  p: Profile,
  docs: PlanDoc[],
  sy: SchoolYear,
  todayISO: string,
): TodayForGirl {
  const travelWeek = isTravelWeek(sy, todayISO)
  const weekday = weekdayOf(todayISO)
  const subjects: TodaySubject[] = subjectPlansFor(p, docs, sy, todayISO).map((sp) => ({
    subject: sp.subject,
    missing: sp.missing,
    pointer: sp.pointer,
    items: travelWeek || !sp.doc ? [] : itemsForDay(sp.doc, sp.pointer, weekday),
  }))
  return { travelWeek, scopeWeek: derivedScopeWeek(sy, todayISO), subjects }
}

import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject, type Grade, type Profile } from '../types'
import { academyGradeOf, isAcademyGradeEnabledFromHost } from './featureFlag'
import { ACADEMY_COURSE_ID_PATTERN } from '../curriculum/grade-authority'

/**
 * ACADEMY-LEVEL-DECOUPLE — the one place a "which content does she receive?"
 * question is answered.
 *
 * Two different questions live in this app and used to share one field:
 *  - NOMINAL grade (Profile.grade) — what she IS. Transcripts, report cards, the
 *    Status/Today/Picker labels, high-school gating, skill trees, mission
 *    templates and placement all keep reading it. Nothing here changes that.
 *  - WORKING LEVEL (Profile.workingLevels[subject]) — what she RECEIVES, per
 *    subject. Only the Academy reads it.
 *
 * Invariants (tested in workingLevel.test.ts):
 *  - an unset subject resolves to the nominal grade, so a profile that has never
 *    been given a level behaves exactly as it did before this module existed
 *  - resolution never mutates the profile and never touches `grade`
 *  - the per-grade feature flag still gates: a working level of 5 with
 *    VITE_ACADEMY_GRADE_5_ENABLED unset reaches nothing
 */

/** One subject the girl reaches, and the academy level its content comes from. */
export interface AcademyProgramEntry {
  subject: AcademySubject
  level: AcademyGrade
}

/** The level whose content this subject serves her. Unset = her nominal grade. */
export function workingLevelFor(p: Profile, subject: AcademySubject): Grade {
  return p.workingLevels?.[subject] ?? p.grade
}

/** True when the parent has explicitly assigned this subject a level. */
export function hasExplicitWorkingLevel(p: Profile, subject: AcademySubject): boolean {
  return p.workingLevels?.[subject] !== undefined
}

/**
 * Assign (or clear, with `null`) one subject's working level. Returns a new
 * profile; `grade` is never touched. Clearing the last entry drops the whole
 * record so an untouched-again profile is indistinguishable from a fresh one.
 *
 * `level` is an AcademyGrade: only curriculum-supported grades have published
 * content, and sync validation refuses anything else, so the type refuses it
 * here first.
 */
export function setWorkingLevel(
  p: Profile,
  subject: AcademySubject,
  level: AcademyGrade | null,
): Profile {
  const next: Record<string, AcademyGrade> = { ...(p.workingLevels ?? {}) }
  if (level === null) delete next[subject]
  else next[subject] = level
  const rest = { ...p }
  delete rest.workingLevels
  const moved = Object.keys(next).length === 0 ? rest : { ...rest, workingLevels: next }
  return reconcileEnrollment(moved)
}

/** Course ids encode their level and subject. academyRoute.ts and
 * sync/provenance.ts now read the same pattern from the grade authority, so the
 * three copies this comment used to warn about are one definition. */
const COURSE_ID = ACADEMY_COURSE_ID_PATTERN

/** The level this subject's content may come from, ignoring feature flags —
 * the authorization the profile carries, not what the build currently serves. */
function authorizedLevel(p: Profile, subject: string): AcademyGrade | null {
  return ACADEMY_SUBJECTS.includes(subject as AcademySubject)
    ? academyGradeOf(workingLevelFor(p, subject as AcademySubject))
    : null
}

/**
 * Drop enrollment records the profile is no longer authorized for. Changing a
 * working level otherwise leaves a course from the OLD level in
 * `academy.courseIds`, which sync validation refuses — and because
 * `persistDatasetVerified` validates before writing, the parent's change would
 * silently fail to save and a reload would quarantine the household dataset.
 *
 * Lossless: `lessons` and `assessments` are keyed independently and are never
 * touched, so a girl moved from Grade 5 to Grade 7 mathematics keeps every
 * completed Grade 5 lesson. Her next Academy visit re-enrolls the new level's
 * courses (AcademyRouter reconciles against the composed program).
 */
export function reconcileEnrollment(p: Profile): Profile {
  if (!p.academy) return p
  const kept = p.academy.courseIds.filter((id) => {
    const parsed = COURSE_ID.exec(id)
    return parsed !== null && authorizedLevel(p, parsed[2]) === parsed[1]
  })
  if (kept.length === p.academy.courseIds.length) return p
  return { ...p, academy: { ...p.academy, courseIds: kept } }
}

/**
 * Every subject whose working level lands on an ENABLED academy level, in the
 * release's subject order. Empty = this girl reaches no academy content at all,
 * which is the state of every profile until a flag is on AND a level resolves.
 */
export function enabledAcademyEntries(p: Profile): AcademyProgramEntry[] {
  const entries: AcademyProgramEntry[] = []
  for (const subject of ACADEMY_SUBJECTS) {
    const level = academyGradeOf(workingLevelFor(p, subject))
    if (level && isAcademyGradeEnabledFromHost(level)) entries.push({ subject, level })
  }
  return entries
}

/** Does this girl reach any academy content? Replaces the old profile-grade gate. */
export function hasEnabledAcademyProgram(p: Profile): boolean {
  return enabledAcademyEntries(p).length > 0
}

/** Distinct enabled academy levels, ascending — the catalogs a program loads. */
export function enabledAcademyLevels(p: Profile): AcademyGrade[] {
  return levelsOf(enabledAcademyEntries(p))
}

/** Distinct levels of a program entry list, ascending. */
export function levelsOf(entries: readonly AcademyProgramEntry[]): AcademyGrade[] {
  return [...new Set(entries.map((e) => e.level))].sort((a, b) => Number(a) - Number(b))
}

/** Is ANY academy level enabled on this host? Gates the parent-side Academy tab,
 * which must stay reachable even when no profile currently resolves into one —
 * otherwise the level that would grant access could never be assigned. */
export function isAnyAcademyLevelEnabled(): boolean {
  return ACADEMY_GRADES.some(isAcademyGradeEnabledFromHost)
}

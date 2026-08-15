/**
 * Derivation model for the Admin high-school programme.
 *
 * The rules here are the whole reason this module exists as its own thing:
 *
 *  1. Never claim graduation-complete unless the source snapshot's ruling
 *     literally says so AND no coverage gap is NOT_COVERED /
 *     REQUIRES_DIRECTOR_DECISION.
 *  2. Show a credit value only when the source recorded one (`credit`
 *     is `null` for grade-8 anchors and MUST stay unshown for those).
 *  3. Prerequisites shown as UNVERIFIED / UNRESOLVED / OK against the snapshot;
 *     never invented.
 *  4. Progression Grade N -> N+1 for a family is `CONTINUOUS` only when the
 *     N+1 course names an N-course of the same family as its prerequisite.
 *  5. Coverage classification mirrors the source's rawVerdict; never softer.
 */
import {
  COVERAGE_STATUS,
  HIGH_SCHOOL_GRADES,
  HIGH_SCHOOL_SUBJECTS,
  type CoverageGap,
  type CoverageStatus,
  type GraduationRuling,
  type GraduationVerdict,
  type HighSchoolCourse,
  type HighSchoolGrade,
  type HighSchoolProgramSnapshot,
  type HighSchoolSubject,
  type SeamFact,
  type SeamContinuityVerdict,
  type StandardsFact,
  type StandardsVerification,
} from './contracts'

export interface PrerequisiteView {
  readonly courseId: string
  /**
   * `ok`         — every prerequisite id resolves within the snapshot.
   * `unresolved` — at least one prerequisite id does not exist in the snapshot.
   * `none`       — the course records no prerequisites (grade-8 anchors).
   */
  readonly status: 'ok' | 'unresolved' | 'none'
  readonly declaredPrerequisiteIds: readonly string[]
  readonly unresolvedIds: readonly string[]
}

export interface CreditView {
  readonly courseId: string
  /**
   * `stated`      — source recorded a credit; use `credits`.
   * `not_stated`  — source recorded null; do not display a credit value.
   */
  readonly status: 'stated' | 'not_stated'
  readonly credits: number | null
}

export interface GradeProgressionRow {
  readonly grade: HighSchoolGrade
  readonly courses: readonly HighSchoolCourse[]
}

export interface FamilyProgressionRow {
  readonly subject: HighSchoolSubject
  readonly grades: Readonly<Partial<Record<HighSchoolGrade, HighSchoolCourse>>>
  readonly presentGrades: readonly HighSchoolGrade[]
  readonly missingGrades: readonly HighSchoolGrade[]
  /**
   * `continuous`             — every high-school grade (9..12) is present AND
   *                            each one names the same-family previous grade
   *                            as its prerequisite.
   * `broken_prerequisites`   — some HS grade is missing OR does not chain to
   *                            the same-family previous grade.
   */
  readonly progressionStatus: 'continuous' | 'broken_prerequisites'
  readonly progressionNotes: readonly string[]
}

export interface SeamView {
  readonly family: SeamFact['family']
  readonly familyLabel: string
  readonly grade8CourseId: string | null
  readonly grade9CourseId: string | null
  readonly ruling: SeamContinuityVerdict
  readonly namedDiscontinuities: readonly string[]
  readonly note: string
  readonly sourceDoc: string
  /**
   * `has_anchor`  — Grade 8 and Grade 9 course ids are both present.
   * `no_anchor`   — No Grade 8 anchor exists (World Language).
   */
  readonly anchoring: 'has_anchor' | 'no_anchor'
  /**
   * `linked` — the Grade 9 course names the Grade 8 course as its
   *            prerequisite. `unlinked` — it does not (or Grade 8 is absent).
   */
  readonly linkage: 'linked' | 'unlinked'
}

export interface StandardsView extends StandardsFact {
  readonly displayStatus: CoverageStatus
}

export interface CoverageView extends CoverageGap {}

export interface GraduationRulingView extends GraduationRuling {
  /**
   * `graduation_complete`    — snapshot says so AND no gap is
   *                            NOT_COVERED/REQUIRES_DIRECTOR_DECISION.
   * `not_graduation_complete`
   * `unverified`             — snapshot ruling is UNVERIFIED.
   */
  readonly overallStatus: 'graduation_complete' | 'not_graduation_complete' | 'unverified'
  readonly reason: string
}

export interface HighSchoolProgramView {
  readonly snapshot: HighSchoolProgramSnapshot
  readonly progressionByGrade: readonly GradeProgressionRow[]
  readonly progressionByFamily: readonly FamilyProgressionRow[]
  readonly prerequisites: readonly PrerequisiteView[]
  readonly credits: readonly CreditView[]
  readonly seamG8G9: readonly SeamView[]
  readonly standardsCoverage: readonly StandardsView[]
  readonly coverageGaps: readonly CoverageView[]
  readonly graduation: GraduationRulingView
  /**
   * True iff the display MAY use the graduation-complete label. This is a
   * hard invariant checked in tests; see rule 1 above.
   */
  readonly graduationCompletionClaimable: boolean
}

const HIGH_SCHOOL_GRADE_SET: ReadonlySet<HighSchoolGrade> = new Set(HIGH_SCHOOL_GRADES)

function standardsDisplayStatus(verification: StandardsVerification): CoverageStatus {
  switch (verification) {
    case 'VERIFIED': return 'COVERED'
    case 'PARTIALLY_VERIFIED': return 'PARTIAL'
    case 'UNVERIFIED': return 'UNVERIFIED'
    case 'NO_ANCHOR': return 'NOT_COVERED'
  }
}

export function deriveHighSchoolProgramView(snapshot: HighSchoolProgramSnapshot): HighSchoolProgramView {
  const byId = new Map<string, HighSchoolCourse>()
  for (const course of snapshot.courses) byId.set(course.courseId, course)

  const progressionByGrade: GradeProgressionRow[] = HIGH_SCHOOL_GRADES.map((grade) => ({
    grade,
    courses: snapshot.courses.filter((c) => c.grade === grade),
  }))

  const progressionByFamily: FamilyProgressionRow[] = HIGH_SCHOOL_SUBJECTS.map((subject) => {
    const grades: Partial<Record<HighSchoolGrade, HighSchoolCourse>> = {}
    for (const c of snapshot.courses) if (c.subject === subject) grades[c.grade] = c
    const presentGrades = HIGH_SCHOOL_GRADES.filter((g) => grades[g])
    const missingGrades = HIGH_SCHOOL_GRADES.filter((g) => !grades[g])
    const notes: string[] = []
    let progressionStatus: FamilyProgressionRow['progressionStatus'] = 'continuous'
    for (const grade of [9, 10, 11, 12] as const) {
      const course = grades[grade]
      if (!course) {
        progressionStatus = 'broken_prerequisites'
        notes.push(`Grade ${grade} course missing for ${subject}`)
        continue
      }
      const expectedPrereq = grade === 9 ? `ma-g8-${subject}` : `ma-g${grade - 1}-${subject}`
      if (!course.prerequisiteCourseIds.includes(expectedPrereq)) {
        progressionStatus = 'broken_prerequisites'
        notes.push(`Grade ${grade} ${subject} does not name ${expectedPrereq} as a prerequisite`)
      }
    }
    return {
      subject,
      grades,
      presentGrades,
      missingGrades,
      progressionStatus,
      progressionNotes: notes,
    }
  })

  const prerequisites: PrerequisiteView[] = snapshot.courses.map((course) => {
    if (course.prerequisiteCourseIds.length === 0) {
      return { courseId: course.courseId, status: 'none', declaredPrerequisiteIds: [], unresolvedIds: [] }
    }
    const unresolved = course.prerequisiteCourseIds.filter((id) => !byId.has(id))
    return {
      courseId: course.courseId,
      status: unresolved.length ? 'unresolved' : 'ok',
      declaredPrerequisiteIds: course.prerequisiteCourseIds,
      unresolvedIds: unresolved,
    }
  })

  const credits: CreditView[] = snapshot.courses.map((course) => (
    course.creditRecommendation === null
      ? { courseId: course.courseId, status: 'not_stated', credits: null }
      : { courseId: course.courseId, status: 'stated', credits: course.creditRecommendation }
  ))

  const seamG8G9: SeamView[] = snapshot.seam.map((s) => {
    const grade8 = s.grade8CourseId ? byId.get(s.grade8CourseId) : undefined
    const grade9 = s.grade9CourseId ? byId.get(s.grade9CourseId) : undefined
    const linked = Boolean(grade9 && grade8 && grade9.prerequisiteCourseIds.includes(grade8.courseId))
    return {
      ...s,
      anchoring: s.grade8CourseId && s.grade9CourseId ? 'has_anchor' : 'no_anchor',
      linkage: linked ? 'linked' : 'unlinked',
    }
  })

  const standardsCoverage: StandardsView[] = snapshot.standards.map((s) => ({
    ...s,
    displayStatus: standardsDisplayStatus(s.verification),
  }))

  const coverageGaps: CoverageView[] = snapshot.gaps.map((g) => ({ ...g }))

  const graduation = derivegraduationRuling(snapshot.graduationRuling, snapshot.gaps)

  return {
    snapshot,
    progressionByGrade,
    progressionByFamily,
    prerequisites,
    credits,
    seamG8G9,
    standardsCoverage,
    coverageGaps,
    graduation,
    graduationCompletionClaimable: graduation.overallStatus === 'graduation_complete',
  }
}

function derivegraduationRuling(source: GraduationRuling, gaps: readonly CoverageGap[]): GraduationRulingView {
  const blockingGap = gaps.find((g) => g.rawVerdict === 'NOT_COVERED' || g.rawVerdict === 'REQUIRES_DIRECTOR_DECISION')
  if (source.verdict === 'GRADUATION_COMPLETE' && !blockingGap) {
    return { ...source, overallStatus: 'graduation_complete', reason: source.basis }
  }
  if (source.verdict === 'GRADUATION_COMPLETE' && blockingGap) {
    return {
      ...source,
      verdict: 'NOT_GRADUATION_COMPLETE',
      overallStatus: 'not_graduation_complete',
      reason: `Source ruling is GRADUATION_COMPLETE but ${blockingGap.requirement} is ${blockingGap.rawVerdict}; the module refuses to project completeness over a blocking gap.`,
    }
  }
  if (source.verdict === 'UNVERIFIED') {
    return { ...source, overallStatus: 'unverified', reason: 'Source graduation ruling is UNVERIFIED.' }
  }
  return { ...source, overallStatus: 'not_graduation_complete', reason: source.basis }
}

/** Guard so tests can assert the status vocabulary is exhaustive. */
export function isCoverageStatus(value: string): value is CoverageStatus {
  return (COVERAGE_STATUS as readonly string[]).includes(value)
}

/** Guard: is `grade` one of the recognised high-school grades? */
export function isHighSchoolGrade(value: number): value is HighSchoolGrade {
  return HIGH_SCHOOL_GRADE_SET.has(value as HighSchoolGrade)
}

/** Convenience: total *stated* recommended credits, grouped by grade. */
export function totalCreditsByGrade(view: HighSchoolProgramView): Readonly<Record<HighSchoolGrade, number>> {
  const totals: Record<HighSchoolGrade, number> = { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
  for (const c of view.snapshot.courses) {
    if (c.creditRecommendation !== null) totals[c.grade] += c.creditRecommendation
  }
  return totals
}

/** Convenience: total *stated* recommended credits Grades 9..12 combined. */
export function totalHighSchoolCredits(view: HighSchoolProgramView): number {
  return view.snapshot.courses.reduce((sum, c) => (
    c.grade !== 8 && c.creditRecommendation !== null ? sum + c.creditRecommendation : sum
  ), 0)
}

/** Known-gap list flattened for compact display. */
export function knownGapSummaries(view: HighSchoolProgramView): readonly {
  readonly requirement: string
  readonly requirementLabel: string
  readonly displayStatus: CoverageStatus
  readonly owner: string
}[] {
  return view.coverageGaps.map((g) => ({
    requirement: g.requirement,
    requirementLabel: g.requirementLabel,
    displayStatus: g.displayStatus,
    owner: g.owner,
  }))
}

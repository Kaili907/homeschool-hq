import { describe, expect, it } from 'vitest'
import {
  HIGH_SCHOOL_GRADES,
  HIGH_SCHOOL_PROGRAM_CONTRACT_ID,
  HIGH_SCHOOL_PROGRAM_SOURCE_REF,
  HIGH_SCHOOL_SUBJECTS,
  type HighSchoolCourse,
  type HighSchoolProgramSnapshot,
} from './contracts'
import {
  deriveHighSchoolProgramView,
  isCoverageStatus,
  isHighSchoolGrade,
  knownGapSummaries,
  totalCreditsByGrade,
  totalHighSchoolCredits,
} from './model'
import { HIGH_SCHOOL_PROGRAM_SNAPSHOT } from './snapshot'

/**
 * Rule tests — the whole point of the module is that these hold.
 *
 * If a change to the snapshot breaks one of these, the change is wrong; the
 * test does NOT get relaxed.
 */

const SNAP = HIGH_SCHOOL_PROGRAM_SNAPSHOT

describe('high-school-program snapshot contract', () => {
  it('names the released contract and source ref exactly', () => {
    expect(SNAP.contractId).toBe(HIGH_SCHOOL_PROGRAM_CONTRACT_ID)
    expect(SNAP.sourceRef).toBe(HIGH_SCHOOL_PROGRAM_SOURCE_REF)
    expect(SNAP.gradeSpan).toEqual([8, 9, 10, 11, 12])
  })

  it('has 10 courses in each of Grades 8..12 (10 families × 5 grades = 50)', () => {
    for (const grade of HIGH_SCHOOL_GRADES) {
      const grades = SNAP.courses.filter((c) => c.grade === grade)
      expect(grades).toHaveLength(10)
    }
    expect(SNAP.courses).toHaveLength(50)
  })

  it('carries a sourceDoc for every course, seam, standards, gap and graduation fact', () => {
    for (const c of SNAP.courses) expect(c.sourceDoc).toMatch(/^curriculum-authoring\/full-family-highschool-9-12\/release\//)
    for (const s of SNAP.seam) expect(s.sourceDoc).toMatch(/^curriculum-authoring\/full-family-highschool-9-12\/release\//)
    for (const s of SNAP.standards) expect(s.sourceDoc).toMatch(/^curriculum-authoring\/full-family-highschool-9-12\/release\//)
    for (const g of SNAP.gaps) expect(g.sourceDoc).toMatch(/^curriculum-authoring\/full-family-highschool-9-12\/release\//)
    expect(SNAP.graduationRuling.sourceDoc).toMatch(/^curriculum-authoring\/full-family-highschool-9-12\/release\//)
  })

  it('records no credit for any Grade 8 anchor', () => {
    const anchors = SNAP.courses.filter((c) => c.grade === 8)
    expect(anchors).toHaveLength(10)
    for (const a of anchors) {
      expect(a.creditRecommendation).toBeNull()
      expect(a.origin).toBe('EXISTING_GRADE_8_ANCHOR')
      expect(a.authoringStatus).toBe('FROZEN_DO_NOT_MODIFY')
    }
  })

  it('records a credit for every HS course (Grades 9-12) — source states credit for every new course', () => {
    const highSchool = SNAP.courses.filter((c) => c.grade !== 8)
    for (const c of highSchool) {
      expect(c.creditRecommendation).not.toBeNull()
      expect(c.origin).toBe('NEW_HIGH_SCHOOL_COURSE')
      expect(c.authoringStatus).toBe('TO_BE_AUTHORED')
    }
  })
})

describe('deriveHighSchoolProgramView — progression and prerequisites', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('produces one row per grade in span, with 10 courses each', () => {
    expect(view.progressionByGrade.map((r) => r.grade)).toEqual([8, 9, 10, 11, 12])
    for (const row of view.progressionByGrade) expect(row.courses).toHaveLength(10)
  })

  it('produces one family row per subject with all 5 grades present and continuous progression', () => {
    expect(view.progressionByFamily.map((f) => f.subject)).toEqual([...HIGH_SCHOOL_SUBJECTS])
    for (const family of view.progressionByFamily) {
      expect(family.presentGrades).toEqual([8, 9, 10, 11, 12])
      expect(family.missingGrades).toEqual([])
      expect(family.progressionStatus).toBe('continuous')
      expect(family.progressionNotes).toEqual([])
    }
  })

  it('every high-school course names a prerequisite that resolves to a course in the snapshot', () => {
    const hsPrereqs = view.prerequisites.filter((p) => !p.courseId.startsWith('ma-g8-'))
    for (const p of hsPrereqs) {
      expect(p.status).toBe('ok')
      expect(p.declaredPrerequisiteIds.length).toBeGreaterThan(0)
      expect(p.unresolvedIds).toEqual([])
    }
    const anchorPrereqs = view.prerequisites.filter((p) => p.courseId.startsWith('ma-g8-'))
    for (const p of anchorPrereqs) expect(p.status).toBe('none')
  })

  it('detects a broken family chain when a course does not name its predecessor', () => {
    const brokenCourses: HighSchoolCourse[] = SNAP.courses.map((c) => (
      c.courseId === 'ma-g11-mathematics'
        ? { ...c, prerequisiteCourseIds: ['ma-g8-mathematics'] }
        : c
    ))
    const brokenSnap: HighSchoolProgramSnapshot = { ...SNAP, courses: brokenCourses }
    const brokenView = deriveHighSchoolProgramView(brokenSnap)
    const math = brokenView.progressionByFamily.find((f) => f.subject === 'mathematics')
    expect(math?.progressionStatus).toBe('broken_prerequisites')
    expect(math?.progressionNotes.join(' ')).toMatch(/Grade 11 mathematics does not name ma-g10-mathematics/)
  })

  it('flags an unresolved prerequisite id', () => {
    const brokenCourses: HighSchoolCourse[] = SNAP.courses.map((c) => (
      c.courseId === 'ma-g10-science'
        ? { ...c, prerequisiteCourseIds: ['ma-nonexistent'] }
        : c
    ))
    const brokenSnap: HighSchoolProgramSnapshot = { ...SNAP, courses: brokenCourses }
    const brokenView = deriveHighSchoolProgramView(brokenSnap)
    const p = brokenView.prerequisites.find((row) => row.courseId === 'ma-g10-science')
    expect(p?.status).toBe('unresolved')
    expect(p?.unresolvedIds).toEqual(['ma-nonexistent'])
  })
})

describe('deriveHighSchoolProgramView — credits', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('reports credit status as not_stated only when the source recorded null', () => {
    const notStated = view.credits.filter((c) => c.status === 'not_stated')
    expect(notStated.map((c) => c.courseId).sort()).toEqual(
      SNAP.courses.filter((c) => c.grade === 8).map((c) => c.courseId).sort(),
    )
    for (const c of notStated) expect(c.credits).toBeNull()
    for (const c of view.credits.filter((c) => c.status === 'stated')) expect(c.credits).not.toBeNull()
  })

  it('totals Grade 9..12 stated credits at 26.25 recommended (per contract programme-load note)', () => {
    // The contract explicitly says "recommends 26.25 credits across Grades 9-12".
    expect(totalHighSchoolCredits(view)).toBeCloseTo(26.25, 5)
    expect(totalCreditsByGrade(view)[8]).toBe(0)
  })
})

describe('deriveHighSchoolProgramView — Grade 8 → 9 seam', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('covers all 10 subject families plus World Language (11 rows)', () => {
    expect(view.seamG8G9).toHaveLength(11)
    expect(view.seamG8G9.some((s) => s.family === 'world-language')).toBe(true)
  })

  it('marks the World Language row NO_ANCHOR and unlinked (no anchor to link to)', () => {
    const wl = view.seamG8G9.find((s) => s.family === 'world-language')
    expect(wl?.ruling).toBe('NO_ANCHOR')
    expect(wl?.anchoring).toBe('no_anchor')
    expect(wl?.linkage).toBe('unlinked')
    expect(wl?.grade8CourseId).toBeNull()
    expect(wl?.grade9CourseId).toBeNull()
  })

  it('marks every anchored subject-family seam as linked (Grade 9 course names Grade 8 as prereq)', () => {
    for (const seam of view.seamG8G9) {
      if (seam.family === 'world-language') continue
      expect(seam.anchoring).toBe('has_anchor')
      expect(seam.linkage).toBe('linked')
    }
  })
})

describe('deriveHighSchoolProgramView — standards coverage', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('projects Ready-for-Life to NOT_COVERED (no coded MDE anchor)', () => {
    const rfl = view.standardsCoverage.find((s) => s.family === 'ready-for-life')
    expect(rfl?.verification).toBe('NO_ANCHOR')
    expect(rfl?.displayStatus).toBe('NOT_COVERED')
  })

  it('projects ELA to PARTIAL (dotted HS codes UNVERIFIED)', () => {
    const ela = view.standardsCoverage.find((s) => s.family === 'english-language-arts')
    expect(ela?.verification).toBe('PARTIALLY_VERIFIED')
    expect(ela?.displayStatus).toBe('PARTIAL')
  })

  it('projects World Language row as UNVERIFIED (no family to standards-audit)', () => {
    const wl = view.standardsCoverage.find((s) => s.family === 'world-language')
    expect(wl?.verification).toBe('UNVERIFIED')
    expect(wl?.displayStatus).toBe('UNVERIFIED')
  })
})

describe('deriveHighSchoolProgramView — coverage gaps', () => {
  const view = deriveHighSchoolProgramView(SNAP)
  const gaps = knownGapSummaries(view)

  it('lists all four contract-declared gaps in the display', () => {
    expect(gaps.map((g) => g.requirement).sort()).toEqual([
      'MMC_ONLINE_LEARNING_EXPERIENCE',
      'MMC_PERSONAL_FINANCE_DISPLACEMENT',
      'MMC_WORLD_LANGUAGE',
      'READY_FOR_LIFE_STANDARDS_ANCHOR',
    ])
  })

  it('maps NOT_COVERED, PARTIALLY_COVERED, REQUIRES_DIRECTOR_DECISION verdicts to the display vocabulary', () => {
    const byReq = new Map(view.coverageGaps.map((g) => [g.requirement, g]))
    expect(byReq.get('MMC_WORLD_LANGUAGE')?.displayStatus).toBe('NOT_COVERED')
    expect(byReq.get('MMC_ONLINE_LEARNING_EXPERIENCE')?.displayStatus).toBe('PARTIAL')
    expect(byReq.get('MMC_PERSONAL_FINANCE_DISPLACEMENT')?.displayStatus).toBe('UNVERIFIED')
    expect(byReq.get('READY_FOR_LIFE_STANDARDS_ANCHOR')?.displayStatus).toBe('UNVERIFIED')
  })

  it('records the irreducible remainder for the World Language NOT_COVERED gap', () => {
    const wl = view.coverageGaps.find((g) => g.requirement === 'MMC_WORLD_LANGUAGE')
    expect(wl?.irreducibleRemainderCredits).toBe(0.5)
  })
})

describe('deriveHighSchoolProgramView — graduation ruling', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('refuses to project graduation-complete over the source ruling', () => {
    expect(view.graduation.verdict).toBe('NOT_GRADUATION_COMPLETE')
    expect(view.graduation.overallStatus).toBe('not_graduation_complete')
    expect(view.graduationCompletionClaimable).toBe(false)
  })

  it('refuses graduation-complete even if the source is edited to say so while a blocking gap remains', () => {
    const forcedSnap: HighSchoolProgramSnapshot = {
      ...SNAP,
      graduationRuling: { ...SNAP.graduationRuling, verdict: 'GRADUATION_COMPLETE', basis: 'forged', note: 'forged' },
    }
    const forcedView = deriveHighSchoolProgramView(forcedSnap)
    expect(forcedView.graduation.verdict).toBe('NOT_GRADUATION_COMPLETE')
    expect(forcedView.graduationCompletionClaimable).toBe(false)
    expect(forcedView.graduation.reason).toMatch(/refuses to project completeness over a blocking gap/i)
  })

  it('projects graduation-complete only when the source says so AND no blocking gap remains', () => {
    const cleanSnap: HighSchoolProgramSnapshot = {
      ...SNAP,
      gaps: SNAP.gaps.filter((g) => g.rawVerdict !== 'NOT_COVERED' && g.rawVerdict !== 'REQUIRES_DIRECTOR_DECISION'),
      graduationRuling: { ...SNAP.graduationRuling, verdict: 'GRADUATION_COMPLETE', basis: 'all requirements covered', note: 'test snapshot' },
    }
    const cleanView = deriveHighSchoolProgramView(cleanSnap)
    expect(cleanView.graduation.overallStatus).toBe('graduation_complete')
    expect(cleanView.graduationCompletionClaimable).toBe(true)
  })

  it('projects UNVERIFIED when the source graduation ruling is UNVERIFIED', () => {
    const unverifiedSnap: HighSchoolProgramSnapshot = {
      ...SNAP,
      graduationRuling: { ...SNAP.graduationRuling, verdict: 'UNVERIFIED' },
    }
    const unverifiedView = deriveHighSchoolProgramView(unverifiedSnap)
    expect(unverifiedView.graduation.overallStatus).toBe('unverified')
    expect(unverifiedView.graduationCompletionClaimable).toBe(false)
  })
})

describe('guards', () => {
  it('isCoverageStatus accepts the vocabulary and rejects strays', () => {
    expect(isCoverageStatus('COVERED')).toBe(true)
    expect(isCoverageStatus('PARTIAL')).toBe(true)
    expect(isCoverageStatus('NOT_COVERED')).toBe(true)
    expect(isCoverageStatus('UNVERIFIED')).toBe(true)
    expect(isCoverageStatus('graduation-complete')).toBe(false)
  })

  it('isHighSchoolGrade accepts 8..12 only', () => {
    for (const g of [8, 9, 10, 11, 12]) expect(isHighSchoolGrade(g)).toBe(true)
    for (const g of [5, 7, 13, 0]) expect(isHighSchoolGrade(g)).toBe(false)
  })
})

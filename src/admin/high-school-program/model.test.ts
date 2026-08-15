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
  divergentReconciliations,
  isCoverageStatus,
  isHighSchoolGrade,
  knownGapSummaries,
  reconciliationVerdictCounts,
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

describe('deriveHighSchoolProgramView — source evidence catalog', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('catalogs all eleven expected sources (1 release + 4 science lineage + 6 subject bundles)', () => {
    expect(view.sources).toHaveLength(11)
    const keys = view.sources.map((s) => s.source.key).sort()
    expect(keys).toEqual([
      'ela-r1',
      'health-pe-r1',
      'math-r1',
      'release',
      'rfl-finlit-r1',
      'science-h2',
      'science-h3',
      'science-h4',
      'science-r1',
      'social-studies-r1',
      'tech-arts-r1',
    ])
  })

  it('records exactly one RELEASE_PLANNING_CONTRACT source (release-r1)', () => {
    const planning = view.sources.filter((s) => s.source.role === 'RELEASE_PLANNING_CONTRACT')
    expect(planning).toHaveLength(1)
    expect(planning[0].source.ref).toBe('origin/mac/hs912-release-r1')
    expect(planning[0].displayStatus).toBe('COVERED')
  })

  it('records 6 AUTHORED_SUBJECT_EVIDENCE bundles (math, ela, science-h4, social-studies, health-pe, rfl-finlit, tech-arts)', () => {
    const authored = view.sources.filter((s) => s.source.role === 'AUTHORED_SUBJECT_EVIDENCE')
    expect(authored.map((a) => a.source.key).sort()).toEqual([
      'ela-r1', 'health-pe-r1', 'math-r1', 'rfl-finlit-r1', 'science-h4',
      'social-studies-r1', 'tech-arts-r1',
    ])
  })

  it('marks science-r1, h2, and h3 as SUPERSEDED with supersededBy=science-h4', () => {
    const superseded = view.sources.filter((s) => s.source.role === 'SUPERSEDED_SUBJECT_EVIDENCE')
    expect(superseded.map((s) => s.source.key).sort()).toEqual(['science-h2', 'science-h3', 'science-r1'])
    for (const s of superseded) expect(s.source.supersededBy).toBe('science-h4')
  })

  it('carries a short git SHA on every source', () => {
    for (const s of view.sources) {
      expect(s.source.sha).toMatch(/^[0-9a-f]{7,12}$/)
    }
  })

  it('projects every non-superseded family as authored (all 10 subject families have subject evidence)', () => {
    for (const fam of view.familySourceCoverage) {
      expect(fam.status).toBe('authored')
      expect(fam.authorityRefs.length).toBeGreaterThan(0)
    }
  })
})

describe('deriveHighSchoolProgramView — reconciliation', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('reconciles all 40 HS courses (10 subjects × 4 grades)', () => {
    expect(view.reconciliations).toHaveLength(40)
  })

  it('every reconciliation names a contract course and a subject ref @ sha', () => {
    for (const r of view.reconciliations) {
      expect(r.courseId).toMatch(/^ma-g(?:9|1[0-2])-/)
      expect(r.subjectRef).not.toBeNull()
      expect(r.subjectSha).toMatch(/^[0-9a-f]{7,12}$/)
    }
  })

  it('math and ELA courses diverge on title (sessions match)', () => {
    for (const r of view.reconciliations.filter((r) => r.subject === 'mathematics' || r.subject === 'english-language-arts')) {
      expect(r.sessionsMatch).toBe(true)
      expect(r.titleMatch).toBe(false)
      expect(r.idMatch).toBe(true)
      expect(r.verdict).toBe('DIVERGES_TITLE')
    }
  })

  it('science courses diverge on id scheme (ma-hs9-biology, etc.)', () => {
    for (const r of view.reconciliations.filter((r) => r.subject === 'science')) {
      expect(r.idMatch).toBe(false)
      expect(r.verdict).toBe('DIVERGES_ID_SCHEME')
      expect(r.subjectCourseId).toMatch(/^ma-hs(?:9|1[0-2])-/)
      expect(r.subjectSessions).toBe(108)
      expect(r.contractSessions).toBe(180)
    }
  })

  it('social studies diverges on title and sessions (180 → 108) for every grade', () => {
    for (const r of view.reconciliations.filter((r) => r.subject === 'social-studies')) {
      expect(r.titleMatch).toBe(false)
      expect(r.sessionsMatch).toBe(false)
      expect(r.verdict).toBe('DIVERGES_TITLE_AND_SESSIONS')
    }
  })

  it('health/PE Grade 9 diverges on sessions (90 → 36 / 90 → 108); Grades 10-12 match on sessions but diverge on titles', () => {
    const health9 = view.reconciliations.find((r) => r.courseId === 'ma-g9-health')!
    expect(health9.contractSessions).toBe(90)
    expect(health9.subjectSessions).toBe(36)
    expect(health9.sessionsMatch).toBe(false)
    const pe9 = view.reconciliations.find((r) => r.courseId === 'ma-g9-physical-education')!
    expect(pe9.contractSessions).toBe(90)
    expect(pe9.subjectSessions).toBe(108)
    expect(pe9.sessionsMatch).toBe(false)
    for (const grade of [10, 11, 12] as const) {
      const health = view.reconciliations.find((r) => r.courseId === `ma-g${grade}-health`)!
      const pe = view.reconciliations.find((r) => r.courseId === `ma-g${grade}-physical-education`)!
      expect(health.sessionsMatch).toBe(true)
      expect(pe.sessionsMatch).toBe(true)
    }
  })

  it('technology diverges on title and sessions in all four grades', () => {
    for (const r of view.reconciliations.filter((r) => r.subject === 'technology')) {
      expect(r.titleMatch).toBe(false)
      expect(r.sessionsMatch).toBe(false)
      expect(r.verdict).toBe('DIVERGES_TITLE_AND_SESSIONS')
    }
  })

  it('financial literacy Grade 9 diverges on sessions (90 → 72); 10-12 sessions match', () => {
    const fl9 = view.reconciliations.find((r) => r.courseId === 'ma-g9-financial-literacy')!
    expect(fl9.sessionsMatch).toBe(false)
    expect(fl9.contractSessions).toBe(90)
    expect(fl9.subjectSessions).toBe(72)
    for (const grade of [10, 11, 12] as const) {
      const fl = view.reconciliations.find((r) => r.courseId === `ma-g${grade}-financial-literacy`)!
      expect(fl.sessionsMatch).toBe(true)
    }
  })

  it('counts divergent reconciliations honestly — none of the 40 currently MATCHES_CONTRACT', () => {
    // Every HS course in the current evidence diverges from the release matrix on at least one dimension.
    const counts = reconciliationVerdictCounts(view)
    expect(counts.MATCHES_CONTRACT).toBe(0)
    expect(divergentReconciliations(view).length).toBe(view.reconciliations.length)
  })
})

describe('deriveHighSchoolProgramView — delivery / integration', () => {
  const view = deriveHighSchoolProgramView(SNAP)

  it('carries at least one delivery fact and every fact has a source ref + path', () => {
    expect(view.delivery.length).toBeGreaterThan(0)
    for (const d of view.delivery) {
      expect(d.evidenceRef).toBeTruthy()
      expect(d.evidencePath).toBeTruthy()
    }
  })

  it('reports NOT_COVERED when no delivery fact is served in the active release', () => {
    expect(view.deliveryStatus.servedInReleaseCount).toBe(0)
    expect(view.deliveryStatus.displayStatus).toBe('NOT_COVERED')
  })

  it('reports COVERED when every fact is served', () => {
    const snap = {
      ...SNAP,
      delivery: SNAP.delivery.map((d) => ({ ...d, servedInRelease: true })),
    }
    const v = deriveHighSchoolProgramView(snap)
    expect(v.deliveryStatus.displayStatus).toBe('COVERED')
  })

  it('reports PARTIAL when some facts are served and some are not', () => {
    const snap = {
      ...SNAP,
      delivery: [
        { ...SNAP.delivery[0], servedInRelease: true },
        ...SNAP.delivery.slice(1),
      ],
    }
    const v = deriveHighSchoolProgramView(snap)
    expect(v.deliveryStatus.displayStatus).toBe('PARTIAL')
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

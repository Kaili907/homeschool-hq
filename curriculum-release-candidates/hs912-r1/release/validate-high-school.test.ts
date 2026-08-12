import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BLOCKED,
  COURSE_ID,
  COVERAGE_VERDICTS,
  GRADE_SPAN,
  LESSON_ID,
  READY,
  SUBJECT_FAMILIES,
  UNIT_ID,
  checkAssembly,
  checkCountsAreNotPinned,
  checkCoverageMap,
  checkDeclaredGaps,
  checkHandoff,
  checkIdGrammar,
  checkLesson,
  checkMatrix,
  checkNoPrerequisiteCycle,
  checkSchedules,
  runValidation,
} from './validate-high-school.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const codes = (findings: any[]) => findings.map((f) => f.code)
const blocking = (findings: any[]) => findings.filter((f) => f.severity === 'BLOCKING')

async function realMatrix(): Promise<any> {
  return JSON.parse(await readFile(join(HERE, 'course-matrix.json'), 'utf8'))
}

// A minimal well-formed matrix, built from the same rules the real one follows.
function syntheticMatrix(): any {
  const courses: any[] = []
  for (const subject of SUBJECT_FAMILIES) {
    courses.push({
      course_id: `ma-g8-${subject}`,
      grade: 8,
      subject,
      origin: 'EXISTING_GRADE_8_ANCHOR',
      authoring_status: 'FROZEN_DO_NOT_MODIFY',
      source_path: `curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/${subject}`,
      owner_branch: null,
      prerequisite_course_ids: [],
      classification: 'EXISTING_RELEASE_CONTENT',
    })
    for (const grade of [9, 10, 11, 12]) {
      courses.push({
        course_id: `ma-g${grade}-${subject}`,
        grade,
        subject,
        origin: 'NEW_HIGH_SCHOOL_COURSE',
        authoring_status: 'TO_BE_AUTHORED',
        source_path: `curriculum-authoring/full-family-highschool-9-12/${subject}/grade-${grade}/`,
        owner_branch: 'mac/hs912-math-r1',
        prerequisite_course_ids: [`ma-g${grade - 1}-${subject}`],
        credit_recommendation: 1,
        credit_components: null,
        standards_framework: 'framework',
        classification: 'MANUEL_ACADEMY_COURSE_DESIGN_DECISION',
      })
    }
  }
  return {
    schema_version: 'manuel-academy-high-school-course-matrix-1.0',
    grade_span: [...GRADE_SPAN],
    subject_families: SUBJECT_FAMILIES.map((subject) => ({
      subject,
      owner_branch: 'mac/hs912-math-r1',
    })),
    count_policy: 'derived, not asserted',
    expected_counts: {
      grade_8_anchor_courses: 10,
      new_high_school_courses: 40,
      total_courses_in_matrix: 50,
      units_per_course: 'NOT_FIXED_BY_THIS_CONTRACT',
      lessons_per_course: 'NOT_FIXED_BY_THIS_CONTRACT',
    },
    courses,
  }
}

describe('identifier grammar', () => {
  it('is internally consistent', () => {
    expect(checkIdGrammar()).toEqual([])
  })

  it('accepts two-digit grades and rejects the truncated form', () => {
    expect(COURSE_ID.test('ma-g10-mathematics')).toBe(true)
    expect(COURSE_ID.test('ma-g12-arts-and-music')).toBe(true)
    // The alternation bug this guards: `ma-g(5|7|8|9|10)` would let `ma-g1-…`
    // through by matching `1` and leaving `0` to the subject segment.
    expect(COURSE_ID.test('ma-g1-mathematics')).toBe(false)
    expect(COURSE_ID.test('ma-g13-mathematics')).toBe(false)
  })

  it('holds for unit and lesson identifiers', () => {
    expect(UNIT_ID.test('ma-g11-science-u01')).toBe(true)
    expect(UNIT_ID.test('ma-g11-science-u1')).toBe(false)
    expect(LESSON_ID.test('ma-g10-health-u02-l14')).toBe(true)
    expect(LESSON_ID.test('ma-g10-health-u02-l14x')).toBe(false)
  })
})

describe('course matrix', () => {
  it('passes on the real contract file', async () => {
    expect(blocking(checkMatrix(await realMatrix()))).toEqual([])
  })

  it('publishes exactly one course per family per grade across 8-12', async () => {
    const matrix = await realMatrix()
    for (const subject of SUBJECT_FAMILIES) {
      for (const grade of GRADE_SPAN) {
        const hits = matrix.courses.filter((c: any) => c.subject === subject && c.grade === grade)
        expect(hits, `${subject} grade ${grade}`).toHaveLength(1)
      }
    }
    expect(matrix.courses).toHaveLength(50)
  })

  it('detects a skipped grade', () => {
    const matrix = syntheticMatrix()
    matrix.courses = matrix.courses.filter((c: any) => c.course_id !== 'ma-g11-science')
    matrix.expected_counts.new_high_school_courses = 39
    matrix.expected_counts.total_courses_in_matrix = 49
    const found = codes(checkMatrix(matrix))
    expect(found).toContain('GRADE_MISSING')
    expect(found).toContain('PREREQ_UNRESOLVED')
  })

  it('detects a duplicated subject-grade slot', () => {
    const matrix = syntheticMatrix()
    matrix.courses.push({ ...matrix.courses.find((c: any) => c.course_id === 'ma-g9-science') })
    expect(codes(checkMatrix(matrix))).toContain('COURSE_ID_DUPLICATE')
  })

  it('detects an incoherent prerequisite', () => {
    const matrix = syntheticMatrix()
    const course = matrix.courses.find((c: any) => c.course_id === 'ma-g11-science')
    course.prerequisite_course_ids = ['ma-g10-mathematics']
    expect(codes(checkMatrix(matrix))).toContain('PREREQ_INCOHERENT')
  })

  it('detects a prerequisite cycle', () => {
    const cyclic = [
      { course_id: 'a', prerequisite_course_ids: ['b'] },
      { course_id: 'b', prerequisite_course_ids: ['a'] },
    ]
    expect(codes(checkNoPrerequisiteCycle(cyclic))).toContain('PREREQ_CYCLE')
  })

  it('rejects a course that writes outside its family root', () => {
    const matrix = syntheticMatrix()
    matrix.courses.find((c: any) => c.course_id === 'ma-g9-health').source_path =
      'curriculum-authoring/full-family-highschool-9-12/science/grade-9/'
    expect(codes(checkMatrix(matrix))).toContain('COURSE_PATH_OUT_OF_FAMILY')
  })

  it('rejects an unfrozen Grade 8 anchor', () => {
    const matrix = syntheticMatrix()
    matrix.courses.find((c: any) => c.course_id === 'ma-g8-science').authoring_status = 'TO_BE_AUTHORED'
    expect(codes(checkMatrix(matrix))).toContain('ANCHOR_NOT_FROZEN')
  })

  it('requires split-credit components to sum to the course credit', () => {
    const matrix = syntheticMatrix()
    const course = matrix.courses.find((c: any) => c.course_id === 'ma-g11-social-studies')
    course.credit_components = [
      { component: 'Civics', credit: 0.5 },
      { component: 'Economics', credit: 0.25 },
    ]
    expect(codes(checkMatrix(matrix))).toContain('CREDIT_COMPONENTS_SUM')
  })

  it('accepts the real split-credit civics/economics course', async () => {
    const matrix = await realMatrix()
    const course = matrix.courses.find((c: any) => c.course_id === 'ma-g11-social-studies')
    expect(course.credit_components).toHaveLength(2)
    const sum = course.credit_components.reduce((t: number, p: any) => t + p.credit, 0)
    expect(sum).toBeCloseTo(course.credit_recommendation)
  })
})

describe('lesson counts are not pinned before builders return', () => {
  it('passes on the real contract file', async () => {
    expect(checkCountsAreNotPinned(await realMatrix())).toEqual([])
  })

  it('fails if a future edit hardcodes a lesson total', () => {
    const matrix = syntheticMatrix()
    matrix.expected_counts.lessons_per_course = 180
    expect(codes(checkCountsAreNotPinned(matrix))).toContain('COUNTS_PINNED_TOO_EARLY')
  })

  it('fails if the count policy is removed', () => {
    const matrix = syntheticMatrix()
    delete matrix.count_policy
    expect(codes(checkCountsAreNotPinned(matrix))).toContain('COUNT_POLICY_MISSING')
  })
})

describe('grade 8 to 9 handoff', () => {
  it('passes on the real document', async () => {
    const text = await readFile(join(HERE, 'grade8-to-grade9-handoff.md'), 'utf8')
    expect(blocking(checkHandoff(text, await realMatrix()))).toEqual([])
  })

  it('fails when a family is not explained', () => {
    const text = '**Continuity ruling: CONTINUOUS.** world language noted'
    const found = codes(checkHandoff(text, syntheticMatrix()))
    expect(found).toContain('HANDOFF_FAMILY_MISSING')
    expect(found).toContain('HANDOFF_RULINGS_INCOMPLETE')
  })

  it('fails when World Language is silently omitted', () => {
    const found = codes(checkHandoff('ma-g8-science ma-g9-science', syntheticMatrix()))
    expect(found).toContain('HANDOFF_WORLD_LANGUAGE_SILENT')
  })
})

describe('coverage map', () => {
  it('passes on the real document and uses every verdict', async () => {
    const text = await readFile(join(HERE, 'credit-coverage-map.md'), 'utf8')
    expect(blocking(checkCoverageMap(text))).toEqual([])
    for (const verdict of COVERAGE_VERDICTS) expect(text).toContain(verdict)
  })

  it('fails when a verdict is never used', () => {
    expect(codes(checkCoverageMap('COVERED only, world language'))).toContain('COVERAGE_VERDICT_UNUSED')
  })

  it('fails when World Language is not ruled on', () => {
    const text = COVERAGE_VERDICTS.join(' ')
    expect(codes(checkCoverageMap(text))).toContain('COVERAGE_WORLD_LANGUAGE_MISSING')
  })
})

// ---------------------------------------------------------------------------

function lesson(overrides: Record<string, unknown> = {}): any {
  return {
    lesson_id: 'ma-g9-science-u01-l01',
    course_id: 'ma-g9-science',
    subject: 'science',
    title: 'Launch and diagnostic',
    phase: 'Launch',
    focus: 'cells',
    standards: ['HS-EXAMPLE-1'],
    learning_objectives: ['a', 'b', 'c'],
    lesson_flow: [1, 2, 3, 4, 5],
    formative_check: 'exit ticket',
    mastery_rule: 'two occasions',
    accessibility_and_accommodations: ['a', 'b', 'c', 'd', 'e'],
    safety_and_privacy: ['a', 'b'],
    answer_or_scoring_guidance: 'score the target',
    adaptive_tutor_routes: [],
    ...overrides,
  }
}

function course(overrides: Record<string, unknown> = {}): any {
  return {
    course_id: 'ma-g9-science',
    grade: 9,
    subject: 'science',
    units: [{
      unit_id: 'ma-g9-science-u01',
      course_id: 'ma-g9-science',
      unit_number: 1,
      standards: ['HS-EXAMPLE-1'],
      lesson_ids: ['ma-g9-science-u01-l01', 'ma-g9-science-u01-l02'],
      assessment_id: 'ma-g9-science-u01-assessment',
    }],
    lessons: [lesson(), lesson({ lesson_id: 'ma-g9-science-u01-l02' })],
    assessments: [{ assessment_id: 'ma-g9-science-u01-assessment' }],
    ...overrides,
  }
}

function model(overrides: Record<string, unknown> = {}): any {
  return {
    courses: [course()],
    schedules: [{ grade: 9, references: ['ma-g9-science-u01-l01', 'ma-g9-science-u01-l02'] }],
    standardsRegistries: { science: new Set(['HS-EXAMPLE-1']) },
    ...overrides,
  }
}

describe('lesson contract', () => {
  it('accepts a well-formed lesson', () => {
    expect(blocking(checkLesson(lesson(), 'ma-g9-science', new Set(['HS-EXAMPLE-1'])))).toEqual([])
  })

  it('rejects thin accessibility provision', () => {
    const found = codes(checkLesson(lesson({ accessibility_and_accommodations: ['a'] }), 'ma-g9-science', null))
    expect(found).toContain('LESSON_FIELD_INSUFFICIENT')
  })

  it('rejects a missing mastery rule', () => {
    expect(codes(checkLesson(lesson({ mastery_rule: '' }), 'ma-g9-science', null))).toContain('LESSON_FIELD_MISSING')
  })

  it('rejects required media with no alternative', () => {
    const found = codes(checkLesson(
      lesson({ media: { required: true } }), 'ma-g9-science', null))
    expect(found).toContain('MEDIA_NO_ALTERNATIVE')
  })

  it('accepts required media that offers a text alternative', () => {
    const found = codes(checkLesson(
      lesson({ media: { required: true, fallback: 'read the transcript' } }), 'ma-g9-science', null))
    expect(found).not.toContain('MEDIA_NO_ALTERNATIVE')
  })

  it('rejects an untraceable standards code', () => {
    const found = codes(checkLesson(lesson({ standards: ['HS-MADE-UP-9'] }), 'ma-g9-science', new Set(['HS-EXAMPLE-1'])))
    expect(found).toContain('STANDARD_UNTRACEABLE')
  })

  it('accepts an honestly marked UNVERIFIED code', () => {
    const found = codes(checkLesson(
      lesson({ standards: ['UNVERIFIED: pending MDE confirmation'] }), 'ma-g9-science', new Set(['HS-EXAMPLE-1'])))
    expect(found).not.toContain('STANDARD_UNTRACEABLE')
  })

  it('rejects a privacy-prohibited request', () => {
    const found = codes(checkLesson(
      lesson({ student_activity: 'Submit home address to the tutor.' }), 'ma-g9-science', null))
    expect(found).toContain('PRIVACY_PROHIBITED_REQUEST')
  })

  it('rejects body-based assessment in health and physical education', () => {
    const found = codes(checkLesson(
      lesson({ lesson_id: 'ma-g9-health-u01-l01', subject: 'health', student_activity: 'Record a weigh-in.' }),
      'ma-g9-health', null))
    expect(found).toContain('BODY_ASSESSMENT_PROHIBITED')
  })
})

describe('assembly', () => {
  it('accepts a coherent delivery', () => {
    expect(blocking(checkAssembly(model()))).toEqual([])
  })

  it('rejects a lesson claimed by two units', () => {
    const m = model()
    m.courses[0].units.push({
      unit_id: 'ma-g9-science-u02',
      course_id: 'ma-g9-science',
      unit_number: 2,
      standards: ['HS-EXAMPLE-1'],
      lesson_ids: ['ma-g9-science-u01-l01'],
      assessment_id: 'ma-g9-science-u02-assessment',
    })
    expect(codes(checkAssembly(m))).toContain('LESSON_CLAIMED_TWICE')
  })

  it('rejects an orphaned lesson', () => {
    const m = model()
    m.courses[0].lessons.push(lesson({ lesson_id: 'ma-g9-science-u01-l03' }))
    m.schedules[0].references.push('ma-g9-science-u01-l03')
    expect(codes(checkAssembly(m))).toContain('LESSON_ORPHANED')
  })

  it('rejects non-sequential unit numbering', () => {
    const m = model()
    m.courses[0].units[0].unit_number = 2
    expect(codes(checkAssembly(m))).toContain('UNIT_NUMBERING')
  })

  it('rejects a unit that cannot evidence mastery twice', () => {
    const m = model()
    m.courses[0].units[0].lesson_ids = ['ma-g9-science-u01-l01']
    m.courses[0].lessons = [lesson()]
    m.schedules[0].references = ['ma-g9-science-u01-l01']
    expect(codes(checkAssembly(m))).toContain('MASTERY_SINGLE_OCCASION')
  })

  it('rejects a course with no assessment', () => {
    const m = model()
    m.courses[0].assessments = []
    expect(codes(checkAssembly(m))).toContain('COURSE_NO_ASSESSMENT')
  })

  it('rejects duplicate lesson ids across courses', () => {
    const m = model()
    m.courses.push(course({
      course_id: 'ma-g10-science',
      grade: 10,
      units: [{
        unit_id: 'ma-g10-science-u01',
        course_id: 'ma-g10-science',
        unit_number: 1,
        standards: ['HS-EXAMPLE-1'],
        lesson_ids: ['ma-g9-science-u01-l01', 'ma-g9-science-u01-l02'],
        assessment_id: 'ma-g10-science-u01-assessment',
      }],
      assessments: [{ assessment_id: 'ma-g10-science-u01-assessment' }],
    }))
    expect(codes(checkAssembly(m))).toContain('LESSON_ID_DUPLICATE')
  })
})

describe('schedule references', () => {
  it('resolves every reference exactly once', () => {
    const owner = new Map([['ma-g9-science-u01-l01', 'ma-g9-science']])
    const found = checkSchedules(
      { schedules: [{ grade: 9, references: ['ma-g9-science-u01-l01'] }] } as any, owner)
    expect(blocking(found)).toEqual([])
  })

  it('rejects a reference that resolves to nothing', () => {
    const owner = new Map([['ma-g9-science-u01-l01', 'ma-g9-science']])
    const found = codes(checkSchedules(
      { schedules: [{ grade: 9, references: ['ma-g9-science-u09-l99'] }] } as any, owner))
    expect(found).toContain('SCHEDULE_REF_UNRESOLVED')
    expect(found).toContain('LESSON_UNSCHEDULED')
  })

  it('rejects a lesson scheduled twice', () => {
    const owner = new Map([['ma-g9-science-u01-l01', 'ma-g9-science']])
    const found = codes(checkSchedules(
      { schedules: [{ grade: 9, references: ['ma-g9-science-u01-l01', 'ma-g9-science-u01-l01'] }] } as any, owner))
    expect(found).toContain('SCHEDULE_REF_DUPLICATED')
  })

  it('rejects a delivery with no schedule at all', () => {
    const owner = new Map([['ma-g9-science-u01-l01', 'ma-g9-science']])
    expect(codes(checkSchedules({ schedules: [] } as any, owner))).toContain('SCHEDULE_MISSING')
  })
})

describe('end to end', () => {
  it('reports the contract as ready and asserts no counts', async () => {
    const result = await runValidation({ mode: 'contract' })
    expect(result.findings.filter((f: any) => f.severity === 'BLOCKING')).toEqual([])
    expect(result.overall).toBe(READY)
    expect(result.countsAsserted).toBe(false)
    expect(result.derivedCounts).toBeNull()
  })

  it('blocks assembly mode until the subject sessions return', async () => {
    const result = await runValidation({ mode: 'assembly' })
    expect(result.overall).toBe(BLOCKED)
    expect(codes(result.findings)).toContain('ASSEMBLY_INCOMPLETE')
    // Counts are observed, never asserted against a pre-agreed total.
    expect(result.derivedCounts).not.toBeNull()
  })
})

describe('declared coverage gaps', () => {
  it('passes on the real contract file and declares World Language', async () => {
    const matrix = await realMatrix()
    expect(blocking(checkDeclaredGaps(matrix))).toEqual([])
    const wl = matrix.declared_coverage_gaps.find((g: any) => g.requirement === 'MMC_WORLD_LANGUAGE')
    expect(wl.verdict).toBe('NOT_COVERED')
    expect(wl.irreducible_remainder_credits).toBe(0.5)
    expect(matrix.graduation_completeness.verdict).toBe('NOT_GRADUATION_COMPLETE')
  })

  it('refuses an empty audit', () => {
    expect(codes(checkDeclaredGaps({ declared_coverage_gaps: [] }))).toContain('GAPS_NOT_DECLARED')
  })

  it('refuses a graduation-complete claim while a requirement is uncovered', async () => {
    const matrix = await realMatrix()
    matrix.graduation_completeness = { verdict: 'GRADUATION_COMPLETE' }
    expect(codes(checkDeclaredGaps(matrix))).toContain('COMPLETENESS_CLAIMED_OVER_GAP')
  })

  it('refuses to let World Language be dropped from the audit', async () => {
    const matrix = await realMatrix()
    matrix.declared_coverage_gaps = matrix.declared_coverage_gaps.filter(
      (g: any) => g.requirement !== 'MMC_WORLD_LANGUAGE')
    expect(codes(checkDeclaredGaps(matrix))).toContain('GAP_WORLD_LANGUAGE_UNDECLARED')
  })

  it('refuses an unowned or unexplained gap', async () => {
    const matrix = await realMatrix()
    matrix.declared_coverage_gaps.push({ requirement: 'SOMETHING', verdict: 'NOT_COVERED' })
    const found = codes(checkDeclaredGaps(matrix))
    expect(found).toContain('GAP_UNOWNED')
    expect(found).toContain('GAP_UNEXPLAINED')
  })

  it('requires a not-complete verdict to state its basis', async () => {
    const matrix = await realMatrix()
    matrix.graduation_completeness = { verdict: 'NOT_GRADUATION_COMPLETE' }
    expect(codes(checkDeclaredGaps(matrix))).toContain('COMPLETENESS_UNSUPPORTED')
  })
})

describe('online learning experience has an explicit owner', () => {
  it('is assigned to the grade 9 technology course', async () => {
    const matrix = await realMatrix()
    const owners = matrix.courses.filter((c: any) =>
      (c.satisfies_state_requirements ?? []).includes('MMC_ONLINE_LEARNING_EXPERIENCE'))
    expect(owners.map((c: any) => c.course_id)).toEqual(['ma-g9-technology'])
  })
})

describe('state requirements have homes where the audit says they do', () => {
  it('places algebra I, geometry and algebra II, and a final-year mathematics course', async () => {
    const matrix = await realMatrix()
    const math = matrix.courses
      .filter((c: any) => c.subject === 'mathematics' && c.grade !== 8)
      .sort((a: any, b: any) => a.grade - b.grade)
    expect(math.map((c: any) => c.course_name)).toEqual([
      'Algebra I', 'Geometry', 'Algebra II', 'Precalculus with Statistics',
    ])
    const final = math.find((c: any) => c.grade === 12)
    expect(final.satisfies_state_requirements).toContain('MMC_MATHEMATICS_FINAL_YEAR')
  })

  it('carries the VPAA credit across grades 9 and 10 and holds grades 11-12 in reserve', async () => {
    const matrix = await realMatrix()
    const arts = matrix.courses.filter((c: any) => c.subject === 'arts-and-music' && c.grade !== 8)
    const required = arts.filter((c: any) =>
      c.satisfies_state_requirements.includes('MMC_VISUAL_PERFORMING_APPLIED_ARTS'))
    expect(required.map((c: any) => c.grade)).toEqual([9, 10])
    expect(required.reduce((t: number, c: any) => t + c.credit_recommendation, 0)).toBeCloseTo(1.0)
    // The additional 1.0 is the substitutable world-language credit; it must stay.
    const reserve = arts.filter((c: any) => c.grade >= 11)
    expect(reserve.reduce((t: number, c: any) => t + c.credit_recommendation, 0)).toBeCloseTo(1.0)
    for (const c of reserve) expect(c.design_note).toMatch(/World Language/i)
  })

  it('places health and physical education together in grade 9 for the combined credit', async () => {
    const matrix = await realMatrix()
    const carriers = matrix.courses.filter((c: any) =>
      c.satisfies_state_requirements?.includes('MMC_PHYSICAL_EDUCATION_AND_HEALTH'))
    expect(carriers.map((c: any) => c.course_id).sort())
      .toEqual(['ma-g9-health', 'ma-g9-physical-education'])
    expect(carriers.reduce((t: number, c: any) => t + c.credit_recommendation, 0)).toBeCloseTo(1.0)
  })

  it('keeps economics distinct from personal finance', async () => {
    const matrix = await realMatrix()
    const econ = matrix.courses.find((c: any) =>
      c.satisfies_state_requirements?.includes('MMC_SOCIAL_STUDIES_ECONOMICS'))
    expect(econ.subject).toBe('social-studies')
    const pf = matrix.courses.find((c: any) =>
      c.satisfies_state_requirements?.includes('MMC_PERSONAL_FINANCE'))
    expect(pf.subject).toBe('financial-literacy')
    expect(pf.satisfies_state_requirements).not.toContain('MMC_SOCIAL_STUDIES_ECONOMICS')
  })

  it('has no world-language course anywhere', async () => {
    const matrix = await realMatrix()
    expect(matrix.courses.filter((c: any) => c.subject === 'world-language')).toEqual([])
  })
})

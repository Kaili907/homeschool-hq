// Manuel Academy — Grades 9-12 release validator.
//
// Proves the structural claims of the high-school release contract. Runs in two
// modes:
//   --mode contract  (default) the contract artifacts themselves are coherent
//   --mode assembly            plus: what the subject sessions actually returned
//
// Deliberate non-goal: this validator NEVER asserts a pre-agreed lesson or unit
// total. Counts are derived from delivered content and checked for internal
// consistency. A contract that pins lesson counts before builders return is
// itself a failure (see checkCountsAreNotPinned).
import { readFile, stat } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const HIGH_SCHOOL_VALIDATOR_SCHEMA_VERSION = 1
export const READY = 'HIGH_SCHOOL_RELEASE_CONTRACT_READY'
export const BLOCKED = 'BLOCKED'

export const GRADE_SPAN = Object.freeze([8, 9, 10, 11, 12])
export const HIGH_SCHOOL_GRADES = Object.freeze([9, 10, 11, 12])

export const SUBJECT_FAMILIES = Object.freeze([
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology',
  'arts-and-music',
  'financial-literacy',
])

export const OWNER_BRANCHES = Object.freeze([
  'mac/hs912-math-r1',
  'mac/hs912-ela-r1',
  'mac/hs912-science-r1',
  'mac/hs912-social-studies-r1',
  'mac/hs912-health-pe-r1',
  'mac/hs912-rfl-finlit-r1',
  'mac/hs912-tech-arts-r1',
])

// Two-digit-grade-safe identifier grammar. `1[0-2]` is a single alternative so
// that `ma-g1-…` can never match and `ma-g10-…` can never be truncated.
const G = '(?:5|7|8|9|1[0-2])'
const SUBJ = '[a-z][a-z-]*[a-z]'
export const COURSE_ID = new RegExp(`^ma-g${G}-${SUBJ}$`)
export const UNIT_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}$`)
export const LESSON_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}-l\\d{2}$`)
export const ASSESSMENT_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}-assessment$`)

/** Every lesson record must carry these. Mirrors the published Grade 8 lesson
 *  contract (curriculum-content/…/schemas/lesson.schema.json) so high-school
 *  content stays Study-compatible. */
export const REQUIRED_LESSON_FIELDS = Object.freeze({
  standards: { kind: 'array', min: 1 },
  learning_objectives: { kind: 'array', min: 3 },
  lesson_flow: { kind: 'array', min: 5 },
  accessibility_and_accommodations: { kind: 'array', min: 5 },
  safety_and_privacy: { kind: 'array', min: 2 },
  formative_check: { kind: 'string' },
  mastery_rule: { kind: 'string' },
  title: { kind: 'string' },
  phase: { kind: 'string' },
  focus: { kind: 'string' },
})

/** Fields the browser projection strips. Their presence in source is required
 *  (teacher/tutor material must exist); their absence is what build-curriculum
 *  enforces downstream. */
export const PROTECTED_LESSON_FIELDS = Object.freeze([
  'answer_or_scoring_guidance',
  'adaptive_tutor_routes',
])

/** Privacy denylist. A lesson must never require any of these of a learner. */
export const PRIVACY_PROHIBITED = Object.freeze([
  'social security number', 'passport number', 'real password', 'account credentials',
  'card number', 'credit card number', 'precise location', 'home address',
  'medical diagnosis', 'family income', 'immigration status',
])

/** Health/PE assessment denylist carried forward from the published policy. */
export const BODY_ASSESSMENT_PROHIBITED = Object.freeze([
  'calorie target', 'weigh-in', 'weigh in', 'body-size score', 'body size score',
  'weight cutting', 'earned food', 'body mass index score',
])

const isArray = Array.isArray
const isText = (v) => typeof v === 'string' && v.trim().length > 0

function finding(severity, code, message, context = {}) {
  return Object.freeze({ severity, code, message, context: Object.freeze({ ...context }) })
}
const fail = (code, message, context) => finding('BLOCKING', code, message, context)
const warn = (code, message, context) => finding('ADVISORY', code, message, context)

// ---------------------------------------------------------------------------
// Contract-mode checks (pure)
// ---------------------------------------------------------------------------

export function checkIdGrammar() {
  const out = []
  // Guards against the classic `ma-g(5|7|8|9|10)` alternation mistake, where the
  // `1` of `10` matches as its own alternative and Grade 10 silently degrades.
  const mustAccept = [
    'ma-g8-mathematics', 'ma-g9-mathematics', 'ma-g10-mathematics',
    'ma-g11-english-language-arts', 'ma-g12-arts-and-music',
  ]
  const mustReject = ['ma-g1-mathematics', 'ma-g13-mathematics', 'ma-g0-mathematics', 'ma-g10-', 'ma-g10-Mathematics']
  for (const id of mustAccept) {
    if (!COURSE_ID.test(id)) out.push(fail('ID_GRAMMAR_REJECTS_VALID', `course id grammar rejects ${id}`, { id }))
  }
  for (const id of mustReject) {
    if (COURSE_ID.test(id)) out.push(fail('ID_GRAMMAR_ACCEPTS_INVALID', `course id grammar accepts ${id}`, { id }))
  }
  if (!LESSON_ID.test('ma-g10-science-u01-l01')) {
    out.push(fail('ID_GRAMMAR_REJECTS_VALID', 'lesson id grammar rejects a Grade 10 lesson id', {}))
  }
  if (LESSON_ID.test('ma-g1-science-u01-l01')) {
    out.push(fail('ID_GRAMMAR_ACCEPTS_INVALID', 'lesson id grammar accepts a Grade 1 lesson id', {}))
  }
  return out
}

export function checkCountsAreNotPinned(matrix) {
  const out = []
  const counts = matrix?.expected_counts ?? {}
  for (const key of ['units_per_course', 'lessons_per_course']) {
    if (typeof counts[key] === 'number') {
      out.push(fail('COUNTS_PINNED_TOO_EARLY',
        `expected_counts.${key} pins a numeric total before builders returned`, { key, value: counts[key] }))
    }
  }
  if (!isText(matrix?.count_policy)) {
    out.push(fail('COUNT_POLICY_MISSING', 'course-matrix.json must state its count policy', {}))
  }
  return out
}

export function checkMatrix(matrix) {
  const out = []
  if (matrix?.schema_version !== 'manuel-academy-high-school-course-matrix-1.0') {
    out.push(fail('MATRIX_SCHEMA_VERSION', 'unexpected course-matrix schema_version',
      { found: matrix?.schema_version ?? null }))
    return out
  }
  const courses = isArray(matrix.courses) ? matrix.courses : []
  if (courses.length === 0) return [fail('MATRIX_EMPTY', 'course-matrix.json declares no courses', {})]

  // --- grade span is exactly the contracted span, in order
  const span = isArray(matrix.grade_span) ? matrix.grade_span : []
  if (span.join(',') !== GRADE_SPAN.join(',')) {
    out.push(fail('GRADE_SPAN_MISMATCH', 'grade_span is not 8,9,10,11,12', { found: span }))
  }

  // --- families declared match families used
  const declared = isArray(matrix.subject_families) ? matrix.subject_families.map((f) => f.subject) : []
  for (const fam of SUBJECT_FAMILIES) {
    if (!declared.includes(fam)) out.push(fail('FAMILY_NOT_DECLARED', `subject family ${fam} is not declared`, { fam }))
  }
  for (const fam of declared) {
    if (!SUBJECT_FAMILIES.includes(fam)) out.push(fail('FAMILY_UNKNOWN', `undeclared subject family ${fam}`, { fam }))
  }
  for (const f of (isArray(matrix.subject_families) ? matrix.subject_families : [])) {
    if (!OWNER_BRANCHES.includes(f.owner_branch)) {
      out.push(fail('FAMILY_OWNER_UNKNOWN', `subject family ${f.subject} names an unknown owner branch`,
        { fam: f.subject, owner: f.owner_branch ?? null }))
    }
  }

  // --- ids unique and well formed, and consistent with their own grade/subject
  const byId = new Map()
  for (const c of courses) {
    if (byId.has(c.course_id)) {
      out.push(fail('COURSE_ID_DUPLICATE', `duplicate course id ${c.course_id}`, { id: c.course_id }))
      continue
    }
    byId.set(c.course_id, c)
    if (!COURSE_ID.test(String(c.course_id ?? ''))) {
      out.push(fail('COURSE_ID_MALFORMED', `malformed course id ${c.course_id}`, { id: c.course_id }))
      continue
    }
    if (c.course_id !== `ma-g${c.grade}-${c.subject}`) {
      out.push(fail('COURSE_ID_INCONSISTENT',
        `course id ${c.course_id} does not encode grade ${c.grade} and subject ${c.subject}`,
        { id: c.course_id, grade: c.grade, subject: c.subject }))
    }
  }

  // --- CONTINUITY: every family x every grade, exactly once. No skipped grade.
  const cell = new Map()
  for (const c of courses) cell.set(`${c.subject}|${c.grade}`, (cell.get(`${c.subject}|${c.grade}`) ?? 0) + 1)
  for (const fam of SUBJECT_FAMILIES) {
    for (const grade of GRADE_SPAN) {
      const n = cell.get(`${fam}|${grade}`) ?? 0
      if (n === 0) {
        out.push(fail('GRADE_MISSING', `subject ${fam} has no course at grade ${grade}`, { fam, grade }))
      } else if (n > 1) {
        out.push(fail('GRADE_DUPLICATED', `subject ${fam} has ${n} courses at grade ${grade}`, { fam, grade, n }))
      }
    }
  }

  // --- PREREQUISITES: coherent, same-family, exactly one step back, acyclic
  for (const c of courses) {
    const pre = isArray(c.prerequisite_course_ids) ? c.prerequisite_course_ids : []
    if (c.grade === 8) {
      if (pre.length !== 0) {
        out.push(fail('ANCHOR_PREREQ', `grade 8 anchor ${c.course_id} must declare no prerequisite`, { id: c.course_id }))
      }
      continue
    }
    if (pre.length !== 1) {
      out.push(fail('PREREQ_CARDINALITY',
        `${c.course_id} must declare exactly one prerequisite, found ${pre.length}`, { id: c.course_id, pre }))
      continue
    }
    const want = `ma-g${c.grade - 1}-${c.subject}`
    if (pre[0] !== want) {
      out.push(fail('PREREQ_INCOHERENT',
        `${c.course_id} declares prerequisite ${pre[0]}, expected ${want}`, { id: c.course_id, found: pre[0], want }))
    }
    if (!byId.has(pre[0])) {
      out.push(fail('PREREQ_UNRESOLVED', `${c.course_id} names prerequisite ${pre[0]} which is not in the matrix`,
        { id: c.course_id, pre: pre[0] }))
    }
  }
  out.push(...checkNoPrerequisiteCycle(courses))

  // --- anchors are frozen and point at the published release
  for (const c of courses.filter((x) => x.grade === 8)) {
    if (c.authoring_status !== 'FROZEN_DO_NOT_MODIFY') {
      out.push(fail('ANCHOR_NOT_FROZEN', `grade 8 anchor ${c.course_id} is not marked frozen`, { id: c.course_id }))
    }
    if (!String(c.source_path ?? '').startsWith('curriculum-content/manuel-academy/1.0.0/')) {
      out.push(fail('ANCHOR_PATH', `grade 8 anchor ${c.course_id} does not point at the published release`,
        { id: c.course_id, path: c.source_path ?? null }))
    }
  }

  // --- new courses: owner, path, credit, classification
  for (const c of courses.filter((x) => x.grade !== 8)) {
    if (!OWNER_BRANCHES.includes(c.owner_branch)) {
      out.push(fail('COURSE_OWNER_UNKNOWN', `${c.course_id} names an unknown owner branch`,
        { id: c.course_id, owner: c.owner_branch ?? null }))
    }
    const wantRoot = `curriculum-authoring/full-family-highschool-9-12/${c.subject}/`
    if (!String(c.source_path ?? '').startsWith(wantRoot)) {
      out.push(fail('COURSE_PATH_OUT_OF_FAMILY', `${c.course_id} writes outside its family root`,
        { id: c.course_id, path: c.source_path ?? null, wantRoot }))
    }
    if (c.classification !== 'MANUEL_ACADEMY_COURSE_DESIGN_DECISION') {
      out.push(fail('COURSE_CLASSIFICATION',
        `${c.course_id} must be classified as a Manuel Academy course-design decision`,
        { id: c.course_id, found: c.classification ?? null }))
    }
    if (typeof c.credit_recommendation !== 'number' || c.credit_recommendation <= 0) {
      out.push(fail('CREDIT_MISSING', `${c.course_id} has no positive credit recommendation`, { id: c.course_id }))
    }
    if (!isText(c.standards_framework)) {
      out.push(fail('FRAMEWORK_MISSING', `${c.course_id} names no standards framework`, { id: c.course_id }))
    }
    const comps = c.credit_components
    if (comps != null) {
      if (!isArray(comps) || comps.length < 2) {
        out.push(fail('CREDIT_COMPONENTS_SHAPE', `${c.course_id} credit_components must list at least two parts`,
          { id: c.course_id }))
      } else {
        const sum = comps.reduce((t, p) => t + (typeof p.credit === 'number' ? p.credit : NaN), 0)
        if (!Number.isFinite(sum) || Math.abs(sum - c.credit_recommendation) > 1e-9) {
          out.push(fail('CREDIT_COMPONENTS_SUM',
            `${c.course_id} credit components sum to ${sum}, course credit is ${c.credit_recommendation}`,
            { id: c.course_id, sum, credit: c.credit_recommendation }))
        }
      }
    }
  }

  // --- declared totals match what is actually in the file
  const ec = matrix.expected_counts ?? {}
  const actualNew = courses.filter((c) => c.origin === 'NEW_HIGH_SCHOOL_COURSE').length
  const actualAnchor = courses.filter((c) => c.origin === 'EXISTING_GRADE_8_ANCHOR').length
  if (ec.new_high_school_courses !== actualNew) {
    out.push(fail('COUNT_MISMATCH_NEW', 'expected_counts.new_high_school_courses disagrees with courses[]',
      { declared: ec.new_high_school_courses ?? null, actual: actualNew }))
  }
  if (ec.grade_8_anchor_courses !== actualAnchor) {
    out.push(fail('COUNT_MISMATCH_ANCHOR', 'expected_counts.grade_8_anchor_courses disagrees with courses[]',
      { declared: ec.grade_8_anchor_courses ?? null, actual: actualAnchor }))
  }
  if (ec.total_courses_in_matrix !== courses.length) {
    out.push(fail('COUNT_MISMATCH_TOTAL', 'expected_counts.total_courses_in_matrix disagrees with courses[]',
      { declared: ec.total_courses_in_matrix ?? null, actual: courses.length }))
  }

  out.push(...checkCountsAreNotPinned(matrix))
  return out
}

export function checkNoPrerequisiteCycle(courses) {
  const edges = new Map(courses.map((c) => [c.course_id, isArray(c.prerequisite_course_ids) ? c.prerequisite_course_ids : []]))
  const state = new Map()
  const out = []
  const walk = (id, trail) => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'open') {
      out.push(fail('PREREQ_CYCLE', `prerequisite cycle: ${[...trail, id].join(' -> ')}`, { trail: [...trail, id] }))
      return
    }
    state.set(id, 'open')
    for (const next of edges.get(id) ?? []) if (edges.has(next)) walk(next, [...trail, id])
    state.set(id, 'done')
  }
  for (const id of edges.keys()) walk(id, [])
  return out
}

/** The Grade 8 -> 9 seam must be explained for every family, and the absent
 *  World Language family must be acknowledged rather than quietly omitted. */
export function checkHandoff(text, matrix) {
  const out = []
  if (!isText(text)) return [fail('HANDOFF_MISSING', 'grade8-to-grade9-handoff.md is missing or empty', {})]
  for (const fam of SUBJECT_FAMILIES) {
    const anchor = `ma-g8-${fam}`
    const g9 = `ma-g9-${fam}`
    if (!text.includes(anchor) || !text.includes(g9)) {
      out.push(fail('HANDOFF_FAMILY_MISSING',
        `handoff does not name both ${anchor} and ${g9}`, { fam }))
    }
  }
  const rulings = (text.match(/\*\*Continuity ruling:/g) ?? []).length
  if (rulings < SUBJECT_FAMILIES.length) {
    out.push(fail('HANDOFF_RULINGS_INCOMPLETE',
      `handoff carries ${rulings} continuity rulings, expected at least ${SUBJECT_FAMILIES.length}`,
      { rulings, expected: SUBJECT_FAMILIES.length }))
  }
  if (!/world language/i.test(text)) {
    out.push(fail('HANDOFF_WORLD_LANGUAGE_SILENT',
      'handoff does not acknowledge the absent World Language family', {}))
  }
  const matrixFamilies = new Set((matrix?.courses ?? []).map((c) => c.subject))
  if (matrixFamilies.has('world-language')) {
    out.push(warn('WORLD_LANGUAGE_PRESENT',
      'a world-language family now exists in the matrix; re-run the coverage ruling', {}))
  }
  return out
}

/** The coverage audit must actually rule on every requirement it lists, using
 *  the contracted vocabulary, and must not silently declare the programme
 *  graduation-complete. */
export const COVERAGE_VERDICTS = Object.freeze([
  'COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'REQUIRES_DIRECTOR_DECISION',
])

export function checkCoverageMap(text) {
  const out = []
  if (!isText(text)) return [fail('COVERAGE_MAP_MISSING', 'credit-coverage-map.md is missing or empty', {})]
  for (const verdict of COVERAGE_VERDICTS) {
    if (!text.includes(verdict)) {
      out.push(fail('COVERAGE_VERDICT_UNUSED', `coverage map never uses the verdict ${verdict}`, { verdict }))
    }
  }
  if (!/world language/i.test(text)) {
    out.push(fail('COVERAGE_WORLD_LANGUAGE_MISSING', 'coverage map does not rule on World Language', {}))
  }
  if (/graduation[- ]complete/i.test(text) && !/not\s+(?:a\s+)?graduation[- ]complete|is not graduation[- ]complete/i.test(text)) {
    out.push(warn('COVERAGE_COMPLETENESS_CLAIM',
      'coverage map appears to claim graduation completeness; verify the wording', {}))
  }
  return out
}

/** The contract may not report graduation completeness while an uncovered
 *  requirement is still declared. This is the machine form of "do not silently
 *  call the programme graduation-complete". */
export function checkDeclaredGaps(matrix) {
  const out = []
  const gaps = matrix?.declared_coverage_gaps
  if (!isArray(gaps) || gaps.length === 0) {
    return [fail('GAPS_NOT_DECLARED',
      'course-matrix.json declares no coverage gaps; an empty audit is not a passing audit', {})]
  }
  for (const g of gaps) {
    if (!isText(g?.requirement)) out.push(fail('GAP_UNNAMED', 'a declared gap has no requirement name', {}))
    if (!COVERAGE_VERDICTS.includes(g?.verdict)) {
      out.push(fail('GAP_VERDICT_INVALID', `gap ${g?.requirement} carries an invalid verdict`,
        { requirement: g?.requirement ?? null, verdict: g?.verdict ?? null }))
    }
    if (!isText(g?.owner)) {
      out.push(fail('GAP_UNOWNED', `gap ${g?.requirement} names no owner`, { requirement: g?.requirement ?? null }))
    }
    if (!isText(g?.detail)) {
      out.push(fail('GAP_UNEXPLAINED', `gap ${g?.requirement} carries no detail`,
        { requirement: g?.requirement ?? null }))
    }
  }
  if (!gaps.some((g) => g?.requirement === 'MMC_WORLD_LANGUAGE')) {
    out.push(fail('GAP_WORLD_LANGUAGE_UNDECLARED',
      'the World Language requirement is not declared as a coverage gap', {}))
  }

  const completeness = matrix?.graduation_completeness
  if (!isText(completeness?.verdict)) {
    return [...out, fail('COMPLETENESS_UNSTATED', 'course-matrix.json states no graduation completeness verdict', {})]
  }
  const uncovered = gaps.filter((g) => g?.verdict === 'NOT_COVERED').map((g) => g.requirement)
  if (completeness.verdict === 'GRADUATION_COMPLETE' && uncovered.length > 0) {
    out.push(fail('COMPLETENESS_CLAIMED_OVER_GAP',
      `graduation completeness is claimed while ${uncovered.length} requirement(s) remain NOT_COVERED`,
      { uncovered }))
  }
  if (completeness.verdict === 'NOT_GRADUATION_COMPLETE' && !isText(completeness.basis)) {
    out.push(fail('COMPLETENESS_UNSUPPORTED', 'a not-complete verdict must state its basis', {}))
  }
  return out
}

// ---------------------------------------------------------------------------
// Assembly-mode checks (pure; operate on a loaded model)
// ---------------------------------------------------------------------------

/**
 * model: { courses: [{ course_id, grade, subject, units, lessons, assessments }],
 *          schedules: [{ grade, references: [lessonId, ...] }],
 *          standardsRegistries: { [subject]: Set<string> } }
 */
export function checkAssembly(model) {
  const out = []
  const seenLesson = new Map()
  const seenUnit = new Set()
  const seenAssessment = new Set()

  for (const course of model.courses ?? []) {
    const { course_id: cid, units = [], lessons = [], assessments = [] } = course
    const lessonById = new Map(lessons.map((l) => [l.lesson_id, l]))

    if (units.length === 0) out.push(fail('COURSE_NO_UNITS', `${cid} delivered no units`, { cid }))
    if (lessons.length === 0) out.push(fail('COURSE_NO_LESSONS', `${cid} delivered no lessons`, { cid }))
    if (assessments.length === 0) {
      out.push(fail('COURSE_NO_ASSESSMENT', `${cid} delivered no unit assessment`, { cid }))
    }

    // units: sequential from 1, well-formed, uniquely owned
    const numbers = units.map((u) => u.unit_number).sort((a, b) => a - b)
    numbers.forEach((n, i) => {
      if (n !== i + 1) {
        out.push(fail('UNIT_NUMBERING', `${cid} unit numbering is not sequential from 1`, { cid, found: numbers }))
      }
    })
    const claimedLessons = new Map()
    for (const u of units) {
      if (!UNIT_ID.test(String(u.unit_id ?? ''))) {
        out.push(fail('UNIT_ID_MALFORMED', `malformed unit id ${u.unit_id} in ${cid}`, { cid, id: u.unit_id }))
      }
      if (seenUnit.has(u.unit_id)) {
        out.push(fail('UNIT_ID_DUPLICATE', `duplicate unit id ${u.unit_id}`, { id: u.unit_id }))
      }
      seenUnit.add(u.unit_id)
      if (u.course_id !== cid) {
        out.push(fail('UNIT_COURSE_MISMATCH', `${u.unit_id} claims course ${u.course_id}, lives in ${cid}`,
          { cid, id: u.unit_id }))
      }
      if (!isArray(u.standards) || u.standards.length === 0) {
        out.push(fail('UNIT_STANDARDS_MISSING', `${u.unit_id} carries no standards`, { id: u.unit_id }))
      }
      for (const lid of (isArray(u.lesson_ids) ? u.lesson_ids : [])) {
        if (claimedLessons.has(lid)) {
          out.push(fail('LESSON_CLAIMED_TWICE', `${lid} is claimed by ${claimedLessons.get(lid)} and ${u.unit_id}`,
            { lid, first: claimedLessons.get(lid), second: u.unit_id }))
        }
        claimedLessons.set(lid, u.unit_id)
        if (!lessonById.has(lid)) {
          out.push(fail('LESSON_REF_UNRESOLVED', `${u.unit_id} references missing lesson ${lid}`,
            { id: u.unit_id, lid }))
        }
      }
    }
    for (const l of lessons) {
      if (!claimedLessons.has(l.lesson_id)) {
        out.push(fail('LESSON_ORPHANED', `${l.lesson_id} is not claimed by any unit`, { lid: l.lesson_id }))
      }
    }

    // assessments: one per unit, well formed
    for (const a of assessments) {
      if (!ASSESSMENT_ID.test(String(a.assessment_id ?? ''))) {
        out.push(fail('ASSESSMENT_ID_MALFORMED', `malformed assessment id ${a.assessment_id} in ${cid}`,
          { cid, id: a.assessment_id }))
      }
      if (seenAssessment.has(a.assessment_id)) {
        out.push(fail('ASSESSMENT_ID_DUPLICATE', `duplicate assessment id ${a.assessment_id}`, { id: a.assessment_id }))
      }
      seenAssessment.add(a.assessment_id)
    }

    // lessons: schema, traceability, policy gates
    const registry = model.standardsRegistries?.[course.subject] ?? null
    for (const l of lessons) {
      out.push(...checkLesson(l, cid, registry))
      if (seenLesson.has(l.lesson_id)) {
        out.push(fail('LESSON_ID_DUPLICATE',
          `duplicate lesson id ${l.lesson_id} (also in ${seenLesson.get(l.lesson_id)})`,
          { lid: l.lesson_id, other: seenLesson.get(l.lesson_id) }))
      }
      seenLesson.set(l.lesson_id, cid)
    }

    // multi-occasion mastery: a course must present each unit's target on more
    // than one occasion — the unit's lessons plus a separate unit assessment.
    for (const u of units) {
      const lids = isArray(u.lesson_ids) ? u.lesson_ids : []
      const hasAssessment = assessments.some((a) => a.assessment_id === u.assessment_id)
      if (lids.length < 2 || !hasAssessment) {
        out.push(fail('MASTERY_SINGLE_OCCASION',
          `${u.unit_id} cannot evidence mastery on two occasions (lessons=${lids.length}, assessment=${hasAssessment})`,
          { id: u.unit_id, lessons: lids.length, assessment: hasAssessment }))
      }
    }
  }

  // schedule: bidirectional, exactly once
  out.push(...checkSchedules(model, seenLesson))
  return out
}

export function checkLesson(l, cid, registry) {
  const out = []
  const lid = String(l?.lesson_id ?? '')
  if (!LESSON_ID.test(lid)) {
    return [fail('LESSON_ID_MALFORMED', `malformed lesson id ${lid || '(none)'} in ${cid}`, { cid, lid })]
  }
  if (!lid.startsWith(`${cid}-`)) {
    out.push(fail('LESSON_COURSE_MISMATCH', `${lid} does not belong to ${cid}`, { cid, lid }))
  }
  for (const [field, rule] of Object.entries(REQUIRED_LESSON_FIELDS)) {
    const v = l?.[field]
    if (rule.kind === 'array') {
      if (!isArray(v) || v.length < rule.min) {
        out.push(fail('LESSON_FIELD_INSUFFICIENT',
          `${lid}.${field} needs at least ${rule.min} entries`, { lid, field, min: rule.min }))
      }
    } else if (!isText(v)) {
      out.push(fail('LESSON_FIELD_MISSING', `${lid}.${field} is missing`, { lid, field }))
    }
  }
  for (const field of PROTECTED_LESSON_FIELDS) {
    if (l?.[field] === undefined) {
      out.push(warn('LESSON_PROTECTED_FIELD_ABSENT',
        `${lid} has no ${field}; the Study projection expects it to exist in source`, { lid, field }))
    }
  }
  // standards traceability
  for (const code of (isArray(l?.standards) ? l.standards : [])) {
    if (!isText(code)) {
      out.push(fail('STANDARD_BLANK', `${lid} carries a blank standards entry`, { lid }))
      continue
    }
    if (registry && !registry.has(code) && !/UNVERIFIED/i.test(code)) {
      out.push(fail('STANDARD_UNTRACEABLE',
        `${lid} cites ${code}, which is not in the family standards registry and is not marked UNVERIFIED`,
        { lid, code }))
    }
  }
  // no-media alternative
  const media = l?.media
  if (media && typeof media === 'object' && media.required === true) {
    if (!isText(media.fallback) && !isText(media.description)) {
      out.push(fail('MEDIA_NO_ALTERNATIVE',
        `${lid} requires media but offers no text or description alternative`, { lid }))
    }
  }
  // privacy and body-assessment denylists
  const blob = JSON.stringify(l).toLowerCase()
  for (const phrase of PRIVACY_PROHIBITED) {
    if (blob.includes(`require ${phrase}`) || blob.includes(`submit ${phrase}`) || blob.includes(`enter your ${phrase}`)) {
      out.push(fail('PRIVACY_PROHIBITED_REQUEST', `${lid} appears to request "${phrase}"`, { lid, phrase }))
    }
  }
  if (l?.subject === 'health' || l?.subject === 'physical-education') {
    for (const phrase of BODY_ASSESSMENT_PROHIBITED) {
      if (blob.includes(phrase)) {
        out.push(fail('BODY_ASSESSMENT_PROHIBITED',
          `${lid} references "${phrase}", prohibited by the published policy`, { lid, phrase }))
      }
    }
  }
  return out
}

/** Every schedule reference resolves to exactly one lesson, and every lesson is
 *  scheduled exactly once. Both directions, or a schedule can silently drop a
 *  course. */
export function checkSchedules(model, lessonOwner) {
  const out = []
  const scheduled = new Map()
  for (const s of model.schedules ?? []) {
    for (const ref of s.references ?? []) {
      if (!lessonOwner.has(ref)) {
        out.push(fail('SCHEDULE_REF_UNRESOLVED',
          `grade ${s.grade} schedule references ${ref}, which is not a delivered lesson`, { grade: s.grade, ref }))
        continue
      }
      scheduled.set(ref, (scheduled.get(ref) ?? 0) + 1)
    }
  }
  for (const [ref, n] of scheduled) {
    if (n > 1) {
      out.push(fail('SCHEDULE_REF_DUPLICATED', `${ref} is scheduled ${n} times, expected exactly once`, { ref, n }))
    }
  }
  if ((model.schedules ?? []).length > 0) {
    for (const [lid] of lessonOwner) {
      if (!scheduled.has(lid)) {
        out.push(fail('LESSON_UNSCHEDULED', `${lid} never appears in a schedule`, { lid }))
      }
    }
  } else {
    out.push(fail('SCHEDULE_MISSING', 'no daily schedule was delivered for any grade', {}))
  }
  return out
}

// ---------------------------------------------------------------------------
// Filesystem driver
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url))
export const RELEASE_DIR = HERE
export const WAVE_ROOT = resolve(HERE, '..')

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))
const readText = async (p) => readFile(p, 'utf8').catch(() => '')
const exists = async (p) => stat(p).then(() => true).catch(() => false)

async function loadSubjectContent(waveRoot, matrix) {
  const courses = []
  const schedules = []
  const standardsRegistries = {}

  for (const fam of SUBJECT_FAMILIES) {
    const famRoot = join(waveRoot, fam)
    if (!(await exists(famRoot))) continue
    const coverage = await readText(join(famRoot, 'standards-coverage.md'))
    if (coverage) {
      // A code is any backticked token in the family's coverage document.
      standardsRegistries[fam] = new Set([...coverage.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()))
    }
    for (const grade of HIGH_SCHOOL_GRADES) {
      const dir = join(famRoot, `grade-${grade}`)
      if (!(await exists(dir))) continue
      const cid = `ma-g${grade}-${fam}`
      const units = (await exists(join(dir, 'units.json'))) ? await readJson(join(dir, 'units.json')) : []
      const assessments = (await exists(join(dir, 'assessments.json')))
        ? await readJson(join(dir, 'assessments.json')) : []
      let lessons = []
      if (await exists(join(dir, 'lessons.jsonl'))) {
        lessons = (await readFile(join(dir, 'lessons.jsonl'), 'utf8'))
          .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
      }
      courses.push({
        course_id: cid, grade, subject: fam,
        units: isArray(units) ? units : (units.units ?? []),
        lessons,
        assessments: isArray(assessments) ? assessments : (assessments.assessments ?? []),
      })
    }
  }

  for (const grade of HIGH_SCHOOL_GRADES) {
    const p = join(waveRoot, 'schedules', `grade-${grade}`, 'daily-schedule.csv')
    if (!(await exists(p))) continue
    const rows = (await readFile(p, 'utf8')).split('\n').slice(1).filter((r) => r.trim())
    const references = rows.flatMap((r) => r.split(',').slice(2).map((c) => c.trim()).filter(Boolean))
    schedules.push({ grade, references })
  }
  return { courses, schedules, standardsRegistries }
}

export async function runValidation({ mode = 'contract', waveRoot = WAVE_ROOT, releaseDir = RELEASE_DIR } = {}) {
  const findings = []
  const matrixPath = join(releaseDir, 'course-matrix.json')
  let matrix = null
  try {
    matrix = await readJson(matrixPath)
  } catch (error) {
    findings.push(fail('MATRIX_UNREADABLE', `course-matrix.json could not be read: ${error.message}`, {}))
  }

  findings.push(...checkIdGrammar())
  if (matrix) {
    findings.push(...checkMatrix(matrix))
    findings.push(...checkHandoff(await readText(join(releaseDir, 'grade8-to-grade9-handoff.md')), matrix))
    findings.push(...checkCoverageMap(await readText(join(releaseDir, 'credit-coverage-map.md'))))
    findings.push(...checkDeclaredGaps(matrix))
  }

  let derived = null
  if (mode === 'assembly') {
    const model = await loadSubjectContent(waveRoot, matrix)
    findings.push(...checkAssembly(model))
    derived = {
      courses_delivered: model.courses.length,
      units_delivered: model.courses.reduce((t, c) => t + c.units.length, 0),
      lessons_delivered: model.courses.reduce((t, c) => t + c.lessons.length, 0),
      assessments_delivered: model.courses.reduce((t, c) => t + c.assessments.length, 0),
      schedules_delivered: model.schedules.length,
    }
    const expected = (matrix?.courses ?? []).filter((c) => c.grade !== 8).length
    if (model.courses.length !== expected) {
      findings.push(fail('ASSEMBLY_INCOMPLETE',
        `assembly mode found ${model.courses.length} delivered courses, matrix expects ${expected}`,
        { found: model.courses.length, expected }))
    }
  }

  const blocking = findings.filter((f) => f.severity === 'BLOCKING')
  return {
    schemaVersion: HIGH_SCHOOL_VALIDATOR_SCHEMA_VERSION,
    mode,
    overall: blocking.length === 0 ? READY : BLOCKED,
    blockingCount: blocking.length,
    advisoryCount: findings.length - blocking.length,
    derivedCounts: derived,
    countsAsserted: false,
    findings,
  }
}

function renderOperator(result) {
  const lines = []
  lines.push(`Manuel Academy high-school release validation — mode: ${result.mode}`)
  lines.push(`overall: ${result.overall}`)
  lines.push(`blocking: ${result.blockingCount}   advisory: ${result.advisoryCount}`)
  if (result.derivedCounts) {
    lines.push('derived counts (observed, never asserted):')
    for (const [k, v] of Object.entries(result.derivedCounts)) lines.push(`  ${k}: ${v}`)
  }
  if (result.findings.length === 0) {
    lines.push('no findings')
  } else {
    lines.push('findings:')
    for (const f of result.findings) lines.push(`  [${f.severity}] ${f.code} — ${f.message}`)
  }
  return lines.join('\n')
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const arg = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback
  }
  const result = await runValidation({ mode: arg('mode', 'contract') })
  process.stdout.write(
    arg('format', 'operator') === 'json'
      ? `${JSON.stringify(result, null, 2)}\n`
      : `${renderOperator(result)}\n`,
  )
  process.exit(result.overall === READY ? 0 : 1)
}

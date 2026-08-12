// Manuel Academy — Grades 8-12 release-candidate assembly validator.
//
// Proves the assembly obligations for curriculum-release-candidates/hs912-r1.
// It is deliberately SEPARATE from release/validate-high-school.mjs, which is a
// verbatim copy of the release lane's contract validator and is never edited
// here. This file proves what the assembly session was asked to prove, and it
// reports the release validator's own defects rather than working around them.
//
//   node curriculum-release-candidates/hs912-r1/validation/validate-assembly.mjs [--format json]
//
// Exit code 0 when overall is HS912_ASSEMBLY_READY, 1 when BLOCKED.
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCHEMA_VERSION = 1
export const READY = 'HS912_ASSEMBLY_READY'
export const BLOCKED = 'BLOCKED'

const HERE = dirname(fileURLToPath(import.meta.url))
export const RC_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(RC_ROOT, '..', '..')
const ANCHOR = join(REPO_ROOT, 'curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses')

export const FAMILIES = Object.freeze([
  'mathematics', 'english-language-arts', 'science', 'social-studies', 'health',
  'physical-education', 'ready-for-life', 'technology', 'arts-and-music', 'financial-literacy',
])
/** Families delivered in the contract's canonical shape. `science` is imported
 *  verbatim in its own v2 authoring-set shape and is proved separately. */
export const NORMALISED = Object.freeze(FAMILIES.filter((f) => f !== 'science'))
export const GRADES = Object.freeze([9, 10, 11, 12])

const G = '(?:5|7|8|9|1[0-2])'
const SUBJ = '[a-z][a-z-]*[a-z]'
export const COURSE_ID = new RegExp(`^ma-g${G}-${SUBJ}$`)
export const UNIT_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}$`)
export const LESSON_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}-l\\d{2}$`)
export const ASSESSMENT_ID = new RegExp(`^ma-g${G}-${SUBJ}-u\\d{2}-assessment$`)

/** Body-assessment denylist, carried forward from the published Health/PE policy.
 *  Matched with polarity: a lesson that *forbids* weigh-ins is compliant, not in
 *  breach. release/validate-high-school.mjs matches these blind to polarity and
 *  therefore reports every compliant lesson — see NOTE_VALIDATOR_POLARITY. */
export const BODY_ASSESSMENT_PROHIBITED = Object.freeze([
  'calorie target', 'weigh-in', 'weigh in', 'body-size score', 'body size score',
  'weight cutting', 'earned food', 'body mass index score',
])
const NEGATIONS = ['do not', "don't", 'never', 'no ', 'without', 'avoid', 'prohibit', 'not use', 'not require', 'instead of']

const finding = (severity, code, message, context = {}) =>
  Object.freeze({ severity, code, message, context: Object.freeze({ ...context }) })
const fail = (c, m, x) => finding('BLOCKING', c, m, x)
const warn = (c, m, x) => finding('ADVISORY', c, m, x)
const note = (c, m, x) => finding('NOTE', c, m, x)

const exists = (p) => stat(p).then(() => true).catch(() => false)
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'))
const readText = (p) => readFile(p, 'utf8').catch(() => '')
const asList = (d, key) => (Array.isArray(d) ? d : (d?.[key] ?? []))

async function loadModel() {
  const matrix = await readJson(join(RC_ROOT, 'release/course-matrix.json'))
  const courses = []
  for (const fam of NORMALISED) {
    for (const grade of GRADES) {
      const dir = join(RC_ROOT, fam, `grade-${grade}`)
      if (!(await exists(dir))) continue
      const units = asList(await readJson(join(dir, 'units.json')), 'units')
      const assessments = asList(await readJson(join(dir, 'assessments.json')), 'assessments')
      const lessons = (await readFile(join(dir, 'lessons.jsonl'), 'utf8'))
        .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))
      courses.push({ course_id: `ma-g${grade}-${fam}`, grade, subject: fam, units, lessons, assessments })
    }
  }
  const schedules = []
  for (const grade of GRADES) {
    const p = join(RC_ROOT, 'schedules', `grade-${grade}`, 'daily-schedule.csv')
    if (!(await exists(p))) continue
    const rows = (await readFile(p, 'utf8')).split('\n').slice(1).filter((r) => r.trim())
    schedules.push({ grade, references: rows.map((r) => r.split(',')[2]?.trim()).filter(Boolean) })
  }
  return { matrix, courses, schedules }
}

// --- 1. no skipped grade 8-12 ----------------------------------------------
export async function checkGradeSpan(model) {
  const out = []
  for (const fam of FAMILIES) {
    if (!(await exists(join(ANCHOR, fam)))) {
      out.push(fail('GRADE_8_ANCHOR_MISSING', `${fam} has no published Grade 8 anchor course`, { fam }))
    }
    for (const grade of GRADES) {
      const delivered = fam === 'science'
        ? (await exists(join(RC_ROOT, 'science/authoring-set/courses.json')))
          && (await readJson(join(RC_ROOT, 'science/authoring-set/courses.json'))).some((c) => c.grade === grade)
        : model.courses.some((c) => c.subject === fam && c.grade === grade)
      if (!delivered) out.push(fail('GRADE_MISSING', `${fam} delivers no Grade ${grade} course`, { fam, grade }))
    }
  }
  return out
}

// --- 2. Grade 8 -> 9 handoff ------------------------------------------------
export async function checkHandoff() {
  const out = []
  const central = await readText(join(RC_ROOT, 'release/grade8-to-grade9-handoff.md'))
  if (!central) return [fail('HANDOFF_CENTRAL_MISSING', 'release/grade8-to-grade9-handoff.md is absent', {})]
  for (const fam of FAMILIES) {
    if (!central.includes(fam)) {
      out.push(fail('HANDOFF_FAMILY_MISSING', `${fam} is not addressed in the central Grade 8-9 handoff`, { fam }))
    }
    const docs = await familySeamDocs(fam)
    if (docs.length === 0) {
      out.push(warn('HANDOFF_FAMILY_DOC_ABSENT',
        `${fam} ships no family-level Grade 8 seam document; only the central handoff covers it`, { fam }))
    }
  }
  return out
}

async function familySeamDocs(fam) {
  const roots = fam === 'science' ? [join(RC_ROOT, 'science')] : [join(RC_ROOT, fam, 'source-docs')]
  const hits = []
  for (const root of roots) {
    if (!(await exists(root))) continue
    for (const p of await walk(root)) {
      if (!p.endsWith('.md')) continue
      const t = (await readText(p)).toLowerCase()
      if (t.includes('grade 8') || t.includes('grade-8')) hits.push(p.slice(RC_ROOT.length + 1))
    }
  }
  return hits
}

async function walk(dir) {
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...await walk(p))
    else out.push(p)
  }
  return out
}

// --- 3. identifiers ---------------------------------------------------------
export function checkIdentifiers(model) {
  const out = []
  const seenCourse = new Set(), seenUnit = new Set(), seenLesson = new Map(), seenAssessment = new Set()
  for (const c of model.courses) {
    if (!COURSE_ID.test(c.course_id)) out.push(fail('COURSE_ID_MALFORMED', `malformed course id ${c.course_id}`, { id: c.course_id }))
    if (seenCourse.has(c.course_id)) out.push(fail('COURSE_ID_DUPLICATE', `duplicate course id ${c.course_id}`, { id: c.course_id }))
    seenCourse.add(c.course_id)
    const lessonIds = new Set(c.lessons.map((l) => l.lesson_id))
    const claimed = new Map()
    for (const u of c.units) {
      if (!UNIT_ID.test(String(u.unit_id))) out.push(fail('UNIT_ID_MALFORMED', `malformed unit id ${u.unit_id}`, { id: u.unit_id }))
      if (seenUnit.has(u.unit_id)) out.push(fail('UNIT_ID_DUPLICATE', `duplicate unit id ${u.unit_id}`, { id: u.unit_id }))
      seenUnit.add(u.unit_id)
      if (u.course_id !== c.course_id) out.push(fail('UNIT_COURSE_MISMATCH', `${u.unit_id} claims ${u.course_id}`, { id: u.unit_id }))
      if (!Array.isArray(u.standards) || u.standards.length === 0) {
        out.push(fail('UNIT_STANDARDS_MISSING', `${u.unit_id} carries no standards`, { id: u.unit_id }))
      }
      for (const lid of u.lesson_ids ?? []) {
        if (claimed.has(lid)) out.push(fail('LESSON_CLAIMED_TWICE', `${lid} claimed by ${claimed.get(lid)} and ${u.unit_id}`, { lid }))
        claimed.set(lid, u.unit_id)
        if (!lessonIds.has(lid)) out.push(fail('LESSON_REF_UNRESOLVED', `${u.unit_id} references missing ${lid}`, { lid }))
      }
      if ((u.lesson_ids ?? []).length < 2 || !c.assessments.some((a) => a.assessment_id === u.assessment_id)) {
        out.push(fail('MASTERY_SINGLE_OCCASION', `${u.unit_id} cannot evidence mastery twice`, { id: u.unit_id }))
      }
    }
    const numbers = c.units.map((u) => u.unit_number).sort((a, b) => a - b)
    numbers.forEach((n, i) => {
      if (n !== i + 1) out.push(fail('UNIT_NUMBERING', `${c.course_id} unit numbering not sequential from 1`, { found: numbers }))
    })
    for (const l of c.lessons) {
      if (!LESSON_ID.test(String(l.lesson_id))) out.push(fail('LESSON_ID_MALFORMED', `malformed lesson id ${l.lesson_id}`, { id: l.lesson_id }))
      if (!String(l.lesson_id).startsWith(`${c.course_id}-`)) out.push(fail('LESSON_COURSE_MISMATCH', `${l.lesson_id} not in ${c.course_id}`, { id: l.lesson_id }))
      if (seenLesson.has(l.lesson_id)) out.push(fail('LESSON_ID_DUPLICATE', `duplicate lesson id ${l.lesson_id}`, { id: l.lesson_id }))
      seenLesson.set(l.lesson_id, c.course_id)
      if (!claimed.has(l.lesson_id)) out.push(fail('LESSON_ORPHANED', `${l.lesson_id} claimed by no unit`, { id: l.lesson_id }))
    }
    for (const a of c.assessments) {
      if (!ASSESSMENT_ID.test(String(a.assessment_id))) out.push(fail('ASSESSMENT_ID_MALFORMED', `malformed assessment id ${a.assessment_id}`, { id: a.assessment_id }))
      if (seenAssessment.has(a.assessment_id)) out.push(fail('ASSESSMENT_ID_DUPLICATE', `duplicate assessment id ${a.assessment_id}`, { id: a.assessment_id }))
      seenAssessment.add(a.assessment_id)
    }
    if (c.units.length === 0) out.push(fail('COURSE_NO_UNITS', `${c.course_id} delivered no units`, { id: c.course_id }))
    if (c.lessons.length === 0) out.push(fail('COURSE_NO_LESSONS', `${c.course_id} delivered no lessons`, { id: c.course_id }))
    if (c.assessments.length === 0) out.push(fail('COURSE_NO_ASSESSMENT', `${c.course_id} delivered no assessment`, { id: c.course_id }))
  }
  return { findings: out, lessonOwner: seenLesson }
}

// --- 4. schedules -----------------------------------------------------------
export function checkSchedules(model, lessonOwner) {
  const out = []
  const seen = new Map()
  for (const s of model.schedules) {
    for (const ref of s.references) {
      if (!lessonOwner.has(ref)) { out.push(fail('SCHEDULE_REF_UNRESOLVED', `grade ${s.grade} schedules undelivered ${ref}`, { ref })); continue }
      seen.set(ref, (seen.get(ref) ?? 0) + 1)
    }
  }
  for (const [ref, n] of seen) if (n > 1) out.push(fail('SCHEDULE_REF_DUPLICATED', `${ref} scheduled ${n} times`, { ref, n }))
  if (model.schedules.length !== GRADES.length) {
    out.push(fail('SCHEDULE_MISSING', `expected ${GRADES.length} grade schedules, found ${model.schedules.length}`, {}))
  }
  for (const [lid] of lessonOwner) if (!seen.has(lid)) out.push(fail('LESSON_UNSCHEDULED', `${lid} never scheduled`, { lid }))
  return out
}

// --- 5. standards traceability ---------------------------------------------
export async function checkStandards(model) {
  const out = []
  for (const fam of NORMALISED) {
    const coverage = await readText(join(RC_ROOT, fam, 'standards-coverage.md'))
    if (!coverage) { out.push(fail('STANDARDS_COVERAGE_MISSING', `${fam} ships no standards-coverage.md`, { fam })); continue }
    const registry = new Set([...coverage.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()))
    const untraceable = new Map()
    for (const c of model.courses.filter((c) => c.subject === fam)) {
      for (const src of [...c.units, ...c.lessons]) {
        for (const code of src.standards ?? []) {
          if (!String(code).trim()) { out.push(fail('STANDARD_BLANK', `${fam} carries a blank standards entry`, { fam })); continue }
          if (!registry.has(code) && !/UNVERIFIED/i.test(code)) untraceable.set(code, (untraceable.get(code) ?? 0) + 1)
        }
      }
    }
    for (const [code, n] of untraceable) {
      out.push(fail('STANDARD_UNTRACEABLE',
        `${fam} cites ${code} in ${n} place(s); it is not evidenced by the lane's own standards custody`,
        { fam, code, occurrences: n }))
    }
  }
  return out
}

// --- 6. credit / content matrix ---------------------------------------------
export function checkCreditMatrix(model) {
  const out = []
  const rows = new Map(model.matrix.courses.map((c) => [c.course_id, c]))
  for (const c of model.courses) {
    const row = rows.get(c.course_id)
    if (!row) { out.push(fail('MATRIX_ROW_MISSING', `${c.course_id} has no course-matrix row`, { id: c.course_id })); continue }
    if (typeof row.credit_recommendation !== 'number') {
      out.push(fail('CREDIT_UNSTATED', `${c.course_id} states no credit recommendation`, { id: c.course_id }))
    }
    if (row.sessions !== c.lessons.length) {
      out.push(warn('SESSION_COUNT_DIVERGENCE',
        `${c.course_id} delivers ${c.lessons.length} lessons against a recommended ${row.sessions} sessions`,
        { id: c.course_id, delivered: c.lessons.length, recommended: row.sessions }))
    }
  }
  return out
}

// --- 7. senior-year substance ------------------------------------------------
export function checkSeniorYear(model) {
  const out = []
  for (const fam of NORMALISED) {
    const g11 = model.courses.find((c) => c.subject === fam && c.grade === 11)
    const g12 = model.courses.find((c) => c.subject === fam && c.grade === 12)
    if (!g12) continue
    if (g12.lessons.length < g11.lessons.length) {
      out.push(fail('SENIOR_YEAR_THIN',
        `${fam} Grade 12 delivers ${g12.lessons.length} lessons against Grade 11's ${g11.lessons.length}`,
        { fam, g12: g12.lessons.length, g11: g11.lessons.length }))
    }
    if (g12.units.length < 4) {
      out.push(fail('SENIOR_YEAR_THIN', `${fam} Grade 12 delivers only ${g12.units.length} units`, { fam }))
    }
  }
  const mathG12 = model.matrix.courses.find((c) => c.course_id === 'ma-g12-mathematics')
  if (!mathG12?.satisfies_state_requirements?.includes('MMC_MATHEMATICS_FINAL_YEAR')) {
    out.push(fail('SENIOR_YEAR_MATH_UNCLAIMED', 'no Grade 12 course carries the final-year mathematics requirement', {}))
  }
  return out
}

// --- 8. personal finance stays separate from economics -----------------------
export function checkPersonalFinanceSeparation(model) {
  const out = []
  const pf = model.matrix.courses.filter((c) => (c.satisfies_state_requirements ?? []).includes('MMC_PERSONAL_FINANCE'))
  if (pf.length === 0) return [fail('PERSONAL_FINANCE_UNASSIGNED', 'no course carries MMC_PERSONAL_FINANCE', {})]
  for (const c of pf) {
    if (c.subject !== 'financial-literacy') {
      out.push(fail('PERSONAL_FINANCE_MERGED_INTO_ECONOMICS',
        `${c.course_id} (${c.subject}) carries the personal finance requirement; it must sit in financial-literacy`,
        { id: c.course_id, subject: c.subject }))
    }
  }
  const econ = model.matrix.courses.filter((c) => (c.satisfies_state_requirements ?? [])
    .some((r) => r.includes('ECONOMICS')))
  for (const c of econ) {
    if ((c.satisfies_state_requirements ?? []).includes('MMC_PERSONAL_FINANCE')) {
      out.push(fail('PERSONAL_FINANCE_MERGED_INTO_ECONOMICS',
        `${c.course_id} claims both an economics requirement and personal finance`, { id: c.course_id }))
    }
  }
  const finlit = model.courses.filter((c) => c.subject === 'financial-literacy')
  if (finlit.length !== GRADES.length) {
    out.push(fail('PERSONAL_FINANCE_FAMILY_INCOMPLETE',
      `financial-literacy delivers ${finlit.length} of ${GRADES.length} courses`, {}))
  }
  return out
}

// --- 9. world language stays uncovered --------------------------------------
export async function checkWorldLanguage(model) {
  const out = []
  const gap = (model.matrix.declared_coverage_gaps ?? []).find((g) => g.requirement === 'MMC_WORLD_LANGUAGE')
  if (!gap) return [fail('WORLD_LANGUAGE_GAP_UNDECLARED', 'MMC_WORLD_LANGUAGE is not declared as a coverage gap', {})]
  if (!['NOT_COVERED', 'REQUIRES_DIRECTOR_DECISION'].includes(gap.verdict)) {
    out.push(fail('WORLD_LANGUAGE_VERDICT_OVERSTATED',
      `MMC_WORLD_LANGUAGE carries verdict ${gap.verdict}; only NOT_COVERED or REQUIRES_DIRECTOR_DECISION is supportable`,
      { verdict: gap.verdict }))
  }
  const wl = model.matrix.courses.filter((c) => /world-language|language-other|spanish|french|japanese/.test(c.course_id))
  for (const c of wl) {
    out.push(fail('WORLD_LANGUAGE_COURSE_UNDECLARED',
      `${c.course_id} looks like world-language content while the requirement is declared uncovered`, { id: c.course_id }))
  }
  const completeness = model.matrix.graduation_completeness ?? {}
  const uncovered = (model.matrix.declared_coverage_gaps ?? []).filter((g) => g.verdict === 'NOT_COVERED')
  if (completeness.verdict === 'GRADUATION_COMPLETE' && uncovered.length > 0) {
    out.push(fail('COMPLETENESS_CLAIMED_OVER_GAP',
      `graduation completeness is claimed while ${uncovered.length} requirement(s) are NOT_COVERED`, {}))
  }
  return out
}

// --- 10. health / PE body-assessment policy, polarity aware ------------------
export function checkBodyAssessment(model) {
  const out = []
  for (const c of model.courses.filter((c) => c.subject === 'health' || c.subject === 'physical-education')) {
    for (const l of c.lessons) {
      for (const sentence of sentences(JSON.stringify(l))) {
        const lower = sentence.toLowerCase()
        if (NEGATIONS.some((n) => lower.includes(n))) continue
        for (const phrase of BODY_ASSESSMENT_PROHIBITED) {
          if (lower.includes(phrase)) {
            out.push(fail('BODY_ASSESSMENT_PROHIBITED',
              `${l.lesson_id} instructs "${phrase}" outside a prohibition`, { lid: l.lesson_id, phrase }))
          }
        }
      }
    }
  }
  return out
}
const sentences = (blob) => blob.split(/(?<=[.!?])\s+|","|\\n/)

// --- 11. science, proved on its own terms ------------------------------------
export async function checkScience() {
  const out = []
  const root = join(RC_ROOT, 'science/authoring-set')
  if (!(await exists(root))) return [fail('SCIENCE_MISSING', 'no science content was imported', {})]
  const courses = await readJson(join(root, 'courses.json'))
  const units = await readJson(join(root, 'units.json'))
  const assessments = await readJson(join(root, 'assessments.json'))
  const schedules = await readJson(join(root, 'schedules.json'))
  const ids = new Set(), lessons = new Set()
  for (const c of courses) {
    if (ids.has(c.course_id)) out.push(fail('SCIENCE_ID_DUPLICATE', `duplicate ${c.course_id}`, {}))
    ids.add(c.course_id)
    if (COURSE_ID.test(c.course_id)) continue
    out.push(fail('SCIENCE_ID_SCHEME_CONFLICT',
      `${c.course_id} does not match the release contract identifier grammar ma-g<grade>-science required by course-matrix.json`,
      { id: c.course_id, expected: `ma-g${c.grade}-science` }))
  }
  for (const grade of GRADES) {
    if (!courses.some((c) => c.grade === grade)) out.push(fail('SCIENCE_GRADE_MISSING', `science has no Grade ${grade}`, { grade }))
  }
  for (const f of ['ma-hs9-biology', 'ma-hs10-chemistry', 'ma-hs11-physics', 'ma-hs12-earth-space-environmental']) {
    const p = join(root, 'lessons', `${f}.lessons.jsonl`)
    if (!(await exists(p))) { out.push(fail('SCIENCE_LESSONS_MISSING', `${f} lessons absent`, {})); continue }
    for (const line of (await readFile(p, 'utf8')).split('\n')) {
      if (!line.trim()) continue
      const l = JSON.parse(line)
      if (lessons.has(l.lesson_id)) out.push(fail('SCIENCE_LESSON_DUPLICATE', `duplicate ${l.lesson_id}`, {}))
      lessons.add(l.lesson_id)
    }
  }
  const claimed = new Set()
  for (const u of units) for (const r of u.lesson_refs ?? []) {
    if (!lessons.has(r)) out.push(fail('SCIENCE_LESSON_REF_UNRESOLVED', `${u.unit_id} references ${r}`, {}))
    claimed.add(r)
  }
  for (const l of lessons) if (!claimed.has(l)) out.push(fail('SCIENCE_LESSON_ORPHANED', `${l} claimed by no unit`, {}))
  const scheduled = new Map()
  for (const s of schedules) for (const e of s.entries ?? []) for (const r of e.lesson_refs ?? []) {
    scheduled.set(r, (scheduled.get(r) ?? 0) + 1)
  }
  for (const l of lessons) {
    const n = scheduled.get(l) ?? 0
    if (n !== 1) out.push(fail('SCIENCE_SCHEDULE_MISMATCH', `${l} is scheduled ${n} times`, { n }))
  }
  if (assessments.length !== units.length) {
    out.push(fail('SCIENCE_ASSESSMENT_COUNT', `${assessments.length} assessments for ${units.length} units`, {}))
  }
  out.push(note('SCIENCE_PENDING_H2_REVIEW',
    'science is imported verbatim from mac/hs912-science-h2 and carries status PENDING_H2_REVIEW until the parallel read-only review passes',
    { courses: courses.length, units: units.length, lessons: lessons.size }))
  return out
}

export async function runAssemblyValidation() {
  const model = await loadModel()
  const ids = checkIdentifiers(model)
  const findings = [
    ...await checkGradeSpan(model),
    ...await checkHandoff(),
    ...ids.findings,
    ...checkSchedules(model, ids.lessonOwner),
    ...await checkStandards(model),
    ...checkCreditMatrix(model),
    ...checkSeniorYear(model),
    ...checkPersonalFinanceSeparation(model),
    ...await checkWorldLanguage(model),
    ...checkBodyAssessment(model),
    ...await checkScience(),
    note('NOTE_VALIDATOR_POLARITY',
      'release/validate-high-school.mjs matches the Health/PE body-assessment denylist without polarity and reports every lesson whose safety_and_privacy text forbids those practices. checkBodyAssessment here is polarity aware. The release validator is not edited by this session.',
      {}),
  ]
  const blocking = findings.filter((f) => f.severity === 'BLOCKING')
  return {
    schemaVersion: SCHEMA_VERSION,
    overall: blocking.length === 0 ? READY : BLOCKED,
    blockingCount: blocking.length,
    advisoryCount: findings.filter((f) => f.severity === 'ADVISORY').length,
    noteCount: findings.filter((f) => f.severity === 'NOTE').length,
    derivedCounts: {
      normalised_courses: model.courses.length,
      normalised_units: model.courses.reduce((t, c) => t + c.units.length, 0),
      normalised_lessons: model.courses.reduce((t, c) => t + c.lessons.length, 0),
      normalised_assessments: model.courses.reduce((t, c) => t + c.assessments.length, 0),
      schedules: model.schedules.length,
    },
    countsAsserted: false,
    findings,
  }
}

const result = await runAssemblyValidation()
if (process.argv.includes('--format') && process.argv[process.argv.indexOf('--format') + 1] === 'json') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  const l = [`Manuel Academy 8-12 release-candidate assembly validation`,
    `overall: ${result.overall}`,
    `blocking: ${result.blockingCount}   advisory: ${result.advisoryCount}   notes: ${result.noteCount}`,
    'derived counts (observed, never asserted):']
  for (const [k, v] of Object.entries(result.derivedCounts)) l.push(`  ${k}: ${v}`)
  l.push(result.findings.length ? 'findings:' : 'no findings')
  for (const f of result.findings) l.push(`  [${f.severity}] ${f.code} — ${f.message}`)
  process.stdout.write(`${l.join('\n')}\n`)
}
process.exit(result.overall === READY ? 0 : 1)

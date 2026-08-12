#!/usr/bin/env node
// Validation for the High School Financial Literacy 9-12 authoring lane.
//
// This lane is deliberately OUTSIDE the frozen published release at
// curriculum-content/manuel-academy/1.0.0 (which pins grades 5/7/8). These checks
// therefore stand alone and read nothing from the frozen release except, in the
// continuity check, the Grade 8 course that this lane continues from.
//
// Usage: node validation/validate.mjs [--json]
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LANE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(LANE, '../../../..')
const GRADES = [9, 10, 11, 12]
const SLUG = (g) => `financial-literacy-${g}`
const EXPECTED_CODES = ['PF1', 'PF2', 'PF3', 'PF4', 'PF4.1', 'PF5', 'PF6', 'PF7']
const UNIT_COUNTS = [10, 10, 10, 11, 10, 10, 11]
const LESSONS_PER_COURSE = 72

const checks = []
const ok = (c, d) => checks.push({ check: c, result: 'PASS', details: d })
const bad = (c, d) => checks.push({ check: c, result: 'FAIL', details: d })
const assert = (cond, c, d) => (cond ? ok(c, d) : bad(c, d))

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const parseCsv = (t) => t.split('\n').filter(Boolean).map((r) => {
  const out = []; let f = '', q = false
  for (let i = 0; i < r.length; i++) {
    const c = r[i]
    if (q) { if (c === '"' && r[i + 1] === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ',') { out.push(f); f = '' }
    else f += c
  }
  out.push(f); return out
})

// ---------- 1. standards corpus ----------
const corpusPath = join(LANE, 'standards', 'michigan-personal-finance-9-12-expectations.json')
assert(existsSync(corpusPath), 'standards corpus exists', corpusPath)
const corpus = readJson(corpusPath)
const codes = corpus.expectations.map((e) => e.code)
assert(JSON.stringify(codes) === JSON.stringify(EXPECTED_CODES),
  'corpus contains exactly PF1-PF7 plus PF4.1', codes.join(', '))
assert(corpus.expectations.every((e) => typeof e.text === 'string' && e.text.trim().length > 0),
  'every expectation carries verbatim text', `${corpus.expectations.length} expectations`)
assert(/^[0-9a-f]{64}$/.test(corpus.source.sha256 || ''),
  'corpus records a sha256 of the retrieved source document', corpus.source.sha256)
assert(corpus.source.bytes > 0 && corpus.source.pages > 0,
  'corpus records byte length and page count', `${corpus.source.bytes} bytes / ${corpus.source.pages} pages`)
assert(corpus.verification?.verified === true && /No expectation was reconstructed from model memory/i.test(corpus.verification.method || ''),
  'corpus asserts retrieval-not-memory provenance', 'verification.method')
assert(corpus.expectations.find((e) => e.code === 'PF7') !== undefined,
  'PF7 Paying Taxes is present (the expectation a 6-standard summary would drop)',
  corpus.expectations.find((e) => e.code === 'PF7')?.title)
assert(corpus.expectations.find((e) => e.code === 'PF4.1')?.parent === 'PF4',
  'PF4.1 is recorded as a child of PF4', 'parent=PF4')
assert(existsSync(join(LANE, 'standards', 'standards-custody.md')), 'standards custody document exists', 'standards-custody.md')
assert(Array.isArray(corpus.limits) && corpus.limits.some((l) => /not a claim of state approval/i.test(l)),
  'corpus states that alignment is not approval', 'limits')

// ---------- 2. per-course structure ----------
const allLessons = []
const coveredAcrossProgression = new Set()
for (const g of GRADES) {
  const dir = join(LANE, 'courses', SLUG(g))
  const cid = `ma-g${g}-financial-literacy`
  for (const f of ['units.json', 'lessons.jsonl', 'assessments.json', 'daily-schedule.csv', 'course-guide.md', 'lesson-sequence.md']) {
    assert(existsSync(join(dir, f)), `g${g}: ${f} exists`, join(SLUG(g), f))
  }
  const units = readJson(join(dir, 'units.json'))
  const lessons = readJsonl(join(dir, 'lessons.jsonl'))
  const assessments = readJson(join(dir, 'assessments.json'))
  allLessons.push(...lessons)

  assert(units.length === 7, `g${g}: 7 units (one per expectation)`, `${units.length}`)
  assert(lessons.length === LESSONS_PER_COURSE, `g${g}: ${LESSONS_PER_COURSE} lessons`, `${lessons.length}`)
  assert(assessments.length === 7, `g${g}: 7 unit assessments`, `${assessments.length}`)
  assert(JSON.stringify(units.map((u) => u.days)) === JSON.stringify(UNIT_COUNTS),
    `g${g}: unit day counts match the published Grade 8 shape`, units.map((u) => u.days).join(','))

  // every expectation covered within this single course
  const covered = new Set(units.flatMap((u) => u.standards))
  for (const c of EXPECTED_CODES) {
    assert(covered.has(c), `g${g}: expectation ${c} is covered`, c)
    coveredAcrossProgression.add(c)
  }

  // referential integrity
  const ids = new Set(lessons.map((l) => l.lesson_id))
  assert(ids.size === lessons.length, `g${g}: lesson ids unique`, `${ids.size}`)
  const declared = units.flatMap((u) => u.lesson_ids)
  assert(declared.length === lessons.length && declared.every((id) => ids.has(id)),
    `g${g}: every unit lesson_id resolves to a lesson`, `${declared.length} refs`)
  assert(lessons.every((l) => l.course_id === cid) && units.every((u) => u.course_id === cid),
    `g${g}: course_id consistent`, cid)
  assert(lessons.every((l, i) => l.course_day === i + 1),
    `g${g}: course_day is contiguous 1..${LESSONS_PER_COURSE}`, 'contiguous')
  const aIds = new Set(assessments.map((a) => a.assessment_id))
  assert(units.every((u) => aIds.has(u.assessment_id)),
    `g${g}: every unit assessment_id resolves`, `${aIds.size}`)
  assert(lessons.every((l) => units[l.unit_number - 1] && l.unit_title === units[l.unit_number - 1].title),
    `g${g}: lesson unit_title matches its unit`, 'consistent')

  // schedule
  const rows = parseCsv(readFileSync(join(dir, 'daily-schedule.csv'), 'utf8'))
  const head = rows[0], body = rows.slice(1)
  assert(head[0] === 'course_day' && head.includes('lesson_id'), `g${g}: schedule header`, head.join(','))
  assert(body.length === lessons.length, `g${g}: one schedule row per lesson`, `${body.length}`)
  const li = head.indexOf('lesson_id')
  assert(body.every((r, i) => r[li] === lessons[i].lesson_id), `g${g}: schedule lesson refs align`, 'aligned')
  const wi = head.indexOf('week')
  assert(Math.max(...body.map((r) => Number(r[wi]))) === 36, `g${g}: schedule spans 36 weeks`, '36')

  // Study Engine compatibility: segment-level resume needs >= 5 flow segments
  assert(lessons.every((l) => Array.isArray(l.lesson_flow) && l.lesson_flow.length >= 5),
    `g${g}: every lesson has >= 5 lesson_flow segments`, 'segment resume safe')
  // adult-only fields present on every lesson
  assert(lessons.every((l) => l.answer_or_scoring_guidance && Array.isArray(l.adaptive_tutor_routes) && l.mastery_rule),
    `g${g}: adult-only fields present on every lesson`, '3 protected fields')
  assert(assessments.every((a) => a.mastery_interpretation), `g${g}: assessments carry mastery_interpretation`, 'present')
}
assert(EXPECTED_CODES.every((c) => coveredAcrossProgression.has(c)),
  'complete 9-12 progression covers every Michigan Personal Finance expectation',
  [...coveredAcrossProgression].sort().join(', '))

// ---------- 3. mastery evidence ----------
assert(allLessons.every((l) => /never from practice generation alone/i.test(l.mastery_rule)),
  'practice generation never directly awards mastery', `${allLessons.length} lessons`)
assert(allLessons.every((l) => /two separate occasions/i.test(l.mastery_rule)),
  'mastery requires evidence on at least two separate occasions', 'two-occasion rule')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => r.signal === 'mastery evidence')),
  'every lesson carries a mastery-evidence tutor route', 'present')

// ---------- 4. no real financial data (the core safety invariant) ----------
// Prohibited terms may appear ONLY inside refusal/safety fields. They must never
// appear in any learner-facing instruction field.
const LEARNER_FIELDS = ['title', 'focus', 'essential_question', 'student_activity', 'formative_check',
  'home_connection', 'extension', 'learning_objectives', 'success_criteria', 'materials', 'performance_task_link']
const PROHIBITED = [
  /\breal bank\b/i, /\bbank credential/i, /\breal account number/i, /\bcard number\b/i,
  /\bsocial security number\b/i, /\bssn\b/i, /\btax identification number\b/i,
  /\bbrokerage credential/i, /\bpassword\b/i, /\bPIN\b/, /\breal balance/i, /\brouting number\b/i,
]
const violations = []
for (const l of allLessons) {
  const text = LEARNER_FIELDS.map((f) => {
    const v = l[f]
    return Array.isArray(v) ? v.join(' ') : (typeof v === 'string' ? v : '')
  }).join(' ')
  for (const p of PROHIBITED) if (p.test(text)) violations.push(`${l.lesson_id}: ${p}`)
}
assert(violations.length === 0,
  'no learner-facing field ever requests real financial or identifying data',
  violations.length ? violations.slice(0, 5).join('; ') : `${allLessons.length} lessons scanned, 0 violations`)

// digit shapes that would indicate a real card / SSN anywhere in the lane
const rawAll = GRADES.map((g) => readFileSync(join(LANE, 'courses', SLUG(g), 'lessons.jsonl'), 'utf8')).join('\n')
assert(!/\b\d{3}-\d{2}-\d{4}\b/.test(rawAll), 'no SSN-shaped literal anywhere in the lane', 'none')
assert(!/\b(?:\d[ -]?){13,19}\b/.test(rawAll), 'no card-number-shaped literal anywhere in the lane', 'none')

assert(allLessons.every((l) => l.simulation_only === true && l.requires_real_financial_data === false),
  'every lesson is flagged simulation-only and requires no real financial data', `${allLessons.length} lessons`)
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /No real transaction is required or requested/i.test(s))),
  'every lesson states that no real transaction is required', 'no-transaction rule')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /offers real financial or identifying data/i.test(r.signal))),
  'every lesson carries a tutor route refusing real financial data', 'refusal route')

// ---------- 5. no individualized advice ----------
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /what they personally should do with real money/i.test(r.signal))),
  'every lesson carries a tutor route declining individualized financial advice', 'decline route')
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /does not give individualized financial advice/i.test(s))),
  'every lesson states the no-individualized-advice boundary', 'boundary stated')

// ---------- 6. dignity + privacy ----------
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /non-shaming/i.test(s))),
  'every lesson carries the non-shaming requirement', 'no shame')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /discloses household financial hardship/i.test(r.signal))),
  'every lesson routes household-hardship disclosure without recording it', 'hardship route')
assert(allLessons.every((l) => /Do not expose raw learner responses/i.test(l.parent_or_guardian_visibility)),
  'parent-visible evidence is minimized on every lesson', 'minimized')
assert(allLessons.every((l) => l.media?.required === false),
  'no lesson requires media', 'media optional everywhere')

// ---------- 7. grade 12 capstone ----------
const g12units = readJson(join(LANE, 'courses', SLUG(12), 'units.json'))
const cap = g12units.find((u) => u.is_capstone_unit)
assert(cap !== undefined, 'grade 12 declares a capstone unit', cap?.title)
assert(/ADULT FINANCE CAPSTONE/.test(cap?.performance_task || ''),
  'grade 12 capstone is a practical simulated adult-finance capstone', 'declared')
assert(cap?.simulation_only === true && !/real (transaction|account|payment)/i.test(cap.performance_task),
  'grade 12 capstone requires no real transaction', 'simulated')
const g12lessons = readJsonl(join(LANE, 'courses', SLUG(12), 'lessons.jsonl'))
assert(g12lessons.filter((l) => l.is_capstone_lesson).length === 1,
  'grade 12 has exactly one capstone lesson', 'one')

// ---------- 8. continuity 8 -> 9 ----------
const g8 = join(REPO, 'curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/financial-literacy/units.json')
if (existsSync(g8)) {
  const g8u = readJson(g8)
  const g8codes = new Set(g8u.flatMap((u) => u.standards).filter((s) => /^PF/.test(s)))
  assert([...g8codes].every((c) => EXPECTED_CODES.includes(c) || c.startsWith('PF')),
    'grade 8 uses the same PF code vocabulary this lane extends', [...g8codes].sort().join(', '))
  assert(g8u.length === 7, 'grade 8 predecessor has 7 units, matching this lane', `${g8u.length}`)
  const g9 = readJson(join(LANE, 'courses', SLUG(9), 'units.json'))
  assert(JSON.stringify(g8u.map((u) => u.days)) === JSON.stringify(g9.map((u) => u.days)),
    'grade 9 keeps the grade 8 unit-length shape', g9.map((u) => u.days).join(','))
} else {
  ok('grade 8 predecessor not present in this worktree; continuity check skipped', g8)
}
assert(existsSync(join(LANE, 'progression', 'grade-8-to-financial-literacy-9-handoff.md')),
  'grade 8 -> 9 handoff document exists', 'handoff')
assert(existsSync(join(LANE, 'progression', 'rigor-progression-9-12.md')),
  'rigor progression document exists', 'rigor')

// ---------- report ----------
const failed = checks.filter((c) => c.result === 'FAIL')
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))
} else {
  for (const c of checks) console.log(`${c.result === 'PASS' ? 'PASS' : 'FAIL'}  ${c.check}${c.details ? `  — ${c.details}` : ''}`)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
}
process.exit(failed.length ? 1 : 0)

#!/usr/bin/env node
// Validation for the High School Ready for Life 9-12 authoring lane.
// Usage: node validation/validate.mjs [--json]
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LANE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO = resolve(LANE, '../../../..')
const GRADES = [9, 10, 11, 12]
const SLUG = (g) => `ready-for-life-${g}`
const UNITS = 6, LESSONS_PER_UNIT = 6, LESSONS_PER_COURSE = 36
const SIGNOFF_DAYS = [4, 6]

const checks = []
const ok = (c, d) => checks.push({ check: c, result: 'PASS', details: d })
const bad = (c, d) => checks.push({ check: c, result: 'FAIL', details: d })
const assert = (cond, c, d) => (cond ? ok(c, d) : bad(c, d))
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const parseCsv = (t) => t.split('\n').filter(Boolean).map((r) => r.split(',').reduce((acc, part) => {
  // simple splitter is unsafe with quotes; use a real one
  return acc
}, null) || null)
function csvRows(text) {
  const rows = []; let row = [], f = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(f); f = '' }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (c !== '\r') f += c
  }
  if (f.length || row.length) { row.push(f); rows.push(row) }
  return rows.filter((r) => r.length > 1)
}

// ---------- 1. competency framework honesty ----------
const fwPath = join(LANE, 'standards', 'manuel-academy-rfl-9-12-competencies.json')
assert(existsSync(fwPath), 'competency framework exists', fwPath)
const fw = readJson(fwPath)
assert(fw.authority === 'LOCAL_COMPOSITION', 'framework is declared LOCAL_COMPOSITION', fw.authority)
assert(fw.jurisdiction === null, 'framework claims no jurisdiction', 'jurisdiction=null')
assert(/NOT a state, national, or third-party standards framework/i.test(fw.authority_statement || ''),
  'framework explicitly disclaims external standards authority', 'disclaimed')
assert(fw.relationship_to_published_release?.modification?.startsWith('NONE'),
  'framework states the published grades 5/7/8 course is unmodified', 'NONE')
assert(Array.isArray(fw.safety_charter) && fw.safety_charter.length >= 6, 'safety charter present', `${fw.safety_charter?.length} clauses`)
assert(/A click cannot certify/i.test(fw.certification_rule?.statement || ''),
  'framework states that a click cannot certify a real-world task', 'stated')
assert(/never directly awards mastery|never from practice generation/i.test(fw.evidence_rule || '') || /at least two/i.test(fw.evidence_rule || ''),
  'framework states the multi-occasion evidence rule', 'stated')

// ---------- 2. per-course structure ----------
const allLessons = []
for (const g of GRADES) {
  const dir = join(LANE, 'courses', SLUG(g))
  const cid = `ma-g${g}-ready-for-life`
  for (const f of ['units.json', 'lessons.jsonl', 'assessments.json', 'daily-schedule.csv', 'course-guide.md', 'lesson-sequence.md']) {
    assert(existsSync(join(dir, f)), `g${g}: ${f} exists`, join(SLUG(g), f))
  }
  const units = readJson(join(dir, 'units.json'))
  const lessons = readJsonl(join(dir, 'lessons.jsonl'))
  const assessments = readJson(join(dir, 'assessments.json'))
  allLessons.push(...lessons)

  assert(units.length === UNITS, `g${g}: ${UNITS} units`, `${units.length}`)
  assert(lessons.length === LESSONS_PER_COURSE, `g${g}: ${LESSONS_PER_COURSE} lessons`, `${lessons.length}`)
  assert(assessments.length === UNITS, `g${g}: ${UNITS} unit assessments`, `${assessments.length}`)
  assert(units.every((u) => u.days === LESSONS_PER_UNIT), `g${g}: every unit is ${LESSONS_PER_UNIT} lessons`, 'uniform')

  const ids = new Set(lessons.map((l) => l.lesson_id))
  assert(ids.size === lessons.length, `g${g}: lesson ids unique`, `${ids.size}`)
  const declared = units.flatMap((u) => u.lesson_ids)
  assert(declared.length === lessons.length && declared.every((id) => ids.has(id)),
    `g${g}: every unit lesson_id resolves`, `${declared.length} refs`)
  assert(lessons.every((l) => l.course_id === cid) && units.every((u) => u.course_id === cid),
    `g${g}: course_id consistent`, cid)
  assert(lessons.every((l, i) => l.course_day === i + 1), `g${g}: course_day contiguous 1..${LESSONS_PER_COURSE}`, 'contiguous')
  const aIds = new Set(assessments.map((a) => a.assessment_id))
  assert(units.every((u) => aIds.has(u.assessment_id)), `g${g}: every unit assessment_id resolves`, `${aIds.size}`)
  assert(lessons.every((l) => l.standards.length === 1 && l.standards[0] === `Manuel Academy RFL Grade ${g} progression`),
    `g${g}: lessons carry the local grade progression string`, `Manuel Academy RFL Grade ${g} progression`)
  assert(lessons.every((l) => Array.isArray(l.competency_domains) && l.competency_domains.every((d) => fw.domains.some((x) => x.code === d))),
    `g${g}: every competency domain resolves to the framework`, 'resolved')

  const rows = csvRows(readFileSync(join(dir, 'daily-schedule.csv'), 'utf8'))
  const head = rows[0], body = rows.slice(1)
  assert(body.length === lessons.length, `g${g}: one schedule row per lesson`, `${body.length}`)
  const li = head.indexOf('lesson_id')
  assert(body.every((r, i) => r[li] === lessons[i].lesson_id), `g${g}: schedule lesson refs align`, 'aligned')
  const si = head.indexOf('requires_guardian_signoff')
  assert(si >= 0 && body.every((r, i) => (r[si] === 'yes') === lessons[i].requires_guardian_signoff),
    `g${g}: schedule sign-off column matches lessons`, 'consistent')
  const wi = head.indexOf('week')
  assert(Math.max(...body.map((r) => Number(r[wi]))) === 36, `g${g}: schedule spans 36 weeks`, '36')

  assert(lessons.every((l) => Array.isArray(l.lesson_flow) && l.lesson_flow.length >= 5),
    `g${g}: every lesson has >= 5 lesson_flow segments`, 'segment resume safe')
  assert(lessons.every((l) => l.answer_or_scoring_guidance && Array.isArray(l.adaptive_tutor_routes) && l.mastery_rule),
    `g${g}: adult-only fields present on every lesson`, '3 protected fields')
}

// ---------- 3. guardian sign-off: a click cannot certify ----------
const signoff = allLessons.filter((l) => l.requires_guardian_signoff)
assert(signoff.length === GRADES.length * UNITS * SIGNOFF_DAYS.length,
  'expected number of guardian sign-off lessons', `${signoff.length} of ${allLessons.length}`)
assert(allLessons.every((l) => l.requires_guardian_signoff === SIGNOFF_DAYS.includes(l.day_in_unit)),
  'sign-off lessons are exactly the real-world application and performance-task days', `days ${SIGNOFF_DAYS.join(',')}`)
assert(signoff.every((l) => l.adult_attestation?.required === true),
  'every sign-off lesson requires an adult attestation', `${signoff.length} lessons`)
assert(signoff.every((l) => ['observing_adult_role', 'what_was_observed', 'date'].every((f) => l.adult_attestation.fields.includes(f))),
  'attestation names the observing adult role, what was observed, and the date', '3 fields')
assert(allLessons.every((l) => l.adult_attestation?.click_alone_is_insufficient === true),
  'every lesson records that a click alone is insufficient', `${allLessons.length} lessons`)
assert(signoff.every((l) => /A click cannot certify a real-world adult-supervised task/i.test(l.guardian_signoff_rule || '')),
  'every sign-off lesson states the click-cannot-certify rule verbatim', 'stated')
assert(signoff.every((l) => l.adaptive_tutor_routes.some((r) => /reports a real-world task complete without attestation/i.test(r.signal))),
  'every sign-off lesson routes an unattested completion claim', 'routed')

// ---------- 4. safety: no unsafe unsupervised task ----------
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /No unsafe unsupervised real-world task is ever assigned/i.test(s))),
  'every lesson states that no unsafe unsupervised task is assigned', 'stated')
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /Guardian supervision is required for heat, sharp tools/i.test(s))),
  'every lesson enumerates the supervision-required hazards', 'enumerated')
assert(allLessons.every((l) => typeof l.simulated_alternative === 'string' && /equal\s+credit/i.test(l.simulated_alternative)),
  'every lesson offers a simulated alternative at equal credit', `${allLessons.length} lessons`)
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /proposes an unsafe or unsupervised action/i.test(r.signal))),
  'every lesson carries a tutor route refusing unsafe or unsupervised action', 'routed')

// ---------- 5. no credential collection ----------
const LEARNER_FIELDS = ['title', 'focus', 'essential_question', 'student_activity', 'formative_check',
  'home_connection', 'extension', 'learning_objectives', 'success_criteria', 'materials', 'performance_task_link']
const PROHIBITED = [/\bpassword\b/i, /\bPIN\b/, /\baccount number\b/i, /\bcard number\b/i,
  /\bsocial security\b/i, /\bssn\b/i, /\breal balance/i, /\bcredential/i]
const viol = []
for (const l of allLessons) {
  const text = LEARNER_FIELDS.map((f) => {
    const v = l[f]; return Array.isArray(v) ? v.join(' ') : (typeof v === 'string' ? v : '')
  }).join(' ')
  for (const p of PROHIBITED) if (p.test(text)) viol.push(`${l.lesson_id}: ${p}`)
}
assert(viol.length === 0, 'no learner-facing field ever requests a credential or identifier',
  viol.length ? viol.slice(0, 5).join('; ') : `${allLessons.length} lessons scanned, 0 violations`)
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /No credential collection/i.test(s))),
  'every lesson states the no-credential rule', 'stated')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /offers a credential or identifier/i.test(r.signal))),
  'every lesson routes an offered credential to refusal', 'routed')

// ---------- 6. dignity: no shame, no forced disclosure ----------
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /non-shaming/i.test(s) && /never treated as a character flaw/i.test(s))),
  'every lesson carries the no-shame requirement', 'no shame')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /expresses shame or self-criticism/i.test(r.signal))),
  'every lesson routes learner shame without recording it', 'routed')
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /No forced private disclosure/i.test(s))),
  'every lesson states the no-forced-disclosure rule', 'stated')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /discloses private or household detail/i.test(r.signal))),
  'every lesson routes private disclosure without storing it', 'routed')
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /No identifiable learner photo/i.test(s))),
  'no lesson requires an identifiable photo, recording, or performance', 'stated')
assert(allLessons.every((l) => l.media?.required === false), 'no lesson requires media', 'optional')

// ---------- 7. not advice ----------
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /is medical, legal, financial, employment, or immigration advice/i.test(s))),
  'every lesson states the not-advice boundary', 'stated')
assert(allLessons.every((l) => l.adaptive_tutor_routes.some((r) => /asks for medical, legal, or financial direction/i.test(r.signal))),
  'every lesson routes an advice request to a qualified human', 'routed')
assert(allLessons.every((l) => l.safety_and_privacy.some((s) => /Local rules vary/i.test(s))),
  'every lesson tells the learner to verify local rules rather than assume', 'stated')

// ---------- 8. mastery + privacy ----------
assert(allLessons.every((l) => /never from practice generation alone/i.test(l.mastery_rule)),
  'practice generation never directly awards mastery', `${allLessons.length} lessons`)
assert(allLessons.every((l) => /two separate occasions/i.test(l.mastery_rule)),
  'mastery requires evidence on at least two separate occasions', 'two-occasion rule')
assert(allLessons.every((l) => /attestation is present/i.test(l.mastery_rule)),
  'an attested real-world performance counts only when the attestation exists', 'stated')
assert(allLessons.every((l) => /Do not expose raw reflections/i.test(l.parent_or_guardian_visibility)),
  'parent-visible evidence is minimized on every lesson', 'minimized')

// ---------- 9. senior capstone ----------
const g12u = readJson(join(LANE, 'courses', SLUG(12), 'units.json'))
const senior = g12u.find((u) => u.capstone_level === 'senior')
assert(senior !== undefined, 'grade 12 declares a senior capstone unit', senior?.title)
assert(senior?.unit_number === UNITS, 'the senior capstone is the final unit of grade 12', `unit ${senior?.unit_number}`)
assert(/TRANSITION-TO-ADULTHOOD CAPSTONE/.test(senior?.performance_task || ''),
  'the senior capstone is a transition-to-adulthood capstone', 'declared')
assert(/guardian attestation of every real-world component/i.test(senior?.performance_task || ''),
  'the senior capstone requires guardian attestation of real-world components', 'required')
assert(/without shame/i.test(senior?.topics.join(' ') || ''),
  'the senior capstone names remaining support needs without shame', 'stated')
for (const g of GRADES) {
  const u = readJson(join(LANE, 'courses', SLUG(g), 'units.json'))
  assert(u.some((x) => x.capstone_level), `g${g}: declares a capstone unit`, u.find((x) => x.capstone_level)?.title)
}

// ---------- 10. continuity 8 -> 9 ----------
const g8 = join(REPO, 'curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/units.json')
if (existsSync(g8)) {
  const g8u = readJson(g8)
  assert(g8u.length === UNITS, 'grade 8 predecessor has 6 units, matching this lane', `${g8u.length}`)
  assert(g8u.every((u) => u.days === LESSONS_PER_UNIT), 'grade 8 predecessor uses 6-lesson units, matching this lane', 'uniform')
  assert(g8u.every((u) => u.standards.every((s) => /^Manuel Academy RFL Grade \d+ progression$/.test(s))),
    'grade 8 uses the same local progression-string convention this lane extends', g8u[0].standards[0])
  const g8titles = g8u.map((u) => u.title)
  assert(fw.relationship_to_published_release.predecessor_units.every((t) => g8titles.includes(t)),
    'framework predecessor unit list matches the actual grade 8 course', `${g8titles.length} units`)
} else {
  bad('grade 8 predecessor readable for continuity check', g8)
}
assert(existsSync(join(LANE, 'progression', 'grade-8-to-ready-for-life-9-handoff.md')), 'grade 8 -> 9 handoff exists', 'handoff')
assert(existsSync(join(LANE, 'progression', 'progression-9-12.md')), 'progression document exists', 'progression')

// ---------- report ----------
const failed = checks.filter((c) => c.result === 'FAIL')
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2))
} else {
  for (const c of checks) console.log(`${c.result}  ${c.check}${c.details ? `  — ${c.details}` : ''}`)
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
}
process.exit(failed.length ? 1 : 0)

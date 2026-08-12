#!/usr/bin/env node
// Validation for the High School ELA 9-12 authoring lane.
//
// This lane is deliberately OUTSIDE the frozen published release at
// curriculum-content/manuel-academy/1.0.0 (which pins grades 5/7/8, 30 courses,
// 2736 lessons and must not be disturbed). These checks therefore stand alone.
//
// Usage: node validation/validate.mjs [--json]
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LANE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SLUGS = ['english-9', 'english-10', 'english-11', 'english-12']
const GRADE_OF = { 'english-9': 9, 'english-10': 10, 'english-11': 11, 'english-12': 12 }
const BAND_OF = { 9: '9-10', 10: '9-10', 11: '11-12', 12: '11-12' }

const checks = []
const ok = (check, details) => checks.push({ check, result: 'PASS', details })
const bad = (check, details) => checks.push({ check, result: 'FAIL', details })
const assert = (cond, check, details) => (cond ? ok(check, details) : bad(check, details))

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const readJsonl = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') inQ = false
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.length > 1)
}

// ---------- standards corpus ----------
const corpus = readJson(join(LANE, 'standards', 'michigan-ela-9-12-standards.json'))
const byCode = new Map(corpus.standards.map((s) => [s.code, s]))
const applicable = new Set(corpus.standards.filter((s) => s.applicable).map((s) => s.code))
assert(corpus.standards.length === 84, 'standards-corpus-size', `${corpus.standards.length} entries (expect 84 = 2 bands x (10+10+10+6+6))`)
assert(corpus.source.sha256 && /^[0-9a-f]{64}$/.test(corpus.source.sha256), 'standards-source-hashed', corpus.source.sha256)
assert(corpus.code_format.authority === 'LOCAL_COMPOSITION', 'standards-code-format-disclosed', corpus.code_format.authority)
assert(corpus.verification.verified === true, 'standards-verified-flag', String(corpus.verification.verified))
assert(corpus.standards.every((s) => typeof s.text === 'string' && s.text.length > 20), 'standards-text-nonempty', 'all entries carry text')

// ---------- load courses ----------
const courses = {}
for (const slug of SLUGS) {
  const dir = join(LANE, 'courses', slug)
  assert(existsSync(dir), `course-exists:${slug}`, dir)
  courses[slug] = {
    slug, grade: GRADE_OF[slug], dir,
    units: readJson(join(dir, 'units.json')),
    lessons: readJsonl(join(dir, 'lessons.jsonl')),
    assessments: readJson(join(dir, 'assessments.json')),
    texts: readJson(join(dir, 'text-bank.json')),
    schedule: parseCsv(readFileSync(join(dir, 'daily-schedule.csv'), 'utf8')),
    guide: readFileSync(join(dir, 'course-guide.md'), 'utf8'),
  }
}
assert(Object.keys(courses).length === 4, 'four-courses', SLUGS.join(', '))

// ---------- shape, counts, IDs ----------
const allLessonIds = new Set(), allUnitIds = new Set(), allAssessmentIds = new Set()
let dupLesson = 0, dupUnit = 0, dupAssess = 0
for (const slug of SLUGS) {
  const c = courses[slug]
  const cid = `ma-g${c.grade}-english-language-arts`
  assert(c.units.length === 10, `units-count:${slug}`, `${c.units.length}`)
  assert(c.lessons.length === 180, `lessons-count:${slug}`, `${c.lessons.length}`)
  assert(c.assessments.length === 10, `assessments-count:${slug}`, `${c.assessments.length}`)
  assert(c.units.every((u) => u.days === 18), `unit-days-18:${slug}`, '10 units x 18 days')
  assert(c.lessons.every((l) => l.course_id === cid), `course-id-consistent:${slug}`, cid)
  assert(c.lessons.every((l) => l.grade === c.grade), `grade-consistent:${slug}`, `${c.grade}`)
  const idRe = new RegExp(`^ma-g${c.grade}-english-language-arts-u[0-9]{2}-l[0-9]{2}$`)
  assert(c.lessons.every((l) => idRe.test(l.lesson_id)), `lesson-id-format:${slug}`, idRe.source)
  for (const l of c.lessons) { if (allLessonIds.has(l.lesson_id)) dupLesson++; allLessonIds.add(l.lesson_id) }
  for (const u of c.units) { if (allUnitIds.has(u.unit_id)) dupUnit++; allUnitIds.add(u.unit_id) }
  for (const a of c.assessments) { if (allAssessmentIds.has(a.assessment_id)) dupAssess++; allAssessmentIds.add(a.assessment_id) }

  // course_day contiguity
  const days = c.lessons.map((l) => l.course_day).sort((a, b) => a - b)
  assert(days.length === 180 && days[0] === 1 && days[179] === 180 && new Set(days).size === 180,
    `course-days-1-180:${slug}`, `${days[0]}..${days[179]}, unique=${new Set(days).size}`)
}
assert(allLessonIds.size === 720 && dupLesson === 0, 'unique-lesson-ids', `${allLessonIds.size} unique, ${dupLesson} dupes`)
assert(allUnitIds.size === 40 && dupUnit === 0, 'unique-unit-ids', `${allUnitIds.size} unique`)
assert(allAssessmentIds.size === 40 && dupAssess === 0, 'unique-assessment-ids', `${allAssessmentIds.size} unique`)

// ---------- referential integrity ----------
for (const slug of SLUGS) {
  const c = courses[slug]
  const lessonById = new Map(c.lessons.map((l) => [l.lesson_id, l]))
  const refCount = new Map()
  for (const u of c.units) for (const id of u.lesson_ids) refCount.set(id, (refCount.get(id) || 0) + 1)
  const unresolved = [...refCount.keys()].filter((id) => !lessonById.has(id))
  const multi = [...refCount.entries()].filter(([, n]) => n !== 1)
  const orphan = c.lessons.filter((l) => !refCount.has(l.lesson_id))
  assert(unresolved.length === 0, `unit-refs-resolve:${slug}`, `${unresolved.length} unresolved`)
  assert(multi.length === 0, `unit-refs-exactly-once:${slug}`, `${multi.length} referenced != once`)
  assert(orphan.length === 0, `no-orphan-lessons:${slug}`, `${orphan.length} orphans`)
  const aIds = new Set(c.assessments.map((a) => a.assessment_id))
  assert(c.units.every((u) => aIds.has(u.assessment_id)), `assessment-refs-resolve:${slug}`, '10/10')
}

// ---------- schedule coverage ----------
for (const slug of SLUGS) {
  const c = courses[slug]
  const rows = c.schedule.slice(1)
  const scheduled = rows.map((r) => r[5])
  const lessonSet = new Set(c.lessons.map((l) => l.lesson_id))
  const counts = new Map()
  for (const id of scheduled) counts.set(id, (counts.get(id) || 0) + 1)
  const notOnce = [...counts.entries()].filter(([, n]) => n !== 1)
  const unknown = scheduled.filter((id) => !lessonSet.has(id))
  const missing = [...lessonSet].filter((id) => !counts.has(id))
  assert(rows.length === 180, `schedule-rows:${slug}`, `${rows.length}`)
  assert(unknown.length === 0, `schedule-refs-known:${slug}`, `${unknown.length} unknown`)
  assert(notOnce.length === 0 && missing.length === 0,
    `schedule-covers-every-lesson-once:${slug}`, `scheduled=${scheduled.length}, lessons=${lessonSet.size}`)
  const weeks = new Set(rows.map((r) => Number(r[1])))
  const weekdays = new Set(rows.map((r) => Number(r[2])))
  assert(weeks.size === 36, `schedule-36-weeks:${slug}`, `${weeks.size}`)
  assert([...weekdays].every((d) => d >= 1 && d <= 5), `schedule-weekdays-1-5:${slug}`, [...weekdays].sort().join(','))
}

// ---------- standards resolution, band, coverage ----------
const bandUnion = { '9-10': new Set(), '11-12': new Set() }
for (const slug of SLUGS) {
  const c = courses[slug]
  const band = BAND_OF[c.grade]
  const used = new Set()
  for (const u of c.units) for (const s of u.standards) used.add(s)
  for (const l of c.lessons) for (const s of l.standards) used.add(s)
  for (const a of c.assessments) for (const s of a.standards) used.add(s)
  const unknown = [...used].filter((s) => !byCode.has(s))
  const wrongBand = [...used].filter((s) => byCode.has(s) && byCode.get(s).band !== band)
  const notApplicable = [...used].filter((s) => byCode.has(s) && !byCode.get(s).applicable)
  const gradePrefixed = [...used].filter((s) => /^[0-9]{1,2}\./.test(s) && !s.startsWith('9-10.') && !s.startsWith('11-12.'))
  assert(unknown.length === 0, `standards-resolve:${slug}`, `${unknown.length} unknown: ${unknown.slice(0, 5).join(',')}`)
  assert(wrongBand.length === 0, `standards-band-correct:${slug}`, `band ${band}, ${wrongBand.length} out-of-band`)
  assert(notApplicable.length === 0, `standards-applicable-only:${slug}`, `${notApplicable.length} not-applicable used`)
  assert(gradePrefixed.length === 0, `no-k8-standard-codes:${slug}`, `${gradePrefixed.length} grade-prefixed (e.g. 8.RL.1) codes`)
  for (const s of used) bandUnion[band].add(s)
}
for (const band of ['9-10', '11-12']) {
  const need = [...applicable].filter((c) => c.startsWith(band + '.'))
  const missing = need.filter((c) => !bandUnion[band].has(c))
  assert(missing.length === 0, `band-coverage:${band}`, `${need.length - missing.length}/${need.length} covered${missing.length ? '; missing ' + missing.join(',') : ''}`)
}

// ---------- lesson content invariants ----------
const REQUIRED = ['schema_version', 'lesson_id', 'course_id', 'grade', 'subject', 'course_day',
  'unit_number', 'title', 'phase', 'focus', 'standards', 'learning_objectives', 'lesson_flow',
  'formative_check', 'mastery_rule', 'accessibility_and_accommodations', 'safety_and_privacy']
for (const slug of SLUGS) {
  const c = courses[slug]
  const missingField = c.lessons.filter((l) => REQUIRED.some((k) => l[k] === undefined))
  assert(missingField.length === 0, `lesson-required-fields:${slug}`, `${missingField.length} lessons missing a required field`)
  assert(c.lessons.every((l) => l.learning_objectives.length >= 3), `lesson-3-objectives:${slug}`, 'all')
  assert(c.lessons.every((l) => l.lesson_flow.length >= 5), `lesson-5-segments:${slug}`, 'all (Study-resumable segmentation)')
  assert(c.lessons.every((l) => l.standards.length >= 1), `lesson-has-standards:${slug}`, 'all')
  assert(c.lessons.every((l) => l.accessibility_and_accommodations.length >= 5), `lesson-accessibility-5:${slug}`, 'all')
  assert(c.lessons.every((l) => l.safety_and_privacy.length >= 2), `lesson-safety-2:${slug}`, 'all')
  assert(c.lessons.every((l) => l.media && l.media.required === false && typeof l.media.fallback === 'string'),
    `media-optional-with-fallback:${slug}`, 'all lessons: media never required, fallback present')
  assert(c.lessons.every((l) => /accessible reading representation/i.test(l.accessibility_and_accommodations.join(' '))),
    `accessible-reading-representation:${slug}`, 'all')
  assert(c.lessons.every((l) => /private|privately/i.test(l.safety_and_privacy.join(' '))),
    `private-presentation-path:${slug}`, 'all')
  // multi-occasion mastery
  assert(c.lessons.every((l) => /two (separate )?occasions|two occasions/i.test(l.mastery_rule)),
    `multi-occasion-mastery:${slug}`, 'every lesson requires >= 2 occasions')
  // authorship
  assert(c.lessons.every((l) => Array.isArray(l.student_authorship) && l.student_authorship.length >= 3),
    `student-authorship-present:${slug}`, 'all')
  assert(c.lessons.every((l) => /must not draft, rewrite, or supply sentences/i.test(l.student_authorship.join(' '))),
    `tutor-may-not-write-response:${slug}`, 'all')
  assert(c.lessons.every((l) => l.adaptive_tutor_routes.some((r) => /Decline to supply the assessed response/i.test(r.action))),
    `tutor-declines-answer-route:${slug}`, 'all')
  // no raw essay persistence into guardian metadata
  assert(c.lessons.every((l) => /Do not expose raw drafts/i.test(l.parent_or_guardian_visibility)),
    `no-raw-essay-in-guardian-metadata:${slug}`, 'all')
}

// ---------- assessment invariants ----------
let prevPoints = 0
for (const slug of SLUGS) {
  const c = courses[slug]
  assert(c.assessments.every((a) => a.total_points === a.prompts.reduce((s, p) => s + p.points, 0)),
    `assessment-points-sum:${slug}`, 'all')
  assert(c.assessments.every((a) => a.mastery_interpretation && a.rubric_dimensions.length >= 4),
    `assessment-rubric:${slug}`, 'all')
  assert(c.assessments.every((a) => /reassessment/i.test(a.reassessment || '')), `assessment-reassessment:${slug}`, 'all')
  assert(c.assessments.every((a) => /learner/i.test(a.authorship_rule) && /must be the learner's own/i.test(a.authorship_rule)),
    `assessment-authorship-rule:${slug}`, 'all')
  const pts = c.assessments[0].total_points
  assert(pts >= prevPoints, `assessment-weight-non-decreasing:${slug}`, `${prevPoints} -> ${pts}`)
  prevPoints = pts
}

// ---------- rigor progression is real, not cosmetic ----------
const profileStrings = SLUGS.map((s) => {
  const l = courses[s].lessons[3]
  return {
    slug: s,
    model: l.lesson_flow[1].teacher_or_tutor_action,
    guided: l.lesson_flow[2].teacher_or_tutor_action,
    independent: l.lesson_flow[3].teacher_or_tutor_action,
    mastery: l.mastery_rule,
  }
})
for (const key of ['model', 'guided', 'independent', 'mastery']) {
  const vals = profileStrings.map((p) => p[key])
  assert(new Set(vals).size === 4, `rigor-distinct:${key}`, `${new Set(vals).size}/4 distinct across the four courses`)
}
assert(/no worked exemplar/i.test(profileStrings[3].model), 'g12-no-supplied-method', 'English 12 withholds the worked exemplar')
assert(/checklist still available/i.test(profileStrings[0].independent), 'g9-scaffold-present', 'English 9 keeps the criteria checklist')
assert(courses['english-12'].assessments[0].prompts.some((p) => p.type === 'source trail audit'),
  'g12-source-trail-audit', 'English 12 scores an auditable source trail')
assert(courses['english-11'].assessments[0].prompts.some((p) => p.type === 'uncertainty and limits'),
  'g11-uncertainty-scored', 'English 11 scores uncertainty and limits')
assert(!courses['english-10'].assessments[0].prompts.some((p) => p.type === 'source trail audit'),
  'g10-lacks-g12-dimension', 'English 10 does not carry the senior dimension')

// ---------- text banks / source boundaries ----------
const VALID_RIGHTS = new Set(['original', 'public_domain', 'rights_required'])
for (const slug of SLUGS) {
  const c = courses[slug]
  const ts = c.texts.texts
  assert(ts.every((t) => VALID_RIGHTS.has(t.rights)), `text-rights-valid:${slug}`, 'all')
  assert(new Set(ts.map((t) => t.text_id)).size === ts.length, `text-ids-unique:${slug}`, `${ts.length}`)
  const pdBad = ts.filter((t) => t.rights === 'public_domain' && typeof t.year === 'number' && t.year > 1929)
  assert(pdBad.length === 0, `public-domain-year:${slug}`, `${pdBad.length} entries dated after 1929${pdBad.length ? ': ' + pdBad.map((t) => `${t.text_id}(${t.year})`).join(',') : ''}`)
  const gated = ts.filter((t) => t.rights === 'rights_required')
  assert(gated.every((t) => t.reproducible_in_full === false && t.public_domain_substitute),
    `rights-required-substituted:${slug}`, `${gated.length} gated entries, each with a PD substitute`)
  assert(gated.every((t) => !t.opening_passage), `rights-required-no-text:${slug}`, 'no passage stored for gated works')
  assert(ts.every((t) => t.source && t.author !== undefined), `text-citation-metadata:${slug}`, 'all entries carry source + author')
  assert(ts.some((t) => t.rights === 'original'), `original-texts-present:${slug}`, `${ts.filter((t) => t.rights === 'original').length} original`)
}

// ---------- the 18-day arc must actually differentiate days ----------
for (const slug of SLUGS) {
  const c = courses[slug]
  const shapeOf = (l) => l.lesson_flow.map((s) => s.segment).join(' | ')
  const shapes = new Set(c.lessons.map(shapeOf))
  assert(shapes.size >= 10, `phase-arc-implemented:${slug}`,
    `${shapes.size} distinct lesson_flow shapes across 18 phases (a single shape means the arc is decorative)`)
  const byPhase = new Map()
  for (const l of c.lessons) {
    if (!byPhase.has(l.phase)) byPhase.set(l.phase, new Set())
    byPhase.get(l.phase).add(shapeOf(l))
  }
  assert([...byPhase.values()].every((set) => set.size === 1), `phase-shape-stable:${slug}`,
    'each phase yields one consistent shape')
  // the day that matters most: assessment day must not run instruction
  const assessDays = c.lessons.filter((l) => l.phase === 'Unit assessment')
  assert(assessDays.length === 10, `assessment-days-present:${slug}`, `${assessDays.length}`)
  const instructing = assessDays.filter((l) => l.lesson_flow.some((s) => /Model or mini-lesson|Guided practice/i.test(s.segment)))
  assert(instructing.length === 0, `assessment-day-no-instruction:${slug}`,
    `${instructing.length} assessment days still run modelling or guided practice`)
  const seminarDays = c.lessons.filter((l) => l.phase === 'Discussion or problem seminar')
  assert(seminarDays.every((l) => l.lesson_flow.some((s) => /Seminar/i.test(s.segment))), `seminar-day-is-seminar:${slug}`, `${seminarDays.length} days`)
  assert(seminarDays.every((l) => l.lesson_flow.some((s) => /private/i.test(s.teacher_or_tutor_action))), `seminar-private-option:${slug}`, 'all')
  const correction = c.lessons.filter((l) => l.phase === 'Targeted correction')
  assert(correction.every((l) => /reassessment/i.test(JSON.stringify(l.lesson_flow))), `correction-day-has-reassessment:${slug}`, `${correction.length} days`)
  // activity and check must vary by phase, not just by focus
  const acts = new Set(c.lessons.map((l) => l.student_activity.replace(/[a-z' -]+$/i, '')))
  assert(new Set(c.lessons.map((l) => l.formative_check)).size >= 10, `formative-check-varies:${slug}`,
    `${new Set(c.lessons.map((l) => l.formative_check)).size} distinct formative checks`)
}

// ---------- the assessed bar must rise between courses ----------
{
  const crit = SLUGS.map((s) => JSON.stringify(courses[s].lessons[3].success_criteria))
  const objs = SLUGS.map((s) => JSON.stringify(courses[s].lessons[3].learning_objectives.map((o) => o.replace(/grades [0-9-]+[^.]*/g, ''))))
  assert(new Set(crit).size === 4, 'success-criteria-distinct-per-course', `${new Set(crit).size}/4 distinct`)
  assert(new Set(objs).size === 4, 'learning-objectives-distinct-per-course', `${new Set(objs).size}/4 distinct`)
  const g12 = courses['english-12'].lessons[3].success_criteria.join(' ')
  assert(/known weakness of that method/i.test(g12) && /does not establish/i.test(g12),
    'g12-criteria-are-senior-level', 'English 12 is judged on method choice and bounded claims')
  const g9 = courses['english-9'].lessons[3].success_criteria.join(' ')
  assert(/criteria checklist/i.test(g9), 'g9-criteria-are-scaffolded', 'English 9 is judged against a supplied checklist')
}

// ---------- assessment weight ladder (Grade 8 assesses at 38) ----------
{
  const pts = SLUGS.map((s) => courses[s].assessments[0].total_points)
  assert(pts.every((p) => p > 38), 'assessment-above-grade-8', `${pts.join(' < ')} vs grade 8 = 38`)
  assert(pts.every((p, i) => i === 0 || p > pts[i - 1]), 'assessment-strictly-increasing', pts.join(' -> '))
  assert(SLUGS.every((s) => courses[s].assessments.every((a) => a.total_points === courses[s].assessments[0].total_points)),
    'assessment-weight-consistent-in-course', 'all 10 units per course carry the same weight')
}

// ---------- lesson-level standards must be informative ----------
for (const slug of SLUGS) {
  const c = courses[slug]
  assert(c.lessons.every((l) => l.primary_standard && byCode.has(l.primary_standard)), `primary-standard-resolves:${slug}`, 'all')
  assert(c.lessons.every((l) => l.standards.includes(l.primary_standard)), `primary-standard-in-unit:${slug}`, 'all')
  const uncovered = []
  for (const u of c.units) {
    const primaries = new Set(c.lessons.filter((l) => l.unit_number === u.unit_number).map((l) => l.primary_standard))
    for (const st of u.standards) if (!primaries.has(st)) uncovered.push(`u${u.unit_number}:${st}`)
  }
  assert(uncovered.length === 0, `every-unit-standard-is-primary-somewhere:${slug}`,
    `${uncovered.length} unit standards never primary${uncovered.length ? ': ' + uncovered.slice(0, 4).join(',') : ''}`)
  assert(new Set(c.lessons.map((l) => l.primary_standard)).size >= 5, `primary-standards-varied:${slug}`,
    `${new Set(c.lessons.map((l) => l.primary_standard)).size} distinct primaries`)
}

// ---------- texts must actually be assigned, not merely catalogued ----------
const TEXT_ANCHORS = [
  ['english-10', 3, '9-10.RI.9', ['ma-hs-ela-t-1005', 'ma-hs-ela-t-1007']],
  ['english-9', 9, '9-10.RL.6', ['ma-hs-ela-t-909']],
  ['english-10', 7, '9-10.RL.7', ['ma-hs-ela-t-1010', 'ma-hs-ela-t-1012']],
  ['english-11', 2, '11-12.RI.9', ['ma-hs-ela-t-1113', 'ma-hs-ela-t-1106']],
  ['english-11', 9, '11-12.RL.7', ['ma-hs-ela-t-1110', 'ma-hs-ela-t-1112']],
  ['english-12', 7, '11-12.RL.7', ['ma-hs-ela-t-1208', 'ma-hs-ela-t-1209']],
  ['english-11', 5, '11-12.RL.9', ['ma-hs-ela-t-1107', 'ma-hs-ela-t-1108']],
]
for (const slug of SLUGS) {
  const c = courses[slug]
  const bank = new Map(c.texts.texts.map((t) => [t.text_id, t]))
  const gated = new Set(c.texts.texts.filter((t) => t.rights === 'rights_required').map((t) => t.text_id))
  const assignable = c.texts.texts.filter((t) => t.rights !== 'rights_required').map((t) => t.text_id)
  const assigned = new Set()
  for (const u of c.units) for (const id of u.assigned_text_ids || []) assigned.add(id)
  assert(c.units.every((u) => (u.assigned_text_ids || []).length >= 2), `units-assign-texts:${slug}`, 'every unit assigns >= 2 texts')
  assert([...assigned].every((id) => bank.has(id)), `assigned-texts-resolve:${slug}`, `${[...assigned].filter((id) => !bank.has(id)).length} unresolved`)
  assert([...assigned].every((id) => !gated.has(id)), `gated-text-never-assigned:${slug}`, `${[...assigned].filter((id) => gated.has(id)).length} gated works assigned`)
  const unreferenced = assignable.filter((id) => !assigned.has(id))
  assert(unreferenced.length === 0, `every-text-is-taught:${slug}`,
    `${assignable.length - unreferenced.length}/${assignable.length} assignable texts assigned${unreferenced.length ? '; orphaned: ' + unreferenced.join(',') : ''}`)
  assert(c.lessons.every((l) => Array.isArray(l.assigned_texts) && l.assigned_texts.length >= 2), `lessons-name-their-texts:${slug}`, 'all 180')
  assert(c.lessons.every((l) => l.assigned_texts.every((t) => t.title && t.author !== undefined && t.rights && t.source)),
    `lesson-texts-carry-citation:${slug}`, 'all')
  assert(c.lessons.every((l) => l.assigned_texts.every((t) => t.accessible_representation)), `lesson-texts-accessible:${slug}`, 'all')
}
for (const [slug, un, code, required] of TEXT_ANCHORS) {
  const u = courses[slug].units.find((x) => x.unit_number === un)
  const has = required.every((id) => (u.assigned_text_ids || []).includes(id))
  assert(u.standards.includes(code) && has, `text-anchor:${slug}-u${un}-${code}`,
    `${code} instantiated by ${required.join(' + ')}`)
}

// ---------- ownership boundary ----------
const laneOnly = existsSync(join(LANE, 'courses')) && existsSync(join(LANE, 'standards'))
assert(laneOnly, 'lane-self-contained', 'all authored artifacts live under the ELA lane')

// ---------- report ----------
const failed = checks.filter((c) => c.result === 'FAIL')
const report = {
  package_id: 'manuel-academy-highschool-9-12-ela',
  validated_on: new Date().toISOString().slice(0, 10),
  overall: failed.length === 0 ? 'PASS' : 'FAIL',
  counts: { checks: checks.length, passed: checks.length - failed.length, failed: failed.length },
  totals: { courses: 4, units: 40, lessons: 720, assessments: 40, standards_in_corpus: corpus.standards.length },
  checks,
}
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  for (const c of checks) if (c.result === 'FAIL') console.log(`FAIL  ${c.check} — ${c.details}`)
  console.log(`\n${report.overall}: ${report.counts.passed}/${report.counts.checks} checks passed`)
  console.log(`courses=4 units=40 lessons=720 assessments=40 standards=${corpus.standards.length}`)
}
process.exit(failed.length === 0 ? 0 : 1)

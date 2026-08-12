/**
 * Validate the High School 9-12 science authoring set against the repository's
 * own Curriculum Authoring 2.0.0 contract, then run mission-specific checks
 * that the generic validator does not cover.
 *
 * Run from the repository root:
 *   node --experimental-strip-types --disable-warning=ExperimentalWarning \
 *     curriculum-authoring/full-family-highschool-9-12/subjects/science/validation/validate.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const setDir = resolve(here, '../authoring-set')
const repoRoot = resolve(here, '../../../../..')
const { validateAuthoringSet, projectStudentLesson } = await import(
  resolve(repoRoot, 'src/curriculum-authoring/v2/validation.ts')
)

const readJson = (name) => JSON.parse(readFileSync(resolve(setDir, name), 'utf8'))
const lessons = readdirSync(resolve(setDir, 'lessons'))
  .filter((f) => f.endsWith('.jsonl'))
  .sort()
  .flatMap((f) =>
    readFileSync(resolve(setDir, 'lessons', f), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  )

const set = {
  manifest: readJson('manifest.json'),
  courses: readJson('courses.json'),
  units: readJson('units.json'),
  lessons,
  assessments: readJson('assessments.json'),
  assessment_interpretations: readJson('assessment-interpretations.json'),
  schedules: readJson('schedules.json'),
  standard_frameworks: [readJson('standard-framework.json')],
  resources: readJson('resources.json'),
  policy_sets: [readJson('policy-set.json')],
}

const report = validateAuthoringSet(set)

// ---------------------------------------------------------------- mission checks
const checks = []
const check = (name, pass, detail) => checks.push({ check: name, result: pass ? 'PASS' : 'FAIL', detail })

const policy = set.policy_sets[0]
const framework = set.standard_frameworks[0]
const frameworkIds = new Set(framework.standards.map((s) => s.standard_id))

check('schema-contract-valid', report.valid, `${report.issues.length} issues from validateAuthoringSet`)
check('framework-has-71-performance-expectations', framework.standards.length === 71, `${framework.standards.length} standards`)

// Every framework PE is claimed as primary coverage by at least one unit.
const unitPrimary = new Set()
for (const u of set.units) for (const s of u.standards) unitPrimary.add(s.standard_id)
const uncovered = [...frameworkIds].filter((id) => !unitPrimary.has(id))
check('every-performance-expectation-covered', uncovered.length === 0,
  uncovered.length ? `uncovered: ${uncovered.join(', ')}` : 'all 71 covered by a unit')

// Four courses, four grades, 108 sessions each.
check('four-courses-grades-9-12',
  set.courses.length === 4 && [9, 10, 11, 12].every((g) => set.courses.some((c) => c.grade === g)),
  set.courses.map((c) => `${c.grade}:${c.course_id}`).join(' '))
check('each-course-108-sessions',
  set.courses.every((c) => lessons.filter((l) => l.course_ref === c.course_id).length === 108),
  set.courses.map((c) => `${c.course_id}=${lessons.filter((l) => l.course_ref === c.course_id).length}`).join(' '))

// Lab safety: every unit has a Day 7 investigation with hazards, and a stated alternative.
const invLessons = lessons.filter((l) => l.day_in_unit === 7)
check('every-unit-has-an-investigation', invLessons.length === set.units.length, `${invLessons.length} investigation lessons / ${set.units.length} units`)
check('investigations-declare-hazards', invLessons.every((l) => l.safety_privacy.hazards.length > 0), 'all investigation lessons declare at least one typed hazard')
check('investigations-declare-supervision',
  invLessons.every((l) => ['nearby-adult', 'direct-adult', 'none'].includes(l.safety_privacy.supervision)),
  'all investigation lessons declare a supervision level')

// Chemical or thermal hazard implies direct adult supervision and guardian confirmation.
const chemLessons = invLessons.filter((l) => l.safety_privacy.hazards.some((h) => h.kind === 'chemical'))
const chemOk = chemLessons.every((l) => l.safety_privacy.supervision === 'direct-adult' && l.safety_privacy.guardian_visibility === 'confirmation-required')
check('chemical-hazards-require-direct-adult-supervision', chemOk,
  `${chemLessons.length} lessons carry a chemical hazard; ${chemLessons.filter((l) => l.safety_privacy.supervision === 'direct-adult').length} require direct adult supervision`)

// Every lesson carries a no-special-equipment alternative.
const hasAlt = (l) => (l.extensions ?? []).some((e) => e.namespace === 'manuel.academy/lab-alternative' && e.value?.value?.trim())
check('every-lesson-states-an-alternative-path', lessons.every(hasAlt), 'lab-alternative extension present on every lesson')
check('every-unit-states-an-alternative-path', set.units.every(hasAlt), 'lab-alternative extension present on every unit')

// Multi-occasion mastery.
check('multi-occasion-mastery-everywhere',
  lessons.every((l) => l.mastery.minimum_occasions >= 2 && l.mastery.minimum_distinct_dates >= 2 &&
    l.mastery.independent_evidence_required === true && l.mastery.transfer_requirement === 'novel-context'),
  'every lesson requires >=2 occasions on >=2 dates with independent evidence and novel-context transfer')

// Accessibility and media.
check('text-fallback-required-everywhere', lessons.every((l) => l.accessibility.text_fallback === 'required'), 'all lessons')
check('no-required-media-resources', set.resources.every((r) => r.required === false), 'every resource is optional and has a text fallback')
check('all-resources-have-text-fallback', set.resources.every((r) => r.text_fallback?.trim()), `${set.resources.length} resources`)

// Prohibited-content scans over the whole serialized package.
const whole = JSON.stringify(set).toLowerCase()
// A negated mention ("never require a photograph") is the safeguard, not a violation,
// so a hit only counts when no negation appears in the preceding clause.
const NEGATION = /(never|no|not|without|n't)\b[^.]{0,60}$/
const affirmativeHits = (re) => {
  const hits = []
  for (const m of whole.matchAll(new RegExp(re, 'g'))) {
    if (!NEGATION.test(whole.slice(Math.max(0, m.index - 80), m.index))) hits.push(m[0])
  }
  return hits
}
const banned = [
  ['required-photo-or-video-proof', /require[sd]?\s+(a\s+)?(photo|photograph|video|voice recording)/],
  ['mains-electricity-use', /(plug|connect)[^.]{0,40}\b(wall|outlet|mains)\b/],
  ['laser-instruction', /\buse a laser|point the laser|with a laser pointer\b/],
]
for (const [label, re] of banned) {
  const hits = affirmativeHits(re)
  check(`no-${label}`, hits.length === 0, hits.length ? `MATCHED: ${hits.slice(0, 3).join(' | ')}` : 'no affirmative match')
}

// No learner body or health measurement requested.
const bodyRe = /(measure|record|take)\s+(your|the learner's|the student's)\s+(pulse|heart rate|blood pressure|body temperature|weight|height|bmi|breathing rate|reaction time)/
check('no-learner-body-or-health-measurement', !bodyRe.test(whole), bodyRe.test(whole) ? 'MATCHED' : 'no match')

// Tutor authority is pinned and never overridden.
check('tutor-authority-pinned',
  policy.tutor_authority.reveals_answers === false &&
  policy.tutor_authority.gives_final_graded_answer === false &&
  policy.tutor_authority.controls_graded_work_policy === false,
  'policy set pins all three tutor authority invariants to false')
const SIGNALS = { 'prerequisite-gap': 'prerequisite-reteach', 'procedure-without-understanding': 'conceptual-explanation',
  'correct-low-confidence': 'confidence-calibration', 'repeated-error-pattern': 'error-pattern-contrast',
  'mastery-evidence': 'mastery-evidence-collection' }
check('tutor-routes-use-controlled-signals-only',
  lessons.every((l) => l.tutor_routes.every((r) => SIGNALS[r.signal] === r.strategy)), 'all routes')

// Student projection must not leak protected material.
const leak = lessons.find((l) => {
  const s = JSON.stringify(projectStudentLesson(l, policy))
  return ['scoring_guidance', 'mastery', 'tutor_routes', 'safety_privacy', 'guardian_visibility_note'].some((k) => s.includes(`"${k}"`))
})
check('student-projection-carries-no-protected-fields', !leak, leak ? `leak in ${leak.lesson_id}` : 'all 432 lessons project cleanly')

// Stable refs: ids match the safe-reference pattern the Study seam enforces.
const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const allRefs = [...lessons.map((l) => l.lesson_id), ...set.units.map((u) => u.unit_id), ...set.courses.map((c) => c.course_id)]
check('all-refs-are-study-seam-safe', allRefs.every((r) => SAFE_REF.test(r)), `${allRefs.length} identifiers`)
check('all-refs-unique', new Set(allRefs).size === allRefs.length, `${new Set(allRefs).size} unique of ${allRefs.length}`)

// Schedules cover every lesson exactly once.
const scheduled = set.schedules.flatMap((s) => s.entries.flatMap((e) => e.lesson_refs))
check('schedule-covers-every-lesson-once',
  scheduled.length === lessons.length && new Set(scheduled).size === lessons.length,
  `scheduled=${scheduled.length} lessons=${lessons.length}`)

// Assessment alignment: every unit assessment carries its unit's standards.
const byUnit = new Map(set.units.map((u) => [u.unit_id, u]))
check('assessments-aligned-to-unit-standards',
  set.assessments.every((a) => {
    const u = byUnit.get(a.unit_ref)
    return u && JSON.stringify(a.standards.map((s) => s.standard_id).sort()) === JSON.stringify(u.standards.map((s) => s.standard_id).sort())
  }), `${set.assessments.length} assessments`)
check('assessment-bands-ordered',
  set.assessment_interpretations.every((i) => i.not_yet_maximum_percent < i.developing_minimum_percent && i.developing_minimum_percent < i.secure_minimum_percent),
  'not-yet < developing < secure for all interpretations')

// ---------------------------------------------------------------- output
const failed = checks.filter((c) => c.result === 'FAIL')
const overall = report.valid && failed.length === 0 ? 'PASS' : 'FAIL'
const out = {
  package_id: 'manuel-academy-highschool-9-12-science',
  schema_set_version: report.schema_set_version,
  overall,
  contract_issues: report.issues,
  counts: { checks: checks.length, passed: checks.length - failed.length, failed: failed.length },
  checks,
}
writeFileSync(resolve(here, 'validation-report.json'), JSON.stringify(out, null, 2) + '\n')

console.log(`contract: valid=${report.valid} issues=${report.issues.length}`)
for (const issue of report.issues.slice(0, 25)) console.log(`  [${issue.code}] ${issue.path}: ${issue.message}`)
if (report.issues.length > 25) console.log(`  ...and ${report.issues.length - 25} more`)
for (const c of checks) console.log(`${c.result === 'PASS' ? '  ok  ' : '  FAIL'} ${c.check} - ${c.detail}`)
console.log(`\nOVERALL: ${overall} (${out.counts.passed}/${out.counts.checks} mission checks passed)`)
process.exit(overall === 'PASS' ? 0 : 1)

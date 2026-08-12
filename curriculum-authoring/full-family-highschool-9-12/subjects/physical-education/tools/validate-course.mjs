#!/usr/bin/env node
// Validator for the Grades 9-12 Physical Education authoring release.
// Implements the nine gates named in ../validation-contract.md.
//
// Usage: node validate-course.mjs [buildDir]   (defaults to ../build)
// Exits 1 if any gate fails.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_BUILD = path.join(path.dirname(TOOLS_DIR), 'build')

export const EXPECTED_GRADES = [9, 10, 11, 12]
export const EXPECTED_DAYS = 108
export const EXPECTED_UNITS = 9
export const EXPECTED_LEVELS = { 9: 1, 10: 1, 11: 2, 12: 2 }
export const LESSON_ID_PATTERN = /^ma-g(9|10|11|12)-physical-education-u[0-9]{2}-l[0-9]{2}$/

// Fields describing work the learner is required to do. The participation floor
// lives in safety_and_privacy / accessibility_and_accommodations and is
// deliberately NOT scanned: those fields state prohibitions and would otherwise
// be flagged for containing the term they forbid.
const LESSON_REQUIREMENT_FIELDS = (l) => [
  l.title,
  l.focus,
  ...l.learning_objectives,
  ...l.success_criteria,
  ...l.materials,
  ...l.lesson_flow.map((s) => s.teacher_or_tutor_action),
  l.student_activity,
  l.formative_check,
  l.extension,
  l.home_connection,
]

const UNIT_REQUIREMENT_FIELDS = (u) => [u.title, ...u.topics, u.performance_task, ...u.materials]

// "bodyweight" (one word) is an exercise modality, not a measurement, and a bare
// "weight" appears legitimately as a Laban movement quality — both are excluded
// on purpose, so the patterns below target measurement and scoring language.
const BODY_METRIC_PATTERNS = [
  /\bBMI\b/i,
  /body[\s-]?fat/i,
  /body[\s-]?composition/i,
  /body[\s-]?(size|measurement)/i,
  /\bweigh[\s-]?in/i,
  /\bweight (loss|gain|goal|target|change)/i,
  // Bare "weight" is deliberately absent: it is a Laban movement quality
  // ("space, time, weight, and flow") and "bodyweight practice" is ordinary
  // strength terminology. A *learner's* weight is never either of those.
  /\b(your|their|his|her|the learner's)\s+(body\s+)?weight\b/i,
  /\bbody weight\b/i,
  /\bcalorie/i,
  /\bdiet(s|ing|ary)?\b/i,
  /\bskinfold|\bwaist\b|\bgirth\b/i,
  /\bpercentile\b/i,
  /\bnorm table/i,
  /\bfitness test\b/i,
  /\bbeep test|\bpacer test|\bbody scan/i,
]

const MEDIA_PATTERNS = [/\bphotograph/i, /\bphoto\b/i, /\bvideo\b/i, /\bfilm(ed|ing)?\b/i, /\bvoice recording/i, /\brecord(ing)? (yourself|the learner)/i, /\bselfie\b/i, /\bwebcam\b/i]

const PUBLIC_PERFORMANCE_PATTERNS = [/\baudience\b/i, /\bspectators?\b/i, /\bin front of (a|the) (class|group|crowd)/i, /\bpublicly perform/i, /\bcompete against\b/i]

const NEGATORS = /\b(no|not|never|without|avoid|prohibit|forbid|excluded?|instead of|rather than|does not|do not|don't|is not|are not|optional|may decline)\b/i

// A negated sentence is normally a guard ("Body weight is never scored"), so a
// pattern hit inside one is suppressed. That heuristic has one hole: a genuine
// instruction can carry a negator in an unrelated clause — "Record your weight
// with no shoes on" would read as a guard and pass. DEMAND_FRAME closes it. A
// sentence that instructs the learner to supply, log, or submit something is a
// requirement whatever else it contains, so a pattern hit inside one is always
// reported and the negator suppression does not apply.
const DEMAND_FRAME = /\b(record|log|enter|submit|upload|report|measure|weigh|photograph|film|track|write down|fill in|input|provide|share|state)\s+(your|your own|their|the learner's)\b/i

const sentences = (text) => String(text).split(/(?<=[.;:!?])\s+|\s+—\s+/).filter(Boolean)

function scan(fields, patterns, source) {
  const findings = []
  for (const field of fields) {
    if (!field) continue
    for (const sentence of sentences(field)) {
      for (const pattern of patterns) {
        if (pattern.test(sentence) && (DEMAND_FRAME.test(sentence) || !NEGATORS.test(sentence))) findings.push({ source, pattern: String(pattern), text: sentence.trim() })
      }
    }
  }
  return findings
}

export async function loadBuild(buildDir = DEFAULT_BUILD) {
  const index = JSON.parse(await readFile(path.join(buildDir, 'course-index.json'), 'utf8'))
  const courses = []
  for (const entry of index) {
    const dir = path.join(buildDir, entry.path)
    const units = JSON.parse(await readFile(path.join(dir, 'units.json'), 'utf8'))
    const assessments = JSON.parse(await readFile(path.join(dir, 'assessments.json'), 'utf8'))
    const lessons = (await readFile(path.join(dir, 'lessons.jsonl'), 'utf8')).split('\n').filter(Boolean).map((line) => JSON.parse(line))
    courses.push({ ...entry, units, lessons, assessments })
  }
  return { index, courses }
}

const ok = (name, detail) => ({ name, pass: true, detail, findings: [] })
const fail = (name, detail, findings = []) => ({ name, pass: false, detail, findings })

// Gate 1 — 9→10→11→12 progression across the two Michigan PE levels.
export function checkProgression({ courses }) {
  const grades = courses.map((c) => c.grade).sort((a, b) => a - b)
  if (String(grades) !== String(EXPECTED_GRADES)) return fail('grade-progression', `expected grades ${EXPECTED_GRADES} got ${grades}`)
  const findings = []
  for (const c of courses) {
    if (c.units.length !== EXPECTED_UNITS) findings.push({ source: c.course_id, text: `${c.units.length} units, expected ${EXPECTED_UNITS}` })
    if (c.lessons.length !== EXPECTED_DAYS) findings.push({ source: c.course_id, text: `${c.lessons.length} lessons, expected ${EXPECTED_DAYS}` })
    if (c.pe_level !== EXPECTED_LEVELS[c.grade]) findings.push({ source: c.course_id, text: `grade ${c.grade} should be LEVEL ${EXPECTED_LEVELS[c.grade]}, got ${c.pe_level}` })
    for (const l of c.lessons) if (l.pe_level !== EXPECTED_LEVELS[c.grade]) findings.push({ source: l.lesson_id, text: 'lesson pe_level does not match its course' })
  }
  const titles = new Map()
  for (const c of courses) {
    for (const u of c.units) {
      if (titles.has(u.title)) findings.push({ source: u.unit_id, text: `unit title repeats ${titles.get(u.title)}: "${u.title}"` })
      titles.set(u.title, u.unit_id)
    }
  }
  return findings.length ? fail('grade-progression', 'progression defects', findings) : ok('grade-progression', `grades 9→10→11→12, LEVEL 1 in 9-10 and LEVEL 2 in 11-12, ${EXPECTED_UNITS} distinct units and ${EXPECTED_DAYS} days each`)
}

// Gate 2 — privacy guard: nothing surveils the learner or their household.
export function checkPrivacyGuard({ courses }) {
  const findings = []
  const surveillance = [/\bmedical history\b/i, /\byour diagnosis\b/i, /\bhousehold income\b/i, /\bfamily income\b/i, /\bprecise location\b/i, /\blive tracking\b/i, /\bwearable\b/i, /\bheart[- ]rate export/i, /\bstep count\b/i, /\bsleep log\b/i]
  for (const c of courses) {
    for (const u of c.units) findings.push(...scan(UNIT_REQUIREMENT_FIELDS(u), surveillance, u.unit_id))
    for (const l of c.lessons) {
      findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), surveillance, l.lesson_id))
      const visibility = l.parent_or_guardian_visibility ?? ''
      if (!/do not expose body data/i.test(visibility)) findings.push({ source: l.lesson_id, text: 'guardian visibility does not exclude body data' })
    }
    for (const a of c.assessments) findings.push(...scan(a.prompts.map((p) => p.prompt), surveillance, a.assessment_id))
  }
  return findings.length ? fail('privacy-guard', 'privacy defects', findings) : ok('privacy-guard', 'no task collects body data, wearable data, location, or household information; guardian views show learning metadata only')
}

// Gate 3 — PE inclusive path.
export function checkInclusivePath({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) {
      if (!u.inclusive_adaptation) findings.push({ source: u.unit_id, text: 'unit has no inclusive_adaptation' })
      if (!u.inclusion_guard) findings.push({ source: u.unit_id, text: 'unit has no inclusion_guard' })
    }
    for (const l of c.lessons) {
      if (!l.inclusive_adaptation) findings.push({ source: l.lesson_id, text: 'lesson has no inclusive_adaptation' })
      if (l.accessibility_and_accommodations.length < 5) findings.push({ source: l.lesson_id, text: 'fewer than 5 accessibility entries' })
      const access = l.accessibility_and_accommodations.join(' ')
      if (!/seated/i.test(access)) findings.push({ source: l.lesson_id, text: 'no seated route offered' })
      if (!/solo/i.test(access)) findings.push({ source: l.lesson_id, text: 'no solo route offered' })
      const routes = l.adaptive_tutor_routes.map((r) => r.signal)
      if (!routes.includes('learner declines a task')) findings.push({ source: l.lesson_id, text: 'no tutor route for a declined task' })
      if (!routes.includes('pain, dizziness, breathlessness, or head impact')) findings.push({ source: l.lesson_id, text: 'no stop-rule tutor route' })
    }
    for (const a of c.assessments) {
      if (!/full credit/i.test(a.accommodation_note ?? '')) findings.push({ source: a.assessment_id, text: 'assessment does not state that an adapted performance is full credit' })
    }
  }
  return findings.length ? fail('pe-inclusive-path', 'inclusive path defects', findings) : ok('pe-inclusive-path', 'every unit and lesson carries a seated, solo, adapted route, a decline route, and a stop rule; adapted performance is full credit')
}

// Gate 4 — no body metrics and no body scoring.
export function checkNoBodyMetrics({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) findings.push(...scan(UNIT_REQUIREMENT_FIELDS(u), BODY_METRIC_PATTERNS, u.unit_id))
    for (const l of c.lessons) {
      findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), BODY_METRIC_PATTERNS, l.lesson_id))
      if (!/never score body size|never body size|body size/i.test(l.answer_or_scoring_guidance)) {
        findings.push({ source: l.lesson_id, text: 'scoring guidance does not exclude body size' })
      }
    }
    for (const a of c.assessments) {
      findings.push(...scan(a.prompts.map((p) => p.prompt), BODY_METRIC_PATTERNS, a.assessment_id))
      if (!/never adjust a score for body size/i.test(a.mastery_interpretation?.rule ?? '')) {
        findings.push({ source: a.assessment_id, text: 'mastery rule does not forbid adjusting a score for body size' })
      }
    }
  }
  return findings.length ? fail('no-body-metrics', 'body-metric or body-scoring requirements found', findings) : ok('no-body-metrics', 'no required task or assessment uses a body metric, fitness-test norm, or body-based score')
}

// Gate 5 — no-media route.
export function checkNoMediaRoute({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const l of c.lessons) {
      if (l.media?.required !== false) findings.push({ source: l.lesson_id, text: 'media.required is not false' })
      if (!l.media?.fallback) findings.push({ source: l.lesson_id, text: 'media has no fallback' })
      findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), MEDIA_PATTERNS, l.lesson_id))
    }
    for (const u of c.units) findings.push(...scan(UNIT_REQUIREMENT_FIELDS(u), MEDIA_PATTERNS, u.unit_id))
    for (const a of c.assessments) findings.push(...scan(a.prompts.map((p) => p.prompt), MEDIA_PATTERNS, a.assessment_id))
  }
  return findings.length ? fail('no-media-route', 'media requirements found', findings) : ok('no-media-route', 'no task requires camera proof; every lesson completes through described, written, or demonstrated-to-one-adult evidence')
}

// Gate 5b, folded into the media gate's contract line: no public performance.
export function checkNoPublicPerformance({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) findings.push(...scan([u.performance_task, ...u.topics], PUBLIC_PERFORMANCE_PATTERNS, u.unit_id))
    for (const l of c.lessons) findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), PUBLIC_PERFORMANCE_PATTERNS, l.lesson_id))
  }
  return findings.length ? fail('no-public-performance', 'public performance requirements found', findings) : ok('no-public-performance', 'no task requires performing for an audience, a group, or spectators')
}

// Gate 6 — guardian safety.
export function checkGuardianSafety({ courses }) {
  const required = ['equipment', 'environment', 'movement_hazards', 'supervision_note', 'guardian_confirmation_required']
  const findings = []
  const check = (id, g) => {
    if (!g) return findings.push({ source: id, text: 'no guardian_safety block' })
    for (const key of required) if (g[key] === undefined || g[key] === null || g[key] === '') findings.push({ source: id, text: `guardian_safety.${key} missing` })
  }
  for (const c of courses) {
    for (const u of c.units) {
      check(u.unit_id, u.guardian_safety)
      // Any unit whose hazards are more than "none" must be guardian-confirmed.
      const hazards = u.guardian_safety?.movement_hazards ?? ''
      const trivial = /^none/i.test(hazards)
      if (!trivial && u.guardian_safety?.guardian_confirmation_required !== true) {
        findings.push({ source: u.unit_id, text: `unit declares movement hazards but does not require guardian confirmation` })
      }
    }
    for (const l of c.lessons) check(l.lesson_id, l.guardian_safety)
  }
  return findings.length ? fail('guardian-safety', 'guardian safety defects', findings) : ok('guardian-safety', 'every unit and lesson carries a complete guardian safety block, and every unit with movement hazards requires guardian confirmation')
}

// Gate 7 — standards mapping.
export function checkStandardsMapping({ courses }) {
  const findings = []
  const counts = { canonical: 0, unverified: 0, 'human-review': 0 }
  const tally = (id, entries, standards) => {
    if (!standards?.length) findings.push({ source: id, text: 'no standards entries' })
    if (!entries?.length) return findings.push({ source: id, text: 'no standards_mapping entries' })
    for (const e of entries) {
      if (!(e.mapping_status in counts)) findings.push({ source: id, text: `invalid mapping_status "${e.mapping_status}"` })
      else counts[e.mapping_status] += 1
      if (!e.framework) findings.push({ source: id, text: 'standards_mapping entry has no framework' })
      if (!e.level) findings.push({ source: id, text: 'standards_mapping entry does not name a Michigan PE LEVEL' })
    }
  }
  for (const c of courses) {
    for (const u of c.units) tally(u.unit_id, u.standards_mapping, u.standards)
    for (const l of c.lessons) tally(l.lesson_id, l.standards_mapping, l.standards)
  }
  const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')
  return findings.length ? fail('standards-mapping', `mapping defects (${summary})`, findings) : ok('standards-mapping', `every unit and lesson declares a mapping_status and a LEVEL — ${summary}`)
}

// Gate 8 — Study compatibility.
export function checkStudyCompatibility({ courses }) {
  const required = ['schema_version', 'lesson_id', 'course_id', 'grade', 'subject', 'course_day', 'unit_number', 'title', 'phase', 'focus', 'standards', 'learning_objectives', 'lesson_flow', 'formative_check', 'mastery_rule', 'accessibility_and_accommodations', 'safety_and_privacy']
  const findings = []
  const seen = new Set()
  for (const c of courses) {
    const days = new Set()
    for (const l of c.lessons) {
      for (const key of required) if (l[key] === undefined) findings.push({ source: l.lesson_id, text: `missing required field ${key}` })
      if (l.schema_version !== '1.0') findings.push({ source: l.lesson_id, text: 'schema_version is not "1.0"' })
      if (!LESSON_ID_PATTERN.test(l.lesson_id)) findings.push({ source: l.lesson_id, text: 'lesson_id does not match the grade 9-12 PE pattern' })
      if (seen.has(l.lesson_id)) findings.push({ source: l.lesson_id, text: 'duplicate lesson_id' })
      seen.add(l.lesson_id)
      if (l.subject !== 'physical-education') findings.push({ source: l.lesson_id, text: `subject is "${l.subject}"` })
      if (l.grade !== c.grade) findings.push({ source: l.lesson_id, text: 'grade does not match its course' })
      if (l.learning_objectives.length < 3) findings.push({ source: l.lesson_id, text: 'fewer than 3 learning objectives' })
      if (l.lesson_flow.length < 5) findings.push({ source: l.lesson_id, text: 'fewer than 5 lesson_flow segments' })
      if (l.safety_and_privacy.length < 2) findings.push({ source: l.lesson_id, text: 'fewer than 2 safety_and_privacy entries' })
      if (days.has(l.course_day)) findings.push({ source: l.lesson_id, text: `course_day ${l.course_day} used twice` })
      days.add(l.course_day)
    }
    for (let d = 1; d <= EXPECTED_DAYS; d += 1) if (!days.has(d)) findings.push({ source: c.course_id, text: `course_day ${d} has no lesson` })
    const referenced = c.units.flatMap((u) => u.lesson_ids)
    if (new Set(referenced).size !== referenced.length) findings.push({ source: c.course_id, text: 'a lesson id is referenced by more than one unit' })
    for (const id of referenced) if (!c.lessons.some((l) => l.lesson_id === id)) findings.push({ source: c.course_id, text: `unit references missing lesson ${id}` })
    for (const l of c.lessons) if (!referenced.includes(l.lesson_id)) findings.push({ source: l.lesson_id, text: 'lesson is not referenced by any unit' })
  }
  return findings.length ? fail('study-compatibility', 'schema/sequence defects', findings) : ok('study-compatibility', `${seen.size} lessons match the canonical lesson contract and each course day resolves to exactly one lesson`)
}

// Gate 9 — multi-occasion evidence.
export function checkMultiOccasionEvidence({ courses }) {
  const findings = []
  const multi = /(two|multiple|later|second|different) (occasions?|session|day|setting|representation)|at least two/i
  for (const c of courses) {
    for (const l of c.lessons) {
      if (!multi.test(l.mastery_rule)) findings.push({ source: l.lesson_id, text: 'mastery_rule does not require evidence on more than one occasion' })
      if (!l.adaptive_tutor_routes.some((r) => r.signal === 'mastery evidence' && multi.test(r.action))) {
        findings.push({ source: l.lesson_id, text: 'mastery-evidence tutor route does not require a later occasion' })
      }
    }
    for (const a of c.assessments) {
      if (!/not the sole basis/i.test(a.mastery_interpretation?.rule ?? '')) findings.push({ source: a.assessment_id, text: 'assessment does not state that one score is not the sole basis for mastery' })
    }
  }
  return findings.length ? fail('multi-occasion-evidence', 'single-occasion mastery found', findings) : ok('multi-occasion-evidence', 'every lesson and assessment requires evidence across more than one occasion or setting')
}

// Gate 11 — a lesson must be distinct work, not a relabelled earlier lesson.
// A 12-day unit carrying six topics regenerates each topic on a second pass; if
// the second pass copies the first, half the course is filler that still counts
// as instructional days and still claims a separate mastery occasion. Identity
// is judged on what the learner actually does, so the fields that only label a
// lesson (id, title, phase, day) are excluded from the comparison.
export function checkDistinctLessons({ courses }) {
  const LABEL_ONLY = new Set(['lesson_id', 'title', 'phase', 'course_day', 'day_in_unit', 'cycle'])
  const findings = []
  for (const c of courses) {
    const seen = new Map()
    for (const l of c.lessons) {
      const body = {}
      for (const [k, v] of Object.entries(l)) if (!LABEL_ONLY.has(k)) body[k] = v
      const key = JSON.stringify(body, Object.keys(body).sort())
      if (seen.has(key)) findings.push({ source: l.lesson_id, text: `is identical to ${seen.get(key)} apart from its label fields` })
      else seen.set(key, l.lesson_id)
    }
  }
  return findings.length
    ? fail('distinct-lessons', 'duplicate lesson bodies found', findings)
    : ok('distinct-lessons', 'every lesson differs from every other in what the learner is asked to do')
}

export const GATES = [
  checkProgression,
  checkPrivacyGuard,
  checkInclusivePath,
  checkNoBodyMetrics,
  checkNoMediaRoute,
  checkNoPublicPerformance,
  checkGuardianSafety,
  checkStandardsMapping,
  checkStudyCompatibility,
  checkMultiOccasionEvidence,
  checkDistinctLessons,
]

export function runValidation(build) {
  return GATES.map((gate) => gate(build))
}

async function main() {
  const buildDir = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_BUILD
  const build = await loadBuild(buildDir)
  const results = runValidation(build)
  console.log(`Grades 9-12 Physical Education — validation report (${buildDir})\n`)
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name.padEnd(24)} ${r.detail}`)
    for (const f of r.findings.slice(0, 12)) console.log(`        · ${f.source}: ${f.text}`)
    if (r.findings.length > 12) console.log(`        · … ${r.findings.length - 12} more`)
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} gates passed.`)
  if (failed.length) process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) await main()

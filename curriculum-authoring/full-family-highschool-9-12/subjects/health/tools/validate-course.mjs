#!/usr/bin/env node
// Validator for the Grades 9-12 Health authoring release.
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
export const EXPECTED_DAYS = 36
export const EXPECTED_UNITS = 6
export const LESSON_ID_PATTERN = /^ma-g(9|10|11|12)-health-u[0-9]{2}-l[0-9]{2}$/

// Fields that describe work the learner is actually required to do. The privacy
// and inclusion guards live in safety_and_privacy / accessibility_and_
// accommodations and are deliberately NOT scanned: those fields exist to state
// prohibitions, and scanning them would flag the guard for containing the word
// it forbids.
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
]

const MEDIA_PATTERNS = [/\bphotograph/i, /\bphoto\b/i, /\bvideo\b/i, /\bfilm(ed|ing)?\b/i, /\bvoice recording/i, /\brecord(ing)? (yourself|the learner)/i, /\bselfie\b/i, /\bwebcam\b/i]

const PRIVATE_DISCLOSURE_PATTERNS = [
  /\bmedical history\b/i,
  /\byour diagnosis\b/i,
  /\bdiagnose (yourself|the learner|your)/i,
  /\bsexual history\b/i,
  /\byour (own )?(symptoms|medication|prescription)/i,
  /\bfamily income\b/i,
  /\bimmigration status\b/i,
]

// A sentence that names a prohibited thing in order to forbid it is not a
// violation. This is a heuristic; ../validation-contract.md states that human
// review is still required.
const NEGATORS = /\b(no|not|never|without|avoid|prohibit|forbid|excluded?|instead of|rather than|does not|do not|don't|is not|are not)\b/i

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
        if (pattern.test(sentence) && (DEMAND_FRAME.test(sentence) || !NEGATORS.test(sentence))) {
          findings.push({ source, pattern: String(pattern), text: sentence.trim() })
        }
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
    const lessons = (await readFile(path.join(dir, 'lessons.jsonl'), 'utf8'))
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    courses.push({ ...entry, units, lessons, assessments })
  }
  const modules = JSON.parse(await readFile(path.join(buildDir, 'optional-modules', 'sex-education.json'), 'utf8'))
  return { index, courses, modules }
}

const ok = (name, detail) => ({ name, pass: true, detail, findings: [] })
const fail = (name, detail, findings = []) => ({ name, pass: false, detail, findings })

// Gate 1 — 9→10→11→12 progression.
export function checkProgression({ courses }) {
  const grades = courses.map((c) => c.grade).sort((a, b) => a - b)
  if (String(grades) !== String(EXPECTED_GRADES)) return fail('grade-progression', `expected grades ${EXPECTED_GRADES} got ${grades}`)
  const findings = []
  for (const c of courses) {
    if (c.units.length !== EXPECTED_UNITS) findings.push({ source: c.course_id, text: `${c.units.length} units, expected ${EXPECTED_UNITS}` })
    if (c.lessons.length !== EXPECTED_DAYS) findings.push({ source: c.course_id, text: `${c.lessons.length} lessons, expected ${EXPECTED_DAYS}` })
  }
  // Each grade must be distinct work, not a relabelled copy of the year below.
  const titles = new Map()
  for (const c of courses) {
    for (const u of c.units) {
      if (titles.has(u.title)) findings.push({ source: u.unit_id, text: `unit title repeats ${titles.get(u.title)}: "${u.title}"` })
      titles.set(u.title, u.unit_id)
    }
  }
  return findings.length ? fail('grade-progression', 'progression defects', findings) : ok('grade-progression', `grades ${grades.join('→')}, ${EXPECTED_UNITS} distinct units and ${EXPECTED_DAYS} days each`)
}

// Gate 2 — health privacy guard.
export function checkPrivacyGuard({ courses, modules }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) {
      findings.push(...scan(UNIT_REQUIREMENT_FIELDS(u), PRIVATE_DISCLOSURE_PATTERNS, u.unit_id))
      if (!u.privacy_guard) findings.push({ source: u.unit_id, text: 'unit has no privacy_guard statement' })
    }
    for (const l of c.lessons) {
      findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), PRIVATE_DISCLOSURE_PATTERNS, l.lesson_id))
      const guards = l.safety_and_privacy.join(' ')
      if (!/does not diagnose/i.test(guards)) findings.push({ source: l.lesson_id, text: 'safety_and_privacy does not carry the no-diagnosis statement' })
      if (!/sexual history/i.test(guards)) findings.push({ source: l.lesson_id, text: 'safety_and_privacy does not carry the no-sexual-history statement' })
    }
    for (const a of c.assessments) {
      findings.push(...scan(a.prompts.map((p) => p.prompt), PRIVATE_DISCLOSURE_PATTERNS, a.assessment_id))
    }
  }
  // Sex education must never be scheduled without explicit guardian activation.
  for (const m of modules) {
    if (!m.guardian_activation_required) findings.push({ source: m.module_id, text: 'sex-education module is not guardian-activation gated' })
    if (m.scheduled_by_default !== false) findings.push({ source: m.module_id, text: 'sex-education module is scheduled by default' })
    if (m.counts_toward_course_days !== false) findings.push({ source: m.module_id, text: 'sex-education module counts toward course days' })
    if (m.required_for_completion_or_credit !== false) findings.push({ source: m.module_id, text: 'sex-education module is required for completion or credit' })
  }
  return findings.length ? fail('health-privacy-guard', 'privacy guard defects', findings) : ok('health-privacy-guard', 'no required task requests private disclosure; sex education is guardian-gated and out of every course sequence')
}

// Gate 3 — inclusive path (health: every unit reaches the standard another way).
export function checkInclusivePath({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) {
      if (!u.inclusive_adaptation) findings.push({ source: u.unit_id, text: 'unit has no inclusive_adaptation' })
    }
    for (const l of c.lessons) {
      if (l.accessibility_and_accommodations.length < 5) findings.push({ source: l.lesson_id, text: 'fewer than 5 accessibility entries' })
      const routes = l.adaptive_tutor_routes.map((r) => r.signal)
      if (!routes.includes('learner discloses something private')) findings.push({ source: l.lesson_id, text: 'no tutor route for a private disclosure' })
    }
  }
  return findings.length ? fail('inclusive-path', 'inclusive path defects', findings) : ok('inclusive-path', 'every unit carries an adaptation and every lesson carries ≥5 accessibility entries and a disclosure route')
}

// Gate 4 — no body metrics.
export function checkNoBodyMetrics({ courses }) {
  const findings = []
  for (const c of courses) {
    for (const u of c.units) findings.push(...scan(UNIT_REQUIREMENT_FIELDS(u), BODY_METRIC_PATTERNS, u.unit_id))
    for (const l of c.lessons) findings.push(...scan(LESSON_REQUIREMENT_FIELDS(l), BODY_METRIC_PATTERNS, l.lesson_id))
    for (const a of c.assessments) findings.push(...scan(a.prompts.map((p) => p.prompt), BODY_METRIC_PATTERNS, a.assessment_id))
  }
  return findings.length ? fail('no-body-metrics', 'body-metric requirements found', findings) : ok('no-body-metrics', 'no required task, topic, or assessment prompt asks for a body metric')
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
  return findings.length ? fail('no-media-route', 'media requirements found', findings) : ok('no-media-route', 'every lesson completes without media and no task requires a photograph, video, or recording')
}

// Gate 6 — guardian safety.
export function checkGuardianSafety({ courses, modules }) {
  const required = ['equipment', 'environment', 'movement_hazards', 'sensitive_content_note', 'guardian_confirmation_required']
  const findings = []
  const check = (id, g) => {
    if (!g) return findings.push({ source: id, text: 'no guardian_safety block' })
    for (const key of required) {
      if (g[key] === undefined || g[key] === null || g[key] === '') findings.push({ source: id, text: `guardian_safety.${key} missing` })
    }
  }
  for (const c of courses) {
    for (const u of c.units) check(u.unit_id, u.guardian_safety)
    for (const l of c.lessons) check(l.lesson_id, l.guardian_safety)
  }
  for (const m of modules) {
    check(m.module_id, m.guardian_safety)
    if (m.guardian_safety?.guardian_confirmation_required !== true) findings.push({ source: m.module_id, text: 'optional module does not require guardian confirmation' })
  }
  // Every unit carrying content Michigan law regulates must require confirmation.
  for (const c of courses) {
    for (const u of c.units) {
      if (u.required_by_michigan_law && u.guardian_safety?.guardian_confirmation_required !== true) {
        findings.push({ source: u.unit_id, text: 'unit carries content required by Michigan law but does not require guardian confirmation' })
      }
    }
  }
  return findings.length ? fail('guardian-safety', 'guardian safety defects', findings) : ok('guardian-safety', 'every unit, lesson, and optional module carries a complete guardian safety block')
}

// Gate 7 — standards mapping.
export function checkStandardsMapping({ courses, modules }) {
  const findings = []
  const counts = { canonical: 0, unverified: 0, 'human-review': 0 }
  const tally = (id, entries, standards) => {
    if (!standards?.length) findings.push({ source: id, text: 'no standards entries' })
    if (!entries?.length) return findings.push({ source: id, text: 'no standards_mapping entries' })
    for (const e of entries) {
      if (!(e.mapping_status in counts)) findings.push({ source: id, text: `invalid mapping_status "${e.mapping_status}"` })
      else counts[e.mapping_status] += 1
      if (!e.framework) findings.push({ source: id, text: 'standards_mapping entry has no framework' })
    }
  }
  for (const c of courses) {
    for (const u of c.units) tally(u.unit_id, u.standards_mapping, u.standards)
    for (const l of c.lessons) tally(l.lesson_id, l.standards_mapping, l.standards)
  }
  for (const m of modules) tally(m.module_id, m.standards_mapping, m.standards)
  const summary = Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')
  return findings.length ? fail('standards-mapping', `mapping defects (${summary})`, findings) : ok('standards-mapping', `every unit and lesson declares a mapping_status — ${summary}`)
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
      if (!LESSON_ID_PATTERN.test(l.lesson_id)) findings.push({ source: l.lesson_id, text: 'lesson_id does not match the grade 9-12 health pattern' })
      if (seen.has(l.lesson_id)) findings.push({ source: l.lesson_id, text: 'duplicate lesson_id' })
      seen.add(l.lesson_id)
      if (l.subject !== 'health') findings.push({ source: l.lesson_id, text: `subject is "${l.subject}"` })
      if (l.grade !== c.grade) findings.push({ source: l.lesson_id, text: 'grade does not match its course' })
      if (l.learning_objectives.length < 3) findings.push({ source: l.lesson_id, text: 'fewer than 3 learning objectives' })
      if (l.lesson_flow.length < 5) findings.push({ source: l.lesson_id, text: 'fewer than 5 lesson_flow segments' })
      if (l.safety_and_privacy.length < 2) findings.push({ source: l.lesson_id, text: 'fewer than 2 safety_and_privacy entries' })
      if (days.has(l.course_day)) findings.push({ source: l.lesson_id, text: `course_day ${l.course_day} used twice` })
      days.add(l.course_day)
    }
    for (let d = 1; d <= EXPECTED_DAYS; d += 1) if (!days.has(d)) findings.push({ source: c.course_id, text: `course_day ${d} has no lesson` })
    // Every lesson is referenced by exactly one unit, and every referenced id exists.
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
  return findings.length ? fail('multi-occasion-evidence', 'single-occasion mastery found', findings) : ok('multi-occasion-evidence', 'every lesson and assessment requires evidence across more than one occasion')
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
  console.log(`Grades 9-12 Health — validation report (${buildDir})\n`)
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

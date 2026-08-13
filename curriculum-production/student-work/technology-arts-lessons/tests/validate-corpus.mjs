#!/usr/bin/env node
/**
 * Independent structural + policy validator for the lesson corpus. Deliberately
 * does NOT reuse the generator's own helpers — it re-derives every expectation
 * from the source lessons.jsonl and from the stated subject policies, so a
 * generator bug cannot validate itself.
 *
 * Policy enforced:
 *   TECHNOLOGY — every lesson is a logic/code/debugging/design task with
 *     explicit success and check criteria; no real credentials; no live
 *     exploitation. Risk terms are allowed ONLY inside a prohibiting sentence.
 *   ARTS/MUSIC — every lesson is creation/analysis/portfolio work with a
 *     rubric, a private presentation option, and a text/no-audio alternative;
 *     no camera, voice, or public performance may be mandated; sources must be
 *     copyright-safe and the graded work must be the student's own.
 *
 * Exits non-zero on any failure.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { COURSES } from '../src/courses.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const readJsonl = (p) =>
  readFileSync(p, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l))

const failures = []
const fail = (id, message) => failures.push(`${id}: ${message}`)

/** Secret-shaped literals that must never appear anywhere in the corpus. */
const CREDENTIAL_LITERALS = [
  { name: 'openai-style key', re: /\bsk-[A-Za-z0-9]{16,}/ },
  { name: 'aws access key id', re: /\bAKIA[0-9A-Z]{12,}/ },
  { name: 'github token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'google api key', re: /\bAIza[0-9A-Za-z_-]{30,}/ },
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'bearer token', re: /\bBearer\s+[A-Za-z0-9._-]{20,}/ },
  { name: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./ },
  { name: 'assigned password literal', re: /\b(password|passphrase|api[_ ]?key|secret|token)\s*[:=]\s*["']?[A-Za-z0-9!@#$%^&*_-]{8,}/i },
]

/**
 * Terms that would indicate live exploitation if used as an instruction.
 * Each occurrence must sit in a sentence that forbids it.
 */
const EXPLOIT_TERMS = [
  'exploit', 'penetrat', 'brute force', 'sql injection', 'cross-site', 'xss',
  'ddos', 'denial of service', 'crack the', 'bypass', 'probe', 'port scan',
  'keylog', 'phish', 'malware', 'backdoor',
]

/**
 * Ordinary pedagogical phrases that happen to contain a risk term. Stripped
 * before the risk scan so "diagnostic probe" (a launch-day work label) is not
 * mistaken for probing a live system.
 */
const BENIGN_COMPOUNDS = [/diagnostic probe/gi]
/**
 * A risk term is acceptable when its sentence forbids the act ("no live
 * system may be probed") or frames it defensively ("recognising and defending
 * against phishing") — which is what security education legitimately teaches.
 */
const NEGATION =
  /\b(never|do not|don't|must not|cannot|may not|without|prohibit|forbidden|instead of|no\s+(real|live|third-party|production|public)|defend|defending|defensive|protect|avoid|recognis|recogniz|resist|mitigat|report)\b/i

/** Patterns that would mandate a camera, voice, or public performance. */
const MANDATED_EXPOSURE = [
  /\bmust\s+(be\s+)?(perform|record|photograph|film|videotape|sing|play)\w*\b/i,
  /\brequired\s+to\s+(perform|record|photograph|film|sing|play|speak)\b/i,
  /\bpresent\s+(it\s+|your\s+work\s+|this\s+)?to\s+the\s+class\b/i,
  /\bin\s+front\s+of\s+(an|the)\s+audience\b/i,
  /\bupload\b[^.]*\b(youtube|instagram|tiktok|social media)\b/i,
  /\byou\s+will\s+perform\s+(this|it)\s+(publicly|for\s+an\s+audience)/i,
]

const LIVE_URL = /https?:\/\/(?!example\.(com|org))[a-z0-9.-]+/i

function sentences(text) {
  return text.split(/(?<=[.!?])\s+/)
}

function scanText(id, label, text) {
  for (const { name, re } of CREDENTIAL_LITERALS) {
    if (re.test(text)) fail(id, `${label} contains a ${name}-shaped literal`)
  }
  if (LIVE_URL.test(text)) fail(id, `${label} contains a live URL: ${text.match(LIVE_URL)[0]}`)
  let scannable = text
  for (const compound of BENIGN_COMPOUNDS) scannable = scannable.replace(compound, ' ')
  const lower = scannable.toLowerCase()
  for (const term of EXPLOIT_TERMS) {
    if (!lower.includes(term)) continue
    for (const sentence of sentences(scannable)) {
      if (sentence.toLowerCase().includes(term) && !NEGATION.test(sentence)) {
        fail(id, `${label} uses risk term "${term}" outside a prohibiting sentence: "${sentence.trim().slice(0, 140)}"`)
      }
    }
  }
  for (const re of MANDATED_EXPOSURE) {
    const m = text.match(re)
    if (m) fail(id, `${label} appears to mandate exposure: "${m[0]}"`)
  }
}

const REQUIRED_PACKAGE_FIELDS = [
  'schema_version', 'lesson_id', 'unit_id', 'source_course_id', 'subject', 'band',
  'grade', 'grade_dir', 'unit_number', 'unit_title', 'day_in_unit', 'lesson_title',
  'phase', 'work_mode', 'focus', 'task_type', 'task_label', 'scoring_stance',
  'estimated_minutes', 'standards', 'learning_objectives', 'lesson_success_criteria',
  'task_brief', 'primary_task', 'requirements', 'deliverable',
  'presentation_and_privacy', 'copyright_and_authorship', 'accessibility_options',
  'task_accessibility_provisions', 'remediation', 'extension', 'unit_context',
]

const REQUIRED_GUIDE_FIELDS = [
  'schema_version', 'lesson_id', 'unit_id', 'subject', 'grade', 'unit_title',
  'lesson_title', 'phase', 'work_mode', 'scoring_authority_kind', 'rubric',
  'scoring_judgment_guidance', 'lesson_success_criteria', 'formative_check',
  'mastery_rule', 'unit_assessment_reference', 'remediation_plan', 'extension_plan',
  'accessibility_options', 'source_integrity', 'safety_and_privacy', 'standards',
]

const RUBRIC_LEVELS = ['exceeds', 'meets', 'developing', 'beginning']
const ARTS_RESOURCE_MODES = new Set(['MODEL_A', 'MODEL_B', 'GUIDED_A', 'GUIDED_B', 'INVESTIGATE'])
const EXPECTED_RESOURCE_KIND = {
  MODEL_A: 'ACADEMY_ORIGINAL_MODEL',
  MODEL_B: 'ACADEMY_ORIGINAL_MODEL',
  GUIDED_A: 'ACADEMY_CREATED_SCAFFOLD',
  GUIDED_B: 'ACADEMY_CREATED_SCAFFOLD',
  INVESTIGATE: 'ACADEMY_ORIGINAL_REFERENCE_WORK',
}

let packageCount = 0
const seenLessonIds = new Set()
const gradesSeen = new Set()
const modesSeen = new Set()
const artsResourceCounts = {
  ACADEMY_ORIGINAL_MODEL: 0,
  ACADEMY_CREATED_SCAFFOLD: 0,
  ACADEMY_ORIGINAL_REFERENCE_WORK: 0,
}

for (const course of COURSES) {
  const sourceLessons = readJsonl(course.lessonsPath)
  const pkgDir = resolve(ROOT, 'packages', course.subjectKey, course.gradeDir)
  const guideDir = resolve(ROOT, 'scoring-guides', course.subjectKey, course.gradeDir)

  const onDisk = new Set(
    readdirSync(pkgDir).filter((f) => f.endsWith('.task-package.json')).map((f) => f.replace('.task-package.json', '')),
  )

  // Coverage: every authored lesson has materials, and nothing extra exists.
  for (const lesson of sourceLessons) {
    if (!onDisk.has(lesson.lesson_id)) fail(lesson.lesson_id, 'no task package generated for this authored lesson')
  }
  for (const id of onDisk) {
    if (!sourceLessons.some((l) => l.lesson_id === id)) fail(id, 'task package exists with no matching authored lesson')
  }

  const sourceById = new Map(sourceLessons.map((l) => [l.lesson_id, l]))

  for (const lesson of sourceLessons) {
    const id = lesson.lesson_id
    const pkgPath = resolve(pkgDir, `${id}.task-package.json`)
    const guidePath = resolve(guideDir, `${id}.scoring-guide.json`)
    if (!existsSync(pkgPath) || !existsSync(guidePath)) {
      fail(id, 'missing task package or scoring guide file')
      continue
    }

    const pkg = readJson(pkgPath)
    const guide = readJson(guidePath)
    packageCount += 1

    if (seenLessonIds.has(id)) fail(id, 'duplicate lesson id across the corpus')
    seenLessonIds.add(id)
    gradesSeen.add(pkg.grade)
    modesSeen.add(pkg.work_mode)

    for (const field of REQUIRED_PACKAGE_FIELDS) {
      if (pkg[field] === undefined || pkg[field] === null) fail(id, `task package missing field "${field}"`)
    }
    for (const field of REQUIRED_GUIDE_FIELDS) {
      if (guide[field] === undefined || guide[field] === null) fail(id, `scoring guide missing field "${field}"`)
    }

    // Fidelity to the authored lesson — re-derived from source, not the generator.
    const src = sourceById.get(id)
    if (pkg.phase !== src.phase) fail(id, `phase drift: package "${pkg.phase}" vs source "${src.phase}"`)
    if (pkg.focus !== src.focus) fail(id, `focus drift: package "${pkg.focus}" vs source "${src.focus}"`)
    if (pkg.lesson_title !== src.title) fail(id, 'lesson_title does not match the authored lesson title')
    if (pkg.day_in_unit !== src.day_in_unit) fail(id, 'day_in_unit does not match the authored lesson')
    if (pkg.unit_number !== src.unit_number) fail(id, 'unit_number does not match the authored lesson')
    if (JSON.stringify(pkg.learning_objectives) !== JSON.stringify(src.learning_objectives)) {
      fail(id, 'learning_objectives do not match the authored lesson')
    }
    if (JSON.stringify(pkg.lesson_success_criteria) !== JSON.stringify(src.success_criteria)) {
      fail(id, 'lesson_success_criteria do not match the authored lesson')
    }
    if (pkg.grade !== course.grade || pkg.subject !== course.subjectKey) fail(id, 'grade/subject mismatch against course registry')

    // The lesson task must actually mention its own focus.
    if (!pkg.primary_task.toLowerCase().includes(src.focus.toLowerCase())) {
      fail(id, 'primary_task does not reference the lesson focus')
    }

    // Scoring authority.
    if (guide.scoring_authority_kind !== 'RUBRIC') fail(id, 'scoring_authority_kind is not RUBRIC')
    if (!Array.isArray(guide.rubric) || guide.rubric.length < 2) fail(id, 'rubric has fewer than 2 dimensions')
    for (const row of guide.rubric ?? []) {
      if (!row.dimension) fail(id, 'rubric row has no dimension name')
      for (const level of RUBRIC_LEVELS) {
        if (!row[level] || row[level].length < 20) fail(id, `rubric dimension "${row.dimension}" has a thin/absent "${level}" descriptor`)
      }
    }
    if (guide.safety_and_privacy?.status !== 'VERIFIED') fail(id, 'safety_and_privacy is not VERIFIED')
    if (!['VERIFIED', 'NOT_APPLICABLE'].includes(guide.source_integrity?.status)) fail(id, 'source_integrity status is neither VERIFIED nor NOT_APPLICABLE')

    // Subject policy.
    const isTech = pkg.subject === 'technology'
    if (isTech) {
      const checks = pkg.test_or_check_criteria
      if (!Array.isArray(checks) || checks.length < 4) fail(id, 'technology lesson has fewer than 4 test/check criteria')
      const note = pkg.presentation_and_privacy?.sandbox_and_credentials_note ?? ''
      if (!/never use a real password/i.test(note)) fail(id, 'technology lesson lacks the no-real-credentials prohibition')
      if (!/do not sign into, probe, scan/i.test(note)) fail(id, 'technology lesson lacks the no-live-system prohibition')
      if (pkg.critique_criteria) fail(id, 'technology lesson unexpectedly carries arts critique_criteria')
    } else {
      const checks = pkg.critique_criteria
      if (!Array.isArray(checks) || checks.length < 4) fail(id, 'arts lesson has fewer than 4 critique criteria')
      const opts = pkg.presentation_and_privacy?.presentation_options ?? ''
      const alt = pkg.presentation_and_privacy?.text_or_no_audio_alternative ?? ''
      if (!/no public performance/i.test(opts)) fail(id, 'arts lesson lacks the no-public-performance guarantee')
      if (!/never lowers the score/i.test(opts)) fail(id, 'arts lesson does not state that choosing privacy is not penalised')
      if (!/written alternative is always available/i.test(alt)) fail(id, 'arts lesson lacks the written/no-audio alternative')
      if (!/public domain|openly licensed/i.test(pkg.copyright_and_authorship)) fail(id, 'arts lesson lacks copyright-safe sourcing language')
      if (pkg.test_or_check_criteria) fail(id, 'arts lesson unexpectedly carries technology check criteria')

      const resourceRequired = ARTS_RESOURCE_MODES.has(pkg.work_mode)
      const resource = pkg.learner_resource
      if (resourceRequired) {
        if (!resource || typeof resource !== 'object') fail(id, 'reference-dependent arts lesson has no attached learner_resource metadata')
        if (typeof pkg.sourceReference !== 'string' || pkg.sourceReference.length < 300) fail(id, 'attached sourceReference is absent or too thin to use')
        if (!pkg.sourceReference?.includes(pkg.focus)) fail(id, 'attached sourceReference does not identify the lesson focus')
        if (!/ATTACHED MANUEL ACADEMY LEARNER RESOURCE/.test(pkg.sourceReference ?? '')) fail(id, 'learner resource is not identified as attached')
        if (!/Manuel Academy original; licensed CC BY 4\.0/.test(pkg.sourceReference ?? '')) fail(id, 'learner resource lacks the Academy-original CC BY 4.0 rights statement')
        if (!/no outside|Earlier-pass substitute|no instrument|scrap paper|pencil|silent/i.test(pkg.sourceReference ?? '')) fail(id, 'learner resource lacks a concrete offline or household-accessible use route')
        if (resource?.kind !== EXPECTED_RESOURCE_KIND[pkg.work_mode]) fail(id, `resource kind ${resource?.kind} does not match ${pkg.work_mode}`)
        if (resource?.availability !== 'ATTACHED_IN_PACKAGE' || resource?.academy_original !== true || resource?.license !== 'CC-BY-4.0') fail(id, 'learner resource availability or rights metadata is invalid')
        if (resource?.third_party_content !== false) fail(id, 'learner resource contains or ambiguously claims third-party content')
        for (const field of ['external_dependencies', 'required_paid_tools', 'required_specialized_materials']) {
          if (!Array.isArray(resource?.[field]) || resource[field].length !== 0) fail(id, `learner resource ${field} is not an explicit empty list`)
        }
        if (resource?.household_accessible !== true || resource?.silent_text_route_equal_credit !== true) fail(id, 'learner resource lacks household or silent equal-credit access metadata')
        if (resource?.kind in artsResourceCounts) artsResourceCounts[resource.kind] += 1
      } else if (pkg.learner_resource || pkg.sourceReference) {
        fail(id, 'non-reference-dependent arts lesson unexpectedly carries an attached learner resource')
      }
      if (!(pkg.materials ?? []).some((item) => /pencil or pen and scrap paper are enough/i.test(item))) {
        fail(id, 'arts lesson lacks the household-accessible material route')
      }
    }

    if (!/must be your own authorship/i.test(pkg.copyright_and_authorship)) fail(id, 'lesson lacks the student-authorship requirement')

    // Access provisions must be specific to what this task demands.
    if (!Array.isArray(pkg.task_accessibility_provisions) || pkg.task_accessibility_provisions.length < 1) {
      fail(id, 'no task-specific accessibility provisions')
    }
    // Where the learning target IS a motor act, an alternate input route must
    // be named — adjusting "response mode" cannot help when the response mode
    // is the thing being assessed.
    const MOTOR = /(typing|keyboard|mouse|trackpad|touchpad|handwriting|instrument|fingering|grip|manipulat)/i
    if (MOTOR.test(src.focus)) {
      const provisions = (pkg.task_accessibility_provisions ?? []).join(' ')
      if (!/(switch|dictation|voice typing|voice input|eye|one[- ]handed|alternate|scrib|different way)/i.test(provisions)) {
        fail(id, `motor learning target "${src.focus}" has no alternate input route on record`)
      }
    }
    // Elementary tasks must be chunked into single actions.
    if ([3, 4, 5].includes(pkg.grade)) {
      if (!Array.isArray(pkg.task_steps) || pkg.task_steps.length < 3) {
        fail(id, 'elementary lesson has no chunked task_steps')
      }
      const longest = Math.max(...(pkg.task_steps ?? ['x']).map((step) => step.split(/\s+/).length))
      if (longest > 32) fail(id, `elementary task step runs to ${longest} words`)
    } else if (pkg.task_steps) {
      fail(id, 'non-elementary lesson unexpectedly carries task_steps')
    }

    // Content scan over everything student-facing.
    const studentFacing = {
      task_brief: pkg.task_brief,
      primary_task: pkg.primary_task,
      requirements: pkg.requirements.join(' '),
      deliverable: pkg.deliverable,
      criteria: (pkg.test_or_check_criteria ?? pkg.critique_criteria ?? []).join(' '),
      remediation: pkg.remediation,
      extension: pkg.extension,
      presentation: JSON.stringify(pkg.presentation_and_privacy),
      copyright: pkg.copyright_and_authorship,
      sourceReference: pkg.sourceReference ?? '',
    }
    for (const [label, text] of Object.entries(studentFacing)) scanText(id, label, text)
  }
}

// Corpus-level expectations.
const EXPECTED_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12]
for (const g of EXPECTED_GRADES) if (!gradesSeen.has(g)) fail('corpus', `no lessons generated for grade ${g}`)
if (modesSeen.size < 16) fail('corpus', `only ${modesSeen.size} of 16 work modes appear in the corpus`)
if (artsResourceCounts.ACADEMY_ORIGINAL_MODEL !== 108) fail('corpus', `Academy-original models ${artsResourceCounts.ACADEMY_ORIGINAL_MODEL} != 108`)
if (artsResourceCounts.ACADEMY_CREATED_SCAFFOLD !== 108) fail('corpus', `Academy-created scaffolds ${artsResourceCounts.ACADEMY_CREATED_SCAFFOLD} != 108`)
if (artsResourceCounts.ACADEMY_ORIGINAL_REFERENCE_WORK !== 54) fail('corpus', `Academy-original references ${artsResourceCounts.ACADEMY_ORIGINAL_REFERENCE_WORK} != 54`)

console.log(`Validated ${packageCount} lesson packages + scoring guides.`)
console.log(`Grades covered: ${[...gradesSeen].sort((a, b) => a - b).join(', ')}`)
console.log(`Work modes present: ${modesSeen.size}`)
console.log(`Arts resources: ${artsResourceCounts.ACADEMY_ORIGINAL_MODEL} models, ${artsResourceCounts.ACADEMY_CREATED_SCAFFOLD} scaffolds, ${artsResourceCounts.ACADEMY_ORIGINAL_REFERENCE_WORK} reference works`)
if (failures.length > 0) {
  console.error(`\nVALIDATION FAILURES (${failures.length}):`)
  for (const f of failures.slice(0, 60)) console.error(`  - ${f}`)
  if (failures.length > 60) console.error(`  ... and ${failures.length - 60} more`)
  process.exitCode = 1
} else {
  console.log('CORPUS VALIDATION: PASS')
}

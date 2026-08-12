// Deterministic, local, offline check that a single static Grade 5 Math unit
// (frozen Manuel Academy curriculum-content) is structurally usable for the
// Family Pilot. Makes no network calls and reads only files already on disk.
//
// No single Grade 5 Math unit is designated in this repository as "the"
// pilot unit (see docs/family-pilot/grade5-math-unit.md). This validator
// therefore requires the caller to name a unit explicitly; it reports
// PILOT_STATIC_UNIT_DESIGNATION_REQUIRED when none is given.

import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PILOT_STATIC_UNIT_DESIGNATION_REQUIRED = 'PILOT_STATIC_UNIT_DESIGNATION_REQUIRED'

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..')
const CURRICULUM_ROOT = path.join(REPO_ROOT, 'curriculum-content', 'manuel-academy')
const REGISTRY_PATH = path.join(CURRICULUM_ROOT, 'production-release-registry.json')
const GRADE = 5
const SUBJECT = 'mathematics'
const UNIT_ID_PATTERN = /^ma-g5-mathematics-u(\d{2})$/
const LESSON_ID_PATTERN = /^ma-g5-mathematics-u(\d{2})-l(\d{2})$/

function check(results, name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'))
}

function readJsonl(filePath) {
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

/** Resolves the single active curriculum release from the registry, or throws. */
export function resolveActiveRelease() {
  const registry = readJson(REGISTRY_PATH)
  const active = (registry.releases ?? []).filter((release) => release.status === 'active')
  if (active.length !== 1) {
    throw new Error(`expected exactly one active release, found ${active.length}`)
  }
  return active[0]
}

export function courseDirFor(release) {
  return path.join(
    CURRICULUM_ROOT,
    release.sourceDirectory,
    'grades',
    `grade-${GRADE}`,
    'courses',
    SUBJECT,
  )
}

/** Normalizes CLI/programmatic unit input (unit_id or bare unit number) to a canonical unit_id. */
export function normalizeUnitId(input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null
  const trimmed = input.trim()
  if (UNIT_ID_PATTERN.test(trimmed)) return trimmed
  if (/^\d{1,2}$/.test(trimmed)) return `ma-g5-mathematics-u${trimmed.padStart(2, '0')}`
  return null
}

function findPracticeReference(unitNumber, unitTitle, results) {
  const practiceUnitsPath = path.join(
    REPO_ROOT,
    'src',
    'curriculum',
    'practice',
    'grade5MathPracticeUnits.ts',
  )
  const practiceFileExists = existsSync(practiceUnitsPath)
  check(results, 'practice-index-file-exists', practiceFileExists, practiceUnitsPath)
  if (!practiceFileExists) return

  const source = readFileSync(practiceUnitsPath, 'utf8')
  const entryPattern = /unitNumber:\s*(\d+),\s*title:\s*'([^']*)'/g
  let match
  let entry = null
  while ((match = entryPattern.exec(source)) !== null) {
    if (Number(match[1]) === unitNumber) {
      entry = { unitNumber: Number(match[1]), title: match[2] }
      break
    }
  }
  check(results, 'practice-index-has-unit-entry', entry !== null, `unitNumber ${unitNumber}`)
  if (!entry) return

  check(
    results,
    'practice-index-title-matches-unit-title',
    entry.title === unitTitle,
    `index="${entry.title}" unit="${unitTitle}"`,
  )

  const generatorPath = path.join(
    REPO_ROOT,
    'src',
    'curriculum',
    `grade5MathUnit${unitNumber}Generator.ts`,
  )
  check(
    results,
    'practice-generator-file-exists',
    existsSync(generatorPath),
    generatorPath,
  )
}

function checkLessonContent(lesson, results, label) {
  check(results, `${label}:has-title`, typeof lesson.title === 'string' && lesson.title.length > 0)
  check(
    results,
    `${label}:has-learning-objectives`,
    Array.isArray(lesson.learning_objectives) && lesson.learning_objectives.length > 0,
  )
  check(
    results,
    `${label}:has-success-criteria`,
    Array.isArray(lesson.success_criteria) && lesson.success_criteria.length > 0,
  )
  check(
    results,
    `${label}:has-lesson-flow`,
    Array.isArray(lesson.lesson_flow) &&
      lesson.lesson_flow.length > 0 &&
      lesson.lesson_flow.every(
        (segment) =>
          typeof segment.segment === 'string' &&
          typeof segment.teacher_or_tutor_action === 'string' &&
          segment.teacher_or_tutor_action.length > 0,
      ),
  )
  check(
    results,
    `${label}:has-answer-or-scoring-guidance`,
    typeof lesson.answer_or_scoring_guidance === 'string' &&
      lesson.answer_or_scoring_guidance.length > 0,
  )
}

/**
 * Validates one static Grade 5 Math unit for pilot readiness.
 * @param {string} unitInput unit_id (e.g. "ma-g5-mathematics-u03") or bare unit number (e.g. "3")
 * @returns {{ status: string, results: Array<{name: string, pass: boolean, detail: string}> }}
 */
export function validateUnit(unitInput) {
  const results = []
  const unitId = normalizeUnitId(unitInput)

  if (!unitId) {
    return { status: PILOT_STATIC_UNIT_DESIGNATION_REQUIRED, results }
  }

  let release
  try {
    release = resolveActiveRelease()
  } catch (error) {
    check(results, 'active-release-resolves', false, error.message)
    return { status: 'FAIL', results }
  }
  check(results, 'active-release-resolves', true, release.version)

  const courseDir = courseDirFor(release)
  const unitsPath = path.join(courseDir, 'units.json')
  const lessonsPath = path.join(courseDir, 'lessons.jsonl')
  const assessmentsPath = path.join(courseDir, 'assessments.json')

  check(results, 'units-file-exists', existsSync(unitsPath), unitsPath)
  check(results, 'lessons-file-exists', existsSync(lessonsPath), lessonsPath)
  check(results, 'assessments-file-exists', existsSync(assessmentsPath), assessmentsPath)
  if (results.some((r) => !r.pass)) return { status: 'FAIL', results }

  let units
  let lessons
  let assessments
  try {
    units = readJson(unitsPath)
    check(results, 'units-file-parses', true)
  } catch (error) {
    check(results, 'units-file-parses', false, error.message)
    return { status: 'FAIL', results }
  }
  try {
    lessons = readJsonl(lessonsPath)
    check(results, 'lessons-file-parses', true)
  } catch (error) {
    check(results, 'lessons-file-parses', false, error.message)
    return { status: 'FAIL', results }
  }
  try {
    assessments = readJson(assessmentsPath)
    check(results, 'assessments-file-parses', true)
  } catch (error) {
    check(results, 'assessments-file-parses', false, error.message)
    return { status: 'FAIL', results }
  }

  const unit = units.find((u) => u.unit_id === unitId)
  check(results, 'unit-found-in-units-file', Boolean(unit), unitId)
  if (!unit) return { status: 'FAIL', results }

  check(results, 'unit-grade-is-5', unit.grade === GRADE, String(unit.grade))
  check(results, 'unit-subject-is-mathematics', unit.subject === SUBJECT, String(unit.subject))
  check(
    results,
    'unit-id-matches-unit-number',
    UNIT_ID_PATTERN.test(unit.unit_id) && Number(UNIT_ID_PATTERN.exec(unit.unit_id)[1]) === unit.unit_number,
    `unit_id=${unit.unit_id} unit_number=${unit.unit_number}`,
  )
  check(
    results,
    'unit-has-lesson-ids',
    Array.isArray(unit.lesson_ids) && unit.lesson_ids.length > 0,
    `count=${Array.isArray(unit.lesson_ids) ? unit.lesson_ids.length : 0}`,
  )
  check(
    results,
    'unit-lesson-ids-internally-consistent',
    Array.isArray(unit.lesson_ids) &&
      unit.lesson_ids.every((id) => {
        const parsed = LESSON_ID_PATTERN.exec(id)
        return parsed !== null && Number(parsed[1]) === unit.unit_number
      }),
  )
  check(
    results,
    'unit-assessment-id-matches-convention',
    unit.assessment_id === `${unit.unit_id}-assessment`,
    unit.assessment_id,
  )

  const lessonById = new Map(lessons.map((lesson) => [lesson.lesson_id, lesson]))
  for (const lessonId of unit.lesson_ids ?? []) {
    const matches = lessons.filter((lesson) => lesson.lesson_id === lessonId)
    check(results, `lesson-referenced-once:${lessonId}`, matches.length === 1, `found ${matches.length}`)
    const lesson = lessonById.get(lessonId)
    if (!lesson) continue
    check(
      results,
      `lesson-course-id-matches-unit:${lessonId}`,
      lesson.course_id === unit.course_id,
      `lesson=${lesson.course_id} unit=${unit.course_id}`,
    )
    check(
      results,
      `lesson-unit-number-matches:${lessonId}`,
      lesson.unit_number === unit.unit_number,
      `lesson=${lesson.unit_number} unit=${unit.unit_number}`,
    )
    checkLessonContent(lesson, results, `lesson-content:${lessonId}`)
  }

  const assessment = assessments.find((a) => a.assessment_id === unit.assessment_id)
  check(results, 'assessment-found', Boolean(assessment), unit.assessment_id)
  if (assessment) {
    check(results, 'assessment-unit-number-matches', assessment.unit_number === unit.unit_number)
    check(
      results,
      'assessment-has-prompts',
      Array.isArray(assessment.prompts) &&
        assessment.prompts.length > 0 &&
        assessment.prompts.every(
          (prompt) =>
            typeof prompt.type === 'string' &&
            typeof prompt.prompt === 'string' &&
            prompt.prompt.length > 0 &&
            typeof prompt.points === 'number',
        ),
    )
  }

  findPracticeReference(unit.unit_number, unit.title, results)

  const status = results.every((r) => r.pass) ? 'PASS' : 'FAIL'
  return { status, results }
}

function parseArgs(argv) {
  const args = { unit: null, format: 'operator' }
  for (const arg of argv) {
    if (arg.startsWith('--unit=')) args.unit = arg.slice('--unit='.length)
    else if (arg.startsWith('--format=')) args.format = arg.slice('--format='.length)
  }
  return args
}

function printOperator(outcome, unitInput) {
  if (outcome.status === PILOT_STATIC_UNIT_DESIGNATION_REQUIRED) {
    console.log(PILOT_STATIC_UNIT_DESIGNATION_REQUIRED)
    console.log(
      'No Grade 5 Math unit is designated as the static Family Pilot candidate in this repository.',
    )
    console.log('Pass one explicitly: --unit=<unit_id|unit_number>, e.g. --unit=3 or --unit=ma-g5-mathematics-u03')
    return
  }
  const failures = outcome.results.filter((r) => !r.pass)
  console.log(`unit: ${unitInput}`)
  console.log(`status: ${outcome.status}`)
  console.log(`checks: ${outcome.results.length} (${failures.length} failed)`)
  for (const failure of failures) {
    console.log(`  FAIL ${failure.name}${failure.detail ? ` — ${failure.detail}` : ''}`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const outcome = validateUnit(args.unit)

  if (args.format === 'json') {
    console.log(JSON.stringify(outcome, null, 2))
  } else {
    printOperator(outcome, args.unit)
  }

  if (outcome.status === PILOT_STATIC_UNIT_DESIGNATION_REQUIRED) process.exit(2)
  if (outcome.status !== 'PASS') process.exit(1)
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()

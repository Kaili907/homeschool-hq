#!/usr/bin/env node
// Validator for the Grades 3/4 curriculum release. See validation-contract.md.
// Usage: node validate-grade34.mjs [rootDir]
// rootDir defaults to the curriculum-authoring/full-family-grade34/ directory this file lives under.

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE_DIR = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.dirname(RELEASE_DIR)

const EXPECTED_GRADES = [3, 4]
const EXPECTED_SUBJECTS = [
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology-computer-science',
  'arts-music',
  'financial-literacy',
]
const EXPECTED_WEEKS = 36
const LESSON_ID_PATTERN = /^ma-g(3|4)-[a-z-]+-u[0-9]{2}-l[0-9]{2}$/
const MANIFEST_CANDIDATES = ['manifest.json', 'course.json', 'index.json']

// Mirrors policies/instruction-mastery-accessibility-safety.md's prohibited-disclosure list.
const FORBIDDEN_PII_TERMS = [
  'photo',
  'voice recording',
  'precise location',
  'diagnosis',
  'medical history',
  'family income',
  'faith disclosure',
  'immigration status',
  'real password',
  'account credential',
  'card number',
  'tax id',
  'social security',
  'private message',
]
const NEGATION_PATTERN = /\b(no|not|never|without|optional|isn't|is not|does not|doesn't)\b/i
const TEXT_FALLBACK_TERMS = ['text fallback', 'text-only fallback', 'transcript', 'described', 'description', 'concrete materials', 'demonstration']
const MULTI_OCCASION_TERMS = ['occasion', 'multiple', 'more than one', 'separated by', 'two attempts', 'not a single answer', 'not establish mastery']

function makeReport() {
  return { checks: [], issues: [] }
}

function record(report, name, pass, details) {
  report.checks.push({ check: name, result: pass ? 'PASS' : 'FAIL', details })
  if (!pass) report.issues.push({ check: name, details })
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

export async function loadCourseMatrix(root) {
  const matrixPath = path.join(root, 'release', 'course-matrix.json')
  return readJson(matrixPath)
}

export async function loadLessonSchema(root) {
  const schemaPath = path.join(root, 'release', 'lesson-schema.json')
  return readJson(schemaPath)
}

/**
 * Subject lanes expose one manifest file per subject/grade directory
 * (subjects/<subject>/grade-<n>/{manifest,course,index}.json) containing
 * { course, units: [], lessons: [], schedule: { weeks, entries: [] } }.
 * Returns { found: boolean, courses, units, lessons, schedules }.
 */
export async function discoverSubjectContent(root) {
  const subjectsDir = path.join(root, 'subjects')
  const aggregate = { found: false, courses: [], units: [], lessons: [], schedules: [] }
  if (!existsSync(subjectsDir)) return aggregate

  const subjectDirs = await readdir(subjectsDir, { withFileTypes: true })
  for (const subjectDir of subjectDirs) {
    if (!subjectDir.isDirectory()) continue
    const subjectPath = path.join(subjectsDir, subjectDir.name)
    const gradeDirs = await readdir(subjectPath, { withFileTypes: true })
    for (const gradeDir of gradeDirs) {
      if (!gradeDir.isDirectory()) continue
      const gradePath = path.join(subjectPath, gradeDir.name)
      const manifestFile = MANIFEST_CANDIDATES.map((name) => path.join(gradePath, name)).find(existsSync)
      if (!manifestFile) continue
      aggregate.found = true
      const manifest = await readJson(manifestFile)
      if (manifest.course) aggregate.courses.push(manifest.course)
      if (Array.isArray(manifest.units)) aggregate.units.push(...manifest.units)
      if (Array.isArray(manifest.lessons)) aggregate.lessons.push(...manifest.lessons)
      if (manifest.schedule) aggregate.schedules.push({ course_id: manifest.course?.course_id, ...manifest.schedule })
    }
  }
  return aggregate
}

export function checkTwoGrades(courses) {
  const grades = [...new Set(courses.map((c) => c.grade))].sort()
  const pass = grades.length === EXPECTED_GRADES.length && grades.every((g, i) => g === EXPECTED_GRADES[i])
  return { pass, details: grades }
}

export function checkCoursesPerGrade(courses) {
  const byGrade = {}
  for (const grade of EXPECTED_GRADES) byGrade[grade] = courses.filter((c) => c.grade === grade).length
  const pass = EXPECTED_GRADES.every((g) => byGrade[g] === EXPECTED_SUBJECTS.length)
  return { pass, details: byGrade }
}

export function checkCourseCount(courses) {
  const pass = courses.length === EXPECTED_GRADES.length * EXPECTED_SUBJECTS.length
  return { pass, details: courses.length }
}

export function checkUniqueIds(items, idKey) {
  const seen = new Map()
  const duplicates = []
  for (const item of items) {
    const id = item[idKey]
    seen.set(id, (seen.get(id) ?? 0) + 1)
  }
  for (const [id, count] of seen) if (count > 1) duplicates.push(id)
  return { pass: duplicates.length === 0, details: duplicates }
}

export function checkLessonIdPattern(lessons) {
  const invalid = lessons.filter((l) => !LESSON_ID_PATTERN.test(l.lesson_id ?? '')).map((l) => l.lesson_id)
  return { pass: invalid.length === 0, details: invalid }
}

export function checkWeekCoverage(schedules) {
  const bad = schedules.filter((s) => s.weeks !== EXPECTED_WEEKS).map((s) => ({ course_id: s.course_id, weeks: s.weeks }))
  return { pass: schedules.length > 0 && bad.length === 0, details: bad }
}

export function checkScheduleCoversEveryLessonOnce(schedules, lessons) {
  const lessonIds = new Set(lessons.map((l) => l.lesson_id))
  const scheduledCounts = new Map()
  for (const schedule of schedules) {
    for (const entry of schedule.entries ?? []) {
      for (const ref of entry.lesson_refs ?? []) {
        scheduledCounts.set(ref, (scheduledCounts.get(ref) ?? 0) + 1)
      }
    }
  }
  const missing = [...lessonIds].filter((id) => !scheduledCounts.has(id))
  const duplicated = [...scheduledCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  const unknownRefs = [...scheduledCounts.keys()].filter((id) => !lessonIds.has(id))
  const pass = missing.length === 0 && duplicated.length === 0 && unknownRefs.length === 0
  return { pass, details: { missing, duplicated, unknownRefs } }
}

function requiredFieldsPresent(lesson, schema) {
  return (schema.required ?? []).filter((field) => lesson[field] === undefined)
}

function minItemsSatisfied(lesson, schema) {
  const failures = []
  for (const [key, def] of Object.entries(schema.properties ?? {})) {
    if (def.type === 'array' && typeof def.minItems === 'number') {
      const value = lesson[key]
      if (!Array.isArray(value) || value.length < def.minItems) failures.push(key)
    }
  }
  return failures
}

export function checkLessonSchemaCompatibility(lessons, schema) {
  const failures = []
  for (const lesson of lessons) {
    const missingRequired = requiredFieldsPresent(lesson, schema)
    const shortArrays = minItemsSatisfied(lesson, schema)
    const idPatternOk = LESSON_ID_PATTERN.test(lesson.lesson_id ?? '')
    if (missingRequired.length || shortArrays.length || !idPatternOk) {
      failures.push({ lesson_id: lesson.lesson_id, missingRequired, shortArrays, idPatternOk })
    }
  }
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

export function checkStandardsAndObjectives(lessons) {
  const failures = lessons
    .filter((l) => !(Array.isArray(l.standards) && l.standards.length >= 1) || !(Array.isArray(l.learning_objectives) && l.learning_objectives.length >= 3))
    .map((l) => l.lesson_id)
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

export function checkAccessibilityDepth(lessons) {
  const failures = lessons.filter((l) => !(Array.isArray(l.accessibility_and_accommodations) && l.accessibility_and_accommodations.length >= 5)).map((l) => l.lesson_id)
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

export function checkSafetyPrivacyDepth(lessons) {
  const failures = lessons.filter((l) => !(Array.isArray(l.safety_and_privacy) && l.safety_and_privacy.length >= 2)).map((l) => l.lesson_id)
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

function mentionsForbiddenRequirement(text) {
  const lower = String(text).toLowerCase()
  return FORBIDDEN_PII_TERMS.some((term) => {
    const idx = lower.indexOf(term)
    if (idx === -1) return false
    const window = lower.slice(Math.max(0, idx - 20), idx + term.length + 10)
    return !NEGATION_PATTERN.test(window)
  })
}

/**
 * Heuristic keyword scan for content that requires a prohibited disclosure
 * (photo, voice, precise location, diagnosis, income, credentials, etc. — see
 * policies/instruction-mastery-accessibility-safety.md). A boilerplate
 * prohibition entry like "no photo required" is not flagged; a requirement
 * like "students must upload a photo" is. Human review is still required —
 * this catches obvious cases, not every phrasing.
 */
export function checkSafetyPrivacyContent(lessons) {
  const failures = []
  for (const lesson of lessons) {
    const flagged = (lesson.safety_and_privacy ?? []).filter((entry) => mentionsForbiddenRequirement(entry))
    if (flagged.length) failures.push({ lesson_id: lesson.lesson_id, flagged })
  }
  return { pass: failures.length === 0, details: failures }
}

/**
 * Heuristic: every lesson's accessibility_and_accommodations must name a
 * text/transcript/description/demonstration fallback, matching the policy
 * that every lesson works without media. Human review is still required.
 */
export function checkNoMediaPath(lessons) {
  const failures = lessons
    .filter((l) => {
      const acc = (l.accessibility_and_accommodations ?? []).join(' ').toLowerCase()
      return !TEXT_FALLBACK_TERMS.some((term) => acc.includes(term))
    })
    .map((l) => l.lesson_id)
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

/**
 * Heuristic: every lesson's mastery_rule text must reflect multiple evidence
 * occasions rather than a single-answer check, matching the canonical
 * mastery policy. Human review is still required.
 */
export function checkMultiOccasionMastery(lessons) {
  const failures = lessons
    .filter((l) => !MULTI_OCCASION_TERMS.some((term) => String(l.mastery_rule ?? '').toLowerCase().includes(term)))
    .map((l) => l.lesson_id)
  return { pass: lessons.length > 0 && failures.length === 0, details: failures }
}

export function summarizeStandardsMappingStatus(lessons) {
  const counts = { canonical: 0, unverified: 0, 'human-review': 0, missing: 0 }
  for (const lesson of lessons) {
    for (const standard of lesson.standards ?? []) {
      if (standard.mapping_status && counts[standard.mapping_status] !== undefined) counts[standard.mapping_status] += 1
      else counts.missing += 1
    }
  }
  return counts
}

export async function runValidation(root = DEFAULT_ROOT) {
  const report = makeReport()
  const matrix = await loadCourseMatrix(root)
  const schema = await loadLessonSchema(root)
  const content = await discoverSubjectContent(root)

  const matrixCourses = matrix.courses ?? []
  record(report, 'two-grades', checkTwoGrades(matrixCourses).pass, checkTwoGrades(matrixCourses).details)
  record(report, 'ten-courses-per-grade', checkCoursesPerGrade(matrixCourses).pass, checkCoursesPerGrade(matrixCourses).details)
  record(report, 'course-count', checkCourseCount(matrixCourses).pass, checkCourseCount(matrixCourses).details)
  record(report, 'unique-course-ids', checkUniqueIds(matrixCourses, 'course_id').pass, checkUniqueIds(matrixCourses, 'course_id').details)

  if (!content.found) {
    report.overall = 'INCOMPLETE'
    report.message = 'No subject content found under subjects/**. Matrix-level checks ran; content-level checks (units, lessons, schedule, schema, accessibility, safety, mastery) are pending subject-lane authoring.'
    return report
  }

  record(report, 'unique-unit-ids', checkUniqueIds(content.units, 'unit_id').pass, checkUniqueIds(content.units, 'unit_id').details)
  record(report, 'unique-lesson-ids', checkUniqueIds(content.lessons, 'lesson_id').pass, checkUniqueIds(content.lessons, 'lesson_id').details)
  record(report, 'lesson-id-pattern', checkLessonIdPattern(content.lessons).pass, checkLessonIdPattern(content.lessons).details)
  record(report, 'week-coverage', checkWeekCoverage(content.schedules).pass, checkWeekCoverage(content.schedules).details)
  record(report, 'schedule-covers-every-lesson-once', checkScheduleCoversEveryLessonOnce(content.schedules, content.lessons).pass, checkScheduleCoversEveryLessonOnce(content.schedules, content.lessons).details)
  record(report, 'lesson-schema-compatibility', checkLessonSchemaCompatibility(content.lessons, schema).pass, checkLessonSchemaCompatibility(content.lessons, schema).details)
  record(report, 'required-standards-and-objectives', checkStandardsAndObjectives(content.lessons).pass, checkStandardsAndObjectives(content.lessons).details)
  record(report, 'accessibility-depth', checkAccessibilityDepth(content.lessons).pass, checkAccessibilityDepth(content.lessons).details)
  record(report, 'safety-privacy-depth', checkSafetyPrivacyDepth(content.lessons).pass, checkSafetyPrivacyDepth(content.lessons).details)
  record(report, 'safety-privacy-content', checkSafetyPrivacyContent(content.lessons).pass, checkSafetyPrivacyContent(content.lessons).details)
  record(report, 'no-media-path', checkNoMediaPath(content.lessons).pass, checkNoMediaPath(content.lessons).details)
  record(report, 'multi-occasion-mastery', checkMultiOccasionMastery(content.lessons).pass, checkMultiOccasionMastery(content.lessons).details)

  report.standards_mapping_status = summarizeStandardsMappingStatus(content.lessons)
  report.overall = report.issues.length === 0 ? 'PASS' : 'FAIL'
  return report
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT
  const report = await runValidation(root)
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = report.overall === 'FAIL' ? 1 : 0
}

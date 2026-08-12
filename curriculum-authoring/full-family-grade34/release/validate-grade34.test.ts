import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkTwoGrades,
  checkCoursesPerGrade,
  checkCourseCount,
  checkUniqueIds,
  checkLessonIdPattern,
  checkWeekCoverage,
  checkScheduleCoversEveryLessonOnce,
  checkLessonSchemaCompatibility,
  checkStandardsAndObjectives,
  checkAccessibilityDepth,
  checkSafetyPrivacyDepth,
  checkSafetyPrivacyContent,
  checkNoMediaPath,
  checkMultiOccasionMastery,
  summarizeStandardsMappingStatus,
  loadCourseMatrix,
  loadLessonSchema,
  runValidation,
} from './validate-grade34.mjs'

const RELEASE_DIR = path.dirname(fileURLToPath(import.meta.url))

function validLesson(overrides = {}) {
  return {
    schema_version: '1.0',
    lesson_id: 'ma-g3-mathematics-u01-l01',
    course_id: 'ma-g3-mathematics',
    grade: 3,
    subject: 'mathematics',
    course_day: 1,
    unit_number: 1,
    title: 'Rounding to the nearest ten',
    phase: 'introduce',
    focus: 'Rounding whole numbers',
    standards: [{ code_or_strand: '3.NBT.A.1', source: 'standards-reference.md#mathematics', mapping_status: 'unverified' }],
    learning_objectives: ['Round to the nearest ten.', 'Round to the nearest hundred.', 'Explain rounding using a number line.'],
    lesson_flow: ['warm-up', 'model', 'guided practice', 'independent practice', 'closing'],
    formative_check: 'Exit ticket with three rounding problems.',
    mastery_rule: 'Requires correct reasoning on two occasions separated by a day, not a single answer.',
    accessibility_and_accommodations: ['keyboard access', 'text-only fallback', 'extended time', 'chunked directions', 'high contrast'],
    safety_and_privacy: ['no photo required', 'no voice recording required'],
    ...overrides,
  }
}

describe('matrix-level checks (pure functions)', () => {
  const courses = [
    { course_id: 'ma-g3-mathematics', grade: 3 },
    { course_id: 'ma-g4-mathematics', grade: 4 },
  ]

  it('checkTwoGrades passes for exactly [3,4] and fails otherwise', () => {
    expect(checkTwoGrades(courses).pass).toBe(true)
    expect(checkTwoGrades([...courses, { course_id: 'ma-g5-mathematics', grade: 5 }]).pass).toBe(false)
  })

  it('checkCourseCount requires exactly 20', () => {
    expect(checkCourseCount(courses).pass).toBe(false)
    const twenty = Array.from({ length: 20 }, (_, i) => ({ course_id: `c${i}`, grade: i < 10 ? 3 : 4 }))
    expect(checkCourseCount(twenty).pass).toBe(true)
  })

  it('checkCoursesPerGrade requires 10 per grade across the canonical subject list', () => {
    expect(checkCoursesPerGrade(courses).pass).toBe(false)
  })

  it('checkUniqueIds flags duplicates', () => {
    expect(checkUniqueIds(courses, 'course_id').pass).toBe(true)
    expect(checkUniqueIds([...courses, { course_id: 'ma-g3-mathematics', grade: 3 }], 'course_id').pass).toBe(false)
  })
})

describe('lesson-level checks (pure functions)', () => {
  it('checkLessonIdPattern accepts grade 3/4 ids and rejects others', () => {
    expect(checkLessonIdPattern([{ lesson_id: 'ma-g3-mathematics-u01-l01' }]).pass).toBe(true)
    expect(checkLessonIdPattern([{ lesson_id: 'ma-g5-mathematics-u01-l01' }]).pass).toBe(false)
  })

  it('checkWeekCoverage requires exactly 36 weeks and at least one schedule', () => {
    expect(checkWeekCoverage([]).pass).toBe(false)
    expect(checkWeekCoverage([{ course_id: 'ma-g3-mathematics', weeks: 36 }]).pass).toBe(true)
    expect(checkWeekCoverage([{ course_id: 'ma-g3-mathematics', weeks: 30 }]).pass).toBe(false)
  })

  it('checkScheduleCoversEveryLessonOnce catches missing, duplicated, and unknown refs', () => {
    const lessons = [{ lesson_id: 'l1' }, { lesson_id: 'l2' }]
    const complete = [{ entries: [{ lesson_refs: ['l1'] }, { lesson_refs: ['l2'] }] }]
    expect(checkScheduleCoversEveryLessonOnce(complete, lessons).pass).toBe(true)

    const missing = [{ entries: [{ lesson_refs: ['l1'] }] }]
    expect(checkScheduleCoversEveryLessonOnce(missing, lessons).details.missing).toEqual(['l2'])

    const duplicated = [{ entries: [{ lesson_refs: ['l1'] }, { lesson_refs: ['l1'] }, { lesson_refs: ['l2'] }] }]
    expect(checkScheduleCoversEveryLessonOnce(duplicated, lessons).details.duplicated).toEqual(['l1'])

    const unknown = [{ entries: [{ lesson_refs: ['l1'] }, { lesson_refs: ['l2'] }, { lesson_refs: ['l99'] }] }]
    expect(checkScheduleCoversEveryLessonOnce(unknown, lessons).details.unknownRefs).toEqual(['l99'])
  })

  it('checkStandardsAndObjectives, checkAccessibilityDepth, checkSafetyPrivacyDepth pass for a well-formed lesson and fail for a stripped one', () => {
    const good = [validLesson()]
    expect(checkStandardsAndObjectives(good).pass).toBe(true)
    expect(checkAccessibilityDepth(good).pass).toBe(true)
    expect(checkSafetyPrivacyDepth(good).pass).toBe(true)

    const stripped = [validLesson({ learning_objectives: ['only one'], accessibility_and_accommodations: ['one'], safety_and_privacy: [] })]
    expect(checkStandardsAndObjectives(stripped).pass).toBe(false)
    expect(checkAccessibilityDepth(stripped).pass).toBe(false)
    expect(checkSafetyPrivacyDepth(stripped).pass).toBe(false)
  })

  it('checkSafetyPrivacyContent ignores boilerplate prohibitions but flags actual requirements', () => {
    const clean = [validLesson({ safety_and_privacy: ['no photo required', 'no voice recording required'] })]
    expect(checkSafetyPrivacyContent(clean).pass).toBe(true)

    const violating = [validLesson({ safety_and_privacy: ['students must upload a photo of their work', 'no voice recording required'] })]
    expect(checkSafetyPrivacyContent(violating).pass).toBe(false)
    expect(checkSafetyPrivacyContent(violating).details[0].flagged).toEqual(['students must upload a photo of their work'])
  })

  it('checkNoMediaPath requires a text/transcript/description fallback to be named', () => {
    expect(checkNoMediaPath([validLesson()]).pass).toBe(true)
    const noFallback = [validLesson({ accessibility_and_accommodations: ['extended time', 'movement breaks', 'hidden timer', 'low-distraction setting', 'alternate response mode'] })]
    expect(checkNoMediaPath(noFallback).pass).toBe(false)
  })

  it('checkMultiOccasionMastery requires mastery_rule to reflect multiple evidence occasions', () => {
    expect(checkMultiOccasionMastery([validLesson()]).pass).toBe(true)
    const singleAnswer = [validLesson({ mastery_rule: 'A correct answer on the exit ticket demonstrates mastery.' })]
    expect(checkMultiOccasionMastery(singleAnswer).pass).toBe(false)
  })

  it('summarizeStandardsMappingStatus counts by status, including unrecognized as missing', () => {
    const lessons = [
      validLesson({ standards: [{ mapping_status: 'canonical' }, { mapping_status: 'unverified' }] }),
      validLesson({ standards: [{ mapping_status: 'human-review' }, {}] }),
    ]
    expect(summarizeStandardsMappingStatus(lessons)).toEqual({ canonical: 1, unverified: 1, 'human-review': 1, missing: 1 })
  })
})

describe('lesson-schema-compatibility against the real lesson-schema.json', () => {
  it('accepts a well-formed lesson and rejects one missing required fields or short arrays', async () => {
    const schema = await loadLessonSchema(path.dirname(RELEASE_DIR))
    expect(checkLessonSchemaCompatibility([validLesson()], schema).pass).toBe(true)

    const broken = validLesson({ learning_objectives: ['too short'] })
    delete broken.mastery_rule
    expect(checkLessonSchemaCompatibility([broken], schema).pass).toBe(false)
  })
})

describe('release artifacts are internally consistent', () => {
  it('course-matrix.json has exactly 20 courses across grades 3 and 4, 10 per grade, unique ids', async () => {
    const matrix = await loadCourseMatrix(path.dirname(RELEASE_DIR))
    expect(checkTwoGrades(matrix.courses).pass).toBe(true)
    expect(checkCourseCount(matrix.courses).pass).toBe(true)
    expect(checkCoursesPerGrade(matrix.courses).pass).toBe(true)
    expect(checkUniqueIds(matrix.courses, 'course_id').pass).toBe(true)
  })
})

describe('runValidation end-to-end', () => {
  let tmpRoot: string

  beforeAll(async () => {
    tmpRoot = await mkdtemp(path.join(tmpdir(), 'grade34-validate-'))
    await mkdir(path.join(tmpRoot, 'release'), { recursive: true })
    await copyFile(path.join(RELEASE_DIR, 'course-matrix.json'), path.join(tmpRoot, 'release', 'course-matrix.json'))
    await copyFile(path.join(RELEASE_DIR, 'lesson-schema.json'), path.join(tmpRoot, 'release', 'lesson-schema.json'))
  })

  afterAll(async () => {
    await rm(tmpRoot, { recursive: true, force: true })
  })

  it('reports INCOMPLETE when no subjects/** content exists yet (today\'s real state)', async () => {
    const report = await runValidation(tmpRoot)
    expect(report.overall).toBe('INCOMPLETE')
    expect(report.checks.find((c) => c.check === 'course-count').result).toBe('PASS')
  })

  it('reports PASS once a subject lane supplies a complete, valid manifest', async () => {
    const gradeDir = path.join(tmpRoot, 'subjects', 'mathematics', 'grade-3')
    await mkdir(gradeDir, { recursive: true })
    const lesson = validLesson()
    const manifest = {
      course: { course_id: 'ma-g3-mathematics', grade: 3 },
      units: [{ unit_id: 'ma-g3-mathematics-u01' }],
      lessons: [lesson],
      schedule: { weeks: 36, entries: [{ week: 1, day: 1, lesson_refs: [lesson.lesson_id] }] },
    }
    await writeFile(path.join(gradeDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

    const report = await runValidation(tmpRoot)
    expect(report.overall).toBe('PASS')
    expect(report.standards_mapping_status.unverified).toBe(1)
  })

  it('reports FAIL when a subject lane supplies an invalid lesson', async () => {
    const gradeDir = path.join(tmpRoot, 'subjects', 'science', 'grade-4')
    await mkdir(gradeDir, { recursive: true })
    const brokenLesson = validLesson({ lesson_id: 'ma-g4-science-u01-l01', grade: 4, subject: 'science', accessibility_and_accommodations: ['only one'] })
    const manifest = {
      course: { course_id: 'ma-g4-science', grade: 4 },
      units: [{ unit_id: 'ma-g4-science-u01' }],
      lessons: [brokenLesson],
      schedule: { weeks: 36, entries: [{ week: 1, day: 1, lesson_refs: [brokenLesson.lesson_id] }] },
    }
    await writeFile(path.join(gradeDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

    const report = await runValidation(tmpRoot)
    expect(report.overall).toBe('FAIL')
    expect(report.issues.some((issue) => issue.check === 'accessibility-depth')).toBe(true)
  })
})

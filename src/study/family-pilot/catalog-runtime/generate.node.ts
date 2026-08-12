import { readFileSync, readdirSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, resolve } from 'node:path'
import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types.ts'

/**
 * FF-M11 generator — projects the frozen release into the browser-safe ES
 * modules under ./generated.
 *
 * Node-only, and deliberately NOT imported by anything the browser reaches:
 * this file is the whole reason ./generated exists, and ./generated is the
 * whole reason the runtime needs no filesystem. Run it with
 *
 *   node --experimental-strip-types src/study/family-pilot/catalog-runtime/generate.node.ts
 *
 * The output is committed, so a production build needs no extra step, and
 * generated.test.ts fails if the committed output ever drifts from the source.
 *
 * The frozen source is READ ONLY. Like scripts/build-curriculum.mjs, this
 * verifies the release invariants and fails loudly rather than emitting a
 * partial or guessed catalog.
 */

export const EXPECTED = {
  releaseGrades: ['5', '7', '8'] as readonly AcademyGrade[],
  courses: 30,
  units: 232,
  lessons: 2736,
  lessonsByGrade: { '5': 900, '7': 900, '8': 936 } as Record<AcademyGrade, number>,
  subjectsPerGrade: ACADEMY_SUBJECTS.length,
} as const

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../..')
const CONTENT_ROOT = join(REPO_ROOT, 'curriculum-content/manuel-academy')
const OUT_ROOT = join(HERE, 'generated')

class GeneratorError extends Error {}
// Explicitly annotated so TypeScript treats a bare fail(...) call as a
// control-flow terminator and narrows the checks above it.
const fail: (message: string) => never = (message) => {
  throw new GeneratorError(`catalog-runtime generate: ${message}`)
}

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch (cause) {
    return fail(`cannot read JSON at ${path} (${String(cause)})`)
  }
}

function readReleaseVersion(): string {
  const registry = readJson(join(CONTENT_ROOT, 'production-release-registry.json')) as {
    currentRelease?: unknown
    releases?: unknown
  }
  if (typeof registry.currentRelease !== 'string' || !registry.currentRelease) {
    return fail('release registry has no currentRelease')
  }
  const releases = Array.isArray(registry.releases) ? registry.releases : []
  const active = releases.filter(
    (r): r is { version: string; status: string } =>
      !!r && typeof r === 'object' && (r as { status?: unknown }).status === 'active',
  )
  if (active.length !== 1 || active[0].version !== registry.currentRelease) {
    return fail('release registry must identify exactly one active current release')
  }
  return registry.currentRelease
}

interface RawUnit {
  unit_id: string
  course_id: string
  unit_number: number
  title: string
  days: number
  essential_question: string
  assessment_id: string | null
  lesson_ids: string[]
}

interface RawLesson {
  lesson_id: string
  course_id: string
  unit_number: number
  day_in_unit: number
  course_day: number
  title: string
  estimated_minutes: string
}

interface LoadedCourse {
  courseRef: string
  grade: AcademyGrade
  subject: AcademySubject
  title: string
  days: number
  units: RawUnit[]
  lessons: RawLesson[]
}

function isSubject(value: unknown): value is AcademySubject {
  return typeof value === 'string' && (ACADEMY_SUBJECTS as readonly string[]).includes(value)
}

function loadCourse(releaseRoot: string, grade: AcademyGrade, subjectDir: string): LoadedCourse {
  const base = join(releaseRoot, 'grades', `grade-${grade}`, 'courses', subjectDir)
  const label = `grade-${grade}/${subjectDir}`

  const rawUnits = readJson(join(base, 'units.json'))
  if (!Array.isArray(rawUnits) || rawUnits.length === 0) fail(`${label} units.json is empty or malformed`)

  const rawAssessments = readJson(join(base, 'assessments.json'))
  if (!Array.isArray(rawAssessments)) fail(`${label} assessments.json is malformed`)
  const assessmentIds = new Set(
    (rawAssessments as { assessment_id?: unknown }[])
      .map((a) => a.assessment_id)
      .filter((id): id is string => typeof id === 'string'),
  )

  const lessonText = (() => {
    try {
      return readFileSync(join(base, 'lessons.jsonl'), 'utf8')
    } catch {
      return fail(`${label} lessons.jsonl is unavailable`)
    }
  })()

  const lessons: RawLesson[] = []
  for (const line of lessonText.split(/\r?\n/)) {
    if (!line.trim()) continue
    let r: Record<string, unknown>
    try {
      r = JSON.parse(line) as Record<string, unknown>
    } catch {
      return fail(`${label} lessons.jsonl has a line that is not valid JSON`)
    }
    if (
      typeof r.lesson_id !== 'string' || !r.lesson_id ||
      typeof r.course_id !== 'string' || !r.course_id ||
      typeof r.unit_number !== 'number' ||
      typeof r.day_in_unit !== 'number' ||
      typeof r.course_day !== 'number' ||
      typeof r.title !== 'string' || !r.title ||
      typeof r.estimated_minutes !== 'string' || !r.estimated_minutes
    ) {
      fail(`${label} has a lesson missing required catalog fields`)
    }
    lessons.push({
      lesson_id: r.lesson_id as string,
      course_id: r.course_id as string,
      unit_number: r.unit_number as number,
      day_in_unit: r.day_in_unit as number,
      course_day: r.course_day as number,
      title: r.title as string,
      estimated_minutes: r.estimated_minutes as string,
    })
  }
  if (lessons.length === 0) fail(`${label} lessons.jsonl is empty`)

  const courseRef = lessons[0].course_id
  const byId = new Map<string, RawLesson>()
  for (const lesson of lessons) {
    if (lesson.course_id !== courseRef) fail(`${label} mixes course_id across lessons.jsonl`)
    if (byId.has(lesson.lesson_id)) fail(`${label} repeats lesson_id ${lesson.lesson_id}`)
    byId.set(lesson.lesson_id, lesson)
  }

  // course_day must be a dense 1..N sequence — the completion order downstream walks.
  const ordered = lessons.slice().sort((a, b) => a.course_day - b.course_day)
  ordered.forEach((lesson, index) => {
    if (lesson.course_day !== index + 1) {
      fail(`${label} course_day is not a dense 1..N sequence (position ${index + 1} is ${lesson.course_day})`)
    }
  })

  const seen = new Set<string>()
  const units: RawUnit[] = (rawUnits as Record<string, unknown>[])
    .slice()
    .sort((a, b) => (a.unit_number as number) - (b.unit_number as number))
    .map((u) => {
      if (
        typeof u.unit_id !== 'string' || typeof u.course_id !== 'string' ||
        typeof u.unit_number !== 'number' || typeof u.title !== 'string' ||
        typeof u.days !== 'number' || typeof u.essential_question !== 'string' ||
        !Array.isArray(u.lesson_ids) || u.lesson_ids.length === 0
      ) {
        fail(`${label} unit ${String(u.unit_id)} is missing required fields`)
      }
      if (u.course_id !== courseRef) fail(`${label} unit ${String(u.unit_id)} has a foreign course_id`)
      for (const lessonId of u.lesson_ids as unknown[]) {
        if (typeof lessonId !== 'string') fail(`${label} unit ${String(u.unit_id)} has a non-string lesson id`)
        const lesson = byId.get(lessonId)
        if (!lesson) fail(`${label} unit ${String(u.unit_id)} references unknown lesson ${lessonId}`)
        if (lesson!.unit_number !== u.unit_number) {
          fail(`${label} lesson ${lessonId} claims unit ${lesson!.unit_number}, units.json says ${String(u.unit_number)}`)
        }
        if (seen.has(lessonId)) fail(`${label} lesson ${lessonId} appears in more than one unit`)
        seen.add(lessonId)
      }
      const assessmentId = typeof u.assessment_id === 'string' ? u.assessment_id : null
      if (assessmentId !== null && !assessmentIds.has(assessmentId)) {
        fail(`${label} unit ${String(u.unit_id)} references unknown assessment ${assessmentId}`)
      }
      return {
        unit_id: u.unit_id as string,
        course_id: courseRef,
        unit_number: u.unit_number as number,
        title: u.title as string,
        days: u.days as number,
        essential_question: u.essential_question as string,
        assessment_id: assessmentId,
        lesson_ids: (u.lesson_ids as string[]).slice(),
      }
    })

  // Dense 1..N unit numbers, mirroring the course_day check above. The provider
  // keys lesson rows by unit_number, so a duplicate would silently re-parent a
  // whole unit's lessons onto another unit's ref.
  units.forEach((unit, index) => {
    if (unit.unit_number !== index + 1) {
      fail(`${label} unit_number is not a dense 1..N sequence (position ${index + 1} is ${unit.unit_number})`)
    }
  })

  if (seen.size !== byId.size) fail(`${label} units.json covers ${seen.size} of ${byId.size} lessons`)
  if (!isSubject(subjectDir)) fail(`${label} is not one of the ten published subjects`)
  // The ref becomes a module filename; keep it incapable of escaping generated/.
  if (!/^[a-z0-9-]+$/.test(courseRef)) fail(`${label} has an unsafe course_id ${courseRef}`)

  return {
    courseRef,
    grade,
    subject: subjectDir as AcademySubject,
    title: '',
    days: 0,
    units,
    lessons: ordered,
  }
}

export interface GeneratedFile {
  readonly relativePath: string
  readonly contents: string
}

const q = (value: string): string => JSON.stringify(value)

/** Builds every generated module's exact text. Pure, so the drift test can
 * compare it against what is committed without writing anything. */
export function buildGeneratedFiles(): readonly GeneratedFile[] {
  const releaseVersion = readReleaseVersion()
  const releaseRoot = join(CONTENT_ROOT, releaseVersion)

  // The release itself decides what it contains. Iterating only the expected
  // grades would let a release that gained grade-6 pass every count below while
  // emitting a catalog missing a quarter of its content.
  const gradeDirs = readdirSync(join(releaseRoot, 'grades')).sort()
  const expectedGradeDirs = EXPECTED.releaseGrades.map((grade) => `grade-${grade}`).sort()
  if (gradeDirs.join(',') !== expectedGradeDirs.join(',')) {
    fail(`release publishes grades [${gradeDirs.join(', ')}], expected [${expectedGradeDirs.join(', ')}]`)
  }

  const courseIndex = readJson(join(releaseRoot, 'course-index.json'))
  if (!Array.isArray(courseIndex)) fail('course-index.json is malformed')
  if ((courseIndex as unknown[]).length !== EXPECTED.courses) {
    fail(`course-index.json lists ${(courseIndex as unknown[]).length} courses, expected ${EXPECTED.courses}`)
  }
  const catalogMeta = new Map(
    (courseIndex as Record<string, unknown>[]).map((c) => [
      c.course_id as string,
      { title: c.title as string, days: c.days as number },
    ]),
  )

  const courses: LoadedCourse[] = []
  for (const grade of EXPECTED.releaseGrades) {
    const coursesDir = join(releaseRoot, 'grades', `grade-${grade}`, 'courses')
    for (const subjectDir of readdirSync(coursesDir).sort()) {
      const course = loadCourse(releaseRoot, grade, subjectDir)
      const meta = catalogMeta.get(course.courseRef)
      if (!meta || typeof meta.title !== 'string' || typeof meta.days !== 'number') {
        fail(`course-index.json has no title/days for ${course.courseRef}`)
      }
      courses.push({ ...course, title: meta!.title, days: meta!.days })
    }
  }

  // ---- release invariants ----
  if (courses.length !== EXPECTED.courses) fail(`found ${courses.length} courses, expected ${EXPECTED.courses}`)
  const allUnits = courses.flatMap((c) => c.units)
  if (new Set(allUnits.map((u) => u.unit_id)).size !== EXPECTED.units) {
    fail(`found ${new Set(allUnits.map((u) => u.unit_id)).size} unit refs, expected ${EXPECTED.units}`)
  }
  const allLessonRefs = courses.flatMap((c) => c.lessons.map((l) => l.lesson_id))
  if (new Set(allLessonRefs).size !== EXPECTED.lessons || allLessonRefs.length !== EXPECTED.lessons) {
    fail(`found ${allLessonRefs.length} lesson refs (${new Set(allLessonRefs).size} unique), expected ${EXPECTED.lessons}`)
  }
  for (const grade of EXPECTED.releaseGrades) {
    const total = courses.filter((c) => c.grade === grade).reduce((n, c) => n + c.lessons.length, 0)
    if (total !== EXPECTED.lessonsByGrade[grade]) {
      fail(`grade ${grade} has ${total} lessons, expected ${EXPECTED.lessonsByGrade[grade]}`)
    }
    const subjects = new Set(courses.filter((c) => c.grade === grade).map((c) => c.subject))
    if (subjects.size !== EXPECTED.subjectsPerGrade) {
      fail(`grade ${grade} publishes ${subjects.size} subjects, expected ${EXPECTED.subjectsPerGrade}`)
    }
  }
  // Course refs must be mutually non-prefixing so a ref never resolves ambiguously.
  for (const a of courses) {
    for (const b of courses) {
      if (a !== b && b.courseRef.startsWith(`${a.courseRef}-`)) {
        fail(`course ref ${b.courseRef} is nested under ${a.courseRef}`)
      }
    }
  }

  const files: GeneratedFile[] = []
  const moduleNameOf = (courseRef: string) => courseRef

  // ---- eager index: courses + units, no lesson payloads ----
  const courseLines = courses.map(
    (c) =>
      `  { courseRef: ${q(c.courseRef)}, grade: ${q(c.grade)}, subject: ${q(c.subject)},` +
      ` title: ${q(c.title)}, days: ${c.days}, unitCount: ${c.units.length}, lessonCount: ${c.lessons.length} },`,
  )
  const unitLines = courses.flatMap((c) =>
    c.units.map(
      (u) =>
        `  { unitRef: ${q(u.unit_id)}, courseRef: ${q(c.courseRef)}, grade: ${q(c.grade)},` +
        ` subject: ${q(c.subject)}, unitNumber: ${u.unit_number}, title: ${q(u.title)}, days: ${u.days},` +
        ` essentialQuestion: ${q(u.essential_question)},` +
        ` assessmentRef: ${u.assessment_id === null ? 'null' : q(u.assessment_id)},` +
        ` lessonRefs: [${u.lesson_ids.map(q).join(', ')}] },`,
    ),
  )

  files.push({
    relativePath: 'index.ts',
    contents: [
      '// GENERATED by ../generate.node.ts from the frozen curriculum release. Do not edit.',
      '//',
      '// The eager half of the catalog: course and unit structure only. Lesson',
      '// payloads live in ./courses/* and load on demand — see ../loaders.ts.',
      "import type { CatalogCourse, CatalogUnit } from '../types'",
      '',
      `export const RELEASE_VERSION = ${q(releaseVersion)}`,
      '',
      'export const COURSES: readonly CatalogCourse[] = [',
      ...courseLines,
      ']',
      '',
      'export const UNITS: readonly CatalogUnit[] = [',
      ...unitLines,
      ']',
      '',
    ].join('\n'),
  })

  // ---- lazy per-course lesson payloads ----
  for (const course of courses) {
    const rows = course.lessons.map(
      (l) =>
        `  { lessonRef: ${q(l.lesson_id)}, unitNumber: ${l.unit_number}, dayInUnit: ${l.day_in_unit},` +
        ` courseDay: ${l.course_day}, title: ${q(l.title)}, estimatedMinutes: ${q(l.estimated_minutes)} },`,
    )
    files.push({
      relativePath: `courses/${moduleNameOf(course.courseRef)}.ts`,
      contents: [
        `// GENERATED by ../../generate.node.ts from the frozen curriculum release. Do not edit.`,
        `// Lazy lesson payload for ${course.courseRef} (${course.lessons.length} lessons), in course_day order.`,
        "import type { GeneratedLessonRow } from '../../rows'",
        '',
        'const LESSONS: readonly GeneratedLessonRow[] = [',
        ...rows,
        ']',
        '',
        'export default LESSONS',
        '',
      ].join('\n'),
    })
  }

  // ---- loader map: one static import() per course, so Vite emits one chunk each ----
  const loaderLines = courses.map(
    (c) => `  ${q(c.courseRef)}: () => import('./generated/courses/${moduleNameOf(c.courseRef)}'),`,
  )
  files.push({
    relativePath: '../loaders.ts',
    contents: [
      '// GENERATED by ./generate.node.ts from the frozen curriculum release. Do not edit.',
      '//',
      '// Every specifier below is a static string, which is what lets Vite split each',
      "// course's lessons into its own chunk and keep them out of the initial bundle.",
      '// A glob or a computed specifier would forfeit that, so this stays explicit.',
      "import type { GeneratedLessonRow } from './rows'",
      '',
      'export type CourseLessonLoader = () => Promise<{ default: readonly GeneratedLessonRow[] }>',
      '',
      'export const COURSE_LESSON_LOADERS: Readonly<Record<string, CourseLessonLoader>> = {',
      ...loaderLines,
      '}',
      '',
    ].join('\n'),
  })

  return files
}

export function writeGeneratedFiles(): readonly GeneratedFile[] {
  const files = buildGeneratedFiles()
  rmSync(join(OUT_ROOT, 'courses'), { recursive: true, force: true })
  for (const file of files) {
    const target = resolve(OUT_ROOT, file.relativePath)
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, file.contents)
  }
  return files
}

export function readGeneratedFile(relativePath: string): string | undefined {
  try {
    return readFileSync(resolve(OUT_ROOT, relativePath), 'utf8')
  } catch {
    return undefined
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(HERE, 'generate.node.ts')
if (invokedDirectly) {
  const files = writeGeneratedFiles()
  console.log(`catalog-runtime generate: wrote ${files.length} modules`)
}

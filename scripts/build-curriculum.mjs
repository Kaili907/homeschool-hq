// SESSION CURR-1: derive the browser-served curriculum chunks from the immutable
// source release in curriculum-content/manuel-academy/<version>/.
//
// The source release is Director-authored content and is NEVER edited here — this
// script projects it into public/curriculum/<version>/ (gitignored, regenerated on
// every build) as small per-unit chunks so the app can lazy-load one unit at a
// time instead of shipping the whole 20MB release on first paint.
//
// Public content boundary: browser chunks OMIT `answer_or_scoring_guidance`
// (teacher-only scoring), `adaptive_tutor_routes` (tutor-facing), and assessment
// `mastery_interpretation` (scoring thresholds). The static host cannot authorize
// per-request access, so protected fields remain only in the immutable repository
// source and are never projected into public/ or the production build.
//
// The script re-verifies the release invariants (counts, ID uniqueness, schedule
// coverage) and fails the build loudly on any mismatch.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const VERSION = '1.0.0'
const SOURCE = resolve(process.cwd(), 'curriculum-content/manuel-academy', VERSION)
const OUT = resolve(process.cwd(), 'public/curriculum', VERSION)

const EXPECTED = { courses: 30, units: 232, lessons: 2736, grades: ['5', '7', '8'] }

// Lesson fields withheld from the student projection (see boundary note above).
const PROTECTED_LESSON_FIELDS = ['answer_or_scoring_guidance', 'adaptive_tutor_routes']

const fail = (msg) => {
  console.error(`build-curriculum: FAIL — ${msg}`)
  process.exit(1)
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

const manifest = readJson(join(SOURCE, 'curriculum-manifest.json'))
if (manifest.version !== VERSION) fail(`source manifest version ${manifest.version} != ${VERSION}`)

// ---------- load + verify every course ----------

const gradeDirs = EXPECTED.grades.map((g) => ({ grade: g, dir: join(SOURCE, 'grades', `grade-${g}`) }))
const courses = [] // { meta from units.json context, units, lessons, assessments }
const allLessonIds = new Set()
const allUnitIds = new Set()

for (const { grade, dir } of gradeDirs) {
  for (const courseDir of readdirSync(join(dir, 'courses')).sort()) {
    const base = join(dir, 'courses', courseDir)
    const units = readJson(join(base, 'units.json'))
    const assessments = readJson(join(base, 'assessments.json'))
    const lessons = readFileSync(join(base, 'lessons.jsonl'), 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
    if (!lessons.length) fail(`${base}: empty lessons.jsonl`)
    const courseId = lessons[0].course_id
    for (const u of units) {
      if (allUnitIds.has(u.unit_id)) fail(`duplicate unit_id ${u.unit_id}`)
      allUnitIds.add(u.unit_id)
    }
    for (const l of lessons) {
      if (allLessonIds.has(l.lesson_id)) fail(`duplicate lesson_id ${l.lesson_id}`)
      allLessonIds.add(l.lesson_id)
      if (l.course_id !== courseId) fail(`${l.lesson_id}: mixed course_id in ${base}`)
    }
    courses.push({ grade, courseId, units, lessons, assessments })
  }
}

if (courses.length !== EXPECTED.courses) fail(`courses ${courses.length} != ${EXPECTED.courses}`)
if (allUnitIds.size !== EXPECTED.units) fail(`units ${allUnitIds.size} != ${EXPECTED.units}`)
if (allLessonIds.size !== EXPECTED.lessons) fail(`lessons ${allLessonIds.size} != ${EXPECTED.lessons}`)

// ---------- emit ----------

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
const emit = (rel, data) => {
  const p = join(OUT, rel)
  mkdirSync(resolve(p, '..'), { recursive: true })
  writeFileSync(p, JSON.stringify(data))
}

const studentLesson = (l) => {
  const safe = { ...l }
  for (const f of PROTECTED_LESSON_FIELDS) delete safe[f]
  return safe
}
const studentAssessment = (a) => {
  const { mastery_interpretation, ...safe } = a
  return safe
}

for (const c of courses) {
  const byUnit = new Map()
  for (const l of c.lessons) {
    if (!byUnit.has(l.unit_number)) byUnit.set(l.unit_number, [])
    byUnit.get(l.unit_number).push(l)
  }
  for (const [unitNumber, lessons] of byUnit) {
    lessons.sort((a, b) => a.course_day - b.course_day)
    const unitMeta = c.units.find((u) => u.unit_number === unitNumber)
    if (!unitMeta) fail(`${c.courseId}: lessons reference unit ${unitNumber} missing from units.json`)
    const assessment = c.assessments.find((a) => a.unit_number === unitNumber) ?? null
    const nn = String(unitNumber).padStart(2, '0')
    emit(`courses/${c.courseId}/unit-${nn}.json`, {
      releaseVersion: VERSION,
      unit: unitMeta,
      lessons: lessons.map(studentLesson),
      assessment: assessment ? studentAssessment(assessment) : null,
    })
  }
}

// Per-grade catalog (course + unit summaries; no lesson bodies) and schedule.
for (const { grade, dir } of gradeDirs) {
  const gradeCourses = courses.filter((c) => c.grade === grade)
  emit(`grade-${grade}/catalog.json`, {
    releaseVersion: VERSION,
    grade,
    courses: gradeCourses.map((c) => ({
      courseId: c.courseId,
      subject: c.lessons[0].subject,
      lessonCount: c.lessons.length,
      units: c.units.map((u) => ({
        unitId: u.unit_id,
        unitNumber: u.unit_number,
        title: u.title,
        days: u.days,
        essentialQuestion: u.essential_question,
        performanceTask: u.performance_task,
        lessonIds: u.lesson_ids,
        hasAssessment: c.assessments.some((a) => a.unit_number === u.unit_number),
      })),
    })),
  })

  // daily-schedule.csv: week,day,period_1..period_N of lesson ids. Every lesson
  // must appear exactly once (re-verified here). The day column carries weekday
  // NAMES (Monday…Friday) — mapped here to 1…5 for the app's schedule lookups.
  const WEEKDAY_NUMBER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 }
  const csv = readFileSync(join(dir, 'daily-schedule.csv'), 'utf8').trim().split('\n')
  const header = csv[0].split(',')
  const titleOf = new Map(gradeCourses.flatMap((c) => c.lessons.map((l) => [l.lesson_id, l.title])))
  const scheduled = new Set()
  const days = csv.slice(1).map((line) => {
    const cells = line.split(',')
    const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']))
    const lessons = header
      .filter((h) => h.startsWith('period_'))
      .flatMap((h) => (row[h] ? row[h].split(';') : []))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((lessonId) => {
        if (!titleOf.has(lessonId)) fail(`grade ${grade} schedule references unknown ${lessonId}`)
        if (scheduled.has(lessonId)) fail(`grade ${grade} schedule repeats ${lessonId}`)
        scheduled.add(lessonId)
        return { lessonId, title: titleOf.get(lessonId) }
      })
    const dayNumber = WEEKDAY_NUMBER[row.day]
    if (!dayNumber) fail(`grade ${grade} schedule has unknown weekday "${row.day}"`)
    return { week: Number(row.week), day: dayNumber, lessons }
  })
  const gradeLessonCount = gradeCourses.reduce((n, c) => n + c.lessons.length, 0)
  if (scheduled.size !== gradeLessonCount)
    fail(`grade ${grade} schedule covers ${scheduled.size}/${gradeLessonCount} lessons`)
  const weeks = new Set(days.map((d) => d.week))
  if (weeks.size !== 36) fail(`grade ${grade} schedule has ${weeks.size} weeks, expected 36`)
  emit(`grade-${grade}/schedule.json`, { releaseVersion: VERSION, grade, days })
}

emit('release.json', {
  releaseVersion: VERSION,
  packageId: manifest.package_id,
  authoredOn: manifest.authored_on,
  grades: EXPECTED.grades,
  counts: { courses: courses.length, units: allUnitIds.size, lessons: allLessonIds.size },
  courses: courses.map((c) => ({
    courseId: c.courseId,
    grade: c.grade,
    subject: c.lessons[0].subject,
    lessonCount: c.lessons.length,
    unitCount: c.units.length,
  })),
})

console.log(
  `build-curriculum: ${VERSION} OK — ${courses.length} courses, ${allUnitIds.size} units, ${allLessonIds.size} lessons → public/curriculum/${VERSION}`,
)

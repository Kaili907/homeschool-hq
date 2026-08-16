import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CORPUS_VERSION, answerKeyRefFor, emitLesson, gradeFolder, packagePathFor } from './emit.ts'
import { ELIGIBLE_GRADES, readLessons, type EligibleGrade } from './lessonSources.ts'
import { validateLesson, type ValidationIssue } from './validate.ts'

/**
 * Emits the whole mathematics student-work corpus and validates it in the same
 * pass. Writing and checking together means a package can never be published
 * without having been checked.
 */

const outputRoot = process.argv[2] ?? process.cwd()

interface GradeSummary {
  grade: number
  courseId: string
  lessons: number
  items: number
  gradedItems: number
  workedExamples: number
  keyedAnswers: number
  itemTypes: number
}

const summaries: GradeSummary[] = []
const issues: ValidationIssue[] = []
let totalOracleRecomputed = 0
let totalGeneratorAuthority = 0

for (const directory of ['packages', 'answer-keys']) {
  rmSync(join(outputRoot, directory), { recursive: true, force: true })
}

for (const grade of ELIGIBLE_GRADES as readonly EligibleGrade[]) {
  const lessons = readLessons(grade)
  const itemTypes = new Set<string>()
  let items = 0
  let gradedItems = 0
  let workedExamples = 0
  let keyedAnswers = 0

  for (const lesson of lessons) {
    const emitted = emitLesson(lesson)
    issues.push(...validateLesson(emitted.package, emitted.answerKey, lesson))

    for (const section of emitted.package.sections) {
      for (const item of section.items) {
        items += 1
        itemTypes.add(item.itemType)
        if (item.kind === 'worked-example') workedExamples += 1
        else gradedItems += 1
      }
    }
    keyedAnswers += emitted.answerKey.answers.length
    for (const entry of emitted.answerKey.answers) {
      if (entry.verification.method === 'recomputed') totalOracleRecomputed += 1
      else totalGeneratorAuthority += 1
    }

    const packagePath = join(outputRoot, packagePathFor(lesson))
    const keyPath = join(outputRoot, answerKeyRefFor(lesson))
    mkdirSync(dirname(packagePath), { recursive: true })
    mkdirSync(dirname(keyPath), { recursive: true })
    writeFileSync(packagePath, `${JSON.stringify(emitted.package, null, 2)}\n`)
    writeFileSync(keyPath, `${JSON.stringify(emitted.answerKey, null, 2)}\n`)
  }

  summaries.push({
    grade,
    courseId: lessons[0].ref.courseId,
    lessons: lessons.length,
    items,
    gradedItems,
    workedExamples,
    keyedAnswers,
    itemTypes: itemTypes.size,
  })
  console.log(
    `grade ${String(grade).padStart(2)} (${lessons[0].ref.courseId}): lessons=${lessons.length} items=${items} graded=${gradedItems} examples=${workedExamples} keyed=${keyedAnswers} itemTypes=${itemTypes.size}`,
  )
}

const manifest = {
  corpusVersion: CORPUS_VERSION,
  subject: 'mathematics',
  generatedFrom: {
    canonicalPackage: 'curriculum-content/manuel-academy/1.0.0 (grades 5, 7, 8)',
    highSchoolAuthoring:
      'curriculum-authoring/full-family-highschool-9-12/subjects/mathematics (grades 9-12)',
    excluded: 'grades 3 and 4 — that mathematics authoring branch is still moving',
  },
  totals: {
    lessons: summaries.reduce((sum, entry) => sum + entry.lessons, 0),
    items: summaries.reduce((sum, entry) => sum + entry.items, 0),
    gradedItems: summaries.reduce((sum, entry) => sum + entry.gradedItems, 0),
    workedExamples: summaries.reduce((sum, entry) => sum + entry.workedExamples, 0),
    keyedAnswers: summaries.reduce((sum, entry) => sum + entry.keyedAnswers, 0),
  },
  answerAuthority: {
    oracleRecomputed: totalOracleRecomputed,
    generatorAuthority: totalGeneratorAuthority,
  },
  byGrade: summaries,
  paths: {
    studentPackages: 'packages/grade-XX/<lessonId>.package.json',
    answerKeys: 'answer-keys/grade-XX/<lessonId>.key.json',
  },
}
writeFileSync(join(outputRoot, 'corpus-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`\ntotals: ${JSON.stringify(manifest.totals)}`)
console.log(`answer authority: ${JSON.stringify(manifest.answerAuthority)}`)
console.log(`validation issues: ${issues.length}`)
if (issues.length > 0) {
  const byCheck = new Map<string, number>()
  for (const issue of issues) byCheck.set(issue.check, (byCheck.get(issue.check) ?? 0) + 1)
  for (const [check, count] of [...byCheck].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check}: ${count}`)
  }
  for (const issue of issues.slice(0, 10)) {
    console.log(`  e.g. ${issue.packageId} [${issue.check}] ${issue.detail}`)
  }
  process.exit(1)
}

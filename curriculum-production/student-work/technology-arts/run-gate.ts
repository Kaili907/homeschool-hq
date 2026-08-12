/**
 * Runs the shared repo Production Quality Gate
 * (src/curriculum/production-quality) against every generated task
 * package + scoring guide on disk, and writes gate-report.json /
 * gate-report.md.
 *
 * Usage: node --experimental-strip-types tooling/run-ts.mjs run-gate.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { evaluateCourseProductionReadiness } from '../../../src/curriculum/production-quality/index.ts'
import type { CourseProductionInput, CourseReadinessResult } from '../../../src/curriculum/production-quality/index.ts'

import { COURSES } from './src/courses.mjs'
import { toGateInput } from './src/generateUnitMaterials.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

const courseResults: CourseReadinessResult[] = []

for (const course of COURSES) {
  const packagesDir = resolve(HERE, 'packages', course.subjectKey, course.gradeDir)
  const scoringDir = resolve(HERE, 'scoring-guides', course.subjectKey, course.gradeDir)

  const packageFiles = readdirSync(packagesDir)
    .filter((f) => f.endsWith('.task-package.json'))
    .sort()

  const lessons = packageFiles.map((file) => {
    const unitId = file.replace('.task-package.json', '')
    const taskPackage = readJson(resolve(packagesDir, file))
    const scoringGuide = readJson(resolve(scoringDir, `${unitId}.scoring-guide.json`))
    return toGateInput(taskPackage, scoringGuide)
  })

  const courseId = lessons[0]?.courseId ?? `${course.subjectKey}-grade-${course.grade}`
  const input: CourseProductionInput = {
    courseId,
    title: `${course.subjectKey} grade ${course.grade} (${course.band})`,
    lessons,
  }

  courseResults.push(evaluateCourseProductionReadiness(input))
}

const totalLessons = courseResults.reduce((sum, c) => sum + c.gapSummary.totalLessons, 0)
const totalReady = courseResults.reduce((sum, c) => sum + c.gapSummary.readyCount, 0)
const totalNeedsReview = courseResults.reduce((sum, c) => sum + c.gapSummary.needsHumanReviewCount, 0)
const totalNotReady = courseResults.reduce((sum, c) => sum + c.gapSummary.notReadyCount, 0)

const report = {
  generatedFor: 'curriculum-production/student-work/technology-arts',
  gateSource: 'src/curriculum/production-quality (this branch, evaluateCourseProductionReadiness)',
  totals: {
    courses: courseResults.length,
    lessons: totalLessons,
    ready: totalReady,
    needsHumanReview: totalNeedsReview,
    notReady: totalNotReady,
  },
  courses: courseResults,
}

writeFileSync(resolve(HERE, 'gate-report.json'), JSON.stringify(report, null, 2) + '\n')

const mdLines: string[] = []
mdLines.push('# Production Quality Gate Report — Technology + Arts/Music')
mdLines.push('')
mdLines.push(
  `Evaluated ${totalLessons} unit task packages across ${courseResults.length} courses using the shared ` +
    '`src/curriculum/production-quality` gate (`ARTS_RFL_PE_PROJECT` subject family).',
)
mdLines.push('')
mdLines.push(`- READY: ${totalReady}`)
mdLines.push(`- NEEDS_HUMAN_REVIEW: ${totalNeedsReview}`)
mdLines.push(`- NOT_READY: ${totalNotReady}`)
mdLines.push('')
mdLines.push('## By course')
mdLines.push('')
mdLines.push('| Course | Status | Ready | Needs review | Not ready |')
mdLines.push('| --- | --- | --- | --- | --- |')
for (const c of courseResults) {
  mdLines.push(
    `| ${c.courseId} | ${c.status} | ${c.gapSummary.readyCount} | ${c.gapSummary.needsHumanReviewCount} | ${c.gapSummary.notReadyCount} |`,
  )
}

const flagged = courseResults.flatMap((c) =>
  c.lessonResults.filter((l) => l.status !== 'READY').map((l) => ({ course: c.courseId, ...l })),
)
if (flagged.length > 0) {
  mdLines.push('')
  mdLines.push('## Flagged units')
  mdLines.push('')
  for (const f of flagged) {
    mdLines.push(`- **${f.lessonId}** (${f.course}) — ${f.status}: ${f.codes.join(', ')}`)
    for (const note of f.notes) mdLines.push(`  - ${note}`)
  }
} else {
  mdLines.push('')
  mdLines.push('No flagged units.')
}

writeFileSync(resolve(HERE, 'gate-report.md'), mdLines.join('\n') + '\n')

console.log(`Gate: ${totalReady} READY / ${totalNeedsReview} NEEDS_HUMAN_REVIEW / ${totalNotReady} NOT_READY of ${totalLessons} units.`)
if (totalNotReady > 0) {
  process.exitCode = 1
}

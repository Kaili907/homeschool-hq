/**
 * Runs the repo's Production Quality Gate over every Science work package.
 *
 *   node curriculum-production/final/science/validation/run-production-quality-gate.mjs
 *
 * The gate itself is imported from `src/curriculum/production-quality` — this
 * runner projects packages into its input contract and writes the reports. It
 * exits non-zero if any lesson comes back NOT_READY.
 */

import { register } from 'node:module'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

register('./ts-loader-hook.mjs', import.meta.url)

const {
  courseIds,
  loadCoursePackages,
  loadSharedBlocks,
  projectToGateInput,
  ROOT,
  REPO_ROOT,
} = await import('./packages.mjs')

const gate = await import(
  join(REPO_ROOT, 'src/curriculum/production-quality/index.ts')
)

const blocks = loadSharedBlocks()

const courseResults = []
for (const courseId of courseIds()) {
  const packages = loadCoursePackages(courseId)
  const lessons = packages.map((pkg) => projectToGateInput(pkg, blocks))
  const result = gate.evaluateCourseProductionReadiness({
    courseId,
    title: packages[0]?.course_title ?? courseId,
    lessons,
  })
  courseResults.push({ courseId, title: packages[0]?.course_title ?? courseId, result })
}

const allLessonResults = courseResults.flatMap((entry) => entry.result.lessonResults)
const overall = gate.summarizeProductionGaps(allLessonResults)

const notReady = allLessonResults.filter((lesson) => lesson.status === 'NOT_READY')
const needsReview = allLessonResults.filter((lesson) => lesson.status === 'NEEDS_HUMAN_REVIEW')

const report = {
  gate: 'src/curriculum/production-quality',
  subject: 'science',
  totalLessons: allLessonResults.length,
  status: notReady.length === 0 ? 'PASS' : 'FAIL',
  summary: {
    ready: overall.readyCount,
    needsHumanReview: overall.needsHumanReviewCount,
    notReady: overall.notReadyCount,
  },
  codeCounts: overall.codeCounts,
  courses: courseResults.map((entry) => ({
    courseId: entry.courseId,
    title: entry.title,
    status: entry.result.status,
    ready: entry.result.gapSummary.readyCount,
    needsHumanReview: entry.result.gapSummary.needsHumanReviewCount,
    notReady: entry.result.gapSummary.notReadyCount,
  })),
  notReadyLessons: notReady.map((lesson) => ({
    lessonId: lesson.lessonId,
    codes: lesson.codes,
    notes: lesson.notes,
  })),
  needsHumanReviewLessons: needsReview.slice(0, 25).map((lesson) => ({
    lessonId: lesson.lessonId,
    notes: lesson.notes,
  })),
}

writeFileSync(
  join(ROOT, 'reports/production-quality-gate.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8',
)

const lines = [
  '# Production Quality Gate — Science student work',
  '',
  `Gate: \`${report.gate}\` · ${report.totalLessons} lessons · **${report.status}**`,
  '',
  `- READY: ${report.summary.ready}`,
  `- NEEDS_HUMAN_REVIEW: ${report.summary.needsHumanReview}`,
  `- NOT_READY: ${report.summary.notReady}`,
  '',
  '| Course | Status | Ready | Needs human review | Not ready |',
  '| --- | --- | --- | --- | --- |',
  ...report.courses.map(
    (course) =>
      `| ${course.title} | ${course.status} | ${course.ready} | ${course.needsHumanReview} | ${course.notReady} |`,
  ),
  '',
  '## Gap codes',
  '',
  '| Code | Lessons |',
  '| --- | --- |',
  ...Object.entries(report.codeCounts)
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1])
    .map(([code, count]) => `| \`${code}\` | ${count} |`),
  '',
]

if (notReady.length > 0) {
  lines.push('## NOT_READY lessons', '')
  for (const lesson of notReady.slice(0, 50)) {
    lines.push(`- \`${lesson.lessonId}\` — ${lesson.codes.join(', ')}`)
    for (const note of lesson.notes) lines.push(`  - ${note}`)
  }
  lines.push('')
}
if (needsReview.length > 0) {
  lines.push('## NEEDS_HUMAN_REVIEW sample', '')
  for (const lesson of needsReview.slice(0, 15)) {
    lines.push(`- \`${lesson.lessonId}\``)
    for (const note of lesson.notes) lines.push(`  - ${note}`)
  }
  lines.push('')
}

writeFileSync(join(ROOT, 'reports/production-quality-gate.md'), lines.join('\n'), 'utf8')

console.log(
  `production quality gate: ${report.status} — ready ${report.summary.ready}, ` +
    `needs-human-review ${report.summary.needsHumanReview}, not-ready ${report.summary.notReady}`,
)
process.exit(report.status === 'PASS' ? 0 : 1)

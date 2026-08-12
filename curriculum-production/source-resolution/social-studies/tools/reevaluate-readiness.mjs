/**
 * Re-run the shipped production readiness gate over the Social Studies
 * production input, with this registry's verified source-integrity results
 * applied. Reads the gate input read-only; writes only into this directory.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateCourseProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'

const HERE = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO = join(HERE, '..', '..', '..')
const GATE_INPUT = join(REPO, 'curriculum-production', 'student-work', 'social-studies',
  '_gate', 'production-input.json')

const registry = JSON.parse(readFileSync(join(HERE, 'source-registry.json'), 'utf8'))
const input = JSON.parse(readFileSync(GATE_INPUT, 'utf8'))

const byLesson = new Map(registry.lessons.map((l) => [l.lessonRef, l]))

let applied = 0
const courses = input.courses.map((course) => ({
  ...course,
  title: course.title ?? course.courseId,
  lessons: course.lessons.map((lesson) => {
    const entry = byLesson.get(lesson.lessonId)
    if (!entry || entry.sourceIntegrityStatus !== 'VERIFIED') return lesson
    applied += 1
    return { ...lesson, sourceIntegrityStatus: 'VERIFIED' }
  }),
}))

const results = courses.map((course) => evaluateCourseProductionReadiness(course))

const codeCounts = {}
let totalReady = 0
let totalNeedsReview = 0
let totalNotReady = 0
let totalLessons = 0
for (const r of results) {
  totalLessons += r.lessonResults.length
  totalReady += r.gapSummary.readyCount
  totalNeedsReview += r.gapSummary.needsHumanReviewCount
  totalNotReady += r.gapSummary.notReadyCount
  for (const [code, n] of Object.entries(r.gapSummary.codeCounts)) {
    codeCounts[code] = (codeCounts[code] ?? 0) + n
  }
}

const report = {
  generatedBy: 'tools/reevaluate-readiness.mjs',
  gateInput: 'curriculum-production/student-work/social-studies/_gate/production-input.json',
  registry: 'curriculum-production/source-resolution/social-studies/source-registry.json',
  sourceIntegrityOverridesApplied: applied,
  totalLessons,
  totalReady,
  totalNeedsReview,
  totalNotReady,
  codeCounts,
  courses: results.map((r) => ({
    courseId: r.courseId,
    status: r.status,
    ready: r.gapSummary.readyCount,
    needsHumanReview: r.gapSummary.needsHumanReviewCount,
    notReady: r.gapSummary.notReadyCount,
    remainingReviewLessons: r.lessonResults
      .filter((l) => l.status !== 'READY')
      .slice(0, 5)
      .map((l) => ({ lessonId: l.lessonId, codes: l.codes, notes: l.notes })),
  })),
}

writeFileSync(join(HERE, 'readiness-reevaluation.json'), JSON.stringify(report, null, 2) + '\n')

const md = [
  '# Social Studies Production Readiness -- re-evaluation after source resolution',
  '',
  `Total lessons: ${totalLessons} | READY: ${totalReady} | NEEDS_HUMAN_REVIEW: ${totalNeedsReview} | NOT_READY: ${totalNotReady}`,
  '',
  `Source-integrity overrides applied from the registry: ${applied}`,
  '',
  '| Course | Status | READY | NEEDS_HUMAN_REVIEW | NOT_READY |',
  '|---|---|---:|---:|---:|',
  ...report.courses.map((c) =>
    `| ${c.courseId} | ${c.status} | ${c.ready} | ${c.needsHumanReview} | ${c.notReady} |`),
  '',
  `Code counts: \`${JSON.stringify(codeCounts)}\``,
  '',
].join('\n')
writeFileSync(join(HERE, 'readiness-reevaluation.md'), md)

console.log(`overrides=${applied} lessons=${totalLessons} READY=${totalReady} REVIEW=${totalNeedsReview} NOT_READY=${totalNotReady}`)

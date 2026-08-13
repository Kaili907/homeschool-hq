/**
 * Re-run the shipped production readiness gate with this lane's projection
 * applied, so the readiness report and the projection cannot disagree.
 *
 * Only lessons the projection marks admissible get sourceIntegrityStatus
 * VERIFIED. A DYNAMIC_SOURCE_REQUIRED lesson with no satisfying attachment is
 * left exactly as it shipped -- it stays NEEDS_HUMAN_REVIEW, which is the whole
 * point: pending is reported as pending, not as READY.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateCourseProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'

const HERE = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO = join(HERE, '..', '..', '..')
const GATE_INPUT = join(REPO, 'curriculum-production', 'student-work', 'social-studies',
  '_gate', 'production-input.json')

const projection = JSON.parse(readFileSync(join(HERE, 'source-projection.json'), 'utf8'))
const input = JSON.parse(readFileSync(GATE_INPUT, 'utf8'))

const byLesson = new Map(projection.lessons.map((l) => [l.lessonRef, l]))

let applied = 0
let heldPending = 0
let carriedThroughUnchecked = 0
const courses = input.courses.map((course) => ({
  ...course,
  title: course.title ?? course.courseId,
  lessons: course.lessons.map((lesson) => {
    const row = byLesson.get(lesson.lessonId)
    if (!row) return lesson
    if (row.admissible === null) {
      // Outside both registries. Its gate-input assertion stands, unchecked by
      // this lane -- counted so the report can say so out loud.
      carriedThroughUnchecked += 1
      return lesson
    }
    if (row.admissible !== true) {
      if (row.sourceClass === 'DYNAMIC_SOURCE_REQUIRED' || row.sourceClass === 'UNRESOLVED') {
        heldPending += 1
      }
      return lesson
    }
    if (lesson.sourceIntegrityStatus === 'VERIFIED') return lesson
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
  projection: 'curriculum-production/source-resolution/social-studies-dynamic/source-projection.json',
  sourceIntegrityOverridesApplied: applied,
  lessonsHeldPending: heldPending,
  lessonsCarriedThroughUnchecked: carriedThroughUnchecked,
  readySplit: {
    readyOnACheckedSource: totalReady - carriedThroughUnchecked,
    readyOnTheGateInputsOwnUncheckedAssertion: carriedThroughUnchecked,
    statement: 'This lane checked the source integrity of the first group only. '
      + 'The second group -- grades 9-12 -- ships READY on the sourceIntegrityStatus '
      + 'the gate input already asserted, which no registry in this lane verified. '
      + 'Do not read this READY count as one lane\'s verification of all of it.',
  },
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

writeFileSync(join(HERE, 'readiness-after-policy.json'), JSON.stringify(report, null, 2) + '\n')

const md = [
  '# Social Studies production readiness -- with the dynamic-source policy applied',
  '',
  `Total lessons: ${totalLessons} | READY: ${totalReady} | NEEDS_HUMAN_REVIEW: ${totalNeedsReview} | NOT_READY: ${totalNotReady}`,
  '',
  `Source-integrity overrides applied from the projection: ${applied}`,
  `Lessons deliberately held pending (dynamic contract unsatisfied, or unresolved): ${heldPending}`,
  '',
  `**READY on a source this lane checked: ${totalReady - carriedThroughUnchecked}.** `
    + `The other ${carriedThroughUnchecked} READY lessons (grades 9-12) carry the gate input's own `
    + `sourceIntegrityStatus assertion, which no registry in this lane verified. The projection `
    + `records them as NOT_ASSESSED_BY_SOURCE_REGISTRY with \`admissible: null\`.`,
  '',
  '| Course | Status | READY | NEEDS_HUMAN_REVIEW | NOT_READY |',
  '|---|---|---:|---:|---:|',
  ...report.courses.map((c) =>
    `| ${c.courseId} | ${c.status} | ${c.ready} | ${c.needsHumanReview} | ${c.notReady} |`),
  '',
  `Code counts: \`${JSON.stringify(codeCounts)}\``,
  '',
].join('\n')
writeFileSync(join(HERE, 'readiness-after-policy.md'), md)

console.log(`overrides=${applied} pending=${heldPending} unchecked=${carriedThroughUnchecked} lessons=${totalLessons} READY=${totalReady} REVIEW=${totalNeedsReview} NOT_READY=${totalNotReady}`)

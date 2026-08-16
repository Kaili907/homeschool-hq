#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertPopulation,
  inspectAssessment,
  inspectLesson,
  resolveProductionRef,
  summarize,
} from './lib.mjs'
import { BLOCKING_CODES, EXPECTED } from './rules.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = resolve(HERE, '../..')
const CURRENT_EVIDENCE_BASE = '3b89a20234d2e8a2ddfa11f9de27bd8d10a82fa4'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line))
}

function parseArgs(argv) {
  const rootIndex = argv.indexOf('--root')
  return {
    root: resolve(rootIndex >= 0 ? argv[rootIndex + 1] : DEFAULT_ROOT),
    build: !argv.includes('--no-build'),
    write: argv.includes('--write'),
    json: argv.includes('--json'),
    allowFail: argv.includes('--allow-fail'),
  }
}

function scienceRecords(root) {
  const base = join(root, 'curriculum-production/final/science/packages')
  const records = new Map()
  for (const course of readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const path = join(base, course, 'work-packages.jsonl')
    for (const row of readJsonl(path)) records.set(row.lesson_id, row)
  }
  return records
}

function loadBrowserPayloads(root, runtimeManifest) {
  const output = join(root, 'public/family-pilot-final/2.0.0/courses')
  const materials = new Map()
  const runtimeRows = new Map()
  for (const course of runtimeManifest.courses) {
    const payload = readJson(join(output, `${course.courseRef}.json`))
    for (const [lessonRef, material] of Object.entries(payload.materials)) materials.set(lessonRef, material)
    for (const row of payload.lessons) runtimeRows.set(row.lessonRef, row)
  }
  return { materials, runtimeRows }
}

function loadScoring(root, ref) {
  if (typeof ref !== 'string') return null
  const path = resolveProductionRef(root, ref)
  return extname(path) === '.json' ? readJson(path) : { markdown: readFileSync(path, 'utf8') }
}

function assessmentWorkflowAvailable(root, browserManifest) {
  const app = readFileSync(join(root, 'src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx'), 'utf8')
  const projectedAssessments = Array.isArray(browserManifest.assessments)
    ? browserManifest.assessments.length
    : Object.keys(browserManifest.assessmentMaterials ?? {}).length
  return projectedAssessments === EXPECTED.assessments &&
    /assessment(?:Ref|Material|Payload)/.test(app) &&
    /(?:assign|load|play|submit).*assessment|assessment.*(?:assign|load|play|submit)/is.test(app)
}

export function runAudit(options = {}) {
  const root = resolve(options.root ?? DEFAULT_ROOT)
  if (options.build !== false) {
    execFileSync(process.execPath, ['scripts/build-final-family-pilot-data.mjs'], {
      cwd: root,
      stdio: options.quiet ? 'ignore' : 'inherit',
    })
  }

  const admitted = join(root, 'curriculum-release-admitted/family-pilot-r1')
  const bindings = readJsonl(join(admitted, 'production-bindings.jsonl'))
  const assessmentsSource = readJson(join(admitted, 'assessment-bindings.json'))
  const runtimeManifest = readJson(join(admitted, 'runtime/runtime-manifest.json'))
  const browserManifest = readJson(join(root, 'public/family-pilot-final/2.0.0/manifest.json'))
  const courses = runtimeManifest.courses
  const { materials, runtimeRows } = loadBrowserPayloads(root, runtimeManifest)
  const science = scienceRecords(root)

  if (bindings.length !== EXPECTED.lessons) throw new Error(`Lesson binding population is ${bindings.length}, expected ${EXPECTED.lessons}`)
  if (materials.size !== EXPECTED.lessons) throw new Error(`Browser material population is ${materials.size}, expected ${EXPECTED.lessons}`)
  if (new Set(bindings.map((binding) => binding.lessonRef)).size !== bindings.length) throw new Error('Lesson bindings contain duplicate lesson refs')
  if (new Set(assessmentsSource.map((assessment) => assessment.assessmentRef)).size !== assessmentsSource.length) throw new Error('Assessment bindings contain duplicate assessment refs')
  if (new Set(courses.map((course) => course.courseRef)).size !== courses.length) throw new Error('Runtime manifest contains duplicate course refs')
  for (const grade of EXPECTED.grades) {
    for (const subject of EXPECTED.subjects) {
      const cellCourses = courses.filter((course) => course.grade === grade && course.subject === subject)
      if (cellCourses.length !== 1) throw new Error(`Expected one course for grade ${grade} ${subject}, found ${cellCourses.length}`)
    }
  }

  const lessons = bindings.map((binding) => {
    const path = resolveProductionRef(root, binding.productionPackageRef)
    const raw = readFileSync(path, 'utf8')
    const isJson = extname(path) === '.json'
    return inspectLesson({
      binding,
      value: isJson ? JSON.parse(raw) : null,
      markdown: isJson ? null : raw,
      material: materials.get(binding.lessonRef),
      runtimeRow: runtimeRows.get(binding.lessonRef),
      scoring: loadScoring(root, binding.scoringAuthorityRef),
      scienceRecord: binding.subject === 'science' ? science.get(binding.lessonRef) : null,
    })
  })

  const workflowAvailable = assessmentWorkflowAvailable(root, browserManifest)
  const assessments = assessmentsSource.map((assessment) => inspectAssessment(assessment, root, workflowAvailable))
  const summary = summarize({ lessons, assessments, courses })
  assertPopulation(summary)
  return {
    schemaVersion: 1,
    evidenceBaseSha: CURRENT_EVIDENCE_BASE,
    classification: summary.releaseReady ? 'LEARNER_RELEASE_READY' : 'LEARNER_RELEASE_BLOCKED',
    negativeControls: {
      testCommand: 'npm run test:learner-release-gate',
      coveredBlockingCodes: BLOCKING_CODES,
      subjectAwarePositiveControl: 'PE, Arts/Music, and Ready for Life pass without Math-style practice/mastery fields',
    },
    ...summary,
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function matrixMarkdown(report) {
  const rows = report.matrix.map((row) =>
    `| ${row.grade} | ${row.subject} | ${row.lessons} | ${row.readyLessons} | ${row.assessments} | ${row.readyAssessments} | ${row.status} | ${row.topCodes.map((item) => `${item.code}=${item.count}`).join('; ')} |`,
  ).join('\n')
  return `# Learner release grade × subject readiness matrix

Machine result: **${report.classification}**

This matrix is generated by \`node scripts/audit-learner-release/audit.mjs --write --allow-fail\`. A cell is READY only when every lesson and assessment in that grade × subject cell passes its subject-aware source and learner-projection rules.

| Grade | Subject | Lessons | Ready lessons | Assessments | Ready assessments | Status | Leading failures |
| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |
${rows}
`
}

function reportMarkdown(report) {
  const lessonRows = BLOCKING_CODES.filter((code) => report.lessonGate.failureCounts[code] > 0)
    .map((code) => `| ${code} | ${report.lessonGate.failureCounts[code]} | ${report.samplesByCode[code].map((ref) => `\`${ref}\``).join(', ')} |`).join('\n')
  const assessmentRows = BLOCKING_CODES.filter((code) => report.assessmentGate.failureCounts[code] > 0)
    .map((code) => `| ${code} | ${report.assessmentGate.failureCounts[code]} | ${report.samplesByCode[code].map((ref) => `\`${ref}\``).join(', ')} |`).join('\n')
  const rules = Object.entries(report.subjectRules).map(([subject, rule]) => `- **${subject}:** ${rule}`).join('\n')
  return `# Learner release quality gate — current base evidence

Classification: **${report.classification}**

Audited content base: \`${report.evidenceBaseSha}\`

The gate inspected ${report.counts.lessons.toLocaleString()} admitted lessons, ${report.counts.assessments} assessments, and ${report.counts.courses} courses. File existence is only population evidence; it never makes an artifact learner-ready.

## Lesson gate

Ready: **${report.lessonGate.ready}**

Blocked: **${report.lessonGate.blocked}**

| Failure code | Lessons | First deterministic samples |
| --- | ---: | --- |
${lessonRows}

## Assessment gate

Ready: **${report.assessmentGate.ready}**

Blocked: **${report.assessmentGate.blocked}**

| Failure code | Assessments | First deterministic samples |
| --- | ---: | --- |
${assessmentRows}

## Subject rules

${rules}

## Negative controls

\`${report.negativeControls.testCommand}\` covers all ${report.negativeControls.coveredBlockingCodes.length} blocking classifications, including source/data/material removal, empty required work, placeholder shells, flattened choices, lost item refs, response-kind loss, adult/scoring leakage, unsafe source state, missing assessment material/workflow, unrunnable Technology, PE safety/equipment, Arts scaffold loss, and Financial Literacy answer disclosure. A positive control proves PE, Arts/Music, and Ready for Life are not forced through Math-shaped requirements.

## Release contract

The command exits nonzero whenever any blocking code remains, when population totals drift from 8,292 lessons / 699 assessments / 90 courses, or when the browser build cannot be inspected. The tracked JSON and matrix are evidence for this base; the command always recomputes from the current admitted release and generated learner payload.
`
}

function writeEvidence(root, report) {
  const output = join(root, 'docs/learner-release-quality')
  mkdirSync(output, { recursive: true })
  writeFileSync(join(output, 'current-base-report.json'), stableJson(report))
  writeFileSync(join(output, 'CURRENT_BASE_FAILURES.md'), reportMarkdown(report))
  writeFileSync(join(output, 'GRADE_SUBJECT_READINESS_MATRIX.md'), matrixMarkdown(report))
}

function operatorOutput(report) {
  const lessonFailures = Object.entries(report.lessonGate.failureCounts).filter(([, count]) => count > 0)
  const assessmentFailures = Object.entries(report.assessmentGate.failureCounts).filter(([, count]) => count > 0)
  return [
    `CLASSIFICATION ${report.classification}`,
    `POPULATION courses=${report.counts.courses} lessons=${report.counts.lessons} assessments=${report.counts.assessments}`,
    `LESSON_GATE ready=${report.lessonGate.ready} blocked=${report.lessonGate.blocked}`,
    ...lessonFailures.map(([code, count]) => `LESSON_FAILURE ${code}=${count}`),
    `ASSESSMENT_GATE ready=${report.assessmentGate.ready} blocked=${report.assessmentGate.blocked}`,
    ...assessmentFailures.map(([code, count]) => `ASSESSMENT_FAILURE ${code}=${count}`),
  ].join('\n')
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const report = runAudit(options)
  if (options.write) writeEvidence(options.root, report)
  process.stdout.write(options.json ? stableJson(report) : `${operatorOutput(report)}\n`)
  if (!report.releaseReady && !options.allowFail) process.exitCode = 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

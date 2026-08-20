import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceCommit =
  process.argv[2] ?? '3b89a20234d2e8a2ddfa11f9de27bd8d10a82fa4'
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
)

function sourceJson(path) {
  return JSON.parse(
    execFileSync(
      'git',
      ['-C', repositoryRoot, 'show', `${sourceCommit}:${path}`],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ),
  )
}

const manifest = sourceJson(
  'curriculum-production/final/assessments/manifest.json',
)
const admitted = sourceJson(
  'curriculum-release-admitted/family-pilot-r1/assessment-bindings.json',
)
if (
  manifest?.totals?.assessments !== 699 ||
  manifest?.assessments?.length !== 699 ||
  admitted?.length !== 699
)
  throw new Error('source_assessment_count_mismatch')

const admittedByRef = new Map(admitted.map((row) => [row.assessmentRef, row]))
const rows = manifest.assessments.map((row) => {
  const binding = admittedByRef.get(row.assessmentRef)
  if (
    !binding ||
    binding.grade !== row.grade ||
    binding.subject !== row.subject ||
    binding.releaseSlotId !== row.courseRef ||
    binding.state !== 'BOUND' ||
    binding.normalFamilyUseStatus !== 'READY'
  ) {
    throw new Error(`source_assessment_binding_mismatch:${row.assessmentRef}`)
  }
  return {
    assessmentRef: row.assessmentRef,
    courseRef: row.courseRef,
    unitRef: binding.unitRef,
    grade: row.grade,
    subject: row.subject,
    packageRef: row.packageRef,
    materialSha256: row.materialSha256,
  }
})

if (
  new Set(rows.map((row) => row.assessmentRef)).size !== 699 ||
  admitted.some(
    (row) =>
      !rows.some((candidate) => candidate.assessmentRef === row.assessmentRef),
  )
) {
  throw new Error('source_assessment_join_incomplete')
}

writeFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    'release-2.0.0-bindings.generated.json',
  ),
  `${JSON.stringify(rows, null, 2)}\n`,
  'utf8',
)

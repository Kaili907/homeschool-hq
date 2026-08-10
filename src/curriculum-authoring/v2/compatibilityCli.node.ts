import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { curriculumSchemaSetJson } from './contracts.ts'
import { importImmutableV1 } from './v1Importer.node.ts'

const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const reportDirectory = join(repositoryRoot, 'docs', 'curriculum', 'schema-set-v2')
const schemaDirectory = join(
  repositoryRoot,
  'curriculum-content',
  'manuel-academy',
  'schema-sets',
  '2.0.0',
)

const result = importImmutableV1()
mkdirSync(reportDirectory, { recursive: true })
mkdirSync(schemaDirectory, { recursive: true })
writeFileSync(
  join(reportDirectory, 'compatibility-report.json'),
  `${JSON.stringify(result.report, null, 2)}\n`,
)
writeFileSync(join(schemaDirectory, 'schema-set.json'), `${JSON.stringify(curriculumSchemaSetJson, null, 2)}\n`)

if (!result.validation.valid) {
  console.error(JSON.stringify(result.validation, null, 2))
  process.exitCode = 1
} else {
  console.log(
    `curriculum-schema-v2: compatible draft — ${result.report.counts.courses} courses, ${result.report.counts.units} units, ${result.report.counts.lessons} lessons, ${result.report.counts.assessments} assessments, ${result.report.counts.schedules} schedules`,
  )
}

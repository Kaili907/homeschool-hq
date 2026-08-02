import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GENERATED_SCHEMA_FILE_NAMES,
  STUDY_ENGINE_SCHEMA_REGISTRY,
} from './registry.ts'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const outputDirectory = join(currentDirectory, 'generated')
const checkOnly = process.argv.includes('--check')
const mismatches: string[] = []

mkdirSync(outputDirectory, { recursive: true })

for (const schema of STUDY_ENGINE_SCHEMA_REGISTRY) {
  const filename = GENERATED_SCHEMA_FILE_NAMES[schema.schemaId]
  if (!filename) throw new Error(`No generated filename registered for ${schema.schemaId}`)
  const target = join(outputDirectory, filename)
  const expected = `${JSON.stringify(schema.jsonSchema, null, 2)}\n`
  if (checkOnly) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== expected) {
      mismatches.push(filename)
    }
  } else {
    writeFileSync(target, expected, 'utf8')
  }
}

if (checkOnly && mismatches.length > 0) {
  throw new Error(`Generated JSON Schemas are stale or missing: ${mismatches.join(', ')}`)
}

if (!checkOnly) {
  process.stdout.write(
    `Generated ${STUDY_ENGINE_SCHEMA_REGISTRY.length} JSON Schemas in ${outputDirectory}\n`,
  )
}

#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { analyzeMigrationCollisions } from './migration-collision-detector.mjs'

const root = resolve(process.cwd())
const migrationsRoot = resolve(root, 'supabase/migrations')
const manifestPath = resolve(root, 'docs/study-engine-final-production/migration-manifest.json')

try {
  const [filenames, manifestText] = await Promise.all([
    readdir(migrationsRoot),
    readFile(manifestPath, 'utf8'),
  ])
  const migrationFilenames = filenames.filter((filename) => filename.endsWith('.sql'))
  const hashes = new Map(await Promise.all(migrationFilenames.map(async (filename) => {
    const source = await readFile(resolve(migrationsRoot, filename), 'utf8')
    const normalized = source.replaceAll('\r\n', '\n')
    return [filename, createHash('sha256').update(normalized).digest('hex')]
  })))
  const result = analyzeMigrationCollisions(
    migrationFilenames,
    JSON.parse(manifestText),
    hashes,
  )
  if (result.ok) {
    process.stdout.write(`migration-collision-check: READY (${result.migrationCount} migrations)\n`)
    process.exitCode = 0
  } else {
    process.stdout.write(`migration-collision-check: BLOCKED (${result.collisions.length} collisions, ${result.orderingHazards.length} ordering hazards, ${result.integrityHazards.length} integrity hazards)\n`)
    for (const collision of result.collisions) {
      process.stdout.write(`collision ${collision.version}: ${collision.files.join(', ')}\n`)
    }
    for (const hazard of result.orderingHazards) {
      const context = [hazard.filename, hazard.dependency].filter(Boolean).join(' -> ')
      process.stdout.write(`ordering ${hazard.code}${context ? `: ${context}` : ''}\n`)
    }
    for (const hazard of result.integrityHazards) {
      const context = [hazard.filename, hazard.dependency].filter(Boolean).join(' -> ')
      process.stdout.write(`integrity ${hazard.code}${context ? `: ${context}` : ''}\n`)
    }
    process.exitCode = 1
  }
} catch {
  process.stderr.write('migration-collision-check: UNAVAILABLE\n')
  process.exitCode = 1
}

#!/usr/bin/env node
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
  const result = analyzeMigrationCollisions(filenames, JSON.parse(manifestText))
  if (result.ok) {
    process.stdout.write(`migration-collision-check: READY (${result.migrationCount} migrations)\n`)
    process.exitCode = 0
  } else {
    process.stdout.write(`migration-collision-check: BLOCKED (${result.collisions.length} collisions, ${result.orderingHazards.length} ordering hazards)\n`)
    for (const collision of result.collisions) {
      process.stdout.write(`collision ${collision.version}: ${collision.files.join(', ')}\n`)
    }
    for (const hazard of result.orderingHazards) {
      const context = [hazard.filename, hazard.dependency].filter(Boolean).join(' -> ')
      process.stdout.write(`ordering ${hazard.code}${context ? `: ${context}` : ''}\n`)
    }
    process.exitCode = 1
  }
} catch {
  process.stderr.write('migration-collision-check: UNAVAILABLE\n')
  process.exitCode = 1
}

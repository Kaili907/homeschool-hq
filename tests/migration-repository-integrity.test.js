import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeMigrationCollisions } from '../scripts/migration-collision-detector.mjs'

// The detector's unit test proves the analysis is correct on synthetic input.
// This suite points the same analysis at the real repository, so a branch that
// reintroduces a timestamp collision, a same-name divergence, or an
// unregistered migration fails here instead of in production.
const root = resolve(import.meta.dirname, '..')
const migrationsRoot = resolve(root, 'supabase/migrations')
const manifestPath = resolve(root, 'docs/study-engine-final-production/migration-manifest.json')

async function readRepository() {
  const filenames = (await readdir(migrationsRoot)).filter((name) => name.endsWith('.sql'))
  const hashes = new Map(await Promise.all(filenames.map(async (filename) => {
    const source = await readFile(resolve(migrationsRoot, filename), 'utf8')
    return [filename, createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')]
  })))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  return { filenames, hashes, manifest }
}

describe('repository migration chain', () => {
  it('carries no collisions, ordering hazards, or integrity hazards', async () => {
    const { filenames, hashes, manifest } = await readRepository()
    const result = analyzeMigrationCollisions(filenames, manifest, hashes)
    expect({
      collisions: result.collisions,
      orderingHazards: result.orderingHazards,
      integrityHazards: result.integrityHazards,
    }).toEqual({ collisions: [], orderingHazards: [], integrityHazards: [] })
    expect(result.ok).toBe(true)
    expect(result.migrationCount).toBe(manifest.migrations.length)
  })

  it('fails when a branch reintroduces a timestamp collision', async () => {
    const { filenames, hashes, manifest } = await readRepository()
    const existing = manifest.migrations[manifest.migrations.length - 1]
    const colliding = `${existing.version}_academy_reintroduced_collision.sql`
    const result = analyzeMigrationCollisions([...filenames, colliding], manifest, hashes)
    expect(result.ok).toBe(false)
    expect(result.collisions).toContainEqual({
      version: existing.version,
      files: [colliding, existing.filename].sort(),
    })
  })

  it('fails when a branch changes migration content without the manifest', async () => {
    const { filenames, hashes, manifest } = await readRepository()
    const target = manifest.migrations[0].filename
    const tampered = new Map(hashes)
    tampered.set(target, 'a'.repeat(64))
    const result = analyzeMigrationCollisions(filenames, manifest, tampered)
    expect(result.ok).toBe(false)
    expect(result.integrityHazards).toContainEqual(
      expect.objectContaining({ code: 'manifest_sha256_mismatch', filename: target }),
    )
  })

  it('fails when a branch adds a migration it never registers', async () => {
    const { filenames, hashes, manifest } = await readRepository()
    const unregistered = '20260817120000_academy_unregistered_branch_migration.sql'
    const result = analyzeMigrationCollisions([...filenames, unregistered], manifest, hashes)
    expect(result.ok).toBe(false)
    expect(result.orderingHazards).toContainEqual(
      expect.objectContaining({ code: 'migration_missing_from_manifest', filename: unregistered }),
    )
  })
})

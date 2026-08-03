import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

interface ManifestEntry {
  version: string
  filename: string
  sha256: string
  dependency: string | null
  classification: 'historical-baseline' | 'executable'
  applicationStatus: string
  requiredMarkerTransition: string
  supersessionStatus: string
  supersedesSha256?: string
}

interface Manifest {
  schemaVersion: number
  projectRef: string
  hashNormalization: string
  migrations: ManifestEntry[]
}

const migrationDirectory = new URL('./migrations/', import.meta.url)
const manifestUrl = new URL(
  '../docs/study-engine-final-production/migration-manifest.json',
  import.meta.url,
)
const unsafeSession17 = '46c68426d21a79b90a3011d5fbfcca19044393887636dd845ca362f6e4e69443'

async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(manifestUrl, 'utf8')) as Manifest
}

describe('Study migration manifest consistency', () => {
  it('covers every SQL migration exactly once in strict filename and dependency order', async () => {
    const manifest = await loadManifest()
    const files = (await readdir(migrationDirectory))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort()
    const names = manifest.migrations.map((entry) => entry.filename)
    const versions = manifest.migrations.map((entry) => entry.version)
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.projectRef).toBe('ymtvzmqhfvwjtxjdmybs')
    expect(manifest.hashNormalization).toContain('LF')
    expect(names).toEqual(files)
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(versions).size).toBe(versions.length)
    expect([...names].sort()).toEqual(names)
    expect([...versions].sort()).toEqual(versions)

    manifest.migrations.forEach((entry, index) => {
      expect(entry.filename.startsWith(`${entry.version}_`)).toBe(true)
      expect(entry.dependency).toBe(index === 0 ? null : manifest.migrations[index - 1].filename)
      expect(entry.requiredMarkerTransition.length).toBeGreaterThan(0)
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  it('matches every LF-canonical SHA-256 and excludes the unsafe Session 17 bytes', async () => {
    const manifest = await loadManifest()
    for (const entry of manifest.migrations) {
      const source = await readFile(new URL(entry.filename, migrationDirectory), 'utf8')
      const actual = createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
      expect(actual, entry.filename).toBe(entry.sha256)
    }
    const executable = manifest.migrations.filter((entry) => entry.classification === 'executable')
    expect(executable.map((entry) => entry.sha256)).not.toContain(unsafeSession17)
  })

  it('classifies historical SQL as baseline-only and records the before-first-use supersession', async () => {
    const manifest = await loadManifest()
    // The v2.2 hosted chain is four migrations (profiles base, student
    // identity, household CAS, gateway usage) per the hosted ledger.
    expect(manifest.migrations.slice(0, 4).every((entry) =>
      entry.classification === 'historical-baseline' &&
      entry.applicationStatus === 'hosted-equivalent-baseline-pending-authorization',
    )).toBe(true)
    expect(manifest.migrations.slice(4).every((entry) =>
      entry.classification === 'executable' && entry.applicationStatus === 'not-applied-hosted',
    )).toBe(true)
    const corrected = manifest.migrations.find((entry) => entry.version === '20260801170000')
    expect(corrected).toMatchObject({
      supersessionStatus: 'supersedes-before-first-application',
      supersedesSha256: unsafeSession17,
    })
    expect(manifest.migrations.filter((entry) => entry.supersessionStatus !== 'current'))
      .toEqual([corrected])
  })
})

import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  evaluateMigrationPreflight,
  EXPECTED_STUDY_PROJECT_REF,
  UNSAFE_SESSION_17_SHA256,
  validateMigrationManifest,
} from './study-migration-preflight.mjs'

type Classification = 'historical-baseline' | 'executable'

interface ManifestEntry {
  version: string
  filename: string
  sha256: string
  dependency: string | null
  classification: string
  applicationStatus: string
  requiredMarkerTransition: string
  supersessionStatus: string
}

interface Manifest {
  schemaVersion: number
  projectRef: string
  migrations: ManifestEntry[]
}

const CHECKED_IN_MANIFEST_URL = new URL(
  '../docs/study-engine-final-production/migration-manifest.json',
  import.meta.url,
)
const CHECKED_IN_MIGRATIONS_URL = new URL('../supabase/migrations/', import.meta.url)

const temporaryDirectories: string[] = []

afterAll(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })))
})

function canonicalSha256(source: string) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

/**
 * Writes a real migration directory plus the manifest that describes it, so
 * every checksum, dependency and file-set assertion is exercised against files
 * on disk rather than against hand-written fixtures.
 */
async function buildFixture(classifications: Classification[], bodies?: string[]) {
  const directory = await mkdtemp(join(tmpdir(), 'study-migration-preflight-'))
  temporaryDirectories.push(directory)
  const migrations: ManifestEntry[] = []
  let dependency: string | null = null
  for (const [index, classification] of classifications.entries()) {
    const version = `2026010100${String(index).padStart(4, '0')}`
    const slug = `fixture_${String(index).padStart(2, '0')}`
    const filename = `${version}_${slug}.sql`
    const body = bodies?.[index] ?? `-- ${slug}\nselect ${index};\n`
    await writeFile(join(directory, filename), body, 'utf8')
    migrations.push({
      version,
      filename,
      sha256: canonicalSha256(body),
      dependency,
      classification,
      applicationStatus: classification === 'historical-baseline'
        ? 'hosted-equivalent-baseline-pending-authorization'
        : 'not-applied-hosted',
      requiredMarkerTransition: `${slug}_version:0->1`,
      supersessionStatus: 'current',
    })
    dependency = filename
  }
  return {
    directory,
    manifest: { schemaVersion: 1, projectRef: EXPECTED_STUDY_PROJECT_REF, migrations } satisfies Manifest,
  }
}

function approvedEvidence(checksums: string[]) {
  return {
    projectRef: EXPECTED_STUDY_PROJECT_REF,
    exactProjectVerified: true,
    foundationObjectEquivalenceReconfirmed: true,
    historicalBaselineAuthorization: true,
    migrationHistoryResolved: true,
    hostedDriftAbsent: true,
    finalMetadataRepreflightPassed: true,
    hostedMutationAuthorized: false,
    approvedExecutableChecksums: checksums,
  }
}

const HISTORICAL: Classification = 'historical-baseline'
const EXECUTABLE: Classification = 'executable'

describe('manifest-driven historical/executable boundary', () => {
  it('accepts the checked-in manifest and its real migration files', async () => {
    const manifest = JSON.parse(await readFile(CHECKED_IN_MANIFEST_URL, 'utf8')) as Manifest
    await expect(validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it.each([
    ['boundary before the checked-in one', [HISTORICAL, HISTORICAL, EXECUTABLE, EXECUTABLE, EXECUTABLE]],
    ['boundary at the checked-in one', [HISTORICAL, HISTORICAL, HISTORICAL, HISTORICAL, EXECUTABLE, EXECUTABLE]],
    [
      'boundary after the checked-in one, extended with forward migrations',
      [HISTORICAL, HISTORICAL, HISTORICAL, HISTORICAL, HISTORICAL, HISTORICAL, EXECUTABLE, EXECUTABLE, EXECUTABLE],
    ],
    ['single historical baseline and a single executable', [HISTORICAL, EXECUTABLE]],
  ])('accepts a valid manifest whose %s', async (_label, classifications) => {
    const { directory, manifest } = await buildFixture(classifications as Classification[])
    await expect(validateMigrationManifest(manifest, directory))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it('rejects a classification outside the known vocabulary', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE])
    manifest.migrations[2].classification = 'exectuable'
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-invalid')
  })

  it('rejects a historical baseline that follows an executable migration', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE, HISTORICAL, EXECUTABLE])
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-order-invalid')
  })

  it('rejects a manifest with no executable migration at all', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, HISTORICAL])
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-executable-set-empty')
  })
})

describe('manifest structural integrity', () => {
  it.each([
    [{ schemaVersion: 2, migrations: [] }],
    [{ schemaVersion: 1, migrations: [] }],
    [{ migrations: [{}] }],
    [{ schemaVersion: 1 }],
    [null],
  ])('rejects an unusable manifest envelope (%#)', async (manifest) => {
    await expect(validateMigrationManifest(manifest, tmpdir()))
      .resolves.toMatchObject({ valid: false, reasons: ['manifest-invalid-or-empty'] })
  })

  it('rejects a broken dependency chain', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE])
    manifest.migrations[2].dependency = manifest.migrations[0].filename
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-dependency-invalid')
  })

  it('rejects a non-null dependency on the first entry', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[0].dependency = manifest.migrations[1].filename
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-dependency-invalid')
  })

  it('rejects manifest entries that are not in sorted order', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE])
    manifest.migrations.reverse()
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-order-invalid')
  })

  it('rejects a duplicate version', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    // Two distinct files sharing one version: nothing else about the manifest breaks.
    const version = manifest.migrations[0].version
    const filename = `${version}_fixture_duplicate.sql`
    const body = '-- duplicate version\nselect 99;\n'
    await writeFile(join(directory, filename), body, 'utf8')
    await unlink(join(directory, manifest.migrations[1].filename))
    manifest.migrations[1] = {
      ...manifest.migrations[1],
      version,
      filename,
      sha256: canonicalSha256(body),
      dependency: manifest.migrations[0].filename,
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-version')
  })

  it('rejects a duplicate filename', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[1] = { ...manifest.migrations[1], filename: manifest.migrations[0].filename }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-filename')
  })

  it('rejects a duplicate checksum', async () => {
    const body = '-- identical body\nselect 1;\n'
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE], [body, body])
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-checksum')
  })

  it('rejects a filename that does not correspond to its version', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[1] = { ...manifest.migrations[1], version: '20991231235959' }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-filename-version-invalid')
  })
})

describe('manifest against the migration files on disk', () => {
  it('rejects a manifest entry whose file is missing', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE])
    await unlink(join(directory, manifest.migrations[2].filename))
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-file-set-mismatch')
  })

  it('rejects a migration file that the manifest does not describe', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    await writeFile(join(directory, '20991231235959_undeclared.sql'), '-- undeclared\n', 'utf8')
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-file-set-mismatch')
  })

  it('rejects an unreadable migration directory', async () => {
    const { manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    const result = await validateMigrationManifest(manifest, join(tmpdir(), 'study-migration-preflight-absent'))
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-directory-unavailable')
  })

  it('rejects a checksum that does not match the file it names', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE])
    const tampered = manifest.migrations[2].filename
    manifest.migrations[2] = { ...manifest.migrations[2], sha256: 'f'.repeat(64) }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain(`migration-checksum-mismatch:${tampered}`)
  })

  it('rejects the unsafe Session 17 checksum wherever it appears', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE, EXECUTABLE])
    manifest.migrations[2] = { ...manifest.migrations[2], sha256: UNSAFE_SESSION_17_SHA256 }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('unsafe-session-17-executable')
  })

  it('detects tampering with any checked-in migration checksum', async () => {
    const manifest = JSON.parse(await readFile(CHECKED_IN_MANIFEST_URL, 'utf8')) as Manifest
    for (const index of manifest.migrations.keys()) {
      const tampered = {
        ...manifest,
        migrations: manifest.migrations.map((entry, position) =>
          position === index ? { ...entry, sha256: 'f'.repeat(64) } : entry),
      }
      const result = await validateMigrationManifest(tampered, CHECKED_IN_MIGRATIONS_URL)
      expect(result.valid).toBe(false)
      expect(result.reasons).toContain(`migration-checksum-mismatch:${manifest.migrations[index].filename}`)
    }
  })
})

describe('hosted Study migration authorization preflight', () => {
  const manifest = {
    schemaVersion: 1,
    migrations: [
      { classification: 'historical-baseline', supersessionStatus: 'current', sha256: 'a'.repeat(64) },
      { classification: 'executable', supersessionStatus: 'current', sha256: 'b'.repeat(64) },
      { classification: 'executable', supersessionStatus: 'current', sha256: 'c'.repeat(64) },
    ],
  }
  const checksums = ['b'.repeat(64), 'c'.repeat(64)]

  it('allows only an exact fully approved evidence and checksum set', () => {
    expect(evaluateMigrationPreflight(approvedEvidence(checksums), manifest))
      .toMatchObject({ allowed: true, reasons: [], checksums })
  })

  it('derives the executable checksum set from the checked-in manifest', async () => {
    const checkedIn = JSON.parse(await readFile(CHECKED_IN_MANIFEST_URL, 'utf8')) as Manifest
    const expected = checkedIn.migrations
      .filter((entry) => entry.classification === 'executable' && entry.supersessionStatus !== 'superseded')
      .map((entry) => entry.sha256)
    expect(evaluateMigrationPreflight(approvedEvidence(expected), checkedIn))
      .toMatchObject({ allowed: true, reasons: [] })
  })

  it.each([
    ['projectRef', 'wrong-project', 'exact-project-not-verified'],
    ['exactProjectVerified', false, 'exact-project-not-verified'],
    ['foundationObjectEquivalenceReconfirmed', false, 'foundation-equivalence-not-reconfirmed'],
    ['historicalBaselineAuthorization', false, 'historical-baseline-authorization-absent'],
    ['migrationHistoryResolved', false, 'migration-history-unresolved'],
    ['hostedDriftAbsent', false, 'hosted-drift-present-or-unknown'],
    ['finalMetadataRepreflightPassed', false, 'final-metadata-repreflight-not-passed'],
    ['hostedMutationAuthorized', true, 'evidence-must-not-authorize-hosted-mutation'],
  ])('refuses %s drift', (key, value, reason) => {
    const result = evaluateMigrationPreflight({ ...approvedEvidence(checksums), [key]: value }, manifest)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain(reason)
  })

  it('refuses an approved checksum set in the wrong order', () => {
    const result = evaluateMigrationPreflight(approvedEvidence([...checksums].reverse()), manifest)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('final-checksum-set-not-approved')
  })

  it.each([
    ['an empty approval', []],
    ['a truncated approval', ['b'.repeat(64)]],
    ['an inflated approval', [...checksums, 'd'.repeat(64)]],
  ])('refuses %s', (_label, approved) => {
    const result = evaluateMigrationPreflight(approvedEvidence(approved), manifest)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('final-checksum-set-not-approved')
  })

  it('refuses an empty executable checksum set', () => {
    const historicalOnly = {
      schemaVersion: 1,
      migrations: [{ classification: 'historical-baseline', supersessionStatus: 'current', sha256: 'a'.repeat(64) }],
    }
    const result = evaluateMigrationPreflight(approvedEvidence([]), historicalOnly)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('unsafe-or-empty-executable-checksum-set')
  })

  it('refuses the superseded unsafe Session 17 checksum', () => {
    const unsafe = {
      schemaVersion: 1,
      migrations: [
        { classification: 'historical-baseline', supersessionStatus: 'current', sha256: 'a'.repeat(64) },
        { classification: 'executable', supersessionStatus: 'current', sha256: UNSAFE_SESSION_17_SHA256 },
      ],
    }
    const result = evaluateMigrationPreflight(approvedEvidence([UNSAFE_SESSION_17_SHA256]), unsafe)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('unsafe-or-empty-executable-checksum-set')
  })
})

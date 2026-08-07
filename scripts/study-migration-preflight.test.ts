import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  ALLOWED_APPLICATION_STATUS,
  evaluateMigrationPreflight,
  EXPECTED_STUDY_PROJECT_REF,
  FROZEN_HISTORICAL_BASELINE_DEMOTED,
  FROZEN_HISTORICAL_BASELINE_FILENAMES,
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

/** A fresh in-memory copy of the real manifest, so each test mutates its own. */
async function checkedInManifest(): Promise<Manifest> {
  return JSON.parse(await readFile(CHECKED_IN_MANIFEST_URL, 'utf8')) as Manifest
}

function executableSha256(manifest: Manifest) {
  return manifest.migrations
    .filter((entry) => entry.classification === 'executable' && entry.supersessionStatus !== 'superseded')
    .map((entry) => entry.sha256)
}

/**
 * How a fixture lays down the frozen historical floor:
 *   'frozen'  — all members present as historical baselines: the only legal shape
 *   'omitted' — no floor at all, for tests that must build an illegal manifest
 *   Map       — floor filename -> the filename to write instead, or null to drop it,
 *               which is how deletion and rename are exercised without disturbing
 *               anything else about the manifest
 */
type Floor = 'frozen' | 'omitted' | ReadonlyMap<string, string | null>

/**
 * Writes a real migration directory plus the manifest that describes it, so every
 * checksum, dependency and file-set assertion is exercised against files on disk
 * rather than against hand-written fixtures.
 *
 * Every fixture is rooted in the frozen historical floor, because a manifest without
 * it is not one this estate can ever legally present. `classifications` describes the
 * entries that follow the floor; their versions sort after every floor member, so the
 * boundary they create is a boundary above already-hosted work.
 */
async function buildFixture(
  classifications: Classification[],
  options: { bodies?: string[], floor?: Floor } = {},
) {
  const { bodies, floor = 'frozen' } = options
  const directory = await mkdtemp(join(tmpdir(), 'study-migration-preflight-'))
  temporaryDirectories.push(directory)
  const migrations: ManifestEntry[] = []
  let dependency: string | null = null

  async function append(filename: string, body: string, classification: Classification, marker: string) {
    await writeFile(join(directory, filename), body, 'utf8')
    migrations.push({
      version: filename.slice(0, 14),
      filename,
      sha256: canonicalSha256(body),
      dependency,
      classification,
      applicationStatus: ALLOWED_APPLICATION_STATUS.get(classification)!,
      requiredMarkerTransition: marker,
      supersessionStatus: 'current',
    })
    dependency = filename
  }

  if (floor !== 'omitted') {
    for (const [index, member] of FROZEN_HISTORICAL_BASELINE_FILENAMES.entries()) {
      const written = floor === 'frozen' || !floor.has(member) ? member : floor.get(member)
      if (written === null || written === undefined) continue
      await append(written, `-- floor ${index}\nselect ${index};\n`, 'historical-baseline', `floor_${index}:0->1`)
    }
  }

  const aboveFloor = migrations.length
  for (const [index, classification] of classifications.entries()) {
    const slug = `fixture_${String(index).padStart(2, '0')}`
    await append(
      `2026090100${String(index).padStart(4, '0')}_${slug}.sql`,
      bodies?.[index] ?? `-- ${slug}\nselect ${index};\n`,
      classification,
      `${slug}_version:0->1`,
    )
  }

  return {
    directory,
    aboveFloor,
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
const GATEWAY_USAGE = '20260731120000_academy_gateway_usage.sql'

describe('manifest-driven historical/executable boundary', () => {
  it('accepts the checked-in manifest and its real migration files', async () => {
    await expect(validateMigrationManifest(await checkedInManifest(), CHECKED_IN_MIGRATIONS_URL))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it.each([
    ['sits directly on the frozen floor', [EXECUTABLE, EXECUTABLE]],
    ['has one promoted migration above the floor', [HISTORICAL, EXECUTABLE, EXECUTABLE]],
    ['has several promoted migrations above the floor', [HISTORICAL, HISTORICAL, HISTORICAL, EXECUTABLE]],
    ['has a single executable above the floor', [EXECUTABLE]],
  ])('accepts a valid manifest whose boundary %s', async (_label, classifications) => {
    const { directory, manifest } = await buildFixture(classifications as Classification[])
    await expect(validateMigrationManifest(manifest, directory))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it('rejects a classification outside the known vocabulary', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations.at(-1)!.classification = 'exectuable'
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
})

/**
 * This manifest lineage is an append-only chain rooted in migrations that already
 * exist on the hosted project, so a legal manifest always has a nonempty
 * historical prefix and a nonempty executable suffix. Both degenerate shapes are
 * permanently illegal, not merely unusual.
 */
describe('nonempty historical prefix and nonempty executable suffix', () => {
  it.each([
    ['an all-historical manifest', [HISTORICAL, HISTORICAL, HISTORICAL], 'frozen' as Floor],
    ['a manifest with zero entries above the floor', [], 'frozen' as Floor],
  ])('rejects %s', async (_label, classifications) => {
    const { directory, manifest } = await buildFixture(classifications as Classification[])
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-executable-set-empty')
  })

  it.each([
    ['an all-executable manifest', [EXECUTABLE, EXECUTABLE, EXECUTABLE]],
    ['a manifest with zero historical baselines', [EXECUTABLE]],
  ])('rejects %s', async (_label, classifications) => {
    // A manifest with no historical prefix necessarily has no frozen floor either, so
    // it is refused twice over; this case pins the shape rule specifically.
    const { directory, manifest } = await buildFixture(classifications as Classification[], { floor: 'omitted' })
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-historical-baseline-set-empty')
    expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  })
})

describe('classification and hosted application status correspondence', () => {
  it('pins the closed allowed mapping', () => {
    expect([...ALLOWED_APPLICATION_STATUS]).toEqual([
      ['historical-baseline', 'hosted-equivalent-baseline-pending-authorization'],
      ['executable', 'not-applied-hosted'],
    ])
  })

  it.each([...ALLOWED_APPLICATION_STATUS])('accepts %s carrying %s', async (classification, status) => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    const index = manifest.migrations.findIndex((entry) => entry.classification === classification)
    manifest.migrations[index].applicationStatus = status
    await expect(validateMigrationManifest(manifest, directory))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it('rejects an executable entry carrying the historical hosted-equivalence status', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations.at(-1)!.applicationStatus = 'hosted-equivalent-baseline-pending-authorization'
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
  })

  it('rejects a historical baseline masquerading as a pending-apply executable entry', async () => {
    const { directory, manifest, aboveFloor } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[aboveFloor].applicationStatus = 'not-applied-hosted'
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
  })

  it('rejects an application status outside the closed mapping', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations.at(-1)!.applicationStatus = 'applied-hosted'
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
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
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations.at(-1)!.dependency = manifest.migrations[0].filename
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
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations.reverse()
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-order-invalid')
  })

  it('rejects a duplicate version', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    // Two distinct files sharing one version: nothing else about the manifest breaks.
    const previous = manifest.migrations.at(-2)!
    const replaced = manifest.migrations.at(-1)!
    const filename = `${previous.version}_fixture_duplicate.sql`
    const body = '-- duplicate version\nselect 99;\n'
    await writeFile(join(directory, filename), body, 'utf8')
    await unlink(join(directory, replaced.filename))
    manifest.migrations[manifest.migrations.length - 1] = {
      ...replaced,
      version: previous.version,
      filename,
      sha256: canonicalSha256(body),
      dependency: previous.filename,
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-version')
  })

  it('rejects a duplicate filename', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[manifest.migrations.length - 1] = {
      ...manifest.migrations.at(-1)!,
      filename: manifest.migrations.at(-2)!.filename,
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-filename')
  })

  it('rejects a duplicate checksum', async () => {
    const body = '-- identical body\nselect 1;\n'
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE], { bodies: [body, body] })
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('duplicate-migration-checksum')
  })

  it('rejects a filename that does not correspond to its version', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    manifest.migrations[manifest.migrations.length - 1] = {
      ...manifest.migrations.at(-1)!,
      version: '20991231235959',
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-filename-version-invalid')
  })
})

describe('manifest against the migration files on disk', () => {
  it('rejects a manifest entry whose file is missing', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    await unlink(join(directory, manifest.migrations.at(-1)!.filename))
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
    const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
    const tampered = manifest.migrations.at(-1)!.filename
    manifest.migrations[manifest.migrations.length - 1] = {
      ...manifest.migrations.at(-1)!,
      sha256: 'f'.repeat(64),
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain(`migration-checksum-mismatch:${tampered}`)
  })

  it('rejects the unsafe Session 17 checksum wherever it appears', async () => {
    const { directory, manifest } = await buildFixture([EXECUTABLE, EXECUTABLE])
    manifest.migrations[manifest.migrations.length - 1] = {
      ...manifest.migrations.at(-1)!,
      sha256: UNSAFE_SESSION_17_SHA256,
    }
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('unsafe-session-17-executable')
  })

  it('detects tampering with any checked-in migration checksum', async () => {
    const manifest = await checkedInManifest()
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

/**
 * A read-only provenance audit established that the frozen members exist in the
 * hosted historical ledger and are permanently non-replayable. Every shape rule above
 * constrains where the historical/executable boundary may sit; these constrain which
 * migrations may sit below it. The two are independent: a manifest that moves the
 * boundary back over an already-hosted migration still presents a perfectly ordered
 * historical prefix and executable suffix, which is exactly why the shape rules alone
 * let the demotion through.
 */
describe('frozen hosted historical baseline floor', () => {
  it('pins the audited floor membership', () => {
    expect([...FROZEN_HISTORICAL_BASELINE_FILENAMES]).toEqual([
      '20260724074106_academy_profiles_base.sql',
      '20260724230000_academy_student_identity_foundation.sql',
      '20260726120000_academy_household_revision_cas.sql',
      '20260731120000_academy_gateway_usage.sql',
    ])
  })

  it('holds every floor member as a historical baseline in the checked-in manifest', async () => {
    const manifest = await checkedInManifest()
    for (const filename of FROZEN_HISTORICAL_BASELINE_FILENAMES) {
      expect(manifest.migrations.find((entry) => entry.filename === filename), filename)
        .toMatchObject({
          classification: 'historical-baseline',
          applicationStatus: 'hosted-equivalent-baseline-pending-authorization',
        })
    }
  })

  it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])('rejects demoting %s to executable', async (filename) => {
    const manifest = await checkedInManifest()
    Object.assign(manifest.migrations.find((entry) => entry.filename === filename)!, {
      classification: 'executable',
      applicationStatus: 'not-applied-hosted',
    })
    const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  })

  it('is the only rule that catches a demotion of the last floor member', async () => {
    // The exact hole this session closes. Demoting the newest floor member leaves the
    // manifest legal by every other rule — ordered, dependency-chained, correctly
    // paired, checksums intact — so the reason set is a single entry.
    const manifest = await checkedInManifest()
    Object.assign(manifest.migrations.find((entry) => entry.filename === GATEWAY_USAGE)!, {
      classification: 'executable',
      applicationStatus: 'not-applied-hosted',
    })
    const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    expect(result.reasons).toEqual([FROZEN_HISTORICAL_BASELINE_DEMOTED])
  })

  it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])('rejects deleting %s', async (filename) => {
    // Deleted from the manifest and from disk, with the dependency chain closed over
    // the gap: everything else about this manifest is legal.
    const { directory, manifest } = await buildFixture([EXECUTABLE, EXECUTABLE], {
      floor: new Map([[filename, null]]),
    })
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.reasons).toEqual([FROZEN_HISTORICAL_BASELINE_DEMOTED])
  })

  it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])('rejects renaming %s', async (filename) => {
    // Renamed consistently in the manifest, on disk, and in the dependency chain, so
    // the file set and every checksum still agree. Only membership notices.
    const renamed = filename.replace(/\.sql$/, '_renamed.sql')
    const { directory, manifest } = await buildFixture([EXECUTABLE, EXECUTABLE], {
      floor: new Map([[filename, renamed]]),
    })
    expect(manifest.migrations.some((entry) => entry.filename === renamed)).toBe(true)
    const result = await validateMigrationManifest(manifest, directory)
    expect(result.reasons).toEqual([FROZEN_HISTORICAL_BASELINE_DEMOTED])
  })

  it('leaves a floor member that keeps its classification to the status pairing rule', async () => {
    // Division of labour: membership pins classification, the closed mapping pins the
    // status. A floor member wearing the wrong status is caught, but not by this rule.
    const manifest = await checkedInManifest()
    manifest.migrations.find((entry) => entry.filename === GATEWAY_USAGE)!
      .applicationStatus = 'not-applied-hosted'
    const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
    expect(result.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  })

  it('leaves floor members reordered against each other to the ordering rules', async () => {
    // Identity is preserved — all four are present as historical baselines — so this
    // rule stays silent and the sequence rules speak instead.
    const manifest = await checkedInManifest()
    const [first, second, ...rest] = manifest.migrations
    manifest.migrations = [second, first, ...rest]
    const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-order-invalid')
    expect(result.reasons).toContain('migration-dependency-invalid')
    expect(result.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  })

  it('stays silent on the intact checked-in manifest', async () => {
    const manifest = await checkedInManifest()
    const validation = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    const preflight = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
    expect(validation.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
    expect(preflight.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
    expect(preflight.allowed).toBe(true)
  })
})

/**
 * The floor is enforced in the authorization gate as well as in manifest validation,
 * because the executable checksum set is derived from `classification` alone. Demoting
 * an already-hosted migration mints a new executable entry, and an evidence record
 * rewritten alongside the manifest approves that enlarged set without the equality
 * tripwire making a sound. Every case below is internally consistent on purpose.
 */
describe('frozen floor survives coordinated evidence re-approval', () => {
  it('refuses a demotion even when the evidence approves the enlarged checksum set', async () => {
    const manifest = await checkedInManifest()
    Object.assign(manifest.migrations.find((entry) => entry.filename === GATEWAY_USAGE)!, {
      classification: 'executable',
      applicationStatus: 'not-applied-hosted',
    })
    const reapproved = executableSha256(manifest)
    expect(reapproved).toContain(
      manifest.migrations.find((entry) => entry.filename === GATEWAY_USAGE)!.sha256,
    )
    const result = evaluateMigrationPreflight(approvedEvidence(reapproved), manifest)
    expect(result.reasons).not.toContain('final-checksum-set-not-approved')
    expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
    expect(result.allowed).toBe(false)
  })

  it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])(
    'refuses an approval whose manifest deleted %s',
    async (filename) => {
      const manifest = await checkedInManifest()
      manifest.migrations = manifest.migrations.filter((entry) => entry.filename !== filename)
      const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
      expect(result.reasons).not.toContain('final-checksum-set-not-approved')
      expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
      expect(result.allowed).toBe(false)
    },
  )

  it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])(
    'refuses an approval whose manifest renamed %s',
    async (filename) => {
      const manifest = await checkedInManifest()
      manifest.migrations.find((entry) => entry.filename === filename)!.filename =
        filename.replace(/\.sql$/, '_renamed.sql')
      const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
      expect(result.reasons).not.toContain('final-checksum-set-not-approved')
      expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
      expect(result.allowed).toBe(false)
    },
  )
})

/**
 * The floor is a floor, not a ceiling. Applying an executable migration promotes it to
 * a historical baseline, which grows the historical set above the audited four; that
 * must stay legal at every size, and must stop only where the manifest would run out
 * of executable work entirely.
 */
describe('legal growth above the frozen floor', () => {
  async function promoteFirstExecutables(count: number) {
    const manifest = await checkedInManifest()
    for (const entry of manifest.migrations.filter((candidate) => candidate.classification === 'executable').slice(0, count)) {
      entry.classification = 'historical-baseline'
      entry.applicationStatus = ALLOWED_APPLICATION_STATUS.get('historical-baseline')!
    }
    return manifest
  }

  it('accepts promoting the next executable migration to a historical baseline', async () => {
    const manifest = await promoteFirstExecutables(1)
    const historical = manifest.migrations.filter((entry) => entry.classification === 'historical-baseline')
    expect(historical).toHaveLength(FROZEN_HISTORICAL_BASELINE_FILENAMES.length + 1)
    await expect(validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })

  it('keeps every frozen member present through that promotion', async () => {
    const manifest = await promoteFirstExecutables(1)
    for (const filename of FROZEN_HISTORICAL_BASELINE_FILENAMES) {
      expect(manifest.migrations.find((entry) => entry.filename === filename), filename)
        .toMatchObject({ classification: 'historical-baseline' })
    }
  })

  it('accepts every further promotion up to the last executable migration', async () => {
    const checkedIn = await checkedInManifest()
    const executables = checkedIn.migrations.filter((entry) => entry.classification === 'executable').length
    expect(executables).toBeGreaterThan(1)
    for (let promoted = 1; promoted < executables; promoted += 1) {
      const manifest = await promoteFirstExecutables(promoted)
      await expect(validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL), `promoted ${promoted}`)
        .resolves.toMatchObject({ valid: true, reasons: [] })
      expect(
        evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest),
        `promoted ${promoted}`,
      ).toMatchObject({ allowed: true, reasons: [] })
    }
  })

  it('stops at the shape rule, not the floor, when every executable is promoted', async () => {
    const checkedIn = await checkedInManifest()
    const executables = checkedIn.migrations.filter((entry) => entry.classification === 'executable').length
    const manifest = await promoteFirstExecutables(executables)
    const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
    expect(result.valid).toBe(false)
    expect(result.reasons).toContain('migration-executable-set-empty')
    expect(result.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  })

  it('accepts a forward migration appended above a grown historical set', async () => {
    const { directory, manifest } = await buildFixture([HISTORICAL, HISTORICAL, EXECUTABLE, EXECUTABLE])
    expect(manifest.migrations.filter((entry) => entry.classification === 'historical-baseline'))
      .toHaveLength(FROZEN_HISTORICAL_BASELINE_FILENAMES.length + 2)
    await expect(validateMigrationManifest(manifest, directory))
      .resolves.toMatchObject({ valid: true, reasons: [] })
  })
})

function classified(classification: Classification, sha256: string, filename?: string) {
  return {
    classification,
    applicationStatus: ALLOWED_APPLICATION_STATUS.get(classification),
    supersessionStatus: 'current',
    sha256,
    filename: filename ?? `2026090100000${sha256.slice(0, 1)}_synthetic.sql`,
  }
}

/**
 * evaluateMigrationPreflight reads the manifest and never the disk, so a preflight
 * fixture carries the frozen floor as manifest entries. Without it every fixture below
 * would be refused for a reason these tests are not about.
 */
function preflightManifest(...aboveFloor: ReturnType<typeof classified>[]) {
  return {
    schemaVersion: 1,
    migrations: [
      ...FROZEN_HISTORICAL_BASELINE_FILENAMES.map((filename, index) =>
        classified(HISTORICAL, String(index).repeat(64), filename)),
      ...aboveFloor,
    ],
  }
}

describe('hosted Study migration authorization preflight', () => {
  const manifest = preflightManifest(
    classified(HISTORICAL, 'a'.repeat(64)),
    classified(EXECUTABLE, 'b'.repeat(64)),
    classified(EXECUTABLE, 'c'.repeat(64)),
  )
  const checksums = ['b'.repeat(64), 'c'.repeat(64)]

  it('allows only an exact fully approved evidence and checksum set', () => {
    expect(evaluateMigrationPreflight(approvedEvidence(checksums), manifest))
      .toMatchObject({ allowed: true, reasons: [], checksums })
  })

  it('derives the executable checksum set from the checked-in manifest', async () => {
    const checkedIn = await checkedInManifest()
    expect(evaluateMigrationPreflight(approvedEvidence(executableSha256(checkedIn)), checkedIn))
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
    const historicalOnly = preflightManifest(classified(HISTORICAL, 'a'.repeat(64)))
    const result = evaluateMigrationPreflight(approvedEvidence([]), historicalOnly)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('unsafe-or-empty-executable-checksum-set')
  })

  it('refuses the superseded unsafe Session 17 checksum', () => {
    const unsafe = preflightManifest(classified(EXECUTABLE, UNSAFE_SESSION_17_SHA256))
    const result = evaluateMigrationPreflight(approvedEvidence([UNSAFE_SESSION_17_SHA256]), unsafe)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('unsafe-or-empty-executable-checksum-set')
  })

  it('refuses an executable entry carrying the baseline status even when the checksums are re-approved', () => {
    const masquerading = preflightManifest({
      ...classified(EXECUTABLE, 'b'.repeat(64)),
      applicationStatus: 'hosted-equivalent-baseline-pending-authorization',
    })
    // The rewrite is internally consistent: the evidence approves exactly the
    // checksum set the rewritten manifest derives, so the checksum tripwire is
    // silent. Only the classification/status cross-check catches it.
    const result = evaluateMigrationPreflight(approvedEvidence(['b'.repeat(64)]), masquerading)
    expect(result.reasons).not.toContain('final-checksum-set-not-approved')
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
  })

  it('refuses a historical baseline masquerading as a pending-apply entry', () => {
    const masquerading = preflightManifest(
      { ...classified(HISTORICAL, 'a'.repeat(64)), applicationStatus: 'not-applied-hosted' },
      classified(EXECUTABLE, 'b'.repeat(64)),
    )
    const result = evaluateMigrationPreflight(approvedEvidence(['b'.repeat(64)]), masquerading)
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('migration-classification-status-mismatch')
  })
})

/**
 * `approvedExecutableChecksums` is a separate-authorization tripwire, not a
 * cryptographic proof of classification. Exact ordered equality proves only that
 * the evidence record and the manifest agree; it says nothing about who wrote
 * either one. One actor holding both can always make them agree. These tests pin
 * that boundary so the guarantee is never overstated — and are not licence to
 * weaken the equality, which still catches every case where the two records were
 * authored apart and drifted.
 */
describe('checksum equality as a separate-authorization tripwire', () => {
  it('stays silent when one actor rewrites the manifest and the evidence together', () => {
    const rewritten = preflightManifest(classified(EXECUTABLE, 'e'.repeat(64)))
    const result = evaluateMigrationPreflight(approvedEvidence(['e'.repeat(64)]), rewritten)
    expect(result.reasons).not.toContain('final-checksum-set-not-approved')
    expect(result.allowed).toBe(true)
  })

  it('still catches an evidence record that drifted from the manifest it approves', () => {
    const result = evaluateMigrationPreflight(
      approvedEvidence(['e'.repeat(64)]),
      preflightManifest(classified(EXECUTABLE, 'f'.repeat(64))),
    )
    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain('final-checksum-set-not-approved')
  })
})

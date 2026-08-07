import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  ALLOWED_APPLICATION_STATUS,
  evaluateMigrationPreflight,
  executableChecksums,
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

/**
 * Any hosted application status the classification declares. A classification now
 * admits a set rather than a single value, and a fixture that is not about the status
 * only needs a legal one; derived rather than restated so a vocabulary change cannot
 * leave the fixtures asserting against a value the validator no longer accepts.
 */
function allowedStatus(classification: Classification) {
  return [...ALLOWED_APPLICATION_STATUS.get(classification)!][0]
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
      applicationStatus: allowedStatus(classification),
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

/**
 * The four foundation migrations the Aug 2 2026 reset left in the hosted ledger, and
 * the six Study migrations the Aug 3 2026 DDL burst applied to it. Restated literally
 * and never derived, because this is a claim about hosted history rather than a view
 * of the manifest: a list computed from the manifest would agree with whatever the
 * manifest happens to say, which is exactly the agreement these two lists exist to
 * refuse. See `hosted-applied-evidence.json` for the provenance and its limits.
 */
const HOSTED_APPLIED_FOUNDATION_FILENAMES = [
  '20260724074106_academy_profiles_base.sql',
  '20260724230000_academy_student_identity_foundation.sql',
  '20260726120000_academy_household_revision_cas.sql',
  '20260731120000_academy_gateway_usage.sql',
]

const HOSTED_APPLIED_STUDY_FILENAMES = [
  '20260801010000_academy_study_engine_storage.sql',
  '20260801011000_academy_study_engine_authorization.sql',
  '20260801012000_academy_study_engine_production_reconciliation.sql',
  '20260801160000_academy_study_verified_identity.sql',
  '20260801170000_academy_study_adult_review_operations.sql',
  '20260801190000_academy_study_final_production_reconciliation.sql',
]

const HOSTED_APPLIED_FILENAMES = [
  ...HOSTED_APPLIED_FOUNDATION_FILENAMES,
  ...HOSTED_APPLIED_STUDY_FILENAMES,
]

/**
 * An already-applied migration can never be offered as executable work, and the gate
 * reads that offer out of `classification` alone. This is the trap the reconciliation
 * closes: before it, all six Study migrations sat in the executable checksum set, so
 * an authorized preflight would have replayed DDL that ran against hosted on Aug 3.
 */
describe('hosted-applied migrations are never executable work', () => {
  it.each(HOSTED_APPLIED_STUDY_FILENAMES)(
    'keeps the already-applied %s out of the executable checksum set',
    async (filename) => {
      const manifest = await checkedInManifest()
      const entry = manifest.migrations.find((candidate) => candidate.filename === filename)
      expect(entry, filename).toBeDefined()
      expect(entry!.classification, filename).toBe(HISTORICAL)
      expect(executableChecksums(manifest), filename).not.toContain(entry!.sha256)
    },
  )

  it('leaves exactly one executable migration on this lineage', async () => {
    const manifest = await checkedInManifest()
    expect(manifest.migrations.filter((entry) => entry.classification === EXECUTABLE)
      .map((entry) => entry.filename))
      .toEqual(['20260806120000_academy_study_in_app_receipt_timestamp.sql'])
  })

  it('records every hosted-applied migration as ledger-recorded', async () => {
    const manifest = await checkedInManifest()
    for (const filename of HOSTED_APPLIED_FILENAMES) {
      expect(manifest.migrations.find((entry) => entry.filename === filename), filename)
        .toMatchObject({
          classification: HISTORICAL,
          applicationStatus: 'hosted-applied-ledger-recorded',
        })
    }
  })
})

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

/**
 * A classification admits a SET of hosted application statuses, not one status. A
 * historical baseline is a hosted object whose local definition was confirmed
 * equivalent; whether its hosted ledger row is merely awaiting separate authorization
 * or is already recorded as applied is a second, independent fact about the same
 * migration, and both are legal states for the same classification. An executable
 * migration has never run against the hosted project, so it admits exactly one.
 *
 * The cross-product is enumerated rather than sampled: every declared classification
 * against every declared status, each row stating whether the pairing is legal. The
 * coverage test below fails the moment the vocabulary grows without a row to match,
 * so a new status cannot be introduced with its illegal pairings left unasserted.
 */
const APPLICATION_STATUS_MATRIX: readonly (readonly [Classification, string, boolean])[] = [
  [HISTORICAL, 'hosted-equivalent-baseline-pending-authorization', true],
  [HISTORICAL, 'hosted-applied-ledger-recorded', true],
  [HISTORICAL, 'not-applied-hosted', false],
  [EXECUTABLE, 'not-applied-hosted', true],
  [EXECUTABLE, 'hosted-applied-ledger-recorded', false],
  [EXECUTABLE, 'hosted-equivalent-baseline-pending-authorization', false],
]

describe('classification and hosted application status correspondence', () => {
  it('pins the closed allowed vocabulary', () => {
    expect([...ALLOWED_APPLICATION_STATUS].map(([classification, statuses]) =>
      [classification, [...statuses]])).toEqual([
      ['historical-baseline', [
        'hosted-equivalent-baseline-pending-authorization',
        'hosted-applied-ledger-recorded',
      ]],
      ['executable', ['not-applied-hosted']],
    ])
  })

  it('enumerates every declared classification against every declared status', () => {
    // A per-pairing test list is always one vocabulary change behind. Deriving the
    // expected cross-product from the validator's own declaration makes the matrix
    // above fail first, rather than silently covering a shrinking fraction of it.
    const statuses = [...new Set([...ALLOWED_APPLICATION_STATUS.values()].flatMap((set) => [...set]))]
    const expected = [...ALLOWED_APPLICATION_STATUS.keys()]
      .flatMap((classification) => statuses.map((status) => `${classification}|${status}`))
    expect(APPLICATION_STATUS_MATRIX.map(([classification, status]) => `${classification}|${status}`).sort())
      .toEqual(expected.sort())
  })

  it.each(APPLICATION_STATUS_MATRIX.filter(([, , legal]) => legal))(
    'accepts %s carrying %s',
    async (classification, status) => {
      const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
      const index = manifest.migrations.findLastIndex((entry) => entry.classification === classification)
      manifest.migrations[index].applicationStatus = status
      await expect(validateMigrationManifest(manifest, directory))
        .resolves.toMatchObject({ valid: true, reasons: [] })
    },
  )

  it.each(APPLICATION_STATUS_MATRIX.filter(([, , legal]) => !legal))(
    'rejects %s carrying %s',
    async (classification, status) => {
      const { directory, manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
      const index = manifest.migrations.findLastIndex((entry) => entry.classification === classification)
      manifest.migrations[index].applicationStatus = status
      const result = await validateMigrationManifest(manifest, directory)
      expect(result.valid).toBe(false)
      expect(result.reasons).toContain('migration-classification-status-mismatch')
    },
  )

  it.each(APPLICATION_STATUS_MATRIX.filter(([, , legal]) => !legal))(
    'refuses %s carrying %s in the authorization gate too',
    async (classification, status) => {
      // The gate re-runs this cross-check because its executable checksum set is derived
      // from `classification` alone; an entry wearing a status its classification forbids
      // would otherwise buy approval by having its checksum re-approved alongside.
      const { manifest } = await buildFixture([HISTORICAL, EXECUTABLE])
      const index = manifest.migrations.findLastIndex((entry) => entry.classification === classification)
      manifest.migrations[index].applicationStatus = status
      const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
      expect(result.allowed).toBe(false)
      expect(result.reasons).toContain('migration-classification-status-mismatch')
    },
  )

  it('rejects an application status outside the declared vocabulary entirely', async () => {
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
    // Exactly the ten migrations recorded as applied against the hosted ledger — the
    // four foundation files and the six Study files — and nothing else. The eleventh
    // migration on this lineage has never run against hosted and must stay executable.
    expect([...FROZEN_HISTORICAL_BASELINE_FILENAMES]).toEqual(HOSTED_APPLIED_FILENAMES)
    expect(FROZEN_HISTORICAL_BASELINE_FILENAMES).toHaveLength(10)
    expect(FROZEN_HISTORICAL_BASELINE_FILENAMES)
      .not.toContain('20260806120000_academy_study_in_app_receipt_timestamp.sql')
  })

  it('holds every floor member as a historical baseline in the checked-in manifest', async () => {
    const manifest = await checkedInManifest()
    for (const filename of FROZEN_HISTORICAL_BASELINE_FILENAMES) {
      expect(manifest.migrations.find((entry) => entry.filename === filename), filename)
        .toMatchObject({
          classification: 'historical-baseline',
          applicationStatus: 'hosted-applied-ledger-recorded',
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
    // Demoting the newest floor member leaves the manifest legal by every other rule —
    // ordered, dependency-chained, correctly paired, checksums intact — so the reason
    // set is a single entry. Derived from the floor rather than named, because which
    // migration is newest changes every time the floor grows, and naming it would quietly
    // turn this into a test about some interior member that other rules also catch.
    const manifest = await checkedInManifest()
    Object.assign(manifest.migrations.find((entry) =>
      entry.filename === FROZEN_HISTORICAL_BASELINE_FILENAMES.at(-1))!, {
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
 * A filename-keyed lookup is last-write-wins, so a manifest that lists a frozen member
 * twice — the real entry demoted to executable, an identical historical-baseline twin
 * placed after it — makes the lookup report the twin's classification while the demoted
 * entry still mints an executable checksum for an already-hosted migration. The floor is
 * therefore evaluated over every entry bearing a frozen filename rather than through a
 * per-filename lookup, so no arrangement of duplicates can silence it.
 *
 * The gate is the site that matters. validateMigrationManifest refuses these manifests
 * several times over through its duplicate and ordering rules, but the floor is enforced
 * in the gate precisely so that its refusal does not depend on another rule holding.
 */
describe('frozen floor is immune to duplicated frozen filenames', () => {
  /** Replaces one floor member in place with N copies carrying the given classifications. */
  async function duplicatedFloorMember(filename: string, classifications: Classification[]) {
    const manifest = await checkedInManifest()
    const index = manifest.migrations.findIndex((entry) => entry.filename === filename)
    const original = manifest.migrations[index]
    manifest.migrations.splice(index, 1, ...classifications.map((classification) => ({
      ...original,
      classification,
      applicationStatus: allowedStatus(classification),
    })))
    return { manifest, sha256: original.sha256 }
  }

  /** The twin placed at the far end of the manifest rather than beside its original. */
  async function demotedWithDistantTwin(filename: string, twin: 'first' | 'last') {
    const manifest = await checkedInManifest()
    const victim = manifest.migrations.find((entry) => entry.filename === filename)!
    const duplicate = { ...victim }
    Object.assign(victim, { classification: 'executable', applicationStatus: 'not-applied-hosted' })
    if (twin === 'first') manifest.migrations.unshift(duplicate)
    else manifest.migrations.push(duplicate)
    return { manifest, sha256: victim.sha256 }
  }

  const MIXED_ARRANGEMENTS: readonly (readonly Classification[])[] = [
    [EXECUTABLE, HISTORICAL],
    [HISTORICAL, EXECUTABLE],
    [EXECUTABLE, HISTORICAL, HISTORICAL],
    [HISTORICAL, EXECUTABLE, HISTORICAL],
    [HISTORICAL, HISTORICAL, EXECUTABLE],
  ]

  const mixedCases = FROZEN_HISTORICAL_BASELINE_FILENAMES.flatMap((filename) =>
    MIXED_ARRANGEMENTS.map((classifications) => [filename, classifications.join('+'), classifications] as const))

  it.each(mixedCases)(
    'refuses %s duplicated as %s in the direct gate',
    async (_filename, _label, classifications) => {
      const { manifest, sha256 } = await duplicatedFloorMember(_filename, [...classifications])
      const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
      // The demotion really did mint executable work out of an already-hosted migration,
      // and the evidence really does approve it: this is the state the floor exists to stop.
      expect(result.checksums).toContain(sha256)
      expect(result.reasons).not.toContain('final-checksum-set-not-approved')
      // Exactly the floor, and nothing else. The gate never runs the duplicate-filename
      // rule, so this pins that its refusal is its own and not borrowed from validation.
      expect(result.reasons).toEqual([FROZEN_HISTORICAL_BASELINE_DEMOTED])
      expect(result.allowed).toBe(false)
    },
  )

  it.each(mixedCases)(
    'refuses %s duplicated as %s in manifest validation',
    async (_filename, _label, classifications) => {
      const { manifest } = await duplicatedFloorMember(_filename, [...classifications])
      const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
      expect(result.valid).toBe(false)
      expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
    },
  )

  const distantCases = FROZEN_HISTORICAL_BASELINE_FILENAMES.flatMap((filename) =>
    (['first', 'last'] as const).map((twin) => [filename, twin] as const))

  it.each(distantCases)(
    'refuses a demoted %s whose historical twin sits %s in the manifest',
    async (filename, twin) => {
      const { manifest, sha256 } = await demotedWithDistantTwin(filename, twin)
      const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
      expect(result.checksums).toContain(sha256)
      expect(result.reasons).toEqual([FROZEN_HISTORICAL_BASELINE_DEMOTED])
      expect(result.allowed).toBe(false)
    },
  )

  it.each(distantCases)(
    'reports %s demoted from manifest validation too, twin %s',
    async (filename, twin) => {
      const { manifest } = await demotedWithDistantTwin(filename, twin)
      const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
      expect(result.valid).toBe(false)
      expect(result.reasons).toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
    },
  )

  it('still accepts a legal manifest that repeats no frozen filename', async () => {
    // The immunity must not come from refusing every manifest that mentions a frozen
    // filename more than zero times.
    const manifest = await checkedInManifest()
    expect(evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest))
      .toMatchObject({ allowed: true, reasons: [] })
  })

  /**
   * Division of labour. Two identical historical duplicates leave the floor's own claim
   * — every entry bearing this filename is a historical baseline — perfectly true, so the
   * floor says nothing and the generic duplicate rules own the refusal. This predicate is
   * not the repository's duplicate validator and must not grow into one.
   */
  describe('duplicate policy stays with the duplicate rules', () => {
    it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])(
      'stays silent on two identical historical copies of %s',
      async (filename) => {
        const { manifest } = await duplicatedFloorMember(filename, [HISTORICAL, HISTORICAL])
        const result = evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest)
        expect(result.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
        expect(result.allowed).toBe(true)
      },
    )

    it.each([...FROZEN_HISTORICAL_BASELINE_FILENAMES])(
      'leaves two identical historical copies of %s to the duplicate-filename rule',
      async (filename) => {
        const { manifest } = await duplicatedFloorMember(filename, [HISTORICAL, HISTORICAL])
        const result = await validateMigrationManifest(manifest, CHECKED_IN_MIGRATIONS_URL)
        expect(result.valid).toBe(false)
        expect(result.reasons).toContain('duplicate-migration-filename')
        expect(result.reasons).not.toContain(FROZEN_HISTORICAL_BASELINE_DEMOTED)
      },
    )
  })
})

/**
 * The floor is a floor, not a ceiling. Applying an executable migration promotes it to
 * a historical baseline, which grows the historical set above the audited four; that
 * must stay legal at every size, and must stop only where the manifest would run out
 * of executable work entirely.
 */
describe('legal growth above the frozen floor', () => {
  /**
   * Growth is exercised on fixtures rather than on the checked-in manifest. That
   * manifest now carries exactly one executable migration, so promoting it does not
   * demonstrate growth — it exhausts the executable set, which is the shape-rule case
   * pinned at the end of this block. Fixtures write real files for every checksum
   * assertion and lay down the real ten-member floor, so nothing is lost by moving.
   */
  const GROWTH_SIZES = [1, 2, 3, 5, 8]

  it.each(GROWTH_SIZES)('accepts %i migrations promoted above the floor', async (promoted) => {
    const { directory, manifest } = await buildFixture(
      [...Array<Classification>(promoted).fill(HISTORICAL), EXECUTABLE],
    )
    expect(manifest.migrations.filter((entry) => entry.classification === HISTORICAL))
      .toHaveLength(FROZEN_HISTORICAL_BASELINE_FILENAMES.length + promoted)
    await expect(validateMigrationManifest(manifest, directory), `promoted ${promoted}`)
      .resolves.toMatchObject({ valid: true, reasons: [] })
    expect(
      evaluateMigrationPreflight(approvedEvidence(executableSha256(manifest)), manifest),
      `promoted ${promoted}`,
    ).toMatchObject({ allowed: true, reasons: [] })
  })

  it.each(GROWTH_SIZES)('keeps every frozen member present through %i promotions', async (promoted) => {
    const { manifest } = await buildFixture(
      [...Array<Classification>(promoted).fill(HISTORICAL), EXECUTABLE],
    )
    for (const filename of FROZEN_HISTORICAL_BASELINE_FILENAMES) {
      expect(manifest.migrations.find((entry) => entry.filename === filename), filename)
        .toMatchObject({ classification: HISTORICAL })
    }
  })

  it('stops at the shape rule, not the floor, when every executable is promoted', async () => {
    const manifest = await checkedInManifest()
    for (const entry of manifest.migrations.filter((candidate) => candidate.classification === EXECUTABLE)) {
      entry.classification = HISTORICAL
      entry.applicationStatus = allowedStatus(HISTORICAL)
    }
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
    applicationStatus: allowedStatus(classification),
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

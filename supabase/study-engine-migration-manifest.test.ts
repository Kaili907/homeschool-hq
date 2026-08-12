import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  ALLOWED_APPLICATION_STATUS,
  FROZEN_HISTORICAL_BASELINE_FILENAMES,
} from '../scripts/study-migration-preflight.mjs'

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

/**
 * Independent byte custody for every migration on this lineage.
 *
 * Deliberately a second literal list, and deliberately NOT derived from the manifest.
 * The manifest's own checksums are already checked against the files, but that pair
 * agrees whenever one actor edits both — it is a drift tripwire, not proof that the
 * bytes never moved. Ten of these migrations are recorded as applied against the hosted
 * ledger and are permanently non-replayable; if their local bytes drift from what ran,
 * every equivalence claim in `hosted-applied-evidence.json` quietly stops being about
 * the files in this repository. This pin is what makes such a drift loud.
 *
 * A failure here is never fixed by updating the expected value. It means a migration's
 * bytes changed, which for the ten hosted-applied members is a defect by construction.
 */
const CUSTODY_LF_SHA256: Readonly<Record<string, string>> = {
  '20260724074106_academy_profiles_base.sql':
    '16c609d24efb9b9694b410a2313e5f2f7228db5118e2ccc4fa779f03c1d53c51',
  '20260724230000_academy_student_identity_foundation.sql':
    '2c7825ba957b68a39413a1e2da81aebaa72fb35dde7abeeba6ea8a493ecf3bde',
  '20260726120000_academy_household_revision_cas.sql':
    '0d5556db9f1dc406234e08180051e8d54807870084223b25db18017b1648c268',
  '20260731120000_academy_gateway_usage.sql':
    '9eb92005e9c98e94f3fa365351ab527d01cee47da2d0ceac3db0a4e60d82c86f',
  '20260801010000_academy_study_engine_storage.sql':
    '7ebb25b0517f3b79b36e0399757715826a634fbdf731a9716fdeeb4dad9da0fa',
  '20260801011000_academy_study_engine_authorization.sql':
    '3e4fe306b9edfb17cf3fbf0f62b4c5565fdccc9abde1726d7205c60d822acfad',
  '20260801012000_academy_study_engine_production_reconciliation.sql':
    '8675afe9f5c802689234fc769e09a4f42bf7a19eba6c88bfeadb816a048910d3',
  '20260801160000_academy_study_verified_identity.sql':
    '4501be3757cb0baf53edc200e7673744b12626eeb84dd56d6fc2899e3d25338e',
  '20260801170000_academy_study_adult_review_operations.sql':
    '562b67462148d9e94933b0fd9007fad37a3b0a08cb8432383c0b228088c0d8eb',
  '20260801190000_academy_study_final_production_reconciliation.sql':
    'd4ccea295aac2bda67dbfd310650e1c625de867485ecc47f5e993f74c8006d00',
  '20260806120000_academy_study_in_app_receipt_timestamp.sql':
    'b690c634b9c629149d570c9ffc5e1664b060be1d9f45f76cb461503de2c6f3b6',
  '20260806140000_academy_study_c2_operations_contract.sql':
    '8448c6d1d6eec2247a913cfb18bd21b8fd9f6793bab5acd81b414878e5333baf',
  '20260808120000_academy_study_actor_bound_session_verification.sql':
    '21462128be7f207cd31e60620acc1ec125f61e2e62fa2c41bb7272a764750f83',
  '20260808150000_academy_study_academic_readiness_contract.sql':
    'c53d383e56601700eddf6dbc683cfcc3a23b3612e33ec7386dfe0210befcf58d',
  '20260809120000_academy_study_learner_runtime_operations.sql':
    '693f437220ad4947345fa1846840718a4074e6a02df334f8937d15a975cbb2b1',
  '20260810120000_academy_study_production_wire_contract_v1.sql':
    '64696f8cd7655460beeda94b023b75c421032761ee3c20c6bb249d115bd7f4ff',
}

describe('migration byte custody', () => {
  it('holds every migration byte-for-byte, independently of the manifest', async () => {
    const files = (await readdir(migrationDirectory))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort()
    expect(files).toEqual(Object.keys(CUSTODY_LF_SHA256))
    for (const [filename, expected] of Object.entries(CUSTODY_LF_SHA256)) {
      const source = await readFile(new URL(filename, migrationDirectory), 'utf8')
      expect(createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex'), filename)
        .toBe(expected)
    }
  })

  it('agrees with the manifest it is meant to cross-check', async () => {
    // The two lists must match today. They are kept separate so that a change to one
    // is visible against the other, not so that they can drift.
    const manifest = await loadManifest()
    expect(Object.fromEntries(manifest.migrations.map((entry) => [entry.filename, entry.sha256])))
      .toEqual(CUSTODY_LF_SHA256)
  })
})

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

  it('splits into a nonempty historical prefix and a nonempty executable suffix', async () => {
    const manifest = await loadManifest()
    const classifications = manifest.migrations.map((entry) => entry.classification)
    // Asserted by shape, never by position: applying an executable migration
    // promotes it to a historical baseline and forward migrations are appended, so
    // the boundary moves without the manifest becoming any less legal.
    const boundary = classifications.indexOf('executable')
    expect(boundary).toBeGreaterThan(0)
    expect(classifications.slice(0, boundary))
      .toEqual(Array<string>(boundary).fill('historical-baseline'))
    expect(classifications.slice(boundary))
      .toEqual(Array<string>(classifications.length - boundary).fill('executable'))
  })

  it('keeps every migration recorded as applied on hosted a historical baseline', async () => {
    const manifest = await loadManifest()
    // Imported from the validator rather than restated here: a second literal list is a
    // second thing to forget to update, and the whole point of this claim is that these
    // filenames mean the same thing to the checked-in manifest and to the gate that
    // reads it. Membership, never position — the boundary index legitimately moves as
    // executable migrations are applied and promoted.
    //
    // The status is pinned to the exact value rather than to set membership. The
    // validator deliberately allows a historical baseline either hosted provenance, so
    // set membership alone would let one of these ten regress to the pending-authorization
    // status without a word. That regression mints no executable work — the floor still
    // holds the classification — but it would misstate hosted history, which is the one
    // thing this record exists to state correctly.
    for (const filename of FROZEN_HISTORICAL_BASELINE_FILENAMES) {
      const entry = manifest.migrations.find((candidate) => candidate.filename === filename)
      expect(entry, filename).toMatchObject({
        classification: 'historical-baseline',
        applicationStatus: 'hosted-applied-ledger-recorded',
      })
    }
    expect(FROZEN_HISTORICAL_BASELINE_FILENAMES).toHaveLength(10)
  })

  // Named in full and in order, never counted, and never expressed as "everything the
  // floor does not hold". Both forms would accept a hosted-applied member demoted out
  // of the floor in exchange for a forward migration; only naming the members refuses
  // that trade. Each is pinned to not-applied-hosted individually, because the
  // executable classification admits no other status and each further executable is a
  // further place for one to go wrong.
  it('leaves the never-applied migrations executable and pending', async () => {
    const manifest = await loadManifest()
    const executable = manifest.migrations.filter((entry) => entry.classification === 'executable')
    expect(executable.map((entry) => entry.filename))
      .toEqual([
        '20260806120000_academy_study_in_app_receipt_timestamp.sql',
        '20260806140000_academy_study_c2_operations_contract.sql',
        '20260808120000_academy_study_actor_bound_session_verification.sql',
        '20260808150000_academy_study_academic_readiness_contract.sql',
        '20260809120000_academy_study_learner_runtime_operations.sql',
        '20260810120000_academy_study_production_wire_contract_v1.sql',
      ])
    for (const entry of executable) {
      expect(entry.applicationStatus, entry.filename).toBe('not-applied-hosted')
    }
  })

  it('gives every entry a hosted application status its classification allows', async () => {
    const manifest = await loadManifest()
    for (const entry of manifest.migrations) {
      expect(ALLOWED_APPLICATION_STATUS.get(entry.classification)?.has(entry.applicationStatus), entry.filename)
        .toBe(true)
    }
  })

  it('records the before-first-use supersession', async () => {
    const manifest = await loadManifest()
    const corrected = manifest.migrations.find((entry) => entry.version === '20260801170000')
    expect(corrected).toMatchObject({
      supersessionStatus: 'supersedes-before-first-application',
      supersedesSha256: unsafeSession17,
    })
    expect(manifest.migrations.filter((entry) => entry.supersessionStatus !== 'current'))
      .toEqual([corrected])
  })
})

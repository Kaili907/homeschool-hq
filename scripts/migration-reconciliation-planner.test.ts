import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createMigrationReconciliationPlan,
  formatMigrationReconciliationOperatorPlan,
} from './migration-reconciliation-planner.mjs'

const execFileAsync = promisify(execFile)
const fixtureDirectory = fileURLToPath(
  new URL('./fixtures/migration-reconciliation/four-way/', import.meta.url),
)
const plannerPath = fileURLToPath(new URL('./migration-reconciliation-planner.mjs', import.meta.url))
const temporaryDirectories: string[] = []

function checksum(source: string) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

type MigrationSpec = {
  filename: string
  source: string
  dependency?: string | null
  classification?: string
  applicationStatus?: string
}

function manifestFor(specs: MigrationSpec[]) {
  return {
    schemaVersion: 1,
    projectRef: 'fixture-local-only',
    migrations: specs.map((spec, index) => ({
      version: spec.filename.slice(0, 14),
      filename: spec.filename,
      sha256: checksum(spec.source),
      dependency: spec.dependency === undefined
        ? index === 0 ? null : specs[index - 1].filename
        : spec.dependency,
      classification: spec.classification ?? 'executable',
      applicationStatus: spec.applicationStatus ?? 'unapplied-parallel',
    })),
  }
}

async function temporaryPlan(
  specs: MigrationSpec[],
  options: {
    manifest?: ReturnType<typeof manifestFor>
    proposal?: unknown
    safety?: unknown
    referenceSource?: string
  } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'migration-reconciliation-'))
  temporaryDirectories.push(root)
  const migrations = join(root, 'migrations')
  const references = join(root, 'references')
  await Promise.all([mkdir(migrations), mkdir(references)])
  await Promise.all(specs.map((spec) => writeFile(join(migrations, spec.filename), spec.source)))
  if (options.referenceSource) {
    await writeFile(join(references, 'identity.md'), options.referenceSource)
  }
  return createMigrationReconciliationPlan({
    migrationDirectory: migrations,
    manifest: options.manifest ?? manifestFor(specs),
    manifestPath: join(root, 'migration-manifest.json'),
    proposal: options.proposal ?? null,
    safety: options.safety ?? {},
    referenceRoots: [references],
  })
}

async function loadFixtureJson(filename: string) {
  return JSON.parse(await readFile(join(fixtureDirectory, filename), 'utf8'))
}

async function fourWayPlan(proposalFilename: string | null) {
  return createMigrationReconciliationPlan({
    migrationDirectory: join(fixtureDirectory, 'migrations'),
    manifest: await loadFixtureJson('migration-manifest.json'),
    manifestPath: join(fixtureDirectory, 'migration-manifest.json'),
    proposal: proposalFilename ? await loadFixtureJson(proposalFilename) : null,
    proposalPath: proposalFilename ? join(fixtureDirectory, proposalFilename) : null,
    safety: await loadFixtureJson('safety.json'),
    safetyPath: join(fixtureDirectory, 'safety.json'),
    referenceRoots: [join(fixtureDirectory, 'references')],
  })
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('migration reconciliation planner', () => {
  it('accepts a manifest with no collision without proposing changes', async () => {
    const plan = await temporaryPlan([
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_feature.sql', source: 'select 2;\n' },
    ])

    expect(plan.collisions).toEqual([])
    expect(plan.validation).toMatchObject({ valid: true, result: 'VALID_CANDIDATE_PLAN' })
    expect(plan.proposedVersionMap.every((entry) => entry.changed === false)).toBe(true)
  })

  it('detects a two-way collision and blocks an unresolved destination', async () => {
    const plan = await temporaryPlan([
      { filename: '20260810120000_provider_pricing.sql', source: 'select 1;\n' },
      { filename: '20260810120000_study_settings.sql', source: 'select 2;\n' },
    ])

    expect(plan.collisions).toEqual([{
      version: '20260810120000',
      migrations: [
        '20260810120000_provider_pricing.sql',
        '20260810120000_study_settings.sql',
      ],
    }])
    expect(plan.validation.errorCodes).toContain('DESTINATION_VERSION_REUSED')
  })

  it('inventories the deterministic four-way 120000 collision with distinct checksums', async () => {
    const plan = await fourWayPlan(null)

    expect(plan.collisions).toHaveLength(1)
    expect(plan.collisions[0]).toMatchObject({ version: '20260810120000' })
    expect(plan.collisions[0].migrations).toHaveLength(4)
    expect(new Set(plan.inventory.map((entry) => entry.sha256)).size).toBe(4)
    expect(plan.validation.errorCodes).toContain('DESTINATION_VERSION_REUSED')
  })

  it('refuses a reused destination version', async () => {
    const plan = await fourWayPlan('reused-destination-proposal.json')

    expect(plan.validation.valid).toBe(false)
    expect(plan.errors).toContainEqual(expect.objectContaining({
      code: 'DESTINATION_VERSION_REUSED',
      version: '20260810120100',
    }))
  })

  it('detects dependency inversion even when proposed destinations are unique', async () => {
    const plan = await fourWayPlan('dependency-inversion-proposal.json')

    expect(plan.validation.errorCodes).toContain('DEPENDENCY_INVERSION')
    expect(plan.errors).toContainEqual(expect.objectContaining({
      code: 'DEPENDENCY_INVERSION',
      dependency: '20260810120000_curriculum_draft_authoring.sql',
      dependent: '20260810120000_study_effective_settings_v2.sql',
    }))
  })

  it('protects frozen historical and known hosted/applied migrations', async () => {
    const specs = [
      {
        filename: '20260810110000_frozen.sql',
        source: 'select 1;\n',
        classification: 'historical-baseline',
      },
      {
        filename: '20260810120000_applied.sql',
        source: 'select 2;\n',
        applicationStatus: 'applied-hosted',
      },
    ]
    const proposal = {
      schemaVersion: 1,
      reconciliations: [
        { filename: specs[0].filename, replacementVersion: '20260810110100' },
        { filename: specs[1].filename, replacementVersion: '20260810120100' },
      ],
    }
    const plan = await temporaryPlan(specs, { proposal })

    expect(plan.validation.errorCodes).toEqual(expect.arrayContaining([
      'FROZEN_HISTORICAL_RENUMBER_FORBIDDEN',
      'APPLIED_MIGRATION_RENUMBER_POLICY_REQUIRED',
    ]))
    expect(plan.unsafeOperations).toHaveLength(2)
  })

  it('fails closed on a manifest file-set mismatch', async () => {
    const specs = [
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_unlisted.sql', source: 'select 2;\n' },
    ]
    const plan = await temporaryPlan(specs, { manifest: manifestFor(specs.slice(0, 1)) })

    expect(plan.validation.errorCodes).toContain('MISSING_MANIFEST_ENTRY')
  })

  it('fails closed on a checksum mismatch', async () => {
    const specs = [{ filename: '20260810120000_feature.sql', source: 'select 1;\n' }]
    const manifest = manifestFor(specs)
    manifest.migrations[0].sha256 = '0'.repeat(64)
    const plan = await temporaryPlan(specs, { manifest })

    expect(plan.errors).toContainEqual(expect.objectContaining({
      code: 'CHECKSUM_MISMATCH',
      filename: specs[0].filename,
    }))
  })

  it('accepts a globally unique, dependency-ordered four-way candidate plan', async () => {
    const plan = await fourWayPlan('valid-proposal.json')

    expect(plan.validation).toEqual({
      valid: true,
      result: 'VALID_CANDIDATE_PLAN',
      errorCodes: [],
    })
    expect(plan.proposedVersionMap.map((entry) => entry.replacementVersion)).toEqual([
      '20260810120100',
      '20260810120000',
      '20260810120300',
      '20260810120200',
    ])
    expect(plan.affectedManifestEntries).toHaveLength(3)
    expect(plan.affectedDependencyReferences).toHaveLength(2)
    expect(plan.affectedManifestEntries.every((entry) =>
      entry.fields.sha256.current === entry.fields.sha256.postRenameContentUnchanged &&
      entry.fields.sha256.afterContentEdit === null,
    )).toBe(true)
    expect(plan.affectedTestsAndDocs).toHaveLength(1)
    expect(plan.affectedTestsAndDocs[0].matches).toContainEqual(expect.objectContaining({
      token: '20260810120000',
      ambiguous: true,
      migrations: expect.arrayContaining(plan.inventory.map((entry) => entry.filename)),
    }))
  })

  it('emits parseable deterministic machine-readable JSON without changing fixture files', async () => {
    const migrations = join(fixtureDirectory, 'migrations')
    const before = await readdir(migrations)
    const args = [
      plannerPath,
      '--migrations', migrations,
      '--manifest', join(fixtureDirectory, 'migration-manifest.json'),
      '--proposal', join(fixtureDirectory, 'valid-proposal.json'),
      '--safety', join(fixtureDirectory, 'safety.json'),
      '--references', join(fixtureDirectory, 'references'),
      '--format', 'json',
    ]
    const { stdout, stderr } = await execFileAsync(process.execPath, args)
    const repeated = await execFileAsync(process.execPath, args)
    const after = await readdir(migrations)
    const plan = JSON.parse(stdout)

    expect(stderr).toBe('')
    expect(repeated.stderr).toBe('')
    expect(repeated.stdout).toBe(stdout)
    expect(plan).toMatchObject({
      schemaVersion: 1,
      mode: 'READ_ONLY',
      mutationPerformed: false,
      validation: { valid: true, result: 'VALID_CANDIDATE_PLAN' },
    })
    expect(after).toEqual(before)
  })

  it('emits an operator-readable collision, dependency, checksum, and safety plan', async () => {
    const output = formatMigrationReconciliationOperatorPlan(
      await fourWayPlan('valid-proposal.json'),
    )

    expect(output).toContain('Mode: READ ONLY (no files renamed or modified)')
    expect(output).toContain('Collision groups: 1')
    expect(output).toContain('Dependency order:')
    expect(output).toContain('post-rename-content-unchanged=')
    expect(output).toContain('after-content-edit=UNKNOWN')
    expect(output).toContain('Result: VALID_CANDIDATE_PLAN')
    expect(output).toContain('Mutations performed: NO')
  })
})

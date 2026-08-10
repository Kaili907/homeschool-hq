import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evaluateAdminProductionPreflight,
  formatOperatorReport,
} from './admin-production-preflight.mjs'
import {
  EXPECTED_STUDY_PROJECT_REF,
  validateMigrationManifest,
} from './study-migration-preflight.mjs'

const contractUrl = new URL('../docs/admin-production-preflight/deployment-contract.json', import.meta.url)
const evidenceUrl = new URL('../docs/admin-production-preflight/current-local-evidence.json', import.meta.url)
const manifestUrl = new URL('../docs/study-engine-final-production/migration-manifest.json', import.meta.url)

function checksum(source: string) {
  return createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
}

interface MigrationSpec {
  filename: string
  source: string
}

function manifestFor(specs: MigrationSpec[]) {
  return {
    schemaVersion: 1,
    projectRef: EXPECTED_STUDY_PROJECT_REF,
    hashNormalization: 'UTF-8 bytes with CRLF normalized to LF',
    migrations: specs.map((spec, index) => ({
      version: spec.filename.slice(0, 14),
      filename: spec.filename,
      sha256: checksum(spec.source),
      dependency: index === 0 ? null : specs[index - 1].filename,
      classification: index === 0 ? 'historical-baseline' : 'executable',
      applicationStatus: index === 0
        ? 'hosted-equivalent-baseline-pending-authorization'
        : 'not-applied-hosted',
      requiredMarkerTransition: `marker-${index + 1}`,
      supersessionStatus: 'current',
    })),
  }
}

async function withMigrationDirectory<T>(specs: MigrationSpec[], run: (directory: string) => Promise<T>) {
  const directory = await mkdtemp(join(tmpdir(), 'admin-preflight-r3-'))
  try {
    await Promise.all(specs.map((spec) => writeFile(join(directory, spec.filename), spec.source, 'utf8')))
    return await run(directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function loadJson(url: URL) {
  return JSON.parse(await readFile(url, 'utf8'))
}

function migrationOptions(manifest: ReturnType<typeof manifestFor>) {
  return {
    frozenHistoricalMigrations: [{
      filename: manifest.migrations[0].filename,
      sha256: manifest.migrations[0].sha256,
    }],
    approvedHistoricalReconciliations: [],
  }
}

function allPassEvidence(contract: Record<string, any>) {
  return {
    schemaVersion: 1,
    contractId: contract.contractId,
    scope: 'local-only',
    gates: Object.fromEntries(contract.gates
      .filter((gate: Record<string, unknown>) => gate.applicability === 'required')
      .map((gate: Record<string, unknown>) => [gate.id, {
        status: 'PASS',
        evidenceRefs: ['scripts/admin-production-preflight.test.ts'],
      }])),
  }
}

function blockGate(evidence: Record<string, any>, gateId: string, reasonCode: string) {
  return {
    ...evidence,
    gates: {
      ...evidence.gates,
      [gateId]: {
        status: 'BLOCKING',
        reasonCode,
        evidenceRefs: ['scripts/admin-production-preflight.test.ts'],
      },
    },
  }
}

async function evaluateFixture(transformEvidence?: (
  evidence: Record<string, any>,
) => Record<string, any>) {
  const specs = [
    { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
    { filename: '20260810120000_feature.sql', source: 'select 2;\n' },
  ]
  const manifest = manifestFor(specs)
  const checkedInContract = await loadJson(contractUrl)
  const contract = { ...checkedInContract, migrationIdentity: migrationOptions(manifest) }
  const evidence = allPassEvidence(contract)
  return withMigrationDirectory(specs, (migrationDirectory) => evaluateAdminProductionPreflight({
    contract,
    evidence: transformEvidence ? transformEvidence(evidence) : evidence,
    manifest,
    migrationDirectory,
  }))
}

describe('Admin production migration identity', () => {
  it('accepts a clean, unique, deterministic migration chain', async () => {
    const specs = [
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_feature.sql', source: 'select 2;\n' },
    ]
    const manifest = manifestFor(specs)
    const result = await withMigrationDirectory(specs, (directory) =>
      validateMigrationManifest(manifest, directory, migrationOptions(manifest)))

    expect(result).toMatchObject({ valid: true, contractErrors: [] })
  })

  it('rejects two files sharing the deliberate 20260810120000 version', async () => {
    const specs = [
      { filename: '20260810120000_provider_pricing.sql', source: 'select 1;\n' },
      { filename: '20260810120000_study_settings.sql', source: 'select 2;\n' },
    ]
    const manifest = manifestFor(specs)
    const result = await withMigrationDirectory(specs, (directory) =>
      validateMigrationManifest(manifest, directory, migrationOptions(manifest)))

    expect(result.valid).toBe(false)
    expect(result.contractErrors).toEqual(expect.arrayContaining([
      'duplicate-migration-version',
      'duplicate-migration-version:20260810120000',
    ]))
  })

  it('rejects a migration file with no manifest entry', async () => {
    const specs = [
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_unlisted.sql', source: 'select 2;\n' },
    ]
    const manifest = manifestFor(specs.slice(0, 1))
    const result = await withMigrationDirectory(specs, (directory) =>
      validateMigrationManifest(manifest, directory, migrationOptions(manifest)))

    expect(result.contractErrors).toContain('missing-manifest-entry:20260810120000_unlisted.sql')
  })

  it('rejects an orphan manifest entry with no migration file', async () => {
    const specs = [
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_absent.sql', source: 'select 2;\n' },
    ]
    const manifest = manifestFor(specs)
    const result = await withMigrationDirectory(specs.slice(0, 1), (directory) =>
      validateMigrationManifest(manifest, directory, migrationOptions(manifest)))

    expect(result.contractErrors).toContain('orphan-manifest-entry:20260810120000_absent.sql')
  })

  it('rejects a checksum mismatch', async () => {
    const specs = [
      { filename: '20260810110000_foundation.sql', source: 'select 1;\n' },
      { filename: '20260810120000_feature.sql', source: 'select 2;\n' },
    ]
    const manifest = manifestFor(specs)
    manifest.migrations[1].sha256 = 'f'.repeat(64)
    const result = await withMigrationDirectory(specs, (directory) =>
      validateMigrationManifest(manifest, directory, migrationOptions(manifest)))

    expect(result.contractErrors).toContain('migration-checksum-mismatch:20260810120000_feature.sql')
  })

  it('requires an exact approved reconciliation for historical mutation', async () => {
    const original = { filename: '20260810110000_foundation.sql', source: 'select 1;\n' }
    const replacement = { ...original, source: 'select 9;\n' }
    const manifest = manifestFor([replacement])
    const frozen = {
      frozenHistoricalMigrations: [{ filename: original.filename, sha256: checksum(original.source) }],
      approvedHistoricalReconciliations: [],
    }
    const blocked = await withMigrationDirectory([replacement], (directory) =>
      validateMigrationManifest(manifest, directory, frozen))
    expect(blocked.contractErrors).toContain(
      'historical-migration-mutation-unapproved:20260810110000_foundation.sql',
    )

    const approved = await withMigrationDirectory([replacement], (directory) => validateMigrationManifest(
      manifest,
      directory,
      {
        ...frozen,
        approvedHistoricalReconciliations: [{
          approved: true,
          filename: original.filename,
          previousSha256: checksum(original.source),
          replacementSha256: checksum(replacement.source),
          approvalReference: 'MIGRATION-RECONCILIATION-1',
        }],
      },
    ))
    expect(approved).toMatchObject({ valid: true, contractErrors: [] })
  })
})

describe('Admin production activation gates', () => {
  it('blocks unconfigured account pricing even when pricing architecture passes', async () => {
    const result = await evaluateFixture((evidence) => blockGate(
      evidence,
      'provider_pricing_account_configuration',
      'ACCOUNT_PRICING_NOT_VERIFIED',
    ))
    expect(result.classification).toBe('BLOCKED_BY_CONFIGURATION')
    expect(result.gates.find((gate) => gate.id === 'provider_pricing_architecture')?.status).toBe('PASS')
  })

  it('blocks configuration that is not actually enforced', async () => {
    const result = await evaluateFixture((evidence) => blockGate(
      evidence,
      'admin_configuration_runtime_enforcement',
      'PRODUCTION_ENFORCEMENT_NOT_VERIFIED',
    ))
    expect(result.classification).toBe('BLOCKED_BY_CONFIGURATION')
  })

  it('keeps incomplete provider attempt coverage separate from ledger operation', async () => {
    const result = await evaluateFixture((evidence) => blockGate(
      evidence,
      'provider_attempt_journal',
      'PROVIDER_ATTEMPT_JOURNAL_MISSING',
    ))
    expect(result.classification).toBe('BLOCKED_BY_PROVIDER_ACCOUNTING')
    expect(result.gates.find((gate) => gate.id === 'provider_cost_ledger_operational')?.status).toBe('PASS')
  })

  it.each([
    ['study_effective_settings_v2', 'STUDY_SETTINGS_V2_MISSING'],
    ['study_curriculum_binding', 'STUDY_CURRICULUM_BINDING_MISSING'],
    ['study_adult_review_worker', 'PRODUCTION_WORKER_NOT_COMPOSED'],
    ['study_worker_schedule', 'PRODUCTION_WORKER_SCHEDULE_MISSING'],
  ])('keeps missing Study prerequisite %s blocking', async (gateId, reasonCode) => {
    const result = await evaluateFixture((evidence) => blockGate(evidence, gateId, reasonCode))
    expect(result.classification).toBe('BLOCKED_BY_STUDY')
    expect(result.gates.find((gate) => gate.id === gateId)?.status).toBe('BLOCKING')
  })

  it('fails closed when required evidence is missing', async () => {
    const result = await evaluateFixture((evidence) => {
      const gates = { ...evidence.gates }
      delete gates.admin_audit
      return { ...evidence, gates }
    })
    expect(result.classification).toBe('BLOCKED_BY_LOCAL_INTEGRATION')
    expect(result.gates.find((gate) => gate.id === 'admin_audit')).toMatchObject({
      status: 'BLOCKING',
      reasonCode: 'EVIDENCE_MISSING',
    })
  })

  it('rejects a pass backed only by a missing local artifact', async () => {
    const result = await evaluateFixture((evidence) => ({
      ...evidence,
      gates: {
        ...evidence.gates,
        admin_audit: { status: 'PASS', evidenceRefs: ['docs/does-not-exist.md'] },
      },
    }))
    expect(result.gates.find((gate) => gate.id === 'admin_audit')).toMatchObject({
      status: 'BLOCKING',
      reasonCode: 'EVIDENCE_INVALID',
    })
  })

  it('allows the all-local-gates-pass case only to hosted preflight', async () => {
    const result = await evaluateFixture()
    expect(result).toMatchObject({
      classification: 'READY_FOR_HOSTED_PREFLIGHT',
      readyForHostedPreflight: true,
      productionActivationAuthorized: false,
      hostedContactPerformed: false,
      summary: { blocking: 0, notApplicable: 2 },
    })
  })

  it('keeps operator and machine output privacy-safe', async () => {
    const secret = 'student-name-and-secret-provider-key'
    const result = await evaluateFixture((evidence) => ({
      ...evidence,
      privateOperatorNote: secret,
      gates: {
        ...evidence.gates,
        admin_audit: { ...evidence.gates.admin_audit, privateOperatorNote: secret },
        [secret]: { status: 'PASS', evidenceRefs: ['scripts/admin-production-preflight.test.ts'] },
      },
    }))
    expect(formatOperatorReport(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('reports the checked-in local state as integration-blocked without hosted contact', async () => {
    const [contract, evidence, manifest] = await Promise.all([
      loadJson(contractUrl),
      loadJson(evidenceUrl),
      loadJson(manifestUrl),
    ])
    const result = await evaluateAdminProductionPreflight({
      contract,
      evidence,
      manifest,
      migrationDirectory: new URL('../supabase/migrations/', import.meta.url),
    })
    expect(result).toMatchObject({
      classification: 'BLOCKED_BY_LOCAL_INTEGRATION',
      hostedContactPerformed: false,
      productionActivationAuthorized: false,
      migrationIdentity: { status: 'PASS' },
    })
  })
})

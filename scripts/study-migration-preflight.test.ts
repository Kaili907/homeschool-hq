import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import {
  evaluateMigrationPreflight,
  executableChecksums,
  EXPECTED_STUDY_PROJECT_REF,
  historicalVersions,
  requiredMarkerTransitions,
  UNSAFE_SESSION_17_SHA256,
  validateMigrationManifest,
} from './study-migration-preflight.mjs'

const manifest = {
  schemaVersion: 1,
  projectRef: EXPECTED_STUDY_PROJECT_REF,
  migrations: [
    {
      version: '20260724000000',
      classification: 'historical-baseline',
      supersessionStatus: 'current',
      sha256: 'a'.repeat(64),
      requiredMarkerTransition: 'historical-marker-1',
    },
    {
      version: '20260725000000',
      classification: 'historical-baseline',
      supersessionStatus: 'current',
      sha256: 'b'.repeat(64),
      requiredMarkerTransition: 'historical-marker-2',
    },
    {
      version: '20260801000000',
      classification: 'executable',
      supersessionStatus: 'current',
      sha256: 'c'.repeat(64),
      requiredMarkerTransition: 'executable-postcondition-1',
    },
    {
      version: '20260802000000',
      classification: 'executable',
      supersessionStatus: 'current',
      sha256: 'd'.repeat(64),
      requiredMarkerTransition: 'executable-postcondition-2',
    },
  ],
}

function approvedEvidence(targetManifest = manifest) {
  return {
    projectRef: EXPECTED_STUDY_PROJECT_REF,
    exactProjectVerified: true,
    historicalVersions: historicalVersions(targetManifest),
    approvedRequiredMarkerTransitions: requiredMarkerTransitions(targetManifest),
    foundationObjectEquivalenceReconfirmed: true,
    historicalBaselineAuthorization: true,
    migrationHistoryResolved: true,
    hostedDriftAbsent: true,
    finalMetadataRepreflightPassed: true,
    hostedMutationAuthorized: false,
    approvedExecutableChecksums: executableChecksums(targetManifest),
  }
}

async function loadCheckedInJson(filename: string) {
  return JSON.parse(await readFile(
    new URL(`../docs/study-engine-final-production/${filename}`, import.meta.url),
    'utf8',
  ))
}

async function validateCheckedInManifest(override?: (entry: Record<string, unknown>, index: number) => Record<string, unknown>) {
  const checkedInManifest = await loadCheckedInJson('migration-manifest.json')
  const targetManifest = override
    ? { ...checkedInManifest, migrations: checkedInManifest.migrations.map(override) }
    : checkedInManifest
  return {
    manifest: targetManifest,
    result: await validateMigrationManifest(
      targetManifest,
      new URL('../supabase/migrations/', import.meta.url),
    ),
  }
}

describe('hosted Study migration manifest contract', () => {
  it('accepts the canonical four-entry historical prefix structurally', async () => {
    const { manifest: checkedInManifest, result } = await validateCheckedInManifest()

    expect(historicalVersions(checkedInManifest)).toEqual([
      '20260724074106',
      '20260724230000',
      '20260726120000',
      '20260731120000',
    ])
    expect(result).toMatchObject({ valid: true, contractErrors: [] })
  })

  it('rejects historical/executable/historical interleaving', async () => {
    const { result } = await validateCheckedInManifest((entry, index) =>
      index === 5 ? { ...entry, classification: 'historical-baseline' } : entry,
    )

    expect(result.valid).toBe(false)
    expect(result.contractErrors).toContain('migration-classification-order-invalid')
  })

  it('handles a zero-length historical prefix safely', async () => {
    const { manifest: executableOnly, result } = await validateCheckedInManifest((entry) => ({
      ...entry,
      classification: 'executable',
    }))

    expect(historicalVersions(executableOnly)).toEqual([])
    expect(result).toMatchObject({ valid: true, contractErrors: [] })
  })

  it('rejects a manifest for another project as a contract error', async () => {
    const checkedInManifest = await loadCheckedInJson('migration-manifest.json')
    const result = await validateMigrationManifest(
      { ...checkedInManifest, projectRef: 'another-project' },
      new URL('../supabase/migrations/', import.meta.url),
    )

    expect(result.contractErrors).toContain('manifest-project-ref-invalid')
  })
})

describe('hosted Study migration authorization evidence', () => {
  it('allows only exact fully approved evidence', () => {
    expect(evaluateMigrationPreflight(approvedEvidence(), manifest))
      .toMatchObject({ allowed: true, readinessHolds: [] })
  })

  it.each([
    ['missing', ['20260724000000']],
    ['extra', ['20260724000000', '20260725000000', '20260726000000']],
    ['reordered', ['20260725000000', '20260724000000']],
  ])('rejects %s historical-version evidence', (_case, historicalEvidence) => {
    const evidence = { ...approvedEvidence(), historicalVersions: historicalEvidence }
    expect(evaluateMigrationPreflight(evidence, manifest).readinessHolds)
      .toContain('historical-version-evidence-mismatch')
  })

  it('requires evidence for the exact manifest and expected project ref', () => {
    const evidence = { ...approvedEvidence(), projectRef: 'wrong-project' }
    expect(evaluateMigrationPreflight(evidence, manifest).readinessHolds)
      .toContain('exact-project-not-verified')

    const wrongManifest = { ...manifest, projectRef: 'wrong-project' }
    expect(evaluateMigrationPreflight({ ...approvedEvidence(), projectRef: 'wrong-project' }, wrongManifest).readinessHolds)
      .toContain('exact-project-not-verified')
  })

  it.each([
    ['missing', ['historical-marker-1', 'historical-marker-2', 'executable-postcondition-1']],
    ['extra', [...requiredMarkerTransitions(manifest), 'unapproved-marker']],
    ['reordered', [...requiredMarkerTransitions(manifest)].reverse()],
  ])('rejects %s ordered marker/postcondition evidence', (_case, markerEvidence) => {
    const evidence = { ...approvedEvidence(), approvedRequiredMarkerTransitions: markerEvidence }
    expect(evaluateMigrationPreflight(evidence, manifest).readinessHolds)
      .toContain('required-marker-transition-evidence-mismatch')
  })

  it('does not accept a blanket marker boolean as exact postcondition evidence', () => {
    const evidence = {
      ...approvedEvidence(),
      approvedRequiredMarkerTransitions: undefined,
      requiredMarkerTransitionsVerified: true,
    }
    expect(evaluateMigrationPreflight(evidence, manifest).readinessHolds)
      .toContain('required-marker-transition-evidence-mismatch')
  })

  it('requires the exact ordered executable checksum approval', () => {
    const missing = { ...approvedEvidence(), approvedExecutableChecksums: ['c'.repeat(64)] }
    const reordered = { ...approvedEvidence(), approvedExecutableChecksums: ['d'.repeat(64), 'c'.repeat(64)] }

    expect(evaluateMigrationPreflight(missing, manifest).readinessHolds)
      .toContain('final-checksum-set-not-approved')
    expect(evaluateMigrationPreflight(reordered, manifest).readinessHolds)
      .toContain('final-checksum-set-not-approved')
  })

  it('rejects the superseded unsafe Session 17 checksum', () => {
    const unsafe = {
      ...manifest,
      migrations: [{
        version: '20260801000000',
        classification: 'executable',
        supersessionStatus: 'current',
        sha256: UNSAFE_SESSION_17_SHA256,
        requiredMarkerTransition: 'unsafe-postcondition',
      }],
    }
    expect(evaluateMigrationPreflight(approvedEvidence(unsafe), unsafe).readinessHolds)
      .toContain('unsafe-or-empty-executable-checksum-set')
  })

  it('includes TEL-FOUNDATION only through its exact canonical checksum', async () => {
    const checkedInManifest = await loadCheckedInJson('migration-manifest.json')
    const checksums = executableChecksums(checkedInManifest)
    const telemetryEntries = checkedInManifest.migrations.filter((entry: Record<string, unknown>) =>
      entry.filename === '20260809120000_academy_operational_telemetry_foundation.sql',
    )

    expect(checksums.filter((value) =>
      value === '5646d92084f85dd1a5b5463cff3f97970dc1e9017c85a809443266d8dcb1c23d',
    )).toHaveLength(1)
    expect(telemetryEntries).toEqual([expect.objectContaining({
      sha256: '5646d92084f85dd1a5b5463cff3f97970dc1e9017c85a809443266d8dcb1c23d',
    })])
  })

  it('keeps checked-in unresolved evidence blocked for real readiness holds', async () => {
    const checkedInManifest = await loadCheckedInJson('migration-manifest.json')
    const checkedInEvidence = await loadCheckedInJson('hosted-foundation-baseline-evidence.json')
    const result = evaluateMigrationPreflight(checkedInEvidence, checkedInManifest)

    expect(result.allowed).toBe(false)
    expect(result.readinessHolds).toEqual(expect.arrayContaining([
      'historical-version-evidence-mismatch',
      'required-marker-transition-evidence-mismatch',
      'foundation-equivalence-not-reconfirmed',
      'historical-baseline-authorization-absent',
      'migration-history-unresolved',
      'final-metadata-repreflight-not-passed',
      'final-checksum-set-not-approved',
    ]))
    expect(result.readinessHolds).not.toContain('exact-project-not-verified')
  })

  it('keeps manifest contract errors distinct from evidence readiness holds', async () => {
    const { result: manifestResult } = await validateCheckedInManifest((entry, index) =>
      index === 5 ? { ...entry, classification: 'historical-baseline' } : entry,
    )
    const evidenceResult = evaluateMigrationPreflight(
      { ...approvedEvidence(), finalMetadataRepreflightPassed: false },
      manifest,
    )

    expect(manifestResult.contractErrors).toContain('migration-classification-order-invalid')
    expect(evidenceResult.readinessHolds).toEqual(['final-metadata-repreflight-not-passed'])
    expect(evidenceResult.readinessHolds).not.toContain('migration-classification-order-invalid')
  })
})

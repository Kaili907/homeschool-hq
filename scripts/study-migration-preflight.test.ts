import { describe, expect, it } from 'vitest'
import {
  evaluateMigrationPreflight,
  EXPECTED_STUDY_PROJECT_REF,
  UNSAFE_SESSION_17_SHA256,
  validateMigrationManifest,
} from './study-migration-preflight.mjs'

const manifest = {
  schemaVersion: 1,
  migrations: [
    { classification: 'historical-baseline', supersessionStatus: 'current', sha256: 'a'.repeat(64) },
    { classification: 'executable', supersessionStatus: 'current', sha256: 'b'.repeat(64) },
  ],
}

function approvedEvidence() {
  return {
    projectRef: EXPECTED_STUDY_PROJECT_REF,
    exactProjectVerified: true,
    foundationObjectEquivalenceReconfirmed: true,
    historicalBaselineAuthorization: true,
    migrationHistoryResolved: true,
    hostedDriftAbsent: true,
    finalMetadataRepreflightPassed: true,
    hostedMutationAuthorized: false,
    approvedExecutableChecksums: ['b'.repeat(64)],
  }
}

describe('hosted Study migration authorization preflight', () => {
  it('independently verifies the checked-in final file set and canonical hashes', async () => {
    const checkedInManifest = JSON.parse(await import('node:fs/promises').then(({ readFile }) =>
      readFile(new URL('../docs/study-engine-final-production/migration-manifest.json', import.meta.url), 'utf8'),
    ))
    await expect(validateMigrationManifest(
      checkedInManifest,
      new URL('../supabase/migrations/', import.meta.url),
    )).resolves.toMatchObject({ valid: true, reasons: [] })

    const tampered = {
      ...checkedInManifest,
      migrations: checkedInManifest.migrations.map((entry: Record<string, unknown>, index: number) =>
        index === 4 ? { ...entry, sha256: 'f'.repeat(64) } : entry),
    }
    const result = await validateMigrationManifest(
      tampered,
      new URL('../supabase/migrations/', import.meta.url),
    )
    expect(result.valid).toBe(false)
    expect(result.reasons.some((reason: string) => reason.startsWith('migration-checksum-mismatch:'))).toBe(true)
  })

  it('allows only an exact fully approved evidence and checksum set', () => {
    expect(evaluateMigrationPreflight(approvedEvidence(), manifest)).toMatchObject({ allowed: true, reasons: [] })
  })

  it.each([
    ['projectRef', 'wrong-project', 'exact-project-not-verified'],
    ['historicalBaselineAuthorization', false, 'historical-baseline-authorization-absent'],
    ['migrationHistoryResolved', false, 'migration-history-unresolved'],
    ['hostedDriftAbsent', false, 'hosted-drift-present-or-unknown'],
    ['finalMetadataRepreflightPassed', false, 'final-metadata-repreflight-not-passed'],
  ])('refuses %s drift', (key, value, reason) => {
    const evidence = { ...approvedEvidence(), [key]: value }
    expect(evaluateMigrationPreflight(evidence, manifest).reasons).toContain(reason)
  })

  it('rejects the superseded unsafe Session 17 checksum and mismatched approval', () => {
    const unsafe = {
      ...manifest,
      migrations: [{ classification: 'executable', supersessionStatus: 'current', sha256: UNSAFE_SESSION_17_SHA256 }],
    }
    expect(evaluateMigrationPreflight(approvedEvidence(), unsafe)).toMatchObject({ allowed: false })
    expect(evaluateMigrationPreflight({ ...approvedEvidence(), approvedExecutableChecksums: [] }, manifest).reasons)
      .toContain('final-checksum-set-not-approved')
  })
})

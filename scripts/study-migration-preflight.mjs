import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const EXPECTED_STUDY_PROJECT_REF = 'ymtvzmqhfvwjtxjdmybs'
export const UNSAFE_SESSION_17_SHA256 = '46c68426d21a79b90a3011d5fbfcca19044393887636dd845ca362f6e4e69443'

function sameStringArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index])
}

export function executableChecksums(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) return []
  return manifest.migrations
    .filter((entry) => entry.classification === 'executable' && entry.supersessionStatus !== 'superseded')
    .map((entry) => typeof entry.sha256 === 'string' ? entry.sha256.toLowerCase() : '')
}

export async function validateMigrationManifest(manifest, migrationDirectory) {
  const reasons = []
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  if (manifest?.schemaVersion !== 1 || entries.length === 0) {
    return Object.freeze({ valid: false, reasons: Object.freeze(['manifest-invalid-or-empty']) })
  }
  const filenames = entries.map((entry) => entry?.filename)
  const versions = entries.map((entry) => entry?.version)
  const hashes = entries.map((entry) => typeof entry?.sha256 === 'string' ? entry.sha256.toLowerCase() : '')
  if (new Set(filenames).size !== filenames.length) reasons.push('duplicate-migration-filename')
  if (new Set(versions).size !== versions.length) reasons.push('duplicate-migration-version')
  if (new Set(hashes).size !== hashes.length) reasons.push('duplicate-migration-checksum')
  if (filenames.some((name, index) =>
    typeof name !== 'string' || !/^\d{14}_.+\.sql$/.test(name) || !name.startsWith(`${versions[index]}_`)
  )) reasons.push('migration-filename-version-invalid')
  if (JSON.stringify([...filenames].sort()) !== JSON.stringify(filenames) ||
      JSON.stringify([...versions].sort()) !== JSON.stringify(versions)) {
    reasons.push('migration-order-invalid')
  }
  if (entries.some((entry, index) =>
    entry?.dependency !== (index === 0 ? null : filenames[index - 1])
  )) reasons.push('migration-dependency-invalid')
  if (entries.some((entry, index) =>
    (index < 4 && entry?.classification !== 'historical-baseline') ||
    (index >= 4 && entry?.classification !== 'executable') ||
    typeof entry?.applicationStatus !== 'string' ||
    typeof entry?.requiredMarkerTransition !== 'string' ||
    entry.requiredMarkerTransition.length === 0 ||
    typeof entry?.supersessionStatus !== 'string' ||
    !/^[0-9a-f]{64}$/.test(hashes[index])
  )) reasons.push('migration-entry-contract-invalid')
  if (hashes.includes(UNSAFE_SESSION_17_SHA256)) reasons.push('unsafe-session-17-executable')

  let files = []
  try {
    files = (await readdir(migrationDirectory))
      .filter((name) => /^\d{14}_.+\.sql$/.test(name))
      .sort()
  } catch {
    reasons.push('migration-directory-unavailable')
  }
  if (JSON.stringify(files) !== JSON.stringify(filenames)) reasons.push('migration-file-set-mismatch')
  if (files.length === filenames.length) {
    for (let index = 0; index < entries.length; index += 1) {
      try {
        const migrationPath = migrationDirectory instanceof URL
          ? new URL(filenames[index], migrationDirectory)
          : resolve(migrationDirectory, filenames[index])
        const source = await readFile(migrationPath, 'utf8')
        const actual = createHash('sha256').update(source.replaceAll('\r\n', '\n')).digest('hex')
        if (actual !== hashes[index]) reasons.push(`migration-checksum-mismatch:${filenames[index]}`)
      } catch {
        reasons.push(`migration-unreadable:${filenames[index]}`)
      }
    }
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) })
}

/** Pure, local, non-mutating authorization gate. */
export function evaluateMigrationPreflight(evidence, manifest) {
  const reasons = []
  const checksums = executableChecksums(manifest)
  if (evidence?.projectRef !== EXPECTED_STUDY_PROJECT_REF || evidence?.exactProjectVerified !== true) {
    reasons.push('exact-project-not-verified')
  }
  if (evidence?.foundationObjectEquivalenceReconfirmed !== true) reasons.push('foundation-equivalence-not-reconfirmed')
  if (evidence?.historicalBaselineAuthorization !== true) reasons.push('historical-baseline-authorization-absent')
  if (evidence?.migrationHistoryResolved !== true) reasons.push('migration-history-unresolved')
  if (evidence?.hostedDriftAbsent !== true) reasons.push('hosted-drift-present-or-unknown')
  if (evidence?.finalMetadataRepreflightPassed !== true) reasons.push('final-metadata-repreflight-not-passed')
  if (evidence?.hostedMutationAuthorized === true) reasons.push('evidence-must-not-authorize-hosted-mutation')
  const approved = Array.isArray(evidence?.approvedExecutableChecksums)
    ? evidence.approvedExecutableChecksums.map((value) => typeof value === 'string' ? value.toLowerCase() : '')
    : evidence?.approvedExecutableChecksums
  if (checksums.length === 0 || checksums.includes(UNSAFE_SESSION_17_SHA256)) reasons.push('unsafe-or-empty-executable-checksum-set')
  if (!sameStringArray(approved, checksums)) reasons.push('final-checksum-set-not-approved')
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons), checksums: Object.freeze(checksums) })
}

async function main() {
  const args = process.argv.slice(2)
  const evidenceArg = args.indexOf('--evidence')
  const manifestArg = args.indexOf('--manifest')
  if (evidenceArg < 0 || manifestArg < 0 || !args[evidenceArg + 1] || !args[manifestArg + 1]) {
    throw new Error('Usage: study-migration-preflight --evidence <path> --manifest <path>')
  }
  const evidence = JSON.parse(await readFile(resolve(args[evidenceArg + 1]), 'utf8'))
  const manifestPath = resolve(args[manifestArg + 1])
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const manifestValidation = await validateMigrationManifest(manifest, resolve('supabase/migrations'))
  const result = evaluateMigrationPreflight(evidence, manifest)
  const reasons = [...manifestValidation.reasons, ...result.reasons]
  const allowed = manifestValidation.valid && result.allowed
  process.stdout.write(`${JSON.stringify({ allowed, reasons })}\n`)
  if (!allowed) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'preflight_failed'}\n`)
    process.exitCode = 1
  })
}

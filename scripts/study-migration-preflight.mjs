import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export const EXPECTED_STUDY_PROJECT_REF = 'ymtvzmqhfvwjtxjdmybs'
export const UNSAFE_SESSION_17_SHA256 = '46c68426d21a79b90a3011d5fbfcca19044393887636dd845ca362f6e4e69443'

function sameStringArray(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index])
}

export function historicalVersions(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) return []
  return manifest.migrations
    .filter((entry) => entry.classification === 'historical-baseline')
    .map((entry) => entry.version)
}

export function requiredMarkerTransitions(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) return []
  return manifest.migrations.map((entry) => entry.requiredMarkerTransition)
}

export function executableChecksums(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.migrations)) return []
  return manifest.migrations
    .filter((entry) => entry.classification === 'executable' && entry.supersessionStatus !== 'superseded')
    .map((entry) => typeof entry.sha256 === 'string' ? entry.sha256.toLowerCase() : '')
}

function exactHistoricalReconciliation(approvals, filename, previousSha256, replacementSha256) {
  return Array.isArray(approvals) && approvals.some((approval) =>
    approval?.approved === true &&
    approval?.filename === filename &&
    approval?.previousSha256?.toLowerCase() === previousSha256 &&
    approval?.replacementSha256?.toLowerCase() === replacementSha256 &&
    typeof approval?.approvalReference === 'string' &&
    /^[A-Z0-9][A-Z0-9._/-]{2,80}$/.test(approval.approvalReference)
  )
}

export async function validateMigrationManifest(manifest, migrationDirectory, options = {}) {
  const reasons = []
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  if (manifest?.schemaVersion !== 1 || entries.length === 0) {
    const contractErrors = Object.freeze(['manifest-invalid-or-empty'])
    return Object.freeze({ valid: false, reasons: contractErrors, contractErrors })
  }
  if (manifest?.projectRef !== EXPECTED_STUDY_PROJECT_REF) reasons.push('manifest-project-ref-invalid')
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
  let executableSeen = false
  let classificationOrderInvalid = false
  for (const entry of entries) {
    if (entry?.classification === 'executable') {
      executableSeen = true
    } else if (entry?.classification === 'historical-baseline') {
      if (executableSeen) classificationOrderInvalid = true
    } else {
      classificationOrderInvalid = true
    }
  }
  if (classificationOrderInvalid) reasons.push('migration-classification-order-invalid')
  if (entries.some((entry, index) =>
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
  const fileVersions = files.map((filename) => filename.slice(0, 14))
  const duplicateFileVersions = [...new Set(fileVersions.filter((version, index) =>
    fileVersions.indexOf(version) !== index,
  ))]
  for (const version of duplicateFileVersions) reasons.push(`duplicate-migration-version:${version}`)

  const fileSet = new Set(files)
  const manifestFileSet = new Set(filenames)
  for (const filename of files) {
    if (!manifestFileSet.has(filename)) reasons.push(`missing-manifest-entry:${filename}`)
  }
  for (const filename of filenames) {
    if (typeof filename === 'string' && !fileSet.has(filename)) reasons.push(`orphan-manifest-entry:${filename}`)
  }
  if (JSON.stringify(files) !== JSON.stringify(filenames)) reasons.push('migration-file-set-mismatch')
  for (let index = 0; index < entries.length; index += 1) {
    if (!fileSet.has(filenames[index])) continue
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

  const frozenHistory = options?.frozenHistoricalMigrations
  const approvals = options?.approvedHistoricalReconciliations
  if (frozenHistory !== undefined && !Array.isArray(frozenHistory)) {
    reasons.push('historical-baseline-contract-invalid')
  } else if (Array.isArray(frozenHistory)) {
    for (const frozen of frozenHistory) {
      const previousSha256 = typeof frozen?.sha256 === 'string' ? frozen.sha256.toLowerCase() : ''
      const current = entries.find((entry) => entry?.filename === frozen?.filename)
      const replacementSha256 = typeof current?.sha256 === 'string' ? current.sha256.toLowerCase() : ''
      if (typeof frozen?.filename !== 'string' || !/^[0-9a-f]{64}$/.test(previousSha256)) {
        reasons.push('historical-baseline-contract-invalid')
      } else if (!current) {
        reasons.push(`historical-migration-missing:${frozen.filename}`)
      } else if (current.classification !== 'historical-baseline') {
        reasons.push(`historical-migration-reclassified:${frozen.filename}`)
      } else if (replacementSha256 !== previousSha256 && !exactHistoricalReconciliation(
        approvals,
        frozen.filename,
        previousSha256,
        replacementSha256,
      )) {
        reasons.push(`historical-migration-mutation-unapproved:${frozen.filename}`)
      }
    }
  }
  const contractErrors = Object.freeze(reasons)
  return Object.freeze({ valid: reasons.length === 0, reasons: contractErrors, contractErrors })
}

/** Pure, local, non-mutating authorization gate. */
export function evaluateMigrationPreflight(evidence, manifest) {
  const reasons = []
  const checksums = executableChecksums(manifest)
  const expectedHistoricalVersions = historicalVersions(manifest)
  const expectedMarkerTransitions = requiredMarkerTransitions(manifest)
  if (manifest?.projectRef !== EXPECTED_STUDY_PROJECT_REF ||
      evidence?.projectRef !== manifest?.projectRef ||
      evidence?.projectRef !== EXPECTED_STUDY_PROJECT_REF ||
      evidence?.exactProjectVerified !== true) {
    reasons.push('exact-project-not-verified')
  }
  if (!sameStringArray(evidence?.historicalVersions, expectedHistoricalVersions)) {
    reasons.push('historical-version-evidence-mismatch')
  }
  if (!sameStringArray(evidence?.approvedRequiredMarkerTransitions, expectedMarkerTransitions)) {
    reasons.push('required-marker-transition-evidence-mismatch')
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
  const readinessHolds = Object.freeze(reasons)
  return Object.freeze({
    allowed: reasons.length === 0,
    reasons: readinessHolds,
    readinessHolds,
    checksums: Object.freeze(checksums),
  })
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
  process.stdout.write(`${JSON.stringify({
    allowed,
    contractErrors: manifestValidation.contractErrors,
    readinessHolds: result.readinessHolds,
    reasons,
  })}\n`)
  if (!allowed) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'preflight_failed'}\n`)
    process.exitCode = 1
  })
}

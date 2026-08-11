import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const EXPECTED_STUDY_PROJECT_REF = 'ymtvzmqhfvwjtxjdmybs'
export const UNSAFE_SESSION_17_SHA256 = '46c68426d21a79b90a3011d5fbfcca19044393887636dd845ca362f6e4e69443'

/**
 * Closed classification -> allowed applicationStatus SET.
 *
 * Classification stays bivalent — a migration is either already part of hosted history
 * or it is work this estate may still run — because that is the only distinction the
 * gate acts on. What a single status could not express is that the historical side has
 * two genuinely different provenances, and they are not interchangeable:
 *
 *   hosted-equivalent-baseline-pending-authorization
 *     the hosted object was confirmed equivalent to the local definition, but its
 *     ledger entry still awaits separate authorization
 *   hosted-applied-ledger-recorded
 *     the migration is recorded in the hosted ledger as applied
 *
 * Both mean "never replayable", which is why both sit under one classification. An
 * executable migration has never run against the hosted project, so it admits exactly
 * one status; in particular it may never claim to be ledger-recorded, and a historical
 * baseline may never claim it has not been applied. No controlling document defines any
 * other status, so any other pairing is a misclassification rather than a state this
 * estate has reached.
 */
export const ALLOWED_APPLICATION_STATUS = new Map([
  ['historical-baseline', new Set([
    'hosted-equivalent-baseline-pending-authorization',
    'hosted-applied-ledger-recorded',
  ])],
  ['executable', new Set(['not-applied-hosted'])],
])

/**
 * The immutable hosted historical floor. A read-only provenance audit established
 * that these migrations exist in the hosted historical ledger and are permanently
 * non-replayable, so no manifest this estate can legally present may ever offer one
 * of them as executable work.
 *
 * Membership, never position. The historical/executable boundary index legitimately
 * moves — applying an executable migration promotes it and grows the historical
 * prefix — so any rule phrased as a count or an offset stops meaning "these
 * migrations are already hosted" the moment the lineage grows. This list is a floor,
 * not a ceiling: the historical set may grow above it and never shrink below it.
 *
 * Ten members: the four foundation migrations the Aug 2 2026 reset left in the hosted
 * ledger, and the six Study migrations the Aug 3 2026 DDL burst applied to it. The six
 * were carried as executable until this reconciliation — a repository record that had
 * fallen behind hosted reality, and one that offered six already-applied migrations as
 * replayable work. Every migration on this lineage above the ten has never run against
 * hosted and is deliberately absent from this floor; that set was one migration when
 * this comment was first written and grows with each forward append, which is exactly
 * why the rule below is membership of these ten and never a count or an offset.
 */
export const FROZEN_HISTORICAL_BASELINE_FILENAMES = Object.freeze([
  '20260724074106_academy_profiles_base.sql',
  '20260724230000_academy_student_identity_foundation.sql',
  '20260726120000_academy_household_revision_cas.sql',
  '20260731120000_academy_gateway_usage.sql',
  '20260801010000_academy_study_engine_storage.sql',
  '20260801011000_academy_study_engine_authorization.sql',
  '20260801012000_academy_study_engine_production_reconciliation.sql',
  '20260801160000_academy_study_verified_identity.sql',
  '20260801170000_academy_study_adult_review_operations.sql',
  '20260801190000_academy_study_final_production_reconciliation.sql',
])

/** One reason for every way a frozen member can stop being a present historical baseline. */
export const FROZEN_HISTORICAL_BASELINE_DEMOTED = 'frozen-historical-baseline-demoted'

/**
 * True when any frozen member is absent from the manifest or no longer carries the
 * historical-baseline classification. Absence covers deletion and rename alike: a
 * renamed member is, to a membership test, simply a member that is not there.
 *
 * Every entry bearing a frozen filename is examined, never a filename-keyed lookup of
 * them. A lookup keyed by filename is last-write-wins, so a manifest listing a frozen
 * member twice — the real entry demoted to executable, an identical historical-baseline
 * twin placed after it — would report the twin's classification while the demoted entry
 * went on minting executable work out of an already-hosted migration. Reading both
 * directions over all entries makes the rule independent of the order duplicates
 * happen to appear in, and so independent of the duplicate rules in manifest validation.
 */
function frozenHistoricalBaselineViolated(entries) {
  const historical = new Set()
  const notHistorical = new Set()
  for (const entry of entries) {
    ;(entry?.classification === 'historical-baseline' ? historical : notHistorical).add(entry?.filename)
  }
  return FROZEN_HISTORICAL_BASELINE_FILENAMES.some((filename) =>
    !historical.has(filename) || notHistorical.has(filename))
}

function classificationStatusMismatch(entries) {
  return entries.some((entry) =>
    !ALLOWED_APPLICATION_STATUS.get(entry?.classification)?.has(entry?.applicationStatus))
}

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
  // The historical/executable boundary is whatever each entry declares, not a fixed
  // position: applying an executable migration promotes it to a historical baseline,
  // and forward migrations are appended, so both counts move over time. What does not
  // move is the shape — this lineage is an append-only chain rooted in migrations that
  // already exist on the hosted project, so a legal manifest always has a nonempty
  // historical prefix and a nonempty executable suffix.
  const classifications = entries.map((entry) => entry?.classification)
  if (classifications.some((value) => !ALLOWED_APPLICATION_STATUS.has(value))) {
    reasons.push('migration-classification-invalid')
  } else {
    const boundary = classifications.indexOf('executable')
    if (boundary < 0) reasons.push('migration-executable-set-empty')
    else if (boundary === 0) reasons.push('migration-historical-baseline-set-empty')
    if (boundary >= 0 && classifications.slice(boundary).some((value) => value !== 'executable')) {
      reasons.push('migration-classification-order-invalid')
    }
  }
  // The shape rules above constrain where the boundary may sit; this one constrains
  // which migrations may sit below it. A manifest can satisfy every shape rule and
  // still be illegal, because moving the boundary back over an already-hosted
  // migration leaves a perfectly ordered historical prefix and executable suffix.
  if (frozenHistoricalBaselineViolated(entries)) reasons.push(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  if (classificationStatusMismatch(entries)) reasons.push('migration-classification-status-mismatch')
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
  // Re-checked here and not only in validateMigrationManifest: the checksum set below
  // is derived from `classification` alone, so an executable entry wearing the
  // historical hosted-equivalence status would otherwise buy itself an approval by
  // having its checksum re-approved.
  const migrations = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  if (classificationStatusMismatch(migrations)) {
    reasons.push('migration-classification-status-mismatch')
  }
  // Enforced here as well as in validateMigrationManifest, and for the same reason:
  // demoting an already-hosted migration mints a new executable entry, and an evidence
  // record rewritten alongside the manifest approves that enlarged checksum set without
  // the equality tripwire making a sound. Evidence re-approval must not buy the demotion.
  if (frozenHistoricalBaselineViolated(migrations)) {
    reasons.push(FROZEN_HISTORICAL_BASELINE_DEMOTED)
  }
  const approved = Array.isArray(evidence?.approvedExecutableChecksums)
    ? evidence.approvedExecutableChecksums.map((value) => typeof value === 'string' ? value.toLowerCase() : '')
    : evidence?.approvedExecutableChecksums
  if (checksums.length === 0 || checksums.includes(UNSAFE_SESSION_17_SHA256)) reasons.push('unsafe-or-empty-executable-checksum-set')
  // Exact ordered equality is a separate-authorization tripwire, not a proof of
  // classification: it establishes that the evidence record and the manifest agree,
  // which catches drift between records authored apart, but one actor holding both
  // can always make them agree. Do not weaken it, and do not lean on it for more.
  if (!sameStringArray(approved, checksums)) reasons.push('final-checksum-set-not-approved')
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons), checksums: Object.freeze(checksums) })
}

export function isDirectExecution(moduleUrl, entrypoint) {
  return typeof entrypoint === 'string' &&
    realpathSync(fileURLToPath(moduleUrl)) === realpathSync(resolve(entrypoint))
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

if (isDirectExecution(import.meta.url, process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'preflight_failed'}\n`)
    process.exitCode = 1
  })
}

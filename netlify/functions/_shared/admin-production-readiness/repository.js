import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { analyzeMigrationCollisions } from '../../../../scripts/migration-collision-detector.mjs'
import { createAdminCurriculumActivationPersistence } from '../admin-curriculum-activation.js'
import { createAdminCurriculumIntegrityService } from '../admin-curriculum-integrity.js'
import { createAdminCurriculumPublishingPersistence } from '../admin-curriculum-publishing.js'
import { createAdminCurriculumStagingPersistence } from '../admin-curriculum-staging.js'

const ROOT = new URL('../../../../', import.meta.url)
const MIGRATIONS = new URL('supabase/migrations/', ROOT)
const MIGRATION_MANIFEST = new URL('docs/study-engine-final-production/migration-manifest.json', ROOT)
const RELEASE_REGISTRY = new URL('curriculum-content/manuel-academy/production-release-registry.json', ROOT)
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/
const SHA256 = /^[0-9a-f]{64}$/
const RELEASE_CONTROL_MIGRATION_SUFFIXES = Object.freeze({
  registry: '_academy_curriculum_release_registry.sql',
  staging: '_academy_curriculum_release_staging.sql',
  publishing: '_academy_curriculum_release_publishing.sql',
  activationRollback: '_academy_curriculum_activation_rollback.sql',
})

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function normalizedDigest(text) {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n'), 'utf8').digest('hex')
}

async function migrationEvidence() {
  const [filenames, manifestText] = await Promise.all([
    readdir(MIGRATIONS),
    readFile(MIGRATION_MANIFEST, 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)
  const analysis = analyzeMigrationCollisions(filenames, manifest)
  const entries = Array.isArray(manifest?.migrations) ? manifest.migrations : []
  let hashMismatchCount = 0
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object'
      || typeof entry.filename !== 'string'
      || typeof entry.sha256 !== 'string'
      || !SHA256.test(entry.sha256)) {
      hashMismatchCount++
      continue
    }
    try {
      const source = await readFile(new URL(entry.filename, MIGRATIONS), 'utf8')
      if (normalizedDigest(source) !== entry.sha256) hashMismatchCount++
    } catch {
      hashMismatchCount++
    }
  }
  return Object.freeze({
    state: analysis.ok && entries.length === analysis.migrationCount && hashMismatchCount === 0
      ? 'ready' : 'blocked',
    migrationCount: analysis.migrationCount,
    manifestCount: entries.length,
    collisionVersions: Object.freeze(analysis.collisions.map(({ version }) => version)),
    orderingHazardCount: analysis.orderingHazards.length,
    hashMismatchCount,
  })
}

async function curriculumEvidence() {
  const registry = JSON.parse(await readFile(RELEASE_REGISTRY, 'utf8'))
  if (!exactObject(registry, ['schemaVersion', 'currentRelease', 'releases'])
    || registry.schemaVersion !== 1
    || !VERSION.test(registry.currentRelease)
    || !Array.isArray(registry.releases)) throw new TypeError('invalid release registry')
  const releases = registry.releases.filter((release) =>
    exactObject(release, ['version', 'status', 'sourceDirectory'])
    && VERSION.test(release.version)
    && (release.status === 'active' || release.status === 'inactive')
    && release.sourceDirectory === release.version)
  const active = releases.filter((release) => release.status === 'active')
  if (releases.length !== registry.releases.length
    || active.length !== 1
    || active[0].version !== registry.currentRelease) throw new TypeError('invalid active release')

  const releaseRoot = new URL(
    `curriculum-content/manuel-academy/${encodeURIComponent(active[0].sourceDirectory)}/`,
    ROOT,
  )
  const [manifest, validation] = await Promise.all([
    readFile(new URL('curriculum-manifest.json', releaseRoot), 'utf8').then(JSON.parse),
    readFile(new URL('validation/validation.json', releaseRoot), 'utf8').then(JSON.parse),
  ])
  const ready = manifest?.version === registry.currentRelease
    && validation?.version === registry.currentRelease
    && validation?.overall === 'PASS'
    && manifest?.status === 'curriculum-authoring-release-complete'
  return Object.freeze({
    state: ready ? 'ready' : 'blocked',
    activeVersion: registry.currentRelease,
    registeredReleaseCount: releases.length,
    validationState: validation?.overall === 'PASS' ? 'passed' : 'failed',
  })
}

async function releaseControlEvidence() {
  const filenames = await readdir(MIGRATIONS)
  const hasMigration = (suffix) => filenames.some((filename) => filename.endsWith(suffix))
  const registry = hasMigration(RELEASE_CONTROL_MIGRATION_SUFFIXES.registry)
  const staging = hasMigration(RELEASE_CONTROL_MIGRATION_SUFFIXES.staging)
    && typeof createAdminCurriculumStagingPersistence === 'function'
  const integrity = typeof createAdminCurriculumIntegrityService === 'function'
  const publishing = hasMigration(RELEASE_CONTROL_MIGRATION_SUFFIXES.publishing)
    && typeof createAdminCurriculumPublishingPersistence === 'function'
  const activationRollback = hasMigration(RELEASE_CONTROL_MIGRATION_SUFFIXES.activationRollback)
    && typeof createAdminCurriculumActivationPersistence === 'function'
  return Object.freeze({
    state: registry && staging && integrity && publishing && activationRollback
      ? 'ready' : 'blocked',
    registry,
    staging,
    integrity,
    publishing,
    activationRollback,
  })
}

/** Repository-only facts. No network client or hosted credential is accepted. */
export function createRepositoryProductionReadinessSource() {
  return Object.freeze({
    async read() {
      const [migrations, curriculum, releaseControls] = await Promise.all([
        migrationEvidence(),
        curriculumEvidence(),
        releaseControlEvidence(),
      ])
      return Object.freeze({ migrations, curriculum, releaseControls })
    },
  })
}

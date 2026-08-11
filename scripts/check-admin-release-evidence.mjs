import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'docs/admin-console/rc2-release-evidence-manifest.json')
const evidencePath = resolve(root, 'docs/admin-console/rc2-release-evidence.md')
const goNoGoPath = resolve(root, 'docs/admin-console/rc2-go-no-go.md')
const sha40 = /^[0-9a-f]{40}$/
const sha64 = /^[0-9a-f]{64}$/

function fail(message) {
  throw new Error(`RELEASE EVIDENCE CHECK FAILED: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: options.encoding ?? null,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function commitExists(sha) {
  if (!sha40.test(sha)) return false
  return spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
    cwd: root,
    stdio: 'ignore',
  }).status === 0
}

function artifactAt(commit, path) {
  assert(sha40.test(commit), `invalid commit identity ${commit}`)
  assert(
    typeof path === 'string'
      && path.length > 0
      && !path.startsWith('/')
      && !path.includes('..')
      && !path.includes(':'),
    `unsafe artifact path ${String(path)}`,
  )
  try {
    return git(['show', `${commit}:${path}`])
  } catch {
    fail(`artifact does not resolve: ${commit}:${path}`)
  }
}

function exactSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function migrationSha256(bytes) {
  return createHash('sha256')
    .update(bytes.toString('utf8').replaceAll('\r\n', '\n'))
    .digest('hex')
}

function fullCommitShas(text) {
  const found = new Set()
  for (const match of text.matchAll(/[0-9a-f]{40}/g)) {
    const before = match.index === 0 ? '' : text[match.index - 1]
    const after = text[match.index + 40] ?? ''
    if (!/[0-9a-f]/.test(before) && !/[0-9a-f]/.test(after)) found.add(match[0])
  }
  return found
}

function verifyNoSecretValues(text) {
  const patterns = [
    ['Anthropic credential value', /sk-ant-[A-Za-z0-9_-]{8,}/],
    ['JWT value', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['credential-bearing URL', /https?:\/\/[^/\s:@]+:[^@\s/]+@/],
    ['assigned server credential value', /\b(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|STUDY_SAFETY_RATE_LIMIT_HMAC_KEY)\s*=\s*[^\s`|]+/],
  ]
  for (const [label, pattern] of patterns) assert(!pattern.test(text), `${label} found in package`)
}

function verifyManifestShape(manifest) {
  assert(manifest?.schemaVersion === 1, 'unsupported evidence manifest schema')
  assert(manifest?.artifactHash === 'sha256-exact-bytes', 'unexpected artifact hash contract')
  assert(manifest?.migrationHash === 'sha256-lf-normalized-utf8', 'unexpected migration hash contract')
  assert(manifest?.release?.rc2Sha === 'PENDING', 'this package must be refreshed for a completed RC2')
  assert(Array.isArray(manifest?.sources) && manifest.sources.length >= 8, 'source evidence list is incomplete')
}

function verifyReleaseIdentity(manifest) {
  const release = manifest.release
  for (const [label, sha] of [
    ['RC1', release.rc1Sha],
    ['observed partial RC2', release.observedPartialRc2Sha],
    ['observed partial RC2 base', release.observedPartialRc2Base],
  ]) assert(commitExists(sha), `${label} commit does not resolve: ${sha}`)

  const ancestry = spawnSync('git', [
    'merge-base', '--is-ancestor', release.observedPartialRc2Base, release.observedPartialRc2Sha,
  ], { cwd: root, stdio: 'ignore' })
  assert(ancestry.status === 0, 'observed in-progress RC2 does not descend from its recorded RC1 base')
  assert(release.observedPartialRc2Base === release.rc1Sha, 'observed in-progress RC2 base differs from RC1')

  const ref = spawnSync('git', ['rev-parse', '--verify', release.rc2LocalRef], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  if (ref.status === 0) {
    const current = ref.stdout.trim()
    assert(
      current === release.observedPartialRc2Sha,
      `local RC2 assembly ref moved to ${current}; refresh the evidence package before relying on RC2_SHA=PENDING`,
    )
  }
}

function verifySourceArtifacts(manifest, evidenceText) {
  let count = 0
  const ids = new Set()
  for (const source of manifest.sources) {
    assert(typeof source?.id === 'string' && !ids.has(source.id), `duplicate or invalid source id ${String(source?.id)}`)
    ids.add(source.id)
    assert(commitExists(source.commit), `${source.id} commit does not resolve: ${source.commit}`)
    assert(evidenceText.includes(source.commit), `${source.id} SHA is not present in the operator evidence document`)
    assert(Array.isArray(source.artifacts) && source.artifacts.length > 0, `${source.id} has no artifacts`)
    for (const artifact of source.artifacts) {
      assert(sha64.test(artifact.sha256), `${source.id}:${artifact.path} has invalid SHA-256`)
      const actual = exactSha256(artifactAt(source.commit, artifact.path))
      assert(actual === artifact.sha256, `${source.id}:${artifact.path} expected ${artifact.sha256}, observed ${actual}`)
      count++
    }
  }
  return count
}

function verifyRc1Migrations(manifest) {
  const custody = manifest.rc1MigrationManifest
  assert(commitExists(custody.commit), `RC1 migration-manifest commit does not resolve: ${custody.commit}`)
  const manifestBytes = artifactAt(custody.commit, custody.path)
  assert(exactSha256(manifestBytes) === custody.sha256, 'RC1 migration-manifest artifact digest mismatch')
  const migrationManifest = JSON.parse(manifestBytes.toString('utf8'))
  assert(Array.isArray(migrationManifest.migrations), 'RC1 migration manifest has no migrations array')
  assert(migrationManifest.migrations.length === custody.expectedMigrationCount, 'RC1 migration count differs from evidence manifest')

  const treeFiles = git([
    'ls-tree', '-r', '--name-only', custody.commit, '--', 'supabase/migrations',
  ], { encoding: 'utf8' })
    .split('\n')
    .filter((path) => path.endsWith('.sql'))
    .map((path) => path.slice('supabase/migrations/'.length))
  const manifestFiles = migrationManifest.migrations.map((entry) => entry.filename)
  assert(JSON.stringify(treeFiles) === JSON.stringify(manifestFiles), 'RC1 migration tree and manifest file coverage/order differ')

  const versions = new Set()
  for (const [index, entry] of migrationManifest.migrations.entries()) {
    assert(/^\d{14}_[a-z0-9_]+\.sql$/.test(entry.filename), `invalid RC1 migration filename ${entry.filename}`)
    const version = entry.filename.slice(0, 14)
    assert(!versions.has(version), `duplicate RC1 migration version ${version}`)
    versions.add(version)
    assert(sha64.test(entry.sha256), `invalid RC1 migration digest for ${entry.filename}`)
    const expectedDependency = index === 0 ? null : migrationManifest.migrations[index - 1].filename
    assert((entry.dependency ?? null) === expectedDependency, `non-linear RC1 dependency for ${entry.filename}`)
    const bytes = artifactAt(custody.commit, `supabase/migrations/${entry.filename}`)
    const actual = migrationSha256(bytes)
    assert(actual === entry.sha256, `RC1 migration ${entry.filename} expected ${entry.sha256}, observed ${actual}`)
  }
  return migrationManifest.migrations.length
}

function verifyOperatorDocs(manifest, evidenceText, goNoGoText) {
  const combined = `${evidenceText}\n${goNoGoText}`
  assert(evidenceText.includes('RC2_SHA = PENDING'), 'release evidence does not mark RC2 pending')
  assert(goNoGoText.includes('RC2_SHA = PENDING'), 'GO / NO-GO package does not mark RC2 pending')
  assert(combined.includes('NO-GO / UNVERIFIED'), 'required production classification is absent')

  const holds = [
    'Push / merge',
    'Hosted migration application',
    'Deployment',
    'Production publication',
    'Activation',
    'Rollback (application, database corrective action/restore, or curriculum pointer)',
  ]
  const lines = goNoGoText.split('\n')
  for (const action of holds) {
    const line = lines.find((candidate) => candidate.includes(action))
    assert(line?.includes('DIRECTOR AUTHORIZATION REQUIRED'), `${action} Director hold is missing`)
  }

  for (const sha of fullCommitShas(combined)) assert(commitExists(sha), `document-referenced commit does not resolve: ${sha}`)
  for (const source of manifest.sources) assert(combined.includes(source.commit), `operator docs omit ${source.id} SHA`)
  verifyNoSecretValues(`${combined}\n${JSON.stringify(manifest)}`)
}

function main() {
  assert(process.argv.length === 2, 'this read-only command accepts no arguments')
  const manifestText = readFileSync(manifestPath, 'utf8')
  const evidenceText = readFileSync(evidencePath, 'utf8')
  const goNoGoText = readFileSync(goNoGoPath, 'utf8')
  const manifest = JSON.parse(manifestText)

  verifyManifestShape(manifest)
  verifyReleaseIdentity(manifest)
  const artifactCount = verifySourceArtifacts(manifest, evidenceText)
  const migrationCount = verifyRc1Migrations(manifest)
  verifyOperatorDocs(manifest, evidenceText, goNoGoText)

  console.log(`[PASS] ${manifest.sources.length} immutable evidence source commits resolve`)
  console.log(`[PASS] ${artifactCount} source artifact SHA-256 values match`)
  console.log(`[PASS] RC1 migration custody: ${migrationCount} files, order, dependencies, and SHA-256 values match`)
  console.log('[PASS] operator classification, Director holds, SHA references, and secret-value guard match')
  console.log('[PASS] safety: local files and fixed git read operations only; no arguments or hosted access')
  console.log('RESULT: ADMIN_RELEASE_EVIDENCE_REFERENCES_VALID')
  console.log('RELEASE: RC2_SHA=PENDING; PRODUCTION=NO-GO / UNVERIFIED')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

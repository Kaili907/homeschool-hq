import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = resolve(root, 'docs/study-engine-final-production/migration-manifest.json')
const migrationRoot = resolve(root, 'supabase/migrations')
const vitestPath = resolve(root, 'node_modules/vitest/vitest.mjs')
const sandboxPath = '/usr/bin/sandbox-exec'
const networkDeniedSandbox = '(version 1) (allow default) (deny network*)'
const testPaths = [
  'netlify/functions/_shared/admin-curriculum-integrity.test.js',
  'supabase/academy-curriculum-release-staging.db.test.ts',
  'supabase/academy-curriculum-release-publishing.db.test.ts',
  'supabase/academy-curriculum-activation-rollback.db.test.ts',
]
const requiredMigrations = [
  '20260808120000_academy_admin_authorization.sql',
  '20260809130000_academy_admin_audit_foundation.sql',
  '20260809160000_academy_curriculum_release_registry.sql',
  '20260809170000_academy_admin_curriculum_audit_vocabulary.sql',
  '20260810120000_academy_curriculum_draft_authoring.sql',
  '20260810140000_academy_curriculum_human_approval.sql',
  '20260810150000_academy_curriculum_release_staging.sql',
  '20260810160000_academy_curriculum_release_publishing.sql',
  '20260810170000_academy_curriculum_activation_rollback.sql',
]
const linkedProjectMarkers = [
  'supabase/.temp/project-ref',
  'supabase/.branches/_current_branch',
  '.supabase/project-ref',
]
const forbiddenTestSource = [
  ['hosted Supabase client', /@supabase\/supabase-js|\bcreateClient\s*\(/],
  ['network API', /\bfetch\s*\(|from\s+['"]node:(?:http|https|net|tls)['"]/],
  ['child process escape', /from\s+['"]node:child_process['"]/],
  ['hosted command', /\bsupabase\s+(?:link|db\s+push|migration\s+up)\b|\bpsql\b/],
]

function stop(message) {
  throw new Error(`OPERATOR STOP: ${message}`)
}

function sha256Normalized(bytes) {
  return createHash('sha256')
    .update(bytes.toString('utf8').replaceAll('\r\n', '\n'))
    .digest('hex')
}

function migrationMismatches(manifest) {
  const byName = new Map(manifest.migrations.map((entry) => [entry.filename, entry]))
  const positions = requiredMigrations.map((filename) => (
    manifest.migrations.findIndex((entry) => entry.filename === filename)
  ))
  const orderMismatch = positions.some((position, index) => (
    position < 0 || (index > 0 && position <= positions[index - 1])
  ))
  const mismatches = orderMismatch ? ['required release migrations are absent or out of order'] : []
  return mismatches.concat(requiredMigrations.flatMap((filename) => {
    const entry = byName.get(filename)
    if (!entry) return [`${filename}: absent from custody manifest`]
    const path = resolve(migrationRoot, filename)
    if (!existsSync(path)) return [`${filename}: migration file unavailable`]
    const actual = sha256Normalized(readFileSync(path))
    return actual === entry.sha256
      ? []
      : [`${filename}: expected ${entry.sha256}, observed ${actual}`]
  }))
}

function assertLocalOnlyGuard() {
  if (process.argv.length !== 2) {
    stop('this command accepts no project reference, URL, connection string, or passthrough arguments')
  }
  const presentMarker = linkedProjectMarkers.find((path) => existsSync(resolve(root, path)))
  if (presentMarker) {
    stop(`linked Supabase marker present at ${presentMarker}; unlink outside this rehearsal or use a clean worktree`)
  }
  if (!existsSync(vitestPath)) {
    stop('the repository-local Vitest runtime is unavailable; do not substitute a remote runner')
  }
  if (process.platform !== 'darwin' || !existsSync(sandboxPath)) {
    stop('this MAC rehearsal requires the macOS sandbox to enforce network denial')
  }
  for (const relativePath of testPaths) {
    const source = readFileSync(resolve(root, relativePath), 'utf8')
    if (!source.includes('@electric-sql/pglite') && relativePath.startsWith('supabase/')) {
      stop(`${relativePath} is no longer bound to the disposable PGlite database`)
    }
    for (const [label, pattern] of forbiddenTestSource) {
      if (pattern.test(source)) stop(`${relativePath} contains a forbidden ${label}`)
    }
  }
}

function scrubHostedEnvironment() {
  const childEnvironment = { ...process.env }
  const hostedKey = /^(?:SUPABASE|DATABASE_URL$|POSTGRES|PGHOST$|PGPORT$|PGUSER$|PGPASSWORD$|PGDATABASE$|NETLIFY_AUTH_TOKEN$|VERCEL_TOKEN$)/i
  const removed = []
  for (const key of Object.keys(childEnvironment)) {
    if (hostedKey.test(key)) {
      removed.push(key)
      delete childEnvironment[key]
    }
  }
  childEnvironment.MANUEL_ACADEMY_RELEASE_REHEARSAL = 'local-disposable-pglite'
  return { childEnvironment, removed: removed.sort() }
}

function assertNetworkSandbox() {
  const probe = [
    "const net = require('node:net')",
    "const socket = net.createConnection({ host: '127.0.0.1', port: 9 })",
    "socket.on('error', (error) => process.exit(error.code === 'EPERM' ? 0 : 2))",
    "socket.on('connect', () => process.exit(3))",
    'setTimeout(() => process.exit(4), 1000)',
  ].join(';')
  const result = spawnSync(sandboxPath, [
    '-p',
    networkDeniedSandbox,
    process.execPath,
    '-e',
    probe,
  ], { timeout: 2_000 })
  if (result.status !== 0) {
    stop(`macOS network-denial self-test failed (exit ${result.status ?? 'unknown'})`)
  }
}

function main() {
  console.log('MANUEL ACADEMY — LOCAL PRODUCTION RELEASE AND ROLLBACK REHEARSAL')
  assertLocalOnlyGuard()
  assertNetworkSandbox()
  console.log('[PASS] hosted-access guard: network denial self-test, no linked marker, hosted client, network API, hosted command, or external test runner')

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const mismatches = migrationMismatches(manifest)
  if (mismatches.length > 0) stop(`migration custody mismatch\n${mismatches.join('\n')}`)
  console.log(`[PASS] migration custody: ${requiredMigrations.length} required migration hashes and order inputs match`)

  const syntheticMismatch = structuredClone(manifest)
  const selected = syntheticMismatch.migrations.find((entry) => entry.filename === requiredMigrations[0])
  selected.sha256 = '0'.repeat(64)
  if (migrationMismatches(syntheticMismatch).length !== 1) {
    stop('the synthetic migration-mismatch stop gate did not fail closed')
  }
  console.log('[PASS] failure rehearsal: synthetic migration mismatch stopped before database creation')

  const { childEnvironment, removed } = scrubHostedEnvironment()
  console.log(`[PASS] environment isolation: ${removed.length} hosted credential/connection variable name(s) removed from the test process`)

  const result = spawnSync(sandboxPath, [
    '-p',
    networkDeniedSandbox,
    process.execPath,
    vitestPath,
    'run',
    '--reporter=verbose',
    ...testPaths,
  ], {
    cwd: root,
    env: childEnvironment,
    stdio: 'inherit',
  })
  if (result.error) stop(`local Vitest process could not start: ${result.error.message}`)
  if (result.status !== 0) stop(`a required local gate failed (Vitest exit ${result.status ?? 'unknown'})`)

  console.log('[PASS] OS/runtime isolation: macOS sandbox process completed with all network access denied')
  console.log('[PASS] release path: approved revision → stage → verify → publish/not-active → activate → second transition → rollback')
  console.log('[PASS] invariants: pointer CAS/history, learner pin isolation, and immutable release/artifact equality')
  console.log('[PASS] operator-stop scenarios: manifest mismatch, tampered artifact, missing approval, stale approval, pointer CAS conflict, authorization failure, partial/unavailable evidence')
  console.log('RESULT: ADMIN_RELEASE_REHEARSAL_READY (local/disposable evidence only)')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}

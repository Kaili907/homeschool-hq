import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)

export const LEARNER_RELEASE_SHA = '7baf8dfbc27168708ed4cf504285a1838d7345f6'
export const PRODUCTION_PROJECT_REF = 'ymtvzmqhfvwjtxjdmybs'
export const REQUIRED_DISABLED_FLAGS = Object.freeze([
  'VITE_FAMILY_PILOT_ENABLED',
  'VITE_STUDY_ENGINE_ENABLED',
  'ACADEMY_STUDY_ENABLED',
])
export const REQUIRED_HOSTED_ENV = Object.freeze([
  Object.freeze({ name: 'HOSTED_SYNC_DATABASE_URL', secret: true }),
  Object.freeze({ name: 'HOSTED_SYNC_TARGET_PROJECT_REF', secret: false }),
])

const SHA = /^[0-9a-f]{40}$/u
const PROJECT_REF = /^[a-z0-9]{20}$/u
const FORBIDDEN_INVENTORY_SQL = /\b(?:insert|update|delete|merge|create|alter|drop|truncate|grant|revoke|comment|copy|call|do|vacuum|analyze|refresh|reindex|cluster|setval|nextval|pg_advisory)\b/iu

function present(env, name) {
  return typeof env?.[name] === 'string' && env[name].length > 0
}

export function inspectEnvironment(env = {}) {
  const hosted = REQUIRED_HOSTED_ENV.map(({ name, secret }) => ({
    name,
    secret,
    present: present(env, name),
  }))
  const flags = REQUIRED_DISABLED_FLAGS.map((name) => ({
    name,
    present: present(env, name),
    disabled: env?.[name] === 'false',
  }))
  const reasons = [
    ...hosted.filter((item) => !item.present).map((item) => `required-env-missing:${item.name}`),
    ...flags.filter((item) => !item.present).map((item) => `required-flag-missing:${item.name}`),
    ...flags.filter((item) => item.present && !item.disabled)
      .map((item) => `feature-flag-not-exact-false:${item.name}`),
  ]
  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    hosted: Object.freeze(hosted),
    flags: Object.freeze(flags),
  })
}

export function inspectTargetIdentity({
  expectedProjectRef,
  environmentProjectRef,
  databaseUrl,
} = {}) {
  const reasons = []
  const expected = typeof expectedProjectRef === 'string' ? expectedProjectRef : ''
  const fromEnvironment = typeof environmentProjectRef === 'string' ? environmentProjectRef : ''
  let connectionIdentityMatched = false
  if (!PROJECT_REF.test(expected)) reasons.push('target-project-ref-invalid')
  if (expected === PRODUCTION_PROJECT_REF) reasons.push('production-target-prohibited')
  if (fromEnvironment !== expected) reasons.push('target-project-ref-environment-mismatch')

  let parsed = null
  try {
    parsed = new URL(databaseUrl)
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
      reasons.push('database-url-protocol-invalid')
    }
    const unexpectedParams = [...parsed.searchParams.keys()].filter((name) => name !== 'sslmode')
    if (unexpectedParams.length > 0) reasons.push('database-url-parameter-not-allowlisted')
    const sslmode = parsed.searchParams.get('sslmode')
    if (sslmode && !['require', 'verify-ca', 'verify-full'].includes(sslmode)) {
      reasons.push('database-url-sslmode-unsafe')
    }
    const directHostMatch = parsed.hostname === `db.${expected}.supabase.co`
    const poolerUserMatch = decodeURIComponent(parsed.username).endsWith(`.${expected}`)
    connectionIdentityMatched = directHostMatch || poolerUserMatch
    if (!directHostMatch && !poolerUserMatch) reasons.push('database-url-project-identity-mismatch')
    if (!parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
      reasons.push('database-url-incomplete')
    }
  } catch {
    reasons.push('database-url-invalid')
  }

  const result = {
    valid: reasons.length === 0,
    productionTargetProhibited: expected === PRODUCTION_PROJECT_REF,
    targetIsNotKnownProduction: PROJECT_REF.test(expected) && expected !== PRODUCTION_PROJECT_REF,
    connectionIdentityMatched,
    reasons: Object.freeze(reasons),
  }
  // The parsed URL carries the password. Keep it usable by the internal runner
  // but non-enumerable so JSON/report serialization cannot disclose it.
  Object.defineProperty(result, 'parsed', { value: parsed, enumerable: false })
  return Object.freeze(result)
}

export function connectionEnvironment(parsed, baseEnvironment = {}) {
  if (!(parsed instanceof URL)) throw new TypeError('parsed_database_url_required')
  const sslmode = parsed.searchParams.get('sslmode') || 'require'
  const processEnvironment = {}
  for (const name of ['PATH', 'LANG', 'LC_ALL', 'TMPDIR', 'HOME']) {
    if (typeof baseEnvironment[name] === 'string') processEnvironment[name] = baseEnvironment[name]
  }
  return {
    ...processEnvironment,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || '5432',
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: decodeURIComponent(parsed.pathname.slice(1)),
    PGSSLMODE: sslmode,
    PGCONNECT_TIMEOUT: '10',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=30000 -c lock_timeout=3000',
  }
}

export function inspectInventorySql(source) {
  const normalized = source.replaceAll('\r\n', '\n')
  const reasons = []
  if (!/^\s*begin\s+isolation\s+level\s+serializable\s+read\s+only\s+deferrable\s*;/iu.test(normalized)) {
    reasons.push('read-only-transaction-boundary-missing')
  }
  if (!/\brollback\s*;\s*$/iu.test(normalized)) reasons.push('rollback-terminator-missing')
  if (FORBIDDEN_INVENTORY_SQL.test(normalized)) reasons.push('write-capable-sql-token-present')
  if (/\\(?:copy|gexec|include|i|ir|o|out|w)\b/iu.test(normalized)) {
    reasons.push('unsafe-psql-meta-command-present')
  }
  return Object.freeze({
    valid: reasons.length === 0,
    sha256: createHash('sha256').update(normalized).digest('hex'),
    reasons: Object.freeze(reasons),
  })
}

export async function inspectRepoGuard({
  rootDirectory,
  learnerReleaseSha,
  convergenceSha,
  run = execFile,
} = {}) {
  const reasons = []
  if (!SHA.test(learnerReleaseSha ?? '')) reasons.push('learner-release-sha-invalid')
  if (!SHA.test(convergenceSha ?? '')) reasons.push('convergence-sha-invalid')
  if (learnerReleaseSha === convergenceSha) reasons.push('convergence-sha-not-distinct-from-learner-release')
  if (reasons.length > 0) return Object.freeze({ valid: false, reasons: Object.freeze(reasons) })

  try {
    const [{ stdout: head }, { stdout: status }] = await Promise.all([
      run('git', ['rev-parse', 'HEAD'], { cwd: rootDirectory, encoding: 'utf8' }),
      run('git', ['status', '--porcelain'], { cwd: rootDirectory, encoding: 'utf8' }),
    ])
    if (head.trim() !== convergenceSha) reasons.push('head-does-not-match-convergence-sha')
    if (status.trim() !== '') reasons.push('worktree-not-clean')
    await run('git', ['cat-file', '-e', `${learnerReleaseSha}^{commit}`], {
      cwd: rootDirectory,
      encoding: 'utf8',
    })
    await run('git', ['cat-file', '-e', `${convergenceSha}^{commit}`], {
      cwd: rootDirectory,
      encoding: 'utf8',
    })
    try {
      await run('git', ['merge-base', '--is-ancestor', learnerReleaseSha, convergenceSha], {
        cwd: rootDirectory,
        encoding: 'utf8',
      })
    } catch {
      reasons.push('learner-release-is-not-convergence-ancestor')
    }
  } catch {
    reasons.push('git-sha-verification-failed')
  }
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) })
}

export function inspectRollbackChecklist(checklist) {
  const reasons = []
  const expected = [
    'backup_captured',
    'restore_owner_named',
    'restore_window_approved',
    'pre_apply_inventory_preserved',
    'feature_flags_disabled',
    'workers_disabled',
    'rollback_stop_criteria_approved',
    'additive_recovery_owner_named',
  ]
  if (checklist?.schemaVersion !== 1) reasons.push('rollback-schema-version-invalid')
  const items = Array.isArray(checklist?.items) ? checklist.items : []
  const ids = items.map((item) => item?.id)
  if (new Set(ids).size !== ids.length) reasons.push('rollback-item-duplicate')
  for (const id of expected) {
    const item = items.find((candidate) => candidate?.id === id)
    if (!item) reasons.push(`rollback-item-missing:${id}`)
    else if (item.requiredBeforeApply !== true || item.status !== 'PENDING') {
      reasons.push(`rollback-item-template-invalid:${id}`)
    }
  }
  if (checklist?.hostedApplyAuthorized !== false) reasons.push('rollback-template-authorizes-apply')
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) })
}

export async function runLocalReplay({ rootDirectory, env = process.env, run = execFile } = {}) {
  const childEnvironment = { ...env, NO_HOSTED_CONTACT: 'true' }
  for (const name of Object.keys(childEnvironment)) {
    if (/^(?:HOSTED_SYNC_|SUPABASE|DATABASE_URL$|PG(?:HOST|PORT|USER|PASSWORD|DATABASE|SERVICE|SERVICEFILE|PASSFILE|OPTIONS)$)/iu.test(name)) {
      delete childEnvironment[name]
    }
  }
  try {
    await run('node', ['scripts/replay-admin-migration-union.mjs'], {
      cwd: rootDirectory,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: childEnvironment,
    })
    return Object.freeze({ valid: true, command: 'node scripts/replay-admin-migration-union.mjs' })
  } catch (error) {
    return Object.freeze({
      valid: false,
      command: 'node scripts/replay-admin-migration-union.mjs',
      reason: 'local-migration-replay-failed',
      exitCode: typeof error?.code === 'number' ? error.code : null,
    })
  }
}

export async function runHostedInventory({ parsedDatabaseUrl, inventoryPath, env, run = execFile } = {}) {
  const source = await readFile(inventoryPath, 'utf8')
  const sqlGuard = inspectInventorySql(source)
  if (!sqlGuard.valid) return Object.freeze({ valid: false, reasons: sqlGuard.reasons })
  try {
    const { stdout } = await run('psql', [
      '-X',
      '--no-password',
      '--set=ON_ERROR_STOP=1',
      '--file', inventoryPath,
    ], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: connectionEnvironment(parsedDatabaseUrl, env),
    })
    return Object.freeze({ valid: true, inventory: stdout, sqlSha256: sqlGuard.sha256 })
  } catch (error) {
    return Object.freeze({
      valid: false,
      reasons: Object.freeze(['hosted-read-inventory-failed']),
      exitCode: typeof error?.code === 'number' ? error.code : null,
    })
  }
}

#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateMigrationManifest } from '../study-migration-preflight.mjs'
import {
  inspectEnvironment,
  inspectInventorySql,
  inspectRepoGuard,
  inspectRollbackChecklist,
  inspectTargetIdentity,
  LEARNER_RELEASE_SHA,
  runHostedInventory,
  runLocalReplay,
} from './lib.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(scriptDirectory, '../..')

function usage() {
  return [
    'Usage:',
    '  node scripts/hosted-sync-preflight/preflight.mjs \\',
    `    --learner-release-sha ${LEARNER_RELEASE_SHA} \\`,
    '    --convergence-sha <40-hex-sha> \\',
    '    --target-project-ref <20-character-non-production-ref> [--hosted-read] [--format json|operator]',
    '',
    'Local mode is the default and performs no network contact.',
    '--hosted-read is catalog-only and runs the checked-in SQL in a read-only transaction.',
    'There is no apply mode.',
  ].join('\n')
}

export function parseArguments(args) {
  const options = {
    learnerReleaseSha: '',
    convergenceSha: '',
    targetProjectRef: '',
    hostedRead: false,
    format: 'operator',
  }
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--hosted-read') options.hostedRead = true
    else if (argument === '--learner-release-sha') options.learnerReleaseSha = args[++index] ?? ''
    else if (argument === '--convergence-sha') options.convergenceSha = args[++index] ?? ''
    else if (argument === '--target-project-ref') options.targetProjectRef = args[++index] ?? ''
    else if (argument === '--format') options.format = args[++index] ?? ''
    else if (argument === '--help' || argument === '-h') options.help = true
    else if (argument === '--apply' || argument.startsWith('--apply=')) {
      throw new Error('apply-mode-does-not-exist')
    } else throw new Error(`unknown-argument:${argument}`)
  }
  if (!['json', 'operator'].includes(options.format)) throw new Error('format-invalid')
  if (!options.help && options.learnerReleaseSha !== LEARNER_RELEASE_SHA) {
    throw new Error('learner-release-sha-does-not-match-pinned-release')
  }
  return Object.freeze(options)
}

function check(id, result, detail = {}) {
  const reasons = result.reasons ?? (result.reason ? [result.reason] : [])
  return Object.freeze({ id, passed: result.valid === true, reasons, ...detail })
}

function inventoryCommand(options) {
  return [
    'node scripts/hosted-sync-preflight/preflight.mjs',
    `--learner-release-sha ${options.learnerReleaseSha}`,
    `--convergence-sha ${options.convergenceSha}`,
    `--target-project-ref ${options.targetProjectRef}`,
    '--hosted-read',
  ].join(' ')
}

export async function runPreflight(options, {
  rootDirectory = defaultRoot,
  env = process.env,
  repoInspector = inspectRepoGuard,
  replayRunner = runLocalReplay,
  inventoryRunner = runHostedInventory,
} = {}) {
  const manifestPath = resolve(rootDirectory, 'docs/study-engine-final-production/migration-manifest.json')
  const migrationDirectory = resolve(rootDirectory, 'supabase/migrations')
  const rollbackPath = resolve(rootDirectory, 'docs/hosted-study-sync/staging-preflight/rollback-checklist.json')
  const inventoryPath = resolve(rootDirectory, 'scripts/hosted-sync-preflight/inventory.sql')
  const [manifestSource, rollbackSource, inventorySource] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(rollbackPath, 'utf8'),
    readFile(inventoryPath, 'utf8'),
  ])
  const manifest = JSON.parse(manifestSource)
  const rollback = JSON.parse(rollbackSource)

  const [repo, migration, replay] = await Promise.all([
    repoInspector({
      rootDirectory,
      learnerReleaseSha: options.learnerReleaseSha,
      convergenceSha: options.convergenceSha,
    }),
    validateMigrationManifest(manifest, migrationDirectory),
    replayRunner({ rootDirectory, env }),
  ])
  const environment = inspectEnvironment(env)
  const target = inspectTargetIdentity({
    expectedProjectRef: options.targetProjectRef,
    environmentProjectRef: env.HOSTED_SYNC_TARGET_PROJECT_REF,
    databaseUrl: env.HOSTED_SYNC_DATABASE_URL,
  })
  const rollbackGuard = inspectRollbackChecklist(rollback)
  const inventorySql = inspectInventorySql(inventorySource)
  const checks = [
    check('repo_sha', repo),
    check('migration_manifest_and_checksums', migration, {
      manifestSha256: createHash('sha256').update(manifestSource).digest('hex'),
      migrationCount: manifest.migrations.length,
    }),
    check('required_environment_presence_and_disabled_flags', environment, {
      environment: environment.hosted,
      featureFlags: environment.flags,
    }),
    check('non_production_target_identity', target, {
      targetIsNotKnownProduction: target.targetIsNotKnownProduction,
      connectionIdentityMatched: target.connectionIdentityMatched,
    }),
    check('local_migration_replay', replay, { command: replay.command }),
    check('rollback_artifact_template', rollbackGuard),
    check('inventory_sql_read_only', inventorySql, { sqlSha256: inventorySql.sha256 }),
  ]

  let hostedInventory = null
  if (options.hostedRead && checks.every((item) => item.passed)) {
    hostedInventory = await inventoryRunner({
      parsedDatabaseUrl: target.parsed,
      inventoryPath,
      env,
    })
    checks.push(check('hosted_read_inventory', hostedInventory, {
      sqlSha256: hostedInventory.sqlSha256,
    }))
  }
  const passed = checks.every((item) => item.passed)
  return Object.freeze({
    schemaVersion: 1,
    procedure: 'hosted-sync-staging-preflight-r1',
    status: passed
      ? options.hostedRead ? 'HOSTED_READ_COMPLETE' : 'READY_FOR_HOSTED_READ'
      : 'BLOCKED',
    mode: options.hostedRead ? 'HOSTED_READ_ONLY' : 'LOCAL_ONLY',
    passed,
    learnerReleaseSha: options.learnerReleaseSha,
    convergenceSha: options.convergenceSha,
    targetProjectRefSupplied: options.targetProjectRef !== '',
    stagingEnvironmentClaimed: false,
    hostedContactPerformed: options.hostedRead && hostedInventory?.valid === true,
    hostedWritePerformed: false,
    stagingApplyAuthorized: false,
    familyEnablementAuthorized: false,
    applyModeAvailable: false,
    checks: Object.freeze(checks),
    blockers: Object.freeze(checks.filter((item) => !item.passed).flatMap((item) =>
      item.reasons.length > 0 ? item.reasons.map((reason) => `${item.id}:${reason}`) : [item.id]
    )),
    inventoryCommandPlan: Object.freeze({
      command: inventoryCommand(options),
      mode: 'HOSTED_READ_ONLY',
      transaction: 'SERIALIZABLE READ ONLY DEFERRABLE; always ROLLBACK',
      writesAuthorized: false,
      output: options.hostedRead && hostedInventory?.valid === true ? hostedInventory.inventory : null,
    }),
  })
}

export function formatOperator(report) {
  const lines = [
    'Hosted sync staging preflight R1',
    `Status: ${report.status}`,
    `Mode: ${report.mode}`,
    `Learner release SHA: ${report.learnerReleaseSha}`,
    `Convergence SHA: ${report.convergenceSha}`,
    `Hosted contact performed: ${report.hostedContactPerformed ? 'YES' : 'NO'}`,
    'Hosted write performed: NO',
    'Staging environment claimed: NO',
    'Staging apply authorized: NO',
    'Family enablement authorized: NO',
    'Apply mode available: NO',
    '',
    'Checks:',
    ...report.checks.map((item) => `- ${item.passed ? 'PASS' : 'BLOCK'} ${item.id}`),
  ]
  if (report.blockers.length > 0) lines.push('', 'Blockers:', ...report.blockers.map((item) => `- ${item}`))
  lines.push('', 'Read-only hosted inventory command plan:', report.inventoryCommandPlan.command)
  if (report.inventoryCommandPlan.output) {
    lines.push('', 'Read-only catalog inventory:', report.inventoryCommandPlan.output.trimEnd())
  }
  return `${lines.join('\n')}\n`
}

async function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`ERROR: ${error.message}\n\n${usage()}\n`)
    process.exitCode = 1
    return
  }
  if (options.help) {
    process.stdout.write(`${usage()}\n`)
    return
  }
  try {
    const report = await runPreflight(options)
    process.stdout.write(options.format === 'json'
      ? `${JSON.stringify(report, null, 2)}\n`
      : formatOperator(report))
    if (!report.passed) process.exitCode = 2
  } catch (error) {
    process.stderr.write(`BLOCKED: ${error instanceof Error ? error.message : 'preflight-failed'}\n`)
    process.exitCode = 2
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()

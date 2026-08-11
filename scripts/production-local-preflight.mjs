import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  evaluateAdminProductionPreflight,
  formatOperatorReport as formatAdminProductionPreflight,
} from './admin-production-preflight.mjs'
import {
  createMigrationReconciliationPlan,
  formatMigrationReconciliationOperatorPlan,
} from './migration-reconciliation-planner.mjs'
import {
  formatStudyDeploymentPreflight,
  runLocalStudyDeploymentPreflight,
  STUDY_DEPLOYMENT_ENV_INVENTORY,
} from './study-deployment-env-preflight.mjs'

export const UNIFIED_LOCAL_PREFLIGHT_SCHEMA_VERSION = 1
export const UNIFIED_LOCAL_PREFLIGHT_COMMAND = 'npm.cmd run preflight:production-local'
export const UNIFIED_LOCAL_PREFLIGHT_PRECEDENCE = Object.freeze([
  'BLOCKED_BY_MIGRATION_IDENTITY',
  'BLOCKED_BY_UNSAFE_ENV',
  'BLOCKED_BY_LOCAL_INTEGRATION',
  'BLOCKED_BY_DEPLOYMENT_CONFIG',
  'BLOCKED_BY_MISSING_ENV',
  'BLOCKED_BY_CONFIGURATION',
  'BLOCKED_BY_STUDY',
  'BLOCKED_BY_PROVIDER_ACCOUNTING',
])

const READY_FOR_HOSTED_PREFLIGHT = 'READY_FOR_HOSTED_PREFLIGHT'
const LOCAL_EXECUTION_FAILED = 'LOCAL_EXECUTION_FAILED'
const READ_ONLY_CONTRACT_VIOLATION = 'READ_ONLY_CONTRACT_VIOLATION'

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function sensitiveEnvironmentValues(env) {
  const inventorySecrets = new Set(STUDY_DEPLOYMENT_ENV_INVENTORY
    .filter((item) => item.secret)
    .map((item) => item.name))
  return Object.entries(env ?? {})
    .filter(([name, value]) =>
      typeof value === 'string' &&
      value.length > 0 &&
      (inventorySecrets.has(name) || /(?:KEY|SECRET|CREDENTIAL)/u.test(name)),
    )
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length)
}

function redactString(source, secretValues) {
  let result = source
  for (const secret of secretValues) {
    if (result === secret) return '[REDACTED]'
    if (secret.length >= 8 && result.includes(secret)) {
      result = result.split(secret).join('[REDACTED]')
    }
  }
  return result
}

function redactSensitiveValues(value, secretValues) {
  if (typeof value === 'string') return redactString(value, secretValues)
  if (Array.isArray(value)) return value.map((item) => redactSensitiveValues(item, secretValues))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [
      redactString(key, secretValues),
      redactSensitiveValues(child, secretValues),
    ]))
  }
  return value
}

function adminComponent(result) {
  const completed = result !== null && result !== undefined
  const ready = completed &&
    result.classification === READY_FOR_HOSTED_PREFLIGHT &&
    result.readyForHostedPreflight === true
  return {
    authority: 'Admin production activation preflight R3',
    completed,
    status: completed ? result.classification : LOCAL_EXECUTION_FAILED,
    ready,
    blockingClassification: ready
      ? null
      : completed ? result.classification : 'BLOCKED_BY_LOCAL_INTEGRATION',
    result: completed ? result : null,
  }
}

function migrationComponent(plan) {
  const completed = plan !== null && plan !== undefined
  const readOnly = completed && plan.mode === 'READ_ONLY' && plan.mutationPerformed === false
  const validationPassed = completed &&
    plan.validation?.valid === true &&
    plan.validation?.result === 'VALID_CANDIDATE_PLAN'
  const ready = readOnly && validationPassed
  return {
    authority: 'Migration reconciliation planner',
    completed,
    status: completed
      ? readOnly ? plan.validation?.result ?? LOCAL_EXECUTION_FAILED : READ_ONLY_CONTRACT_VIOLATION
      : LOCAL_EXECUTION_FAILED,
    ready,
    mode: completed ? plan.mode ?? 'UNKNOWN' : 'UNKNOWN',
    mutationPerformed: completed ? plan.mutationPerformed !== false : false,
    blockingClassification: ready
      ? null
      : completed && !readOnly ? 'BLOCKED_BY_LOCAL_INTEGRATION' : 'BLOCKED_BY_MIGRATION_IDENTITY',
    result: completed ? plan : null,
  }
}

function studyComponent(result) {
  const completed = result !== null && result !== undefined
  const ready = completed &&
    result.overall === 'READY_FOR_DEPLOYMENT_ENVIRONMENT' &&
    result.ready === true
  return {
    authority: 'Study production deployment environment preflight',
    completed,
    status: completed ? result.overall : LOCAL_EXECUTION_FAILED,
    ready,
    blockingClassification: ready
      ? null
      : completed ? result.overall : 'BLOCKED_BY_DEPLOYMENT_CONFIG',
    result: completed ? result : null,
  }
}

/**
 * Conservatively composes completed subsystem results. A missing subsystem
 * result fails closed and every blocker remains visible even when another
 * blocker has higher overall precedence.
 */
export function evaluateUnifiedLocalProductionPreflight({
  adminResult = null,
  migrationPlan = null,
  studyResult = null,
  env = {},
} = {}) {
  const components = {
    adminR3: adminComponent(adminResult),
    migrationReconciliation: migrationComponent(migrationPlan),
    studyDeploymentEnvironment: studyComponent(studyResult),
  }
  const blockers = Object.entries(components)
    .filter(([, component]) => !component.ready)
    .map(([subsystem, component]) => ({
      subsystem,
      authority: component.authority,
      classification: component.blockingClassification,
      authorityStatus: component.status,
    }))
  const precedenceMatch = UNIFIED_LOCAL_PREFLIGHT_PRECEDENCE.find((classification) =>
    blockers.some((blocker) => blocker.classification === classification),
  )
  const overall = blockers.length === 0
    ? READY_FOR_HOSTED_PREFLIGHT
    : precedenceMatch ?? 'BLOCKED_BY_LOCAL_INTEGRATION'
  const readyForHostedPreflight = overall === READY_FOR_HOSTED_PREFLIGHT && blockers.length === 0
  const report = {
    schemaVersion: UNIFIED_LOCAL_PREFLIGHT_SCHEMA_VERSION,
    preflight: 'unified-local-production-preflight',
    scope: 'local-static-readiness-only',
    command: UNIFIED_LOCAL_PREFLIGHT_COMMAND,
    overall,
    precedence: [...UNIFIED_LOCAL_PREFLIGHT_PRECEDENCE],
    readyForHostedPreflight,
    productionActivationAuthorized: false,
    hostedContactPerformed: false,
    deploymentSmokeTestsPerformed: false,
    phases: {
      localStaticReadiness: {
        status: overall,
        performed: true,
        ready: readyForHostedPreflight,
      },
      hostedPreflight: {
        status: 'NOT_RUN',
        performed: false,
        eligible: readyForHostedPreflight,
        authorized: false,
        contactPerformed: false,
      },
      deploymentSmokeTests: {
        status: 'NOT_RUN',
        performed: false,
        eligible: false,
        authorized: false,
      },
    },
    summary: {
      components: Object.keys(components).length,
      ready: Object.values(components).filter((component) => component.ready).length,
      blocking: blockers.length,
    },
    blockers,
    components,
  }
  const redacted = redactSensitiveValues(report, sensitiveEnvironmentValues(env))
  return deepFreeze(redacted)
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function fulfilledValue(settled) {
  return settled.status === 'fulfilled' ? settled.value : null
}

function resolveFromRoot(rootDirectory, value, fallback) {
  const selected = value ?? fallback
  return isAbsolute(selected) ? resolve(selected) : resolve(rootDirectory, selected)
}

export async function runUnifiedLocalProductionPreflight({
  rootDirectory = process.cwd(),
  env = process.env,
  adminContractPath,
  adminEvidencePath,
  migrationManifestPath,
  migrationDirectory,
  migrationProposalPath = null,
  migrationSafetyPath,
  referenceRoots,
  noReferenceScan = false,
} = {}) {
  const root = resolve(rootDirectory)
  const contractPath = resolveFromRoot(
    root,
    adminContractPath,
    'docs/admin-production-preflight/deployment-contract.json',
  )
  const evidencePath = resolveFromRoot(
    root,
    adminEvidencePath,
    'docs/admin-production-preflight/current-local-evidence.json',
  )
  const manifestPath = resolveFromRoot(
    root,
    migrationManifestPath,
    'docs/study-engine-final-production/migration-manifest.json',
  )
  const migrationsPath = resolveFromRoot(root, migrationDirectory, 'supabase/migrations')
  const proposalPath = migrationProposalPath
    ? resolveFromRoot(root, migrationProposalPath, migrationProposalPath)
    : null
  const safetyPath = resolveFromRoot(
    root,
    migrationSafetyPath,
    'docs/admin-production-preflight/deployment-contract.json',
  )
  const resolvedReferenceRoots = noReferenceScan
    ? []
    : Array.isArray(referenceRoots) && referenceRoots.length > 0
      ? referenceRoots.map((path) => resolveFromRoot(root, path, path))
      : [root]

  const adminPromise = (async () => {
    const [contract, evidence, manifest] = await Promise.all([
      readJson(contractPath),
      readJson(evidencePath),
      readJson(manifestPath),
    ])
    return evaluateAdminProductionPreflight({
      contract,
      evidence,
      manifest,
      migrationDirectory: migrationsPath,
      evidenceRoot: root,
    })
  })()
  const migrationPromise = (async () => {
    const [manifest, proposal, safety] = await Promise.all([
      readJson(manifestPath),
      proposalPath ? readJson(proposalPath) : null,
      readJson(safetyPath),
    ])
    return createMigrationReconciliationPlan({
      migrationDirectory: migrationsPath,
      manifest,
      manifestPath,
      proposal,
      proposalPath,
      safety,
      safetyPath,
      referenceRoots: resolvedReferenceRoots,
    })
  })()
  const studyPromise = runLocalStudyDeploymentPreflight({ rootDirectory: root, env })
  const [admin, migration, study] = await Promise.allSettled([
    adminPromise,
    migrationPromise,
    studyPromise,
  ])
  return evaluateUnifiedLocalProductionPreflight({
    adminResult: fulfilledValue(admin),
    migrationPlan: fulfilledValue(migration),
    studyResult: fulfilledValue(study),
    env,
  })
}

export function serializeUnifiedLocalProductionPreflight(report) {
  return `${JSON.stringify(report, null, 2)}\n`
}

function detailedOperatorResult(component, formatter) {
  if (!component.completed || !component.result) {
    return `Result unavailable: ${LOCAL_EXECUTION_FAILED}`
  }
  return formatter(component.result).trimEnd()
}

export function formatUnifiedLocalProductionPreflight(report) {
  const lines = [
    'Unified local production preflight',
    'Scope: LOCAL STATIC READINESS ONLY (no hosted contact)',
    `Overall: ${report.overall}`,
    `Ready for hosted preflight: ${report.readyForHostedPreflight ? 'YES' : 'NO'}`,
    'Production activation authorized: NO',
    'Hosted preflight: NOT RUN',
    'Deployment smoke tests: NOT RUN',
    `Status precedence: ${report.precedence.join(' > ')}`,
    '',
    'Subsystem authority summary:',
    `- Admin R3: ${report.components.adminR3.status}`,
    `- Migration reconciliation: ${report.components.migrationReconciliation.status} ` +
      `(mode=${report.components.migrationReconciliation.mode}; mutations=` +
      `${report.components.migrationReconciliation.mutationPerformed ? 'YES' : 'NO'})`,
    `- Study deployment environment: ${report.components.studyDeploymentEnvironment.status}`,
  ]
  if (report.blockers.length > 0) {
    lines.push('', 'All local blockers:')
    for (const blocker of report.blockers) {
      lines.push(
        `- ${blocker.subsystem} [${blocker.classification}]: ${blocker.authorityStatus}`,
      )
    }
  }
  lines.push(
    '',
    'Phase boundary:',
    '- This command evaluates local static readiness only.',
    '- Hosted preflight requires separate authorization and was not contacted.',
    '- Deployment smoke tests require a deployed target and were not run.',
    '',
    'Admin R3 authority detail:',
    detailedOperatorResult(report.components.adminR3, formatAdminProductionPreflight),
    '',
    'Migration reconciliation authority detail:',
    detailedOperatorResult(
      report.components.migrationReconciliation,
      formatMigrationReconciliationOperatorPlan,
    ),
    '',
    'Study deployment environment authority detail:',
    detailedOperatorResult(
      report.components.studyDeploymentEnvironment,
      formatStudyDeploymentPreflight,
    ),
  )
  return `${lines.join('\n')}\n`
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

function argumentValues(args, flag) {
  const values = []
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1])
  }
  return values
}

function validateArguments(args) {
  const valued = new Set([
    '--format',
    '--root',
    '--admin-contract',
    '--admin-evidence',
    '--migration-manifest',
    '--migrations',
    '--migration-proposal',
    '--migration-safety',
    '--references',
  ])
  const boolean = new Set(['--no-reference-scan'])
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (valued.has(argument)) {
      if (!args[index + 1] || args[index + 1].startsWith('--')) return false
      index += 1
    } else if (!boolean.has(argument)) {
      return false
    }
  }
  return !args.includes('--apply')
}

async function main() {
  const args = process.argv.slice(2)
  const format = argumentValue(args, '--format') ?? 'operator'
  if (!validateArguments(args) || !['json', 'operator'].includes(format)) {
    throw new Error(
      'Usage: production-local-preflight [--format json|operator] [--root path] ' +
      '[--admin-contract path] [--admin-evidence path] [--migration-manifest path] ' +
      '[--migrations path] [--migration-proposal path] [--migration-safety path] ' +
      '[--references path] [--no-reference-scan] (apply mode is not supported)',
    )
  }
  const report = await runUnifiedLocalProductionPreflight({
    rootDirectory: resolve(argumentValue(args, '--root') ?? process.cwd()),
    adminContractPath: argumentValue(args, '--admin-contract'),
    adminEvidencePath: argumentValue(args, '--admin-evidence'),
    migrationManifestPath: argumentValue(args, '--migration-manifest'),
    migrationDirectory: argumentValue(args, '--migrations'),
    migrationProposalPath: argumentValue(args, '--migration-proposal') ?? null,
    migrationSafetyPath: argumentValue(args, '--migration-safety'),
    referenceRoots: argumentValues(args, '--references'),
    noReferenceScan: args.includes('--no-reference-scan'),
  })
  process.stdout.write(format === 'json'
    ? serializeUnifiedLocalProductionPreflight(report)
    : formatUnifiedLocalProductionPreflight(report))
  if (!report.readyForHostedPreflight) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'production_local_preflight_failed'}\n`)
    process.exitCode = 1
  })
}

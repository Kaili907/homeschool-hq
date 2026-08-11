import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { resolve, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RELEASE_CANDIDATE_SCHEMA_VERSION = 1
export const RELEASE_CANDIDATE_COMMAND = 'npm run validate:release-candidate'
export const RELEASE_CANDIDATE_JSON_COMMAND = 'npm run validate:release-candidate:json'

const READY = 'READY_FOR_HOSTED_PREFLIGHT'
const TEST_FILE = /\.(?:test|spec)\.(?:cjs|js|mjs|ts|tsx)$/iu
const SKIPPED_TESTS = /--passWithNoTests|(?:\|\||;)\s*(?:true|exit\s+0)\b/iu
const EXCLUDED_DIRECTORIES = new Set([
  '.git', '.netlify', 'build', 'coverage', 'dist', 'node_modules',
])
const HOSTED_CREDENTIAL = /^(?:ANTHROPIC_API_KEY|NETLIFY_AUTH_TOKEN|NETLIFY_SITE_ID|OPENAI_API_KEY|SUPABASE_ACCESS_TOKEN|SUPABASE_SERVICE_ROLE_KEY)$/u
const SENSITIVE_NAME = /(?:API_KEY|AUTH_TOKEN|CREDENTIAL|PASSWORD|PRIVATE_KEY|SECRET|SERVICE_ROLE|TOKEN)$/iu
const TEST_RUNNER = /(?:^|\s)(?:vitest|playwright)(?:\s|$)|(?:^|\s)node(?:\s+\S+)*\s+\S*(?:smoke|test|validat)\S*|(?:^|\s)npm(?:\.cmd)?\s+.*\brun\s+(?:smoke|test|validat)/iu

function slash(value) {
  return value.split(sep).join('/')
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function isSafeTestScript(command) {
  return typeof command === 'string' && command.trim().length > 0 && !SKIPPED_TESTS.test(command)
}

function npmScript(script) {
  return Object.freeze({ kind: 'npm-script', script })
}

function vitestFiles(files) {
  return Object.freeze({ kind: 'vitest-files', files: Object.freeze([...files].sort()) })
}

function vitestProject(project) {
  return Object.freeze({ kind: 'vitest-project', project })
}

function gitDiffCheck() {
  return Object.freeze({ kind: 'git-diff-check' })
}

function detectedGate(gate, command, reason, options = {}) {
  return Object.freeze({
    gate,
    blocking: options.blocking !== false,
    availability: 'detected',
    command,
    reason,
    semantic: options.semantic ?? null,
  })
}

function missingGate(gate, reason, options = {}) {
  return Object.freeze({
    gate,
    blocking: options.blocking !== false,
    availability: 'missing',
    command: null,
    reason,
    semantic: null,
  })
}

function notApplicableGate(gate, reason) {
  return Object.freeze({
    gate,
    blocking: false,
    availability: 'not-applicable',
    command: null,
    reason,
    semantic: null,
  })
}

function selectScript(scripts, candidates, validator = () => true) {
  for (const name of candidates) {
    if (!hasOwn(scripts, name)) continue
    const command = scripts[name]
    if (isSafeTestScript(command) && validator(command)) return name
  }
  return null
}

function fileMap(records) {
  return new Map(records.map((record) => {
    if (typeof record === 'string') return [slash(record), '']
    return [slash(record.path), record.content ?? '']
  }))
}

function matchingTests(files, predicate) {
  return [...files.keys()].filter((path) => TEST_FILE.test(path) && predicate(path))
}

function migrationSemantic(stdout) {
  try {
    const result = JSON.parse(stdout)
    if (result?.mode !== 'READ_ONLY' || result?.mutationPerformed !== false) {
      return 'migration planner violated the read-only contract'
    }
    if (result?.validation?.valid !== true || result?.validation?.result !== 'VALID_CANDIDATE_PLAN') {
      return 'migration identity, manifest, or checksum validation blocked'
    }
    return null
  } catch {
    return 'migration planner did not produce valid JSON output'
  }
}

function preflightSemantic(stdout) {
  try {
    const result = JSON.parse(stdout)
    if (result?.hostedContactPerformed !== false || result?.productionActivationAuthorized !== false) {
      return 'local preflight violated the no-hosted-contact contract'
    }
    if (result?.overall !== READY || result?.readyForHostedPreflight !== true) {
      return `unified local production preflight blocked (${result?.overall ?? 'UNKNOWN'})`
    }
    return null
  } catch {
    return 'unified local production preflight did not produce valid JSON output'
  }
}

/**
 * Builds a fixed-order, fail-closed gate plan from repository capabilities.
 * Explicit scripts take precedence; file discovery is limited to named suites.
 */
export function discoverReleaseCandidateGates({ packageScripts = {}, fileRecords = [] } = {}) {
  const files = fileMap(fileRecords)
  const paths = [...files.keys()]
  const gates = []

  const migrationScript = selectScript(
    packageScripts,
    [
      'validate:migration-identity:json',
      'validate:migrations:json',
      'plan:migration-reconciliation:json',
    ],
    (command) => /migration/iu.test(command) && /(?:--format\s+json|--json\b)/iu.test(command),
  )
  gates.push(migrationScript
    ? detectedGate(
        'migration_identity_manifest_checksum',
        npmScript(migrationScript),
        `detected npm script ${migrationScript}`,
        { semantic: migrationSemantic },
      )
    : missingGate(
        'migration_identity_manifest_checksum',
        'required migration identity/manifest/checksum capability is absent',
      ))

  const preflightScript = selectScript(
    packageScripts,
    ['preflight:production-local:json'],
    (command) => /production-local-preflight/iu.test(command) && /--format\s+json/iu.test(command),
  )
  gates.push(preflightScript
    ? detectedGate(
        'unified_local_production_preflight',
        npmScript(preflightScript),
        `detected npm script ${preflightScript}`,
        { semantic: preflightSemantic },
      )
    : missingGate(
        'unified_local_production_preflight',
        'required unified local production preflight capability is absent',
      ))

  const smokeScript = selectScript(
    packageScripts,
    ['smoke:study-production-local'],
    (command) => TEST_RUNNER.test(command) && /study-production-local-smoke/iu.test(command),
  )
  const smokeMarkers = paths.filter((path) =>
    /(?:^|\/)study-production-local-smoke(?:\.|\/)/iu.test(path),
  )
  gates.push(smokeScript
    ? detectedGate(
        'study_local_production_smoke',
        npmScript(smokeScript),
        `detected installed Study smoke via npm script ${smokeScript}`,
      )
    : smokeMarkers.length > 0
      ? missingGate(
          'study_local_production_smoke',
          'Study local production smoke files are installed but the required operator script is absent',
        )
      : notApplicableGate(
          'study_local_production_smoke',
          'Study local production smoke is not installed in this checkout',
        ))

  const rootScript = selectScript(
    packageScripts,
    ['test:root-app'],
    (command) => /vitest\s+run/iu.test(command) && /--project\s+root-app/iu.test(command),
  )
  gates.push(rootScript
    ? detectedGate('full_root_tests', npmScript(rootScript), `detected npm script ${rootScript}`)
    : missingGate('full_root_tests', 'required full root-app test capability is absent'))

  const netlifyScript = selectScript(
    packageScripts,
    ['test:netlify'],
    (command) => /vitest\s+run/iu.test(command) && /--project\s+netlify-functions/iu.test(command),
  )
  gates.push(netlifyScript
    ? detectedGate('full_netlify_tests', npmScript(netlifyScript), `detected npm script ${netlifyScript}`)
    : missingGate('full_netlify_tests', 'required full Netlify test capability is absent'))

  const supabaseScript = selectScript(
    packageScripts,
    ['test:supabase', 'test:supabase-contracts', 'test:db-contracts'],
    (command) => TEST_RUNNER.test(command) && /(?:supabase|root-supabase|db)/iu.test(command),
  )
  const supabaseTests = matchingTests(files, (path) => path.startsWith('supabase/'))
  const hasSupabaseProject = (files.get('vite.config.ts') ?? '').includes("name: 'root-supabase'") ||
    (files.get('vite.config.ts') ?? '').includes('name: "root-supabase"')
  gates.push(supabaseScript
    ? detectedGate('supabase_db_contracts', npmScript(supabaseScript), `detected npm script ${supabaseScript}`)
    : supabaseTests.length > 0 && hasSupabaseProject
      ? detectedGate(
          'supabase_db_contracts',
          vitestProject('root-supabase'),
          `detected root-supabase project with ${supabaseTests.length} contract suite(s)`,
        )
      : missingGate('supabase_db_contracts', 'required complete Supabase/DB contract capability is absent'))

  const adminAuthScript = selectScript(
    packageScripts,
    ['test:admin-auth'],
    (command) => /authorization/iu.test(command) && /vitest\s+run/iu.test(command),
  )
  gates.push(adminAuthScript
    ? detectedGate('admin_authorization', npmScript(adminAuthScript), `detected npm script ${adminAuthScript}`)
    : missingGate('admin_authorization', 'required Admin authorization capability is absent'))

  const costsPricingScript = selectScript(
    packageScripts,
    ['test:costs-pricing', 'test:admin-costs-pricing', 'test:pricing-costs'],
    (command) => TEST_RUNNER.test(command) && /cost/iu.test(command) && /pricing/iu.test(command),
  )
  const costsTests = matchingTests(files, (path) =>
    /^(?:netlify\/functions|src\/(?:admin|components\/admin)|supabase\/).*(?:cost|pricing)/iu.test(path),
  )
  const hasCosts = costsTests.some((path) => /cost/iu.test(path))
  const hasPricing = costsTests.some((path) => /pricing/iu.test(path))
  gates.push(costsPricingScript
    ? detectedGate('costs_pricing', npmScript(costsPricingScript), `detected npm script ${costsPricingScript}`)
    : hasCosts && hasPricing
      ? detectedGate(
          'costs_pricing',
          vitestFiles(costsTests),
          `detected ${costsTests.length} Costs/Pricing suite(s)`,
        )
      : missingGate(
          'costs_pricing',
          `required Costs/Pricing capability is incomplete (costs=${hasCosts ? 'present' : 'missing'}; pricing=${hasPricing ? 'present' : 'missing'})`,
        ))

  const securityScript = selectScript(
    packageScripts,
    ['test:study-security-adversarial', 'test:study-adversarial'],
    (command) => TEST_RUNNER.test(command) && /study/iu.test(command) && /(?:security|adversarial)/iu.test(command),
  )
  const studySecurityTests = matchingTests(files, (path) =>
    /^(?:netlify\/functions\/_shared\/study|src\/study|supabase\/study)/iu.test(path) &&
    /(?:security|adversarial)/iu.test(path),
  )
  const hasSecurity = studySecurityTests.some((path) => /security/iu.test(path))
  const hasAdversarial = studySecurityTests.some((path) => /adversarial/iu.test(path))
  gates.push(securityScript
    ? detectedGate('study_security_adversarial', npmScript(securityScript), `detected npm script ${securityScript}`)
    : hasSecurity && hasAdversarial
      ? detectedGate(
          'study_security_adversarial',
          vitestFiles(studySecurityTests),
          `detected ${studySecurityTests.length} Study security/adversarial suite(s)`,
        )
      : missingGate(
          'study_security_adversarial',
          `required Study security/adversarial capability is incomplete (security=${hasSecurity ? 'present' : 'missing'}; adversarial=${hasAdversarial ? 'present' : 'missing'})`,
        ))

  const recoveryScript = selectScript(
    packageScripts,
    ['test:study-recovery-chaos', 'test:study-chaos'],
    (command) => TEST_RUNNER.test(command) && /study/iu.test(command) && /(?:recovery|chaos)/iu.test(command),
  )
  const recoveryTests = matchingTests(files, (path) =>
    /^(?:netlify\/functions\/_shared\/study|src\/study|supabase\/study)/iu.test(path) &&
    /recovery/iu.test(path) && /chaos/iu.test(path),
  )
  gates.push(recoveryScript
    ? detectedGate('study_recovery_chaos', npmScript(recoveryScript), `detected npm script ${recoveryScript}`)
    : recoveryTests.length > 0
      ? detectedGate(
          'study_recovery_chaos',
          vitestFiles(recoveryTests),
          `detected ${recoveryTests.length} Study recovery/chaos suite(s)`,
        )
      : missingGate('study_recovery_chaos', 'required Study recovery/chaos capability is absent'))

  const operationsScript = selectScript(
    packageScripts,
    ['test:study-operations-browser', 'test:admin-study-operations-browser'],
    (command) => TEST_RUNNER.test(command) && /study/iu.test(command) && /(?:browser|accessib)/iu.test(command),
  )
  const operationTests = matchingTests(files, (path) =>
    /admin.*study.*operations/iu.test(path),
  )
  const accessibleOperationTests = operationTests.filter((path) => {
    if (/(?:accessib|browser)/iu.test(path)) return true
    const content = files.get(path) ?? ''
    return /aria-(?:busy|labelledby|live)/iu.test(content) &&
      /(?:focus-visible|reduced-motion)/iu.test(content)
  })
  gates.push(operationsScript
    ? detectedGate(
        'study_operations_browser_accessibility',
        npmScript(operationsScript),
        `detected npm script ${operationsScript}`,
      )
    : accessibleOperationTests.length > 0
      ? detectedGate(
          'study_operations_browser_accessibility',
          vitestFiles(operationTests),
          `detected ${accessibleOperationTests.length} Study Operations browser/accessibility suite(s)`,
        )
      : missingGate(
          'study_operations_browser_accessibility',
          'required Study Operations browser/accessibility capability is absent',
        ))

  const curriculumScript = selectScript(
    packageScripts,
    ['test:curriculum-validation', 'test:curriculum-contracts'],
    (command) => TEST_RUNNER.test(command) && /curriculum/iu.test(command),
  )
  const curriculumTests = matchingTests(files, (path) =>
    /^(?:netlify\/functions\/admin-curriculum|src\/admin\/curriculum-validation|src\/components\/admin\/CurriculumValidation|src\/curriculum-authoring|tests\/curriculum-content)/iu.test(path),
  )
  gates.push(curriculumScript
    ? detectedGate(
        'curriculum_validation',
        npmScript(curriculumScript),
        `detected npm script ${curriculumScript}`,
      )
    : curriculumTests.length > 0
      ? detectedGate(
          'curriculum_validation',
          vitestFiles(curriculumTests),
          `detected ${curriculumTests.length} curriculum validation suite(s)`,
        )
      : notApplicableGate(
          'curriculum_validation',
          'no curriculum validation suites are installed in this checkout',
        ))

  const typecheckScript = selectScript(
    packageScripts,
    ['typecheck'],
    (command) => /(?:^|\s)tsc(?:\s|$)/iu.test(command) && /--noEmit/iu.test(command),
  )
  gates.push(typecheckScript
    ? detectedGate('typecheck', npmScript(typecheckScript), `detected npm script ${typecheckScript}`)
    : missingGate('typecheck', 'required no-emit TypeScript validation capability is absent'))

  const buildScript = selectScript(
    packageScripts,
    ['build'],
    (command) => /vite\s+build/iu.test(command),
  )
  gates.push(buildScript
    ? detectedGate(
        'production_build',
        npmScript(buildScript),
        `detected npm script ${buildScript}`,
      )
    : missingGate('production_build', 'required production build capability is absent'))

  gates.push(detectedGate(
    'git_diff_check',
    gitDiffCheck(),
    'built-in local git diff --check gate',
  ))

  return Object.freeze(gates)
}

async function listRepositoryFiles(rootDirectory) {
  const records = []
  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue
      const absolute = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolute)
      } else if (entry.isFile()) {
        records.push(slash(relative(rootDirectory, absolute)))
      }
    }
  }
  await visit(rootDirectory)
  records.sort()
  return records
}

async function repositoryFileRecords(rootDirectory) {
  const paths = await listRepositoryFiles(rootDirectory)
  const contentPaths = new Set(['vite.config.ts'])
  for (const path of paths) {
    if (/admin.*study.*operations/iu.test(path) && TEST_FILE.test(path)) contentPaths.add(path)
  }
  return Promise.all(paths.map(async (path) => ({
    path,
    content: contentPaths.has(path)
      ? await readFile(resolve(rootDirectory, path), 'utf8')
      : '',
  })))
}

function sensitiveValues(env) {
  return Object.entries(env ?? {})
    .filter(([name, value]) => SENSITIVE_NAME.test(name) && typeof value === 'string' && value.length >= 4)
    .map(([, value]) => value)
    .sort((left, right) => right.length - left.length)
}

/** Redacts known environment values and common credential-shaped output. */
export function redactSensitiveText(value, env = {}) {
  let result = String(value ?? '')
  for (const secret of sensitiveValues(env)) result = result.split(secret).join('[REDACTED]')
  return result
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;"']+/giu, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|auth[_-]?token|credential|password|private[_-]?key|secret|service[_-]?role|token)\s*[:=]\s*)[^\s,;]+/giu, '$1[REDACTED]')
    .replace(/\b(?:sk|pk)_[A-Za-z0-9_-]{12,}\b/gu, '[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu, '[REDACTED]')
}

function localOnlyEnvironment(env, allowStaticPreflightEnvironment) {
  const result = { ...env, ACADEMY_VALIDATION_SCOPE: 'local-only', NO_HOSTED_CONTACT: 'true' }
  if (!allowStaticPreflightEnvironment) {
    for (const name of Object.keys(result)) {
      if (HOSTED_CREDENTIAL.test(name) || SENSITIVE_NAME.test(name)) delete result[name]
    }
  }
  return result
}

function commandInvocation(command, rootDirectory, env) {
  if (command.kind === 'npm-script') {
    if (typeof env.npm_execpath === 'string' && env.npm_execpath.length > 0) {
      return {
        executable: process.execPath,
        args: [env.npm_execpath, 'run', '--silent', command.script],
        shell: false,
      }
    }
    return {
      executable: process.platform === 'win32' ? 'npm.cmd' : 'npm',
      args: ['run', '--silent', command.script],
      shell: process.platform === 'win32',
    }
  }
  if (command.kind === 'vitest-files') {
    return {
      executable: process.execPath,
      args: [resolve(rootDirectory, 'node_modules/vitest/vitest.mjs'), 'run', ...command.files],
      shell: false,
    }
  }
  if (command.kind === 'vitest-project') {
    return {
      executable: process.execPath,
      args: [resolve(rootDirectory, 'node_modules/vitest/vitest.mjs'), 'run', '--project', command.project],
      shell: false,
    }
  }
  return { executable: 'git', args: ['diff', '--check'], shell: false }
}

export function runLocalCommand(command, {
  rootDirectory,
  env,
  allowStaticPreflightEnvironment = false,
} = {}) {
  return new Promise((fulfill) => {
    const childEnv = localOnlyEnvironment(env, allowStaticPreflightEnvironment)
    const invocation = commandInvocation(command, rootDirectory, childEnv)
    let stdout = ''
    let stderr = ''
    const child = spawn(invocation.executable, invocation.args, {
      cwd: rootDirectory,
      env: childEnv,
      shell: invocation.shell,
      windowsHide: true,
    })
    child.stdout?.setEncoding('utf8')
    child.stderr?.setEncoding('utf8')
    child.stdout?.on('data', (chunk) => { stdout += chunk })
    child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => fulfill({ exitCode: null, stdout, stderr, error }))
    child.on('close', (exitCode, signal) => fulfill({ exitCode, stdout, stderr, signal }))
  })
}

function failureSummary(execution, env) {
  if (execution.error) {
    return `command could not start: ${redactSensitiveText(execution.error.message, env)}`
  }
  const combined = redactSensitiveText(`${execution.stderr ?? ''}\n${execution.stdout ?? ''}`, env)
    .replace(/\u001b\[[0-9;]*m/gu, '')
  const lastLine = combined.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean).at(-1)
  const detail = lastLine ? `: ${lastLine.slice(0, 300)}` : ''
  if (execution.signal) return `command terminated by ${execution.signal}${detail}`
  return `command failed with exit code ${execution.exitCode ?? 'UNKNOWN'}${detail}`
}

function gateResult(plan, status, durationMs, reason) {
  return Object.freeze({
    gate: plan.gate,
    status,
    durationMs: Math.max(0, Math.round(durationMs)),
    reason,
    blocking: plan.blocking,
  })
}

export function classifyReleaseCandidate(gates) {
  const blockers = gates.filter((gate) => gate.blocking && gate.status !== 'PASSED')
  if (blockers.length === 0) return READY
  if (blockers.some((gate) => gate.status === 'MISSING')) return 'BLOCKED_BY_MISSING_GATE'
  if (blockers.some((gate) => gate.gate === 'migration_identity_manifest_checksum')) {
    return 'BLOCKED_BY_MIGRATION_IDENTITY'
  }
  if (blockers.some((gate) => gate.gate === 'unified_local_production_preflight')) {
    return 'BLOCKED_BY_LOCAL_PREFLIGHT'
  }
  if (blockers.some((gate) => gate.gate === 'production_build')) return 'BLOCKED_BY_BUILD'
  return 'BLOCKED_BY_TEST_FAILURE'
}

export function createReleaseCandidateResult(gates) {
  const classification = classifyReleaseCandidate(gates)
  const readyForHostedPreflight = classification === READY
  return Object.freeze({
    schemaVersion: RELEASE_CANDIDATE_SCHEMA_VERSION,
    validation: 'final-release-candidate',
    scope: 'local-validation-only',
    command: RELEASE_CANDIDATE_COMMAND,
    classification,
    status: readyForHostedPreflight ? 'READY' : 'BLOCKED',
    readyForHostedPreflight,
    hostedContactPerformed: false,
    productionActivationAuthorized: false,
    durationMs: gates.reduce((total, gate) => total + gate.durationMs, 0),
    summary: {
      gates: gates.length,
      passed: gates.filter((gate) => gate.status === 'PASSED').length,
      failed: gates.filter((gate) => gate.status === 'FAILED').length,
      missing: gates.filter((gate) => gate.status === 'MISSING').length,
      notApplicable: gates.filter((gate) => gate.status === 'NOT_APPLICABLE').length,
      blocking: gates.filter((gate) => gate.blocking && gate.status !== 'PASSED').length,
    },
    gates: Object.freeze([...gates]),
  })
}

export async function runReleaseCandidateValidation({
  rootDirectory = process.cwd(),
  env = process.env,
  gatePlans = null,
  runner = runLocalCommand,
  now = () => performance.now(),
} = {}) {
  const root = resolve(rootDirectory)
  let plans = gatePlans
  if (!plans) {
    const [packageJson, records] = await Promise.all([
      readFile(resolve(root, 'package.json'), 'utf8').then(JSON.parse),
      repositoryFileRecords(root),
    ])
    plans = discoverReleaseCandidateGates({
      packageScripts: packageJson.scripts ?? {},
      fileRecords: records,
    })
  }

  const results = []
  for (const plan of plans) {
    if (plan.availability === 'missing') {
      results.push(gateResult(plan, 'MISSING', 0, plan.reason))
      continue
    }
    if (plan.availability === 'not-applicable') {
      results.push(gateResult(plan, 'NOT_APPLICABLE', 0, plan.reason))
      continue
    }
    const started = now()
    const execution = await runner(plan.command, {
      rootDirectory: root,
      env,
      gate: plan.gate,
      allowStaticPreflightEnvironment: plan.gate === 'unified_local_production_preflight',
    })
    const durationMs = execution.durationMs ?? now() - started
    const semanticFailure = !execution.error && !execution.signal && plan.semantic
      ? plan.semantic(execution.stdout ?? '')
      : null
    if (execution.exitCode !== 0 || execution.error || execution.signal) {
      results.push(gateResult(
        plan,
        'FAILED',
        durationMs,
        semanticFailure
          ? redactSensitiveText(semanticFailure, env)
          : failureSummary(execution, env),
      ))
      continue
    }
    results.push(semanticFailure
      ? gateResult(plan, 'FAILED', durationMs, redactSensitiveText(semanticFailure, env))
      : gateResult(plan, 'PASSED', durationMs, 'completed successfully'))
  }
  return createReleaseCandidateResult(results)
}

export function serializeReleaseCandidateResult(result) {
  return `${JSON.stringify(result, null, 2)}\n`
}

export function formatReleaseCandidateOperatorResult(result) {
  const lines = [
    'Final release candidate validation',
    'Scope: LOCAL VALIDATION ONLY (no hosted contact)',
    `Classification: ${result.classification}`,
    `Status: ${result.status}`,
    `Ready for hosted preflight: ${result.readyForHostedPreflight ? 'YES' : 'NO'}`,
    `Hosted contact performed: ${result.hostedContactPerformed ? 'YES' : 'NO'}`,
    `Duration: ${result.durationMs}ms`,
    '',
    'Gates:',
  ]
  for (const gate of result.gates) {
    lines.push(
      `- gate=${gate.gate} status=${gate.status} duration=${gate.durationMs}ms ` +
      `blocking=${gate.blocking ? 'blocking' : 'non-blocking'} reason=${JSON.stringify(gate.reason)}`,
    )
  }
  lines.push('', `Operator result: ${result.classification}`)
  return `${lines.join('\n')}\n`
}

function parseArguments(args) {
  if (args.length !== 2 || args[0] !== '--format' || !['json', 'operator'].includes(args[1])) {
    throw new Error('Usage: release-candidate-validation --format operator|json')
  }
  return args[1]
}

async function main() {
  const format = parseArguments(process.argv.slice(2))
  const result = await runReleaseCandidateValidation()
  process.stdout.write(format === 'json'
    ? serializeReleaseCandidateResult(result)
    : formatReleaseCandidateOperatorResult(result))
  if (!result.readyForHostedPreflight) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`release_candidate_validation_failed: ${redactSensitiveText(error instanceof Error ? error.message : error)}\n`)
    process.exitCode = 1
  })
}

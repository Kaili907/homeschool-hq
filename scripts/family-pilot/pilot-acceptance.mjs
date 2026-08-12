// Operator command answering one question: is this integrated tree ready
// for Dad to start the supervised Family Pilot? This is NOT a production
// readiness gate (see scripts/production-local-preflight.mjs) and it never
// contacts a hosted service.
//
// The pieces this checks are each owned by a different sibling branch and
// land independently. A sibling piece that hasn't merged into the tree
// being checked is expected, not an error: this command reports that piece
// as WAITING_ON_INTEGRATION rather than failing the whole run.
import { existsSync, readdirSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const PILOT_ACCEPTANCE_SCHEMA_VERSION = 1

export const PASS = 'PASS'
export const FAIL = 'FAIL'
export const WAITING_ON_INTEGRATION = 'WAITING_ON_INTEGRATION'

const STATUSES = new Set([PASS, FAIL, WAITING_ON_INTEGRATION])

/**
 * The six pieces named in the pilot acceptance goal, wired to how each
 * sibling branch actually ships it. `discoveryPaths` are candidate
 * repo-relative locations; the first one present in the tree being checked
 * is used. When none are present the check reports WAITING_ON_INTEGRATION
 * without running anything.
 */
export const DEFAULT_CHECKS = [
  {
    id: 'family-pilot-readiness',
    label: 'Family pilot readiness',
    discoveryPaths: ['scripts/family-pilot/readiness.mjs'],
    buildCommand: (root, resolvedPath) => ({
      command: process.execPath,
      args: [resolvedPath, '--format', 'json', '--root', root],
    }),
  },
  {
    id: 'grade5-math-unit-validation',
    label: 'Grade 5 Math designated unit validation',
    discoveryPaths: ['scripts/family-pilot/validate-grade5-math-unit.mjs'],
    // The validator itself has no designated unit today and asks the caller
    // to name one; until this runner is told which unit is the pilot unit,
    // that is treated as waiting on that decision, not as a failure.
    waitingExitCodes: [2],
    buildCommand: (root, resolvedPath, ctx) => ({
      command: process.execPath,
      args: [
        resolvedPath,
        ...(ctx.grade5MathUnit ? [`--unit=${ctx.grade5MathUnit}`] : []),
        '--format=json',
      ],
    }),
  },
  {
    id: 'persistence-smoke',
    label: 'Persistence smoke',
    discoveryPaths: ['supabase/family-pilot/persistence/learner-progress-smoke.db.test.ts'],
    buildCommand: (root, resolvedPath) => ({
      command: 'npx',
      args: ['vitest', 'run', resolvedPath, '--reporter=json'],
    }),
  },
  {
    id: 'parent-smoke',
    label: 'Parent smoke',
    discoveryPaths: ['tests/family-pilot/parent'],
    requireNonEmptyDirectory: true,
    buildCommand: (root, resolvedPath) => ({
      command: 'npx',
      args: ['vitest', 'run', resolvedPath, '--reporter=json'],
    }),
  },
  {
    id: 'browser-smoke',
    label: 'Browser smoke',
    discoveryPaths: ['tests/family-pilot/browser/playwright.config.ts'],
    buildCommand: (root, resolvedPath) => ({
      command: 'npx',
      args: ['playwright', 'test', '--config', resolvedPath, '--reporter=json'],
    }),
  },
  {
    id: 'windows-launcher-check',
    label: 'Local launcher check mode',
    discoveryPaths: ['scripts/family-pilot/start-windows.ps1'],
    buildCommand: (root, resolvedPath) => ({
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolvedPath, '-Check', '-Format', 'json', '-RepoRoot', root],
    }),
  },
]

// Some sibling tools report a designation/config gap through their own
// status vocabulary rather than a distinct exit code. Recognized here so
// "present but not yet configured" also reads as WAITING_ON_INTEGRATION
// instead of FAIL.
const WAITING_STATUS_VALUES = new Set(['PILOT_STATIC_UNIT_DESIGNATION_REQUIRED'])

function discoverCheck(check, root) {
  for (const candidate of check.discoveryPaths) {
    const resolvedPath = join(root, candidate)
    if (!existsSync(resolvedPath)) continue
    if (check.requireNonEmptyDirectory) {
      let entries
      try {
        entries = readdirSync(resolvedPath)
      } catch {
        continue
      }
      if (entries.length === 0) continue
    }
    return resolvedPath
  }
  return null
}

function parseJsonOutput(stdout) {
  const trimmed = (stdout ?? '').trim()
  if (!trimmed) return { parsed: null, malformed: false }
  try {
    return { parsed: JSON.parse(trimmed), malformed: false }
  } catch {
    // Some tools log progress lines before a single JSON summary line.
    const lastLine = trimmed.split('\n').filter((line) => line.trim().length > 0).pop()
    if (lastLine) {
      try {
        return { parsed: JSON.parse(lastLine), malformed: false }
      } catch {
        // fall through
      }
    }
    return { parsed: null, malformed: true }
  }
}

/**
 * Classifies one already-run command's outcome. Exit code is authoritative
 * for waiting/pass/fail unless the command's own JSON output says
 * otherwise, so a check that runs but can't produce parseable output still
 * gets a definite (if less detailed) verdict from its exit code.
 */
export function classifyExecution({ exitCode, stdout, waitingExitCodes = [] }) {
  if (waitingExitCodes.includes(exitCode)) {
    return {
      status: WAITING_ON_INTEGRATION,
      detail: `Exit code ${exitCode} indicates this piece is not configured/integrated yet.`,
      malformed: false,
    }
  }
  const { parsed, malformed } = parseJsonOutput(stdout)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if (typeof parsed.status === 'string' && WAITING_STATUS_VALUES.has(parsed.status)) {
      return {
        status: WAITING_ON_INTEGRATION,
        detail: `Reported status ${parsed.status}.`,
        malformed: false,
      }
    }
    if (typeof parsed.ready === 'boolean') {
      return {
        status: parsed.ready ? PASS : FAIL,
        detail: parsed.detail ?? parsed.verdict ?? `ready=${parsed.ready}`,
        malformed: false,
      }
    }
    if (typeof parsed.status === 'string') {
      const normalized = parsed.status.toUpperCase()
      return {
        status: normalized === 'PASS' ? PASS : FAIL,
        detail: parsed.detail ?? `status=${parsed.status}`,
        malformed: false,
      }
    }
  }
  if (malformed) {
    return {
      status: FAIL,
      detail: 'Check output could not be parsed as JSON.',
      malformed: true,
    }
  }
  return {
    status: exitCode === 0 ? PASS : FAIL,
    detail: `Exit code ${exitCode}.`,
    malformed: false,
  }
}

// npx/powershell.exe are resolved by name (not a path this process controls)
// and on Windows that resolution needs a shell — but shell:true does not
// escape arguments, so paths containing spaces (a real, common case: user
// profile directories) must be quoted here ourselves. An absolute command
// (e.g. process.execPath) needs neither the shell nor the quoting.
function needsShell(command) {
  return !isAbsolute(command)
}

function shellQuote(value) {
  const text = String(value)
  return /^[A-Za-z0-9_.:/\\-]+$/.test(text) ? text : `"${text.replace(/"/g, '\\"')}"`
}

function runCommandSync(command, args, cwd) {
  const useShell = needsShell(command)
  const result = spawnSync(command, useShell ? args.map(shellQuote) : args, {
    cwd,
    encoding: 'utf8',
    shell: useShell,
    windowsHide: true,
  })
  if (result.error) {
    return { exitCode: 1, stdout: '', spawnError: result.error.message }
  }
  return { exitCode: result.status ?? 1, stdout: result.stdout ?? '', spawnError: null }
}

function evaluateCheck(check, root, ctx) {
  const resolvedPath = discoverCheck(check, root)
  if (!resolvedPath) {
    return {
      id: check.id,
      label: check.label,
      status: WAITING_ON_INTEGRATION,
      detail: `None of the expected locations exist yet: ${check.discoveryPaths.join(', ')}.`,
      resolvedPath: null,
    }
  }
  const { command, args } = check.buildCommand(root, resolvedPath, ctx)
  const execution = runCommandSync(command, args, root)
  if (execution.spawnError) {
    return {
      id: check.id,
      label: check.label,
      status: FAIL,
      detail: `Could not run this check: ${execution.spawnError}`,
      resolvedPath,
    }
  }
  const { status, detail } = classifyExecution({
    exitCode: execution.exitCode,
    stdout: execution.stdout,
    waitingExitCodes: check.waitingExitCodes ?? [],
  })
  return { id: check.id, label: check.label, status, detail, resolvedPath }
}

function overallStatus(checks) {
  if (checks.some((check) => check.status === FAIL)) return FAIL
  if (checks.some((check) => check.status === WAITING_ON_INTEGRATION)) return WAITING_ON_INTEGRATION
  return PASS
}

export function runPilotAcceptance({
  rootDirectory = process.cwd(),
  checks = DEFAULT_CHECKS,
  grade5MathUnit = null,
} = {}) {
  const root = resolve(rootDirectory)
  const ctx = { rootDirectory: root, grade5MathUnit }
  const results = checks.map((check) => evaluateCheck(check, root, ctx))
  const overall = overallStatus(results)
  return {
    schemaVersion: PILOT_ACCEPTANCE_SCHEMA_VERSION,
    scope: 'supervised-pilot-acceptance-only',
    rootDirectory: root,
    overall,
    checks: results,
    summary: {
      total: results.length,
      pass: results.filter((check) => check.status === PASS).length,
      fail: results.filter((check) => check.status === FAIL).length,
      waiting: results.filter((check) => check.status === WAITING_ON_INTEGRATION).length,
    },
  }
}

export function serializePilotAcceptance(report) {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function formatPilotAcceptance(report) {
  const lines = [
    'Family pilot acceptance (is this tree ready for the supervised pilot?)',
    'Scope: local composition of sibling pilot checks — no hosted calls.',
    `Overall: ${report.overall}`,
    `Checks: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.waiting} waiting on integration`,
    '',
  ]
  for (const check of report.checks) {
    lines.push(`- [${check.status}] ${check.label}: ${check.detail}`)
  }
  return `${lines.join('\n')}\n`
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

const EXIT_CODE_BY_STATUS = { [PASS]: 0, [FAIL]: 1, [WAITING_ON_INTEGRATION]: 3 }

async function main() {
  const args = process.argv.slice(2)
  const format = argumentValue(args, '--format') ?? 'operator'
  if (!['json', 'operator'].includes(format)) {
    throw new Error('Usage: pilot-acceptance.mjs [--format json|operator] [--root path] [--grade5-unit id]')
  }
  const rootArgument = argumentValue(args, '--root')
  const rootDirectory = rootArgument
    ? (isAbsolute(rootArgument) ? rootArgument : resolve(process.cwd(), rootArgument))
    : fileURLToPath(new URL('../../', import.meta.url))
  const report = runPilotAcceptance({
    rootDirectory,
    grade5MathUnit: argumentValue(args, '--grade5-unit') ?? null,
  })
  process.stdout.write(format === 'json'
    ? serializePilotAcceptance(report)
    : formatPilotAcceptance(report))
  process.exitCode = EXIT_CODE_BY_STATUS[report.overall] ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'pilot_acceptance_failed'}\n`)
    process.exitCode = 1
  })
}

export { STATUSES as PILOT_ACCEPTANCE_STATUSES }

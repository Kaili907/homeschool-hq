// Local readiness gate for the supervised one-child Grade 5 Math family pilot.
//
// This is NOT the production Study readiness gate (see
// scripts/study-deployment-env-preflight.mjs / scripts/production-local-preflight.mjs).
// It answers a narrower question: can Dad run the pilot locally/preview right now?
// It never contacts a hosted service — every check reads the local filesystem or
// the local process environment only.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const FAMILY_PILOT_READINESS_SCHEMA_VERSION = 1
const READY = 'READY_FOR_SUPERVISED_PILOT'
const NOT_READY = 'NOT_READY_FOR_SUPERVISED_PILOT'

// Netlify pins the hosted build's Node major version; fall back to this if
// netlify.toml is missing or unparseable in the fixture/root being checked.
const DEFAULT_EXPECTED_NODE_MAJOR = 22
// Floor below which the local toolchain (Vite 6 / Vitest 4) cannot run at all.
// This gates readiness; an exact match to the hosted pin above is reported for
// awareness only, since the pilot itself only ever runs locally.
const MINIMUM_NODE_MAJOR = 18

// Same truthy-value semantics as netlify/functions/_shared/http.js#envFlagEnabled,
// duplicated here rather than imported so this pilot-only tool has no dependency
// on production Study source.
function envFlagEnabled(env, name) {
  const value = env?.[name]
  return typeof value === 'string' && ['1', 'true', 'on', 'enabled'].includes(value.toLowerCase())
}

function nodeMajor(versionString) {
  return Number.parseInt(versionString.replace(/^v/, '').split('.')[0], 10)
}

function expectedHostedNodeMajor(rootDirectory) {
  const netlifyTomlPath = join(rootDirectory, 'netlify.toml')
  if (!existsSync(netlifyTomlPath)) return DEFAULT_EXPECTED_NODE_MAJOR
  const match = readFileSync(netlifyTomlPath, 'utf8').match(/NODE_VERSION\s*=\s*"(\d+)"/)
  return match ? Number.parseInt(match[1], 10) : DEFAULT_EXPECTED_NODE_MAJOR
}

function readJsonIfPresent(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function dirHasEntries(path) {
  if (!existsSync(path)) return false
  try {
    return readdirSync(path).length > 0
  } catch {
    return false
  }
}

/**
 * Each check is self-contained and receives { rootDirectory, env, nodeVersion }.
 * Add new checks by appending to PILOT_CHECKS — the runner and both report
 * formats pick them up automatically.
 */
export const PILOT_CHECKS = [
  {
    id: 'node-runtime',
    label: 'Correct Node runtime',
    run({ rootDirectory, nodeVersion }) {
      const actualMajor = nodeMajor(nodeVersion)
      const expectedMajor = expectedHostedNodeMajor(rootDirectory)
      const meetsFloor = Number.isFinite(actualMajor) && actualMajor >= MINIMUM_NODE_MAJOR
      const matchesHostedPin = actualMajor === expectedMajor
      return {
        pass: meetsFloor,
        detail: meetsFloor
          ? `Node ${nodeVersion} meets the minimum (${MINIMUM_NODE_MAJOR}+) the local toolchain needs` +
            (matchesHostedPin ? '.' : `; note: hosted builds pin Node ${expectedMajor} (netlify.toml).`)
          : `Node ${nodeVersion} is below the minimum Node ${MINIMUM_NODE_MAJOR} the local toolchain needs.`,
      }
    },
  },
  {
    id: 'local-repo-build-availability',
    label: 'Local repo/build availability',
    run({ rootDirectory }) {
      const missing = []
      if (!existsSync(join(rootDirectory, 'package.json'))) missing.push('package.json')
      if (!existsSync(join(rootDirectory, 'node_modules'))) missing.push('node_modules (run npm ci)')
      return {
        pass: missing.length === 0,
        detail: missing.length === 0
          ? 'package.json and node_modules are present.'
          : `Missing: ${missing.join(', ')}.`,
      }
    },
  },
  {
    id: 'grade5-math-static-unit',
    label: 'Grade 5 Math static unit is present',
    run({ rootDirectory }) {
      const registryPath = join(
        rootDirectory,
        'curriculum-content/manuel-academy/production-release-registry.json',
      )
      const registry = readJsonIfPresent(registryPath)
      if (!registry?.currentRelease) {
        return { pass: false, detail: `Curriculum release registry not readable: ${registryPath}` }
      }
      const mathDir = join(
        rootDirectory,
        'curriculum-content/manuel-academy',
        registry.currentRelease,
        'grades/grade-5/courses/mathematics',
      )
      const present = dirHasEntries(mathDir)
      return {
        pass: present,
        detail: present
          ? `Grade 5 mathematics course present at ${mathDir}.`
          : `Grade 5 mathematics course not found at ${mathDir}.`,
      }
    },
  },
  {
    id: 'student-route-module',
    label: 'Student route/module exists',
    run({ rootDirectory }) {
      const required = [
        'src/curriculum/practice/grade5MathPracticeRoute.ts',
        'src/components/curriculum/Grade5MathPractice.tsx',
      ]
      const missing = required.filter((path) => !existsSync(join(rootDirectory, path)))
      return {
        pass: missing.length === 0,
        detail: missing.length === 0
          ? 'Grade 5 Math practice route and component are both present.'
          : `Missing: ${missing.join(', ')}.`,
      }
    },
  },
  {
    id: 'parent-supervision-surface',
    label: 'Parent supervision surface exists',
    run({ rootDirectory }) {
      const candidates = ['src/components/GrownUps.tsx', 'src/components/hub/ParentHub.tsx']
      const found = candidates.filter((path) => existsSync(join(rootDirectory, path)))
      return {
        pass: found.length > 0,
        detail: found.length > 0
          ? `Found: ${found.join(', ')}.`
          : `None of the known parent surfaces exist: ${candidates.join(', ')}.`,
      }
    },
  },
  {
    id: 'local-progress-session-support',
    label: 'Local progress/session support exists',
    run({ rootDirectory }) {
      const appStatePath = join(rootDirectory, 'src/appState.ts')
      if (!existsSync(appStatePath)) {
        return { pass: false, detail: `${appStatePath} does not exist.` }
      }
      const usesLocalStorage = readFileSync(appStatePath, 'utf8').includes('localStorage')
      return {
        pass: usesLocalStorage,
        detail: usesLocalStorage
          ? 'src/appState.ts persists progress via localStorage (no hosted dependency).'
          : 'src/appState.ts exists but no longer references localStorage.',
      }
    },
  },
  {
    id: 'pilot-dependencies-present',
    label: 'No required pilot dependency is obviously missing',
    run({ rootDirectory }) {
      const pkg = readJsonIfPresent(join(rootDirectory, 'package.json'))
      if (!pkg) return { pass: false, detail: 'package.json not readable.' }
      const required = [
        ['react', pkg.dependencies],
        ['react-dom', pkg.dependencies],
        ['vite', pkg.devDependencies],
      ]
      const missing = required.filter(([name, section]) => !section?.[name]).map(([name]) => name)
      return {
        pass: missing.length === 0,
        detail: missing.length === 0
          ? 'react, react-dom, and vite are all declared.'
          : `Missing from package.json: ${missing.join(', ')}.`,
      }
    },
  },
  {
    id: 'production-study-dark',
    label: 'Production Study remains dark',
    run({ env }) {
      const enabled = envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')
      return {
        pass: !enabled,
        detail: enabled
          ? 'ACADEMY_STUDY_ENABLED is set to an enabled value in this environment; the pilot expects it dark.'
          : 'ACADEMY_STUDY_ENABLED is not enabled in this environment.',
      }
    },
  },
  {
    id: 'no-email-sms-required',
    label: 'Email/SMS are not required for the pilot',
    run() {
      // Design invariant, not an environment probe: nothing in this checker may
      // ever require an email/SMS provider credential for pilot readiness. If a
      // future check adds one to REQUIRED_ENV_VAR_IDS, this fails and calls it out.
      const requiredEnvVarIds = PILOT_CHECKS
        .flatMap((check) => check.requiredEnvVars ?? [])
      const emailOrSmsPattern = /EMAIL|SMS|SENDGRID|TWILIO|RESEND|MAIL(?!_TO_SELF)/i
      const offenders = requiredEnvVarIds.filter((name) => emailOrSmsPattern.test(name))
      return {
        pass: offenders.length === 0,
        detail: offenders.length === 0
          ? 'No pilot check requires an email/SMS provider credential.'
          : `These checks require email/SMS credentials, which the pilot must not need: ${offenders.join(', ')}.`,
      }
    },
  },
]

export function evaluateFamilyPilotReadiness({
  rootDirectory = process.cwd(),
  env = process.env,
  nodeVersion = process.version,
} = {}) {
  const root = resolve(rootDirectory)
  const ctx = { rootDirectory: root, env, nodeVersion }
  const checks = PILOT_CHECKS.map((check) => {
    let outcome
    try {
      outcome = check.run(ctx)
    } catch (error) {
      outcome = { pass: false, detail: `Check threw: ${error instanceof Error ? error.message : String(error)}` }
    }
    return { id: check.id, label: check.label, pass: outcome.pass === true, detail: outcome.detail }
  })
  const failed = checks.filter((check) => !check.pass)
  const verdict = failed.length === 0 ? READY : NOT_READY
  return {
    schemaVersion: FAMILY_PILOT_READINESS_SCHEMA_VERSION,
    scope: 'local-family-pilot-readiness-only',
    rootDirectory: root,
    verdict,
    ready: failed.length === 0,
    checks,
    failedChecks: failed.map((check) => ({ id: check.id, label: check.label, detail: check.detail })),
  }
}

export function serializeFamilyPilotReadiness(report) {
  return `${JSON.stringify(report, null, 2)}\n`
}

export function formatFamilyPilotReadiness(report) {
  const lines = [
    'Family pilot readiness (local supervised Grade 5 Math pilot)',
    'Scope: LOCAL ONLY — no hosted network calls made.',
    `Verdict: ${report.verdict}`,
    '',
    'Checks:',
  ]
  for (const check of report.checks) {
    lines.push(`- [${check.pass ? 'PASS' : 'FAIL'}] ${check.label}: ${check.detail}`)
  }
  if (report.failedChecks.length > 0) {
    lines.push('', 'Failed checks:')
    for (const check of report.failedChecks) {
      lines.push(`- ${check.id}: ${check.detail}`)
    }
  }
  return `${lines.join('\n')}\n`
}

function argumentValue(args, flag) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const args = process.argv.slice(2)
  const format = argumentValue(args, '--format') ?? 'operator'
  if (!['json', 'operator'].includes(format)) {
    throw new Error('Usage: readiness.mjs [--format json|operator] [--root path]')
  }
  const rootArgument = argumentValue(args, '--root')
  const rootDirectory = rootArgument
    ? (isAbsolute(rootArgument) ? rootArgument : resolve(process.cwd(), rootArgument))
    : fileURLToPath(new URL('../../', import.meta.url))
  const report = evaluateFamilyPilotReadiness({ rootDirectory })
  process.stdout.write(format === 'json'
    ? serializeFamilyPilotReadiness(report)
    : formatFamilyPilotReadiness(report))
  if (!report.ready) process.exitCode = 2
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'family_pilot_readiness_failed'}\n`)
    process.exitCode = 1
  })
}

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  classifyExecution,
  DEFAULT_CHECKS,
  FAIL,
  PASS,
  runPilotAcceptance,
  WAITING_ON_INTEGRATION,
} from './pilot-acceptance.mjs'

const fixturesRoot = fileURLToPath(new URL('./fixtures/pilot-acceptance', import.meta.url))

function fixtureCommand(scriptName) {
  return (root, resolvedPath) => ({
    command: process.execPath,
    args: [join(fixturesRoot, scriptName), resolvedPath],
  })
}

/** A minimal two-check config: a marker file stands in for "the piece exists". */
function syntheticChecks({ firstScript, secondScript, secondPresent = true } = {}) {
  return [
    {
      id: 'first',
      label: 'First fixture check',
      discoveryPaths: ['first.marker'],
      buildCommand: fixtureCommand(firstScript),
    },
    {
      id: 'second',
      label: 'Second fixture check',
      discoveryPaths: [secondPresent ? 'second.marker' : 'second.marker.not-present'],
      buildCommand: fixtureCommand(secondScript ?? 'passing-check.mjs'),
    },
  ]
}

const tempDirectories: string[] = []

async function makeRoot(markers: string[]) {
  const dir = await mkdtemp(join(tmpdir(), 'pilot-acceptance-'))
  tempDirectories.push(dir)
  for (const marker of markers) {
    await writeFile(join(dir, marker), 'present\n', 'utf8')
  }
  return dir
}

afterEach(async () => {
  while (tempDirectories.length > 0) {
    const dir = tempDirectories.pop()
    if (dir) await rm(dir, { recursive: true, force: true })
  }
})

describe('classifyExecution', () => {
  it('passes when JSON output reports ready:true and exit code 0', () => {
    const outcome = classifyExecution({ exitCode: 0, stdout: '{"ready":true,"detail":"ok"}' })
    expect(outcome.status).toBe(PASS)
  })

  it('fails when JSON output reports ready:false', () => {
    const outcome = classifyExecution({ exitCode: 1, stdout: '{"ready":false,"detail":"bad"}' })
    expect(outcome.status).toBe(FAIL)
  })

  it('treats a configured waiting exit code as WAITING_ON_INTEGRATION regardless of output', () => {
    const outcome = classifyExecution({ exitCode: 2, stdout: 'anything', waitingExitCodes: [2] })
    expect(outcome.status).toBe(WAITING_ON_INTEGRATION)
  })

  it('treats a recognized waiting status string as WAITING_ON_INTEGRATION', () => {
    const outcome = classifyExecution({
      exitCode: 2,
      stdout: '{"status":"PILOT_STATIC_UNIT_DESIGNATION_REQUIRED"}',
    })
    expect(outcome.status).toBe(WAITING_ON_INTEGRATION)
  })

  it('fails closed on unparseable output and flags it as malformed', () => {
    const outcome = classifyExecution({ exitCode: 0, stdout: 'not json {{{' })
    expect(outcome.status).toBe(FAIL)
    expect(outcome.malformed).toBe(true)
  })

  it('falls back to exit code when there is no output at all', () => {
    expect(classifyExecution({ exitCode: 0, stdout: '' }).status).toBe(PASS)
    expect(classifyExecution({ exitCode: 1, stdout: '' }).status).toBe(FAIL)
  })
})

describe('runPilotAcceptance', () => {
  it('reports PASS when every check is present and passes', async () => {
    const root = await makeRoot(['first.marker', 'second.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({ firstScript: 'passing-check.mjs', secondScript: 'passing-check.mjs' }),
    })
    expect(report.overall).toBe(PASS)
    expect(report.checks.every((check) => check.status === PASS)).toBe(true)
    expect(report.summary).toEqual({ total: 2, pass: 2, fail: 0, waiting: 0 })
  })

  it('reports FAIL overall when one present check fails, even if another passes', async () => {
    const root = await makeRoot(['first.marker', 'second.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({ firstScript: 'failing-check.mjs', secondScript: 'passing-check.mjs' }),
    })
    expect(report.overall).toBe(FAIL)
    const first = report.checks.find((check) => check.id === 'first')
    expect(first?.status).toBe(FAIL)
    const second = report.checks.find((check) => check.id === 'second')
    expect(second?.status).toBe(PASS)
  })

  it('reports WAITING_ON_INTEGRATION for a check whose sibling file has not landed', async () => {
    const root = await makeRoot(['first.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({
        firstScript: 'passing-check.mjs',
        secondPresent: false,
      }),
    })
    expect(report.overall).toBe(WAITING_ON_INTEGRATION)
    const second = report.checks.find((check) => check.id === 'second')
    expect(second?.status).toBe(WAITING_ON_INTEGRATION)
    expect(second?.resolvedPath).toBeNull()
  })

  it('does not hardcode failure just because a sibling branch has not merged', async () => {
    // No markers at all: every check is "missing", not "failing".
    const root = await makeRoot([])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({ firstScript: 'passing-check.mjs', secondPresent: false }),
    })
    expect(report.overall).toBe(WAITING_ON_INTEGRATION)
    expect(report.checks.every((check) => check.status === WAITING_ON_INTEGRATION)).toBe(true)
  })

  it('treats malformed check output as a definite FAIL rather than crashing the run', async () => {
    const root = await makeRoot(['first.marker', 'second.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({ firstScript: 'malformed-check.mjs', secondScript: 'passing-check.mjs' }),
    })
    expect(report.overall).toBe(FAIL)
    const first = report.checks.find((check) => check.id === 'first')
    expect(first?.status).toBe(FAIL)
  })

  it('lets a present check report its own WAITING_ON_INTEGRATION via exit code and status', async () => {
    const root = await makeRoot(['first.marker', 'second.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({
        firstScript: 'waiting-designation-check.mjs',
        secondScript: 'passing-check.mjs',
      }),
    })
    expect(report.overall).toBe(WAITING_ON_INTEGRATION)
    const first = report.checks.find((check) => check.id === 'first')
    expect(first?.status).toBe(WAITING_ON_INTEGRATION)
  })

  it('FAIL outranks WAITING_ON_INTEGRATION in the overall verdict', async () => {
    const root = await makeRoot(['first.marker'])
    const report = runPilotAcceptance({
      rootDirectory: root,
      checks: syntheticChecks({ firstScript: 'failing-check.mjs', secondPresent: false }),
    })
    expect(report.overall).toBe(FAIL)
  })
})

describe('DEFAULT_CHECKS', () => {
  const expectedIds = [
    'family-pilot-readiness',
    'grade5-math-unit-validation',
    'persistence-smoke',
    'parent-smoke',
    'browser-smoke',
    'windows-launcher-check',
  ]

  it('covers exactly the six pieces the pilot acceptance goal names', () => {
    expect(DEFAULT_CHECKS.map((check) => check.id)).toEqual(expectedIds)
  })

  it('every check declares at least one discovery path and a command builder', () => {
    for (const check of DEFAULT_CHECKS) {
      expect(check.discoveryPaths.length).toBeGreaterThan(0)
      expect(typeof check.buildCommand).toBe('function')
    }
  })

  it('reports WAITING_ON_INTEGRATION for every default check against a bare repo checkout', async () => {
    // Simulates this exact isolated build: no sibling family-pilot branches
    // are merged in, so nothing should be discovered — and nothing should
    // be reported as broken because of that.
    const root = await makeRoot([])
    const report = runPilotAcceptance({ rootDirectory: root })
    expect(report.overall).toBe(WAITING_ON_INTEGRATION)
    expect(report.checks.every((check) => check.status === WAITING_ON_INTEGRATION)).toBe(true)
  })

  it('requests structured JSON output from the Windows launcher check', () => {
    const windowsCheck = DEFAULT_CHECKS.find((check) => check.id === 'windows-launcher-check')
    const { args } = windowsCheck.buildCommand('C:\\some\\root', 'C:\\some\\root\\scripts\\family-pilot\\start-windows.ps1')
    expect(args).toEqual(expect.arrayContaining(['-Format', 'json']))
  })
})

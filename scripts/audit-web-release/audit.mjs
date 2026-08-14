#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  RULES,
  configuredNetlifyFunctionsPath,
  defaultCommandRunner,
  inspectFamilyPilotDefaultOff,
  inspectNetlifyFunctionSurface,
  runRequiredCommand,
  scanBrowserOutput,
  summarizeFindings,
} from './lib.mjs'

const root = process.cwd()
const findings = []
const commands = []
const configText = readFileSync(resolve(root, 'netlify.toml'), 'utf8')

const build = runRequiredCommand('npm run build', defaultCommandRunner, {
  cwd: root,
  env: {
    VITE_FAMILY_PILOT_ENABLED: 'true',
    VITE_USE_PROXY: 'true',
  },
})
commands.push(build)
if (!build.passed) {
  findings.push({
    rule: RULES.build,
    file: 'package.json',
    line: null,
    detail: 'The deploy-equivalent enabled production build failed.',
    evidence: build.command,
  })
}

let browser = { filesScanned: 0, findings: [] }
if (build.passed) {
  browser = scanBrowserOutput(resolve(root, 'dist'))
  findings.push(...browser.findings)
}

const configuredFunctionsPath = configuredNetlifyFunctionsPath(configText)
const functions = inspectNetlifyFunctionSurface(resolve(root, configuredFunctionsPath))
findings.push(...functions.findings)

const defaultOff = inspectFamilyPilotDefaultOff(
  configText,
  readFileSync(resolve(root, 'src/study/familyPilotFlag.ts'), 'utf8'),
)
findings.push(...defaultOff.findings)

const quality = runRequiredCommand('npm run audit:family-pilot-launch', defaultCommandRunner, { cwd: root })
commands.push(quality)
if (!quality.passed) {
  findings.push({
    rule: RULES.quality,
    file: 'package.json',
    line: null,
    detail: 'The existing full learner/Family Pilot quality gate failed.',
    evidence: quality.command,
  })
}

const defaultOffRuntime = runRequiredCommand(
  'npx vitest run --project root-app src/App.familyPilotRouteLifecycle.test.tsx',
  defaultCommandRunner,
  { cwd: root },
)
commands.push(defaultOffRuntime)
if (!defaultOffRuntime.passed) {
  findings.push({
    rule: RULES.defaultOff,
    file: 'src/App.familyPilotRouteLifecycle.test.tsx',
    line: null,
    detail: 'The Family Pilot route/default-off lifecycle proof failed.',
    evidence: defaultOffRuntime.command,
  })
}

const report = {
  status: findings.length === 0 ? 'PASS' : 'FAIL',
  browserFilesScanned: browser.filesScanned,
  configuredNetlifyFunctionsPath,
  callableNetlifyFunctions: functions.callable,
  allowlistedNetlifyFunctions: functions.allowlisted,
  commands,
  countsByRule: summarizeFindings(findings),
  findings,
}

console.log(JSON.stringify(report, null, 2))
console.log(`WEB_RELEASE_SECURITY_GATE ${report.status}`)
if (findings.length) process.exitCode = 1

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  RULES,
  inspectFamilyPilotDefaultOff,
  inspectNetlifyFunctionSurface,
  runRequiredCommand,
  scanBrowserOutput,
} from './lib.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'web-release-audit-'))
  return {
    root,
    write(relative, contents) {
      const file = join(root, relative)
      mkdirSync(join(file, '..'), { recursive: true })
      writeFileSync(file, contents)
      return file
    },
    close() { rmSync(root, { recursive: true, force: true }) },
  }
}

function rules(result) {
  return new Set(result.findings.map((finding) => finding.rule))
}

test('positive control: generic security identifiers and explicit false claims are not authority', () => {
  const fx = fixture()
  try {
    fx.write('assets/safe.js', String.raw`
      const denied = new Set(['correctAnswer', 'answerAuthorityRef', 'restricted:adult', 'serviceRoleKey'])
      const deniedPattern = /rawAnswer|tutorTranscript|serviceRoleKey|PIN/i
      const backup = { tutorTranscriptIncluded: false, rawAnswerIncluded: false }
      console.info('PIN required; answer authority never enters the browser')
    `)
    const result = scanBrowserOutput(fx.root)
    assert.deepEqual(result.findings, [])
  } finally { fx.close() }
})

test('negative control: executable production correctness authority fails', () => {
  const fx = fixture()
  try {
    fx.write('assets/app.js', `const item={correctAnswer:'42'}; export const grade=x=>x===item.correctAnswer`)
    assert.ok(rules(scanBrowserOutput(fx.root)).has(RULES.answerAuthority))
  } finally { fx.close() }
})

test('negative control: adult answer/scoring locators in browser JSON fail', () => {
  const fx = fixture()
  try {
    fx.write('course.json', JSON.stringify({ package: { scoringAuthorityRef: 'restricted:adult/grade-5/item-1' } }))
    assert.ok(rules(scanBrowserOutput(fx.root)).has(RULES.answerAuthority))
  } finally { fx.close() }
})

test('negative control: learner PIN material fails while PIN display copy does not', () => {
  const fx = fixture()
  try {
    fx.write('assets/app.js', `console.info('Enter your PIN'); const profile={pin:'4821'}; authenticate(profile.pin)`)
    const result = scanBrowserOutput(fx.root)
    assert.ok(rules(result).has(RULES.learnerPin))
  } finally { fx.close() }
})

test('negative control: raw Tutor transcript material fails while false inclusion metadata does not', () => {
  const fx = fixture()
  try {
    fx.write('assets/tutor.js', `const api='/api/anthropic'; const session={transcript:[{role:'user',content:'private'}]}; send(session.transcript)`)
    const result = scanBrowserOutput(fx.root)
    assert.ok(rules(result).has(RULES.tutorTranscript))
  } finally { fx.close() }
})

test('negative control: service-role credential access and values fail, deny lists do not', () => {
  const fx = fixture()
  try {
    const jwt = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'),
      'signature',
    ].join('.')
    fx.write('assets/client.js', `const config={serviceRoleKey:${JSON.stringify(jwt)}}; createClient(config.serviceRoleKey)`)
    assert.ok(rules(scanBrowserOutput(fx.root)).has(RULES.serviceRole))
  } finally { fx.close() }
})

test('negative control: a required localhost runtime endpoint fails, incidental prose does not', () => {
  const fx = fixture()
  try {
    fx.write('assets/client.js', `const endpoint='http://localhost:9999/grade'; fetch(endpoint)`)
    fx.write('assets/copy.js', `console.info('Developers can preview at http://localhost:4173')`)
    const result = scanBrowserOutput(fx.root)
    assert.ok(rules(result).has(RULES.localhost))
    assert.equal(result.findings.filter((finding) => finding.rule === RULES.localhost).length, 1)
  } finally { fx.close() }
})

test('negative control: callable Netlify tests, helpers, and unknown handlers fail allowlisting', () => {
  const fx = fixture()
  try {
    fx.write('good.js', 'export const handler=()=>({statusCode:200})')
    fx.write('good.test.js', 'export const handler=()=>({statusCode:200})')
    fx.write('production-item-resolver.js', 'export function resolve(){}')
    fx.write('surprise.js', 'export const handler=()=>({statusCode:200})')
    fx.write('_shared/helper.js', 'export function helper(){}')
    const result = inspectNetlifyFunctionSurface(fx.root, ['good'])
    assert.equal(result.findings.length, 3)
    assert.deepEqual(result.callable, ['good', 'good.test', 'production-item-resolver', 'surprise'])
  } finally { fx.close() }
})

test('negative control: a failed integrated quality command remains release-blocking', () => {
  const result = runRequiredCommand('quality-gate', () => 7, { cwd: '/unused' })
  assert.deepEqual(result, { command: 'quality-gate', status: 7, passed: false })
})

test('negative controls: global flag enablement and truthy source semantics fail default-off', () => {
  const config = `[build.environment]\n  VITE_FAMILY_PILOT_ENABLED = "true"\n`
  const source = `export function isFamilyPilotEnabled(value){ return Boolean(value) }`
  const result = inspectFamilyPilotDefaultOff(config, source)
  assert.ok(rules(result).has(RULES.defaultOff))
})

test('positive control: one named branch and exact literal true preserve default-off', () => {
  const config = `[build.environment]\n  NODE_VERSION = "22"\n[context."mac/example-family-pilot".environment]\n  VITE_FAMILY_PILOT_ENABLED = "true"\n`
  const source = `export function isFamilyPilotEnabled(value){ return value === 'true' }`
  assert.deepEqual(inspectFamilyPilotDefaultOff(config, source).findings, [])
})

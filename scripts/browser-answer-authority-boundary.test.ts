import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { build, type Plugin } from 'vite'
import { browserAnswerAuthorityBoundary } from './browser-answer-authority-boundary'

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function virtualModule(specifier: string, resolvedId: string, source: string): Plugin {
  return {
    name: `mutant-${specifier}`,
    enforce: 'pre',
    resolveId(id) { return id === specifier ? `\0${resolvedId}` : null },
    load(id) { return id === `\0${resolvedId}` ? source : null },
  }
}

async function bundleMutant(source: string, plugins: Plugin[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'answer-authority-mutant-'))
  temporaryRoots.push(root)
  const entry = join(root, 'entry.js')
  writeFileSync(entry, source)
  return build({
    configFile: false,
    logLevel: 'silent',
    plugins: [...plugins, browserAnswerAuthorityBoundary()],
    build: { write: false, minify: true, rollupOptions: { input: entry } },
  })
}

describe('production browser answer-authority dependency boundary mutants', () => {
  it('allows non-executable privacy denylist strings', async () => {
    await expect(bundleMutant(`
      const privacyDenylist = ['answerIndex', 'correctAnswer', 'expectedAnswer']
      document.title = String(privacyDenylist.length)
    `)).resolves.toBeDefined()
  })

  it('rejects a browser import of the trusted server resolver', async () => {
    const resolver = virtualModule(
      'mutant:server-resolver',
      '/repo/netlify/functions/production-item-resolver.js',
      'export const resolveTrustedItem = () => "trusted"',
    )
    await expect(bundleMutant(
      'import { resolveTrustedItem } from "mutant:server-resolver"; document.title = resolveTrustedItem()',
      [resolver],
    )).rejects.toThrow(/forbidden answer-authority module.*production-item-resolver/)
  })

  it('rejects a browser import of the legacy answer-key evaluator', async () => {
    const evaluator = virtualModule(
      'mutant:legacy-evaluator',
      '/repo/src/study/family-pilot/practice/practice.ts',
      'export const evaluateLegacy = () => true',
    )
    await expect(bundleMutant(
      'import { evaluateLegacy } from "mutant:legacy-evaluator"; document.title = String(evaluateLegacy())',
      [evaluator],
    )).rejects.toThrow(/forbidden answer-authority module.*practice\/practice/)
  })

  it('rejects a bundled answer-index fixture', async () => {
    await expect(bundleMutant(`
      const admittedItem = { choices: ['choice:a', 'choice:b'], answerIndex: 1 }
      document.title = String(admittedItem.answerIndex)
    `)).rejects.toThrow(/contains executable answer authority/)
  })

  it('rejects a bundled correct-answer lookup', async () => {
    await expect(bundleMutant(`
      const admittedOracle = { correctAnswerLookup: { 'item:1': 'choice:b' } }
      document.title = admittedOracle.correctAnswerLookup['item:1']
    `)).rejects.toThrow(/contains executable answer authority/)
  })
})

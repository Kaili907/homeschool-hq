/**
 * Structural proof that Tutor stays dark: no file Netlify deploys as a
 * callable function imports the Server Tutor content-binding/custody
 * modules, directly or transitively. Netlify's `functions` directory
 * (netlify.toml) publishes only the top-level files in netlify/functions/ —
 * not netlify/functions/_shared/ — so that top-level set is the exact
 * "deployed production handler" surface this test walks from.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const functionsRoot = fileURLToPath(new URL('.', import.meta.url))

const TUTOR_MODULES = Object.freeze([
  resolve(functionsRoot, '_shared/study-tutor/content-binding.js'),
  resolve(functionsRoot, '_shared/study-tutor/artifact-custody.js'),
])

const IMPORT_SPECIFIER = /(?:\bimport\b|\bexport\b)(?:[^'"]*?\bfrom\b\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g

function deployedHandlerEntryPoints() {
  return readdirSync(functionsRoot)
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .map((name) => resolve(functionsRoot, name))
}

function relativeImportSpecifiers(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const specifiers = []
  IMPORT_SPECIFIER.lastIndex = 0
  let match
  while ((match = IMPORT_SPECIFIER.exec(text)) !== null) {
    const specifier = match[1] ?? match[2]
    if (specifier?.startsWith('.')) specifiers.push(specifier)
  }
  return specifiers
}

/** BFS over the static relative-import graph reachable from one entry file. */
function importClosure(entryFile) {
  const visited = new Set()
  const queue = [entryFile]
  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)
    for (const specifier of relativeImportSpecifiers(current)) {
      const resolved = resolve(dirname(current), specifier)
      if (!visited.has(resolved)) queue.push(resolved)
    }
  }
  return visited
}

describe('Server Tutor content binding stays outside every deployed handler', () => {
  it('has both Tutor modules present on disk (a moved/renamed module must not make this test vacuous)', () => {
    for (const modulePath of TUTOR_MODULES) {
      expect(() => readFileSync(modulePath, 'utf8')).not.toThrow()
    }
  })

  it('walks a nonempty set of deployed handler entry points', () => {
    expect(deployedHandlerEntryPoints().length).toBeGreaterThan(0)
  })

  it.each(deployedHandlerEntryPoints())(
    'the import closure of %s never reaches a Tutor content-binding/custody module',
    (entryFile) => {
      const closure = importClosure(entryFile)
      for (const tutorModule of TUTOR_MODULES) {
        expect(closure.has(tutorModule)).toBe(false)
      }
    },
  )

  it('the aggregate closure across every deployed handler excludes both Tutor modules', () => {
    const aggregate = new Set()
    for (const entryFile of deployedHandlerEntryPoints()) {
      for (const module of importClosure(entryFile)) aggregate.add(module)
    }
    for (const tutorModule of TUTOR_MODULES) {
      expect(aggregate.has(tutorModule)).toBe(false)
    }
  })
})

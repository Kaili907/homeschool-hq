import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGeneratedFiles } from './generate.node'

/**
 * FF-M11 — the browser rules, enforced rather than asserted in prose.
 *
 * The whole point of this module is that a deployed browser can read the
 * catalog. That fails the moment anything reachable from ./index pulls in
 * node:fs, so the import graph is walked here and checked.
 */

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = resolve(HERE, '../../../..')
const ENTRY = join(HERE, 'index.ts')

/** A module's source with comments removed. These checks are about what the
 * code does, not about what its own documentation says it avoids. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

/** Every specifier in a module: static imports, re-exports, and dynamic import(). */
function specifiersOf(withoutComments: string): string[] {
  const found: string[] = []
  // A computed or template-literal specifier would be neither followed nor
  // reported, so it is surfaced as an offender rather than skipped silently.
  if (/\bimport\s*\(\s*[^'")\s]/.test(withoutComments)) found.push('<computed import()>')
  const patterns = [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const pattern of patterns) {
    for (const match of withoutComments.matchAll(pattern)) found.push(match[1])
  }
  return found
}

function resolveRelative(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]
  return candidates.find((path) => existsSync(path) && statSync(path).isFile())
}

interface BareImport {
  readonly specifier: string
  readonly importer: string
}

/** Walks the browser-reachable graph from `entry`, following relative imports. */
function walkGraph(entry: string): { files: string[]; bare: BareImport[] } {
  const files = new Set<string>()
  const bare: BareImport[] = []
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (files.has(file)) continue
    files.add(file)
    for (const specifier of specifiersOf(codeOf(file))) {
      if (specifier.startsWith('.')) {
        const target = resolveRelative(file, specifier)
        if (!target) throw new Error(`unresolvable specifier ${specifier} in ${relative(REPO_ROOT, file)}`)
        queue.push(target)
      } else {
        bare.push({ specifier, importer: relative(REPO_ROOT, file) })
      }
    }
  }
  return { files: [...files], bare }
}

describe('browser dependency graph', () => {
  const graph = walkGraph(ENTRY)

  it('reaches more than just the entry module', () => {
    expect(graph.files.length).toBeGreaterThan(30)
  })

  it('imports no node builtin anywhere in the graph', () => {
    const builtins = graph.bare.filter(
      (node) =>
        node.specifier.startsWith('node:') ||
        ['fs', 'path', 'url', 'os', 'crypto', 'child_process', 'module'].includes(node.specifier),
    )
    expect(builtins).toEqual([])
  })

  it('reaches no *.node.ts module', () => {
    const nodeOnly = graph.files
      .filter((file) => file.endsWith('.node.ts'))
      .map((file) => relative(REPO_ROOT, file))
    expect(nodeOnly).toEqual([])
  })

  it('reaches no test module', () => {
    const tests = graph.files
      .filter((file) => /\.test\.tsx?$/.test(file))
      .map((file) => relative(REPO_ROOT, file))
    expect(tests).toEqual([])
  })

  it('names no filesystem path or localhost origin', () => {
    const offenders: string[] = []
    for (const file of graph.files) {
      const source = codeOf(file)
      if (/localhost|127\.0\.0\.1/.test(source)) offenders.push(`${relative(REPO_ROOT, file)}: localhost`)
      if (/curriculum-content\//.test(source)) {
        offenders.push(`${relative(REPO_ROOT, file)}: frozen source path`)
      }
      if (/\bprocess\.cwd\b|\b__dirname\b|\bfileURLToPath\b/.test(source)) {
        offenders.push(`${relative(REPO_ROOT, file)}: filesystem path resolution`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('requires no fetch, XMLHttpRequest or WebSocket to read the catalog', () => {
    const offenders = graph.files
      .filter((file) => /\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(codeOf(file)))
      .map((file) => relative(REPO_ROOT, file))
    expect(offenders).toEqual([])
  })

  it('adds no package dependency of its own', () => {
    // Scoped to this module: the walk also reaches shared app types, and a
    // future type-only package import over there is not this module's concern.
    const own = graph.bare.filter((node) =>
      node.importer.startsWith('src/study/family-pilot/catalog-runtime/'),
    )
    expect(own).toEqual([])
  })

  it('never resolves a specifier it could not follow', () => {
    expect(graph.bare.filter((node) => node.specifier === '<computed import()>')).toEqual([])
  })
})

describe('generated modules', () => {
  it('leave no module behind that the generator no longer emits', () => {
    const emitted = buildGeneratedFiles()
      .filter((file) => file.relativePath.startsWith('courses/'))
      .map((file) => file.relativePath.slice('courses/'.length))
      .sort()
    expect(readdirSync(join(HERE, 'generated/courses')).sort()).toEqual(emitted)
  })

  it('are in sync with the frozen source', () => {
    for (const file of buildGeneratedFiles()) {
      const path = resolve(HERE, 'generated', file.relativePath)
      expect(existsSync(path), `${file.relativePath} is missing — run generate.node.ts`).toBe(true)
      expect(
        readFileSync(path, 'utf8'),
        `${file.relativePath} has drifted from the frozen source — run generate.node.ts`,
      ).toBe(file.contents)
    }
  })

  it('keep lesson payloads out of the eager index', () => {
    const index = readFileSync(join(HERE, 'generated/index.ts'), 'utf8')
    expect(index).not.toMatch(/courseDay/)
    expect(index).not.toMatch(/estimatedMinutes/)
    // The eager index carries structure for the whole release; a lesson-body
    // sized index would mean the split silently stopped working.
    expect(Buffer.byteLength(index, 'utf8')).toBeLessThan(220_000)
  })

  it('split lesson payloads into one module per course, none of them huge', () => {
    const loaders = readFileSync(join(HERE, 'loaders.ts'), 'utf8')
    const specifiers = [...loaders.matchAll(/import\('([^']+)'\)/g)].map((m) => m[1])
    expect(specifiers).toHaveLength(30)
    expect(new Set(specifiers).size).toBe(30)
    for (const specifier of specifiers) {
      const path = resolveRelative(join(HERE, 'loaders.ts'), specifier)
      expect(path, `${specifier} does not resolve`).toBeDefined()
      expect(statSync(path!).size).toBeLessThan(40_000)
    }
  })
})

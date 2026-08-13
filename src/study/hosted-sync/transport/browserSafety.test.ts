import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

const FORBIDDEN_IMPORTS = [
  'node:',
  '@supabase/',
  'supabaseShared',
  'service-role',
  'serviceRole',
  'netlify',
  'localDevelopmentPorts',
  'mountedPorts',
  '/testing/',
] as const

const FORBIDDEN_BUNDLE_MARKERS = [
  '@supabase/supabase-js',
  'service_role',
  'require("node:',
  "require('node:",
  'from"node:',
  "from'node:",
  'node:fs',
  'node:path',
  'localStorage',
  'sessionStorage',
  'indexedDB.open',
] as const

function productionFiles(): readonly string[] {
  return readdirSync(here)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => join(here, name))
}

function importSpecifiers(source: string): readonly string[] {
  return [...source.matchAll(/(?:^|[\s;])(?:import|export)[\s\S]*?from\s+['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .concat([...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]))
}

function resolveRelative(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function importClosure(): readonly string[] {
  const seen = new Set<string>()
  const queue = [join(here, 'index.ts')]
  while (queue.length > 0) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      const target = resolveRelative(file, specifier)
      if (target) queue.push(target)
    }
  }
  return [...seen]
}

function outputText(result: Rollup.RollupOutput | readonly Rollup.RollupOutput[]): string {
  return (Array.isArray(result) ? result : [result])
    .flatMap((output) => output.output)
    .map((entry) => entry.type === 'chunk'
      ? entry.code
      : typeof entry.source === 'string'
        ? entry.source
        : new TextDecoder().decode(entry.source))
    .join('\n')
}

describe('hosted Study sync transport — browser boundary', () => {
  it('keeps production sources and their reachable graph free of privileged or Node imports', () => {
    expect(productionFiles().map((file) => relative(here, file)).sort()).toEqual([
      'contracts.ts', 'index.ts', 'privacy.ts', 'queue.ts', 'transport.ts', 'types.ts',
    ])
    const closure = importClosure()
    expect(closure.some((file) => file.endsWith(join('durable-ports', 'schema.ts')))).toBe(true)
    for (const file of closure) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of FORBIDDEN_IMPORTS) {
          expect(specifier, `${relative(repoRoot, file)} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('bundles as production ES2022 without Node, Supabase, storage, or service credentials', async () => {
    const result = await build({
      configFile: false,
      root: repoRoot,
      mode: 'production',
      logLevel: 'silent',
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        lib: { entry: join(here, 'index.ts'), formats: ['es'], fileName: 'study-sync-transport' },
      },
    })
    if ('on' in result) throw new Error('Study sync transport bundle unexpectedly started watch mode.')
    const bundle = outputText(result)
    expect(bundle).toContain('createStudySyncTransport')
    expect(bundle).toContain('REPLACE_MINIMIZED_STUDY_DOCUMENT')
    for (const marker of FORBIDDEN_BUNDLE_MARKERS) {
      expect(bundle, `production bundle contains ${marker}`).not.toContain(marker)
    }
  }, 120_000)
})

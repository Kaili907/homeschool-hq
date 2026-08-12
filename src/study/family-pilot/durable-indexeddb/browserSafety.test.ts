import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import { openFamilyPilotIndexedDbStudyStorage } from './storage'

// Changing where a household's Study work is stored is only an improvement if
// the new module is at least as deployable as the one it backs. These are the
// accepted module's own boundary rules, applied to this one: nothing
// server-only, nothing Node-only, no development provider, no credential, and
// no test-only code reachable from the production entry point.

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

const FORBIDDEN_IMPORT_SPECIFIERS = [
  'localDevelopmentPorts',
  'mountedPorts',
  '@supabase/',
  'supabaseShared',
  'service-role',
  'serviceRole',
  'netlify',
  'node:',
  'node_modules',
  'demonstrations',
  'syntheticStudyFixtures',
  // The test-only IndexedDB and the test-only device harness.
  './testing/',
  '/testing/',
] as const

const FORBIDDEN_SOURCE_MARKERS = [
  'LOCAL DEVELOPMENT ONLY',
  'session12-local-forced-outcome-v1',
  'forcedSafetyOutcome',
  'learner:local-release-candidate',
  'learner:synthetic-grade5-',
  'x-api-key',
  'api.anthropic.com',
] as const

/** The module's own production files: top level only, never the test kit. */
function moduleFiles(): readonly string[] {
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
  return candidates.find(
    (candidate) => (candidate.endsWith('.ts') || candidate.endsWith('.tsx')) && existsSync(candidate),
  ) ?? null
}

/** Every first-party file reachable from the public entry point. */
function importClosure(): readonly string[] {
  const seen = new Set<string>()
  const queue = [join(here, 'index.ts')]
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (seen.has(file)) continue
    seen.add(file)
    for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
      const resolved = resolveRelative(file, specifier)
      if (resolved) queue.push(resolved)
    }
  }
  return [...seen]
}

describe('Family Pilot IndexedDB Study ports — module boundary', () => {
  it('has a public entry point and no test-only source beside it', () => {
    const files = moduleFiles().map((file) => relative(here, file)).sort()
    expect(files).toEqual(['index.ts', 'indexedDbRecords.ts', 'ports.ts', 'storage.ts'])
  })

  it('imports nothing local-development, server-only, Node-only, or test-only', () => {
    for (const file of moduleFiles()) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(specifier, `${relative(repoRoot, file)} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('keeps the whole reachable import closure free of the same imports', () => {
    const closure = importClosure()
    // The closure is real: it reaches the accepted durable ports it composes,
    // and through them the shared Study contracts and the calendar runtime.
    expect(closure.length).toBeGreaterThan(moduleFiles().length)
    expect(closure.some((file) => file.endsWith(join('durable-ports', 'durableStudyPorts.ts')))).toBe(true)
    expect(closure.some((file) => file.includes('adaptive-tutor'))).toBe(true)
    expect(closure.some((file) => file.includes(join('durable-indexeddb', 'testing')))).toBe(false)
    for (const file of closure) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(specifier, `${relative(repoRoot, file)} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('carries no local-development or provider-credential marker in its own source', () => {
    const source = moduleFiles().map((file) => readFileSync(file, 'utf8')).join('\n')
    for (const marker of FORBIDDEN_SOURCE_MARKERS) {
      expect(source).not.toContain(marker)
    }
  })

  it('refuses, rather than crashes, where there is no window and no IndexedDB', async () => {
    expect(typeof window).toBe('undefined')
    expect(typeof indexedDB).toBe('undefined')
    await expect(openFamilyPilotIndexedDbStudyStorage({
      scope: { householdRef: 'household:manuel', learnerRef: 'learner:ada' },
    })).rejects.toMatchObject({ name: 'FamilyPilotDurableStorageError', kind: 'storage-unavailable' })
  })
})

function outputText(result: Rollup.RollupOutput | readonly Rollup.RollupOutput[]): string {
  const outputs = Array.isArray(result) ? result : [result]
  return outputs
    .flatMap((output) => output.output)
    .map((entry) => {
      if (entry.type === 'chunk') return entry.code
      return typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source)
    })
    .join('\n')
}

describe('Family Pilot IndexedDB Study ports — production browser bundle', () => {
  it('bundles for a production browser with no Node built-in and no preview marker', async () => {
    const result = await build({
      configFile: false,
      root: repoRoot,
      mode: 'production',
      logLevel: 'silent',
      build: {
        write: false,
        minify: true,
        target: 'es2022',
        lib: {
          entry: join(here, 'index.ts'),
          formats: ['es'],
          fileName: 'family-pilot-durable-indexeddb',
        },
      },
    })
    if ('on' in result) throw new Error('Durable IndexedDB bundle scan unexpectedly started watch mode.')
    const bundle = outputText(result)

    // It really did compile, and it really is the IndexedDB store.
    expect(bundle).toContain('createFamilyPilotIndexedDbStudyPorts')
    expect(bundle).toContain('manuel-academy.study.family-pilot-durable')
    expect(bundle).toContain('indexedDB')
    // And nothing from the test kit came with it.
    expect(bundle).not.toContain('createFakeIndexedDb')
    expect(bundle).not.toContain('family-pilot-indexeddb-test-safety-v1')

    for (const marker of [
      ...FORBIDDEN_SOURCE_MARKERS,
      'require("node:',
      "require('node:",
      'from"node:',
      "from'node:",
      'node:fs',
      'node:path',
      'node:crypto',
      '@supabase/supabase-js',
    ]) {
      expect(bundle, `production bundle contains ${marker}`).not.toContain(marker)
    }
  }, 120_000)
})

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'
import { createFamilyPilotDurableStudyPorts } from './durableStudyPorts'
import type { StudySafetyPort } from '../../ports'

// The blocker this module exists to remove is that the accepted Family Pilot
// Study surface can only be composed from a local-development provider, and so
// has to be DEV-gated. That is only actually removed if this module is provably
// clean: nothing server-only, nothing Node-only, and no development-provider
// marker anywhere in its own import closure or in its production output.

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..', '..')

const FORBIDDEN_IMPORT_SPECIFIERS = [
  // The local-development provider and its mounted composition.
  'localDevelopmentPorts',
  'mountedPorts',
  // Server-only and privileged data planes.
  '@supabase/',
  'supabaseShared',
  'service-role',
  'serviceRole',
  'netlify',
  // Node-only APIs of any kind.
  'node:',
  'node_modules',
  // Preview and synthetic fixtures, which carry frozen release-candidate identities.
  'demonstrations',
  'syntheticStudyFixtures',
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

describe('Family Pilot durable Study ports — module boundary', () => {
  it('has a public entry point and no test-only source in it', () => {
    const files = moduleFiles().map((file) => relative(here, file)).sort()
    expect(files).toContain('index.ts')
    expect(files).toContain('durableStudyPorts.ts')
    expect(files).toContain('schema.ts')
    expect(files).toContain('store.ts')
    expect(files).toContain('minimization.ts')
  })

  it('imports nothing local-development, server-only, or Node-only', () => {
    for (const file of moduleFiles()) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf8'))
      for (const specifier of specifiers) {
        for (const forbidden of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(specifier, `${relative(repoRoot, file)} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('keeps the whole reachable import closure free of the same imports', () => {
    const closure = importClosure()
    // The closure is real: it reaches the shared Study contracts and the
    // accepted calendar runtime, not just this directory.
    expect(closure.length).toBeGreaterThan(moduleFiles().length)
    expect(closure.some((file) => file.includes('adaptive-tutor'))).toBe(true)
    expect(closure.some((file) => file.endsWith(join('src', 'study', 'ports.ts')))).toBe(true)
    expect(closure.some((file) => file.endsWith(join('src', 'study', 'acceptedParentAdapter.ts')))).toBe(true)
    for (const file of closure) {
      const specifiers = importSpecifiers(readFileSync(file, 'utf8'))
      for (const specifier of specifiers) {
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

  it('constructs without a window, a document, or any storage present', () => {
    expect(typeof window).toBe('undefined')
    const safety: StudySafetyPort = {
      mode: 'production',
      classifierVersion: 'family-pilot-durable-ports-test-safety-v1',
      evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
    }
    expect(() => createFamilyPilotDurableStudyPorts({ safety })).not.toThrow()
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

describe('Family Pilot durable Study ports — production browser bundle', () => {
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
          fileName: 'family-pilot-durable-ports',
        },
      },
    })
    if ('on' in result) throw new Error('Durable ports bundle scan unexpectedly started watch mode.')
    const bundle = outputText(result)

    // It really did compile: the factory and the storage key both survive.
    expect(bundle).toContain('manuel-academy.study.family-pilot-durable-ports.v1')
    expect(bundle).toContain('createFamilyPilotDurableStudyPorts')

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

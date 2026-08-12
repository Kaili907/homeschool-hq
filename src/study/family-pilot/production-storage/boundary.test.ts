import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

// A composition layer is only worth having if it is at least as deployable as
// the modules it composes. These are the accepted modules' own boundary rules,
// applied to this one — plus the one rule that is specific to composing:
// ../integration/index.ts carries a PRODUCTION BOUNDARY WARNING, because it
// re-exports FamilyPilotController and drags the Study runtime facade into any
// bundle that touches it. This module therefore imports ../integration/safety
// directly and never the barrel, and that is asserted rather than remembered.

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

describe('Family Pilot production Study ports — module boundary', () => {
  it('is a composition and nothing else: one entry point and two files behind it', () => {
    expect(moduleFiles().map((file) => relative(here, file)).sort())
      .toEqual(['index.ts', 'productionStudyPorts.ts', 'studyEntrySafety.ts'])
  })

  it('imports nothing local-development, server-only, Node-only, or test-only', () => {
    for (const file of [...moduleFiles(), ...importClosure()]) {
      for (const specifier of importSpecifiers(readFileSync(file, 'utf8'))) {
        for (const forbidden of FORBIDDEN_IMPORT_SPECIFIERS) {
          expect(specifier, `${relative(repoRoot, file)} imports ${specifier}`).not.toContain(forbidden)
        }
      }
    }
  })

  it('reaches every module it claims to compose, and not the integration barrel', () => {
    const closure = importClosure()
    for (const composed of [
      join('durable-indexeddb', 'storage.ts'),
      join('durable-indexeddb', 'ports.ts'),
      join('durable-ports', 'durableStudyPorts.ts'),
      join('durable-ports', 'safetySeam.ts'),
      join('integration', 'safety.ts'),
    ]) {
      expect(closure.some((file) => file.endsWith(composed)), composed).toBe(true)
    }
    // The Study runtime facade and everything that drags it in stay out.
    expect(closure.some((file) => file.endsWith(join('integration', 'index.ts')))).toBe(false)
    expect(closure.some((file) => file.endsWith(join('integration', 'controller.ts')))).toBe(false)
    expect(closure.some((file) => file.includes(join('production-storage', 'testing')))).toBe(false)
  })

  it('carries no local-development or provider-credential marker in its own source', () => {
    const source = moduleFiles().map((file) => readFileSync(file, 'utf8')).join('\n')
    for (const marker of FORBIDDEN_SOURCE_MARKERS) {
      expect(source).not.toContain(marker)
    }
  })

  it('ships no safety classifier of its own', () => {
    const source = moduleFiles().map((file) => readFileSync(file, 'utf8')).join('\n')
    // The bundle's StudySafetyPort is required from the caller, exactly as the
    // two modules below it require it. Nothing here evaluates anything.
    expect(source).not.toContain('classifierVersion:')
    expect(source).not.toContain('mayContinue')
    expect(source).toContain('StudySafetyPort')
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

describe('Family Pilot production Study ports — production browser bundle', () => {
  it('bundles for a production browser with no Node built-in and no test kit', async () => {
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
          fileName: 'family-pilot-production-storage',
        },
      },
    })
    if ('on' in result) throw new Error('Production storage bundle scan unexpectedly started watch mode.')
    const bundle = outputText(result)

    expect(bundle).toContain('createFamilyPilotProductionStudyPorts')
    expect(bundle).toContain('manuel-academy.study.family-pilot-durable')
    expect(bundle).toContain('indexedDB')
    expect(bundle).not.toContain('createFakeIndexedDb')
    expect(bundle).not.toContain('family-pilot-indexeddb-test-safety-v1')
    expect(bundle).not.toContain('FamilyPilotController')

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

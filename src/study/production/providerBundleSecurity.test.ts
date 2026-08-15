import { beforeAll, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

const UNSAFE_BUILD_REQUESTS = Object.freeze({
  // Vitest itself runs with NODE_ENV=test. Override it for the nested Vite build
  // so import.meta.env.PROD is compiled exactly as it is for a deployment build.
  NODE_ENV: 'production',
  VITE_USE_PROXY: 'false',
  VITE_ALLOW_BROWSER_PROVIDER_KEYS: 'true',
  VITE_STUDY_ENGINE_ENABLED: 'true',
  VITE_STUDY_ENGINE_PREVIEW: 'true',
  VITE_ANTHROPIC_API_KEY: 'synthetic-browser-tutor-key-sentinel',
  VITE_ELEVENLABS_API_KEY: 'synthetic-browser-voice-key-sentinel',
})

const FORBIDDEN_PRODUCTION_BUNDLE_MARKERS = [
  // Provider-native browser transports and credential-bearing headers.
  'api.anthropic.com',
  'api.elevenlabs.io',
  'x-api-key',
  'xi-api-key',
  'anthropic-dangerous-direct-browser-access',

  // Session 15 browser-local credential slots and build-time escape hatches.
  'homeschool-hq:tutor:key',
  'homeschool-hq:voice:key',
  'VITE_USE_PROXY',
  'VITE_ALLOW_BROWSER_PROVIDER_KEYS',
  'VITE_ANTHROPIC_API_KEY',
  'VITE_ELEVENLABS_API_KEY',
  UNSAFE_BUILD_REQUESTS.VITE_ANTHROPIC_API_KEY,
  UNSAFE_BUILD_REQUESTS.VITE_ELEVENLABS_API_KEY,
  'server-only-provider-voice-sentinel',
  'synthetic-provider-voice-secret',

  // Frozen RC1 and explicit local-preview identities/implementations.
  'learner:local-release-candidate',
  'learner:synthetic-grade5-',
  'LOCAL DEVELOPMENT ONLY',
  'session12-local-forced-outcome-v1',

  // Frozen Math R1 subject package content (D-MATH-2): registered behind the
  // study runtime's subject registry, never in any production bundle.
  'Adaptive Math Intervention Content',
  'math-seq-pv-regroup-v1',
] as const

function outputText(result: Rollup.RollupOutput | readonly Rollup.RollupOutput[]): string {
  const outputs = Array.isArray(result) ? result : [result]
  return outputs
    .flatMap((output) => output.output)
    .map((entry) => {
      if (entry.type === 'chunk') return entry.code
      return typeof entry.source === 'string'
        ? entry.source
        : new TextDecoder().decode(entry.source)
    })
    .join('\n')
}

describe('production client bundle provider and preview boundary', () => {
  let bundle = ''
  let buildOutputs: readonly Rollup.RollupOutput[] = []

  beforeAll(async () => {
    const previous = new Map<string, string | undefined>()
    for (const [name, value] of Object.entries(UNSAFE_BUILD_REQUESTS)) {
      previous.set(name, process.env[name])
      process.env[name] = value
    }

    try {
      const result = await build({
        mode: 'production',
        logLevel: 'silent',
        build: {
          write: false,
          minify: true,
        },
      })
      if ('on' in result) throw new Error('Production bundle scan unexpectedly started watch mode.')
      buildOutputs = Array.isArray(result) ? result : [result]
      bundle = outputText(result)
    } finally {
      for (const [name, value] of previous) {
        if (value === undefined) delete process.env[name]
        else process.env[name] = value
      }
    }
  }, 120_000)

  it('forces the authenticated same-origin Tutor and voice gateways even when proxy opt-out is requested', () => {
    expect(bundle).toContain('/api/anthropic')
    expect(bundle).toContain('/api/tts')
  })

  it.each(FORBIDDEN_PRODUCTION_BUNDLE_MARKERS)(
    'omits forbidden production client marker %s',
    (marker) => {
      expect(bundle).not.toContain(marker)
    },
  )

  it('keeps the final Family Pilot production closure free of local, test, Node, and Supabase Study providers', () => {
    const chunks = buildOutputs.flatMap((output) =>
      output.output.filter((entry): entry is Rollup.OutputChunk => entry.type === 'chunk'))
    const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
    const entry = chunks.find((chunk) => chunk.facadeModuleId?.endsWith('/src/study/family-pilot/final-app/FinalFamilyPilotApp.tsx'))
    expect(entry, 'the feature-flagged final Family Pilot app must be emitted').toBeDefined()

    const closure = new Set<Rollup.OutputChunk>()
    const visit = (chunk: Rollup.OutputChunk | undefined) => {
      if (!chunk || closure.has(chunk)) return
      closure.add(chunk)
      chunk.imports.forEach((fileName) => visit(byFile.get(fileName)))
    }
    visit(entry)

    const workspacePrefix = `${process.cwd()}/`
    const moduleIds = [...closure]
      .flatMap((chunk) => Object.keys(chunk.modules))
      .map((moduleId) => moduleId.replace(workspacePrefix, ''))
      .join('\n')
    const closureText = [...closure].map((chunk) => chunk.code).join('\n')
    expect(moduleIds).not.toMatch(/localDevelopmentPorts|syntheticStudyFixtures|\/testing\/|fakeIndexedDb|node_modules\/fake-indexeddb/i)
    expect(moduleIds).not.toMatch(/source\.node|generate\.node|node-runtime|supabase.*study|study.*supabase/i)
    // The main app's shared entry owns Supabase authentication and is a static
    // Rollup dependency of every lazy screen. Scan the final facade itself for
    // endpoint/provider markers, while using module ids above to prove the
    // final Study graph did not acquire a Supabase Study implementation.
    expect(entry?.code).not.toMatch(/node:fs|node:fs\/promises|@supabase\/supabase-js|localhost|127\.0\.0\.1/i)
    expect(closureText).not.toContain('production-material:')
  })
})

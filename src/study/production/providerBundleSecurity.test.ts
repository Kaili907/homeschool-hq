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
})

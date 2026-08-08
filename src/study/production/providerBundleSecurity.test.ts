import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { build, type Rollup } from 'vite'

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * STUDY-A1-PROD-DASH-H2 Phase 2 — the bundle half of the import-closure claim.
 *
 * Minification renames identifiers, so an identifier is worthless as a bundle
 * marker: `getGatewayAccessToken` and `createVerifiedStudyRuntimeAdapter` are
 * both absent from a bundle that ships them. Only string literals survive, so
 * every marker below is a literal, and the positive control asserts that
 * literals of exactly this shape do reach the bundle.
 *
 * These are derived from the adapter sources rather than transcribed, so a new
 * direct browser-to-database Study call is covered the day it is written.
 *
 * `@supabase/supabase-js` and `createClient` are deliberately NOT markers here:
 * the app authenticates through that client, so both are in every production
 * bundle and asserting their absence would be a test that can only fail. That
 * the verified dashboard does not reach them is a claim about the dashboard's
 * own import closure, and it is enforced where it can be true —
 * `productionImportBoundary.test.ts`, against the value closure.
 */
function directStudyDatabaseMarkers(): readonly string[] {
  const directories = [join(sourceRoot, 'study', 'persistence'), join(sourceRoot, 'study', 'generated')]
  const markers = new Set<string>()
  for (const directory of directories) {
    for (const name of readdirSync(directory)) {
      if (!name.endsWith('.ts') || name.endsWith('.test.ts')) continue
      for (const [, marker] of readFileSync(join(directory, name), 'utf8')
        .matchAll(/'(academy_study_[a-z_]+)'/g)) markers.add(marker)
    }
  }
  return [...markers].sort()
}

const DIRECT_STUDY_DATABASE_MARKERS = directStudyDatabaseMarkers()

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

  // STUDY-A1-PROD-DASH-1: preview-only Study day seeding, test-only inspection
  // seams, and trusted-server transports. The production learner dashboard is
  // the first real production Study surface, so these must not arrive with it.
  'ensureLocalDevelopmentStudyDay',
  'inspectPublicStateForTest',
  'testOnlyPrivateNoteMatches',
  'trustedServerRpc',
  'trustedServerClient',
  'SUPABASE_SERVICE_ROLE_KEY',

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

  it.each(DIRECT_STUDY_DATABASE_MARKERS)(
    'omits direct browser-to-database Study call %s',
    (marker) => {
      expect(bundle).not.toContain(marker)
    },
  )
})

// STUDY-A1-PROD-DASH-1 Phase 10. The scan above deliberately asks for preview
// mode to prove the bundle stays clean under a hostile build request; this one
// is the deployment configuration itself — Study on, preview off — and is the
// build in which the verified learner dashboard actually ships.
describe('production client bundle with the Study preview switched off', () => {
  let bundle = ''

  beforeAll(async () => {
    const requests = { ...UNSAFE_BUILD_REQUESTS, VITE_STUDY_ENGINE_PREVIEW: 'false' }
    const previous = new Map<string, string | undefined>()
    for (const [name, value] of Object.entries(requests)) {
      previous.set(name, process.env[name])
      process.env[name] = value
    }

    try {
      const result = await build({
        mode: 'production',
        logLevel: 'silent',
        build: { write: false, minify: true },
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

  it('ships the verified read-only learner dashboard', () => {
    // Positive control: a bundle that did not contain the new surface at all
    // would pass every exclusion below for the wrong reason.
    expect(bundle).toContain('Scheduled Study blocks')
    expect(bundle).toContain('Recent Study sessions')
  })

  it('proves a Study string literal of the forbidden shape would be caught', () => {
    // The exclusions below are only worth anything if a marker of the same kind
    // survives minification. These three are snake_case-and-colon Study
    // operation literals that the verified surface genuinely ships, so an
    // `academy_study_*` literal would be just as visible if one arrived.
    expect(DIRECT_STUDY_DATABASE_MARKERS.length).toBeGreaterThan(10)
    for (const shipped of ['dashboard:read', 'calendar:read', 'student:progress:read']) {
      expect(bundle).toContain(shipped)
    }
  })

  it.each(DIRECT_STUDY_DATABASE_MARKERS)(
    'omits direct browser-to-database Study call %s',
    (marker) => {
      expect(bundle).not.toContain(marker)
    },
  )

  it('ships no Study session launch, resume or settings control with it', () => {
    for (const control of ['Start Study', 'Resume session', 'Study settings', 'Review queue']) {
      expect(bundle).not.toContain(control)
    }
  })

  it.each(FORBIDDEN_PRODUCTION_BUNDLE_MARKERS)(
    'omits forbidden production client marker %s',
    (marker) => {
      expect(bundle).not.toContain(marker)
    },
  )
})

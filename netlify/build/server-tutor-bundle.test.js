/**
 * STUDY-A1-SERVER-TUTOR-BUILD-FEASIBILITY — the build gate for server-side Tutor.
 *
 * The Tutor bundle-boundary analysis recommends executing Tutor on the server,
 * and named one hard prerequisite before any of that work is worth starting:
 * prove Netlify's build can bundle the frozen Tutor Core and resolve
 * `@frozen/tutor-math-r1`. This file is that proof, and it is deliberately a
 * BUILD fixture rather than a function — see ./server-tutor-bundle.mjs for why
 * nothing here is deployable.
 *
 * The resolution is not mocked anywhere in this file. A test-time stub for
 * `@frozen/tutor-math-r1` would make every assertion below pass while proving
 * the opposite of what is claimed, so the frozen content is reached through the
 * real alias, bundled by the real bundler, and executed as real JavaScript.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  NETLIFY_FUNCTION_BUILD,
  PRODUCTION_TUTOR_ENTRY_POINTS,
  TUTOR_ADAPTER_ENTRY_POINT,
  bundleProductionTutor,
  frozenPackageAliases,
} from './server-tutor-bundle.mjs'

const repoRoot = new URL('../../', import.meta.url)
const readRepoFile = (path) => readFileSync(fileURLToPath(new URL(path, repoRoot)), 'utf8')

/**
 * Every sequence id the frozen Math R1 manifest registers. Four programs, and
 * the point of listing all four is below: only one of them is the default.
 */
const FROZEN_SEQUENCE_IDS = Object.freeze([
  'math-seq-pv-regroup-v1',
  'math-seq-mult-div-rel-v1',
  'math-seq-equivalent-fractions-v1',
  'math-seq-multistep-word-problems-v1',
])

/** Sequence 01, which `selectTutorProgram` returns when nothing else matches. */
const DEFAULT_SEQUENCE_PROMPT =
  'That is one useful piece of evidence. Here is the next check. Which comparison is true?'

/** Sequence 04, which is reachable ONLY by a genuine routing-id match. */
const SEQUENCE_04_ID = 'math-seq-multistep-word-problems-v1'
const SEQUENCE_04_PROMPT =
  'That is one useful piece of evidence. Here is the next check. A class has 24 students. ' +
  'Tickets cost $12 per student, and the bus fee is $85. Which expression gives the total trip cost?'

function turnRequest(overrides = {}) {
  return {
    requestRef: 'study-turn:server-bundle-probe',
    sessionRef: 'study-session:server-bundle-probe',
    learnerPseudonym: 'learner:00112233445566778899aabbccddeeff',
    lessonRef: 'math-lesson-04-multistep-word-problem-reasoning',
    segmentRef: 'segment:server-bundle-probe',
    skillRef: SEQUENCE_04_ID,
    subject: 'math',
    taskType: 'guided-practice',
    transientLearnerText: 'ready',
    expectedAnswer: 'ready',
    occurredAt: '2026-08-01T14:00:00.000Z',
    learnerLocalDate: '2026-08-01',
    householdTimeZone: 'America/Detroit',
    ...overrides,
  }
}

/**
 * Ports, and only ports. The adapter takes its event ledger and both safety
 * classifiers as injected dependencies, so a turn needs no provider, no network
 * and no credential — which is itself one of the things this file measures.
 */
function turnDependencies() {
  return {
    eventLedger: { appendAcceptedEvent: async () => ({ status: 'appended' }) },
    safety: { mode: 'local-demo' },
    outputSafety: {
      classify: async () => ({
        classification: 'clear',
        mayContinue: true,
        adultHelpState: 'not-needed',
      }),
    },
  }
}

describe('server-side Tutor build feasibility', () => {
  /**
   * RED, and it is run rather than remembered. `alias: {}` is exactly what a
   * Netlify function build has today, because nothing outside vite.config.ts
   * ever declared the mapping.
   */
  it('cannot resolve the frozen subject package without an explicit alias', async () => {
    const failure = await bundleProductionTutor({
      entryPoints: [TUTOR_ADAPTER_ENTRY_POINT],
      alias: {},
    }).then(
      () => null,
      (error) => error,
    )

    // Asserted as a specific unresolved specifier at a specific file. "The build
    // failed" would also be satisfied by a typo in this test.
    expect(failure).not.toBeNull()
    const messages = (failure.errors ?? []).map((error) => error.text)
    expect(messages).toContain('Could not resolve "@frozen/tutor-math-r1"')
    const locations = (failure.errors ?? []).map((error) => error.location?.file ?? '')
    expect(locations.some((file) => file.endsWith('subject-registry.ts'))).toBe(true)
  })

  /**
   * GREEN, over the whole production Tutor surface rather than the one entry
   * that happens to be easy. `tutorRuntime.ts` is included because it is what a
   * real server function would import, and it reaches WebCrypto and the contract
   * parser that the adapter alone does not.
   */
  it('bundles every production Tutor entry point with the shared alias', async () => {
    const result = await bundleProductionTutor({
      entryPoints: PRODUCTION_TUTOR_ENTRY_POINTS,
      alias: frozenPackageAliases,
    })
    expect(result.outputFiles).toHaveLength(PRODUCTION_TUTOR_ENTRY_POINTS.length)
    for (const outputFile of result.outputFiles) {
      expect(outputFile.text.length).toBeGreaterThan(0)
    }
  })

  it('targets the Node version netlify.toml actually deploys', () => {
    // The build settings claim to describe the deployed function runtime. This
    // is what stops that claim going stale silently.
    expect(readRepoFile('netlify.toml')).toContain('NODE_VERSION = "22"')
    expect(NETLIFY_FUNCTION_BUILD.target).toBe('node22')
    expect(NETLIFY_FUNCTION_BUILD.platform).toBe('node')
    expect(NETLIFY_FUNCTION_BUILD.format).toBe('esm')
  })

  describe('the bundled Tutor adapter', () => {
    let bundleText
    let workingDirectory
    let adapter

    beforeAll(async () => {
      const result = await bundleProductionTutor({
        entryPoints: [TUTOR_ADAPTER_ENTRY_POINT],
        alias: frozenPackageAliases,
      })
      bundleText = result.outputFiles[0].text
      // Written outside the repository, so a feasibility probe cannot leave a
      // loadable Tutor artifact anywhere Netlify publishes from.
      workingDirectory = await mkdtemp(join(tmpdir(), 'study-server-tutor-probe-'))
      const bundlePath = join(workingDirectory, 'tutorAdapter.mjs')
      await writeFile(bundlePath, bundleText, 'utf8')
      adapter = await import(pathToFileURL(bundlePath).href)
    })

    afterAll(async () => {
      if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true })
    })

    it('carries all four frozen sequences, not just the one the default path reaches', () => {
      for (const sequenceId of FROZEN_SEQUENCE_IDS) {
        expect(bundleText).toContain(sequenceId)
      }
    })

    /**
     * The load-bearing half of the tree-shaking claim, because the assertion
     * above is only a text search and a marker that is merely PRESENT proves
     * little.
     *
     * `selectTutorProgram` falls back to `programs[0]` — sequence 01 — for any
     * routing id it cannot match. So if esbuild had dropped the three
     * non-default lessons, this turn would not fail: it would quietly answer
     * with sequence 01's prompt. Driving sequence 04 and requiring ITS prose
     * distinguishes "the whole Tutor was bundled" from "the default survived",
     * and the second assertion names the exact wrong answer this is guarding
     * against.
     */
    it('executes a deterministic turn in Node from a non-default frozen sequence', async () => {
      const result = await adapter.runProductionTutorTurn(turnRequest(), turnDependencies())

      expect(result.status).toBe('accepted')
      expect(result.directive).toBe('continue')
      expect(result.reasonCode).toBe('tutor-core-continue')
      expect(result.coreSubmitInvocations).toBe(1)
      expect(result.visibleText).toBe(SEQUENCE_04_PROMPT)
      expect(result.visibleText).not.toBe(DEFAULT_SEQUENCE_PROMPT)
      expect(result.eventId).toBe('study-turn:server-bundle-probe')
      expect(result.recommendation.action).toBe('continue-plan')
      expect(result.minimizedProjection.evidence.skillIds).toEqual([SEQUENCE_04_ID])
      expect(result.privacyActions).toEqual([])

      // Same request, same answer. The bundle holds no clock and no RNG (pinned
      // below), so this is a property rather than a coincidence.
      const repeated = await adapter.runProductionTutorTurn(turnRequest(), turnDependencies())
      expect(repeated).toEqual(result)
    })

    it('needs no provider key, credential, network call or browser global', () => {
      for (const forbidden of [
        'ANTHROPIC_API_KEY',
        'ELEVENLABS_API_KEY',
        'VITE_',
        'import.meta.env',
        'process.env',
        'Authorization:',
        'Bearer ',
        'XMLHttpRequest',
        'localStorage',
        'window.',
        'document.',
      ]) {
        expect(bundleText).not.toContain(forbidden)
      }
      // `fetch` deserves its own assertion: a Tutor that reached a hosted
      // provider would need one, and the whole point of the frozen Core is that
      // it does not.
      expect(bundleText).not.toMatch(/\bfetch\s*\(/)

      // The one credential-shaped token in the bundle is a DENYLIST entry — a
      // field name the privacy sanitizer refuses to emit — which is the opposite
      // of a credential requirement. Pinned so the scan above cannot be read as
      // having missed it.
      expect(bundleText).toContain('"apiKey"')
      expect(readRepoFile('adaptive-tutor/study-engine/bridges/tutor-core/src/privacy.ts')).toContain('apiKey')
    })

    /**
     * Reproducibility, stated as what is actually true.
     *
     * The bundle DOES read the wall clock: the pre-Core safety permit carries a
     * TTL compared against `Date.now()`, and a few envelope fields fall back to
     * `new Date().toISOString()` when the caller supplies no timestamp. Claiming
     * the clock is absent would be a false statement about the artifact, and it
     * would go stale the moment someone checked.
     *
     * The claim that matters for a server is narrower and stronger: none of that
     * clock reaches what the host is handed. So the same turn is run under two
     * system times seven months apart and required to produce the identical
     * result — which a bare twice-in-a-row comparison could never show.
     */
    it('does not let the server wall clock reach the turn result', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        vi.setSystemTime(new Date('2026-08-01T14:00:00.000Z'))
        const first = await adapter.runProductionTutorTurn(turnRequest(), turnDependencies())
        vi.setSystemTime(new Date('2027-03-09T02:41:07.000Z'))
        const second = await adapter.runProductionTutorTurn(turnRequest(), turnDependencies())
        expect(second).toEqual(first)
        expect(first.status).toBe('accepted')
      } finally {
        vi.useRealTimers()
      }
      // Randomness genuinely is absent, so the only remaining nondeterminism a
      // server could introduce would have to come from a dependency.
      expect(bundleText).not.toMatch(/Math\.random\s*\(/)
    })

    it('carries no release-candidate or local-development surface', () => {
      // The preview bundle markers, restated here because this artifact is the
      // one that would run on a server rather than in a browser.
      expect(bundleText).not.toContain('learner:local-release-candidate')
      expect(bundleText).not.toContain('LOCAL DEVELOPMENT ONLY')
      expect(bundleText).not.toContain('portable-non-production')
    })
  })

  /**
   * The card's own constraint, pinned rather than promised. A feasibility spike
   * that quietly became a publicly callable Tutor endpoint is the failure this
   * guards, and both halves of "callable" are checked: a function file Netlify
   * would mount, and a redirect that would route to it.
   */
  it('mounts no Tutor route and publishes no Tutor function', () => {
    const netlifyConfig = readRepoFile('netlify.toml')
    expect(netlifyConfig).not.toMatch(/functions\/[^\s"]*tutor/i)
    expect(netlifyConfig).not.toMatch(/from = "\/api\/study\/tutor/i)
    // The functions directory netlify.toml publishes, and nothing Tutor-shaped
    // in it. This probe lives in netlify/build/, which Netlify does not scan.
    expect(netlifyConfig).toContain('functions = "netlify/functions"')
    const published = readRepoFile('netlify.toml').includes('functions = "netlify/build"')
    expect(published).toBe(false)
  })
})

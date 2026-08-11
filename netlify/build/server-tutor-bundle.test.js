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
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { viteConfig } from '../../vite.config'
import {
  DEFAULT_SERVER_TUTOR_OUTPUT_DIRECTORY,
  FROZEN_PACKAGE_ALIAS_SOURCES,
  HOST_CONTENT_MAPPING_SCHEMA_VERSION,
  NETLIFY_FUNCTION_BUILD,
  PRODUCTION_TUTOR_ENTRY_POINTS,
  SERVER_TUTOR_ARTIFACT_SCHEMA_VERSION,
  SERVER_TUTOR_BUNDLE_FILE,
  SERVER_TUTOR_MANIFEST_FILE,
  TUTOR_ADAPTER_ENTRY_POINT,
  buildServerTutorPrebundle,
  bundleProductionTutor,
  frozenPackageAliases,
  verifyFrozenTutorCustody,
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

const repoRootPath = fileURLToPath(repoRoot)
const TEST_MAPPING_FIXTURE = 'netlify/build/host-content-mapping.test.json'
const ACADEMY_MANIFEST_SHA256 = '38e6f27c24ec5371e4647364c088984fa0e1dbe25e1312847108a6d56d7404be'

function productionMappingArtifact(overrides = {}) {
  return {
    schemaVersion: HOST_CONTENT_MAPPING_SCHEMA_VERSION,
    artifactKind: 'production-reviewed',
    mappingVersion: 1,
    compatibilityStatus: 'approved',
    sourceCustody: {
      academy: {
        packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
        release: '1.0.0',
        manifestSha256: ACADEMY_MANIFEST_SHA256,
      },
      frozenTutor: {
        packageName: '@manuel-academy/adaptive-tutor-math-content',
        packageVersion: '1.0.2',
        checksumManifestSha256: 'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee',
      },
    },
    lessonMappings: [
      {
        lessonRef: 'math-lesson-04-multistep-word-problem-reasoning',
        skillRef: SEQUENCE_04_ID,
      },
    ],
    ...overrides,
  }
}

async function relativeFiles(root) {
  const entries = await readdir(root, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length + 1).replaceAll('\\', '/'))
    .sort()
}

describe('production-grade server Tutor prebundle', () => {
  let workingDirectory
  let productionFixtureDirectory
  let first
  let second
  let bundleText
  let serverEntry
  let functionFilesBefore

  beforeAll(async () => {
    workingDirectory = await mkdtemp(join(tmpdir(), 'study-server-tutor-prebundle-'))
    productionFixtureDirectory = await mkdtemp(join(repoRootPath, 'netlify', 'build', '.mapping-test-'))
    functionFilesBefore = await relativeFiles(join(repoRootPath, 'netlify', 'functions'))
    first = await buildServerTutorPrebundle({
      mapping: { mode: 'test', fixturePath: TEST_MAPPING_FIXTURE },
      outputDirectory: join(workingDirectory, 'first'),
      buildSourceSha: null,
    })
    second = await buildServerTutorPrebundle({
      mapping: { mode: 'test', fixturePath: TEST_MAPPING_FIXTURE },
      outputDirectory: join(workingDirectory, 'second'),
      buildSourceSha: null,
    })
    const bundlePath = join(first.outputDirectory, SERVER_TUTOR_BUNDLE_FILE)
    bundleText = await readFile(bundlePath, 'utf8')
    serverEntry = await import(pathToFileURL(bundlePath).href)
  }, 120_000)

  afterAll(async () => {
    if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true })
    if (productionFixtureDirectory) {
      await rm(productionFixtureDirectory, { recursive: true, force: true })
    }
  })

  async function writeProductionArtifact(name, artifact) {
    const bytes = Buffer.isBuffer(artifact)
      ? artifact
      : Buffer.from(typeof artifact === 'string' ? artifact : `${JSON.stringify(artifact, null, 2)}\n`)
    const artifactPath = join(productionFixtureDirectory, name)
    await writeFile(artifactPath, bytes)
    return {
      artifactPath: relative(repoRootPath, artifactPath).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  }

  async function buildProductionArtifact(name, artifact, expectedSha256) {
    const written = await writeProductionArtifact(name, artifact)
    return buildServerTutorPrebundle({
      mapping: {
        mode: 'production',
        artifactPath: written.artifactPath,
        expectedSha256: expectedSha256 ?? written.sha256,
      },
      outputDirectory: join(productionFixtureDirectory, `output-${name}`),
      buildSourceSha: null,
    })
  }

  it('feeds browser Vite and server esbuild from one canonical alias authority', () => {
    expect(viteConfig.resolve?.alias).toBe(frozenPackageAliases)
    expect(FROZEN_PACKAGE_ALIAS_SOURCES).toEqual({
      '@frozen/tutor-math-r1': 'adaptive-tutor/subjects/math/index.ts',
    })
    expect(Object.keys(frozenPackageAliases)).toEqual(Object.keys(FROZEN_PACKAGE_ALIAS_SOURCES))
    const serverInputs = Object.keys(first.metafile.inputs).map((path) => path.replaceAll('\\', '/'))
    expect(serverInputs.some((path) => path.endsWith(FROZEN_PACKAGE_ALIAS_SOURCES['@frozen/tutor-math-r1']))).toBe(true)
  })

  it('verifies the real frozen package against the external custody pin', async () => {
    await expect(verifyFrozenTutorCustody()).resolves.toEqual({
      packageName: '@manuel-academy/adaptive-tutor-math-content',
      packageVersion: '1.0.2',
      manifestVersion: '1.0.0',
      checksumManifestSha256: 'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee',
      checksumEntryCount: 91,
    })
  })

  it('fails before bundling when the frozen package is missing', async () => {
    await expect(verifyFrozenTutorCustody({
      packageRoot: join(workingDirectory, 'missing-frozen-package'),
    })).rejects.toThrow('Frozen Tutor package is missing')
  })

  it('fails before bundling when the frozen checksum set drifts', async () => {
    const corrupt = await mkdtemp(join(tmpdir(), 'study-corrupt-frozen-tutor-'))
    try {
      await Promise.all([
        writeFile(join(corrupt, 'package.json'), JSON.stringify({
          name: '@manuel-academy/adaptive-tutor-math-content',
          version: '1.0.2',
        })),
        writeFile(join(corrupt, 'manifest.json'), JSON.stringify({ version: '1.0.0' })),
        writeFile(join(corrupt, 'SHA256SUMS.txt'), `${'0'.repeat(64)}  ./index.ts\n`),
      ])
      await expect(verifyFrozenTutorCustody({ packageRoot: corrupt }))
        .rejects.toThrow('Frozen Tutor checksum manifest mismatch')
    } finally {
      await rm(corrupt, { recursive: true, force: true })
    }
  })

  it('emits the exact v1 manifest schema and verified digests', async () => {
    const fixtureBytes = await readFile(fileURLToPath(new URL(TEST_MAPPING_FIXTURE, repoRoot)))
    const expectedMappingDigest = createHash('sha256').update(fixtureBytes).digest('hex')
    const manifestOnDisk = JSON.parse(await readFile(
      join(first.outputDirectory, SERVER_TUTOR_MANIFEST_FILE),
      'utf8',
    ))

    expect(Object.keys(first.manifest)).toEqual([
      'schemaVersion',
      'runtime',
      'frozenPackage',
      'adapterContractVersion',
      'bundle',
      'hostContentMapping',
      'buildSourceSha',
    ])
    expect(first.manifest).toEqual({
      schemaVersion: SERVER_TUTOR_ARTIFACT_SCHEMA_VERSION,
      runtime: { platform: 'node', nodeTarget: 'node22', moduleFormat: 'esm' },
      frozenPackage: {
        specifier: '@frozen/tutor-math-r1',
        name: '@manuel-academy/adaptive-tutor-math-content',
        packageVersion: '1.0.2',
        manifestVersion: '1.0.0',
        checksumManifestSha256: 'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee',
        checksumEntryCount: 91,
      },
      adapterContractVersion: 'study-tutor.v1',
      bundle: {
        file: 'server-tutor.mjs',
        sha256: createHash('sha256').update(Buffer.from(bundleText)).digest('hex'),
      },
      hostContentMapping: {
        status: 'test-fixture',
        schemaVersion: 'study-host-content-mapping.test-fixture.v1',
        artifactKind: 'test-fixture',
        mappingVersion: 1,
        compatibilityStatus: 'test-fixture-only',
        artifactPath: TEST_MAPPING_FIXTURE,
        sha256: expectedMappingDigest,
      },
      buildSourceSha: null,
    })
    expect(manifestOnDisk).toEqual(first.manifest)
  })

  it('emits byte-identical bundle and manifest digests across unchanged builds', async () => {
    expect(second.manifest).toEqual(first.manifest)
    expect(await readFile(join(second.outputDirectory, SERVER_TUTOR_BUNDLE_FILE)))
      .toEqual(await readFile(join(first.outputDirectory, SERVER_TUTOR_BUNDLE_FILE)))
    expect(await readFile(join(second.outputDirectory, SERVER_TUTOR_MANIFEST_FILE)))
      .toEqual(await readFile(join(first.outputDirectory, SERVER_TUTOR_MANIFEST_FILE)))
  })

  it('requires a reviewed mapping artifact and digest in production mode', async () => {
    await expect(buildServerTutorPrebundle({
      mapping: { mode: 'production' },
      outputDirectory: join(workingDirectory, 'missing-production-mapping'),
    })).rejects.toThrow('requires a reviewed mapping artifact and SHA-256 digest')
  })

  it('pins the future production order without weakening the current browser build', () => {
    const packageJson = JSON.parse(readRepoFile('package.json'))
    const documentation = readRepoFile('docs/server-tutor-prebundle.md')
    expect(packageJson.scripts['server-tutor:bundle']).toBe('node netlify/build/server-tutor-bundle.mjs')
    expect(packageJson.scripts.build).not.toContain('server-tutor:bundle')
    expect(documentation).toContain(
      'curriculum:build -> server-tutor:bundle (reviewed mapping) -> vite build -> stamp-sw',
    )
  })

  it('allows the dedicated mapping fixture only in explicit test mode', async () => {
    const fixtureBytes = await readFile(fileURLToPath(new URL(TEST_MAPPING_FIXTURE, repoRoot)))
    await expect(buildProductionArtifact('reviewed-production-mapping.json', fixtureBytes))
      .rejects.toThrow('Unsupported production mapping schemaVersion')
    expect(first.manifest.hostContentMapping).toMatchObject({
      status: 'test-fixture',
      schemaVersion: 'study-host-content-mapping.test-fixture.v1',
      artifactKind: 'test-fixture',
      mappingVersion: 1,
      compatibilityStatus: 'test-fixture-only',
    })
  })

  it('accepts a reviewed approved artifact according to contents even under a .test filename', async () => {
    const result = await buildProductionArtifact('whatever.test.json', productionMappingArtifact())
    expect(result.manifest.hostContentMapping).toEqual({
      status: 'production-reviewed',
      schemaVersion: HOST_CONTENT_MAPPING_SCHEMA_VERSION,
      artifactKind: 'production-reviewed',
      mappingVersion: 1,
      compatibilityStatus: 'approved',
      sourceCustody: productionMappingArtifact().sourceCustody,
      artifactPath: expect.stringMatching(/whatever\.test\.json$/),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
  })

  it('accepts an honestly empty reviewed production compatibility artifact', async () => {
    const result = await buildProductionArtifact('no-approved-mapping.json', productionMappingArtifact({
      compatibilityStatus: 'no-approved-mapping-under-current-frozen-runtime',
      lessonMappings: [],
    }))
    expect(result.manifest.hostContentMapping.compatibilityStatus)
      .toBe('no-approved-mapping-under-current-frozen-runtime')
  })

  it('rejects test artifactKind even when the production schemaVersion is claimed', async () => {
    await expect(buildProductionArtifact('test-kind.json', productionMappingArtifact({
      artifactKind: 'test-fixture',
    }))).rejects.toThrow('artifactKind must be production-reviewed')
  })

  it('rejects an unsupported production mapping schemaVersion', async () => {
    await expect(buildProductionArtifact('wrong-schema.json', productionMappingArtifact({
      schemaVersion: 'study-tutor-host-mapping.v2',
    }))).rejects.toThrow('Unsupported production mapping schemaVersion')
  })

  it('rejects a missing production mapping schemaVersion', async () => {
    const artifact = productionMappingArtifact()
    delete artifact.schemaVersion
    await expect(buildProductionArtifact('missing-schema.json', artifact))
      .rejects.toThrow('Production mapping schemaVersion is required')
  })

  it('rejects a missing production mappingVersion', async () => {
    const artifact = productionMappingArtifact()
    delete artifact.mappingVersion
    await expect(buildProductionArtifact('missing-version.json', artifact))
      .rejects.toThrow('Production mappingVersion is required')
  })

  it('rejects a non-positive production mappingVersion', async () => {
    await expect(buildProductionArtifact('wrong-version.json', productionMappingArtifact({
      mappingVersion: 0,
    }))).rejects.toThrow('Production mappingVersion must be a positive integer')
  })

  it('rejects missing reviewed source custody pins', async () => {
    await expect(buildProductionArtifact('missing-custody.json', productionMappingArtifact({
      sourceCustody: undefined,
    }))).rejects.toThrow('Production mapping sourceCustody is required')
  })

  it('rejects a mapping pinned to another frozen Tutor package', async () => {
    const artifact = productionMappingArtifact()
    artifact.sourceCustody.frozenTutor.packageName = '@manuel-academy/other-tutor-content'
    await expect(buildProductionArtifact('wrong-frozen-package.json', artifact))
      .rejects.toThrow('Production mapping frozen Tutor package mismatch')
  })

  it('rejects a mapping pinned to another frozen checksum manifest', async () => {
    const artifact = productionMappingArtifact()
    artifact.sourceCustody.frozenTutor.checksumManifestSha256 = '0'.repeat(64)
    await expect(buildProductionArtifact('wrong-frozen-checksum.json', artifact))
      .rejects.toThrow('Production mapping frozen Tutor checksum manifest mismatch')
  })

  it('rejects a mapping whose Academy manifest pin does not match custody', async () => {
    const artifact = productionMappingArtifact()
    artifact.sourceCustody.academy.manifestSha256 = '0'.repeat(64)
    await expect(buildProductionArtifact('wrong-academy-manifest.json', artifact))
      .rejects.toThrow('Production mapping Academy manifest digest mismatch')
  })

  it('rejects a production mapping digest mismatch independently of its envelope', async () => {
    await expect(buildProductionArtifact(
      'wrong-artifact-digest.json',
      productionMappingArtifact(),
      '0'.repeat(64),
    )).rejects.toThrow('Production host-content mapping digest mismatch')
  })

  it('rejects invalid production mapping JSON with its correct digest', async () => {
    await expect(buildProductionArtifact('invalid-json.json', '{not-json}\n'))
      .rejects.toThrow('Production host-content mapping artifact is not valid JSON')
  })

  it('exports only the server factory and contract version', () => {
    expect(Object.keys(serverEntry).sort()).toEqual([
      'SERVER_TUTOR_ADAPTER_CONTRACT_VERSION',
      'createProductionServerTutorRuntime',
    ])
    expect(serverEntry.SERVER_TUTOR_ADAPTER_CONTRACT_VERSION).toBe('study-tutor.v1')
  })

  it('executes a non-default frozen Tutor program through the server factory in Node', async () => {
    const runtime = serverEntry.createProductionServerTutorRuntime({
      scope: {
        householdRef: 'household:server-prebundle-test',
        learnerRef: 'learner:server-prebundle-test',
        sessionRef: 'study-session:server-prebundle-test',
      },
      hostProfileRef: 'profile:server-prebundle-test',
      safety: {
        mode: 'production',
        classifierVersion: 'server-prebundle-test-v1',
        evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
      },
      eventLedger: { append: async () => 'appended' },
      isCurrent: () => true,
      bridgeSessionRef: 'study-session:server-prebundle-test',
    })
    await runtime.launch({
      sessionRef: 'study-session:server-prebundle-test',
      lessonRef: 'math-lesson-04-multistep-word-problem-reasoning',
      householdTimeZone: 'America/Detroit',
      learnerLocalDate: '2026-08-01',
    })
    const result = await runtime.submit({
      requestRef: 'study-turn:server-prebundle-test',
      sessionRef: 'study-session:server-prebundle-test',
      lessonRef: 'math-lesson-04-multistep-word-problem-reasoning',
      segmentRef: 'segment:server-prebundle-test',
      skillRef: SEQUENCE_04_ID,
      subject: 'math',
      taskType: 'guided-practice',
      transientLearnerText: 'ready',
      expectedAnswer: 'ready',
      occurredAt: '2026-08-01T14:00:00.000Z',
      learnerLocalDate: '2026-08-01',
      householdTimeZone: 'America/Detroit',
    })
    expect(result).toEqual({
      status: 'accepted',
      eventRef: 'study-turn:server-prebundle-test',
      visibleText: SEQUENCE_04_PROMPT,
    })
    expect(result.visibleText).not.toBe(DEFAULT_SEQUENCE_PROMPT)
  })

  it('keeps the server artifact out of browser inputs, dist and source maps', async () => {
    const inputs = Object.keys(first.metafile.inputs).map((path) => path.replaceAll('\\', '/'))
    expect(inputs.some((path) => path === 'src/App.tsx' || path.startsWith('src/components/'))).toBe(false)
    expect(inputs.some((path) => /\.(?:css|scss|sass|less)$/.test(path))).toBe(false)
    expect(bundleText).not.toContain('@frozen/tutor-math-r1')
    expect(bundleText).not.toMatch(/\bimport\s*\(/)

    const distRoot = join(repoRootPath, 'dist')
    const distFiles = await relativeFiles(distRoot).catch(() => [])
    expect(distFiles.some((path) => /server-tutor|generated/i.test(path))).toBe(false)
    for (const mapFile of distFiles.filter((path) => path.endsWith('.map'))) {
      const mapText = await readFile(join(distRoot, mapFile), 'utf8')
      expect(mapText).not.toContain('math-seq-pv-regroup-v1')
      expect(mapText).not.toContain('Adaptive Math Intervention Content')
    }

    const sourceFiles = (await relativeFiles(join(repoRootPath, 'src')))
      .filter((path) => /\.(?:ts|tsx|js|jsx)$/.test(path))
    for (const sourceFile of sourceFiles) {
      const source = await readFile(join(repoRootPath, 'src', sourceFile), 'utf8')
      expect(source).not.toContain(DEFAULT_SERVER_TUTOR_OUTPUT_DIRECTORY)
      expect(source).not.toContain(SERVER_TUTOR_BUNDLE_FILE)
    }
  })

  it('does not create a callable Netlify function or Tutor route', async () => {
    expect(await relativeFiles(join(repoRootPath, 'netlify', 'functions'))).toEqual(functionFilesBefore)
    expect(DEFAULT_SERVER_TUTOR_OUTPUT_DIRECTORY.startsWith('netlify/functions/')).toBe(false)
    const netlifyConfig = readRepoFile('netlify.toml')
    expect(netlifyConfig).not.toMatch(/from = "\/api\/study\/tutor/i)
    expect(netlifyConfig).not.toMatch(/functions\/[^\s"]*tutor/i)
  })
})

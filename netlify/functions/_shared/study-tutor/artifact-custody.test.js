import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACADEMY_SOURCE_PINS,
  FROZEN_TUTOR_SOURCE_PINS,
  PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING,
  TUTOR_HOST_MAPPING_ARTIFACT_KIND,
  TUTOR_HOST_MAPPING_SCHEMA_VERSION,
  TUTOR_HOST_MAPPING_SHA256,
  TUTOR_HOST_MAPPING_VERSION,
} from '../../../../src/study/server/tutorHostMapping.ts'

const { readFileMock } = vi.hoisted(() => ({ readFileMock: vi.fn() }))

vi.mock('node:fs/promises', () => ({ readFile: readFileMock }))

import {
  createProductionServerTutorArtifactCustody,
  createTestServerTutorArtifactCustody,
  isTestServerTutorArtifactCapability,
  isVerifiedServerTutorArtifactCapability,
} from './artifact-custody.js'

const STATIC_SCHEMA = 'study-server-tutor-static-capability.v1'
const RAW_MAPPING_SHA256 = 'c02fca57f61aaf74b950da1f3f5845cd76b38dba83997269198cf02b864e613d'

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function deepClone(value) {
  return structuredClone(value)
}

let sourceNonce = 0

function bundleSource({
  mapping = deepClone(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING),
  custodyMutate,
  staticSchema = STATIC_SCHEMA,
  omitMethod = null,
  importMarker = null,
  accessorMethod = null,
  dishonestLookup = false,
} = {}) {
  const custody = {
    schemaVersion: TUTOR_HOST_MAPPING_SCHEMA_VERSION,
    artifactKind: TUTOR_HOST_MAPPING_ARTIFACT_KIND,
    mappingVersion: TUTOR_HOST_MAPPING_VERSION,
    compatibilityStatus: mapping.compatibilityStatus,
    academySourcePins: mapping.academySourcePins,
    frozenTutorPins: mapping.frozenTutorPins,
    mappingSha256: TUTOR_HOST_MAPPING_SHA256,
    rawFileSha256: RAW_MAPPING_SHA256,
  }
  custodyMutate?.(custody)

  const methodSources = {
    verifyAcademySourcePins: `verifyAcademySourcePins(candidate) {
      return canonicalJson(candidate) === canonicalJson(SERVER_TUTOR_HOST_CONTENT_MAPPING.academySourcePins)
    }`,
    verifyFrozenTutorPins: `verifyFrozenTutorPins(candidate) {
      return canonicalJson(candidate) === canonicalJson(SERVER_TUTOR_HOST_CONTENT_MAPPING.frozenTutorPins)
    }`,
    resolveApprovedMapping: dishonestLookup
      ? `resolveApprovedMapping() { return Object.freeze(Object.create(null)) }`
      : `resolveApprovedMapping(input) {
        const matched = SERVER_TUTOR_HOST_CONTENT_MAPPING.approvedMappings.find((row) =>
          row.hostLessonRef === input.hostLessonRef &&
          row.hostSegmentRef === input.hostSegmentRef &&
          row.taskType === input.taskType)
        return matched === undefined ? null : Object.freeze(Object.create(null))
      }`,
    evaluateApprovedMapping: `evaluateApprovedMapping(input) {
      return { eligible: true, input }
    }`,
    deriveLearnerPseudonym: `async deriveLearnerPseudonym(sessionRef) {
      return 'learner:synthetic-' + sessionRef
    }`,
    createRuntime: `createRuntime(dependencies) {
      return { kind: 'synthetic-runtime', dependencies }
    }`,
  }
  if (omitMethod !== null) delete methodSources[omitMethod]
  if (accessorMethod !== null) {
    methodSources[accessorMethod] = `get ${accessorMethod}() { return () => true }`
  }

  sourceNonce += 1
  return `
function deepFreeze(value) {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  return '{' + Object.keys(value).sort().map(
    (key) => JSON.stringify(key) + ':' + canonicalJson(value[key]),
  ).join(',') + '}'
}
${importMarker === null ? '' : `globalThis[${JSON.stringify(importMarker.key)}] = ${JSON.stringify(importMarker.value)}`}
export const SERVER_TUTOR_HOST_CONTENT_MAPPING = deepFreeze(${JSON.stringify(mapping)})
export const SERVER_TUTOR_HOST_CONTENT_MAPPING_CUSTODY = deepFreeze(${JSON.stringify(custody)})
export const SERVER_TUTOR_STATIC_CAPABILITY = Object.freeze({
  schemaVersion: ${JSON.stringify(staticSchema)},
  ${Object.values(methodSources).join(',\n')}
})
export function createProductionServerTutorRuntime(dependencies) {
  return { kind: 'raw-runtime-that-custody-must-not-export', dependencies }
}
// unique synthetic module ${sourceNonce}
`
}

function manifestFor(bundleBytes, mutate) {
  const bundleSha256 = sha256(bundleBytes)
  const manifest = {
    schemaVersion: 'study-server-tutor-prebundle.v1',
    runtime: { platform: 'node', nodeTarget: 'node22', moduleFormat: 'esm' },
    frozenPackage: {
      specifier: '@frozen/tutor-math-r1',
      name: '@manuel-academy/adaptive-tutor-math-content',
      packageVersion: '1.0.2',
      manifestVersion: '1.0.0',
      checksumManifestSha256: FROZEN_TUTOR_SOURCE_PINS.sha256SumsDigest,
      checksumEntryCount: 91,
    },
    adapterContractVersion: 'study-tutor.v1',
    bundle: { file: 'server-tutor.mjs', sha256: bundleSha256 },
    hostContentMapping: {
      status: 'production-reviewed',
      artifactPath: 'src/study/server/tutorHostMapping.v1.json',
      schemaVersion: TUTOR_HOST_MAPPING_SCHEMA_VERSION,
      artifactKind: TUTOR_HOST_MAPPING_ARTIFACT_KIND,
      mappingVersion: TUTOR_HOST_MAPPING_VERSION,
      compatibilityStatus: 'no-approved-mapping-under-current-frozen-runtime',
      academySourcePins: deepClone(ACADEMY_SOURCE_PINS),
      frozenTutorPins: deepClone(FROZEN_TUTOR_SOURCE_PINS),
      mappingSha256: TUTOR_HOST_MAPPING_SHA256,
      rawFileSha256: RAW_MAPPING_SHA256,
      bundleSha256,
    },
    buildSourceSha: null,
  }
  mutate?.(manifest)
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function artifactPair({ sourceOptions, manifestMutate } = {}) {
  const bundleBytes = Buffer.from(bundleSource(sourceOptions), 'utf8')
  return {
    bundleBytes,
    manifestBytes: manifestFor(bundleBytes, manifestMutate),
  }
}

function installReads({ bundleBytes, manifestBytes }, options = {}) {
  let bundleReads = 0
  let manifestReads = 0
  readFileMock.mockImplementation(async (url) => {
    const path = url instanceof URL ? url.pathname : String(url)
    if (path.endsWith('/netlify/build/generated/server-tutor.mjs')) {
      bundleReads += 1
      return bundleReads === 1 || options.replacementBundleBytes === undefined
        ? bundleBytes
        : options.replacementBundleBytes
    }
    if (path.endsWith('/netlify/build/generated/server-tutor.manifest.json')) {
      manifestReads += 1
      return manifestBytes
    }
    throw new Error('unexpected artifact path')
  })
  return {
    bundleReads: () => bundleReads,
    manifestReads: () => manifestReads,
  }
}

describe('production server Tutor artifact custody', () => {
  beforeEach(() => {
    readFileMock.mockReset()
  })

  it('reads only the two fixed files once and returns only a private wrapper', async () => {
    const reads = installReads(artifactPair())
    const custody = createProductionServerTutorArtifactCustody()

    expect(custody.verify).toHaveLength(0)
    await expect(custody.verify('/tmp/caller-controlled')).resolves.toEqual({
      status: 'mapping-integrity-failed',
    })
    expect(readFileMock).not.toHaveBeenCalled()

    const first = await custody.verify()
    const second = await custody.verify()
    expect(second).toBe(first)
    expect(first.status).toBe('verified')
    expect(reads.bundleReads()).toBe(1)
    expect(reads.manifestReads()).toBe(1)
    expect(readFileMock.mock.calls.map(([url]) => url.pathname).sort()).toEqual([
      expect.stringMatching(/\/netlify\/build\/generated\/server-tutor\.manifest\.json$/),
      expect.stringMatching(/\/netlify\/build\/generated\/server-tutor\.mjs$/),
    ])

    const capability = first.capability
    expect(Object.keys(capability)).toEqual([
      'verifyAcademySourcePins',
      'verifyFrozenTutorPins',
      'resolveApprovedMapping',
      'evaluateApprovedMapping',
      'deriveLearnerPseudonym',
      'createRuntime',
    ])
    expect(Object.isFrozen(capability)).toBe(true)
    expect(isVerifiedServerTutorArtifactCapability(capability)).toBe(true)
    expect(isTestServerTutorArtifactCapability(capability)).toBe(false)
    expect(capability.verifyAcademySourcePins(ACADEMY_SOURCE_PINS)).toBe(true)
    expect(capability.verifyAcademySourcePins({ ...ACADEMY_SOURCE_PINS, releaseVersion: 'stale' })).toBe(false)
    expect(capability.verifyFrozenTutorPins()).toBe(true)
    expect(capability.verifyFrozenTutorPins(FROZEN_TUTOR_SOURCE_PINS)).toBe(false)
    expect(capability.resolveApprovedMapping({ operation: 'x' })).toBeNull()
    expect(capability.evaluateApprovedMapping({ mapping: 'x' })).toEqual({
      eligible: true,
      input: { mapping: 'x' },
    })
    await expect(capability.deriveLearnerPseudonym('session:x'))
      .resolves.toBe('learner:synthetic-session:x')
    expect(capability.createRuntime({ port: true })).toEqual({
      kind: 'synthetic-runtime',
      dependencies: { port: true },
    })

    for (const forbidden of [
      'module',
      'namespace',
      'runtime',
      'mapping',
      'custody',
      'schemaVersion',
      'createProductionServerTutorRuntime',
      'SERVER_TUTOR_HOST_CONTENT_MAPPING',
      'SERVER_TUTOR_HOST_CONTENT_MAPPING_CUSTODY',
      'SERVER_TUTOR_STATIC_CAPABILITY',
    ]) {
      expect(Object.hasOwn(capability, forbidden)).toBe(false)
      expect(Object.hasOwn(first, forbidden)).toBe(false)
    }
  })

  it('brands by object identity, so serialization, spread, and forgery do not transfer trust', async () => {
    installReads(artifactPair())
    const result = await createProductionServerTutorArtifactCustody().verify()
    const capability = result.capability
    const roundTrip = JSON.parse(JSON.stringify(capability))
    const spread = { ...capability }
    const forged = Object.freeze(Object.fromEntries(
      Object.keys(capability).map((key) => [key, capability[key]]),
    ))

    expect(isVerifiedServerTutorArtifactCapability(capability)).toBe(true)
    expect(isVerifiedServerTutorArtifactCapability(roundTrip)).toBe(false)
    expect(isVerifiedServerTutorArtifactCapability(spread)).toBe(false)
    expect(isVerifiedServerTutorArtifactCapability(forged)).toBe(false)
    expect(() => structuredClone(capability)).toThrow()
  })

  it('hashes before import and never executes bytes whose hash is not vouched for', async () => {
    const marker = '__studyTutorCustodyHashOrder'
    delete globalThis[marker]
    const original = artifactPair()
    const tampered = Buffer.concat([
      original.bundleBytes,
      Buffer.from(`\nglobalThis.${marker} = 'executed'\n`, 'utf8'),
    ])
    installReads({ bundleBytes: tampered, manifestBytes: original.manifestBytes })

    await expect(createProductionServerTutorArtifactCustody().verify()).resolves.toEqual({
      status: 'mapping-integrity-failed',
    })
    expect(globalThis[marker]).toBeUndefined()
  })

  it('imports the exact verified byte snapshot without reopening a replaceable path', async () => {
    const marker = '__studyTutorCustodyExactBytes'
    delete globalThis[marker]
    const safe = artifactPair({ sourceOptions: { importMarker: { key: marker, value: 'safe' } } })
    const replacement = Buffer.from(
      `globalThis.${marker} = 'replacement'; throw new Error('replacement imported')`,
      'utf8',
    )
    const reads = installReads(safe, { replacementBundleBytes: replacement })
    const custody = createProductionServerTutorArtifactCustody()

    await expect(custody.verify()).resolves.toMatchObject({ status: 'verified' })
    await expect(custody.verify()).resolves.toMatchObject({ status: 'verified' })
    expect(globalThis[marker]).toBe('safe')
    expect(reads.bundleReads()).toBe(1)
    expect(reads.manifestReads()).toBe(1)
    delete globalThis[marker]
  })

  it.each([
    ['manifest schema', (manifest) => { manifest.schemaVersion = 'study-server-tutor-prebundle.v2' }],
    ['bundle filename', (manifest) => { manifest.bundle.file = '../server-tutor.mjs' }],
    ['second bundle digest', (manifest) => { manifest.hostContentMapping.bundleSha256 = '0'.repeat(64) }],
    ['mapping digest', (manifest) => { manifest.hostContentMapping.mappingSha256 = '0'.repeat(64) }],
    ['mapping version', (manifest) => { manifest.hostContentMapping.mappingVersion = 2 }],
    ['Academy pins', (manifest) => { manifest.hostContentMapping.academySourcePins.releaseVersion = '1.0.1' }],
    ['frozen pins', (manifest) => { manifest.hostContentMapping.frozenTutorPins.packageVersion = '1.0.3' }],
    ['extra manifest authority', (manifest) => { manifest.callerArtifactPath = '/tmp/replacement' }],
  ])('refuses %s tampering without diagnostics', async (_label, mutate) => {
    installReads(artifactPair({ manifestMutate: mutate }))
    await expect(createProductionServerTutorArtifactCustody().verify()).resolves.toEqual({
      status: 'mapping-integrity-failed',
    })
  })

  it.each([
    ['embedded mapping bytes', {
      mapping: (() => {
        const mapping = deepClone(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING)
        mapping.review.reviewedLessonCount = 17
        return mapping
      })(),
    }],
    ['embedded custody pins', {
      custodyMutate: (custody) => { custody.academySourcePins.releaseVersion = '1.0.1' },
    }],
    ['static capability schema', { staticSchema: 'study-server-tutor-static-capability.v2' }],
    ['missing static method', { omitMethod: 'deriveLearnerPseudonym' }],
    ['accessor static method', { accessorMethod: 'createRuntime' }],
    ['static lookup disagreement', { dishonestLookup: true }],
  ])('refuses %s disagreement after the bundle hash agrees', async (_label, sourceOptions) => {
    installReads(artifactPair({ sourceOptions }))
    await expect(createProductionServerTutorArtifactCustody().verify()).resolves.toEqual({
      status: 'mapping-integrity-failed',
    })
  })

  it('returns only server-unavailable when either fixed generated file cannot be read', async () => {
    readFileMock.mockRejectedValue(new Error('missing'))
    await expect(createProductionServerTutorArtifactCustody().verify()).resolves.toEqual({
      status: 'server-unavailable',
    })
  })
})

describe('explicit test artifact custody', () => {
  it('mints the same trusted wrapper and delegates the six supplied hooks', async () => {
    const hooks = {
      verifyAcademySourcePins: vi.fn((pins) => pins?.releaseVersion === 'future'),
      verifyFrozenTutorPins: vi.fn(() => true),
      resolveApprovedMapping: vi.fn((input) => ({ approved: input })),
      evaluateApprovedMapping: vi.fn((input) => ({ evaluated: input })),
      deriveLearnerPseudonym: vi.fn(async (input) => `pseudonym:${input}`),
      createRuntime: vi.fn((input) => ({ runtime: input })),
    }
    const custody = createTestServerTutorArtifactCustody(hooks)
    const result = await custody.verify()
    const capability = result.capability

    expect(result.status).toBe('verified')
    expect(isVerifiedServerTutorArtifactCapability(capability)).toBe(false)
    expect(isTestServerTutorArtifactCapability(capability)).toBe(true)
    expect(capability.verifyAcademySourcePins({ releaseVersion: 'future' })).toBe(true)
    expect(capability.verifyAcademySourcePins({ releaseVersion: 'stale' })).toBe(false)
    expect(capability.verifyFrozenTutorPins()).toBe(true)
    expect(capability.verifyFrozenTutorPins({ forged: true })).toBe(false)
    expect(capability.resolveApprovedMapping('operation')).toEqual({ approved: 'operation' })
    expect(capability.evaluateApprovedMapping('mapping')).toEqual({ evaluated: 'mapping' })
    await expect(capability.deriveLearnerPseudonym('session')).resolves.toBe('pseudonym:session')
    expect(capability.createRuntime('ports')).toEqual({ runtime: 'ports' })
    expect(hooks.verifyFrozenTutorPins).toHaveBeenCalledWith()
    expect(Object.keys(capability)).toHaveLength(6)
  })

  it('allows omitted test pin predicates but refuses missing operational hooks', async () => {
    const custody = createTestServerTutorArtifactCustody({
      resolveApprovedMapping: () => null,
      evaluateApprovedMapping: () => ({ eligible: false }),
      deriveLearnerPseudonym: async () => null,
      createRuntime: () => null,
    })
    const result = await custody.verify()
    expect(result.capability.verifyAcademySourcePins({ anything: true })).toBe(true)
    expect(result.capability.verifyFrozenTutorPins()).toBe(true)

    expect(() => createTestServerTutorArtifactCustody({})).toThrow(
      'test_server_tutor_artifact_hooks_required',
    )
  })
})

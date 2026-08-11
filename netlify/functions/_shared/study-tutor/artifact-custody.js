import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const SERVER_ARTIFACT_SCHEMA_VERSION = 'study-server-tutor-prebundle.v1'
const STATIC_CAPABILITY_SCHEMA_VERSION = 'study-server-tutor-static-capability.v1'
const EMBEDDED_MAPPING_SCHEMA_VERSION = ['study', 'tutor', 'host', 'mapping.v1'].join('-')
const EMBEDDED_MAPPING_ARTIFACT_PATH = [
  'src/study/server/',
  'tutor',
  'Host',
  'Mapping.v1.json',
].join('')
const EMBEDDED_MAPPING_ARTIFACT_KIND = 'production-reviewed'
const EMBEDDED_MAPPING_VERSION = 1
const EMBEDDED_MAPPING_COMPATIBILITY = 'no-approved-mapping-under-current-frozen-runtime'
const EMBEDDED_MAPPING_SHA256 =
  '8a8cd0df920f47a7741460b7bf8e3b21ffcc8653df282b3853e4e046d5aaa23d'
const EMBEDDED_MAPPING_RAW_FILE_SHA256 =
  'c02fca57f61aaf74b950da1f3f5845cd76b38dba83997269198cf02b864e613d'

const GENERATED_DIRECTORY = new URL('../../../build/generated/', import.meta.url)
const FIXED_BUNDLE_URL = new URL('server-tutor.mjs', GENERATED_DIRECTORY)
const FIXED_MANIFEST_URL = new URL('server-tutor.manifest.json', GENERATED_DIRECTORY)

const MANIFEST_KEYS = Object.freeze([
  'adapterContractVersion',
  'buildSourceSha',
  'bundle',
  'frozenPackage',
  'hostContentMapping',
  'runtime',
  'schemaVersion',
])
const RUNTIME_KEYS = Object.freeze(['moduleFormat', 'nodeTarget', 'platform'])
const FROZEN_PACKAGE_KEYS = Object.freeze([
  'checksumEntryCount',
  'checksumManifestSha256',
  'manifestVersion',
  'name',
  'packageVersion',
  'specifier',
])
const BUNDLE_KEYS = Object.freeze(['file', 'sha256'])
const MANIFEST_MAPPING_KEYS = Object.freeze([
  'academySourcePins',
  'artifactKind',
  'artifactPath',
  'bundleSha256',
  'compatibilityStatus',
  'frozenTutorPins',
  'mappingSha256',
  'mappingVersion',
  'rawFileSha256',
  'schemaVersion',
  'status',
])
const EMBEDDED_MAPPING_KEYS = Object.freeze([
  'academySourcePins',
  'approvedMappings',
  'artifactKind',
  'compatibilityStatus',
  'expectedAnswerBinding',
  'frozenTutorPins',
  'mappingVersion',
  'review',
  'reviewedLessons',
  'schemaVersion',
])
const EMBEDDED_CUSTODY_KEYS = Object.freeze([
  'academySourcePins',
  'artifactKind',
  'compatibilityStatus',
  'frozenTutorPins',
  'mappingSha256',
  'mappingVersion',
  'rawFileSha256',
  'schemaVersion',
])
const STATIC_CAPABILITY_KEYS = Object.freeze([
  'createRuntime',
  'deriveLearnerPseudonym',
  'evaluateApprovedMapping',
  'resolveApprovedMapping',
  'schemaVersion',
  'verifyAcademySourcePins',
  'verifyFrozenTutorPins',
])
const PUBLIC_CAPABILITY_METHODS = Object.freeze([
  'verifyAcademySourcePins',
  'verifyFrozenTutorPins',
  'resolveApprovedMapping',
  'evaluateApprovedMapping',
  'deriveLearnerPseudonym',
  'createRuntime',
])

const INTEGRITY_FAILED = Object.freeze({ status: 'mapping-integrity-failed' })
const UNAVAILABLE = Object.freeze({ status: 'server-unavailable' })
const VERIFIED_PRODUCTION_CAPABILITIES = new WeakSet()
const VERIFIED_TEST_CAPABILITIES = new WeakSet()

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function copyBytes(value) {
  if (!(value instanceof Uint8Array)) throw new TypeError('artifact_bytes_required')
  return Buffer.from(value)
}

function isPlainPrototype(value) {
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function dataDescriptors(value) {
  if (value === null || typeof value !== 'object') return null
  if (!isPlainPrototype(value)) return null
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  if (keys.some((key) => typeof key !== 'string')) return null
  for (const key of keys) {
    const descriptor = descriptors[key]
    if (
      !Object.hasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined
    ) return null
  }
  return descriptors
}

function hasExactDescriptorKeys(descriptors, expected) {
  if (descriptors === null) return false
  const keys = Reflect.ownKeys(descriptors)
  const wanted = [...expected].sort()
  return keys.length === wanted.length &&
    keys.every((key) => typeof key === 'string') &&
    keys.map(String).sort().every((key, index) => key === wanted[index])
}

function exactRecord(value, expected) {
  const descriptors = dataDescriptors(value)
  return hasExactDescriptorKeys(descriptors, expected) ? descriptors : null
}

function snapshotJsonTree(value, options = {}, state = { depth: 0, seen: new Set() }) {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non_finite_artifact_number')
    return value
  }
  if (typeof value !== 'object') throw new TypeError('non_json_artifact_value')
  if (state.depth > 32 || state.seen.has(value)) throw new TypeError('invalid_artifact_tree')
  if (options.requireFrozen === true && !Object.isFrozen(value)) {
    throw new TypeError('mutable_embedded_artifact')
  }

  const nextState = { depth: state.depth + 1, seen: new Set(state.seen).add(value) }
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError('nonplain_artifact_array')
    const descriptors = Object.getOwnPropertyDescriptors(value)
    const lengthDescriptor = descriptors.length
    const length = lengthDescriptor?.value
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Reflect.ownKeys(descriptors).some((key) => typeof key !== 'string') ||
      Reflect.ownKeys(descriptors).length !== length + 1
    ) throw new TypeError('sparse_or_extended_artifact_array')
    const snapshot = []
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)]
      if (
        descriptor === undefined ||
        !Object.hasOwn(descriptor, 'value') ||
        descriptor.enumerable !== true ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined
      ) throw new TypeError('accessor_artifact_array')
      snapshot.push(snapshotJsonTree(descriptor.value, options, nextState))
    }
    return snapshot
  }

  const descriptors = dataDescriptors(value)
  if (descriptors === null) throw new TypeError('nonplain_artifact_record')
  const snapshot = Object.create(null)
  for (const key of Object.keys(descriptors)) {
    snapshot[key] = snapshotJsonTree(descriptors[key].value, options, nextState)
  }
  return snapshot
}

function canonicalSerialize(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value.replace(/\r\n?/g, '\n'))
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('non_finite_canonical_number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalSerialize(value[key])}`).join(',')}}`
  }
  throw new TypeError('noncanonical_value')
}

function sameCanonical(left, right) {
  return canonicalSerialize(left) === canonicalSerialize(right)
}

function validSha256(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function validBuildSourceSha(value) {
  return value === null || (typeof value === 'string' && /^[0-9a-f]{40}$/.test(value))
}

function parseManifest(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const parsed = JSON.parse(text)
  return snapshotJsonTree(parsed)
}

function verifyManifest(manifest, actualBundleSha256) {
  const top = exactRecord(manifest, MANIFEST_KEYS)
  if (top === null || manifest.schemaVersion !== SERVER_ARTIFACT_SCHEMA_VERSION) return false

  const runtime = exactRecord(manifest.runtime, RUNTIME_KEYS)
  if (
    runtime === null ||
    manifest.runtime.platform !== 'node' ||
    manifest.runtime.nodeTarget !== 'node22' ||
    manifest.runtime.moduleFormat !== 'esm'
  ) return false

  const frozenPackage = exactRecord(manifest.frozenPackage, FROZEN_PACKAGE_KEYS)
  if (
    frozenPackage === null ||
    manifest.frozenPackage.specifier !== '@frozen/tutor-math-r1' ||
    manifest.frozenPackage.name !== '@manuel-academy/adaptive-tutor-math-content' ||
    manifest.frozenPackage.packageVersion !== '1.0.2' ||
    manifest.frozenPackage.manifestVersion !== '1.0.0' ||
    manifest.frozenPackage.checksumManifestSha256 !==
      'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee' ||
    manifest.frozenPackage.checksumEntryCount !== 91
  ) return false

  const bundle = exactRecord(manifest.bundle, BUNDLE_KEYS)
  if (
    bundle === null ||
    manifest.bundle.file !== 'server-tutor.mjs' ||
    !validSha256(manifest.bundle.sha256) ||
    manifest.bundle.sha256 !== actualBundleSha256
  ) return false

  const mapping = exactRecord(manifest.hostContentMapping, MANIFEST_MAPPING_KEYS)
  if (
    mapping === null ||
    manifest.hostContentMapping.status !== 'production-reviewed' ||
    manifest.hostContentMapping.artifactPath !== EMBEDDED_MAPPING_ARTIFACT_PATH ||
    manifest.hostContentMapping.schemaVersion !== EMBEDDED_MAPPING_SCHEMA_VERSION ||
    manifest.hostContentMapping.artifactKind !== EMBEDDED_MAPPING_ARTIFACT_KIND ||
    manifest.hostContentMapping.mappingVersion !== EMBEDDED_MAPPING_VERSION ||
    manifest.hostContentMapping.compatibilityStatus !== EMBEDDED_MAPPING_COMPATIBILITY ||
    manifest.hostContentMapping.mappingSha256 !== EMBEDDED_MAPPING_SHA256 ||
    manifest.hostContentMapping.rawFileSha256 !== EMBEDDED_MAPPING_RAW_FILE_SHA256 ||
    manifest.hostContentMapping.bundleSha256 !== actualBundleSha256 ||
    manifest.hostContentMapping.bundleSha256 !== manifest.bundle.sha256
  ) return false

  return manifest.adapterContractVersion === 'study-tutor.v1' &&
    validBuildSourceSha(manifest.buildSourceSha)
}

function moduleDataExport(namespace, name) {
  const descriptor = Object.getOwnPropertyDescriptor(namespace, name)
  if (
    descriptor === undefined ||
    !Object.hasOwn(descriptor, 'value') ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  ) throw new TypeError('missing_static_artifact_export')
  return descriptor.value
}

function verifyEmbeddedArtifacts(namespace, manifest) {
  const rawMapping = moduleDataExport(namespace, 'SERVER_TUTOR_HOST_CONTENT_MAPPING')
  const rawCustody = moduleDataExport(namespace, 'SERVER_TUTOR_HOST_CONTENT_MAPPING_CUSTODY')
  const rawCapability = moduleDataExport(namespace, 'SERVER_TUTOR_STATIC_CAPABILITY')

  const mapping = snapshotJsonTree(rawMapping, { requireFrozen: true })
  const custody = snapshotJsonTree(rawCustody, { requireFrozen: true })
  if (
    exactRecord(mapping, EMBEDDED_MAPPING_KEYS) === null ||
    mapping.schemaVersion !== EMBEDDED_MAPPING_SCHEMA_VERSION ||
    mapping.artifactKind !== EMBEDDED_MAPPING_ARTIFACT_KIND ||
    mapping.mappingVersion !== EMBEDDED_MAPPING_VERSION ||
    mapping.compatibilityStatus !== EMBEDDED_MAPPING_COMPATIBILITY ||
    !Array.isArray(mapping.approvedMappings) ||
    sha256(Buffer.from(canonicalSerialize(mapping), 'utf8')) !== EMBEDDED_MAPPING_SHA256
  ) throw new TypeError('embedded_mapping_integrity')

  if (
    exactRecord(custody, EMBEDDED_CUSTODY_KEYS) === null ||
    custody.schemaVersion !== EMBEDDED_MAPPING_SCHEMA_VERSION ||
    custody.artifactKind !== EMBEDDED_MAPPING_ARTIFACT_KIND ||
    custody.mappingVersion !== EMBEDDED_MAPPING_VERSION ||
    custody.compatibilityStatus !== EMBEDDED_MAPPING_COMPATIBILITY ||
    custody.mappingSha256 !== EMBEDDED_MAPPING_SHA256 ||
    custody.rawFileSha256 !== EMBEDDED_MAPPING_RAW_FILE_SHA256
  ) throw new TypeError('embedded_custody_integrity')

  const manifestMapping = manifest.hostContentMapping
  for (const pins of [
    [mapping.academySourcePins, custody.academySourcePins],
    [mapping.academySourcePins, manifestMapping.academySourcePins],
    [mapping.frozenTutorPins, custody.frozenTutorPins],
    [mapping.frozenTutorPins, manifestMapping.frozenTutorPins],
  ]) {
    if (!sameCanonical(pins[0], pins[1])) throw new TypeError('embedded_pin_disagreement')
  }

  const capabilityDescriptors = exactRecord(rawCapability, STATIC_CAPABILITY_KEYS)
  if (
    capabilityDescriptors === null ||
    !Object.isFrozen(rawCapability) ||
    capabilityDescriptors.schemaVersion.value !== STATIC_CAPABILITY_SCHEMA_VERSION
  ) throw new TypeError('static_capability_integrity')
  for (const method of PUBLIC_CAPABILITY_METHODS) {
    if (typeof capabilityDescriptors[method].value !== 'function') {
      throw new TypeError('static_capability_method_missing')
    }
  }

  const methods = Object.freeze(Object.fromEntries(
    PUBLIC_CAPABILITY_METHODS.map((method) => [method, capabilityDescriptors[method].value]),
  ))
  if (
    Reflect.apply(methods.verifyAcademySourcePins, rawCapability, [rawMapping.academySourcePins]) !== true ||
    Reflect.apply(methods.verifyFrozenTutorPins, rawCapability, [rawMapping.frozenTutorPins]) !== true
  ) throw new TypeError('static_capability_pin_disagreement')

  // The embedded mapping and the embedded lookup are one custodied artifact.
  // Prove their behavior agrees before any wrapper can be branded. Production
  // currently exercises all 18 lessons x 5 reviewed segments as exact nulls;
  // a future approved row must instead yield one opaque frozen selection.
  const reviewedLessons = mapping.reviewedLessons
  const reviewedSegments = mapping.review?.reviewedHostSegments
  if (!Array.isArray(reviewedLessons) || !Array.isArray(reviewedSegments)) {
    throw new TypeError('static_capability_census_missing')
  }
  for (const lesson of reviewedLessons) {
    for (const segment of reviewedSegments) {
      const input = Object.freeze({
        hostLessonRef: lesson.hostLessonRef,
        hostSegmentRef: `${lesson.hostLessonRef}:segment:${segment.suffix}`,
        taskType: segment.taskType,
      })
      const expected = mapping.approvedMappings.find((row) =>
        row.hostLessonRef === input.hostLessonRef &&
        row.hostSegmentRef === input.hostSegmentRef &&
        row.taskType === input.taskType)
      const selection = Reflect.apply(methods.resolveApprovedMapping, rawCapability, [input])
      if (expected === undefined) {
        if (selection !== null) throw new TypeError('static_capability_lookup_disagreement')
      } else if (
        selection === null ||
        typeof selection !== 'object' ||
        !Object.isFrozen(selection) ||
        Reflect.ownKeys(selection).length !== 0
      ) {
        throw new TypeError('static_capability_lookup_disagreement')
      }
    }
  }

  return { methods, receiver: rawCapability, privateFrozenPins: rawMapping.frozenTutorPins }
}

function mintPublicCapability({ methods, receiver, privateFrozenPins }, trustSet) {
  const capability = Object.freeze({
    verifyAcademySourcePins(candidate) {
      return Reflect.apply(methods.verifyAcademySourcePins, receiver, [candidate]) === true
    },
    verifyFrozenTutorPins(...unexpected) {
      if (unexpected.length !== 0) return false
      return Reflect.apply(methods.verifyFrozenTutorPins, receiver, [privateFrozenPins]) === true
    },
    resolveApprovedMapping(...args) {
      return Reflect.apply(methods.resolveApprovedMapping, receiver, args)
    },
    evaluateApprovedMapping(...args) {
      return Reflect.apply(methods.evaluateApprovedMapping, receiver, args)
    },
    deriveLearnerPseudonym(...args) {
      return Reflect.apply(methods.deriveLearnerPseudonym, receiver, args)
    },
    createRuntime(...args) {
      return Reflect.apply(methods.createRuntime, receiver, args)
    },
  })
  trustSet.add(capability)
  return capability
}

async function verifyFixedArtifacts() {
  let bundleBytes
  let manifestBytes
  try {
    const read = await Promise.all([
      readFile(FIXED_BUNDLE_URL),
      readFile(FIXED_MANIFEST_URL),
    ])
    bundleBytes = copyBytes(read[0])
    manifestBytes = copyBytes(read[1])
  } catch {
    return UNAVAILABLE
  }

  try {
    const actualBundleSha256 = sha256(bundleBytes)
    const manifest = parseManifest(manifestBytes)
    if (!verifyManifest(manifest, actualBundleSha256)) return INTEGRITY_FAILED

    const exactVerifiedBytesUrl = `data:text/javascript;base64,${bundleBytes.toString('base64')}`
    const namespace = await import(exactVerifiedBytesUrl)
    const source = verifyEmbeddedArtifacts(namespace, manifest)
    const capability = mintPublicCapability(source, VERIFIED_PRODUCTION_CAPABILITIES)
    return Object.freeze({ status: 'verified', capability })
  } catch {
    return INTEGRITY_FAILED
  }
}

function memoizedVerifier(run) {
  let settled
  return Object.freeze({
    verify(...unexpected) {
      if (unexpected.length !== 0) return Promise.resolve(INTEGRITY_FAILED)
      settled ??= Promise.resolve().then(run)
      return settled
    },
  })
}

/** Production reads exactly the two fixed generated artifacts and accepts no path. */
export function createProductionServerTutorArtifactCustody() {
  return memoizedVerifier(verifyFixedArtifacts)
}

/**
 * Explicit test composition. It mints the same non-transferable wrapper without
 * creating a path seam or making generated artifacts a test prerequisite.
 */
export function createTestServerTutorArtifactCustody({
  verifyAcademySourcePins = () => true,
  verifyFrozenTutorPins = () => true,
  resolveApprovedMapping,
  evaluateApprovedMapping,
  deriveLearnerPseudonym,
  createRuntime,
} = {}) {
  const hooks = {
    verifyAcademySourcePins,
    verifyFrozenTutorPins,
    resolveApprovedMapping,
    evaluateApprovedMapping,
    deriveLearnerPseudonym,
    createRuntime,
  }
  if (PUBLIC_CAPABILITY_METHODS.some((method) => typeof hooks[method] !== 'function')) {
    throw new TypeError('test_server_tutor_artifact_hooks_required')
  }

  const privateFrozenPins = Object.freeze(Object.create(null))
  const receiver = Object.freeze({
    schemaVersion: STATIC_CAPABILITY_SCHEMA_VERSION,
    verifyAcademySourcePins: hooks.verifyAcademySourcePins,
    verifyFrozenTutorPins: () => hooks.verifyFrozenTutorPins(),
    resolveApprovedMapping: hooks.resolveApprovedMapping,
    evaluateApprovedMapping: hooks.evaluateApprovedMapping,
    deriveLearnerPseudonym: hooks.deriveLearnerPseudonym,
    createRuntime: hooks.createRuntime,
  })
  const methods = Object.freeze(Object.fromEntries(
    PUBLIC_CAPABILITY_METHODS.map((method) => [method, receiver[method]]),
  ))
  const capability = mintPublicCapability(
    { methods, receiver, privateFrozenPins },
    VERIFIED_TEST_CAPABILITIES,
  )
  const result = Object.freeze({ status: 'verified', capability })
  return memoizedVerifier(() => result)
}

export function isVerifiedServerTutorArtifactCapability(capability) {
  return Boolean(
    capability &&
    typeof capability === 'object' &&
    VERIFIED_PRODUCTION_CAPABILITIES.has(capability),
  )
}

export function isTestServerTutorArtifactCapability(capability) {
  return Boolean(
    capability &&
    typeof capability === 'object' &&
    VERIFIED_TEST_CAPABILITIES.has(capability),
  )
}

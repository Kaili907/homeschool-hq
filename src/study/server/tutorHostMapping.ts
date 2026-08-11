/**
 * Server-only reviewed authority for Academy-to-Tutor host-content mapping.
 *
 * This module is intentionally outside every browser and production-route
 * import closure. It parses a source-controlled artifact; it does not enable a
 * route, select a default Tutor program, or accept learner/session authority.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const TUTOR_HOST_MAPPING_SCHEMA_VERSION = 'study-tutor-host-mapping.v1' as const
export const TUTOR_HOST_MAPPING_ARTIFACT_KIND = 'production-reviewed' as const
export const TUTOR_HOST_MAPPING_VERSION = 1 as const

export const TUTOR_HOST_COMPATIBILITY_STATUSES = Object.freeze([
  'approved',
  'no-approved-mapping-under-current-frozen-runtime',
] as const)

export type TutorHostCompatibilityStatus =
  (typeof TUTOR_HOST_COMPATIBILITY_STATUSES)[number]

export const TUTOR_HOST_EXCLUSION_REASON_CODES = Object.freeze([
  'frozen-runtime-not-concept-addressable',
  'no-exact-tutor-capability',
] as const)

export type TutorHostExclusionReasonCode =
  (typeof TUTOR_HOST_EXCLUSION_REASON_CODES)[number]

export const ACADEMY_SOURCE_PINS = Object.freeze({
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  manifestSha256: '38e6f27c24ec5371e4647364c088984fa0e1dbe25e1312847108a6d56d7404be',
  courseId: 'ma-g5-mathematics',
  unitId: 'ma-g5-mathematics-u05',
  manifestSourceReference: 'curriculum-content/manuel-academy/1.0.0/MANIFEST.json',
  unitSourceReference: 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/units.json#ma-g5-mathematics-u05',
  lessonSourceReference: 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/lessons.jsonl',
  sequenceSourceReference: 'curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/mathematics/lesson-sequence.md#unit-5-adding-and-subtracting-fractions',
})

export const REVIEWED_HOST_SEGMENTS = Object.freeze([
  { suffix: 'retrieve', taskType: 'retrieval-practice', tutorPhase: 'reassess' },
  { suffix: 'teach', taskType: 'direct-instruction', tutorPhase: 'teach-visually' },
  { suffix: 'guide', taskType: 'guided-practice', tutorPhase: 'guided-practice' },
  { suffix: 'try', taskType: 'independent-practice', tutorPhase: 'independent-attempt' },
  { suffix: 'check', taskType: 'mastery-check', tutorPhase: 'independent-attempt' },
] as const)

export type ReviewedHostTaskType = (typeof REVIEWED_HOST_SEGMENTS)[number]['taskType']
export type ReviewedTutorPhase = (typeof REVIEWED_HOST_SEGMENTS)[number]['tutorPhase']

export const ACADEMY_GRADE5_MATH_UNIT5_CENSUS = Object.freeze([
  { hostLessonRef: 'ma-g5-mathematics-u05-l01', courseDay: 73, hostPhase: 'Launch and diagnostic', hostFocus: 'fraction equivalence', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l02', courseDay: 74, hostPhase: 'Concept model A', hostFocus: 'benchmark fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l03', courseDay: 75, hostPhase: 'Guided practice A', hostFocus: 'common denominators', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l04', courseDay: 76, hostPhase: 'Independent application A', hostFocus: 'adding unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l05', courseDay: 77, hostPhase: 'Concept model B', hostFocus: 'subtracting unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l06', courseDay: 78, hostPhase: 'Guided practice B', hostFocus: 'mixed-number problem solving', exclusionScope: 'all-reviewed-segments', reasonCode: 'no-exact-tutor-capability' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l07', courseDay: 79, hostPhase: 'Investigation or close reading', hostFocus: 'fraction equivalence', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l08', courseDay: 80, hostPhase: 'Reteach and varied practice', hostFocus: 'benchmark fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l09', courseDay: 81, hostPhase: 'Concept model C', hostFocus: 'common denominators', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l10', courseDay: 82, hostPhase: 'Discussion or problem seminar', hostFocus: 'adding unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l11', courseDay: 83, hostPhase: 'Performance task planning', hostFocus: 'subtracting unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l12', courseDay: 84, hostPhase: 'Performance task build', hostFocus: 'mixed-number problem solving', exclusionScope: 'all-reviewed-segments', reasonCode: 'no-exact-tutor-capability' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l13', courseDay: 85, hostPhase: 'Skill consolidation', hostFocus: 'fraction equivalence', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l14', courseDay: 86, hostPhase: 'Transfer challenge', hostFocus: 'benchmark fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l15', courseDay: 87, hostPhase: 'Assessment preparation', hostFocus: 'common denominators', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l16', courseDay: 88, hostPhase: 'Unit assessment', hostFocus: 'adding unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l17', courseDay: 89, hostPhase: 'Targeted correction', hostFocus: 'subtracting unlike fractions', exclusionScope: 'all-reviewed-segments', reasonCode: 'frozen-runtime-not-concept-addressable' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l18', courseDay: 90, hostPhase: 'Publication, presentation, or reflection', hostFocus: 'mixed-number problem solving', exclusionScope: 'all-reviewed-segments', reasonCode: 'no-exact-tutor-capability' },
] as const satisfies readonly {
  readonly hostLessonRef: string
  readonly courseDay: number
  readonly hostPhase: string
  readonly hostFocus: string
  readonly exclusionScope: 'all-reviewed-segments'
  readonly reasonCode: TutorHostExclusionReasonCode
}[])

export const FROZEN_TUTOR_SOURCE_PINS = Object.freeze({
  packageName: '@manuel-academy/adaptive-tutor-math-content',
  packageVersion: '1.0.2',
  manifestVersion: '1.0.0',
  sha256SumsDigest: 'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee',
  manifestSha256: 'c3814f08d4337f9d5bd8ab5c25b281c88a4cb3e49ff621fe178323bf907be0d7',
  sequenceSha256: '844cd8d3934425268728299aa9a18e5f9b37c05e639dd5b12404ebddea2e20e5',
  adapterSha256: 'd5bbc79d635486c4f617d09e5fc2ca6871853efd01116fa228a678997ea32eac',
  engineSha256: '7b664ee1be7417becefa443c93c678d33f4e619849d08982a928867a13a10fc5',
  manifestSourceReference: 'adaptive-tutor/subjects/math/manifest.json',
  checksumSourceReference: 'adaptive-tutor/subjects/math/SHA256SUMS.txt',
  sequenceSourceReference: 'adaptive-tutor/subjects/math/lessons/03-equivalent-fractions-and-common-denominators/sequence.json',
  adapterSourceReference: 'adaptive-tutor/subjects/math/core-v0.2-adapter.ts',
  engineSourceReference: 'adaptive-tutor/core/engine/adaptive-tutor-engine.ts',
  declaredMetadata: Object.freeze({
    sequenceRoutingId: 'math-seq-equivalent-fractions-v1',
    lessonId: 'math-lesson-03-equivalent-fractions-common-denominators',
    declaredSkillIds: Object.freeze([
      'math-skill-fr-equivalence-v1',
      'math-skill-fr-common-denominator-v1',
      'math-skill-fr-add-sub-v1',
      'math-skill-fr-compare-v1',
    ] as const),
  }),
  effectiveExecutableRoutingAuthority: Object.freeze({
    conceptAddressable: false,
    programTargetSkillId: 'math-skill-fr-equivalence-v1',
    adaptedRuntimeItemSkillIds: Object.freeze(['math-skill-fr-equivalence-v1'] as const),
    phaseItemSelection: 'sequential-array-index',
    phaseItemRefs: Object.freeze({
      assessment: Object.freeze([
        'math-fr-d01', 'math-fr-d02', 'math-fr-d03',
        'math-fr-d04', 'math-fr-d05', 'math-fr-d06',
      ] as const),
      guidedPractice: Object.freeze([
        'math-fr-g01', 'math-fr-g02', 'math-fr-g03',
        'math-fr-g04', 'math-fr-g05', 'math-fr-g06',
      ] as const),
      independentAttempt: Object.freeze([
        'math-fr-m01', 'math-fr-m02', 'math-fr-m03',
        'math-fr-m04', 'math-fr-m05', 'math-fr-m06',
      ] as const),
      reassess: Object.freeze([
        'math-fr-m01-reassess', 'math-fr-m02-reassess', 'math-fr-m03-reassess',
        'math-fr-m04-reassess', 'math-fr-m05-reassess', 'math-fr-m06-reassess',
      ] as const),
    }),
    selectableTeachingTurnRefs: Object.freeze([
      'math-seq-equivalent-fractions-v1-teach-1',
      'math-seq-equivalent-fractions-v1-teach-2',
      'math-seq-equivalent-fractions-v1-teach-3',
      'math-seq-equivalent-fractions-v1-teach-4',
      'math-seq-equivalent-fractions-v1-teach-5',
      'math-seq-equivalent-fractions-v1-teach-6',
      'math-seq-equivalent-fractions-v1-teach-7',
    ] as const),
  }),
})

export const TUTOR_HOST_MAPPING_REVIEW = Object.freeze({
  compatibilityRule: 'every-selectable-runtime-item-must-fit-reviewed-host-segment-scope',
  reviewedLessonCount: 18,
  reviewedHostSegments: REVIEWED_HOST_SEGMENTS,
})

export const EXPECTED_ANSWER_BINDING_REVIEW = Object.freeze({
  status: 'deferred-honestly',
})

export interface ApprovedTutorHostMapping {
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly taskType: ReviewedHostTaskType
  readonly tutorPhase: ReviewedTutorPhase
  readonly programRef: string
  /** Must enumerate the complete selectable runtime scope for `tutorPhase`. */
  readonly reviewedRuntimeItemRefs: readonly string[]
}

export interface TutorHostMappingArtifact {
  readonly schemaVersion: typeof TUTOR_HOST_MAPPING_SCHEMA_VERSION
  readonly artifactKind: typeof TUTOR_HOST_MAPPING_ARTIFACT_KIND
  readonly mappingVersion: typeof TUTOR_HOST_MAPPING_VERSION
  readonly compatibilityStatus: TutorHostCompatibilityStatus
  readonly academySourcePins: typeof ACADEMY_SOURCE_PINS
  readonly frozenTutorPins: typeof FROZEN_TUTOR_SOURCE_PINS
  readonly review: typeof TUTOR_HOST_MAPPING_REVIEW
  readonly reviewedLessons: typeof ACADEMY_GRADE5_MATH_UNIT5_CENSUS
  readonly approvedMappings: readonly ApprovedTutorHostMapping[]
  readonly expectedAnswerBinding: typeof EXPECTED_ANSWER_BINDING_REVIEW
}

const ARTIFACT_KEYS = Object.freeze([
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
] as const)

const APPROVED_MAPPING_KEYS = Object.freeze([
  'hostLessonRef',
  'hostSegmentRef',
  'programRef',
  'reviewedRuntimeItemRefs',
  'taskType',
  'tutorPhase',
] as const)

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Reflect.ownKeys(value)
  const sortedExpected = [...expected].sort()
  return keys.every((key): key is string => typeof key === 'string') &&
    keys.length === expected.length &&
    [...keys].sort().every((key, index) => key === sortedExpected[index])
}

function isSafeRef(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REF.test(value)
}

function sameCanonical(left: unknown, right: unknown): boolean {
  return canonicalSerialize(left) === canonicalSerialize(right)
}

function runtimeScopeFor(phase: ReviewedTutorPhase): readonly string[] {
  const authority = FROZEN_TUTOR_SOURCE_PINS.effectiveExecutableRoutingAuthority
  if (phase === 'teach-visually') return authority.selectableTeachingTurnRefs
  if (phase === 'guided-practice') return authority.phaseItemRefs.guidedPractice
  if (phase === 'independent-attempt') return authority.phaseItemRefs.independentAttempt
  return authority.phaseItemRefs.reassess
}

function parseApprovedMapping(value: unknown): ApprovedTutorHostMapping | null {
  if (!isRecord(value) || !hasExactKeys(value, APPROVED_MAPPING_KEYS)) return null
  if (
    !isSafeRef(value.hostLessonRef) ||
    !isSafeRef(value.hostSegmentRef) ||
    !isSafeRef(value.programRef) ||
    !Array.isArray(value.reviewedRuntimeItemRefs) ||
    !value.reviewedRuntimeItemRefs.every(isSafeRef)
  ) return null

  const lesson = ACADEMY_GRADE5_MATH_UNIT5_CENSUS.find(
    (candidate) => candidate.hostLessonRef === value.hostLessonRef,
  )
  const segment = REVIEWED_HOST_SEGMENTS.find(
    (candidate) => `${value.hostLessonRef}:segment:${candidate.suffix}` === value.hostSegmentRef,
  )
  if (
    lesson === undefined ||
    segment === undefined ||
    value.taskType !== segment.taskType ||
    value.tutorPhase !== segment.tutorPhase ||
    value.programRef !== FROZEN_TUTOR_SOURCE_PINS.declaredMetadata.sequenceRoutingId
  ) return null

  const completeRuntimeScope = runtimeScopeFor(segment.tutorPhase)
  if (!sameCanonical(value.reviewedRuntimeItemRefs, completeRuntimeScope)) return null

  return value as unknown as ApprovedTutorHostMapping
}

function mappingKey(mapping: ApprovedTutorHostMapping): string {
  return `${mapping.hostLessonRef}\u0000${mapping.hostSegmentRef}`
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

/**
 * Exact runtime parser. Unknown fields, stale pins, partial runtime scopes,
 * duplicate keys, and an approval inconsistent with the frozen executable
 * authority are refusals.
 */
export function parseTutorHostMappingArtifact(raw: unknown): TutorHostMappingArtifact | null {
  try {
    if (!isRecord(raw) || !hasExactKeys(raw, ARTIFACT_KEYS)) return null
    if (
      raw.schemaVersion !== TUTOR_HOST_MAPPING_SCHEMA_VERSION ||
      raw.artifactKind !== TUTOR_HOST_MAPPING_ARTIFACT_KIND ||
      raw.mappingVersion !== TUTOR_HOST_MAPPING_VERSION ||
      !TUTOR_HOST_COMPATIBILITY_STATUSES.includes(raw.compatibilityStatus as TutorHostCompatibilityStatus) ||
      !sameCanonical(raw.academySourcePins, ACADEMY_SOURCE_PINS) ||
      !sameCanonical(raw.frozenTutorPins, FROZEN_TUTOR_SOURCE_PINS) ||
      !sameCanonical(raw.review, TUTOR_HOST_MAPPING_REVIEW) ||
      !sameCanonical(raw.reviewedLessons, ACADEMY_GRADE5_MATH_UNIT5_CENSUS) ||
      !sameCanonical(raw.expectedAnswerBinding, EXPECTED_ANSWER_BINDING_REVIEW) ||
      !Array.isArray(raw.approvedMappings)
    ) return null

    const mappings = raw.approvedMappings.map(parseApprovedMapping)
    if (mappings.some((mapping) => mapping === null)) return null
    const approvedMappings = mappings as ApprovedTutorHostMapping[]
    const keys = approvedMappings.map(mappingKey)
    if (new Set(keys).size !== keys.length) return null

    const conceptAddressable =
      FROZEN_TUTOR_SOURCE_PINS.effectiveExecutableRoutingAuthority.conceptAddressable
    if (!conceptAddressable) {
      if (
        raw.compatibilityStatus !== 'no-approved-mapping-under-current-frozen-runtime' ||
        approvedMappings.length !== 0
      ) return null
    } else if (
      raw.compatibilityStatus !== 'approved' ||
      approvedMappings.length === 0
    ) return null

    approvedMappings.sort((left, right) => mappingKey(left).localeCompare(mappingKey(right)))
    return deepFreeze({
      ...raw,
      approvedMappings,
    } as unknown as TutorHostMappingArtifact)
  } catch {
    return null
  }
}

/** Sorted object keys, compact JSON, and normalized text newlines. */
export function canonicalSerialize(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value.replace(/\r\n?/g, '\n'))
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical serialization rejects non-finite numbers.')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSerialize).join(',')}]`
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => {
      if (record[key] === undefined) {
        throw new TypeError(`Canonical serialization rejects undefined at ${key}.`)
      }
      return `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`
    }).join(',')}}`
  }
  throw new TypeError(`Canonical serialization does not support ${typeof value}.`)
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex')
}

const artifactUrl = new URL('./tutorHostMapping.v1.json', import.meta.url)
const digestUrl = new URL('./tutorHostMapping.v1.sha256', import.meta.url)

export function loadTutorHostMappingArtifact(): TutorHostMappingArtifact {
  const rawText = readFileSync(fileURLToPath(artifactUrl), 'utf8')
  const normalizedText = rawText.replace(/\r\n?/g, '\n')
  const parsedJson: unknown = JSON.parse(normalizedText)
  const artifact = parseTutorHostMappingArtifact(parsedJson)
  if (artifact === null) throw new Error('Tutor host mapping artifact failed exact production parsing.')

  const canonical = canonicalSerialize(artifact)
  if (normalizedText !== `${canonical}\n`) {
    throw new Error('Tutor host mapping artifact is not canonical JSON.')
  }

  const expectedDigest = readFileSync(fileURLToPath(digestUrl), 'utf8').trim()
  const actualDigest = canonicalSha256(artifact)
  if (expectedDigest !== actualDigest) {
    throw new Error('Tutor host mapping artifact digest does not match its source-controlled pin.')
  }
  return artifact
}

export const PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING = loadTutorHostMappingArtifact()
export const TUTOR_HOST_MAPPING_CANONICAL_JSON = canonicalSerialize(
  PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING,
)
export const TUTOR_HOST_MAPPING_SHA256 = canonicalSha256(
  PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING,
)

export interface TutorHostMappingLookup {
  readonly academyPackageId: string
  readonly academyReleaseVersion: string
  readonly academyManifestSha256: string
  readonly frozenPackageName: string
  readonly frozenPackageVersion: string
  readonly frozenSha256SumsDigest: string
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly taskType: string
}

/** Exact lookup only. Missing, stale, unknown, and mismatched input is ineligible. */
export function resolveApprovedTutorHostMapping(
  input: TutorHostMappingLookup,
): ApprovedTutorHostMapping | null {
  if (
    input.academyPackageId !== ACADEMY_SOURCE_PINS.packageId ||
    input.academyReleaseVersion !== ACADEMY_SOURCE_PINS.releaseVersion ||
    input.academyManifestSha256 !== ACADEMY_SOURCE_PINS.manifestSha256 ||
    input.frozenPackageName !== FROZEN_TUTOR_SOURCE_PINS.packageName ||
    input.frozenPackageVersion !== FROZEN_TUTOR_SOURCE_PINS.packageVersion ||
    input.frozenSha256SumsDigest !== FROZEN_TUTOR_SOURCE_PINS.sha256SumsDigest
  ) return null

  return PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING.approvedMappings.find((mapping) =>
    mapping.hostLessonRef === input.hostLessonRef &&
    mapping.hostSegmentRef === input.hostSegmentRef &&
    mapping.taskType === input.taskType,
  ) ?? null
}

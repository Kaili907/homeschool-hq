import { createHash } from 'node:crypto'
import {
  ACADEMY_CONTENT_CUSTODY,
  ACADEMY_GRADE5_MATH_UNIT5_LESSONS,
  APPROVED_TUTOR_CONTENT_MAPPINGS,
  FROZEN_TUTOR_CONTENT_CUSTODY,
  REVIEWED_MATH_SEGMENTS,
  TUTOR_CONTENT_MAPPING_VERSION,
  type ApprovedTutorContentMapping,
} from './tutorContentMapping.data'
import type { CanonicalStudyTaskType } from '../types'

export * from './tutorContentMapping.data'

const taskPhase = new Map<CanonicalStudyTaskType, ApprovedTutorContentMapping['tutorPhase']>(
  REVIEWED_MATH_SEGMENTS.map((segment) => [segment.taskType, segment.tutorPhase]),
)
const frozenSkills = new Set<string>(FROZEN_TUTOR_CONTENT_CUSTODY.skillRefs)

function mappingKey(row: Pick<ApprovedTutorContentMapping, 'hostLessonRef' | 'hostSegmentRef'>): string {
  return `${row.hostLessonRef}\u0000${row.hostSegmentRef}`
}

function compareMappingRows(left: ApprovedTutorContentMapping, right: ApprovedTutorContentMapping): number {
  const leftKey = mappingKey(left)
  const rightKey = mappingKey(right)
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0
}

function assertCanonicalRow(row: ApprovedTutorContentMapping): void {
  if (
    row.mappingVersion !== TUTOR_CONTENT_MAPPING_VERSION ||
    row.academyPackageId !== ACADEMY_CONTENT_CUSTODY.packageId ||
    row.academyReleaseVersion !== ACADEMY_CONTENT_CUSTODY.releaseVersion ||
    row.academyManifestSha256 !== ACADEMY_CONTENT_CUSTODY.manifestSha256 ||
    row.academyCourseId !== ACADEMY_CONTENT_CUSTODY.courseId ||
    row.academyUnitId !== ACADEMY_CONTENT_CUSTODY.unitId
  ) throw new Error(`Stale Academy custody pin for ${row.hostLessonRef}.`)

  if (
    row.frozenPackageName !== FROZEN_TUTOR_CONTENT_CUSTODY.packageName ||
    row.frozenPackageVersion !== FROZEN_TUTOR_CONTENT_CUSTODY.packageVersion ||
    row.frozenManifestVersion !== FROZEN_TUTOR_CONTENT_CUSTODY.manifestVersion ||
    row.frozenSha256SumsDigest !== FROZEN_TUTOR_CONTENT_CUSTODY.sha256SumsDigest ||
    row.programRef !== FROZEN_TUTOR_CONTENT_CUSTODY.programRef ||
    row.canonicalTutorRoutingId !== FROZEN_TUTOR_CONTENT_CUSTODY.sequenceRoutingId
  ) throw new Error(`Stale frozen Tutor custody pin for ${row.hostLessonRef}.`)

  if (row.status !== 'approved') throw new Error(`Unapproved mapping row for ${row.hostLessonRef}.`)
  if (row.skillRefs.length !== 1 || !frozenSkills.has(row.skillRefs[0])) {
    throw new Error(`Unknown or ambiguous Tutor skill for ${row.hostLessonRef}.`)
  }

  const lesson = ACADEMY_GRADE5_MATH_UNIT5_LESSONS.find(
    (candidate) => candidate.hostLessonRef === row.hostLessonRef,
  )
  if (lesson?.mappingStatus !== 'approved' || lesson.tutorSkillRef === null) {
    throw new Error(`Unknown or static-only Academy lesson ${row.hostLessonRef}.`)
  }
  const segment = REVIEWED_MATH_SEGMENTS.find(
    (candidate) => `${row.hostLessonRef}:segment:${candidate.suffix}` === row.hostSegmentRef,
  )
  if (
    segment === undefined ||
    row.hostSourceReference !== `${ACADEMY_CONTENT_CUSTODY.lessonSourceReference}#${row.hostLessonRef}` ||
    row.hostSubject !== 'mathematics' ||
    row.hostPhase !== lesson.hostPhase ||
    row.hostConcept !== lesson.hostConcept ||
    row.taskType !== segment.taskType ||
    row.tutorSubject !== 'math' ||
    row.tutorPhase !== segment.tutorPhase ||
    row.skillRefs[0] !== lesson.tutorSkillRef ||
    row.tutorSourceReference !== FROZEN_TUTOR_CONTENT_CUSTODY.sequenceSourceReference ||
    row.tutorGradeBand.minimum !== FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand.minimum ||
    row.tutorGradeBand.maximum !== FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand.maximum ||
    row.tutorGradeBand.primary.join(',') !== FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand.primary.join(',') ||
    row.adapterContractVersion !== 1 ||
    row.tutorContractVersion !== 'study-tutor.v1'
  ) throw new Error(`Unreviewed Academy/Tutor compatibility metadata for ${row.hostSegmentRef}.`)

  if (taskPhase.get(row.taskType) !== row.tutorPhase) {
    throw new Error(`Unsupported task/phase mapping for ${row.hostSegmentRef}.`)
  }
}

/** Build-time authority validation. Duplicate, ambiguous, unknown, or stale rows throw. */
export function validateTutorContentMapping(
  rows: readonly ApprovedTutorContentMapping[],
): readonly ApprovedTutorContentMapping[] {
  const seen = new Set<string>()
  for (const row of rows) {
    assertCanonicalRow(row)
    const key = mappingKey(row)
    if (seen.has(key)) throw new Error(`Duplicate Tutor content mapping for ${row.hostSegmentRef}.`)
    seen.add(key)
  }

  const supportedLessons = ACADEMY_GRADE5_MATH_UNIT5_LESSONS.filter((lesson) => lesson.mappingStatus === 'approved')
  const expectedCount = supportedLessons.length * REVIEWED_MATH_SEGMENTS.length
  if (rows.length !== expectedCount) {
    throw new Error(`Incomplete Tutor content mapping: expected ${expectedCount} rows, received ${rows.length}.`)
  }

  return Object.freeze([...rows].sort(compareMappingRows))
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
      if (record[key] === undefined) throw new TypeError(`Canonical serialization rejects undefined at ${key}.`)
      return `${JSON.stringify(key)}:${canonicalSerialize(record[key])}`
    }).join(',')}}`
  }
  throw new TypeError(`Canonical serialization does not support ${typeof value}.`)
}

export function canonicalSha256(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex')
}

export const VALIDATED_TUTOR_CONTENT_MAPPINGS = validateTutorContentMapping(APPROVED_TUTOR_CONTENT_MAPPINGS)

export const TUTOR_CONTENT_MAPPING_CANONICAL_SERIALIZATION = canonicalSerialize({
  mappingVersion: TUTOR_CONTENT_MAPPING_VERSION,
  records: VALIDATED_TUTOR_CONTENT_MAPPINGS,
})

export const TUTOR_CONTENT_MAPPING_SHA256 = createHash('sha256')
  .update(TUTOR_CONTENT_MAPPING_CANONICAL_SERIALIZATION, 'utf8')
  .digest('hex')

const mappingIndex = new Map(VALIDATED_TUTOR_CONTENT_MAPPINGS.map((row) => [mappingKey(row), row]))

export interface TutorContentMappingLookup {
  readonly academyPackageId: string
  readonly academyReleaseVersion: string
  readonly academyManifestSha256: string
  readonly frozenPackageName: string
  readonly frozenPackageVersion: string
  readonly frozenManifestVersion: string
  readonly frozenSha256SumsDigest: string
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly taskType: string
}

/** Exact lookup only. Missing, stale, unknown, or mismatched input is ineligible. */
export function resolveApprovedTutorContentMapping(
  input: TutorContentMappingLookup,
): ApprovedTutorContentMapping | null {
  if (
    input.academyPackageId !== ACADEMY_CONTENT_CUSTODY.packageId ||
    input.academyReleaseVersion !== ACADEMY_CONTENT_CUSTODY.releaseVersion ||
    input.academyManifestSha256 !== ACADEMY_CONTENT_CUSTODY.manifestSha256 ||
    input.frozenPackageName !== FROZEN_TUTOR_CONTENT_CUSTODY.packageName ||
    input.frozenPackageVersion !== FROZEN_TUTOR_CONTENT_CUSTODY.packageVersion ||
    input.frozenManifestVersion !== FROZEN_TUTOR_CONTENT_CUSTODY.manifestVersion ||
    input.frozenSha256SumsDigest !== FROZEN_TUTOR_CONTENT_CUSTODY.sha256SumsDigest
  ) return null

  const row = mappingIndex.get(mappingKey(input))
  return row?.taskType === input.taskType ? row : null
}

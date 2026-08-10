import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BRIDGE_CONTRACT_VERSION,
  mapStudyTaskToTutorPhase,
} from '../../../adaptive-tutor/study-engine/bridges/tutor-core/src/index.ts'
import { adaptHostLessonToStudyPlan } from '../curriculumAdapter'
import { STUDY_TUTOR_CONTRACT_VERSION } from '../contracts/tutor/runtime'
import {
  ACADEMY_CONTENT_CUSTODY,
  ACADEMY_GRADE5_MATH_UNIT5_LESSONS,
  APPROVED_TUTOR_CONTENT_MAPPINGS,
  EXPECTED_ANSWER_BINDING_REVIEW,
  FROZEN_TUTOR_CONTENT_CUSTODY,
  REVIEWED_MATH_SEGMENTS,
  TUTOR_CONTENT_MAPPING_CANONICAL_SERIALIZATION,
  TUTOR_CONTENT_MAPPING_SHA256,
  TUTOR_CONTENT_MAPPING_VERSION,
  VALIDATED_TUTOR_CONTENT_MAPPINGS,
  canonicalSerialize,
  canonicalSha256,
  resolveApprovedTutorContentMapping,
  validateTutorContentMapping,
  type ApprovedTutorContentMapping,
  type TutorContentMappingLookup,
} from './tutorContentMapping'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')

function text(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(resolve(repoRoot, path))).digest('hex')
}

function lookup(
  row: ApprovedTutorContentMapping = VALIDATED_TUTOR_CONTENT_MAPPINGS[0]!,
  overrides: Partial<TutorContentMappingLookup> = {},
): TutorContentMappingLookup {
  return {
    academyPackageId: row.academyPackageId,
    academyReleaseVersion: row.academyReleaseVersion,
    academyManifestSha256: row.academyManifestSha256,
    frozenPackageName: row.frozenPackageName,
    frozenPackageVersion: row.frozenPackageVersion,
    frozenManifestVersion: row.frozenManifestVersion,
    frozenSha256SumsDigest: row.frozenSha256SumsDigest,
    hostLessonRef: row.hostLessonRef,
    hostSegmentRef: row.hostSegmentRef,
    taskType: row.taskType,
    ...overrides,
  }
}

describe('authoritative Academy Grade 5 Mathematics Unit 5 census', () => {
  const academyLessons = text(ACADEMY_CONTENT_CUSTODY.lessonSourceReference)
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as {
      lesson_id: string
      course_id: string
      course_day: number
      unit_number: number
      subject: string
      phase: string
      focus: string
      lesson_flow: readonly { segment: string }[]
    })
    .filter((lesson) => lesson.unit_number === 5)

  it('pins the real package manifest and all 18 exact lesson records', () => {
    const manifest = JSON.parse(text(ACADEMY_CONTENT_CUSTODY.manifestSourceReference)) as {
      package_id: string
      version: string
    }
    expect(manifest).toMatchObject({
      package_id: ACADEMY_CONTENT_CUSTODY.packageId,
      version: ACADEMY_CONTENT_CUSTODY.releaseVersion,
    })
    expect(sha256(ACADEMY_CONTENT_CUSTODY.manifestSourceReference)).toBe(ACADEMY_CONTENT_CUSTODY.manifestSha256)
    expect(academyLessons).toHaveLength(18)
    expect(ACADEMY_GRADE5_MATH_UNIT5_LESSONS).toHaveLength(18)
    expect(academyLessons.map((lesson) => lesson.lesson_id)).toEqual(
      ACADEMY_GRADE5_MATH_UNIT5_LESSONS.map((lesson) => lesson.hostLessonRef),
    )
    for (const census of ACADEMY_GRADE5_MATH_UNIT5_LESSONS) {
      const source = academyLessons.find((lesson) => lesson.lesson_id === census.hostLessonRef)
      expect(source).toMatchObject({
        course_id: ACADEMY_CONTENT_CUSTODY.courseId,
        course_day: census.courseDay,
        unit_number: 5,
        subject: 'mathematics',
        phase: census.hostPhase,
        focus: census.hostConcept,
      })
      expect(source?.lesson_flow.map((segment) => segment.segment)).toEqual([
        'Welcome and retrieval',
        'Model or mini-lesson',
        'Guided practice',
        'Independent application',
        'Exit ticket and next step',
      ])
    }
  })

  it('preserves the reviewed semantic grouping and leaves L06/L12/L18 static-only', () => {
    const expectedSkillForConcept = new Map([
      ['fraction equivalence', 'math-skill-fr-equivalence-v1'],
      ['benchmark fractions', 'math-skill-fr-compare-v1'],
      ['common denominators', 'math-skill-fr-common-denominator-v1'],
      ['adding unlike fractions', 'math-skill-fr-add-sub-v1'],
      ['subtracting unlike fractions', 'math-skill-fr-add-sub-v1'],
      ['mixed-number problem solving', null],
    ])
    for (const lesson of ACADEMY_GRADE5_MATH_UNIT5_LESSONS) {
      expect(lesson.tutorSkillRef).toBe(expectedSkillForConcept.get(lesson.hostConcept))
    }
    expect(ACADEMY_GRADE5_MATH_UNIT5_LESSONS.filter((lesson) => lesson.mappingStatus === 'static-only')
      .map((lesson) => lesson.hostLessonRef)).toEqual([
        'ma-g5-mathematics-u05-l06',
        'ma-g5-mathematics-u05-l12',
        'ma-g5-mathematics-u05-l18',
      ])
  })
})

describe('frozen Tutor census and segment compatibility', () => {
  it('pins the frozen package, manifest, checksums, routing ID, skills, and grade band', () => {
    const packageJson = JSON.parse(text('adaptive-tutor/subjects/math/package.json')) as { name: string; version: string }
    const manifest = JSON.parse(text(FROZEN_TUTOR_CONTENT_CUSTODY.manifestSourceReference)) as {
      version: string
      gradeBand: { minimum: number; maximum: number }
      sequenceIds: readonly string[]
    }
    const sequence = JSON.parse(text(FROZEN_TUTOR_CONTENT_CUSTODY.sequenceSourceReference)) as {
      version: string
      sequenceId: string
      lessonId: string
      skillIds: readonly string[]
      gradeBand: { minimum: number; maximum: number; primary: readonly number[] }
    }
    expect(packageJson).toMatchObject({
      name: FROZEN_TUTOR_CONTENT_CUSTODY.packageName,
      version: FROZEN_TUTOR_CONTENT_CUSTODY.packageVersion,
    })
    expect(manifest.version).toBe(FROZEN_TUTOR_CONTENT_CUSTODY.manifestVersion)
    expect(manifest.sequenceIds).toContain(FROZEN_TUTOR_CONTENT_CUSTODY.sequenceRoutingId)
    expect(sequence).toMatchObject({
      version: FROZEN_TUTOR_CONTENT_CUSTODY.manifestVersion,
      sequenceId: FROZEN_TUTOR_CONTENT_CUSTODY.sequenceRoutingId,
      lessonId: FROZEN_TUTOR_CONTENT_CUSTODY.sequenceLessonId,
      gradeBand: FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand,
    })
    expect(sequence.skillIds).toEqual(FROZEN_TUTOR_CONTENT_CUSTODY.skillRefs)
    expect(sha256(FROZEN_TUTOR_CONTENT_CUSTODY.checksumSourceReference)).toBe(
      FROZEN_TUTOR_CONTENT_CUSTODY.sha256SumsDigest,
    )
    expect(sha256(FROZEN_TUTOR_CONTENT_CUSTODY.manifestSourceReference)).toBe(
      FROZEN_TUTOR_CONTENT_CUSTODY.manifestSha256,
    )
    expect(sha256(FROZEN_TUTOR_CONTENT_CUSTODY.sequenceSourceReference)).toBe(
      FROZEN_TUTOR_CONTENT_CUSTODY.sequenceSha256,
    )
    expect(VALIDATED_TUTOR_CONTENT_MAPPINGS.every((row) =>
      row.adapterContractVersion === BRIDGE_CONTRACT_VERSION &&
      row.tutorContractVersion === STUDY_TUTOR_CONTRACT_VERSION)).toBe(true)
  })

  it('maps every supported lesson to the exact five host segment refs and frozen phases', () => {
    const supported = ACADEMY_GRADE5_MATH_UNIT5_LESSONS.filter((lesson) => lesson.mappingStatus === 'approved')
    expect(supported).toHaveLength(15)
    expect(VALIDATED_TUTOR_CONTENT_MAPPINGS).toHaveLength(75)
    for (const lesson of supported) {
      const plan = adaptHostLessonToStudyPlan({
        lessonRef: lesson.hostLessonRef,
        title: lesson.hostPhase,
        kind: 'math',
        skillRefs: [lesson.tutorSkillRef!],
      })
      const rows = VALIDATED_TUTOR_CONTENT_MAPPINGS.filter((row) => row.hostLessonRef === lesson.hostLessonRef)
      const bySegmentRef = (left: { segmentRef: string }, right: { segmentRef: string }): number =>
        left.segmentRef.localeCompare(right.segmentRef)
      expect(rows.map((row) => ({ segmentRef: row.hostSegmentRef, taskType: row.taskType })).sort(bySegmentRef))
        .toEqual(plan.segments.map((segment) => ({ segmentRef: segment.segmentRef, taskType: segment.taskType })).sort(bySegmentRef))
      for (const row of rows) {
        const phase = mapStudyTaskToTutorPhase(row.taskType)
        expect(phase.status).toBe('mapped')
        if (phase.status === 'mapped') expect(phase.value.requestedPhase).toBe(row.tutorPhase)
      }
    }
  })
})

describe('fail-closed canonical mapping authority', () => {
  it('has no duplicate lesson/segment keys and rejects a duplicate as a build failure', () => {
    const keys = VALIDATED_TUTOR_CONTENT_MAPPINGS.map((row) => `${row.hostLessonRef}|${row.hostSegmentRef}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(() => validateTutorContentMapping([...APPROVED_TUTOR_CONTENT_MAPPINGS, APPROVED_TUTOR_CONTENT_MAPPINGS[0]!]))
      .toThrow(/Duplicate Tutor content mapping/)
  })

  it('rejects an unknown mapped skill as a build failure', () => {
    const changed = [...APPROVED_TUTOR_CONTENT_MAPPINGS]
    changed[0] = { ...changed[0]!, skillRefs: ['math-skill-unknown-v1'] } as unknown as ApprovedTutorContentMapping
    expect(() => validateTutorContentMapping(changed)).toThrow(/Unknown or ambiguous Tutor skill/)
  })

  it('rejects unknown lessons and stale host or frozen pins as build failures', () => {
    const changedLesson = [...APPROVED_TUTOR_CONTENT_MAPPINGS]
    changedLesson[0] = {
      ...changedLesson[0]!,
      hostLessonRef: 'ma-g5-mathematics-u05-unknown',
      hostSegmentRef: 'ma-g5-mathematics-u05-unknown:segment:retrieve',
    }
    expect(() => validateTutorContentMapping(changedLesson)).toThrow(/Unknown or static-only Academy lesson/)

    const changedHostPin = [...APPROVED_TUTOR_CONTENT_MAPPINGS]
    changedHostPin[0] = { ...changedHostPin[0]!, academyReleaseVersion: '1.0.1' }
    expect(() => validateTutorContentMapping(changedHostPin)).toThrow(/Stale Academy custody pin/)

    const changedFrozenPin = [...APPROVED_TUTOR_CONTENT_MAPPINGS]
    changedFrozenPin[0] = { ...changedFrozenPin[0]!, frozenSha256SumsDigest: '0'.repeat(64) }
    expect(() => validateTutorContentMapping(changedFrozenPin)).toThrow(/Stale frozen Tutor custody pin/)
  })

  it('fails closed for unknown lesson, unknown segment, task mismatch, and the three static-only lessons', () => {
    expect(resolveApprovedTutorContentMapping(lookup())).not.toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { hostLessonRef: 'ma-g5-mathematics-u05-unknown' }))).toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { hostSegmentRef: 'ma-g5-mathematics-u05-l01:segment:unknown' }))).toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { taskType: 'custom' }))).toBeNull()
    for (const suffix of ['l06', 'l12', 'l18']) {
      const lessonRef = `ma-g5-mathematics-u05-${suffix}`
      expect(resolveApprovedTutorContentMapping(lookup(undefined, {
        hostLessonRef: lessonRef,
        hostSegmentRef: `${lessonRef}:segment:retrieve`,
      }))).toBeNull()
    }
  })

  it('rejects changed host release/manifest pins and frozen package/checksum pins', () => {
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { academyReleaseVersion: '1.0.1' }))).toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { academyManifestSha256: '0'.repeat(64) }))).toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { frozenPackageVersion: '1.0.3' }))).toBeNull()
    expect(resolveApprovedTutorContentMapping(lookup(undefined, { frozenSha256SumsDigest: '0'.repeat(64) }))).toBeNull()
  })

  it('contains no learner, identity, placement, mastery, permission, or session authority', () => {
    const forbidden = new Set([
      'studentid', 'learnerref', 'householdid', 'authuserid', 'nominallearnergrade',
      'workinglevel', 'placementstate', 'masterystate', 'permission', 'grant', 'sessionauthorization',
    ])
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit)
      if (typeof value !== 'object' || value === null) return
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key.toLowerCase())).toBe(false)
        visit(child)
      }
    }
    visit(VALIDATED_TUTOR_CONTENT_MAPPINGS)
    expect(EXPECTED_ANSWER_BINDING_REVIEW.status).toBe('deferred-honestly')
    expect(VALIDATED_TUTOR_CONTENT_MAPPINGS.every((row) => !('expectedAnswerBinding' in row))).toBe(true)
  })
})

describe('canonical serialization and server-only custody', () => {
  it('produces an order- and line-ending-stable SHA-256 mapping digest', () => {
    const left = { z: 'line one\r\nline two', a: { y: 2, x: 1 } }
    const right = { a: { x: 1, y: 2 }, z: 'line one\nline two' }
    expect(canonicalSerialize(left)).toBe(canonicalSerialize(right))
    expect(canonicalSha256(left)).toBe(canonicalSha256(right))
    expect(canonicalSha256({ mappingVersion: TUTOR_CONTENT_MAPPING_VERSION, records: VALIDATED_TUTOR_CONTENT_MAPPINGS }))
      .toBe(TUTOR_CONTENT_MAPPING_SHA256)
    const reversed = validateTutorContentMapping([...APPROVED_TUTOR_CONTENT_MAPPINGS].reverse())
    expect(canonicalSha256({ mappingVersion: TUTOR_CONTENT_MAPPING_VERSION, records: reversed }))
      .toBe(TUTOR_CONTENT_MAPPING_SHA256)
    expect(TUTOR_CONTENT_MAPPING_CANONICAL_SERIALIZATION).not.toMatch(/\r/)
    expect(TUTOR_CONTENT_MAPPING_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('has no production or browser importer and carries no default-program fallback', () => {
    const sourceRoot = resolve(repoRoot, 'src')
    const sourceFiles: string[] = []
    const visit = (directory: string): void => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name)
        if (statSync(path).isDirectory()) visit(path)
        else if (/\.(?:ts|tsx)$/.test(name)) sourceFiles.push(path)
      }
    }
    visit(sourceRoot)
    const importers = sourceFiles
      .filter((path) => !path.startsWith(here) && !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
      .filter((path) => /tutorContentMapping/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(repoRoot, path).replaceAll('\\', '/'))
    expect(importers).toEqual([])
    expect(text('src/study/server/tutorContentMapping.ts')).not.toContain('programs[0]')
    expect(text('src/study/server/tutorContentMapping.data.ts')).not.toContain('programs[0]')
  })
})

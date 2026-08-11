import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  resolveTutorSubjectRegistration,
  selectTutorProgram,
} from '../../../adaptive-tutor/study-engine/runtime/src/subject-registry.ts'
import { sequence } from '../../../adaptive-tutor/subjects/math/lessons/03-equivalent-fractions-and-common-denominators/sequence.ts'
import { adaptHostLessonToStudyPlan } from '../curriculumAdapter'
import {
  ACADEMY_GRADE5_MATH_UNIT5_CENSUS,
  ACADEMY_SOURCE_PINS,
  EXPECTED_ANSWER_BINDING_REVIEW,
  FROZEN_TUTOR_SOURCE_PINS,
  PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING,
  REVIEWED_HOST_SEGMENTS,
  TUTOR_HOST_MAPPING_ARTIFACT_KIND,
  TUTOR_HOST_MAPPING_CANONICAL_JSON,
  TUTOR_HOST_MAPPING_SCHEMA_VERSION,
  TUTOR_HOST_MAPPING_SHA256,
  TUTOR_HOST_MAPPING_VERSION,
  canonicalSerialize,
  canonicalSha256,
  loadTutorHostMappingArtifact,
  parseTutorHostMappingArtifact,
  resolveApprovedTutorHostMapping,
  type ApprovedTutorHostMapping,
  type ReviewedTutorPhase,
  type TutorHostMappingArtifact,
  type TutorHostMappingLookup,
} from './tutorHostMapping'
import { probeFrozenTutorRouting } from './tutorHostMappingProbe'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')

function text(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8')
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(resolve(repoRoot, path))).digest('hex')
}

function mutableArtifact(): Record<string, unknown> {
  return structuredClone(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING) as unknown as Record<string, unknown>
}

function runtimeScopeFor(phase: ReviewedTutorPhase): readonly string[] {
  const authority = FROZEN_TUTOR_SOURCE_PINS.effectiveExecutableRoutingAuthority
  if (phase === 'teach-visually') return authority.selectableTeachingTurnRefs
  if (phase === 'guided-practice') return authority.phaseItemRefs.guidedPractice
  if (phase === 'independent-attempt') return authority.phaseItemRefs.independentAttempt
  return authority.phaseItemRefs.reassess
}

function approvedRow(
  hostLessonRef: string = ACADEMY_GRADE5_MATH_UNIT5_CENSUS[0].hostLessonRef,
  segment: (typeof REVIEWED_HOST_SEGMENTS)[number] = REVIEWED_HOST_SEGMENTS[0],
): ApprovedTutorHostMapping {
  return {
    hostLessonRef,
    hostSegmentRef: `${hostLessonRef}:segment:${segment.suffix}`,
    taskType: segment.taskType,
    tutorPhase: segment.tutorPhase,
    programRef: FROZEN_TUTOR_SOURCE_PINS.declaredMetadata.sequenceRoutingId,
    reviewedRuntimeItemRefs: runtimeScopeFor(segment.tutorPhase),
  }
}

function lookup(overrides: Partial<TutorHostMappingLookup> = {}): TutorHostMappingLookup {
  const lesson = ACADEMY_GRADE5_MATH_UNIT5_CENSUS[0]
  const segment = REVIEWED_HOST_SEGMENTS[0]
  return {
    academyPackageId: ACADEMY_SOURCE_PINS.packageId,
    academyReleaseVersion: ACADEMY_SOURCE_PINS.releaseVersion,
    academyManifestSha256: ACADEMY_SOURCE_PINS.manifestSha256,
    frozenPackageName: FROZEN_TUTOR_SOURCE_PINS.packageName,
    frozenPackageVersion: FROZEN_TUTOR_SOURCE_PINS.packageVersion,
    frozenSha256SumsDigest: FROZEN_TUTOR_SOURCE_PINS.sha256SumsDigest,
    hostLessonRef: lesson.hostLessonRef,
    hostSegmentRef: `${lesson.hostLessonRef}:segment:${segment.suffix}`,
    taskType: segment.taskType,
    ...overrides,
  }
}

function reverseObjectInsertionOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectInsertionOrder)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, child]) => [key, reverseObjectInsertionOrder(child)]),
  )
}

describe('authoritative Academy Grade 5 Mathematics Unit 5 census', () => {
  const academyLessons = text(ACADEMY_SOURCE_PINS.lessonSourceReference)
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
    .filter((lesson) => lesson.course_id === ACADEMY_SOURCE_PINS.courseId && lesson.unit_number === 5)

  it('pins the Academy package and rechecks all 18 exact source lessons', () => {
    const manifest = JSON.parse(text(ACADEMY_SOURCE_PINS.manifestSourceReference)) as {
      package_id: string
      version: string
    }
    expect(manifest).toMatchObject({
      package_id: ACADEMY_SOURCE_PINS.packageId,
      version: ACADEMY_SOURCE_PINS.releaseVersion,
    })
    expect(sha256(ACADEMY_SOURCE_PINS.manifestSourceReference)).toBe(
      ACADEMY_SOURCE_PINS.manifestSha256,
    )
    expect(academyLessons).toHaveLength(18)
    expect(ACADEMY_GRADE5_MATH_UNIT5_CENSUS).toHaveLength(18)
    expect(academyLessons.map((lesson) => lesson.lesson_id)).toEqual(
      ACADEMY_GRADE5_MATH_UNIT5_CENSUS.map((lesson) => lesson.hostLessonRef),
    )

    for (const census of ACADEMY_GRADE5_MATH_UNIT5_CENSUS) {
      const source = academyLessons.find((lesson) => lesson.lesson_id === census.hostLessonRef)
      expect(source).toMatchObject({
        course_id: ACADEMY_SOURCE_PINS.courseId,
        course_day: census.courseDay,
        unit_number: 5,
        subject: 'mathematics',
        phase: census.hostPhase,
        focus: census.hostFocus,
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

  it('rechecks every exact host segment without assigning a Tutor concept skill', () => {
    for (const lesson of ACADEMY_GRADE5_MATH_UNIT5_CENSUS) {
      const plan = adaptHostLessonToStudyPlan({
        lessonRef: lesson.hostLessonRef,
        title: lesson.hostPhase,
        kind: 'math',
        skillRefs: [],
      })
      expect(plan.skillRefs).toEqual([])
      expect(plan.segments.map((segment) => ({
        segmentRef: segment.segmentRef,
        taskType: segment.taskType,
      }))).toEqual(REVIEWED_HOST_SEGMENTS.map((segment) => ({
        segmentRef: `${lesson.hostLessonRef}:segment:${segment.suffix}`,
        taskType: segment.taskType,
      })))
      expect(lesson.exclusionScope).toBe('all-reviewed-segments')
    }
  })

  it('keeps L06/L12/L18 static-only and excludes the other 15 for executable routing', () => {
    expect(ACADEMY_GRADE5_MATH_UNIT5_CENSUS
      .filter((lesson) => lesson.reasonCode === 'no-exact-tutor-capability')
      .map((lesson) => lesson.hostLessonRef)).toEqual([
      'ma-g5-mathematics-u05-l06',
      'ma-g5-mathematics-u05-l12',
      'ma-g5-mathematics-u05-l18',
    ])
    expect(ACADEMY_GRADE5_MATH_UNIT5_CENSUS
      .filter((lesson) => lesson.reasonCode === 'frozen-runtime-not-concept-addressable'))
      .toHaveLength(15)
  })
})

describe('load-bearing frozen Tutor executable probe', () => {
  it('pins the frozen package, adapter, engine, manifest, and sequence bytes', () => {
    const packageJson = JSON.parse(text('adaptive-tutor/subjects/math/package.json')) as {
      name: string
      version: string
    }
    const manifest = JSON.parse(text(FROZEN_TUTOR_SOURCE_PINS.manifestSourceReference)) as {
      version: string
      sequenceIds: readonly string[]
    }
    expect(packageJson).toMatchObject({
      name: FROZEN_TUTOR_SOURCE_PINS.packageName,
      version: FROZEN_TUTOR_SOURCE_PINS.packageVersion,
    })
    expect(manifest.version).toBe(FROZEN_TUTOR_SOURCE_PINS.manifestVersion)
    expect(manifest.sequenceIds).toContain(
      FROZEN_TUTOR_SOURCE_PINS.declaredMetadata.sequenceRoutingId,
    )
    for (const [sourceReference, digest] of [
      [FROZEN_TUTOR_SOURCE_PINS.checksumSourceReference, FROZEN_TUTOR_SOURCE_PINS.sha256SumsDigest],
      [FROZEN_TUTOR_SOURCE_PINS.manifestSourceReference, FROZEN_TUTOR_SOURCE_PINS.manifestSha256],
      [FROZEN_TUTOR_SOURCE_PINS.sequenceSourceReference, FROZEN_TUTOR_SOURCE_PINS.sequenceSha256],
      [FROZEN_TUTOR_SOURCE_PINS.adapterSourceReference, FROZEN_TUTOR_SOURCE_PINS.adapterSha256],
      [FROZEN_TUTOR_SOURCE_PINS.engineSourceReference, FROZEN_TUTOR_SOURCE_PINS.engineSha256],
    ] as const) {
      expect(sha256(sourceReference)).toBe(digest)
    }
  })

  it('proves declared skills collapse to one adapted skill and phase items advance sequentially', () => {
    const probe = probeFrozenTutorRouting()
    const authority = FROZEN_TUTOR_SOURCE_PINS.effectiveExecutableRoutingAuthority
    expect(probe.declaredSkillGraphIds).toEqual(
      FROZEN_TUTOR_SOURCE_PINS.declaredMetadata.declaredSkillIds,
    )
    expect(probe.programTargetSkillId).toBe(authority.programTargetSkillId)
    expect(probe.adaptedRuntimeItemSkillIds).toEqual(authority.adaptedRuntimeItemSkillIds)
    expect(probe.selectableItemsByPhase).toEqual({
      assessment: authority.phaseItemRefs.assessment,
      'guided-practice': authority.phaseItemRefs.guidedPractice,
      'independent-attempt': authority.phaseItemRefs.independentAttempt,
      reassess: authority.phaseItemRefs.reassess,
    })
    expect(probe.engineSelectedItemsByPhase).toEqual(probe.selectableItemsByPhase)
    expect(probe.selectableTeachingTurnIds).toEqual(authority.selectableTeachingTurnRefs)
    expect(authority.selectableTeachingTurnRefs).toContain(probe.engineSelectedTeachingTurnId)
    expect(probe.terminalPhase).toBe('advance')
    expect(authority.conceptAddressable).toBe(false)
    expect(authority.phaseItemSelection).toBe('sequential-array-index')
  })

  it('recognizes mixed concepts from actual prompts and boards, not source names alone', () => {
    const prompts = new Map([
      ...sequence.diagnostic.items,
      ...sequence.guidedPractice.items,
      ...sequence.independentMasteryCheck.items,
    ].map((item) => [item.id, item.prompt]))

    const mixedPhaseWitnesses = [
      ['math-fr-d01', /equivalent/i],
      ['math-fr-d03', /common denominator/i],
      ['math-fr-d04', /\+/],
      ['math-fr-d05', /greater/i],
      ['math-fr-g01', /equivalent/i],
      ['math-fr-g02', /common denominator/i],
      ['math-fr-g03', /\+/],
      ['math-fr-g04', /[−-]|subtract/i],
      ['math-fr-m01', /equivalent/i],
      ['math-fr-m02', /\+/],
      ['math-fr-m03', /[−-]|subtract/i],
      ['math-fr-m04', /compare/i],
    ] as const
    for (const [itemId, expectedContent] of mixedPhaseWitnesses) {
      expect(prompts.get(itemId)).toMatch(expectedContent)
    }

    const boards = sequence.visualExplanationPlan.boards.map((board) => board.altText).join('\n')
    expect(boards).toMatch(/equivalence|same amount/i)
    expect(boards).toMatch(/common|shared multiple|twelfths/i)
    expect(boards).toMatch(/compare/i)
  })
})

describe('zero-mapping artifact and exact production parser', () => {
  it('loads only the canonical, reviewed, zero-mapping safe state', () => {
    expect(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING).toMatchObject({
      schemaVersion: TUTOR_HOST_MAPPING_SCHEMA_VERSION,
      artifactKind: TUTOR_HOST_MAPPING_ARTIFACT_KIND,
      mappingVersion: TUTOR_HOST_MAPPING_VERSION,
      compatibilityStatus: 'no-approved-mapping-under-current-frozen-runtime',
      approvedMappings: [],
      expectedAnswerBinding: EXPECTED_ANSWER_BINDING_REVIEW,
    })
    expect(parseTutorHostMappingArtifact(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING))
      .toEqual(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING)
    expect(Object.isFrozen(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING)).toBe(true)
  })

  it('rejects stale schemas, artifact kinds, versions, pins, status, and extra fields', () => {
    const mutations: Array<(artifact: Record<string, unknown>) => void> = [
      (artifact) => { artifact.schemaVersion = 'study-tutor-host-mapping.v2' },
      (artifact) => { artifact.artifactKind = 'draft' },
      (artifact) => { artifact.mappingVersion = 2 },
      (artifact) => { artifact.compatibilityStatus = 'unknown' },
      (artifact) => {
        (artifact.academySourcePins as Record<string, unknown>).manifestSha256 = '0'.repeat(64)
      },
      (artifact) => {
        (artifact.frozenTutorPins as Record<string, unknown>).packageVersion = '1.0.3'
      },
      (artifact) => { artifact.browserRoutingAuthority = true },
    ]
    for (const mutate of mutations) {
      const artifact = mutableArtifact()
      mutate(artifact)
      expect(parseTutorHostMappingArtifact(artifact)).toBeNull()
    }
  })

  it('rejects the old 75-row design even when every row names the complete phase scope', () => {
    const unsafe = mutableArtifact()
    const rows = ACADEMY_GRADE5_MATH_UNIT5_CENSUS
      .filter((lesson) => lesson.reasonCode === 'frozen-runtime-not-concept-addressable')
      .flatMap((lesson) => REVIEWED_HOST_SEGMENTS.map((segment) =>
        approvedRow(lesson.hostLessonRef, segment)))
    expect(rows).toHaveLength(75)
    unsafe.compatibilityStatus = 'approved'
    unsafe.approvedMappings = rows
    expect(parseTutorHostMappingArtifact(unsafe)).toBeNull()
  })

  it('rejects partial runtime scope and duplicate approved mapping keys', () => {
    const partial = mutableArtifact()
    partial.compatibilityStatus = 'approved'
    partial.approvedMappings = [{
      ...approvedRow(),
      reviewedRuntimeItemRefs: [runtimeScopeFor('reassess')[0]],
    }]
    expect(parseTutorHostMappingArtifact(partial)).toBeNull()

    const duplicate = mutableArtifact()
    const row = approvedRow()
    duplicate.compatibilityStatus = 'approved'
    duplicate.approvedMappings = [row, structuredClone(row)]
    expect(parseTutorHostMappingArtifact(duplicate)).toBeNull()
  })

  it('fails closed for every Unit 5 lesson/segment and never falls back to a Tutor default', () => {
    for (const lesson of ACADEMY_GRADE5_MATH_UNIT5_CENSUS) {
      for (const segment of REVIEWED_HOST_SEGMENTS) {
        expect(resolveApprovedTutorHostMapping(lookup({
          hostLessonRef: lesson.hostLessonRef,
          hostSegmentRef: `${lesson.hostLessonRef}:segment:${segment.suffix}`,
          taskType: segment.taskType,
        }))).toBeNull()
      }
    }

    const registration = resolveTutorSubjectRegistration('math')
    const legacyFallback = selectTutorProgram(
      registration,
      ACADEMY_GRADE5_MATH_UNIT5_CENSUS[0].hostLessonRef,
    )
    expect(legacyFallback).toBe(registration.programs[0]?.program)
    expect(resolveApprovedTutorHostMapping(lookup())).toBeNull()
    expect(text('src/study/server/tutorHostMapping.ts')).not.toContain('programs[0]')
  })

  it('fails closed for unknown lesson, unknown segment, task mismatch, and stale lookup pins', () => {
    expect(resolveApprovedTutorHostMapping(lookup({
      hostLessonRef: 'ma-g5-mathematics-u05-unknown',
    }))).toBeNull()
    expect(resolveApprovedTutorHostMapping(lookup({
      hostSegmentRef: 'ma-g5-mathematics-u05-l01:segment:unknown',
    }))).toBeNull()
    expect(resolveApprovedTutorHostMapping(lookup({ taskType: 'custom' }))).toBeNull()
    expect(resolveApprovedTutorHostMapping(lookup({ academyReleaseVersion: '1.0.1' }))).toBeNull()
    expect(resolveApprovedTutorHostMapping(lookup({ frozenPackageVersion: '1.0.3' }))).toBeNull()
  })

  it('contains no learner, grade, working-level, identity, session, or answer authority', () => {
    const forbidden = new Set([
      'studentid', 'learnerref', 'learnergrade', 'nominalgrade', 'householdid',
      'authuserid', 'workinglevel', 'placementstate', 'sessionauthorization',
      'expectedanswer', 'answercorpus', 'permission', 'grant',
    ])
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit)
      if (typeof value !== 'object' || value === null) return
      for (const [key, child] of Object.entries(value)) {
        expect(forbidden.has(key.toLowerCase())).toBe(false)
        visit(child)
      }
    }
    visit(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING)
    expect(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING.expectedAnswerBinding.status)
      .toBe('deferred-honestly')
  })
})

describe('canonical JSON, digest, and server/browser boundary', () => {
  it('is stable across repeated loads, line endings, and object insertion order', () => {
    const left = { z: 'line one\r\nline two', a: { y: 2, x: 1 } }
    const right = { a: { x: 1, y: 2 }, z: 'line one\nline two' }
    expect(canonicalSerialize(left)).toBe(canonicalSerialize(right))
    expect(canonicalSha256(left)).toBe(canonicalSha256(right))
    expect(canonicalSha256(reverseObjectInsertionOrder(PRODUCTION_REVIEWED_TUTOR_HOST_MAPPING)))
      .toBe(TUTOR_HOST_MAPPING_SHA256)
    expect(canonicalSha256(loadTutorHostMappingArtifact())).toBe(TUTOR_HOST_MAPPING_SHA256)
    expect(canonicalSha256(loadTutorHostMappingArtifact())).toBe(TUTOR_HOST_MAPPING_SHA256)
  })

  it('pins the canonical source file and source-controlled SHA-256', () => {
    const artifactText = text('src/study/server/tutorHostMapping.v1.json').replace(/\r\n?/g, '\n')
    const digestText = text('src/study/server/tutorHostMapping.v1.sha256').trim()
    expect(artifactText).toBe(`${TUTOR_HOST_MAPPING_CANONICAL_JSON}\n`)
    expect(TUTOR_HOST_MAPPING_CANONICAL_JSON).not.toMatch(/\r/)
    expect(digestText).toBe(TUTOR_HOST_MAPPING_SHA256)
    expect(TUTOR_HOST_MAPPING_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('has no browser or production-route importer, so the route stays dark', () => {
    const roots = ['src', 'netlify']
    const sourceFiles: string[] = []
    const visit = (directory: string): void => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name)
        if (statSync(path).isDirectory()) visit(path)
        else if (/\.(?:ts|tsx|js|mjs)$/.test(name)) sourceFiles.push(path)
      }
    }
    for (const root of roots) visit(resolve(repoRoot, root))

    const importers = sourceFiles
      .filter((path) => !path.startsWith(here))
      .filter((path) => !/\.test\.[cm]?[jt]sx?$/.test(path))
      .filter((path) => /tutorHostMapping|study-tutor-host-mapping\.v1/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(repoRoot, path).replaceAll('\\', '/'))
    expect(importers).toEqual([])
  })
})

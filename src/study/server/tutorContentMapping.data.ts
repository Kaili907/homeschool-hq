import type { CanonicalStudyTaskType } from '../types'

/** Reviewed compatibility metadata only; never learner, placement, or session authority. */
export const TUTOR_CONTENT_MAPPING_VERSION = 'academy-tutor-content-mapping.v1' as const

export const ACADEMY_CONTENT_CUSTODY = Object.freeze({
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

export const FROZEN_TUTOR_CONTENT_CUSTODY = Object.freeze({
  packageName: '@manuel-academy/adaptive-tutor-math-content',
  packageVersion: '1.0.2',
  manifestVersion: '1.0.0',
  sha256SumsDigest: 'a9c44585d36e120dfac6b95aade0cf77763cabeff1026490672244dbc87f27ee',
  manifestSha256: 'c3814f08d4337f9d5bd8ab5c25b281c88a4cb3e49ff621fe178323bf907be0d7',
  sequenceSha256: '844cd8d3934425268728299aa9a18e5f9b37c05e639dd5b12404ebddea2e20e5',
  programRef: 'math-seq-equivalent-fractions-v1',
  sequenceRoutingId: 'math-seq-equivalent-fractions-v1',
  sequenceLessonId: 'math-lesson-03-equivalent-fractions-common-denominators',
  skillRefs: Object.freeze([
    'math-skill-fr-equivalence-v1',
    'math-skill-fr-common-denominator-v1',
    'math-skill-fr-add-sub-v1',
    'math-skill-fr-compare-v1',
  ] as const),
  gradeBand: Object.freeze({ minimum: 4, maximum: 6, primary: Object.freeze([4, 5] as const) }),
  manifestSourceReference: 'adaptive-tutor/subjects/math/manifest.json',
  checksumSourceReference: 'adaptive-tutor/subjects/math/SHA256SUMS.txt',
  sequenceSourceReference: 'adaptive-tutor/subjects/math/lessons/03-equivalent-fractions-and-common-denominators/sequence.json',
})

export type FrozenTutorSkillRef = typeof FROZEN_TUTOR_CONTENT_CUSTODY.skillRefs[number]

export interface AcademyUnit5LessonCensusRecord {
  readonly hostLessonRef: string
  readonly courseDay: number
  readonly hostPhase: string
  readonly hostConcept: string
  readonly mappingStatus: 'approved' | 'static-only'
  readonly tutorSkillRef: FrozenTutorSkillRef | null
}

/** Exact IDs and semantics transcribed from the authoritative lessons.jsonl records. */
export const ACADEMY_GRADE5_MATH_UNIT5_LESSONS = Object.freeze([
  { hostLessonRef: 'ma-g5-mathematics-u05-l01', courseDay: 73, hostPhase: 'Launch and diagnostic', hostConcept: 'fraction equivalence', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-equivalence-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l02', courseDay: 74, hostPhase: 'Concept model A', hostConcept: 'benchmark fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-compare-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l03', courseDay: 75, hostPhase: 'Guided practice A', hostConcept: 'common denominators', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-common-denominator-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l04', courseDay: 76, hostPhase: 'Independent application A', hostConcept: 'adding unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l05', courseDay: 77, hostPhase: 'Concept model B', hostConcept: 'subtracting unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l06', courseDay: 78, hostPhase: 'Guided practice B', hostConcept: 'mixed-number problem solving', mappingStatus: 'static-only', tutorSkillRef: null },
  { hostLessonRef: 'ma-g5-mathematics-u05-l07', courseDay: 79, hostPhase: 'Investigation or close reading', hostConcept: 'fraction equivalence', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-equivalence-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l08', courseDay: 80, hostPhase: 'Reteach and varied practice', hostConcept: 'benchmark fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-compare-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l09', courseDay: 81, hostPhase: 'Concept model C', hostConcept: 'common denominators', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-common-denominator-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l10', courseDay: 82, hostPhase: 'Discussion or problem seminar', hostConcept: 'adding unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l11', courseDay: 83, hostPhase: 'Performance task planning', hostConcept: 'subtracting unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l12', courseDay: 84, hostPhase: 'Performance task build', hostConcept: 'mixed-number problem solving', mappingStatus: 'static-only', tutorSkillRef: null },
  { hostLessonRef: 'ma-g5-mathematics-u05-l13', courseDay: 85, hostPhase: 'Skill consolidation', hostConcept: 'fraction equivalence', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-equivalence-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l14', courseDay: 86, hostPhase: 'Transfer challenge', hostConcept: 'benchmark fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-compare-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l15', courseDay: 87, hostPhase: 'Assessment preparation', hostConcept: 'common denominators', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-common-denominator-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l16', courseDay: 88, hostPhase: 'Unit assessment', hostConcept: 'adding unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l17', courseDay: 89, hostPhase: 'Targeted correction', hostConcept: 'subtracting unlike fractions', mappingStatus: 'approved', tutorSkillRef: 'math-skill-fr-add-sub-v1' },
  { hostLessonRef: 'ma-g5-mathematics-u05-l18', courseDay: 90, hostPhase: 'Publication, presentation, or reflection', hostConcept: 'mixed-number problem solving', mappingStatus: 'static-only', tutorSkillRef: null },
] as const satisfies readonly AcademyUnit5LessonCensusRecord[])

interface ReviewedMathSegment {
  readonly suffix: string
  readonly taskType: CanonicalStudyTaskType
  readonly tutorPhase: 'teach-visually' | 'guided-practice' | 'independent-attempt' | 'reassess'
}

/** Exact math segment IDs are `${hostLessonRef}:segment:${suffix}` per curriculumAdapter.ts. */
export const REVIEWED_MATH_SEGMENTS = Object.freeze([
  { suffix: 'retrieve', taskType: 'retrieval-practice', tutorPhase: 'reassess' },
  { suffix: 'teach', taskType: 'direct-instruction', tutorPhase: 'teach-visually' },
  { suffix: 'guide', taskType: 'guided-practice', tutorPhase: 'guided-practice' },
  { suffix: 'try', taskType: 'independent-practice', tutorPhase: 'independent-attempt' },
  { suffix: 'check', taskType: 'mastery-check', tutorPhase: 'independent-attempt' },
] as const satisfies readonly ReviewedMathSegment[])

export interface ApprovedTutorContentMapping {
  readonly mappingVersion: typeof TUTOR_CONTENT_MAPPING_VERSION
  readonly academyPackageId: string
  readonly academyReleaseVersion: string
  readonly academyManifestSha256: string
  readonly academyCourseId: string
  readonly academyUnitId: string
  readonly hostSourceReference: string
  readonly hostLessonRef: string
  readonly hostSegmentRef: string
  readonly hostSubject: 'mathematics'
  readonly hostPhase: string
  readonly hostConcept: string
  readonly taskType: CanonicalStudyTaskType
  readonly canonicalTutorRoutingId: string
  readonly skillRefs: readonly [FrozenTutorSkillRef]
  readonly tutorSubject: 'math'
  readonly tutorPhase: ReviewedMathSegment['tutorPhase']
  readonly tutorGradeBand: typeof FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand
  readonly programRef: string
  readonly tutorSourceReference: string
  readonly frozenPackageName: string
  readonly frozenPackageVersion: string
  readonly frozenManifestVersion: string
  readonly frozenSha256SumsDigest: string
  readonly adapterContractVersion: 1
  readonly tutorContractVersion: 'study-tutor.v1'
  readonly status: 'approved'
}

const supportedLessons = ACADEMY_GRADE5_MATH_UNIT5_LESSONS.filter(
  (lesson): lesson is typeof lesson & { readonly mappingStatus: 'approved'; readonly tutorSkillRef: FrozenTutorSkillRef } =>
    lesson.mappingStatus === 'approved' && lesson.tutorSkillRef !== null,
)

export const APPROVED_TUTOR_CONTENT_MAPPINGS: readonly ApprovedTutorContentMapping[] = Object.freeze(
  supportedLessons.flatMap((lesson) => REVIEWED_MATH_SEGMENTS.map((segment) => Object.freeze({
    mappingVersion: TUTOR_CONTENT_MAPPING_VERSION,
    academyPackageId: ACADEMY_CONTENT_CUSTODY.packageId,
    academyReleaseVersion: ACADEMY_CONTENT_CUSTODY.releaseVersion,
    academyManifestSha256: ACADEMY_CONTENT_CUSTODY.manifestSha256,
    academyCourseId: ACADEMY_CONTENT_CUSTODY.courseId,
    academyUnitId: ACADEMY_CONTENT_CUSTODY.unitId,
    hostSourceReference: `${ACADEMY_CONTENT_CUSTODY.lessonSourceReference}#${lesson.hostLessonRef}`,
    hostLessonRef: lesson.hostLessonRef,
    hostSegmentRef: `${lesson.hostLessonRef}:segment:${segment.suffix}`,
    hostSubject: 'mathematics' as const,
    hostPhase: lesson.hostPhase,
    hostConcept: lesson.hostConcept,
    taskType: segment.taskType,
    canonicalTutorRoutingId: FROZEN_TUTOR_CONTENT_CUSTODY.sequenceRoutingId,
    skillRefs: Object.freeze([lesson.tutorSkillRef] as const),
    tutorSubject: 'math' as const,
    tutorPhase: segment.tutorPhase,
    tutorGradeBand: FROZEN_TUTOR_CONTENT_CUSTODY.gradeBand,
    programRef: FROZEN_TUTOR_CONTENT_CUSTODY.programRef,
    tutorSourceReference: FROZEN_TUTOR_CONTENT_CUSTODY.sequenceSourceReference,
    frozenPackageName: FROZEN_TUTOR_CONTENT_CUSTODY.packageName,
    frozenPackageVersion: FROZEN_TUTOR_CONTENT_CUSTODY.packageVersion,
    frozenManifestVersion: FROZEN_TUTOR_CONTENT_CUSTODY.manifestVersion,
    frozenSha256SumsDigest: FROZEN_TUTOR_CONTENT_CUSTODY.sha256SumsDigest,
    adapterContractVersion: 1 as const,
    tutorContractVersion: 'study-tutor.v1' as const,
    status: 'approved' as const,
  }))),
)

/** No exact server answer reference exists; T3/T4 must establish one before enablement. */
export const EXPECTED_ANSWER_BINDING_REVIEW = Object.freeze({
  status: 'deferred-honestly' as const,
  downstreamRequirement: 'T3/T4 must bind each eligible host segment to an existing canonical server-side answer authority before route enablement.',
})

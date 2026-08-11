export const STUDY_BOUND_CONTENT_SCHEMA_VERSION = 1 as const

export interface StudyBoundContentRequest {
  readonly sessionId: string
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
}

export interface StudyBoundContentBinding {
  readonly schemaVersion: typeof STUDY_BOUND_CONTENT_SCHEMA_VERSION
  readonly releaseId: string
  readonly packageId: string
  readonly releaseVersion: string
  readonly curriculumManifestSha256: string
}

export interface StudyLearnerLessonFlowSegment {
  readonly segment: string
  readonly minutes?: string
  readonly teacherOrTutorAction: string
}

export interface StudyLearnerMediaGuidance {
  readonly required?: boolean
  readonly description?: string
  readonly suggestion?: string
  readonly fallback?: string
}

/**
 * Exact learner-safe curriculum projection. Scoring guidance, mastery rules,
 * adaptive routes, assessment custody, safety policy text, guardian notes, and
 * source authority are deliberately absent.
 */
export interface StudyLearnerLesson {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: 5 | 7 | 8
  readonly subject: string
  readonly courseDay: number
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly title: string
  readonly phase?: string
  readonly focus?: string
  readonly standards: readonly string[]
  readonly schemaVersion: string
  readonly estimatedMinutes?: string
  readonly essentialQuestion?: string
  readonly learningObjectives: readonly string[]
  readonly successCriteria: readonly string[]
  readonly materials: readonly string[]
  readonly lessonFlow: readonly StudyLearnerLessonFlowSegment[]
  readonly studentActivity?: string
  readonly formativeCheck: string
  readonly extension?: string
  readonly accommodations: readonly string[]
  readonly media?: StudyLearnerMediaGuidance | string
  readonly homeConnection?: string
}

export interface StudyBoundContentReady {
  readonly schemaVersion: typeof STUDY_BOUND_CONTENT_SCHEMA_VERSION
  readonly status: 'ready'
  readonly reasonCode: 'content-ready'
  readonly sessionRef: string
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
  readonly curriculumBinding: StudyBoundContentBinding
  readonly lessons: readonly StudyLearnerLesson[]
}

export type StudyBoundContentFailureStatus =
  | 'unavailable'
  | 'unsupported'
  | 'membership_mismatch'
  | 'not_found'
  | 'release_unavailable'
  | 'manifest_mismatch'

export type StudyBoundContentFailureReason =
  | 'content-authority-unavailable'
  | 'content-request-unsupported'
  | 'advisory-lesson-mismatch'
  | 'lesson-context-unsupported'
  | 'curriculum-package-unavailable'
  | 'bound-release-identity-mismatch'
  | 'bound-release-unavailable'
  | 'curriculum-manifest-mismatch'
  | 'curriculum-package-malformed'
  | 'curriculum-schedule-unavailable'
  | 'lesson-context-not-found'
  | 'skill-ref-not-found'
  | 'skill-not-eligible-for-lesson'
  | 'skill-not-eligible-for-learner'
  | 'curriculum-content-unavailable'
  | 'study-session-unavailable'
  | 'legacy-curriculum-binding-ambiguous'
  | 'curriculum-release-unavailable'
  | 'learner-curriculum-scope-unavailable'

export interface StudyBoundContentFailure {
  readonly schemaVersion: typeof STUDY_BOUND_CONTENT_SCHEMA_VERSION
  readonly status: StudyBoundContentFailureStatus
  readonly reasonCode: StudyBoundContentFailureReason
  readonly rejectedSkillRef?: string
}

export type StudyBoundContentResponse = StudyBoundContentReady | StudyBoundContentFailure

const SAFE_REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const PACKAGE_ID = /^[a-z0-9][a-z0-9-]{0,119}$/
const RELEASE_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+$/
const SHA256 = /^[0-9a-f]{64}$/
const FAILURE_STATUSES = new Set<StudyBoundContentFailureStatus>([
  'unavailable', 'unsupported', 'membership_mismatch', 'not_found',
  'release_unavailable', 'manifest_mismatch',
])
const FAILURE_REASONS = new Set<StudyBoundContentFailureReason>([
  'content-authority-unavailable', 'content-request-unsupported',
  'advisory-lesson-mismatch', 'lesson-context-unsupported',
  'curriculum-package-unavailable', 'bound-release-identity-mismatch',
  'bound-release-unavailable', 'curriculum-manifest-mismatch',
  'curriculum-package-malformed', 'curriculum-schedule-unavailable',
  'lesson-context-not-found', 'skill-ref-not-found',
  'skill-not-eligible-for-lesson', 'skill-not-eligible-for-learner',
  'curriculum-content-unavailable', 'study-session-unavailable',
  'legacy-curriculum-binding-ambiguous', 'curriculum-release-unavailable',
  'learner-curriculum-scope-unavailable',
])

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function exact(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): Record<string, unknown> | null {
  const candidate = record(value)
  if (!candidate || required.some((key) => !Object.hasOwn(candidate, key))) return null
  const allowed = new Set([...required, ...optional])
  return Object.keys(candidate).every((key) => allowed.has(key)) ? candidate : null
}

function safeRef(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REF.test(value)
}

function text(value: unknown, maximum = 100_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function integer(value: unknown, minimum = 1, maximum = 100_000): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
}

function textArray(value: unknown, maximum = 256): readonly string[] | null {
  if (!Array.isArray(value) || value.length > maximum || value.some((item) => !text(item))) return null
  return Object.freeze([...value]) as readonly string[]
}

function refArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64 ||
      value.some((item) => !safeRef(item)) || new Set(value).size !== value.length) return null
  return Object.freeze([...value]) as readonly string[]
}

function parseBinding(value: unknown): StudyBoundContentBinding | null {
  const candidate = exact(value, [
    'schemaVersion', 'releaseId', 'packageId', 'releaseVersion',
    'curriculumManifestSha256',
  ])
  if (!candidate || candidate.schemaVersion !== STUDY_BOUND_CONTENT_SCHEMA_VERSION ||
      typeof candidate.releaseId !== 'string' || !UUID.test(candidate.releaseId) ||
      typeof candidate.packageId !== 'string' || !PACKAGE_ID.test(candidate.packageId) ||
      typeof candidate.releaseVersion !== 'string' || !RELEASE_VERSION.test(candidate.releaseVersion) ||
      typeof candidate.curriculumManifestSha256 !== 'string' ||
      !SHA256.test(candidate.curriculumManifestSha256)) return null
  return Object.freeze({
    schemaVersion: STUDY_BOUND_CONTENT_SCHEMA_VERSION,
    releaseId: candidate.releaseId,
    packageId: candidate.packageId,
    releaseVersion: candidate.releaseVersion,
    curriculumManifestSha256: candidate.curriculumManifestSha256,
  })
}

function optionalText(candidate: Record<string, unknown>, key: string): string | undefined | null {
  if (!Object.hasOwn(candidate, key)) return undefined
  return text(candidate[key]) ? candidate[key] : null
}

function parseFlow(value: unknown): readonly StudyLearnerLessonFlowSegment[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return null
  const parsed: StudyLearnerLessonFlowSegment[] = []
  for (const item of value) {
    const candidate = exact(item, ['segment', 'teacherOrTutorAction'], ['minutes'])
    const minutes = candidate ? optionalText(candidate, 'minutes') : null
    if (!candidate || !text(candidate.segment) || !text(candidate.teacherOrTutorAction) ||
        minutes === null) return null
    parsed.push(Object.freeze({
      segment: candidate.segment,
      ...(minutes === undefined ? {} : { minutes }),
      teacherOrTutorAction: candidate.teacherOrTutorAction,
    }))
  }
  return Object.freeze(parsed)
}

function parseMedia(value: unknown): StudyLearnerMediaGuidance | string | null {
  if (text(value)) return value
  const candidate = exact(value, [], ['required', 'description', 'suggestion', 'fallback'])
  if (!candidate || Object.keys(candidate).length === 0) return null
  const required = candidate.required
  if (Object.hasOwn(candidate, 'required') && typeof required !== 'boolean') return null
  const description = optionalText(candidate, 'description')
  const suggestion = optionalText(candidate, 'suggestion')
  const fallback = optionalText(candidate, 'fallback')
  if (description === null || suggestion === null || fallback === null) return null
  return Object.freeze({
    ...(required === undefined ? {} : { required: required as boolean }),
    ...(description === undefined ? {} : { description }),
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(fallback === undefined ? {} : { fallback }),
  })
}

function parseLesson(value: unknown): StudyLearnerLesson | null {
  const candidate = exact(value, [
    'lessonId', 'courseId', 'grade', 'subject', 'courseDay', 'unitNumber',
    'unitTitle', 'dayInUnit', 'title', 'standards', 'schemaVersion',
    'learningObjectives', 'successCriteria', 'materials', 'lessonFlow',
    'formativeCheck', 'accommodations',
  ], [
    'phase', 'focus', 'estimatedMinutes', 'essentialQuestion', 'studentActivity',
    'extension', 'media', 'homeConnection',
  ])
  if (!candidate || !safeRef(candidate.lessonId) || !safeRef(candidate.courseId) ||
      ![5, 7, 8].includes(candidate.grade as number) || !text(candidate.subject) ||
      !integer(candidate.courseDay) || !integer(candidate.unitNumber) ||
      !text(candidate.unitTitle) || !integer(candidate.dayInUnit) || !text(candidate.title) ||
      !text(candidate.schemaVersion, 32) || !text(candidate.formativeCheck)) return null
  const standards = textArray(candidate.standards)
  const objectives = textArray(candidate.learningObjectives)
  const criteria = textArray(candidate.successCriteria)
  const materials = textArray(candidate.materials)
  const flow = parseFlow(candidate.lessonFlow)
  const accommodations = textArray(candidate.accommodations)
  if (!standards || !objectives || !criteria || !materials || !flow || !accommodations) return null
  const phase = optionalText(candidate, 'phase')
  const focus = optionalText(candidate, 'focus')
  const estimatedMinutes = optionalText(candidate, 'estimatedMinutes')
  const essentialQuestion = optionalText(candidate, 'essentialQuestion')
  const studentActivity = optionalText(candidate, 'studentActivity')
  const extension = optionalText(candidate, 'extension')
  const homeConnection = optionalText(candidate, 'homeConnection')
  if ([phase, focus, estimatedMinutes, essentialQuestion, studentActivity, extension, homeConnection]
    .some((item) => item === null)) return null
  const media = Object.hasOwn(candidate, 'media') ? parseMedia(candidate.media) : undefined
  if (Object.hasOwn(candidate, 'media') && media === null) return null
  return Object.freeze({
    lessonId: candidate.lessonId,
    courseId: candidate.courseId,
    grade: candidate.grade as 5 | 7 | 8,
    subject: candidate.subject,
    courseDay: candidate.courseDay,
    unitNumber: candidate.unitNumber,
    unitTitle: candidate.unitTitle,
    dayInUnit: candidate.dayInUnit,
    title: candidate.title,
    ...(phase === undefined ? {} : { phase }),
    ...(focus === undefined ? {} : { focus }),
    standards,
    schemaVersion: candidate.schemaVersion,
    ...(estimatedMinutes === undefined ? {} : { estimatedMinutes }),
    ...(essentialQuestion === undefined ? {} : { essentialQuestion }),
    learningObjectives: objectives,
    successCriteria: criteria,
    materials,
    lessonFlow: flow,
    ...(studentActivity === undefined ? {} : { studentActivity }),
    formativeCheck: candidate.formativeCheck,
    ...(extension === undefined ? {} : { extension }),
    accommodations,
    ...(media === undefined ? {} : { media }),
    ...(homeConnection === undefined ? {} : { homeConnection }),
  }) as StudyLearnerLesson
}

export function parseStudyBoundContentResponse(value: unknown): StudyBoundContentResponse | null {
  const candidate = record(value)
  if (!candidate || candidate.schemaVersion !== STUDY_BOUND_CONTENT_SCHEMA_VERSION) return null
  if (candidate.status === 'ready') {
    const ready = exact(candidate, [
      'schemaVersion', 'status', 'reasonCode', 'sessionRef', 'lessonRef',
      'skillRefs', 'curriculumBinding', 'lessons',
    ])
    if (!ready || ready.reasonCode !== 'content-ready' || !safeRef(ready.sessionRef) ||
        !safeRef(ready.lessonRef)) return null
    const skillRefs = refArray(ready.skillRefs)
    const binding = parseBinding(ready.curriculumBinding)
    if (!skillRefs || !binding || !Array.isArray(ready.lessons) ||
        ready.lessons.length !== skillRefs.length) return null
    const lessons = ready.lessons.map(parseLesson)
    if (lessons.some((lesson) => !lesson) ||
        lessons.some((lesson, index) => lesson!.lessonId !== skillRefs[index])) return null
    return Object.freeze({
      schemaVersion: STUDY_BOUND_CONTENT_SCHEMA_VERSION,
      status: 'ready',
      reasonCode: 'content-ready',
      sessionRef: ready.sessionRef,
      lessonRef: ready.lessonRef,
      skillRefs,
      curriculumBinding: binding,
      lessons: Object.freeze(lessons as StudyLearnerLesson[]),
    })
  }

  const failure = exact(candidate, ['schemaVersion', 'status', 'reasonCode'], ['rejectedSkillRef'])
  if (!failure || !FAILURE_STATUSES.has(failure.status as StudyBoundContentFailureStatus) ||
      !FAILURE_REASONS.has(failure.reasonCode as StudyBoundContentFailureReason)) return null
  const rejectedSkillRef = Object.hasOwn(failure, 'rejectedSkillRef')
    ? failure.rejectedSkillRef
    : undefined
  if (rejectedSkillRef !== undefined && !safeRef(rejectedSkillRef)) return null
  return Object.freeze({
    schemaVersion: STUDY_BOUND_CONTENT_SCHEMA_VERSION,
    status: failure.status as StudyBoundContentFailureStatus,
    reasonCode: failure.reasonCode as StudyBoundContentFailureReason,
    ...(rejectedSkillRef === undefined ? {} : { rejectedSkillRef }),
  })
}

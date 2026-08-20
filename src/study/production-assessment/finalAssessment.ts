import releaseBindings from './release-2.0.0-bindings.generated.json'

export const PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION = '2.0.0' as const
export const PRODUCTION_FINAL_ASSESSMENT_COUNT = 699 as const

export const PRODUCTION_FINAL_ASSESSMENT_SUBJECTS = [
  'arts-and-music',
  'english-language-arts',
  'financial-literacy',
  'health',
  'mathematics',
  'physical-education',
  'ready-for-life',
  'science',
  'social-studies',
  'technology',
] as const

export type ProductionFinalAssessmentSubject =
  (typeof PRODUCTION_FINAL_ASSESSMENT_SUBJECTS)[number]

export type ProductionFinalAssessmentAuthorityClass =
  'AUTO_SCOREABLE' | 'RUBRIC_REQUIRED' | 'GUARDIAN_REQUIRED' | 'COMPLETION_ONLY'

export interface ProductionFinalAssessmentBinding {
  readonly releaseVersion: typeof PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION
  readonly assessmentRef: string
  readonly courseRef: string
  readonly unitRef: string
  readonly grade: number
  readonly subject: ProductionFinalAssessmentSubject
  readonly packageRef: string
  readonly materialSha256: string
}

export interface ProductionFinalAssessmentTask {
  readonly taskRef: string
  readonly kind: string
  readonly prompt: string
  readonly directions?: string
  readonly choices?: readonly string[]
  readonly responseUnit?: string
  readonly standardRef?: string
  readonly possiblePoints?: number
}

export interface ProductionFinalAssessmentProjection {
  readonly schemaVersion: 1
  readonly releaseVersion: typeof PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION
  readonly assessmentRef: string
  readonly courseRef: string
  readonly unitRef: string
  readonly grade: number
  readonly subject: ProductionFinalAssessmentSubject
  readonly unitNumber: number
  readonly unitTitle: string
  readonly courseTitle: string
  readonly assessmentLessonRef: string | null
  readonly instructions: readonly string[]
  readonly learnerTasks: readonly ProductionFinalAssessmentTask[]
  readonly responseMode: string
  readonly completionScoringAuthorityClass: ProductionFinalAssessmentAuthorityClass
  readonly learnerSuccessCriteria: readonly string[]
}

export interface ProductionFinalAssessmentProjectionRequest {
  readonly schemaVersion: 1
  readonly releaseVersion: typeof PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly courseRef: string
  readonly unitRef: string
  readonly grade: number
  readonly subject: ProductionFinalAssessmentSubject
}

type GeneratedBinding = Omit<ProductionFinalAssessmentBinding, 'releaseVersion'>

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{0,199}$/
const SHA256 = /^[0-9a-f]{64}$/
const SUBJECTS = new Set<string>(PRODUCTION_FINAL_ASSESSMENT_SUBJECTS)
const AUTHORITY_CLASSES = new Set<ProductionFinalAssessmentAuthorityClass>([
  'AUTO_SCOREABLE',
  'RUBRIC_REQUIRED',
  'GUARDIAN_REQUIRED',
  'COMPLETION_ONLY',
])
const FORBIDDEN_PROJECTION_KEYS = new Set([
  'adultScoringAuthorityRef',
  'answer',
  'answers',
  'answerIndex',
  'answerKey',
  'answerKeyRef',
  'answerAuthorityRef',
  'correctAnswer',
  'correctChoice',
  'expectedAnswer',
  'scoringGuide',
  'scoringSourceRef',
  'solution',
  'solutions',
])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function safeRef(value: unknown): value is string {
  return typeof value === 'string' && REF.test(value)
}

function keysOnly(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function stringList(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  )
}

function containsForbiddenProjectionKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenProjectionKey)
  if (!record(value)) return false
  return Object.entries(value).some(
    ([key, child]) =>
      FORBIDDEN_PROJECTION_KEYS.has(key) ||
      containsForbiddenProjectionKey(child),
  )
}

function generatedBinding(value: unknown): value is GeneratedBinding {
  if (
    !record(value) ||
    !safeRef(value.assessmentRef) ||
    !safeRef(value.courseRef) ||
    !safeRef(value.unitRef) ||
    !Number.isInteger(value.grade) ||
    !SUBJECTS.has(String(value.subject)) ||
    typeof value.packageRef !== 'string' ||
    !value.packageRef.startsWith(
      'curriculum-production/final/assessments/packages/',
    ) ||
    !SHA256.test(String(value.materialSha256))
  )
    return false
  return true
}

function loadBindings(): readonly ProductionFinalAssessmentBinding[] {
  if (
    !Array.isArray(releaseBindings) ||
    releaseBindings.length !== PRODUCTION_FINAL_ASSESSMENT_COUNT ||
    !releaseBindings.every(generatedBinding)
  ) {
    throw new Error('production_final_assessment_catalog_invalid')
  }
  const seen = new Set<string>()
  const rows = releaseBindings.map((row) => {
    if (seen.has(row.assessmentRef)) {
      throw new Error('production_final_assessment_catalog_duplicate')
    }
    seen.add(row.assessmentRef)
    return Object.freeze({
      releaseVersion: PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION,
      ...row,
    }) as ProductionFinalAssessmentBinding
  })
  return Object.freeze(rows)
}

const BINDINGS = loadBindings()
const BINDINGS_BY_REF = new Map(
  BINDINGS.map((binding) => [binding.assessmentRef, binding]),
)

export function listProductionFinalAssessmentBindings(): readonly ProductionFinalAssessmentBinding[] {
  return BINDINGS
}

export function resolveProductionFinalAssessmentBinding(
  assessmentRef: string,
  releaseVersion: string = PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION,
): ProductionFinalAssessmentBinding | null {
  if (releaseVersion !== PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION)
    return null
  return BINDINGS_BY_REF.get(assessmentRef) ?? null
}

export function createProductionFinalAssessmentProjectionRequest(input: {
  readonly assignmentRef: string
  readonly assessmentRef: string
  readonly releaseVersion?: string
}): ProductionFinalAssessmentProjectionRequest | null {
  if (!safeRef(input.assignmentRef)) return null
  const binding = resolveProductionFinalAssessmentBinding(
    input.assessmentRef,
    input.releaseVersion ?? PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION,
  )
  if (!binding) return null
  return Object.freeze({
    schemaVersion: 1,
    releaseVersion: binding.releaseVersion,
    assignmentRef: input.assignmentRef,
    assessmentRef: binding.assessmentRef,
    courseRef: binding.courseRef,
    unitRef: binding.unitRef,
    grade: binding.grade,
    subject: binding.subject,
  })
}

function parseTask(value: unknown): ProductionFinalAssessmentTask | null {
  if (
    !record(value) ||
    !keysOnly(value, [
      'taskRef',
      'kind',
      'prompt',
      'directions',
      'choices',
      'responseUnit',
      'standardRef',
      'possiblePoints',
    ]) ||
    !safeRef(value.taskRef) ||
    typeof value.kind !== 'string' ||
    !value.kind.trim() ||
    typeof value.prompt !== 'string' ||
    !value.prompt.trim()
  )
    return null
  if (value.directions !== undefined && typeof value.directions !== 'string')
    return null
  if (
    value.choices !== undefined &&
    (!Array.isArray(value.choices) ||
      value.choices.length < 2 ||
      !value.choices.every(
        (choice) => typeof choice === 'string' && choice.trim().length > 0,
      ))
  )
    return null
  if (
    value.responseUnit !== undefined &&
    typeof value.responseUnit !== 'string'
  )
    return null
  if (value.standardRef !== undefined && typeof value.standardRef !== 'string')
    return null
  if (
    value.possiblePoints !== undefined &&
    (typeof value.possiblePoints !== 'number' ||
      !Number.isFinite(value.possiblePoints))
  )
    return null
  return Object.freeze({
    taskRef: value.taskRef,
    kind: value.kind,
    prompt: value.prompt,
    ...(value.directions === undefined ? {} : { directions: value.directions }),
    ...(value.choices === undefined
      ? {}
      : { choices: Object.freeze([...value.choices]) }),
    ...(value.responseUnit === undefined
      ? {}
      : { responseUnit: value.responseUnit }),
    ...(value.standardRef === undefined
      ? {}
      : { standardRef: value.standardRef }),
    ...(value.possiblePoints === undefined
      ? {}
      : { possiblePoints: value.possiblePoints }),
  })
}

/** Parses a learner-safe projection and binds it to the admitted 2.0.0 identity. */
export function parseProductionFinalAssessmentProjection(
  value: unknown,
): ProductionFinalAssessmentProjection | null {
  if (
    !record(value) ||
    !keysOnly(value, [
      'schemaVersion',
      'releaseVersion',
      'assessmentRef',
      'courseRef',
      'unitRef',
      'grade',
      'subject',
      'unitNumber',
      'unitTitle',
      'courseTitle',
      'assessmentLessonRef',
      'instructions',
      'learnerTasks',
      'responseMode',
      'completionScoringAuthorityClass',
      'learnerSuccessCriteria',
    ]) ||
    containsForbiddenProjectionKey(value) ||
    value.schemaVersion !== 1 ||
    value.releaseVersion !== PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION ||
    !safeRef(value.assessmentRef) ||
    !safeRef(value.courseRef) ||
    !safeRef(value.unitRef) ||
    !Number.isInteger(value.grade) ||
    !SUBJECTS.has(String(value.subject)) ||
    !Number.isInteger(value.unitNumber) ||
    Number(value.unitNumber) < 1 ||
    typeof value.unitTitle !== 'string' ||
    !value.unitTitle.trim() ||
    typeof value.courseTitle !== 'string' ||
    !value.courseTitle.trim() ||
    !(
      value.assessmentLessonRef === null || safeRef(value.assessmentLessonRef)
    ) ||
    !stringList(value.instructions) ||
    !stringList(value.learnerSuccessCriteria) ||
    typeof value.responseMode !== 'string' ||
    !value.responseMode.trim() ||
    !AUTHORITY_CLASSES.has(
      value.completionScoringAuthorityClass as ProductionFinalAssessmentAuthorityClass,
    ) ||
    !Array.isArray(value.learnerTasks) ||
    value.learnerTasks.length === 0
  )
    return null
  const binding = resolveProductionFinalAssessmentBinding(value.assessmentRef)
  if (
    !binding ||
    binding.courseRef !== value.courseRef ||
    binding.unitRef !== value.unitRef ||
    binding.grade !== value.grade ||
    binding.subject !== value.subject
  )
    return null
  const tasks = value.learnerTasks.map(parseTask)
  if (
    tasks.some((task) => task === null) ||
    new Set(tasks.map((task) => task?.taskRef)).size !== tasks.length
  )
    return null
  return Object.freeze({
    schemaVersion: 1,
    releaseVersion: PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION,
    assessmentRef: binding.assessmentRef,
    courseRef: binding.courseRef,
    unitRef: binding.unitRef,
    grade: binding.grade,
    subject: binding.subject,
    unitNumber: Number(value.unitNumber),
    unitTitle: value.unitTitle,
    courseTitle: value.courseTitle,
    assessmentLessonRef: value.assessmentLessonRef,
    instructions: Object.freeze([...value.instructions]),
    learnerTasks: Object.freeze(tasks as ProductionFinalAssessmentTask[]),
    responseMode: value.responseMode,
    completionScoringAuthorityClass:
      value.completionScoringAuthorityClass as ProductionFinalAssessmentAuthorityClass,
    learnerSuccessCriteria: Object.freeze([...value.learnerSuccessCriteria]),
  })
}

/**
 * Projects the canonical learner package while removing its restricted adult-authority locator.
 * Scoring content is never read or reconstructed here.
 */
export function projectProductionFinalAssessmentPackage(
  value: unknown,
): ProductionFinalAssessmentProjection | null {
  if (
    !record(value) ||
    value.schemaVersion !== '1.0' ||
    value.kind !== 'canonical-learner-assessment-package' ||
    !safeRef(value.assessmentRef) ||
    !safeRef(value.courseRef) ||
    !Number.isInteger(value.grade) ||
    !SUBJECTS.has(String(value.subject)) ||
    !record(value.location) ||
    !safeRef(value.location.unitRef) ||
    !Number.isInteger(value.location.unitNumber) ||
    typeof value.location.unitTitle !== 'string' ||
    !value.location.unitTitle.trim() ||
    typeof value.location.courseTitle !== 'string' ||
    !value.location.courseTitle.trim() ||
    !(
      value.location.assessmentLessonRef === null ||
      safeRef(value.location.assessmentLessonRef)
    ) ||
    !stringList(value.instructions) ||
    !stringList(value.learnerSuccessCriteria) ||
    !Array.isArray(value.learnerTasks) ||
    value.learnerTasks.length === 0 ||
    typeof value.responseMode !== 'string' ||
    !value.responseMode.trim() ||
    !AUTHORITY_CLASSES.has(
      value.completionScoringAuthorityClass as ProductionFinalAssessmentAuthorityClass,
    ) ||
    typeof value.adultScoringAuthorityRef !== 'string' ||
    !value.adultScoringAuthorityRef.startsWith('restricted:') ||
    !record(value.productionReadiness) ||
    value.productionReadiness.status !== 'READY' ||
    value.productionReadiness.structuralOnly !== false ||
    value.productionReadiness.answerMaterialIncluded !== false
  )
    return null
  const binding = resolveProductionFinalAssessmentBinding(value.assessmentRef)
  if (
    !binding ||
    binding.courseRef !== value.courseRef ||
    binding.unitRef !== value.location.unitRef ||
    binding.grade !== value.grade ||
    binding.subject !== value.subject
  )
    return null
  const learnerMaterial = {
    instructions: value.instructions,
    learnerTasks: value.learnerTasks,
    learnerSuccessCriteria: value.learnerSuccessCriteria,
  }
  if (containsForbiddenProjectionKey(learnerMaterial)) return null
  return parseProductionFinalAssessmentProjection({
    schemaVersion: 1,
    releaseVersion: PRODUCTION_FINAL_ASSESSMENT_RELEASE_VERSION,
    assessmentRef: binding.assessmentRef,
    courseRef: binding.courseRef,
    unitRef: binding.unitRef,
    grade: binding.grade,
    subject: binding.subject,
    unitNumber: value.location.unitNumber,
    unitTitle: value.location.unitTitle,
    courseTitle: value.location.courseTitle,
    assessmentLessonRef: value.location.assessmentLessonRef,
    instructions: value.instructions,
    learnerTasks: value.learnerTasks,
    responseMode: value.responseMode,
    completionScoringAuthorityClass: value.completionScoringAuthorityClass,
    learnerSuccessCriteria: value.learnerSuccessCriteria,
  })
}

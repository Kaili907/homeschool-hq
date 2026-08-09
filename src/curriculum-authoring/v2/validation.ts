import {
  assessmentProtectedInterpretationSchema,
  assessmentSchema,
  courseSchema,
  curriculumManifestSchema,
  lessonSchema,
  mediaResourceSchema,
  policySetSchema,
  protectedAssessmentProjectionSchema,
  protectedLessonProjectionSchema,
  scheduleSchema,
  standardFrameworkSchema,
  studentAssessmentProjectionSchema,
  studentLessonProjectionSchema,
  unitSchema,
  type Assessment,
  type AssessmentProtectedInterpretation,
  type CurriculumAuthoringSet,
  type ExtensionEntry,
  type Lesson,
  type MasteryRequirement,
  type MasteryStrengthening,
  type PolicySet,
  type ProtectedLessonProjection,
  type StudentAssessmentProjection,
  type StudentLessonProjection,
} from './contracts.ts'
import { validateWithSchema, type AuthoringSchema } from './schema.ts'

export type AuthoringIssueCode =
  | 'SHAPE_INVALID'
  | 'DUPLICATE_ID'
  | 'BAD_REFERENCE'
  | 'ORDERING_INVALID'
  | 'COUNT_MISMATCH'
  | 'SCHEDULE_INVALID'
  | 'ASSESSMENT_POINT_MISMATCH'
  | 'STANDARD_REFERENCE_INVALID'
  | 'MASTERY_FLOOR_WEAKENED'
  | 'TUTOR_INVARIANT_VIOLATION'
  | 'ACCESSIBILITY_INVALID'
  | 'SAFETY_PRIVACY_INVALID'
  | 'EXTENSION_INVALID'
  | 'PROJECTION_LEAK'

export interface AuthoringIssue {
  readonly code: AuthoringIssueCode
  readonly path: string
  readonly message: string
}

export interface AuthoringValidationReport {
  readonly valid: boolean
  readonly schema_set_version: '2.0.0'
  readonly issues: readonly AuthoringIssue[]
}

const TRANSFER_STRENGTH = { none: 0, retrieval: 1, 'novel-context': 2 } as const

function add(issues: AuthoringIssue[], code: AuthoringIssueCode, path: string, message: string): void {
  issues.push({ code, path, message })
}

function validateCollection<T>(
  schema: AuthoringSchema<T>,
  values: readonly unknown[],
  path: string,
  issues: AuthoringIssue[],
): void {
  values.forEach((value, index) => {
    const result = validateWithSchema(schema, value)
    if (!result.success) {
      result.issues.forEach((item) =>
        add(issues, 'SHAPE_INVALID', `${path}[${index}]${item.path.slice(1)}`, item.message),
      )
    }
  })
}

function uniqueBy<T>(
  values: readonly T[],
  identity: (value: T) => string,
  path: string,
  issues: AuthoringIssue[],
): Map<string, T> {
  const result = new Map<string, T>()
  values.forEach((value, index) => {
    const key = identity(value)
    if (result.has(key)) add(issues, 'DUPLICATE_ID', `${path}[${index}]`, `duplicate identifier ${key}`)
    else result.set(key, value)
  })
  return result
}

function equalArrays(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function registeredStudentExtensions(
  extensions: readonly ExtensionEntry[] | undefined,
  policy: PolicySet,
): readonly ExtensionEntry[] {
  if (!extensions) return []
  const registry = new Map(policy.extension_namespaces.map((entry) => [entry.namespace, entry]))
  return extensions.filter((entry) => {
    const registration = registry.get(entry.namespace)
    return (
      entry.projection === 'student-safe' &&
      registration?.allowed_projection === 'student-safe' &&
      registration.value_schema_ref === entry.schema_ref
    )
  })
}

export function resolveMastery(
  floor: MasteryRequirement,
  strengthening: MasteryStrengthening,
): MasteryRequirement {
  return {
    policy_ref: floor.policy_ref,
    minimum_occasions: Math.max(floor.minimum_occasions, strengthening.minimum_occasions ?? 0),
    minimum_distinct_dates: Math.max(
      floor.minimum_distinct_dates,
      strengthening.minimum_distinct_dates ?? 0,
    ),
    independent_evidence_required:
      floor.independent_evidence_required || strengthening.independent_evidence_required === true,
    evidence_types: [...new Set([...floor.evidence_types, ...(strengthening.evidence_types ?? [])])],
    transfer_requirement:
      strengthening.transfer_requirement &&
      TRANSFER_STRENGTH[strengthening.transfer_requirement] > TRANSFER_STRENGTH[floor.transfer_requirement]
        ? strengthening.transfer_requirement
        : floor.transfer_requirement,
  }
}

export function projectStudentLesson(lesson: Lesson, policy: PolicySet): StudentLessonProjection {
  return {
    schema_set_version: lesson.schema_set_version,
    lesson_id: lesson.lesson_id,
    course_ref: lesson.course_ref,
    unit_ref: lesson.unit_ref,
    grade: lesson.grade,
    subject: lesson.subject,
    course_day: lesson.course_day,
    day_in_unit: lesson.day_in_unit,
    title: lesson.title,
    phase: lesson.phase,
    focus: lesson.focus,
    estimated_duration: lesson.estimated_duration,
    standards: lesson.standards,
    essential_question: lesson.essential_question,
    learning_objectives: lesson.learning_objectives,
    success_criteria: lesson.success_criteria,
    materials: lesson.materials,
    lesson_flow: lesson.lesson_flow,
    student_activity: lesson.student_activity,
    formative_check: lesson.formative_check,
    ...(lesson.extension_activity ? { extension_activity: lesson.extension_activity } : {}),
    accessibility: lesson.accessibility,
    resource_refs: lesson.resource_refs,
    ...(lesson.home_connection ? { home_connection: lesson.home_connection } : {}),
    extensions: registeredStudentExtensions(lesson.extensions, policy).map((entry) => ({
      namespace: entry.namespace,
      key: entry.key,
      value: entry.value,
    })),
  }
}

export function projectProtectedLesson(lesson: Lesson, policy: PolicySet): ProtectedLessonProjection {
  return {
    schema_set_version: lesson.schema_set_version,
    lesson_id: lesson.lesson_id,
    scoring_guidance: lesson.scoring_guidance,
    mastery: resolveMastery(policy.mastery_floor, lesson.mastery),
    tutor_routes: lesson.tutor_routes,
    safety_privacy: lesson.safety_privacy,
    guardian_visibility_note: lesson.guardian_visibility_note,
    extensions: (lesson.extensions ?? []).filter((entry) => entry.projection === 'protected'),
  }
}

export function projectStudentAssessment(
  assessment: Assessment,
  policy: PolicySet,
): StudentAssessmentProjection {
  return {
    schema_set_version: assessment.schema_set_version,
    assessment_id: assessment.assessment_id,
    course_ref: assessment.course_ref,
    unit_ref: assessment.unit_ref,
    title: assessment.title,
    standards: assessment.standards,
    total_points: assessment.total_points,
    prompts: assessment.prompts,
    rubric_dimensions: assessment.rubric_dimensions,
    accommodation_note: assessment.accommodation_note,
    extensions: registeredStudentExtensions(assessment.extensions, policy).map((entry) => ({
      namespace: entry.namespace,
      key: entry.key,
      value: entry.value,
    })),
  }
}

export function projectProtectedAssessment(
  interpretation: AssessmentProtectedInterpretation,
): AssessmentProtectedInterpretation {
  return {
    schema_set_version: interpretation.schema_set_version,
    interpretation_id: interpretation.interpretation_id,
    assessment_ref: interpretation.assessment_ref,
    secure_minimum_percent: interpretation.secure_minimum_percent,
    developing_minimum_percent: interpretation.developing_minimum_percent,
    not_yet_maximum_percent: interpretation.not_yet_maximum_percent,
    mastery_rule: interpretation.mastery_rule,
    prompt_scoring: interpretation.prompt_scoring,
    ...(interpretation.extensions ? { extensions: interpretation.extensions } : {}),
  }
}

const FORBIDDEN_TUTOR_AUTHORITY_KEYS = new Set([
  'revealsanswers',
  'revealanswers',
  'canrevealanswers',
  'answerreveal',
  'givesfinalgradedanswer',
  'givefinalgradedanswer',
  'finalgradedanswer',
  'providesanswerkey',
  'answerkey',
  'gradedworkpolicy',
  'controlsgradedworkpolicy',
])

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function findForbiddenTutorAuthority(value: unknown, path = '$'): readonly string[] {
  const found: string[] = []
  const visit = (candidate: unknown, candidatePath: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${candidatePath}[${index}]`))
      return
    }
    if (candidate === null || typeof candidate !== 'object') return
    for (const [key, entry] of Object.entries(candidate)) {
      const nextPath = `${candidatePath}.${key}`
      if (FORBIDDEN_TUTOR_AUTHORITY_KEYS.has(normalizedKey(key))) found.push(nextPath)
      visit(entry, nextPath)
    }
  }
  visit(value, path)
  return found
}

function validateExtensions(
  extensions: readonly ExtensionEntry[] | undefined,
  policy: PolicySet,
  path: string,
  issues: AuthoringIssue[],
): void {
  if (!extensions) return
  const registrations = new Map(policy.extension_namespaces.map((entry) => [entry.namespace, entry]))
  extensions.forEach((entry, index) => {
    const registration = registrations.get(entry.namespace)
    const entryPath = `${path}[${index}]`
    if (!registration) {
      add(issues, 'EXTENSION_INVALID', entryPath, `namespace ${entry.namespace} is not registered`)
      return
    }
    if (registration.value_schema_ref !== entry.schema_ref) {
      add(issues, 'EXTENSION_INVALID', `${entryPath}.schema_ref`, 'does not match the registered value schema')
    }
    if (registration.allowed_projection !== entry.projection) {
      add(issues, 'EXTENSION_INVALID', `${entryPath}.projection`, 'does not match the registered projection')
    }
    for (const forbiddenPath of findForbiddenTutorAuthority(entry, entryPath)) {
      add(issues, 'TUTOR_INVARIANT_VIOLATION', forbiddenPath, 'curriculum extensions cannot control Tutor answer authority')
    }
  })
}

function validateStandardReferences(
  references: Lesson['standards'],
  frameworks: Map<string, CurriculumAuthoringSet['standard_frameworks'][number]>,
  path: string,
  issues: AuthoringIssue[],
): void {
  references.forEach((reference, index) => {
    const framework = frameworks.get(reference.framework_ref)
    const referencePath = `${path}[${index}]`
    if (!framework) {
      add(issues, 'STANDARD_REFERENCE_INVALID', `${referencePath}.framework_ref`, 'framework does not exist')
      return
    }
    if (reference.mapping_status === 'canonical') {
      if (!reference.standard_id) {
        add(issues, 'STANDARD_REFERENCE_INVALID', referencePath, 'canonical mappings require standard_id')
      } else if (!framework.standards.some((standard) => standard.standard_id === reference.standard_id)) {
        add(issues, 'STANDARD_REFERENCE_INVALID', `${referencePath}.standard_id`, 'standard does not exist in framework')
      }
    } else if (!reference.legacy_label) {
      add(issues, 'STANDARD_REFERENCE_INVALID', referencePath, 'uncertain mappings must preserve legacy_label')
    }
  })
}

const TUTOR_STRATEGY_BY_SIGNAL = {
  'prerequisite-gap': 'prerequisite-reteach',
  'procedure-without-understanding': 'conceptual-explanation',
  'correct-low-confidence': 'confidence-calibration',
  'repeated-error-pattern': 'error-pattern-contrast',
  'mastery-evidence': 'mastery-evidence-collection',
} as const

export function validateAuthoringSet(input: CurriculumAuthoringSet): AuthoringValidationReport {
  const issues: AuthoringIssue[] = []
  const manifestResult = validateWithSchema(curriculumManifestSchema, input.manifest)
  if (!manifestResult.success) {
    manifestResult.issues.forEach((item) => add(issues, 'SHAPE_INVALID', `manifest${item.path.slice(1)}`, item.message))
  }
  validateCollection(courseSchema, input.courses, 'courses', issues)
  validateCollection(unitSchema, input.units, 'units', issues)
  validateCollection(lessonSchema, input.lessons, 'lessons', issues)
  validateCollection(assessmentSchema, input.assessments, 'assessments', issues)
  validateCollection(
    assessmentProtectedInterpretationSchema,
    input.assessment_interpretations,
    'assessment_interpretations',
    issues,
  )
  validateCollection(scheduleSchema, input.schedules, 'schedules', issues)
  validateCollection(standardFrameworkSchema, input.standard_frameworks, 'standard_frameworks', issues)
  validateCollection(mediaResourceSchema, input.resources, 'resources', issues)
  validateCollection(policySetSchema, input.policy_sets, 'policy_sets', issues)

  const courses = uniqueBy(input.courses, (item) => item.course_id, 'courses', issues)
  const units = uniqueBy(input.units, (item) => item.unit_id, 'units', issues)
  const lessons = uniqueBy(input.lessons, (item) => item.lesson_id, 'lessons', issues)
  const assessments = uniqueBy(input.assessments, (item) => item.assessment_id, 'assessments', issues)
  const interpretations = uniqueBy(
    input.assessment_interpretations,
    (item) => item.interpretation_id,
    'assessment_interpretations',
    issues,
  )
  const schedules = uniqueBy(input.schedules, (item) => item.schedule_id, 'schedules', issues)
  const frameworks = uniqueBy(
    input.standard_frameworks,
    (item) => item.framework_id,
    'standard_frameworks',
    issues,
  )
  const resources = uniqueBy(input.resources, (item) => item.resource_id, 'resources', issues)
  const policies = uniqueBy(input.policy_sets, (item) => item.policy_set_id, 'policy_sets', issues)
  const policy = policies.get(input.manifest.policy_set_ref)
  if (!policy) add(issues, 'BAD_REFERENCE', 'manifest.policy_set_ref', 'policy set does not exist')

  const countPairs: ReadonlyArray<readonly [keyof typeof input.manifest.counts, number]> = [
    ['courses', input.courses.length],
    ['units', input.units.length],
    ['lessons', input.lessons.length],
    ['assessments', input.assessments.length],
    ['schedules', input.schedules.length],
    ['resources', input.resources.length],
  ]
  countPairs.forEach(([key, actual]) => {
    if (input.manifest.counts[key] !== actual) {
      add(issues, 'COUNT_MISMATCH', `manifest.counts.${key}`, `declares ${input.manifest.counts[key]} but found ${actual}`)
    }
  })
  if (!equalArrays(input.manifest.course_refs, input.courses.map((item) => item.course_id))) {
    add(issues, 'ORDERING_INVALID', 'manifest.course_refs', 'must exactly match courses in authoring order')
  }
  if (!equalArrays(input.manifest.schedule_refs, input.schedules.map((item) => item.schedule_id))) {
    add(issues, 'ORDERING_INVALID', 'manifest.schedule_refs', 'must exactly match schedules in authoring order')
  }
  input.manifest.framework_refs.forEach((frameworkRef, index) => {
    if (!frameworks.has(frameworkRef)) add(issues, 'BAD_REFERENCE', `manifest.framework_refs[${index}]`, 'framework does not exist')
  })
  input.manifest.resource_refs.forEach((resourceRef, index) => {
    if (!resources.has(resourceRef)) add(issues, 'BAD_REFERENCE', `manifest.resource_refs[${index}]`, 'resource does not exist')
  })

  input.courses.forEach((course, index) => {
    const expectedUnits = input.units
      .filter((unit) => unit.course_ref === course.course_id)
      .sort((left, right) => left.order - right.order)
    if (!equalArrays(course.unit_refs, expectedUnits.map((unit) => unit.unit_id))) {
      add(issues, 'ORDERING_INVALID', `courses[${index}].unit_refs`, 'must exactly match child units in order')
    }
    validateStandardReferences(course.standards, frameworks, `courses[${index}].standards`, issues)
    if (policy) validateExtensions(course.extensions, policy, `courses[${index}].extensions`, issues)
  })

  input.units.forEach((unit, index) => {
    const course = courses.get(unit.course_ref)
    if (!course) add(issues, 'BAD_REFERENCE', `units[${index}].course_ref`, 'course does not exist')
    else if (unit.grade !== course.grade || unit.subject !== course.subject) {
      add(issues, 'BAD_REFERENCE', `units[${index}]`, 'grade and subject must match the parent course')
    }
    const expectedLessons = input.lessons
      .filter((lesson) => lesson.unit_ref === unit.unit_id)
      .sort((left, right) => left.day_in_unit - right.day_in_unit)
    if (!equalArrays(unit.lesson_refs, expectedLessons.map((lesson) => lesson.lesson_id))) {
      add(issues, 'ORDERING_INVALID', `units[${index}].lesson_refs`, 'must exactly match child lessons in order')
    }
    if (unit.assessment_ref && !assessments.has(unit.assessment_ref)) {
      add(issues, 'BAD_REFERENCE', `units[${index}].assessment_ref`, 'assessment does not exist')
    }
    validateStandardReferences(unit.standards, frameworks, `units[${index}].standards`, issues)
    if (policy) validateExtensions(unit.extensions, policy, `units[${index}].extensions`, issues)
  })

  input.lessons.forEach((lesson, index) => {
    const course = courses.get(lesson.course_ref)
    const unit = units.get(lesson.unit_ref)
    if (!course) add(issues, 'BAD_REFERENCE', `lessons[${index}].course_ref`, 'course does not exist')
    if (!unit) add(issues, 'BAD_REFERENCE', `lessons[${index}].unit_ref`, 'unit does not exist')
    else if (unit.course_ref !== lesson.course_ref || unit.grade !== lesson.grade || unit.subject !== lesson.subject) {
      add(issues, 'BAD_REFERENCE', `lessons[${index}]`, 'course, grade, and subject must match the parent unit')
    }
    if (lesson.estimated_duration.minimum_minutes > lesson.estimated_duration.maximum_minutes) {
      add(issues, 'ORDERING_INVALID', `lessons[${index}].estimated_duration`, 'minimum cannot exceed maximum')
    }
    validateStandardReferences(lesson.standards, frameworks, `lessons[${index}].standards`, issues)
    lesson.resource_refs.forEach((resourceRef, resourceIndex) => {
      if (!resources.has(resourceRef)) add(issues, 'BAD_REFERENCE', `lessons[${index}].resource_refs[${resourceIndex}]`, 'resource does not exist')
    })
    lesson.tutor_routes.forEach((route, routeIndex) => {
      if (TUTOR_STRATEGY_BY_SIGNAL[route.signal] !== route.strategy) {
        add(issues, 'TUTOR_INVARIANT_VIOLATION', `lessons[${index}].tutor_routes[${routeIndex}]`, 'strategy is not allowed for signal')
      }
    })
    for (const forbiddenPath of findForbiddenTutorAuthority(
      { tutor_routes: lesson.tutor_routes, extensions: lesson.extensions },
      `lessons[${index}]`,
    )) {
      add(issues, 'TUTOR_INVARIANT_VIOLATION', forbiddenPath, 'curriculum cannot control Tutor answer authority')
    }
    if (policy) {
      if (lesson.mastery.policy_ref !== policy.policy_set_id) {
        add(issues, 'BAD_REFERENCE', `lessons[${index}].mastery.policy_ref`, 'must reference the active policy set')
      }
      const floor = policy.mastery_floor
      if (
        (lesson.mastery.minimum_occasions !== undefined && lesson.mastery.minimum_occasions < floor.minimum_occasions) ||
        (lesson.mastery.minimum_distinct_dates !== undefined &&
          lesson.mastery.minimum_distinct_dates < floor.minimum_distinct_dates) ||
        (floor.independent_evidence_required && lesson.mastery.independent_evidence_required === false) ||
        (lesson.mastery.transfer_requirement !== undefined &&
          TRANSFER_STRENGTH[lesson.mastery.transfer_requirement] < TRANSFER_STRENGTH[floor.transfer_requirement]) ||
        (lesson.mastery.evidence_types !== undefined &&
          floor.evidence_types.some((evidence) => !lesson.mastery.evidence_types?.includes(evidence)))
      ) {
        add(issues, 'MASTERY_FLOOR_WEAKENED', `lessons[${index}].mastery`, 'lesson requirements cannot weaken the policy floor')
      }
      const effective = resolveMastery(floor, lesson.mastery)
      if (effective.minimum_distinct_dates > effective.minimum_occasions) {
        add(issues, 'MASTERY_FLOOR_WEAKENED', `lessons[${index}].mastery`, 'distinct dates cannot exceed occasions')
      }
      if (lesson.accessibility.policy_ref !== policy.policy_set_id) {
        add(issues, 'ACCESSIBILITY_INVALID', `lessons[${index}].accessibility.policy_ref`, 'must reference the active policy set')
      }
      if (lesson.accessibility.text_fallback !== 'required') {
        add(issues, 'ACCESSIBILITY_INVALID', `lessons[${index}].accessibility.text_fallback`, 'text fallback is required')
      }
      if (lesson.safety_privacy.policy_ref !== policy.policy_set_id) {
        add(issues, 'SAFETY_PRIVACY_INVALID', `lessons[${index}].safety_privacy.policy_ref`, 'must reference the active policy set')
      }
      if (lesson.safety_privacy.stop_conditions.length === 0 || lesson.safety_privacy.privacy_declarations.length === 0) {
        add(issues, 'SAFETY_PRIVACY_INVALID', `lessons[${index}].safety_privacy`, 'stop conditions and privacy declarations are required')
      }
      validateExtensions(lesson.extensions, policy, `lessons[${index}].extensions`, issues)

      const student = projectStudentLesson(lesson, policy)
      const protectedProjection = projectProtectedLesson(lesson, policy)
      const studentResult = validateWithSchema(studentLessonProjectionSchema, student)
      const protectedResult = validateWithSchema(protectedLessonProjectionSchema, protectedProjection)
      if (!studentResult.success || !protectedResult.success) {
        add(issues, 'PROJECTION_LEAK', `lessons[${index}]`, 'generated projections do not satisfy their independent schemas')
      }
      const protectedKeys = ['scoring_guidance', 'mastery', 'tutor_routes', 'safety_privacy', 'guardian_visibility_note']
      const serializedStudent = JSON.stringify(student)
      protectedKeys.forEach((key) => {
        if (serializedStudent.includes(`\"${key}\"`)) add(issues, 'PROJECTION_LEAK', `lessons[${index}]`, `student projection contains ${key}`)
      })
    }
  })

  input.assessments.forEach((assessment, index) => {
    const unit = units.get(assessment.unit_ref)
    if (!courses.has(assessment.course_ref)) add(issues, 'BAD_REFERENCE', `assessments[${index}].course_ref`, 'course does not exist')
    if (!unit || unit.course_ref !== assessment.course_ref) {
      add(issues, 'BAD_REFERENCE', `assessments[${index}].unit_ref`, 'unit does not belong to assessment course')
    }
    const pointSum = assessment.prompts.reduce((sum, prompt) => sum + prompt.points, 0)
    if (pointSum !== assessment.total_points) {
      add(issues, 'ASSESSMENT_POINT_MISMATCH', `assessments[${index}].total_points`, `declares ${assessment.total_points} but prompts sum to ${pointSum}`)
    }
    uniqueBy(assessment.prompts, (prompt) => prompt.prompt_id, `assessments[${index}].prompts`, issues)
    const interpretation = interpretations.get(assessment.protected_interpretation_ref)
    if (!interpretation || interpretation.assessment_ref !== assessment.assessment_id) {
      add(issues, 'BAD_REFERENCE', `assessments[${index}].protected_interpretation_ref`, 'protected interpretation is missing or belongs to another assessment')
    }
    validateStandardReferences(assessment.standards, frameworks, `assessments[${index}].standards`, issues)
    if (policy) {
      validateExtensions(assessment.extensions, policy, `assessments[${index}].extensions`, issues)
      const student = projectStudentAssessment(assessment, policy)
      if (!validateWithSchema(studentAssessmentProjectionSchema, student).success) {
        add(issues, 'PROJECTION_LEAK', `assessments[${index}]`, 'student assessment projection is invalid')
      }
      const serializedStudent = JSON.stringify(student)
      if (serializedStudent.includes('protected_interpretation') || serializedStudent.includes('scoring_guidance')) {
        add(issues, 'PROJECTION_LEAK', `assessments[${index}]`, 'student assessment projection contains protected interpretation')
      }
    }
  })

  input.assessment_interpretations.forEach((interpretation, index) => {
    const assessment = assessments.get(interpretation.assessment_ref)
    if (!assessment) add(issues, 'BAD_REFERENCE', `assessment_interpretations[${index}].assessment_ref`, 'assessment does not exist')
    else {
      const promptIds = new Set(assessment.prompts.map((prompt) => prompt.prompt_id))
      interpretation.prompt_scoring.forEach((entry, scoringIndex) => {
        if (!promptIds.has(entry.prompt_ref)) {
          add(issues, 'BAD_REFERENCE', `assessment_interpretations[${index}].prompt_scoring[${scoringIndex}].prompt_ref`, 'prompt does not exist')
        }
      })
    }
    if (
      interpretation.not_yet_maximum_percent >= interpretation.developing_minimum_percent ||
      interpretation.developing_minimum_percent >= interpretation.secure_minimum_percent
    ) {
      add(issues, 'ORDERING_INVALID', `assessment_interpretations[${index}]`, 'score bands must increase from not-yet to developing to secure')
    }
    if (!validateWithSchema(protectedAssessmentProjectionSchema, projectProtectedAssessment(interpretation)).success) {
      add(issues, 'PROJECTION_LEAK', `assessment_interpretations[${index}]`, 'protected assessment projection is invalid')
    }
    if (policy) validateExtensions(interpretation.extensions, policy, `assessment_interpretations[${index}].extensions`, issues)
  })

  input.standard_frameworks.forEach((framework, index) => {
    const standardIds = uniqueBy(framework.standards, (standard) => standard.standard_id, `standard_frameworks[${index}].standards`, issues)
    framework.standards.forEach((standard, standardIndex) => {
      if (standard.parent_standard_ref && !standardIds.has(standard.parent_standard_ref)) {
        add(issues, 'STANDARD_REFERENCE_INVALID', `standard_frameworks[${index}].standards[${standardIndex}].parent_standard_ref`, 'parent standard does not exist')
      }
    })
  })

  input.resources.forEach((resource, index) => {
    if (!resource.text_fallback.trim()) add(issues, 'ACCESSIBILITY_INVALID', `resources[${index}].text_fallback`, 'resource fallback is required')
    if ((resource.kind === 'audio' || resource.kind === 'video') && !resource.caption_or_transcript) {
      add(issues, 'ACCESSIBILITY_INVALID', `resources[${index}].caption_or_transcript`, 'audio and video require captions or a transcript')
    }
    if (resource.kind === 'image' && !resource.alt_text && !resource.long_description) {
      add(issues, 'ACCESSIBILITY_INVALID', `resources[${index}]`, 'images require alt text or a long description')
    }
  })

  input.schedules.forEach((schedule, index) => {
    const seenSlots = new Set<string>()
    const seenLessons = new Set<string>()
    schedule.entries.forEach((entry, entryIndex) => {
      const slot = `${entry.week}:${entry.day}`
      if (seenSlots.has(slot)) add(issues, 'SCHEDULE_INVALID', `schedules[${index}].entries[${entryIndex}]`, `duplicate schedule slot ${slot}`)
      seenSlots.add(slot)
      if (entry.week > schedule.weeks) add(issues, 'SCHEDULE_INVALID', `schedules[${index}].entries[${entryIndex}].week`, 'week exceeds schedule weeks')
      entry.lesson_refs.forEach((lessonRef, lessonIndex) => {
        const lesson = lessons.get(lessonRef)
        if (!lesson || lesson.grade !== schedule.grade) {
          add(issues, 'SCHEDULE_INVALID', `schedules[${index}].entries[${entryIndex}].lesson_refs[${lessonIndex}]`, 'lesson is missing or belongs to another grade')
        }
        if (seenLessons.has(lessonRef)) add(issues, 'SCHEDULE_INVALID', `schedules[${index}]`, `lesson ${lessonRef} is scheduled more than once`)
        seenLessons.add(lessonRef)
      })
    })
    if (schedule.entries.length !== schedule.instructional_days) {
      add(issues, 'SCHEDULE_INVALID', `schedules[${index}].instructional_days`, `declares ${schedule.instructional_days} but has ${schedule.entries.length} entries`)
    }
    const expected = input.lessons.filter((lesson) => lesson.grade === schedule.grade).map((lesson) => lesson.lesson_id)
    const missing = expected.filter((lessonId) => !seenLessons.has(lessonId))
    if (missing.length) add(issues, 'SCHEDULE_INVALID', `schedules[${index}]`, `does not cover ${missing.length} lessons for grade ${schedule.grade}`)
  })

  input.policy_sets.forEach((item, index) => {
    if (item.mastery_floor.policy_ref !== item.policy_set_id) {
      add(issues, 'BAD_REFERENCE', `policy_sets[${index}].mastery_floor.policy_ref`, 'mastery floor must reference its owning policy set')
    }
    if (item.mastery_floor.minimum_distinct_dates > item.mastery_floor.minimum_occasions) {
      add(issues, 'MASTERY_FLOOR_WEAKENED', `policy_sets[${index}].mastery_floor`, 'distinct dates cannot exceed occasions')
    }
  })

  return { valid: issues.length === 0, schema_set_version: '2.0.0', issues }
}

import {
  arraySchema,
  booleanSchema,
  enumSchema,
  integerSchema,
  literalSchema,
  numberSchema,
  objectSchema,
  oneOfSchema,
  optionalSchema,
  stringSchema,
  type InferSchema,
  type JsonSchema,
} from './schema.ts'

export const CURRICULUM_SCHEMA_SET_VERSION = '2.0.0' as const

const id = stringSchema({ minLength: 3, maxLength: 128, pattern: /^[a-z0-9][a-z0-9:-]*$/ })
const ref = stringSchema({ minLength: 3, maxLength: 128, pattern: /^[a-z0-9][a-z0-9:-]*$/ })
const shortText = stringSchema({ minLength: 1, maxLength: 240 })
const longText = stringSchema({ minLength: 1, maxLength: 12_000 })
const versioned = literalSchema(CURRICULUM_SCHEMA_SET_VERSION)
const subject = enumSchema([
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology',
  'arts-and-music',
  'financial-literacy',
] as const)

export const durationSchema = objectSchema({
  minimum_minutes: integerSchema({ minimum: 1, maximum: 480 }),
  maximum_minutes: integerSchema({ minimum: 1, maximum: 480 }),
})

export const standardReferenceSchema = objectSchema({
  framework_ref: ref,
  standard_id: optionalSchema(ref),
  legacy_label: optionalSchema(stringSchema({ minLength: 1, maxLength: 240 })),
  mapping_status: enumSchema(['canonical', 'unverified', 'human-review'] as const),
})

export const standardSchema = objectSchema({
  standard_id: id,
  code: shortText,
  label: shortText,
  description: optionalSchema(longText),
  parent_standard_ref: optionalSchema(ref),
})

export const standardFrameworkSchema = objectSchema({
  schema_set_version: versioned,
  framework_id: id,
  name: shortText,
  jurisdiction: shortText,
  framework_version: shortText,
  authority_status: enumSchema(['verified', 'reference-only', 'legacy-unverified'] as const),
  standards: arraySchema(standardSchema, { minItems: 1, maxItems: 10_000 }),
})

const evidenceType = enumSchema([
  'worked-example',
  'explanation',
  'error-analysis',
  'application',
  'retrieval',
  'performance',
] as const)

export const masteryRequirementSchema = objectSchema({
  policy_ref: ref,
  minimum_occasions: integerSchema({ minimum: 1, maximum: 20 }),
  minimum_distinct_dates: integerSchema({ minimum: 1, maximum: 20 }),
  independent_evidence_required: booleanSchema(),
  evidence_types: arraySchema(evidenceType, { minItems: 1, uniqueItems: true }),
  transfer_requirement: enumSchema(['none', 'retrieval', 'novel-context'] as const),
})

export const masteryStrengtheningSchema = objectSchema({
  policy_ref: ref,
  minimum_occasions: optionalSchema(integerSchema({ minimum: 1, maximum: 20 })),
  minimum_distinct_dates: optionalSchema(integerSchema({ minimum: 1, maximum: 20 })),
  independent_evidence_required: optionalSchema(booleanSchema()),
  evidence_types: optionalSchema(arraySchema(evidenceType, { minItems: 1, uniqueItems: true })),
  transfer_requirement: optionalSchema(enumSchema(['none', 'retrieval', 'novel-context'] as const)),
})

const tutorSignal = enumSchema([
  'prerequisite-gap',
  'procedure-without-understanding',
  'correct-low-confidence',
  'repeated-error-pattern',
  'mastery-evidence',
] as const)

const tutorStrategy = enumSchema([
  'prerequisite-reteach',
  'conceptual-explanation',
  'confidence-calibration',
  'error-pattern-contrast',
  'mastery-evidence-collection',
] as const)

export const tutorRouteParametersSchema = objectSchema({
  representation: optionalSchema(enumSchema(['text', 'visual', 'concrete', 'worked-example'] as const)),
  retry_count: optionalSchema(integerSchema({ minimum: 0, maximum: 3 })),
  review_timing: optionalSchema(enumSchema(['same-session', 'same-day', 'next-session'] as const)),
  require_explanation: optionalSchema(booleanSchema()),
  evidence_type: optionalSchema(evidenceType),
})

export const tutorRouteSchema = objectSchema({
  signal: tutorSignal,
  strategy: tutorStrategy,
  parameters: tutorRouteParametersSchema,
})

export const accessibilitySchema = objectSchema({
  policy_ref: ref,
  text_fallback: literalSchema('required'),
  keyboard: enumSchema(['required', 'not-applicable'] as const),
  caption_or_transcript: enumSchema(['required-when-media', 'not-applicable'] as const),
  alt_or_long_description: enumSchema(['required-when-visual', 'not-applicable'] as const),
  reduced_motion: enumSchema(['available', 'not-applicable'] as const),
  high_contrast: enumSchema(['available', 'not-applicable'] as const),
  extended_time: booleanSchema(),
  timer_accommodation: enumSchema(['hidden', 'extended', 'untimed', 'not-applicable'] as const),
  movement_break: booleanSchema(),
  response_modes: arraySchema(
    enumSchema(['typed', 'handwritten', 'spoken', 'drawn', 'manipulative', 'demonstrated'] as const),
    { minItems: 1, uniqueItems: true },
  ),
})

export const hazardSchema = objectSchema({
  kind: enumSchema(['physical', 'chemical', 'online', 'financial', 'privacy', 'emotional'] as const),
  description: shortText,
  mitigation: shortText,
})

export const safetyPrivacySchema = objectSchema({
  policy_ref: ref,
  hazards: arraySchema(hazardSchema, { maxItems: 20 }),
  sensitivity: arraySchema(shortText, { maxItems: 20, uniqueItems: true }),
  supervision: enumSchema(['none', 'nearby-adult', 'direct-adult'] as const),
  guardian_visibility: enumSchema(['summary', 'confirmation-required', 'direct-observation'] as const),
  stop_conditions: arraySchema(shortText, { minItems: 1, maxItems: 20 }),
  privacy_declarations: arraySchema(shortText, { minItems: 1, maxItems: 20 }),
  academic_integrity_mode: enumSchema(['practice-support', 'independent-graded', 'collaborative'] as const),
})

const extensionValueSchema = oneOfSchema([
  objectSchema({ type: literalSchema('string'), value: stringSchema({ maxLength: 2_000 }) }),
  objectSchema({ type: literalSchema('number'), value: numberSchema({ minimum: -1_000_000, maximum: 1_000_000 }) }),
  objectSchema({ type: literalSchema('boolean'), value: booleanSchema() }),
  objectSchema({ type: literalSchema('string-list'), value: arraySchema(shortText, { maxItems: 100 }) }),
] as const)

export const extensionEntrySchema = objectSchema({
  namespace: stringSchema({ minLength: 3, maxLength: 128, pattern: /^[a-z][a-z0-9.-]+\/[a-z][a-z0-9.-]+$/ }),
  key: stringSchema({ minLength: 1, maxLength: 128, pattern: /^[a-z][a-z0-9_.-]*$/ }),
  schema_ref: ref,
  projection: enumSchema(['student-safe', 'protected'] as const),
  value: extensionValueSchema,
})

export const extensionNamespaceSchema = objectSchema({
  namespace: stringSchema({ minLength: 3, maxLength: 128, pattern: /^[a-z][a-z0-9.-]+\/[a-z][a-z0-9.-]+$/ }),
  value_schema_ref: ref,
  allowed_projection: enumSchema(['student-safe', 'protected'] as const),
})

export const mediaResourceSchema = objectSchema({
  schema_set_version: versioned,
  resource_id: id,
  kind: enumSchema(['text', 'image', 'audio', 'video', 'interactive', 'document', 'physical'] as const),
  title: shortText,
  locator: stringSchema({ minLength: 1, maxLength: 2_000 }),
  rights: shortText,
  required: booleanSchema(),
  text_fallback: shortText,
  caption_or_transcript: optionalSchema(longText),
  alt_text: optionalSchema(shortText),
  long_description: optionalSchema(longText),
})

export const policySetSchema = objectSchema({
  schema_set_version: versioned,
  policy_set_id: id,
  title: shortText,
  mastery_floor: masteryRequirementSchema,
  tutor_authority: objectSchema({
    reveals_answers: literalSchema(false),
    gives_final_graded_answer: literalSchema(false),
    controls_graded_work_policy: literalSchema(false),
  }),
  safety_privacy: objectSchema({
    non_disableable_prohibitions: arraySchema(shortText, { minItems: 1, uniqueItems: true }),
    required_privacy_declarations: arraySchema(shortText, { minItems: 1, uniqueItems: true }),
  }),
  extension_namespaces: arraySchema(extensionNamespaceSchema, { uniqueItems: true }),
})

export const courseSchema = objectSchema({
  schema_set_version: versioned,
  course_id: id,
  grade: integerSchema({ minimum: 1, maximum: 12 }),
  subject,
  title: shortText,
  description: longText,
  capstone: optionalSchema(longText),
  days: integerSchema({ minimum: 1, maximum: 366 }),
  order: integerSchema({ minimum: 1, maximum: 100 }),
  unit_refs: arraySchema(ref, { minItems: 1, uniqueItems: true }),
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  extensions: optionalSchema(arraySchema(extensionEntrySchema, { uniqueItems: true })),
})

export const unitSchema = objectSchema({
  schema_set_version: versioned,
  unit_id: id,
  course_ref: ref,
  grade: integerSchema({ minimum: 1, maximum: 12 }),
  subject,
  order: integerSchema({ minimum: 1, maximum: 100 }),
  title: shortText,
  days: integerSchema({ minimum: 1, maximum: 366 }),
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  essential_question: longText,
  topics: arraySchema(shortText, { minItems: 1, uniqueItems: true }),
  performance_task: longText,
  lesson_refs: arraySchema(ref, { minItems: 1, uniqueItems: true }),
  assessment_ref: optionalSchema(ref),
  extensions: optionalSchema(arraySchema(extensionEntrySchema, { uniqueItems: true })),
})

export const lessonFlowSegmentSchema = objectSchema({
  segment_id: id,
  title: shortText,
  duration: durationSchema,
  teacher_or_tutor_action: longText,
})

export const lessonSchema = objectSchema({
  schema_set_version: versioned,
  lesson_id: id,
  course_ref: ref,
  unit_ref: ref,
  grade: integerSchema({ minimum: 1, maximum: 12 }),
  subject,
  course_day: integerSchema({ minimum: 1, maximum: 366 }),
  day_in_unit: integerSchema({ minimum: 1, maximum: 366 }),
  title: shortText,
  phase: shortText,
  focus: longText,
  estimated_duration: durationSchema,
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  essential_question: longText,
  learning_objectives: arraySchema(longText, { minItems: 1, maxItems: 30 }),
  success_criteria: arraySchema(longText, { minItems: 1, maxItems: 30 }),
  materials: arraySchema(shortText, { maxItems: 100 }),
  lesson_flow: arraySchema(lessonFlowSegmentSchema, { minItems: 1, maxItems: 30 }),
  student_activity: longText,
  formative_check: longText,
  scoring_guidance: longText,
  mastery: masteryStrengtheningSchema,
  tutor_routes: arraySchema(tutorRouteSchema, { maxItems: 20 }),
  extension_activity: optionalSchema(longText),
  accessibility: accessibilitySchema,
  safety_privacy: safetyPrivacySchema,
  resource_refs: arraySchema(ref, { uniqueItems: true }),
  guardian_visibility_note: longText,
  home_connection: optionalSchema(longText),
  extensions: optionalSchema(arraySchema(extensionEntrySchema, { uniqueItems: true })),
})

export const assessmentPromptSchema = objectSchema({
  prompt_id: id,
  type: enumSchema([
    'concept-vocabulary',
    'representation-source',
    'application',
    'error-claim-analysis',
    'connection',
    'performance-evidence',
    'reflection-transfer',
    'other',
  ] as const),
  prompt: longText,
  points: integerSchema({ minimum: 0, maximum: 1_000 }),
  resource_refs: arraySchema(ref, { uniqueItems: true }),
})

export const assessmentSchema = objectSchema({
  schema_set_version: versioned,
  assessment_id: id,
  course_ref: ref,
  unit_ref: ref,
  title: shortText,
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  total_points: integerSchema({ minimum: 1, maximum: 100_000 }),
  prompts: arraySchema(assessmentPromptSchema, { minItems: 1, maxItems: 500 }),
  rubric_dimensions: arraySchema(shortText, { minItems: 1, maxItems: 50 }),
  accommodation_note: longText,
  protected_interpretation_ref: ref,
  extensions: optionalSchema(arraySchema(extensionEntrySchema, { uniqueItems: true })),
})

export const promptScoringSchema = objectSchema({
  prompt_ref: ref,
  scoring_guidance: longText,
})

export const assessmentProtectedInterpretationSchema = objectSchema({
  schema_set_version: versioned,
  interpretation_id: id,
  assessment_ref: ref,
  secure_minimum_percent: numberSchema({ minimum: 0, maximum: 100 }),
  developing_minimum_percent: numberSchema({ minimum: 0, maximum: 100 }),
  not_yet_maximum_percent: numberSchema({ minimum: 0, maximum: 100 }),
  mastery_rule: longText,
  prompt_scoring: arraySchema(promptScoringSchema, { minItems: 1 }),
  extensions: optionalSchema(arraySchema(extensionEntrySchema, { uniqueItems: true })),
})

export const scheduleEntrySchema = objectSchema({
  week: integerSchema({ minimum: 1, maximum: 53 }),
  day: integerSchema({ minimum: 1, maximum: 7 }),
  lesson_refs: arraySchema(ref, { uniqueItems: true }),
})

export const scheduleSchema = objectSchema({
  schema_set_version: versioned,
  schedule_id: id,
  grade: integerSchema({ minimum: 1, maximum: 12 }),
  weeks: integerSchema({ minimum: 1, maximum: 53 }),
  instructional_days: integerSchema({ minimum: 1, maximum: 366 }),
  entries: arraySchema(scheduleEntrySchema, { minItems: 1, maxItems: 366 }),
})

export const curriculumManifestSchema = objectSchema({
  schema_set_version: versioned,
  curriculum_id: id,
  draft_version: stringSchema({ minLength: 5, maxLength: 64, pattern: /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/ }),
  status: enumSchema(['draft', 'in-review'] as const),
  title: shortText,
  policy_set_ref: ref,
  framework_refs: arraySchema(ref, { minItems: 1, uniqueItems: true }),
  course_refs: arraySchema(ref, { minItems: 1, uniqueItems: true }),
  schedule_refs: arraySchema(ref, { minItems: 1, uniqueItems: true }),
  resource_refs: arraySchema(ref, { uniqueItems: true }),
  counts: objectSchema({
    courses: integerSchema({ minimum: 1 }),
    units: integerSchema({ minimum: 1 }),
    lessons: integerSchema({ minimum: 1 }),
    assessments: integerSchema({ minimum: 0 }),
    schedules: integerSchema({ minimum: 1 }),
    resources: integerSchema({ minimum: 0 }),
  }),
})

const studentExtensionSchema = objectSchema({
  namespace: stringSchema({ minLength: 3, maxLength: 128, pattern: /^[a-z][a-z0-9.-]+\/[a-z][a-z0-9.-]+$/ }),
  key: stringSchema({ minLength: 1, maxLength: 128, pattern: /^[a-z][a-z0-9_.-]*$/ }),
  value: extensionValueSchema,
})

export const studentLessonProjectionSchema = objectSchema({
  schema_set_version: versioned,
  lesson_id: id,
  course_ref: ref,
  unit_ref: ref,
  grade: integerSchema({ minimum: 1, maximum: 12 }),
  subject,
  course_day: integerSchema({ minimum: 1, maximum: 366 }),
  day_in_unit: integerSchema({ minimum: 1, maximum: 366 }),
  title: shortText,
  phase: shortText,
  focus: longText,
  estimated_duration: durationSchema,
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  essential_question: longText,
  learning_objectives: arraySchema(longText, { minItems: 1, maxItems: 30 }),
  success_criteria: arraySchema(longText, { minItems: 1, maxItems: 30 }),
  materials: arraySchema(shortText, { maxItems: 100 }),
  lesson_flow: arraySchema(lessonFlowSegmentSchema, { minItems: 1, maxItems: 30 }),
  student_activity: longText,
  formative_check: longText,
  extension_activity: optionalSchema(longText),
  accessibility: accessibilitySchema,
  resource_refs: arraySchema(ref, { uniqueItems: true }),
  home_connection: optionalSchema(longText),
  extensions: arraySchema(studentExtensionSchema, { uniqueItems: true }),
})

export const protectedLessonProjectionSchema = objectSchema({
  schema_set_version: versioned,
  lesson_id: id,
  scoring_guidance: longText,
  mastery: masteryRequirementSchema,
  tutor_routes: arraySchema(tutorRouteSchema, { maxItems: 20 }),
  safety_privacy: safetyPrivacySchema,
  guardian_visibility_note: longText,
  extensions: arraySchema(extensionEntrySchema, { uniqueItems: true }),
})

export const studentAssessmentProjectionSchema = objectSchema({
  schema_set_version: versioned,
  assessment_id: id,
  course_ref: ref,
  unit_ref: ref,
  title: shortText,
  standards: arraySchema(standardReferenceSchema, { minItems: 1 }),
  total_points: integerSchema({ minimum: 1, maximum: 100_000 }),
  prompts: arraySchema(assessmentPromptSchema, { minItems: 1, maxItems: 500 }),
  rubric_dimensions: arraySchema(shortText, { minItems: 1, maxItems: 50 }),
  accommodation_note: longText,
  extensions: arraySchema(studentExtensionSchema, { uniqueItems: true }),
})

export const protectedAssessmentProjectionSchema = assessmentProtectedInterpretationSchema

export type CurriculumManifest = InferSchema<typeof curriculumManifestSchema>
export type Course = InferSchema<typeof courseSchema>
export type Unit = InferSchema<typeof unitSchema>
export type Lesson = InferSchema<typeof lessonSchema>
export type Assessment = InferSchema<typeof assessmentSchema>
export type AssessmentProtectedInterpretation = InferSchema<typeof assessmentProtectedInterpretationSchema>
export type Schedule = InferSchema<typeof scheduleSchema>
export type StandardFramework = InferSchema<typeof standardFrameworkSchema>
export type StandardReference = InferSchema<typeof standardReferenceSchema>
export type MasteryRequirement = InferSchema<typeof masteryRequirementSchema>
export type MasteryStrengthening = InferSchema<typeof masteryStrengtheningSchema>
export type TutorRoute = InferSchema<typeof tutorRouteSchema>
export type Accessibility = InferSchema<typeof accessibilitySchema>
export type SafetyPrivacy = InferSchema<typeof safetyPrivacySchema>
export type MediaResource = InferSchema<typeof mediaResourceSchema>
export type PolicySet = InferSchema<typeof policySetSchema>
export type ExtensionEntry = InferSchema<typeof extensionEntrySchema>
export type StudentLessonProjection = InferSchema<typeof studentLessonProjectionSchema>
export type ProtectedLessonProjection = InferSchema<typeof protectedLessonProjectionSchema>
export type StudentAssessmentProjection = InferSchema<typeof studentAssessmentProjectionSchema>

export interface CurriculumAuthoringSet {
  readonly manifest: CurriculumManifest
  readonly courses: readonly Course[]
  readonly units: readonly Unit[]
  readonly lessons: readonly Lesson[]
  readonly assessments: readonly Assessment[]
  readonly assessment_interpretations: readonly AssessmentProtectedInterpretation[]
  readonly schedules: readonly Schedule[]
  readonly standard_frameworks: readonly StandardFramework[]
  readonly resources: readonly MediaResource[]
  readonly policy_sets: readonly PolicySet[]
}

export const curriculumSchemaSetJson: JsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/curriculum-authoring/2.0.0/schema-set.json',
  title: 'Manuel Academy Curriculum Authoring Schema Set 2.0.0',
  schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
  $defs: {
    curriculum_manifest: curriculumManifestSchema.jsonSchema,
    course: courseSchema.jsonSchema,
    unit: unitSchema.jsonSchema,
    lesson: lessonSchema.jsonSchema,
    assessment: assessmentSchema.jsonSchema,
    assessment_protected_interpretation: assessmentProtectedInterpretationSchema.jsonSchema,
    schedule: scheduleSchema.jsonSchema,
    standard_framework: standardFrameworkSchema.jsonSchema,
    standard_reference: standardReferenceSchema.jsonSchema,
    mastery: masteryRequirementSchema.jsonSchema,
    tutor_route: tutorRouteSchema.jsonSchema,
    accessibility: accessibilitySchema.jsonSchema,
    safety_privacy: safetyPrivacySchema.jsonSchema,
    media_resource: mediaResourceSchema.jsonSchema,
    policy_set: policySetSchema.jsonSchema,
    student_lesson_projection: studentLessonProjectionSchema.jsonSchema,
    protected_lesson_projection: protectedLessonProjectionSchema.jsonSchema,
    student_assessment_projection: studentAssessmentProjectionSchema.jsonSchema,
    protected_assessment_projection: protectedAssessmentProjectionSchema.jsonSchema,
  },
}

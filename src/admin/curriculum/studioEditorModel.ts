import {
  CURRICULUM_AUTHORING_SCHEMA_VERSION,
  type CurriculumDraftEntityPayload,
  type CurriculumDraftEntityType,
  type CurriculumStudioEntityIndexEntry,
} from '../curriculum-authoring/contracts'

export const CURRICULUM_ENTITY_REF_PATTERN = /^[a-z0-9][a-z0-9:-]{2,127}$/

const SUBJECTS = [
  'mathematics', 'english-language-arts', 'science', 'social-studies', 'health',
  'physical-education', 'ready-for-life', 'technology', 'arts-and-music', 'financial-literacy',
] as const

const OPTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  subject: SUBJECTS,
  kind: ['text', 'image', 'audio', 'video', 'interactive', 'document', 'physical'],
  mapping_status: ['canonical', 'unverified', 'human-review'],
  type: [
    'concept-vocabulary', 'representation-source', 'application', 'error-claim-analysis',
    'connection', 'performance-evidence', 'reflection-transfer', 'other',
  ],
  signal: [
    'prerequisite-gap', 'procedure-without-understanding', 'correct-low-confidence',
    'repeated-error-pattern', 'mastery-evidence',
  ],
  strategy: [
    'prerequisite-reteach', 'conceptual-explanation', 'confidence-calibration',
    'error-pattern-contrast', 'mastery-evidence-collection',
  ],
  representation: ['text', 'visual', 'concrete', 'worked-example'],
  review_timing: ['same-session', 'same-day', 'next-session'],
  evidence_type: ['worked-example', 'explanation', 'error-analysis', 'application', 'retrieval', 'performance'],
  text_fallback: ['required'],
  keyboard: ['required', 'not-applicable'],
  caption_or_transcript: ['required-when-media', 'not-applicable'],
  alt_or_long_description: ['required-when-visual', 'not-applicable'],
  reduced_motion: ['available', 'not-applicable'],
  high_contrast: ['available', 'not-applicable'],
  timer_accommodation: ['hidden', 'extended', 'untimed', 'not-applicable'],
  supervision: ['none', 'nearby-adult', 'direct-adult'],
  guardian_visibility: ['summary', 'confirmation-required', 'direct-observation'],
  academic_integrity_mode: ['practice-support', 'independent-graded', 'collaborative'],
})

const ARRAY_DEFAULTS: Readonly<Record<string, unknown>> = Object.freeze({
  standards: {
    framework_ref: 'manuel-academy-legacy-standards-v1',
    legacy_label: 'Human mapping required',
    mapping_status: 'human-review',
  },
  lesson_flow: {
    segment_id: 'new-segment',
    title: 'New segment',
    duration: { minimum_minutes: 5, maximum_minutes: 10 },
    teacher_or_tutor_action: 'Describe the instructional action.',
  },
  prompts: {
    prompt_id: 'new-prompt',
    type: 'other',
    prompt: 'Enter the assessment prompt.',
    points: 1,
    resource_refs: [],
  },
  tutor_routes: {
    signal: 'prerequisite-gap',
    strategy: 'prerequisite-reteach',
    parameters: { representation: 'worked-example', retry_count: 1 },
  },
  hazards: {
    kind: 'physical',
    description: 'Describe the hazard.',
    mitigation: 'Describe the mitigation.',
  },
  response_modes: 'typed',
  evidence_types: 'application',
  extensions: {
    namespace: 'manuel.academy/draft',
    key: 'authoring-note',
    schema_ref: 'manuel-academy-extension-string-v1',
    projection: 'student-safe',
    value: { type: 'string', value: 'Describe the extension value.' },
  },
})

const OPTIONAL_DEFAULTS: Readonly<Record<CurriculumDraftEntityType, Readonly<Record<string, unknown>>>> = Object.freeze({
  course: { capstone: 'Describe the capstone experience.', extensions: [] },
  unit: { assessment_ref: 'assessment-mapping-required', extensions: [] },
  lesson: {
    extension_activity: 'Describe the extension activity.',
    home_connection: 'Describe the optional home connection.',
    extensions: [],
  },
  assessment: { extensions: [] },
  media_resource: {
    caption_or_transcript: 'Provide a caption or transcript.',
    alt_text: 'Provide concise alternative text.',
    long_description: 'Provide a detailed long description.',
  },
})

function standardReference() {
  return {
    framework_ref: 'manuel-academy-legacy-standards-v1',
    legacy_label: 'Human mapping required',
    mapping_status: 'human-review' as const,
  }
}

function selectedParent(
  entityType: CurriculumDraftEntityType,
  selected: CurriculumStudioEntityIndexEntry | null,
  entries: readonly CurriculumStudioEntityIndexEntry[],
): CurriculumStudioEntityIndexEntry | null {
  if (entityType === 'unit') {
    if (selected?.entityType === 'course') return selected
    const courseRef = selected?.courseRef
    return entries.find((entry) => entry.entityType === 'course' && entry.entityRef === courseRef)
      ?? entries.find((entry) => entry.entityType === 'course')
      ?? null
  }
  if (entityType === 'lesson' || entityType === 'assessment') {
    if (selected?.entityType === 'unit') return selected
    const unitRef = selected?.unitRef ?? (selected?.entityType === 'lesson' || selected?.entityType === 'assessment' ? selected.unitRef : undefined)
    return entries.find((entry) => entry.entityType === 'unit' && entry.entityRef === unitRef)
      ?? entries.find((entry) => entry.entityType === 'unit')
      ?? null
  }
  return null
}

export function createDraftEntityPayload(
  entityType: CurriculumDraftEntityType,
  entityRef: string,
  selected: CurriculumStudioEntityIndexEntry | null,
  entries: readonly CurriculumStudioEntityIndexEntry[],
): CurriculumDraftEntityPayload {
  const parent = selectedParent(entityType, selected, entries)
  const grade = parent?.grade ?? 5
  const subject = (parent?.subject ?? 'mathematics') as (typeof SUBJECTS)[number]
  const courseRef = parent?.entityType === 'course'
    ? parent.entityRef
    : parent?.courseRef ?? entries.find((entry) => entry.entityType === 'course')?.entityRef ?? 'course-mapping-required'
  const unitRef = parent?.entityType === 'unit'
    ? parent.entityRef
    : entries.find((entry) => entry.entityType === 'unit' && entry.courseRef === courseRef)?.entityRef ?? 'unit-mapping-required'
  if (entityType === 'course') {
    return {
      schema_set_version: CURRICULUM_AUTHORING_SCHEMA_VERSION,
      course_id: entityRef,
      grade,
      subject,
      title: 'New course',
      description: 'Describe the scope and purpose of this course.',
      days: 1,
      order: Math.max(1, entries.filter((entry) => entry.entityType === 'course').length + 1),
      unit_refs: [`${entityRef}-unit-01`],
      standards: [standardReference()],
    }
  }
  if (entityType === 'unit') {
    return {
      schema_set_version: CURRICULUM_AUTHORING_SCHEMA_VERSION,
      unit_id: entityRef,
      course_ref: courseRef,
      grade,
      subject,
      order: Math.max(1, entries.filter((entry) => entry.entityType === 'unit' && entry.courseRef === courseRef).length + 1),
      title: 'New unit',
      days: 1,
      standards: [standardReference()],
      essential_question: 'What essential question will guide this unit?',
      topics: ['Topic mapping required'],
      performance_task: 'Describe the unit performance task.',
      lesson_refs: [`${entityRef}-lesson-01`],
    }
  }
  if (entityType === 'lesson') {
    return {
      schema_set_version: CURRICULUM_AUTHORING_SCHEMA_VERSION,
      lesson_id: entityRef,
      course_ref: courseRef,
      unit_ref: unitRef,
      grade,
      subject,
      course_day: 1,
      day_in_unit: 1,
      title: 'New lesson',
      phase: 'Draft',
      focus: 'Describe the lesson focus.',
      estimated_duration: { minimum_minutes: 30, maximum_minutes: 45 },
      standards: [standardReference()],
      essential_question: 'What question will guide this lesson?',
      learning_objectives: ['Describe the learning objective.'],
      success_criteria: ['Describe observable success.'],
      materials: [],
      lesson_flow: [{
        segment_id: `${entityRef}-segment-01`,
        title: 'Instruction',
        duration: { minimum_minutes: 30, maximum_minutes: 45 },
        teacher_or_tutor_action: 'Describe the instructional action.',
      }],
      student_activity: 'Describe the learner activity.',
      formative_check: 'Describe the formative check.',
      scoring_guidance: 'Describe protected scoring guidance.',
      mastery: { policy_ref: 'manuel-academy-global-policy-v2' },
      tutor_routes: [],
      accessibility: {
        policy_ref: 'manuel-academy-global-policy-v2',
        text_fallback: 'required', keyboard: 'required',
        caption_or_transcript: 'required-when-media', alt_or_long_description: 'required-when-visual',
        reduced_motion: 'available', high_contrast: 'available', extended_time: true,
        timer_accommodation: 'hidden', movement_break: true, response_modes: ['typed'],
      },
      safety_privacy: {
        policy_ref: 'manuel-academy-global-policy-v2', hazards: [], sensitivity: [],
        supervision: 'none', guardian_visibility: 'summary',
        stop_conditions: ['Stop when the learner requests a break or the activity becomes unsafe.'],
        privacy_declarations: ['Collect only the minimum instructional evidence.'],
        academic_integrity_mode: 'practice-support',
      },
      resource_refs: [],
      guardian_visibility_note: 'Share a high-level learning summary only.',
    }
  }
  if (entityType === 'assessment') {
    return {
      schema_set_version: CURRICULUM_AUTHORING_SCHEMA_VERSION,
      assessment_id: entityRef,
      course_ref: courseRef,
      unit_ref: unitRef,
      title: 'New assessment',
      standards: [standardReference()],
      total_points: 1,
      prompts: [{
        prompt_id: `${entityRef}-prompt-01`, type: 'other',
        prompt: 'Enter the assessment prompt.', points: 1, resource_refs: [],
      }],
      rubric_dimensions: ['Describe the rubric dimension.'],
      accommodation_note: 'Provide the accommodations declared by the learner policy.',
      protected_interpretation_ref: `${entityRef}-interpretation`,
    }
  }
  return {
    schema_set_version: CURRICULUM_AUTHORING_SCHEMA_VERSION,
    resource_id: entityRef,
    kind: 'text',
    title: 'New media resource',
    locator: 'authoring-locator-required',
    rights: 'Rights review required before publication.',
    required: false,
    text_fallback: 'Provide an equivalent text fallback.',
  }
}

export function isProtectedAuthoringPath(path: readonly (string | number)[]): boolean {
  const key = String(path.at(-1) ?? '')
  return key === 'schema_set_version'
    || key.endsWith('_id')
    || key === 'protected_interpretation_ref'
}

export function authoringFieldOptions(path: readonly (string | number)[]): readonly string[] | undefined {
  const key = String(path.at(-1) ?? '')
  const parent = String(path.at(-2) ?? '')
  if (key === 'kind' && path.includes('hazards')) {
    return ['physical', 'chemical', 'online', 'financial', 'privacy', 'emotional']
  }
  if (key === 'type' && path.includes('extensions')) return ['string', 'number', 'boolean', 'string-list']
  if (parent === 'response_modes') return ['typed', 'handwritten', 'spoken', 'drawn', 'manipulative', 'demonstrated']
  if (parent === 'evidence_types') return ['worked-example', 'explanation', 'error-analysis', 'application', 'retrieval', 'performance']
  return OPTIONS[key]
}

export function authoringArrayItemDefault(
  path: readonly (string | number)[],
  root?: CurriculumDraftEntityPayload,
  nextIndex = 0,
): unknown {
  const key = String(path.at(-1) ?? '')
  const configured = ARRAY_DEFAULTS[key]
  if (configured !== undefined) {
    const value = structuredClone(configured) as Record<string, unknown>
    if (root && key === 'lesson_flow') value.segment_id = `${entityIdentity(root)}-segment-${String(nextIndex + 1).padStart(2, '0')}`
    if (root && key === 'prompts') value.prompt_id = `${entityIdentity(root)}-prompt-${String(nextIndex + 1).padStart(2, '0')}`
    return value
  }
  return ''
}

function entityIdentity(payload: CurriculumDraftEntityPayload): string {
  const value = payload as unknown as Record<string, unknown>
  return String(value.course_id ?? value.unit_id ?? value.lesson_id ?? value.assessment_id ?? value.resource_id ?? 'draft-entity')
}

export function missingOptionalAuthoringFields(
  entityType: CurriculumDraftEntityType,
  payload: CurriculumDraftEntityPayload,
): readonly { readonly key: string; readonly value: unknown }[] {
  const record = payload as unknown as Record<string, unknown>
  return Object.entries(OPTIONAL_DEFAULTS[entityType])
    .filter(([key]) => !Object.hasOwn(record, key))
    .map(([key, value]) => ({ key, value: structuredClone(value) }))
}

export function authoringFieldLabel(key: string): string {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase())
}

export function updateAuthoringValue(
  root: CurriculumDraftEntityPayload,
  path: readonly (string | number)[],
  value: unknown,
): CurriculumDraftEntityPayload {
  const clone = structuredClone(root) as unknown as Record<string, unknown>
  let target: Record<string | number, unknown> | unknown[] = clone
  path.slice(0, -1).forEach((segment) => {
    target = target[segment as keyof typeof target] as Record<string | number, unknown> | unknown[]
  })
  target[path.at(-1)! as keyof typeof target] = value
  return clone as unknown as CurriculumDraftEntityPayload
}

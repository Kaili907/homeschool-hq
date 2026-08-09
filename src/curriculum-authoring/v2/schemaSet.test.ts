import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CURRICULUM_SCHEMA_SET_VERSION,
  curriculumSchemaSetJson,
  studentLessonProjectionSchema,
  type CurriculumAuthoringSet,
} from './contracts.ts'
import { classifySemanticDiff } from './semanticDiff.ts'
import { validateWithSchema } from './schema.ts'
import {
  findForbiddenTutorAuthority,
  projectStudentLesson,
  resolveMastery,
  validateAuthoringSet,
} from './validation.ts'
import { importImmutableV1 } from './v1Importer.node.ts'

const POLICY_ID = 'academy-policy-v2'

function validAuthoringSet(): CurriculumAuthoringSet {
  return {
    manifest: {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      curriculum_id: 'test-curriculum',
      draft_version: '2.0.0-test',
      status: 'draft',
      title: 'Test curriculum',
      policy_set_ref: POLICY_ID,
      framework_refs: ['test-framework'],
      course_refs: ['test-course'],
      schedule_refs: ['test-schedule'],
      resource_refs: ['test-resource'],
      counts: { courses: 1, units: 1, lessons: 1, assessments: 1, schedules: 1, resources: 1 },
    },
    policy_sets: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        policy_set_id: POLICY_ID,
        title: 'Academy global policy',
        mastery_floor: {
          policy_ref: POLICY_ID,
          minimum_occasions: 2,
          minimum_distinct_dates: 2,
          independent_evidence_required: true,
          evidence_types: ['application', 'explanation'],
          transfer_requirement: 'retrieval',
        },
        tutor_authority: {
          reveals_answers: false,
          gives_final_graded_answer: false,
          controls_graded_work_policy: false,
        },
        safety_privacy: {
          non_disableable_prohibitions: ['Never require a private disclosure.'],
          required_privacy_declarations: ['Collect only the minimum instructional evidence.'],
        },
        extension_namespaces: [
          {
            namespace: 'manuel/student',
            value_schema_ref: 'extension-schema-student',
            allowed_projection: 'student-safe',
          },
          {
            namespace: 'manuel/admin',
            value_schema_ref: 'extension-schema-admin',
            allowed_projection: 'protected',
          },
        ],
      },
    ],
    standard_frameworks: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        framework_id: 'test-framework',
        name: 'Test standards',
        jurisdiction: 'Test jurisdiction',
        framework_version: '2026',
        authority_status: 'verified',
        standards: [{ standard_id: 'standard-one', code: 'T.1', label: 'Test standard one' }],
      },
    ],
    resources: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        resource_id: 'test-resource',
        kind: 'text',
        title: 'Readable source',
        locator: 'resources/test-resource.txt',
        rights: 'Locally authored',
        required: false,
        text_fallback: 'The resource is already readable text.',
      },
    ],
    courses: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        course_id: 'test-course',
        grade: 5,
        subject: 'mathematics',
        title: 'Test mathematics',
        description: 'A test course used to validate the authoring schema set.',
        days: 1,
        order: 1,
        unit_refs: ['test-unit'],
        standards: [{ framework_ref: 'test-framework', standard_id: 'standard-one', mapping_status: 'canonical' }],
      },
    ],
    units: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        unit_id: 'test-unit',
        course_ref: 'test-course',
        grade: 5,
        subject: 'mathematics',
        order: 1,
        title: 'Test unit',
        days: 1,
        standards: [{ framework_ref: 'test-framework', standard_id: 'standard-one', mapping_status: 'canonical' }],
        essential_question: 'How can a learner demonstrate the target?',
        topics: ['testing'],
        performance_task: 'Demonstrate the target and explain the evidence.',
        lesson_refs: ['test-lesson'],
        assessment_ref: 'test-assessment',
      },
    ],
    lessons: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        lesson_id: 'test-lesson',
        course_ref: 'test-course',
        unit_ref: 'test-unit',
        grade: 5,
        subject: 'mathematics',
        course_day: 1,
        day_in_unit: 1,
        title: 'Test lesson',
        phase: 'Launch',
        focus: 'Reason from evidence.',
        estimated_duration: { minimum_minutes: 30, maximum_minutes: 45 },
        standards: [{ framework_ref: 'test-framework', standard_id: 'standard-one', mapping_status: 'canonical' }],
        essential_question: 'What evidence supports the result?',
        learning_objectives: ['Explain the result using evidence.'],
        success_criteria: ['The response includes an accurate result and an explanation.'],
        materials: ['notebook'],
        lesson_flow: [
          {
            segment_id: 'test-segment',
            title: 'Independent application',
            duration: { minimum_minutes: 30, maximum_minutes: 45 },
            teacher_or_tutor_action: 'Invite an independent attempt and ask for evidence.',
          },
        ],
        student_activity: 'Complete a fresh application and explain the reasoning.',
        formative_check: 'Show the result and name one check.',
        scoring_guidance: 'Score the stated target and accept multiple valid approaches.',
        mastery: { policy_ref: POLICY_ID, minimum_occasions: 3, minimum_distinct_dates: 2 },
        tutor_routes: [
          {
            signal: 'prerequisite-gap',
            strategy: 'prerequisite-reteach',
            parameters: { representation: 'concrete', retry_count: 1 },
          },
        ],
        extension_activity: 'Apply the idea under a new constraint.',
        accessibility: {
          policy_ref: POLICY_ID,
          text_fallback: 'required',
          keyboard: 'required',
          caption_or_transcript: 'required-when-media',
          alt_or_long_description: 'required-when-visual',
          reduced_motion: 'available',
          high_contrast: 'available',
          extended_time: true,
          timer_accommodation: 'hidden',
          movement_break: true,
          response_modes: ['typed', 'spoken'],
        },
        safety_privacy: {
          policy_ref: POLICY_ID,
          hazards: [],
          sensitivity: [],
          supervision: 'none',
          guardian_visibility: 'summary',
          stop_conditions: ['Pause when the learner asks to stop.'],
          privacy_declarations: ['Do not require private disclosure.'],
          academic_integrity_mode: 'practice-support',
        },
        resource_refs: ['test-resource'],
        guardian_visibility_note: 'Share the target and next instructional step, not raw answers.',
        home_connection: 'Notice one optional example at home.',
        extensions: [
          {
            namespace: 'manuel/student',
            key: 'display_hint',
            schema_ref: 'extension-schema-student',
            projection: 'student-safe',
            value: { type: 'string', value: 'Use a wide workspace.' },
          },
          {
            namespace: 'manuel/admin',
            key: 'review_note',
            schema_ref: 'extension-schema-admin',
            projection: 'protected',
            value: { type: 'string', value: 'Review after the pilot.' },
          },
        ],
      },
    ],
    assessments: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        assessment_id: 'test-assessment',
        course_ref: 'test-course',
        unit_ref: 'test-unit',
        title: 'Test assessment',
        standards: [{ framework_ref: 'test-framework', standard_id: 'standard-one', mapping_status: 'canonical' }],
        total_points: 10,
        prompts: [
          {
            prompt_id: 'test-assessment-p01',
            type: 'application',
            prompt: 'Apply the idea in a fresh situation and explain the result.',
            points: 10,
            resource_refs: [],
          },
        ],
        rubric_dimensions: ['accuracy', 'evidence'],
        accommodation_note: 'Access supports may change format without changing the standard.',
        protected_interpretation_ref: 'test-assessment-interpretation',
      },
    ],
    assessment_interpretations: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        interpretation_id: 'test-assessment-interpretation',
        assessment_ref: 'test-assessment',
        secure_minimum_percent: 85,
        developing_minimum_percent: 70,
        not_yet_maximum_percent: 69.99,
        mastery_rule: 'Use this score as one evidence source, never as the sole mastery decision.',
        prompt_scoring: [
          { prompt_ref: 'test-assessment-p01', scoring_guidance: 'Award credit for an accurate result and supported reasoning.' },
        ],
      },
    ],
    schedules: [
      {
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        schedule_id: 'test-schedule',
        grade: 5,
        weeks: 1,
        instructional_days: 1,
        entries: [{ week: 1, day: 1, lesson_refs: ['test-lesson'] }],
      },
    ],
  }
}

function codes(set: CurriculumAuthoringSet): readonly string[] {
  return validateAuthoringSet(set).issues.map((issue) => issue.code)
}

describe('Curriculum Authoring Schema Set 2.0.0', () => {
  it('validates a complete strict authoring set', () => {
    expect(validateAuthoringSet(validAuthoringSet())).toEqual({
      valid: true,
      schema_set_version: '2.0.0',
      issues: [],
    })
  })

  it('emits strict JSON Schema object boundaries', () => {
    const definitions = curriculumSchemaSetJson.$defs as Record<string, { additionalProperties?: unknown }>
    expect(Object.keys(definitions)).toEqual(expect.arrayContaining([
      'curriculum_manifest',
      'course',
      'unit',
      'lesson',
      'assessment',
      'assessment_protected_interpretation',
      'schedule',
      'standard_framework',
      'mastery',
      'tutor_route',
      'accessibility',
      'safety_privacy',
      'media_resource',
      'policy_set',
      'student_lesson_projection',
      'protected_lesson_projection',
    ]))
    expect(Object.values(definitions).every((schema) => schema.additionalProperties === false)).toBe(true)
  })

  it.each([
    ['unknown field', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0], { surprise: true }), 'SHAPE_INVALID'],
    ['null field', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0], { title: null }), 'SHAPE_INVALID'],
    ['oversized value', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0], { title: 'x'.repeat(241) }), 'SHAPE_INVALID'],
    ['bad parent ref', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0], { unit_ref: 'missing-unit' }), 'BAD_REFERENCE'],
    ['duplicate ID', (set: CurriculumAuthoringSet) => Object.assign(set, { courses: [...set.courses, structuredClone(set.courses[0])] }), 'DUPLICATE_ID'],
    ['broken schedule', (set: CurriculumAuthoringSet) => Object.assign(set.schedules[0].entries[0], { lesson_refs: [] }), 'SCHEDULE_INVALID'],
    ['assessment point mismatch', (set: CurriculumAuthoringSet) => Object.assign(set.assessments[0], { total_points: 11 }), 'ASSESSMENT_POINT_MISMATCH'],
    ['weakened mastery', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0].mastery, { minimum_occasions: 1 }), 'MASTERY_FLOOR_WEAKENED'],
    ['unsafe Tutor key', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0].tutor_routes[0].parameters, { revealsAnswers: true }), 'TUTOR_INVARIANT_VIOLATION'],
    ['missing fallback', (set: CurriculumAuthoringSet) => Reflect.deleteProperty(set.lessons[0].accessibility, 'text_fallback'), 'SHAPE_INVALID'],
    ['invalid standard ref', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0].standards[0], { standard_id: 'missing-standard' }), 'STANDARD_REFERENCE_INVALID'],
    ['invalid safety rule', (set: CurriculumAuthoringSet) => Object.assign(set.lessons[0].safety_privacy, { stop_conditions: [] }), 'SHAPE_INVALID'],
  ] as const)('rejects negative fixture: %s', (_name, mutate, expectedCode) => {
    const set = structuredClone(validAuthoringSet()) as CurriculumAuthoringSet & {
      courses: CurriculumAuthoringSet['courses'][number][]
    }
    mutate(set)
    expect(codes(set)).toContain(expectedCode)
  })

  it('resolves lesson mastery to the stricter policy requirement', () => {
    const set = validAuthoringSet()
    const effective = resolveMastery(set.policy_sets[0].mastery_floor, {
      policy_ref: POLICY_ID,
      minimum_occasions: 4,
      evidence_types: ['application', 'explanation', 'error-analysis'],
      transfer_requirement: 'novel-context',
    })
    expect(effective).toMatchObject({
      minimum_occasions: 4,
      minimum_distinct_dates: 2,
      independent_evidence_required: true,
      transfer_requirement: 'novel-context',
    })
    expect(effective.evidence_types).toEqual(['application', 'explanation', 'error-analysis'])
  })

  it('uses an allowlist so new and protected fields cannot leak into student lessons', () => {
    const set = validAuthoringSet()
    Object.assign(set.lessons[0], {
      future_secret_answer: 'do not publish',
      future_protected_strategy: 'do not publish',
    })
    const projected = projectStudentLesson(set.lessons[0], set.policy_sets[0])
    expect(projected).not.toHaveProperty('scoring_guidance')
    expect(projected).not.toHaveProperty('mastery')
    expect(projected).not.toHaveProperty('tutor_routes')
    expect(projected).not.toHaveProperty('future_secret_answer')
    expect(projected.extensions).toEqual([
      { namespace: 'manuel/student', key: 'display_hint', value: { type: 'string', value: 'Use a wide workspace.' } },
    ])
    expect(validateWithSchema(studentLessonProjectionSchema, projected).success).toBe(true)
  })

  it('rejects a protected-field leak against the independent student projection schema', () => {
    const set = validAuthoringSet()
    const projected = projectStudentLesson(set.lessons[0], set.policy_sets[0])
    expect(
      validateWithSchema(studentLessonProjectionSchema, { ...projected, scoring_guidance: 'secret' }).success,
    ).toBe(false)
  })

  it('recursively detects equivalent Tutor authority keys', () => {
    expect(findForbiddenTutorAuthority({ extension: { nested: { graded_work_policy: true } } })).toEqual([
      '$.extension.nested.graded_work_policy',
    ])
    expect(findForbiddenTutorAuthority({ nested: [{ givesFinalGradedAnswer: true }] })).toEqual([
      '$.nested[0].givesFinalGradedAnswer',
    ])
  })

  it('classifies all required elevated semantic changes', () => {
    const changes = classifySemanticDiff(
      {
        mastery: { minimum_occasions: 2 },
        assessment_interpretations: { threshold: 85 },
        tutor_routes: [{ strategy: 'old' }],
        extensions: [{ projection: 'protected' }],
        safety_privacy: { supervision: 'none' },
        guardian_visibility: 'summary',
        accessibility: { text_fallback: 'required' },
        standards: ['one'],
        policy_set_ref: 'old-policy',
      },
      {
        mastery: { minimum_occasions: 3 },
        assessment_interpretations: { threshold: 90 },
        tutor_routes: [{ strategy: 'new' }],
        extensions: [{ projection: 'student-safe' }],
        safety_privacy: { supervision: 'direct-adult' },
        guardian_visibility: 'direct-observation',
        accessibility: {},
        standards: ['two'],
        policy_set_ref: 'new-policy',
      },
    )
    expect(new Set(changes.flatMap((change) => change.category ? [change.category] : []))).toEqual(
      new Set([
        'MASTERY',
        'ASSESSMENT_INTERPRETATION',
        'TUTOR_PROTECTED_STRATEGY',
        'STUDENT_PROTECTED_CLASSIFICATION',
        'SAFETY_PRIVACY',
        'GUARDIAN_VISIBILITY',
        'ACCESSIBILITY_FALLBACK_REMOVAL',
        'STANDARDS_CREDIT',
        'GLOBAL_POLICY_REFERENCE',
      ]),
    )
  })
})

describe('read-only immutable v1 importer', () => {
  it('imports the whole corpus without guessing canonical standards or dropping source fields', () => {
    const result = importImmutableV1()
    expect(result.validation.valid, JSON.stringify(result.validation.issues.slice(0, 10), null, 2)).toBe(true)
    expect(result.report.counts).toEqual({
      courses: 30,
      units: 232,
      lessons: 2736,
      assessments: 232,
      schedules: 3,
      resources: 18,
      unique_legacy_standard_labels: 384,
    })
    expect(result.report.standards.canonical_ids_guessed).toBe(0)
    expect(result.report.standards.human_review_labels.map((entry) => entry.legacy_label)).toEqual(['2', '3', '4', '5'])
    expect(result.report.preservation.source_fields_dropped).toBe(0)
    expect(result.report.preservation.field_inventory.lesson).toHaveLength(30)
    expect(result.draft.assessments.every((assessment) =>
      assessment.prompts.every((prompt) => prompt.prompt_id.startsWith(`${assessment.assessment_id}-p`)),
    )).toBe(true)
  }, 120_000)

  it('matches the committed machine-readable compatibility report', () => {
    const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
    const committed = JSON.parse(
      readFileSync(join(repositoryRoot, 'docs', 'curriculum', 'schema-set-v2', 'compatibility-report.json'), 'utf8'),
    ) as unknown
    expect(importImmutableV1().report).toEqual(committed)
  }, 120_000)
})

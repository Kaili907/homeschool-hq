import { describe, expect, it } from 'vitest'
import { CURRICULUM_SCHEMA_SET_VERSION, type CurriculumAuthoringSet } from '../../curriculum-authoring/v2/contracts.ts'
import {
  createCurriculumSnapshotValidator,
  validateCurriculumSnapshot,
} from './engine.ts'

const POLICY_ID = 'academy-policy-v2'

function validSnapshot(): CurriculumAuthoringSet {
  return {
    manifest: {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      curriculum_id: 'validation-fixture',
      draft_version: '2.1.0-test',
      status: 'draft',
      title: 'Validation fixture',
      policy_set_ref: POLICY_ID,
      framework_refs: ['michigan-framework'],
      course_refs: ['math-course'],
      schedule_refs: ['grade-five-schedule'],
      resource_refs: ['readable-resource'],
      counts: { courses: 1, units: 1, lessons: 1, assessments: 1, schedules: 1, resources: 1 },
    },
    courses: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      course_id: 'math-course',
      grade: 5,
      subject: 'mathematics',
      title: 'Mathematics',
      description: 'A complete validation fixture course.',
      days: 1,
      order: 1,
      unit_refs: ['math-unit'],
      standards: [{ framework_ref: 'michigan-framework', standard_id: 'math-standard', mapping_status: 'canonical' }],
    }],
    units: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      unit_id: 'math-unit',
      course_ref: 'math-course',
      grade: 5,
      subject: 'mathematics',
      order: 1,
      title: 'Reasoning unit',
      days: 1,
      standards: [{ framework_ref: 'michigan-framework', standard_id: 'math-standard', mapping_status: 'canonical' }],
      essential_question: 'How does evidence support a mathematical conclusion?',
      topics: ['reasoning'],
      performance_task: 'Solve a new problem and explain the evidence.',
      lesson_refs: ['math-lesson'],
      assessment_ref: 'math-assessment',
    }],
    lessons: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      lesson_id: 'math-lesson',
      course_ref: 'math-course',
      unit_ref: 'math-unit',
      grade: 5,
      subject: 'mathematics',
      course_day: 1,
      day_in_unit: 1,
      title: 'Reason from evidence',
      phase: 'Launch',
      focus: 'Use evidence to support a conclusion.',
      estimated_duration: { minimum_minutes: 30, maximum_minutes: 45 },
      standards: [{ framework_ref: 'michigan-framework', standard_id: 'math-standard', mapping_status: 'canonical' }],
      essential_question: 'What evidence supports the result?',
      learning_objectives: ['Explain a result using evidence.'],
      success_criteria: ['The response contains a result and supporting evidence.'],
      materials: ['notebook'],
      lesson_flow: [{
        segment_id: 'lesson-segment',
        title: 'Independent application',
        duration: { minimum_minutes: 30, maximum_minutes: 45 },
        teacher_or_tutor_action: 'Invite an independent attempt and ask for evidence.',
      }],
      student_activity: 'Complete a new application and explain the reasoning.',
      formative_check: 'Show the result and name one check.',
      scoring_guidance: 'Score the target while accepting multiple valid approaches.',
      mastery: { policy_ref: POLICY_ID, minimum_occasions: 3, minimum_distinct_dates: 2 },
      tutor_routes: [{
        signal: 'prerequisite-gap',
        strategy: 'prerequisite-reteach',
        parameters: { representation: 'concrete', retry_count: 1 },
      }],
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
        privacy_declarations: ['Do not require a private disclosure.'],
        academic_integrity_mode: 'practice-support',
      },
      resource_refs: ['readable-resource'],
      guardian_visibility_note: 'Share the learning target and next step, not raw answers.',
    }],
    assessments: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      assessment_id: 'math-assessment',
      course_ref: 'math-course',
      unit_ref: 'math-unit',
      title: 'Reasoning assessment',
      standards: [{ framework_ref: 'michigan-framework', standard_id: 'math-standard', mapping_status: 'canonical' }],
      total_points: 10,
      prompts: [{
        prompt_id: 'math-prompt',
        type: 'application',
        prompt: 'Apply the idea in a new situation and explain the result.',
        points: 10,
        resource_refs: ['readable-resource'],
      }],
      rubric_dimensions: ['accuracy', 'evidence'],
      accommodation_note: 'Access supports may change format without changing the standard.',
      protected_interpretation_ref: 'math-interpretation',
    }],
    assessment_interpretations: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      interpretation_id: 'math-interpretation',
      assessment_ref: 'math-assessment',
      secure_minimum_percent: 85,
      developing_minimum_percent: 70,
      not_yet_maximum_percent: 69,
      mastery_rule: 'Use this result as one evidence source, never as the sole mastery decision.',
      prompt_scoring: [{ prompt_ref: 'math-prompt', scoring_guidance: 'Award credit for accurate supported reasoning.' }],
    }],
    schedules: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      schedule_id: 'grade-five-schedule',
      grade: 5,
      weeks: 1,
      instructional_days: 1,
      entries: [{ week: 1, day: 1, lesson_refs: ['math-lesson'] }],
    }],
    standard_frameworks: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      framework_id: 'michigan-framework',
      name: 'Verified fixture standards',
      jurisdiction: 'Michigan',
      framework_version: 'fixture-2026',
      authority_status: 'verified',
      standards: [{ standard_id: 'math-standard', code: 'MATH.TEST', label: 'Fixture mathematics standard' }],
    }],
    resources: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      resource_id: 'readable-resource',
      kind: 'text',
      title: 'Readable source',
      locator: 'resources/readable.txt',
      rights: 'Locally authored',
      required: false,
      text_fallback: 'The resource is already readable text.',
    }],
    policy_sets: [{
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      policy_set_id: POLICY_ID,
      title: 'Academy validation policy',
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
        non_disableable_prohibitions: ['Never require private disclosure.'],
        required_privacy_declarations: ['Collect only minimum instructional evidence.'],
      },
      extension_namespaces: [],
    }],
  }
}

function draftOptions() {
  return { origin: 'draft' as const, snapshotId: 'draft-fixture', expectedVersion: '2.1.0-test' }
}

describe('curriculum snapshot validation engine', () => {
  it('validates a complete Schema v2 snapshot without producing a false blocker', () => {
    const result = validateCurriculumSnapshot(validSnapshot(), draftOptions())

    expect(result.status).toBe('valid')
    expect(result.publicationReady).toBe(true)
    expect(result.summary).toMatchObject({ total: 0, blocking: 0, errors: 0 })
  })

  it('reports schema-invalid input as blocking and not ready', () => {
    const snapshot = validSnapshot() as unknown as { courses: Array<Record<string, unknown>> }
    snapshot.courses[0].title = ''
    const result = validateCurriculumSnapshot(snapshot, draftOptions())

    expect(result.status).toBe('invalid')
    expect(result.publicationReady).toBe(false)
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'schema', path: 'courses[0].title', blocking: true }),
    ]))
  })

  it('finds missing lesson and assessment resource references', () => {
    const snapshot = validSnapshot()
    ;(snapshot.lessons[0].resource_refs as string[]).push('missing-lesson-resource')
    ;(snapshot.assessments[0].prompts[0].resource_refs as string[]).push('missing-assessment-resource')
    const result = validateCurriculumSnapshot(snapshot, draftOptions())

    expect(result.status).toBe('invalid')
    expect(result.findings.filter((finding) => finding.rule === 'resources.reference_integrity')).toHaveLength(2)
  })

  it('reports assessment totals and relationships that do not match', () => {
    const snapshot = validSnapshot()
    ;(snapshot.assessments[0] as { total_points: number }).total_points = 11
    const result = validateCurriculumSnapshot(snapshot, draftOptions())

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'assessments', rule: 'assessments.point_total', blocking: true }),
    ]))
  })

  it('keeps unresolved human standards review publication-blocking without inventing an ID', () => {
    const snapshot = validSnapshot() as unknown as {
      lessons: Array<{ standards: Array<Record<string, unknown>> }>
    }
    snapshot.lessons[0].standards[0] = {
      framework_ref: 'michigan-framework',
      legacy_label: '2',
      mapping_status: 'human-review',
    }
    const result = validateCurriculumSnapshot(snapshot, draftOptions())
    const finding = result.findings.find((item) => item.rule === 'standards.human_review_required')

    expect(result.status).toBe('invalid')
    expect(result.publicationReady).toBe(false)
    expect(finding).toMatchObject({ blocking: true, severity: 'error', entity: { id: 'math-lesson' } })
    expect(finding?.remediation).toContain('do not invent an official ID')
  })

  it('classifies a protected Tutor authority violation', () => {
    const snapshot = validSnapshot() as unknown as {
      policy_sets: Array<{ tutor_authority: { reveals_answers: boolean } }>
    }
    snapshot.policy_sets[0].tutor_authority.reveals_answers = true
    const result = validateCurriculumSnapshot(snapshot, draftOptions())

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'tutor-routing', rule: 'tutor.authority_contract', blocking: true }),
    ]))
  })

  it('reports missing visual accessibility metadata', () => {
    const snapshot = validSnapshot() as unknown as {
      resources: Array<Record<string, unknown>>
    }
    snapshot.resources[0].kind = 'image'
    const result = validateCurriculumSnapshot(snapshot, draftOptions())

    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'accessibility', rule: 'accessibility.required_support', blocking: true }),
    ]))
  })

  it('blocks a release/version mismatch', () => {
    const result = validateCurriculumSnapshot(validSnapshot(), {
      origin: 'published-release',
      snapshotId: 'release-fixture',
      expectedVersion: '9.9.9',
    })

    expect(result.status).toBe('invalid')
    expect(result.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'version-consistency', rule: 'version.source_snapshot_match' }),
    ]))
  })

  it('produces deterministic finding IDs and blocking calculations', () => {
    const snapshot = validSnapshot()
    ;(snapshot.assessments[0] as { total_points: number }).total_points = 11
    const first = validateCurriculumSnapshot(snapshot, draftOptions())
    const second = validateCurriculumSnapshot(structuredClone(snapshot), draftOptions())

    expect(first.findings.map((finding) => finding.id)).toEqual(second.findings.map((finding) => finding.id))
    expect(new Set(first.findings.map((finding) => finding.id)).size).toBe(first.findings.length)
    expect(first.summary.blocking).toBe(first.findings.filter((finding) => finding.blocking).length)
    expect(first.publicationReady).toBe(false)
  })

  it('truthfully distinguishes incomplete and unsupported snapshots', () => {
    const incomplete = validSnapshot() as unknown as Record<string, unknown>
    delete incomplete.lessons
    const unsupported = validSnapshot() as unknown as { manifest: { schema_set_version: string } }
    unsupported.manifest.schema_set_version = '3.0.0'

    expect(validateCurriculumSnapshot(incomplete, draftOptions())).toMatchObject({ status: 'incomplete', publicationReady: false })
    expect(validateCurriculumSnapshot(unsupported, draftOptions())).toMatchObject({ status: 'unavailable', publicationReady: false })
  })

  it('returns a controlled error state when semantic validation fails to execute', () => {
    const validate = createCurriculumSnapshotValidator({
      validateSemantics() {
        throw new Error('private stack and credential should not escape')
      },
    })
    const result = validate(validSnapshot(), draftOptions())

    expect(result).toMatchObject({ status: 'error', publicationReady: false })
    expect(result.findings[0]).toMatchObject({ rule: 'engine.execution_failed', blocking: true })
    expect(JSON.stringify(result)).not.toContain('credential')
  })
})

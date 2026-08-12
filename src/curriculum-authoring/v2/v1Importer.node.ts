import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  CURRICULUM_SCHEMA_SET_VERSION,
  type Assessment,
  type AssessmentProtectedInterpretation,
  type CurriculumAuthoringSet,
  type Lesson,
  type MasteryStrengthening,
  type MediaResource,
  type Schedule,
  type StandardFramework,
  type StandardReference,
  type TutorRoute,
} from './contracts.ts'
import { validateAuthoringSet, type AuthoringValidationReport } from './validation.ts'

export type MigrationClassification =
  | 'NO_BREAK'
  | 'MIGRATION_REQUIRED'
  | 'CONTENT_CORRECTION_REQUIRED'
  | 'SCHEMA_VERSION_REQUIRED'

interface V1SourceRecord {
  readonly entity_type: 'manifest' | 'course' | 'unit' | 'lesson' | 'assessment' | 'schedule' | 'resource'
  readonly entity_id: string
  readonly source_path: string
  readonly source: Readonly<Record<string, unknown>>
}

export interface CompatibilityReport {
  readonly schema_set_version: '2.0.0'
  readonly source_release: '1.0.0'
  readonly source_immutable: true
  readonly result: 'COMPATIBLE_DRAFT_REQUIRES_REVIEW' | 'INVALID_DRAFT'
  readonly counts: {
    readonly courses: number
    readonly units: number
    readonly lessons: number
    readonly assessments: number
    readonly schedules: number
    readonly resources: number
    readonly unique_legacy_standard_labels: number
  }
  readonly classification_counts: Readonly<Record<MigrationClassification, number>>
  readonly standards: {
    readonly canonical_ids_guessed: 0
    readonly human_review_labels: readonly {
      readonly legacy_label: string
      readonly affected_references: number
      readonly classification: 'CONTENT_CORRECTION_REQUIRED'
    }[]
    readonly unverified_labels: number
  }
  readonly preservation: {
    readonly source_records_retained_in_memory: number
    readonly source_fields_dropped: 0
    readonly field_inventory: Readonly<Record<V1SourceRecord['entity_type'], readonly string[]>>
  }
  readonly validation: {
    readonly valid: boolean
    readonly issue_count: number
  }
  readonly runtime_dependencies: readonly string[]
}

export interface V1ImportResult {
  readonly draft: CurriculumAuthoringSet
  readonly report: CompatibilityReport
  readonly validation: AuthoringValidationReport
  readonly source_records: readonly V1SourceRecord[]
}

type JsonRecord = Record<string, unknown>

const DEFAULT_V1_ROOT = fileURLToPath(
  new URL('../../../curriculum-content/manuel-academy/1.0.0/', import.meta.url),
)
const POLICY_ID = 'manuel-academy-global-policy-v2'
const LEGACY_FRAMEWORK_ID = 'manuel-academy-legacy-standards-v1'

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value as JsonRecord
}

function asArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`)
  return value
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${label} must be an integer`)
  return value
}

function strings(value: unknown, label: string): readonly string[] {
  return asArray(value, label).map((entry, index) => text(entry, `${label}[${index}]`))
}

function parseDuration(value: unknown): { readonly minimum_minutes: number; readonly maximum_minutes: number } {
  const values = String(value).match(/\d+/g)?.map(Number) ?? []
  if (values.length === 0) return { minimum_minutes: 1, maximum_minutes: 480 }
  return { minimum_minutes: values[0], maximum_minutes: values[1] ?? values[0] }
}

function normalizeSignal(value: string): TutorRoute['signal'] {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\bbut\b/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
  if (
    normalized === 'prerequisite-gap' ||
    normalized === 'procedure-without-understanding' ||
    normalized === 'correct-low-confidence' ||
    normalized === 'repeated-error-pattern' ||
    normalized === 'mastery-evidence'
  ) return normalized
  throw new Error(`unsupported v1 Tutor signal ${value}`)
}

function importTutorRoute(value: unknown): TutorRoute {
  const source = asRecord(value, 'Tutor route')
  const signal = normalizeSignal(text(source.signal, 'Tutor route signal'))
  const strategyBySignal = {
    'prerequisite-gap': 'prerequisite-reteach',
    'procedure-without-understanding': 'conceptual-explanation',
    'correct-low-confidence': 'confidence-calibration',
    'repeated-error-pattern': 'error-pattern-contrast',
    'mastery-evidence': 'mastery-evidence-collection',
  } as const
  const parametersBySignal: Record<TutorRoute['signal'], TutorRoute['parameters']> = {
    'prerequisite-gap': { representation: 'concrete', retry_count: 1 },
    'procedure-without-understanding': { require_explanation: true },
    'correct-low-confidence': { retry_count: 1 },
    'repeated-error-pattern': { representation: 'worked-example', review_timing: 'next-session' },
    'mastery-evidence': { require_explanation: true, evidence_type: 'application' },
  }
  return { signal, strategy: strategyBySignal[signal], parameters: parametersBySignal[signal] }
}

function promptType(value: string): Assessment['prompts'][number]['type'] {
  const mapping: Record<string, Assessment['prompts'][number]['type']> = {
    'concept and vocabulary': 'concept-vocabulary',
    'representation or source': 'representation-source',
    application: 'application',
    'error or claim analysis': 'error-claim-analysis',
    connection: 'connection',
    'performance evidence': 'performance-evidence',
    'reflection and transfer': 'reflection-transfer',
  }
  return mapping[value] ?? 'other'
}

function recordSource(
  records: V1SourceRecord[],
  entityType: V1SourceRecord['entity_type'],
  entityId: string,
  sourcePath: string,
  source: JsonRecord,
): void {
  records.push({ entity_type: entityType, entity_id: entityId, source_path: sourcePath, source })
}

export function importImmutableV1(sourceRoot = DEFAULT_V1_ROOT): V1ImportResult {
  const sourceRecords: V1SourceRecord[] = []
  const manifestSource = asRecord(readJson(join(sourceRoot, 'curriculum-manifest.json')), 'v1 manifest')
  if (manifestSource.version !== '1.0.0') throw new Error('v1 importer accepts only immutable release 1.0.0')
  recordSource(sourceRecords, 'manifest', text(manifestSource.package_id, 'package_id'), 'curriculum-manifest.json', manifestSource)

  const courseSources = asArray(readJson(join(sourceRoot, 'course-index.json')), 'course-index').map((value) =>
    asRecord(value, 'course'),
  )
  const unitSources = asArray(readJson(join(sourceRoot, 'unit-index.json')), 'unit-index').map((value) =>
    asRecord(value, 'unit'),
  )
  const lessonSources: Array<{ readonly source: JsonRecord; readonly sourcePath: string }> = []
  const assessmentSources: Array<{
    readonly source: JsonRecord
    readonly courseId: string
    readonly sourcePath: string
  }> = []

  for (const course of courseSources) {
    const courseId = text(course.course_id, 'course_id')
    const grade = integer(course.grade, `${courseId}.grade`)
    const courseSubject = text(course.subject, `${courseId}.subject`)
    const relativeBase = join('grades', `grade-${grade}`, 'courses', courseSubject)
    const lessonPath = join(sourceRoot, relativeBase, 'lessons.jsonl')
    readFileSync(lessonPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .forEach((line, index) => {
        lessonSources.push({
          source: asRecord(JSON.parse(line) as unknown, `${courseId} lesson ${index + 1}`),
          sourcePath: `${join(relativeBase, 'lessons.jsonl')}#L${index + 1}`,
        })
      })
    asArray(readJson(join(sourceRoot, relativeBase, 'assessments.json')), `${courseId} assessments`).forEach((value) => {
      assessmentSources.push({
        source: asRecord(value, `${courseId} assessment`),
        courseId,
        sourcePath: join(relativeBase, 'assessments.json'),
      })
    })
  }

  const allStandardLabels = new Set<string>()
  const standardOccurrences = new Map<string, number>()
  const collectStandards = (value: unknown, label: string): void => {
    strings(value, label).forEach((standard) => {
      allStandardLabels.add(standard)
      standardOccurrences.set(standard, (standardOccurrences.get(standard) ?? 0) + 1)
    })
  }
  courseSources.forEach((course) => {
    const courseId = text(course.course_id, 'course_id')
    const standards = unitSources
      .filter((unit) => unit.course_id === courseId)
      .flatMap((unit) => strings(unit.standards, `${courseId} unit standards`))
    collectStandards([...new Set(standards)], `${courseId} standards`)
  })
  unitSources.forEach((unit) => collectStandards(unit.standards, `${String(unit.unit_id)} standards`))
  lessonSources.forEach(({ source }) => collectStandards(source.standards, `${String(source.lesson_id)} standards`))
  assessmentSources.forEach(({ source }) => collectStandards(source.standards, `${String(source.assessment_id)} standards`))

  const sortedLabels = [...allStandardLabels].sort((left, right) => left.localeCompare(right))
  const standardIdByLabel = new Map(
    sortedLabels.map((label, index) => [label, `legacy-v1-standard-${String(index + 1).padStart(3, '0')}`]),
  )
  const standardReference = (legacyLabel: string): StandardReference => ({
    framework_ref: LEGACY_FRAMEWORK_ID,
    standard_id: standardIdByLabel.get(legacyLabel),
    legacy_label: legacyLabel,
    mapping_status: /^\d+$/.test(legacyLabel) ? 'human-review' : 'unverified',
  })
  const references = (value: unknown, label: string): readonly StandardReference[] =>
    strings(value, label).map(standardReference)

  const framework: StandardFramework = {
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    framework_id: LEGACY_FRAMEWORK_ID,
    name: 'Immutable v1 legacy standards labels',
    jurisdiction: 'Michigan-aligned; canonical authority not asserted',
    framework_version: '1.0.0-import',
    authority_status: 'legacy-unverified',
    standards: sortedLabels.map((label) => ({
      standard_id: standardIdByLabel.get(label)!,
      code: label,
      label,
      description: 'Legacy label retained verbatim for mapping review; this is not a guessed canonical identifier.',
    })),
  }

  const policySet: CurriculumAuthoringSet['policy_sets'][number] = {
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    policy_set_id: POLICY_ID,
    title: 'Manuel Academy global authoring policy v2',
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
      non_disableable_prohibitions: [
        'Do not require private disclosure, public posting, account creation, purchase, photograph, or voice recording.',
        'Do not shame, diagnose, or infer character from learner work.',
      ],
      required_privacy_declarations: [
        'Collect only the minimum instructional evidence and never expose raw private reflection or raw answers to guardians.',
      ],
    },
    extension_namespaces: [],
  }

  const courses = courseSources.map((source, index) => {
    const courseId = text(source.course_id, 'course_id')
    recordSource(sourceRecords, 'course', courseId, 'course-index.json', source)
    const childUnits = unitSources.filter((unit) => unit.course_id === courseId)
    const courseStandards = [...new Set(childUnits.flatMap((unit) => strings(unit.standards, `${courseId} standards`)))]
    return {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      course_id: courseId,
      grade: integer(source.grade, `${courseId}.grade`),
      subject: text(source.subject, `${courseId}.subject`) as CurriculumAuthoringSet['courses'][number]['subject'],
      title: text(source.title, `${courseId}.title`),
      description: text(source.description, `${courseId}.description`),
      capstone: text(source.capstone, `${courseId}.capstone`),
      days: integer(source.days, `${courseId}.days`),
      order: index % 10 + 1,
      unit_refs: childUnits.map((unit) => text(unit.unit_id, `${courseId} unit_id`)),
      standards: courseStandards.map(standardReference),
    }
  })

  const units = unitSources.map((source) => {
    const unitId = text(source.unit_id, 'unit_id')
    recordSource(sourceRecords, 'unit', unitId, 'unit-index.json', source)
    return {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      unit_id: unitId,
      course_ref: text(source.course_id, `${unitId}.course_id`),
      grade: integer(source.grade, `${unitId}.grade`),
      subject: text(source.subject, `${unitId}.subject`) as CurriculumAuthoringSet['units'][number]['subject'],
      order: integer(source.unit_number, `${unitId}.unit_number`),
      title: text(source.title, `${unitId}.title`),
      days: integer(source.days, `${unitId}.days`),
      standards: references(source.standards, `${unitId}.standards`),
      essential_question: text(source.essential_question, `${unitId}.essential_question`),
      topics: strings(source.topics, `${unitId}.topics`),
      performance_task: text(source.performance_task, `${unitId}.performance_task`),
      lesson_refs: strings(source.lesson_ids, `${unitId}.lesson_ids`),
      assessment_ref: text(source.assessment_id, `${unitId}.assessment_id`),
    }
  })

  const lessons: Lesson[] = lessonSources.map(({ source, sourcePath }) => {
    const lessonId = text(source.lesson_id, 'lesson_id')
    recordSource(sourceRecords, 'lesson', lessonId, sourcePath, source)
    const unitNumber = integer(source.unit_number, `${lessonId}.unit_number`)
    const courseId = text(source.course_id, `${lessonId}.course_id`)
    const mastery: MasteryStrengthening = { policy_ref: POLICY_ID }
    return {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      lesson_id: lessonId,
      course_ref: courseId,
      unit_ref: `${courseId}-u${String(unitNumber).padStart(2, '0')}`,
      grade: integer(source.grade, `${lessonId}.grade`),
      subject: text(source.subject, `${lessonId}.subject`) as Lesson['subject'],
      course_day: integer(source.course_day, `${lessonId}.course_day`),
      day_in_unit: integer(source.day_in_unit, `${lessonId}.day_in_unit`),
      title: text(source.title, `${lessonId}.title`),
      phase: text(source.phase, `${lessonId}.phase`),
      focus: text(source.focus, `${lessonId}.focus`),
      estimated_duration: parseDuration(source.estimated_minutes),
      standards: references(source.standards, `${lessonId}.standards`),
      essential_question: text(source.essential_question, `${lessonId}.essential_question`),
      learning_objectives: strings(source.learning_objectives, `${lessonId}.learning_objectives`),
      success_criteria: strings(source.success_criteria, `${lessonId}.success_criteria`),
      materials: strings(source.materials, `${lessonId}.materials`),
      lesson_flow: asArray(source.lesson_flow, `${lessonId}.lesson_flow`).map((entry, index) => {
        const segment = asRecord(entry, `${lessonId}.lesson_flow[${index}]`)
        return {
          segment_id: `${lessonId}-segment-${String(index + 1).padStart(2, '0')}`,
          title: text(segment.segment, `${lessonId}.lesson_flow[${index}].segment`),
          duration: parseDuration(segment.minutes),
          teacher_or_tutor_action: text(
            segment.teacher_or_tutor_action,
            `${lessonId}.lesson_flow[${index}].teacher_or_tutor_action`,
          ),
        }
      }),
      student_activity: text(source.student_activity, `${lessonId}.student_activity`),
      formative_check: text(source.formative_check, `${lessonId}.formative_check`),
      scoring_guidance: text(source.answer_or_scoring_guidance, `${lessonId}.answer_or_scoring_guidance`),
      mastery,
      tutor_routes: asArray(source.adaptive_tutor_routes, `${lessonId}.adaptive_tutor_routes`).map(importTutorRoute),
      extension_activity: text(source.extension, `${lessonId}.extension`),
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
        response_modes: ['typed', 'handwritten', 'spoken', 'drawn', 'manipulative', 'demonstrated'],
      },
      safety_privacy: {
        policy_ref: POLICY_ID,
        hazards: [],
        sensitivity: [],
        supervision: 'none',
        guardian_visibility: 'summary',
        stop_conditions: ['Pause or stop when the learner requests a break or the activity becomes unsafe.'],
        privacy_declarations: ['Do not require private disclosure, public posting, account creation, purchase, photograph, or voice recording.'],
        academic_integrity_mode: 'practice-support',
      },
      resource_refs: [],
      guardian_visibility_note: text(
        source.parent_or_guardian_visibility,
        `${lessonId}.parent_or_guardian_visibility`,
      ),
      home_connection: text(source.home_connection, `${lessonId}.home_connection`),
    }
  })

  const assessments: Assessment[] = []
  const assessmentInterpretations: AssessmentProtectedInterpretation[] = []
  assessmentSources.forEach(({ source, courseId, sourcePath }) => {
    const assessmentId = text(source.assessment_id, 'assessment_id')
    recordSource(sourceRecords, 'assessment', assessmentId, sourcePath, source)
    const unitNumber = integer(source.unit_number, `${assessmentId}.unit_number`)
    const prompts = asArray(source.prompts, `${assessmentId}.prompts`).map((entry, index) => {
      const prompt = asRecord(entry, `${assessmentId}.prompts[${index}]`)
      return {
        prompt_id: `${assessmentId}-p${String(index + 1).padStart(2, '0')}`,
        type: promptType(text(prompt.type, `${assessmentId}.prompts[${index}].type`)),
        prompt: text(prompt.prompt, `${assessmentId}.prompts[${index}].prompt`),
        points: integer(prompt.points, `${assessmentId}.prompts[${index}].points`),
        resource_refs: [],
      }
    })
    const interpretationId = `${assessmentId}-interpretation`
    const mastery = asRecord(source.mastery_interpretation, `${assessmentId}.mastery_interpretation`)
    assessments.push({
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      assessment_id: assessmentId,
      course_ref: courseId,
      unit_ref: `${courseId}-u${String(unitNumber).padStart(2, '0')}`,
      title: `${text(source.unit_title, `${assessmentId}.unit_title`)} Assessment`,
      standards: references(source.standards, `${assessmentId}.standards`),
      total_points: integer(source.total_points, `${assessmentId}.total_points`),
      prompts,
      rubric_dimensions: strings(source.rubric_dimensions, `${assessmentId}.rubric_dimensions`),
      accommodation_note: text(source.accommodation_note, `${assessmentId}.accommodation_note`),
      protected_interpretation_ref: interpretationId,
    })
    assessmentInterpretations.push({
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      interpretation_id: interpretationId,
      assessment_ref: assessmentId,
      secure_minimum_percent: 85,
      developing_minimum_percent: 70,
      not_yet_maximum_percent: 69.99,
      mastery_rule: [
        text(mastery.secure, `${assessmentId}.mastery_interpretation.secure`),
        text(mastery.developing, `${assessmentId}.mastery_interpretation.developing`),
        text(mastery.not_yet, `${assessmentId}.mastery_interpretation.not_yet`),
        text(mastery.rule, `${assessmentId}.mastery_interpretation.rule`),
      ].join(' '),
      prompt_scoring: prompts.map((prompt) => ({
        prompt_ref: prompt.prompt_id,
        scoring_guidance: `Apply the protected v1 mastery interpretation and rubric dimensions to this prompt; no fixed answer was imported.`,
      })),
    })
  })

  // RELEASE-SCOPED: the grade directories the v1 source tree actually contains.
  // These read files off disk, so this list tracks the v1 release, not the
  // canonical supported-grade authority.
  const schedules: Schedule[] = [5, 7, 8].map((grade) => {
    const relativePath = join('grades', `grade-${grade}`, 'daily-schedule.csv')
    const lines = readFileSync(join(sourceRoot, relativePath), 'utf8').trim().split(/\r?\n/)
    const headers = lines[0].split(',')
    const dayNumber: Readonly<Record<string, number>> = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 }
    const entries = lines.slice(1).map((line) => {
      const cells = line.split(',')
      const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
      return {
        week: Number(row.week),
        day: dayNumber[row.day],
        lesson_refs: headers
          .filter((header) => header.startsWith('period_'))
          .flatMap((header) => row[header].split(';'))
          .map((value) => value.trim())
          .filter(Boolean),
      }
    })
    const scheduleId = `ma-g${grade}-schedule`
    recordSource(sourceRecords, 'schedule', scheduleId, relativePath, { headers, entries })
    return {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      schedule_id: scheduleId,
      grade,
      weeks: 36,
      instructional_days: entries.length,
      entries,
    }
  })

  const resources: MediaResource[] = []
  // RELEASE-SCOPED, as above: v1 source directories on disk.
  for (const grade of [5, 7, 8]) {
    const relativePath = join('grades', `grade-${grade}`, 'original-text-bank.json')
    asArray(readJson(join(sourceRoot, relativePath)), `grade ${grade} text bank`).forEach((value) => {
      const source = asRecord(value, `grade ${grade} text resource`)
      const resourceId = text(source.id, 'resource id')
      recordSource(sourceRecords, 'resource', resourceId, relativePath, source)
      resources.push({
        schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
        resource_id: resourceId,
        kind: 'text',
        title: text(source.title, `${resourceId}.title`),
        locator: `${relativePath}#${resourceId}`,
        rights: 'Locally authored original text retained in immutable curriculum release 1.0.0.',
        required: false,
        text_fallback: 'This resource is already available as readable plain text.',
      })
    })
  }

  const draft: CurriculumAuthoringSet = {
    manifest: {
      schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
      curriculum_id: 'manuel-academy-curriculum-v2-draft',
      draft_version: '2.0.0-v1-import',
      status: 'draft',
      title: 'Manuel Academy v1 read-only import draft',
      policy_set_ref: POLICY_ID,
      framework_refs: [LEGACY_FRAMEWORK_ID],
      course_refs: courses.map((course) => course.course_id),
      schedule_refs: schedules.map((schedule) => schedule.schedule_id),
      resource_refs: resources.map((resource) => resource.resource_id),
      counts: {
        courses: courses.length,
        units: units.length,
        lessons: lessons.length,
        assessments: assessments.length,
        schedules: schedules.length,
        resources: resources.length,
      },
    },
    courses,
    units,
    lessons,
    assessments,
    assessment_interpretations: assessmentInterpretations,
    schedules,
    standard_frameworks: [framework],
    resources,
    policy_sets: [policySet],
  }
  const validation = validateAuthoringSet(draft)

  const fieldInventory = Object.fromEntries(
    (['manifest', 'course', 'unit', 'lesson', 'assessment', 'schedule', 'resource'] as const).map((entityType) => [
      entityType,
      [...new Set(sourceRecords.filter((record) => record.entity_type === entityType).flatMap((record) => Object.keys(record.source)))].sort(),
    ]),
  ) as unknown as CompatibilityReport['preservation']['field_inventory']
  const humanReviewLabels = sortedLabels
    .filter((label) => /^\d+$/.test(label))
    .map((legacyLabel) => ({
      legacy_label: legacyLabel,
      affected_references: standardOccurrences.get(legacyLabel) ?? 0,
      classification: 'CONTENT_CORRECTION_REQUIRED' as const,
    }))
  const schemaVersionRequired = 1 + courses.length + units.length + schedules.length + resources.length
  const migrationRequired = lessons.length + assessments.length
  const report: CompatibilityReport = {
    schema_set_version: CURRICULUM_SCHEMA_SET_VERSION,
    source_release: '1.0.0',
    source_immutable: true,
    result: validation.valid ? 'COMPATIBLE_DRAFT_REQUIRES_REVIEW' : 'INVALID_DRAFT',
    counts: {
      courses: courses.length,
      units: units.length,
      lessons: lessons.length,
      assessments: assessments.length,
      schedules: schedules.length,
      resources: resources.length,
      unique_legacy_standard_labels: sortedLabels.length,
    },
    classification_counts: {
      NO_BREAK: 0,
      MIGRATION_REQUIRED: migrationRequired,
      CONTENT_CORRECTION_REQUIRED: humanReviewLabels.length,
      SCHEMA_VERSION_REQUIRED: schemaVersionRequired,
    },
    standards: {
      canonical_ids_guessed: 0,
      human_review_labels: humanReviewLabels,
      unverified_labels: sortedLabels.length - humanReviewLabels.length,
    },
    preservation: {
      source_records_retained_in_memory: sourceRecords.length,
      source_fields_dropped: 0,
      field_inventory: fieldInventory,
    },
    validation: { valid: validation.valid, issue_count: validation.issues.length },
    runtime_dependencies: [
      'Learner mastery runtime must record evidence type before every v2 evidence-type rule can be enforced.',
      'Learner mastery runtime must record transfer mode before transfer requirements can be enforced.',
      'ADMIN-16 owns any future database authoring model; this schema set requires no database migration.',
    ],
  }
  return { draft, report, validation, source_records: sourceRecords }
}

export function listV1CourseDirectories(sourceRoot = DEFAULT_V1_ROOT): readonly string[] {
  // RELEASE-SCOPED, as above: v1 source directories on disk.
  return [5, 7, 8].flatMap((grade) =>
    readdirSync(join(sourceRoot, 'grades', `grade-${grade}`, 'courses'))
      .sort()
      .map((subject) => join(sourceRoot, 'grades', `grade-${grade}`, 'courses', subject)),
  )
}

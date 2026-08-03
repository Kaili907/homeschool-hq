import {
  ACTIVE_RESPONSE_MODES,
  STUDY_TASK_TYPES,
  type LessonStudyPlan,
  type PrerequisiteReference,
} from '../contracts/index.ts'
import {
  createRootJsonSchema,
  effectiveWorkBlockRangeSchema,
  idArraySchema,
  opaqueIdSchema,
  positiveIntegerSchema,
  stringArraySchema,
  type JsonSchema,
} from './json-schema.ts'
import {
  defineRuntimeSchema,
  expectArray,
  expectBoolean,
  expectId,
  expectNumber,
  expectRecord,
  expectString,
  expectStringArray,
  indexPath,
  propertyPath,
  validateEffectiveWorkBlockRange,
  validateHeader,
  type ValidationContext,
} from './validation.ts'

const GRADE_BANDS = ['elementary-3-5', 'middle-6-8', 'high-9-12'] as const
const LOAD_LEVELS = ['low', 'moderate', 'high', 'very-high'] as const

const prerequisiteSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['skillId', 'relationship', 'minimumOutcome', 'onGap'],
  properties: {
    skillId: opaqueIdSchema,
    relationship: { enum: ['required', 'supporting'] },
    minimumOutcome: { enum: ['introduced', 'progressing', 'demonstrated', 'retained'] },
    onGap: {
      enum: ['remediate-before-segment', 'embed-review', 'request-adult-review'],
    },
  },
}

const segmentTimingSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['minimumMinutes', 'plannedMinutes', 'maximumMinutes'],
  properties: {
    minimumMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    plannedMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    maximumMinutes: { type: 'integer', minimum: 1, maximum: 240 },
  },
}

const cognitiveLoadSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'overallLevel',
    'novelty',
    'workingMemoryDemand',
    'interactionDemand',
    'supportLevel',
    'supportStrategies',
  ],
  properties: {
    overallLevel: { enum: LOAD_LEVELS },
    novelty: { enum: LOAD_LEVELS },
    workingMemoryDemand: { enum: LOAD_LEVELS },
    interactionDemand: { enum: LOAD_LEVELS },
    supportLevel: { enum: LOAD_LEVELS },
    supportStrategies: stringArraySchema(),
  },
}

const activeResponseSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['required', 'modes', 'minimumResponseCount'],
  properties: {
    required: { type: 'boolean' },
    modes: stringArraySchema({ allowed: ACTIVE_RESPONSE_MODES }),
    minimumResponseCount: { type: 'integer', minimum: 0, maximum: 500 },
    maximumPassiveMinutes: { type: 'integer', minimum: 1, maximum: 240 },
  },
}

const breakEligibilitySchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['eligible', 'studentMayRequest', 'approvalRequired'],
  properties: {
    eligible: { type: 'boolean' },
    studentMayRequest: { type: 'boolean' },
    approvalRequired: { type: 'boolean' },
    availableAfterActiveMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    recommendedBreakMinutes: { type: 'integer', minimum: 1, maximum: 120 },
  },
}

const masteryCheckSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['required', 'skillIds', 'learningObjectiveIds', 'minimumItemCount'],
  properties: {
    required: { type: 'boolean' },
    skillIds: idArraySchema(),
    learningObjectiveIds: idArraySchema(),
    minimumItemCount: { type: 'integer', minimum: 0, maximum: 100 },
    criterion: {
      type: 'object',
      additionalProperties: false,
      required: ['minimumAccuracyPercent', 'minimumIndependentResponses'],
      properties: {
        minimumAccuracyPercent: { type: 'number', minimum: 0, maximum: 100 },
        minimumIndependentResponses: { type: 'integer', minimum: 0, maximum: 100 },
        maximumHintCount: { type: 'integer', minimum: 0, maximum: 100 },
      },
    },
  },
}

const lessonSegmentSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'sequence',
    'title',
    'taskType',
    'learningObjectiveIds',
    'timing',
    'cognitiveLoad',
    'activeResponse',
    'breakEligibility',
    'masteryCheck',
    'prerequisiteRefs',
    'dependsOnSegmentIds',
  ],
  properties: {
    id: opaqueIdSchema,
    sequence: positiveIntegerSchema,
    title: { type: 'string', minLength: 1, maxLength: 300 },
    taskType: { enum: STUDY_TASK_TYPES },
    customTaskTypeId: opaqueIdSchema,
    learningObjectiveIds: idArraySchema(),
    timing: segmentTimingSchema,
    cognitiveLoad: cognitiveLoadSchema,
    activeResponse: activeResponseSchema,
    breakEligibility: breakEligibilitySchema,
    masteryCheck: masteryCheckSchema,
    prerequisiteRefs: { type: 'array', maxItems: 100, items: prerequisiteSchema },
    dependsOnSegmentIds: idArraySchema(),
  },
}

export const lessonStudyPlanJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:lesson-study-plan:1',
  title: 'Lesson Study Plan',
  kind: 'lesson-study-plan',
  description:
    'A versioned lesson plan with contextual timing guidance, active responses, mastery checks, and stable segment sequencing.',
  required: [
    'studentId',
    'lessonId',
    'subjectId',
    'gradeBand',
    'gradeBandStartingRanges',
    'subjectTimingProfiles',
    'taskTimingProfiles',
    'prerequisiteRefs',
    'segments',
    'segmentSequence',
  ],
  properties: {
    studentId: opaqueIdSchema,
    lessonId: opaqueIdSchema,
    subjectId: opaqueIdSchema,
    gradeBand: { enum: GRADE_BANDS },
    gradeBandStartingRanges: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'gradeBand',
          'basis',
          'effectiveWorkBlockRange',
          'reviewAfterEligibleSessions',
        ],
        properties: {
          gradeBand: { enum: GRADE_BANDS },
          basis: { const: 'grade-band-starting-range' },
          effectiveWorkBlockRange: effectiveWorkBlockRangeSchema,
          reviewAfterEligibleSessions: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    },
    subjectTimingProfiles: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['subjectId', 'effectiveWorkBlockRange'],
        properties: {
          subjectId: opaqueIdSchema,
          effectiveWorkBlockRange: effectiveWorkBlockRangeSchema,
          rationale: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
      },
    },
    taskTimingProfiles: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['taskType', 'effectiveWorkBlockRange'],
        properties: {
          taskType: { enum: STUDY_TASK_TYPES },
          customTaskTypeId: opaqueIdSchema,
          effectiveWorkBlockRange: effectiveWorkBlockRangeSchema,
          rationale: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
      },
    },
    prerequisiteRefs: { type: 'array', maxItems: 100, items: prerequisiteSchema },
    segments: { type: 'array', minItems: 1, maxItems: 500, items: lessonSegmentSchema },
    segmentSequence: idArraySchema({ minimum: 1 }),
    focusProfileRef: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'revision'],
      properties: { id: opaqueIdSchema, revision: positiveIntegerSchema },
    },
    controlsRef: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'revision'],
      properties: { id: opaqueIdSchema, revision: positiveIntegerSchema },
    },
  },
  runtimeRefinements: [
    'segment IDs and sequence numbers are unique',
    'segmentSequence contains every segment exactly once in sequence order',
    'dependencies refer only to earlier segments',
    'custom task identifiers match the custom discriminant',
    'all timing ranges are ordered',
  ],
})

const PLAN_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'lessonId',
  'subjectId',
  'gradeBand',
  'gradeBandStartingRanges',
  'subjectTimingProfiles',
  'taskTimingProfiles',
  'prerequisiteRefs',
  'segments',
  'segmentSequence',
  'focusProfileRef',
  'controlsRef',
] as const

function validatePrerequisite(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is PrerequisiteReference {
  const record = expectRecord(context, value, path, [
    'skillId',
    'relationship',
    'minimumOutcome',
    'onGap',
  ])
  if (!record) return false
  expectId(context, record.skillId, propertyPath(path, 'skillId'))
  expectString(context, record.relationship, propertyPath(path, 'relationship'), {
    allowed: ['required', 'supporting'],
  })
  expectString(context, record.minimumOutcome, propertyPath(path, 'minimumOutcome'), {
    allowed: ['introduced', 'progressing', 'demonstrated', 'retained'],
  })
  expectString(context, record.onGap, propertyPath(path, 'onGap'), {
    allowed: ['remediate-before-segment', 'embed-review', 'request-adult-review'],
  })
  return true
}

function validateTiming(
  context: ValidationContext,
  value: unknown,
  path: string,
): void {
  const record = expectRecord(context, value, path, [
    'minimumMinutes',
    'plannedMinutes',
    'maximumMinutes',
  ])
  if (!record) return
  const minimumValid = expectNumber(context, record.minimumMinutes, propertyPath(path, 'minimumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  const plannedValid = expectNumber(context, record.plannedMinutes, propertyPath(path, 'plannedMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  const maximumValid = expectNumber(context, record.maximumMinutes, propertyPath(path, 'maximumMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 240,
  })
  if (
    minimumValid &&
    plannedValid &&
    maximumValid &&
    !(
      (record.minimumMinutes as number) <= (record.plannedMinutes as number) &&
      (record.plannedMinutes as number) <= (record.maximumMinutes as number)
    )
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'Expected minimumMinutes <= plannedMinutes <= maximumMinutes.',
    })
  }
}

function validateCognitiveLoad(context: ValidationContext, value: unknown, path: string): void {
  const record = expectRecord(context, value, path, [
    'overallLevel',
    'novelty',
    'workingMemoryDemand',
    'interactionDemand',
    'supportLevel',
    'supportStrategies',
  ])
  if (!record) return
  for (const key of [
    'overallLevel',
    'novelty',
    'workingMemoryDemand',
    'interactionDemand',
    'supportLevel',
  ] as const) {
    expectString(context, record[key], propertyPath(path, key), { allowed: LOAD_LEVELS })
  }
  expectStringArray(context, record.supportStrategies, propertyPath(path, 'supportStrategies'), {
    unique: true,
    maximumLength: 30,
  })
}

function validateActiveResponse(context: ValidationContext, value: unknown, path: string): void {
  const record = expectRecord(context, value, path, [
    'required',
    'modes',
    'minimumResponseCount',
    'maximumPassiveMinutes',
  ])
  if (!record) return
  const requiredValid = expectBoolean(context, record.required, propertyPath(path, 'required'))
  const modes = expectStringArray(context, record.modes, propertyPath(path, 'modes'), {
    unique: true,
    allowed: ACTIVE_RESPONSE_MODES,
    maximumLength: ACTIVE_RESPONSE_MODES.length,
  })
  const minimumValid = expectNumber(
    context,
    record.minimumResponseCount,
    propertyPath(path, 'minimumResponseCount'),
    { integer: true, minimum: 0, maximum: 500 },
  )
  if (record.maximumPassiveMinutes !== undefined) {
    expectNumber(context, record.maximumPassiveMinutes, propertyPath(path, 'maximumPassiveMinutes'), {
      integer: true,
      minimum: 1,
      maximum: 240,
    })
  }
  if (
    requiredValid &&
    record.required === true &&
    ((modes?.length ?? 0) === 0 || (minimumValid && (record.minimumResponseCount as number) < 1))
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'A required active response needs at least one mode and one response.',
    })
  }
  if (
    requiredValid &&
    record.required === false &&
    minimumValid &&
    (record.minimumResponseCount as number) !== 0
  ) {
    context.add({
      code: 'invariant',
      path: propertyPath(path, 'minimumResponseCount'),
      message: 'A non-required active response must use a zero minimum.',
    })
  }
}

function validateBreakEligibility(context: ValidationContext, value: unknown, path: string): void {
  const record = expectRecord(context, value, path, [
    'eligible',
    'studentMayRequest',
    'approvalRequired',
    'availableAfterActiveMinutes',
    'recommendedBreakMinutes',
  ])
  if (!record) return
  const eligibleValid = expectBoolean(context, record.eligible, propertyPath(path, 'eligible'))
  expectBoolean(context, record.studentMayRequest, propertyPath(path, 'studentMayRequest'))
  expectBoolean(context, record.approvalRequired, propertyPath(path, 'approvalRequired'))
  if (record.availableAfterActiveMinutes !== undefined) {
    expectNumber(
      context,
      record.availableAfterActiveMinutes,
      propertyPath(path, 'availableAfterActiveMinutes'),
      { integer: true, minimum: 1, maximum: 240 },
    )
  }
  if (record.recommendedBreakMinutes !== undefined) {
    expectNumber(
      context,
      record.recommendedBreakMinutes,
      propertyPath(path, 'recommendedBreakMinutes'),
      { integer: true, minimum: 1, maximum: 120 },
    )
  }
  if (
    eligibleValid &&
    record.eligible === false &&
    (record.availableAfterActiveMinutes !== undefined ||
      record.recommendedBreakMinutes !== undefined)
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'An ineligible segment cannot define break timing.',
    })
  }
}

function validateMasteryCheck(context: ValidationContext, value: unknown, path: string): void {
  const record = expectRecord(context, value, path, [
    'required',
    'skillIds',
    'learningObjectiveIds',
    'minimumItemCount',
    'criterion',
  ])
  if (!record) return
  const requiredValid = expectBoolean(context, record.required, propertyPath(path, 'required'))
  const skillIds = expectStringArray(context, record.skillIds, propertyPath(path, 'skillIds'), {
    ids: true,
    unique: true,
  })
  const objectiveIds = expectStringArray(
    context,
    record.learningObjectiveIds,
    propertyPath(path, 'learningObjectiveIds'),
    { ids: true, unique: true },
  )
  const itemCountValid = expectNumber(
    context,
    record.minimumItemCount,
    propertyPath(path, 'minimumItemCount'),
    { integer: true, minimum: 0, maximum: 100 },
  )
  if (record.criterion !== undefined) {
    const criterion = expectRecord(context, record.criterion, propertyPath(path, 'criterion'), [
      'minimumAccuracyPercent',
      'minimumIndependentResponses',
      'maximumHintCount',
    ])
    if (criterion) {
      expectNumber(
        context,
        criterion.minimumAccuracyPercent,
        propertyPath(propertyPath(path, 'criterion'), 'minimumAccuracyPercent'),
        { minimum: 0, maximum: 100 },
      )
      expectNumber(
        context,
        criterion.minimumIndependentResponses,
        propertyPath(propertyPath(path, 'criterion'), 'minimumIndependentResponses'),
        { integer: true, minimum: 0, maximum: 100 },
      )
      if (criterion.maximumHintCount !== undefined) {
        expectNumber(
          context,
          criterion.maximumHintCount,
          propertyPath(propertyPath(path, 'criterion'), 'maximumHintCount'),
          { integer: true, minimum: 0, maximum: 100 },
        )
      }
    }
  }
  if (
    requiredValid &&
    record.required === true &&
    ((skillIds?.length ?? 0) + (objectiveIds?.length ?? 0) === 0 ||
      (itemCountValid && (record.minimumItemCount as number) < 1) ||
      record.criterion === undefined)
  ) {
    context.add({
      code: 'invariant',
      path,
      message: 'A required mastery check needs a target, at least one item, and a criterion.',
    })
  }
}

function validateVersionedReference(
  context: ValidationContext,
  value: unknown,
  path: string,
): void {
  const record = expectRecord(context, value, path, ['id', 'revision'])
  if (!record) return
  expectId(context, record.id, propertyPath(path, 'id'))
  expectNumber(context, record.revision, propertyPath(path, 'revision'), {
    integer: true,
    minimum: 1,
  })
}

function validatePlan(value: unknown, context: ValidationContext): value is LessonStudyPlan {
  const record = expectRecord(context, value, '$', PLAN_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'lesson-study-plan')
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.lessonId, '$.lessonId')
  expectId(context, record.subjectId, '$.subjectId')
  expectString(context, record.gradeBand, '$.gradeBand', { allowed: GRADE_BANDS })

  const gradeRanges = expectArray(context, record.gradeBandStartingRanges, '$.gradeBandStartingRanges', {
    minimumLength: 1,
    maximumLength: 3,
  })
  const gradeRangeBands = new Set<string>()
  gradeRanges?.forEach((entry, index) => {
    const path = indexPath('$.gradeBandStartingRanges', index)
    const range = expectRecord(context, entry, path, [
      'gradeBand',
      'basis',
      'effectiveWorkBlockRange',
      'reviewAfterEligibleSessions',
    ])
    if (!range) return
    if (expectString(context, range.gradeBand, propertyPath(path, 'gradeBand'), { allowed: GRADE_BANDS })) {
      const band = range.gradeBand as string
      if (gradeRangeBands.has(band)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'gradeBand'), message: `Duplicate grade band "${band}".` })
      }
      gradeRangeBands.add(band)
    }
    expectString(context, range.basis, propertyPath(path, 'basis'), {
      allowed: ['grade-band-starting-range'],
    })
    validateEffectiveWorkBlockRange(
      context,
      range.effectiveWorkBlockRange,
      propertyPath(path, 'effectiveWorkBlockRange'),
    )
    expectNumber(
      context,
      range.reviewAfterEligibleSessions,
      propertyPath(path, 'reviewAfterEligibleSessions'),
      { integer: true, minimum: 1, maximum: 100 },
    )
  })
  if (typeof record.gradeBand === 'string' && !gradeRangeBands.has(record.gradeBand)) {
    context.add({
      code: 'reference',
      path: '$.gradeBandStartingRanges',
      message: 'The plan gradeBand must have a starting range.',
    })
  }

  const subjectProfiles = expectArray(context, record.subjectTimingProfiles, '$.subjectTimingProfiles', {
    maximumLength: 100,
  })
  const seenSubjects = new Set<string>()
  subjectProfiles?.forEach((entry, index) => {
    const path = indexPath('$.subjectTimingProfiles', index)
    const profile = expectRecord(context, entry, path, [
      'subjectId',
      'effectiveWorkBlockRange',
      'rationale',
    ])
    if (!profile) return
    if (expectId(context, profile.subjectId, propertyPath(path, 'subjectId'))) {
      const subject = profile.subjectId as string
      if (seenSubjects.has(subject)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'subjectId'), message: `Duplicate subject "${subject}".` })
      }
      seenSubjects.add(subject)
    }
    validateEffectiveWorkBlockRange(
      context,
      profile.effectiveWorkBlockRange,
      propertyPath(path, 'effectiveWorkBlockRange'),
    )
    if (profile.rationale !== undefined) {
      expectString(context, profile.rationale, propertyPath(path, 'rationale'), {
        minimumLength: 1,
        maximumLength: 1_000,
      })
    }
  })

  const taskProfiles = expectArray(context, record.taskTimingProfiles, '$.taskTimingProfiles', {
    maximumLength: 100,
  })
  const seenTasks = new Set<string>()
  taskProfiles?.forEach((entry, index) => {
    const path = indexPath('$.taskTimingProfiles', index)
    const profile = expectRecord(context, entry, path, [
      'taskType',
      'customTaskTypeId',
      'effectiveWorkBlockRange',
      'rationale',
    ])
    if (!profile) return
    const taskValid = expectString(context, profile.taskType, propertyPath(path, 'taskType'), {
      allowed: STUDY_TASK_TYPES,
    })
    const customIdValid =
      profile.customTaskTypeId === undefined ||
      expectId(context, profile.customTaskTypeId, propertyPath(path, 'customTaskTypeId'))
    if (taskValid) {
      const taskKey =
        profile.taskType === 'custom' && typeof profile.customTaskTypeId === 'string'
          ? `custom:${profile.customTaskTypeId}`
          : String(profile.taskType)
      if (seenTasks.has(taskKey)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'taskType'), message: `Duplicate task timing profile "${taskKey}".` })
      }
      seenTasks.add(taskKey)
      if (profile.taskType === 'custom' && profile.customTaskTypeId === undefined) {
        context.add({ code: 'required', path: propertyPath(path, 'customTaskTypeId'), message: 'A custom task requires customTaskTypeId.' })
      }
      if (profile.taskType !== 'custom' && profile.customTaskTypeId !== undefined && customIdValid) {
        context.add({ code: 'invariant', path: propertyPath(path, 'customTaskTypeId'), message: 'customTaskTypeId is only allowed for custom tasks.' })
      }
    }
    validateEffectiveWorkBlockRange(
      context,
      profile.effectiveWorkBlockRange,
      propertyPath(path, 'effectiveWorkBlockRange'),
    )
    if (profile.rationale !== undefined) {
      expectString(context, profile.rationale, propertyPath(path, 'rationale'), {
        minimumLength: 1,
        maximumLength: 1_000,
      })
    }
  })

  const planPrerequisites = expectArray(context, record.prerequisiteRefs, '$.prerequisiteRefs', {
    maximumLength: 100,
  })
  const seenPlanPrerequisites = new Set<string>()
  planPrerequisites?.forEach((entry, index) => {
    const path = indexPath('$.prerequisiteRefs', index)
    if (validatePrerequisite(context, entry, path) && typeof entry.skillId === 'string') {
      const skillId = entry.skillId as string
      if (seenPlanPrerequisites.has(skillId)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'skillId'), message: `Duplicate prerequisite "${skillId}".` })
      }
      seenPlanPrerequisites.add(skillId)
    }
  })

  const segments = expectArray(context, record.segments, '$.segments', {
    minimumLength: 1,
    maximumLength: 500,
  })
  const segmentIds = new Map<string, number>()
  const segmentSequenceNumbers = new Set<number>()
  segments?.forEach((entry, index) => {
    const path = indexPath('$.segments', index)
    const segment = expectRecord(context, entry, path, [
      'id',
      'sequence',
      'title',
      'taskType',
      'customTaskTypeId',
      'learningObjectiveIds',
      'timing',
      'cognitiveLoad',
      'activeResponse',
      'breakEligibility',
      'masteryCheck',
      'prerequisiteRefs',
      'dependsOnSegmentIds',
    ])
    if (!segment) return
    if (expectId(context, segment.id, propertyPath(path, 'id'))) {
      const id = segment.id as string
      if (segmentIds.has(id)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'id'), message: `Duplicate segment id "${id}".` })
      } else {
        segmentIds.set(id, index)
      }
    }
    if (
      expectNumber(context, segment.sequence, propertyPath(path, 'sequence'), {
        integer: true,
        minimum: 1,
        maximum: 500,
      })
    ) {
      const sequence = segment.sequence as number
      if (segmentSequenceNumbers.has(sequence)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'sequence'), message: `Duplicate segment sequence ${sequence}.` })
      }
      segmentSequenceNumbers.add(sequence)
    }
    expectString(context, segment.title, propertyPath(path, 'title'), {
      minimumLength: 1,
      maximumLength: 300,
    })
    const taskValid = expectString(context, segment.taskType, propertyPath(path, 'taskType'), {
      allowed: STUDY_TASK_TYPES,
    })
    if (segment.customTaskTypeId !== undefined) {
      expectId(context, segment.customTaskTypeId, propertyPath(path, 'customTaskTypeId'))
    }
    if (taskValid && segment.taskType === 'custom' && segment.customTaskTypeId === undefined) {
      context.add({ code: 'required', path: propertyPath(path, 'customTaskTypeId'), message: 'A custom task requires customTaskTypeId.' })
    }
    if (taskValid && segment.taskType !== 'custom' && segment.customTaskTypeId !== undefined) {
      context.add({ code: 'invariant', path: propertyPath(path, 'customTaskTypeId'), message: 'customTaskTypeId is only allowed for custom tasks.' })
    }
    expectStringArray(
      context,
      segment.learningObjectiveIds,
      propertyPath(path, 'learningObjectiveIds'),
      { ids: true, unique: true },
    )
    validateTiming(context, segment.timing, propertyPath(path, 'timing'))
    validateCognitiveLoad(context, segment.cognitiveLoad, propertyPath(path, 'cognitiveLoad'))
    validateActiveResponse(context, segment.activeResponse, propertyPath(path, 'activeResponse'))
    validateBreakEligibility(context, segment.breakEligibility, propertyPath(path, 'breakEligibility'))
    validateMasteryCheck(context, segment.masteryCheck, propertyPath(path, 'masteryCheck'))
    const prerequisites = expectArray(
      context,
      segment.prerequisiteRefs,
      propertyPath(path, 'prerequisiteRefs'),
      { maximumLength: 100 },
    )
    const seenPrerequisites = new Set<string>()
    prerequisites?.forEach((prerequisite, prerequisiteIndex) => {
      const prerequisitePath = indexPath(propertyPath(path, 'prerequisiteRefs'), prerequisiteIndex)
      if (
        validatePrerequisite(context, prerequisite, prerequisitePath) &&
        typeof prerequisite.skillId === 'string'
      ) {
        const skillId = prerequisite.skillId as string
        if (seenPrerequisites.has(skillId)) {
          context.add({ code: 'duplicate', path: propertyPath(prerequisitePath, 'skillId'), message: `Duplicate prerequisite "${skillId}".` })
        }
        seenPrerequisites.add(skillId)
      }
    })
    expectStringArray(
      context,
      segment.dependsOnSegmentIds,
      propertyPath(path, 'dependsOnSegmentIds'),
      { ids: true, unique: true },
    )
  })

  const explicitSequence = expectStringArray(context, record.segmentSequence, '$.segmentSequence', {
    ids: true,
    unique: true,
    minimumLength: 1,
  })
  if (segments && explicitSequence) {
    if (explicitSequence.length !== segments.length) {
      context.add({
        code: 'sequence',
        path: '$.segmentSequence',
        message: 'segmentSequence must contain every segment exactly once.',
      })
    }
    const sortedSegments = [...segments]
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .sort((left, right) => Number(left.sequence) - Number(right.sequence))
    sortedSegments.forEach((segment, index) => {
      const expectedSequence = index + 1
      if (segment.sequence !== expectedSequence) {
        context.add({
          code: 'sequence',
          path: `$.segments[${segments.indexOf(segment)}].sequence`,
          message: `Segment sequence must be contiguous; expected ${expectedSequence}.`,
        })
      }
      if (typeof segment.id === 'string' && explicitSequence[index] !== segment.id) {
        context.add({
          code: 'sequence',
          path: indexPath('$.segmentSequence', index),
          message: `Expected segment "${segment.id}" at this sequence position.`,
        })
      }
    })
    explicitSequence.forEach((id, index) => {
      if (!segmentIds.has(id)) {
        context.add({
          code: 'reference',
          path: indexPath('$.segmentSequence', index),
          message: `Unknown segment reference "${id}".`,
        })
      }
    })
    segments.forEach((entry, segmentIndex) => {
      if (typeof entry !== 'object' || entry === null) return
      const segment = entry as Record<string, unknown>
      if (!Array.isArray(segment.dependsOnSegmentIds)) return
      segment.dependsOnSegmentIds.forEach((dependency, dependencyIndex) => {
        if (typeof dependency !== 'string') return
        const dependencyPosition = segmentIds.get(dependency)
        const dependencyPath = indexPath(
          `$.segments[${segmentIndex}].dependsOnSegmentIds`,
          dependencyIndex,
        )
        if (dependencyPosition === undefined) {
          context.add({
            code: 'reference',
            path: dependencyPath,
            message: `Unknown segment dependency "${dependency}".`,
          })
        } else if (dependencyPosition >= segmentIndex) {
          context.add({
            code: 'sequence',
            path: dependencyPath,
            message: 'A segment may depend only on an earlier segment.',
          })
        }
      })
    })
  }

  if (record.focusProfileRef !== undefined) {
    validateVersionedReference(context, record.focusProfileRef, '$.focusProfileRef')
  }
  if (record.controlsRef !== undefined) {
    validateVersionedReference(context, record.controlsRef, '$.controlsRef')
  }

  return context.issues.length === 0
}

export const lessonStudyPlanSchema = defineRuntimeSchema<LessonStudyPlan>({
  schemaId: 'lesson-study-plan',
  kind: 'lesson-study-plan',
  jsonSchema: lessonStudyPlanJsonSchema,
  validateValue: validatePlan,
})

export const validateLessonStudyPlan = lessonStudyPlanSchema.validate
export const parseLessonStudyPlan = lessonStudyPlanSchema.parse
export const isLessonStudyPlan = lessonStudyPlanSchema.is

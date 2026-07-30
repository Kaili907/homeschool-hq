import {
  STUDY_TASK_TYPES,
  type StudentFocusProfile,
} from '../contracts/index.ts'
import {
  actorSchema,
  createRootJsonSchema,
  effectiveWorkBlockRangeSchema,
  idArraySchema,
  isoDateTimeSchema,
  opaqueIdSchema,
  stringArraySchema,
  type JsonSchema,
} from './json-schema.ts'
import {
  compareDateTimes,
  defineRuntimeSchema,
  expectArray,
  expectBoolean,
  expectId,
  expectISODateTime,
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
const TIMER_PREFERENCES = [
  'hidden',
  'count-up',
  'count-down',
  'progress-bar',
  'milestones-only',
] as const
const INPUT_MODES = ['keyboard', 'touch', 'speech', 'paper', 'switch'] as const

const scopedFocusSchema: JsonSchema = {
  type: 'object',
  required: ['effectiveWorkBlockRange', 'breakDurationMinutes', 'evidenceIds'],
  properties: {
    effectiveWorkBlockRange: effectiveWorkBlockRangeSchema,
    breakDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
    evidenceIds: idArraySchema(),
  },
}

const actorWithAdultRoleSchema: JsonSchema = {
  ...actorSchema,
  properties: {
    role: { enum: ['parent', 'teacher'] },
    actorId: opaqueIdSchema,
  },
}

export const studentFocusProfileJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:student-focus-profile:1',
  title: 'Student Focus Profile',
  kind: 'student-focus-profile',
  description:
    'Contextual and revisable effective work-block guidance. It never defines a permanent child trait.',
  required: [
    'studentId',
    'gradeBand',
    'estimate',
    'breakDurationMinutes',
    'timerPresentationPreference',
    'taskSpecificProfiles',
    'subjectSpecificProfiles',
    'accessibility',
    'accommodations',
    'adjustmentHistory',
  ],
  properties: {
    studentId: opaqueIdSchema,
    gradeBand: { enum: GRADE_BANDS },
    estimate: {
      oneOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'status',
            'eligibleObservationCount',
            'minimumObservationCount',
            'gradeBandStartingRange',
            'reason',
          ],
          properties: {
            status: { const: 'insufficient-data' },
            eligibleObservationCount: { type: 'integer', minimum: 0 },
            minimumObservationCount: { type: 'integer', minimum: 1 },
            gradeBandStartingRange: effectiveWorkBlockRangeSchema,
            reason: {
              enum: ['new-profile', 'too-few-sessions', 'inconsistent-contexts', 'data-withheld'],
            },
          },
        },
        {
          type: 'object',
          additionalProperties: false,
          required: [
            'status',
            'eligibleObservationCount',
            'assessedAt',
            'confidence',
            'baselineWorkDurationMinutes',
            'currentTargetWorkDurationMinutes',
            'comfortableMaximumWorkDurationMinutes',
            'effectiveWorkBlockRange',
            'evidenceIds',
          ],
          properties: {
            status: { const: 'established' },
            eligibleObservationCount: { type: 'integer', minimum: 1 },
            assessedAt: isoDateTimeSchema,
            confidence: { enum: ['low', 'moderate', 'high'] },
            baselineWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
            currentTargetWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
            comfortableMaximumWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
            effectiveWorkBlockRange: effectiveWorkBlockRangeSchema,
            evidenceIds: idArraySchema({ minimum: 1 }),
          },
        },
      ],
    },
    breakDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
    timerPresentationPreference: { enum: TIMER_PREFERENCES },
    taskSpecificProfiles: {
      type: 'array',
      maxItems: 100,
      items: {
        allOf: [
          scopedFocusSchema,
          {
            type: 'object',
            required: ['taskType'],
            properties: {
              taskType: { enum: STUDY_TASK_TYPES },
              customTaskTypeId: opaqueIdSchema,
            },
          },
        ],
        unevaluatedProperties: false,
      },
    },
    subjectSpecificProfiles: {
      type: 'array',
      maxItems: 100,
      items: {
        allOf: [
          scopedFocusSchema,
          {
            type: 'object',
            required: ['subjectId'],
            properties: { subjectId: opaqueIdSchema },
          },
        ],
        unevaluatedProperties: false,
      },
    },
    accessibility: {
      type: 'object',
      additionalProperties: false,
      required: [
        'textScalePercent',
        'reducedMotion',
        'highContrast',
        'narration',
        'captions',
        'inputModes',
        'lowDistractionPresentation',
      ],
      properties: {
        textScalePercent: { type: 'integer', minimum: 75, maximum: 300 },
        reducedMotion: { type: 'boolean' },
        highContrast: { type: 'boolean' },
        narration: { enum: ['off', 'available', 'preferred'] },
        captions: { type: 'boolean' },
        inputModes: stringArraySchema({ minimum: 1, allowed: INPUT_MODES }),
        lowDistractionPresentation: { type: 'boolean' },
      },
    },
    accommodations: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'category', 'enabled', 'functionalDescription', 'approvedBy'],
        properties: {
          id: opaqueIdSchema,
          category: {
            enum: [
              'presentation',
              'response',
              'setting',
              'timing',
              'assistive-technology',
              'other',
            ],
          },
          enabled: { type: 'boolean' },
          functionalDescription: { type: 'string', minLength: 1, maxLength: 1_000 },
          approvedBy: { enum: ['parent', 'teacher', 'school-plan'] },
          reviewAt: isoDateTimeSchema,
        },
      },
    },
    adjustmentHistory: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'changedAt', 'changedBy', 'nextTargetMinutes', 'reason', 'evidenceIds'],
        properties: {
          id: opaqueIdSchema,
          changedAt: isoDateTimeSchema,
          changedBy: actorSchema,
          previousTargetMinutes: { type: 'integer', minimum: 1, maximum: 240 },
          nextTargetMinutes: { type: 'integer', minimum: 1, maximum: 240 },
          reason: {
            enum: [
              'new-evidence',
              'student-feedback',
              'accommodation',
              'parent-override',
              'teacher-override',
              'context-change',
            ],
          },
          evidenceIds: idArraySchema(),
        },
      },
    },
    parentOverride: {
      type: 'object',
      additionalProperties: false,
      required: ['active', 'setBy', 'reason', 'createdAt', 'reviewAt'],
      properties: {
        active: { type: 'boolean' },
        maximumWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
        targetWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
        breakDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
        setBy: actorWithAdultRoleSchema,
        reason: { type: 'string', minLength: 1, maxLength: 1_000 },
        createdAt: isoDateTimeSchema,
        expiresAt: isoDateTimeSchema,
        reviewAt: isoDateTimeSchema,
      },
    },
    contextSkillIds: idArraySchema(),
  },
  runtimeRefinements: [
    'insufficient-data cannot contain personalized duration estimates',
    'established durations and effective work-block range are ordered',
    'active parent maximum caps the current target',
    'override and adjustment chronology is valid',
    'task, subject, accommodation, and adjustment identifiers are unique',
  ],
})

const PROFILE_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'gradeBand',
  'estimate',
  'breakDurationMinutes',
  'timerPresentationPreference',
  'taskSpecificProfiles',
  'subjectSpecificProfiles',
  'accessibility',
  'accommodations',
  'adjustmentHistory',
  'parentOverride',
  'contextSkillIds',
] as const

function validateActor(
  context: ValidationContext,
  value: unknown,
  path: string,
  roles: readonly string[] = ['student', 'parent', 'teacher', 'tutor', 'system'],
): void {
  const actor = expectRecord(context, value, path, ['role', 'actorId'])
  if (!actor) return
  expectString(context, actor.role, propertyPath(path, 'role'), { allowed: roles })
  if (actor.actorId !== undefined) expectId(context, actor.actorId, propertyPath(path, 'actorId'))
  if (actor.role !== 'system' && actor.actorId === undefined) {
    context.add({
      code: 'required',
      path: propertyPath(path, 'actorId'),
      message: 'A non-system actor requires actorId.',
    })
  }
}

function validateScopedProfile(
  context: ValidationContext,
  record: Record<string, unknown>,
  path: string,
): void {
  validateEffectiveWorkBlockRange(
    context,
    record.effectiveWorkBlockRange,
    propertyPath(path, 'effectiveWorkBlockRange'),
  )
  expectNumber(context, record.breakDurationMinutes, propertyPath(path, 'breakDurationMinutes'), {
    integer: true,
    minimum: 1,
    maximum: 120,
  })
  expectStringArray(context, record.evidenceIds, propertyPath(path, 'evidenceIds'), {
    ids: true,
    unique: true,
  })
}

function validateFocusProfile(
  value: unknown,
  context: ValidationContext,
): value is StudentFocusProfile {
  const record = expectRecord(context, value, '$', PROFILE_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'student-focus-profile')
  expectId(context, record.studentId, '$.studentId')
  expectString(context, record.gradeBand, '$.gradeBand', { allowed: GRADE_BANDS })

  const estimate = expectRecord(context, record.estimate, '$.estimate')
  let establishedTarget: number | undefined
  if (estimate) {
    if (estimate.status === 'insufficient-data') {
      const allowed = [
        'status',
        'eligibleObservationCount',
        'minimumObservationCount',
        'gradeBandStartingRange',
        'reason',
      ] as const
      for (const key of Object.keys(estimate)) {
        if (!allowed.includes(key as (typeof allowed)[number])) {
          context.add({
            code: /duration|target|maximum|baseline/i.test(key) ? 'safety' : 'unknown-key',
            path: propertyPath('$.estimate', key),
            message:
              'Insufficient data cannot contain a personalized duration estimate; use generic grade-band guidance.',
          })
        }
      }
      expectString(context, estimate.status, '$.estimate.status', {
        allowed: ['insufficient-data'],
      })
      const eligibleValid = expectNumber(
        context,
        estimate.eligibleObservationCount,
        '$.estimate.eligibleObservationCount',
        { integer: true, minimum: 0 },
      )
      const minimumValid = expectNumber(
        context,
        estimate.minimumObservationCount,
        '$.estimate.minimumObservationCount',
        { integer: true, minimum: 1 },
      )
      if (
        eligibleValid &&
        minimumValid &&
        (estimate.eligibleObservationCount as number) >=
          (estimate.minimumObservationCount as number)
      ) {
        context.add({
          code: 'invariant',
          path: '$.estimate.status',
          message: 'insufficient-data requires fewer eligible observations than the minimum.',
        })
      }
      validateEffectiveWorkBlockRange(
        context,
        estimate.gradeBandStartingRange,
        '$.estimate.gradeBandStartingRange',
      )
      expectString(context, estimate.reason, '$.estimate.reason', {
        allowed: ['new-profile', 'too-few-sessions', 'inconsistent-contexts', 'data-withheld'],
      })
    } else if (estimate.status === 'established') {
      const established = expectRecord(context, estimate, '$.estimate', [
        'status',
        'eligibleObservationCount',
        'assessedAt',
        'confidence',
        'baselineWorkDurationMinutes',
        'currentTargetWorkDurationMinutes',
        'comfortableMaximumWorkDurationMinutes',
        'effectiveWorkBlockRange',
        'evidenceIds',
      ])
      if (established) {
        expectString(context, established.status, '$.estimate.status', { allowed: ['established'] })
        expectNumber(
          context,
          established.eligibleObservationCount,
          '$.estimate.eligibleObservationCount',
          { integer: true, minimum: 1 },
        )
        expectISODateTime(context, established.assessedAt, '$.estimate.assessedAt')
        expectString(context, established.confidence, '$.estimate.confidence', {
          allowed: ['low', 'moderate', 'high'],
        })
        const baselineValid = expectNumber(
          context,
          established.baselineWorkDurationMinutes,
          '$.estimate.baselineWorkDurationMinutes',
          { integer: true, minimum: 1, maximum: 240 },
        )
        const targetValid = expectNumber(
          context,
          established.currentTargetWorkDurationMinutes,
          '$.estimate.currentTargetWorkDurationMinutes',
          { integer: true, minimum: 1, maximum: 240 },
        )
        const comfortableValid = expectNumber(
          context,
          established.comfortableMaximumWorkDurationMinutes,
          '$.estimate.comfortableMaximumWorkDurationMinutes',
          { integer: true, minimum: 1, maximum: 240 },
        )
        validateEffectiveWorkBlockRange(
          context,
          established.effectiveWorkBlockRange,
          '$.estimate.effectiveWorkBlockRange',
        )
        const evidenceIds = expectStringArray(
          context,
          established.evidenceIds,
          '$.estimate.evidenceIds',
          { ids: true, unique: true, minimumLength: 1 },
        )
        if (evidenceIds && evidenceIds.length === 0) {
          context.add({
            code: 'required',
            path: '$.estimate.evidenceIds',
            message: 'An established estimate requires evidence.',
          })
        }
        if (baselineValid && targetValid && comfortableValid) {
          establishedTarget = established.currentTargetWorkDurationMinutes as number
          const baseline = established.baselineWorkDurationMinutes as number
          const target = established.currentTargetWorkDurationMinutes as number
          const comfortable = established.comfortableMaximumWorkDurationMinutes as number
          if (!(baseline <= comfortable && target <= comfortable)) {
            context.add({
              code: 'invariant',
              path: '$.estimate',
              message: 'Baseline and current target cannot exceed the comfortable maximum.',
            })
          }
          const range = established.effectiveWorkBlockRange
          if (typeof range === 'object' && range !== null) {
            const rangeRecord = range as Record<string, unknown>
            if (
              typeof rangeRecord.minimumMinutes === 'number' &&
              typeof rangeRecord.maximumMinutes === 'number' &&
              (target < rangeRecord.minimumMinutes || target > rangeRecord.maximumMinutes)
            ) {
              context.add({
                code: 'invariant',
                path: '$.estimate.currentTargetWorkDurationMinutes',
                message: 'Current target must fall inside the effective work-block range.',
              })
            }
          }
        }
      }
    } else {
      context.add({
        code: 'literal',
        path: '$.estimate.status',
        message: 'Expected insufficient-data or established.',
      })
    }
  }

  expectNumber(context, record.breakDurationMinutes, '$.breakDurationMinutes', {
    integer: true,
    minimum: 1,
    maximum: 120,
  })
  expectString(context, record.timerPresentationPreference, '$.timerPresentationPreference', {
    allowed: TIMER_PREFERENCES,
  })

  const taskProfiles = expectArray(context, record.taskSpecificProfiles, '$.taskSpecificProfiles', {
    maximumLength: 100,
  })
  const taskKeys = new Set<string>()
  taskProfiles?.forEach((entry, index) => {
    const path = indexPath('$.taskSpecificProfiles', index)
    const profile = expectRecord(context, entry, path, [
      'taskType',
      'customTaskTypeId',
      'effectiveWorkBlockRange',
      'breakDurationMinutes',
      'evidenceIds',
    ])
    if (!profile) return
    const taskValid = expectString(context, profile.taskType, propertyPath(path, 'taskType'), {
      allowed: STUDY_TASK_TYPES,
    })
    if (profile.customTaskTypeId !== undefined) {
      expectId(context, profile.customTaskTypeId, propertyPath(path, 'customTaskTypeId'))
    }
    if (taskValid) {
      if (profile.taskType === 'custom' && profile.customTaskTypeId === undefined) {
        context.add({ code: 'required', path: propertyPath(path, 'customTaskTypeId'), message: 'A custom task requires customTaskTypeId.' })
      }
      if (profile.taskType !== 'custom' && profile.customTaskTypeId !== undefined) {
        context.add({ code: 'invariant', path: propertyPath(path, 'customTaskTypeId'), message: 'customTaskTypeId is only allowed for custom tasks.' })
      }
      const key =
        profile.taskType === 'custom'
          ? `custom:${String(profile.customTaskTypeId)}`
          : String(profile.taskType)
      if (taskKeys.has(key)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'taskType'), message: `Duplicate task profile "${key}".` })
      }
      taskKeys.add(key)
    }
    validateScopedProfile(context, profile, path)
  })

  const subjectProfiles = expectArray(
    context,
    record.subjectSpecificProfiles,
    '$.subjectSpecificProfiles',
    { maximumLength: 100 },
  )
  const subjectIds = new Set<string>()
  subjectProfiles?.forEach((entry, index) => {
    const path = indexPath('$.subjectSpecificProfiles', index)
    const profile = expectRecord(context, entry, path, [
      'subjectId',
      'effectiveWorkBlockRange',
      'breakDurationMinutes',
      'evidenceIds',
    ])
    if (!profile) return
    if (expectId(context, profile.subjectId, propertyPath(path, 'subjectId'))) {
      const subjectId = profile.subjectId as string
      if (subjectIds.has(subjectId)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'subjectId'), message: `Duplicate subject profile "${subjectId}".` })
      }
      subjectIds.add(subjectId)
    }
    validateScopedProfile(context, profile, path)
  })

  const accessibility = expectRecord(context, record.accessibility, '$.accessibility', [
    'textScalePercent',
    'reducedMotion',
    'highContrast',
    'narration',
    'captions',
    'inputModes',
    'lowDistractionPresentation',
  ])
  if (accessibility) {
    expectNumber(context, accessibility.textScalePercent, '$.accessibility.textScalePercent', {
      integer: true,
      minimum: 75,
      maximum: 300,
    })
    expectBoolean(context, accessibility.reducedMotion, '$.accessibility.reducedMotion')
    expectBoolean(context, accessibility.highContrast, '$.accessibility.highContrast')
    expectString(context, accessibility.narration, '$.accessibility.narration', {
      allowed: ['off', 'available', 'preferred'],
    })
    expectBoolean(context, accessibility.captions, '$.accessibility.captions')
    expectStringArray(context, accessibility.inputModes, '$.accessibility.inputModes', {
      allowed: INPUT_MODES,
      unique: true,
      minimumLength: 1,
      maximumLength: INPUT_MODES.length,
    })
    expectBoolean(
      context,
      accessibility.lowDistractionPresentation,
      '$.accessibility.lowDistractionPresentation',
    )
  }

  const accommodations = expectArray(context, record.accommodations, '$.accommodations', {
    maximumLength: 100,
  })
  const accommodationIds = new Set<string>()
  accommodations?.forEach((entry, index) => {
    const path = indexPath('$.accommodations', index)
    const accommodation = expectRecord(context, entry, path, [
      'id',
      'category',
      'enabled',
      'functionalDescription',
      'approvedBy',
      'reviewAt',
    ])
    if (!accommodation) return
    if (expectId(context, accommodation.id, propertyPath(path, 'id'))) {
      const id = accommodation.id as string
      if (accommodationIds.has(id)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'id'), message: `Duplicate accommodation id "${id}".` })
      }
      accommodationIds.add(id)
    }
    expectString(context, accommodation.category, propertyPath(path, 'category'), {
      allowed: [
        'presentation',
        'response',
        'setting',
        'timing',
        'assistive-technology',
        'other',
      ],
    })
    expectBoolean(context, accommodation.enabled, propertyPath(path, 'enabled'))
    expectString(
      context,
      accommodation.functionalDescription,
      propertyPath(path, 'functionalDescription'),
      { minimumLength: 1, maximumLength: 1_000 },
    )
    expectString(context, accommodation.approvedBy, propertyPath(path, 'approvedBy'), {
      allowed: ['parent', 'teacher', 'school-plan'],
    })
    if (accommodation.reviewAt !== undefined) {
      expectISODateTime(context, accommodation.reviewAt, propertyPath(path, 'reviewAt'))
    }
  })

  const adjustments = expectArray(context, record.adjustmentHistory, '$.adjustmentHistory', {
    maximumLength: 2_000,
  })
  const adjustmentIds = new Set<string>()
  let previousAdjustmentTime = Number.NEGATIVE_INFINITY
  adjustments?.forEach((entry, index) => {
    const path = indexPath('$.adjustmentHistory', index)
    const adjustment = expectRecord(context, entry, path, [
      'id',
      'changedAt',
      'changedBy',
      'previousTargetMinutes',
      'nextTargetMinutes',
      'reason',
      'evidenceIds',
    ])
    if (!adjustment) return
    if (expectId(context, adjustment.id, propertyPath(path, 'id'))) {
      const id = adjustment.id as string
      if (adjustmentIds.has(id)) {
        context.add({ code: 'duplicate', path: propertyPath(path, 'id'), message: `Duplicate adjustment id "${id}".` })
      }
      adjustmentIds.add(id)
    }
    if (expectISODateTime(context, adjustment.changedAt, propertyPath(path, 'changedAt'))) {
      const time = Date.parse(adjustment.changedAt as string)
      if (time < previousAdjustmentTime) {
        context.add({
          code: 'chronology',
          path: propertyPath(path, 'changedAt'),
          message: 'Adjustment history must be chronological.',
        })
      }
      previousAdjustmentTime = time
    }
    validateActor(context, adjustment.changedBy, propertyPath(path, 'changedBy'))
    if (adjustment.previousTargetMinutes !== undefined) {
      expectNumber(
        context,
        adjustment.previousTargetMinutes,
        propertyPath(path, 'previousTargetMinutes'),
        { integer: true, minimum: 1, maximum: 240 },
      )
    }
    expectNumber(
      context,
      adjustment.nextTargetMinutes,
      propertyPath(path, 'nextTargetMinutes'),
      { integer: true, minimum: 1, maximum: 240 },
    )
    expectString(context, adjustment.reason, propertyPath(path, 'reason'), {
      allowed: [
        'new-evidence',
        'student-feedback',
        'accommodation',
        'parent-override',
        'teacher-override',
        'context-change',
      ],
    })
    expectStringArray(context, adjustment.evidenceIds, propertyPath(path, 'evidenceIds'), {
      ids: true,
      unique: true,
    })
  })

  if (record.parentOverride !== undefined) {
    const override = expectRecord(context, record.parentOverride, '$.parentOverride', [
      'active',
      'maximumWorkDurationMinutes',
      'targetWorkDurationMinutes',
      'breakDurationMinutes',
      'setBy',
      'reason',
      'createdAt',
      'expiresAt',
      'reviewAt',
    ])
    if (override) {
      const activeValid = expectBoolean(context, override.active, '$.parentOverride.active')
      let maximum: number | undefined
      let target: number | undefined
      if (override.maximumWorkDurationMinutes !== undefined) {
        if (
          expectNumber(
            context,
            override.maximumWorkDurationMinutes,
            '$.parentOverride.maximumWorkDurationMinutes',
            { integer: true, minimum: 1, maximum: 240 },
          )
        ) {
          maximum = override.maximumWorkDurationMinutes as number
        }
      }
      if (override.targetWorkDurationMinutes !== undefined) {
        if (
          expectNumber(
            context,
            override.targetWorkDurationMinutes,
            '$.parentOverride.targetWorkDurationMinutes',
            { integer: true, minimum: 1, maximum: 240 },
          )
        ) {
          target = override.targetWorkDurationMinutes as number
        }
      }
      if (override.breakDurationMinutes !== undefined) {
        expectNumber(
          context,
          override.breakDurationMinutes,
          '$.parentOverride.breakDurationMinutes',
          { integer: true, minimum: 1, maximum: 120 },
        )
      }
      if (
        maximum === undefined &&
        target === undefined &&
        override.breakDurationMinutes === undefined
      ) {
        context.add({
          code: 'invariant',
          path: '$.parentOverride',
          message: 'An override must change at least one operational setting.',
        })
      }
      if (maximum !== undefined && target !== undefined && target > maximum) {
        context.add({
          code: 'invariant',
          path: '$.parentOverride.targetWorkDurationMinutes',
          message: 'Override target cannot exceed override maximum.',
        })
      }
      if (
        activeValid &&
        override.active === true &&
        maximum !== undefined &&
        establishedTarget !== undefined &&
        establishedTarget > maximum
      ) {
        context.add({
          code: 'invariant',
          path: '$.estimate.currentTargetWorkDurationMinutes',
          message: 'Current target cannot exceed an active parent maximum.',
        })
      }
      validateActor(context, override.setBy, '$.parentOverride.setBy', ['parent', 'teacher'])
      expectString(context, override.reason, '$.parentOverride.reason', {
        minimumLength: 1,
        maximumLength: 1_000,
      })
      expectISODateTime(context, override.createdAt, '$.parentOverride.createdAt')
      expectISODateTime(context, override.reviewAt, '$.parentOverride.reviewAt')
      compareDateTimes(
        context,
        override.createdAt,
        override.reviewAt,
        '$.parentOverride.reviewAt',
        'Override reviewAt cannot be earlier than createdAt.',
      )
      if (override.expiresAt !== undefined) {
        expectISODateTime(context, override.expiresAt, '$.parentOverride.expiresAt')
        compareDateTimes(
          context,
          override.createdAt,
          override.expiresAt,
          '$.parentOverride.expiresAt',
          'Override expiresAt cannot be earlier than createdAt.',
        )
      }
    }
  }

  if (record.contextSkillIds !== undefined) {
    expectStringArray(context, record.contextSkillIds, '$.contextSkillIds', {
      ids: true,
      unique: true,
    })
  }
  return context.issues.length === 0
}

export const studentFocusProfileSchema = defineRuntimeSchema<StudentFocusProfile>({
  schemaId: 'student-focus-profile',
  kind: 'student-focus-profile',
  jsonSchema: studentFocusProfileJsonSchema,
  validateValue: validateFocusProfile,
})

export const validateStudentFocusProfile = studentFocusProfileSchema.validate
export const parseStudentFocusProfile = studentFocusProfileSchema.parse
export const isStudentFocusProfile = studentFocusProfileSchema.is

import type { ParentTeacherControls } from '../contracts/index.ts'
import {
  createRootJsonSchema,
  idArraySchema,
  isoDateTimeSchema,
  opaqueIdSchema,
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
  validateHeader,
  validateMinuteRange,
  type ValidationContext,
} from './validation.ts'

const TIMER_PREFERENCES = [
  'hidden',
  'count-up',
  'count-down',
  'progress-bar',
  'milestones-only',
] as const

const INTERRUPTION_CATEGORIES = [
  'accessibility-need',
  'technology-issue',
  'scheduled-appointment',
  'family-need',
  'teacher-directed',
  'parent-directed',
  'wellbeing',
  'emergency',
] as const

const adultActorSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['role', 'actorId'],
  properties: {
    role: { enum: ['parent', 'teacher'] },
    actorId: opaqueIdSchema,
  },
}

export const parentTeacherControlsJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:parent-teacher-controls:1',
  title: 'Parent and Teacher Controls',
  kind: 'parent-teacher-controls',
  description:
    'Adult-defined operational guardrails and audit records. Maximum work duration is not a child trait.',
  required: [
    'studentId',
    'maximumWorkDurationMinutes',
    'breakDuration',
    'timerVisibility',
    'manualOverrides',
    'recommendationDecisions',
    'accommodations',
    'rescheduling',
    'reviewRequests',
    'approvedInterruptionCategories',
  ],
  properties: {
    studentId: opaqueIdSchema,
    maximumWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    breakDuration: {
      type: 'object',
      additionalProperties: false,
      required: ['minimumMinutes', 'defaultMinutes', 'maximumMinutes'],
      properties: {
        minimumMinutes: { type: 'integer', minimum: 1, maximum: 120 },
        defaultMinutes: { type: 'integer', minimum: 1, maximum: 120 },
        maximumMinutes: { type: 'integer', minimum: 1, maximum: 120 },
      },
    },
    timerVisibility: { enum: TIMER_PREFERENCES },
    manualOverrides: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'target', 'setBy', 'reason', 'createdAt'],
        properties: {
          id: opaqueIdSchema,
          target: {
            enum: [
              'work-duration',
              'break-duration',
              'timer-visibility',
              'schedule',
              'accommodation',
            ],
          },
          setBy: adultActorSchema,
          reason: { type: 'string', minLength: 1, maxLength: 1_000 },
          createdAt: isoDateTimeSchema,
          expiresAt: isoDateTimeSchema,
          maximumWorkDurationMinutes: { type: 'integer', minimum: 1, maximum: 240 },
          breakDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
          timerPresentation: { enum: TIMER_PREFERENCES },
          referenceId: opaqueIdSchema,
        },
      },
    },
    recommendationDecisions: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'recommendationId', 'decision', 'decidedBy', 'decidedAt'],
        properties: {
          id: opaqueIdSchema,
          recommendationId: opaqueIdSchema,
          decision: { enum: ['accepted', 'rejected'] },
          decidedBy: adultActorSchema,
          decidedAt: isoDateTimeSchema,
          reason: { type: 'string', minLength: 1, maxLength: 1_000 },
        },
      },
    },
    accommodations: {
      type: 'array',
      maxItems: 100,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'enabled', 'functionalDescription', 'source'],
        properties: {
          id: opaqueIdSchema,
          enabled: { type: 'boolean' },
          functionalDescription: { type: 'string', minLength: 1, maxLength: 1_000 },
          source: { enum: ['parent', 'teacher', 'school-plan'] },
          reviewAt: isoDateTimeSchema,
        },
      },
    },
    rescheduling: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'studyPlanId',
          'originalStartAt',
          'replacementStartAt',
          'changedBy',
          'reason',
          'changedAt',
        ],
        properties: {
          id: opaqueIdSchema,
          studyPlanId: opaqueIdSchema,
          originalStartAt: isoDateTimeSchema,
          replacementStartAt: isoDateTimeSchema,
          changedBy: adultActorSchema,
          reason: { type: 'string', minLength: 1, maxLength: 1_000 },
          changedAt: isoDateTimeSchema,
        },
      },
    },
    reviewRequests: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'requestedAt',
          'requestedBy',
          'category',
          'status',
          'basisEvidenceIds',
        ],
        properties: {
          id: opaqueIdSchema,
          requestedAt: isoDateTimeSchema,
          requestedBy: {
            type: 'object',
            additionalProperties: false,
            required: ['role'],
            properties: {
              role: { enum: ['student', 'parent', 'teacher', 'tutor', 'system'] },
              actorId: opaqueIdSchema,
            },
          },
          category: {
            enum: [
              'reteaching',
              'prerequisite-review',
              'accommodation-review',
              'schedule-review',
              'student-support',
            ],
          },
          status: { enum: ['open', 'acknowledged', 'resolved'] },
          basisEvidenceIds: idArraySchema(),
        },
      },
    },
    approvedInterruptionCategories: {
      type: 'array',
      minItems: 1,
      uniqueItems: true,
      items: { enum: INTERRUPTION_CATEGORIES },
    },
    privateRecordRef: opaqueIdSchema,
  },
  runtimeRefinements: [
    'break minimum <= default <= maximum',
    'override fields match the selected target and remain inside control caps',
    'adult actor and chronology requirements are enforced',
    'audit identifiers are unique',
    'private note bodies are not accepted by this schema',
  ],
})

const CONTROL_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'maximumWorkDurationMinutes',
  'breakDuration',
  'timerVisibility',
  'manualOverrides',
  'recommendationDecisions',
  'accommodations',
  'rescheduling',
  'reviewRequests',
  'approvedInterruptionCategories',
  'privateRecordRef',
] as const

function validateActor(
  context: ValidationContext,
  value: unknown,
  path: string,
  roles: readonly string[],
): void {
  const actor = expectRecord(context, value, path, ['role', 'actorId'])
  if (!actor) return
  const roleValid = expectString(context, actor.role, propertyPath(path, 'role'), {
    allowed: roles,
  })
  if (actor.actorId !== undefined) expectId(context, actor.actorId, propertyPath(path, 'actorId'))
  if (roleValid && actor.role !== 'system' && actor.actorId === undefined) {
    context.add({
      code: 'required',
      path: propertyPath(path, 'actorId'),
      message: 'A non-system actor requires actorId.',
    })
  }
}

function uniqueId(
  context: ValidationContext,
  seen: Set<string>,
  value: unknown,
  path: string,
): void {
  if (!expectId(context, value, path)) return
  if (seen.has(value)) {
    context.add({ code: 'duplicate', path, message: `Duplicate audit id "${value}".` })
  }
  seen.add(value)
}

function validateParentTeacherControlsValue(
  value: unknown,
  context: ValidationContext,
): value is ParentTeacherControls {
  const record = expectRecord(context, value, '$', CONTROL_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'parent-teacher-controls')
  expectId(context, record.studentId, '$.studentId')
  const maximumValid = expectNumber(
    context,
    record.maximumWorkDurationMinutes,
    '$.maximumWorkDurationMinutes',
    { integer: true, minimum: 1, maximum: 240 },
  )
  validateMinuteRange(context, record.breakDuration, '$.breakDuration')
  const breakRecord =
    typeof record.breakDuration === 'object' && record.breakDuration !== null
      ? (record.breakDuration as Record<string, unknown>)
      : undefined
  expectString(context, record.timerVisibility, '$.timerVisibility', {
    allowed: TIMER_PREFERENCES,
  })

  const auditIds = new Set<string>()
  const overrides = expectArray(context, record.manualOverrides, '$.manualOverrides', {
    maximumLength: 2_000,
  })
  overrides?.forEach((entry, index) => {
    const path = indexPath('$.manualOverrides', index)
    const override = expectRecord(context, entry, path, [
      'id',
      'target',
      'setBy',
      'reason',
      'createdAt',
      'expiresAt',
      'maximumWorkDurationMinutes',
      'breakDurationMinutes',
      'timerPresentation',
      'referenceId',
    ])
    if (!override) return
    uniqueId(context, auditIds, override.id, propertyPath(path, 'id'))
    const targetValid = expectString(context, override.target, propertyPath(path, 'target'), {
      allowed: [
        'work-duration',
        'break-duration',
        'timer-visibility',
        'schedule',
        'accommodation',
      ],
    })
    validateActor(context, override.setBy, propertyPath(path, 'setBy'), ['parent', 'teacher'])
    expectString(context, override.reason, propertyPath(path, 'reason'), {
      minimumLength: 1,
      maximumLength: 1_000,
    })
    expectISODateTime(context, override.createdAt, propertyPath(path, 'createdAt'))
    if (override.expiresAt !== undefined) {
      expectISODateTime(context, override.expiresAt, propertyPath(path, 'expiresAt'))
      compareDateTimes(
        context,
        override.createdAt,
        override.expiresAt,
        propertyPath(path, 'expiresAt'),
        'Override expiresAt cannot be earlier than createdAt.',
      )
    }
    let overrideMaximum: number | undefined
    if (override.maximumWorkDurationMinutes !== undefined) {
      if (
        expectNumber(
          context,
          override.maximumWorkDurationMinutes,
          propertyPath(path, 'maximumWorkDurationMinutes'),
          { integer: true, minimum: 1, maximum: 240 },
        )
      ) {
        overrideMaximum = override.maximumWorkDurationMinutes as number
      }
    }
    let overrideBreak: number | undefined
    if (override.breakDurationMinutes !== undefined) {
      if (
        expectNumber(
          context,
          override.breakDurationMinutes,
          propertyPath(path, 'breakDurationMinutes'),
          { integer: true, minimum: 1, maximum: 120 },
        )
      ) {
        overrideBreak = override.breakDurationMinutes as number
      }
    }
    if (override.timerPresentation !== undefined) {
      expectString(
        context,
        override.timerPresentation,
        propertyPath(path, 'timerPresentation'),
        { allowed: TIMER_PREFERENCES },
      )
    }
    if (override.referenceId !== undefined) {
      expectId(context, override.referenceId, propertyPath(path, 'referenceId'))
    }
    if (targetValid) {
      const expectedProperty: Record<string, string> = {
        'work-duration': 'maximumWorkDurationMinutes',
        'break-duration': 'breakDurationMinutes',
        'timer-visibility': 'timerPresentation',
        schedule: 'referenceId',
        accommodation: 'referenceId',
      }
      const requiredProperty = expectedProperty[override.target as string]
      if (requiredProperty && override[requiredProperty] === undefined) {
        context.add({
          code: 'required',
          path: propertyPath(path, requiredProperty),
          message: `Override target "${String(override.target)}" requires ${requiredProperty}.`,
        })
      }
      const targetFields = [
        'maximumWorkDurationMinutes',
        'breakDurationMinutes',
        'timerPresentation',
        'referenceId',
      ]
      for (const field of targetFields) {
        if (field !== requiredProperty && override[field] !== undefined) {
          context.add({
            code: 'invariant',
            path: propertyPath(path, field),
            message: `Property ${field} does not match override target "${String(override.target)}".`,
          })
        }
      }
    }
    if (
      overrideMaximum !== undefined &&
      maximumValid &&
      overrideMaximum > (record.maximumWorkDurationMinutes as number)
    ) {
      context.add({
        code: 'invariant',
        path: propertyPath(path, 'maximumWorkDurationMinutes'),
        message: 'A work-duration override cannot exceed the control maximum.',
      })
    }
    if (
      overrideBreak !== undefined &&
      breakRecord &&
      typeof breakRecord.minimumMinutes === 'number' &&
      typeof breakRecord.maximumMinutes === 'number' &&
      (overrideBreak < breakRecord.minimumMinutes || overrideBreak > breakRecord.maximumMinutes)
    ) {
      context.add({
        code: 'invariant',
        path: propertyPath(path, 'breakDurationMinutes'),
        message: 'A break override must stay within the configured break range.',
      })
    }
  })

  const decisions = expectArray(
    context,
    record.recommendationDecisions,
    '$.recommendationDecisions',
    { maximumLength: 2_000 },
  )
  decisions?.forEach((entry, index) => {
    const path = indexPath('$.recommendationDecisions', index)
    const decision = expectRecord(context, entry, path, [
      'id',
      'recommendationId',
      'decision',
      'decidedBy',
      'decidedAt',
      'reason',
    ])
    if (!decision) return
    uniqueId(context, auditIds, decision.id, propertyPath(path, 'id'))
    expectId(context, decision.recommendationId, propertyPath(path, 'recommendationId'))
    expectString(context, decision.decision, propertyPath(path, 'decision'), {
      allowed: ['accepted', 'rejected'],
    })
    validateActor(context, decision.decidedBy, propertyPath(path, 'decidedBy'), [
      'parent',
      'teacher',
    ])
    expectISODateTime(context, decision.decidedAt, propertyPath(path, 'decidedAt'))
    if (decision.reason !== undefined) {
      expectString(context, decision.reason, propertyPath(path, 'reason'), {
        minimumLength: 1,
        maximumLength: 1_000,
      })
    }
  })

  const accommodations = expectArray(context, record.accommodations, '$.accommodations', {
    maximumLength: 100,
  })
  const accommodationIds = new Set<string>()
  accommodations?.forEach((entry, index) => {
    const path = indexPath('$.accommodations', index)
    const accommodation = expectRecord(context, entry, path, [
      'id',
      'enabled',
      'functionalDescription',
      'source',
      'reviewAt',
    ])
    if (!accommodation) return
    uniqueId(context, accommodationIds, accommodation.id, propertyPath(path, 'id'))
    expectBoolean(context, accommodation.enabled, propertyPath(path, 'enabled'))
    expectString(
      context,
      accommodation.functionalDescription,
      propertyPath(path, 'functionalDescription'),
      { minimumLength: 1, maximumLength: 1_000 },
    )
    expectString(context, accommodation.source, propertyPath(path, 'source'), {
      allowed: ['parent', 'teacher', 'school-plan'],
    })
    if (accommodation.reviewAt !== undefined) {
      expectISODateTime(context, accommodation.reviewAt, propertyPath(path, 'reviewAt'))
    }
  })

  const rescheduling = expectArray(context, record.rescheduling, '$.rescheduling', {
    maximumLength: 2_000,
  })
  rescheduling?.forEach((entry, index) => {
    const path = indexPath('$.rescheduling', index)
    const reschedule = expectRecord(context, entry, path, [
      'id',
      'studyPlanId',
      'originalStartAt',
      'replacementStartAt',
      'changedBy',
      'reason',
      'changedAt',
    ])
    if (!reschedule) return
    uniqueId(context, auditIds, reschedule.id, propertyPath(path, 'id'))
    expectId(context, reschedule.studyPlanId, propertyPath(path, 'studyPlanId'))
    expectISODateTime(context, reschedule.originalStartAt, propertyPath(path, 'originalStartAt'))
    expectISODateTime(
      context,
      reschedule.replacementStartAt,
      propertyPath(path, 'replacementStartAt'),
    )
    if (
      typeof reschedule.originalStartAt === 'string' &&
      reschedule.originalStartAt === reschedule.replacementStartAt
    ) {
      context.add({
        code: 'invariant',
        path: propertyPath(path, 'replacementStartAt'),
        message: 'Replacement start must differ from the original start.',
      })
    }
    validateActor(context, reschedule.changedBy, propertyPath(path, 'changedBy'), [
      'parent',
      'teacher',
    ])
    expectString(context, reschedule.reason, propertyPath(path, 'reason'), {
      minimumLength: 1,
      maximumLength: 1_000,
    })
    expectISODateTime(context, reschedule.changedAt, propertyPath(path, 'changedAt'))
  })

  const reviewRequests = expectArray(context, record.reviewRequests, '$.reviewRequests', {
    maximumLength: 2_000,
  })
  reviewRequests?.forEach((entry, index) => {
    const path = indexPath('$.reviewRequests', index)
    const request = expectRecord(context, entry, path, [
      'id',
      'requestedAt',
      'requestedBy',
      'category',
      'status',
      'basisEvidenceIds',
    ])
    if (!request) return
    uniqueId(context, auditIds, request.id, propertyPath(path, 'id'))
    expectISODateTime(context, request.requestedAt, propertyPath(path, 'requestedAt'))
    validateActor(
      context,
      request.requestedBy,
      propertyPath(path, 'requestedBy'),
      ['student', 'parent', 'teacher', 'tutor', 'system'],
    )
    expectString(context, request.category, propertyPath(path, 'category'), {
      allowed: [
        'reteaching',
        'prerequisite-review',
        'accommodation-review',
        'schedule-review',
        'student-support',
      ],
    })
    expectString(context, request.status, propertyPath(path, 'status'), {
      allowed: ['open', 'acknowledged', 'resolved'],
    })
    expectStringArray(context, request.basisEvidenceIds, propertyPath(path, 'basisEvidenceIds'), {
      ids: true,
      unique: true,
    })
  })

  expectStringArray(
    context,
    record.approvedInterruptionCategories,
    '$.approvedInterruptionCategories',
    {
      unique: true,
      minimumLength: 1,
      allowed: INTERRUPTION_CATEGORIES,
      maximumLength: INTERRUPTION_CATEGORIES.length,
    },
  )
  if (record.privateRecordRef !== undefined) {
    expectId(context, record.privateRecordRef, '$.privateRecordRef')
  }
  return context.issues.length === 0
}

export const parentTeacherControlsSchema = defineRuntimeSchema<ParentTeacherControls>({
  schemaId: 'parent-teacher-controls',
  kind: 'parent-teacher-controls',
  jsonSchema: parentTeacherControlsJsonSchema,
  validateValue: validateParentTeacherControlsValue,
})

export const validateParentTeacherControls = parentTeacherControlsSchema.validate
export const parseParentTeacherControls = parentTeacherControlsSchema.parse
export const isParentTeacherControls = parentTeacherControlsSchema.is

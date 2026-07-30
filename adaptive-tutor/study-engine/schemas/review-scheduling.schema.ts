import type { StudentSkillReview } from '../contracts/index.ts'
import {
  createRootJsonSchema,
  idArraySchema,
  isoDateSchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  opaqueIdSchema,
  type JsonSchema,
} from './json-schema.ts'
import {
  defineRuntimeSchema,
  expectArray,
  expectIanaTimeZone,
  expectId,
  expectISODate,
  expectISODateTime,
  expectNumber,
  expectRecord,
  expectString,
  expectStringArray,
  indexPath,
  propertyPath,
  validateHeader,
  type ValidationContext,
} from './validation.ts'

const CANONICAL_INTERVALS: Readonly<Record<string, number>> = {
  'same-day': 0,
  'one-day': 1,
  'three-day': 3,
  'seven-day': 7,
  'fourteen-day': 14,
  'thirty-day': 30,
}

const reviewIntervalSchema: JsonSchema = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'same-day' }, days: { const: 0 } } },
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'one-day' }, days: { const: 1 } } },
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'three-day' }, days: { const: 3 } } },
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'seven-day' }, days: { const: 7 } } },
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'fourteen-day' }, days: { const: 14 } } },
    { type: 'object', additionalProperties: false, required: ['id', 'days'], properties: { id: { const: 'thirty-day' }, days: { const: 30 } } },
    {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'days'],
      properties: {
        id: { const: 'custom' },
        days: { type: 'integer', minimum: 0, maximum: 3650 },
      },
    },
  ],
}

export const studentSkillReviewJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:student-skill-review:1',
  title: 'Student Skill Review',
  kind: 'student-skill-review',
  description:
    'A per-skill retrieval and review schedule. Canonical intervals are planning defaults, not universal claims.',
  required: [
    'studentId',
    'subjectId',
    'skillId',
    'timeZone',
    'retrievalAttempts',
    'currentInterval',
    'nextReviewDate',
    'intervalAdjustments',
  ],
  properties: {
    studentId: opaqueIdSchema,
    subjectId: opaqueIdSchema,
    skillId: opaqueIdSchema,
    timeZone: { type: 'string', minLength: 1, maxLength: 100 },
    retrievalAttempts: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'attemptedAt',
          'reviewDate',
          'correctCount',
          'attemptedCount',
          'hintCount',
          'independence',
          'evidenceId',
        ],
        properties: {
          id: opaqueIdSchema,
          attemptedAt: isoDateTimeSchema,
          reviewDate: isoDateSchema,
          correctCount: nonNegativeIntegerSchema,
          attemptedCount: { type: 'integer', minimum: 1 },
          hintCount: nonNegativeIntegerSchema,
          independence: {
            enum: ['independent', 'minimal-support', 'guided', 'full-support'],
          },
          evidenceId: opaqueIdSchema,
        },
      },
    },
    currentInterval: reviewIntervalSchema,
    nextReviewDate: isoDateSchema,
    intervalAdjustments: {
      type: 'array',
      maxItems: 2_000,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['adjustedAt', 'action', 'from', 'to', 'basisEvidenceIds'],
        properties: {
          adjustedAt: isoDateTimeSchema,
          action: {
            enum: ['interval-expansion', 'interval-contraction', 'interval-maintained'],
          },
          from: reviewIntervalSchema,
          to: reviewIntervalSchema,
          basisEvidenceIds: idArraySchema({ minimum: 1 }),
        },
      },
    },
    reteachingTrigger: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'reason', 'basisEvidenceIds'],
      properties: {
        status: { enum: ['not-triggered', 'triggered'] },
        reason: {
          enum: ['repeated-retrieval-difficulty', 'retention-decline', 'adult-request'],
        },
        basisEvidenceIds: idArraySchema(),
      },
    },
    prerequisiteRemediationTrigger: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'reason', 'prerequisiteSkillIds', 'basisEvidenceIds'],
      properties: {
        status: { enum: ['not-triggered', 'triggered'] },
        reason: { enum: ['confirmed-prerequisite-gap', 'adult-request'] },
        prerequisiteSkillIds: idArraySchema(),
        basisEvidenceIds: idArraySchema(),
      },
    },
  },
  runtimeRefinements: [
    'canonical interval IDs match their exact day counts',
    'retrieval attempts and interval adjustments are chronological',
    'nextReviewDate equals the latest local review date plus current interval',
    'expansion increases days and contraction decreases days',
    'triggered actions require supporting evidence',
  ],
})

const REVIEW_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'subjectId',
  'skillId',
  'timeZone',
  'retrievalAttempts',
  'currentInterval',
  'nextReviewDate',
  'intervalAdjustments',
  'reteachingTrigger',
  'prerequisiteRemediationTrigger',
] as const

function validateReviewInterval(
  context: ValidationContext,
  value: unknown,
  path: string,
): number | undefined {
  const interval = expectRecord(context, value, path, ['id', 'days'])
  if (!interval) return undefined
  const idValid = expectString(context, interval.id, propertyPath(path, 'id'), {
    allowed: [...Object.keys(CANONICAL_INTERVALS), 'custom'],
  })
  const daysValid = expectNumber(context, interval.days, propertyPath(path, 'days'), {
    integer: true,
    minimum: 0,
    maximum: 3650,
  })
  if (!idValid || !daysValid) return undefined
  const id = interval.id as string
  const days = interval.days as number
  if (id !== 'custom' && CANONICAL_INTERVALS[id] !== days) {
    context.add({
      code: 'invariant',
      path,
      message: `Canonical interval "${id}" requires ${CANONICAL_INTERVALS[id]} day(s).`,
    })
  }
  if (id === 'custom' && Object.values(CANONICAL_INTERVALS).includes(days)) {
    context.add({
      code: 'invariant',
      path,
      message: 'Use the canonical interval ID for a canonical day count.',
    })
  }
  return days
}

function dateInTimeZone(dateTime: string, timeZone: string): string | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(dateTime))
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
    return `${values.year}-${values.month}-${values.day}`
  } catch {
    return undefined
  }
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function validateStudentSkillReviewValue(
  value: unknown,
  context: ValidationContext,
): value is StudentSkillReview {
  const record = expectRecord(context, value, '$', REVIEW_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'student-skill-review')
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.subjectId, '$.subjectId')
  expectId(context, record.skillId, '$.skillId')
  const timeZoneValid = expectIanaTimeZone(context, record.timeZone, '$.timeZone')

  const attempts = expectArray(context, record.retrievalAttempts, '$.retrievalAttempts', {
    maximumLength: 2_000,
  })
  const attemptIds = new Set<string>()
  let previousAttempt = Number.NEGATIVE_INFINITY
  let latestReviewDate: string | undefined
  attempts?.forEach((entry, index) => {
    const path = indexPath('$.retrievalAttempts', index)
    const attempt = expectRecord(context, entry, path, [
      'id',
      'attemptedAt',
      'reviewDate',
      'correctCount',
      'attemptedCount',
      'hintCount',
      'independence',
      'evidenceId',
    ])
    if (!attempt) return
    if (expectId(context, attempt.id, propertyPath(path, 'id'))) {
      const id = attempt.id as string
      if (attemptIds.has(id)) {
        context.add({
          code: 'duplicate',
          path: propertyPath(path, 'id'),
          message: `Duplicate retrieval attempt id "${id}".`,
        })
      }
      attemptIds.add(id)
    }
    const attemptedAtValid = expectISODateTime(
      context,
      attempt.attemptedAt,
      propertyPath(path, 'attemptedAt'),
    )
    const reviewDateValid = expectISODate(
      context,
      attempt.reviewDate,
      propertyPath(path, 'reviewDate'),
    )
    if (attemptedAtValid) {
      const time = Date.parse(attempt.attemptedAt as string)
      if (time < previousAttempt) {
        context.add({
          code: 'chronology',
          path: propertyPath(path, 'attemptedAt'),
          message: 'Retrieval attempts must be chronological.',
        })
      }
      previousAttempt = time
    }
    if (
      attemptedAtValid &&
      reviewDateValid &&
      timeZoneValid &&
      typeof record.timeZone === 'string'
    ) {
      const localDate = dateInTimeZone(attempt.attemptedAt as string, record.timeZone)
      if (localDate !== attempt.reviewDate) {
        context.add({
          code: 'invariant',
          path: propertyPath(path, 'reviewDate'),
          message: 'reviewDate must be the attempt date in the configured time zone.',
        })
      }
      latestReviewDate = attempt.reviewDate as string
    }
    const correctValid = expectNumber(
      context,
      attempt.correctCount,
      propertyPath(path, 'correctCount'),
      { integer: true, minimum: 0 },
    )
    const attemptedValid = expectNumber(
      context,
      attempt.attemptedCount,
      propertyPath(path, 'attemptedCount'),
      { integer: true, minimum: 1 },
    )
    if (
      correctValid &&
      attemptedValid &&
      (attempt.correctCount as number) > (attempt.attemptedCount as number)
    ) {
      context.add({
        code: 'invariant',
        path: propertyPath(path, 'correctCount'),
        message: 'correctCount cannot exceed attemptedCount.',
      })
    }
    expectNumber(context, attempt.hintCount, propertyPath(path, 'hintCount'), {
      integer: true,
      minimum: 0,
    })
    expectString(context, attempt.independence, propertyPath(path, 'independence'), {
      allowed: ['independent', 'minimal-support', 'guided', 'full-support'],
    })
    expectId(context, attempt.evidenceId, propertyPath(path, 'evidenceId'))
  })

  const currentDays = validateReviewInterval(context, record.currentInterval, '$.currentInterval')
  const nextDateValid = expectISODate(context, record.nextReviewDate, '$.nextReviewDate')
  if (
    latestReviewDate !== undefined &&
    currentDays !== undefined &&
    nextDateValid &&
    record.nextReviewDate !== addCalendarDays(latestReviewDate, currentDays)
  ) {
    context.add({
      code: 'invariant',
      path: '$.nextReviewDate',
      message: 'nextReviewDate must equal the latest review date plus currentInterval days.',
    })
  }

  const adjustments = expectArray(
    context,
    record.intervalAdjustments,
    '$.intervalAdjustments',
    { maximumLength: 2_000 },
  )
  let previousAdjustment = Number.NEGATIVE_INFINITY
  adjustments?.forEach((entry, index) => {
    const path = indexPath('$.intervalAdjustments', index)
    const adjustment = expectRecord(context, entry, path, [
      'adjustedAt',
      'action',
      'from',
      'to',
      'basisEvidenceIds',
    ])
    if (!adjustment) return
    if (expectISODateTime(context, adjustment.adjustedAt, propertyPath(path, 'adjustedAt'))) {
      const time = Date.parse(adjustment.adjustedAt as string)
      if (time < previousAdjustment) {
        context.add({
          code: 'chronology',
          path: propertyPath(path, 'adjustedAt'),
          message: 'Interval adjustments must be chronological.',
        })
      }
      previousAdjustment = time
    }
    const actionValid = expectString(context, adjustment.action, propertyPath(path, 'action'), {
      allowed: ['interval-expansion', 'interval-contraction', 'interval-maintained'],
    })
    const fromDays = validateReviewInterval(context, adjustment.from, propertyPath(path, 'from'))
    const toDays = validateReviewInterval(context, adjustment.to, propertyPath(path, 'to'))
    expectStringArray(
      context,
      adjustment.basisEvidenceIds,
      propertyPath(path, 'basisEvidenceIds'),
      { ids: true, unique: true, minimumLength: 1 },
    )
    if (actionValid && fromDays !== undefined && toDays !== undefined) {
      if (adjustment.action === 'interval-expansion' && toDays <= fromDays) {
        context.add({
          code: 'invariant',
          path: propertyPath(path, 'to'),
          message: 'Interval expansion must increase the day count.',
        })
      }
      if (adjustment.action === 'interval-contraction' && toDays >= fromDays) {
        context.add({
          code: 'invariant',
          path: propertyPath(path, 'to'),
          message: 'Interval contraction must decrease the day count.',
        })
      }
      if (adjustment.action === 'interval-maintained' && toDays !== fromDays) {
        context.add({
          code: 'invariant',
          path: propertyPath(path, 'to'),
          message: 'A maintained interval must keep the same day count.',
        })
      }
    }
  })

  if (record.reteachingTrigger !== undefined) {
    const trigger = expectRecord(context, record.reteachingTrigger, '$.reteachingTrigger', [
      'status',
      'reason',
      'basisEvidenceIds',
    ])
    if (trigger) {
      const statusValid = expectString(context, trigger.status, '$.reteachingTrigger.status', {
        allowed: ['not-triggered', 'triggered'],
      })
      expectString(context, trigger.reason, '$.reteachingTrigger.reason', {
        allowed: ['repeated-retrieval-difficulty', 'retention-decline', 'adult-request'],
      })
      const basis = expectStringArray(
        context,
        trigger.basisEvidenceIds,
        '$.reteachingTrigger.basisEvidenceIds',
        { ids: true, unique: true },
      )
      if (statusValid && trigger.status === 'triggered' && (basis?.length ?? 0) === 0) {
        context.add({
          code: 'invariant',
          path: '$.reteachingTrigger.basisEvidenceIds',
          message: 'A triggered reteaching action requires evidence.',
        })
      }
      if (statusValid && trigger.status === 'not-triggered' && (basis?.length ?? 0) > 0) {
        context.add({
          code: 'invariant',
          path: '$.reteachingTrigger.basisEvidenceIds',
          message: 'A non-triggered action cannot carry trigger evidence.',
        })
      }
    }
  }

  if (record.prerequisiteRemediationTrigger !== undefined) {
    const trigger = expectRecord(
      context,
      record.prerequisiteRemediationTrigger,
      '$.prerequisiteRemediationTrigger',
      ['status', 'reason', 'prerequisiteSkillIds', 'basisEvidenceIds'],
    )
    if (trigger) {
      const statusValid = expectString(
        context,
        trigger.status,
        '$.prerequisiteRemediationTrigger.status',
        { allowed: ['not-triggered', 'triggered'] },
      )
      expectString(context, trigger.reason, '$.prerequisiteRemediationTrigger.reason', {
        allowed: ['confirmed-prerequisite-gap', 'adult-request'],
      })
      const skills = expectStringArray(
        context,
        trigger.prerequisiteSkillIds,
        '$.prerequisiteRemediationTrigger.prerequisiteSkillIds',
        { ids: true, unique: true },
      )
      const basis = expectStringArray(
        context,
        trigger.basisEvidenceIds,
        '$.prerequisiteRemediationTrigger.basisEvidenceIds',
        { ids: true, unique: true },
      )
      if (
        statusValid &&
        trigger.status === 'triggered' &&
        ((skills?.length ?? 0) === 0 || (basis?.length ?? 0) === 0)
      ) {
        context.add({
          code: 'invariant',
          path: '$.prerequisiteRemediationTrigger',
          message: 'Triggered prerequisite remediation requires a skill and supporting evidence.',
        })
      }
      if (
        statusValid &&
        trigger.status === 'not-triggered' &&
        ((skills?.length ?? 0) > 0 || (basis?.length ?? 0) > 0)
      ) {
        context.add({
          code: 'invariant',
          path: '$.prerequisiteRemediationTrigger',
          message: 'A non-triggered action cannot carry trigger references.',
        })
      }
    }
  }

  return context.issues.length === 0
}

export const studentSkillReviewSchema = defineRuntimeSchema<StudentSkillReview>({
  schemaId: 'student-skill-review',
  kind: 'student-skill-review',
  jsonSchema: studentSkillReviewJsonSchema,
  validateValue: validateStudentSkillReviewValue,
})

export const validateStudentSkillReview = studentSkillReviewSchema.validate
export const parseStudentSkillReview = studentSkillReviewSchema.parse
export const isStudentSkillReview = studentSkillReviewSchema.is

import type {
  AbandonedStudySession,
  ActiveStudySession,
  ApprovedBreakStudySession,
  CompletedStudySession,
  PausedStudySession,
  PlannedStudySession,
  StudentRequestedBreakStudySession,
  StudySession,
  TechnicalInterruptionStudySession,
} from '../contracts/index.ts'
import {
  actorSchema,
  createRootJsonSchema,
  idArraySchema,
  isoDateTimeSchema,
  nonNegativeIntegerSchema,
  opaqueIdSchema,
  positiveIntegerSchema,
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
  rejectUnknownKeys,
  validateHeader,
  type ValidationContext,
} from './validation.ts'

const SESSION_STATUSES = [
  'planned',
  'active',
  'paused',
  'approved-break',
  'student-requested-break',
  'technical-interruption',
  'completed',
  'abandoned',
] as const

const SESSION_EVENT_TYPES = [
  'session-planned',
  'session-started',
  'segment-started',
  'active-response-recorded',
  'segment-completed',
  'pause-started',
  'break-requested',
  'break-approved',
  'break-started',
  'break-ended',
  'technical-interruption-started',
  'technical-interruption-ended',
  'session-resumed',
  'redirection-recorded',
  'tutor-intervention-recorded',
  'session-completed',
  'session-abandoned',
] as const

const resumePointSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['segmentId', 'elapsedActiveSecondsInSegment'],
  properties: {
    segmentId: opaqueIdSchema,
    elapsedActiveSecondsInSegment: nonNegativeIntegerSchema,
    responseDraftRef: opaqueIdSchema,
  },
}

const sessionEventSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'sessionId', 'sequence', 'occurredAt', 'type', 'actor'],
  properties: {
    id: opaqueIdSchema,
    sessionId: opaqueIdSchema,
    sequence: positiveIntegerSchema,
    occurredAt: isoDateTimeSchema,
    type: { enum: SESSION_EVENT_TYPES },
    actor: { enum: ['student', 'parent', 'teacher', 'tutor', 'system'] },
    segmentId: opaqueIdSchema,
    detailCode: { type: 'string', minLength: 1, maxLength: 200 },
    evidenceRef: opaqueIdSchema,
  },
}

const resultSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'sessionId',
    'outcome',
    'completedSegmentIds',
    'remainingSegmentIds',
    'activeDurationSeconds',
    'breakDurationSeconds',
    'pausedDurationSeconds',
    'evidenceIds',
    'recommendedNextAction',
    'recordedAt',
  ],
  properties: {
    id: opaqueIdSchema,
    sessionId: opaqueIdSchema,
    outcome: { enum: ['completed', 'partially-completed', 'abandoned'] },
    completedSegmentIds: idArraySchema(),
    remainingSegmentIds: idArraySchema(),
    activeDurationSeconds: nonNegativeIntegerSchema,
    breakDurationSeconds: nonNegativeIntegerSchema,
    pausedDurationSeconds: nonNegativeIntegerSchema,
    evidenceIds: idArraySchema(),
    recommendedNextAction: {
      enum: [
        'continue-plan',
        'review',
        'reteach',
        'prerequisite-remediation',
        'adult-review',
        'none',
      ],
    },
    recordedAt: isoDateTimeSchema,
  },
}

const approvedBreakSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'interruptionId',
    'requestedAt',
    'approvedAt',
    'approvedBy',
    'reasonCategory',
    'plannedDurationMinutes',
  ],
  properties: {
    interruptionId: opaqueIdSchema,
    requestedAt: isoDateTimeSchema,
    approvedAt: isoDateTimeSchema,
    approvedBy: {
      ...actorSchema,
      properties: {
        role: { enum: ['parent', 'teacher', 'tutor', 'system'] },
        actorId: opaqueIdSchema,
      },
    },
    reasonCategory: {
      enum: [
        'student-request',
        'accessibility-need',
        'scheduled-break',
        'wellbeing',
        'adult-directed',
      ],
    },
    plannedDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
  },
}

const studentRequestedBreakSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['interruptionId', 'requestedAt', 'requestState'],
  properties: {
    interruptionId: opaqueIdSchema,
    requestedAt: isoDateTimeSchema,
    requestState: { enum: ['pending', 'approved'] },
    approvedAt: isoDateTimeSchema,
    plannedDurationMinutes: { type: 'integer', minimum: 1, maximum: 120 },
  },
}

const technicalInterruptionSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['interruptionId', 'startedAt', 'category', 'recoverable'],
  properties: {
    interruptionId: opaqueIdSchema,
    startedAt: isoDateTimeSchema,
    category: {
      enum: [
        'network-unavailable',
        'device-power',
        'application-restart',
        'audio-unavailable',
        'input-unavailable',
        'unknown-technical',
      ],
    },
    recoverable: { type: 'boolean' },
    detailCode: { type: 'string', minLength: 1, maxLength: 200 },
  },
}

const baseSessionJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:study-session:1',
  title: 'Study Session',
  kind: 'study-session',
  description:
    'A discriminated study-session state with append-only events, neutral interruption states, resume points, and terminal results.',
  required: ['status', 'studentId', 'studyPlanId', 'plannedSegmentIds', 'eventLog'],
  properties: {
    status: { enum: SESSION_STATUSES },
    studentId: opaqueIdSchema,
    studyPlanId: opaqueIdSchema,
    plannedSegmentIds: idArraySchema({ minimum: 1 }),
    eventLog: { type: 'array', minItems: 1, maxItems: 2_000, items: sessionEventSchema },
    scheduledStartAt: isoDateTimeSchema,
    startedAt: isoDateTimeSchema,
    currentSegmentId: opaqueIdSchema,
    elapsedActiveSeconds: nonNegativeIntegerSchema,
    pausedAt: isoDateTimeSchema,
    pauseCategory: {
      enum: ['student-request', 'adult-directed', 'scheduled', 'accessibility-need'],
    },
    resumePoint: resumePointSchema,
    break: approvedBreakSchema,
    breakRequest: studentRequestedBreakSchema,
    interruption: technicalInterruptionSchema,
    completedAt: isoDateTimeSchema,
    abandonedAt: isoDateTimeSchema,
    reasonCategory: {
      enum: [
        'student-choice',
        'adult-directed',
        'schedule-change',
        'wellbeing',
        'technical-unrecoverable',
        'other',
      ],
    },
    result: resultSchema,
  },
  runtimeRefinements: [
    'only fields for the selected status are allowed',
    'event IDs and sequence numbers are unique and chronological',
    'event session IDs equal the enclosing session ID',
    'all segment references belong to plannedSegmentIds',
    'pause, break, and interruption states require a resume point',
    'terminal states require a matching result and cannot resume',
  ],
})

export const studySessionJsonSchema = {
  ...baseSessionJsonSchema,
  oneOf: [
    { properties: { status: { const: 'planned' } }, required: ['scheduledStartAt'] },
    {
      properties: { status: { const: 'active' } },
      required: ['startedAt', 'currentSegmentId', 'elapsedActiveSeconds'],
    },
    {
      properties: { status: { const: 'paused' } },
      required: ['startedAt', 'pausedAt', 'pauseCategory', 'resumePoint'],
    },
    {
      properties: { status: { const: 'approved-break' } },
      required: ['startedAt', 'break', 'resumePoint'],
    },
    {
      properties: { status: { const: 'student-requested-break' } },
      required: ['startedAt', 'breakRequest', 'resumePoint'],
    },
    {
      properties: { status: { const: 'technical-interruption' } },
      required: ['startedAt', 'interruption', 'resumePoint'],
    },
    {
      properties: { status: { const: 'completed' } },
      required: ['startedAt', 'completedAt', 'result'],
    },
    {
      properties: { status: { const: 'abandoned' } },
      required: ['startedAt', 'abandonedAt', 'reasonCategory', 'result'],
    },
  ],
} as const

const COMMON_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'status',
  'studentId',
  'studyPlanId',
  'plannedSegmentIds',
  'eventLog',
] as const

const ALL_SESSION_KEYS = [
  ...COMMON_KEYS,
  'scheduledStartAt',
  'startedAt',
  'currentSegmentId',
  'elapsedActiveSeconds',
  'pausedAt',
  'pauseCategory',
  'resumePoint',
  'break',
  'breakRequest',
  'interruption',
  'completedAt',
  'abandonedAt',
  'reasonCategory',
  'result',
] as const

const STATUS_KEYS: Record<(typeof SESSION_STATUSES)[number], readonly string[]> = {
  planned: [...COMMON_KEYS, 'scheduledStartAt'],
  active: [...COMMON_KEYS, 'startedAt', 'currentSegmentId', 'elapsedActiveSeconds'],
  paused: [...COMMON_KEYS, 'startedAt', 'pausedAt', 'pauseCategory', 'resumePoint'],
  'approved-break': [...COMMON_KEYS, 'startedAt', 'break', 'resumePoint'],
  'student-requested-break': [
    ...COMMON_KEYS,
    'startedAt',
    'breakRequest',
    'resumePoint',
  ],
  'technical-interruption': [
    ...COMMON_KEYS,
    'startedAt',
    'interruption',
    'resumePoint',
  ],
  completed: [...COMMON_KEYS, 'startedAt', 'completedAt', 'result'],
  abandoned: [
    ...COMMON_KEYS,
    'startedAt',
    'abandonedAt',
    'reasonCategory',
    'result',
  ],
}

function validateActorReference(
  context: ValidationContext,
  value: unknown,
  path: string,
  allowedRoles: readonly string[],
): void {
  const actor = expectRecord(context, value, path, ['role', 'actorId'])
  if (!actor) return
  const roleValid = expectString(context, actor.role, propertyPath(path, 'role'), {
    allowed: allowedRoles,
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

function validateResumePoint(
  context: ValidationContext,
  value: unknown,
  path: string,
  plannedSegmentIds: ReadonlySet<string>,
): void {
  const point = expectRecord(context, value, path, [
    'segmentId',
    'elapsedActiveSecondsInSegment',
    'responseDraftRef',
  ])
  if (!point) return
  if (
    expectId(context, point.segmentId, propertyPath(path, 'segmentId')) &&
    !plannedSegmentIds.has(point.segmentId as string)
  ) {
    context.add({
      code: 'reference',
      path: propertyPath(path, 'segmentId'),
      message: `Resume segment "${String(point.segmentId)}" is not planned.`,
    })
  }
  expectNumber(
    context,
    point.elapsedActiveSecondsInSegment,
    propertyPath(path, 'elapsedActiveSecondsInSegment'),
    { integer: true, minimum: 0 },
  )
  if (point.responseDraftRef !== undefined) {
    expectId(context, point.responseDraftRef, propertyPath(path, 'responseDraftRef'))
  }
}

function validateSessionResult(
  context: ValidationContext,
  value: unknown,
  path: string,
  sessionId: unknown,
  plannedSegmentIds: readonly string[],
  expectedOutcomes: readonly string[],
): void {
  const result = expectRecord(context, value, path, [
    'id',
    'sessionId',
    'outcome',
    'completedSegmentIds',
    'remainingSegmentIds',
    'activeDurationSeconds',
    'breakDurationSeconds',
    'pausedDurationSeconds',
    'evidenceIds',
    'recommendedNextAction',
    'recordedAt',
  ])
  if (!result) return
  expectId(context, result.id, propertyPath(path, 'id'))
  if (
    expectId(context, result.sessionId, propertyPath(path, 'sessionId')) &&
    typeof sessionId === 'string' &&
    result.sessionId !== sessionId
  ) {
    context.add({
      code: 'reference',
      path: propertyPath(path, 'sessionId'),
      message: 'Result sessionId must equal the enclosing session id.',
    })
  }
  expectString(context, result.outcome, propertyPath(path, 'outcome'), {
    allowed: expectedOutcomes,
  })
  const completed = expectStringArray(
    context,
    result.completedSegmentIds,
    propertyPath(path, 'completedSegmentIds'),
    { ids: true, unique: true },
  )
  const remaining = expectStringArray(
    context,
    result.remainingSegmentIds,
    propertyPath(path, 'remainingSegmentIds'),
    { ids: true, unique: true },
  )
  const plannedSet = new Set(plannedSegmentIds)
  const resultIds = [...(completed ?? []), ...(remaining ?? [])]
  resultIds.forEach((id) => {
    if (!plannedSet.has(id)) {
      context.add({
        code: 'reference',
        path,
        message: `Result references unplanned segment "${id}".`,
      })
    }
  })
  const completedSet = new Set(completed ?? [])
  remaining?.forEach((id, index) => {
    if (completedSet.has(id)) {
      context.add({
        code: 'duplicate',
        path: indexPath(propertyPath(path, 'remainingSegmentIds'), index),
        message: `Segment "${id}" cannot be both completed and remaining.`,
      })
    }
  })
  if (new Set(resultIds).size !== plannedSet.size || resultIds.length !== plannedSet.size) {
    context.add({
      code: 'invariant',
      path,
      message: 'Completed and remaining segments must partition plannedSegmentIds.',
    })
  }
  for (const key of [
    'activeDurationSeconds',
    'breakDurationSeconds',
    'pausedDurationSeconds',
  ] as const) {
    expectNumber(context, result[key], propertyPath(path, key), {
      integer: true,
      minimum: 0,
    })
  }
  expectStringArray(context, result.evidenceIds, propertyPath(path, 'evidenceIds'), {
    ids: true,
    unique: true,
  })
  expectString(
    context,
    result.recommendedNextAction,
    propertyPath(path, 'recommendedNextAction'),
    {
      allowed: [
        'continue-plan',
        'review',
        'reteach',
        'prerequisite-remediation',
        'adult-review',
        'none',
      ],
    },
  )
  expectISODateTime(context, result.recordedAt, propertyPath(path, 'recordedAt'))
}

function validateEvents(
  context: ValidationContext,
  value: unknown,
  sessionId: unknown,
  plannedSegmentIds: ReadonlySet<string>,
): readonly Record<string, unknown>[] {
  const events = expectArray(context, value, '$.eventLog', {
    minimumLength: 1,
    maximumLength: 2_000,
  })
  if (!events) return []
  const records: Record<string, unknown>[] = []
  const eventIds = new Set<string>()
  let previousTime = Number.NEGATIVE_INFINITY
  events.forEach((entry, index) => {
    const path = indexPath('$.eventLog', index)
    const event = expectRecord(context, entry, path, [
      'id',
      'sessionId',
      'sequence',
      'occurredAt',
      'type',
      'actor',
      'segmentId',
      'detailCode',
      'evidenceRef',
    ])
    if (!event) return
    records.push(event)
    if (expectId(context, event.id, propertyPath(path, 'id'))) {
      const id = event.id as string
      if (eventIds.has(id)) {
        context.add({
          code: 'duplicate',
          path: propertyPath(path, 'id'),
          message: `Duplicate event id "${id}".`,
        })
      }
      eventIds.add(id)
    }
    if (
      expectId(context, event.sessionId, propertyPath(path, 'sessionId')) &&
      typeof sessionId === 'string' &&
      event.sessionId !== sessionId
    ) {
      context.add({
        code: 'reference',
        path: propertyPath(path, 'sessionId'),
        message: 'Event sessionId must equal the enclosing session id.',
      })
    }
    if (
      expectNumber(context, event.sequence, propertyPath(path, 'sequence'), {
        integer: true,
        minimum: 1,
      }) &&
      event.sequence !== index + 1
    ) {
      context.add({
        code: 'sequence',
        path: propertyPath(path, 'sequence'),
        message: `Expected contiguous event sequence ${index + 1}.`,
      })
    }
    if (expectISODateTime(context, event.occurredAt, propertyPath(path, 'occurredAt'))) {
      const time = Date.parse(event.occurredAt as string)
      if (time < previousTime) {
        context.add({
          code: 'chronology',
          path: propertyPath(path, 'occurredAt'),
          message: 'Event timestamps must be nondecreasing.',
        })
      }
      previousTime = time
    }
    expectString(context, event.type, propertyPath(path, 'type'), {
      allowed: SESSION_EVENT_TYPES,
    })
    expectString(context, event.actor, propertyPath(path, 'actor'), {
      allowed: ['student', 'parent', 'teacher', 'tutor', 'system'],
    })
    if (
      event.segmentId !== undefined &&
      expectId(context, event.segmentId, propertyPath(path, 'segmentId')) &&
      !plannedSegmentIds.has(event.segmentId as string)
    ) {
      context.add({
        code: 'reference',
        path: propertyPath(path, 'segmentId'),
        message: `Event segment "${String(event.segmentId)}" is not planned.`,
      })
    }
    if (event.detailCode !== undefined) {
      expectString(context, event.detailCode, propertyPath(path, 'detailCode'), {
        minimumLength: 1,
        maximumLength: 200,
      })
    }
    if (event.evidenceRef !== undefined) {
      expectId(context, event.evidenceRef, propertyPath(path, 'evidenceRef'))
    }
  })
  return records
}

function validateStudySessionValue(value: unknown, context: ValidationContext): value is StudySession {
  const record = expectRecord(context, value, '$', ALL_SESSION_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'study-session')
  const statusValid = expectString(context, record.status, '$.status', {
    allowed: SESSION_STATUSES,
  })
  if (statusValid && SESSION_STATUSES.includes(record.status as (typeof SESSION_STATUSES)[number])) {
    rejectUnknownKeys(
      context,
      record,
      '$',
      STATUS_KEYS[record.status as (typeof SESSION_STATUSES)[number]],
    )
  }
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.studyPlanId, '$.studyPlanId')
  const plannedIds =
    expectStringArray(context, record.plannedSegmentIds, '$.plannedSegmentIds', {
      ids: true,
      unique: true,
      minimumLength: 1,
    }) ?? []
  const plannedSet = new Set(plannedIds)
  const events = validateEvents(context, record.eventLog, record.id, plannedSet)
  const lastEventType = events.at(-1)?.type

  if (!statusValid) return context.issues.length === 0
  switch (record.status) {
    case 'planned': {
      expectISODateTime(context, record.scheduledStartAt, '$.scheduledStartAt')
      if (lastEventType !== 'session-planned') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'A planned session must end with session-planned.',
        })
      }
      break
    }
    case 'active': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      if (
        expectId(context, record.currentSegmentId, '$.currentSegmentId') &&
        !plannedSet.has(record.currentSegmentId as string)
      ) {
        context.add({
          code: 'reference',
          path: '$.currentSegmentId',
          message: 'currentSegmentId must be planned.',
        })
      }
      expectNumber(context, record.elapsedActiveSeconds, '$.elapsedActiveSeconds', {
        integer: true,
        minimum: 0,
      })
      if (lastEventType === 'session-completed' || lastEventType === 'session-abandoned') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'An active session cannot have a terminal final event.',
        })
      }
      break
    }
    case 'paused': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      expectISODateTime(context, record.pausedAt, '$.pausedAt')
      compareDateTimes(
        context,
        record.startedAt,
        record.pausedAt,
        '$.pausedAt',
        'pausedAt cannot be earlier than startedAt.',
      )
      expectString(context, record.pauseCategory, '$.pauseCategory', {
        allowed: ['student-request', 'adult-directed', 'scheduled', 'accessibility-need'],
      })
      validateResumePoint(context, record.resumePoint, '$.resumePoint', plannedSet)
      if (lastEventType !== 'pause-started') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'A paused session must end with pause-started.',
        })
      }
      break
    }
    case 'approved-break': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      validateResumePoint(context, record.resumePoint, '$.resumePoint', plannedSet)
      const approvedBreak = expectRecord(context, record.break, '$.break', [
        'interruptionId',
        'requestedAt',
        'approvedAt',
        'approvedBy',
        'reasonCategory',
        'plannedDurationMinutes',
      ])
      if (approvedBreak) {
        expectId(context, approvedBreak.interruptionId, '$.break.interruptionId')
        expectISODateTime(context, approvedBreak.requestedAt, '$.break.requestedAt')
        expectISODateTime(context, approvedBreak.approvedAt, '$.break.approvedAt')
        compareDateTimes(
          context,
          approvedBreak.requestedAt,
          approvedBreak.approvedAt,
          '$.break.approvedAt',
          'approvedAt cannot be earlier than requestedAt.',
        )
        validateActorReference(
          context,
          approvedBreak.approvedBy,
          '$.break.approvedBy',
          ['parent', 'teacher', 'tutor', 'system'],
        )
        expectString(context, approvedBreak.reasonCategory, '$.break.reasonCategory', {
          allowed: [
            'student-request',
            'accessibility-need',
            'scheduled-break',
            'wellbeing',
            'adult-directed',
          ],
        })
        expectNumber(
          context,
          approvedBreak.plannedDurationMinutes,
          '$.break.plannedDurationMinutes',
          { integer: true, minimum: 1, maximum: 120 },
        )
      }
      if (lastEventType !== 'break-started') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'An approved break session must end with break-started.',
        })
      }
      break
    }
    case 'student-requested-break': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      validateResumePoint(context, record.resumePoint, '$.resumePoint', plannedSet)
      const request = expectRecord(context, record.breakRequest, '$.breakRequest', [
        'interruptionId',
        'requestedAt',
        'requestState',
        'approvedAt',
        'plannedDurationMinutes',
      ])
      if (request) {
        expectId(context, request.interruptionId, '$.breakRequest.interruptionId')
        expectISODateTime(context, request.requestedAt, '$.breakRequest.requestedAt')
        const requestStateValid = expectString(
          context,
          request.requestState,
          '$.breakRequest.requestState',
          { allowed: ['pending', 'approved'] },
        )
        if (request.approvedAt !== undefined) {
          expectISODateTime(context, request.approvedAt, '$.breakRequest.approvedAt')
          compareDateTimes(
            context,
            request.requestedAt,
            request.approvedAt,
            '$.breakRequest.approvedAt',
            'approvedAt cannot be earlier than requestedAt.',
          )
        }
        if (request.plannedDurationMinutes !== undefined) {
          expectNumber(
            context,
            request.plannedDurationMinutes,
            '$.breakRequest.plannedDurationMinutes',
            { integer: true, minimum: 1, maximum: 120 },
          )
        }
        if (
          requestStateValid &&
          request.requestState === 'approved' &&
          (request.approvedAt === undefined || request.plannedDurationMinutes === undefined)
        ) {
          context.add({
            code: 'invariant',
            path: '$.breakRequest',
            message: 'An approved request requires approvedAt and plannedDurationMinutes.',
          })
        }
        if (
          requestStateValid &&
          request.requestState === 'pending' &&
          (request.approvedAt !== undefined || request.plannedDurationMinutes !== undefined)
        ) {
          context.add({
            code: 'invariant',
            path: '$.breakRequest',
            message: 'A pending request cannot contain approval fields.',
          })
        }
      }
      if (lastEventType !== 'break-requested') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'A student-requested break session must end with break-requested.',
        })
      }
      break
    }
    case 'technical-interruption': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      validateResumePoint(context, record.resumePoint, '$.resumePoint', plannedSet)
      const interruption = expectRecord(context, record.interruption, '$.interruption', [
        'interruptionId',
        'startedAt',
        'category',
        'recoverable',
        'detailCode',
      ])
      if (interruption) {
        expectId(context, interruption.interruptionId, '$.interruption.interruptionId')
        expectISODateTime(context, interruption.startedAt, '$.interruption.startedAt')
        expectString(context, interruption.category, '$.interruption.category', {
          allowed: [
            'network-unavailable',
            'device-power',
            'application-restart',
            'audio-unavailable',
            'input-unavailable',
            'unknown-technical',
          ],
        })
        expectBoolean(context, interruption.recoverable, '$.interruption.recoverable')
        if (interruption.detailCode !== undefined) {
          expectString(context, interruption.detailCode, '$.interruption.detailCode', {
            minimumLength: 1,
            maximumLength: 200,
          })
        }
      }
      if (lastEventType !== 'technical-interruption-started') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'A technical interruption session must end with technical-interruption-started.',
        })
      }
      break
    }
    case 'completed': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      expectISODateTime(context, record.completedAt, '$.completedAt')
      compareDateTimes(
        context,
        record.startedAt,
        record.completedAt,
        '$.completedAt',
        'completedAt cannot be earlier than startedAt.',
      )
      validateSessionResult(
        context,
        record.result,
        '$.result',
        record.id,
        plannedIds,
        ['completed', 'partially-completed'],
      )
      if (lastEventType !== 'session-completed') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'A completed session must end with session-completed.',
        })
      }
      break
    }
    case 'abandoned': {
      expectISODateTime(context, record.startedAt, '$.startedAt')
      expectISODateTime(context, record.abandonedAt, '$.abandonedAt')
      compareDateTimes(
        context,
        record.startedAt,
        record.abandonedAt,
        '$.abandonedAt',
        'abandonedAt cannot be earlier than startedAt.',
      )
      expectString(context, record.reasonCategory, '$.reasonCategory', {
        allowed: [
          'student-choice',
          'adult-directed',
          'schedule-change',
          'wellbeing',
          'technical-unrecoverable',
          'other',
        ],
      })
      validateSessionResult(
        context,
        record.result,
        '$.result',
        record.id,
        plannedIds,
        ['abandoned'],
      )
      if (lastEventType !== 'session-abandoned') {
        context.add({
          code: 'invariant',
          path: '$.eventLog',
          message: 'An abandoned session must end with session-abandoned.',
        })
      }
      break
    }
    default:
      break
  }
  return context.issues.length === 0
}

export const studySessionSchema = defineRuntimeSchema<StudySession>({
  schemaId: 'study-session',
  kind: 'study-session',
  jsonSchema: studySessionJsonSchema,
  validateValue: validateStudySessionValue,
})

export const validateStudySession = studySessionSchema.validate
export const parseStudySession = studySessionSchema.parse
export const isStudySession = studySessionSchema.is

export const isPlannedStudySession = (value: unknown): value is PlannedStudySession =>
  studySessionSchema.is(value) && value.status === 'planned'
export const isActiveStudySession = (value: unknown): value is ActiveStudySession =>
  studySessionSchema.is(value) && value.status === 'active'
export const isPausedStudySession = (value: unknown): value is PausedStudySession =>
  studySessionSchema.is(value) && value.status === 'paused'
export const isApprovedBreakStudySession = (
  value: unknown,
): value is ApprovedBreakStudySession =>
  studySessionSchema.is(value) && value.status === 'approved-break'
export const isStudentRequestedBreakStudySession = (
  value: unknown,
): value is StudentRequestedBreakStudySession =>
  studySessionSchema.is(value) && value.status === 'student-requested-break'
export const isTechnicalInterruptionStudySession = (
  value: unknown,
): value is TechnicalInterruptionStudySession =>
  studySessionSchema.is(value) && value.status === 'technical-interruption'
export const isCompletedStudySession = (value: unknown): value is CompletedStudySession =>
  studySessionSchema.is(value) && value.status === 'completed'
export const isAbandonedStudySession = (value: unknown): value is AbandonedStudySession =>
  studySessionSchema.is(value) && value.status === 'abandoned'

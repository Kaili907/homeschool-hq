import {
  AI_SAFETY_SCHEMA_VERSION,
  type AllowedSessionWindow,
  type ConversationSessionMetadata,
  type DataDeletionRequest,
  type DataExportRequest,
  type ParentNotification,
  type RetentionPolicy,
  type SafetyEvent,
  type TutorPermissions,
  type Weekday,
} from './contracts.ts'

export interface ValidationIssue {
  readonly path: string
  readonly code:
    | 'type'
    | 'required'
    | 'additional-property'
    | 'literal'
    | 'enum'
    | 'format'
    | 'length'
    | 'range'
    | 'chronology'
    | 'duplicate'
    | 'json-safety'
    | 'invariant'
  readonly message: string
}

export type ValidationResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] }

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const MAX_STRING_LENGTH = 20_000
const MAX_ARRAY_LENGTH = 5_000
const MAX_DEPTH = 30
const MAX_NODES = 25_000

class ValidationContext {
  public readonly issues: ValidationIssue[] = []

  public add(issue: ValidationIssue): void {
    this.issues.push(issue)
  }
}

const pathFor = (path: string, key: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$-]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`

const indexPath = (path: string, index: number): string => `${path}[${index}]`

function inspectJsonBoundary(value: unknown): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const active = new WeakSet<object>()
  let nodes = 0

  const visit = (entry: unknown, path: string, depth: number): void => {
    nodes += 1
    if (nodes > MAX_NODES) {
      if (!issues.some((issue) => issue.code === 'json-safety' && issue.path === '$')) {
        issues.push({
          path: '$',
          code: 'json-safety',
          message: `Payload exceeds ${MAX_NODES} JSON nodes.`,
        })
      }
      return
    }
    if (depth > MAX_DEPTH) {
      issues.push({
        path,
        code: 'json-safety',
        message: `Payload exceeds maximum depth ${MAX_DEPTH}.`,
      })
      return
    }
    if (entry === null || typeof entry === 'boolean') return
    if (typeof entry === 'string') {
      if (entry.length > MAX_STRING_LENGTH) {
        issues.push({
          path,
          code: 'json-safety',
          message: `String exceeds ${MAX_STRING_LENGTH} characters.`,
        })
      }
      return
    }
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry)) {
        issues.push({ path, code: 'json-safety', message: 'Number must be finite.' })
      }
      return
    }
    if (
      typeof entry === 'undefined' ||
      typeof entry === 'function' ||
      typeof entry === 'symbol' ||
      typeof entry === 'bigint'
    ) {
      issues.push({
        path,
        code: 'json-safety',
        message: `Values of type ${typeof entry} are not JSON-safe.`,
      })
      return
    }
    if (typeof entry !== 'object') return
    if (active.has(entry)) {
      issues.push({ path, code: 'json-safety', message: 'Cyclic references are not accepted.' })
      return
    }
    active.add(entry)
    if (Array.isArray(entry)) {
      if (entry.length > MAX_ARRAY_LENGTH) {
        issues.push({
          path,
          code: 'json-safety',
          message: `Array exceeds ${MAX_ARRAY_LENGTH} items.`,
        })
      }
      for (let index = 0; index < entry.length; index += 1) {
        if (!Object.hasOwn(entry, index)) {
          issues.push({
            path: indexPath(path, index),
            code: 'json-safety',
            message: 'Sparse arrays are not accepted.',
          })
          continue
        }
        visit(entry[index], indexPath(path, index), depth + 1)
      }
      active.delete(entry)
      return
    }
    const prototype = Object.getPrototypeOf(entry)
    if (prototype !== Object.prototype && prototype !== null) {
      issues.push({ path, code: 'json-safety', message: 'Expected a plain JSON object.' })
      active.delete(entry)
      return
    }
    if (Object.getOwnPropertySymbols(entry).length > 0) {
      issues.push({ path, code: 'json-safety', message: 'Symbol keys are not accepted.' })
    }
    for (const key of Object.keys(entry)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        issues.push({
          path: pathFor(path, key),
          code: 'json-safety',
          message: `Reserved key "${key}" is not accepted.`,
        })
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(entry, key)
      if (!descriptor || descriptor.get || descriptor.set) {
        issues.push({
          path: pathFor(path, key),
          code: 'json-safety',
          message: 'Accessor properties are not accepted.',
        })
        continue
      }
      visit(descriptor.value, pathFor(path, key), depth + 1)
    }
    active.delete(entry)
  }

  visit(value, '$', 0)
  return issues
}

function expectRecord(
  context: ValidationContext,
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    context.add({ path, code: 'type', message: 'Expected an object.' })
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!allowedKeys.includes(key)) {
      context.add({
        path: pathFor(path, key),
        code: 'additional-property',
        message: `Unexpected property "${key}".`,
      })
    }
  }
  return record
}

function expectLiteral(
  context: ValidationContext,
  value: unknown,
  expected: string | number | boolean,
  path: string,
): boolean {
  if (value !== expected) {
    context.add({ path, code: 'literal', message: `Expected ${JSON.stringify(expected)}.` })
    return false
  }
  return true
}

function expectString(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: {
    readonly minimum?: number
    readonly maximum?: number
    readonly allowed?: readonly string[]
    readonly pattern?: RegExp
  } = {},
): value is string {
  if (typeof value !== 'string') {
    context.add({ path, code: 'type', message: 'Expected a string.' })
    return false
  }
  const minimum = options.minimum ?? 1
  const maximum = options.maximum ?? 1_000
  if (value.length < minimum || value.length > maximum) {
    context.add({
      path,
      code: 'length',
      message: `Expected between ${minimum} and ${maximum} characters.`,
    })
  }
  if (options.allowed && !options.allowed.includes(value)) {
    context.add({
      path,
      code: 'enum',
      message: `Expected one of: ${options.allowed.join(', ')}.`,
    })
  }
  if (options.pattern && !options.pattern.test(value)) {
    context.add({ path, code: 'format', message: 'String has an invalid format.' })
  }
  return true
}

function expectBoolean(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is boolean {
  if (typeof value !== 'boolean') {
    context.add({ path, code: 'type', message: 'Expected a boolean.' })
    return false
  }
  return true
}

function expectInteger(
  context: ValidationContext,
  value: unknown,
  path: string,
  minimum: number,
  maximum: number,
): value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    context.add({ path, code: 'type', message: 'Expected an integer.' })
    return false
  }
  if (value < minimum || value > maximum) {
    context.add({
      path,
      code: 'range',
      message: `Expected a value from ${minimum} through ${maximum}.`,
    })
  }
  return true
}

function expectId(context: ValidationContext, value: unknown, path: string): value is string {
  return expectString(context, value, path, {
    minimum: 1,
    maximum: 128,
    pattern: ID_PATTERN,
  })
}

function expectDateTime(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  if (!expectString(context, value, path, { maximum: 40, pattern: ISO_DATE_TIME_PATTERN })) {
    return false
  }
  if (Number.isNaN(Date.parse(value))) {
    context.add({ path, code: 'format', message: 'Expected a valid RFC 3339 date-time.' })
    return false
  }
  return true
}

function expectTimeZone(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is string {
  if (!expectString(context, value, path, { maximum: 100 })) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0)
  } catch {
    context.add({ path, code: 'format', message: 'Expected a valid IANA time zone.' })
    return false
  }
  return true
}

function expectStringArray(
  context: ValidationContext,
  value: unknown,
  path: string,
  options: {
    readonly allowed?: readonly string[]
    readonly ids?: boolean
    readonly maximum?: number
    readonly unique?: boolean
  } = {},
): value is readonly string[] {
  if (!Array.isArray(value)) {
    context.add({ path, code: 'type', message: 'Expected an array.' })
    return false
  }
  if (value.length > (options.maximum ?? 200)) {
    context.add({
      path,
      code: 'length',
      message: `Expected no more than ${options.maximum ?? 200} items.`,
    })
  }
  const seen = new Set<string>()
  value.forEach((entry, index) => {
    const valid = options.ids
      ? expectId(context, entry, indexPath(path, index))
      : expectString(context, entry, indexPath(path, index), {
          maximum: 500,
          ...(options.allowed ? { allowed: options.allowed } : {}),
        })
    if (valid && options.unique) {
      if (seen.has(entry)) {
        context.add({
          path: indexPath(path, index),
          code: 'duplicate',
          message: 'Duplicate array item.',
        })
      }
      seen.add(entry)
    }
  })
  return true
}

function result<T>(context: ValidationContext, value: unknown): ValidationResult<T> {
  return context.issues.length === 0
    ? { success: true, value: value as T }
    : { success: false, issues: context.issues }
}

function initialize(value: unknown): ValidationContext {
  const context = new ValidationContext()
  for (const issue of inspectJsonBoundary(value)) context.add(issue)
  return context
}

const hasJsonBoundaryIssue = (context: ValidationContext): boolean =>
  context.issues.some((issue) => issue.code === 'json-safety')

function validateEnvelope(
  context: ValidationContext,
  record: Record<string, unknown>,
): void {
  expectLiteral(context, record.schemaVersion, AI_SAFETY_SCHEMA_VERSION, '$.schemaVersion')
  expectDateTime(context, record.createdAt, '$.createdAt')
}

export function validateConversationSession(
  value: unknown,
): ValidationResult<ConversationSessionMetadata> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  const record = expectRecord(context, value, '$', [
    'kind',
    'schemaVersion',
    'createdAt',
    'sessionId',
    'studentId',
    'subject',
    'ageBand',
    'channel',
    'startedAt',
    'endedAt',
    'status',
    'timeZone',
    'policyVersion',
    'transcriptMode',
    'rawMicrophoneRecordingStored',
    'parentReviewScope',
    'safetyExceptionApplies',
  ])
  if (!record) return result(context, value)
  validateEnvelope(context, record)
  expectLiteral(context, record.kind, 'conversation-session', '$.kind')
  expectId(context, record.sessionId, '$.sessionId')
  expectId(context, record.studentId, '$.studentId')
  const subject = expectRecord(context, record.subject, '$.subject', ['subjectId', 'displayName'])
  if (subject) {
    expectId(context, subject.subjectId, '$.subject.subjectId')
    expectString(context, subject.displayName, '$.subject.displayName', { maximum: 100 })
  }
  expectString(context, record.ageBand, '$.ageBand', {
    allowed: ['under-8', '8-12', '13-17'],
  })
  expectString(context, record.channel, '$.channel', { allowed: ['text', 'voice'] })
  const startedValid = expectDateTime(context, record.startedAt, '$.startedAt')
  const endedValid =
    record.endedAt === undefined || expectDateTime(context, record.endedAt, '$.endedAt')
  expectString(context, record.status, '$.status', {
    allowed: ['active', 'completed', 'paused-for-safety', 'student-blocked', 'technical-stop'],
  })
  expectTimeZone(context, record.timeZone, '$.timeZone')
  expectString(context, record.policyVersion, '$.policyVersion', { maximum: 40 })
  expectString(context, record.transcriptMode, '$.transcriptMode', {
    allowed: ['text-only', 'not-retained'],
  })
  expectLiteral(
    context,
    record.rawMicrophoneRecordingStored,
    false,
    '$.rawMicrophoneRecordingStored',
  )
  expectLiteral(
    context,
    record.parentReviewScope,
    'authorized-parent-and-student',
    '$.parentReviewScope',
  )
  expectLiteral(context, record.safetyExceptionApplies, true, '$.safetyExceptionApplies')
  if (
    startedValid &&
    endedValid &&
    typeof record.endedAt === 'string' &&
    Date.parse(record.endedAt) < Date.parse(record.startedAt as string)
  ) {
    context.add({
      path: '$.endedAt',
      code: 'chronology',
      message: 'endedAt cannot be earlier than startedAt.',
    })
  }
  if (record.status === 'active' && record.endedAt !== undefined) {
    context.add({
      path: '$.endedAt',
      code: 'invariant',
      message: 'An active session cannot have endedAt.',
    })
  }
  if (record.status !== 'active' && record.endedAt === undefined) {
    context.add({
      path: '$.endedAt',
      code: 'required',
      message: 'A non-active session requires endedAt.',
    })
  }
  return result(context, value)
}

const CLASSIFICATIONS = [
  'answer-integrity',
  'academic-integrity',
  'age-inappropriate-content',
  'dangerous-activity',
  'harassment-or-hate',
  'medical-boundary',
  'legal-boundary',
  'potential-self-harm',
  'potential-immediate-danger',
  'potential-abuse-or-unsafe-situation',
  'privacy-or-personal-data',
  'prompt-injection',
  'restricted-subject',
  'sexual-content',
  'violent-content',
  'student-report',
  'student-block',
  'model-policy-failure',
  'access-control',
] as const

const WITHHELD_REASONS = [
  'direct-answer-request',
  'answer-leak-detected',
  'restricted-subject',
  'outside-allowed-time',
  'daily-session-limit',
  'session-time-limit',
  'permission-disabled',
  'voice-input-disabled',
  'safety-concern',
  'privacy-request',
  'harmful-instructions',
  'age-inappropriate',
  'prompt-injection',
  'student-blocked',
  'human-review-required',
  'history-unavailable',
] as const

const SAFETY_BASE_KEYS = [
  'kind',
  'schemaVersion',
  'createdAt',
  'eventId',
  'sessionId',
  'studentId',
  'subjectId',
  'occurredAt',
  'classification',
  'severity',
  'escalation',
  'summary',
  'evidenceRefs',
  'detector',
  'parentVisible',
  'rawMicrophoneRecordingStored',
] as const

function validateSafetyBase(
  context: ValidationContext,
  record: Record<string, unknown>,
): void {
  validateEnvelope(context, record)
  expectId(context, record.eventId, '$.eventId')
  expectId(context, record.sessionId, '$.sessionId')
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.subjectId, '$.subjectId')
  expectDateTime(context, record.occurredAt, '$.occurredAt')
  expectString(context, record.classification, '$.classification', {
    allowed: CLASSIFICATIONS,
  })
  expectString(context, record.severity, '$.severity', {
    allowed: ['info', 'low', 'moderate', 'high', 'critical'],
  })
  expectString(context, record.escalation, '$.escalation', {
    allowed: [
      'none',
      'record-for-parent',
      'parent-review',
      'urgent-parent-attention',
      'human-safety-review',
    ],
  })
  expectString(context, record.summary, '$.summary', { maximum: 500 })
  expectStringArray(context, record.evidenceRefs, '$.evidenceRefs', {
    ids: true,
    unique: true,
    maximum: 50,
  })
  expectString(context, record.detector, '$.detector', {
    allowed: ['local-policy', 'model-output-check', 'student', 'parent', 'reviewer'],
  })
  expectLiteral(context, record.parentVisible, true, '$.parentVisible')
  expectLiteral(
    context,
    record.rawMicrophoneRecordingStored,
    false,
    '$.rawMicrophoneRecordingStored',
  )
}

export function validateSafetyEvent(value: unknown): ValidationResult<SafetyEvent> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    context.add({ path: '$', code: 'type', message: 'Expected an object.' })
    return result(context, value)
  }
  const kind = (value as Record<string, unknown>).kind
  const variantKeys: Record<string, readonly string[]> = {
    'answer-withheld-event': [
      'withheldReason',
      'studentExplanation',
      'canContinueLearning',
    ],
    'emergency-language-event': [
      'sessionAction',
      'responseProtocol',
      'hotlineInformationProvided',
      'emergencyServicesContacted',
    ],
    'student-report-event': [
      'reportId',
      'reportCategory',
      'targetEntryId',
      'studentComment',
    ],
    'student-block-event': ['blockId', 'blockScope'],
    'policy-violation-event': ['policyCode'],
  }
  if (typeof kind !== 'string' || !(kind in variantKeys)) {
    context.add({
      path: '$.kind',
      code: 'enum',
      message: 'Unknown safety event kind.',
    })
    return result(context, value)
  }
  const record = expectRecord(context, value, '$', [
    ...SAFETY_BASE_KEYS,
    ...variantKeys[kind],
  ])
  if (!record) return result(context, value)
  validateSafetyBase(context, record)
  if (kind === 'answer-withheld-event') {
    expectString(context, record.withheldReason, '$.withheldReason', {
      allowed: WITHHELD_REASONS,
    })
    expectString(context, record.studentExplanation, '$.studentExplanation', {
      maximum: 1_000,
    })
    expectBoolean(context, record.canContinueLearning, '$.canContinueLearning')
  }
  if (kind === 'emergency-language-event') {
    expectString(context, record.classification, '$.classification', {
      allowed: [
        'potential-self-harm',
        'potential-immediate-danger',
        'potential-abuse-or-unsafe-situation',
      ],
    })
    expectLiteral(context, record.severity, 'critical', '$.severity')
    expectLiteral(context, record.escalation, 'human-safety-review', '$.escalation')
    expectLiteral(
      context,
      record.sessionAction,
      'pause-and-seek-trusted-adult',
      '$.sessionAction',
    )
    expectLiteral(
      context,
      record.responseProtocol,
      'trusted-adult-now-and-authorized-human-review',
      '$.responseProtocol',
    )
    expectLiteral(
      context,
      record.hotlineInformationProvided,
      false,
      '$.hotlineInformationProvided',
    )
    expectLiteral(
      context,
      record.emergencyServicesContacted,
      false,
      '$.emergencyServicesContacted',
    )
  }
  if (kind === 'student-report-event') {
    expectLiteral(context, record.classification, 'student-report', '$.classification')
    expectId(context, record.reportId, '$.reportId')
    expectString(context, record.reportCategory, '$.reportCategory', {
      allowed: [
        'unhelpful',
        'incorrect',
        'scary-or-upsetting',
        'inappropriate',
        'privacy-concern',
        'other',
      ],
    })
    if (record.targetEntryId !== undefined) {
      expectId(context, record.targetEntryId, '$.targetEntryId')
    }
    if (record.studentComment !== undefined) {
      expectString(context, record.studentComment, '$.studentComment', { maximum: 500 })
    }
  }
  if (kind === 'student-block-event') {
    expectLiteral(context, record.classification, 'student-block', '$.classification')
    expectId(context, record.blockId, '$.blockId')
    expectString(context, record.blockScope, '$.blockScope', {
      allowed: ['session', 'subject', 'all-tutor'],
    })
  }
  if (kind === 'policy-violation-event') {
    expectString(context, record.policyCode, '$.policyCode', {
      allowed: [
        'unsafe-model-output',
        'answer-disclosure',
        'restricted-content',
        'privacy-boundary',
        'authorization-denied',
      ],
    })
  }
  return result(context, value)
}

export function validateParentNotification(
  value: unknown,
): ValidationResult<ParentNotification> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  const record = expectRecord(context, value, '$', [
    'kind',
    'schemaVersion',
    'createdAt',
    'notificationId',
    'eventId',
    'studentId',
    'recipientActorId',
    'channel',
    'urgency',
    'title',
    'summary',
    'includedData',
    'includesRawTranscript',
    'status',
    'shownAt',
    'acknowledgedAt',
  ])
  if (!record) return result(context, value)
  validateEnvelope(context, record)
  expectLiteral(context, record.kind, 'parent-notification', '$.kind')
  expectId(context, record.notificationId, '$.notificationId')
  expectId(context, record.eventId, '$.eventId')
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.recipientActorId, '$.recipientActorId')
  expectLiteral(context, record.channel, 'in-app', '$.channel')
  expectString(context, record.urgency, '$.urgency', {
    allowed: ['when-convenient', 'prompt', 'urgent'],
  })
  expectString(context, record.title, '$.title', { maximum: 120 })
  expectString(context, record.summary, '$.summary', { maximum: 500 })
  expectStringArray(context, record.includedData, '$.includedData', {
    allowed: ['session-metadata', 'safe-event-summary', 'timeline-reference'],
    unique: true,
    maximum: 3,
  })
  expectLiteral(context, record.includesRawTranscript, false, '$.includesRawTranscript')
  expectString(context, record.status, '$.status', {
    allowed: ['pending', 'shown', 'acknowledged'],
  })
  if (record.shownAt !== undefined) expectDateTime(context, record.shownAt, '$.shownAt')
  if (record.acknowledgedAt !== undefined) {
    expectDateTime(context, record.acknowledgedAt, '$.acknowledgedAt')
  }
  if (record.status === 'acknowledged' && record.acknowledgedAt === undefined) {
    context.add({
      path: '$.acknowledgedAt',
      code: 'required',
      message: 'An acknowledged notification requires acknowledgedAt.',
    })
  }
  return result(context, value)
}

const WEEKDAYS: readonly Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

function validateWindow(
  context: ValidationContext,
  value: unknown,
  path: string,
): value is AllowedSessionWindow {
  const record = expectRecord(context, value, path, [
    'windowId',
    'days',
    'startLocalTime',
    'endLocalTime',
    'timeZone',
  ])
  if (!record) return false
  expectId(context, record.windowId, pathFor(path, 'windowId'))
  expectStringArray(context, record.days, pathFor(path, 'days'), {
    allowed: WEEKDAYS,
    unique: true,
    maximum: 7,
  })
  if (Array.isArray(record.days) && record.days.length === 0) {
    context.add({
      path: pathFor(path, 'days'),
      code: 'length',
      message: 'At least one weekday is required.',
    })
  }
  expectString(context, record.startLocalTime, pathFor(path, 'startLocalTime'), {
    maximum: 5,
    pattern: LOCAL_TIME_PATTERN,
  })
  expectString(context, record.endLocalTime, pathFor(path, 'endLocalTime'), {
    maximum: 5,
    pattern: LOCAL_TIME_PATTERN,
  })
  expectTimeZone(context, record.timeZone, pathFor(path, 'timeZone'))
  return true
}

export function validateTutorPermissions(value: unknown): ValidationResult<TutorPermissions> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  const record = expectRecord(context, value, '$', [
    'kind',
    'schemaVersion',
    'createdAt',
    'permissionsId',
    'studentId',
    'enabled',
    'allowedSubjectIds',
    'allowedSessionWindows',
    'dailySessionLimit',
    'maximumSessionMinutes',
    'capabilities',
    'parentReviewMode',
    'studentPrivacyNotice',
    'voiceDataMode',
    'updatedBy',
    'updatedAt',
  ])
  if (!record) return result(context, value)
  validateEnvelope(context, record)
  expectLiteral(context, record.kind, 'tutor-permissions', '$.kind')
  expectId(context, record.permissionsId, '$.permissionsId')
  expectId(context, record.studentId, '$.studentId')
  expectBoolean(context, record.enabled, '$.enabled')
  expectStringArray(context, record.allowedSubjectIds, '$.allowedSubjectIds', {
    ids: true,
    unique: true,
    maximum: 100,
  })
  if (
    Array.isArray(record.allowedSubjectIds) &&
    record.allowedSubjectIds.some((subjectId) => subjectId === '*')
  ) {
    context.add({
      path: '$.allowedSubjectIds',
      code: 'format',
      message: 'Wildcard subject access is not accepted.',
    })
  }
  if (!Array.isArray(record.allowedSessionWindows)) {
    context.add({ path: '$.allowedSessionWindows', code: 'type', message: 'Expected an array.' })
  } else {
    if (record.allowedSessionWindows.length > 50) {
      context.add({
        path: '$.allowedSessionWindows',
        code: 'length',
        message: 'Expected no more than 50 session windows.',
      })
    }
    record.allowedSessionWindows.forEach((window, index) =>
      validateWindow(context, window, indexPath('$.allowedSessionWindows', index)),
    )
  }
  expectInteger(context, record.dailySessionLimit, '$.dailySessionLimit', 0, 100)
  expectInteger(context, record.maximumSessionMinutes, '$.maximumSessionMinutes', 1, 240)
  const capabilities = expectRecord(context, record.capabilities, '$.capabilities', [
    'textTutoring',
    'voiceInput',
    'readAloud',
    'externalLinks',
    'fileUpload',
  ])
  if (capabilities) {
    for (const key of [
      'textTutoring',
      'voiceInput',
      'readAloud',
      'externalLinks',
      'fileUpload',
    ] as const) {
      expectBoolean(context, capabilities[key], `$.capabilities.${key}`)
    }
  }
  expectLiteral(
    context,
    record.parentReviewMode,
    'always-available-to-authorized-parent',
    '$.parentReviewMode',
  )
  expectLiteral(
    context,
    record.studentPrivacyNotice,
    'parent-review-with-safety-exceptions',
    '$.studentPrivacyNotice',
  )
  expectLiteral(
    context,
    record.voiceDataMode,
    'transcript-only-no-raw-audio',
    '$.voiceDataMode',
  )
  const updatedBy = expectRecord(context, record.updatedBy, '$.updatedBy', ['role', 'actorId'])
  if (updatedBy) {
    expectLiteral(context, updatedBy.role, 'parent', '$.updatedBy.role')
    expectId(context, updatedBy.actorId, '$.updatedBy.actorId')
  }
  const createdValid = expectDateTime(context, record.createdAt, '$.createdAt')
  const updatedValid = expectDateTime(context, record.updatedAt, '$.updatedAt')
  if (
    createdValid &&
    updatedValid &&
    Date.parse(record.updatedAt as string) < Date.parse(record.createdAt as string)
  ) {
    context.add({
      path: '$.updatedAt',
      code: 'chronology',
      message: 'updatedAt cannot be earlier than createdAt.',
    })
  }
  return result(context, value)
}

export function validateRetentionPolicy(value: unknown): ValidationResult<RetentionPolicy> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  const record = expectRecord(context, value, '$', [
    'kind',
    'schemaVersion',
    'createdAt',
    'policyId',
    'studentId',
    'instructionalHistoryDays',
    'safetyEventDays',
    'auditHistoryDays',
    'preserveOpenHumanReviews',
    'rawMicrophoneRecordingRetentionDays',
    'updatedBy',
    'updatedAt',
  ])
  if (!record) return result(context, value)
  validateEnvelope(context, record)
  expectLiteral(context, record.kind, 'retention-policy', '$.kind')
  expectId(context, record.policyId, '$.policyId')
  expectId(context, record.studentId, '$.studentId')
  if (
    expectInteger(
      context,
      record.instructionalHistoryDays,
      '$.instructionalHistoryDays',
      7,
      90,
    ) &&
    ![7, 30, 60, 90].includes(record.instructionalHistoryDays)
  ) {
    context.add({
      path: '$.instructionalHistoryDays',
      code: 'enum',
      message: 'Expected one of: 7, 30, 60, 90.',
    })
  }
  if (
    expectInteger(context, record.safetyEventDays, '$.safetyEventDays', 90, 365) &&
    ![90, 180, 365].includes(record.safetyEventDays)
  ) {
    context.add({
      path: '$.safetyEventDays',
      code: 'enum',
      message: 'Expected one of: 90, 180, 365.',
    })
  }
  if (
    expectInteger(context, record.auditHistoryDays, '$.auditHistoryDays', 180, 730) &&
    ![180, 365, 730].includes(record.auditHistoryDays)
  ) {
    context.add({
      path: '$.auditHistoryDays',
      code: 'enum',
      message: 'Expected one of: 180, 365, 730.',
    })
  }
  expectLiteral(context, record.preserveOpenHumanReviews, true, '$.preserveOpenHumanReviews')
  expectLiteral(
    context,
    record.rawMicrophoneRecordingRetentionDays,
    0,
    '$.rawMicrophoneRecordingRetentionDays',
  )
  const updatedBy = expectRecord(context, record.updatedBy, '$.updatedBy', ['role', 'actorId'])
  if (updatedBy) {
    expectLiteral(context, updatedBy.role, 'parent', '$.updatedBy.role')
    expectId(context, updatedBy.actorId, '$.updatedBy.actorId')
  }
  expectDateTime(context, record.updatedAt, '$.updatedAt')
  return result(context, value)
}

export function validateDataRequest(
  value: unknown,
): ValidationResult<DataExportRequest | DataDeletionRequest> {
  const context = initialize(value)
  if (hasJsonBoundaryIssue(context)) return result(context, value)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    context.add({ path: '$', code: 'type', message: 'Expected an object.' })
    return result(context, value)
  }
  const kind = (value as Record<string, unknown>).kind
  const exportKeys = ['scope', 'format', 'status', 'completedAt']
  const deletionKeys = ['scope', 'status', 'approvedBy', 'approvedAt', 'completedAt']
  const record = expectRecord(context, value, '$', [
    'kind',
    'schemaVersion',
    'createdAt',
    'requestId',
    'studentId',
    'requestedBy',
    'requestedAt',
    ...(kind === 'data-export-request' ? exportKeys : deletionKeys),
  ])
  if (!record) return result(context, value)
  validateEnvelope(context, record)
  if (kind !== 'data-export-request' && kind !== 'data-deletion-request') {
    context.add({ path: '$.kind', code: 'enum', message: 'Unknown data request kind.' })
    return result(context, value)
  }
  expectId(context, record.requestId, '$.requestId')
  expectId(context, record.studentId, '$.studentId')
  const requestedBy = expectRecord(context, record.requestedBy, '$.requestedBy', [
    'role',
    'actorId',
  ])
  if (requestedBy) {
    expectString(context, requestedBy.role, '$.requestedBy.role', {
      allowed: ['student', 'parent'],
    })
    expectId(context, requestedBy.actorId, '$.requestedBy.actorId')
  }
  expectDateTime(context, record.requestedAt, '$.requestedAt')
  if (kind === 'data-export-request') {
    expectString(context, record.scope, '$.scope', {
      allowed: ['instructional-history', 'safety-events', 'all-safety-center-data'],
    })
    expectLiteral(context, record.format, 'json', '$.format')
    expectString(context, record.status, '$.status', {
      allowed: ['requested', 'ready', 'completed', 'denied'],
    })
  } else {
    expectString(context, record.scope, '$.scope', {
      allowed: ['instructional-history', 'safety-events', 'all-eligible-data'],
    })
    expectString(context, record.status, '$.status', {
      allowed: [
        'requested',
        'awaiting-parent-confirmation',
        'approved',
        'completed',
        'partially-completed',
        'denied',
      ],
    })
    if (record.approvedBy !== undefined) {
      const approvedBy = expectRecord(context, record.approvedBy, '$.approvedBy', [
        'role',
        'actorId',
      ])
      if (approvedBy) {
        expectLiteral(context, approvedBy.role, 'parent', '$.approvedBy.role')
        expectId(context, approvedBy.actorId, '$.approvedBy.actorId')
      }
    }
    if (record.approvedAt !== undefined) {
      expectDateTime(context, record.approvedAt, '$.approvedAt')
    }
    if (
      ['approved', 'completed', 'partially-completed'].includes(String(record.status)) &&
      (record.approvedBy === undefined || record.approvedAt === undefined)
    ) {
      context.add({
        path: '$.approvedBy',
        code: 'required',
        message: 'Approved and completed deletion requests require parent approval.',
      })
    }
  }
  if (record.completedAt !== undefined) {
    expectDateTime(context, record.completedAt, '$.completedAt')
  }
  return result(context, value)
}

export function assertValid<T>(
  validation: ValidationResult<T>,
  label = 'AI Safety contract',
): T {
  if (validation.success) return validation.value
  const detail = validation.issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ')
  throw new TypeError(`${label} validation failed: ${detail}`)
}

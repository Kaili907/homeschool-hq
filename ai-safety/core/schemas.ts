/**
 * Dependency-neutral JSON Schema documents for host systems that validate at a
 * wire boundary. Runtime invariants (chronology, authorization, and fixed
 * privacy safeguards) are additionally enforced by validation.ts.
 */

export type JsonSchemaDocument = Readonly<Record<string, unknown>>

const opaqueId = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$',
} as const

const dateTime = { type: 'string', format: 'date-time' } as const
const timeZone = { type: 'string', minLength: 1, maxLength: 100 } as const

const envelopeProperties = {
  schemaVersion: { const: 1 },
  createdAt: dateTime,
} as const

const baseRequired = ['schemaVersion', 'createdAt'] as const

const safetyClassifications = [
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

export const conversationSessionJsonSchema: JsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/ai-safety/conversation-session.v1.schema.json',
  title: 'Manuel Academy AI Safety Conversation Session',
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    ...baseRequired,
    'sessionId',
    'studentId',
    'subject',
    'ageBand',
    'channel',
    'startedAt',
    'status',
    'timeZone',
    'policyVersion',
    'transcriptMode',
    'rawMicrophoneRecordingStored',
    'parentReviewScope',
    'safetyExceptionApplies',
  ],
  properties: {
    kind: { const: 'conversation-session' },
    ...envelopeProperties,
    sessionId: opaqueId,
    studentId: opaqueId,
    subject: {
      type: 'object',
      additionalProperties: false,
      required: ['subjectId', 'displayName'],
      properties: {
        subjectId: opaqueId,
        displayName: { type: 'string', minLength: 1, maxLength: 100 },
      },
    },
    ageBand: { enum: ['under-8', '8-12', '13-17'] },
    channel: { enum: ['text', 'voice'] },
    startedAt: dateTime,
    endedAt: dateTime,
    status: {
      enum: ['active', 'completed', 'paused-for-safety', 'student-blocked', 'technical-stop'],
    },
    timeZone,
    policyVersion: { type: 'string', minLength: 1, maxLength: 40 },
    transcriptMode: { enum: ['text-only', 'not-retained'] },
    rawMicrophoneRecordingStored: { const: false },
    parentReviewScope: { const: 'authorized-parent-and-student' },
    safetyExceptionApplies: { const: true },
  },
  'x-manuel-runtime-refinement': [
    'endedAt >= startedAt',
    'status=active means endedAt is absent',
    'status!=active means endedAt is present',
  ],
}

const safetyBaseProperties = {
  ...envelopeProperties,
  eventId: opaqueId,
  sessionId: opaqueId,
  studentId: opaqueId,
  subjectId: opaqueId,
  occurredAt: dateTime,
  classification: { enum: safetyClassifications },
  severity: { enum: ['info', 'low', 'moderate', 'high', 'critical'] },
  escalation: {
    enum: [
      'none',
      'record-for-parent',
      'parent-review',
      'urgent-parent-attention',
      'human-safety-review',
    ],
  },
  summary: { type: 'string', minLength: 1, maxLength: 500 },
  evidenceRefs: {
    type: 'array',
    maxItems: 50,
    uniqueItems: true,
    items: opaqueId,
  },
  detector: {
    enum: ['local-policy', 'model-output-check', 'student', 'parent', 'reviewer'],
  },
  parentVisible: { const: true },
  rawMicrophoneRecordingStored: { const: false },
} as const

const safetyBaseRequired = [
  ...baseRequired,
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

const withheldReasons = [
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

const safetyVariant = (
  kind: string,
  required: readonly string[],
  properties: Readonly<Record<string, unknown>>,
) => ({
  type: 'object',
  additionalProperties: false,
  required: ['kind', ...safetyBaseRequired, ...required],
  properties: {
    kind: { const: kind },
    ...safetyBaseProperties,
    ...properties,
  },
})

export const safetyEventJsonSchema: JsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/ai-safety/safety-event.v1.schema.json',
  title: 'Manuel Academy AI Safety Event',
  oneOf: [
    safetyVariant(
      'answer-withheld-event',
      ['withheldReason', 'studentExplanation', 'canContinueLearning'],
      {
        withheldReason: { enum: withheldReasons },
        studentExplanation: { type: 'string', minLength: 1, maxLength: 1_000 },
        canContinueLearning: { type: 'boolean' },
      },
    ),
    safetyVariant(
      'emergency-language-event',
      [
        'sessionAction',
        'responseProtocol',
        'hotlineInformationProvided',
        'emergencyServicesContacted',
      ],
      {
        classification: {
          enum: [
            'potential-self-harm',
            'potential-immediate-danger',
            'potential-abuse-or-unsafe-situation',
          ],
        },
        severity: { const: 'critical' },
        escalation: { const: 'human-safety-review' },
        sessionAction: { const: 'pause-and-seek-trusted-adult' },
        responseProtocol: { const: 'trusted-adult-now-and-authorized-human-review' },
        hotlineInformationProvided: { const: false },
        emergencyServicesContacted: { const: false },
      },
    ),
    safetyVariant(
      'student-report-event',
      ['reportId', 'reportCategory'],
      {
        classification: { const: 'student-report' },
        reportId: opaqueId,
        reportCategory: {
          enum: [
            'unhelpful',
            'incorrect',
            'scary-or-upsetting',
            'inappropriate',
            'privacy-concern',
            'other',
          ],
        },
        targetEntryId: opaqueId,
        studentComment: { type: 'string', minLength: 1, maxLength: 500 },
      },
    ),
    safetyVariant('student-block-event', ['blockId', 'blockScope'], {
      classification: { const: 'student-block' },
      blockId: opaqueId,
      blockScope: { enum: ['session', 'subject', 'all-tutor'] },
    }),
    safetyVariant('policy-violation-event', ['policyCode'], {
      policyCode: {
        enum: [
          'unsafe-model-output',
          'answer-disclosure',
          'restricted-content',
          'privacy-boundary',
          'authorization-denied',
        ],
      },
    }),
  ],
}

export const parentNotificationJsonSchema: JsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/ai-safety/parent-notification.v1.schema.json',
  title: 'Manuel Academy AI Safety Parent Notification',
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    ...baseRequired,
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
  ],
  properties: {
    kind: { const: 'parent-notification' },
    ...envelopeProperties,
    notificationId: opaqueId,
    eventId: opaqueId,
    studentId: opaqueId,
    recipientActorId: opaqueId,
    channel: { const: 'in-app' },
    urgency: { enum: ['when-convenient', 'prompt', 'urgent'] },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    summary: { type: 'string', minLength: 1, maxLength: 500 },
    includedData: {
      type: 'array',
      maxItems: 3,
      uniqueItems: true,
      items: {
        enum: ['session-metadata', 'safe-event-summary', 'timeline-reference'],
      },
    },
    includesRawTranscript: { const: false },
    status: { enum: ['pending', 'shown', 'acknowledged'] },
    shownAt: dateTime,
    acknowledgedAt: dateTime,
  },
}

export const tutorPermissionsJsonSchema: JsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/ai-safety/tutor-permissions.v1.schema.json',
  title: 'Manuel Academy Tutor Permissions',
  type: 'object',
  additionalProperties: false,
  required: [
    'kind',
    ...baseRequired,
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
  ],
  properties: {
    kind: { const: 'tutor-permissions' },
    ...envelopeProperties,
    permissionsId: opaqueId,
    studentId: opaqueId,
    enabled: { type: 'boolean' },
    allowedSubjectIds: {
      type: 'array',
      maxItems: 100,
      uniqueItems: true,
      items: opaqueId,
      description: 'An empty list denies every subject. Wildcards are rejected at runtime.',
    },
    allowedSessionWindows: {
      type: 'array',
      maxItems: 50,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['windowId', 'days', 'startLocalTime', 'endLocalTime', 'timeZone'],
        properties: {
          windowId: opaqueId,
          days: {
            type: 'array',
            minItems: 1,
            maxItems: 7,
            uniqueItems: true,
            items: {
              enum: [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday',
              ],
            },
          },
          startLocalTime: {
            type: 'string',
            pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
          },
          endLocalTime: {
            type: 'string',
            pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$',
          },
          timeZone,
        },
      },
    },
    dailySessionLimit: { type: 'integer', minimum: 0, maximum: 100 },
    maximumSessionMinutes: { type: 'integer', minimum: 1, maximum: 240 },
    capabilities: {
      type: 'object',
      additionalProperties: false,
      required: ['textTutoring', 'voiceInput', 'readAloud', 'externalLinks', 'fileUpload'],
      properties: {
        textTutoring: { type: 'boolean' },
        voiceInput: { type: 'boolean' },
        readAloud: { type: 'boolean' },
        externalLinks: { type: 'boolean' },
        fileUpload: { type: 'boolean' },
      },
    },
    parentReviewMode: { const: 'always-available-to-authorized-parent' },
    studentPrivacyNotice: { const: 'parent-review-with-safety-exceptions' },
    voiceDataMode: { const: 'transcript-only-no-raw-audio' },
    updatedBy: {
      type: 'object',
      additionalProperties: false,
      required: ['role', 'actorId'],
      properties: {
        role: { const: 'parent' },
        actorId: opaqueId,
      },
    },
    updatedAt: dateTime,
  },
  'x-manuel-runtime-refinement': [
    'allowedSubjectIds cannot contain wildcard values',
    'updatedAt >= createdAt',
  ],
}

export const dataRequestJsonSchema: JsonSchemaDocument = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://manuel.academy/schemas/ai-safety/data-request.v1.schema.json',
  title: 'Manuel Academy AI Safety Export or Deletion Request',
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: [
        'kind',
        ...baseRequired,
        'requestId',
        'studentId',
        'requestedBy',
        'requestedAt',
        'scope',
        'format',
        'status',
      ],
      properties: {
        kind: { const: 'data-export-request' },
        ...envelopeProperties,
        requestId: opaqueId,
        studentId: opaqueId,
        requestedBy: {
          type: 'object',
          additionalProperties: false,
          required: ['role', 'actorId'],
          properties: {
            role: { enum: ['student', 'parent'] },
            actorId: opaqueId,
          },
        },
        requestedAt: dateTime,
        scope: {
          enum: ['instructional-history', 'safety-events', 'all-safety-center-data'],
        },
        format: { const: 'json' },
        status: { enum: ['requested', 'ready', 'completed', 'denied'] },
        completedAt: dateTime,
      },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: [
        'kind',
        ...baseRequired,
        'requestId',
        'studentId',
        'requestedBy',
        'requestedAt',
        'scope',
        'status',
      ],
      properties: {
        kind: { const: 'data-deletion-request' },
        ...envelopeProperties,
        requestId: opaqueId,
        studentId: opaqueId,
        requestedBy: {
          type: 'object',
          additionalProperties: false,
          required: ['role', 'actorId'],
          properties: {
            role: { enum: ['student', 'parent'] },
            actorId: opaqueId,
          },
        },
        requestedAt: dateTime,
        scope: {
          enum: ['instructional-history', 'safety-events', 'all-eligible-data'],
        },
        status: {
          enum: [
            'requested',
            'awaiting-parent-confirmation',
            'approved',
            'completed',
            'partially-completed',
            'denied',
          ],
        },
        approvedBy: {
          type: 'object',
          additionalProperties: false,
          required: ['role', 'actorId'],
          properties: {
            role: { const: 'parent' },
            actorId: opaqueId,
          },
        },
        approvedAt: dateTime,
        completedAt: dateTime,
      },
    },
  ],
  'x-manuel-runtime-refinement': [
    'approved/completed deletion requests require approvedBy and approvedAt',
  ],
}

export const AI_SAFETY_SCHEMA_REGISTRY = [
  conversationSessionJsonSchema,
  safetyEventJsonSchema,
  parentNotificationJsonSchema,
  tutorPermissionsJsonSchema,
  dataRequestJsonSchema,
] as const

export const getAiSafetySchema = (schemaId: string): JsonSchemaDocument | undefined =>
  AI_SAFETY_SCHEMA_REGISTRY.find((schema) => schema.$id === schemaId)

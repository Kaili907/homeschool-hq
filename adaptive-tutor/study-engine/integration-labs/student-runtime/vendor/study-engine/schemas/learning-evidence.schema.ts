import type { LearningEvidence } from '../contracts/index.ts'
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
  expectBoolean,
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

const OBSERVATION_SOURCES = [
  'student-report',
  'teacher-observation',
  'parent-observation',
  'system-measure',
] as const

const engagementSignals = [
  'accuracy',
  'response-latency',
  'random-response-indicator',
  'redirection',
  'student-report',
  'adult-observation',
  'technical-context',
] as const

const sourcedRatingSchema: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['rating', 'source', 'observedAt'],
  properties: {
    rating: { type: 'integer', minimum: 1, maximum: 5 },
    source: { enum: OBSERVATION_SOURCES },
    observedAt: isoDateTimeSchema,
  },
}

export const learningEvidenceJsonSchema = createRootJsonSchema({
  id: 'urn:manuel-academy:study-engine:learning-evidence:1',
  title: 'Learning Evidence',
  kind: 'learning-evidence',
  description:
    'Structured learning observations. Accuracy alone never establishes an engagement concern or a prerequisite gap.',
  required: ['studentId', 'sessionId', 'subjectId', 'skillIds', 'capturedAt'],
  properties: {
    studentId: opaqueIdSchema,
    sessionId: opaqueIdSchema,
    subjectId: opaqueIdSchema,
    skillIds: idArraySchema({ minimum: 1 }),
    capturedAt: isoDateTimeSchema,
    accuracy: {
      type: 'object',
      additionalProperties: false,
      required: ['correctCount', 'attemptedCount', 'accuracyPercent', 'scoringMethod'],
      properties: {
        correctCount: nonNegativeIntegerSchema,
        attemptedCount: { type: 'integer', minimum: 1 },
        accuracyPercent: { type: 'number', minimum: 0, maximum: 100 },
        scoringMethod: { type: 'string', minLength: 1, maxLength: 200 },
      },
    },
    completion: {
      type: 'object',
      additionalProperties: false,
      required: ['completedCount', 'assignedCount', 'completionPercent'],
      properties: {
        completedCount: nonNegativeIntegerSchema,
        assignedCount: { type: 'integer', minimum: 1 },
        completionPercent: { type: 'number', minimum: 0, maximum: 100 },
      },
    },
    independence: {
      type: 'object',
      additionalProperties: false,
      required: ['supportLevel', 'source'],
      properties: {
        supportLevel: { enum: ['independent', 'minimal-support', 'guided', 'full-support'] },
        source: { enum: OBSERVATION_SOURCES },
      },
    },
    confidence: sourcedRatingSchema,
    effort: sourcedRatingSchema,
    frustration: sourcedRatingSchema,
    hintUse: {
      type: 'object',
      additionalProperties: false,
      required: ['offeredCount', 'requestedCount', 'acceptedCount', 'kinds'],
      properties: {
        offeredCount: nonNegativeIntegerSchema,
        requestedCount: nonNegativeIntegerSchema,
        acceptedCount: nonNegativeIntegerSchema,
        kinds: {
          type: 'array',
          uniqueItems: true,
          items: { enum: ['prompt', 'visual', 'worked-step', 'definition', 'example'] },
        },
      },
    },
    tutorIntervention: {
      type: 'object',
      additionalProperties: false,
      required: ['count', 'kinds'],
      properties: {
        count: nonNegativeIntegerSchema,
        kinds: {
          type: 'array',
          uniqueItems: true,
          items: {
            enum: [
              'clarification',
              'prompt',
              'worked-example',
              'reteaching',
              'redirection',
              'adult-escalation',
            ],
          },
        },
      },
    },
    redirectionCount: nonNegativeIntegerSchema,
    responseLatency: {
      type: 'object',
      additionalProperties: false,
      required: ['sampleCount', 'medianMs', 'p90Ms', 'minimumMs', 'maximumMs'],
      properties: {
        sampleCount: { type: 'integer', minimum: 1 },
        medianMs: nonNegativeIntegerSchema,
        p90Ms: nonNegativeIntegerSchema,
        minimumMs: nonNegativeIntegerSchema,
        maximumMs: nonNegativeIntegerSchema,
      },
    },
    randomResponseIndicators: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'strength', 'supportingEvidenceIds', 'doesNotEstablishInattention'],
        properties: {
          kind: {
            enum: ['unusually-fast-series', 'repeating-choice-pattern', 'observer-concern'],
          },
          strength: { enum: ['weak', 'moderate', 'strong'] },
          supportingEvidenceIds: idArraySchema({ minimum: 1 }),
          doesNotEstablishInattention: { const: true },
        },
      },
    },
    nextDayRecall: {
      type: 'object',
      additionalProperties: false,
      required: ['attemptedOn', 'intervalDays', 'correctCount', 'attemptedCount', 'hintCount'],
      properties: {
        attemptedOn: isoDateSchema,
        intervalDays: { const: 1 },
        correctCount: nonNegativeIntegerSchema,
        attemptedCount: { type: 'integer', minimum: 1 },
        hintCount: nonNegativeIntegerSchema,
      },
    },
    retention: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basisEvidenceIds', 'measuredAcrossDays'],
      properties: {
        status: { enum: ['not-assessed', 'declining', 'stable', 'improving', 'retained'] },
        basisEvidenceIds: idArraySchema(),
        measuredAcrossDays: nonNegativeIntegerSchema,
      },
    },
    masteryOutcome: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'basisEvidenceIds'],
      properties: {
        status: {
          enum: [
            'not-assessed',
            'not-yet-demonstrated',
            'progressing',
            'demonstrated',
            'retained',
            'insufficient-evidence',
          ],
        },
        criterionId: opaqueIdSchema,
        algorithmVersion: { type: 'string', minLength: 1, maxLength: 100 },
        basisEvidenceIds: idArraySchema(),
      },
    },
    prerequisiteGapOutcome: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'prerequisiteSkillIds', 'basisEvidenceIds', 'nextAction'],
      properties: {
        status: { enum: ['none-observed', 'suspected', 'confirmed', 'insufficient-evidence'] },
        prerequisiteSkillIds: idArraySchema(),
        basisEvidenceIds: idArraySchema(),
        nextAction: { enum: ['none', 'collect-more-evidence', 'remediate', 'adult-review'] },
      },
    },
    engagementSupport: {
      type: 'object',
      additionalProperties: false,
      required: ['status', 'supportingSignals', 'wording'],
      properties: {
        status: { enum: ['no-concern', 'support-may-help', 'insufficient-evidence'] },
        supportingSignals: {
          type: 'array',
          uniqueItems: true,
          items: { enum: engagementSignals },
        },
        wording: { const: 'contextual-and-revisable' },
      },
    },
  },
  runtimeRefinements: [
    'at least one observation field is present',
    'counts and computed percentages agree',
    'latency summaries are ordered',
    'confirmed prerequisite gaps require multiple evidence references',
    'support-may-help requires a signal independent of accuracy',
  ],
})

const EVIDENCE_KEYS = [
  'kind',
  'schemaVersion',
  'id',
  'revision',
  'createdAt',
  'updatedAt',
  'metadata',
  'studentId',
  'sessionId',
  'subjectId',
  'skillIds',
  'capturedAt',
  'accuracy',
  'completion',
  'independence',
  'confidence',
  'effort',
  'frustration',
  'hintUse',
  'tutorIntervention',
  'redirectionCount',
  'responseLatency',
  'randomResponseIndicators',
  'nextDayRecall',
  'retention',
  'masteryOutcome',
  'prerequisiteGapOutcome',
  'engagementSupport',
] as const

const OBSERVATION_KEYS = [
  'accuracy',
  'completion',
  'independence',
  'confidence',
  'effort',
  'frustration',
  'hintUse',
  'tutorIntervention',
  'redirectionCount',
  'responseLatency',
  'randomResponseIndicators',
  'nextDayRecall',
  'retention',
  'masteryOutcome',
  'prerequisiteGapOutcome',
  'engagementSupport',
] as const

function validateRatio(
  context: ValidationContext,
  value: unknown,
  path: string,
  configuration: {
    readonly numeratorKey: string
    readonly denominatorKey: string
    readonly percentKey: string
    readonly extraKeys?: readonly string[]
  },
): void {
  const keys = [
    configuration.numeratorKey,
    configuration.denominatorKey,
    configuration.percentKey,
    ...(configuration.extraKeys ?? []),
  ]
  const ratio = expectRecord(context, value, path, keys)
  if (!ratio) return
  const numerator = ratio[configuration.numeratorKey]
  const denominator = ratio[configuration.denominatorKey]
  const percent = ratio[configuration.percentKey]
  const numeratorValid = expectNumber(
    context,
    numerator,
    propertyPath(path, configuration.numeratorKey),
    { integer: true, minimum: 0 },
  )
  const denominatorValid = expectNumber(
    context,
    denominator,
    propertyPath(path, configuration.denominatorKey),
    { integer: true, minimum: 1 },
  )
  const percentValid = expectNumber(
    context,
    percent,
    propertyPath(path, configuration.percentKey),
    { minimum: 0, maximum: 100 },
  )
  if (numeratorValid && denominatorValid && (numerator as number) > (denominator as number)) {
    context.add({
      code: 'invariant',
      path: propertyPath(path, configuration.numeratorKey),
      message: `${configuration.numeratorKey} cannot exceed ${configuration.denominatorKey}.`,
    })
  }
  if (numeratorValid && denominatorValid && percentValid) {
    const expected = ((numerator as number) / (denominator as number)) * 100
    if (Math.abs(expected - (percent as number)) > 0.01) {
      context.add({
        code: 'invariant',
        path: propertyPath(path, configuration.percentKey),
        message: `${configuration.percentKey} does not match the counts.`,
      })
    }
  }
}

function validateSourcedRating(
  context: ValidationContext,
  value: unknown,
  path: string,
): void {
  const rating = expectRecord(context, value, path, ['rating', 'source', 'observedAt'])
  if (!rating) return
  expectNumber(context, rating.rating, propertyPath(path, 'rating'), {
    integer: true,
    minimum: 1,
    maximum: 5,
  })
  expectString(context, rating.source, propertyPath(path, 'source'), {
    allowed: OBSERVATION_SOURCES,
  })
  expectISODateTime(context, rating.observedAt, propertyPath(path, 'observedAt'))
}

function validateLearningEvidenceValue(
  value: unknown,
  context: ValidationContext,
): value is LearningEvidence {
  const record = expectRecord(context, value, '$', EVIDENCE_KEYS)
  if (!record) return false
  validateHeader(context, record, '$', 'learning-evidence')
  expectId(context, record.studentId, '$.studentId')
  expectId(context, record.sessionId, '$.sessionId')
  expectId(context, record.subjectId, '$.subjectId')
  expectStringArray(context, record.skillIds, '$.skillIds', {
    ids: true,
    unique: true,
    minimumLength: 1,
  })
  expectISODateTime(context, record.capturedAt, '$.capturedAt')

  if (!OBSERVATION_KEYS.some((key) => record[key] !== undefined)) {
    context.add({
      code: 'required',
      path: '$',
      message: 'Learning evidence requires at least one observation field.',
    })
  }

  if (record.accuracy !== undefined) {
    validateRatio(context, record.accuracy, '$.accuracy', {
      numeratorKey: 'correctCount',
      denominatorKey: 'attemptedCount',
      percentKey: 'accuracyPercent',
      extraKeys: ['scoringMethod'],
    })
    if (typeof record.accuracy === 'object' && record.accuracy !== null) {
      expectString(
        context,
        (record.accuracy as Record<string, unknown>).scoringMethod,
        '$.accuracy.scoringMethod',
        { minimumLength: 1, maximumLength: 200 },
      )
    }
  }
  if (record.completion !== undefined) {
    validateRatio(context, record.completion, '$.completion', {
      numeratorKey: 'completedCount',
      denominatorKey: 'assignedCount',
      percentKey: 'completionPercent',
    })
  }
  if (record.independence !== undefined) {
    const independence = expectRecord(context, record.independence, '$.independence', [
      'supportLevel',
      'source',
    ])
    if (independence) {
      expectString(context, independence.supportLevel, '$.independence.supportLevel', {
        allowed: ['independent', 'minimal-support', 'guided', 'full-support'],
      })
      expectString(context, independence.source, '$.independence.source', {
        allowed: OBSERVATION_SOURCES,
      })
    }
  }
  for (const key of ['confidence', 'effort', 'frustration'] as const) {
    if (record[key] !== undefined) validateSourcedRating(context, record[key], `$.${key}`)
  }

  if (record.hintUse !== undefined) {
    const hintUse = expectRecord(context, record.hintUse, '$.hintUse', [
      'offeredCount',
      'requestedCount',
      'acceptedCount',
      'kinds',
    ])
    if (hintUse) {
      const offeredValid = expectNumber(context, hintUse.offeredCount, '$.hintUse.offeredCount', {
        integer: true,
        minimum: 0,
      })
      const requestedValid = expectNumber(
        context,
        hintUse.requestedCount,
        '$.hintUse.requestedCount',
        { integer: true, minimum: 0 },
      )
      const acceptedValid = expectNumber(context, hintUse.acceptedCount, '$.hintUse.acceptedCount', {
        integer: true,
        minimum: 0,
      })
      expectStringArray(context, hintUse.kinds, '$.hintUse.kinds', {
        unique: true,
        allowed: ['prompt', 'visual', 'worked-step', 'definition', 'example'],
      })
      if (
        offeredValid &&
        requestedValid &&
        acceptedValid &&
        ((hintUse.requestedCount as number) > (hintUse.offeredCount as number) ||
          (hintUse.acceptedCount as number) > (hintUse.offeredCount as number))
      ) {
        context.add({
          code: 'invariant',
          path: '$.hintUse',
          message: 'Requested and accepted counts cannot exceed offeredCount.',
        })
      }
    }
  }

  if (record.tutorIntervention !== undefined) {
    const intervention = expectRecord(
      context,
      record.tutorIntervention,
      '$.tutorIntervention',
      ['count', 'kinds'],
    )
    if (intervention) {
      const countValid = expectNumber(context, intervention.count, '$.tutorIntervention.count', {
        integer: true,
        minimum: 0,
      })
      const kinds = expectStringArray(context, intervention.kinds, '$.tutorIntervention.kinds', {
        unique: true,
        allowed: [
          'clarification',
          'prompt',
          'worked-example',
          'reteaching',
          'redirection',
          'adult-escalation',
        ],
      })
      if (
        countValid &&
        (((intervention.count as number) === 0 && (kinds?.length ?? 0) > 0) ||
          ((intervention.count as number) > 0 && (kinds?.length ?? 0) === 0))
      ) {
        context.add({
          code: 'invariant',
          path: '$.tutorIntervention',
          message: 'Intervention kinds must be empty exactly when count is zero.',
        })
      }
    }
  }

  if (record.redirectionCount !== undefined) {
    expectNumber(context, record.redirectionCount, '$.redirectionCount', {
      integer: true,
      minimum: 0,
    })
  }

  if (record.responseLatency !== undefined) {
    const latency = expectRecord(context, record.responseLatency, '$.responseLatency', [
      'sampleCount',
      'medianMs',
      'p90Ms',
      'minimumMs',
      'maximumMs',
    ])
    if (latency) {
      const valuesValid = [
        expectNumber(context, latency.sampleCount, '$.responseLatency.sampleCount', {
          integer: true,
          minimum: 1,
        }),
        expectNumber(context, latency.medianMs, '$.responseLatency.medianMs', {
          integer: true,
          minimum: 0,
        }),
        expectNumber(context, latency.p90Ms, '$.responseLatency.p90Ms', {
          integer: true,
          minimum: 0,
        }),
        expectNumber(context, latency.minimumMs, '$.responseLatency.minimumMs', {
          integer: true,
          minimum: 0,
        }),
        expectNumber(context, latency.maximumMs, '$.responseLatency.maximumMs', {
          integer: true,
          minimum: 0,
        }),
      ].every(Boolean)
      if (
        valuesValid &&
        !(
          (latency.minimumMs as number) <= (latency.medianMs as number) &&
          (latency.medianMs as number) <= (latency.p90Ms as number) &&
          (latency.p90Ms as number) <= (latency.maximumMs as number)
        )
      ) {
        context.add({
          code: 'invariant',
          path: '$.responseLatency',
          message: 'Expected minimumMs <= medianMs <= p90Ms <= maximumMs.',
        })
      }
    }
  }

  if (record.randomResponseIndicators !== undefined) {
    const indicators = expectArray(
      context,
      record.randomResponseIndicators,
      '$.randomResponseIndicators',
      { maximumLength: 3 },
    )
    const kinds = new Set<string>()
    indicators?.forEach((entry, index) => {
      const path = indexPath('$.randomResponseIndicators', index)
      const indicator = expectRecord(context, entry, path, [
        'kind',
        'strength',
        'supportingEvidenceIds',
        'doesNotEstablishInattention',
      ])
      if (!indicator) return
      if (
        expectString(context, indicator.kind, propertyPath(path, 'kind'), {
          allowed: ['unusually-fast-series', 'repeating-choice-pattern', 'observer-concern'],
        })
      ) {
        const kind = indicator.kind as string
        if (kinds.has(kind)) {
          context.add({
            code: 'duplicate',
            path: propertyPath(path, 'kind'),
            message: `Duplicate indicator kind "${kind}".`,
          })
        }
        kinds.add(kind)
      }
      expectString(context, indicator.strength, propertyPath(path, 'strength'), {
        allowed: ['weak', 'moderate', 'strong'],
      })
      expectStringArray(
        context,
        indicator.supportingEvidenceIds,
        propertyPath(path, 'supportingEvidenceIds'),
        { ids: true, unique: true, minimumLength: 1 },
      )
      if (indicator.doesNotEstablishInattention !== true) {
        context.add({
          code: 'safety',
          path: propertyPath(path, 'doesNotEstablishInattention'),
          message: 'Random-response indicators must explicitly state that they do not establish inattention.',
        })
      } else {
        expectBoolean(
          context,
          indicator.doesNotEstablishInattention,
          propertyPath(path, 'doesNotEstablishInattention'),
        )
      }
    })
  }

  if (record.nextDayRecall !== undefined) {
    const recall = expectRecord(context, record.nextDayRecall, '$.nextDayRecall', [
      'attemptedOn',
      'intervalDays',
      'correctCount',
      'attemptedCount',
      'hintCount',
    ])
    if (recall) {
      expectISODate(context, recall.attemptedOn, '$.nextDayRecall.attemptedOn')
      if (recall.intervalDays !== 1) {
        context.add({
          code: 'literal',
          path: '$.nextDayRecall.intervalDays',
          message: 'Next-day recall requires intervalDays 1.',
        })
      }
      const correctValid = expectNumber(
        context,
        recall.correctCount,
        '$.nextDayRecall.correctCount',
        { integer: true, minimum: 0 },
      )
      const attemptedValid = expectNumber(
        context,
        recall.attemptedCount,
        '$.nextDayRecall.attemptedCount',
        { integer: true, minimum: 1 },
      )
      expectNumber(context, recall.hintCount, '$.nextDayRecall.hintCount', {
        integer: true,
        minimum: 0,
      })
      if (
        correctValid &&
        attemptedValid &&
        (recall.correctCount as number) > (recall.attemptedCount as number)
      ) {
        context.add({
          code: 'invariant',
          path: '$.nextDayRecall.correctCount',
          message: 'correctCount cannot exceed attemptedCount.',
        })
      }
    }
  }

  if (record.retention !== undefined) {
    const retention = expectRecord(context, record.retention, '$.retention', [
      'status',
      'basisEvidenceIds',
      'measuredAcrossDays',
    ])
    if (retention) {
      const statusValid = expectString(context, retention.status, '$.retention.status', {
        allowed: ['not-assessed', 'declining', 'stable', 'improving', 'retained'],
      })
      const basis = expectStringArray(
        context,
        retention.basisEvidenceIds,
        '$.retention.basisEvidenceIds',
        { ids: true, unique: true },
      )
      expectNumber(context, retention.measuredAcrossDays, '$.retention.measuredAcrossDays', {
        integer: true,
        minimum: 0,
      })
      if (statusValid && retention.status !== 'not-assessed' && (basis?.length ?? 0) < 2) {
        context.add({
          code: 'invariant',
          path: '$.retention.basisEvidenceIds',
          message: 'A retention outcome requires at least two evidence references.',
        })
      }
    }
  }

  if (record.masteryOutcome !== undefined) {
    const mastery = expectRecord(context, record.masteryOutcome, '$.masteryOutcome', [
      'status',
      'criterionId',
      'algorithmVersion',
      'basisEvidenceIds',
    ])
    if (mastery) {
      const statusValid = expectString(context, mastery.status, '$.masteryOutcome.status', {
        allowed: [
          'not-assessed',
          'not-yet-demonstrated',
          'progressing',
          'demonstrated',
          'retained',
          'insufficient-evidence',
        ],
      })
      if (mastery.criterionId !== undefined) {
        expectId(context, mastery.criterionId, '$.masteryOutcome.criterionId')
      }
      if (mastery.algorithmVersion !== undefined) {
        expectString(context, mastery.algorithmVersion, '$.masteryOutcome.algorithmVersion', {
          minimumLength: 1,
          maximumLength: 100,
        })
      }
      const basis = expectStringArray(
        context,
        mastery.basisEvidenceIds,
        '$.masteryOutcome.basisEvidenceIds',
        { ids: true, unique: true },
      )
      if (
        statusValid &&
        ['not-yet-demonstrated', 'progressing', 'demonstrated', 'retained'].includes(
          mastery.status as string,
        ) &&
        (basis?.length ?? 0) === 0
      ) {
        context.add({
          code: 'invariant',
          path: '$.masteryOutcome.basisEvidenceIds',
          message: 'This mastery outcome requires supporting evidence.',
        })
      }
    }
  }

  if (record.prerequisiteGapOutcome !== undefined) {
    const gap = expectRecord(
      context,
      record.prerequisiteGapOutcome,
      '$.prerequisiteGapOutcome',
      ['status', 'prerequisiteSkillIds', 'basisEvidenceIds', 'nextAction'],
    )
    if (gap) {
      const statusValid = expectString(
        context,
        gap.status,
        '$.prerequisiteGapOutcome.status',
        { allowed: ['none-observed', 'suspected', 'confirmed', 'insufficient-evidence'] },
      )
      const skills = expectStringArray(
        context,
        gap.prerequisiteSkillIds,
        '$.prerequisiteGapOutcome.prerequisiteSkillIds',
        { ids: true, unique: true },
      )
      const basis = expectStringArray(
        context,
        gap.basisEvidenceIds,
        '$.prerequisiteGapOutcome.basisEvidenceIds',
        { ids: true, unique: true },
      )
      expectString(context, gap.nextAction, '$.prerequisiteGapOutcome.nextAction', {
        allowed: ['none', 'collect-more-evidence', 'remediate', 'adult-review'],
      })
      if (
        statusValid &&
        gap.status === 'confirmed' &&
        ((skills?.length ?? 0) === 0 || (basis?.length ?? 0) < 2)
      ) {
        context.add({
          code: 'invariant',
          path: '$.prerequisiteGapOutcome',
          message: 'A confirmed gap requires a prerequisite skill and multiple evidence references.',
        })
      }
      if (
        statusValid &&
        gap.status === 'suspected' &&
        ((skills?.length ?? 0) === 0 || (basis?.length ?? 0) === 0)
      ) {
        context.add({
          code: 'invariant',
          path: '$.prerequisiteGapOutcome',
          message: 'A suspected gap requires a prerequisite skill and supporting evidence.',
        })
      }
    }
  }

  if (record.engagementSupport !== undefined) {
    const support = expectRecord(context, record.engagementSupport, '$.engagementSupport', [
      'status',
      'supportingSignals',
      'wording',
    ])
    if (support) {
      const statusValid = expectString(context, support.status, '$.engagementSupport.status', {
        allowed: ['no-concern', 'support-may-help', 'insufficient-evidence'],
      })
      const signals = expectStringArray(
        context,
        support.supportingSignals,
        '$.engagementSupport.supportingSignals',
        { unique: true, allowed: engagementSignals },
      )
      expectString(context, support.wording, '$.engagementSupport.wording', {
        allowed: ['contextual-and-revisable'],
      })
      if (
        statusValid &&
        support.status === 'support-may-help' &&
        (signals?.length === 0 || signals?.every((signal) => signal === 'accuracy'))
      ) {
        context.add({
          code: 'safety',
          path: '$.engagementSupport.supportingSignals',
          message: 'Accuracy alone cannot justify an engagement-support concern.',
        })
      }
    }
  }

  return context.issues.length === 0
}

export const learningEvidenceSchema = defineRuntimeSchema<LearningEvidence>({
  schemaId: 'learning-evidence',
  kind: 'learning-evidence',
  jsonSchema: learningEvidenceJsonSchema,
  validateValue: validateLearningEvidenceValue,
})

export const validateLearningEvidence = learningEvidenceSchema.validate
export const parseLearningEvidence = learningEvidenceSchema.parse
export const isLearningEvidence = learningEvidenceSchema.is

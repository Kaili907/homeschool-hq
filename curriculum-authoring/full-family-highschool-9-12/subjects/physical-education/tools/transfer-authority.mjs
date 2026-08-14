import { createHash } from 'node:crypto'

/**
 * Canonical authority for every high-school PE transfer lesson. The normalized
 * requirements are prose-independent, while sourceFieldBindings bind the
 * actual learner/adult authored fields so wording cannot contradict them.
 */

export const TRANSFER_AUTHORITY_SCHEMA = 'manuel-academy.pe-transfer-authority.v3'

export const SOURCE_LEARNER_SEMANTIC_FIELDS = [
  'focus',
  'transfer_condition',
  'transfer_evidence_requirement',
  'student_activity',
  'formative_check',
]

export const SOURCE_ADULT_SEMANTIC_FIELDS = [
  'success_criteria',
  'answer_or_scoring_guidance',
  'adaptive_tutor_routes',
  'guardian_safety',
  'safety_and_privacy',
]

export function semanticDigest(value) {
  const serialized = JSON.stringify(value)
  return createHash('sha256').update(serialized === undefined ? 'undefined' : serialized).digest('hex')
}

export function bindSourceSemanticFields(record, lesson) {
  return {
    ...record,
    sourceFieldBindings: {
      algorithm: 'SHA-256',
      learnerFields: Object.fromEntries(SOURCE_LEARNER_SEMANTIC_FIELDS.map((field) => [field, semanticDigest(lesson[field])])),
      adultFields: Object.fromEntries(SOURCE_ADULT_SEMANTIC_FIELDS.map((field) => [field, semanticDigest(lesson[field])])),
    },
  }
}

const SPAN_BY_UNIT = {
  '9:1': ['SESSION', 1],
  '9:2': ['DECISION_SEQUENCE', 1],
  '9:3': ['SCORE_STATE_SEQUENCE', 1],
  '9:4': ['DAY', 7],
  '9:5': ['COMPLETE_SEQUENCE', 1],
  '9:6': ['TRIAL', 1],
  '9:7': ['ROUTE_SCENARIO', 1],
  '9:8': ['INCLUSION_SCENARIO', 1],
  '9:9': ['PORTFOLIO_DEFENSE', 1],
  '10:1': ['SESSION', 1],
  '10:2': ['ADAPTIVE_ACTIVITY', 1],
  '10:3': ['COMPLETE_CONTEST', 1],
  '10:4': ['PROGRAM_CYCLE', 1],
  '10:5': ['DAY', 7],
  '10:6': ['ACCESS_REDESIGN', 1],
  '10:7': ['SESSION', 2],
  '10:8': ['LEADERSHIP_SEGMENT', 1],
  '10:9': ['PORTFOLIO_DEFENSE', 1],
  '11:1': ['PROGRAM_CYCLE', 1],
  '11:2': ['PRACTICE_BLOCK', 1],
  '11:3': ['CONCURRENT_PRACTICE_BLOCK', 1],
  '11:4': ['CONSTRAINT_PRACTICE', 1],
  '11:5': ['SESSION', 2],
  '11:6': ['OUTING_SCENARIO', 1],
  '11:7': ['INCLUSIVE_SESSION', 1],
  '11:8': ['TERM_STRETCH', 1],
  '11:9': ['PORTFOLIO_DEFENSE', 1],
  '12:1': ['TRANSITION_SCENARIO', 1],
  '12:2': ['TRAINING_CYCLE', 1],
  '12:3': ['BUDGET_SCENARIO', 1],
  '12:4': ['CHALLENGE_ATTEMPT', 1],
  '12:5': ['SESSION', 1],
  '12:6': ['LIFE_STAGE_SCENARIO', 3],
  '12:7': ['INCLUSIVE_SESSION', 1],
  '12:8': ['TRAINING_BLOCK', 1],
  '12:9': ['PLAN_DEFENSE_AND_REVISION', 1],
}

const COMPLETE_ROUTE_SET = [
  'PERFORMED',
  'ADAPTED_PERFORMANCE',
  'SOLO_SIMULATION',
  'DIAGRAMMED_MODEL',
  'WRITTEN_OR_DESCRIBED_MODEL',
]

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

export function buildTransferAuthorityRecord(course, unit, unitNumber, lessonId, focus) {
  const [spanUnit, minimum] = SPAN_BY_UNIT[`${course.grade}:${unitNumber}`]
  const authorityId = `${course.courseId}-u${String(unitNumber).padStart(2, '0')}-transfer-v3`
  const evidenceIds = uniqueSorted([
    `${authorityId}:condition`,
    `${lessonId}:focus-action`,
    'BREAKDOWN_ANALYSIS',
    'EARLIER_OCCASION_COMPARISON',
    ...(unit.secondPassEvidence ? ['AUTHORED_UNIT_EVIDENCE'] : []),
    ...(course.grade === 9 && unitNumber === 5 ? ['INTERRUPTION_RECOVERY'] : []),
  ])

  return {
    schemaVersion: TRANSFER_AUTHORITY_SCHEMA,
    authorityId,
    learnerTask: {
      actionId: `${lessonId}:focus-action`,
      actionKind: 'APPLY_OR_FULLY_MODEL',
      focusId: `${course.courseId}-u${String(unitNumber).padStart(2, '0')}:${focus}`,
      executionRequired: false,
    },
    durationContinuity: {
      span: { unit: spanUnit, minimum, coverage: 'COMPLETE_REQUIRED_SPAN' },
      uninterruptedPerformanceRequired: false,
      interruptionRecoveryRequired: evidenceIds.includes('INTERRUPTION_RECOVERY'),
    },
    restInterruptionAllowance: {
      restAllowed: true,
      restPreservesParticipationCredit: true,
      transferCreditAfterRest: 'PRESERVED_WHEN_REQUIRED_EVIDENCE_IS_MET',
    },
    transferRequirement: {
      required: true,
      conditionId: `${authorityId}:condition`,
    },
    completionEvidence: {
      completionKind: 'PERFORM_OR_FULLY_MODEL_COMPLETE_SPAN',
      hypotheticalCompletionAllowed: true,
      requiredEvidenceIds: evidenceIds,
      maximumCreditableSpan: { unit: spanUnit, maximum: minimum },
    },
    equalCreditPath: {
      routes: COMPLETE_ROUTE_SET,
      sameEvidenceRequired: true,
      requiredEvidenceIds: evidenceIds,
    },
    adultRubric: {
      scoringAuthority: 'RUBRIC',
      requiredEvidenceIds: evidenceIds,
      bodyMetricsScored: false,
      participantCountScored: false,
    },
    adaptiveRouteExpectations: {
      safeReductionPreservesParticipationCredit: true,
      alternateRouteCanEarnTransferCredit: true,
      alternateRouteMustPreserveEvidence: true,
      guardianSafetyBoundaryRetained: true,
    },
    sourceFieldBindings: null,
  }
}

export function validateTransferAuthorityRecord(record) {
  const errors = []
  if (!record || typeof record !== 'object') return ['structured transfer authority is missing']
  if (record.schemaVersion !== TRANSFER_AUTHORITY_SCHEMA) errors.push('unsupported transfer-authority schema')
  if (typeof record.authorityId !== 'string' || !record.authorityId) errors.push('authorityId is missing')
  if (!record.learnerTask?.actionId || record.learnerTask?.actionKind !== 'APPLY_OR_FULLY_MODEL' || !record.learnerTask?.focusId || typeof record.learnerTask?.executionRequired !== 'boolean') errors.push('learner task/action is invalid')
  if (!record.durationContinuity?.span?.unit || !Number.isInteger(record.durationContinuity?.span?.minimum) || record.durationContinuity.span.minimum < 1 || record.durationContinuity?.span?.coverage !== 'COMPLETE_REQUIRED_SPAN' || typeof record.durationContinuity?.uninterruptedPerformanceRequired !== 'boolean' || typeof record.durationContinuity?.interruptionRecoveryRequired !== 'boolean') errors.push('duration/span requirement is invalid')
  if (record.durationContinuity?.uninterruptedPerformanceRequired && record.restInterruptionAllowance?.restPreservesParticipationCredit) errors.push('uninterrupted performance contradicts rest-credit authority')
  if (record.restInterruptionAllowance?.restAllowed !== true || typeof record.restInterruptionAllowance?.restPreservesParticipationCredit !== 'boolean' || !record.restInterruptionAllowance?.transferCreditAfterRest) errors.push('stop/rest authority is not retained')
  if (record.transferRequirement?.required !== true || !record.transferRequirement?.conditionId) errors.push('transfer requirement is invalid')
  if (record.completionEvidence?.completionKind !== 'PERFORM_OR_FULLY_MODEL_COMPLETE_SPAN' || !Array.isArray(record.completionEvidence?.requiredEvidenceIds) || record.completionEvidence.requiredEvidenceIds.length < 3 || typeof record.completionEvidence?.hypotheticalCompletionAllowed !== 'boolean') errors.push('completion evidence is incomplete')
  if (record.completionEvidence?.maximumCreditableSpan?.unit !== record.durationContinuity?.span?.unit || record.completionEvidence?.maximumCreditableSpan?.maximum < record.durationContinuity?.span?.minimum) errors.push('completion path does not cover the required duration/span')
  if (!Array.isArray(record.equalCreditPath?.routes) || record.equalCreditPath.routes.length === 0 || !Array.isArray(record.equalCreditPath?.requiredEvidenceIds) || record.equalCreditPath.requiredEvidenceIds.length === 0 || record.equalCreditPath?.sameEvidenceRequired !== true || JSON.stringify(record.equalCreditPath?.requiredEvidenceIds) !== JSON.stringify(record.completionEvidence?.requiredEvidenceIds)) errors.push('equal-credit evidence differs from completion evidence')
  if (record.adultRubric?.scoringAuthority !== 'RUBRIC' || !Array.isArray(record.adultRubric?.requiredEvidenceIds) || record.adultRubric.requiredEvidenceIds.length === 0 || JSON.stringify(record.adultRubric?.requiredEvidenceIds) !== JSON.stringify(record.completionEvidence?.requiredEvidenceIds)) errors.push('adult rubric evidence differs from completion evidence')
  if (record.adultRubric?.bodyMetricsScored !== false || record.adultRubric?.participantCountScored !== false) errors.push('body metrics and participant count may not be scored')
  if (typeof record.adaptiveRouteExpectations?.safeReductionPreservesParticipationCredit !== 'boolean' || typeof record.adaptiveRouteExpectations?.alternateRouteCanEarnTransferCredit !== 'boolean' || record.adaptiveRouteExpectations?.alternateRouteMustPreserveEvidence !== true || record.adaptiveRouteExpectations?.guardianSafetyBoundaryRetained !== true) errors.push('adaptive-route authority is incomplete')
  if (record.sourceFieldBindings?.algorithm !== 'SHA-256') errors.push('source semantic field binding algorithm is invalid')
  for (const [channel, fields] of [['learnerFields', SOURCE_LEARNER_SEMANTIC_FIELDS], ['adultFields', SOURCE_ADULT_SEMANTIC_FIELDS]]) {
    const bindings = record.sourceFieldBindings?.[channel]
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings) || Object.keys(bindings).sort().join('|') !== [...fields].sort().join('|') || Object.values(bindings).some((digest) => !/^[a-f0-9]{64}$/.test(digest))) errors.push(`source ${channel} semantic field bindings are invalid`)
  }
  return errors
}

export function validateSourceSemanticBindings(record, lesson) {
  const errors = []
  for (const [channel, fields] of [['learnerFields', SOURCE_LEARNER_SEMANTIC_FIELDS], ['adultFields', SOURCE_ADULT_SEMANTIC_FIELDS]]) {
    for (const field of fields) {
      if (record?.sourceFieldBindings?.[channel]?.[field] !== semanticDigest(lesson?.[field])) errors.push(`${channel}.${field} is not bound to the canonical authored field`)
    }
  }
  return errors
}

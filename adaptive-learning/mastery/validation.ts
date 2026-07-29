import {
  CONFIDENCE_LEVELS,
  MASTERY_REASON_CODES,
  MASTERY_SCHEMA_VERSION,
  MASTERY_STATES,
  type ConfidenceAssessment,
  type IndependentDemonstrationEvidence,
  type ManualMasteryOverride,
  type MasteryEvidence,
  type MasteryNextAction,
  type OverrideActor,
  type OverrideAuditEntry,
  type PrerequisiteStatus,
  type StudentSkillMastery,
} from './contracts.ts'
import { validateSkillGraph } from './graph.ts'
import { isStableId } from './ids.ts'
import {
  MasteryValidationError,
  isFiniteNumberInRange,
  isIsoDateTime,
  isNonEmptyString,
  isNonNegativeInteger,
  isOneOf,
  isPositiveInteger,
  isRecord,
  validationFailure,
  validationSuccess,
  type ValidationIssue,
  type ValidationResult,
} from './validation-types.ts'

const EVIDENCE_QUALITIES = [
  'reliable',
  'limited',
  'conflicting',
  'invalidated',
] as const

const SUPPORT_LEVELS = [
  'independent',
  'minimal_support',
  'guided',
  'full_support',
] as const

const NEXT_ACTION_KINDS = [
  'collect_initial_evidence',
  'continue_adaptive_instruction',
  'reteach_prerequisite',
  'schedule_reinforcement',
  'collect_independent_demonstration',
  'maintain_with_spaced_review',
  'resolve_conflicting_evidence',
  'adult_review',
] as const

const CONFIDENCE_FACTOR_CODES = [
  'evidence_volume',
  'independent_samples',
  'distinct_days',
  'recent_evidence',
  'consistent_results',
  'conflicting_results',
  'limited_quality',
  'invalidated_evidence_excluded',
  'no_independent_evidence',
] as const

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  path: string,
  issues: ValidationIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      issues.push({
        path: `${path}.${key}`,
        code: 'unknown_property',
        message: `Property "${key}" is not allowed at this mastery boundary.`,
      })
    }
  }
}

function pushStableIdIssue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isStableId(value)) {
    issues.push({
      path,
      code: 'invalid_stable_id',
      message:
        'Expected a canonical 1-128 character opaque identifier with no whitespace.',
    })
  }
}

function pushDateTimeIssue(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  if (!isIsoDateTime(value)) {
    issues.push({
      path,
      code: 'invalid_datetime',
      message: 'Expected an RFC 3339 date-time with an explicit offset.',
    })
  }
}

function validateEvidenceBase(
  value: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  if (value.schemaVersion !== MASTERY_SCHEMA_VERSION) {
    issues.push({
      path: '$.schemaVersion',
      code: 'unsupported_schema_version',
      message: `Only mastery schema version ${MASTERY_SCHEMA_VERSION} is supported.`,
    })
  }
  pushStableIdIssue(value.id, '$.id', issues)
  pushStableIdIssue(value.studentId, '$.studentId', issues)
  pushStableIdIssue(value.skillId, '$.skillId', issues)
  pushDateTimeIssue(value.capturedAt, '$.capturedAt', issues)
  if (!isStableId(value.sourceRef)) {
    issues.push({
      path: '$.sourceRef',
      code: 'invalid_source_reference',
      message:
        'sourceRef must be a canonical opaque ID; free text, answers, and transcripts are forbidden.',
    })
  }
  if (!isOneOf(value.quality, EVIDENCE_QUALITIES)) {
    issues.push({
      path: '$.quality',
      code: 'invalid_enum',
      message: `Evidence quality must be one of: ${EVIDENCE_QUALITIES.join(', ')}.`,
    })
  }
}

function validateAssessmentEvidence(
  value: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  pushStableIdIssue(value.attemptId, '$.attemptId', issues)
  if (
    !isOneOf(value.assessmentType, [
      'diagnostic',
      'formative',
      'retrieval',
      'summative',
    ] as const)
  ) {
    issues.push({
      path: '$.assessmentType',
      code: 'invalid_enum',
      message: 'Unsupported assessment type.',
    })
  }
  if (
    !isOneOf(value.scoringStatus, [
      'scored',
      'partially_scored',
      'unscored',
    ] as const)
  ) {
    issues.push({
      path: '$.scoringStatus',
      code: 'invalid_enum',
      message: 'Unsupported scoring status.',
    })
  }
  if (!isPositiveInteger(value.attemptedItemCount)) {
    issues.push({
      path: '$.attemptedItemCount',
      code: 'invalid_count',
      message: 'An assessment attempt must contain at least one attempted item.',
    })
  }
  if (!isOneOf(value.supportLevel, SUPPORT_LEVELS)) {
    issues.push({
      path: '$.supportLevel',
      code: 'invalid_enum',
      message: 'Unsupported assessment support level.',
    })
  }

  if (value.scoringStatus === 'unscored') {
    if (value.correctItemCount !== undefined) {
      issues.push({
        path: '$.correctItemCount',
        code: 'unscored_has_correct_count',
        message: 'Unscored assessment evidence cannot claim a correct count.',
      })
    }
  } else {
    if (!isNonNegativeInteger(value.correctItemCount)) {
      issues.push({
        path: '$.correctItemCount',
        code: 'invalid_count',
        message: 'Scored assessment evidence requires a non-negative correct count.',
      })
    } else if (
      isPositiveInteger(value.attemptedItemCount) &&
      value.correctItemCount > value.attemptedItemCount
    ) {
      issues.push({
        path: '$.correctItemCount',
        code: 'count_exceeds_attempts',
        message: 'Correct count cannot exceed attempted item count.',
      })
    }
  }
}

function validateTutorEvidence(
  value: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  pushStableIdIssue(value.interventionId, '$.interventionId', issues)
  if (
    !isOneOf(value.interventionType, [
      'clarification',
      'prompt',
      'hint',
      'worked_example',
      'reteach',
      'redirection',
      'adult_escalation',
    ] as const)
  ) {
    issues.push({
      path: '$.interventionType',
      code: 'invalid_enum',
      message: 'Unsupported tutor intervention type.',
    })
  }
  if (
    !isOneOf(value.supportLevel, [
      'minimal_support',
      'guided',
      'full_support',
    ] as const)
  ) {
    issues.push({
      path: '$.supportLevel',
      code: 'tutor_cannot_be_independent',
      message: 'Tutor intervention evidence cannot claim independent support.',
    })
  }
  if (
    !isOneOf(value.outcome, [
      'resolved_with_support',
      'not_resolved',
      'inconclusive',
    ] as const)
  ) {
    issues.push({
      path: '$.outcome',
      code: 'invalid_enum',
      message: 'Unsupported tutor intervention outcome.',
    })
  }
}

function validateIndependentEvidence(
  value: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  pushStableIdIssue(value.demonstrationId, '$.demonstrationId', issues)
  if (
    !isOneOf(value.context, [
      'assessment',
      'retrieval',
      'authentic_task',
    ] as const)
  ) {
    issues.push({
      path: '$.context',
      code: 'invalid_enum',
      message: 'Unsupported independent-demonstration context.',
    })
  }
  if (value.supportLevel !== 'independent') {
    issues.push({
      path: '$.supportLevel',
      code: 'independent_support_required',
      message:
        'Independent-demonstration evidence must explicitly use independent support level.',
    })
  }
  if (!isPositiveInteger(value.attemptedItemCount)) {
    issues.push({
      path: '$.attemptedItemCount',
      code: 'invalid_count',
      message: 'Independent evidence requires at least one attempted item.',
    })
  }
  if (!isNonNegativeInteger(value.correctItemCount)) {
    issues.push({
      path: '$.correctItemCount',
      code: 'invalid_count',
      message: 'Independent evidence requires a non-negative correct count.',
    })
  } else if (
    isPositiveInteger(value.attemptedItemCount) &&
    value.correctItemCount > value.attemptedItemCount
  ) {
    issues.push({
      path: '$.correctItemCount',
      code: 'count_exceeds_attempts',
      message: 'Correct count cannot exceed attempted item count.',
    })
  }
  if (!isRecord(value.criterion)) {
    issues.push({
      path: '$.criterion',
      code: 'invalid_type',
      message: 'Independent evidence requires a demonstration criterion.',
    })
  } else {
    rejectUnknownKeys(
      value.criterion,
      new Set(['criterionId', 'minimumAccuracy', 'minimumItemCount']),
      '$.criterion',
      issues,
    )
    if (!isStableId(value.criterion.criterionId)) {
      issues.push({
        path: '$.criterion.criterionId',
        code: 'invalid_stable_id',
        message: 'Criterion ID must be stable and opaque.',
      })
    }
    if (
      !isFiniteNumberInRange(value.criterion.minimumAccuracy, 0, 1)
    ) {
      issues.push({
        path: '$.criterion.minimumAccuracy',
        code: 'invalid_ratio',
        message: 'Minimum accuracy must be between 0 and 1.',
      })
    }
    if (!isPositiveInteger(value.criterion.minimumItemCount)) {
      issues.push({
        path: '$.criterion.minimumItemCount',
        code: 'invalid_count',
        message: 'Minimum item count must be a positive integer.',
      })
    }
  }
  if (
    !isOneOf(value.outcome, [
      'successful',
      'unsuccessful',
      'inconclusive',
    ] as const)
  ) {
    issues.push({
      path: '$.outcome',
      code: 'invalid_enum',
      message: 'Unsupported independent-demonstration outcome.',
    })
  }
  if (
    !isOneOf(value.taskNovelty, [
      'new_items',
      'transfer',
      'familiar_items',
    ] as const)
  ) {
    issues.push({
      path: '$.taskNovelty',
      code: 'invalid_enum',
      message: 'Unsupported task novelty.',
    })
  }
  if (!Array.isArray(value.sourceEvidenceIds)) {
    issues.push({
      path: '$.sourceEvidenceIds',
      code: 'invalid_type',
      message: 'sourceEvidenceIds must be an array.',
    })
  } else {
    const seen = new Set<string>()
    value.sourceEvidenceIds.forEach((id, index) => {
      if (!isStableId(id)) {
        issues.push({
          path: `$.sourceEvidenceIds[${index}]`,
          code: 'invalid_stable_id',
          message: 'Source evidence reference must be a stable opaque ID.',
        })
      } else if (seen.has(id)) {
        issues.push({
          path: `$.sourceEvidenceIds[${index}]`,
          code: 'duplicate_reference',
          message: 'Source evidence references must be unique.',
        })
      }
      if (typeof id === 'string') seen.add(id)
    })
  }

  if (
    isPositiveInteger(value.attemptedItemCount) &&
    isNonNegativeInteger(value.correctItemCount) &&
    isRecord(value.criterion) &&
    isFiniteNumberInRange(value.criterion.minimumAccuracy, 0, 1) &&
    isPositiveInteger(value.criterion.minimumItemCount)
  ) {
    const met =
      value.attemptedItemCount >= value.criterion.minimumItemCount &&
      value.correctItemCount / value.attemptedItemCount >=
        value.criterion.minimumAccuracy
    if (value.outcome === 'successful' && !met) {
      issues.push({
        path: '$.outcome',
        code: 'criterion_not_met',
        message:
          'A successful independent demonstration must meet its recorded criterion.',
      })
    }
    if (value.outcome === 'unsuccessful' && met) {
      issues.push({
        path: '$.outcome',
        code: 'criterion_result_mismatch',
        message:
          'An unsuccessful independent demonstration cannot meet its recorded criterion.',
      })
    }
  }
}

export function validateMasteryEvidence(
  value: unknown,
): ValidationResult<MasteryEvidence> {
  if (!isRecord(value)) {
    return validationFailure([
      {
        path: '$',
        code: 'invalid_type',
        message: 'Mastery evidence must be an object.',
      },
    ])
  }
  const issues: ValidationIssue[] = []
  validateEvidenceBase(value, issues)

  switch (value.kind) {
    case 'assessment_attempt':
      rejectUnknownKeys(
        value,
        new Set([
          'kind',
          'schemaVersion',
          'id',
          'studentId',
          'skillId',
          'capturedAt',
          'sourceRef',
          'quality',
          'attemptId',
          'assessmentType',
          'scoringStatus',
          'attemptedItemCount',
          'correctItemCount',
          'supportLevel',
        ]),
        '$',
        issues,
      )
      validateAssessmentEvidence(value, issues)
      break
    case 'tutor_intervention':
      rejectUnknownKeys(
        value,
        new Set([
          'kind',
          'schemaVersion',
          'id',
          'studentId',
          'skillId',
          'capturedAt',
          'sourceRef',
          'quality',
          'interventionId',
          'interventionType',
          'supportLevel',
          'outcome',
        ]),
        '$',
        issues,
      )
      validateTutorEvidence(value, issues)
      break
    case 'independent_demonstration':
      rejectUnknownKeys(
        value,
        new Set([
          'kind',
          'schemaVersion',
          'id',
          'studentId',
          'skillId',
          'capturedAt',
          'sourceRef',
          'quality',
          'demonstrationId',
          'context',
          'supportLevel',
          'attemptedItemCount',
          'correctItemCount',
          'criterion',
          'outcome',
          'taskNovelty',
          'sourceEvidenceIds',
        ]),
        '$',
        issues,
      )
      validateIndependentEvidence(value, issues)
      break
    default:
      issues.push({
        path: '$.kind',
        code: 'unknown_evidence_kind',
        message:
          'Evidence kind must be assessment_attempt, tutor_intervention, or independent_demonstration.',
      })
  }

  return issues.length > 0
    ? validationFailure(issues)
    : validationSuccess(value as unknown as MasteryEvidence)
}

function validateOverrideActor(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is OverrideActor {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Override actor must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set(['role', 'actorId']),
    path,
    issues,
  )
  if (value.role !== 'parent' && value.role !== 'teacher') {
    issues.push({
      path: `${path}.role`,
      code: 'invalid_actor_role',
      message: 'A manual override actor must be a parent or teacher.',
    })
  }
  if (!isStableId(value.actorId)) {
    issues.push({
      path: `${path}.actorId`,
      code: 'invalid_stable_id',
      message: 'Actor ID must be stable and opaque.',
    })
  }
  return true
}

export function validateManualMasteryOverride(
  value: unknown,
): ValidationResult<ManualMasteryOverride> {
  if (!isRecord(value)) {
    return validationFailure([
      {
        path: '$',
        code: 'invalid_type',
        message: 'Manual mastery override must be an object.',
      },
    ])
  }
  const issues: ValidationIssue[] = []
  rejectUnknownKeys(
    value,
    new Set([
      'kind',
      'schemaVersion',
      'id',
      'studentId',
      'skillId',
      'state',
      'reason',
      'actor',
      'createdAt',
      'expiresAt',
    ]),
    '$',
    issues,
  )
  if (value.kind !== 'manual_mastery_override') {
    issues.push({
      path: '$.kind',
      code: 'invalid_discriminant',
      message: 'Override kind must be "manual_mastery_override".',
    })
  }
  if (value.schemaVersion !== MASTERY_SCHEMA_VERSION) {
    issues.push({
      path: '$.schemaVersion',
      code: 'unsupported_schema_version',
      message: `Only mastery schema version ${MASTERY_SCHEMA_VERSION} is supported.`,
    })
  }
  pushStableIdIssue(value.id, '$.id', issues)
  pushStableIdIssue(value.studentId, '$.studentId', issues)
  pushStableIdIssue(value.skillId, '$.skillId', issues)
  if (!isOneOf(value.state, MASTERY_STATES)) {
    issues.push({
      path: '$.state',
      code: 'invalid_enum',
      message: 'Override state is not supported.',
    })
  }
  if (!isNonEmptyString(value.reason, 500)) {
    issues.push({
      path: '$.reason',
      code: 'invalid_reason',
      message: 'Override reason must contain 1-500 characters.',
    })
  }
  validateOverrideActor(value.actor, '$.actor', issues)
  pushDateTimeIssue(value.createdAt, '$.createdAt', issues)
  if (value.expiresAt !== undefined) {
    pushDateTimeIssue(value.expiresAt, '$.expiresAt', issues)
    if (
      isIsoDateTime(value.createdAt) &&
      isIsoDateTime(value.expiresAt) &&
      Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
    ) {
      issues.push({
        path: '$.expiresAt',
        code: 'invalid_expiration',
        message: 'Override expiration must be later than its creation time.',
      })
    }
  }

  return issues.length > 0
    ? validationFailure(issues)
    : validationSuccess(value as unknown as ManualMasteryOverride)
}

function validateConfidence(
  value: unknown,
  evidenceIds: ReadonlySet<string>,
  issues: ValidationIssue[],
): value is ConfidenceAssessment {
  const path = '$.confidence'
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Confidence assessment must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set([
      'score',
      'level',
      'assessedAt',
      'algorithmVersion',
      'basisEvidenceIds',
      'factors',
    ]),
    path,
    issues,
  )
  if (!isFiniteNumberInRange(value.score, 0, 1)) {
    issues.push({
      path: `${path}.score`,
      code: 'invalid_ratio',
      message: 'Confidence score must be between 0 and 1.',
    })
  }
  if (!isOneOf(value.level, CONFIDENCE_LEVELS)) {
    issues.push({
      path: `${path}.level`,
      code: 'invalid_enum',
      message: 'Unsupported confidence level.',
    })
  } else if (isFiniteNumberInRange(value.score, 0, 1)) {
    const expected =
      value.score < 0.25
        ? 'very_low'
        : value.score < 0.5
          ? 'low'
          : value.score < 0.75
            ? 'moderate'
            : 'high'
    if (value.level !== expected) {
      issues.push({
        path: `${path}.level`,
        code: 'confidence_level_mismatch',
        message: `Confidence score ${value.score} maps to "${expected}".`,
      })
    }
  }
  pushDateTimeIssue(value.assessedAt, `${path}.assessedAt`, issues)
  if (!isStableId(value.algorithmVersion)) {
    issues.push({
      path: `${path}.algorithmVersion`,
      code: 'invalid_stable_id',
      message: 'Confidence algorithm version must be a stable identifier.',
    })
  }
  if (!Array.isArray(value.basisEvidenceIds)) {
    issues.push({
      path: `${path}.basisEvidenceIds`,
      code: 'invalid_type',
      message: 'Confidence basis evidence IDs must be an array.',
    })
  } else {
    const seenBasisIds = new Set<string>()
    value.basisEvidenceIds.forEach((id, index) => {
      if (!isStableId(id) || !evidenceIds.has(id)) {
        issues.push({
          path: `${path}.basisEvidenceIds[${index}]`,
          code: 'missing_evidence_reference',
          message: 'Confidence basis must reference evidence on this record.',
        })
      } else if (seenBasisIds.has(id)) {
        issues.push({
          path: `${path}.basisEvidenceIds[${index}]`,
          code: 'duplicate_reference',
          message: 'Confidence basis evidence references must be unique.',
        })
      }
      if (typeof id === 'string') seenBasisIds.add(id)
    })
  }
  if (!Array.isArray(value.factors)) {
    issues.push({
      path: `${path}.factors`,
      code: 'invalid_type',
      message: 'Confidence factors must be an array.',
    })
  } else {
    value.factors.forEach((factor, index) => {
      if (isRecord(factor)) {
        rejectUnknownKeys(
          factor,
          new Set(['code', 'effect', 'explanation']),
          `${path}.factors[${index}]`,
          issues,
        )
      }
      if (
        !isRecord(factor) ||
        !isOneOf(factor.code, CONFIDENCE_FACTOR_CODES) ||
        !isOneOf(factor.effect, ['raises', 'lowers', 'neutral'] as const) ||
        !isNonEmptyString(factor.explanation, 500)
      ) {
        issues.push({
          path: `${path}.factors[${index}]`,
          code: 'invalid_confidence_factor',
          message: 'Confidence factor is malformed.',
        })
      }
    })
  }
  return true
}

function validatePrerequisiteStatus(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): value is PrerequisiteStatus {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Prerequisite status must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set(['skillId', 'state', 'satisfied', 'recordRevision']),
    path,
    issues,
  )
  pushStableIdIssue(value.skillId, `${path}.skillId`, issues)
  if (
    value.state !== 'missing_record' &&
    !isOneOf(value.state, MASTERY_STATES)
  ) {
    issues.push({
      path: `${path}.state`,
      code: 'invalid_enum',
      message: 'Prerequisite state is not supported.',
    })
  }
  if (typeof value.satisfied !== 'boolean') {
    issues.push({
      path: `${path}.satisfied`,
      code: 'invalid_type',
      message: 'Prerequisite satisfied must be boolean.',
    })
  } else if (
    value.satisfied !== (value.state === 'mastered')
  ) {
    issues.push({
      path: `${path}.satisfied`,
      code: 'prerequisite_satisfaction_mismatch',
      message: 'Only a mastered prerequisite record satisfies a required edge.',
    })
  }
  if (
    value.recordRevision !== undefined &&
    !isPositiveInteger(value.recordRevision)
  ) {
    issues.push({
      path: `${path}.recordRevision`,
      code: 'invalid_revision',
      message: 'Referenced record revision must be a positive integer.',
    })
  }
  return true
}

function validateNextAction(
  value: unknown,
  issues: ValidationIssue[],
): value is MasteryNextAction {
  const path = '$.nextAction'
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Next action must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set(['kind', 'label', 'rationale', 'targetSkillIds']),
    path,
    issues,
  )
  if (!isOneOf(value.kind, NEXT_ACTION_KINDS)) {
    issues.push({
      path: `${path}.kind`,
      code: 'invalid_enum',
      message: 'Unsupported next-action kind.',
    })
  }
  if (!isNonEmptyString(value.label, 160)) {
    issues.push({
      path: `${path}.label`,
      code: 'invalid_text',
      message: 'Next-action label must contain 1-160 characters.',
    })
  }
  if (!isNonEmptyString(value.rationale, 500)) {
    issues.push({
      path: `${path}.rationale`,
      code: 'invalid_text',
      message: 'Next-action rationale must contain 1-500 characters.',
    })
  }
  if (!Array.isArray(value.targetSkillIds)) {
    issues.push({
      path: `${path}.targetSkillIds`,
      code: 'invalid_type',
      message: 'Next-action target skill IDs must be an array.',
    })
  } else {
    value.targetSkillIds.forEach((id, index) =>
      pushStableIdIssue(id, `${path}.targetSkillIds[${index}]`, issues),
    )
  }
  return true
}

function validateAuditEntry(
  value: unknown,
  path: string,
  record: Record<string, unknown>,
  issues: ValidationIssue[],
): value is OverrideAuditEntry {
  if (!isRecord(value)) {
    issues.push({
      path,
      code: 'invalid_type',
      message: 'Override audit entry must be an object.',
    })
    return false
  }
  rejectUnknownKeys(
    value,
    new Set([
      'id',
      'overrideId',
      'studentId',
      'skillId',
      'action',
      'actor',
      'at',
      'reason',
      'fromState',
      'toState',
      'overrideSnapshot',
    ]),
    path,
    issues,
  )
  pushStableIdIssue(value.id, `${path}.id`, issues)
  pushStableIdIssue(value.overrideId, `${path}.overrideId`, issues)
  pushStableIdIssue(value.studentId, `${path}.studentId`, issues)
  pushStableIdIssue(value.skillId, `${path}.skillId`, issues)
  if (
    value.studentId !== record.studentId ||
    value.skillId !== record.skillId
  ) {
    issues.push({
      path,
      code: 'audit_record_mismatch',
      message: 'Audit entry must belong to this student and skill.',
    })
  }
  if (
    !isOneOf(value.action, [
      'applied',
      'replaced',
      'revoked',
      'expired',
    ] as const)
  ) {
    issues.push({
      path: `${path}.action`,
      code: 'invalid_enum',
      message: 'Unsupported override audit action.',
    })
  }
  if (!isRecord(value.actor)) {
    issues.push({
      path: `${path}.actor`,
      code: 'invalid_type',
      message: 'Audit actor must be an object.',
    })
  } else if (value.actor.role === 'system') {
    rejectUnknownKeys(
      value.actor,
      new Set(['role', 'actorId']),
      `${path}.actor`,
      issues,
    )
    if (!isStableId(value.actor.actorId)) {
      issues.push({
        path: `${path}.actor.actorId`,
        code: 'invalid_stable_id',
        message: 'System actor ID must be stable and opaque.',
      })
    }
  } else {
    validateOverrideActor(value.actor, `${path}.actor`, issues)
  }
  pushDateTimeIssue(value.at, `${path}.at`, issues)
  if (!isNonEmptyString(value.reason, 500)) {
    issues.push({
      path: `${path}.reason`,
      code: 'invalid_reason',
      message: 'Audit reason must contain 1-500 characters.',
    })
  }
  if (!isOneOf(value.fromState, MASTERY_STATES)) {
    issues.push({
      path: `${path}.fromState`,
      code: 'invalid_enum',
      message: 'Audit fromState is not supported.',
    })
  }
  if (!isOneOf(value.toState, MASTERY_STATES)) {
    issues.push({
      path: `${path}.toState`,
      code: 'invalid_enum',
      message: 'Audit toState is not supported.',
    })
  }
  const snapshot = validateManualMasteryOverride(value.overrideSnapshot)
  if (!snapshot.ok) {
    for (const issue of snapshot.issues) {
      issues.push({
        ...issue,
        path: `${path}.overrideSnapshot${issue.path.slice(1)}`,
      })
    }
  } else if (
    snapshot.value.id !== value.overrideId ||
    snapshot.value.studentId !== record.studentId ||
    snapshot.value.skillId !== record.skillId
  ) {
    issues.push({
      path: `${path}.overrideSnapshot`,
      code: 'audit_snapshot_mismatch',
      message: 'Audit snapshot must match the entry and mastery record.',
    })
  }
  return true
}

export function validateStudentSkillMastery(
  value: unknown,
): ValidationResult<StudentSkillMastery> {
  if (!isRecord(value)) {
    return validationFailure([
      {
        path: '$',
        code: 'invalid_type',
        message: 'Student skill mastery must be an object.',
      },
    ])
  }
  const issues: ValidationIssue[] = []
  rejectUnknownKeys(
    value,
    new Set([
      'kind',
      'schemaVersion',
      'id',
      'revision',
      'studentId',
      'skillId',
      'computedState',
      'state',
      'confidence',
      'evidence',
      'basisEvidenceIds',
      'prerequisiteStatus',
      'reasonCodes',
      'nextAction',
      'evaluatedAt',
      'lastIndependentDemonstrationAt',
      'lastReinforcedAt',
      'override',
      'overrideAuditHistory',
    ]),
    '$',
    issues,
  )
  if (value.kind !== 'student-skill-mastery') {
    issues.push({
      path: '$.kind',
      code: 'invalid_discriminant',
      message: 'Record kind must be "student-skill-mastery".',
    })
  }
  if (value.schemaVersion !== MASTERY_SCHEMA_VERSION) {
    issues.push({
      path: '$.schemaVersion',
      code: 'unsupported_schema_version',
      message: `Only mastery schema version ${MASTERY_SCHEMA_VERSION} is supported.`,
    })
  }
  pushStableIdIssue(value.id, '$.id', issues)
  if (!isPositiveInteger(value.revision)) {
    issues.push({
      path: '$.revision',
      code: 'invalid_revision',
      message: 'Mastery record revision must be a positive integer.',
    })
  }
  pushStableIdIssue(value.studentId, '$.studentId', issues)
  pushStableIdIssue(value.skillId, '$.skillId', issues)
  if (!isOneOf(value.computedState, MASTERY_STATES)) {
    issues.push({
      path: '$.computedState',
      code: 'invalid_enum',
      message: 'Computed mastery state is not supported.',
    })
  }
  if (!isOneOf(value.state, MASTERY_STATES)) {
    issues.push({
      path: '$.state',
      code: 'invalid_enum',
      message: 'Effective mastery state is not supported.',
    })
  }

  const evidenceIds = new Set<string>()
  const evidence = Array.isArray(value.evidence) ? value.evidence : []
  if (!Array.isArray(value.evidence)) {
    issues.push({
      path: '$.evidence',
      code: 'invalid_type',
      message: 'Evidence must be an array.',
    })
  }
  evidence.forEach((item, index) => {
    const result = validateMasteryEvidence(item)
    if (!result.ok) {
      for (const issue of result.issues) {
        issues.push({
          ...issue,
          path: `$.evidence[${index}]${issue.path.slice(1)}`,
        })
      }
      return
    }
    if (
      result.value.studentId !== value.studentId ||
      result.value.skillId !== value.skillId
    ) {
      issues.push({
        path: `$.evidence[${index}]`,
        code: 'evidence_record_mismatch',
        message: 'Evidence must belong to the record student and skill.',
      })
    }
    if (
      isIsoDateTime(value.evaluatedAt) &&
      Date.parse(result.value.capturedAt) > Date.parse(value.evaluatedAt)
    ) {
      issues.push({
        path: `$.evidence[${index}].capturedAt`,
        code: 'future_evidence',
        message: 'Evidence captured after evaluatedAt cannot support this record.',
      })
    }
    if (evidenceIds.has(result.value.id)) {
      issues.push({
        path: `$.evidence[${index}].id`,
        code: 'duplicate_evidence_id',
        message: 'Evidence IDs must be unique within a mastery record.',
      })
    }
    evidenceIds.add(result.value.id)
  })
  evidence.forEach((item, index) => {
    if (
      !isRecord(item) ||
      item.kind !== 'independent_demonstration' ||
      !Array.isArray(item.sourceEvidenceIds)
    ) {
      return
    }
    item.sourceEvidenceIds.forEach((id, referenceIndex) => {
      if (typeof id === 'string' && !evidenceIds.has(id)) {
        issues.push({
          path: `$.evidence[${index}].sourceEvidenceIds[${referenceIndex}]`,
          code: 'missing_evidence_reference',
          message:
            'Independent demonstration source must reference evidence included on this record.',
        })
      }
    })
  })

  if (!Array.isArray(value.basisEvidenceIds)) {
    issues.push({
      path: '$.basisEvidenceIds',
      code: 'invalid_type',
      message: 'basisEvidenceIds must be an array.',
    })
  } else {
    const seen = new Set<string>()
    value.basisEvidenceIds.forEach((id, index) => {
      if (!isStableId(id) || !evidenceIds.has(id)) {
        issues.push({
          path: `$.basisEvidenceIds[${index}]`,
          code: 'missing_evidence_reference',
          message: 'Basis must reference evidence included on this record.',
        })
      } else if (seen.has(id)) {
        issues.push({
          path: `$.basisEvidenceIds[${index}]`,
          code: 'duplicate_reference',
          message: 'Basis evidence references must be unique.',
        })
      }
      if (typeof id === 'string') seen.add(id)
    })
  }

  validateConfidence(value.confidence, evidenceIds, issues)

  if (!Array.isArray(value.prerequisiteStatus)) {
    issues.push({
      path: '$.prerequisiteStatus',
      code: 'invalid_type',
      message: 'Prerequisite status must be an array.',
    })
  } else {
    const prerequisiteIds = new Set<string>()
    value.prerequisiteStatus.forEach((status, index) => {
      validatePrerequisiteStatus(
        status,
        `$.prerequisiteStatus[${index}]`,
        issues,
      )
      if (isRecord(status) && typeof status.skillId === 'string') {
        if (prerequisiteIds.has(status.skillId)) {
          issues.push({
            path: `$.prerequisiteStatus[${index}].skillId`,
            code: 'duplicate_prerequisite',
            message: 'Prerequisite status entries must be unique.',
          })
        }
        if (status.skillId === value.skillId) {
          issues.push({
            path: `$.prerequisiteStatus[${index}].skillId`,
            code: 'self_dependency',
            message: 'A skill cannot list itself as a prerequisite.',
          })
        }
        prerequisiteIds.add(status.skillId)
      }
    })
    const hasBlocker = value.prerequisiteStatus.some(
      (status) => isRecord(status) && status.satisfied === false,
    )
    if (
      value.computedState === 'blocked_by_prerequisite' &&
      !hasBlocker
    ) {
      issues.push({
        path: '$.computedState',
        code: 'blocked_without_prerequisite',
        message: 'Blocked state requires at least one unsatisfied prerequisite.',
      })
    }
  }

  if (
    !Array.isArray(value.reasonCodes) ||
    value.reasonCodes.some((code) => !isOneOf(code, MASTERY_REASON_CODES))
  ) {
    issues.push({
      path: '$.reasonCodes',
      code: 'invalid_reason_codes',
      message: 'Mastery reason codes contain an unsupported value.',
    })
  } else if (new Set(value.reasonCodes).size !== value.reasonCodes.length) {
    issues.push({
      path: '$.reasonCodes',
      code: 'duplicate_reason_code',
      message: 'Mastery reason codes must be unique.',
    })
  }
  validateNextAction(value.nextAction, issues)
  pushDateTimeIssue(value.evaluatedAt, '$.evaluatedAt', issues)

  const successfulIndependent = evidence
    .filter(
      (item): item is IndependentDemonstrationEvidence =>
        isRecord(item) &&
        item.kind === 'independent_demonstration' &&
        item.outcome === 'successful' &&
        item.quality === 'reliable' &&
        isIsoDateTime(item.capturedAt),
    )
    .sort((left, right) => Date.parse(left.capturedAt) - Date.parse(right.capturedAt))
  if (
    value.computedState === 'mastered' &&
    successfulIndependent.length === 0
  ) {
    issues.push({
      path: '$.computedState',
      code: 'mastery_without_independent_evidence',
      message:
        'Computed mastery requires successful, reliable independent performance.',
    })
  }
  if (
    value.computedState === 'needs_reinforcement' &&
    successfulIndependent.length === 0
  ) {
    issues.push({
      path: '$.computedState',
      code: 'reinforcement_without_prior_demonstration',
      message:
        'Needs reinforcement requires prior successful, reliable independent performance.',
    })
  }
  if (value.computedState === 'not_yet_assessed' && evidence.length > 0) {
    issues.push({
      path: '$.computedState',
      code: 'not_assessed_with_evidence',
      message: 'Not yet assessed cannot contain evidence.',
    })
  }
  if (
    (value.computedState === 'currently_learning' ||
      value.computedState === 'evidence_uncertain') &&
    evidence.length === 0
  ) {
    issues.push({
      path: '$.computedState',
      code: 'evidence_state_without_evidence',
      message: `${String(value.computedState)} requires evidence.`,
    })
  }
  const expectedLastIndependent =
    successfulIndependent.at(-1)?.capturedAt
  if (value.lastIndependentDemonstrationAt !== expectedLastIndependent) {
    issues.push({
      path: '$.lastIndependentDemonstrationAt',
      code: 'independent_timestamp_mismatch',
      message:
        'Last independent demonstration must match the latest successful, reliable independent evidence.',
    })
  }
  if (value.lastReinforcedAt !== undefined) {
    pushDateTimeIssue(value.lastReinforcedAt, '$.lastReinforcedAt', issues)
  }

  let validOverride: ManualMasteryOverride | undefined
  if (value.override !== undefined) {
    const override = validateManualMasteryOverride(value.override)
    if (!override.ok) {
      for (const issue of override.issues) {
        issues.push({
          ...issue,
          path: `$.override${issue.path.slice(1)}`,
        })
      }
    } else {
      validOverride = override.value
      if (
        override.value.studentId !== value.studentId ||
        override.value.skillId !== value.skillId
      ) {
        issues.push({
          path: '$.override',
          code: 'override_record_mismatch',
          message: 'Override must belong to the record student and skill.',
        })
      }
    }
  }

  if (!Array.isArray(value.overrideAuditHistory)) {
    issues.push({
      path: '$.overrideAuditHistory',
      code: 'invalid_type',
      message: 'Override audit history must be an array.',
    })
  } else {
    const auditIds = new Set<string>()
    let previousAt = Number.NEGATIVE_INFINITY
    value.overrideAuditHistory.forEach((entry, index) => {
      validateAuditEntry(
        entry,
        `$.overrideAuditHistory[${index}]`,
        value,
        issues,
      )
      if (!isRecord(entry)) return
      if (typeof entry.id === 'string') {
        if (auditIds.has(entry.id)) {
          issues.push({
            path: `$.overrideAuditHistory[${index}].id`,
            code: 'duplicate_audit_id',
            message: 'Override audit IDs must be unique.',
          })
        }
        auditIds.add(entry.id)
      }
      if (isIsoDateTime(entry.at)) {
        const at = Date.parse(entry.at)
        if (at < previousAt) {
          issues.push({
            path: `$.overrideAuditHistory[${index}].at`,
            code: 'audit_out_of_order',
            message: 'Override audit history must be chronological.',
          })
        }
        previousAt = at
      }
    })
    if (
      validOverride &&
      !value.overrideAuditHistory.some(
        (entry) =>
          isRecord(entry) &&
          entry.overrideId === validOverride?.id &&
          (entry.action === 'applied' || entry.action === 'replaced'),
      )
    ) {
      issues.push({
        path: '$.overrideAuditHistory',
        code: 'override_missing_audit',
        message:
          'Every current override must have an applied or replaced audit entry.',
      })
    }
  }

  if (
    validOverride &&
    isIsoDateTime(value.evaluatedAt) &&
    Date.parse(validOverride.createdAt) <= Date.parse(value.evaluatedAt) &&
    (validOverride.expiresAt === undefined ||
      Date.parse(validOverride.expiresAt) > Date.parse(value.evaluatedAt))
  ) {
    if (value.state !== validOverride.state) {
      issues.push({
        path: '$.state',
        code: 'active_override_not_applied',
        message: 'Effective state must reflect the current manual override.',
      })
    }
  } else if (value.state !== value.computedState) {
    issues.push({
      path: '$.state',
      code: 'effective_state_mismatch',
      message:
        'Without a current manual override, effective state must equal computed state.',
    })
  }

  return issues.length > 0
    ? validationFailure(issues)
    : validationSuccess(value as unknown as StudentSkillMastery)
}

export function assertValidMasteryEvidence(
  value: unknown,
): asserts value is MasteryEvidence {
  const result = validateMasteryEvidence(value)
  if (!result.ok) {
    throw new MasteryValidationError('Invalid mastery evidence.', result.issues)
  }
}

export function assertValidStudentSkillMastery(
  value: unknown,
): asserts value is StudentSkillMastery {
  const result = validateStudentSkillMastery(value)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Invalid student skill mastery record.',
      result.issues,
    )
  }
}

export function assertValidManualMasteryOverride(
  value: unknown,
): asserts value is ManualMasteryOverride {
  const result = validateManualMasteryOverride(value)
  if (!result.ok) {
    throw new MasteryValidationError(
      'Invalid manual mastery override.',
      result.issues,
    )
  }
}

export type MasteryPayload =
  | import('./contracts.ts').SkillGraph
  | MasteryEvidence
  | ManualMasteryOverride
  | StudentSkillMastery

/**
 * Version-gated ingress for untrusted JSON. Unknown kinds and future versions
 * are rejected rather than guessed or coerced.
 */
export function validateMasteryPayload(
  value: unknown,
): ValidationResult<MasteryPayload> {
  if (!isRecord(value)) {
    return validationFailure([
      {
        path: '$',
        code: 'invalid_type',
        message: 'Mastery payload must be an object.',
      },
    ])
  }
  if (value.schemaVersion !== MASTERY_SCHEMA_VERSION) {
    return validationFailure([
      {
        path: '$.schemaVersion',
        code: 'unsupported_schema_version',
        message: `Unsupported mastery schema version "${String(
          value.schemaVersion,
        )}". Only version ${MASTERY_SCHEMA_VERSION} is accepted.`,
      },
    ])
  }
  switch (value.kind) {
    case 'mastery-skill-graph':
      return validateSkillGraph(value)
    case 'assessment_attempt':
    case 'tutor_intervention':
    case 'independent_demonstration':
      return validateMasteryEvidence(value)
    case 'manual_mastery_override':
      return validateManualMasteryOverride(value)
    case 'student-skill-mastery':
      return validateStudentSkillMastery(value)
    default:
      return validationFailure([
        {
          path: '$.kind',
          code: 'unknown_payload_kind',
          message: `Unknown mastery payload kind "${String(value.kind)}".`,
        },
      ])
  }
}

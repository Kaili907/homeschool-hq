/**
 * Deterministic structured consistency gate for high-school PE transfer work.
 *
 * Prose is deliberately not inspected. Canonical authoring emits a normalized
 * authority record and the final generator projects that record into both the
 * learner task card and adult scoring guide. This gate compares the actual task
 * schema: action, required span and continuity, stop/rest authority, transfer
 * requirement, completion evidence, equal-credit routes, adult rubric, and
 * adaptive-route expectations. Missing structure fails closed.
 */

export const TRANSFER_AUTHORITY_SCHEMA = 'manuel-academy.pe-transfer-authority.v2'

function finding(classification, code, message) {
  return { classification, code, message }
}

function sortedStrings(value) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string'))].sort() : []
}

function booleanOrNull(value) {
  return typeof value === 'boolean' ? value : null
}

function normalized(record) {
  if (!record || typeof record !== 'object') return null
  return {
    schemaVersion: record.schemaVersion ?? null,
    authorityId: record.authorityId ?? null,
    learnerTask: {
      actionId: record.learnerTask?.actionId ?? null,
      actionKind: record.learnerTask?.actionKind ?? null,
      focusId: record.learnerTask?.focusId ?? null,
      executionRequired: booleanOrNull(record.learnerTask?.executionRequired),
    },
    durationContinuity: {
      span: {
        unit: record.durationContinuity?.span?.unit ?? null,
        minimum: record.durationContinuity?.span?.minimum ?? null,
        coverage: record.durationContinuity?.span?.coverage ?? null,
      },
      uninterruptedPerformanceRequired: booleanOrNull(record.durationContinuity?.uninterruptedPerformanceRequired),
      interruptionRecoveryRequired: booleanOrNull(record.durationContinuity?.interruptionRecoveryRequired),
    },
    restInterruptionAllowance: {
      restAllowed: booleanOrNull(record.restInterruptionAllowance?.restAllowed),
      restPreservesParticipationCredit: booleanOrNull(record.restInterruptionAllowance?.restPreservesParticipationCredit),
      transferCreditAfterRest: record.restInterruptionAllowance?.transferCreditAfterRest ?? null,
    },
    transferRequirement: {
      required: booleanOrNull(record.transferRequirement?.required),
      conditionId: record.transferRequirement?.conditionId ?? null,
    },
    completionEvidence: {
      completionKind: record.completionEvidence?.completionKind ?? null,
      hypotheticalCompletionAllowed: booleanOrNull(record.completionEvidence?.hypotheticalCompletionAllowed),
      requiredEvidenceIds: sortedStrings(record.completionEvidence?.requiredEvidenceIds),
      maximumCreditableSpan: {
        unit: record.completionEvidence?.maximumCreditableSpan?.unit ?? null,
        maximum: record.completionEvidence?.maximumCreditableSpan?.maximum ?? null,
      },
    },
    equalCreditPath: {
      routes: sortedStrings(record.equalCreditPath?.routes),
      sameEvidenceRequired: booleanOrNull(record.equalCreditPath?.sameEvidenceRequired),
      requiredEvidenceIds: sortedStrings(record.equalCreditPath?.requiredEvidenceIds),
    },
    adultRubric: {
      scoringAuthority: record.adultRubric?.scoringAuthority ?? null,
      requiredEvidenceIds: sortedStrings(record.adultRubric?.requiredEvidenceIds),
      bodyMetricsScored: booleanOrNull(record.adultRubric?.bodyMetricsScored),
      participantCountScored: booleanOrNull(record.adultRubric?.participantCountScored),
    },
    adaptiveRouteExpectations: {
      safeReductionPreservesParticipationCredit: booleanOrNull(record.adaptiveRouteExpectations?.safeReductionPreservesParticipationCredit),
      alternateRouteCanEarnTransferCredit: booleanOrNull(record.adaptiveRouteExpectations?.alternateRouteCanEarnTransferCredit),
      alternateRouteMustPreserveEvidence: booleanOrNull(record.adaptiveRouteExpectations?.alternateRouteMustPreserveEvidence),
      guardianSafetyBoundaryRetained: booleanOrNull(record.adaptiveRouteExpectations?.guardianSafetyBoundaryRetained),
    },
  }
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function schemaFindings(record, classification, channel) {
  const out = []
  if (!record) return [finding(classification, 'STRUCTURED_AUTHORITY_MISSING', `${channel} structured transfer authority is missing`)]
  if (record.schemaVersion !== TRANSFER_AUTHORITY_SCHEMA) out.push(finding(classification, 'STRUCTURED_AUTHORITY_SCHEMA_INVALID', `${channel} transfer-authority schema is unsupported`))
  if (!record.authorityId || !record.learnerTask.actionId || !record.learnerTask.actionKind || typeof record.learnerTask.executionRequired !== 'boolean') out.push(finding(classification, 'STRUCTURED_TASK_INVALID', `${channel} learner task/action identity is incomplete`))
  const span = record.durationContinuity.span
  if (!span.unit || !Number.isInteger(span.minimum) || span.minimum < 1 || typeof record.durationContinuity.uninterruptedPerformanceRequired !== 'boolean' || typeof record.durationContinuity.interruptionRecoveryRequired !== 'boolean') out.push(finding(classification, 'STRUCTURED_DURATION_INVALID', `${channel} duration/continuity requirement is incomplete`))
  if (record.restInterruptionAllowance.restAllowed !== true || typeof record.restInterruptionAllowance.restPreservesParticipationCredit !== 'boolean' || !record.restInterruptionAllowance.transferCreditAfterRest) out.push(finding(classification, 'STRUCTURED_REST_AUTHORITY_INVALID', `${channel} stop/rest authority is incomplete`))
  if (!record.transferRequirement.required || !record.transferRequirement.conditionId) out.push(finding(classification, 'STRUCTURED_TRANSFER_INVALID', `${channel} transfer requirement is incomplete`))
  if (record.completionEvidence.requiredEvidenceIds.length === 0 || typeof record.completionEvidence.hypotheticalCompletionAllowed !== 'boolean' || !Number.isInteger(record.completionEvidence.maximumCreditableSpan.maximum)) out.push(finding(classification, 'STRUCTURED_EVIDENCE_INVALID', `${channel} completion/evidence condition is incomplete`))
  if (record.equalCreditPath.routes.length === 0 || !record.equalCreditPath.sameEvidenceRequired) out.push(finding(classification, 'STRUCTURED_EQUAL_CREDIT_INVALID', `${channel} equal-credit path is incomplete`))
  if (record.adultRubric.scoringAuthority !== 'RUBRIC' || record.adultRubric.bodyMetricsScored !== false || record.adultRubric.participantCountScored !== false) out.push(finding(classification, 'STRUCTURED_RUBRIC_INVALID', `${channel} adult rubric authority is invalid`))
  if (typeof record.adaptiveRouteExpectations.safeReductionPreservesParticipationCredit !== 'boolean' || typeof record.adaptiveRouteExpectations.alternateRouteCanEarnTransferCredit !== 'boolean' || record.adaptiveRouteExpectations.alternateRouteMustPreserveEvidence !== true || record.adaptiveRouteExpectations.guardianSafetyBoundaryRetained !== true) out.push(finding(classification, 'STRUCTURED_ADAPTIVE_ROUTE_INVALID', `${channel} adaptive-route expectations are incomplete`))
  return out
}

function contradictionFindings(source, learner, adult) {
  const out = []
  if (source.durationContinuity.uninterruptedPerformanceRequired
    && adult.restInterruptionAllowance.restPreservesParticipationCredit) {
    out.push(finding('SCORING_AUTHORITY_CONFLICT', 'UNINTERRUPTED_VS_REST_CREDIT_AUTHORITY', 'uninterrupted performance is required while adult authority preserves credit for stopping or resting'))
  }

  const requiredSpan = source.durationContinuity.span
  const creditedSpan = learner.completionEvidence.maximumCreditableSpan
  if (requiredSpan.unit !== creditedSpan.unit || creditedSpan.maximum < requiredSpan.minimum) {
    out.push(finding('CONTENT_TRANSFER_CONFLICT', 'REQUIRED_SPAN_NOT_COVERED', 'learner completion does not cover the full required transfer span'))
  }
  if (source.learnerTask.executionRequired && learner.completionEvidence.hypotheticalCompletionAllowed) {
    out.push(finding('CONTENT_TRANSFER_CONFLICT', 'EXECUTION_VS_HYPOTHETICAL_COMPLETION', 'required execution cannot be completed by a hypothetical-only path'))
  }
  return out
}

function compareProjection(source, projected, classification, channel) {
  if (!source || !projected) return []
  const out = []
  const fields = [
    ['learnerTask', 'TASK_ACTION_MISMATCH'],
    ['durationContinuity', 'DURATION_CONTINUITY_MISMATCH'],
    ['restInterruptionAllowance', 'REST_INTERRUPTION_AUTHORITY_MISMATCH'],
    ['transferRequirement', 'TRANSFER_REQUIREMENT_MISMATCH'],
    ['completionEvidence', 'COMPLETION_EVIDENCE_MISMATCH'],
    ['equalCreditPath', 'EQUAL_CREDIT_PATH_MISMATCH'],
    ['adultRubric', 'ADULT_RUBRIC_MISMATCH'],
    ['adaptiveRouteExpectations', 'ADAPTIVE_ROUTE_MISMATCH'],
  ]
  if (source.authorityId !== projected.authorityId) out.push(finding(classification, 'AUTHORITY_ID_MISMATCH', `${channel} is not bound to the canonical transfer authority`))
  for (const [field, code] of fields) {
    if (!same(source[field], projected[field])) out.push(finding(classification, code, `${channel} ${field} meaning differs from canonical authority`))
  }
  return out
}

export function evaluatePeTransferConsistency({ sourceLesson, learnerTransferAuthority, adultTransferAuthority }) {
  if (!sourceLesson?.transfer_condition) return { status: 'CONSISTENT', classifications: [], findings: [] }

  const source = normalized(sourceLesson.transfer_authority)
  const learner = normalized(learnerTransferAuthority)
  const adult = normalized(adultTransferAuthority)
  const findings = [
    ...schemaFindings(source, 'CONTENT_TRANSFER_CONFLICT', 'canonical source'),
    ...schemaFindings(learner, 'CONTENT_TRANSFER_CONFLICT', 'learner task/completion'),
    ...schemaFindings(adult, 'SCORING_AUTHORITY_CONFLICT', 'adult rubric/adaptive authority'),
    ...compareProjection(source, learner, 'CONTENT_TRANSFER_CONFLICT', 'learner projection'),
    ...compareProjection(source, adult, 'SCORING_AUTHORITY_CONFLICT', 'adult projection'),
    ...(source && learner && adult ? contradictionFindings(source, learner, adult) : []),
  ]

  const deduplicated = [...new Map(findings.map((item) => [`${item.classification}:${item.code}:${item.message}`, item])).values()]
  return {
    status: deduplicated.length === 0 ? 'CONSISTENT' : 'CONFLICT',
    classifications: [...new Set(deduplicated.map((item) => item.classification))],
    findings: deduplicated,
  }
}

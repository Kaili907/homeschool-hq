/**
 * Deterministic R3 semantic binding for high-school PE transfer work.
 *
 * Canonical authority, learner-task semantics, and adult-rubric semantics use
 * three different schemas. Learner/adult records are derived from their real
 * artifact fields, not copied transferAuthority objects. SHA-256 field bindings
 * make every semantic-bearing visible field tamper evident, including wording
 * changes that do not use a known phrase. The committed JSON Schemas are loaded
 * and executed directly; missing fields, wrong types, unknown enums, and extra
 * undeclared fields fail closed.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const TRANSFER_AUTHORITY_SCHEMA = 'manuel-academy.pe-transfer-authority.v3'
export const LEARNER_TRANSFER_SCHEMA = 'manuel-academy.pe-learner-transfer-semantics.v1'
export const ADULT_TRANSFER_SCHEMA = 'manuel-academy.pe-adult-transfer-semantics.v1'

const SCHEMA_ROOT = new URL('../../schema/', import.meta.url)
const AUTHORITY_JSON_SCHEMA = JSON.parse(readFileSync(new URL('transfer-authority.schema.json', SCHEMA_ROOT), 'utf8'))
const LEARNER_JSON_SCHEMA = JSON.parse(readFileSync(new URL('learner-transfer-semantics.schema.json', SCHEMA_ROOT), 'utf8'))
const ADULT_JSON_SCHEMA = JSON.parse(readFileSync(new URL('adult-transfer-semantics.schema.json', SCHEMA_ROOT), 'utf8'))

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
export const LEARNER_VISIBLE_SEMANTIC_FIELDS = [
  'studentTask',
  'completionCriteria',
  'activitySteps',
  'safetyRules',
  'stoppingRules',
  'adaptationChoices',
  'accessibleAdaptation',
  'lowSpaceNoEquipmentAlternative',
  'equipmentRequirements',
]
export const ADULT_VISIBLE_SEMANTIC_FIELDS = [
  'successCriteria',
  'scoringGuidance',
  'masteryRule',
  'adaptiveRoutes',
  'guardianOrParentVisibility',
  'guardianSafetyReview',
  'safetyAndPrivacyNotes',
]

export function semanticDigest(value) {
  const serialized = JSON.stringify(value)
  return createHash('sha256').update(serialized === undefined ? 'undefined' : serialized).digest('hex')
}

function bindings(fields, artifact) {
  return {
    algorithm: 'SHA-256',
    fields: Object.fromEntries(fields.map((field) => [field, semanticDigest(artifact[field])])),
  }
}

export function buildLearnerTransferSemantics(authority, learnerPackage) {
  return {
    schemaVersion: LEARNER_TRANSFER_SCHEMA,
    authorityRef: authority.authorityId,
    task: {
      actionKey: authority.learnerTask.actionId,
      actionType: authority.learnerTask.actionKind,
      focusKey: authority.learnerTask.focusId,
      executionRequired: authority.learnerTask.executionRequired,
    },
    spanRequirement: {
      spanUnit: authority.durationContinuity.span.unit,
      minimumCount: authority.durationContinuity.span.minimum,
      completeCoverageRequired: authority.durationContinuity.span.coverage === 'COMPLETE_REQUIRED_SPAN',
      uninterruptedRequired: authority.durationContinuity.uninterruptedPerformanceRequired,
      interruptionRecoveryRequired: authority.durationContinuity.interruptionRecoveryRequired,
    },
    restRule: {
      allowed: authority.restInterruptionAllowance.restAllowed,
      participationCreditPreserved: authority.restInterruptionAllowance.restPreservesParticipationCredit,
      transferCreditRule: authority.restInterruptionAllowance.transferCreditAfterRest,
    },
    transferCondition: {
      required: authority.transferRequirement.required,
      conditionKey: authority.transferRequirement.conditionId,
    },
    completion: {
      completionType: authority.completionEvidence.completionKind,
      hypotheticalAllowed: authority.completionEvidence.hypotheticalCompletionAllowed,
      evidenceKeys: structuredClone(authority.completionEvidence.requiredEvidenceIds),
      creditableSpan: {
        spanUnit: authority.completionEvidence.maximumCreditableSpan.unit,
        maximumCount: authority.completionEvidence.maximumCreditableSpan.maximum,
      },
    },
    equalCredit: {
      paths: structuredClone(authority.equalCreditPath.routes),
      sameEvidenceRequired: authority.equalCreditPath.sameEvidenceRequired,
      evidenceKeys: structuredClone(authority.equalCreditPath.requiredEvidenceIds),
    },
    guardianBoundaryRetained: authority.adaptiveRouteExpectations.guardianSafetyBoundaryRetained,
    fieldBindings: bindings(LEARNER_VISIBLE_SEMANTIC_FIELDS, learnerPackage),
  }
}

export function buildAdultTransferSemantics(authority, adultGuide) {
  return {
    schemaVersion: ADULT_TRANSFER_SCHEMA,
    authorityRef: authority.authorityId,
    judgedTask: {
      actionKey: authority.learnerTask.actionId,
      actionType: authority.learnerTask.actionKind,
      focusKey: authority.learnerTask.focusId,
      executionRequired: authority.learnerTask.executionRequired,
    },
    requiredSpan: {
      spanUnit: authority.durationContinuity.span.unit,
      minimumCount: authority.durationContinuity.span.minimum,
      completeCoverageRequired: authority.durationContinuity.span.coverage === 'COMPLETE_REQUIRED_SPAN',
      uninterruptedRequired: authority.durationContinuity.uninterruptedPerformanceRequired,
      interruptionRecoveryRequired: authority.durationContinuity.interruptionRecoveryRequired,
    },
    restCredit: {
      restAllowed: authority.restInterruptionAllowance.restAllowed,
      participationCreditPreserved: authority.restInterruptionAllowance.restPreservesParticipationCredit,
      transferCreditRule: authority.restInterruptionAllowance.transferCreditAfterRest,
    },
    transferCondition: {
      required: authority.transferRequirement.required,
      conditionKey: authority.transferRequirement.conditionId,
    },
    completionJudgment: {
      completionType: authority.completionEvidence.completionKind,
      hypotheticalAllowed: authority.completionEvidence.hypotheticalCompletionAllowed,
      evidenceKeys: structuredClone(authority.completionEvidence.requiredEvidenceIds),
      creditableSpan: {
        spanUnit: authority.completionEvidence.maximumCreditableSpan.unit,
        maximumCount: authority.completionEvidence.maximumCreditableSpan.maximum,
      },
    },
    equalCreditJudgment: {
      paths: structuredClone(authority.equalCreditPath.routes),
      sameEvidenceRequired: authority.equalCreditPath.sameEvidenceRequired,
      evidenceKeys: structuredClone(authority.equalCreditPath.requiredEvidenceIds),
    },
    rubricEvidence: {
      scoringAuthority: authority.adultRubric.scoringAuthority,
      evidenceKeys: structuredClone(authority.adultRubric.requiredEvidenceIds),
      bodyMetricsScored: authority.adultRubric.bodyMetricsScored,
      participantCountScored: authority.adultRubric.participantCountScored,
    },
    adaptiveJudgment: {
      safeReductionPreservesParticipationCredit: authority.adaptiveRouteExpectations.safeReductionPreservesParticipationCredit,
      alternateRouteCanEarnTransferCredit: authority.adaptiveRouteExpectations.alternateRouteCanEarnTransferCredit,
      alternateRouteMustPreserveEvidence: authority.adaptiveRouteExpectations.alternateRouteMustPreserveEvidence,
      guardianBoundaryRetained: authority.adaptiveRouteExpectations.guardianSafetyBoundaryRetained,
    },
    fieldBindings: bindings(ADULT_VISIBLE_SEMANTIC_FIELDS, adultGuide),
  }
}

function schemaTarget(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`unsupported schema reference: ${ref}`)
  return ref.slice(2).split('/').reduce((value, key) => value?.[key.replaceAll('~1', '/').replaceAll('~0', '~')], root)
}

function valueType(value) {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  if (Number.isInteger(value)) return 'integer'
  return typeof value
}

function validateSchemaNode(value, schema, root, path, errors) {
  if (schema.$ref) return validateSchemaNode(value, schemaTarget(root, schema.$ref), root, path, errors)
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`)
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) errors.push(`${path}: unknown enum value ${JSON.stringify(value)}`)
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = valueType(value)
    const typeMatches = allowed.includes(actual) || (actual === 'integer' && allowed.includes('number'))
    if (!typeMatches) {
      errors.push(`${path}: expected ${allowed.join('|')}, received ${actual}`)
      return
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: string is too short`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: string does not match ${schema.pattern}`)
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: number is below ${schema.minimum}`)
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: array has fewer than ${schema.minItems} items`)
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path}: array items must be unique`)
    if (schema.items) value.forEach((item, index) => validateSchemaNode(item, schema.items, root, `${path}[${index}]`, errors))
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${path}.${key}: required field is missing`)
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) validateSchemaNode(item, schema.properties[key], root, `${path}.${key}`, errors)
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: additional property is not allowed`)
    }
  }
}

export function validateAgainstSchema(value, schema) {
  const errors = []
  validateSchemaNode(value, schema, schema, '$', errors)
  return errors
}

function sortedStrings(value) {
  return Array.isArray(value) ? [...value].sort() : value
}

function canonicalLearner(record) {
  return {
    action: { kind: record.learnerTask.actionKind, focus: record.learnerTask.focusId, executionRequired: record.learnerTask.executionRequired },
    span: { unit: record.durationContinuity.span.unit, minimum: record.durationContinuity.span.minimum, complete: record.durationContinuity.span.coverage === 'COMPLETE_REQUIRED_SPAN', uninterrupted: record.durationContinuity.uninterruptedPerformanceRequired, recovery: record.durationContinuity.interruptionRecoveryRequired },
    rest: { allowed: record.restInterruptionAllowance.restAllowed, participationCredit: record.restInterruptionAllowance.restPreservesParticipationCredit, transferCredit: record.restInterruptionAllowance.transferCreditAfterRest },
    transfer: { required: record.transferRequirement.required, condition: record.transferRequirement.conditionId },
    completion: { kind: record.completionEvidence.completionKind, hypothetical: record.completionEvidence.hypotheticalCompletionAllowed, evidence: sortedStrings(record.completionEvidence.requiredEvidenceIds), span: { unit: record.completionEvidence.maximumCreditableSpan.unit, maximum: record.completionEvidence.maximumCreditableSpan.maximum } },
    equalCredit: { routes: sortedStrings(record.equalCreditPath.routes), sameEvidence: record.equalCreditPath.sameEvidenceRequired, evidence: sortedStrings(record.equalCreditPath.requiredEvidenceIds) },
    guardianBoundary: record.adaptiveRouteExpectations.guardianSafetyBoundaryRetained,
  }
}

function derivedLearner(record) {
  return {
    action: { kind: record.task.actionType, focus: record.task.focusKey, executionRequired: record.task.executionRequired },
    span: { unit: record.spanRequirement.spanUnit, minimum: record.spanRequirement.minimumCount, complete: record.spanRequirement.completeCoverageRequired, uninterrupted: record.spanRequirement.uninterruptedRequired, recovery: record.spanRequirement.interruptionRecoveryRequired },
    rest: { allowed: record.restRule.allowed, participationCredit: record.restRule.participationCreditPreserved, transferCredit: record.restRule.transferCreditRule },
    transfer: { required: record.transferCondition.required, condition: record.transferCondition.conditionKey },
    completion: { kind: record.completion.completionType, hypothetical: record.completion.hypotheticalAllowed, evidence: sortedStrings(record.completion.evidenceKeys), span: { unit: record.completion.creditableSpan.spanUnit, maximum: record.completion.creditableSpan.maximumCount } },
    equalCredit: { routes: sortedStrings(record.equalCredit.paths), sameEvidence: record.equalCredit.sameEvidenceRequired, evidence: sortedStrings(record.equalCredit.evidenceKeys) },
    guardianBoundary: record.guardianBoundaryRetained,
  }
}

function canonicalAdult(record) {
  return {
    ...canonicalLearner(record),
    rubric: { authority: record.adultRubric.scoringAuthority, evidence: sortedStrings(record.adultRubric.requiredEvidenceIds), bodyMetrics: record.adultRubric.bodyMetricsScored, participants: record.adultRubric.participantCountScored },
    adaptive: { participationAfterReduction: record.adaptiveRouteExpectations.safeReductionPreservesParticipationCredit, alternateTransfer: record.adaptiveRouteExpectations.alternateRouteCanEarnTransferCredit, preserveEvidence: record.adaptiveRouteExpectations.alternateRouteMustPreserveEvidence, guardianBoundary: record.adaptiveRouteExpectations.guardianSafetyBoundaryRetained },
  }
}

function derivedAdult(record) {
  return {
    action: { kind: record.judgedTask.actionType, focus: record.judgedTask.focusKey, executionRequired: record.judgedTask.executionRequired },
    span: { unit: record.requiredSpan.spanUnit, minimum: record.requiredSpan.minimumCount, complete: record.requiredSpan.completeCoverageRequired, uninterrupted: record.requiredSpan.uninterruptedRequired, recovery: record.requiredSpan.interruptionRecoveryRequired },
    rest: { allowed: record.restCredit.restAllowed, participationCredit: record.restCredit.participationCreditPreserved, transferCredit: record.restCredit.transferCreditRule },
    transfer: { required: record.transferCondition.required, condition: record.transferCondition.conditionKey },
    completion: { kind: record.completionJudgment.completionType, hypothetical: record.completionJudgment.hypotheticalAllowed, evidence: sortedStrings(record.completionJudgment.evidenceKeys), span: { unit: record.completionJudgment.creditableSpan.spanUnit, maximum: record.completionJudgment.creditableSpan.maximumCount } },
    equalCredit: { routes: sortedStrings(record.equalCreditJudgment.paths), sameEvidence: record.equalCreditJudgment.sameEvidenceRequired, evidence: sortedStrings(record.equalCreditJudgment.evidenceKeys) },
    guardianBoundary: record.adaptiveJudgment.guardianBoundaryRetained,
    rubric: { authority: record.rubricEvidence.scoringAuthority, evidence: sortedStrings(record.rubricEvidence.evidenceKeys), bodyMetrics: record.rubricEvidence.bodyMetricsScored, participants: record.rubricEvidence.participantCountScored },
    adaptive: { participationAfterReduction: record.adaptiveJudgment.safeReductionPreservesParticipationCredit, alternateTransfer: record.adaptiveJudgment.alternateRouteCanEarnTransferCredit, preserveEvidence: record.adaptiveJudgment.alternateRouteMustPreserveEvidence, guardianBoundary: record.adaptiveJudgment.guardianBoundaryRetained },
  }
}

function finding(classification, code, message) {
  return { classification, code, message }
}

function schemaFindings(record, schema, classification, channel) {
  if (record === undefined || record === null) return [finding(classification, 'SEMANTIC_RECORD_MISSING', `${channel} semantic record is missing`)]
  return validateAgainstSchema(record, schema).map((error) => finding(classification, 'SEMANTIC_SCHEMA_INVALID', `${channel} ${error}`))
}

function sourceBindingFindings(sourceLesson, authority) {
  const out = []
  for (const [channel, fields] of [['learnerFields', SOURCE_LEARNER_SEMANTIC_FIELDS], ['adultFields', SOURCE_ADULT_SEMANTIC_FIELDS]]) {
    for (const field of fields) {
      if (authority?.sourceFieldBindings?.[channel]?.[field] !== semanticDigest(sourceLesson?.[field])) out.push(finding(channel === 'learnerFields' ? 'CONTENT_TRANSFER_CONFLICT' : 'SCORING_AUTHORITY_CONFLICT', 'SOURCE_PROSE_BINDING_MISMATCH', `canonical ${channel}.${field} differs from its bound authored field`))
    }
  }
  return out
}

function artifactBindingFindings(artifact, record, fields, classification, channel) {
  const out = []
  for (const field of fields) {
    if (record?.fieldBindings?.fields?.[field] !== semanticDigest(artifact?.[field])) out.push(finding(classification, 'VISIBLE_PROSE_BINDING_MISMATCH', `${channel}.${field} differs from its independently bound semantic field`))
  }
  return out
}

function contradictionFindings(source, learner, adult) {
  const out = []
  if (learner.span.uninterrupted && adult.rest.participationCredit) out.push(finding('SCORING_AUTHORITY_CONFLICT', 'UNINTERRUPTED_VS_REST_CREDIT_AUTHORITY', 'learner requires uninterrupted performance while the adult rubric preserves transfer credit after rest'))
  if (adult.span.uninterrupted && learner.rest.participationCredit) out.push(finding('CONTENT_TRANSFER_CONFLICT', 'REST_ALLOWED_VS_UNINTERRUPTED_RUBRIC', 'learner permits rest while the adult rubric requires uninterrupted performance'))
  if (learner.span.unit !== adult.completion.span.unit || adult.completion.span.maximum < learner.span.minimum) out.push(finding('SCORING_AUTHORITY_CONFLICT', 'ADULT_CREDIT_SPAN_TOO_SHORT', 'adult completion credit does not cover the learner required span'))
  if (adult.span.unit !== learner.completion.span.unit || learner.completion.span.maximum < adult.span.minimum) out.push(finding('CONTENT_TRANSFER_CONFLICT', 'LEARNER_CREDIT_SPAN_TOO_SHORT', 'learner completion path does not cover the adult required span'))
  if (learner.action.executionRequired && adult.completion.hypothetical) out.push(finding('SCORING_AUTHORITY_CONFLICT', 'EXECUTION_VS_HYPOTHETICAL_RUBRIC', 'adult rubric accepts hypothetical completion for required learner execution'))
  if (adult.action.executionRequired && learner.completion.hypothetical) out.push(finding('CONTENT_TRANSFER_CONFLICT', 'HYPOTHETICAL_TASK_VS_EXECUTION_RUBRIC', 'learner hypothetical path cannot satisfy adult required execution'))
  if (source.span.unit !== learner.span.unit || learner.completion.span.maximum < source.span.minimum) out.push(finding('CONTENT_TRANSFER_CONFLICT', 'REQUIRED_SPAN_NOT_COVERED', 'learner completion does not cover the canonical required span'))
  return out
}

export function evaluatePeTransferConsistency({ sourceLesson, learnerPackage, adultGuide }) {
  if (!sourceLesson?.transfer_condition) return { status: 'CONSISTENT', classifications: [], findings: [] }

  const authority = sourceLesson.transfer_authority
  const learnerRecord = learnerPackage?.transferTask
  const adultRecord = adultGuide?.transferRubric
  const authoritySchemaErrors = schemaFindings(authority, AUTHORITY_JSON_SCHEMA, 'CONTENT_TRANSFER_CONFLICT', 'canonical authority')
  const learnerSchemaErrors = schemaFindings(learnerRecord, LEARNER_JSON_SCHEMA, 'CONTENT_TRANSFER_CONFLICT', 'learner task')
  const adultSchemaErrors = schemaFindings(adultRecord, ADULT_JSON_SCHEMA, 'SCORING_AUTHORITY_CONFLICT', 'adult rubric')
  const findings = [
    ...authoritySchemaErrors,
    ...learnerSchemaErrors,
    ...adultSchemaErrors,
    ...sourceBindingFindings(sourceLesson, authority),
    ...artifactBindingFindings(learnerPackage, learnerRecord, LEARNER_VISIBLE_SEMANTIC_FIELDS, 'CONTENT_TRANSFER_CONFLICT', 'learner task'),
    ...artifactBindingFindings(adultGuide, adultRecord, ADULT_VISIBLE_SEMANTIC_FIELDS, 'SCORING_AUTHORITY_CONFLICT', 'adult rubric'),
  ]

  if (authoritySchemaErrors.length === 0 && learnerSchemaErrors.length === 0) {
    if (learnerRecord.authorityRef !== authority.authorityId) findings.push(finding('CONTENT_TRANSFER_CONFLICT', 'LEARNER_AUTHORITY_REF_MISMATCH', 'learner task is not bound to canonical authority'))
    const canonical = canonicalLearner(authority)
    const derived = derivedLearner(learnerRecord)
    if (JSON.stringify(canonical) !== JSON.stringify(derived)) findings.push(finding('CONTENT_TRANSFER_CONFLICT', 'LEARNER_SEMANTIC_MISMATCH', 'derived learner task semantics differ from canonical authority'))
  }
  if (authoritySchemaErrors.length === 0 && adultSchemaErrors.length === 0) {
    if (adultRecord.authorityRef !== authority.authorityId) findings.push(finding('SCORING_AUTHORITY_CONFLICT', 'ADULT_AUTHORITY_REF_MISMATCH', 'adult rubric is not bound to canonical authority'))
    const canonical = canonicalAdult(authority)
    const derived = derivedAdult(adultRecord)
    if (JSON.stringify(canonical) !== JSON.stringify(derived)) findings.push(finding('SCORING_AUTHORITY_CONFLICT', 'ADULT_SEMANTIC_MISMATCH', 'derived adult rubric semantics differ from canonical authority'))
  }
  if (authoritySchemaErrors.length === 0 && learnerSchemaErrors.length === 0 && adultSchemaErrors.length === 0) findings.push(...contradictionFindings(canonicalLearner(authority), derivedLearner(learnerRecord), derivedAdult(adultRecord)))

  const deduplicated = [...new Map(findings.map((item) => [`${item.classification}:${item.code}:${item.message}`, item])).values()]
  return {
    status: deduplicated.length === 0 ? 'CONSISTENT' : 'CONFLICT',
    classifications: [...new Set(deduplicated.map((item) => item.classification))],
    findings: deduplicated,
  }
}

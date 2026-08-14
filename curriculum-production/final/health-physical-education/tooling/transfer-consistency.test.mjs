import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADULT_VISIBLE_SEMANTIC_FIELDS,
  buildAdultTransferSemantics,
  buildLearnerTransferSemantics,
  evaluatePeTransferConsistency,
  LEARNER_VISIBLE_SEMANTIC_FIELDS,
  semanticDigest,
  SOURCE_ADULT_SEMANTIC_FIELDS,
  SOURCE_LEARNER_SEMANTIC_FIELDS,
  TRANSFER_AUTHORITY_SCHEMA,
} from '../src/lib/transferConsistency.mjs'

function authority() {
  const evidence = ['CUE', 'DECISION', 'TRANSFER_CONDITION']
  return {
    schemaVersion: TRANSFER_AUTHORITY_SCHEMA,
    authorityId: 'fixture-transfer-v3',
    learnerTask: {
      actionId: 'fixture:apply',
      actionKind: 'APPLY_OR_FULLY_MODEL',
      focusId: 'fixture:focus',
      executionRequired: false,
    },
    durationContinuity: {
      span: { unit: 'SESSION', minimum: 1, coverage: 'COMPLETE_REQUIRED_SPAN' },
      uninterruptedPerformanceRequired: false,
      interruptionRecoveryRequired: false,
    },
    restInterruptionAllowance: {
      restAllowed: true,
      restPreservesParticipationCredit: true,
      transferCreditAfterRest: 'PRESERVED_WHEN_REQUIRED_EVIDENCE_IS_MET',
    },
    transferRequirement: { required: true, conditionId: 'fixture-transfer-v3:condition' },
    completionEvidence: {
      completionKind: 'PERFORM_OR_FULLY_MODEL_COMPLETE_SPAN',
      hypotheticalCompletionAllowed: true,
      requiredEvidenceIds: evidence,
      maximumCreditableSpan: { unit: 'SESSION', maximum: 1 },
    },
    equalCreditPath: {
      routes: ['ADAPTED_PERFORMANCE', 'DIAGRAMMED_MODEL', 'PERFORMED'],
      sameEvidenceRequired: true,
      requiredEvidenceIds: evidence,
    },
    adultRubric: {
      scoringAuthority: 'RUBRIC',
      requiredEvidenceIds: evidence,
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

function bindSource(authorityRecord, sourceLesson) {
  authorityRecord.sourceFieldBindings = {
    algorithm: 'SHA-256',
    learnerFields: Object.fromEntries(SOURCE_LEARNER_SEMANTIC_FIELDS.map((field) => [field, semanticDigest(sourceLesson[field])])),
    adultFields: Object.fromEntries(SOURCE_ADULT_SEMANTIC_FIELDS.map((field) => [field, semanticDigest(sourceLesson[field])])),
  }
}

function fixture() {
  const sourceLesson = {
    lesson_id: 'ma-g9-physical-education-u01-l07',
    grade: 9,
    unit_number: 1,
    day_in_unit: 7,
    focus: 'a safe transfer focus',
    transfer_condition: 'apply the focus under the authored transfer condition',
    transfer_evidence_requirement: null,
    student_activity: 'Apply or fully model the complete required span; rest safely and preserve the required evidence.',
    formative_check: 'Name the cue, decision, comparison, and revision evidence.',
    success_criteria: ['Credit the complete required span and the stated transfer evidence.'],
    answer_or_scoring_guidance: 'Rest is allowed; full transfer credit still requires every evidence item.',
    adaptive_tutor_routes: [{ signal: 'rest', action: 'Preserve participation credit and re-attempt transfer evidence safely.' }],
    guardian_safety: { guardian_confirmation_required: false },
    safety_and_privacy: ['Never score body metrics or participant count.'],
    transfer_authority: authority(),
  }
  bindSource(sourceLesson.transfer_authority, sourceLesson)
  const learnerPackage = {
    lessonId: sourceLesson.lesson_id,
    studentTask: sourceLesson.student_activity,
    completionCriteria: ['Complete the span and provide every required evidence item.'],
    activitySteps: ['Apply or fully model the task safely.'],
    safetyRules: ['Rest whenever safety or control requires it without losing participation credit.'],
    stoppingRules: ['Stop for pain, dizziness, breathing difficulty, head impact, or unsafe conditions.'],
    adaptationChoices: 'An adapted or fully modeled route earns equal credit with the same evidence.',
    accessibleAdaptation: 'Use a seated, supported, described, or reduced-range route with the same evidence.',
    lowSpaceNoEquipmentAlternative: 'Use a no-equipment model with the same evidence.',
    equipmentRequirements: { required: [], equalCreditNoEquipment: 'Same evidence and credit.' },
  }
  const adultGuide = {
    lessonId: sourceLesson.lesson_id,
    successCriteria: sourceLesson.success_criteria,
    scoringGuidance: sourceLesson.answer_or_scoring_guidance,
    masteryRule: 'Use transfer evidence on more than one occasion.',
    adaptiveRoutes: sourceLesson.adaptive_tutor_routes,
    guardianOrParentVisibility: 'Share completion and evidence type, never private body data.',
    guardianSafetyReview: sourceLesson.guardian_safety,
    safetyAndPrivacyNotes: sourceLesson.safety_and_privacy,
  }
  learnerPackage.transferTask = buildLearnerTransferSemantics(sourceLesson.transfer_authority, learnerPackage)
  adultGuide.transferRubric = buildAdultTransferSemantics(sourceLesson.transfer_authority, adultGuide)
  return { sourceLesson, learnerPackage, adultGuide }
}

function evaluate(value) {
  return evaluatePeTransferConsistency(value)
}

test('valid canonical, learner, and adult independent derivations pass', () => {
  assert.equal(evaluate(fixture()).status, 'CONSISTENT')
})

const wordingAttacks = [
  {
    name: 'learner uninterrupted while adult gives rest credit',
    mutate(value) {
      value.learnerPackage.studentTask = 'Carry the routine from its opening motion to its finish in one continuous effort; breaking the sequence voids the evidence.'
    },
  },
  {
    name: 'learner permits rest while adult requires uninterrupted performance',
    mutate(value) {
      value.adultGuide.scoringGuidance = 'Judge only a single unbroken stretch; any recovery interval cancels the result.'
    },
  },
  {
    name: 'seven distinct days while adult accepts one-day hypothetical plan',
    mutate(value) {
      value.learnerPackage.studentTask = 'Carry out the plan on each of seven separate dates.'
      value.adultGuide.successCriteria = ['An imagined schedule drafted this afternoon completes the work.']
    },
  },
  {
    name: 'hypothetical learner plan while rubric requires seven-day execution',
    mutate(value) {
      value.learnerPackage.completionCriteria = ['One speculative write-up produced in a single sitting earns completion.']
      value.adultGuide.scoringGuidance = 'Credit only enactment on seven separate calendar days.'
    },
  },
]

for (const attack of wordingAttacks) {
  test(`visible prose contradiction fails with unchanged semantic metadata: ${attack.name}`, () => {
    const value = fixture()
    const canonicalBefore = structuredClone(value.sourceLesson.transfer_authority)
    const learnerMetadataBefore = structuredClone(value.learnerPackage.transferTask)
    const adultMetadataBefore = structuredClone(value.adultGuide.transferRubric)
    attack.mutate(value)
    assert.deepEqual(value.sourceLesson.transfer_authority, canonicalBefore)
    assert.deepEqual(value.learnerPackage.transferTask, learnerMetadataBefore)
    assert.deepEqual(value.adultGuide.transferRubric, adultMetadataBefore)
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'VISIBLE_PROSE_BINDING_MISMATCH'))
  })
}

test('paraphrase resistance is content-independent rather than a finite phrase dictionary', () => {
  for (const [index, field] of LEARNER_VISIBLE_SEMANTIC_FIELDS.entries()) {
    const value = fixture()
    value.learnerPackage[field] = `Novel adversarial semantic rewrite ${index}: zephyrs invalidate the authored completion meaning.`
    assert.equal(evaluate(value).status, 'CONFLICT', field)
  }
  for (const [index, field] of ADULT_VISIBLE_SEMANTIC_FIELDS.entries()) {
    const value = fixture()
    value.adultGuide[field] = `Novel adversarial rubric rewrite ${index}: quasar logic reverses adult credit.`
    assert.equal(evaluate(value).status, 'CONFLICT', field)
  }
})

const canonicalRequiredPaths = [
  ['learnerTask', 'focusId'],
  ['durationContinuity', 'span', 'coverage'],
  ['completionEvidence', 'completionKind'],
  ['equalCreditPath', 'requiredEvidenceIds'],
  ['adultRubric', 'requiredEvidenceIds'],
]

for (const path of canonicalRequiredPaths) {
  test(`canonical required field removal fails closed: ${path.join('.')}`, () => {
    const value = fixture()
    let target = value.sourceLesson.transfer_authority
    for (const segment of path.slice(0, -1)) target = target[segment]
    delete target[path.at(-1)]
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'SEMANTIC_SCHEMA_INVALID'))
  })
}

const derivedRequiredPaths = [
  ['learnerPackage', 'transferTask', 'task', 'focusKey'],
  ['learnerPackage', 'transferTask', 'spanRequirement', 'minimumCount'],
  ['learnerPackage', 'transferTask', 'completion', 'completionType'],
  ['learnerPackage', 'transferTask', 'equalCredit', 'evidenceKeys'],
  ['adultGuide', 'transferRubric', 'rubricEvidence', 'evidenceKeys'],
  ['adultGuide', 'transferRubric', 'completionJudgment', 'creditableSpan'],
]

for (const path of derivedRequiredPaths) {
  test(`derived required field removal fails closed: ${path.slice(2).join('.')}`, () => {
    const value = fixture()
    let target = value
    for (const segment of path.slice(0, -1)) target = target[segment]
    delete target[path.at(-1)]
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'SEMANTIC_SCHEMA_INVALID'))
  })
}

const structuredMutations = [
  ['duration', (value) => { value.learnerPackage.transferTask.spanRequirement.minimumCount = 2 }],
  ['continuity', (value) => { value.adultGuide.transferRubric.requiredSpan.uninterruptedRequired = true }],
  ['rest', (value) => { value.learnerPackage.transferTask.restRule.participationCreditPreserved = false }],
  ['evidence ids', (value) => { value.learnerPackage.transferTask.completion.evidenceKeys = ['CUE'] }],
  ['completion kind', (value) => { value.learnerPackage.transferTask.completion.completionType = 'UNKNOWN_COMPLETION' }],
  ['equal-credit route', (value) => { value.adultGuide.transferRubric.equalCreditJudgment.paths = ['PERFORMED'] }],
  ['adult required evidence', (value) => { value.adultGuide.transferRubric.rubricEvidence.evidenceKeys = ['CUE'] }],
]

for (const [name, mutate] of structuredMutations) {
  test(`structured semantic mutation conflicts with unchanged canonical authority: ${name}`, () => {
    const value = fixture()
    mutate(value)
    assert.equal(evaluate(value).status, 'CONFLICT')
  })
}

test('wrong type, unknown enum, and unknown extra field fail the executable schemas', () => {
  for (const mutate of [
    (value) => { value.learnerPackage.transferTask.spanRequirement.minimumCount = '1' },
    (value) => { value.sourceLesson.transfer_authority.durationContinuity.span.unit = 'FORTNIGHTISH' },
    (value) => { value.adultGuide.transferRubric.rubricEvidence.unrecognized = true },
  ]) {
    const value = fixture()
    mutate(value)
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'SEMANTIC_SCHEMA_INVALID'))
  }
})

test('missing learner or adult derivation fails closed', () => {
  for (const channel of ['learner', 'adult']) {
    const value = fixture()
    if (channel === 'learner') delete value.learnerPackage.transferTask
    else delete value.adultGuide.transferRubric
    const result = evaluate(value)
    assert.equal(result.status, 'CONFLICT')
    assert.ok(result.findings.some((item) => item.code === 'SEMANTIC_RECORD_MISSING'))
  }
})

test('valid equal-credit and fully modeled complete-span routes pass', () => {
  const value = fixture()
  assert.ok(value.learnerPackage.transferTask.equalCredit.paths.includes('DIAGRAMMED_MODEL'))
  assert.equal(evaluate(value).status, 'CONSISTENT')
})

test('historical false-positive wording remains valid', () => {
  const value = fixture()
  value.sourceLesson.transfer_condition = 'in a full session the learner runs start to finish without prompting, in a space and on a day they did not choose'
  value.sourceLesson.transfer_authority.sourceFieldBindings.learnerFields.transfer_condition = semanticDigest(value.sourceLesson.transfer_condition)
  assert.equal(evaluate(value).status, 'CONSISTENT')
})

test('lesson number and location changes have no semantic effect', () => {
  const original = fixture()
  const moved = structuredClone(original)
  moved.sourceLesson.lesson_id = 'ma-g12-physical-education-u09-l01'
  moved.sourceLesson.grade = 12
  moved.sourceLesson.unit_number = 9
  moved.sourceLesson.day_in_unit = 1
  moved.learnerPackage.lessonId = moved.sourceLesson.lesson_id
  moved.adultGuide.lessonId = moved.sourceLesson.lesson_id
  assert.deepEqual(evaluate(moved), evaluate(original))
})

import {
  FIXTURE_NOW,
  MASTERY_SCHEMA_VERSION,
  MASTERY_STATES,
  MATH_SKILL_IDS,
  applyManualOverride,
  asMasteryRecordId,
  asOverrideAuditEntryId,
  asOverrideId,
  evaluateMastery,
  masteryDemoFixture,
  revokeManualOverride,
  sampleMathGraph,
  seedMasteryEvidence,
  seedStudentId,
  validateMasteryEvidence,
  validateMasteryPayload,
  validateSkillGraph,
  validateStudentSkillMastery,
  type ManualMasteryOverride,
  type SkillGraph,
} from '../index.ts'

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

for (const graph of masteryDemoFixture.graphs) {
  const result = validateSkillGraph(graph)
  check(result.ok, `Fixture graph ${graph.id} failed runtime validation.`)
}

for (const evidence of seedMasteryEvidence) {
  const result = validateMasteryEvidence(evidence)
  check(result.ok, `Fixture evidence ${evidence.id} failed runtime validation.`)
}

for (const record of masteryDemoFixture.records) {
  const result = validateStudentSkillMastery(record)
  check(result.ok, `Fixture mastery record ${record.id} failed runtime validation.`)
}

const fixtureStates = new Set(
  masteryDemoFixture.records.map(({ state }) => state),
)
for (const requiredState of MASTERY_STATES) {
  check(
    fixtureStates.has(requiredState),
    `Fixture set does not exercise ${requiredState}.`,
  )
}

const cyclicGraph: SkillGraph = {
  ...sampleMathGraph,
  id: sampleMathGraph.id,
  revision: sampleMathGraph.revision + 1,
  prerequisites: [
    ...sampleMathGraph.prerequisites,
    {
      prerequisiteSkillId: MATH_SKILL_IDS.compareFractions,
      dependentSkillId: MATH_SKILL_IDS.equivalentFractions,
      relation: 'required',
      rationale: 'Deliberately invalid reverse edge for the validation gate.',
    },
  ],
}
const cyclicResult = validateSkillGraph(cyclicGraph)
check(!cyclicResult.ok, 'Circular graph was accepted.')
check(
  cyclicResult.issues.some(({ code }) => code === 'circular_dependency'),
  'Circular graph did not return a circular_dependency issue.',
)

const placeValueAssessments = seedMasteryEvidence.filter(
  (evidence) =>
    evidence.skillId === MATH_SKILL_IDS.placeValue &&
    evidence.kind === 'assessment_attempt',
)
const completionOnlyRecord = evaluateMastery({
  recordId: asMasteryRecordId('record:p1:completion-only-check'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.placeValue,
  graph: sampleMathGraph,
  evidence: placeValueAssessments,
  evaluatedAt: FIXTURE_NOW,
})
check(
  completionOnlyRecord.state !== 'mastered',
  'Assessment completion alone incorrectly produced mastery.',
)
check(
  completionOnlyRecord.lastIndependentDemonstrationAt === undefined,
  'Assessment completion fabricated an independent demonstration timestamp.',
)

const baseOverrideRecord = masteryDemoFixture.records.find(
  ({ skillId }) => skillId === MATH_SKILL_IDS.shapeAttributes,
)
check(baseOverrideRecord, 'Override fixture record was not found.')
const override: ManualMasteryOverride = {
  kind: 'manual_mastery_override',
  schemaVersion: MASTERY_SCHEMA_VERSION,
  id: asOverrideId('override:validation-parent'),
  studentId: seedStudentId,
  skillId: MATH_SKILL_IDS.shapeAttributes,
  state: 'mastered',
  reason: 'Parent confirmed an external independent portfolio demonstration.',
  actor: { role: 'parent', actorId: 'parent:fixture' },
  createdAt: '2026-07-28T15:00:00.000Z',
}
const overridden = applyManualOverride(
  baseOverrideRecord,
  override,
  asOverrideAuditEntryId('audit:validation-apply'),
)
check(overridden.state === 'mastered', 'Manual override did not set effective state.')
check(
  overridden.computedState === 'not_yet_assessed',
  'Manual override mutated the computed evidence state.',
)
check(
  overridden.lastIndependentDemonstrationAt === undefined,
  'Manual override fabricated independent performance.',
)
check(
  overridden.overrideAuditHistory.length ===
    baseOverrideRecord.overrideAuditHistory.length + 1,
  'Manual override did not append an audit entry.',
)

const revoked = revokeManualOverride(overridden, {
  auditEntryId: asOverrideAuditEntryId('audit:validation-revoke'),
  actor: { role: 'parent', actorId: 'parent:fixture' },
  at: '2026-07-28T16:00:00.000Z',
  reason: 'Return the visible state to the evidence engine.',
})
check(
  revoked.state === revoked.computedState,
  'Revocation did not restore the computed state.',
)
check(
  revoked.overrideAuditHistory.length ===
    overridden.overrideAuditHistory.length + 1,
  'Revocation did not preserve and append audit history.',
)

const assessmentFixture = seedMasteryEvidence.find(
  ({ kind }) => kind === 'assessment_attempt',
)
check(assessmentFixture, 'Assessment fixture was not found.')
const privacyMutation = {
  ...assessmentFixture,
  rawAnswer: 'student response must never cross this boundary',
}
const privacyResult = validateMasteryPayload(privacyMutation)
check(!privacyResult.ok, 'Unknown raw-answer property was accepted.')
check(
  privacyResult.issues.some(({ code }) => code === 'unknown_property'),
  'Raw-answer rejection did not identify the unknown property.',
)

const futureVersionResult = validateMasteryPayload({
  ...sampleMathGraph,
  schemaVersion: 2,
})
check(!futureVersionResult.ok, 'Future schema version was accepted.')
check(
  futureVersionResult.issues.some(
    ({ code }) => code === 'unsupported_schema_version',
  ),
  'Future version rejection did not identify schema incompatibility.',
)

console.log(
  JSON.stringify(
    {
      status: 'passed',
      graphsValidated: masteryDemoFixture.graphs.length,
      evidenceValidated: seedMasteryEvidence.length,
      recordsValidated: masteryDemoFixture.records.length,
      statesCovered: [...fixtureStates].sort(),
      circularGraphRejected: true,
      completionAloneRejected: true,
      overrideAuditVerified: true,
      unknownPropertyRejected: true,
      futureVersionRejected: true,
    },
    null,
    2,
  ),
)


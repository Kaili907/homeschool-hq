import { describe, expect, it } from 'vitest'
import {
  MASTERY_SCHEMA_VERSION,
  MATH_SKILL_IDS,
  asAssessmentAttemptId,
  asEvidenceId,
  asIndependentDemonstrationId,
  asMasteryRecordId,
  evaluateMastery,
  masteryDemoFixture,
  sampleMathGraph,
  seedStudentId,
  validateSkillGraph,
  type AssessmentAttemptEvidence,
  type IndependentDemonstrationEvidence,
  type MasteryEvidence,
  type SkillId,
} from '../../../adaptive-learning/mastery/index.ts'
import { authorizeLearnerMasteryRoute } from './access'
import {
  NON_EVIDENCE_HOST_SIGNAL_KINDS,
  ignoreUnsupportedHostProgressSignal,
  mergeMasteryEvidenceForReplay,
} from './evidenceBoundary'
import { buildLearnerMasteryDashboard } from './model'

function evidencePair(
  token: string,
  skillId: SkillId,
  capturedAt: string,
): readonly [AssessmentAttemptEvidence, IndependentDemonstrationEvidence] {
  const attempt: AssessmentAttemptEvidence = {
    kind: 'assessment_attempt',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`host:${token}:assessment`),
    attemptId: asAssessmentAttemptId(`host:${token}:attempt`),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `host:${token}:session`,
    quality: 'reliable',
    assessmentType: 'retrieval',
    scoringStatus: 'scored',
    attemptedItemCount: 5,
    correctItemCount: 5,
    supportLevel: 'independent',
  }
  const demonstration: IndependentDemonstrationEvidence = {
    kind: 'independent_demonstration',
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`host:${token}:independent`),
    demonstrationId: asIndependentDemonstrationId(
      `host:${token}:demonstration`,
    ),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `host:${token}:session`,
    quality: 'reliable',
    context: 'retrieval',
    supportLevel: 'independent',
    attemptedItemCount: 5,
    correctItemCount: 5,
    criterion: {
      criterionId: 'host:criterion:independent-80',
      minimumAccuracy: 0.8,
      minimumItemCount: 4,
    },
    outcome: 'successful',
    taskNovelty: 'new_items',
    sourceEvidenceIds: [attempt.id],
  }
  return [attempt, demonstration]
}

function evaluateFoundation(evidence: readonly MasteryEvidence[]) {
  return evaluateMastery({
    recordId: asMasteryRecordId('host:record:foundation'),
    studentId: seedStudentId,
    skillId: MATH_SKILL_IDS.shapeAttributes,
    graph: sampleMathGraph,
    evidence,
    evaluatedAt: '2026-07-29T18:00:00.000Z',
  })
}

function graphPayload() {
  return {
    kind: 'mastery-skill-graph',
    schemaVersion: 1,
    id: 'host:graph',
    revision: 1,
    subjectId: 'host:subject',
    title: 'Host validation graph',
    skills: [
      {
        id: 'host:a',
        subjectId: 'host:subject',
        title: 'A',
        learningObjective: 'Demonstrate A independently.',
        description: 'A',
        gradeBand: 'middle-6-8',
        domain: 'test',
      },
      {
        id: 'host:b',
        subjectId: 'host:subject',
        title: 'B',
        learningObjective: 'Demonstrate B independently.',
        description: 'B',
        gradeBand: 'middle-6-8',
        domain: 'test',
      },
    ],
    prerequisites: [] as Record<string, unknown>[],
  }
}

describe('Session 5 independent mastery probes', () => {
  it('never translates completion, attendance, transfer, schedule, adult, or UI state into evidence', () => {
    for (const kind of NON_EVIDENCE_HOST_SIGNAL_KINDS) {
      expect(ignoreUnsupportedHostProgressSignal({ kind, value: true })).toEqual(
        [],
      )
    }
  })

  it('does not produce mastery from same-day independent demonstrations', () => {
    const evidence = [
      ...evidencePair(
        'same-day-one',
        MATH_SKILL_IDS.shapeAttributes,
        '2026-07-28T13:00:00.000Z',
      ),
      ...evidencePair(
        'same-day-two',
        MATH_SKILL_IDS.shapeAttributes,
        '2026-07-28T20:00:00.000Z',
      ),
    ]

    expect(evaluateFoundation(evidence).computedState).not.toBe('mastered')
  })

  it('allows the engine to master after distinct qualifying days', () => {
    const evidence = [
      ...evidencePair(
        'distinct-one',
        MATH_SKILL_IDS.shapeAttributes,
        '2026-07-27T13:00:00.000Z',
      ),
      ...evidencePair(
        'distinct-two',
        MATH_SKILL_IDS.shapeAttributes,
        '2026-07-28T20:00:00.000Z',
      ),
    ]

    expect(evaluateFoundation(evidence).computedState).toBe('mastered')
  })

  it('rejects a self-referential prerequisite', () => {
    const payload = graphPayload()
    payload.prerequisites = [
      {
        prerequisiteSkillId: 'host:a',
        dependentSkillId: 'host:a',
        relation: 'required',
        rationale: 'Invalid self edge.',
      },
    ]

    expect(validateSkillGraph(payload).ok).toBe(false)
  })

  it('rejects a cyclic prerequisite graph', () => {
    const payload = graphPayload()
    payload.prerequisites = [
      {
        prerequisiteSkillId: 'host:a',
        dependentSkillId: 'host:b',
        relation: 'required',
        rationale: 'A before B.',
      },
      {
        prerequisiteSkillId: 'host:b',
        dependentSkillId: 'host:a',
        relation: 'required',
        rationale: 'Invalid B before A cycle.',
      },
    ]

    expect(validateSkillGraph(payload).ok).toBe(false)
  })

  it('rejects cross-learner projection and learner-scope mismatches', () => {
    expect(() =>
      buildLearnerMasteryDashboard(
        { id: 'different-learner', name: 'Other', grade: '6' },
        {
          generatedAt: '2026-07-29T18:00:00.000Z',
          graphs: masteryDemoFixture.graphs,
          masteryRecords: masteryDemoFixture.records,
          explanations: masteryDemoFixture.explanations,
        },
      ),
    ).toThrow(/different student/)

    expect(
      authorizeLearnerMasteryRoute(
        { kind: 'learner', learnerId: 'p1' },
        'p2',
        'p2',
      ),
    ).toEqual({ allowed: false, reason: 'learner_scope_mismatch' })
    expect(
      authorizeLearnerMasteryRoute(
        { kind: 'learner', learnerId: 'p1' },
        'p1',
        'p2',
      ),
    ).toEqual({ allowed: false, reason: 'learner_scope_mismatch' })
  })

  it('fails closed for stale, unauthenticated, and adult learner-route access', () => {
    expect(authorizeLearnerMasteryRoute(null, 'p1', 'p1')).toEqual({
      allowed: false,
      reason: 'unauthenticated',
    })
    expect(
      authorizeLearnerMasteryRoute(
        { kind: 'adult', actorId: 'parent' },
        'p1',
        'p1',
      ),
    ).toEqual({ allowed: false, reason: 'learner_route_only' })
  })

  it('treats refresh and navigation evidence replays as idempotent', () => {
    const evidence = evidencePair(
      'replay',
      MATH_SKILL_IDS.shapeAttributes,
      '2026-07-28T13:00:00.000Z',
    )
    const first = mergeMasteryEvidenceForReplay(
      seedStudentId,
      [],
      evidence,
    )
    const afterRefresh = mergeMasteryEvidenceForReplay(
      seedStudentId,
      first,
      evidence,
    )
    const afterNavigation = mergeMasteryEvidenceForReplay(
      seedStudentId,
      afterRefresh,
      evidence,
    )

    expect(afterRefresh).toHaveLength(evidence.length)
    expect(afterNavigation).toEqual(first)
  })
})

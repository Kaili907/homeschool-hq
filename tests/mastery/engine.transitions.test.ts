import { describe, expect, it } from "vitest";
import {
  ENGLISH_SKILL_IDS,
  FIXTURE_NOW,
  MASTERY_SCHEMA_VERSION,
  MASTERY_STATES,
  MASTERY_TRANSITION_RULES,
  MATH_SKILL_IDS,
  MasteryValidationError,
  applyManualOverride,
  asAssessmentAttemptId,
  asEvidenceId,
  asIndependentDemonstrationId,
  asMasteryRecordId,
  asOverrideAuditEntryId,
  asOverrideId,
  evaluateMastery,
  expireManualOverride,
  explainMastery,
  masteryDemoFixture,
  revokeManualOverride,
  sampleEnglishGraph,
  sampleMathGraph,
  seedMasteryEvidence,
  seedMasteryExplanations,
  seedStudentId,
  seedStudentMasteryRecords,
  validateMasteryEvidence,
  validateMasteryTransition,
  validateSkillGraph,
  validateStudentSkillMastery,
  type AssessmentAttemptEvidence,
  type IndependentDemonstrationEvidence,
  type ManualMasteryOverride,
  type MasteryEvidence,
  type MasteryState,
  type SkillId,
} from "../../adaptive-learning/mastery/index.ts";

function assessment(
  token: string,
  skillId: SkillId,
  capturedAt: string,
  correctItemCount = 5,
  attemptedItemCount = 5,
): AssessmentAttemptEvidence {
  return {
    kind: "assessment_attempt",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`test:${token}:assessment`),
    attemptId: asAssessmentAttemptId(`test:${token}:attempt`),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `test:${token}:session`,
    quality: "reliable",
    assessmentType: "retrieval",
    scoringStatus: "scored",
    attemptedItemCount,
    correctItemCount,
    supportLevel: "independent",
  };
}

function evidencePair(
  token: string,
  skillId: SkillId,
  capturedAt: string,
  options: {
    readonly correctItemCount?: number;
    readonly outcome?: IndependentDemonstrationEvidence["outcome"];
    readonly taskNovelty?: IndependentDemonstrationEvidence["taskNovelty"];
  } = {},
): readonly [AssessmentAttemptEvidence, IndependentDemonstrationEvidence] {
  const correctItemCount = options.correctItemCount ?? 5;
  const attemptedItemCount = 5;
  const attempt = assessment(
    token,
    skillId,
    capturedAt,
    correctItemCount,
    attemptedItemCount,
  );
  const demonstration: IndependentDemonstrationEvidence = {
    kind: "independent_demonstration",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: asEvidenceId(`test:${token}:independent`),
    demonstrationId: asIndependentDemonstrationId(
      `test:${token}:demonstration`,
    ),
    studentId: seedStudentId,
    skillId,
    capturedAt,
    sourceRef: `test:${token}:session`,
    quality: "reliable",
    context: "retrieval",
    supportLevel: "independent",
    attemptedItemCount,
    correctItemCount,
    criterion: {
      criterionId: "test:criterion:independent-80",
      minimumAccuracy: 0.8,
      minimumItemCount: 4,
    },
    outcome:
      options.outcome ??
      (correctItemCount / attemptedItemCount >= 0.8
        ? "successful"
        : "unsuccessful"),
    taskNovelty: options.taskNovelty ?? "new_items",
    sourceEvidenceIds: [attempt.id],
  };
  return [attempt, demonstration];
}

function evaluateFoundation(
  token: string,
  evidence: readonly MasteryEvidence[],
  evaluatedAt: string,
  previous?: ReturnType<typeof evaluateMastery>,
) {
  return evaluateMastery({
    recordId: asMasteryRecordId(`test:record:${token}`),
    studentId: seedStudentId,
    skillId: MATH_SKILL_IDS.shapeAttributes,
    graph: sampleMathGraph,
    evidence,
    evaluatedAt,
    previous,
  });
}

function recordFor(skillId: SkillId) {
  const record = seedStudentMasteryRecords.find(
    (candidate) => candidate.skillId === skillId,
  );
  if (!record) throw new Error(`Missing fixture record for ${skillId}.`);
  return record;
}

describe("seed graph and state coverage", () => {
  it("validates both sample graphs, every evidence item, and every seed record", () => {
    expect(validateSkillGraph(sampleMathGraph).ok).toBe(true);
    expect(validateSkillGraph(sampleEnglishGraph).ok).toBe(true);
    for (const evidence of seedMasteryEvidence) {
      expect(validateMasteryEvidence(evidence)).toMatchObject({
        ok: true,
        issues: [],
      });
    }
    for (const record of seedStudentMasteryRecords) {
      expect(validateStudentSkillMastery(record)).toMatchObject({
        ok: true,
        issues: [],
      });
    }
    expect(masteryDemoFixture.records).toBe(seedStudentMasteryRecords);
    expect(seedMasteryExplanations).toHaveLength(
      seedStudentMasteryRecords.length,
    );
  });

  it("derives all six required states through the real evaluator", () => {
    const derivedStates = new Set(
      seedStudentMasteryRecords.map((record) => record.computedState),
    );

    expect(derivedStates).toEqual(new Set(MASTERY_STATES));
    expect(recordFor(MATH_SKILL_IDS.placeValue).computedState).toBe("mastered");
    expect(recordFor(MATH_SKILL_IDS.multiplication).computedState).toBe(
      "needs_reinforcement",
    );
    expect(recordFor(MATH_SKILL_IDS.unitFractions).computedState).toBe(
      "currently_learning",
    );
    expect(recordFor(MATH_SKILL_IDS.equivalentFractions).computedState).toBe(
      "evidence_uncertain",
    );
    expect(recordFor(MATH_SKILL_IDS.compareFractions).computedState).toBe(
      "blocked_by_prerequisite",
    );
    expect(recordFor(MATH_SKILL_IDS.shapeAttributes).computedState).toBe(
      "not_yet_assessed",
    );
  });
});

describe("independent-performance mastery gate", () => {
  it("never infers mastery from a perfect assessment/completion alone", () => {
    const perfectAttempt = assessment(
      "perfect-completion-only",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-27T14:00:00.000Z",
      5,
      5,
    );

    const result = evaluateFoundation(
      "completion-only",
      [perfectAttempt],
      FIXTURE_NOW,
    );

    expect(result.computedState).toBe("currently_learning");
    expect(result.state).toBe("currently_learning");
    expect(result.reasonCodes).toContain(
      "independent_evidence_below_threshold",
    );
    expect(result.lastIndependentDemonstrationAt).toBeUndefined();
    expect(result.nextAction.kind).toBe("continue_adaptive_instruction");
  });

  it("requires repeated successful independent demonstrations on distinct days", () => {
    const first = evidencePair(
      "one-demo",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-26T14:00:00.000Z",
    );
    const oneDemonstration = evaluateFoundation(
      "one-demo",
      first,
      FIXTURE_NOW,
    );
    expect(oneDemonstration.computedState).toBe("currently_learning");

    const second = evidencePair(
      "second-demo",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-27T14:00:00.000Z",
      { taskNovelty: "transfer" },
    );
    const repeated = evaluateFoundation(
      "two-demos",
      [...first, ...second],
      FIXTURE_NOW,
    );
    expect(repeated.computedState).toBe("mastered");
    expect(repeated.reasonCodes).toContain("independent_criterion_met");
  });
});

describe("conflict, decay, reinforcement, and recovery", () => {
  it("keeps results within the conflict window uncertain, then treats a later failure as reinforcement", () => {
    const firstSuccess = evidencePair(
      "conflict-success-1",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-01T14:00:00.000Z",
    );
    const secondSuccess = evidencePair(
      "conflict-success-2",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-10T14:00:00.000Z",
      { taskNovelty: "transfer" },
    );
    const withinWindowFailure = evidencePair(
      "conflict-failure-within",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-17T14:00:00.000Z",
      { correctItemCount: 2, outcome: "unsuccessful" },
    );
    const uncertain = evaluateFoundation(
      "conflict-within",
      [...firstSuccess, ...secondSuccess, ...withinWindowFailure],
      "2026-07-18T14:00:00.000Z",
    );

    expect(uncertain.computedState).toBe("evidence_uncertain");
    expect(uncertain.reasonCodes).toContain(
      "conflicting_independent_results",
    );
    expect(uncertain.nextAction.kind).toBe("resolve_conflicting_evidence");

    const outsideWindowFailure = evidencePair(
      "conflict-failure-outside",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-07-18T14:00:00.000Z",
      { correctItemCount: 2, outcome: "unsuccessful" },
    );
    const reinforce = evaluateFoundation(
      "conflict-outside",
      [...firstSuccess, ...secondSuccess, ...outsideWindowFailure],
      "2026-07-19T14:00:00.000Z",
    );

    expect(reinforce.computedState).toBe("needs_reinforcement");
    expect(reinforce.reasonCodes).toContain("recent_independent_failure");
  });

  it("decays stale mastery and returns to mastery only after fresh independent reinforcement", () => {
    const first = evidencePair(
      "decay-1",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-01-01T14:00:00.000Z",
    );
    const second = evidencePair(
      "decay-2",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-01-05T14:00:00.000Z",
      { taskNovelty: "transfer" },
    );
    const evidence = [...first, ...second];
    const mastered = evaluateFoundation(
      "decay",
      evidence,
      "2026-01-10T14:00:00.000Z",
    );
    expect(mastered.computedState).toBe("mastered");

    const stale = evaluateFoundation(
      "decay",
      evidence,
      "2026-03-01T14:00:00.000Z",
      mastered,
    );
    expect(stale.computedState).toBe("needs_reinforcement");
    expect(stale.reasonCodes).toContain("independent_evidence_stale");
    expect(stale.lastReinforcedAt).toBeUndefined();

    const fresh = evidencePair(
      "decay-recovery",
      MATH_SKILL_IDS.shapeAttributes,
      "2026-03-02T14:00:00.000Z",
      { taskNovelty: "transfer" },
    );
    const recovered = evaluateFoundation(
      "decay",
      [...evidence, ...fresh],
      "2026-03-03T14:00:00.000Z",
      stale,
    );

    expect(recovered.computedState).toBe("mastered");
    expect(recovered.reasonCodes).toContain("reinforcement_succeeded");
    expect(recovered.lastReinforcedAt).toBe("2026-03-02T14:00:00.000Z");
    expect(mastered.computedState).toBe("mastered");
    expect(stale.computedState).toBe("needs_reinforcement");
  });
});

describe("prerequisite blocking and explicit transitions", () => {
  it("blocks on an unmet prerequisite and moves blocked to reinforcement once unblocked", () => {
    const unmetPrerequisite = evaluateMastery({
      recordId: asMasteryRecordId("test:record:unmet-place-value"),
      studentId: seedStudentId,
      skillId: MATH_SKILL_IDS.placeValue,
      graph: sampleMathGraph,
      evidence: [],
      evaluatedAt: FIXTURE_NOW,
    });
    const staleMultiplicationEvidence = seedMasteryEvidence.filter(
      (item) => item.skillId === MATH_SKILL_IDS.multiplication,
    );
    const blocked = evaluateMastery({
      recordId: asMasteryRecordId("test:record:multiplication"),
      studentId: seedStudentId,
      skillId: MATH_SKILL_IDS.multiplication,
      graph: sampleMathGraph,
      evidence: staleMultiplicationEvidence,
      prerequisiteRecords: [unmetPrerequisite],
      evaluatedAt: FIXTURE_NOW,
    });

    expect(blocked.computedState).toBe("blocked_by_prerequisite");
    expect(blocked.prerequisiteStatus).toEqual([
      expect.objectContaining({
        skillId: MATH_SKILL_IDS.placeValue,
        satisfied: false,
      }),
    ]);
    expect(blocked.nextAction.targetSkillIds).toEqual([
      MATH_SKILL_IDS.placeValue,
    ]);

    const unblocked = evaluateMastery({
      recordId: blocked.id,
      studentId: seedStudentId,
      skillId: MATH_SKILL_IDS.multiplication,
      graph: sampleMathGraph,
      evidence: staleMultiplicationEvidence,
      prerequisiteRecords: [recordFor(MATH_SKILL_IDS.placeValue)],
      previous: blocked,
      evaluatedAt: "2026-07-29T14:00:00.000Z",
    });

    expect(unblocked.computedState).toBe("needs_reinforcement");
    expect(unblocked.prerequisiteStatus[0]).toMatchObject({
      state: "mastered",
      satisfied: true,
    });
    expect(
      validateMasteryTransition(
        "blocked_by_prerequisite",
        "needs_reinforcement",
      ).allowed,
    ).toBe(true);
  });

  it("implements the documented evidence transition matrix exactly", () => {
    const expected: Readonly<Record<MasteryState, readonly MasteryState[]>> = {
      not_yet_assessed: [
        "not_yet_assessed",
        "currently_learning",
        "blocked_by_prerequisite",
        "evidence_uncertain",
        "mastered",
        "needs_reinforcement",
      ],
      currently_learning: [
        "currently_learning",
        "mastered",
        "needs_reinforcement",
        "blocked_by_prerequisite",
        "evidence_uncertain",
      ],
      mastered: [
        "mastered",
        "needs_reinforcement",
        "blocked_by_prerequisite",
        "evidence_uncertain",
      ],
      needs_reinforcement: [
        "needs_reinforcement",
        "mastered",
        "currently_learning",
        "blocked_by_prerequisite",
        "evidence_uncertain",
      ],
      blocked_by_prerequisite: [
        "blocked_by_prerequisite",
        "not_yet_assessed",
        "currently_learning",
        "needs_reinforcement",
        "evidence_uncertain",
        "mastered",
      ],
      evidence_uncertain: [
        "evidence_uncertain",
        "not_yet_assessed",
        "currently_learning",
        "needs_reinforcement",
        "blocked_by_prerequisite",
        "mastered",
      ],
    };

    expect(MASTERY_TRANSITION_RULES).toEqual(expected);
    for (const from of MASTERY_STATES) {
      for (const to of MASTERY_STATES) {
        const decision = validateMasteryTransition(from, to);
        expect(decision.allowed, `${from} -> ${to}`).toBe(
          expected[from].includes(to),
        );
        expect(
          validateMasteryTransition(from, to, "manual_override").allowed,
          `manual ${from} -> ${to}`,
        ).toBe(true);
      }
    }
    expect(
      validateMasteryTransition("mastered", "currently_learning"),
    ).toMatchObject({
      allowed: false,
      code: "disallowed_engine_transition",
    });
  });
});

describe("manual parent and teacher override audit", () => {
  function override(
    token: string,
    state: MasteryState,
    actorRole: "parent" | "teacher",
    createdAt: string,
    expiresAt?: string,
  ): ManualMasteryOverride {
    return {
      kind: "manual_mastery_override",
      schemaVersion: MASTERY_SCHEMA_VERSION,
      id: asOverrideId(`test:override:${token}`),
      studentId: seedStudentId,
      skillId: MATH_SKILL_IDS.placeValue,
      state,
      reason: `${actorRole} documented an observed learning need.`,
      actor: {
        role: actorRole,
        actorId: `${actorRole}:validation`,
      },
      createdAt,
      expiresAt,
    };
  }

  it("applies, replaces, and revokes overrides without mutating evidence-derived fields", () => {
    const base = recordFor(MATH_SKILL_IDS.placeValue);
    const baseSnapshot = structuredClone(base);
    const parentApplied = applyManualOverride(
      base,
      override(
        "parent",
        "needs_reinforcement",
        "parent",
        "2026-07-29T14:00:00.000Z",
      ),
      asOverrideAuditEntryId("test:audit:parent-applied"),
    );

    expect(base).toEqual(baseSnapshot);
    expect(parentApplied.state).toBe("needs_reinforcement");
    expect(parentApplied.computedState).toBe("mastered");
    expect(parentApplied.evidence).toBe(base.evidence);
    expect(parentApplied.confidence).toBe(base.confidence);
    expect(parentApplied.lastIndependentDemonstrationAt).toBe(
      base.lastIndependentDemonstrationAt,
    );
    expect(parentApplied.overrideAuditHistory.map((entry) => entry.action)).toEqual(
      ["applied"],
    );

    const teacherApplied = applyManualOverride(
      parentApplied,
      override(
        "teacher",
        "currently_learning",
        "teacher",
        "2026-07-30T14:00:00.000Z",
      ),
      asOverrideAuditEntryId("test:audit:teacher-replaced"),
    );

    expect(parentApplied.overrideAuditHistory).toHaveLength(1);
    expect(teacherApplied.overrideAuditHistory.slice(0, 1)).toEqual(
      parentApplied.overrideAuditHistory,
    );
    expect(teacherApplied.overrideAuditHistory.map((entry) => entry.action)).toEqual(
      ["applied", "replaced"],
    );
    expect(teacherApplied.override?.actor.role).toBe("teacher");
    expect(teacherApplied.evidence).toBe(base.evidence);

    const revoked = revokeManualOverride(teacherApplied, {
      auditEntryId: asOverrideAuditEntryId("test:audit:teacher-revoked"),
      actor: { role: "teacher", actorId: "teacher:validation" },
      at: "2026-07-31T14:00:00.000Z",
      reason: "Fresh independent evidence should control the state again.",
    });

    expect(revoked.override).toBeUndefined();
    expect(revoked.state).toBe(revoked.computedState);
    expect(revoked.state).toBe("mastered");
    expect(revoked.overrideAuditHistory.map((entry) => entry.action)).toEqual([
      "applied",
      "replaced",
      "revoked",
    ]);
    expect(teacherApplied.overrideAuditHistory).toHaveLength(2);
    expect(revoked.evidence).toBe(base.evidence);
  });

  it("expires an override through a system audit event and rejects audit-ID reuse", () => {
    const base = recordFor(MATH_SKILL_IDS.placeValue);
    const expiring = applyManualOverride(
      base,
      override(
        "expiring-parent",
        "evidence_uncertain",
        "parent",
        "2026-07-29T14:00:00.000Z",
        "2026-07-30T14:00:00.000Z",
      ),
      asOverrideAuditEntryId("test:audit:expiring-applied"),
    );
    const expired = expireManualOverride(expiring, {
      auditEntryId: asOverrideAuditEntryId("test:audit:expired"),
      at: "2026-07-30T14:00:00.000Z",
      systemActorId: "test:mastery-system",
    });

    expect(expired.override).toBeUndefined();
    expect(expired.state).toBe("mastered");
    expect(expired.overrideAuditHistory.map((entry) => entry.action)).toEqual([
      "applied",
      "expired",
    ]);
    expect(expired.overrideAuditHistory.at(-1)?.actor).toEqual({
      role: "system",
      actorId: "test:mastery-system",
    });
    expect(expiring.overrideAuditHistory).toHaveLength(1);
    expect(expired.evidence).toBe(base.evidence);

    expect(() =>
      applyManualOverride(
        expiring,
        override(
          "duplicate-audit",
          "currently_learning",
          "teacher",
          "2026-07-30T15:00:00.000Z",
        ),
        asOverrideAuditEntryId("test:audit:expiring-applied"),
      ),
    ).toThrow(MasteryValidationError);
  });
});

describe("skill-detail explanation projection", () => {
  it("provides learning, blocker, evidence, confidence, next action, and independent date answers", () => {
    const blocked = recordFor(MATH_SKILL_IDS.compareFractions);
    const explanation = explainMastery(blocked, sampleMathGraph);

    expect(explanation.learningObjective).toBeTruthy();
    expect(explanation.blockingPrerequisites).toEqual([
      expect.objectContaining({
        skillId: MATH_SKILL_IDS.equivalentFractions,
        state: "evidence_uncertain",
      }),
    ]);
    expect(explanation.evidence).toEqual([]);
    expect(explanation.confidenceSummary).toContain("confidence");
    expect(explanation.nextAction.kind).toBe("reteach_prerequisite");
    expect(explanation.lastIndependentDemonstrationSummary).toBe(
      "No successful independent demonstration has been recorded.",
    );

    const mastered = explainMastery(
      recordFor(ENGLISH_SKILL_IDS.centralIdea),
      sampleEnglishGraph,
    );
    expect(mastered.lastIndependentDemonstrationAt).toBeTruthy();
  });
});

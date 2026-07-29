import { describe, expect, it } from "vitest";
import {
  MASTERY_SCHEMA_VERSION,
  validateManualMasteryOverride,
  validateMasteryEvidence,
  validateMasteryPayload,
} from "../../adaptive-learning/mastery/index.ts";

function issueCodes(result: {
  readonly issues: readonly { readonly code: string }[];
}): string[] {
  return result.issues.map((issue) => issue.code);
}

function assessmentPayload(): Record<string, unknown> {
  return {
    kind: "assessment_attempt",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: "evidence.assessment.1",
    studentId: "student.validation",
    skillId: "math.fractions",
    capturedAt: "2026-07-20T14:00:00.000Z",
    sourceRef: "assessment/session-1",
    quality: "reliable",
    attemptId: "attempt.1",
    assessmentType: "formative",
    scoringStatus: "scored",
    attemptedItemCount: 10,
    correctItemCount: 10,
    supportLevel: "independent",
  };
}

function tutorPayload(): Record<string, unknown> {
  return {
    kind: "tutor_intervention",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: "evidence.tutor.1",
    studentId: "student.validation",
    skillId: "math.fractions",
    capturedAt: "2026-07-21T14:00:00.000Z",
    sourceRef: "tutor/session-1",
    quality: "reliable",
    interventionId: "intervention.1",
    interventionType: "hint",
    supportLevel: "guided",
    outcome: "resolved_with_support",
  };
}

function independentPayload(): Record<string, unknown> {
  return {
    kind: "independent_demonstration",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: "evidence.independent.1",
    studentId: "student.validation",
    skillId: "math.fractions",
    capturedAt: "2026-07-22T14:00:00.000Z",
    sourceRef: "retrieval/session-1",
    quality: "reliable",
    demonstrationId: "demonstration.1",
    context: "retrieval",
    supportLevel: "independent",
    attemptedItemCount: 8,
    correctItemCount: 7,
    criterion: {
      criterionId: "criterion.fractions.v1",
      minimumAccuracy: 0.8,
      minimumItemCount: 5,
    },
    outcome: "successful",
    taskNovelty: "new_items",
    sourceEvidenceIds: ["evidence.assessment.1"],
  };
}

function overridePayload(): Record<string, unknown> {
  return {
    kind: "manual_mastery_override",
    schemaVersion: MASTERY_SCHEMA_VERSION,
    id: "override.1",
    studentId: "student.validation",
    skillId: "math.fractions",
    state: "needs_reinforcement",
    reason: "Parent observed a gap during independent homework.",
    actor: {
      role: "parent",
      actorId: "parent.validation",
    },
    createdAt: "2026-07-23T14:00:00.000Z",
    expiresAt: "2026-08-23T14:00:00.000Z",
  };
}

describe("mastery runtime validation boundary", () => {
  it.each([
    assessmentPayload(),
    tutorPayload(),
    independentPayload(),
    overridePayload(),
  ])("accepts a JSON-round-tripped supported payload", (payload) => {
    const wirePayload = JSON.parse(JSON.stringify(payload)) as unknown;
    expect(validateMasteryPayload(wirePayload)).toMatchObject({
      ok: true,
      issues: [],
    });
  });

  it("rejects future schema versions before attempting interpretation", () => {
    const result = validateMasteryPayload({
      ...assessmentPayload(),
      schemaVersion: MASTERY_SCHEMA_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toEqual(["unsupported_schema_version"]);
  });

  it("rejects an unknown top-level payload kind", () => {
    const result = validateMasteryPayload({
      ...assessmentPayload(),
      kind: "future_evidence_kind",
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("unknown_payload_kind");
  });

  it("rejects unknown evidence discriminants at the evidence boundary", () => {
    const result = validateMasteryEvidence({
      ...assessmentPayload(),
      kind: "completion_event",
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("unknown_evidence_kind");
  });

  it("rejects unknown properties instead of silently accepting schema drift", () => {
    const result = validateMasteryEvidence({
      ...assessmentPayload(),
      completionPercent: 100,
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("unknown_property");
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: "$.completionPercent",
            code: "unknown_property",
          }),
        ]),
      );
    }
  });

  it("rejects inconsistent counts and unscored claims", () => {
    const excessiveCorrect = validateMasteryEvidence({
      ...assessmentPayload(),
      attemptedItemCount: 4,
      correctItemCount: 5,
    });
    expect(issueCodes(excessiveCorrect)).toContain("count_exceeds_attempts");

    const unscoredWithCorrectCount = validateMasteryEvidence({
      ...assessmentPayload(),
      scoringStatus: "unscored",
    });
    expect(issueCodes(unscoredWithCorrectCount)).toContain(
      "unscored_has_correct_count",
    );
  });

  it("prevents tutor intervention evidence from claiming independence", () => {
    const result = validateMasteryEvidence({
      ...tutorPayload(),
      supportLevel: "independent",
    });

    expect(result.ok).toBe(false);
    expect(issueCodes(result)).toContain("tutor_cannot_be_independent");
  });

  it("enforces independent context, criteria, and unique source references", () => {
    const supported = validateMasteryEvidence({
      ...independentPayload(),
      supportLevel: "guided",
    });
    expect(issueCodes(supported)).toContain("independent_support_required");

    const belowCriterion = validateMasteryEvidence({
      ...independentPayload(),
      correctItemCount: 4,
    });
    expect(issueCodes(belowCriterion)).toContain("criterion_not_met");

    const duplicateSources = validateMasteryEvidence({
      ...independentPayload(),
      sourceEvidenceIds: [
        "evidence.assessment.1",
        "evidence.assessment.1",
      ],
    });
    expect(issueCodes(duplicateSources)).toContain("duplicate_reference");
  });

  it("accepts only parent or teacher manual overrides with valid timing", () => {
    expect(validateManualMasteryOverride(overridePayload()).ok).toBe(true);
    expect(
      validateManualMasteryOverride({
        ...overridePayload(),
        actor: { role: "teacher", actorId: "teacher.validation" },
      }).ok,
    ).toBe(true);

    const studentActor = validateManualMasteryOverride({
      ...overridePayload(),
      actor: { role: "student", actorId: "student.validation" },
    });
    expect(issueCodes(studentActor)).toContain("invalid_actor_role");

    const backwardExpiration = validateManualMasteryOverride({
      ...overridePayload(),
      expiresAt: "2026-07-01T14:00:00.000Z",
    });
    expect(issueCodes(backwardExpiration)).toContain("invalid_expiration");
  });
});

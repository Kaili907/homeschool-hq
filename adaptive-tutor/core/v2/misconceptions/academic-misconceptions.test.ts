import assert from "node:assert/strict";
import test from "node:test";
import type { TSchema } from "../../schema/typebox.js";
import { Value } from "../../schema/value.js";
import { validateExact } from "../contracts/validation.js";
import {
  AcademicMisconceptionSignalResultSchema,
  MAXIMUM_ACADEMIC_MISCONCEPTION_CODE_LENGTH,
  ReviewedAcademicMisconceptionCodeSchema,
  SerializedAcademicMisconceptionSignalSchema,
  createAcademicMisconceptionRegistry,
  type AcademicMisconceptionEntry,
  type AcademicMisconceptionMatchRequest,
  type AcademicMisconceptionRegistry,
  type SerializedAcademicMisconceptionSignal,
  type StudyApprovedAcademicEvidence,
} from "./index.js";

const entry = {
  version: 1,
  misconceptionRef: "misconception:fraction-add-denominators-v1",
  conceptRef: "concept:adding-fractions-unlike-denominators",
  academicMisconceptionCode: "MATH_FRACTION_ADD_DENOMINATORS",
  reviewApprovalRef: "study-review:misconception-registry-v1",
  reviewedInstructionalResponseRefs: [
    "instructional-response:common-denominator-model-v1",
    "instructional-response:equivalent-fractions-check-v1",
  ],
  prerequisiteConceptRefs: ["concept:equivalent-fractions"],
  evidenceRequirements: {
    minimumSupportingEvidenceCount: 2,
    minimumDistinctOpportunityCount: 2,
    maximumEvidenceAgeDays: 30,
    acceptedSourceKinds: [
      "selected-response-classification",
      "worked-step-classification",
    ],
  },
} as const satisfies AcademicMisconceptionEntry;

function registry(): AcademicMisconceptionRegistry {
  const creation = createAcademicMisconceptionRegistry([entry]);
  assert.equal(creation.status, "ready");
  if (creation.status !== "ready") throw new Error("registry was not ready");
  return creation.registry;
}

function evidence(
  evidenceRef: string,
  opportunityRef: string,
  overrides: Partial<StudyApprovedAcademicEvidence> = {},
): StudyApprovedAcademicEvidence {
  return {
    evidenceVersion: 1,
    evidenceKind: "study-approved-structured-academic-evidence",
    evidenceRef,
    opportunityRef,
    learnerScopeRef: "learner-scope:opaque-a",
    instructionalContextRef: "instructional-context:fraction-unit-a",
    conceptRef: entry.conceptRef,
    academicMisconceptionCode: entry.academicMisconceptionCode,
    sourceKind: "selected-response-classification",
    finding: "consistent-with-misconception-code",
    observedAt: "2026-08-10T14:00:00.000Z",
    approvalKind: "study-approved",
    approvalRef: "study-approval:academic-evidence-v1",
    ...overrides,
  };
}

function request(
  evidenceItems: readonly StudyApprovedAcademicEvidence[],
  overrides: Partial<AcademicMisconceptionMatchRequest> = {},
): AcademicMisconceptionMatchRequest {
  return {
    matcherVersion: 1,
    scopeKind: "trusted-study-academic-evidence-scope",
    learnerScopeRef: "learner-scope:opaque-a",
    instructionalContextRef: "instructional-context:fraction-unit-a",
    conceptRef: entry.conceptRef,
    academicMisconceptionCode: entry.academicMisconceptionCode,
    evaluatedAt: "2026-08-14T14:00:00.000Z",
    evidence: [...evidenceItems],
    ...overrides,
  };
}

function assertBoundedResult(candidate: unknown): void {
  assert.equal(
    validateExact(AcademicMisconceptionSignalResultSchema, candidate).status,
    "accepted",
  );
  const serialized = JSON.stringify(candidate);
  for (const prohibited of [
    "transcript",
    "providerProse",
    "psychologicalLabel",
    "diagnosticLabel",
    "personality",
  ]) {
    assert.equal(serialized.includes(prohibited), false);
  }
}

function generatedSchema(schema: TSchema): TSchema {
  return JSON.parse(JSON.stringify(schema)) as TSchema;
}

function serializedPossibleSignal(
  overrides: Partial<SerializedAcademicMisconceptionSignal> = {},
): unknown {
  return {
    status: "possible-misconception",
    misconceptionRef: entry.misconceptionRef,
    academicMisconceptionCode: entry.academicMisconceptionCode,
    possibleInstructionalSignalOnly: true,
    authoritativeDiagnosis: false,
    authoritativeMasteryState: false,
    durableLearnerClassificationAllowed: false,
    ...overrides,
  };
}

test("academic misconception codes have runtime and serialized-schema parity", () => {
  const serializedCodeSchema = generatedSchema(
    ReviewedAcademicMisconceptionCodeSchema,
  );
  const tooLongCode = `MATH_${"A".repeat(
    MAXIMUM_ACADEMIC_MISCONCEPTION_CODE_LENGTH,
  )}_PATTERN`;
  const boundaryOverflowCode = `MATH_${"A".repeat(15_993)}_PATTERN`;
  assert.equal(boundaryOverflowCode.length, 16_006);

  const cases = [
    { code: entry.academicMisconceptionCode, accepted: true },
    { code: tooLongCode, accepted: false },
    { code: boundaryOverflowCode.slice(0, 16_001), accepted: false },
    {
      code: "The learner adds denominators whenever fractions look difficult.",
      accepted: false,
    },
    { code: "The learner has a mathematical learning disorder.", accepted: false },
    { code: "The learner is lazy and unmotivated.", accepted: false },
    { code: "MATH_FRACTION_加法", accepted: false },
    { code: "PSYCHOLOGICAL_ANXIETY_DIAGNOSIS", accepted: false },
    { code: "MATH_FRACTION_ANXIETY", accepted: false },
    { code: "MATH_STUDENT_STUPID", accepted: false },
  ] as const;

  for (const candidate of cases) {
    assert.equal(
      validateExact(
        ReviewedAcademicMisconceptionCodeSchema,
        candidate.code,
      ).status ===
        "accepted",
      candidate.accepted,
      candidate.code.slice(0, 100),
    );
    assert.equal(
      Value.Check(serializedCodeSchema, candidate.code),
      candidate.accepted,
      candidate.code.slice(0, 100),
    );
    if (!candidate.accepted) {
      assert.deepEqual(
        createAcademicMisconceptionRegistry([
          { ...entry, academicMisconceptionCode: candidate.code },
        ]),
        {
          status: "rejected",
          code: "INVALID_MISCONCEPTION_ENTRY",
          entryIndex: 0,
        },
      );
    }
  }
});

test("serialized possible signals require a known reviewed registry ref and matching code", () => {
  const matcher = registry();
  const serializedSignalSchema = generatedSchema(
    SerializedAcademicMisconceptionSignalSchema,
  );
  const legitimate = serializedPossibleSignal();

  assert.equal(
    validateExact(SerializedAcademicMisconceptionSignalSchema, legitimate).status,
    "accepted",
  );
  assert.equal(Value.Check(serializedSignalSchema, legitimate), true);
  assert.deepEqual(matcher.reviewSerializedSignal(legitimate), {
    status: "accepted",
    signal: legitimate,
  });

  const unknownRegistryRef = serializedPossibleSignal({
    misconceptionRef: "misconception:unknown-reviewed-registry-entry",
  });
  assert.equal(Value.Check(serializedSignalSchema, unknownRegistryRef), true);
  assert.deepEqual(matcher.reviewSerializedSignal(unknownRegistryRef), {
    status: "rejected",
    code: "UNKNOWN_MISCONCEPTION_REF",
  });

  const nonMisconceptionRef = serializedPossibleSignal({
    misconceptionRef: "diagnosis:unknown-registry-entry",
  });
  assert.deepEqual(matcher.reviewSerializedSignal(nonMisconceptionRef), {
    status: "rejected",
    code: "INVALID_SERIALIZED_SIGNAL",
  });

  const mismatchedCode = serializedPossibleSignal({
    academicMisconceptionCode: "MATH_FRACTION_MULTIPLY_NUMERATORS",
  });
  assert.deepEqual(matcher.reviewSerializedSignal(mismatchedCode), {
    status: "rejected",
    code: "MISMATCHED_MISCONCEPTION_CODE",
  });

  assert.deepEqual(
    createAcademicMisconceptionRegistry([
      { ...entry, reviewApprovalRef: "approval:not-a-study-review" },
    ]),
    {
      status: "rejected",
      code: "INVALID_MISCONCEPTION_ENTRY",
      entryIndex: 0,
    },
  );
});

test("serialized non-possible signals cannot retain learner classification identifiers", () => {
  const safeNoSignal = {
    status: "insufficient-evidence",
    misconceptionRef: null,
    academicMisconceptionCode: null,
    possibleInstructionalSignalOnly: true,
    authoritativeDiagnosis: false,
    authoritativeMasteryState: false,
    durableLearnerClassificationAllowed: false,
  } as const;
  assert.equal(
    validateExact(SerializedAcademicMisconceptionSignalSchema, safeNoSignal).status,
    "accepted",
  );
  assert.equal(registry().reviewSerializedSignal(safeNoSignal).status, "accepted");

  const retainedClassification = {
    ...safeNoSignal,
    misconceptionRef: entry.misconceptionRef,
    academicMisconceptionCode: entry.academicMisconceptionCode,
  };
  assert.deepEqual(registry().reviewSerializedSignal(retainedClassification), {
    status: "rejected",
    code: "INVALID_SERIALIZED_SIGNAL",
  });
});

test("emits a non-authoritative possible signal only after enough distinct academic evidence", () => {
  const result = registry().match(
    request([
      evidence("evidence:fraction-a", "opportunity:fraction-a"),
      evidence("evidence:fraction-b", "opportunity:fraction-b", {
        sourceKind: "worked-step-classification",
      }),
    ]),
  );

  assert.equal(result.status, "possible-misconception");
  assert.equal(result.misconceptionRef, entry.misconceptionRef);
  assert.deepEqual(
    result.reviewedInstructionalResponseRefs,
    entry.reviewedInstructionalResponseRefs,
  );
  assert.deepEqual(result.prerequisiteConceptRefs, entry.prerequisiteConceptRefs);
  assert.deepEqual(result.evidenceSummary, {
    submittedEvidenceCount: 2,
    eligibleEvidenceCount: 2,
    supportingEvidenceCount: 2,
    contradictingEvidenceCount: 0,
    distinctSupportingOpportunityCount: 2,
    staleEvidenceCount: 0,
    futureEvidenceCount: 0,
    duplicateEvidenceCount: 0,
  });
  assert.equal(result.possibleInstructionalSignalOnly, true);
  assert.equal(result.authoritativeDiagnosis, false);
  assert.equal(result.authoritativeMasteryState, false);
  assert.equal(result.durableLearnerClassificationAllowed, false);
  assertBoundedResult(result);
});

test("a single wrong response is insufficient evidence and cannot become durable", () => {
  const result = registry().match(
    request([evidence("evidence:fraction-a", "opportunity:fraction-a")]),
  );

  assert.equal(result.status, "insufficient-evidence");
  assert.deepEqual(result.reasonCodes, [
    "MINIMUM_SUPPORTING_EVIDENCE_NOT_MET",
    "MINIMUM_DISTINCT_OPPORTUNITIES_NOT_MET",
  ]);
  assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
  assert.equal(result.durableLearnerClassificationAllowed, false);
});

test("contradicting academic evidence yields no signal", () => {
  const result = registry().match(
    request([
      evidence("evidence:fraction-a", "opportunity:fraction-a", {
        finding: "inconsistent-with-misconception-code",
      }),
    ]),
  );

  assert.equal(result.status, "no-signal");
  assert.deepEqual(result.reasonCodes, ["NO_SUPPORTING_EVIDENCE"]);
  assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
});

test("supporting and contradicting evidence yields a bounded conflict", () => {
  const result = registry().match(
    request([
      evidence("evidence:fraction-a", "opportunity:fraction-a"),
      evidence("evidence:fraction-b", "opportunity:fraction-b", {
        finding: "inconsistent-with-misconception-code",
      }),
    ]),
  );

  assert.equal(result.status, "conflicting-evidence");
  assert.deepEqual(result.reasonCodes, [
    "SUPPORTING_AND_CONTRADICTING_EVIDENCE",
  ]);
  assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
  assertBoundedResult(result);
});

test("unknown misconception codes fail closed", () => {
  for (const unknownCode of [
    "MATH_FRACTION_UNKNOWN_PATTERN",
    "SCIENCE_CELL_UNKNOWN_MODEL",
  ]) {
    const result = registry().match(
      request(
        [
          evidence("evidence:unknown-a", "opportunity:unknown-a", {
            academicMisconceptionCode: unknownCode,
          }),
        ],
        { academicMisconceptionCode: unknownCode },
      ),
    );

    assert.equal(result.status, "insufficient-evidence");
    assert.equal(result.misconceptionRef, null);
    assert.equal(result.academicMisconceptionCode, null);
    assert.deepEqual(result.reasonCodes, ["UNKNOWN_MISCONCEPTION_CODE"]);
    assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
    assert.equal(JSON.stringify(result).includes(unknownCode), false);
  }
});

test("a known code requested for the wrong concept fails closed", () => {
  const wrongConceptRef = "concept:multiplying-fractions";
  const result = registry().match(
    request(
      [
        evidence("evidence:wrong-concept", "opportunity:wrong-concept", {
          conceptRef: wrongConceptRef,
        }),
      ],
      { conceptRef: wrongConceptRef },
    ),
  );

  assert.equal(result.status, "insufficient-evidence");
  assert.deepEqual(result.reasonCodes, ["WRONG_CONCEPT"]);
  assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
});

test("cross-concept evidence cannot be reused for the target concept", () => {
  const result = registry().match(
    request([
      evidence("evidence:fraction-a", "opportunity:fraction-a"),
      evidence("evidence:cross-concept", "opportunity:cross-concept", {
        conceptRef: "concept:multiplying-fractions",
      }),
    ]),
  );

  assert.equal(result.status, "insufficient-evidence");
  assert.deepEqual(result.reasonCodes, ["CROSS_CONCEPT_EVIDENCE"]);
  assert.equal(result.evidenceSummary.eligibleEvidenceCount, 0);
});

test("one academic code cannot be registered for a second concept", () => {
  const creation = createAcademicMisconceptionRegistry([
    entry,
    {
      ...entry,
      misconceptionRef: "misconception:cross-concept-reuse",
      conceptRef: "concept:multiplying-fractions",
    },
  ]);

  assert.deepEqual(creation, {
    status: "rejected",
    code: "DUPLICATE_MISCONCEPTION_CODE",
    entryIndex: 1,
  });
});

test("stale evidence is excluded and cannot satisfy thresholds", () => {
  const result = registry().match(
    request([
      evidence("evidence:stale-a", "opportunity:stale-a", {
        observedAt: "2026-06-01T14:00:00.000Z",
      }),
      evidence("evidence:stale-b", "opportunity:stale-b", {
        observedAt: "2026-06-02T14:00:00.000Z",
      }),
    ]),
  );

  assert.equal(result.status, "insufficient-evidence");
  assert.deepEqual(result.reasonCodes, ["STALE_EVIDENCE_EXCLUDED"]);
  assert.equal(result.evidenceSummary.staleEvidenceCount, 2);
  assert.equal(result.evidenceSummary.eligibleEvidenceCount, 0);
});

test("exact duplicate evidence is collapsed and cannot amplify one response", () => {
  const repeated = evidence("evidence:fraction-a", "opportunity:fraction-a");
  const result = registry().match(request([repeated, structuredClone(repeated)]));

  assert.equal(result.status, "insufficient-evidence");
  assert.equal(result.evidenceSummary.supportingEvidenceCount, 1);
  assert.equal(result.evidenceSummary.duplicateEvidenceCount, 1);
  assert.deepEqual(result.reasonCodes, [
    "DUPLICATE_EVIDENCE_EXCLUDED",
    "MINIMUM_SUPPORTING_EVIDENCE_NOT_MET",
    "MINIMUM_DISTINCT_OPPORTUNITIES_NOT_MET",
  ]);
});

test("reuse of an evidence identity with changed academic content is conflicting", () => {
  const first = evidence("evidence:fraction-a", "opportunity:fraction-a");
  const result = registry().match(
    request([
      first,
      {
        ...first,
        finding: "inconsistent-with-misconception-code",
      },
    ]),
  );

  assert.equal(result.status, "conflicting-evidence");
  assert.deepEqual(result.reasonCodes, ["EVIDENCE_IDENTITY_CONFLICT"]);
});

test("replay is side-effect free and produces the identical result", () => {
  const matcher = registry();
  const replayableRequest = request([
    evidence("evidence:fraction-a", "opportunity:fraction-a"),
    evidence("evidence:fraction-b", "opportunity:fraction-b"),
  ]);

  const first = matcher.match(replayableRequest);
  const replay = matcher.match(structuredClone(replayableRequest));
  assert.deepEqual(replay, first);
  assert.equal(first.status, "possible-misconception");
});

test("cross-context and cross-learner evidence are not partially accepted", () => {
  for (const contaminated of [
    evidence("evidence:cross-context", "opportunity:cross-context", {
      instructionalContextRef: "instructional-context:other-unit",
    }),
    evidence("evidence:cross-learner", "opportunity:cross-learner", {
      learnerScopeRef: "learner-scope:opaque-b",
    }),
  ]) {
    const result = registry().match(
      request([
        evidence("evidence:fraction-a", "opportunity:fraction-a"),
        contaminated,
      ]),
    );
    assert.equal(result.status, "insufficient-evidence");
    assert.equal(result.evidenceSummary.eligibleEvidenceCount, 0);
    assert.deepEqual(result.reviewedInstructionalResponseRefs, []);
  }
});

test("psychological and diagnostic labels are prohibited contract contamination", () => {
  for (const prohibitedEntry of [
    { ...entry, psychologicalLabel: "unmotivated" },
    { ...entry, diagnosticLabel: "attention-disorder" },
  ]) {
    const creation = createAcademicMisconceptionRegistry([prohibitedEntry]);
    assert.deepEqual(creation, {
      status: "rejected",
      code: "INVALID_MISCONCEPTION_ENTRY",
      entryIndex: 0,
    });
  }

  for (const prohibitedEvidence of [
    {
      ...evidence("evidence:psych-label", "opportunity:psych-label"),
      psychologicalLabel: "unmotivated",
    },
    {
      ...evidence("evidence:diagnosis", "opportunity:diagnosis"),
      diagnosticLabel: "attention-disorder",
    },
    {
      ...evidence("evidence:emotion", "opportunity:emotion"),
      emotionalState: "anxious",
    },
  ]) {
    const result = registry().match(request([prohibitedEvidence]));
    assert.equal(result.status, "insufficient-evidence");
    assert.deepEqual(result.reasonCodes, ["INVALID_MATCH_REQUEST"]);
    assert.equal(result.conceptRef, null);
    assertBoundedResult(result);
  }
});

test("raw learner and provider prose contamination is rejected", () => {
  for (const prohibitedEvidence of [
    {
      ...evidence("evidence:raw-transcript", "opportunity:raw-transcript"),
      rawLearnerTranscript: "I guessed because the two numbers looked alike.",
    },
    {
      ...evidence("evidence:raw-provider", "opportunity:raw-provider"),
      rawProviderProse: "The model inferred a misconception from free-form text.",
    },
    {
      ...evidence("evidence:notes", "opportunity:notes"),
      unrestrictedNotes: "Arbitrary prose is not evidence.",
    },
  ]) {
    const result = registry().match(request([prohibitedEvidence]));
    assert.equal(result.status, "insufficient-evidence");
    assert.deepEqual(result.reasonCodes, ["INVALID_MATCH_REQUEST"]);
    assertBoundedResult(result);
  }
});

test("matching is deterministic across evidence ordering", () => {
  const matcher = registry();
  const evidenceA = evidence("evidence:fraction-a", "opportunity:fraction-a");
  const evidenceB = evidence("evidence:fraction-b", "opportunity:fraction-b", {
    sourceKind: "worked-step-classification",
  });

  const forward = matcher.match(request([evidenceA, evidenceB]));
  const reversed = matcher.match(request([evidenceB, evidenceA]));
  assert.deepEqual(reversed, forward);
  assert.equal(JSON.stringify(reversed), JSON.stringify(forward));
});

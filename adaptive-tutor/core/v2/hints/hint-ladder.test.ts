import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../contracts/index.js";
import {
  HintSelectionResultSchema,
  type HintSelectionRequest,
} from "./contracts.js";
import { selectBoundedHint } from "./hint-ladder.js";

const reviewedHints: HintSelectionRequest["reviewedHints"] = [
  {
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:nudge-generic",
    reviewedContentRef: "reviewed-content:nudge-generic",
    reviewRef: "review:hint-nudge",
    hintLevel: "nudge",
    eligibleMisconceptionCodes: [],
    eligibleLearnerStageRefs: [],
  },
  {
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:concept-generic",
    reviewedContentRef: "reviewed-content:concept-generic",
    reviewRef: "review:hint-concept",
    hintLevel: "concept-cue",
    eligibleMisconceptionCodes: [],
    eligibleLearnerStageRefs: [],
  },
  {
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:concept-misconception",
    reviewedContentRef: "reviewed-content:concept-misconception",
    reviewRef: "review:hint-misconception",
    hintLevel: "concept-cue",
    eligibleMisconceptionCodes: ["reverses-numerator-denominator"],
    eligibleLearnerStageRefs: ["learning-stage:middle"],
  },
  {
    metadataKind: "study-reviewed-hint",
    hintRef: "hint:guided-generic",
    reviewedContentRef: "reviewed-content:guided-generic",
    reviewRef: "review:hint-guided",
    hintLevel: "guided-step",
    eligibleMisconceptionCodes: [],
    eligibleLearnerStageRefs: [],
  },
];

function request(
  overrides: Partial<HintSelectionRequest> = {},
): HintSelectionRequest {
  return {
    requestKind: "bounded-hint-selection",
    contextRef: "hint-context:item-001",
    assessmentPhase: "instruction-or-practice",
    studyHintCeiling: "guided-step",
    previousAssistanceLevel: "independent",
    attemptCount: 1,
    misconceptionSignalCode: null,
    learnerStageProfile: {
      profileKind: "approved-learning-stage-hint-policy",
      profileRef: "policy-profile:middle-hints",
      learningStageRef: "learning-stage:middle",
      approvalRef: "approval:middle-hints",
      approvalKind: "study-approved",
      maximumHintEscalationsBeforeRecheck: 8,
    },
    reviewPermission: {
      completedAssessmentReviewAllowed: false,
      privacyApprovalRef: null,
    },
    interventionHistory: [],
    reviewedHints: structuredClone(reviewedHints),
    ...overrides,
  };
}

function hintHistory(
  hintLevel: "nudge" | "concept-cue" | "guided-step",
  contextRef = "hint-context:item-001",
  ordinal = 1,
): HintSelectionRequest["interventionHistory"][number] {
  return {
    interventionRef: `intervention:${contextRef.split(":").at(-1)}-${ordinal}`,
    contextRef,
    ordinal,
    interventionKind: "hint-provided",
    hintLevel,
    assistanceLevel: hintLevel === "guided-step" ? "guided" : "light-hint",
  };
}

test("no hint is recommended before an attempt", () => {
  assert.deepEqual(selectBoundedHint(request({ attemptCount: 0 })), {
    status: "no-hint",
    hintLevel: "none",
    hintMetadata: null,
    assistanceLevel: "independent",
    reasonCodes: ["attempt-not-yet-made"],
    unrestrictedProviderProseAllowed: false,
  });
});

test("first attempt recommends a reviewed nudge", () => {
  const result = selectBoundedHint(request());
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.hintMetadata.hintRef, "hint:nudge-generic");
    assert.equal(result.assistanceLevel, "light-hint");
  }
});

test("second attempt recommends a reviewed concept cue", () => {
  const result = selectBoundedHint(request({ attemptCount: 2 }));
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "concept-cue");
    assert.equal(result.hintMetadata.hintRef, "hint:concept-generic");
  }
});

test("third and later attempts recommend a reviewed guided step", () => {
  for (const attemptCount of [3, 8]) {
    const result = selectBoundedHint(request({ attemptCount }));
    assert.equal(result.status, "recommended");
    if (result.status === "recommended") {
      assert.equal(result.hintLevel, "guided-step");
      assert.equal(result.assistanceLevel, "guided");
    }
  }
});

test("Study ceiling none blocks every hint", () => {
  const result = selectBoundedHint(
    request({ attemptCount: 12, studyHintCeiling: "none" }),
  );
  assert.equal(result.status, "no-hint");
  if (result.status === "no-hint") {
    assert.deepEqual(result.reasonCodes, ["study-hint-ceiling-none"]);
  }
});

test("Study ceiling nudge caps a repeated-attempt recommendation", () => {
  const result = selectBoundedHint(
    request({ attemptCount: 3, studyHintCeiling: "nudge" }),
  );
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.deepEqual(result.reasonCodes, [
      "attempt-count-recommendation",
      "study-hint-ceiling-applied",
    ]);
  }
});

test("attempted ceiling escalation cannot exceed nudge or erase guided evidence", () => {
  const result = selectBoundedHint(
    request({
      studyHintCeiling: "nudge",
      interventionHistory: [hintHistory("guided-step")],
    }),
  );
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.assistanceLevel, "guided");
    assert.ok(result.reasonCodes.includes("intervention-history-recommendation"));
    assert.ok(result.reasonCodes.includes("study-hint-ceiling-applied"));
  }
});

test("repeated attempts traverse only the canonical ladder levels", () => {
  const levels = [0, 1, 2, 3, 4].map((attemptCount) => {
    const result = selectBoundedHint(request({ attemptCount }));
    assert.notEqual(result.status, "rejected");
    return result.status === "rejected" ? "unreachable" : result.hintLevel;
  });
  assert.deepEqual(levels, [
    "none",
    "nudge",
    "concept-cue",
    "guided-step",
    "guided-step",
  ]);
});

test("misconception signal recommends and selects a targeted concept cue", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 1,
      misconceptionSignalCode: "reverses-numerator-denominator",
    }),
  );
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "concept-cue");
    assert.equal(result.hintMetadata.hintRef, "hint:concept-misconception");
    assert.ok(result.reasonCodes.includes("misconception-signal-recommendation"));
  }
});

test("active assessment structurally blocks hints despite review and privacy approvals", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 3,
      assessmentPhase: "active-graded-or-mastery-check",
      reviewPermission: {
        completedAssessmentReviewAllowed: true,
        privacyApprovalRef: "privacy-approval:active-item",
      },
    }),
  );
  assert.deepEqual(result, {
    status: "no-hint",
    hintLevel: "none",
    hintMetadata: null,
    assistanceLevel: "independent",
    reasonCodes: ["active-assessment-structural-block"],
    unrestrictedProviderProseAllowed: false,
  });
});

test("completed assessment review requires its specific permission", () => {
  const denied = selectBoundedHint(
    request({
      assessmentPhase: "completed-assessment-review",
      reviewPermission: {
        completedAssessmentReviewAllowed: false,
        privacyApprovalRef: "privacy-approval:review-item",
      },
    }),
  );
  assert.equal(denied.status, "no-hint");
  if (denied.status === "no-hint") {
    assert.deepEqual(denied.reasonCodes, ["completed-review-not-authorized"]);
  }

  const allowed = selectBoundedHint(
    request({
      assessmentPhase: "completed-assessment-review",
      reviewPermission: {
        completedAssessmentReviewAllowed: true,
        privacyApprovalRef: null,
      },
    }),
  );
  assert.equal(allowed.status, "recommended");
  assert.equal(allowed.hintLevel, "nudge");
});

test("assistance classification preserves all four canonical classes", () => {
  const cases = [
    [request({ attemptCount: 0 }), "independent"],
    [request({ attemptCount: 1 }), "light-hint"],
    [request({ attemptCount: 3 }), "guided"],
    [
      request({ attemptCount: 0, previousAssistanceLevel: "reteach-required" }),
      "reteach-required",
    ],
  ] as const;
  for (const [candidate, expected] of cases) {
    const result = selectBoundedHint(candidate);
    assert.notEqual(result.status, "rejected");
    if (result.status !== "rejected") {
      assert.equal(result.assistanceLevel, expected);
    }
  }
});

test("guided completion remains guided rather than becoming independent evidence", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 0,
      previousAssistanceLevel: "guided",
      interventionHistory: [
        hintHistory("guided-step", "hint-context:item-001", 1),
        {
          interventionRef: "intervention:item-001-2",
          contextRef: "hint-context:item-001",
          ordinal: 2,
          interventionKind: "learner-completion",
          hintLevel: "none",
          assistanceLevel: "guided",
        },
      ],
    }),
  );
  assert.equal(result.status, "no-hint");
  assert.equal(result.assistanceLevel, "guided");
});

test("learner-stage profile pauses escalation until a comprehension recheck", () => {
  const learnerStageProfile = {
    ...request().learnerStageProfile,
    maximumHintEscalationsBeforeRecheck: 1,
  } as const;
  const history = [hintHistory("nudge")];
  const paused = selectBoundedHint(
    request({ attemptCount: 2, learnerStageProfile, interventionHistory: history }),
  );
  assert.equal(paused.status, "no-hint");
  if (paused.status === "no-hint") {
    assert.deepEqual(paused.reasonCodes, ["learner-stage-recheck-required"]);
  }

  const resumed = selectBoundedHint(
    request({
      attemptCount: 2,
      learnerStageProfile,
      interventionHistory: [
        ...history,
        {
          interventionRef: "intervention:item-001-recheck",
          contextRef: "hint-context:item-001",
          ordinal: 2,
          interventionKind: "comprehension-recheck",
          hintLevel: "none",
          assistanceLevel: "light-hint",
        },
      ],
    }),
  );
  assert.equal(resumed.status, "recommended");
  assert.equal(resumed.hintLevel, "concept-cue");
});

test("selection is deterministic under replay and does not mutate input", () => {
  const candidate = request({
    attemptCount: 2,
    misconceptionSignalCode: "reverses-numerator-denominator",
    interventionHistory: [hintHistory("nudge")],
  });
  const snapshot = structuredClone(candidate);
  const first = selectBoundedHint(candidate);
  const second = selectBoundedHint(candidate);
  assert.deepEqual(first, second);
  assert.deepEqual(candidate, snapshot);
});

test("malformed hint state fails closed", () => {
  const malformedCandidates: unknown[] = [
    { ...request(), studyHintCeiling: "answer" },
    { ...request(), unrestrictedProviderProse: "Invent a hint." },
    {
      ...request(),
      interventionHistory: [
        { ...hintHistory("guided-step"), assistanceLevel: "independent" },
      ],
    },
    {
      ...request(),
      reviewedHints: [reviewedHints[0], reviewedHints[0]],
    },
  ];
  for (const malformed of malformedCandidates) {
    assert.deepEqual(selectBoundedHint(malformed), {
      status: "rejected",
      code: "INVALID_HINT_STATE",
      tutorMayProvideHint: false,
      unrestrictedProviderProseAllowed: false,
    });
  }
});

test("hostile hint state fails closed without invoking accessors", () => {
  let getterInvocations = 0;
  const accessorState = request() as HintSelectionRequest & {
    unrestrictedProviderProse?: string;
  };
  Object.defineProperty(accessorState, "unrestrictedProviderProse", {
    enumerable: true,
    get() {
      getterInvocations += 1;
      throw new Error("must not run");
    },
  });
  assert.equal(selectBoundedHint(accessorState).status, "rejected");
  assert.equal(getterInvocations, 0);

  const hostileProxy = new Proxy(request(), {
    getPrototypeOf() {
      throw new Error("hostile reflection");
    },
  });
  assert.deepEqual(selectBoundedHint(hostileProxy), {
    status: "rejected",
    code: "INVALID_HINT_STATE",
    tutorMayProvideHint: false,
    unrestrictedProviderProseAllowed: false,
  });
});

test("cross-context history cannot escalate or contaminate assistance evidence", () => {
  const result = selectBoundedHint(
    request({
      interventionHistory: [
        hintHistory("guided-step", "hint-context:different-item"),
        {
          interventionRef: "intervention:different-item-reteach",
          contextRef: "hint-context:different-item",
          ordinal: 2,
          interventionKind: "reteach",
          hintLevel: "none",
          assistanceLevel: "reteach-required",
        },
      ],
    }),
  );
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.assistanceLevel, "light-hint");
    assert.equal(result.reasonCodes.includes("intervention-history-recommendation"), false);
  }
});

test("only reviewed reference metadata is returned, never hint prose", () => {
  const result = selectBoundedHint(request());
  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.deepEqual(Object.keys(result.hintMetadata).sort(), [
      "eligibleLearnerStageRefs",
      "eligibleMisconceptionCodes",
      "hintLevel",
      "hintRef",
      "metadataKind",
      "reviewRef",
      "reviewedContentRef",
    ]);
    assert.equal("content" in result.hintMetadata, false);
    assert.equal(result.unrestrictedProviderProseAllowed, false);
  }
});

test("missing reviewed metadata yields no hint instead of novel content", () => {
  const result = selectBoundedHint(
    request({ attemptCount: 3, reviewedHints: reviewedHints.slice(0, 2) }),
  );
  assert.equal(result.status, "no-hint");
  if (result.status === "no-hint") {
    assert.deepEqual(result.reasonCodes, ["reviewed-hint-unavailable"]);
  }
});

test("every result variant satisfies the exact result contract", () => {
  const results = [
    selectBoundedHint(request()),
    selectBoundedHint(request({ attemptCount: 0 })),
    selectBoundedHint({ ...request(), unrestrictedProviderProse: "blocked" }),
  ];
  for (const result of results) {
    assert.equal(validateExact(HintSelectionResultSchema, result).status, "accepted");
  }
});

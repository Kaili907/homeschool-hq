import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../contracts/index.js";
import {
  COMPLETED_ASSESSMENT_REVIEW_PERMISSION_VERSION,
  HintSelectionRequestSchema,
  HintSelectionResultSchema,
  type HintSelectionRequest,
} from "./contracts.js";
import { selectBoundedHint } from "./hint-ladder.js";

const LEARNER_SCOPE_REF = "learner-scope:learner-a";
const SESSION_REF = "session:session-a";
const CONTEXT_REF = "hint-context:item-001";
const CURRENT_OPPORTUNITY_REF = "opportunity:item-001-current";
const CURRENT_REVIEW_EVENT_REF = "review-event:item-001-current";
const CURRENT_REVIEW_POLICY_REVISION_REF = "policy-revision:review-v1";
const CURRENT_REVIEW_PRIVACY_APPROVAL_REF = "privacy-approval:item-001-current";

type AuthorizedReviewPermission = Extract<
  HintSelectionRequest["reviewPermission"],
  { status: "authorized" }
>;

function authorizedReviewPermission(
  overrides: Partial<AuthorizedReviewPermission> = {},
): AuthorizedReviewPermission {
  return {
    permissionVersion: COMPLETED_ASSESSMENT_REVIEW_PERMISSION_VERSION,
    status: "authorized",
    permissionKind: "study-completed-assessment-review-permission",
    issuer: "study",
    permissionRef: "review-permission:item-001-current",
    learnerScopeRef: LEARNER_SCOPE_REF,
    sessionRef: SESSION_REF,
    instructionalContextRef: CONTEXT_REF,
    opportunityRef: CURRENT_OPPORTUNITY_REF,
    reviewEventRef: CURRENT_REVIEW_EVENT_REF,
    policyRevisionRef: CURRENT_REVIEW_POLICY_REVISION_REF,
    privacyApprovalRef: null,
    ...overrides,
  };
}

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
    learnerScopeRef: LEARNER_SCOPE_REF,
    sessionRef: SESSION_REF,
    contextRef: CONTEXT_REF,
    currentOpportunityRef: CURRENT_OPPORTUNITY_REF,
    currentReviewEventRef: null,
    currentReviewPolicyRevisionRef: null,
    currentReviewPrivacyApprovalRef: null,
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
      status: "not-authorized",
    },
    interventionHistory: [],
    reviewedHints: structuredClone(reviewedHints),
    ...overrides,
  };
}

function completedReviewRequest(
  overrides: Partial<HintSelectionRequest> = {},
): HintSelectionRequest {
  return request({
    assessmentPhase: "completed-assessment-review",
    currentReviewEventRef: CURRENT_REVIEW_EVENT_REF,
    currentReviewPolicyRevisionRef: CURRENT_REVIEW_POLICY_REVISION_REF,
    reviewPermission: authorizedReviewPermission(),
    ...overrides,
  });
}

function hintHistory(
  hintLevel: "nudge" | "concept-cue" | "guided-step",
  contextRef = CONTEXT_REF,
  ordinal = 1,
  overrides: Partial<HintSelectionRequest["interventionHistory"][number]> = {},
): HintSelectionRequest["interventionHistory"][number] {
  return {
    learnerScopeRef: LEARNER_SCOPE_REF,
    sessionRef: SESSION_REF,
    interventionRef: `intervention:${contextRef.split(":").at(-1)}-${ordinal}`,
    contextRef,
    sourceInteractionRef: `interaction:hint-history-${ordinal}`,
    opportunityRef: CURRENT_OPPORTUNITY_REF,
    ordinal,
    interventionKind: "hint-provided",
    hintLevel,
    assistanceLevel: hintLevel === "guided-step" ? "guided" : "light-hint",
    ...overrides,
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
      currentReviewEventRef: CURRENT_REVIEW_EVENT_REF,
      currentReviewPolicyRevisionRef: CURRENT_REVIEW_POLICY_REVISION_REF,
      currentReviewPrivacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
      reviewPermission: authorizedReviewPermission({
        privacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
      }),
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
      currentReviewEventRef: CURRENT_REVIEW_EVENT_REF,
      currentReviewPolicyRevisionRef: CURRENT_REVIEW_POLICY_REVISION_REF,
    }),
  );
  assert.equal(denied.status, "no-hint");
  if (denied.status === "no-hint") {
    assert.deepEqual(denied.reasonCodes, ["completed-review-not-authorized"]);
  }

  const allowed = selectBoundedHint(
    request({
      assessmentPhase: "completed-assessment-review",
      currentReviewEventRef: CURRENT_REVIEW_EVENT_REF,
      currentReviewPolicyRevisionRef: CURRENT_REVIEW_POLICY_REVISION_REF,
      reviewPermission: authorizedReviewPermission(),
    }),
  );
  assert.equal(allowed.status, "recommended");
  assert.equal(allowed.hintLevel, "nudge");
});

test("exact completed-review authorization is deterministic under replay", () => {
  const candidate = completedReviewRequest({
    attemptCount: 2,
    currentReviewPrivacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
    reviewPermission: authorizedReviewPermission({
      privacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
    }),
  });
  const snapshot = structuredClone(candidate);
  const first = selectBoundedHint(candidate);
  const second = selectBoundedHint(candidate);

  assert.equal(first.status, "recommended");
  assert.equal(first.hintLevel, "concept-cue");
  assert.deepEqual(first, second);
  assert.deepEqual(candidate, snapshot);
});

for (const [scope, overrides] of [
  ["review event", { currentReviewEventRef: "review-event:item-001-next" }],
  ["opportunity", { currentOpportunityRef: "opportunity:item-001-next" }],
  ["learner", { learnerScopeRef: "learner-scope:learner-b" }],
  ["session", { sessionRef: "session:session-b" }],
  ["instructional context", { contextRef: "hint-context:item-002" }],
  [
    "review policy revision",
    { currentReviewPolicyRevisionRef: "policy-revision:review-v2" },
  ],
] as const) {
  test(`completed-review permission cannot be replayed into another ${scope}`, () => {
    const result = selectBoundedHint(completedReviewRequest(overrides));
    assert.equal(result.status, "no-hint");
    if (result.status === "no-hint") {
      assert.deepEqual(result.reasonCodes, ["completed-review-not-authorized"]);
    }
  });
}

test("an exact non-null current privacy approval authorizes completed review", () => {
  const result = selectBoundedHint(
    completedReviewRequest({
      currentReviewPrivacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
      reviewPermission: authorizedReviewPermission({
        privacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
      }),
    }),
  );

  assert.equal(result.status, "recommended");
  assert.equal(result.hintLevel, "nudge");
});

test("changing only the permission privacy approval denies completed review", () => {
  const result = selectBoundedHint(
    completedReviewRequest({
      currentReviewPrivacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
      reviewPermission: authorizedReviewPermission({
        privacyApprovalRef: "privacy-approval:item-001-current-foreign",
      }),
    }),
  );
  assert.equal(result.status, "no-hint");
  if (result.status === "no-hint") {
    assert.deepEqual(result.reasonCodes, ["completed-review-not-authorized"]);
  }
});

for (const [scope, currentReviewPrivacyApprovalRef, privacyApprovalRef] of [
  [
    "permission non-null and current null",
    null,
    CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
  ],
  [
    "permission null and current non-null",
    CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
    null,
  ],
] as const) {
  test(`${scope} denies completed review`, () => {
    const result = selectBoundedHint(
      completedReviewRequest({
        currentReviewPrivacyApprovalRef,
        reviewPermission: authorizedReviewPermission({ privacyApprovalRef }),
      }),
    );

    assert.equal(result.status, "no-hint");
    if (result.status === "no-hint") {
      assert.deepEqual(result.reasonCodes, ["completed-review-not-authorized"]);
    }
  });
}

test("permission null and current null match for completed review", () => {
  const result = selectBoundedHint(completedReviewRequest());
  assert.equal(result.status, "recommended");
  assert.equal(result.hintLevel, "nudge");
});

test("a copied permission reference does not authorize another learner", () => {
  const result = selectBoundedHint(
    completedReviewRequest({ learnerScopeRef: "learner-scope:learner-b" }),
  );
  assert.equal(result.status, "no-hint");
  if (result.status === "no-hint") {
    assert.deepEqual(result.reasonCodes, ["completed-review-not-authorized"]);
  }
});

test("boolean review authority fails the schema and runtime closed", () => {
  const candidate = {
    ...completedReviewRequest(),
    reviewPermission: {
      completedAssessmentReviewAllowed: true,
      privacyApprovalRef: "privacy-approval:item-001",
    },
  };

  assert.equal(validateExact(HintSelectionRequestSchema, candidate).status, "rejected");
  assert.equal(selectBoundedHint(candidate).status, "rejected");
});

test("malformed or non-Study completed-review permission fails closed", () => {
  const malformedCandidates: unknown[] = [];

  for (const [field, value] of [
    ["permissionVersion", "study-tutor-v2.completed-assessment-review-permission.v2"],
    ["permissionKind", "provider-completed-assessment-review-permission"],
    ["issuer", "provider"],
  ] as const) {
    const candidate = structuredClone(completedReviewRequest()) as unknown as {
      reviewPermission: Record<string, unknown>;
    };
    candidate.reviewPermission[field] = value;
    malformedCandidates.push(candidate);
  }

  const missingPermissionRef = structuredClone(completedReviewRequest()) as unknown as {
    reviewPermission: Record<string, unknown>;
  };
  delete missingPermissionRef.reviewPermission.permissionRef;
  malformedCandidates.push(missingPermissionRef);

  const missingReviewEvent = completedReviewRequest({ currentReviewEventRef: null });
  malformedCandidates.push(missingReviewEvent);

  for (const malformed of malformedCandidates) {
    assert.equal(selectBoundedHint(malformed).status, "rejected");
  }
});

test("ordinary instruction and non-graded review ignore completed-review privacy permission", () => {
  for (const assessmentPhase of [
    "instruction-or-practice",
    "non-graded-review",
  ] as const) {
    const result = selectBoundedHint(
      request({
        assessmentPhase,
        currentReviewPrivacyApprovalRef: CURRENT_REVIEW_PRIVACY_APPROVAL_REF,
        reviewPermission: authorizedReviewPermission({
          privacyApprovalRef: "privacy-approval:foreign",
        }),
      }),
    );
    assert.equal(result.status, "recommended");
    assert.equal(result.hintLevel, "nudge");
  }
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
          learnerScopeRef: LEARNER_SCOPE_REF,
          sessionRef: SESSION_REF,
          interventionRef: "intervention:item-001-2",
          contextRef: CONTEXT_REF,
          sourceInteractionRef: "interaction:hint-history-2",
          opportunityRef: CURRENT_OPPORTUNITY_REF,
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
          learnerScopeRef: LEARNER_SCOPE_REF,
          sessionRef: SESSION_REF,
          interventionRef: "intervention:item-001-recheck",
          contextRef: CONTEXT_REF,
          sourceInteractionRef: "interaction:hint-recheck-2",
          opportunityRef: CURRENT_OPPORTUNITY_REF,
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

test("completed prior opportunity does not create a guided floor on a new opportunity", () => {
  const priorOpportunityRef = "opportunity:item-001-prior";
  const result = selectBoundedHint(
    request({
      attemptCount: 1,
      interventionHistory: [
        hintHistory("guided-step", CONTEXT_REF, 1, {
          opportunityRef: priorOpportunityRef,
        }),
        {
          learnerScopeRef: LEARNER_SCOPE_REF,
          sessionRef: SESSION_REF,
          interventionRef: "intervention:item-001-prior-completion",
          contextRef: CONTEXT_REF,
          sourceInteractionRef: "interaction:item-001-prior-completion",
          opportunityRef: priorOpportunityRef,
          ordinal: 2,
          interventionKind: "learner-completion",
          hintLevel: "none",
          assistanceLevel: "guided",
        },
      ],
    }),
  );

  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.assistanceLevel, "light-hint");
    assert.equal(
      result.reasonCodes.includes("intervention-history-recommendation"),
      false,
    );
  }
});

test("unresolved guided assistance in the current opportunity remains guided", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 1,
      interventionHistory: [hintHistory("guided-step")],
    }),
  );

  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "guided-step");
    assert.equal(result.assistanceLevel, "guided");
    assert.ok(result.reasonCodes.includes("intervention-history-recommendation"));
  }
});

test("learner completion closes the current opportunity escalation segment", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 1,
      interventionHistory: [
        hintHistory("guided-step"),
        {
          learnerScopeRef: LEARNER_SCOPE_REF,
          sessionRef: SESSION_REF,
          interventionRef: "intervention:item-001-current-completion",
          contextRef: CONTEXT_REF,
          sourceInteractionRef: "interaction:item-001-current-completion",
          opportunityRef: CURRENT_OPPORTUNITY_REF,
          ordinal: 2,
          interventionKind: "learner-completion",
          hintLevel: "none",
          assistanceLevel: "guided",
        },
      ],
    }),
  );

  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.assistanceLevel, "light-hint");
    assert.equal(
      result.reasonCodes.includes("intervention-history-recommendation"),
      false,
    );
  }
});

test("new opportunity preserves the Study-provided assistance baseline", () => {
  const result = selectBoundedHint(
    request({
      attemptCount: 1,
      previousAssistanceLevel: "reteach-required",
      interventionHistory: [
        hintHistory("guided-step", CONTEXT_REF, 1, {
          opportunityRef: "opportunity:item-001-prior",
        }),
      ],
    }),
  );

  assert.equal(result.status, "recommended");
  if (result.status === "recommended") {
    assert.equal(result.hintLevel, "nudge");
    assert.equal(result.assistanceLevel, "reteach-required");
  }
});

test("a prior-opportunity recheck cannot reset the current opportunity budget", () => {
  const learnerStageProfile = {
    ...request().learnerStageProfile,
    maximumHintEscalationsBeforeRecheck: 1,
  } as const;
  const result = selectBoundedHint(
    request({
      attemptCount: 2,
      learnerStageProfile,
      interventionHistory: [
        hintHistory("nudge"),
        {
          learnerScopeRef: LEARNER_SCOPE_REF,
          sessionRef: SESSION_REF,
          interventionRef: "intervention:item-001-prior-recheck",
          contextRef: CONTEXT_REF,
          sourceInteractionRef: "interaction:item-001-prior-recheck",
          opportunityRef: "opportunity:item-001-prior",
          ordinal: 2,
          interventionKind: "comprehension-recheck",
          hintLevel: "none",
          assistanceLevel: "light-hint",
        },
      ],
    }),
  );

  assert.equal(result.status, "no-hint");
  if (result.status === "no-hint") {
    assert.deepEqual(result.reasonCodes, ["learner-stage-recheck-required"]);
  }
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

test("duplicate and malformed hint provenance fails closed", () => {
  const first = hintHistory("nudge");
  const malformedCandidates: unknown[] = [
    request({
      interventionHistory: [
        first,
        hintHistory("concept-cue", CONTEXT_REF, 2, {
          interventionRef: first.interventionRef,
        }),
      ],
    }),
    request({
      interventionHistory: [
        first,
        hintHistory("concept-cue", CONTEXT_REF, 1, {
          interventionRef: "intervention:contradictory-replay",
        }),
      ],
    }),
    { ...request(), currentOpportunityRef: "not an opaque reference" },
    request({
      interventionHistory: [
        hintHistory("nudge", CONTEXT_REF, 1, {
          opportunityRef: "malformed opportunity",
        }),
      ],
    }),
    request({
      interventionHistory: [
        hintHistory("nudge", CONTEXT_REF, 1, {
          sourceInteractionRef: "malformed interaction",
        }),
      ],
    }),
  ];

  for (const malformed of malformedCandidates) {
    assert.equal(selectBoundedHint(malformed).status, "rejected");
  }
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

test("cross-learner hint history fails closed instead of escalating nudge to concept cue", () => {
  const result = selectBoundedHint(
    request({
      interventionHistory: [
        hintHistory("concept-cue", CONTEXT_REF, 1, {
          learnerScopeRef: "learner-scope:learner-b",
        }),
      ],
    }),
  );
  assert.deepEqual(result, {
    status: "rejected",
    code: "INVALID_HINT_STATE",
    tutorMayProvideHint: false,
    unrestrictedProviderProseAllowed: false,
  });
});

test("same learner hint history from another session fails closed", () => {
  const result = selectBoundedHint(
    request({
      interventionHistory: [
        hintHistory("concept-cue", CONTEXT_REF, 1, {
          sessionRef: "session:session-b",
        }),
      ],
    }),
  );
  assert.equal(result.status, "rejected");
});

test("same learner and session hint history from another context fails closed", () => {
  const result = selectBoundedHint(
    request({
      interventionHistory: [
        hintHistory("concept-cue", "hint-context:different-item"),
      ],
    }),
  );
  assert.equal(result.status, "rejected");
});

test("legitimate prior interaction is accepted without contaminating current escalation", () => {
  const result = selectBoundedHint(
    request({
      interventionHistory: [
        hintHistory("guided-step", CONTEXT_REF, 1, {
          sourceInteractionRef: "interaction:prior-hint-interaction",
          opportunityRef: "opportunity:prior-hint-opportunity",
        }),
      ],
    }),
  );
  assert.equal(result.status, "recommended");
  assert.equal(result.hintLevel, "nudge");
  if (result.status === "recommended") {
    assert.equal(result.assistanceLevel, "light-hint");
    assert.equal(
      result.reasonCodes.includes("intervention-history-recommendation"),
      false,
    );
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

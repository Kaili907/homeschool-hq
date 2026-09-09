import assert from "node:assert/strict";
import test from "node:test";
import { validateExact } from "../../core/v2/contracts/index.js";
import {
  InMemoryWave2ReplayLedger,
  Wave2AdaptiveCompositionRequestSchema,
  Wave2StudyDecisionPacketSchema,
  composeWave2AdaptiveIntelligence,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";
import { countingSubsystems, counters } from "./wave2-r2-test-support.js";

type Fixture = ReturnType<typeof wave2Fixture>;

function setCurrentAssistance(
  input: Fixture,
  assistance: "independent" | "light-hint" | "guided" | "reteach-required",
): void {
  input.masteryEvidence.currentOpportunityAssistanceLevel = assistance;
  const current = input.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === input.studyAuthority.currentOpportunityRef,
  );
  assert.ok(current);
  current.assistanceLevel = assistance;
}

function completedReviewFixture(): Fixture {
  const input = wave2Fixture();
  input.misconceptionMatch.evidence = [];
  input.studyAuthority.assessmentPhase = "completed-assessment-review";
  input.hintSelection.assessmentPhase = "completed-assessment-review";
  input.intervention.assessmentPhase = "completed-assessment-review";
  input.hintSelection.attemptCount = 1;
  input.hintSelection.currentReviewEventRef = "review-event:wave2-current";
  input.hintSelection.currentReviewPolicyRevisionRef = "policy-revision:wave2-current";
  input.hintSelection.currentReviewPrivacyApprovalRef =
    "privacy-approval:wave2-review-current";
  input.hintSelection.reviewPermission = {
    permissionVersion: "study-tutor-v2.completed-assessment-review-permission.v1",
    status: "authorized",
    permissionKind: "study-completed-assessment-review-permission",
    issuer: "study",
    permissionRef: "permission:wave2-review-current",
    learnerScopeRef: input.studyAuthority.learnerScopeRef,
    sessionRef: input.studyAuthority.sessionRef,
    instructionalContextRef: input.studyAuthority.instructionalContextRef,
    opportunityRef: input.studyAuthority.currentOpportunityRef,
    reviewEventRef: "review-event:wave2-current",
    policyRevisionRef: "policy-revision:wave2-current",
    privacyApprovalRef: "privacy-approval:wave2-review-current",
  };
  setCurrentAssistance(input, "light-hint");
  return input;
}

async function compose(input: unknown, ledger = new InMemoryWave2ReplayLedger()) {
  return composeWave2AdaptiveIntelligence(input, { replayLedger: ledger });
}

test("ADMISSION_STUDY_SCOPE_BINDING rejects cross-household, learner, session, and context reuse", async () => {
  const exact = await compose(wave2Fixture());
  assert.equal(exact.status, "pending-study-decision");

  for (const [field, foreignRef] of [
    ["householdScopeRef", "household-scope:foreign"],
    ["learnerScopeRef", "learner-scope:foreign"],
    ["sessionRef", "session:foreign"],
    ["instructionalContextRef", "instructional-context:foreign"],
  ] as const) {
    const input = wave2Fixture();
    input.capabilityMetadata[field] = foreignRef;
    const result = await compose(input);
    assert.equal(result.status, "reviewed-static-fallback", field);
    if (result.status === "reviewed-static-fallback") {
      assert.equal(result.reasonCode, "admission-scope-binding-mismatch", field);
    }
  }
});

test("COMPLETED_REVIEW_PERMISSION_SCOPE reconciles every permission dimension including nullable privacy approval", async () => {
  const exact = await compose(completedReviewFixture());
  assert.equal(exact.status, "pending-study-decision");
  if (exact.status === "pending-study-decision") {
    assert.equal(exact.intervention.actionKind, "hint");
    assert.equal(exact.hint.status, "recommended");
  }

  const unauthorizedCases: readonly [string, (input: Fixture) => void][] = [
    ["changed-only-privacy", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.privacyApprovalRef =
          "privacy-approval:foreign";
      }
    }],
    ["permission-non-null-current-null", (input) => {
      input.hintSelection.currentReviewPrivacyApprovalRef = null;
    }],
    ["permission-null-current-non-null", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.privacyApprovalRef = null;
      }
    }],
    ["changed-learner", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.learnerScopeRef = "learner-scope:foreign";
      }
    }],
    ["changed-session", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.sessionRef = "session:foreign";
      }
    }],
    ["changed-context", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.instructionalContextRef =
          "instructional-context:foreign";
      }
    }],
    ["changed-opportunity", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.opportunityRef = "opportunity:wave2-new";
      }
    }],
    ["changed-review-event", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.reviewEventRef = "review-event:wave2-new";
      }
    }],
    ["changed-policy-revision", (input) => {
      if (input.hintSelection.reviewPermission.status === "authorized") {
        input.hintSelection.reviewPermission.policyRevisionRef =
          "policy-revision:wave2-new";
      }
    }],
  ];
  for (const [name, mutate] of unauthorizedCases) {
    const input = completedReviewFixture();
    mutate(input);
    setCurrentAssistance(input, "independent");
    const result = await compose(input);
    assert.equal(result.status, "pending-study-decision", name);
    if (result.status === "pending-study-decision") {
      assert.equal(result.hint.status, "no-hint", name);
      assert.equal(result.hint.hintLevel, "none", name);
    }
  }

  const nullPrivacy = completedReviewFixture();
  nullPrivacy.hintSelection.currentReviewPrivacyApprovalRef = null;
  if (nullPrivacy.hintSelection.reviewPermission.status === "authorized") {
    nullPrivacy.hintSelection.reviewPermission.privacyApprovalRef = null;
  }
  const nullPrivacyResult = await compose(nullPrivacy);
  assert.equal(nullPrivacyResult.status, "pending-study-decision");
  if (nullPrivacyResult.status === "pending-study-decision") {
    assert.equal(nullPrivacyResult.hint.status, "recommended");
  }

  const legacy = completedReviewFixture() as unknown as Record<string, unknown>;
  const hint = legacy.hintSelection as Record<string, unknown>;
  hint.reviewPermission = { completedAssessmentReviewAllowed: true };
  assert.equal(
    validateExact(Wave2AdaptiveCompositionRequestSchema, legacy).status,
    "rejected",
  );
  assert.equal((await compose(legacy)).status, "reviewed-static-fallback");

  const active = completedReviewFixture();
  active.studyAuthority.assessmentPhase = "active-graded-or-mastery-check";
  active.hintSelection.assessmentPhase = "active-graded-or-mastery-check";
  active.intervention.assessmentPhase = "active-graded-or-mastery-check";
  setCurrentAssistance(active, "independent");
  const activeResult = await compose(active);
  assert.equal(activeResult.status, "pending-study-decision");
  if (activeResult.status === "pending-study-decision") {
    assert.equal(activeResult.hint.status, "no-hint");
  }
});

test("DECISION_OPPORTUNITY_PROVENANCE is locally reconciled and pending-only", async () => {
  const request = wave2Fixture();
  const result = await compose(request);
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") return;
  assert.deepEqual(result.decisionProvenance, {
    learnerScopeRef: request.studyAuthority.learnerScopeRef,
    sessionRef: request.studyAuthority.sessionRef,
    instructionalContextRef: request.studyAuthority.instructionalContextRef,
    opportunityRef: request.studyAuthority.currentOpportunityRef,
    effectiveAssistanceLevel: "independent",
  });

  const ledger = new InMemoryWave2ReplayLedger();
  const first = await compose(wave2Fixture(), ledger);
  const duplicate = await compose(wave2Fixture(), ledger);
  const collisionInput = wave2Fixture();
  collisionInput.hintSelection.attemptCount += 1;
  const collision = await compose(collisionInput, ledger);
  const fallback = await compose({ malformed: true });
  assert.equal(first.status, "pending-study-decision");
  assert.equal(duplicate.status, "duplicate-ignored");
  assert.equal(collision.status, "quarantined");
  assert.equal(fallback.status, "reviewed-static-fallback");
  for (const packet of [duplicate, collision, fallback]) {
    assert.equal("decisionProvenance" in packet, false);
  }
});

test("ADAPTIVE_SUBSYSTEM_RESULT_VALIDATION rejects an extra authority field on an otherwise valid result", async () => {
  const subsystems = countingSubsystems(counters());
  const recommend = subsystems.recommendIntervention;
  Object.defineProperty(subsystems, "recommendIntervention", {
    value(input: Parameters<typeof recommend>[0]) {
      const result = recommend(input);
      return { ...result, authorityOverride: true };
    },
  });
  const result = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
    adaptiveSubsystems: subsystems,
  });
  assert.equal(result.status, "reviewed-static-fallback");
  if (result.status === "reviewed-static-fallback") {
    assert.equal(result.reasonCode, "intervention-ladder-unavailable");
    assert.equal(result.failedFeature, "intervention-ladder");
  }
});

test("PARENT_WHY_CLOSED_SCOPE_AND_COPY binds Study visibility authorization and rejects arbitrary prose", async () => {
  const result = await compose(wave2Fixture());
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision" || result.parentExplanation === null) {
    throw new Error("Expected pending Parent Why projection");
  }
  assert.equal(result.parentExplanation.visibilityAuthorization.issuer, "study");
  assert.equal(
    result.parentExplanation.visibilityAuthorization.learnerScopeRef,
    result.decisionProvenance.learnerScopeRef,
  );
  assert.match(result.parentExplanation.explanation.explanation, /^Tutor suggested /);
  assert.equal(result.parentExplanation.explanation.explanation.includes("Study applied"), false);
  assert.equal(result.parentExplanation.authoritative, false);
  assert.equal(result.parentExplanation.studyMutationAllowed, false);

  const outageSubsystems = countingSubsystems(counters());
  const proposeRepair = outageSubsystems.proposeRepair;
  Object.defineProperty(outageSubsystems, "proposeRepair", {
    value(
      request: Parameters<typeof proposeRepair>[0],
      dependencies: Parameters<typeof proposeRepair>[1],
    ) {
      return proposeRepair(request, {
        ...dependencies,
        prerequisiteGraph: {
          lookup() {
            throw new Error("repair dependency unavailable");
          },
        },
      });
    },
  });
  const outage = await composeWave2AdaptiveIntelligence(wave2Fixture(), {
    replayLedger: new InMemoryWave2ReplayLedger(),
    adaptiveSubsystems: outageSubsystems,
  });
  assert.equal(outage.status, "pending-study-decision");
  if (outage.status !== "pending-study-decision" || outage.parentExplanation === null) {
    throw new Error("Expected pending fallback Parent Why projection");
  }
  assert.equal(outage.intervention.actionKind, "check-prerequisite");
  assert.equal(outage.repair.source, "reviewed-static-fallback");
  assert.equal(outage.studyMutationAllowed, false);
  assert.equal(
    outage.parentExplanation.explanation.reasonCode,
    "tutor-unavailable-static-fallback-proposed",
  );
  assert.equal(
    outage.parentExplanation.explanation.title,
    "Reviewed fallback proposed",
  );
  assert.equal(
    outage.parentExplanation.explanation.explanation,
    "Tutor was unavailable, so reviewed static guidance was proposed for Study to consider for this step.",
  );
  assert.equal(
    outage.parentExplanation.explanation.disclaimer,
    "This explains an existing recommendation. It does not make or change a learning decision.",
  );
  assert.doesNotMatch(
    JSON.stringify(outage.parentExplanation),
    /Study (?:used|applied|changed|assigned|performed|completed)\b/i,
  );

  const pendingHint = wave2Fixture();
  pendingHint.misconceptionMatch.evidence = [];
  const pendingHintResult = await compose(pendingHint);
  assert.equal(pendingHintResult.status, "pending-study-decision");
  if (
    pendingHintResult.status !== "pending-study-decision" ||
    pendingHintResult.parentExplanation === null
  ) throw new Error("Expected pending hint Parent Why projection");
  assert.equal(pendingHintResult.intervention.actionKind, "hint");
  assert.equal(
    pendingHintResult.parentExplanation.explanation.reasonCode,
    "hint-level-change-proposed",
  );
  assert.doesNotMatch(
    JSON.stringify(pendingHintResult.parentExplanation),
    /Study (?:used|applied|changed|assigned|performed|completed)\b/i,
  );

  for (const prose of [
    "Raw learner transcript: private answer",
    "The correct answer is four.",
    "Credential token: secret",
    "Private note: the learner disclosed a family concern.",
    "Diagnosis: attention disorder.",
    "The learner has a personality disorder.",
  ]) {
    const contaminated = structuredClone(result) as unknown as Record<string, unknown>;
    const parent = contaminated.parentExplanation as Record<string, unknown>;
    const explanation = parent.explanation as Record<string, unknown>;
    explanation.explanation = prose;
    assert.equal(validateExact(Wave2StudyDecisionPacketSchema, contaminated).status, "rejected");
  }

  const foreignVisibility = wave2Fixture();
  foreignVisibility.parentWhy!.guardianVisibilityAuthorization.learnerScopeRef =
    "learner-scope:foreign";
  assert.equal((await compose(foreignVisibility)).status, "reviewed-static-fallback");
});

test("MISCONCEPTION_CODE_SEMANTIC_CLOSURE accepts bounded academic code and rejects free-form diagnostic strings", async () => {
  const result = await compose(wave2Fixture());
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") return;
  assert.equal(
    result.misconception.academicMisconceptionCode,
    "MATH_FRACTION_ADD_DENOMINATORS",
  );

  for (const code of [
    "the learner keeps adding denominators without a common denominator",
    "MATH_LEARNER_LAZY_PERSONALITY_DIAGNOSIS",
    `MATH_${"OVERLONG_".repeat(20)}CODE`,
  ]) {
    const contaminated = structuredClone(result) as unknown as Record<string, unknown>;
    const misconception = contaminated.misconception as Record<string, unknown>;
    misconception.academicMisconceptionCode = code;
    assert.equal(validateExact(Wave2StudyDecisionPacketSchema, contaminated).status, "rejected");
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  proposeReteachPlan,
  type ReteachDependencies,
  type ReteachPlanRequest,
  type ReteachRecommendationRequest,
  type ReteachReviewedContentLookupRequest,
} from "./reteach.js";

const binding = {
  householdScopeRef: "household:one",
  learnerScopeRef: "learner:one",
  sessionRef: "session:one",
  invocationRef: "invocation:reteach-one",
  subjectRef: "subject:math",
  gradeRef: "grade:five",
  curriculumRef: "curriculum:math-five",
  workingLevelRef: "working-level:fractions",
} as const;

const request: ReteachPlanRequest = {
  requestRef: "request:reteach-one",
  binding,
  currentConceptRef: "concept:fractions",
  assessmentPhase: "instruction-or-practice",
  safety: { safetyHold: false, mayContinueAcademicFlow: true },
  maxReteachSteps: 3,
  priorReteachLoops: 0,
  maxRepeatedLoops: 2,
  reviewedStaticFallback: {
    fallbackRef: "fallback:reteach-static",
    reviewedContentRefs: ["content:reviewed-static-fractions"],
  },
};

function dependencies(): ReteachDependencies {
  return {
    hintInterventions: {
      recommend(input) {
        const lookup = input as ReteachRecommendationRequest;
        return {
          requestRef: lookup.requestRef,
          binding: lookup.binding,
          currentConceptRef: lookup.currentConceptRef,
          steps: [
            {
              stepRef: "reteach-step:model",
              sequence: 1,
              stepKind: "review-model",
              conceptRef: lookup.currentConceptRef,
              reviewedContentRef: "content:fraction-model-reviewed",
            },
            {
              stepRef: "reteach-step:guided",
              sequence: 2,
              stepKind: "guided-practice",
              conceptRef: lookup.currentConceptRef,
              reviewedContentRef: "content:fraction-practice-reviewed",
            },
          ],
        };
      },
    },
    reviewedContent: {
      lookup(input) {
        const lookup = input as ReteachReviewedContentLookupRequest;
        return {
          requestRef: lookup.requestRef,
          binding: lookup.binding,
          purpose: "reteach",
          currentConceptRef: lookup.currentConceptRef,
          approvedContentRefs: lookup.candidateContentRefs,
        };
      },
    },
  };
}

test("reteach returns only bounded reviewed-content steps", async () => {
  const result = await proposeReteachPlan(request, dependencies());
  assert.equal(result.status, "proposed");
  assert.equal(result.source, "adaptive");
  assert.equal(result.reasonCode, "RETEACH_RECOMMENDED");
  assert.equal(result.steps.length, 2);
  assert.deepEqual(result.reviewedContentRefs, [
    "content:fraction-model-reviewed",
    "content:fraction-practice-reviewed",
  ]);
  assert.equal(result.answerAuthority, "none");
  assert.equal(result.activeAssessmentBypass, false);
  assert.equal(result.studyDecisionRequired, true);
  assert.equal("prose" in result.steps[0]!, false);
});

test("reteach steps are hard-capped at four", async () => {
  const ports = dependencies();
  ports.hintInterventions.recommend = (input) => {
    const lookup = input as ReteachRecommendationRequest;
    return {
      requestRef: lookup.requestRef,
      binding: lookup.binding,
      currentConceptRef: lookup.currentConceptRef,
      steps: Array.from({ length: 6 }, (_, index) => ({
        stepRef: `reteach-step:cap-${index + 1}`,
        sequence: index + 1,
        stepKind: "concept-cue",
        conceptRef: lookup.currentConceptRef,
        reviewedContentRef: `content:reviewed-cap-${index + 1}`,
      })),
    };
  };
  const result = await proposeReteachPlan(
    { ...structuredClone(request), maxReteachSteps: 99 },
    ports,
  );
  assert.equal(result.maxReteachSteps, 4);
  assert.equal(result.steps.length, 4);
  assert.equal(result.reasonCode, "RETEACH_STEP_CAP_REACHED");
});

test("repeated reteach loop cap is terminal at, above, and across replay", async () => {
  let recommendationCalls = 0;
  let reviewCalls = 0;
  const ports = dependencies();
  ports.hintInterventions.recommend = () => {
    recommendationCalls += 1;
    throw new Error("must not be called");
  };
  ports.reviewedContent.lookup = () => {
    reviewCalls += 1;
    throw new Error("must not be called");
  };
  const cappedRequest = { ...structuredClone(request), priorReteachLoops: 2 };
  const result = await proposeReteachPlan(cappedRequest, ports);
  assert.equal(result.status, "withheld");
  assert.equal(result.reasonCode, "REPEATED_RETEACH_LOOP_CAP_REACHED");
  assert.equal(result.source, "none");
  assert.equal(recommendationCalls, 0);
  assert.equal(reviewCalls, 0);
  assert.deepEqual(result.steps, []);
  assert.deepEqual(result.reviewedContentRefs, []);
  assert.equal(result.studyDecisionRequired, true);
  assert.equal(result.authorityEffects.masteryWrite, "none");
  assert.equal(result.authorityEffects.workingLevelMutation, "none");
  assert.deepEqual([...new Set(Object.values(result.authorityEffects))], ["none"]);
  assert.equal("escalation" in result, false);

  const above = await proposeReteachPlan(
    { ...structuredClone(request), priorReteachLoops: 3 },
    ports,
  );
  assert.equal(above.status, "withheld");
  assert.equal(above.reasonCode, "REPEATED_RETEACH_LOOP_CAP_REACHED");
  assert.equal(above.source, "none");
  assert.deepEqual(above.steps, []);
  assert.deepEqual(above.reviewedContentRefs, []);

  const below = await proposeReteachPlan(
    { ...structuredClone(request), priorReteachLoops: 1 },
    dependencies(),
  );
  assert.equal(below.status, "proposed");
  assert.equal(below.reasonCode, "RETEACH_RECOMMENDED");
  assert.equal(below.source, "adaptive");
  assert.equal(below.steps.length, 2);
  assert.equal(below.priorReteachLoops, 1);

  const replay = await proposeReteachPlan(cappedRequest, ports);
  assert.deepEqual(replay, result);
  assert.equal(replay.status, "withheld");
  assert.deepEqual(replay.steps, []);
  assert.deepEqual(replay.reviewedContentRefs, []);
  assert.equal(recommendationCalls, 0);
  assert.equal(reviewCalls, 0);
});

test("active assessment holds reteach and cannot be bypassed", async () => {
  let calls = 0;
  const ports = dependencies();
  ports.hintInterventions.recommend = () => {
    calls += 1;
    return {};
  };
  const result = await proposeReteachPlan(
    {
      ...structuredClone(request),
      assessmentPhase: "active-graded-or-mastery-check",
      priorReteachLoops: 2,
    },
    ports,
  );
  assert.equal(result.status, "withheld");
  assert.equal(result.reasonCode, "ACTIVE_ASSESSMENT_HELD");
  assert.deepEqual(result.steps, []);
  assert.equal(result.activeAssessmentBypass, false);
  assert.equal(calls, 0);
});

test("safety hold returns no reteach steps", async () => {
  const result = await proposeReteachPlan(
    {
      ...structuredClone(request),
      safety: { safetyHold: true, mayContinueAcademicFlow: false },
      priorReteachLoops: 2,
    },
    dependencies(),
  );
  assert.equal(result.status, "withheld");
  assert.equal(result.reasonCode, "SAFETY_HOLD");
  assert.deepEqual(result.steps, []);
  assert.deepEqual(result.reviewedContentRefs, []);
});

test("provider prose or answer authority in a recommendation triggers fallback", async () => {
  const ports = dependencies();
  const original = ports.hintInterventions.recommend;
  ports.hintInterventions.recommend = async (input) => {
    const result = await original(input) as Record<string, unknown>;
    const steps = result.steps as Array<Record<string, unknown>>;
    steps[0]!.providerProse = "Novel provider explanation";
    steps[0]!.correctAnswer = "one half";
    return result;
  };
  const result = await proposeReteachPlan(request, ports);
  assert.equal(result.source, "reviewed-static-fallback");
  assert.equal(result.reasonCode, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  assert.equal(JSON.stringify(result).includes("Novel provider explanation"), false);
  assert.equal(JSON.stringify(result).includes("one half"), false);
});

test("unreviewed reteach content is rejected in favor of static reviewed content", async () => {
  const ports = dependencies();
  ports.reviewedContent.lookup = (input) => {
    const lookup = input as ReteachReviewedContentLookupRequest;
    return {
      requestRef: lookup.requestRef,
      binding: lookup.binding,
      purpose: "reteach",
      currentConceptRef: lookup.currentConceptRef,
      approvedContentRefs: [lookup.candidateContentRefs[0]],
    };
  };
  const result = await proposeReteachPlan(request, ports);
  assert.equal(result.reasonCode, "UNREVIEWED_CONTENT_REJECTED");
  assert.equal(result.source, "reviewed-static-fallback");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-fractions"]);
});

test("reteach dependency outage below the loop cap returns safe static recommendation", async () => {
  const ports = dependencies();
  ports.hintInterventions.recommend = () => {
    throw new Error("recommendation unavailable");
  };
  const result = await proposeReteachPlan(
    { ...structuredClone(request), priorReteachLoops: 1 },
    ports,
  );
  assert.equal(result.status, "proposed");
  assert.equal(result.reasonCode, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  assert.equal(result.source, "reviewed-static-fallback");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-fractions"]);
  assert.equal(result.steps[0]?.reviewedContentRef, "content:reviewed-static-fractions");
});

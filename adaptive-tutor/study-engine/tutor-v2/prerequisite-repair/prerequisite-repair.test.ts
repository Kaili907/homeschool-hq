import assert from "node:assert/strict";
import test from "node:test";
import {
  proposePrerequisiteRepair,
  type MisconceptionSignalLookupResult,
  type PrerequisiteGraphLookupRequest,
  type PrerequisiteGraphLookupResult,
  type PrerequisiteRepairDependencies,
  type PrerequisiteRepairRequest,
  type RepairReviewedContentLookupRequest,
} from "./prerequisite-repair.js";

const binding = {
  householdScopeRef: "household:one",
  learnerScopeRef: "learner:one",
  sessionRef: "session:one",
  invocationRef: "invocation:one",
  subjectRef: "subject:math",
  gradeRef: "grade:five",
  curriculumRef: "curriculum:math-five",
  workingLevelRef: "working-level:fractions",
} as const;

const request: PrerequisiteRepairRequest = {
  requestRef: "request:repair-one",
  binding,
  currentConceptRef: "concept:fractions",
  assessmentPhase: "instruction-or-practice",
  safety: { safetyHold: false, mayContinueAcademicFlow: true },
  maxRepairDepth: 3,
  reviewedStaticFallback: {
    fallbackRef: "fallback:repair-static",
    reviewedContentRefs: ["content:reviewed-static-fractions"],
  },
};

const graph = new Map<string, readonly string[]>([
  ["concept:fractions", ["concept:equal-parts"]],
  ["concept:equal-parts", ["concept:counting-parts"]],
  ["concept:counting-parts", ["concept:whole-and-part"]],
  ["concept:whole-and-part", []],
]);

function graphResult(input: PrerequisiteGraphLookupRequest): PrerequisiteGraphLookupResult {
  return {
    requestRef: input.requestRef,
    binding: input.binding,
    conceptRef: input.conceptRef,
    prerequisites: (graph.get(input.conceptRef) ?? []).map((conceptRef) => ({
      conceptRef,
      subjectRef: input.binding.subjectRef,
      gradeRef: input.binding.gradeRef,
      curriculumRef: input.binding.curriculumRef,
    })),
  };
}

function dependencies(
  suspectedPrerequisiteRefs: readonly string[] = ["concept:equal-parts"],
): PrerequisiteRepairDependencies {
  return {
    prerequisiteGraph: {
      lookup(input) {
        return graphResult(input as PrerequisiteGraphLookupRequest);
      },
    },
    misconceptionSignals: {
      lookup(input) {
        const lookup = input as {
          requestRef: string;
          binding: typeof binding;
          currentConceptRef: string;
        };
        return {
          requestRef: lookup.requestRef,
          binding: lookup.binding,
          currentConceptRef: lookup.currentConceptRef,
          status: suspectedPrerequisiteRefs.length === 0 ? "clear" : "suspected",
          suspectedPrerequisiteRefs,
        } satisfies MisconceptionSignalLookupResult;
      },
    },
    reviewedContent: {
      lookup(input) {
        const lookup = input as RepairReviewedContentLookupRequest;
        return {
          requestRef: lookup.requestRef,
          binding: lookup.binding,
          purpose: "prerequisite-repair",
          entries: lookup.conceptRefs.map((conceptRef) => ({
            conceptRef,
            reviewedContentRefs: [
              `content:${conceptRef.slice("concept:".length)}-reviewed`,
            ],
          })),
        };
      },
    },
  };
}

test("one prerequisite returns a bounded Study-decision proposal", async () => {
  const result = await proposePrerequisiteRepair(request, dependencies());
  assert.equal(result.status, "proposed");
  assert.equal(result.source, "adaptive");
  assert.equal(result.reasonCode, "PREREQUISITE_REPAIR_RECOMMENDED");
  assert.deepEqual(result.recommendedRepairConceptRefs, ["concept:equal-parts"]);
  assert.deepEqual(result.reviewedContentRefs, ["content:equal-parts-reviewed"]);
  assert.equal(result.studyDecisionRequired, true);
  assert.equal(result.authorityEffects.sequencing, "none");
  assert.equal(result.authorityEffects.masteryWrite, "none");
});

test("prerequisite chain includes the bounded ancestor path without assigning it", async () => {
  const result = await proposePrerequisiteRepair(
    request,
    dependencies(["concept:counting-parts"]),
  );
  assert.equal(result.reasonCode, "PREREQUISITE_CHAIN_RECOMMENDED");
  assert.deepEqual(result.recommendedRepairConceptRefs, [
    "concept:equal-parts",
    "concept:counting-parts",
  ]);
  assert.equal(result.appliedRepairDepth, 2);
  assert.equal(result.authorityEffects.assignment, "none");
});

test("max-depth caps a prerequisite chain", async () => {
  const result = await proposePrerequisiteRepair(
    { ...structuredClone(request), maxRepairDepth: 2 },
    dependencies([]),
  );
  assert.equal(result.maxRepairDepth, 2);
  assert.equal(result.appliedRepairDepth, 2);
  assert.equal(result.reasonCode, "MAX_REPAIR_DEPTH_REACHED");
  assert.equal(result.recommendedRepairConceptRefs.includes("concept:whole-and-part"), false);
});

test("repair depth is hard-capped even when Study requests more", async () => {
  const result = await proposePrerequisiteRepair(
    { ...structuredClone(request), maxRepairDepth: 99 },
    dependencies([]),
  );
  assert.equal(result.maxRepairDepth, 3);
  assert.equal(result.appliedRepairDepth, 3);
});

test("graph unavailable returns the reviewed static fallback", async () => {
  const ports = dependencies();
  ports.prerequisiteGraph.lookup = () => {
    throw new Error("graph unavailable");
  };
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.reasonCode, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");
  assert.equal(result.source, "reviewed-static-fallback");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-fractions"]);
  assert.deepEqual(result.recommendedRepairConceptRefs, []);
});

test("conflicting misconception signals cannot select a route", async () => {
  const ports = dependencies();
  ports.misconceptionSignals.lookup = (input) => {
    const lookup = input as {
      requestRef: string;
      binding: typeof binding;
      currentConceptRef: string;
    };
    return {
      requestRef: lookup.requestRef,
      binding: lookup.binding,
      currentConceptRef: lookup.currentConceptRef,
      status: "conflicting",
      suspectedPrerequisiteRefs: ["concept:equal-parts", "concept:decimals"],
    };
  };
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.reasonCode, "CONFLICTING_MISCONCEPTION_SIGNALS");
  assert.equal(result.source, "reviewed-static-fallback");
  assert.deepEqual(result.recommendedRepairConceptRefs, []);
});

test("working-level mutation attempt fails closed and never appears in output", async () => {
  const ports = dependencies();
  ports.prerequisiteGraph.lookup = (input) => ({
    ...graphResult(input as PrerequisiteGraphLookupRequest),
    workingLevelMutation: "working-level:lower",
  });
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.source, "reviewed-static-fallback");
  assert.equal(result.authorityEffects.workingLevelMutation, "none");
  assert.equal(JSON.stringify(result).includes("working-level:lower"), false);
});

test("cross-grade route attempt is rejected", async () => {
  const ports = dependencies();
  ports.prerequisiteGraph.lookup = (input) => {
    const value = graphResult(input as PrerequisiteGraphLookupRequest);
    return {
      ...value,
      prerequisites: value.prerequisites.map((node) => ({
        ...node,
        gradeRef: "grade:four",
      })),
    };
  };
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.reasonCode, "UNAUTHORIZED_ROUTE_REJECTED");
  assert.equal(result.source, "reviewed-static-fallback");
  assert.equal(result.authorityEffects.gradeMutation, "none");
});

test("cross-child context from a signal port is rejected", async () => {
  const ports = dependencies();
  ports.misconceptionSignals.lookup = (input) => {
    const lookup = input as {
      requestRef: string;
      binding: typeof binding;
      currentConceptRef: string;
    };
    return {
      requestRef: lookup.requestRef,
      binding: { ...lookup.binding, learnerScopeRef: "learner:sibling" },
      currentConceptRef: lookup.currentConceptRef,
      status: "suspected",
      suspectedPrerequisiteRefs: ["concept:equal-parts"],
    };
  };
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.reasonCode, "CROSS_CONTEXT_RESULT_REJECTED");
  assert.equal(JSON.stringify(result).includes("learner:sibling"), false);
});

test("replay is byte-deterministic", async () => {
  const first = await proposePrerequisiteRepair(request, dependencies());
  const second = await proposePrerequisiteRepair(
    structuredClone(request),
    dependencies(),
  );
  assert.deepEqual(second, first);
  assert.equal(JSON.stringify(second), JSON.stringify(first));
});

test("reviewed-content failure uses only the static fallback references", async () => {
  const ports = dependencies();
  ports.reviewedContent.lookup = () => {
    throw new Error("review catalog unavailable");
  };
  const result = await proposePrerequisiteRepair(request, ports);
  assert.equal(result.source, "reviewed-static-fallback");
  assert.deepEqual(result.reviewedContentRefs, ["content:reviewed-static-fractions"]);
  assert.equal(JSON.stringify(result).includes("equal-parts-reviewed"), false);
});

test("request-side authority mutation fields invalidate the request", async () => {
  const mutated = {
    ...structuredClone(request),
    targetCourseRef: "course:other",
  };
  const result = await proposePrerequisiteRepair(mutated, dependencies());
  assert.equal(result.status, "withheld");
  assert.equal(result.reasonCode, "INVALID_STUDY_REQUEST");
  assert.equal(result.source, "none");
});

test("active assessment holds prerequisite repair with no route", async () => {
  const result = await proposePrerequisiteRepair(
    { ...structuredClone(request), assessmentPhase: "active-graded-or-mastery-check" },
    dependencies(),
  );
  assert.equal(result.status, "withheld");
  assert.equal(result.reasonCode, "ACTIVE_ASSESSMENT_HELD");
  assert.deepEqual(result.recommendedRepairConceptRefs, []);
  assert.deepEqual(result.reviewedContentRefs, []);
});

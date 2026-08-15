import assert from "node:assert/strict";
import { evaluateAdaptiveAdmission } from "../../core/v2/admission/index.js";
import { buildConceptGraph } from "../../core/v2/concepts/index.js";
import { selectBoundedHint } from "../../core/v2/hints/index.js";
import { recommendNextIntervention } from "../../core/v2/interventions/index.js";
import { evaluateMasteryEvidence } from "../../core/v2/mastery/index.js";
import { createAcademicMisconceptionRegistry } from "../../core/v2/misconceptions/index.js";
import {
  composeWave2AdaptiveIntelligence,
  InMemoryWave2ReplayLedger,
  type Wave2AdaptiveCompositionRequest,
  type Wave2AdaptiveSubsystems,
} from "../../study-engine/tutor-v2/adaptive/index.js";
import { explainTutorRecommendationForParentHub } from "../../study-engine/tutor-v2/parent-explanations/index.js";
import { proposePrerequisiteRepair } from "../../study-engine/tutor-v2/prerequisite-repair/index.js";
import { proposeReteachPlan } from "../../study-engine/tutor-v2/reteach/index.js";
import { wave2Fixture } from "./wave2-fixtures.js";

export const SUBSYSTEM_NAMES = [
  "admission",
  "conceptGraph",
  "conceptQuery",
  "misconceptionRegistry",
  "misconceptionMatch",
  "hint",
  "intervention",
  "mastery",
  "repair",
  "reteach",
  "parent",
] as const;
export type SubsystemName = (typeof SUBSYSTEM_NAMES)[number];
export type SubsystemCounters = Record<SubsystemName, number>;
type ActionKind = Wave2AdaptiveCompositionRequest["studyAuthority"]["allowedActions"][number];
type AssistanceLevel = "independent" | "light-hint" | "guided" | "reteach-required";

export function counters(): SubsystemCounters {
  return Object.fromEntries(SUBSYSTEM_NAMES.map((name) => [name, 0])) as SubsystemCounters;
}

export function countingSubsystems(calls: SubsystemCounters): Wave2AdaptiveSubsystems {
  return {
    evaluateAdmission(input) {
      calls.admission += 1;
      return evaluateAdaptiveAdmission(input);
    },
    buildConceptGraph(input) {
      calls.conceptGraph += 1;
      return buildConceptGraph(input);
    },
    queryConceptGraph(graph, conceptRef) {
      calls.conceptQuery += 1;
      return graph.graph.directPrerequisites(conceptRef);
    },
    createMisconceptionRegistry(input) {
      calls.misconceptionRegistry += 1;
      return createAcademicMisconceptionRegistry(input);
    },
    matchMisconception(registry, request) {
      calls.misconceptionMatch += 1;
      return registry.registry.match(request);
    },
    selectHint(input) {
      calls.hint += 1;
      return selectBoundedHint(input);
    },
    recommendIntervention(input) {
      calls.intervention += 1;
      return recommendNextIntervention(input);
    },
    evaluateMastery(input) {
      calls.mastery += 1;
      return evaluateMasteryEvidence(input);
    },
    proposeRepair(input, dependencies) {
      calls.repair += 1;
      return proposePrerequisiteRepair(input, dependencies);
    },
    proposeReteach(input, dependencies) {
      calls.reteach += 1;
      return proposeReteachPlan(input, dependencies);
    },
    explainParent(input) {
      calls.parent += 1;
      return explainTutorRecommendationForParentHub(input);
    },
  };
}

export class CountingReplayLedger extends InMemoryWave2ReplayLedger {
  calls = 0;

  override claim(eventRef: string, requestFingerprint: string) {
    this.calls += 1;
    return super.claim(eventRef, requestFingerprint);
  }
}

export async function composeWithCounters(
  input: unknown,
  calls: SubsystemCounters,
  replayLedger = new CountingReplayLedger(),
) {
  return composeWave2AdaptiveIntelligence(input, {
    replayLedger,
    adaptiveSubsystems: countingSubsystems(calls),
  });
}

export function assertNoAdaptiveCalls(calls: SubsystemCounters): void {
  assert.deepEqual(calls, counters());
}

export function heldFixture(): Wave2AdaptiveCompositionRequest {
  const input = wave2Fixture();
  input.studyAuthority.safetyStatus = "academic-flow-held";
  input.capabilityMetadata.safetyAdmission = "restricted";
  input.intervention.safetyRestriction = {
    status: "academic-flow-held",
    restrictionRef: "restriction:study-wave2-safety-hold",
  };
  return input;
}

export function authorize(
  input: Wave2AdaptiveCompositionRequest,
  allowedActions: readonly ActionKind[],
): void {
  input.studyAuthority.allowedActions = [...allowedActions];
  input.intervention.allowedActions = [...allowedActions];
}

export function setCurrentAssistance(
  input: Wave2AdaptiveCompositionRequest,
  assistanceLevel: AssistanceLevel,
): void {
  input.masteryEvidence.currentOpportunityAssistanceLevel = assistanceLevel;
  const current = input.masteryEvidence.evidence.find(
    ({ opportunityRef }) => opportunityRef === input.studyAuthority.currentOpportunityRef,
  );
  assert.ok(current, "fixture must contain current-opportunity evidence");
  current.assistanceLevel = assistanceLevel;
}

export function requirePending<T extends Awaited<ReturnType<typeof composeWithCounters>>>(
  result: T,
): Extract<T, { readonly status: "pending-study-decision" }> {
  assert.equal(result.status, "pending-study-decision");
  if (result.status !== "pending-study-decision") throw new Error("Expected pending Study decision");
  return result as Extract<T, { readonly status: "pending-study-decision" }>;
}

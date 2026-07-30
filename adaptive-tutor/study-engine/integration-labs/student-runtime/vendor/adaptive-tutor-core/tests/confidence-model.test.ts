import test from "node:test";
import assert from "node:assert/strict";
import { estimateConfidence, type ConfidenceObservation } from "../core/index.js";

const skillId = "sample-skill";
function observation(id: string, contextId: string, score: number): ConfidenceObservation {
  return {
    id,
    skillId,
    source: "independent-attempt",
    score,
    weight: 1,
    independence: 1,
    contextId,
    evidenceTags: [],
  };
}

test("one answer never becomes sufficient evidence", () => {
  const estimate = estimateConfidence(skillId, [observation("evidence-one", "context-one", 1)]);
  assert.equal(estimate.band, "insufficient-evidence");
  assert.equal(estimate.placementDecisionAllowed, false);
  assert.ok(estimate.uncertainty > 0.3);
});

test("repeated varied evidence narrows uncertainty", () => {
  const observations = Array.from({ length: 8 }, (_, index) =>
    observation(`evidence-${index + 1}`, `context-${index + 1}`, 1),
  );
  const estimate = estimateConfidence(skillId, observations);
  assert.equal(estimate.distinctContextCount, 8);
  assert.ok(estimate.value > 0.85);
  assert.ok(estimate.uncertainty < 0.35);
});

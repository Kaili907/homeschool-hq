import assert from "node:assert/strict";
import test from "node:test";
import {
  WAVE4_EXECUTABLE_DETECTORS,
  validateDetectorCatalog,
} from "../../scripts/tutor-v4/executable-detectors.js";
import { WAVE4_HARD_GATE_FAMILIES } from "../../scripts/tutor-v4/evidence.js";
import { WAVE4_IMPLEMENTATION_MUTATIONS } from "../../scripts/tutor-v4/mutations/catalog.js";

test("all 13 Wave 4 families have one ordered executable non-compensable detector", () => {
  assert.doesNotThrow(validateDetectorCatalog);
  assert.deepEqual(
    WAVE4_EXECUTABLE_DETECTORS.map((detector) => detector.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(new Set(WAVE4_EXECUTABLE_DETECTORS.map(({ detectorId }) => detectorId)).size, 13);
  assert.equal(WAVE4_EXECUTABLE_DETECTORS.every(({ commands }) => commands.length > 0), true);
  assert.equal(WAVE4_EXECUTABLE_DETECTORS.every(({ minimumAssertionCount }) => minimumAssertionCount > 0), true);
});

test("all 13 negative controls rewrite implementation source without changing permanent detectors", () => {
  assert.equal(WAVE4_IMPLEMENTATION_MUTATIONS.length, 13);
  assert.deepEqual(
    WAVE4_IMPLEMENTATION_MUTATIONS.map((mutation) => mutation.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(new Set(WAVE4_IMPLEMENTATION_MUTATIONS.map(({ mutationId }) => mutationId)).size, 13);
  for (const mutation of WAVE4_IMPLEMENTATION_MUTATIONS) {
    assert.equal(mutation.rewrites.length > 0, true, mutation.mutationId);
    for (const rewrite of mutation.rewrites) {
      assert.match(rewrite.sourcePath, /^adaptive-tutor\//);
      assert.equal(rewrite.sourcePath.includes("test"), false, rewrite.sourcePath);
      assert.equal(rewrite.sourcePath.includes("tutor-v2-wave4-release"), false, rewrite.sourcePath);
    }
  }
});

test("single-use-dispatch control targets executable ALREADY_CLAIMED enforcement", () => {
  const mutation = WAVE4_IMPLEMENTATION_MUTATIONS.find(({ mutationId }) =>
    mutationId === "W4-M06-ALLOW-ALREADY-CLAIMED-DISPATCH"
  );
  assert.ok(mutation);
  assert.equal(mutation.family, "RESOURCE_BOUNDS_AND_SINGLE_USE_DISPATCH");
  assert.match(mutation.rewrites[0]?.before ?? "", /dispatchClaim !== "CLAIMED"/);
  assert.match(mutation.rewrites[0]?.after ?? "", /dispatchClaim === "CONFLICT"/);
});

test("no catalog field can manually assert detector PASS", () => {
  for (const detector of WAVE4_EXECUTABLE_DETECTORS) {
    assert.equal(Object.hasOwn(detector, "status"), false);
    assert.equal(Object.hasOwn(detector, "pass"), false);
  }
  for (const mutation of WAVE4_IMPLEMENTATION_MUTATIONS) {
    assert.equal(Object.hasOwn(mutation, "expectedAggregate"), false);
  }
});

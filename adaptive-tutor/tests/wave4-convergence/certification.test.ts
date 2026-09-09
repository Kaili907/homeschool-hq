import assert from "node:assert/strict";
import test from "node:test";
import { WAVE4_EXECUTABLE_DETECTORS } from "../../scripts/tutor-v4/executable-detectors.js";
import {
  POST_REPAIR_BLOCKER_CLOSURES,
  WAVE4_HARD_GATE_FAMILIES,
} from "../../scripts/tutor-v4/evidence.js";
import { WAVE4_IMPLEMENTATION_MUTATIONS } from "../../scripts/tutor-v4/mutations/catalog.js";

test("all 38 historical blockers remain separate from current executable acceptance", () => {
  assert.equal(POST_REPAIR_BLOCKER_CLOSURES.length, 38);
  assert.equal(new Set(POST_REPAIR_BLOCKER_CLOSURES.map((item) => item.id)).size, 38);
  assert.equal(
    POST_REPAIR_BLOCKER_CLOSURES.every((item) =>
      item.baseline === "BASELINE_ADVERSARIAL_FINDING" && item.current === "CLOSED"
    ),
    true,
  );
});

test("Wave 4 acceptance has exactly 13 executable detector definitions and no PASS field", () => {
  assert.deepEqual(
    WAVE4_EXECUTABLE_DETECTORS.map((detector) => detector.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(
    WAVE4_EXECUTABLE_DETECTORS.every((detector) =>
      detector.commands.length > 0 && !Object.hasOwn(detector, "status")
    ),
    true,
  );
});

test("Wave 4 negative controls are 13 implementation source rewrites", () => {
  assert.deepEqual(
    WAVE4_IMPLEMENTATION_MUTATIONS.map((mutation) => mutation.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(
    WAVE4_IMPLEMENTATION_MUTATIONS.every((mutation) => mutation.rewrites.length > 0),
    true,
  );
});

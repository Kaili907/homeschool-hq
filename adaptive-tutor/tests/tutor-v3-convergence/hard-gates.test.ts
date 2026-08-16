import assert from "node:assert/strict";
import test from "node:test";
import {
  WAVE3_HARD_GATE_FAMILIES,
  evaluateWave3HardGates,
} from "../../core/v3/commercial-operation/index.js";
import { collectWave3HardGateEvidence } from "./gate-evidence.js";

test("all 18 non-compensable Wave 3 hard-gate families derive PASS from executed evidence", async () => {
  const evidence = await collectWave3HardGateEvidence();
  const results = evaluateWave3HardGates(evidence);
  assert.equal(results.length, 18);
  assert.deepEqual(results.map((result) => result.name), WAVE3_HARD_GATE_FAMILIES);
  assert.deepEqual(results.filter((result) => result.status !== "PASS"), []);
  assert.equal(results.every((result) => result.nonCompensable), true);
});

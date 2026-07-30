import test from "node:test";
import assert from "node:assert/strict";
import { classifyMisconceptions } from "../core/index.js";
import { mathTutorProgram } from "../examples/index.js";

test("misconception classification selects a supported hypothesis with uncertainty", () => {
  const result = classifyMisconceptions(
    mathTutorProgram.targetSkillId,
    mathTutorProgram.misconceptions,
    [{ tags: ["changes-denominator-only"] }],
  );
  assert.equal(result.selectedMisconceptionId, "math-change-one-number-only");
  assert.equal(result.doNotDiagnose, true);
  assert.match(result.uncertaintyStatement, /hypothesis/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAssessmentItem } from "../core/index.js";
import { mathTutorProgram } from "../examples/index.js";

test("assessment evaluator scores exact multiple-choice sets", () => {
  const item = mathTutorProgram.diagnosticItems[0];
  if (!item) throw new Error("Fixture missing");
  assert.equal(evaluateAssessmentItem(item, { raw: "2/4", selectedOptionIds: ["option-two-fourths"] }).isCorrect, true);
  assert.equal(evaluateAssessmentItem(item, { raw: "2/3", selectedOptionIds: ["option-two-thirds"] }).isCorrect, false);
});

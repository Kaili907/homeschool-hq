import test from "node:test";
import assert from "node:assert/strict";
import { AdaptiveTutorEngine } from "../core/index.js";
import { mathRuntimeHooks, mathTutorProgram } from "../examples/index.js";

function answer(engine: AdaptiveTutorEngine, optionId: string, text = optionId) {
  return engine.submit({ raw: text, selectedOptionIds: [optionId] });
}

test("engine runs assessment through advance with multiple independent evidence points", () => {
  const engine = new AdaptiveTutorEngine(mathTutorProgram, mathRuntimeHooks);
  assert.equal(engine.start().phase, "assessment");
  assert.equal(answer(engine, "option-two-fourths", "2/4").phase, "assessment");
  assert.equal(answer(engine, "option-one-half", "1/2").phase, "identify-missing-concept");
  assert.equal(engine.continue().phase, "teach-visually");
  assert.equal(engine.continue().phase, "teach-visually");
  assert.equal(engine.continue().phase, "guided-practice");
  assert.equal(answer(engine, "option-guided-one-half", "1/2").phase, "guided-practice");
  assert.equal(answer(engine, "option-guided-four-sixths", "4/6").phase, "independent-attempt");
  assert.equal(answer(engine, "option-independent-one-half", "1/2").phase, "independent-attempt");
  assert.equal(answer(engine, "option-independent-four-tenths", "4/10").phase, "independent-attempt");
  assert.equal(answer(engine, "option-independent-six-eighths", "6/8").phase, "reassess");
  assert.equal(answer(engine, "option-reassessment-one-half", "1/2").phase, "reassess");
  const result = answer(engine, "option-reassessment-two-thirds", "2/3");
  assert.equal(result.phase, "advance");
  assert.ok((result.confidence?.evidenceCount ?? 0) >= 7);
  assert.equal(result.confidence?.placementDecisionAllowed, false);
  assert.equal(engine.getReview().highStakesPlacementDecisionMade, false);
});

test("engine reteaches without shame when evidence is weak", () => {
  const engine = new AdaptiveTutorEngine(mathTutorProgram, mathRuntimeHooks);
  engine.start();
  answer(engine, "option-two-thirds", "2/3");
  answer(engine, "option-three-thirds", "3/3");
  engine.continue();
  engine.continue();
  engine.continue();
  answer(engine, "option-guided-three-twelfths", "3/12");
  answer(engine, "option-guided-three-twelfths", "3/12");
  answer(engine, "option-guided-three-twelfths", "3/12");
  answer(engine, "option-guided-six-thirds", "6/3");
  answer(engine, "option-guided-six-thirds", "6/3");
  answer(engine, "option-guided-six-thirds", "6/3");
  answer(engine, "option-independent-four-fourths", "4/4");
  answer(engine, "option-independent-two-tenths", "2/10");
  answer(engine, "option-independent-three-eighths", "3/8");
  answer(engine, "option-reassessment-five-fifths", "5/5");
  const result = answer(engine, "option-reassessment-six-thirds", "6/3");
  assert.equal(result.phase, "reteach");
  assert.doesNotMatch(result.learnerMessage.toLowerCase(), /lazy|bad at/);
});

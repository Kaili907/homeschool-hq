import test from "node:test";
import assert from "node:assert/strict";
import {
  AdaptiveTutorEngine,
  IndependentMasteryContractSchema,
  ParentTeacherReviewSchema,
  TutorResponseSchema,
  VisualBoardCommandSchema,
  promptTemplates,
  validateWithSchema,
} from "../core/index.js";
import { mathRuntimeHooks, mathTutorProgram } from "../examples/index.js";

test("independent mastery contract rejects fewer than three items", () => {
  const invalid = {
    ...mathTutorProgram.independentMastery,
    items: mathTutorProgram.independentMastery.items.slice(0, 1),
    minimumEvidenceCount: 1,
  };
  assert.equal(validateWithSchema(IndependentMasteryContractSchema, invalid).ok, false);
});

test("visual board contract rejects arbitrary executable commands", () => {
  const invalid = {
    id: "unsafe-command",
    kind: "run-script",
    script: "alert(1)",
    durationMs: 0,
    ariaLabel: "Unsafe command",
  };
  assert.equal(validateWithSchema(VisualBoardCommandSchema, invalid).ok, false);
});

test("alternate explanation remains a valid tutor response", () => {
  const engine = new AdaptiveTutorEngine(mathTutorProgram, mathRuntimeHooks);
  engine.start();
  engine.submit({ raw: "2/3", selectedOptionIds: ["option-two-thirds"] });
  engine.submit({ raw: "3/3", selectedOptionIds: ["option-three-thirds"] });
  const response = engine.requestAlternateExplanation();
  assert.equal(response.phase, "teach-visually");
  assert.equal(validateWithSchema(TutorResponseSchema, response).ok, true);
});

test("adult review remains valid before any evidence and forbids placement claims", () => {
  const engine = new AdaptiveTutorEngine(mathTutorProgram, mathRuntimeHooks);
  const review = engine.getReview();
  assert.equal(validateWithSchema(ParentTeacherReviewSchema, review).ok, true);
  assert.equal(review.highStakesPlacementDecisionMade, false);
  assert.equal(review.diagnosticClaimMade, false);
});

test("prompt templates contain the required instructional safety boundaries", () => {
  const joined = promptTemplates.map((template) => template.system).join("\n").toLowerCase();
  assert.match(joined, /not a human/);
  assert.match(joined, /do not complete graded work/);
  assert.match(joined, /do not diagnose/);
  assert.match(joined, /one answer/);
  assert.match(joined, /uncertainty/);
});

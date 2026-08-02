import test from "node:test";
import assert from "node:assert/strict";
import {
  AdaptiveTutorEngine,
  TutorResponseSchema,
  validateWithSchema,
  type AssessmentItem,
} from "../../../core/index.js";
import { decodingMultisyllableWordsModule, englishModules } from "../src/index.js";

function correctOption(item: AssessmentItem): string {
  if (item.kind !== "multiple-choice") throw new Error("Expected a multiple-choice fixture.");
  const option = item.correctOptionIds[0];
  if (!option) throw new Error(`No correct option for ${item.id}.`);
  return option;
}

function wrongOption(item: AssessmentItem): string {
  if (item.kind !== "multiple-choice") throw new Error("Expected a multiple-choice fixture.");
  const option = item.options.find((candidate) => !item.correctOptionIds.includes(candidate.id));
  if (!option) throw new Error(`No incorrect option for ${item.id}.`);
  return option.id;
}

test("each module starts and reaches teaching through the Core v0.2 engine", () => {
  for (const module of englishModules) {
    const engine = new AdaptiveTutorEngine(module.coreProgram, module.runtimeHooks);
    let response = engine.start();
    assert.equal(validateWithSchema(TutorResponseSchema, response).ok, true);
    for (const item of module.coreProgram.diagnosticItems) {
      assert.equal(response.assessmentItem?.id, item.id);
      response = engine.submit({ raw: correctOption(item), selectedOptionIds: [correctOption(item)] });
      assert.equal(validateWithSchema(TutorResponseSchema, response).ok, true);
    }
    assert.equal(response.phase, "identify-missing-concept");
    response = engine.continue();
    assert.equal(response.phase, "teach-visually");
    assert.equal(validateWithSchema(TutorResponseSchema, response).ok, true);
    const alternate = engine.requestAlternateExplanation();
    assert.equal(alternate.alternateExplanationAvailable, true);
    assert.equal(validateWithSchema(TutorResponseSchema, alternate).ok, true);
  }
});

test("insufficient evidence enters a reteaching branch instead of claiming mastery", () => {
  const module = decodingMultisyllableWordsModule;
  const engine = new AdaptiveTutorEngine(module.coreProgram, module.runtimeHooks);
  let response = engine.start();
  for (const item of module.coreProgram.diagnosticItems) {
    response = engine.submit({ raw: wrongOption(item), selectedOptionIds: [wrongOption(item)] });
  }
  assert.equal(response.phase, "identify-missing-concept");
  do {
    response = engine.continue();
  } while (response.phase === "teach-visually");
  assert.equal(response.phase, "guided-practice");
  for (const item of module.coreProgram.guidedPractice.items) {
    response = engine.submit({ raw: correctOption(item), selectedOptionIds: [correctOption(item)] });
  }
  assert.equal(response.phase, "independent-attempt");
  for (const item of module.coreProgram.independentMastery.items) {
    response = engine.submit({ raw: wrongOption(item), selectedOptionIds: [wrongOption(item)] });
  }
  assert.equal(response.phase, "reassess");
  for (const item of module.coreProgram.reassessmentItems) {
    response = engine.submit({ raw: wrongOption(item), selectedOptionIds: [wrongOption(item)] });
  }
  assert.equal(response.phase, "reteach");
  assert.equal(response.alternateExplanationAvailable, true);
  assert.match(response.learnerMessage, /different explanation/i);
});

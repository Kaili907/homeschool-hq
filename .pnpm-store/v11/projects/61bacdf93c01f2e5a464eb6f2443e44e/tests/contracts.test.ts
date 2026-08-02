import test from "node:test";
import assert from "node:assert/strict";
import {
  AssessmentItemSchema,
  GuidedPracticeContractSchema,
  IndependentMasteryContractSchema,
  MediaFallbackSchema,
  SpokenTurnSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  VisualBoardCommandSchema,
  validateWithSchema,
} from "../../../core/index.js";
import { englishModules, validateEnglishModule } from "../src/index.js";

test("all four English programs validate against TutorProgramSchema", () => {
  assert.equal(englishModules.length, 4);
  for (const module of englishModules) {
    assert.equal(validateWithSchema(TutorProgramSchema, module.coreProgram).ok, true, module.lessonId);
  }
});

test("all required Core v0.2 contracts validate for every module", () => {
  const requiredContractPrefixes = [
    "TutorProgramSchema",
    "AssessmentItemSchema",
    "TutorResponseSchema",
    "SpokenTurnSchema",
    "VisualBoardCommandSchema",
    "GuidedPracticeContractSchema",
    "IndependentMasteryContractSchema",
    "MediaFallbackSchema",
  ];
  for (const module of englishModules) {
    const checks = validateEnglishModule(module);
    assert.equal(checks.every((check) => check.passed), true, JSON.stringify(checks.filter((check) => !check.passed)));
    for (const prefix of requiredContractPrefixes) {
      assert.equal(checks.some((check) => check.contract.startsWith(prefix)), true, `${module.lessonId}: ${prefix}`);
    }
  }
});

test("the direct contract objects also validate independently", () => {
  for (const module of englishModules) {
    const program = module.coreProgram;
    const items = [
      ...program.diagnosticItems,
      ...program.guidedPractice.items,
      ...program.independentMastery.items,
      ...program.reassessmentItems,
    ];
    const responses = Object.values(module.coreV02Extension.modeResponses);
    for (const item of items) assert.equal(validateWithSchema(AssessmentItemSchema, item).ok, true);
    for (const response of responses) {
      assert.equal(validateWithSchema(TutorResponseSchema, response).ok, true);
      assert.equal(validateWithSchema(SpokenTurnSchema, response.spokenTurn).ok, true);
      for (const command of response.boardCommands) {
        assert.equal(validateWithSchema(VisualBoardCommandSchema, command).ok, true);
      }
    }
    assert.equal(validateWithSchema(GuidedPracticeContractSchema, program.guidedPractice).ok, true);
    assert.equal(validateWithSchema(IndependentMasteryContractSchema, program.independentMastery).ok, true);
    assert.equal(validateWithSchema(MediaFallbackSchema, program.mediaFallback).ok, true);
  }
});

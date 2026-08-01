import test from "node:test";
import assert from "node:assert/strict";
import {
  coreChangeRequests,
  englishModules,
  englishTutoringRules,
  integrationMatrix,
} from "../src/index.js";

const stableId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

test("the required module list is complete and stable", () => {
  assert.deepEqual(
    englishModules.map((module) => module.completedModuleName),
    [
      "Decoding unfamiliar multisyllable words",
      "Sentence completeness, subjects, predicates, and punctuation",
      "Main idea and supporting details",
      "Organizing and revising a clear paragraph",
    ],
  );
  assert.equal(new Set(englishModules.map((module) => module.lessonId)).size, 4);
  assert.equal(new Set(englishModules.map((module) => module.coreProgram.targetSkillId)).size, 4);
});

test("every module contains a complete adaptive sequence", () => {
  for (const module of englishModules) {
    const program = module.coreProgram;
    const extension = module.coreV02Extension;
    assert.equal(stableId.test(module.lessonId), true);
    assert.equal(stableId.test(program.targetSkillId), true);
    assert.ok(program.skillGraph.edges.length >= 1);
    assert.ok(program.diagnosticItems.length >= 2);
    assert.ok(program.misconceptions.length >= 2);
    assert.ok(program.guidedPractice.items.length >= 2);
    assert.ok(program.independentMastery.items.length >= 3);
    assert.ok(program.reassessmentItems.length >= 2);
    assert.equal(program.independentMastery.singleAnswerCanEstablishMastery, false);
    assert.equal(program.independentMastery.reassessmentRequired, true);
    assert.equal(program.independentMastery.placementDecisionAllowed, false);
    assert.equal(program.mediaFallback.lessonMayContinueWithoutMedia, true);
    assert.equal(program.mediaFallback.captionsAlwaysVisible, true);
    assert.equal(program.mediaFallback.transcriptAlwaysAvailable, true);
    assert.deepEqual(Object.keys(extension.modeResponses).sort(), [
      "different-example",
      "lets-do-one-together",
      "show-me",
      "talk-me-through-it",
    ]);
    assert.equal(extension.distinguishingProbes.length, program.misconceptions.length);
    assert.ok(extension.visualExplanationPlan.boardCommandIds.length >= 3);
    assert.ok(extension.prerequisiteRemediation.length >= 1);
    assert.ok(extension.parentTeacherNotes.lookFor.length >= 1);
    assert.equal(extension.narration.transcript.length, 4);
    assert.equal(extension.narration.captions.length, 4);
    assert.match(extension.webVtt, /^WEBVTT/);
    const itemCount =
      program.diagnosticItems.length +
      program.guidedPractice.items.length +
      program.independentMastery.items.length +
      program.reassessmentItems.length;
    assert.equal(extension.answerReasoning.length, itemCount);
    assert.ok(program.misconceptions.every((misconception) =>
      program.teachingSequences.some((sequence) => sequence.misconceptionId === misconception.id)),
    );
  }
});

test("English tutoring policy encodes every non-negotiable boundary", () => {
  assert.equal(englishTutoringRules.teachRatherThanRewrite, true);
  assert.equal(englishTutoringRules.preserveStudentVoice, true);
  assert.equal(englishTutoringRules.learnerMakesFinalRevision, true);
  assert.equal(englishTutoringRules.oneUsefulStepAtATime, true);
  assert.equal(englishTutoringRules.anotherExplanationAvailable, true);
  assert.equal(englishTutoringRules.shameSpelling, false);
  assert.equal(englishTutoringRules.shameGrammar, false);
  assert.equal(englishTutoringRules.shameReadingLevel, false);
  assert.equal(englishTutoringRules.shameVocabulary, false);
  assert.equal(englishTutoringRules.diagnoseLearningDisability, false);
  assert.equal(englishTutoringRules.completeGradedAssignments, false);
  assert.equal(englishTutoringRules.claimMasteryFromOneResponse, false);
  assert.equal(englishTutoringRules.requireCamera, false);
  assert.equal(englishTutoringRules.requireIdentifiableChildPhotos, false);
  for (const module of englishModules) {
    for (const response of Object.values(module.coreV02Extension.modeResponses)) {
      assert.equal(response.oneUsefulStepOnly, true);
      assert.equal(response.givesFinalGradedAnswer, false);
      assert.equal(response.jarvisClaimsHumanIdentity, false);
      assert.equal(response.alternateExplanationAvailable, true);
    }
  }
});

test("all integration areas are classified and no Core change is requested", () => {
  assert.ok(integrationMatrix.length >= 30);
  assert.ok(integrationMatrix.every((entry) =>
    ["PASS_DIRECT_CORE_V0_2", "PASS_PROVISIONAL_ADAPTER", "BLOCKED_CORE_CHANGE", "NOT_TESTED"].includes(entry.classification)),
  );
  assert.equal(integrationMatrix.some((entry) => entry.classification === "BLOCKED_CORE_CHANGE"), false);
  assert.deepEqual(coreChangeRequests, []);
});

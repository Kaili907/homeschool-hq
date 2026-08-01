import test from "node:test";
import assert from "node:assert/strict";
import {
  NarrationTrackSchema,
  TutorProgramSchema,
  TutorResponseSchema,
  validateWithSchema,
} from "../core/index.js";
import { englishTutorProgram, mathTutorProgram } from "../examples/index.js";
import { narrationFixture } from "../examples/narration.fixture.js";

test("runtime contracts validate both demonstration programs", () => {
  assert.equal(validateWithSchema(TutorProgramSchema, mathTutorProgram).ok, true);
  assert.equal(validateWithSchema(TutorProgramSchema, englishTutorProgram).ok, true);
});

test("narration, caption, and transcript remain valid without audio", () => {
  assert.equal(validateWithSchema(NarrationTrackSchema, narrationFixture).ok, true);
  assert.equal(narrationFixture.audioUri, null);
  assert.equal(narrationFixture.voiceRequired, false);
});

test("tutor response rejects a human identity claim", () => {
  const invalid = {
    ...mathTutorProgram.teachingSequences[0]?.turns[0],
    jarvisClaimsHumanIdentity: true,
  };
  assert.equal(validateWithSchema(TutorResponseSchema, invalid).ok, false);
});

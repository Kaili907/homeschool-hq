import test from "node:test";
import assert from "node:assert/strict";
import { defaultMediaFallback, getVoiceFallback } from "../core/index.js";
import { mathTutorProgram } from "../examples/index.js";

test("media fallback allows lessons to continue", () => {
  assert.equal(defaultMediaFallback.lessonMayContinueWithoutMedia, true);
  assert.equal(defaultMediaFallback.captionsAlwaysVisible, true);
});

test("voice fallback preserves visible text", () => {
  const turn = mathTutorProgram.teachingSequences[0]?.turns[0]?.spokenTurn;
  if (!turn) throw new Error("Fixture missing");
  assert.match(getVoiceFallback(turn, { available: false, reason: "missing-api" }), new RegExp(turn.fallbackText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

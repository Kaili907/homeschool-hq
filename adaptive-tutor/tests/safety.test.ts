import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSafety } from "../core/index.js";

test("safety redirects graded-work completion requests", () => {
  const result = evaluateSafety("Complete my test for me");
  assert.equal(result.triggers[0]?.category, "academic-integrity");
  assert.equal(result.mustStopAcademicFlow, false);
});

test("safety redacts common contact information", () => {
  const result = evaluateSafety("My email is learner@example.com and my phone is 555-123-4567");
  assert.match(result.redactedInput, /\[redacted-email\]/);
  assert.match(result.redactedInput, /\[redacted-phone\]/);
});

test("safety declines diagnosis requests", () => {
  const result = evaluateSafety("Do I have dyslexia?");
  assert.equal(result.mustEscalateToAdult, true);
  assert.equal(result.triggers[0]?.category, "medical-or-disability-diagnosis");
});

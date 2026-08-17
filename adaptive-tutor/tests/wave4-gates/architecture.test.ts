import assert from "node:assert/strict";
import test from "node:test";
import {
  WAVE4_EXECUTABLE_DETECTORS,
  normalizeDetectorOutput,
  validateDetectorCatalog,
  type DetectorExecutionResult,
} from "../../scripts/tutor-v4/executable-detectors.js";
import { WAVE4_HARD_GATE_FAMILIES } from "../../scripts/tutor-v4/evidence.js";
import { classifyMutation } from "../../scripts/tutor-v4/mutation-classification.js";
import { WAVE4_IMPLEMENTATION_MUTATIONS } from "../../scripts/tutor-v4/mutations/catalog.js";

test("all 13 Wave 4 families have one ordered executable non-compensable detector", () => {
  assert.doesNotThrow(validateDetectorCatalog);
  assert.deepEqual(
    WAVE4_EXECUTABLE_DETECTORS.map((detector) => detector.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(new Set(WAVE4_EXECUTABLE_DETECTORS.map(({ detectorId }) => detectorId)).size, 13);
  assert.equal(WAVE4_EXECUTABLE_DETECTORS.every(({ commands }) => commands.length > 0), true);
  assert.equal(WAVE4_EXECUTABLE_DETECTORS.every(({ commands }) =>
    commands.every(({ phase }) => phase === "SETUP" || phase === "SEMANTIC")
  ), true);
  assert.equal(WAVE4_EXECUTABLE_DETECTORS.every(({ minimumAssertionCount }) => minimumAssertionCount > 0), true);
});

test("all 13 negative controls rewrite implementation source without changing permanent detectors", () => {
  assert.equal(WAVE4_IMPLEMENTATION_MUTATIONS.length, 13);
  assert.deepEqual(
    WAVE4_IMPLEMENTATION_MUTATIONS.map((mutation) => mutation.family),
    WAVE4_HARD_GATE_FAMILIES,
  );
  assert.equal(new Set(WAVE4_IMPLEMENTATION_MUTATIONS.map(({ mutationId }) => mutationId)).size, 13);
  for (const mutation of WAVE4_IMPLEMENTATION_MUTATIONS) {
    assert.equal(mutation.rewrites.length > 0, true, mutation.mutationId);
    assert.ok(mutation.compile, mutation.mutationId);
    for (const rewrite of mutation.rewrites) {
      assert.match(rewrite.sourcePath, /^adaptive-tutor\//);
      assert.equal(rewrite.sourcePath.includes("test"), false, rewrite.sourcePath);
      assert.equal(rewrite.sourcePath.includes("tutor-v2-wave4-release"), false, rewrite.sourcePath);
    }
  }
});

test("M04 removes only cached reuse and retains compile-valid existing-value narrowing", () => {
  const mutation = WAVE4_IMPLEMENTATION_MUTATIONS.find(({ mutationId }) =>
    mutationId === "W4-M04-REDISPATCH-EXISTING-ATTEMPT"
  );
  assert.ok(mutation);
  assert.equal(mutation.compile.kind, "typescript-project");
  if (mutation.compile.kind !== "typescript-project") return;
  assert.equal(mutation.compile.projectPath, "adversarial/v4/replay-crash/tsconfig.json");
  assert.match(mutation.rewrites[0]?.before ?? "", /disposition: "reused"/);
  assert.match(mutation.rewrites[0]?.after ?? "", /#dispatches\.delete/);
  assert.doesNotMatch(mutation.rewrites[0]?.after ?? "", /existing && false/);
});

test("single-use-dispatch control targets executable ALREADY_CLAIMED enforcement", () => {
  const mutation = WAVE4_IMPLEMENTATION_MUTATIONS.find(({ mutationId }) =>
    mutationId === "W4-M06-ALLOW-ALREADY-CLAIMED-DISPATCH"
  );
  assert.ok(mutation);
  assert.equal(mutation.family, "RESOURCE_BOUNDS_AND_SINGLE_USE_DISPATCH");
  assert.match(mutation.rewrites[0]?.before ?? "", /dispatchClaim !== "CLAIMED"/);
  assert.match(mutation.rewrites[0]?.after ?? "", /dispatchClaim === "CONFLICT"/);
});

test("no catalog field can manually assert detector PASS", () => {
  for (const detector of WAVE4_EXECUTABLE_DETECTORS) {
    assert.equal(Object.hasOwn(detector, "status"), false);
    assert.equal(Object.hasOwn(detector, "pass"), false);
  }
  for (const mutation of WAVE4_IMPLEMENTATION_MUTATIONS) {
    assert.equal(Object.hasOwn(mutation, "expectedAggregate"), false);
  }
});

function detectorResult(
  overrides: Partial<DetectorExecutionResult> = {},
): DetectorExecutionResult {
  return {
    family: "REPLAY_CRASH_IDEMPOTENCY",
    detectorId: "W4-D04-REPLAY-CRASH-CURRENT",
    status: "PASS",
    exitCode: 0,
    assertionCount: 31,
    minimumAssertionCount: 13,
    sourceInvariant: "test invariant",
    evidenceRef: "test evidence",
    nonCompensable: true,
    invocation: ["test detector"],
    outputSha256: "0".repeat(64),
    missingPaths: [],
    detectorOutcome: "EXECUTED",
    invocationStatus: "EXECUTED",
    compileSetupStatus: "PASS",
    semanticExecutionReached: true,
    semanticResult: "PASS",
    output: "# tests 31",
    ...overrides,
  };
}

test("compiler failure cannot classify as a mutation kill", () => {
  assert.equal(classifyMutation({
    rewriteApplied: true,
    nonEmptySourceDiff: true,
    compileExitCode: 2,
    allMutatedSourcesCompiled: true,
    baselineDetectorOutcome: detectorResult(),
    detectorOutcome: detectorResult({
      status: "FAIL",
      exitCode: 1,
      semanticResult: "FAIL",
    }),
    externalBaseline: false,
  }), "INVALID_MUTANT");
});

test("detector setup failure with zero assertions cannot classify as a kill", () => {
  assert.equal(classifyMutation({
    rewriteApplied: true,
    nonEmptySourceDiff: true,
    compileExitCode: 0,
    allMutatedSourcesCompiled: true,
    baselineDetectorOutcome: detectorResult(),
    detectorOutcome: detectorResult({
      status: "VALIDATION_INCONCLUSIVE",
      exitCode: 2,
      assertionCount: 0,
      compileSetupStatus: "FAIL",
      semanticExecutionReached: false,
      semanticResult: "VALIDATION_INCONCLUSIVE",
      output: "TypeScript compilation failed",
    }),
    externalBaseline: false,
  }), "VALIDATION_INCONCLUSIVE");
});

test("adequate executed semantic assertion failure is a kill", () => {
  assert.equal(classifyMutation({
    rewriteApplied: true,
    nonEmptySourceDiff: true,
    compileExitCode: 0,
    allMutatedSourcesCompiled: true,
    baselineDetectorOutcome: detectorResult(),
    detectorOutcome: detectorResult({
      status: "FAIL",
      exitCode: 1,
      semanticResult: "FAIL",
    }),
    externalBaseline: false,
  }), "KILLED");
});

test("detector output normalization removes disposable answer-extraction paths", () => {
  const first = normalizeDetectorOutput(
    "file:///private/var/folders/aa/bb/T/w4-answer-extraction-59XZC4/baseline/test.js",
    "/repo/adaptive-tutor",
  );
  const second = normalizeDetectorOutput(
    "file:///private/var/folders/cc/dd/T/w4-answer-extraction-yU9r2x/baseline/test.js",
    "/repo/adaptive-tutor",
  );
  assert.equal(first, "file://$DETECTOR_TEMP/baseline/test.js");
  assert.equal(second, first);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUIRED_EVIDENCE_INPUT_PATHS,
  assertEvidenceOnlyDiff,
  isEvidenceOnlyPath,
} from "../../scripts/tutor-v4/evidence-subject-binding.js";

/**
 * The exact parent-to-HEAD diff of the R10 evidence commit (86f684da -> 74868c18).
 * `npm run tutor-v4:release-check` exited 1 on it because the allowlist named
 * only the w4-r9 repair directory while the release check demanded the w4-r10
 * CAMPAIGN-EVIDENCE.json. This list is the regression guard for that blocker.
 */
const EVIDENCE_ONLY_DIFF: readonly string[] = [
  "adaptive-tutor/tutor-v2-wave4-release/CHECKSUMS.json",
  "adaptive-tutor/tutor-v2-wave4-release/HARD-GATE-RESULT.json",
  "adaptive-tutor/tutor-v2-wave4-release/NEGATIVE-CONTROL-EVIDENCE.json",
  "adaptive-tutor/tutor-v2-wave4-release/SOURCE-PROVENANCE.json",
  "adaptive-tutor/tutor-v2-wave4-release/TEST-EVIDENCE.json",
  "docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/CAMPAIGN-EVIDENCE.json",
];

test("T1: an evidence commit carrying the current repair directory is accepted", () => {
  assert.doesNotThrow(() => assertEvidenceOnlyDiff(EVIDENCE_ONLY_DIFF));
  assert.equal(
    isEvidenceOnlyPath(
      "docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/CAMPAIGN-EVIDENCE.json",
    ),
    true,
  );
});

test("T1: every evidence input the release check demands is admissible", () => {
  assert.ok(REQUIRED_EVIDENCE_INPUT_PATHS.length > 0);
  for (const path of REQUIRED_EVIDENCE_INPUT_PATHS) {
    assert.equal(isEvidenceOnlyPath(path), true, `release check demands a rejected path: ${path}`);
  }
});

test("T1: campaign evidence from any repair round is admissible", () => {
  for (const round of [
    "w4-r6-gate-integrity",
    "w4-r9-mutation-evidence-binding",
    "w4-r10-compiler-evidence-determinism",
    "w4-r11-evidence-allowlist-repair",
  ]) {
    assert.equal(
      isEvidenceOnlyPath(`docs/study-tutor-v2/wave4/repairs/${round}/CAMPAIGN-EVIDENCE.json`),
      true,
      round,
    );
  }
});

test("T2: a source path in an otherwise evidence-only diff is rejected", () => {
  for (const intruder of [
    "adaptive-tutor/scripts/tutor-v4/generate-release.ts",
    "adaptive-tutor/core/v3/index.ts",
    "src/App.tsx",
    "netlify/functions/tutor.ts",
    "supabase/migrations/0001.sql",
    "adaptive-tutor/package.json",
    "adaptive-tutor/package-lock.json",
  ]) {
    assert.equal(isEvidenceOnlyPath(intruder), false, intruder);
    assert.throws(
      () => assertEvidenceOnlyDiff([...EVIDENCE_ONLY_DIFF, intruder]),
      /Parent-to-HEAD diff is not evidence-only/u,
      intruder,
    );
  }
});

test("T2: prose beside campaign evidence is not evidence", () => {
  for (const prose of [
    "docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/README.md",
    "docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/VALIDATION.md",
    "docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/AUDIT.md",
    "docs/study-tutor-v2/wave4/repairs/w4-r10-compiler-evidence-determinism/DESIGN.md",
    "docs/study-tutor-v2/wave4/lanes/w4-01-prompt-injection/CAMPAIGN-EVIDENCE.json",
    "docs/CAMPAIGN-EVIDENCE.json",
  ]) {
    assert.equal(isEvidenceOnlyPath(prose), false, prose);
  }
});

test("T2: an empty parent-to-HEAD diff is rejected", () => {
  assert.throws(() => assertEvidenceOnlyDiff([]), /Parent-to-HEAD diff is not evidence-only/u);
});

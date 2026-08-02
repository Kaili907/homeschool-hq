import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(testDir, "..", "..", "..", "..");
const reconciliationRoot = path.resolve(testDir, "..", "..", "reconciliation");

test("all four Wave 1 artifacts still match their required SHA-256", async () => {
  const report = JSON.parse(
    await readFile(
      path.join(reconciliationRoot, "artifact-verification.v1.json"),
      "utf8"
    )
  );
  assert.equal(report.wave1Artifacts.length, 4);
  for (const artifact of report.wave1Artifacts) {
    const bytes = await readFile(path.join(workspaceRoot, artifact.path));
    const actual = createHash("sha256").update(bytes).digest("hex").toUpperCase();
    assert.equal(actual, artifact.expectedSha256, artifact.displayName);
    assert.equal(artifact.actualSha256, actual, artifact.displayName);
    assert.equal(artifact.result, "PASS", artifact.displayName);
    assert.equal(artifact.archiveSafety.streamReadable, true, artifact.displayName);
    for (const hazard of [
      "absolutePaths",
      "traversalPaths",
      "duplicatePaths",
      "caseInsensitiveDuplicatePaths",
      "normalizedDuplicatePaths",
      "symlinks",
      "reservedNameHazards"
    ]) {
      assert.equal(artifact.archiveSafety[hazard], 0, `${artifact.displayName}: ${hazard}`);
    }
  }
});

test("actual Tutor Core v0.2 remains an explicit unavailable blocker", async () => {
  const report = JSON.parse(
    await readFile(
      path.join(reconciliationRoot, "artifact-verification.v1.json"),
      "utf8"
    )
  );
  assert.equal(report.tutorCore.requiredVersion, "0.2");
  assert.equal(report.tutorCore.status, "NOT_ACCESSIBLE");
  assert.equal(report.tutorCore.classification, "BLOCKER");
});

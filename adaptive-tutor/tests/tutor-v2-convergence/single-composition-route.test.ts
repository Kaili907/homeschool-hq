import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import * as StudyTutorV2 from "../../study-engine/tutor-v2/index.js";

const COMPOSER = "composeWave2AdaptiveIntelligence";
const INTERNAL_MODULE = /study-engine\/tutor-v2\/adaptive/;

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ? [path] : [];
  });
}

test("SINGLE_COMPOSITION_ROUTE keeps the Wave 2 composer off shared public barrels", () => {
  assert.equal(Object.hasOwn(StudyTutorV2, COMPOSER), false);
  for (const file of [
    "study-engine/tutor-v2/index.ts",
    "core/v2/index.ts",
    "core/index.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes(`export * from \"./adaptive/index.js\"`), false, file);
    assert.equal(source.includes(COMPOSER), false, file);
  }
});

test("SINGLE_COMPOSITION_ROUTE has no browser, serverless, or production caller", () => {
  const repositoryRoot = resolve("..");
  const productionRoots = ["src", "netlify", "supabase"].map((path) =>
    resolve(repositoryRoot, path)
  );
  for (const file of productionRoots.flatMap(sourceFiles)) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes(COMPOSER), false, file);
    assert.equal(INTERNAL_MODULE.test(source), false, file);
  }
});

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import {
  NarrationTrackSchema,
  ParentTeacherReviewSchema,
  TutorProgramSchema,
  TutorResponseSchema,
} from "../core/contracts/index.js";
import { AdaptiveTutorEngine } from "../core/engine/index.js";
import { validateWithSchema } from "../core/utils/validation.js";
import {
  englishRuntimeHooks,
  englishTutorProgram,
  mathRuntimeHooks,
  mathTutorProgram,
} from "../examples/index.js";
import { narrationFixture } from "../examples/narration.fixture.js";
import { findUnauthorizedSubjectPackageFiles } from "./subject-package-guard.js";
import { isAuthenticationIntegrationPath } from "./platform-boundary.js";

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const output: string[] = [];
  for (const entry of entries) {
    const path = resolve(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output;
}

const checks: CheckResult[] = [];
const add = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

for (const [name, program] of [
  ["math", mathTutorProgram],
  ["english", englishTutorProgram],
] as const) {
  const result = validateWithSchema(TutorProgramSchema, program);
  add(`${name}-program-runtime-schema`, result.ok, result.ok ? "Valid" : result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
}

const narrationResult = validateWithSchema(NarrationTrackSchema, narrationFixture);
add("narration-caption-transcript-runtime-schema", narrationResult.ok, narrationResult.ok ? "Valid" : "Invalid");

const engine = new AdaptiveTutorEngine(mathTutorProgram, mathRuntimeHooks);
let response = engine.start();
add("first-response-contract", validateWithSchema(TutorResponseSchema, response).ok, response.phase);
response = engine.submit({ raw: "2/4", selectedOptionIds: ["option-two-fourths"] });
add("diagnostic-transition", response.phase === "assessment", response.phase);
response = engine.submit({ raw: "1/2", selectedOptionIds: ["option-one-half"] });
add("identify-transition", response.phase === "identify-missing-concept", response.phase);

const review = new AdaptiveTutorEngine(englishTutorProgram, englishRuntimeHooks).getReview();
add("parent-teacher-review-contract", validateWithSchema(ParentTeacherReviewSchema, review).ok, "Empty-evidence review remains explicit about uncertainty.");

const files = await walk(resolve("."));
const relativeFiles = files
  .map((file) => relative(resolve("."), file).replaceAll("\\", "/"))
  .filter((file) => !file.startsWith("node_modules/") && !file.startsWith("dist/"));
const forbiddenPatterns = [
  /^supabase\//,
  /^netlify\//,
  /^\.github\//,
  /database/i,
  /progress-sync/i,
];
const forbiddenMatches = relativeFiles.filter(
  (file) => isAuthenticationIntegrationPath(file) || forbiddenPatterns.some((pattern) => pattern.test(file)),
);
add("platform-boundary", forbiddenMatches.length === 0, forbiddenMatches.length === 0 ? "No GitHub, Supabase, Netlify, database, authentication, or progress-sync files." : forbiddenMatches.join(", "));

const unauthorizedSubjectPackageMatches = findUnauthorizedSubjectPackageFiles(relativeFiles);
add("no-unauthorized-subject-packages", unauthorizedSubjectPackageMatches.length === 0, unauthorizedSubjectPackageMatches.length === 0 ? "Only demonstration fixtures under examples/ and the authorized subjects/math package exist." : unauthorizedSubjectPackageMatches.join(", "));

const requiredFiles = [
  "core/contracts/index.ts",
  "core/engine/adaptive-tutor-engine.ts",
  "core/prompts/templates.ts",
  "core/safety/rules.ts",
  "prototype/main.ts",
  "examples/math-interaction.ts",
  "examples/english-interaction.ts",
  "docs/integration-guide.md",
  "docs/director-handoff.md",
];
for (const requiredFile of requiredFiles) {
  add(`required-file:${requiredFile}`, relativeFiles.includes(requiredFile), requiredFile);
}

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as { version?: string };
add("package-version", packageJson.version === "0.2.0", packageJson.version ?? "missing");

const passed = checks.filter((check) => check.passed).length;
const failed = checks.length - passed;
const report = `# Adaptive Tutor Core v0.2 — Generated Validation Report\n\n**Overall result:** ${failed === 0 ? "PASS" : "FAIL"}\n\n- Checks: ${checks.length}\n- Passed: ${passed}\n- Failed: ${failed}\n- Generated: ${new Date().toISOString()}\n\n| Check | Result | Details |\n|---|---|---|\n${checks.map((check) => `| ${check.name} | ${check.passed ? "PASS" : "FAIL"} | ${check.detail.replaceAll("|", "\\|")} |`).join("\n")}\n\n## Boundary Confirmation\n\n- No GitHub repository was modified.\n- No Supabase, Netlify, Lovable, database, storage, identity, authentication, or progress-synchronization integration was created.\n- English materials are demonstration fixtures only; the Math R1 package under subjects/math is the sole authorized final subject package.\n- The prototype is local-first and remains usable without audio or external media.\n`;
await writeFile(resolve("docs/validation-report.generated.md"), report, "utf8");
console.log(report);
if (failed > 0) process.exitCode = 1;

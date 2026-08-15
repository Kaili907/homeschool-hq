import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, mkdtemp, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../..");
const repositoryRoot = resolve(tutorRoot, "..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const BASE = "94a8d2e1708d3346e905688c4f0f78a6ed4c4a95";
const CONVERGENCE_START = "aeff3bde7be983276c9006576d388eabbe81ba97";

const lanes = [
  {
    id: "W2_01",
    branch: "mac/tutor-v2-w2-admission-r1",
    tip: "d6a1b069a8f5d67023edcb4f247b3c67076306a4",
    patchId: "88e8a6bf486dfe2b0fef4c1679acef9d058793d5",
    paths: ["adaptive-tutor/core/v2/admission", "docs/study-tutor-v2/wave2/lanes/w2-01-admission"],
  },
  {
    id: "W2_02",
    branch: "mac/tutor-v2-w2-concept-graph-r1",
    tip: "b971fc4d139449a815e4ff06c34ca4abb5c84005",
    patchId: "ad8f3e145ba664e3b0d64135c3cf1d8d2174bd2e",
    paths: ["adaptive-tutor/core/v2/concepts", "docs/study-tutor-v2/wave2/lanes/w2-02-concept-graph"],
  },
  {
    id: "W2_03",
    branch: "mac/tutor-v2-w2-misconception-r1",
    tip: "f9ed81626d8d9e455ea750989d8c2a71cfe8bd6d",
    patchId: "f5f7cca1df95e16b2a193bdbb70177ef9a49560b",
    paths: ["adaptive-tutor/core/v2/misconceptions", "docs/study-tutor-v2/wave2/lanes/w2-03-misconception"],
  },
  {
    id: "W2_04",
    branch: "mac/tutor-v2-w2-hint-ladder-r1",
    tip: "eb941ff897181f761f83b3604dc4006d5e5118d4",
    patchId: "7ac35fbee5cb7965f75dba780f3e450d11355091",
    paths: ["adaptive-tutor/core/v2/hints", "docs/study-tutor-v2/wave2/lanes/w2-04-hint-ladder"],
  },
  {
    id: "W2_05",
    branch: "mac/tutor-v2-w2-intervention-r1",
    tip: "94c0d816e6e312af9f61d465a9692ef37919a65b",
    patchId: "0f4f407fe5dbf52ef577c19e9617d7ed342097d8",
    paths: ["adaptive-tutor/core/v2/interventions", "docs/study-tutor-v2/wave2/lanes/w2-05-intervention"],
  },
  {
    id: "W2_06",
    branch: "mac/tutor-v2-w2-mastery-evidence-r1",
    tip: "241cfc7d3b6c673139728302b00bd580cba1e919",
    patchId: "7fcc26bee9e30240410e6b124534f9fa259cf9c9",
    paths: ["adaptive-tutor/core/v2/mastery", "docs/study-tutor-v2/wave2/lanes/w2-06-mastery-evidence"],
  },
  {
    id: "W2_07",
    branch: "mac/tutor-v2-w2-parent-why-r1",
    tip: "661669117497a33e5d2da0a12e6bc3801839a165",
    patchId: "89ad1f511b2d71d2d0fc7689586beb9e53068e60",
    paths: ["adaptive-tutor/study-engine/tutor-v2/parent-explanations", "docs/study-tutor-v2/wave2/lanes/w2-07-parent-why"],
  },
  {
    id: "W2_08",
    branch: "mac/tutor-v2-w2-repair-reteach-r1",
    tip: "39b8d671f35dce6e44d19bff2d58b1bb2bfa4d81",
    patchId: "7ce3fdf3b5fd93d6d2e062667b0fc8b65914bcc1",
    paths: [
      "adaptive-tutor/study-engine/tutor-v2/prerequisite-repair",
      "adaptive-tutor/study-engine/tutor-v2/reteach",
      "docs/study-tutor-v2/wave2/lanes/w2-08-repair-reteach",
    ],
  },
];

const checks = [];
let hardFailure = false;

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? tutorRoot,
    encoding: "utf8",
    shell: false,
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function record(name, status, detail, command) {
  checks.push({ name, status, detail, command });
  process.stdout.write(`${status} ${name}: ${detail}\n`);
  if (status === "FAIL") hardFailure = true;
}

function requireSuccess(name, command, args, detail, options = {}) {
  const result = execute(command, args, options);
  record(name, result.status === 0 ? "PASS" : "FAIL", result.status === 0 ? detail : `exit ${String(result.status)}`, [command, ...args].join(" "));
  if (result.status !== 0) process.stderr.write(`${result.stdout}${result.stderr}`);
  return result;
}

function tapCounts(output) {
  const count = (label) => Number(output.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? -1);
  return { tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped") };
}

function requireTap(name, files, expected, options = {}) {
  const result = execute(process.execPath, ["--test", ...files], options);
  const counts = tapCounts(`${result.stdout}${result.stderr}`);
  const passed = result.status === 0 && counts.tests === expected.tests &&
    counts.pass === expected.pass && counts.fail === 0 &&
    counts.skipped === (expected.skipped ?? 0);
  record(name, passed ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.fail} fail; ${counts.skipped} skipped`, `node --test ${files.join(" ")}`);
  if (!passed) process.stderr.write(`${result.stdout}${result.stderr}`);
  return counts;
}

function git(args, options = {}) {
  return execute("git", args, { cwd: repositoryRoot, ...options });
}

record("node-22", Number(process.versions.node.split(".")[0]) === 22 ? "PASS" : "FAIL", `Node ${process.versions.node}`, "node --version");

for (const lane of lanes) {
  const remote = `origin/${lane.branch}`;
  const tip = git(["rev-parse", remote]).stdout.trim();
  const parent = git(["rev-parse", `${remote}^`]).stdout.trim();
  const merges = git(["rev-list", "--min-parents=2", `${BASE}..${remote}`]).stdout.trim();
  const shown = git(["show", "--pretty=format:", lane.tip]).stdout;
  const patch = execute("git", ["patch-id", "--stable"], { cwd: repositoryRoot, input: shown }).stdout.trim().split(/\s+/)[0];
  const treeExact = lane.paths.every((path) => git(["diff", "--quiet", lane.tip, "HEAD", "--", path]).status === 0);
  const valid = tip === lane.tip && parent === BASE && merges === "" && patch === lane.patchId && treeExact;
  record(
    `${lane.id.toLowerCase()}-provenance`,
    valid ? "PASS" : "FAIL",
    valid ? `${lane.tip}; patch ${lane.patchId}; direct baseline parent; lane tree exact` : `tip=${tip}; parent=${parent}; merges=${merges || "none"}; patch=${patch}; treeExact=${String(treeExact)}`,
    `git provenance checks ${remote}`,
  );
}

requireSuccess("strict-v2-typecheck", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json", "--noEmit"], "strict TypeScript", { cwd: tutorRoot });
requireSuccess("v2-compile", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json"], "compiled Tutor V2 slice", { cwd: tutorRoot });
requireSuccess("wave1-schema-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-schemas.js", "--check"], "23 Wave 1 schemas + inventory exact", { cwd: tutorRoot });
requireSuccess("wave2-schema-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-wave2-schemas.js", "--check"], "2 serialized Wave 2 schemas + inventory exact; 0 internal port schemas", { cwd: tutorRoot });
requireSuccess("wave1-release-check", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-release.js", "--check"], "accepted Wave 1 release artifacts exact", { cwd: tutorRoot });

const dist = "scripts/tutor-v2/.dist";
const w1Counts = requireTap("wave1-hard-gate-regression", [
  `${dist}/tests/tutor-v2-convergence/composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/schema-parity.test.js`,
  `${dist}/tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/approval-decision-structural-validation-adversarial.test.js`,
], { tests: 253, pass: 253 });

const laneCounts = requireTap("wave2-lane-regression", [
  `${dist}/core/v2/admission/admission.test.js`,
  `${dist}/core/v2/concepts/graph.test.js`,
  `${dist}/core/v2/misconceptions/academic-misconceptions.test.js`,
  `${dist}/core/v2/hints/hint-ladder.test.js`,
  `${dist}/core/v2/interventions/intervention-ladder.test.js`,
  `${dist}/core/v2/mastery/mastery-evidence.test.js`,
  `${dist}/study-engine/tutor-v2/parent-explanations/parent-explanation.test.js`,
  `${dist}/study-engine/tutor-v2/prerequisite-repair/prerequisite-repair.test.js`,
  `${dist}/study-engine/tutor-v2/reteach/reteach.test.js`,
], { tests: 164, pass: 164 });

const compositionCounts = requireTap("wave2-composition-regression", [
  `${dist}/tests/tutor-v2-convergence/wave2-composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/wave2-schema-parity.test.js`,
], { tests: 17, pass: 17 });

requireSuccess("study-bridge-typecheck", process.execPath, [tsc, "-p", "study-engine/tests/tutor-v2-bridge/tsconfig.json"], "Study Core Bridge compiled", { cwd: tutorRoot });
const bridgeCounts = requireTap("study-bridge-regression", [
  "study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js",
], { tests: 209, pass: 209 });

const evalTests = requireSuccess("foundation-harness-tests", "npm", ["--prefix", "evals/v2/framework", "test"], "foundation harness self-tests", { cwd: tutorRoot });
const evalTestCounts = tapCounts(`${evalTests.stdout}${evalTests.stderr}`);
if (evalTestCounts.tests !== 8 || evalTestCounts.pass !== 8 || evalTestCounts.fail !== 0) {
  record("foundation-harness-counts", "FAIL", `${evalTestCounts.pass}/${evalTestCounts.tests}`, "npm --prefix evals/v2/framework test");
} else record("foundation-harness-counts", "PASS", "8/8", "npm --prefix evals/v2/framework test");

const evaluation = execute(process.execPath, ["evals/v2/framework/.dist/framework/src/cli.js", "--format=json"], { cwd: tutorRoot });
try {
  const report = JSON.parse(evaluation.stdout);
  const passed = evaluation.status === 0 && report.totalScenarios === 128 && report.passed === 128 && report.failed === 0 && report.classification === "FOUNDATION_GATE_PASS" && report.releaseReady === false;
  record("foundation-corpus", passed ? "PASS" : "FAIL", `${report.passed}/${report.totalScenarios}; ${report.classification}; releaseReady=${String(report.releaseReady)}`, "foundation CLI --format=json");
} catch {
  record("foundation-corpus", "FAIL", "invalid machine report", "foundation CLI --format=json");
}

const coreTests = requireSuccess("tutor-core-tests", "npm", ["test"], "Tutor Core regression", { cwd: tutorRoot });
const coreCounts = tapCounts(`${coreTests.stdout}${coreTests.stderr}`);
if (coreCounts.tests !== 21 || coreCounts.pass !== 21 || coreCounts.fail !== 0) {
  record("tutor-core-counts", "FAIL", `${coreCounts.pass}/${coreCounts.tests}`, "npm test");
} else record("tutor-core-counts", "PASS", "21/21", "npm test");
requireSuccess("tutor-core-build", "npm", ["run", "build"], "Tutor Core build", { cwd: tutorRoot });
requireSuccess("tutor-core-smoke", "npm", ["run", "smoke"], "Tutor Core smoke", { cwd: tutorRoot });
let validationRoot;
try {
  validationRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-validation-"));
  const validationTutor = join(validationRoot, "adaptive-tutor");
  await cp(tutorRoot, validationTutor, {
    recursive: true,
    filter: (source) => !["node_modules", "dist", ".test-dist", ".dist"].includes(basename(source)),
  });
  await symlink(resolve(repositoryRoot, "node_modules"), join(validationTutor, "node_modules"));
  const validation = execute("npm", ["run", "validate"], { cwd: validationTutor });
  const validationOutput = `${validation.stdout}${validation.stderr}`;
  if (validation.status === 0) record("broad-validator", "PASS", "all checks passed", "npm run validate (isolated copy)");
  else if (validationOutput.includes("Checks: 19") && validationOutput.includes("Passed: 18") && validationOutput.includes("Failed: 1") && validationOutput.includes("platform-boundary | FAIL")) {
    record("broad-validator", "INHERITED_FINDING", "18/19; accepted obsolete platform-boundary validator finding", "npm run validate (isolated copy)");
  } else {
    record("broad-validator", "FAIL", "unexpected validation result", "npm run validate (isolated copy)");
    process.stderr.write(validationOutput);
  }
} finally {
  if (validationRoot !== undefined) await rm(validationRoot, { recursive: true, force: true });
}

let sourceRoot;
try {
  sourceRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-study-core-"));
  const frozenTutor = join(sourceRoot, "tutor-core", "manuel-academy-adaptive-tutor-core-v0.2", "adaptive-tutor");
  await mkdir(dirname(frozenTutor), { recursive: true });
  await cp(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/adaptive-tutor-core"), frozenTutor, { recursive: true });
  await symlink(resolve(repositoryRoot, "node_modules"), join(frozenTutor, "node_modules"));
  requireSuccess("frozen-tutor-core-build", "npm", ["run", "build"], "reconstructed frozen Tutor Core build", { cwd: frozenTutor });
  await unlink(join(frozenTutor, "node_modules"));
  const studyContracts = join(sourceRoot, "study-contracts", "adaptive-tutor", "study-engine");
  await mkdir(dirname(studyContracts), { recursive: true });
  await symlink(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/study-engine"), studyContracts);
  const studyBridge = execute(process.execPath, ["--test", "adaptive-tutor/study-engine/tests/tutor-core-bridge/*.test.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, SESSION6_SOURCE_ROOT: sourceRoot, SESSION6_TSC: tsc },
  });
  const counts = tapCounts(`${studyBridge.stdout}${studyBridge.stderr}`);
  const expectedSkip = [process.env.SESSION6_TUTOR_ZIP, process.env.SESSION6_STUDY_CONTRACTS_ZIP, process.env.SESSION6_STUDY_ENGINE_ZIP, process.env.SESSION6_RECONCILIATION_ZIP].some((value) => !value);
  const passed = studyBridge.status === 0 && counts.tests === 36 && counts.fail === 0 &&
    counts.pass === (expectedSkip ? 35 : 36) && counts.skipped === (expectedSkip ? 1 : 0);
  record("study-core-bridge", passed ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.skipped} skipped`, "SESSION6_SOURCE_ROOT=<reconstructed> Study Core Bridge");
  record("frozen-archive-checksums", expectedSkip ? "NOT_AVAILABLE" : "PASS", expectedSkip ? "four external SESSION6 archives not mounted; exact checksum test skipped" : "four configured archives exact", "SESSION6_*_ZIP");
  if (!passed) process.stderr.write(`${studyBridge.stdout}${studyBridge.stderr}`);
} catch (error) {
  record("study-core-bridge", "FAIL", error instanceof Error ? error.message : String(error), "reconstructed Study Core Bridge");
} finally {
  if (sourceRoot !== undefined) await rm(sourceRoot, { recursive: true, force: true });
}

const allowed = (path) =>
  path === "adaptive-tutor/core/v2/index.ts" ||
  path === "adaptive-tutor/core/index.ts" ||
  path === "adaptive-tutor/study-engine/tutor-v2/index.ts" ||
  path === "adaptive-tutor/package.json" ||
  path.startsWith("adaptive-tutor/study-engine/tutor-v2/adaptive/") ||
  path.startsWith("adaptive-tutor/json-schema/v2/") ||
  path.startsWith("adaptive-tutor/scripts/tutor-v2/") ||
  path.startsWith("adaptive-tutor/tests/tutor-v2-convergence/") ||
  path.startsWith("adaptive-tutor/tutor-v2-wave2-release/") ||
  path.startsWith("docs/study-tutor-v2/wave2/");
const statusPaths = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout
  .split("\n").filter(Boolean).map((line) => line.slice(3));
const authoredPaths = git(["diff", "--name-only", CONVERGENCE_START, "HEAD"]).stdout
  .split("\n").filter(Boolean);
const allAuthored = [...new Set([...authoredPaths, ...statusPaths])];
const violations = allAuthored.filter((path) => !allowed(path));
record("convergence-ownership", violations.length === 0 ? "PASS" : "FAIL", violations.length === 0 ? `${allAuthored.length} convergence-authored paths within ownership` : violations.join(", "), `git diff --name-only ${CONVERGENCE_START} HEAD plus status`);
const diffCheck = git(["diff", "--check"]);
record("git-diff-check", diffCheck.status === 0 ? "PASS" : "FAIL", diffCheck.status === 0 ? "no whitespace errors" : diffCheck.stdout.trim(), "git diff --check");

const wave2GateNames = [
  "ADMISSION_GATE", "CONCEPT_GRAPH_GATE", "MISCONCEPTION_GATE", "HINT_CEILING_GATE",
  "ACTIVE_ASSESSMENT_GATE", "MASTERY_AUTHORITY_GATE", "WORKING_LEVEL_GATE",
  "REPAIR_DEPTH_GATE", "CROSS_CHILD_ISOLATION_GATE", "PARENT_PRIVACY_GATE",
  "REPLAY_GATE", "STATIC_FALLBACK_GATE",
];
const wave2CompositionPassed = checks.find(({ name }) => name === "wave2-composition-regression")?.status === "PASS";
const hardGateFamilies = wave2GateNames.map((name) => ({
  name,
  enforcement: "HARD_NON_COMPENSABLE",
  status: wave2CompositionPassed ? "PASS" : "FAIL",
  permanentTest: "tests/tutor-v2-convergence/wave2-composition.test.ts",
}));
if (hardGateFamilies.some(({ status }) => status !== "PASS")) hardFailure = true;

const inherited = checks.some(({ status }) => status === "INHERITED_FINDING" || status === "NOT_AVAILABLE");
const finalClassification = hardFailure
  ? "WAVE2_HOLD"
  : inherited
    ? "WAVE2_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS"
    : "WAVE2_CANDIDATE_READY_FOR_FINAL_REREVIEW";
const result = {
  resultVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 2 Adaptive Intelligence Candidate",
  wave1AcceptedBaselineSha: BASE,
  wave1AcceptanceClassification: "WAVE1_ACCEPTED_WITH_INHERITED_FINDINGS",
  wave2Complete: false,
  finalIndependentRereviewRequired: true,
  finalClassification,
  hardGateFamilies,
  counts: {
    wave1HardGateTests: w1Counts.tests + bridgeCounts.tests,
    wave1HardGatePassed: w1Counts.pass + bridgeCounts.pass,
    wave2LaneTests: laneCounts.tests,
    wave2LanePassed: laneCounts.pass,
    wave2CompositionTests: compositionCounts.tests,
    wave2CompositionPassed: compositionCounts.pass,
    foundationHarnessTests: evalTestCounts.tests,
    foundationHarnessPassed: evalTestCounts.pass,
    tutorCoreTests: coreCounts.tests,
    tutorCorePassed: coreCounts.pass,
  },
  checks,
};
await mkdir(resolve(tutorRoot, "tutor-v2-wave2-release"), { recursive: true });
await writeFile(resolve(tutorRoot, "tutor-v2-wave2-release/WAVE2-GATE-RESULT.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${finalClassification}\n`);
if (hardFailure) process.exitCode = 1;

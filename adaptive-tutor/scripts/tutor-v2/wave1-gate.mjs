import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../..");
const repositoryRoot = resolve(tutorRoot, "..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const W1_08_SHA = "31d5609527f75a11d9d3017ce0f07b3ec1c99b88";
const REPAIR_SHA = "d7aa9720b8096205acc0b63d21a895d8fc16de6f";

const checks = [];
let hardFailure = false;

function record(name, status, detail, command) {
  checks.push({ name, status, detail, command });
  process.stdout.write(`${status} ${name}: ${detail}\n`);
  if (status === "FAIL") hardFailure = true;
}

function execute(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? tutorRoot,
    encoding: "utf8",
    shell: false,
    env: options.env ?? process.env,
    maxBuffer: 32 * 1024 * 1024,
  });
}

function requireSuccess(name, command, args, detail, options = {}) {
  const result = execute(command, args, options);
  if (result.status === 0) record(name, "PASS", detail, [command, ...args].join(" "));
  else {
    record(name, "FAIL", `exit ${String(result.status)}`, [command, ...args].join(" "));
    process.stderr.write(`${result.stdout}${result.stderr}`);
  }
  return result;
}

function tapCounts(output) {
  const count = (label) => Number(output.match(new RegExp(`# ${label} (\\d+)`))?.[1] ?? -1);
  return { tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped") };
}

function requireTap(name, files, expected) {
  const result = execute(process.execPath, ["--test", ...files]);
  const counts = tapCounts(`${result.stdout}${result.stderr}`);
  const matches = result.status === 0 && counts.tests === expected.tests && counts.pass === expected.pass && counts.fail === 0 && counts.skipped === (expected.skipped ?? 0);
  record(name, matches ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.fail} fail; ${counts.skipped} skipped`, `node --test ${files.join(" ")}`);
  if (!matches) process.stderr.write(`${result.stdout}${result.stderr}`);
}

function requireSelectedTap(name, files, pattern, expected) {
  const result = execute(process.execPath, ["--test", `--test-name-pattern=${pattern}`, ...files]);
  const counts = tapCounts(`${result.stdout}${result.stderr}`);
  const matches = result.status === 0
    && counts.tests === expected.selected
    && counts.pass === expected.selected
    && counts.fail === 0
    && counts.skipped === 0;
  record(
    name,
    matches ? "PASS" : "FAIL",
    `${counts.pass}/${expected.selected} selected pass; ${counts.fail} fail`,
    `node --test --test-name-pattern=${pattern} ${files.join(" ")}`,
  );
  if (!matches) process.stderr.write(`${result.stdout}${result.stderr}`);
}

function git(args) {
  return execute("git", args, { cwd: repositoryRoot });
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
record("node-22", nodeMajor === 22 ? "PASS" : "FAIL", `Node ${process.versions.node}`, "node --version");

const refs = {
  "origin/mac/tutor-v2-w1-architecture-r1": "9e30d59f64184e89db493a004e738e859b06a686",
  "origin/mac/tutor-v2-w1-contracts-r1": "660de6a445ca66b8de5136a6ee388804346dce4b",
  "origin/mac/tutor-v2-w1-ownership-adjudication-r1": "f79271ac2cc57e9128ee61774a4f082c35c6fa77",
  "origin/mac/tutor-v2-w1-provider-port-r1": "ee6cc83fdaa43fe733d05abefdaedffe3d0febf9",
  "origin/mac/tutor-v2-w1-authority-policy-r1": "befb91bb2321aec0449d2d8e613619a592feb76c",
  "origin/mac/tutor-v2-w1-age-memory-r1": "4a8bded7bc0caf5ff647dae814e011d20c8ae5bf",
  "origin/mac/tutor-v2-w1-evidence-privacy-r1": "b93765552d60a88ac7691ca7840dfc2ae3a23e77",
  "origin/mac/tutor-v2-w1-eval-harness-r1": "9b959ab7e8176ebccb4fd3ca7b54bf5584602b35",
  "origin/mac/tutor-v2-w1-study-bridge-r1": W1_08_SHA,
  "origin/mac/tutor-v2-w1-provider-boundary-repair-r1": REPAIR_SHA,
};
const remoteMismatches = Object.entries(refs).filter(([ref, expected]) => git(["rev-parse", ref]).stdout.trim() !== expected);
record("canonical-provenance", remoteMismatches.length === 0 ? "PASS" : "FAIL", remoteMismatches.length === 0 ? "10/10 pinned remote tips exact, including repair" : `${remoteMismatches.length} remote mismatches`, "git rev-parse origin/mac/tutor-v2-w1-*");

const repairParent = git(["rev-parse", `${REPAIR_SHA}^`]).stdout.trim();
record("repair-direct-parent", repairParent === "16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d" ? "PASS" : "FAIL", repairParent, `git rev-parse ${REPAIR_SHA}^`);

const laneTrees = [
  ["befb91bb2321aec0449d2d8e613619a592feb76c", ["adaptive-tutor/core/v2/policy/authority", "adaptive-tutor/core/v2/policy/grounding", "adaptive-tutor/core/v2/policy/anti-answer", "adaptive-tutor/core/v2/policy/refusal"]],
  ["4a8bded7bc0caf5ff647dae814e011d20c8ae5bf", ["adaptive-tutor/core/v2/policy/age", "adaptive-tutor/core/v2/memory"]],
  ["b93765552d60a88ac7691ca7840dfc2ae3a23e77", ["adaptive-tutor/study-engine/tutor-v2/evidence", "adaptive-tutor/study-engine/tutor-v2/privacy"]],
  ["9b959ab7e8176ebccb4fd3ca7b54bf5584602b35", ["adaptive-tutor/evals/v2/framework", "adaptive-tutor/evals/v2/corpus/foundation"]],
];
const treeFailures = laneTrees.filter(([sha, paths]) => git(["diff", "--quiet", sha, "HEAD", "--", ...paths]).status !== 0);
record("accepted-lane-tree-equivalence", treeFailures.length === 0 ? "PASS" : "FAIL", treeFailures.length === 0 ? "unrepaired W1-04 through W1-07 trees exact" : `${treeFailures.length} lane tree mismatches`, "git diff --quiet <accepted-sha> HEAD -- <lane-paths>");

const repairPaths = [
  "adaptive-tutor/core/v2/providers",
  "adaptive-tutor/study-engine/bridges/tutor-v2",
  "adaptive-tutor/study-engine/tests/tutor-v2-bridge",
];
const repairTreeExact = git(["diff", "--quiet", REPAIR_SHA, "HEAD", "--", ...repairPaths]).status === 0;
record("accepted-repair-tree-equivalence", repairTreeExact ? "PASS" : "FAIL", repairTreeExact ? "repair-owned source and tests exact" : "repair-owned tree drifted", `git diff --quiet ${REPAIR_SHA} HEAD -- <repair-paths>`);

const providerContractsSource = await readFile(resolve(tutorRoot, "core/v2/providers/ports/contracts.ts"), "utf8");
const sharedV2Source = await readFile(resolve(tutorRoot, "core/v2/index.ts"), "utf8");
const narrowProviderPort = /execute\(request: ProviderExecutionRequest\): Promise<ProviderExecutionResult>/.test(providerContractsSource)
  && !/execute\(request: (?:TutorRequest|StudyAuthorityContext)/.test(providerContractsSource)
  && /ProviderExecutionRequest/.test(sharedV2Source);
record("provider-port-structural-boundary", narrowProviderPort ? "PASS" : "FAIL", narrowProviderPort ? "provider-safe request exported; TutorRequest/StudyAuthorityContext excluded" : "provider port widening detected", "source structural assertion");

requireSuccess("v2-typecheck", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json", "--noEmit"], "strict TypeScript", { cwd: tutorRoot });
requireSuccess("v2-compile", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json"], "convergence compilation", { cwd: tutorRoot });
requireSuccess("schema-runtime-parity-artifacts", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-schemas.js", "--check"], "23 schemas + inventory exact", { cwd: tutorRoot });
requireSuccess("release-evidence-artifacts", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-release.js", "--check"], "7 release artifacts exact", { cwd: tutorRoot });

const dist = "scripts/tutor-v2/.dist";
requireTap("accepted-v2-slice-tests", [
  `${dist}/core/v2/contracts/contracts.test.js`,
  `${dist}/core/v2/providers/testing/provider-port.test.js`,
  `${dist}/core/v2/policy/authority/authority.test.js`,
  `${dist}/core/v2/policy/grounding/grounding.test.js`,
  `${dist}/core/v2/policy/anti-answer/anti-answer.test.js`,
  `${dist}/core/v2/policy/refusal/refusal.test.js`,
  `${dist}/core/v2/policy/age/profile.test.js`,
  `${dist}/core/v2/memory/session-memory.test.js`,
  `${dist}/study-engine/tutor-v2/evidence/tutor-evidence.test.js`,
  `${dist}/study-engine/tutor-v2/privacy/provider-context.test.js`,
], { tests: 112, pass: 112 });
requireTap("provider-port-regression", [
  `${dist}/core/v2/providers/testing/provider-port.test.js`,
], { tests: 12, pass: 12 });
requireTap("provider-mutation-convergence-hard-gate", [
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
], { tests: 13, pass: 13 });
requireTap("cross-slice-convergence-tests", [
  `${dist}/tests/tutor-v2-convergence/composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
  `${dist}/tests/tutor-v2-convergence/schema-parity.test.js`,
], { tests: 55, pass: 55 });

requireSuccess("bridge-typecheck", process.execPath, [tsc, "-p", "study-engine/tests/tutor-v2-bridge/tsconfig.json"], "W1-08 bridge compilation", { cwd: tutorRoot });
const bridgeTest = "study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js";
requireSelectedTap("w1-b1-provider-mutation-adversarial", [bridgeTest], "W1-10 adversarial", { selected: 12 });
requireTap("repaired-bridge-regression", [bridgeTest], { tests: 87, pass: 87 });

const evalTests = requireSuccess("evaluation-harness-build-test", "npm", ["--prefix", "evals/v2/framework", "test"], "harness self-tests", { cwd: tutorRoot });
const evalCounts = tapCounts(`${evalTests.stdout}${evalTests.stderr}`);
if (evalTests.status === 0 && evalCounts.tests === 8 && evalCounts.pass === 8) {
  checks[checks.length - 1] = { ...checks.at(-1), detail: "8/8 harness self-tests" };
} else {
  checks[checks.length - 1] = { ...checks.at(-1), status: "FAIL", detail: `${evalCounts.pass}/${evalCounts.tests} harness self-tests` };
  hardFailure = true;
}

const evaluation = execute(process.execPath, ["evals/v2/framework/.dist/framework/src/cli.js", "--format=json"], { cwd: tutorRoot });
try {
  const report = JSON.parse(evaluation.stdout);
  const passed = evaluation.status === 0 && report.totalScenarios === 128 && report.passed === 128 && report.failed === 0 && report.classification === "FOUNDATION_GATE_PASS" && report.releaseReady === false;
  record("foundation-evaluation", passed ? "PASS" : "FAIL", `${report.passed}/${report.totalScenarios}; ${report.classification}; releaseReady=${String(report.releaseReady)}`, "node evals/v2/framework/.dist/framework/src/cli.js --format=json");
} catch {
  record("foundation-evaluation", "FAIL", "machine report was not valid JSON", "node evals/v2/framework/.dist/framework/src/cli.js --format=json");
}

requireSuccess("tutor-core-v0.2-typecheck", process.execPath, [tsc, "-p", "tsconfig.json", "--noEmit"], "frozen Core typecheck", { cwd: tutorRoot });
const coreTests = requireSuccess("tutor-core-v0.2-tests", "npm", ["test"], "frozen Core regression", { cwd: tutorRoot });
const coreCounts = tapCounts(`${coreTests.stdout}${coreTests.stderr}`);
if (coreTests.status === 0 && coreCounts.tests === 21 && coreCounts.pass === 21) checks[checks.length - 1] = { ...checks.at(-1), detail: "21/21 tests" };
else {
  checks[checks.length - 1] = { ...checks.at(-1), status: "FAIL", detail: `${coreCounts.pass}/${coreCounts.tests} tests` };
  hardFailure = true;
}

let buildRoot;
try {
  buildRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave1-core-build-"));
  const copyRoot = join(buildRoot, "adaptive-tutor");
  await cp(tutorRoot, copyRoot, {
    recursive: true,
    filter: (source) => !["node_modules", "dist", ".test-dist", ".dist"].includes(basename(source)),
  });
  await symlink(resolve(tutorRoot, "node_modules"), join(copyRoot, "node_modules"));
  requireSuccess("tutor-core-v0.2-build", "npm", ["run", "build"], "isolated build PASS", { cwd: copyRoot });
  requireSuccess("tutor-core-v0.2-smoke", "npm", ["run", "smoke"], "isolated smoke PASS", { cwd: copyRoot });
  const validation = execute("npm", ["run", "validate"], { cwd: copyRoot });
  const output = `${validation.stdout}${validation.stderr}`;
  if (output.includes("Checks: 19") && output.includes("Passed: 18") && output.includes("Failed: 1") && output.includes("platform-boundary | FAIL")) {
    record("w1-05-broad-validator", "INHERITED_FINDING", "18/19; obsolete substring/platform scope flags accepted authority paths and generated test output", "npm run validate (isolated copy)");
  } else record("w1-05-broad-validator", "FAIL", "result was not the isolated inherited 18/19 condition", "npm run validate (isolated copy)");
} finally {
  if (buildRoot !== undefined) await rm(buildRoot, { recursive: true, force: true });
}

let sourceRoot;
try {
  sourceRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave1-study-core-"));
  const frozenTutor = join(sourceRoot, "tutor-core", "manuel-academy-adaptive-tutor-core-v0.2", "adaptive-tutor");
  await mkdir(dirname(frozenTutor), { recursive: true });
  await cp(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/adaptive-tutor-core"), frozenTutor, { recursive: true });
  await symlink(resolve(tutorRoot, "node_modules"), join(frozenTutor, "node_modules"));
  requireSuccess("frozen-core-live-tree-build", "npm", ["run", "build"], "reconstructed frozen v0.2 source build", { cwd: frozenTutor });
  await unlink(join(frozenTutor, "node_modules"));
  const studyContracts = join(sourceRoot, "study-contracts", "adaptive-tutor", "study-engine");
  await mkdir(dirname(studyContracts), { recursive: true });
  await symlink(resolve(tutorRoot, "study-engine/integration-labs/student-runtime/vendor/study-engine"), studyContracts);
  const bridge = execute(process.execPath, ["--test", "adaptive-tutor/study-engine/tests/tutor-core-bridge/*.test.mjs"], {
    cwd: repositoryRoot,
    env: { ...process.env, SESSION6_SOURCE_ROOT: sourceRoot, SESSION6_TSC: tsc },
  });
  const counts = tapCounts(`${bridge.stdout}${bridge.stderr}`);
  const expectedSkip = [process.env.SESSION6_TUTOR_ZIP, process.env.SESSION6_STUDY_CONTRACTS_ZIP, process.env.SESSION6_STUDY_ENGINE_ZIP, process.env.SESSION6_RECONCILIATION_ZIP].some((value) => !value);
  const expected = expectedSkip ? { tests: 36, pass: 35, skipped: 1 } : { tests: 36, pass: 36, skipped: 0 };
  const passed = bridge.status === 0 && counts.tests === expected.tests && counts.pass === expected.pass && counts.fail === 0 && counts.skipped === expected.skipped;
  record("study-core-bridge-regression", passed ? "PASS" : "FAIL", `${counts.pass}/${counts.tests} pass; ${counts.skipped} skipped`, "SESSION6_SOURCE_ROOT=<reconstructed> node --test adaptive-tutor/study-engine/tests/tutor-core-bridge/*.test.mjs");
  record("frozen-archive-checksums", expectedSkip ? "NOT_AVAILABLE" : "PASS", expectedSkip ? "four external SESSION6 archives not mounted; one exact-checksum test skipped" : "four configured archives verified", "SESSION6_*_ZIP exact checksum test");
  if (!passed) process.stderr.write(`${bridge.stdout}${bridge.stderr}`);
} finally {
  if (sourceRoot !== undefined) await rm(sourceRoot, { recursive: true, force: true });
}

const audit = execute("npm", ["audit", "--json"], { cwd: resolve(tutorRoot, "study-engine/runtime") });
try {
  const report = JSON.parse(audit.stdout);
  const vulnerabilities = report.metadata?.vulnerabilities ?? {};
  const names = Object.keys(report.vulnerabilities ?? {}).sort();
  if (vulnerabilities.total === 0) record("dependency-advisories", "PASS", "0 advisories", "npm audit --json (study-engine/runtime)");
  else if (vulnerabilities.high === 3 && vulnerabilities.critical === 0 && JSON.stringify(names) === JSON.stringify(["@playwright/test", "nanoid", "playwright"])) {
    record("dependency-advisories", "INHERITED_FINDING", "3 existing high advisories: @playwright/test, nanoid, playwright; manifests unchanged from immutable baseline", "npm audit --json (study-engine/runtime)");
  } else record("dependency-advisories", "FAIL", `${vulnerabilities.total ?? "unknown"} advisories outside accepted inherited set`, "npm audit --json (study-engine/runtime)");
} catch {
  record("dependency-advisories", "FAIL", "npm audit report unavailable or malformed", "npm audit --json (study-engine/runtime)");
}

const allowed = (path) => path === "adaptive-tutor/core/v2/index.ts" || path === "adaptive-tutor/core/index.ts" || path === "adaptive-tutor/study-engine/tutor-v2/index.ts" || path === "adaptive-tutor/package.json" || path === "adaptive-tutor/MANIFEST.json" || path.startsWith("adaptive-tutor/json-schema/v2/") || path.startsWith("adaptive-tutor/scripts/tutor-v2/") || path.startsWith("adaptive-tutor/tutor-v2-release/") || path.startsWith("adaptive-tutor/tests/tutor-v2-convergence/") || path.startsWith("docs/study-tutor-v2/wave1/");
const statusPaths = git(["status", "--porcelain=v1", "--untracked-files=all"]).stdout.split("\n").filter(Boolean).map((line) => line.slice(3));
const committedPaths = git(["diff", "--name-only", REPAIR_SHA, "HEAD"]).stdout.split("\n").filter(Boolean);
const authoredPaths = [...new Set([...committedPaths, ...statusPaths])];
const ownershipViolations = authoredPaths.filter((path) => !allowed(path));
record("w1-09r2-path-ownership", ownershipViolations.length === 0 ? "PASS" : "FAIL", ownershipViolations.length === 0 ? `${authoredPaths.length} authored files all convergence-owned` : ownershipViolations.join(", "), `git diff --name-only ${REPAIR_SHA} HEAD plus git status`);
const diffCheck = git(["diff", "--check"]);
record("git-diff-check", diffCheck.status === 0 ? "PASS" : "FAIL", diffCheck.status === 0 ? "no whitespace errors" : diffCheck.stdout.trim(), "git diff --check");

const inherited = checks.some((check) => check.status === "INHERITED_FINDING" || check.status === "NOT_AVAILABLE");
const finalClassification = hardFailure
  ? "WAVE1_HOLD"
  : inherited
    ? "WAVE1_R2_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS"
    : "WAVE1_R2_CANDIDATE_READY_FOR_FINAL_REREVIEW";
const result = {
  resultVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 1 Foundation",
  foundationGate: hardFailure ? "FAIL" : "PASS",
  finalClassification,
  releaseReady: false,
  checks,
};
await mkdir(resolve(tutorRoot, "tutor-v2-release"), { recursive: true });
await writeFile(resolve(tutorRoot, "tutor-v2-release/WAVE1-GATE-RESULT.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (hardFailure) process.exitCode = 1;

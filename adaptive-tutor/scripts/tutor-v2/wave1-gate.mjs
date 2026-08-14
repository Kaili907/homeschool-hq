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
const B1_REPAIR_SHA = "d7aa9720b8096205acc0b63d21a895d8fc16de6f";
const W1_09R2_SHA = "2c8716ed5db5bb824fc92533615295f0b163f7b2";
const B2_REPAIR_SHA = "9f0b66be0b7f86b2004f05137ef9892d2a3ef09a";
const W1_09R3_SHA = "7435f820dc9e141d8a113b4d7f853044e36ba51d";
const B3_REPAIR_SHA = "cf7ee7265c812a86b708b0e8cf2a33e6370e753d";
const W1_09R4_SHA = "6f90d351d759c697788b6489bd465d954ce52184";
const B4_REPAIR_SHA = "cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841";

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

function requireTap(name, files, expected, options = {}) {
  const result = execute(process.execPath, ["--test", ...files], options);
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
  "origin/mac/tutor-v2-w1-provider-boundary-repair-r1": B1_REPAIR_SHA,
  "origin/mac/tutor-v2-w1-reconvergence-r2": W1_09R2_SHA,
  "origin/mac/tutor-v2-w1-anti-answer-repair-r2": B2_REPAIR_SHA,
  "origin/mac/tutor-v2-w1-reconvergence-r3": W1_09R3_SHA,
  "origin/mac/tutor-v2-w1-privacy-provenance-repair-r3": B3_REPAIR_SHA,
  "origin/mac/tutor-v2-w1-reconvergence-r4": W1_09R4_SHA,
  "origin/mac/tutor-v2-w1-approval-decision-repair-r4": B4_REPAIR_SHA,
};
const remoteMismatches = Object.entries(refs).filter(([ref, expected]) => git(["rev-parse", ref]).stdout.trim() !== expected);
record("canonical-provenance", remoteMismatches.length === 0 ? "PASS" : "FAIL", remoteMismatches.length === 0 ? "16/16 pinned remote tips exact, including B1/B2/B3/B4 and R2/R3/R4" : `${remoteMismatches.length} remote mismatches`, "git rev-parse origin/mac/tutor-v2-w1-*");

const b1Parent = git(["rev-parse", `${B1_REPAIR_SHA}^`]).stdout.trim();
record("b1-repair-direct-parent", b1Parent === "16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d" ? "PASS" : "FAIL", b1Parent, `git rev-parse ${B1_REPAIR_SHA}^`);
const b2Parent = git(["rev-parse", `${B2_REPAIR_SHA}^`]).stdout.trim();
record("b2-repair-direct-parent", b2Parent === W1_09R2_SHA ? "PASS" : "FAIL", b2Parent, `git rev-parse ${B2_REPAIR_SHA}^`);
const b3Parent = git(["rev-parse", `${B3_REPAIR_SHA}^`]).stdout.trim();
record("b3-repair-direct-parent", b3Parent === W1_09R3_SHA ? "PASS" : "FAIL", b3Parent, `git rev-parse ${B3_REPAIR_SHA}^`);

const b4Parent = git(["rev-parse", `${B4_REPAIR_SHA}^`]).stdout.trim();
record("b4-repair-direct-parent", b4Parent === W1_09R4_SHA ? "PASS" : "FAIL", b4Parent, `git rev-parse ${B4_REPAIR_SHA}^`);
const b4RepairScope = git(["diff", "--name-only", W1_09R4_SHA, B4_REPAIR_SHA]).stdout.split("\n").filter(Boolean);
const b4ScopeExact = JSON.stringify(b4RepairScope.sort()) === JSON.stringify([
  "adaptive-tutor/study-engine/bridges/tutor-v2/reviewed-content.ts",
  "adaptive-tutor/study-engine/tests/tutor-v2-bridge/integration.test.ts",
]);
record("b4-repair-audited-scope", b4ScopeExact ? "PASS" : "FAIL", b4ScopeExact ? "B4 touched only reviewed-content.ts and the bridge suite" : b4RepairScope.join(", "), `git diff --name-only ${W1_09R4_SHA} ${B4_REPAIR_SHA}`);

const laneTrees = [
  ["befb91bb2321aec0449d2d8e613619a592feb76c", ["adaptive-tutor/core/v2/policy/authority", "adaptive-tutor/core/v2/policy/grounding", "adaptive-tutor/core/v2/policy/refusal"]],
  ["4a8bded7bc0caf5ff647dae814e011d20c8ae5bf", ["adaptive-tutor/core/v2/policy/age", "adaptive-tutor/core/v2/memory"]],
  ["b93765552d60a88ac7691ca7840dfc2ae3a23e77", ["adaptive-tutor/study-engine/tutor-v2/evidence", "adaptive-tutor/study-engine/tutor-v2/privacy"]],
  ["9b959ab7e8176ebccb4fd3ca7b54bf5584602b35", ["adaptive-tutor/evals/v2/framework", "adaptive-tutor/evals/v2/corpus/foundation"]],
];
const treeFailures = laneTrees.filter(([sha, paths]) => git(["diff", "--quiet", sha, "HEAD", "--", ...paths]).status !== 0);
record("accepted-lane-tree-equivalence", treeFailures.length === 0 ? "PASS" : "FAIL", treeFailures.length === 0 ? "unrepaired W1-04 through W1-07 trees exact" : `${treeFailures.length} lane tree mismatches`, "git diff --quiet <accepted-sha> HEAD -- <unrepaired-lane-paths>");

const b1RepairPaths = [
  "adaptive-tutor/core/v2/providers",
];
const b1RepairTreeExact = git(["diff", "--quiet", B1_REPAIR_SHA, "HEAD", "--", ...b1RepairPaths]).status === 0;
record("accepted-b1-repair-tree-equivalence", b1RepairTreeExact ? "PASS" : "FAIL", b1RepairTreeExact ? "provider and bridge repair source exact" : "B1 repair-owned source drifted", `git diff --quiet ${B1_REPAIR_SHA} HEAD -- <b1-repair-paths>`);
const b2RepairPaths = [
  "adaptive-tutor/core/v2/policy/anti-answer",
];
const b2RepairTreeExact = git(["diff", "--quiet", B2_REPAIR_SHA, "HEAD", "--", ...b2RepairPaths]).status === 0;
record("accepted-b2-repair-tree-equivalence", b2RepairTreeExact ? "PASS" : "FAIL", b2RepairTreeExact ? "structural anti-answer repair source and bridge tests exact" : "B2 repair-owned tree drifted", `git diff --quiet ${B2_REPAIR_SHA} HEAD -- <b2-repair-paths>`);
const b3RepairPaths = [
  "adaptive-tutor/study-engine/bridges/tutor-v2",
  "adaptive-tutor/study-engine/tests/tutor-v2-bridge",
  ":(exclude)adaptive-tutor/study-engine/bridges/tutor-v2/reviewed-content.ts",
  ":(exclude)adaptive-tutor/study-engine/tests/tutor-v2-bridge/integration.test.ts",
];
const b3RepairTreeExact = git(["diff", "--quiet", B3_REPAIR_SHA, "HEAD", "--", ...b3RepairPaths]).status === 0;
record("accepted-b3-repair-tree-equivalence", b3RepairTreeExact ? "PASS" : "FAIL", b3RepairTreeExact ? "privacy bridge source outside the audited B4 repair scope exact" : "B3 repair-owned tree drifted", `git diff --quiet ${B3_REPAIR_SHA} HEAD -- <b3-repair-paths minus b4 scope>`);
const b4RepairPaths = [
  "adaptive-tutor/study-engine/bridges/tutor-v2",
  "adaptive-tutor/study-engine/tests/tutor-v2-bridge",
];
const b4RepairTreeExact = git(["diff", "--quiet", B4_REPAIR_SHA, "HEAD", "--", ...b4RepairPaths]).status === 0;
record("accepted-b4-repair-tree-equivalence", b4RepairTreeExact ? "PASS" : "FAIL", b4RepairTreeExact ? "approval-decision parser source and bridge tests exact" : "B4 repair-owned tree drifted", `git diff --quiet ${B4_REPAIR_SHA} HEAD -- <b4-repair-paths>`);

const providerContractsSource = await readFile(resolve(tutorRoot, "core/v2/providers/ports/contracts.ts"), "utf8");
const sharedV2Source = await readFile(resolve(tutorRoot, "core/v2/index.ts"), "utf8");
const narrowProviderPort = /execute\(request: ProviderExecutionRequest\): Promise<ProviderExecutionResult>/.test(providerContractsSource)
  && !/execute\(request: (?:TutorRequest|StudyAuthorityContext)/.test(providerContractsSource)
  && /ProviderExecutionRequest/.test(sharedV2Source);
record("provider-port-structural-boundary", narrowProviderPort ? "PASS" : "FAIL", narrowProviderPort ? "provider-safe request exported; TutorRequest/StudyAuthorityContext excluded" : "provider port widening detected", "source structural assertion");

const reviewedContentSource = await readFile(resolve(tutorRoot, "study-engine/bridges/tutor-v2/reviewed-content.ts"), "utf8");
const rawParsedBeforeNormalization =
  /const rawDecision = await authority\.review\(structuredClone\(request\)\);\s*const decision = parseRawApprovalDecision\(rawDecision\);/.test(reviewedContentSource)
  && !/structuredClone\(rawDecision\)/.test(reviewedContentSource)
  && !/JSON\.parse\(JSON\.stringify\(rawDecision\)\)/.test(reviewedContentSource)
  && !/rawDecision\.(?:status|approvalRef|code)/.test(reviewedContentSource)
  && /Object\.getPrototypeOf\(candidate\) !== Object\.prototype/.test(reviewedContentSource)
  && /Reflect\.ownKeys\(candidate\)/.test(reviewedContentSource)
  && /Object\.getOwnPropertyDescriptors\(candidate\)/.test(reviewedContentSource)
  && /Object\.hasOwn\(descriptor, "get"\)/.test(reviewedContentSource)
  && /Object\.hasOwn\(descriptor, "set"\)/.test(reviewedContentSource);
record("approval-decision-structural-parser-boundary", rawParsedBeforeNormalization ? "PASS" : "FAIL", rawParsedBeforeNormalization ? "raw authority decision validated before normalization or property access" : "approval decision normalization precedes validation", "source structural assertion");

requireSuccess("v2-typecheck", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json", "--noEmit"], "strict TypeScript", { cwd: tutorRoot });
requireSuccess("v2-compile", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json"], "convergence compilation", { cwd: tutorRoot });
requireSuccess("schema-runtime-parity-artifacts", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-schemas.js", "--check"], "23 schemas + inventory exact", { cwd: tutorRoot });
requireSuccess("release-evidence-artifacts", process.execPath, ["scripts/tutor-v2/.dist/scripts/tutor-v2/generate-release.js", "--check"], "10 release artifacts exact", { cwd: tutorRoot });

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
], { tests: 168, pass: 168 });
requireTap("provider-port-regression", [
  `${dist}/core/v2/providers/testing/provider-port.test.js`,
], { tests: 12, pass: 12 });
requireTap("provider-mutation-convergence-hard-gate", [
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
], { tests: 13, pass: 13 });
const structuralAntiAnswerTest = `${dist}/tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.js`;
const reviewedPrivacyTest = `${dist}/tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.js`;
requireTap("structural-anti-answer-convergence-hard-gate", [
  structuralAntiAnswerTest,
], { tests: 53, pass: 53 });
for (const kind of ["explain", "hint", "ask-check", "show-example", "reteach"]) {
  requireSelectedTap(
    `active-assessment-${kind}-structural-hard-gate`,
    [structuralAntiAnswerTest],
    `structural anti-answer adversarial .*active ${kind} rejects`,
    { selected: 3 },
  );
}
requireSelectedTap("active-assessment-phrase-matrix-hard-gate", [structuralAntiAnswerTest], "W1-09R3 phrase matrix", { selected: 20 });
requireSelectedTap("active-assessment-structured-controls-regression", [structuralAntiAnswerTest], "W1-09R3 structured control", { selected: 4 });
requireSelectedTap("answer-bearing-field-hard-gate", [structuralAntiAnswerTest], "answer-bearing structured field", { selected: 1 });
requireSelectedTap("completed-review-permission-hard-gate", [structuralAntiAnswerTest], "W1-09R3 completed review", { selected: 2 });
requireTap("reviewed-content-privacy-provenance-hard-gate", [reviewedPrivacyTest], { tests: 78, pass: 78 });
requireSelectedTap("w1-10r3-historical-privacy-blockers", [reviewedPrivacyTest], "W1-10R3 historical privacy blocker", { selected: 16 });
requireSelectedTap("additional-privacy-provenance-hard-gates", [reviewedPrivacyTest], "B3 additional privacy provenance", { selected: 21 });
requireSelectedTap("approval-authority-attacks", [reviewedPrivacyTest], "B3 approval attack", { selected: 10 });
requireSelectedTap("free-form-output-provenance", [reviewedPrivacyTest], "B3 free-form output provenance", { selected: 15 });
requireSelectedTap("structured-control-privacy", [reviewedPrivacyTest], "B3 structured control privacy", { selected: 16 });
const approvalDecisionTest = `${dist}/tests/tutor-v2-convergence/approval-decision-structural-validation-adversarial.test.js`;
requireTap("approval-decision-structural-validation-hard-gate", [approvalDecisionTest], { tests: 67, pass: 67 });
requireSelectedTap("b4-raw-decision-root-invariant", [approvalDecisionTest], "B4 root invariant", { selected: 1 });
requireSelectedTap("b4-accessor-attacks", [approvalDecisionTest], "B4 accessor attack", { selected: 10 });
requireSelectedTap("b4-hostile-thenable-attacks", [approvalDecisionTest], "B4 hostile thenable", { selected: 2 });
requireSelectedTap("b4-prototype-attacks", [approvalDecisionTest], "B4 prototype attack", { selected: 6 });
requireSelectedTap("b4-hidden-key-attacks", [approvalDecisionTest], "B4 hidden-key attack", { selected: 5 });
requireSelectedTap("b4-hostile-reflection-attacks", [approvalDecisionTest], "B4 hostile reflection", { selected: 3 });
requireSelectedTap("b4-malformed-value-shapes", [approvalDecisionTest], "B4 malformed primitive or container|B4 malformed decision shape", { selected: 15 });
requireSelectedTap("b4-legitimate-decision-regression", [approvalDecisionTest], "B4 legitimate decision regression", { selected: 6 });
requireSelectedTap("b4-w1-10r4-historical-blockers", [approvalDecisionTest], "B4 W1-10R4 historical", { selected: 8 });
requireSelectedTap("b4-provider-input-malformed-approval", [approvalDecisionTest], "B4 W1-10R4 historical provider-input|B4 provider-input grounding", { selected: 8 });
requireSelectedTap("b4-provider-output-malformed-approval", [approvalDecisionTest], "B4 W1-10R4 historical provider-output", { selected: 4 });
requireSelectedTap("b4-composition-attacks", [approvalDecisionTest], "B4 composition", { selected: 6 });
requireSelectedTap("b4-failure-data-minimization", [approvalDecisionTest], "B4 failure-data minimization", { selected: 1 });

requireTap("cross-slice-convergence-tests", [
  `${dist}/tests/tutor-v2-convergence/composition.test.js`,
  `${dist}/tests/tutor-v2-convergence/provider-boundary-adversarial.test.js`,
  reviewedPrivacyTest,
  `${dist}/tests/tutor-v2-convergence/schema-parity.test.js`,
  structuralAntiAnswerTest,
  approvalDecisionTest,
], { tests: 253, pass: 253 });

requireSuccess("bridge-typecheck", process.execPath, [tsc, "-p", "study-engine/tests/tutor-v2-bridge/tsconfig.json"], "W1-08 bridge compilation", { cwd: tutorRoot });
const bridgeTest = "study-engine/tests/tutor-v2-bridge/.test-dist/study-engine/tests/tutor-v2-bridge/integration.test.js";
requireSelectedTap("w1-b1-provider-mutation-adversarial", [bridgeTest], "W1-10 adversarial", { selected: 12 });
requireSelectedTap("w1-b2-structural-anti-answer-bridge", [bridgeTest], "malicious provider active-assessment|active-assessment structured control|answer-bearing provider field|completed review|provider context excludes protected answer authority", { selected: 13 });
requireSelectedTap("w1-b3-reviewed-content-privacy-bridge", [bridgeTest], "W1-10R3|reviewed-content authority|reviewed learner-safe|grounding digest|raw learner free-form|exact Study-reviewed prose|unapproved reason code|approval cannot|provider-fabricated approval|self-computed digest|authority and approval objects", { selected: 50 });
requireSelectedTap("w1-b4-approval-decision-bridge", [bridgeTest], "raw approval|raw status|throwing approval getter|custom-prototype approval|class-instance approval|null-prototype approval|inherited approval fields|custom prototype supplying|non-enumerable extra key|symbol key on approval|non-enumerable approval metadata|hidden extra key on rejection|exact synchronous|exact asynchronous|frozen exact plain approval|malformed approval failure data|primitive or container authority decision|hostile authority decision|approval fails closed before provider execution|learner-output approval uses reviewed fallback", { selected: 41 });
requireTap("repaired-bridge-regression", [bridgeTest], { tests: 209, pass: 209 });

let neutralizedRoot;
try {
  neutralizedRoot = await mkdtemp(join(tmpdir(), "tutor-v2-wave1-regex-neutralized-"));
  const neutralizedTutor = join(neutralizedRoot, "adaptive-tutor");
  await cp(tutorRoot, neutralizedTutor, {
    recursive: true,
    filter: (source) => !["node_modules", "dist", ".test-dist", ".dist"].includes(basename(source)),
  });
  const privacySourcePath = join(neutralizedTutor, "study-engine/bridges/tutor-v2/privacy.ts");
  const privacySource = await readFile(privacySourcePath, "utf8");
  const rulesStart = privacySource.indexOf("const RULES:");
  const rulesEnd = privacySource.indexOf("\n\nfunction scanStrings", rulesStart);
  if (rulesStart < 0 || rulesEnd < 0) throw new Error("privacy RULES seam not found");
  const neutralRules = "const RULES: readonly {\n  readonly code: TutorV2BridgePrivacyIssue[\"code\"];\n  readonly pattern: RegExp;\n}[] = [];";
  await writeFile(
    privacySourcePath,
    `${privacySource.slice(0, rulesStart)}${neutralRules}${privacySource.slice(rulesEnd)}`,
    "utf8",
  );
  await symlink(resolve(tutorRoot, "node_modules"), join(neutralizedTutor, "node_modules"));
  const compiled = requireSuccess("regex-neutralized-privacy-compile", process.execPath, [tsc, "-p", "scripts/tutor-v2/tsconfig.json"], "temporary copy compiled with lexical RULES empty", { cwd: neutralizedTutor });
  if (compiled.status === 0) {
    requireTap("regex-neutralized-privacy-provenance-hard-gate", [
      "scripts/tutor-v2/.dist/tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.js",
    ], { tests: 78, pass: 78 }, { cwd: neutralizedTutor });
    checks[checks.length - 1] = {
      ...checks.at(-1),
      command: "temporary copy: RULES=[]; tsc; node --test reviewed-content-privacy-provenance-adversarial.test.js",
    };
  }
} catch (error) {
  record("regex-neutralized-privacy-provenance-hard-gate", "FAIL", error instanceof Error ? error.message : String(error), "temporary copy with RULES=[]");
} finally {
  if (neutralizedRoot !== undefined) await rm(neutralizedRoot, { recursive: true, force: true });
}

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
const committedPaths = git(["diff", "--name-only", B4_REPAIR_SHA, "HEAD"]).stdout.split("\n").filter(Boolean);
const authoredPaths = [...new Set([...committedPaths, ...statusPaths])];
const ownershipViolations = authoredPaths.filter((path) => !allowed(path));
record("w1-09r5-path-ownership", ownershipViolations.length === 0 ? "PASS" : "FAIL", ownershipViolations.length === 0 ? `${authoredPaths.length} authored files all convergence-owned` : ownershipViolations.join(", "), `git diff --name-only ${B4_REPAIR_SHA} HEAD plus git status`);
const diffCheck = git(["diff", "--check"]);
record("git-diff-check", diffCheck.status === 0 ? "PASS" : "FAIL", diffCheck.status === 0 ? "no whitespace errors" : diffCheck.stdout.trim(), "git diff --check");

const HARD_GATE_FAMILIES = [
  {
    name: "PROVIDER_AUTHORITY_BOUNDARY",
    blocker: "W1-10 HOLD #1: provider received and could mutate Study authority",
    repair: B1_REPAIR_SHA,
    members: [
      "provider-port-structural-boundary",
      "provider-port-regression",
      "provider-mutation-convergence-hard-gate",
      "w1-b1-provider-mutation-adversarial",
      "accepted-b1-repair-tree-equivalence",
    ],
  },
  {
    name: "STRUCTURAL_ACTIVE_ASSESSMENT_ANTI_ANSWER",
    blocker: "W1-10R2 HOLD #2: active-assessment answer security relied on lexical phrases",
    repair: B2_REPAIR_SHA,
    members: [
      "structural-anti-answer-convergence-hard-gate",
      "active-assessment-explain-structural-hard-gate",
      "active-assessment-hint-structural-hard-gate",
      "active-assessment-ask-check-structural-hard-gate",
      "active-assessment-show-example-structural-hard-gate",
      "active-assessment-reteach-structural-hard-gate",
      "active-assessment-phrase-matrix-hard-gate",
      "active-assessment-structured-controls-regression",
      "answer-bearing-field-hard-gate",
      "completed-review-permission-hard-gate",
      "w1-b2-structural-anti-answer-bridge",
      "accepted-b2-repair-tree-equivalence",
    ],
  },
  {
    name: "REVIEWED_CONTENT_PRIVACY_PROVENANCE",
    blocker: "W1-10R3 HOLD #3: privacy relied on lexical phrases",
    repair: B3_REPAIR_SHA,
    members: [
      "reviewed-content-privacy-provenance-hard-gate",
      "w1-10r3-historical-privacy-blockers",
      "additional-privacy-provenance-hard-gates",
      "approval-authority-attacks",
      "free-form-output-provenance",
      "structured-control-privacy",
      "regex-neutralized-privacy-provenance-hard-gate",
      "w1-b3-reviewed-content-privacy-bridge",
      "accepted-b3-repair-tree-equivalence",
    ],
  },
  {
    name: "APPROVAL_DECISION_STRUCTURAL_VALIDATION",
    blocker: "W1-10R4 reproduced blocker: malformed approval decisions normalized into valid-looking approvals before validation",
    repair: B4_REPAIR_SHA,
    members: [
      "approval-decision-structural-parser-boundary",
      "approval-decision-structural-validation-hard-gate",
      "b4-raw-decision-root-invariant",
      "b4-accessor-attacks",
      "b4-hostile-thenable-attacks",
      "b4-prototype-attacks",
      "b4-hidden-key-attacks",
      "b4-hostile-reflection-attacks",
      "b4-malformed-value-shapes",
      "b4-legitimate-decision-regression",
      "b4-w1-10r4-historical-blockers",
      "b4-provider-input-malformed-approval",
      "b4-provider-output-malformed-approval",
      "b4-composition-attacks",
      "b4-failure-data-minimization",
      "w1-b4-approval-decision-bridge",
      "accepted-b4-repair-tree-equivalence",
      "b4-repair-direct-parent",
      "b4-repair-audited-scope",
    ],
  },
];

const hardGateFamilies = HARD_GATE_FAMILIES.map((family) => {
  const resolved = family.members.map((name) => ({ name, status: checks.find((check) => check.name === name)?.status ?? "MISSING" }));
  const failures = resolved.filter((member) => member.status !== "PASS");
  if (failures.length > 0) hardFailure = true;
  return {
    name: family.name,
    enforcement: "HARD_NON_COMPENSABLE",
    compensableByQualityScore: false,
    blocker: family.blocker,
    repair: family.repair,
    status: failures.length === 0 ? "PASS" : "FAIL",
    memberChecks: resolved,
    failingChecks: failures.map((member) => `${member.name}:${member.status}`),
  };
});
for (const family of hardGateFamilies) {
  process.stdout.write(`${family.status} hard-gate-family ${family.name}: ${family.memberChecks.length} member checks${family.status === "PASS" ? "" : `; failing ${family.failingChecks.join(", ")}`}\n`);
}

const inherited = checks.some((check) => check.status === "INHERITED_FINDING" || check.status === "NOT_AVAILABLE");
const finalClassification = hardFailure
  ? "WAVE1_HOLD"
  : inherited
    ? "WAVE1_R5_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS"
    : "WAVE1_R5_CANDIDATE_READY_FOR_FINAL_REREVIEW";
const result = {
  resultVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 1 Foundation",
  foundationGate: hardFailure ? "FAIL" : "PASS",
  finalClassification,
  releaseReady: false,
  wave1Complete: false,
  finalIndependentRereviewRequired: true,
  hardGateFamilies,
  checks,
};
await mkdir(resolve(tutorRoot, "tutor-v2-release"), { recursive: true });
await writeFile(resolve(tutorRoot, "tutor-v2-release/WAVE1-GATE-RESULT.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (hardFailure) process.exitCode = 1;

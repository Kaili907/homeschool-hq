import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import {
  WAVE3_HARD_GATE_FAMILIES,
  type Wave3HardGateFamily,
} from "../../core/v3/commercial-operation/index.js";
import { MUTATIONS, type MutationDefinition } from "./mutations/catalog.js";

const BASELINE_SHA = "dfc512283ad1e7194558bdddb5debb2c0f8c7589";
const FAILED_W3_13_SHA = "4ea58cfb4346c579fd6a18898dd48d491e5cd8fd";
const B2_SIBLING_SHA = "add32beacaabe7b2d81ad48095fd2f4c3508a763";
const SESSION = "STUDY-TUTOR-V2-W3-B3 Real Executable Implementation Mutation Proof";

interface CommandResult {
  readonly command: string;
  readonly exitStatus: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly stdoutHash: string;
  readonly stderrHash: string;
}

interface HardGateFile {
  readonly hardGateFamilies: readonly {
    readonly name: Wave3HardGateFamily;
    readonly status: "PASS" | "FAIL";
  }[];
}

interface MutationResult {
  readonly candidateSha: string;
  readonly runnerRevision: string;
  readonly family: Wave3HardGateFamily;
  readonly mutationId: string;
  readonly description: string;
  readonly method: string;
  readonly sourcePaths: readonly string[];
  readonly beforeGitBlobs: Readonly<Record<string, string | null>>;
  readonly afterSha256: Readonly<Record<string, string>>;
  readonly exactUnifiedDiff: string;
  readonly baselineCommands: readonly string[];
  readonly mutationCommands: readonly string[];
  readonly compileCommand: string;
  readonly compileExitStatus: number;
  readonly focusedTestCommand: string;
  readonly focusedTestExitStatus: number;
  readonly aggregateGateCommand: string;
  readonly gateExitStatus: number;
  readonly expectedFailingTestNames: readonly string[];
  readonly actualFailingTestNames: readonly string[];
  readonly expectedFailedGate: Wave3HardGateFamily;
  readonly actualFailedGates: readonly Wave3HardGateFamily[];
  readonly stdoutHash: string;
  readonly stderrHash: string;
  readonly logFiles: Readonly<Record<string, string>>;
  classification: "KILLED" | "SURVIVED" | "INVALID_MUTANT";
  cleanupProof: {
    worktreeRemoved: boolean;
    worktreePruned: boolean;
    canonicalProductionDiffClean: boolean;
  };
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function normalizedLog(value: string, worktreePath?: string): string {
  let normalized = value.replaceAll("\r\n", "\n");
  if (worktreePath) normalized = normalized.replaceAll(worktreePath, "$MUTANT_ROOT");
  return normalized
    .replace(/duration_ms: [0-9.]+/g, "duration_ms: <duration>")
    .replace(/# duration_ms [0-9.]+/g, "# duration_ms <duration>")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function run(
  executable: string,
  args: readonly string[],
  cwd: string,
  displayCommand: string,
  worktreePath?: string,
): CommandResult {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = normalizedLog(result.stdout ?? "", worktreePath);
  const stderr = normalizedLog(
    `${result.stderr ?? ""}${result.error ? `${result.error.name}: ${result.error.message}\n` : ""}`,
    worktreePath,
  );
  return {
    command: displayCommand,
    exitStatus: result.status ?? 127,
    stdout,
    stderr,
    stdoutHash: sha256(stdout),
    stderrHash: sha256(stderr),
  };
}

function git(repoRoot: string, args: readonly string[], displayCommand?: string): CommandResult {
  return run("git", args, repoRoot, displayCommand ?? `git ${args.join(" ")}`);
}

function gitText(repoRoot: string, args: readonly string[]): string {
  const result = git(repoRoot, args);
  if (result.exitStatus !== 0) {
    throw new Error(`${result.command} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function occurrenceCount(source: string, anchor: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const found = source.indexOf(anchor, offset);
    if (found === -1) return count;
    count += 1;
    offset = found + anchor.length;
  }
}

function applyMutation(repoRoot: string, mutation: MutationDefinition): {
  readonly sourcePaths: readonly string[];
  readonly beforeGitBlobs: Readonly<Record<string, string | null>>;
  readonly afterSha256: Readonly<Record<string, string>>;
} {
  const sourcePaths = [...new Set(mutation.rewrites.map((rewrite) => rewrite.sourcePath))];
  const beforeGitBlobs: Record<string, string | null> = {};
  for (const sourcePath of sourcePaths) {
    const blob = git(repoRoot, ["rev-parse", `${BASELINE_SHA}:${sourcePath}`]);
    beforeGitBlobs[sourcePath] = blob.exitStatus === 0 ? blob.stdout.trim() : null;
  }

  for (const rewrite of mutation.rewrites) {
    const path = resolve(repoRoot, rewrite.sourcePath);
    if (rewrite.before === null) {
      if (existsSync(path)) throw new Error(`${mutation.mutationId}: new-file target already exists: ${rewrite.sourcePath}`);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, rewrite.after);
      continue;
    }
    const source = readFileSync(path, "utf8");
    const matches = occurrenceCount(source, rewrite.before);
    if (matches !== 1) {
      throw new Error(`${mutation.mutationId}: expected one anchor in ${rewrite.sourcePath}, found ${matches}`);
    }
    const mutated = source.replace(rewrite.before, rewrite.after);
    if (rewrite.after.length > 0 && occurrenceCount(mutated, rewrite.after) < 1) {
      throw new Error(`${mutation.mutationId}: postimage missing in ${rewrite.sourcePath}`);
    }
    if (rewrite.after.length === 0 && mutated.includes(rewrite.before)) {
      throw new Error(`${mutation.mutationId}: deleted preimage remains in ${rewrite.sourcePath}`);
    }
    writeFileSync(path, mutated);
  }

  const afterSha256: Record<string, string> = {};
  for (const sourcePath of sourcePaths) {
    afterSha256[sourcePath] = sha256(readFileSync(resolve(repoRoot, sourcePath)));
  }
  return { sourcePaths, beforeGitBlobs, afterSha256 };
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function failedTestNames(output: string): readonly string[] {
  return [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map((match) => match[1] ?? "");
}

function writeLog(logRoot: string, name: string, value: string, repoRoot: string): string {
  const path = resolve(logRoot, name);
  writeFileSync(path, value);
  return relative(repoRoot, path);
}

function canonicalProductionDiffClean(repoRoot: string): boolean {
  const paths = [
    "adaptive-tutor/core/v3",
    "adaptive-tutor/study-engine",
    "adaptive-tutor/evals/v3",
    "adaptive-tutor/src",
    "netlify",
    "supabase",
  ];
  return git(repoRoot, ["diff", "--quiet", "--", ...paths]).exitStatus === 0;
}

function canonicalProductionMatchesBaseline(repoRoot: string): boolean {
  const paths = [
    "adaptive-tutor/core/v3",
    "adaptive-tutor/study-engine",
    "adaptive-tutor/evals/v3",
    "adaptive-tutor/src",
    "netlify",
    "supabase",
  ];
  return git(repoRoot, ["diff", "--quiet", BASELINE_SHA, "--", ...paths]).exitStatus === 0;
}

function validateCatalog(): void {
  if (MUTATIONS.length !== 18) throw new Error(`Expected 18 mutations, found ${MUTATIONS.length}`);
  const families = MUTATIONS.map((mutation) => mutation.family);
  if (new Set(families).size !== MUTATIONS.length) throw new Error("Mutation families are not unique");
  if (WAVE3_HARD_GATE_FAMILIES.some((family) => !families.includes(family))) {
    throw new Error("Mutation catalog does not cover every Wave 3 hard-gate family");
  }
}

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
const repoRoot = resolve(tutorRoot, "..");
const compiler = resolve(repoRoot, "node_modules/typescript/bin/tsc");
const evidencePath = resolve(tutorRoot, "tutor-v2-wave3-release/MUTATION-EVIDENCE.json");
const documentationRoot = resolve(repoRoot, "docs/study-tutor-v2/wave3/repairs/w3-b3-real-mutation");
const logRoot = resolve(documentationRoot, "logs");
mkdirSync(dirname(evidencePath), { recursive: true });
mkdirSync(documentationRoot, { recursive: true });
rmSync(logRoot, { recursive: true, force: true });
mkdirSync(logRoot, { recursive: true });

validateCatalog();
const writerSha = gitText(repoRoot, ["rev-parse", "HEAD"]);
const candidateSha = gitText(repoRoot, ["rev-parse", BASELINE_SHA]);
if (candidateSha !== BASELINE_SHA) throw new Error(`Exact B1 candidate is unavailable: ${BASELINE_SHA}`);
if (!existsSync(compiler)) throw new Error(`TypeScript compiler not provisioned: ${compiler}`);
if (!existsSync(resolve(repoRoot, "node_modules"))) throw new Error("Canonical dependency tree is missing");
if (!canonicalProductionDiffClean(repoRoot) || !canonicalProductionMatchesBaseline(repoRoot)) {
  throw new Error("Canonical writer product source is dirty or differs from exact B1");
}

const runnerRevision = sha256([
  readFileSync(new URL(import.meta.url)),
  readFileSync(resolve(tutorRoot, "scripts/tutor-v3/mutations/catalog.ts")),
  readFileSync(resolve(tutorRoot, "scripts/tutor-v3/tsconfig.json")),
].map((part) => part.toString()).join("\n"));

const baselineRuns: CommandResult[] = [];
baselineRuns.push(run(process.execPath, [compiler, "-p", "scripts/tutor-v3/tsconfig.json", "--noEmit"], tutorRoot,
  "node $TSC -p scripts/tutor-v3/tsconfig.json --noEmit"));
baselineRuns.push(run(process.execPath, ["scripts/tutor-v3/run-compiled.mjs", "test"], tutorRoot,
  "node scripts/tutor-v3/run-compiled.mjs test"));
baselineRuns.push(run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js"], tutorRoot,
  "node scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js"));

const baselineProbeNames = [
  "foreign trusted invocation curriculum digest fails before provider execution",
  "top-level science subject cannot execute admitted mathematics curriculum",
  "a physical attempt cannot overrun its reserve using unused failover reserve",
  "measured execution over attempt timeout rejects low reported latency",
] as const;
for (const probe of baselineProbeNames) {
  const pattern = `^(?:${regexEscape(probe)})$`;
  baselineRuns.push(run(process.execPath, ["--test", "--test-name-pattern", pattern, commercialFlowPath()], tutorRoot,
    `node --test --test-name-pattern ${JSON.stringify(pattern)} ${commercialFlowPath()}`));
}
const costAnomalyPattern = "^(?:cost over reservation becomes an anomaly without fabricated release)$";
baselineRuns.push(run(process.execPath, [
  "--test",
  "--test-name-pattern",
  costAnomalyPattern,
  "scripts/tutor-v3/.dist/core/v3/routing/budget-resilience/budget-resilience.test.js",
], tutorRoot,
`node --test --test-name-pattern ${JSON.stringify(costAnomalyPattern)} scripts/tutor-v3/.dist/core/v3/routing/budget-resilience/budget-resilience.test.js`));

function commercialFlowPath(): string {
  return "scripts/tutor-v3/.dist/tests/tutor-v3-convergence/commercial-flow.test.js";
}

const baselineLogFiles: Record<string, string> = {};
baselineRuns.forEach((result, index) => {
  baselineLogFiles[`command${index + 1}Stdout`] = writeLog(logRoot, `baseline-${index + 1}.stdout.log`, result.stdout, repoRoot);
  baselineLogFiles[`command${index + 1}Stderr`] = writeLog(logRoot, `baseline-${index + 1}.stderr.log`, result.stderr, repoRoot);
});
const baselineGreen = baselineRuns.every((result) => result.exitStatus === 0);
const baselineCommands = baselineRuns.map((result) => result.command);

const results: MutationResult[] = [];
const temporaryRoot = mkdtempSync(join(tmpdir(), "tutor-v3-real-mutation-"));
let campaignStoppedEarly = false;

try {
  if (baselineGreen) {
    for (const mutation of MUTATIONS) {
      const mutantRoot = resolve(temporaryRoot, mutation.mutationId.toLowerCase());
      const add = git(repoRoot, ["worktree", "add", "--detach", mutantRoot, BASELINE_SHA],
        `git worktree add --detach $MUTANT_ROOT ${BASELINE_SHA}`);
      if (add.exitStatus !== 0) throw new Error(`Unable to create mutant worktree: ${add.stderr}`);

      let result: MutationResult | null = null;
      try {
        const mutantSha = gitText(mutantRoot, ["rev-parse", "HEAD"]);
        const cleanBefore = gitText(mutantRoot, ["status", "--porcelain=v1"]) === "";
        if (mutantSha !== BASELINE_SHA || !cleanBefore) {
          throw new Error(`${mutation.mutationId}: disposable candidate custody failed`);
        }
        symlinkSync(resolve(repoRoot, "node_modules"), resolve(mutantRoot, "node_modules"), "dir");

        const applied = applyMutation(mutantRoot, mutation);
        for (const sourcePath of applied.sourcePaths) {
          if (applied.beforeGitBlobs[sourcePath] === null) {
            const intent = git(mutantRoot, ["add", "-N", "--", sourcePath]);
            if (intent.exitStatus !== 0) throw new Error(`${mutation.mutationId}: git intent-to-add failed`);
          }
        }
        const diffRun = git(mutantRoot, ["diff", "--no-ext-diff", "--binary", "--", ...applied.sourcePaths]);
        if (diffRun.exitStatus !== 0 || diffRun.stdout.trim().length === 0) {
          throw new Error(`${mutation.mutationId}: exact mutation diff is empty or unavailable`);
        }

        let compileCommand = "node $TSC -p scripts/tutor-v3/tsconfig.json";
        let compile = run(process.execPath, [compiler, "-p", "scripts/tutor-v3/tsconfig.json"],
          resolve(mutantRoot, "adaptive-tutor"), compileCommand, mutantRoot);
        if (compile.exitStatus === 0 && mutation.family === "COMPOSED_EVALUATION_EXECUTION") {
          const evalCompileCommand = "node $TSC -p evals/v3/tsconfig.json --noEmit false --rootDir . --outDir scripts/tutor-v3/.dist";
          const evalCompile = run(process.execPath, [
            compiler,
            "-p",
            "evals/v3/tsconfig.json",
            "--noEmit",
            "false",
            "--rootDir",
            ".",
            "--outDir",
            "scripts/tutor-v3/.dist",
          ], resolve(mutantRoot, "adaptive-tutor"), evalCompileCommand, mutantRoot);
          compileCommand = `${compileCommand} && ${evalCompileCommand}`;
          compile = {
            command: compileCommand,
            exitStatus: evalCompile.exitStatus,
            stdout: `${compile.stdout}${evalCompile.stdout}`,
            stderr: `${compile.stderr}${evalCompile.stderr}`,
            stdoutHash: sha256(`${compile.stdout}${evalCompile.stdout}`),
            stderrHash: sha256(`${compile.stderr}${evalCompile.stderr}`),
          };
        }
        const pattern = `^(?:${mutation.expectedFailingTests.map(regexEscape).join("|")})$`;
        const focusedCommand = `node --test --test-name-pattern ${JSON.stringify(pattern)} ${mutation.focusedTestFile}`;
        const focused = compile.exitStatus === 0
          ? run(process.execPath, ["--test", "--test-name-pattern", pattern, mutation.focusedTestFile],
              resolve(mutantRoot, "adaptive-tutor"), focusedCommand, mutantRoot)
          : run(process.execPath, ["-e", "process.exit(125)"], resolve(mutantRoot, "adaptive-tutor"),
              focusedCommand, mutantRoot);
        const gateCommand = "node scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js";
        const gate = compile.exitStatus === 0
          ? run(process.execPath, ["scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js"],
              resolve(mutantRoot, "adaptive-tutor"), gateCommand, mutantRoot)
          : run(process.execPath, ["-e", "process.exit(125)"], resolve(mutantRoot, "adaptive-tutor"),
              gateCommand, mutantRoot);

        const actualFailingTestNames = failedTestNames(`${focused.stdout}\n${focused.stderr}`);
        let gateFileValid = false;
        let actualFailedGates: Wave3HardGateFamily[] = [];
        const gateFilePath = resolve(mutantRoot, "adaptive-tutor/tutor-v2-wave3-release/HARD-GATE-RESULT.json");
        if (compile.exitStatus === 0 && existsSync(gateFilePath)) {
          try {
            const parsed = JSON.parse(readFileSync(gateFilePath, "utf8")) as HardGateFile;
            actualFailedGates = parsed.hardGateFamilies
              .filter((family) => family.status === "FAIL")
              .map((family) => family.name);
            gateFileValid = parsed.hardGateFamilies.length === 18;
          } catch {
            gateFileValid = false;
          }
        }

        const expectedTestFailed = mutation.expectedFailingTests.some((expected) =>
          actualFailingTestNames.includes(expected));
        const expectedGateFailed = actualFailedGates.includes(mutation.expectedFailedGate);
        let classification: MutationResult["classification"];
        if (compile.exitStatus !== 0 || !gateFileValid) {
          classification = "INVALID_MUTANT";
        } else if (expectedTestFailed || expectedGateFailed) {
          classification = "KILLED";
        } else if (focused.exitStatus === 0 && gate.exitStatus === 0) {
          classification = "SURVIVED";
        } else {
          classification = "INVALID_MUTANT";
        }

        const mutationLogRoot = logRoot;
        const prefix = mutation.mutationId.toLowerCase();
        const logFiles = {
          compileStdout: writeLog(mutationLogRoot, `${prefix}-compile.stdout.log`, compile.stdout, repoRoot),
          compileStderr: writeLog(mutationLogRoot, `${prefix}-compile.stderr.log`, compile.stderr, repoRoot),
          focusedStdout: writeLog(mutationLogRoot, `${prefix}-focused.stdout.log`, focused.stdout, repoRoot),
          focusedStderr: writeLog(mutationLogRoot, `${prefix}-focused.stderr.log`, focused.stderr, repoRoot),
          gateStdout: writeLog(mutationLogRoot, `${prefix}-gate.stdout.log`, gate.stdout, repoRoot),
          gateStderr: writeLog(mutationLogRoot, `${prefix}-gate.stderr.log`, gate.stderr, repoRoot),
        };

        result = {
          candidateSha: mutantSha,
          runnerRevision,
          family: mutation.family,
          mutationId: mutation.mutationId,
          description: mutation.description,
          method: mutation.method,
          sourcePaths: applied.sourcePaths,
          beforeGitBlobs: applied.beforeGitBlobs,
          afterSha256: applied.afterSha256,
          exactUnifiedDiff: diffRun.stdout,
          baselineCommands,
          mutationCommands: [
            `git worktree add --detach $MUTANT_ROOT ${BASELINE_SHA}`,
            `${mutation.method} ${mutation.mutationId}`,
          ],
          compileCommand,
          compileExitStatus: compile.exitStatus,
          focusedTestCommand: focusedCommand,
          focusedTestExitStatus: focused.exitStatus,
          aggregateGateCommand: gateCommand,
          gateExitStatus: gate.exitStatus,
          expectedFailingTestNames: mutation.expectedFailingTests,
          actualFailingTestNames,
          expectedFailedGate: mutation.expectedFailedGate,
          actualFailedGates,
          stdoutHash: sha256(`${compile.stdout}\n${focused.stdout}\n${gate.stdout}`),
          stderrHash: sha256(`${compile.stderr}\n${focused.stderr}\n${gate.stderr}`),
          logFiles,
          classification,
          cleanupProof: {
            worktreeRemoved: false,
            worktreePruned: false,
            canonicalProductionDiffClean: false,
          },
        };
      } finally {
        const remove = git(repoRoot, ["worktree", "remove", "--force", mutantRoot],
          "git worktree remove --force $MUTANT_ROOT");
        const prune = git(repoRoot, ["worktree", "prune"]);
        if (result) {
          result.cleanupProof = {
            worktreeRemoved: remove.exitStatus === 0 && !existsSync(mutantRoot),
            worktreePruned: prune.exitStatus === 0 &&
              !gitText(repoRoot, ["worktree", "list", "--porcelain"]).includes(mutantRoot),
            canonicalProductionDiffClean: canonicalProductionDiffClean(repoRoot),
          };
          if (!Object.values(result.cleanupProof).every(Boolean)) {
            result.classification = "INVALID_MUTANT";
          }
          results.push(result);
        }
      }

      const latest = results.at(-1);
      if (!latest || latest.classification !== "KILLED") {
        campaignStoppedEarly = true;
        break;
      }
      process.stdout.write(`KILLED ${mutation.mutationId} ${results.length}/18\n`);
    }
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
  git(repoRoot, ["worktree", "prune"]);
}

const killed = results.filter((result) => result.classification === "KILLED").length;
const survived = results.filter((result) => result.classification === "SURVIVED").length;
const invalidMutants = results.filter((result) => result.classification === "INVALID_MUTANT").length;
const baselineBlocked = baselineGreen ? 0 : 1;
const qualifyingMutationCount = results.filter((result) => result.classification !== "INVALID_MUTANT").length;
const compileValidMutationCount = results.filter((result) => result.compileExitStatus === 0).length;
const aggregateStatus = baselineGreen && results.length === 18 && killed === 18 && survived === 0 &&
  invalidMutants === 0 && !campaignStoppedEarly ? "PASS" : "FAIL";

const output = {
  mutationEvidenceVersion: 2,
  mutationKind: "implementation",
  booleanEvidenceFlipOnly: false,
  session: SESSION,
  baselineSha: BASELINE_SHA,
  failedW313AncestorSha: FAILED_W3_13_SHA,
  b2SiblingDependencySha: B2_SIBLING_SHA,
  candidateSha,
  writerSha,
  runnerRevision,
  baseline: {
    status: baselineGreen ? "PASS" : "BASELINE_BLOCKED",
    commands: baselineRuns.map((result) => ({
      command: result.command,
      exitStatus: result.exitStatus,
      stdoutHash: result.stdoutHash,
      stderrHash: result.stderrHash,
    })),
    logFiles: baselineLogFiles,
    probes: {
      foreignCurriculumDigest: baselineRuns[3]?.exitStatus === 0,
      topLevelSubjectMismatch: baselineRuns[4]?.exitStatus === 0,
      perPhysicalAttemptCost:
        baselineRuns[5]?.exitStatus === 0 && baselineRuns[7]?.exitStatus === 0,
      trustedDeadline: baselineRuns[6]?.exitStatus === 0,
    },
  },
  disposableWorktreesOnly: true,
  permanentTestsChanged: false,
  mutationCount: 18,
  executedMutationCount: results.length,
  qualifyingMutationCount,
  compileValidMutationCount,
  killed,
  survived,
  invalidMutants,
  baselineBlocked,
  exactKilledRatio: `${killed}/18`,
  aggregateStatus,
  cleanupComplete: results.every((result) => Object.values(result.cleanupProof).every(Boolean)),
  results,
};

const serialized = `${JSON.stringify(canonicalize(output), null, 2)}\n`;
writeFileSync(evidencePath, serialized);
writeFileSync(resolve(documentationRoot, "CAMPAIGN-EVIDENCE.json"), serialized);
process.stdout.write(`${aggregateStatus} wave3-real-implementation-mutation-proof ${killed}/18 killed\n`);
if (aggregateStatus !== "PASS") process.exitCode = 1;

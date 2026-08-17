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
import { dirname, join, resolve } from "node:path";
import {
  detectorFor,
  executeDetector,
  validateDetectorCatalog,
  type DetectorExecutionResult,
} from "./executable-detectors.js";
import {
  WAVE4_HARD_GATE_FAMILIES,
  type Wave4HardGateFamily,
} from "./evidence.js";
import {
  WAVE4_IMPLEMENTATION_MUTATIONS,
  type Wave4MutationDefinition,
} from "./mutations/catalog.js";

type Classification =
  | "KILLED"
  | "SURVIVED"
  | "INVALID_MUTANT"
  | "BASELINE_BLOCKED"
  | "EXTERNAL_BASELINE_BLOCKED";

interface MutationResult {
  readonly mutationId: string;
  readonly family: Wave4HardGateFamily;
  readonly description: string;
  readonly semanticShape: string;
  readonly mutationKind: "implementation";
  readonly sourcePaths: readonly string[];
  readonly beforeSha256: Readonly<Record<string, string>>;
  readonly afterSha256: Readonly<Record<string, string>>;
  readonly exactSourceDiff: string;
  readonly diffReference: string;
  readonly detectorId: string;
  readonly baselineDetectorOutcome: DetectorExecutionResult;
  readonly detectorOutcome: DetectorExecutionResult | null;
  readonly compileCommand: readonly string[];
  readonly compileExitCode: number;
  readonly rewriteApplied: boolean;
  readonly classification: Classification;
  readonly compilerFailureUsedAsDetection: false;
  readonly cleanup: {
    readonly worktreeRemoved: boolean;
    readonly worktreePruned: boolean;
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function run(executable: string, args: readonly string[], cwd: string): {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
} {
  const result = spawnSync(executable, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  return {
    status: result.status ?? 127,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `${result.error.message}\n` : ""}`,
  };
}

function git(repoRoot: string, args: readonly string[]) {
  return run("git", args, repoRoot);
}

function gitText(repoRoot: string, args: readonly string[]): string {
  const result = git(repoRoot, args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function occurrenceCount(source: string, target: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = source.indexOf(target, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + target.length;
  }
}

function applyMutation(
  mutantRoot: string,
  mutation: Wave4MutationDefinition,
): {
  readonly sourcePaths: readonly string[];
  readonly beforeSha256: Readonly<Record<string, string>>;
  readonly afterSha256: Readonly<Record<string, string>>;
} {
  const sourcePaths = [...new Set(mutation.rewrites.map((rewrite) => rewrite.sourcePath))];
  const beforeSha256: Record<string, string> = {};
  const afterSha256: Record<string, string> = {};
  for (const sourcePath of sourcePaths) {
    beforeSha256[sourcePath] = sha256(readFileSync(resolve(mutantRoot, sourcePath)));
  }
  for (const rewrite of mutation.rewrites) {
    const path = resolve(mutantRoot, rewrite.sourcePath);
    const source = readFileSync(path, "utf8");
    const matches = occurrenceCount(source, rewrite.before);
    if (matches !== 1) {
      throw new Error(`${mutation.mutationId}: expected one rewrite anchor in ${rewrite.sourcePath}, found ${matches}`);
    }
    const mutated = source.replace(rewrite.before, rewrite.after);
    writeFileSync(path, mutated);
  }
  for (const sourcePath of sourcePaths) {
    afterSha256[sourcePath] = sha256(readFileSync(resolve(mutantRoot, sourcePath)));
  }
  return { sourcePaths, beforeSha256, afterSha256 };
}

function validateCatalog(): void {
  if (WAVE4_IMPLEMENTATION_MUTATIONS.length !== 13) {
    throw new Error(`Expected 13 implementation mutations, found ${WAVE4_IMPLEMENTATION_MUTATIONS.length}`);
  }
  const families = WAVE4_IMPLEMENTATION_MUTATIONS.map((mutation) => mutation.family);
  if (new Set(families).size !== 13) throw new Error("Mutation families are not unique");
  if (WAVE4_HARD_GATE_FAMILIES.some((family) => !families.includes(family))) {
    throw new Error("Mutation catalog does not cover every Wave 4 family");
  }
}

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
const repoRoot = resolve(tutorRoot, "..");
const candidateSha = gitText(repoRoot, ["rev-parse", "HEAD"]);
const dependencyRoot = resolve(tutorRoot, "node_modules");
const outputPath = resolve(tutorRoot, "tutor-v2-wave4-release/NEGATIVE-CONTROL-EVIDENCE.json");
const documentationPath = resolve(
  repoRoot,
  "docs/study-tutor-v2/wave4/repairs/w4-r6-gate-integrity/CAMPAIGN-EVIDENCE.json",
);

validateCatalog();
validateDetectorCatalog();
if (!existsSync(resolve(dependencyRoot, "typescript/bin/tsc"))) {
  throw new Error(`Canonical TypeScript dependency is unavailable: ${dependencyRoot}`);
}

const baselineByFamily = new Map<Wave4HardGateFamily, DetectorExecutionResult>();
for (const family of WAVE4_HARD_GATE_FAMILIES) {
  baselineByFamily.set(family, executeDetector(detectorFor(family), tutorRoot));
}

const temporaryRoot = mkdtempSync(join(tmpdir(), "tutor-v4-implementation-mutations-"));
const results: MutationResult[] = [];
try {
  for (const mutation of WAVE4_IMPLEMENTATION_MUTATIONS) {
    const detector = detectorFor(mutation.family);
    const baselineDetectorOutcome = baselineByFamily.get(mutation.family);
    if (baselineDetectorOutcome === undefined) throw new Error(`Missing baseline: ${mutation.family}`);
    const mutantRoot = resolve(temporaryRoot, mutation.mutationId.toLowerCase());
    const add = git(repoRoot, ["worktree", "add", "--detach", mutantRoot, candidateSha]);
    if (add.status !== 0) throw new Error(`Unable to create ${mutation.mutationId}: ${add.stderr}`);

    let result: MutationResult | null = null;
    try {
      if (gitText(mutantRoot, ["status", "--porcelain=v1"]) !== "") {
        throw new Error(`${mutation.mutationId}: new disposable worktree is not clean`);
      }
      symlinkSync(dependencyRoot, resolve(mutantRoot, "adaptive-tutor/node_modules"), "dir");
      let rewriteApplied = false;
      let sourcePaths: readonly string[] = mutation.rewrites.map((rewrite) => rewrite.sourcePath);
      let beforeSha256: Readonly<Record<string, string>> = {};
      let afterSha256: Readonly<Record<string, string>> = {};
      let exactSourceDiff = "";
      let compileExitCode = 125;
      let detectorOutcome: DetectorExecutionResult | null = null;
      let classification: Classification = "INVALID_MUTANT";
      const compileCommand = [
        "node node_modules/typescript/bin/tsc -p scripts/tutor-v4/tsconfig.json",
        ...(mutation.javascriptSyntaxChecks ?? []).map((path) => `node --check ${path}`),
      ];

      try {
        const applied = applyMutation(mutantRoot, mutation);
        sourcePaths = applied.sourcePaths;
        beforeSha256 = applied.beforeSha256;
        afterSha256 = applied.afterSha256;
        rewriteApplied = true;
        const diff = git(mutantRoot, ["diff", "--no-ext-diff", "--binary", "--", ...sourcePaths]);
        if (diff.status !== 0 || diff.stdout.trim().length === 0) {
          throw new Error(`${mutation.mutationId}: exact source diff is empty`);
        }
        exactSourceDiff = diff.stdout;

        const mutantTutorRoot = resolve(mutantRoot, "adaptive-tutor");
        const compile = run(
          process.execPath,
          ["node_modules/typescript/bin/tsc", "-p", "scripts/tutor-v4/tsconfig.json"],
          mutantTutorRoot,
        );
        compileExitCode = compile.status;
        if (compileExitCode === 0) {
          for (const syntaxPath of mutation.javascriptSyntaxChecks ?? []) {
            const syntax = run(process.execPath, ["--check", resolve(mutantRoot, syntaxPath)], mutantTutorRoot);
            if (syntax.status !== 0) {
              compileExitCode = syntax.status;
              break;
            }
          }
        }
        if (compileExitCode !== 0) {
          classification = "INVALID_MUTANT";
        } else {
          detectorOutcome = executeDetector(detector, mutantTutorRoot);
          if (baselineDetectorOutcome.status !== "PASS") {
            classification = detector.externalBaselineOwner === undefined
              ? "BASELINE_BLOCKED"
              : "EXTERNAL_BASELINE_BLOCKED";
          } else if (detectorOutcome.status === "FAIL") {
            classification = "KILLED";
          } else if (detectorOutcome.status === "PASS") {
            classification = "SURVIVED";
          } else {
            classification = "INVALID_MUTANT";
          }
        }
      } catch {
        classification = "INVALID_MUTANT";
      }

      result = {
        mutationId: mutation.mutationId,
        family: mutation.family,
        description: mutation.description,
        semanticShape: mutation.semanticShape,
        mutationKind: "implementation",
        sourcePaths,
        beforeSha256,
        afterSha256,
        exactSourceDiff,
        diffReference: `docs/study-tutor-v2/wave4/repairs/w4-r6-gate-integrity/CAMPAIGN-EVIDENCE.json#${mutation.mutationId}`,
        detectorId: detector.detectorId,
        baselineDetectorOutcome,
        detectorOutcome,
        compileCommand,
        compileExitCode,
        rewriteApplied,
        classification,
        compilerFailureUsedAsDetection: false,
        cleanup: { worktreeRemoved: false, worktreePruned: false },
      };
    } finally {
      const remove = git(repoRoot, ["worktree", "remove", "--force", mutantRoot]);
      const prune = git(repoRoot, ["worktree", "prune"]);
      if (result !== null) {
        result = {
          ...result,
          cleanup: {
            worktreeRemoved: remove.status === 0 && !existsSync(mutantRoot),
            worktreePruned: prune.status === 0
              && !gitText(repoRoot, ["worktree", "list", "--porcelain"]).includes(mutantRoot),
          },
        };
      }
    }
    if (result === null) throw new Error(`${mutation.mutationId}: result was not recorded`);
    results.push(result);
  }
} finally {
  git(repoRoot, ["worktree", "prune"]);
  rmSync(temporaryRoot, { recursive: true, force: true });
}

const qualifying = results.filter((result) => result.classification !== "INVALID_MUTANT").length;
const compileValid = results.filter((result) => result.compileExitCode === 0).length;
const killed = results.filter((result) => result.classification === "KILLED").length;
const survived = results.filter((result) => result.classification === "SURVIVED").length;
const invalid = results.filter((result) => result.classification === "INVALID_MUTANT").length;
const baselineBlocked = results.filter((result) =>
  result.classification === "BASELINE_BLOCKED"
  || result.classification === "EXTERNAL_BASELINE_BLOCKED"
).length;
const cleanupComplete = results.every((result) =>
  result.cleanup.worktreeRemoved && result.cleanup.worktreePruned
);
const aggregateStatus = killed === 13 && survived === 0 && invalid === 0
  && baselineBlocked === 0 && cleanupComplete
  ? "PASS"
  : invalid > 0 || !cleanupComplete
    ? "FAIL"
    : "EXTERNAL_BASELINE_BLOCKED";
const output = {
  evidenceVersion: 2,
  session: "STUDY-TUTOR-V2-W4-R6",
  candidateSha,
  aggregateStatus,
  mutationKind: "implementation",
  booleanEvidenceFlipOnly: false,
  permanentDetectorAssertionsChanged: false,
  resultJsonMutationUsed: false,
  expectedOutputMutationUsed: false,
  releaseArtifactMutationUsed: false,
  compilerFailureAloneCountsAsDetection: false,
  serialExecution: true,
  disposableDetachedWorktreesOnly: true,
  requiredControlCount: 13,
  controlCount: results.length,
  qualifying,
  compileValid,
  killed,
  survived,
  invalid,
  baselineBlocked,
  cleanupComplete,
  results,
};
const serialized = `${JSON.stringify(canonicalize(output), null, 2)}\n`;
mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(documentationPath), { recursive: true });
writeFileSync(outputPath, serialized);
writeFileSync(documentationPath, serialized);
process.stdout.write(`${aggregateStatus} wave4-implementation-mutations ${killed}/13 killed; ${baselineBlocked} baseline-blocked\n`);
if (aggregateStatus !== "PASS") process.exitCode = 1;

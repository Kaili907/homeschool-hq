import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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
import {
  classifyMutation,
  type MutationClassification,
} from "./mutation-classification.js";

interface CompileCoverageProof {
  readonly sourcePath: string;
  readonly validationKind: "TYPESCRIPT_PROJECT_MEMBERSHIP" | "JAVASCRIPT_MODULE_SYNTAX";
  readonly sourceIncluded: boolean;
  readonly membershipEvidence: string;
}

interface MutationResult {
  readonly mutationId: string;
  readonly family: Wave4HardGateFamily;
  readonly description: string;
  readonly semanticShape: string;
  readonly mutationKind: "implementation";
  readonly evidenceExecutionSha: string;
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
  readonly compileOutputSha256: string;
  readonly compileCoverageProof: readonly CompileCoverageProof[];
  readonly allMutatedSourcesCompiled: boolean;
  readonly rewriteApplied: boolean;
  readonly classification: MutationClassification;
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

function compileMutation(
  mutantRoot: string,
  mutation: Wave4MutationDefinition,
  sourcePaths: readonly string[],
): {
  readonly command: readonly string[];
  readonly exitCode: number;
  readonly output: string;
  readonly coverageProof: readonly CompileCoverageProof[];
} {
  const mutantTutorRoot = resolve(mutantRoot, "adaptive-tutor");
  const compileDefinition = mutation.compile;
  if (compileDefinition.kind === "javascript-module") {
    const source = resolve(mutantRoot, compileDefinition.sourcePath);
    const result = run(process.execPath, ["--check", source], mutantTutorRoot);
    return {
      command: [`node --check ${compileDefinition.sourcePath}`],
      exitCode: result.status,
      output: `${result.stdout}${result.stderr}`,
      coverageProof: sourcePaths.map((sourcePath) => ({
        sourcePath,
        validationKind: "JAVASCRIPT_MODULE_SYNTAX",
        sourceIncluded: sourcePath === compileDefinition.sourcePath,
        membershipEvidence: sourcePath === compileDefinition.sourcePath
          ? `direct node --check target: ${sourcePath}`
          : "source was not the direct node --check target",
      })),
    };
  }

  const args = [
    "node_modules/typescript/bin/tsc",
    "-p",
    compileDefinition.projectPath,
    "--listFiles",
    "--pretty",
    "false",
  ];
  const result = run(process.execPath, args, mutantTutorRoot);
  const listedFiles = new Set(result.stdout.split(/\r?\n/u)
    .filter((line) => line.startsWith("/"))
    .map((line) => realpathSync(line)));
  return {
    command: [`node ${args.join(" ")}`],
    exitCode: result.status,
    output: `${result.stdout}${result.stderr}`,
    coverageProof: sourcePaths.map((sourcePath) => {
      const absoluteSourcePath = realpathSync(resolve(mutantRoot, sourcePath));
      const sourceIncluded = listedFiles.has(absoluteSourcePath);
      return {
        sourcePath,
        validationKind: "TYPESCRIPT_PROJECT_MEMBERSHIP",
        sourceIncluded,
        membershipEvidence: sourceIncluded
          ? `${compileDefinition.projectPath} --listFiles included ${sourcePath}`
          : `${compileDefinition.projectPath} --listFiles omitted ${sourcePath}`,
      };
    }),
  };
}

const tutorRoot = process.cwd().endsWith("adaptive-tutor")
  ? process.cwd()
  : resolve("adaptive-tutor");
const repoRoot = resolve(tutorRoot, "..");
const evidenceExecutionSha = gitText(repoRoot, ["rev-parse", "HEAD"]);
const dependencyRoot = resolve(tutorRoot, "node_modules");
const outputPath = resolve(tutorRoot, "tutor-v2-wave4-release/NEGATIVE-CONTROL-EVIDENCE.json");
const documentationPath = resolve(
  repoRoot,
  "docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/CAMPAIGN-EVIDENCE.json",
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
    const add = git(repoRoot, ["worktree", "add", "--detach", mutantRoot, evidenceExecutionSha]);
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
      let compileOutputSha256 = sha256("");
      let compileCoverageProof: readonly CompileCoverageProof[] = [];
      let allMutatedSourcesCompiled = false;
      let detectorOutcome: DetectorExecutionResult | null = null;
      let classification: MutationClassification = "INVALID_MUTANT";
      let compileCommand: readonly string[] = [];

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

        const compile = compileMutation(mutantRoot, mutation, sourcePaths);
        compileCommand = compile.command;
        compileExitCode = compile.exitCode;
        compileOutputSha256 = sha256(compile.output
          .replaceAll(realpathSync(mutantRoot), "$MUTANT_ROOT")
          .replaceAll(mutantRoot, "$MUTANT_ROOT")
          .replaceAll(realpathSync(dependencyRoot), "$DEPENDENCY_ROOT")
          .replaceAll(dependencyRoot, "$DEPENDENCY_ROOT"));
        compileCoverageProof = compile.coverageProof;
        allMutatedSourcesCompiled = compileCoverageProof.length === sourcePaths.length
          && compileCoverageProof.every((proof) => proof.sourceIncluded);
        if (compileExitCode === 0 && allMutatedSourcesCompiled) {
          const mutantTutorRoot = resolve(mutantRoot, "adaptive-tutor");
          detectorOutcome = executeDetector(detector, mutantTutorRoot);
        }
        classification = classifyMutation({
          rewriteApplied,
          nonEmptySourceDiff: exactSourceDiff.trim().length > 0,
          compileExitCode,
          allMutatedSourcesCompiled,
          baselineDetectorOutcome,
          detectorOutcome,
          externalBaseline: detector.externalBaselineOwner !== undefined,
        });
      } catch {
        classification = "INVALID_MUTANT";
      }

      result = {
        mutationId: mutation.mutationId,
        family: mutation.family,
        description: mutation.description,
        semanticShape: mutation.semanticShape,
        mutationKind: "implementation",
        evidenceExecutionSha,
        sourcePaths,
        beforeSha256,
        afterSha256,
        exactSourceDiff,
        diffReference: `docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/CAMPAIGN-EVIDENCE.json#${mutation.mutationId}`,
        detectorId: detector.detectorId,
        baselineDetectorOutcome,
        detectorOutcome,
        compileCommand,
        compileExitCode,
        compileOutputSha256,
        compileCoverageProof,
        allMutatedSourcesCompiled,
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

const qualifying = results.filter((result) =>
  result.rewriteApplied
  && result.exactSourceDiff.trim().length > 0
  && result.compileExitCode === 0
  && result.allMutatedSourcesCompiled
).length;
const compileValid = results.filter((result) => result.compileExitCode === 0).length;
const killed = results.filter((result) => result.classification === "KILLED").length;
const survived = results.filter((result) => result.classification === "SURVIVED").length;
const invalid = results.filter((result) => result.classification === "INVALID_MUTANT").length;
const validationInconclusive = results.filter((result) =>
  result.classification === "VALIDATION_INCONCLUSIVE"
).length;
const baselineBlocked = results.filter((result) =>
  result.classification === "BASELINE_BLOCKED"
  || result.classification === "EXTERNAL_BASELINE_BLOCKED"
).length;
const cleanupComplete = results.every((result) =>
  result.cleanup.worktreeRemoved && result.cleanup.worktreePruned
);
const aggregateStatus = killed === 13 && survived === 0 && invalid === 0
  && validationInconclusive === 0
  && baselineBlocked === 0 && cleanupComplete
  ? "PASS"
  : invalid > 0 || !cleanupComplete
    ? "FAIL"
    : validationInconclusive > 0
      ? "VALIDATION_INCONCLUSIVE"
      : baselineBlocked > 0
        ? "EXTERNAL_BASELINE_BLOCKED"
        : "FAIL";
const output = {
  evidenceVersion: 3,
  frameworkVersion: 3,
  session: "STUDY-TUTOR-V2-W4-R9",
  frameworkSourceSession: "STUDY-TUTOR-V2-W4-R9",
  evidenceExecutionSha,
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
  validationInconclusive,
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

import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tutorRoot = resolve(here, "../../..");
const require = createRequire(resolve(tutorRoot, "package.json"));
const tsc = resolve(dirname(require.resolve("typescript/package.json")), "bin", "tsc");
const disposableRoot = mkdtempSync(join(tmpdir(), "w4-answer-extraction-"));
const baselineRoot = join(disposableRoot, "baseline");
const testPath = "adversarial/v4/answer-extraction/certification.test.js";
const implementationPath = "core/v2/policy/anti-answer/index.js";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: tutorRoot,
    encoding: "utf8",
    ...options,
  });
}

function fail(message, result) {
  process.stderr.write(`${message}\n`);
  if (result?.stdout) process.stderr.write(result.stdout);
  if (result?.stderr) process.stderr.write(result.stderr);
  process.exitCode = 1;
}

function replaceExactly(source, before, after, mutationId) {
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${mutationId}: expected one mutation target`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

const mutations = [
  {
    id: "disable-active-phase-protection",
    before: 'return phase === "active-graded-or-mastery-check";',
    after: "return false;",
  },
  {
    id: "remove-ask-check-from-structural-set",
    before: '    "ask-check",\n',
    after: "",
  },
  {
    id: "let-review-permission-bypass-active-protection",
    before: "if (phaseRequiresAnswerProtection(instructionContext.assessmentPhase)) {",
    after: "if (phaseRequiresAnswerProtection(instructionContext.assessmentPhase) && assessmentPolicy?.completedAssessmentReviewAllowed !== true) {",
  },
  {
    id: "authorize-completed-review-without-study-permission",
    before: 'instructionContext.assessmentPhase === "completed-assessment-review" &&\n        assessmentPolicy?.completedAssessmentReviewAllowed !== true',
    after: 'instructionContext.assessmentPhase === "completed-assessment-review" &&\n        false',
  },
];

try {
  const compile = run(process.execPath, [
    tsc,
    "-p",
    resolve(here, "tsconfig.json"),
    "--outDir",
    baselineRoot,
  ]);
  if (compile.status !== 0) {
    fail("W4-02 certification compile failed", compile);
  } else {
    const baseline = run(process.execPath, [join(baselineRoot, testPath)]);
    if (baseline.status !== 0) {
      fail("W4-02 baseline certification failed", baseline);
    } else {
      const passed = /^# pass (\d+)$/m.exec(baseline.stdout)?.[1] ?? "unknown";
      const tested = /^# tests (\d+)$/m.exec(baseline.stdout)?.[1] ?? "unknown";
      process.stdout.write(`BASELINE_PASS ${passed}/${tested}\n`);
      for (const mutation of mutations) {
        const mutantRoot = join(disposableRoot, mutation.id);
        cpSync(baselineRoot, mutantRoot, { recursive: true });
        const target = join(mutantRoot, implementationPath);
        const source = readFileSync(target, "utf8");
        writeFileSync(
          target,
          replaceExactly(source, mutation.before, mutation.after, mutation.id),
        );
        const result = run(process.execPath, [join(mutantRoot, testPath)]);
        if (result.status === 0) {
          fail(`W4-02 mutation survived undetected: ${mutation.id}`, result);
          break;
        }
        process.stdout.write(`MUTATION_DETECTED ${mutation.id}\n`);
      }
    }
  }
} catch (error) {
  fail(`W4-02 certification runner error: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  rmSync(disposableRoot, { recursive: true, force: true });
}

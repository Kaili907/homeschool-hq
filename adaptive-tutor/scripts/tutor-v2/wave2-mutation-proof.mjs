import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tutorRoot = resolve(import.meta.dirname, "../..");
const compiledRoot = resolve(tutorRoot, "scripts/tutor-v2/.dist");

const mutations = [
  {
    name: "study-safety-hold-allows-adaptive-hint",
    file: "study-engine/tutor-v2/adaptive/orchestrator.js",
    search: 'if (request.studyAuthority.safetyStatus === "academic-flow-held") {\n        return safetyHeld(request, "study-safety-held");',
    replacement: 'if (false && request.studyAuthority.safetyStatus === "academic-flow-held") {\n        return safetyHeld(request, "study-safety-held");',
    test: "tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js",
  },
  {
    name: "study-allowed-actions-ignored-for-hint",
    file: "study-engine/tutor-v2/adaptive/orchestrator.js",
    search: 'if (request.studyAuthority.allowedActions.includes("hint")) {',
    replacement: "if (true) {",
    test: "tests/tutor-v2-convergence/global-adaptive-allowed-actions.test.js",
  },
  {
    name: "invalid-input-selects-attacker-fallback-ref",
    file: "study-engine/tutor-v2/adaptive/orchestrator.js",
    search: 'const INVALID_FALLBACK_REF = "fallback:reviewed-static-wave2";',
    replacement: 'const INVALID_FALLBACK_REF = "fallback:provider-selected";',
    test: "tests/tutor-v2-convergence/trusted-invalid-request-fallback.test.js",
  },
  {
    name: "history-scope-check-bypassed-before-adaptive-execution",
    file: "study-engine/tutor-v2/adaptive/orchestrator.js",
    search: "function compositionBindingsAreValid(request) {\n    const authority",
    replacement: "function compositionBindingsAreValid(request) {\n    return true;\n    const authority",
    test: "tests/tutor-v2-convergence/adaptive-history-scope-provenance.test.js",
  },
  {
    name: "assisted-current-opportunity-treated-as-independent",
    file: "study-engine/tutor-v2/adaptive/orchestrator.js",
    search: "function effectiveCurrentOpportunityAssistance(request, currentHintLevel) {\n    const opportunityRef",
    replacement: 'function effectiveCurrentOpportunityAssistance(request, currentHintLevel) {\n    return "independent";\n    const opportunityRef',
    test: "tests/tutor-v2-convergence/assistance-mastery-opportunity-binding.test.js",
  },
];

let root;
let failed = false;
try {
  root = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-r2-mutations-"));
  for (const mutation of mutations) {
    const mutationRoot = join(root, mutation.name);
    await cp(compiledRoot, mutationRoot, { recursive: true });
    const file = join(mutationRoot, mutation.file);
    const source = await readFile(file, "utf8");
    if (!source.includes(mutation.search)) {
      process.stderr.write(`FAIL ${mutation.name}: mutation anchor missing\n`);
      failed = true;
      continue;
    }
    await writeFile(file, source.replace(mutation.search, mutation.replacement), "utf8");
    const result = spawnSync(process.execPath, ["--test", join(mutationRoot, mutation.test)], {
      cwd: tutorRoot,
      encoding: "utf8",
      shell: false,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.status === 0) {
      process.stderr.write(`FAIL ${mutation.name}: permanent hard gate survived its defect\n`);
      failed = true;
    } else {
      process.stdout.write(`PASS ${mutation.name}: mutation killed\n`);
    }
  }
} finally {
  if (root !== undefined) await rm(root, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
else process.stdout.write(`PASS wave2-r2-mutation-proof ${mutations.length}/${mutations.length} killed\n`);

import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const tutorRoot = resolve(import.meta.dirname, "../..");
const compiledRoot = resolve(tutorRoot, "scripts/tutor-v2/.dist");

const mutations = [
  {
    name: "study-safety-hold-allows-adaptive-hint",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: 'if (request.studyAuthority.safetyStatus === "academic-flow-held") {\n        return commitReplayProtectedDecision(request, dependencies, safetyHeld(request, "study-safety-held"));',
      replacement: 'if (false && request.studyAuthority.safetyStatus === "academic-flow-held") {\n        return commitReplayProtectedDecision(request, dependencies, safetyHeld(request, "study-safety-held"));',
    }],
    test: "tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js",
  },
  {
    name: "study-allowed-actions-ignored-for-hint",
    edits: [{
      file: "core/v2/interventions/intervention-ladder.js",
      search: "if (input.allowedActions.includes(actionKindForState(candidate.state))) {",
      replacement: "if (true) {",
    }],
    test: "tests/tutor-v2-convergence/global-adaptive-allowed-actions.test.js",
  },
  {
    name: "invalid-input-selects-attacker-fallback-ref",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: 'const INVALID_FALLBACK_REF = "fallback:reviewed-static-wave2";',
      replacement: 'const INVALID_FALLBACK_REF = "fallback:provider-selected";',
    }],
    test: "tests/tutor-v2-convergence/trusted-invalid-request-fallback.test.js",
  },
  {
    name: "history-scope-check-bypassed-before-adaptive-execution",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: "function compositionBindingsAreValid(request) {\n    const authority",
      replacement: "function compositionBindingsAreValid(request) {\n    return true;\n    const authority",
    }],
    test: "tests/tutor-v2-convergence/adaptive-history-scope-provenance.test.js",
  },
  {
    name: "assisted-current-opportunity-treated-as-independent",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: "function effectiveCurrentOpportunityAssistance(request, currentHintLevel) {\n    const opportunityRef",
      replacement: 'function effectiveCurrentOpportunityAssistance(request, currentHintLevel) {\n    return "independent";\n    const opportunityRef',
    }],
    test: "tests/tutor-v2-convergence/assistance-mastery-opportunity-binding.test.js",
  },
  {
    name: "subsystem-exception-escapes-composer",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: 'catch {\n        return fallback(request, "concept-graph-unavailable", "concept-prerequisite-graph");\n    }',
      replacement: 'catch {\n        throw new Error("escaped subsystem exception");\n    }',
    }],
    test: "study-engine/tutor-v2/adaptive/subsystem-fallback.test.js",
  },
  {
    name: "replay-claimed-before-successful-computation",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: "const subsystems = dependencies.adaptiveSubsystems ?? DEFAULT_ADAPTIVE_SUBSYSTEMS;",
      replacement: "await dependencies.replayLedger.claim(request.studyAuthority.eventRef, requestDigest(request));\n    const subsystems = dependencies.adaptiveSubsystems ?? DEFAULT_ADAPTIVE_SUBSYSTEMS;",
    }],
    test: "study-engine/tutor-v2/adaptive/composition-repair.test.js",
  },
  {
    name: "malformed-subsystem-result-accepted",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: "function validateSubsystemResult(schema, value) {\n    try {",
      replacement: 'function validateSubsystemResult(schema, value) {\n    return { status: "accepted", value };\n    try {',
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "simultaneous-hint-repair-reteach",
    edits: [
      {
        file: "study-engine/tutor-v2/adaptive/orchestrator.js",
        search: 'if (interventionAction === "hint") {\n        try {',
        replacement: "if (true) {\n        try {",
      },
      {
        file: "study-engine/tutor-v2/adaptive/orchestrator.js",
        search: 'let repairProjection;\n    if (interventionAction === "check-prerequisite") {',
        replacement: "let repairProjection;\n    if (true) {",
      },
      {
        file: "study-engine/tutor-v2/adaptive/orchestrator.js",
        search: 'let reteachProjection;\n    if (interventionAction === "reteach") {',
        replacement: "let reteachProjection;\n    if (true) {",
      },
    ],
    test: "study-engine/tutor-v2/adaptive/composition-repair.test.js",
  },
  {
    name: "graph-edge-treated-as-deficiency-evidence",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: 'const trustedPrerequisiteRefs = misconception.status === "possible-misconception"\n        ? misconception.prerequisiteConceptRefs.filter((conceptRef) => scopedPrerequisiteRefs.includes(conceptRef) && routeIsCompatible(conceptRef))\n        : [];',
      replacement: "const trustedPrerequisiteRefs = [...scopedPrerequisiteRefs];",
    }],
    test: "study-engine/tutor-v2/adaptive/composition-repair.test.js",
  },
  {
    name: "completed-review-permission-cross-event-replay",
    edits: [{
      file: "core/v2/hints/hint-ladder.js",
      search: "permission.reviewEventRef === request.currentReviewEventRef &&",
      replacement: "true &&",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "stale-failure-dominates-current-mastery",
    edits: [{
      file: "core/v2/mastery/model.js",
      search: 'if (factors.conflictingReplayCount > 0)\n        return "conflicting-evidence";',
      replacement: 'if (factors.evidence.some((item) => item.recency === "stale" && item.outcome === "not-demonstrated") || factors.conflictingReplayCount > 0)\n        return "conflicting-evidence";',
    }],
    test: "core/v2/mastery/mastery-evidence.test.js",
  },
  {
    name: "reteach-cap-proposes-another-loop",
    edits: [{
      file: "study-engine/tutor-v2/reteach/reteach.js",
      search: 'if (request.priorReteachLoops >= maxLoops) {\n        return loopCapProposal(request);\n    }',
      replacement: 'if (request.priorReteachLoops >= maxLoops) {\n        return fallbackProposal(request, "ADAPTIVE_DEPENDENCY_UNAVAILABLE");\n    }',
    }],
    test: "study-engine/tutor-v2/reteach/reteach.test.js",
  },
  {
    name: "unscoped-admission-envelope-reuse",
    edits: [{
      file: "core/v2/admission/gate.js",
      search: "if (request.householdScopeRef !== metadata.householdScopeRef ||",
      replacement: "if (false && (request.householdScopeRef !== metadata.householdScopeRef ||",
    }, {
      file: "core/v2/admission/gate.js",
      search: "request.instructionalContextRef !== metadata.instructionalContextRef) {\n        return refusal(\"scope-binding-mismatch\");",
      replacement: "request.instructionalContextRef !== metadata.instructionalContextRef)) {\n        return refusal(\"scope-binding-mismatch\");",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "parent-why-arbitrary-private-prose",
    edits: [{
      file: "study-engine/tutor-v2/parent-explanations/parent-explanation.js",
      search: "explanation: Type.Literal(copy.explanation),",
      replacement: "explanation: Type.String({ minLength: 1, maxLength: 240 }),",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "misconception-free-form-diagnostic-string",
    edits: [{
      file: "core/v2/misconceptions/academic-misconceptions.js",
      search: 'pattern: "^(?!.*(?:^|_)(?:ANXIETY|ANXIOUS|AUTISM|BEHAVIOR|BEHAVIOUR|CHILD|CONDITION|DEPRESSION|DIAGNOSIS|DIAGNOSTIC|DISORDER|DYSLEXIA|EMOTION|EMOTIONAL|IQ|LAZY|LEARNER|MOTIVATION|PERSONALITY|PSYCHOLOGICAL|STUDENT|STUPID|TRAIT|UNMOTIVATED)(?:_|$))(?:ART|ARTS|COMPUTER|ELA|ENGLISH|FINANCIAL|FINLIT|HEALTH|MATH|MUSIC|PE|PHYSICAL|READY|RFL|SCIENCE|SOCIAL|TECHNOLOGY)(?:_[A-Z0-9]+){2,7}$",',
      replacement: 'pattern: ".*",',
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "decision-provenance-omitted",
    edits: [{
      file: "study-engine/tutor-v2/adaptive/orchestrator.js",
      search: "decisionProvenance: {",
      replacement: "omittedDecisionProvenance: {",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "completed-review-privacy-binding-removed",
    edits: [{
      file: "core/v2/hints/hint-ladder.js",
      search: "permission.policyRevisionRef === request.currentReviewPolicyRevisionRef &&\n        permission.privacyApprovalRef === request.currentReviewPrivacyApprovalRef",
      replacement: "permission.policyRevisionRef === request.currentReviewPolicyRevisionRef",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
  {
    name: "pending-parent-why-restored-to-applied-state-copy",
    edits: [{
      file: "study-engine/tutor-v2/parent-explanations/parent-explanation.js",
      search: "Tutor was unavailable, so reviewed static guidance was proposed for Study to consider for this step.",
      replacement: "Tutor was unavailable, so Study used reviewed static guidance for this step.",
    }],
    test: "tests/tutor-v2-convergence/wave2-r4-contracts.test.js",
  },
];

let root;
let failed = false;
try {
  root = await mkdtemp(join(tmpdir(), "tutor-v2-wave2-r5-mutations-"));
  for (const mutation of mutations) {
    const mutationRoot = join(root, mutation.name);
    await cp(compiledRoot, mutationRoot, { recursive: true });
    let anchorsReady = true;
    for (const edit of mutation.edits) {
      const file = join(mutationRoot, edit.file);
      const source = await readFile(file, "utf8");
      if (!source.includes(edit.search)) {
        process.stderr.write(`FAIL ${mutation.name}: mutation anchor missing in ${edit.file}\n`);
        failed = true;
        anchorsReady = false;
        break;
      }
      await writeFile(file, source.replace(edit.search, edit.replacement), "utf8");
    }
    if (!anchorsReady) continue;
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
else process.stdout.write(`PASS wave2-r5-mutation-proof ${mutations.length}/${mutations.length} killed\n`);

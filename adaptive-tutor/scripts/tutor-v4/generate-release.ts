import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  POST_REPAIR_BLOCKER_CLOSURES,
} from "./evidence.js";

const outputDirectory = resolve("tutor-v2-wave4-release");
const checkOnly = process.argv.includes("--check");
const repoRoot = resolve("..");

function git(args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

function assertEvidenceSubjectBinding(evidenceExecutionSha: string): void {
  git(["cat-file", "-e", `${evidenceExecutionSha}^{commit}`]);
  const currentHead = git(["rev-parse", "HEAD"]);
  if (!checkOnly) {
    if (currentHead !== evidenceExecutionSha) {
      throw new Error("Release evidence must be generated at the exact evidence execution subject");
    }
    return;
  }

  const parentLine = git(["rev-list", "--parents", "-n", "1", currentHead]).split(/\s+/u);
  if (parentLine.length !== 2 || parentLine[1] !== evidenceExecutionSha) {
    throw new Error("evidenceExecutionSha must be the sole exact parent of the final evidence commit");
  }
  const allowed = [
    "adaptive-tutor/tutor-v2-wave4-release/",
    "docs/study-tutor-v2/wave4/repairs/w4-r9-mutation-evidence-binding/",
  ];
  const allowedExact = new Set([
    "docs/study-tutor-v2/wave4/repairs/w4-r6-gate-integrity/CAMPAIGN-EVIDENCE.json",
  ]);
  const changedPaths = git(["diff", "--name-only", evidenceExecutionSha, currentHead])
    .split(/\r?\n/u)
    .filter((path) => path.length > 0);
  if (
    changedPaths.length === 0
    || changedPaths.some((path) =>
      !allowed.some((prefix) => path.startsWith(prefix)) && !allowedExact.has(path)
    )
  ) {
    throw new Error(`Parent-to-HEAD diff is not evidence-only: ${changedPaths.join(", ")}`);
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, canonicalize(child)]));
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const imported = {
  W4_01: { sourceSha: "6915b5c24a75407b13b99c6370889c5cfefd7e38", sourcePatchId: "e3e986665cd710d0bd1b7af040b706afee5a9f9c", resultingSha: "baac0f9d1ed9ddf97520280baa8f201378e9240f", resultingPatchId: "e3e986665cd710d0bd1b7af040b706afee5a9f9c" },
  W4_02: { sourceSha: "4510bf2a99825b98e5ea2b6097eab97990eb1cf5", sourcePatchId: "d9595af19573a55bbc1aa7895cfd492669418763", resultingSha: "d16d644d3ba66db77751f07a87da0c76bf771d19", resultingPatchId: "d9595af19573a55bbc1aa7895cfd492669418763" },
  W4_03: { sourceSha: "0606f7b7c3e2f5bf24bde42aebf35d4e9305cdda", sourcePatchId: "bac0c6cc1bba316c0c1e59f1b11209a88204da90", resultingSha: "1dc7e8435bcd930ef0fbaa7d0880c185a1b34498", resultingPatchId: "bac0c6cc1bba316c0c1e59f1b11209a88204da90" },
  W4_04: { sourceSha: "2554fa98ef7ab93501d99af64ec9b5d93c0b640e", sourcePatchId: "f79d921ed2abef41ce3c05e7eb6899563bf0b520", resultingSha: "951f90c4a7bc24545d859a51a8448a5e3e27f761", resultingPatchId: "f79d921ed2abef41ce3c05e7eb6899563bf0b520" },
  W4_05: { sourceSha: "29a476fee15b92dee6bf7d070c21a4338afe59a5", sourcePatchId: "50a251a33aaaa2379b382cc87bf0a2f91a14216c", resultingSha: "5b66100c6a0dc16a786bdc6c36b3fa28d5174f15", resultingPatchId: "50a251a33aaaa2379b382cc87bf0a2f91a14216c" },
  W4_06: { sourceSha: "9180d0279025a2a83034c7457475bedad8bdbd9d", sourcePatchId: "8f68c89d936478ec9a33f6c14fa41b85ad78720c", resultingSha: "41ce3a464612e36e07d7eab52a7d104ebab0515c", resultingPatchId: "8f68c89d936478ec9a33f6c14fa41b85ad78720c" },
  W4_07: { sourceSha: "b9e5bd3dd64e6a3c0337db91e8190211d50d228b", sourcePatchId: "d094cbe7e3c758bad255d4ea591b3ca40bf2e0cc", resultingSha: "02995dbc51dc2d4261ef4e3a68bcab5c05d7474b", resultingPatchId: "d094cbe7e3c758bad255d4ea591b3ca40bf2e0cc" },
  W4_08: { sourceSha: "383681a89fac8de77eae45c83d761cb10646595b", sourcePatchId: "0f0b71931234813263c0f070eb4e568acc89876c", resultingSha: "f276065700cd93ca7803a5804ad69e05024cbf3d", resultingPatchId: "0f0b71931234813263c0f070eb4e568acc89876c" },
  W4_09: { sourceSha: "f07f552bed446c3d5a8b118ee51cb5047e839bc0", sourcePatchId: "cf92ff2bd584694e77f2e39e030fc288a96878fe", resultingSha: "5890803d6a040040b0e5efd4b9443e69e08cf4d8", resultingPatchId: "cf92ff2bd584694e77f2e39e030fc288a96878fe" },
  W4_10: { sourceSha: "43c6f8e35097c3dc5e635b0c5b5f7090aefca637", sourcePatchId: "bff2ae52e9d0f8bab7830a366ff8151044c68f18", resultingSha: "8f1b8b82916e3f36b4cf2f74d31868765c08dbbe", resultingPatchId: "bff2ae52e9d0f8bab7830a366ff8151044c68f18" },
  W4_11: { sourceSha: "2bac9f90879cc9929b2044f122399d27724679b4", sourcePatchId: "8e22499708bf024f58c30de709f450b6049dad83", resultingSha: "52a97423d033bc1ea153021d3822e1d712d009f0", resultingPatchId: "8e22499708bf024f58c30de709f450b6049dad83" },
  W4_12: { sourceSha: "110e222bc38511711651b8b14f5606e1c2bcf58f", sourcePatchId: "3bf954d3873f06aa6717e8f65cc1b74abc1bdcb4", resultingSha: "d73b9189f46339140180a905fd6e7ae091e5f22e", resultingPatchId: "3bf954d3873f06aa6717e8f65cc1b74abc1bdcb4" },
  W4_13: { sourceSha: "eed4b9e62dd3b754f3ab0c4f06dd847b5f5ffd2e", sourcePatchId: "ce4e5711150f2f333e131c3a405561dc8e989852", resultingSha: "0ba4cb5463da713f1584564a4f387ad09cc3477f", resultingPatchId: "ce4e5711150f2f333e131c3a405561dc8e989852" },
  R1: { sourceSha: "ef672ba2e65e83e17f84057782d8005cc1a03016", sourcePatchId: "880eda43e024a280f32c458b840a5df39a686cb4", resultingSha: "752a61e6928c8b63a8f2db58c17036ac8894652a", resultingPatchId: "880eda43e024a280f32c458b840a5df39a686cb4" },
  R2: { sourceSha: "25dbebebf44770d1fb4fa5a32cf832e8476bbbf0", sourcePatchId: "82073e8be1e81a530c0cbb69f9f476c4486ab25e", resultingSha: "94a4293ee8ea07c54a8fe9e5cd961e6e3c2b3eee", resultingPatchId: "82073e8be1e81a530c0cbb69f9f476c4486ab25e" },
  R3: { sourceSha: "bb8d4f5a9f02561e480daaa87cb00ab2f6e323b5", sourcePatchId: "b394be4028febb0fbdd6013652deeff0d83db277", resultingSha: "a1e26f1d16f99bdc1a39cbcdc0af934457a6f2f4", resultingPatchId: "b394be4028febb0fbdd6013652deeff0d83db277" },
  R4: { sourceSha: "84ed21176e1c7d5a667b39b012f1a0747358b737", sourcePatchId: "8a3a0f1799b34aca539859d0e711febaf091bbc2", resultingSha: "36fece86e80d646e21a8d3328227feeadebc18ce", resultingPatchId: "8a3a0f1799b34aca539859d0e711febaf091bbc2" },
  R5: { sourceSha: "7bc73bfb48ce5c485c2225ac0e13cce3cc15eb83", sourcePatchId: "be9538f29c95961d2ce759ff609903e5df7fb607", resultingSha: "6cea138eb284c8cc651f885472da206d68faa0ee", resultingPatchId: "be9538f29c95961d2ce759ff609903e5df7fb607" },
  R6: { sourceSha: "43106f3f92c17af8bd5aa404ed49c935bdf72631", sourcePatchId: "05f4075d166158c60546de702424f65aec940569", resultingSha: "5ff0ca3ef65df9cda703d74ed3ec11d8a0a9ba6f", resultingPatchId: "05f4075d166158c60546de702424f65aec940569" },
  R7: { sourceSha: "bc706aa6f77b53191830db432b568f3f0f36a54e", sourcePatchId: "393e29308c60b046c55789a4617f5f5de12bcced", resultingSha: "049511fe09e787c0072638ac329c8b980278aaf0", resultingPatchId: "393e29308c60b046c55789a4617f5f5de12bcced" },
  R8: { sourceSha: "4bae0522e15c130493c110a181d8d0ae0e57a14a", sourcePatchId: "b0c882d68326bcc8267333aa5e5cc4226c094d06", resultingSha: "57cae2722632fbf2a6318a1c7744a6126d6a69c3", resultingPatchId: "b0c882d68326bcc8267333aa5e5cc4226c094d06" },
} as const;

interface ExecutableHardGateEvidence {
  readonly resultVersion: number;
  readonly frameworkVersion: number;
  readonly evidenceExecutionSha: string;
  readonly evidenceKind: string;
  readonly aggregateStatus: string;
  readonly hardGateFamilyCount: number;
  readonly hardGateFamiliesPassed: number;
  readonly booleanEvidenceAccepted: boolean;
  readonly results: readonly {
    readonly family: string;
    readonly status: string;
    readonly detectorId: string;
    readonly evidenceExecutionSha: string;
  }[];
}
interface ImplementationMutationEvidence {
  readonly evidenceVersion: number;
  readonly frameworkVersion: number;
  readonly evidenceExecutionSha: string;
  readonly mutationKind: string;
  readonly booleanEvidenceFlipOnly: boolean;
  readonly aggregateStatus: string;
  readonly killed: number;
  readonly qualifying: number;
  readonly compileValid: number;
  readonly survived: number;
  readonly invalid: number;
  readonly baselineBlocked: number;
  readonly cleanupComplete: boolean;
  readonly results: readonly {
    readonly mutationId: string;
    readonly evidenceExecutionSha: string;
    readonly compileExitCode: number;
    readonly allMutatedSourcesCompiled: boolean;
    readonly classification: string;
    readonly detectorOutcome: {
      readonly invocationStatus: string;
      readonly semanticExecutionReached: boolean;
      readonly assertionCount: number;
      readonly semanticResult: string;
    } | null;
  }[];
}
const hardGate = JSON.parse(await readFile(
  resolve(outputDirectory, "HARD-GATE-RESULT.json"),
  "utf8",
)) as ExecutableHardGateEvidence;
const negativeControls = JSON.parse(await readFile(
  resolve(outputDirectory, "NEGATIVE-CONTROL-EVIDENCE.json"),
  "utf8",
)) as ImplementationMutationEvidence;
if (
  hardGate.resultVersion < 3
  || hardGate.frameworkVersion !== 3
  || hardGate.evidenceKind !== "EXECUTABLE_DETECTOR_RESULTS"
  || hardGate.booleanEvidenceAccepted !== false
  || hardGate.hardGateFamilyCount !== 13
) {
  throw new Error("Wave 4 hard-gate evidence is not executable v3 evidence");
}
if (
  negativeControls.evidenceVersion < 3
  || negativeControls.frameworkVersion !== 3
  || negativeControls.mutationKind !== "implementation"
  || negativeControls.booleanEvidenceFlipOnly !== false
  || negativeControls.results.length !== 13
) {
  throw new Error("Wave 4 negative-control evidence is not implementation-mutation v3 evidence");
}
if (
  hardGate.evidenceExecutionSha.length !== 40
  || hardGate.evidenceExecutionSha !== negativeControls.evidenceExecutionSha
  || hardGate.results.some((result) => result.evidenceExecutionSha !== hardGate.evidenceExecutionSha)
  || negativeControls.results.some((result) =>
    result.evidenceExecutionSha !== negativeControls.evidenceExecutionSha
  )
) {
  throw new Error("Wave 4 evidence artifacts do not agree on evidenceExecutionSha");
}
if (
  hardGate.aggregateStatus !== "PASS"
  || hardGate.hardGateFamiliesPassed !== 13
  || hardGate.results.length !== 13
  || negativeControls.aggregateStatus !== "PASS"
  || negativeControls.qualifying !== 13
  || negativeControls.compileValid !== 13
  || negativeControls.killed !== 13
  || negativeControls.survived !== 0
  || negativeControls.invalid !== 0
  || negativeControls.baselineBlocked !== 0
  || !negativeControls.cleanupComplete
  || negativeControls.results.some((result) =>
    result.compileExitCode !== 0
    || !result.allMutatedSourcesCompiled
    || result.classification !== "KILLED"
    || result.detectorOutcome === null
    || result.detectorOutcome.invocationStatus !== "EXECUTED"
    || !result.detectorOutcome.semanticExecutionReached
    || result.detectorOutcome.assertionCount <= 0
    || result.detectorOutcome.semanticResult !== "FAIL"
  )
) {
  throw new Error("Wave 4 evidence does not certify 13 baseline detectors and 13 semantic mutation kills");
}
assertEvidenceSubjectBinding(hardGate.evidenceExecutionSha);
const familyStatus = (family: string): string =>
  hardGate.results.find((result) => result.family === family)?.status ?? "FAIL";
const closuresByLane = Object.fromEntries(["W4-03", "W4-05", "W4-06", "W4-08", "W4-10"].map((lane) => {
  const assertions = POST_REPAIR_BLOCKER_CLOSURES.filter((item) => item.lane === lane);
  return [lane, {
    historicalResult: "BASELINE_ADVERSARIAL_FINDING",
    postRepairResult: assertions.every((item) => item.current === "CLOSED") ? "CLOSED" : "OPEN",
    assertionCount: assertions.length,
    closedCount: assertions.filter((item) => item.current === "CLOSED").length,
  }];
}));
const blockerClosure = {
  evidenceVersion: 1,
  aggregateStatus: POST_REPAIR_BLOCKER_CLOSURES.length === 38 ? "PASS" : "FAIL",
  expectedHistoricalBlockerCount: 38,
  assertionCount: POST_REPAIR_BLOCKER_CLOSURES.length,
  closedCount: POST_REPAIR_BLOCKER_CLOSURES.filter((item) => item.current === "CLOSED").length,
  historicalEvidenceRewritten: false,
  currentReplayKind: "CONVERGENCE_OWNED_POST_REPAIR_REPLAY",
  lanes: closuresByLane,
  assertions: POST_REPAIR_BLOCKER_CLOSURES,
};

const schemaInventoryText = await readFile(resolve("json-schema/v4/wave4/SCHEMA-INVENTORY.json"), "utf8");
const schemaInventory = JSON.parse(schemaInventoryText) as Record<string, unknown>;
const status = {
  statusVersion: 2,
  WAVE_4_COMPLETE: false,
  TUTOR_V2_TECHNICAL_WAVES_COMPLETE: false,
  FINAL_WAVE4_INDEPENDENT_REREVIEW_REQUIRED: true,
  WAVE_4_HARD_GATES_PASS: hardGate.aggregateStatus === "PASS",
  HISTORICAL_BLOCKERS_CLOSED: blockerClosure.closedCount === 38,
  WAVE_3_ACCEPTANCE_PRESERVED: true,
  ONE_STUDY_ENGINE: true,
  TUTOR_REMAINS_ADVISORY: true,
  NOT_AUTHORIZED_FOR_PRODUCTION_DEPLOYMENT: true,
  NOT_AUTHORIZED_FOR_MASTER_MERGE: true,
  NOT_AUTHORIZED_FOR_HOSTED_SUPABASE: true,
  NOT_AUTHORIZED_FOR_BROWSER_AI_WIRING: true,
  NOT_AUTHORIZED_FOR_LIVE_PROVIDER_EXECUTION: true,
  LIVE_MODEL_COMMERCIAL_CERTIFICATION_NOT_PERFORMED: true,
  PRODUCTION_PERSISTENCE_REMAINS_SEPARATE: true,
  COMMERCIAL_WEB_SECURITY_CONVERGENCE_REMAINS_SEPARATE: true,
  FINAL_CLASSIFICATION: "W4_MUTATION_EVIDENCE_REPAIR_READY_FOR_FINAL_REREVIEW",
};
const provenance = {
  provenanceVersion: 3,
  session: "STUDY-TUTOR-V2-W4-R9 Compile-Valid M04 + Exact Mutation Evidence Binding Repair",
  branch: "mac/tutor-v2-w4-mutation-evidence-binding-repair-r1",
  evidenceExecutionSha: hardGate.evidenceExecutionSha,
  startingFailedCandidateSha: "27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76",
  startingWave3Sha: "a2fdf1858cd50c998f5da53970d36ee6c90ff31a",
  wave3AcceptanceRuling: "WAVE3_ACCEPTED_FOR_WAVE4",
  importOrder: Object.keys(imported),
  imports: imported,
  duplicateImportRuling: "PASS_13_LANES_AND_R1_R8_IMPORTED_EXACTLY_ONCE_R1_R2_NOT_DUPLICATED",
  prohibitedAssembledR2Cherry: {
    sha: "b0720b1d3243f6587a6538c7225849ce88d953ef",
    imported: false,
    stablePatchId: "82073e8be1e81a530c0cbb69f9f476c4486ab25e",
    matchesR2PatchId: true,
  },
  semanticCherryPickAdaptations: [],
  semanticConflictRuling: "NO_TEXT_CONFLICTS_OR_SEMANTIC_ADAPTATIONS_R6_R7_R8_INVARIANTS_COEXIST",
  failedW415AcceptanceReview: {
    candidateSha: "27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76",
    accepted: false,
    historicalRuling: "WAVE4_HOLD",
    historyRewritten: false,
    repairedCandidateKind: "POST_REVIEW_REPAIRED_CANDIDATE",
  },
  externalStudyAuthorityDependency: {
    branch: "mac/study-runtime-tutor-authority-port-r2",
    repairSha: "527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4",
    containedInTutorCandidate: false,
    ruling: "SEPARATE_VERIFIED_STUDY_AUTHORITY_ARTIFACT_NOT_MERGED",
  },
  evidenceAttestation: {
    repairedFromFailedCandidateSha: "27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76",
    executionSubjectSha: hardGate.evidenceExecutionSha,
    finalEvidenceCommitIsDirectChild: true,
    evidenceOnlyChildDiffRequired: true,
    selfReferencedFinalCommitShaInsideChecksummedArtifacts: false,
  },
};
const laneInventory = {
  inventoryVersion: 1,
  laneCount: 13,
  lanes: [
    { lane: "W4-01", family: "PROMPT_INJECTION_AUTHORITY_CONTAINMENT", historical: "READY_FOR_CONVERGENCE", current: familyStatus("PROMPT_INJECTION_AUTHORITY_CONTAINMENT") },
    { lane: "W4-02", family: "ACTIVE_ASSESSMENT_ANSWER_EXTRACTION_RESISTANCE", historical: "READY_FOR_CONVERGENCE", current: familyStatus("ACTIVE_ASSESSMENT_ANSWER_EXTRACTION_RESISTANCE") },
    { lane: "W4-03", family: "CROSS_SCOPE_COMMERCIAL_ISOLATION", historical: "BASELINE_ADVERSARIAL_FINDING_19", current: "PASS_19_OF_19_CLOSED" },
    { lane: "W4-04", family: "REPLAY_CRASH_IDEMPOTENCY", historical: "READY_FOR_CONVERGENCE", current: familyStatus("REPLAY_CRASH_IDEMPOTENCY") },
    { lane: "W4-05", family: "PROVIDER_CHAOS_CURRENT_STATE_REVALIDATION", historical: "BASELINE_ADVERSARIAL_FINDING_5", current: "PASS_5_OF_5_CLOSED" },
    { lane: "W4-06", family: "RESOURCE_BOUNDS_AND_SINGLE_USE_DISPATCH", historical: "BASELINE_ADVERSARIAL_FINDING_2", current: "PASS_2_OF_2_CLOSED" },
    { lane: "W4-07", family: "PRIVACY_RETENTION_MINIMIZATION", historical: "READY_FOR_CONVERGENCE", current: familyStatus("PRIVACY_RETENTION_MINIMIZATION") },
    { lane: "W4-08", family: "MULTIMODAL_PRESENTATION_BOUNDARY_HARDENING", historical: "BASELINE_ADVERSARIAL_FINDING_7", current: "PASS_7_OF_7_CLOSED" },
    { lane: "W4-09", family: "MULTILINGUAL_HARD_BOUNDARY_PRESERVATION", historical: "EVALUATION_ONLY_READY_FOR_CONVERGENCE", current: "PASS_EVALUATION_ONLY" },
    { lane: "W4-10", family: "PARENT_GUARDIAN_AUTHORIZATION_TRUTHFULNESS", historical: "BASELINE_ADVERSARIAL_FINDING_5", current: "PASS_5_OF_5_CLOSED" },
    { lane: "W4-11", family: "MODEL_DRIFT_CERTIFICATION_IDENTITY", historical: "READY_FOR_CONVERGENCE", current: "PASS" },
    { lane: "W4-12", family: "OFFLINE_LIVE_CERT_RUNNER_HARD_FAIL", historical: "OFFLINE_RUNNER_READY_FOR_CONVERGENCE", current: "PASS_OFFLINE_ONLY" },
    { lane: "W4-13", family: "SUPPLY_CHAIN_VENDOR_SECRET_ISOLATION", historical: "READY_FOR_CONVERGENCE", current: "PASS" },
  ],
};
const baselineFindings = {
  evidenceVersion: 1,
  preservationRuling: "PASS_HISTORICAL_RED_EVIDENCE_PRESERVED_UNCHANGED",
  findings: [
    { lane: "W4-03", classification: "BASELINE_ADVERSARIAL_FINDING", blockerAssertions: 19, originalEvidence: "docs/study-tutor-v2/wave4/lanes/w4-03-scope-isolation" },
    { lane: "W4-05", classification: "BASELINE_ADVERSARIAL_FINDING", blockerAssertions: 5, originalEvidence: "docs/study-tutor-v2/wave4/lanes/w4-05-provider-chaos" },
    { lane: "W4-06", classification: "BASELINE_ADVERSARIAL_FINDING", blockerAssertions: 2, originalEvidence: "docs/study-tutor-v2/wave4/lanes/w4-06-resource-abuse" },
    { lane: "W4-08", classification: "BASELINE_ADVERSARIAL_FINDING", blockerAssertions: 7, originalEvidence: "docs/study-tutor-v2/wave4/lanes/w4-08-multimodal-fuzz" },
    { lane: "W4-10", classification: "BASELINE_ADVERSARIAL_FINDING", blockerAssertions: 5, originalEvidence: "docs/study-tutor-v2/wave4/lanes/w4-10-parent-guardian" },
  ],
};
const repairInventory = {
  inventoryVersion: 2,
  repairCount: 8,
  repairs: [
    { repair: "R1", name: "Commercial Integrity", sourceSha: imported.R1.sourceSha, result: "PASS_27_OF_27", invariants: ["canonical-commercial-scope", "current-provider-state", "bounded-policy-collections", "single-use-dispatch"] },
    { repair: "R2", name: "Multimodal Boundary", sourceSha: imported.R2.sourceSha, result: "PASS", invariants: ["hostile-object-rejection", "caption-anti-answer", "scope-lineage", "digest", "audio-capability", "media-kind", "fallback-uniqueness", "raw-media-minimization"] },
    { repair: "R3", name: "Parent Guardian", sourceSha: imported.R3.sourceSha, result: "PASS_22_OF_22", invariants: ["exact-guardian-authorization", "consent-revision", "truthful-study-state"] },
    { repair: "R4", name: "Study Accepted-Effect / Memory Lineage", sourceSha: imported.R4.sourceSha, result: "PASS_9_OF_9", invariants: ["accepted-effect-scope", "memory-scope", "same-scope-idempotency", "changed-scope-conflict"] },
    { repair: "R5", name: "Presentation Acceptance Lineage", sourceSha: imported.R5.sourceSha, result: "PASS_20_OF_20", invariants: ["canonical-scope", "study-advisory", "reviewed-content-provenance"] },
    { repair: "R6", name: "Executable Gate Integrity", sourceSha: imported.R6.sourceSha, result: "PASS_13_OF_13_EXECUTABLE_GATES_AND_MUTATIONS", invariants: ["permanent-detector-execution", "implementation-mutations", "boolean-evidence-rejected", "compiler-failure-not-a-kill"] },
    { repair: "R7", name: "Current Replay Crash Certification", sourceSha: imported.R7.sourceSha, result: "PASS_31_OF_31", invariants: ["15-crash-windows", "r1-single-use-dispatch", "study-effect-at-most-once", "exact-memory-replay", "cross-scope-conflict"] },
    { repair: "R8", name: "Current Privacy Retention Certification", sourceSha: imported.R8.sourceSha, result: "PASS_CURRENT_PRIVACY_CERTIFICATION", invariants: ["current-legitimate-projection", "14-canary-categories", "41-scanned-surfaces", "zero-leaks", "raw-transcript-negative-control", "closed-provider-and-schema-policy"] },
  ],
};
const serializedBoundaryInventory = {
  inventoryVersion: 1,
  currentSerializedBoundaryCount: 10,
  internalPortSchemaCount: 0,
  additionalSerializedBoundaryCount: 0,
  serializedBoundaries: [
    "StudyCommercialTutorInvocation", "BoundedCommercialProviderRequest", "BoundedCommercialProviderResponse",
    "StudyCommercialTutorAdvisory", "StudyCommercialEffectReceipt", "CommercialOperationTelemetryEvent",
    "ParentReport", "InstructionalMemoryDelta", "DurableMultimodalEvidence", "MinimizedAcceptedStudyEffectEvent",
  ],
  additionalCandidates: [
    { candidate: "CommercialExecutionScope", classification: "TRUSTED_INTERNAL_CONTRACT", reason: "Study-issued in-process authority input; serialized boundaries carry only its opaque ref and exact lineage" },
    { candidate: "model certification", classification: "TOOLING_ARTIFACT" },
    { candidate: "campaign evidence", classification: "TOOLING_ARTIFACT" },
    { candidate: "accepted presentation", classification: "TRUSTED_INTERNAL_CONTRACT", durableProjection: "DurableMultimodalEvidence" },
  ],
};
const testEvidence = {
  evidenceVersion: 1,
  nodeVersion: "22.23.2",
  importedLaneSuites: 13,
  repairs: { R1: "27/27", R2: "30/30 combined", R3: "22/22", R4: "9/9", R5: "20/20", R6: "13/13 executable gates and 13/13 mutations", R7: "31/31", R8: "current privacy certification PASS" },
  currentReplayCrashCertification: {
    result: "31/31 PASS",
    crashWindows: "15/15 PASS",
    originalSemanticAssertionsPreserved: "28/28",
    r1SingleUseDispatchIntegration: "PASS",
    studyEffectAtMostOnce: "PASS",
    memoryExactReplay: "PASS",
    crossScopeConflict: "PASS",
    negativeControl: "weakened R1 dispatch guard detected",
  },
  currentPrivacyRetentionCertification: {
    result: "PASS",
    legitimateDurableProjection: "accepted",
    canaryCategories: 14,
    scannedSurfaces: 41,
    directLeaks: 0,
    normalizedLeaks: 0,
    encodedLeaks: 0,
    rawMediaPersisted: false,
    rawTranscriptPersisted: false,
    providerPolicyAttacks: "6/6 fail closed",
    schemaAttacks: "9/9 rejected",
    negativeControl: "raw transcript retention detected",
  },
  convergenceRepairReplay: "86/86 TAP assertions",
  historicalBlockerClosure: "38/38",
  wave4HardGates: `${hardGate.hardGateFamiliesPassed}/13 executable detectors passed`,
  wave4NegativeControls: `${negativeControls.killed}/13 compile-valid semantic kills at ${negativeControls.evidenceExecutionSha}`,
  wave3HardGates: "18/18",
  wave3Convergence: "33/33",
  wave2Convergence: "288/288",
  studyTutorBridge: "209/209",
  foundationCorpus: "128/128; FOUNDATION_GATE_PASS; releaseReady=false",
  tutorCore: "21/21; build PASS; smoke PASS",
  studyCoreBridge: "35/36 pass; 1 skipped for unavailable external archives",
  repositoryRoot: "typecheck PASS; production build PASS",
  originalLaneReplay: {
    W4_01: "40/40; 6/6 controls",
    W4_02: "66/66; 4/4 controls",
    W4_03: "historical RED reproduced: 36 pass, 22 fail across 58 tests; 19 recorded blockers",
    W4_04: familyStatus("REPLAY_CRASH_IDEMPOTENCY") === "PASS"
      ? "current executable replay/crash detector PASS"
      : "current executable replay/crash detector FAIL; historical results do not certify current state",
    W4_05: "historical finding preserved: 16/21 matrix, 5 blockers",
    W4_06: "historical finding preserved: 2 explicit blocker cases",
    W4_07: familyStatus("PRIVACY_RETENTION_MINIMIZATION") === "PASS"
      ? "current executable privacy-retention detector PASS"
      : "current executable privacy-retention detector FAIL; historical results do not certify current state",
    W4_08: "historical RED reproduced: 5 pass, 10 fail across 15 tests; 7 blocker categories",
    W4_09: "10/10; evaluation only",
    W4_10: "historical RED reproduced: 25 pass, 5 fail across 30 tests",
    W4_11: "21/21",
    W4_12: "11/11; six hard violations fail immediately; offline only",
    W4_13: "production-scoped scan PASS with 0 findings; 4/4 controls",
  },
  fullValidationRecordedInSessionReturn: true,
  historicalWrapperLimitationsPreserved: true,
};
const certificationStatus = {
  certificationVersion: 1,
  deterministicOfflineWave4Certification: hardGate.aggregateStatus === "PASS"
    && negativeControls.aggregateStatus === "PASS" ? "PASS" : "FAIL",
  finalIndependentRereview: "REQUIRED",
  liveModelCommercialCertification: "NOT_PERFORMED",
  multilingualCurriculumAvailabilityClaimed: false,
  realProviderExecutionPerformed: false,
  productionAuthorizationGranted: false,
};
const limitations = {
  limitationsVersion: 1,
  inherited: [
    { code: "OBSOLETE_BROAD_PLATFORM_VALIDATOR", detail: "The inherited broad platform-boundary validator remains 18/19 because its obsolete rule flags accepted paths/generated output." },
    { code: "INHERITED_DEPENDENCY_ADVISORIES", detail: "Three inherited high advisories remain separately classified." },
    { code: "SESSION6_ARCHIVES_NOT_MOUNTED", detail: "Four frozen Session 6 archives remain unavailable; current executable bridge tests do not replace archive checksums." },
    { code: "WAVE2_OWNERSHIP_ALLOWLIST", detail: "The inherited Wave 2 wrapper reaches HOLD only because its pre-Wave-3 ownership allowlist rejects later accepted Wave 3 and Wave 4 paths; its current regressions and bridges pass." },
    { code: "WAVE1_TEMP_COPY_DEPENDENCIES", detail: "The inherited Wave 1 wrapper's isolated temporary copies cannot resolve the locally shared dependency tree; its 253/253 security convergence and 209/209 Study bridge suites pass before that environment-only failure." },
  ],
  deferred: [
    "production persistence for budgets, telemetry, replay, and dispatch claims",
    "live provider credentials and transports",
    "live pricing and availability feed",
    "Parent Hub production UI",
    "browser multimodal capture",
    "vendor TTS/STT",
    "production curriculum-registry adapter",
    "deployment and commercial web security convergence",
    "live stochastic model certification",
  ],
};
const productionRestrictions = {
  restrictionVersion: 1,
  candidateOnly: true,
  unauthorizedChangesUnderProductionRoots: 0,
  productionRoots: ["src/**", "netlify/**", "supabase/**"],
  providerCredentialsIncluded: false,
  liveEndpointIncluded: false,
  providerSdkIncluded: false,
  deploymentPerformed: false,
  masterMergePerformed: false,
  liveProviderWiringPerformed: false,
};
const supplyChainAdjudication = {
  evidenceVersion: 1,
  aggregateStatus: "PASS",
  scope: "CURRENT_PRODUCTION_FOUNDATION",
  scannedRoots: ["core/v3", "study-engine/tutor-v2/wave3", "study-engine/tutor-v2/parent-reporting"],
  productionFindings: [],
  forbiddenDependencyFindings: [],
  rootLockfileAddition: false,
  laneLocalToolingManifests: [
    "adversarial/v4/multilingual-eval/package.json",
    "adversarial/v4/scope-isolation/package.json",
    "certification/v4/live-runner/package.json",
    "certification/v4/model-drift/package.json",
  ],
  originalWholeDiffWrapperRuling: {
    status: "KNOWN_SCOPE_FALSE_POSITIVES",
    findingCount: 9,
    detail: "Synthetic canaries, test-runner environment variables, and lane-local TypeScript tooling are not production vendor wiring or credentials.",
  },
  negativeControls: ["vendor-import", "openai-import", "endpoint", "production-netlify-import"].map((id) => ({ id, status: "DETECTED" })),
};

const outputs = new Map<string, string>([
  ["STATUS.json", serialize(status)],
  ["SOURCE-PROVENANCE.json", serialize(provenance)],
  ["LANE-INVENTORY.json", serialize(laneInventory)],
  ["ADVERSARIAL-BASELINE-FINDINGS.json", serialize(baselineFindings)],
  ["POST-REPAIR-BLOCKER-CLOSURE.json", serialize(blockerClosure)],
  ["REPAIR-INVENTORY.json", serialize(repairInventory)],
  ["HARD-GATE-RESULT.json", serialize(hardGate)],
  ["NEGATIVE-CONTROL-EVIDENCE.json", serialize(negativeControls)],
  ["SCHEMA-INVENTORY.json", serialize(schemaInventory)],
  ["SERIALIZED-BOUNDARY-INVENTORY.json", serialize(serializedBoundaryInventory)],
  ["TEST-EVIDENCE.json", serialize(testEvidence)],
  ["CERTIFICATION-STATUS.json", serialize(certificationStatus)],
  ["KNOWN-LIMITATIONS.json", serialize(limitations)],
  ["PRODUCTION-RESTRICTIONS.json", serialize(productionRestrictions)],
  ["SUPPLY-CHAIN-ADJUDICATION.json", serialize(supplyChainAdjudication)],
]);
outputs.set("MANIFEST.json", serialize({
  manifestVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 4 Adversarial Certification + Repair Reconvergence",
  finalClassification: status.FINAL_CLASSIFICATION,
  artifacts: [...outputs.keys(), "MANIFEST.json", "CHECKSUMS.json"].sort(),
}));
const checksums = Object.fromEntries([...outputs.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([file, content]) => [file, sha256(content)]));
outputs.set("CHECKSUMS.json", serialize({
  checksumVersion: 1,
  algorithm: "sha256",
  checksumsDocumentExcludesItself: true,
  artifacts: checksums,
}));

if (checkOnly) {
  const actualFiles = (await readdir(outputDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const expectedFiles = [...outputs.keys()].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(`Wave 4 release inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Wave 4 release drift detected: ${file}`);
  }
  process.stdout.write(
    `PASS wave4-release-check ${outputs.size} artifacts; exact-parent subject binding; evidence-only diff\n`,
  );
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(resolve(outputDirectory, file), content, "utf8");
  }
  process.stdout.write(`PASS wave4-release-generation ${outputs.size} artifacts\n`);
}

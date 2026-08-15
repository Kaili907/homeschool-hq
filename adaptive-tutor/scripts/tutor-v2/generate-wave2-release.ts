import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("tutor-v2-wave2-release");
const checkOnly = process.argv.includes("--check");
const gateText = await readFile(resolve(outputDirectory, "WAVE2-GATE-RESULT.json"), "utf8");
const gate = JSON.parse(gateText) as {
  readonly finalClassification: string;
  readonly hardGateFamilies: readonly { readonly name: string; readonly status: string }[];
  readonly counts: Record<string, number>;
  readonly checks: readonly { readonly name: string; readonly status: string; readonly detail: string }[];
};
if (gate.finalClassification !== "WAVE2_R2_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS") {
  throw new Error(`Wave 2 gate is not an inherited-findings candidate: ${gate.finalClassification}`);
}
if (gate.hardGateFamilies.some(({ status }) => status !== "PASS")) {
  throw new Error("Wave 2 hard gate family failure cannot generate a candidate release package.");
}

const schemaText = await readFile(resolve("json-schema/v2/wave2/SCHEMA-INVENTORY.json"), "utf8");
const schemaInventory = JSON.parse(schemaText) as {
  readonly generatedSchemaCount: number;
  readonly internalPortSchemasGenerated: number;
  readonly schemas: readonly { readonly file: string; readonly sha256: string; readonly source: string }[];
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function serialize(value: unknown): string {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

const lanes = {
  W2_01_ADMISSION: {
    branch: "origin/mac/tutor-v2-w2-admission-r1",
    remoteTip: "d6a1b069a8f5d67023edcb4f247b3c67076306a4",
    cherryPickedCommit: "cd8244ff4a3b5065cbe2a7db3bf29ab6f9863d6f",
    stablePatchId: "88e8a6bf486dfe2b0fef4c1679acef9d058793d5",
  },
  W2_02_CONCEPT_GRAPH: {
    branch: "origin/mac/tutor-v2-w2-concept-graph-r1",
    remoteTip: "b971fc4d139449a815e4ff06c34ca4abb5c84005",
    cherryPickedCommit: "d5a4f0af1c0db541c8834e3d8b8d12a0fbaeddbf",
    stablePatchId: "ad8f3e145ba664e3b0d64135c3cf1d8d2174bd2e",
  },
  W2_03_MISCONCEPTION: {
    branch: "origin/mac/tutor-v2-w2-misconception-r1",
    remoteTip: "f9ed81626d8d9e455ea750989d8c2a71cfe8bd6d",
    cherryPickedCommit: "a30e617454a4c05282fb2c7d96f070e3a6fb5a86",
    stablePatchId: "f5f7cca1df95e16b2a193bdbb70177ef9a49560b",
  },
  W2_04_HINT_LADDER: {
    branch: "origin/mac/tutor-v2-w2-hint-ladder-r1",
    remoteTip: "eb941ff897181f761f83b3604dc4006d5e5118d4",
    cherryPickedCommit: "aa3ee6e579e049b7971e973e7adc2ddacaa3140f",
    stablePatchId: "7ac35fbee5cb7965f75dba780f3e450d11355091",
  },
  W2_05_INTERVENTION: {
    branch: "origin/mac/tutor-v2-w2-intervention-r1",
    remoteTip: "94c0d816e6e312af9f61d465a9692ef37919a65b",
    cherryPickedCommit: "b85caf5f62a8e2de71816239ab7f3640b5f83746",
    stablePatchId: "0f4f407fe5dbf52ef577c19e9617d7ed342097d8",
  },
  W2_06_MASTERY_EVIDENCE: {
    branch: "origin/mac/tutor-v2-w2-mastery-evidence-r1",
    remoteTip: "241cfc7d3b6c673139728302b00bd580cba1e919",
    cherryPickedCommit: "1e7432b02beff1ed5d7ec8e1421a0d6a4c955dfe",
    stablePatchId: "7fcc26bee9e30240410e6b124534f9fa259cf9c9",
  },
  W2_07_PARENT_WHY: {
    branch: "origin/mac/tutor-v2-w2-parent-why-r1",
    remoteTip: "661669117497a33e5d2da0a12e6bc3801839a165",
    cherryPickedCommit: "db5341ef1409173f98617255d0b8ca3a51deb80d",
    stablePatchId: "89ad1f511b2d71d2d0fc7689586beb9e53068e60",
  },
  W2_08_REPAIR_RETEACH: {
    branch: "origin/mac/tutor-v2-w2-repair-reteach-r1",
    remoteTip: "39b8d671f35dce6e44d19bff2d58b1bb2bfa4d81",
    cherryPickedCommit: "aeff3bde7be983276c9006576d388eabbe81ba97",
    stablePatchId: "7ce3fdf3b5fd93d6d2e062667b0fc8b65914bcc1",
  },
} as const;

const repairs = {
  W2_B1_GLOBAL_AUTHORITY_FALLBACK: {
    branch: "origin/mac/tutor-v2-w2-authority-fallback-repair-r1",
    sourceCommit: "5ed021ed5cf239bf9b4d90b6baefed960565459a",
    cherryPickedCommit: "461f8298bafcd95b226f8abd76e184e2f58c5ad4",
    stablePatchId: "ee25597f03be72840f8417e1efdd506e85c0f79c",
  },
  W2_B2_HISTORY_SCOPE: {
    branch: "origin/mac/tutor-v2-w2-history-scope-repair-r1",
    sourceCommit: "28849cc7eeef76e9e6eeeb199375523e25317b0b",
    cherryPickedCommit: "ee572e7f4d655e101671ce36253c2121e04d7ff8",
    stablePatchId: "2caee0379c0a6bc7e5012557fc94a5c073e77f03",
  },
  W2_B3_MASTERY_ASSISTANCE: {
    branch: "origin/mac/tutor-v2-w2-mastery-assistance-repair-r1",
    sourceCommit: "76839746eebc60a1adf8e24a6daa68661a9adfa9",
    cherryPickedCommit: "07587f463565e0a0ddce46499ba010249e0319f3",
    stablePatchId: "8b2142f6b809abb7d7462bfb3a918a89bebca462",
  },
} as const;

const status = {
  statusVersion: 2,
  WAVE_2_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
  STUDY_ENGINE_REMAINS_AUTHORITY: true,
  STUDY_SAFETY_HOLD_STOPS_ALL_ADAPTIVE_SUBSYSTEMS: true,
  ADAPTIVE_SAFETY_METADATA_MUST_RECONCILE: true,
  ADAPTIVE_ACTION_PROPOSALS_REQUIRE_STUDY_ALLOWED_ACTION: true,
  INVALID_REQUEST_FALLBACK_USES_ONLY_TRUSTED_CANONICAL_REFS: true,
  HINT_HISTORY_IS_LEARNER_SESSION_CONTEXT_BOUND: true,
  INTERVENTION_HISTORY_IS_LEARNER_SESSION_CONTEXT_BOUND: true,
  CURRENT_OPPORTUNITY_IS_STUDY_BOUND: true,
  CURRENT_ASSISTANCE_IS_BOUND_TO_MASTERY_OPPORTUNITY: true,
  ASSISTED_CURRENT_OPPORTUNITY_CAN_COUNT_AS_INDEPENDENT: false,
  TUTOR_CAN_CHANGE_OFFICIAL_WORKING_LEVEL: false,
  TUTOR_CAN_CHANGE_NOMINAL_GRADE: false,
  TUTOR_CAN_DECLARE_OFFICIAL_MASTERY: false,
  TUTOR_CAN_ASSIGN_CURRICULUM: false,
  PREREQUISITE_REPAIR_IS_PROPOSAL_ONLY: true,
  RETEACH_IS_PROPOSAL_ONLY: true,
  PARENT_EXPLANATIONS_ARE_MINIMIZED_AND_NON_AUTHORITATIVE: true,
  RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED: false,
  UNREVIEWED_PROVIDER_FREE_FORM_LEARNER_OUTPUT_ALLOWED: false,
  PRODUCTION_WIRING_ENABLED: false,
  MASTER_MERGE_AUTHORIZED: false,
  HOSTED_SUPABASE_AUTHORIZED: false,
  BROWSER_AI_WIRING_AUTHORIZED: false,
  LIVE_MODEL_CERTIFICATION: false,
  PRODUCTION_DEPLOY_AUTHORIZED: false,
  STATIC_REVIEWED_CURRICULUM_FALLBACK_REQUIRED: true,
  CROSS_CHILD_CONTEXT_REUSE_ALLOWED: false,
  WAVE1_PROVIDER_AUTHORITY_GATE_REMAINS_CLOSED: true,
  WAVE1_STRUCTURAL_ANTI_ANSWER_GATE_REMAINS_CLOSED: true,
  WAVE1_PRIVACY_PROVENANCE_GATE_REMAINS_CLOSED: true,
  WAVE1_APPROVAL_DECISION_GATE_REMAINS_CLOSED: true,
  WAVE1_ACCEPTED_BASELINE_SHA: "94a8d2e1708d3346e905688c4f0f78a6ed4c4a95",
  W1_10R5_ACCEPTANCE_CLASSIFICATION: "WAVE1_ACCEPTED_WITH_INHERITED_FINDINGS",
  FINAL_CLASSIFICATION: gate.finalClassification,
};

const provenance = {
  provenanceVersion: 2,
  session: "STUDY-TUTOR-V2-W2-09R2 — Wave 2 Blocker Repair Reconvergence",
  branch: "mac/tutor-v2-w2-reconvergence-r2",
  startingSha: "8d618502a16a3d4d169143b539286a3b6fb5b925",
  acceptedWave1BaselineSha: "94a8d2e1708d3346e905688c4f0f78a6ed4c4a95",
  w1_10R5AcceptanceClassification: "WAVE1_ACCEPTED_WITH_INHERITED_FINDINGS",
  failedR1CandidateSha: "8d618502a16a3d4d169143b539286a3b6fb5b925",
  w2_10R1Classification: "WAVE2_HOLD_BLOCKING_FINDINGS",
  w2_10R1BlockingFindings: [
    "Study safety hold did not stop every adaptive subsystem.",
    "Study allowedActions was bypassed by hint, prerequisite repair, and reteach.",
    "Current hint assistance was not bound to the mastery evidence opportunity.",
    "Invalid input controlled supposedly reviewed fallback references.",
    "Hint and intervention history lacked child/session provenance.",
  ],
  cherryPickOrder: [
    ...Object.keys(lanes),
    "W2_B1_GLOBAL_AUTHORITY_FALLBACK",
    "W2_B2_HISTORY_SCOPE",
    "W2_B3_MASTERY_ASSISTANCE",
  ],
  lanes,
  repairs,
  r2Candidate: {
    status: "generated-for-independent-w2-10r2-rereview",
    exactShaRecordedAfterCommitInSessionReturn: true,
    selfReferencedInsideChecksummedArtifacts: false,
  },
  finalW2_10R2Required: true,
  verification: {
    allRemoteTipsExact: true,
    baseIsDirectParentForEveryLane: true,
    mergeCommitsInLaneRanges: 0,
    stablePatchIdsExact: true,
    unrepairedLaneTreesExactAndRepairSupersessionsVerified: true,
    convergenceOwnershipPassed: true,
    repairRemoteTipsExact: true,
    repairDirectParentsAreFailedR1Candidate: true,
    repairStablePatchIdsExact: true,
  },
};

const restrictions = {
  restrictionVersion: 1,
  candidateOnly: true,
  productionWiringEnabled: false,
  masterMergeAuthorized: false,
  productionDeployAuthorized: false,
  hostedSupabaseAuthorized: false,
  browserAiWiringAuthorized: false,
  liveModelCertification: false,
  persistenceAdapterIncluded: false,
  notificationDeliveryIncluded: false,
  providerOrVendorAdapterIncluded: false,
  durableReplayLedgerIncluded: false,
  permittedUse: [
    "local deterministic tests",
    "independent final rereview",
    "schema and release evidence verification",
  ],
};

const limitations = {
  limitationsVersion: 1,
  inherited: [
    {
      code: "OBSOLETE_BROAD_PLATFORM_VALIDATOR",
      detail: "The broad legacy validator remains 18/19 because its platform-boundary substring rule flags accepted authority paths and generated output.",
    },
    {
      code: "SESSION6_ARCHIVES_NOT_MOUNTED",
      detail: "Four external Session 6 archives were not mounted; the reconstructed frozen source built and 35 executable Study Core Bridge tests passed, while one archive checksum test skipped.",
    },
    {
      code: "INHERITED_DEPENDENCY_ADVISORIES",
      detail: "Three existing high advisories affect @playwright/test, playwright, and nanoid in unchanged Study runtime manifests.",
    },
    {
      code: "NON_SELF_REFERENTIAL_CANDIDATE_SHA",
      detail: "As in Wave 1, the exact final candidate SHA is recorded after commit in the session return rather than self-referenced inside checksummed generated artifacts, preserving deterministic regeneration.",
    },
  ],
  candidate: [
    {
      code: "FINAL_INDEPENDENT_REREVIEW_REQUIRED",
      detail: "Wave 2 remains incomplete until detached review of the exact final candidate SHA.",
    },
    {
      code: "REFERENCE_REPLAY_LEDGER_ONLY",
      detail: "The included replay ledger is in-memory test/reference infrastructure; durable production persistence is intentionally absent.",
    },
    {
      code: "REFERENCE_ONLY_REVIEWED_CONTENT",
      detail: "Composition returns reviewed content references and reviewed Parent copy; no learner-facing production delivery path is wired.",
    },
    {
      code: "NO_LIVE_MODEL_CERTIFICATION",
      detail: "No live model or commercial web runtime certification was performed.",
    },
  ],
};

const gateSummary = {
  summaryVersion: 1,
  finalClassification: gate.finalClassification,
  hardGateFamilyCount: gate.hardGateFamilies.length,
  hardGateFamiliesPassed: gate.hardGateFamilies.filter(({ status }) => status === "PASS").length,
  counts: gate.counts,
  inheritedFindings: gate.checks
    .filter(({ status }) => status === "INHERITED_FINDING" || status === "NOT_AVAILABLE")
    .map(({ name, status: checkStatus, detail }) => ({ name, status: checkStatus, detail })),
};

const outputs = new Map<string, string>([
  ["STATUS.json", serialize(status)],
  ["PROVENANCE.json", serialize(provenance)],
  ["PRODUCTION-RESTRICTIONS.json", serialize(restrictions)],
  ["KNOWN-LIMITATIONS.json", serialize(limitations)],
  ["GATE-SUMMARY.json", serialize(gateSummary)],
  ["SCHEMA-INVENTORY.json", serialize(schemaInventory)],
  ["WAVE2-GATE-RESULT.json", serialize(JSON.parse(gateText))],
]);

const manifest = {
  manifestVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 2 R2 Adaptive Intelligence Candidate",
  finalClassification: gate.finalClassification,
  wave2Complete: false,
  finalIndependentRereviewRequired: true,
  artifacts: [...outputs.keys(), "MANIFEST.json", "CHECKSUMS.json"].sort(),
};
outputs.set("MANIFEST.json", serialize(manifest));
const checksums = Object.fromEntries(
  [...outputs.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([file, content]) => [file, sha256(content)]),
);
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
    throw new Error(`Wave 2 release inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Wave 2 release drift detected: ${file}`);
  }
  process.stdout.write(`PASS wave2-release-check ${outputs.size} artifacts\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(resolve(outputDirectory, file), content, "utf8");
  }
  process.stdout.write(`PASS wave2-release-generation ${outputs.size} artifacts\n`);
}

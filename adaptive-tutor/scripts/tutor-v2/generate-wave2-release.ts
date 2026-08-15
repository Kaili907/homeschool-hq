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
if (gate.finalClassification !== "WAVE2_R4_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS") {
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
  statusVersion: 4,
  WAVE_2_COMPLETE: false,
  WAVE_3_AUTHORIZED_BY_TECHNICAL_ACCEPTANCE: false,
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
  SINGLE_COHERENT_ADAPTIVE_ACTION_REQUIRED: true,
  DECISION_PROVENANCE_REQUIRED_ON_PENDING_PACKETS: true,
  COMPLETED_REVIEW_PERMISSION_IS_STRUCTURED_AND_SCOPE_BOUND: true,
  PARENT_WHY_COPY_IS_CLOSED_AND_STUDY_VISIBILITY_BOUND: true,
  MISCONCEPTION_CODE_IS_BOUNDED_ACADEMIC_VOCABULARY: true,
  TUTOR_RECOMMENDATION_IS_ADVISORY: true,
  STUDY_PROGRESSION_DECISION_REQUIRED: true,
  TUTOR_CAN_COMPLETE_STUDY_SEGMENT: false,
  W2_TRUST_BOUNDARY_ADJUDICATION_COMPLETE: true,
  W2_SERIALIZED_BOUNDARY_BLOCKER_FOUND: true,
  WAVE2_SERIALIZED_SCHEMA_COUNT: 2,
  WAVE2_INTERNAL_PORT_SCHEMAS_GENERATED: 0,
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
  provenanceVersion: 4,
  session: "STUDY-TUTOR-V2-W2-09R4 — Full Wave 2 Post-Audit Repair Reconvergence",
  branch: "mac/tutor-v2-w2-reconvergence-r4",
  startingB4Sha: "22c3734bd436c41ba8d24409dcaa146d35914e2f",
  acceptedWave1BaselineSha: "94a8d2e1708d3346e905688c4f0f78a6ed4c4a95",
  failedR1CandidateSha: "8d618502a16a3d4d169143b539286a3b6fb5b925",
  w2_10R1Classification: "WAVE2_HOLD_BLOCKING_FINDINGS",
  failedR2CandidateSha: "a251987b28909e827c0af0ee8bbeea668522459f",
  w2_10R2Classification: "WAVE2_HOLD_BLOCKING_FINDINGS",
  b4Sha: "22c3734bd436c41ba8d24409dcaa146d35914e2f",
  lanes,
  earlierRepairs: repairs,
  postAuditRepairCherryPickOrder: [
    "W2_B5", "W2_B6", "W2_B13", "W2_B7", "W2_B8",
    "W2_B9", "W2_B10", "W2_B11", "W2_B12",
  ],
  postAuditRepairs: {
    W2_B5: { sourceCommit: "c9601aa99bca89ff0673ee6e00858fafa98c70c2", cherryPickedCommit: "9e89a86bf292108276742cf2ebc3a04432e3d4b2", stablePatchId: "1788de549e684b7e9bb3655a1cfc184b842405c3" },
    W2_B6: { sourceCommit: "67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c", cherryPickedCommit: "7c3320cbc899f79c8206de2435517cc4185c83fe", stablePatchId: "a2f745921d05e630a5bf93f1c90cbdc85d6c861d" },
    W2_B13: { sourceCommit: "097ada4fe024f7eed7a50038d13801e45b990b62", sourceParent: "67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c", cherryPickedCommit: "a11608d5de30d973785482b2d7169152c42e31ca", stablePatchId: "e60b439f91424e425181d24414dc9ced30dabd4e" },
    W2_B7: { sourceCommit: "9a6a6a2a851ee5513bc6ddab694e41c1d78cd5f5", cherryPickedCommit: "0f6f3e827ab4be2ed7a57ebddc7cf5e8db179228", stablePatchId: "ee90ea7ec82fda08769113978964090a5d26a553" },
    W2_B8: { sourceCommit: "a907f115894358a5d18b3ead1b361cbab8679390", cherryPickedCommit: "19e23646c7cc45ecb176976c3ed731b1163cfbff", stablePatchId: "bde79ff946a13eda529e6127d32b0544c36671ab" },
    W2_B9: { sourceCommit: "367b8f5450510b3e7037cd2ccf32cac1cac79b6a", cherryPickedCommit: "15ae6c42a89557b23614f6e611e912c44122f225", stablePatchId: "a85bf0573e4d4e4cd03e6dbada26c82a507af1d5" },
    W2_B10: { sourceCommit: "32fd30a7d3aa3b500e3dbaa53a8aa3715fbd9cde", cherryPickedCommit: "783ebb3216a9e7a5919f281fe8f10742bdd0f740", stablePatchId: "c4ec4ed6c14851dda6c77c037a996379fae22fee" },
    W2_B11: { sourceCommit: "5d282f08a5cfbc75e7804dbf461812f218e8db3d", cherryPickedCommit: "dacd2fe203fa93df61e772ce2346395b7c6e507c", stablePatchId: "0955e9b74bb113abaa47fa244eca9a8b36b00a96" },
    W2_B12: { sourceCommit: "c07db50067776457a6eef96f0c2a38b601177031", cherryPickedCommit: "24b604ac4fc72ea49943fff752a5da5c6e5f4125", stablePatchId: "aacfdda8fe7564e6a84437c8b715317ab71b5c1e" },
  },
  trustBoundaryAdjudication: "W2_TRUST_BOUNDARY_ADJUDICATION_COMPLETE",
  serializedBoundaryAdjudication: {
    ruling: "W2_SERIALIZED_BOUNDARY_BLOCKER_FOUND",
    generatedSchemaCount: 2,
    internalPortSchemasGenerated: 0,
  },
  externalStudyProgressionAuthorityRepair: {
    learnerReleaseBaseline: "7baf8dfbc27168708ed4cf504285a1838d7345f6",
    repairSha: "527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4",
    classification: "STUDY_RUNTIME_TUTOR_AUTHORITY_PORT_READY_FOR_TUTOR_CROSS_LINE_R4",
    containedInTutorCandidate: false,
  },
  r4Candidate: {
    status: "generated-for-independent-w2-10r4-rereview",
    exactShaRecordedAfterCommitInSessionReturn: true,
    selfReferencedInsideChecksummedArtifacts: false,
  },
  finalW2_10R4Required: true,
  verification: {
    remoteTipsExact: true,
    sourceParentsExact: true,
    stablePatchIdsExact: true,
    repairOwnershipExact: true,
    convergenceOwnershipPassed: true,
    externalStudyAuthorityPortVerifiedAsSeparateArtifact: true,
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
  externalStudyAuthorityPortContained: false,
  tutorMayCompleteStudySegment: false,
  studyProgressionDecisionRequired: true,
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
    {
      code: "WAVE3_PROVIDER_HARDENING",
      detail: "Broad lower-level provider raw-attempt contract width remains a Wave 3 hardening requirement; accepted Wave 1 supported routes reject current learner attempts before provider execution.",
    },
    {
      code: "EXTERNAL_STUDY_AUTHORITY_PORT_SEPARATE",
      detail: "The verified learner-line Study progression authority repair is a separate integration artifact and is not contained in this Tutor candidate.",
    },
  ],
};

const gateSummary = {
  summaryVersion: 4,
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
  manifestVersion: 4,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 2 R4 Post-Audit Repair Candidate",
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

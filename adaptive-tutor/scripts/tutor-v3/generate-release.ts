import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("tutor-v2-wave3-release");
const checkOnly = process.argv.includes("--check");

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

const hardGateText = await readFile(resolve(outputDirectory, "HARD-GATE-RESULT.json"), "utf8");
const hardGate = JSON.parse(hardGateText) as {
  readonly aggregateStatus: string;
  readonly hardGateFamilyCount: number;
  readonly hardGateFamiliesPassed: number;
  readonly hardGateAdequacyFamilyCount: number;
  readonly hardGateAdequacyFamiliesPassed: number;
  readonly hardGateAdequacyAggregateStatus: string;
};
const mutationText = await readFile(resolve(outputDirectory, "MUTATION-EVIDENCE.json"), "utf8");
const mutation = JSON.parse(mutationText) as {
  readonly aggregateStatus: string;
  readonly mutationEvidenceVersion: number;
  readonly mutationKind: string;
  readonly booleanEvidenceFlipOnly: boolean;
  readonly mutationCount: number;
  readonly qualifyingMutationCount: number;
  readonly compileValidMutationCount: number;
  readonly compileValidMutations: number;
  readonly killed: number;
  readonly survived: number;
  readonly invalidMutants: number;
  readonly baselineBlocked: number;
};
if (
  hardGate.aggregateStatus !== "PASS" ||
  hardGate.hardGateFamilyCount !== 18 ||
  hardGate.hardGateFamiliesPassed !== 18 ||
  hardGate.hardGateAdequacyFamilyCount !== 18 ||
  hardGate.hardGateAdequacyFamiliesPassed !== 18 ||
  hardGate.hardGateAdequacyAggregateStatus !== "PASS"
) {
  throw new Error("Wave 3 hard gates must pass before release evidence generation.");
}
if (
  mutation.aggregateStatus !== "PASS" ||
  mutation.mutationEvidenceVersion < 2 ||
  mutation.mutationKind !== "implementation" ||
  mutation.booleanEvidenceFlipOnly ||
  mutation.mutationCount !== 18 ||
  mutation.qualifyingMutationCount !== 18 ||
  mutation.compileValidMutationCount !== 18 ||
  mutation.compileValidMutations !== 18 ||
  mutation.killed !== 18 ||
  mutation.survived !== 0 ||
  mutation.invalidMutants !== 0 ||
  mutation.baselineBlocked !== 0
) {
  throw new Error("Wave 3 mutation proof must kill every mutation before release generation.");
}

const schemaInventoryText = await readFile(resolve("json-schema/v3/wave3/SCHEMA-INVENTORY.json"), "utf8");
const schemaInventory = JSON.parse(schemaInventoryText) as {
  readonly generatedSchemaCount: number;
  readonly internalPortSchemasGenerated: number;
};
const boundaryInventoryText = await readFile(
  resolve("../docs/study-tutor-v2/wave3/SERIALIZED-BOUNDARY-INVENTORY.json"),
  "utf8",
);

const imports = {
  W3_01: { sourceSha: "96aa35bc110439f7b2d48712d209e7c75671880d", resultingSha: "40ad0a90dc3899c0a2215189c3ac8946b69f0f9b", stablePatchId: "d5f0219ffb0dac36a5f9b52e1010e53038d54e4f" },
  W3_02: { sourceSha: "f71cc584e4a52b4bea079e8fc91a7d05059addc4", resultingSha: "2238ffc8147004af9009192d84e98cae0fef3fe2", stablePatchId: "8a25e52b60e116fa99591c210127e4ef6b06adc7" },
  W3_03: { sourceSha: "7e7d2a7c833e9cfb9b779f4deda9173dce79f314", resultingSha: "7431f151dd769c871ddabb755be00036d57d7799", stablePatchId: "47428eb11265f55f9ec8609590dc6bcf2c242bcd" },
  W3_04: { sourceSha: "8d9fd119d2ca1930e7b41fc68318577ce8079a28", resultingSha: "c9bf72d2afc1dbbfb1896dc9391bc8b893df76cb", stablePatchId: "ee46e4d1fb083d1baff02352c2e3a75d3939e16d" },
  W3_05: { sourceSha: "71752a25748429d1e54b58b136e1d6bfda9c82d5", resultingSha: "14ba94801ed0dbaf9763b323d15b357423b543f1", stablePatchId: "48af45e68d88ede11656b8a54f33281c17264a81" },
  W3_06: { sourceSha: "a9f15ac3019fb235bc34f49c841eb408ef9f1d23", resultingSha: "f40658534165e38b9dc6df0c491a5db973618fd5", stablePatchId: "6aee53674e4442eb7aa285b846ad7ea52a2f1c37" },
  W3_07: { sourceSha: "1dfc1d4f17d81d3950f46b3c9c7a939fcfc0c4f0", resultingSha: "33065d188aee32b17225292d4a8d73c6ba810716", stablePatchId: "1258ba6560e98968b5455a3d86aec95f9506c9e4" },
  W3_08: { sourceSha: "6dd0cc6027d74ad57f8f4b8f0aa39f89ddd3b4bd", resultingSha: "4d4076f15df72d3888d10726638da40bf7f479e4", stablePatchId: "cddd52eda04a5a2c9de15315d5d49b4649a84c13" },
  W3_09: { sourceSha: "76c81e6a51cbdf19a4e9ca4b25e506c2305e2bc1", resultingSha: "f606c266fd28daf4a1657cd8e19311c54af12c66", stablePatchId: "5324c6d2d60321666f7617eebfb2c40bf59e9105" },
  W3_10: { sourceSha: "0692bd3a98bcd904ba3872a5580aced4e96e4691", resultingSha: "0bc23921b0cdd8f9a9103049bc77ac36ffe43e40", stablePatchId: "3459f12055db9ef13470d1a1b2156091123f6f7c" },
  W3_11: { sourceSha: "81506a3032cbbd0c6f1a65d7cb8105a4693ab050", resultingSha: "794f4fa3162615a9f469b724c43afc6d37eb018c", stablePatchId: "9f7714dcd56fe7bf6fa18b12a9863f7482354be9" },
  W3_12: { sourceSha: "8c6c093632ff48551267dfa1b2846472f29335bf", resultingSha: "70ea1d5a01e5035d0bb6065c930274d066733b72", stablePatchId: "a3b140021b7f119e94438d96b7450646cc4ede06" },
  R1: { sourceSha: "87fd6dc45db50b1a8ac4bd6cf5b39c066f25a588", resultingSha: "98d071cbe82041b12471c43067d789fd259f04ff", stablePatchId: "9d9fabcbcdc2e18ac1db17b9d72f5fdfa84f4dd7" },
  R2: { sourceSha: "f73d0dd0f8fd769be9941e7ab97127951b31c33f", resultingSha: "48a128f51c559ab6f7547bf3f9056713ae269850", stablePatchId: "b0341aaa9354b54ca82e74a0813b2f3cfa031cc4" },
  R3: { sourceSha: "21a655f8d4c43bc17b93be84755177f8e6c6c3dc", resultingSha: "f65a8fb04e2b6a16f1b4835f4f291c2251b3bbe7", stablePatchId: "f4c698631e46d97635a0368aee0cd2db808f4ffa" },
  R4: { sourceSha: "b67871cea514288b3c2a18ab13b0756f55867cdc", resultingSha: "abb48c69d1f70cf13834faa65595ad8e674d294c", stablePatchId: "9ef9745470adfb4755551a251bd5e5b02491856c" },
  R5: { sourceSha: "7b7e3fa1eda061250728aab3c78f7c5bff0b19cb", resultingSha: "6793246cb5413cbcca1f13a263fb4f3c738e3f81", stablePatchId: "2c3de65ec4e768b2feebb8336b041fa1f6901c38" },
  R6: { sourceSha: "19385d5321ce62609d9b709c1bdce569f16b6eff", resultingSha: "8d6cd5f7fa4d434c014a6044f4bf6b79a6595871", stablePatchId: "78fa1075619f9befcc2b073132be009dec780bfd" },
  R7: { sourceSha: "8b07eb5f61a7c744a8073534e8e5e2873c457743", resultingSha: "c7592ff56dab4bc585c229f679e159f5d19862d9", stablePatchId: "1535db49e78b2d818e51b6fba491d832bba31065" },
} as const;

const repairImports = {
  B1: {
    sourceSha: "dfc512283ad1e7194558bdddb5debb2c0f8c7589",
    resultingSha: "dfc512283ad1e7194558bdddb5debb2c0f8c7589",
    stablePatchId: "f3f73ee52b210d1f4e68adf13269715f9862de6e",
    ruling: "STARTING_B1_PRESERVED_NOT_REIMPORTED",
  },
  B2: {
    sourceSha: "add32beacaabe7b2d81ad48095fd2f4c3508a763",
    resultingSha: "cc1a89da82719666c5c3a78344cb1173a99a27cc",
    stablePatchId: "72ed3dea2f79ef2bf47bdae84943ddd979139dc6",
    ruling: "IMPORTED_EXACTLY_ONCE_PATCH_ID_MATCH",
  },
  B3_1: {
    sourceSha: "ef22278b5b402a43af042dfa5cb1ef1b28e2a6cc",
    resultingSha: "99e6d6d209a788baabdc3b948b1bf938d184ce15",
    stablePatchId: "6303f3922b581f274d4a8022965f59bc7d5f26c5",
    ruling: "IMPORTED_EXACTLY_ONCE_PATCH_ID_MATCH",
  },
  B3_2: {
    sourceSha: "b29ff3dde5d678c0db44ee053990a963d69875e1",
    resultingSha: "0bd3d655622833b83dc94daf3c6272ff1dd1d825",
    stablePatchId: "6b11ed244a3be268d4298906171ddafc6d6d78af",
    ruling: "IMPORTED_EXACTLY_ONCE_PATCH_ID_MATCH",
  },
} as const;

const status = {
  statusVersion: 2,
  WAVE_3_COMPLETE: false,
  WAVE_4_AUTHORIZED_BY_TECHNICAL_ACCEPTANCE: false,
  FINAL_WAVE3_INDEPENDENT_REREVIEW_REQUIRED: true,
  STUDY_ENGINE_REMAINS_AUTHORITY: true,
  TUTOR_RECOMMENDATION_IS_ADVISORY: true,
  STUDY_PROGRESSION_DECISION_REQUIRED: true,
  TUTOR_CAN_COMPLETE_STUDY_SEGMENT: false,
  RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED: false,
  NOT_AUTHORIZED_FOR_PRODUCTION_DEPLOYMENT: true,
  NOT_AUTHORIZED_FOR_MASTER_MERGE: true,
  NOT_AUTHORIZED_FOR_HOSTED_SUPABASE: true,
  NOT_AUTHORIZED_FOR_BROWSER_AI_WIRING: true,
  NOT_AUTHORIZED_FOR_LIVE_PROVIDER_EXECUTION: true,
  FINAL_CLASSIFICATION: "WAVE3_R2_CANDIDATE_READY_FOR_FINAL_REREVIEW_WITH_INHERITED_FINDINGS",
};

const provenance = {
  provenanceVersion: 2,
  session: "STUDY-TUTOR-V2-W3-15 Post-W3-14 Repair Reconvergence",
  branch: "mac/tutor-v2-w3-reconvergence-r2",
  startingB1Sha: "dfc512283ad1e7194558bdddb5debb2c0f8c7589",
  failedWave3CandidateSha: "4ea58cfb4346c579fd6a18898dd48d491e5cd8fd",
  acceptedWave2Sha: "e8d852c3fa374abb8f5cb93b7ecbddc1786671b2",
  wave2Classification: "WAVE2_ACCEPTED_FOR_WAVE3",
  originalConvergenceImportOrder: Object.keys(imports),
  imports,
  repairImportOrder: Object.keys(repairImports),
  repairImports,
  duplicateImportPrevention: "PASS_B1_START_NOT_REIMPORTED_B2_ONCE_B3_COMMITS_ONCE",
  semanticCherryPickAdaptations: [],
  repairConflictRuling: "NO_CHERRY_PICK_CONFLICTS_NO_SEMANTIC_ADAPTATIONS_REQUIRED",
  convergenceAdaptations: [
    "R7 presentation test fixture was updated after import to the accepted R2 provider-policy catalog and immutable route identity APIs; production R2 and R7 meanings are both preserved.",
  ],
  externalStudyProgressionAuthorityRepair: {
    learnerReleaseBaseline: "7baf8dfbc27168708ed4cf504285a1838d7345f6",
    repairSha: "527e1c0ddbc4cb1f7a2ba15dec79ea90f5e9e0c4",
    branch: "mac/study-runtime-tutor-authority-port-r2",
    containedInTutorCandidate: false,
    ruling: "SEPARATE_VERIFIED_STUDY_AUTHORITY_ARTIFACT_NOT_MERGED",
  },
  finalCandidate: {
    exactShaRecordedAfterCommitInSessionReturn: true,
    selfReferencedInsideChecksummedArtifacts: false,
  },
};

const limitations = {
  limitationsVersion: 2,
  inherited: [
    { code: "OBSOLETE_BROAD_PLATFORM_VALIDATOR", detail: "The accepted inherited broad platform-boundary validator remains 18/19 because its obsolete substring rule flags accepted authority paths/generated output." },
    { code: "INHERITED_DEPENDENCY_ADVISORIES", detail: "Three inherited high advisories remain for @playwright/test, playwright, and nanoid; manifests are unchanged." },
    { code: "SESSION6_ARCHIVES_NOT_MOUNTED", detail: "Four frozen Session 6 archives remain unavailable; current executable bridge tests are used without replacing archive checksum evidence." },
  ],
  deferred: [
    "durable production persistence for budgets, telemetry, and replay",
    "live provider credentials, transports, pricing, and availability feeds",
    "Parent Hub UI and notification delivery",
    "browser multimodal capture and TTS/STT vendor wiring",
    "production curriculum-registry adapter",
    "commercial deployment and security convergence",
    "live stochastic model certification",
    "Wave 4 adversarial campaigns",
  ],
};

const testEvidence = {
  evidenceVersion: 2,
  nodeVersion: "22.23.2",
  focusedLaneCounts: {
    W3_01: 12, W3_02: 23, W3_03: 32, W3_04: 17, W3_05: 12, W3_06: 9,
    W3_07: 26, W3_08: 13, W3_09: 11, W3_10: 15, W3_11: 22, W3_12: 13,
    R1: 8, R2: 59, R3: 28, R4: 12, R5: 22, R6: 26, R7: 13,
  },
  repairFocusedCounts: {
    B1_OPERATION_INTEGRITY: 90,
    B2_SCHEMA_FOCUSED: 5,
    B3_BASELINE_COMMANDS: 8,
  },
  wave3ConvergenceTests: 33,
  fullUniqueWave3RegressionTests: 274,
  hardGateFamilies: hardGate.hardGateFamilyCount,
  hardGateAdequacyFamilies: hardGate.hardGateAdequacyFamilyCount,
  mutationProof: `${mutation.killed}/${mutation.mutationCount} killed`,
  mutationEvidenceVersion: mutation.mutationEvidenceVersion,
  mutationKind: mutation.mutationKind,
  booleanEvidenceFlipOnly: mutation.booleanEvidenceFlipOnly,
  compileValidMutations: mutation.compileValidMutationCount,
  survivedMutations: mutation.survived,
  invalidMutations: mutation.invalidMutants,
  baselineBlocked: mutation.baselineBlocked,
  schemaCount: schemaInventory.generatedSchemaCount,
  internalPortSchemaCount: schemaInventory.internalPortSchemasGenerated,
  fullValidationRecordedInSessionReturn: true,
};

const restrictions = {
  restrictionVersion: 1,
  candidateOnly: true,
  productionWiringEnabled: false,
  providerTransportKind: "injected-interface-only",
  liveProviderEnabled: false,
  credentialsIncluded: false,
  vendorSdkIncluded: false,
  networkEndpointIncluded: false,
  masterMergeAuthorized: false,
  productionDeployAuthorized: false,
  hostedSupabaseAuthorized: false,
  browserAiWiringAuthorized: false,
  externalStudyAuthorityRepairContained: false,
};

const outputs = new Map<string, string>([
  ["STATUS.json", serialize(status)],
  ["KNOWN-LIMITATIONS.json", serialize(limitations)],
  ["SOURCE-PROVENANCE.json", serialize(provenance)],
  ["HARD-GATE-RESULT.json", hardGateText],
  ["SCHEMA-INVENTORY.json", serialize(schemaInventory)],
  ["TEST-EVIDENCE.json", serialize(testEvidence)],
  ["MUTATION-EVIDENCE.json", mutationText],
  ["COMMERCIAL-BOUNDARY-INVENTORY.json", serialize(JSON.parse(boundaryInventoryText))],
  ["PRODUCTION-RESTRICTIONS.json", serialize(restrictions)],
]);
outputs.set("MANIFEST.json", serialize({
  manifestVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 3 Post-Review Repair Reconvergence",
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
    throw new Error(`Wave 3 release inventory differs: expected ${expectedFiles.join(", ")}; found ${actualFiles.join(", ")}`);
  }
  for (const [file, expected] of outputs) {
    const actual = await readFile(resolve(outputDirectory, file), "utf8");
    if (actual !== expected) throw new Error(`Wave 3 release drift detected: ${file}`);
  }
  process.stdout.write(`PASS wave3-release-check ${outputs.size} artifacts\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(resolve(outputDirectory, file), content, "utf8");
  }
  process.stdout.write(`PASS wave3-release-generation ${outputs.size} artifacts\n`);
}

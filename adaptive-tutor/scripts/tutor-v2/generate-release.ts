import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  TUTOR_ACTION_KINDS,
  TUTOR_V2_ACTION_COMPATIBILITY_ID,
  TUTOR_V2_ACTION_SCHEMA_VERSION,
  TUTOR_V2_COMPATIBILITY_ID,
  TUTOR_V2_CONTRACT_VERSION,
} from "../../core/v2/contracts/index.js";
import { FOUNDATION_SCENARIOS } from "../../evals/v2/corpus/foundation/index.js";
import {
  HARD_GATE_DIMENSIONS,
  runFoundationEvaluation,
} from "../../evals/v2/framework/src/index.js";
import {
  TUTOR_V2_BRIDGE_EVENT_VERSION,
  TUTOR_V2_BRIDGE_VERSION,
} from "../../study-engine/bridges/tutor-v2/index.js";

const outputDirectory = resolve("tutor-v2-release");
const checkOnly = process.argv.includes("--check");
const schemaInventoryPath = resolve("json-schema/v2/SCHEMA-INVENTORY.json");
const gateResultPath = resolve(outputDirectory, "WAVE1-GATE-RESULT.json");

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

const schemaInventoryText = await readFile(schemaInventoryPath, "utf8");
const schemaInventory = JSON.parse(schemaInventoryText) as {
  readonly generatedSchemaCount: number;
  readonly schemas: readonly { readonly file: string; readonly source: string; readonly sha256: string }[];
};
const gateResultText = await readFile(gateResultPath, "utf8");
const gateResult = JSON.parse(gateResultText) as {
  readonly foundationGate: string;
  readonly finalClassification: string;
  readonly releaseReady: boolean;
};
const evaluation = runFoundationEvaluation(FOUNDATION_SCENARIOS);
if (evaluation.classification !== "FOUNDATION_GATE_PASS" || evaluation.releaseReady !== false) {
  throw new Error("Foundation evaluation did not retain its accepted Wave 1 classification.");
}

const provenance = {
  provenanceVersion: 5,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 1 Foundation",
  immutableLearnerBaseline: "7baf8dfbc27168708ed4cf504285a1838d7345f6",
  accepted: {
    W1_01: "9e30d59f64184e89db493a004e738e859b06a686",
    W1_02: "660de6a445ca66b8de5136a6ee388804346dce4b",
    OWNERSHIP_ADJUDICATION: "f79271ac2cc57e9128ee61774a4f082c35c6fa77",
    W1_03: "ee6cc83fdaa43fe733d05abefdaedffe3d0febf9",
    W1_04: "befb91bb2321aec0449d2d8e613619a592feb76c",
    W1_05: "4a8bded7bc0caf5ff647dae814e011d20c8ae5bf",
    W1_06: "b93765552d60a88ac7691ca7840dfc2ae3a23e77",
    W1_07: "9b959ab7e8176ebccb4fd3ca7b54bf5584602b35",
    W1_08: "31d5609527f75a11d9d3017ce0f07b3ec1c99b88",
  },
  rejectedCandidates: {
    W1_09: {
      sha: "16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d",
      independentRuling: "W1_10_HOLD_PROVIDER_BOUNDARY",
      acceptedAsWave1Release: false,
    },
    W1_09R2: {
      sha: "2c8716ed5db5bb824fc92533615295f0b163f7b2",
      independentRuling: "W1_10R2_HOLD_SEMANTIC_ANTI_ANSWER_BYPASS",
      acceptedAsWave1Release: false,
    },
    W1_09R3: {
      sha: "7435f820dc9e141d8a113b4d7f853044e36ba51d",
      independentRuling: "W1_10R3_HOLD_LEXICAL_PRIVACY_BOUNDARY",
      acceptedAsWave1Release: false,
    },
  },
  acceptedRepairs: {
    PROVIDER_BOUNDARY_REPAIR: {
      sha: "d7aa9720b8096205acc0b63d21a895d8fc16de6f",
      directParent: "16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d",
      branch: "origin/mac/tutor-v2-w1-provider-boundary-repair-r1",
    },
    STRUCTURAL_ANTI_ANSWER_REPAIR: {
      sha: "9f0b66be0b7f86b2004f05137ef9892d2a3ef09a",
      directParent: "2c8716ed5db5bb824fc92533615295f0b163f7b2",
      branch: "origin/mac/tutor-v2-w1-anti-answer-repair-r2",
    },
    REVIEWED_CONTENT_PRIVACY_PROVENANCE_REPAIR: {
      sha: "cf7ee7265c812a86b708b0e8cf2a33e6370e753d",
      directParent: "7435f820dc9e141d8a113b4d7f853044e36ba51d",
      branch: "origin/mac/tutor-v2-w1-privacy-provenance-repair-r3",
    },
    APPROVAL_DECISION_STRUCTURAL_VALIDATION_REPAIR: {
      sha: "cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841",
      directParent: "6f90d351d759c697788b6489bd465d954ce52184",
      branch: "origin/mac/tutor-v2-w1-approval-decision-repair-r4",
    },
  },
  reconvergenceHistory: {
    W1_09R2: {
      sha: "2c8716ed5db5bb824fc92533615295f0b163f7b2",
      branch: "origin/mac/tutor-v2-w1-reconvergence-r2",
      independentRuling: "W1_10R2_HOLD_LEXICAL_ANTI_ANSWER_BOUNDARY",
      acceptedAsWave1Release: false,
    },
    W1_09R3: {
      session: "STUDY-TUTOR-V2-W1-09R3",
      branch: "mac/tutor-v2-w1-reconvergence-r3",
      sha: "7435f820dc9e141d8a113b4d7f853044e36ba51d",
      startingRepairSha: "9f0b66be0b7f86b2004f05137ef9892d2a3ef09a",
      independentRuling: "W1_10R3_HOLD_LEXICAL_PRIVACY_BOUNDARY",
      acceptedAsWave1Release: false,
    },
    W1_09R4: {
      session: "STUDY-TUTOR-V2-W1-09R4 — Final Wave 1 Privacy Provenance Reconvergence",
      branch: "mac/tutor-v2-w1-reconvergence-r4",
      sha: "6f90d351d759c697788b6489bd465d954ce52184",
      startingRepairSha: "cf7ee7265c812a86b708b0e8cf2a33e6370e753d",
      status: "SUPERSEDED_BY_APPROVAL_DECISION_REPAIR",
      acceptedAsWave1Release: false,
    },
    W1_10R4_ATTEMPTED_REVIEW: {
      custodyStatus: "INVALID",
      acceptedAsAcceptanceEvidence: false,
      reason: "The detached reviewer modified the canonical detached review worktree, so custody was broken and that review cannot serve as Wave 1 acceptance evidence.",
      canonicalR4BranchModified: false,
      reproducedBlockerBeforeTermination: true,
      reproducedBlocker: "MALFORMED_APPROVAL_DECISION_NORMALIZED_INTO_VALID_LOOKING_APPROVAL_BEFORE_VALIDATION",
      reproducedBlockerWasReal: true,
      repairedBy: "cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841",
    },
    W1_09R5: {
      session: "STUDY-TUTOR-V2-W1-09R5 — Final Wave 1 Approval-Decision Reconvergence",
      branch: "mac/tutor-v2-w1-reconvergence-r5",
      startingRepairSha: "cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841",
      status: "CANDIDATE_REQUIRES_W1_10R5_FINAL_INDEPENDENT_REREVIEW",
      acceptedAsWave1Release: false,
    },
  },
  recordedW1_08IntegrationCommits: {
    W1_03: "4cf4bda1c99d0490136f3e53d9c412050166b9ff",
    W1_04: "7a1a12cfe36d6c19657977a07d05f8ecfbff9c5e",
    W1_05: "c7156bc34baccb06dd911519fc29c45bd5782223",
    W1_06: "42c91482102842d3c22cde489dbbf8f73124c17e",
    W1_07: "5a6a191c922c42c5320faf49e2c97f89ada8093e",
  },
  stablePatchIds: {
    W1_03: "ea279d423d6e36928ed4bb03946c6839aa283bd2",
    W1_04: "df59c210e417c3d14fa0c63d841f7750e1d6be14",
    W1_05: "8e389743994665e5608b8c5b3c2cb5665f7005b5",
    W1_06: "2a7d297c95cb4521fc0b75ade8648bc3f37dec09",
    W1_07: "c3c29d0d4a4482d666112c8952ffa26499fa9923",
  },
  verification: {
    canonicalRemoteTipsExact: true,
    acceptedLaneTreesEquivalent: true,
    ownershipAdjudicationPresent: true,
    providerBoundaryRepairPresent: true,
    structuralAntiAnswerRepairPresent: true,
    providerMutationGatesPermanent: true,
    structuralAntiAnswerGatesPermanent: true,
    reviewedContentPrivacyRepairPresent: true,
    reviewedContentPrivacyGatesPermanent: true,
    regexNeutralizedPrivacyValidationRequired: true,
    approvalDecisionStructuralRepairPresent: true,
    approvalDecisionStructuralGatesPermanent: true,
    w1_10R4ReviewCustodyInvalidated: true,
    w1_10R4ReproducedBlockerWasRealAndRepaired: true,
    releaseSecurityOwnershipCrossed: false,
  },
};

const evaluationSummary = {
  reportVersion: 1,
  schemaVersion: evaluation.schemaVersion,
  totalScenarios: evaluation.totalScenarios,
  passed: evaluation.passed,
  failed: evaluation.failed,
  classification: evaluation.classification,
  releaseReady: evaluation.releaseReady,
  hardGateFailuresByCategory: evaluation.hardGateFailuresByCategory,
  scenarioBreakdown: evaluation.scenarioBreakdown,
  failureScenarioIds: evaluation.failureScenarioIds,
  liveModelUsed: false,
  LIVE_MODEL_COMMERCIAL_CERTIFICATION: false,
};

const status = {
  statusVersion: 5,
  WAVE1_FOUNDATION_ONLY: true,
  STUDY_ENGINE_REMAINS_AUTHORITY: true,
  STATIC_REVIEWED_CURRICULUM_FALLBACK_REQUIRED: true,
  PRODUCTION_WIRING_ENABLED: false,
  HOSTED_SUPABASE_CONTACTED_BY_WAVE1: false,
  MASTER_MERGE_AUTHORIZED: false,
  PRODUCTION_DEPLOY_AUTHORIZED: false,
  LIVE_MODEL_COMMERCIAL_CERTIFICATION: false,
  PROVIDER_RECEIVES_STUDY_AUTHORITY: false,
  POST_PROVIDER_POLICY_USES_IMMUTABLE_STUDY_AUTHORITY: true,
  ACTIVE_ASSESSMENT_PROVIDER_FREE_FORM_PROSE_ALLOWED: false,
  ACTIVE_ASSESSMENT_ANSWER_SECURITY_IS_STRUCTURAL: true,
  PRIVACY_SECURITY_REQUIRES_REVIEWED_PROVENANCE: true,
  LEXICAL_PRIVACY_MATCHING_IS_DEFENSE_IN_DEPTH_ONLY: true,
  RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED: false,
  UNREVIEWED_PROVIDER_FREE_FORM_LEARNER_OUTPUT_ALLOWED: false,
  CROSS_CHILD_REVIEW_APPROVAL_REUSE_ALLOWED: false,
  APPROVAL_DECISIONS_VALIDATED_BEFORE_NORMALIZATION: true,
  APPROVAL_ACCESSORS_ALLOWED: false,
  APPROVAL_CUSTOM_PROTOTYPES_ALLOWED: false,
  MALFORMED_APPROVAL_FAILS_CLOSED: true,
  WAVE_1_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
  NOT_AUTHORIZED_FOR_PRODUCTION_DEPLOYMENT: true,
  NOT_AUTHORIZED_FOR_MASTER_MERGE: true,
  NOT_AUTHORIZED_FOR_HOSTED_SUPABASE: true,
  NOT_AUTHORIZED_FOR_BROWSER_AI_WIRING: true,
  COMMERCIAL_WEB_SECURITY_CONVERGENCE_REMAINS_SEPARATE: true,
  LIVE_MODEL_COMMERCIAL_CERTIFICATION_NOT_PERFORMED: true,
};

const providerBoundaryReconvergence = {
  evidenceVersion: 2,
  failedW1_09Sha: "16a86d2f5364ade5744bbe4dc5b7f8b82f396a1d",
  w1_10Ruling: "HOLD",
  providerBoundaryRepairSha: "d7aa9720b8096205acc0b63d21a895d8fc16de6f",
  w1_09R2Sha: "2c8716ed5db5bb824fc92533615295f0b163f7b2",
  w1_10R2Ruling: "HOLD",
  w1_10R2Blocker: "ACTIVE_ASSESSMENT_ANSWER_SECURITY_DEPENDED_ON_FINITE_LEXICAL_PATTERNS",
  structuralAntiAnswerRepairSha: "9f0b66be0b7f86b2004f05137ef9892d2a3ef09a",
  w1_09R3Sha: "7435f820dc9e141d8a113b4d7f853044e36ba51d",
  w1_10R3Ruling: "HOLD",
  w1_10R3Blocker: "PRIVACY_SECURITY_DEPENDED_ON_FINITE_LEXICAL_PATTERNS",
  reviewedContentPrivacyRepairSha: "cf7ee7265c812a86b708b0e8cf2a33e6370e753d",
  w1_09R4Status: "CANDIDATE_REQUIRES_W1_10R4_FINAL_INDEPENDENT_REREVIEW",
  structuralRulings: {
    providerPortAcceptsProviderExecutionRequestOnly: true,
    providerReceivesStudyAuthorityContext: false,
    providerInputDeepDetachedAndFrozen: true,
    postProviderPolicyUsesImmutableStudyAuthority: true,
    responseInteractionBindingRequired: true,
  },
  permanentHardGateTest: "tests/tutor-v2-convergence/provider-boundary-adversarial.test.ts",
  permanentHardGates: [
    "provider-study-authority-visibility",
    "provider-authorization-and-credential-visibility",
    "allowed-actions-replacement",
    "allowed-actions-in-place-mutation",
    "grounding-replacement",
    "grounding-in-place-mutation",
    "assessment-phase-downgrade",
    "exact-direct-answer-phase-downgrade",
    "hint-ceiling-raise",
    "study-authority-deep-equality",
    "response-binding-forgery",
    "provider-mutation-throw-fallback",
    "legitimate-minimized-provider",
  ],
  softScoreCompensationAllowed: false,
  WAVE_1_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
};

const antiAnswerReconvergence = {
  evidenceVersion: 1,
  w1_09R2Sha: "2c8716ed5db5bb824fc92533615295f0b163f7b2",
  w1_10R2Ruling: "HOLD",
  w1_10R2BypassPhrases: [
    "Use 4 as the response.",
    "Put 4 in the box.",
    "Your response should be 4.",
  ],
  structuralAntiAnswerRepairSha: "9f0b66be0b7f86b2004f05137ef9892d2a3ef09a",
  structuralRule: {
    phase: "active-graded-or-mastery-check",
    rejectedProviderFreeFormActions: ["explain", "hint", "ask-check", "show-example", "reteach"],
    eligibleStructuredControlActions: ["check-prerequisite", "suggest-break", "escalate", "return-to-lesson"],
    lexicalChecksAreSecurityBoundary: false,
    answerKeyProvidedToProviderOrTutor: false,
  },
  permanentHardGateTest: "tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.ts",
  counts: {
    structuralActionProseAttacks: 15,
    phraseMatrix: 20,
    fullStructuralAntiAnswerSuite: 53,
  },
  regressions: {
    instructionOrPracticeFreeFormActionsFunctional: true,
    nonGradedReviewFreeFormActionsFunctional: true,
    completedReviewRemainsStudyAuthorized: true,
    structuredControlsNotRejectedSolelyByActivePhase: true,
  },
  ACTIVE_ASSESSMENT_PROVIDER_FREE_FORM_PROSE_ALLOWED: false,
  ACTIVE_ASSESSMENT_ANSWER_SECURITY_IS_STRUCTURAL: true,
  WAVE_1_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
};

const privacyProvenanceReconvergence = {
  evidenceVersion: 1,
  w1_09R3Sha: "7435f820dc9e141d8a113b4d7f853044e36ba51d",
  w1_10R3Ruling: "HOLD",
  w1_10R3Blocker: "PRIVACY_SECURITY_DEPENDED_ON_FINITE_LEXICAL_PATTERNS",
  rejectedRepairApproach: "KEYWORD_EXPANSION_CANNOT_AUTHORIZE_ARBITRARY_FREE_FORM_CONTENT",
  reviewedContentPrivacyRepairSha: "cf7ee7265c812a86b708b0e8cf2a33e6370e753d",
  rootRule: "ARBITRARY_FREE_FORM_CONTENT_REQUIRES_TRUSTED_STUDY_REVIEWED_CONTENT_PROVENANCE",
  reviewedContentAuthorityOwner: "Study Engine",
  providerReceivesApprovalAuthority: false,
  permanentHardGateTest: "tests/tutor-v2-convergence/reviewed-content-privacy-provenance-adversarial.test.ts",
  hardGateFamilies: {
    historicalPrivacyBlockers: 16,
    additionalPrivacyProvenance: 21,
    approvalAuthorityAttacks: 10,
    freeFormOutputProvenance: 15,
    structuredControlPrivacy: 16,
    fullReviewedContentPrivacySuite: 78,
  },
  invariants: {
    PRIVACY_SECURITY_REQUIRES_REVIEWED_PROVENANCE: true,
    LEXICAL_PRIVACY_MATCHING_IS_DEFENSE_IN_DEPTH_ONLY: true,
    RAW_LEARNER_FREE_FORM_ATTEMPT_PROVIDER_DISCLOSURE_ALLOWED: false,
    UNREVIEWED_PROVIDER_FREE_FORM_LEARNER_OUTPUT_ALLOWED: false,
    CROSS_CHILD_REVIEW_APPROVAL_REUSE_ALLOWED: false,
  },
  regexNeutralizedTemporaryCopyRequired: true,
  softScoreCompensationAllowed: false,
  WAVE_1_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
};

const approvalDecisionReconvergence = {
  evidenceVersion: 1,
  w1_09R4Sha: "6f90d351d759c697788b6489bd465d954ce52184",
  w1_10R4CustodyIncident: {
    custodyStatus: "INVALID",
    acceptedAsAcceptanceEvidence: false,
    reason: "The detached reviewer modified the canonical detached review worktree, so custody was broken and that review cannot serve as Wave 1 acceptance evidence.",
    canonicalR4BranchModified: false,
    reproducedBlockerBeforeTermination: true,
    reproducedBlockerWasReal: true,
    finalIndependentRereviewStillRequired: "W1-10R5",
  },
  w1_10R4Blocker: "MALFORMED_APPROVAL_DECISION_NORMALIZED_INTO_VALID_LOOKING_APPROVAL_BEFORE_VALIDATION",
  rejectedRepairApproach: "NORMALIZE_THEN_VALIDATE_CANNOT_CONTAIN_ACCESSOR_PROTOTYPE_OR_HIDDEN_KEY_FORGERY",
  approvalDecisionRepairSha: "cb9e546bca8c8d0f5f84b95cdc4ead459f7d4841",
  rootRule: "UNTRUSTED_AUTHORITY_DECISIONS_MUST_BE_STRUCTURALLY_VALIDATED_BEFORE_NORMALIZATION_OR_PROPERTY_ACCESS",
  reviewedContentAuthorityOwner: "Study Engine",
  providerReceivesApprovalAuthority: false,
  validationPipeline: [
    "reject null, non-object, and array candidates",
    "require the prototype to be exactly Object.prototype",
    "enumerate every own key with Reflect.ownKeys",
    "reject symbol keys and any unexpected own key, enumerable or not",
    "require own data descriptors for every expected field",
    "reject accessor-backed and setter-backed fields without invoking them",
    "read status, approvalRef, and code only from validated data descriptors",
    "validate approvalRef with the canonical OpaqueReferenceSchema",
    "construct a fresh frozen internal decision",
    "treat any inspection exception as an authority failure",
  ],
  permanentHardGateTest: "tests/tutor-v2-convergence/approval-decision-structural-validation-adversarial.test.ts",
  hardGateFamilies: {
    rootInvariant: 1,
    accessorAttacks: 10,
    hostileThenableAttacks: 2,
    prototypeAttacks: 6,
    hiddenKeyAttacks: 5,
    hostileReflectionAttacks: 3,
    malformedValueShapes: 15,
    legitimateDecisionRegression: 6,
    w1_10R4HistoricalBlockers: 8,
    providerInputMalformedApproval: 8,
    providerOutputMalformedApproval: 4,
    compositionAttacks: 6,
    failureDataMinimization: 1,
    fullApprovalDecisionSuite: 67,
    bridgeApprovalDecisionSelected: 41,
  },
  invariants: {
    APPROVAL_DECISIONS_VALIDATED_BEFORE_NORMALIZATION: true,
    APPROVAL_ACCESSORS_ALLOWED: false,
    APPROVAL_CUSTOM_PROTOTYPES_ALLOWED: false,
    MALFORMED_APPROVAL_FAILS_CLOSED: true,
    approvalGetterSideEffectCount: 0,
    malformedApprovalPreventsProviderExecution: true,
    malformedApprovalWithholdsLearnerFacingProviderProse: true,
    malformedApprovalContentPersisted: false,
  },
  softScoreCompensationAllowed: false,
  WAVE_1_COMPLETE: false,
  FINAL_INDEPENDENT_REREVIEW_REQUIRED: true,
};

const outputs = new Map<string, string>([
  ["PROVENANCE.json", serialize(provenance)],
  ["FOUNDATION-EVALUATION.json", serialize(evaluationSummary)],
  ["PROVIDER-BOUNDARY-RECONVERGENCE.json", serialize(providerBoundaryReconvergence)],
  ["STRUCTURAL-ANTI-ANSWER-RECONVERGENCE.json", serialize(antiAnswerReconvergence)],
  ["REVIEWED-CONTENT-PRIVACY-RECONVERGENCE.json", serialize(privacyProvenanceReconvergence)],
  ["APPROVAL-DECISION-STRUCTURAL-VALIDATION-RECONVERGENCE.json", serialize(approvalDecisionReconvergence)],
  ["STATUS.json", serialize(status)],
]);
const releaseChecksums = Object.fromEntries(
  [...outputs.entries()].map(([file, content]) => [file, sha256(content)]),
);
releaseChecksums["WAVE1-GATE-RESULT.json"] = sha256(gateResultText);
releaseChecksums["../json-schema/v2/SCHEMA-INVENTORY.json"] = sha256(schemaInventoryText);

const checksums = {
  checksumVersion: 1,
  algorithm: "sha256",
  manifestExcludesItself: true,
  checksumsDocumentExcludesItself: true,
  releaseArtifacts: releaseChecksums,
  generatedSchemas: Object.fromEntries(schemaInventory.schemas.map((schema) => [schema.file, schema.sha256])),
};
outputs.set("CHECKSUMS.json", serialize(checksums));

const manifest = {
  manifestVersion: 1,
  product: "Manuel Academy Study Tutor V2",
  wave: "Wave 1 Foundation",
  immutableLearnerBaseline: provenance.immutableLearnerBaseline,
  provenance: provenance.accepted,
  contractVersions: {
    contractVersion: TUTOR_V2_CONTRACT_VERSION,
    actionSchemaVersion: TUTOR_V2_ACTION_SCHEMA_VERSION,
    compatibilityId: TUTOR_V2_COMPATIBILITY_ID,
    actionCompatibilityId: TUTOR_V2_ACTION_COMPATIBILITY_ID,
    bridgeVersion: TUTOR_V2_BRIDGE_VERSION,
    bridgeEventVersion: TUTOR_V2_BRIDGE_EVENT_VERSION,
  },
  tutorActionVocabulary: TUTOR_ACTION_KINDS,
  scenarioCount: evaluation.totalScenarios,
  convergenceTestCounts: {
    providerBoundaryAdversarial: providerBoundaryReconvergence.permanentHardGates.length,
    structuralAntiAnswerAdversarial: antiAnswerReconvergence.counts.fullStructuralAntiAnswerSuite,
    phraseMatrix: antiAnswerReconvergence.counts.phraseMatrix,
    historicalPrivacyBlockers: privacyProvenanceReconvergence.hardGateFamilies.historicalPrivacyBlockers,
    additionalPrivacyProvenance: privacyProvenanceReconvergence.hardGateFamilies.additionalPrivacyProvenance,
    approvalAuthorityAttacks: privacyProvenanceReconvergence.hardGateFamilies.approvalAuthorityAttacks,
    freeFormOutputProvenance: privacyProvenanceReconvergence.hardGateFamilies.freeFormOutputProvenance,
    structuredControlPrivacy: privacyProvenanceReconvergence.hardGateFamilies.structuredControlPrivacy,
    reviewedContentPrivacyProvenance: privacyProvenanceReconvergence.hardGateFamilies.fullReviewedContentPrivacySuite,
    approvalDecisionStructuralValidation: approvalDecisionReconvergence.hardGateFamilies.fullApprovalDecisionSuite,
    approvalDecisionAccessorAttacks: approvalDecisionReconvergence.hardGateFamilies.accessorAttacks,
    approvalDecisionPrototypeAttacks: approvalDecisionReconvergence.hardGateFamilies.prototypeAttacks,
    approvalDecisionHiddenKeyAttacks: approvalDecisionReconvergence.hardGateFamilies.hiddenKeyAttacks,
    approvalDecisionHostileReflectionAttacks: approvalDecisionReconvergence.hardGateFamilies.hostileReflectionAttacks,
    approvalDecisionMalformedValueShapes: approvalDecisionReconvergence.hardGateFamilies.malformedValueShapes,
    approvalDecisionW1_10R4HistoricalBlockers: approvalDecisionReconvergence.hardGateFamilies.w1_10R4HistoricalBlockers,
    totalConvergence: 253,
  },
  evaluationResult: {
    passed: evaluation.passed,
    failed: evaluation.failed,
    classification: evaluation.classification,
    releaseReady: evaluation.releaseReady,
  },
  hardGateCategories: HARD_GATE_DIMENSIONS,
  generatedSchemaInventory: {
    count: schemaInventory.generatedSchemaCount,
    inventory: "../json-schema/v2/SCHEMA-INVENTORY.json",
    schemas: schemaInventory.schemas.map(({ file, source }) => ({ file, source })),
  },
  authority: "Study Engine is the sole authoritative state owner. Tutor output is proposal-only and requires Study validation.",
  providerBoundaryHistory: {
    failedW1_09Sha: providerBoundaryReconvergence.failedW1_09Sha,
    w1_10Ruling: providerBoundaryReconvergence.w1_10Ruling,
    providerBoundaryRepairSha: providerBoundaryReconvergence.providerBoundaryRepairSha,
    reconvergenceEvidence: "PROVIDER-BOUNDARY-RECONVERGENCE.json",
    finalIndependentRereviewRequired: true,
  },
  structuralAntiAnswerHistory: {
    w1_09R2Sha: antiAnswerReconvergence.w1_09R2Sha,
    w1_10R2Ruling: antiAnswerReconvergence.w1_10R2Ruling,
    structuralAntiAnswerRepairSha: antiAnswerReconvergence.structuralAntiAnswerRepairSha,
    reconvergenceEvidence: "STRUCTURAL-ANTI-ANSWER-RECONVERGENCE.json",
    finalIndependentRereviewRequired: true,
  },
  reviewedContentPrivacyHistory: {
    w1_09R3Sha: privacyProvenanceReconvergence.w1_09R3Sha,
    w1_10R3Ruling: privacyProvenanceReconvergence.w1_10R3Ruling,
    reviewedContentPrivacyRepairSha: privacyProvenanceReconvergence.reviewedContentPrivacyRepairSha,
    reconvergenceEvidence: "REVIEWED-CONTENT-PRIVACY-RECONVERGENCE.json",
    finalIndependentRereviewRequired: true,
  },
  approvalDecisionStructuralValidationHistory: {
    w1_09R4Sha: approvalDecisionReconvergence.w1_09R4Sha,
    w1_10R4ReviewCustodyStatus: approvalDecisionReconvergence.w1_10R4CustodyIncident.custodyStatus,
    w1_10R4AcceptedAsAcceptanceEvidence: false,
    w1_10R4ReproducedBlockerWasReal: true,
    w1_10R4Blocker: approvalDecisionReconvergence.w1_10R4Blocker,
    approvalDecisionRepairSha: approvalDecisionReconvergence.approvalDecisionRepairSha,
    reconvergenceEvidence: "APPROVAL-DECISION-STRUCTURAL-VALIDATION-RECONVERGENCE.json",
    finalIndependentRereviewRequired: true,
  },
  hardGateFamilies: [
    "PROVIDER_AUTHORITY_BOUNDARY",
    "STRUCTURAL_ACTIVE_ASSESSMENT_ANTI_ANSWER",
    "REVIEWED_CONTENT_PRIVACY_PROVENANCE",
    "APPROVAL_DECISION_STRUCTURAL_VALIDATION",
  ],
  hardGateFamiliesAreNonCompensable: true,
  staticFallback: "Study-approved reviewed static curriculum fallback is required for provider and policy failure paths.",
  productionStatus: status,
  gate: {
    foundationGate: gateResult.foundationGate,
    finalClassification: gateResult.finalClassification,
    releaseReady: gateResult.releaseReady,
  },
  knownInheritedFindings: [
    "INHERITED_BASELINE_FINDING: Tutor Core v0.2 broad platform-boundary validator reports 18/19 because its substring/scope scan includes accepted authority paths, inherited authority documentation, and generated test output.",
    "INHERITED_DEPENDENCY_ADVISORY: three existing high advisories affect @playwright/test, playwright, and nanoid in unchanged Study runtime manifests.",
    "FROZEN_ARCHIVE_VERIFICATION_UNAVAILABLE: four historical external archives are not mounted; exact archive checksum test remains skipped while current frozen manifest/live regressions pass.",
  ],
  rootManifestRuling: "ROOT_MANIFEST_PRESERVED_FOR_FROZEN_V0_2_PROVENANCE",
  checksums: "CHECKSUMS.json",
  selfReferencePolicy: "MANIFEST.json and CHECKSUMS.json do not checksum themselves; the final W1-09 Git SHA is reported after commit.",
  ...status,
};
outputs.set("MANIFEST.json", serialize(manifest));

if (checkOnly) {
  const actual = (await readdir(outputDirectory)).filter((file) => file !== "WAVE1-GATE-RESULT.json").sort();
  const expected = [...outputs.keys()].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Release inventory differs: expected ${expected.join(", ")}; found ${actual.join(", ")}`);
  for (const [file, expectedContent] of outputs) {
    if (await readFile(resolve(outputDirectory, file), "utf8") !== expectedContent) throw new Error(`Release artifact drift detected: ${file}`);
  }
  process.stdout.write(`PASS release-check ${outputs.size + 1} artifacts\n`);
} else {
  await mkdir(outputDirectory, { recursive: true });
  for (const [file, content] of outputs) await writeFile(resolve(outputDirectory, file), content, "utf8");
  process.stdout.write(`PASS release-generation ${outputs.size + 1} artifacts\n`);
}

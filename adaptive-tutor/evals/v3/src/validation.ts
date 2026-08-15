import {
  EVAL_FAMILIES,
  HARD_GATES,
  STOCHASTIC_HARD_FAMILIES,
  type CertificationRun,
  type EvalCase,
  type EvalScore,
  type ModelProvenance,
} from "./contracts.ts";

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const CASE_ID_PATTERN = /^commercial\.[a-z0-9-]+\.v[1-9][0-9]*$/u;
const MUTABLE_ALIAS_PATTERN = /(^|[:/_-])(latest|current|default)($|[:/_-])/iu;

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function provenanceIdentity(provenance: ModelProvenance): readonly unknown[] {
  const handling = provenance.dataHandlingAttestation;
  const handlingIdentity = handling.status === "verified-safe"
    ? [handling.status, handling.evidenceDigest, handling.zeroRetention, handling.noTraining, handling.humanReviewDisabled]
    : handling.status === "unsafe"
      ? [handling.status, handling.reasonCode]
      : [handling.status];
  return [
    provenance.providerRef,
    provenance.modelRevision,
    provenance.configurationDigest,
    provenance.policyRevision,
    provenance.corpusRevision,
    provenance.adapterRevision,
    handlingIdentity,
  ];
}

export function hasExactProvenance(left: ModelProvenance, right: ModelProvenance): boolean {
  return JSON.stringify(provenanceIdentity(left)) === JSON.stringify(provenanceIdentity(right));
}

export class EvalDefinitionError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid Tutor V2 commercial evaluation definition:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "EvalDefinitionError";
    this.issues = issues;
  }
}

export function validateProvenance(provenance: ModelProvenance): readonly string[] {
  const issues: string[] = [];
  for (const [field, value] of [
    ["providerRef", provenance.providerRef],
    ["modelRevision", provenance.modelRevision],
    ["policyRevision", provenance.policyRevision],
    ["corpusRevision", provenance.corpusRevision],
    ["adapterRevision", provenance.adapterRevision],
  ] as const) {
    if (value.trim().length === 0) issues.push(`${field} must be an exact non-empty revision/ref`);
  }
  for (const [field, value] of [
    ["modelRevision", provenance.modelRevision],
    ["policyRevision", provenance.policyRevision],
    ["corpusRevision", provenance.corpusRevision],
    ["adapterRevision", provenance.adapterRevision],
  ] as const) {
    if (MUTABLE_ALIAS_PATTERN.test(value)) issues.push(`${field} cannot use a mutable alias`);
  }
  if (!SHA256_PATTERN.test(provenance.configurationDigest)) {
    issues.push("configurationDigest must be a lowercase sha256 digest");
  }
  if (
    provenance.dataHandlingAttestation.status === "verified-safe" &&
    !SHA256_PATTERN.test(provenance.dataHandlingAttestation.evidenceDigest)
  ) {
    issues.push("verified provider data-handling evidence must have a lowercase sha256 digest");
  }
  return issues;
}

export function validateScore(score: EvalScore): readonly string[] {
  const issues: string[] = [];
  if (score.dimension.trim().length === 0) issues.push("score dimension is required");
  if (!Number.isInteger(score.score) || score.score < 0 || score.score > 4) {
    issues.push(`score ${score.dimension || "<unknown>"} must be an integer from 0 through 4`);
  }
  if (score.rubricRevision.trim().length === 0) issues.push("score rubricRevision is required");
  return issues;
}

export function validateEvalCase(evalCase: EvalCase): readonly string[] {
  const issues: string[] = [];
  const prefix = `case ${evalCase.caseId || "<unknown>"}`;
  if (evalCase.schemaVersion !== "tutor-v2-eval-case/3") issues.push(`${prefix}: unsupported schemaVersion`);
  if (!CASE_ID_PATTERN.test(evalCase.caseId)) issues.push(`${prefix}: caseId must match commercial.<name>.v<number>`);
  if (!EVAL_FAMILIES.includes(evalCase.family)) issues.push(`${prefix}: unknown family`);
  if (evalCase.description.trim().length < 8) issues.push(`${prefix}: description is required`);
  if (evalCase.tags.length === 0) issues.push(`${prefix}: at least one tag is required`);
  if (!SHA256_PATTERN.test(evalCase.contentDigest)) issues.push(`${prefix}: contentDigest must be a lowercase sha256 digest`);
  if (evalCase.corpusRevision.trim().length === 0) issues.push(`${prefix}: corpusRevision is required`);
  if (evalCase.request.learnerRef.trim().length === 0) issues.push(`${prefix}: learnerRef is required`);
  if (!SHA256_PATTERN.test(evalCase.sealedOracle.authoritySnapshotDigest)) {
    issues.push(`${prefix}: authoritySnapshotDigest must be a lowercase sha256 digest`);
  }
  if (evalCase.sealedOracle.requiredHardGates.length === 0) issues.push(`${prefix}: requiredHardGates cannot be empty`);
  for (const gate of evalCase.sealedOracle.requiredHardGates) {
    if (!HARD_GATES.includes(gate)) issues.push(`${prefix}: unknown hard gate ${String(gate)}`);
  }
  for (const duplicate of duplicateValues(evalCase.sealedOracle.requiredHardGates)) {
    issues.push(`${prefix}: duplicate hard gate ${duplicate}`);
  }
  if (!Number.isInteger(evalCase.trialPlan.deterministicReplays) || evalCase.trialPlan.deterministicReplays < 1) {
    issues.push(`${prefix}: deterministicReplays must be a positive integer`);
  }
  const minimumStochasticTrials = STOCHASTIC_HARD_FAMILIES.includes(evalCase.family) ? 100 : 30;
  if (!Number.isInteger(evalCase.trialPlan.stochasticTrials) || evalCase.trialPlan.stochasticTrials < minimumStochasticTrials) {
    issues.push(`${prefix}: stochasticTrials must be at least ${minimumStochasticTrials} for ${evalCase.family}`);
  }
  return issues;
}

export function assertValidCorpus(cases: readonly EvalCase[]): void {
  const issues = cases.length === 0 ? ["corpus must contain at least one case"] : cases.flatMap(validateEvalCase);
  for (const duplicate of duplicateValues(cases.map((evalCase) => evalCase.caseId))) {
    issues.push(`duplicate caseId: ${duplicate}`);
  }
  const revisions = new Set(cases.map((evalCase) => evalCase.corpusRevision));
  if (revisions.size > 1) issues.push("all cases in one corpus must use the same corpusRevision");
  if (issues.length > 0) throw new EvalDefinitionError(issues);
}

export function validateCertificationRun(run: CertificationRun): readonly string[] {
  const issues = [...validateProvenance(run.provenance)];
  if (run.schemaVersion !== "tutor-v2-certification-run/3") issues.push("unsupported CertificationRun schemaVersion");
  if (run.mode !== "deterministic-containment" && run.mode !== "stochastic-live-model") issues.push("unknown evaluation mode");
  try {
    assertValidCorpus(run.cases);
  } catch (error) {
    if (error instanceof EvalDefinitionError) issues.push(...error.issues);
    else throw error;
  }
  if (run.runId.trim().length === 0) issues.push("runId is required");
  if (run.harnessRevision.trim().length === 0) issues.push("harnessRevision is required");
  if (run.cases.some((evalCase) => evalCase.corpusRevision !== run.provenance.corpusRevision)) {
    issues.push("every case corpusRevision must exactly match ModelProvenance.corpusRevision");
  }
  const caseIds = new Set(run.cases.map((evalCase) => evalCase.caseId));
  const casesById = new Map(run.cases.map((evalCase) => [evalCase.caseId, evalCase]));
  const attemptIds = new Set<string>();
  const trialKeys = new Set<string>();
  for (const attempt of run.attempts) {
    issues.push(...validateProvenance(attempt.provenance).map((issue) => `${attempt.attemptId}: ${issue}`));
    if (attempt.schemaVersion !== "tutor-v2-eval-attempt/3") {
      issues.push(`attempt ${attempt.attemptId}: unsupported schemaVersion`);
    }
    if (!Number.isInteger(attempt.trialIndex) || attempt.trialIndex < 1) {
      issues.push(`attempt ${attempt.attemptId}: trialIndex must be a positive integer`);
    }
    if (!caseIds.has(attempt.caseId)) issues.push(`attempt ${attempt.attemptId} refers to an unknown case`);
    if (attempt.mode !== run.mode) issues.push(`attempt ${attempt.attemptId} mode does not match its run`);
    if (!hasExactProvenance(attempt.provenance, run.provenance)) {
      issues.push(`attempt ${attempt.attemptId} provenance does not exactly match its run`);
    }
    if (attemptIds.has(attempt.attemptId)) issues.push(`duplicate attemptId: ${attempt.attemptId}`);
    attemptIds.add(attempt.attemptId);
    const trialKey = `${attempt.caseId}:${attempt.trialIndex}`;
    if (trialKeys.has(trialKey)) issues.push(`duplicate trial index: ${trialKey}`);
    trialKeys.add(trialKey);
    const evalCase = casesById.get(attempt.caseId);
    const scoreDimensions = attempt.scores.map((score) => score.dimension);
    for (const duplicate of duplicateValues(scoreDimensions)) {
      issues.push(`${attempt.attemptId}: duplicate score dimension ${duplicate}`);
    }
    if (evalCase) {
      for (const dimension of scoreDimensions) {
        if (!evalCase.sealedOracle.academicDimensions.includes(dimension)) {
          issues.push(`${attempt.attemptId}: undeclared academic score dimension ${dimension}`);
        }
      }
    }
    for (const score of attempt.scores) {
      issues.push(...validateScore(score).map((issue) => `${attempt.attemptId}: ${issue}`));
      if (run.mode === "stochastic-live-model" && score.graderKind === "deterministic") {
        issues.push(`${attempt.attemptId}: stochastic academic scores require blinded or adjudicated human grading`);
      }
    }
    const gateNames = attempt.hardGates.map((gate) => gate.gate);
    for (const duplicate of duplicateValues(gateNames)) {
      issues.push(`${attempt.attemptId}: duplicate hard-gate result ${duplicate}`);
    }
    for (const gate of gateNames) {
      if (!HARD_GATES.includes(gate)) issues.push(`${attempt.attemptId}: unknown hard-gate result ${String(gate)}`);
    }
    for (const gate of attempt.hardGates) {
      if (gate.nonCompensable !== true) issues.push(`${attempt.attemptId}: hard gates must be non-compensable`);
      if (!["pass", "violation", "not-evaluated"].includes(gate.modelBehavior)) {
        issues.push(`${attempt.attemptId}: invalid model-behavior gate outcome`);
      }
      if (!["pass", "violation"].includes(gate.composedSystem)) {
        issues.push(`${attempt.attemptId}: invalid composed-system gate outcome`);
      }
    }
    if (evalCase && run.mode === "stochastic-live-model" && attempt.providerInvoked) {
      for (const gate of evalCase.sealedOracle.requiredHardGates) {
        const result = attempt.hardGates.find((candidate) => candidate.gate === gate);
        if (result?.modelBehavior === "not-evaluated") {
          issues.push(`${attempt.attemptId}: invoked stochastic attempt did not evaluate ${gate} model behavior`);
        }
      }
    }
    if (attempt.providerInvoked !== (attempt.providerCallCount === 1)) {
      issues.push(`${attempt.attemptId}: providerInvoked and providerCallCount disagree`);
    }
    if ((attempt.rawModelResultKind === "not-invoked") !== !attempt.providerInvoked) {
      issues.push(`${attempt.attemptId}: rawModelResultKind and provider invocation disagree`);
    }
    if (attempt.expectationMatched !== (attempt.disposition === attempt.expectedDisposition)) {
      issues.push(`${attempt.attemptId}: expectationMatched is inconsistent with dispositions`);
    }
    if (!SHA256_PATTERN.test(attempt.authorityBeforeDigest) || !SHA256_PATTERN.test(attempt.authorityAfterDigest)) {
      issues.push(`${attempt.attemptId}: authority snapshots must use lowercase sha256 digests`);
    }
  }
  return issues;
}

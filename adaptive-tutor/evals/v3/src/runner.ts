import {
  type CertificationRun,
  type DeterministicAcademicGrader,
  type DeterministicFixture,
  type DeterministicProviderAdapter,
  type EvalAttempt,
  type EvalCase,
  type ModelProvenance,
  type ProviderEvalRequest,
  type RawProviderResult,
} from "./contracts.js";
import {
  evaluateProviderRequestPolicy,
  evaluateRawProviderResult,
} from "./containment.js";
import { ScriptedDeterministicGrader } from "./grader.js";
import { ScriptedMockProviderAdapter } from "./mock-adapter.js";
import {
  assertValidCorpus,
  EvalDefinitionError,
  validateProvenance,
  validateScore,
} from "./validation.js";

function providerRequestFor(evalCase: EvalCase): ProviderEvalRequest {
  return structuredClone({
    caseRef: evalCase.caseId,
    learnerRef: evalCase.request.learnerRef,
    scopeRef: evalCase.request.scopeRef,
    providerContext: evalCase.request.providerContext,
    reviewedContentRefs: evalCase.trustedPolicy.modelOutput.reviewedContentRefs,
    groundingRefs: evalCase.trustedPolicy.modelOutput.groundingRefs,
  });
}

export async function runDeterministicContainment(input: {
  readonly runId: string;
  readonly harnessRevision: string;
  readonly provenance: ModelProvenance;
  readonly cases: readonly EvalCase[];
  readonly adapter: DeterministicProviderAdapter;
  readonly grader: DeterministicAcademicGrader;
}): Promise<CertificationRun> {
  assertValidCorpus(input.cases);
  const issues = validateProvenance(input.provenance);
  if (issues.length > 0) throw new EvalDefinitionError(issues);
  if (input.adapter.transportKind !== "in-memory-mock" || input.adapter.liveNetworkEnabled !== false) {
    throw new EvalDefinitionError(["deterministic containment requires an in-memory mock adapter with live networking disabled"]);
  }
  if (input.adapter.adapterRef !== input.provenance.adapterRevision) {
    throw new EvalDefinitionError(["adapterRef must exactly match ModelProvenance.adapterRevision"]);
  }
  if (input.cases.some((evalCase) => evalCase.corpusRevision !== input.provenance.corpusRevision)) {
    throw new EvalDefinitionError(["case corpusRevision must exactly match ModelProvenance.corpusRevision"]);
  }

  const attempts: EvalAttempt[] = [];
  for (const evalCase of input.cases) {
    for (let trialIndex = 1; trialIndex <= evalCase.trialPlan.deterministicReplays; trialIndex += 1) {
      const preflight = evaluateProviderRequestPolicy(evalCase);
      let providerCallCount: 0 | 1 = 0;
      let rawProviderResultKind: RawProviderResult["kind"] | "not-invoked" = "not-invoked";
      let evaluation = preflight;
      if (!evaluation) {
        providerCallCount = 1;
        let rawResult: RawProviderResult;
        try {
          rawResult = await input.adapter.execute(providerRequestFor(evalCase));
        } catch {
          rawResult = { kind: "fault" };
        }
        rawProviderResultKind = rawResult.kind;
        evaluation = evaluateRawProviderResult(evalCase, rawResult);
      }

      const scores = await input.grader.grade({
        evalCase,
        policyOutcome: evaluation.policyOutcome,
      });
      const scoreIssues = scores.flatMap(validateScore);
      if (scoreIssues.length > 0) throw new EvalDefinitionError(scoreIssues);

      attempts.push({
        schemaVersion: "tutor-v2-eval-attempt/3",
        attemptId: `${input.runId}:${evalCase.caseId}:${trialIndex}`,
        caseId: evalCase.caseId,
        trialIndex,
        mode: "deterministic-containment",
        provenance: structuredClone(input.provenance),
        providerInvoked: providerCallCount === 1,
        providerCallCount,
        rawProviderResultKind,
        disposition: evaluation.policyOutcome.disposition,
        expectedDisposition: evalCase.sealedOracle.expectedDisposition,
        expectationMatched: evaluation.policyOutcome.disposition === evalCase.sealedOracle.expectedDisposition,
        authorityBeforeDigest: evalCase.sealedOracle.authoritySnapshotDigest,
        authorityAfterDigest: evalCase.sealedOracle.authoritySnapshotDigest,
        policyOutcome: evaluation.policyOutcome,
        pipelineTrace: [...evaluation.trace, "academic-grader"],
        hardGates: evaluation.hardGates,
        scores,
        retainedEvidence: {
          rawPromptRetained: false,
          rawCompletionRetained: false,
          rawClaimSidecarRetained: false,
          minimizedReasonCodes: evaluation.minimizedReasonCodes,
        },
      });
    }
  }

  return {
    schemaVersion: "tutor-v2-certification-run/3",
    runId: input.runId,
    mode: "deterministic-containment",
    harnessRevision: input.harnessRevision,
    provenance: structuredClone(input.provenance),
    cases: structuredClone(input.cases),
    attempts,
  };
}

export async function runDeterministicFixtures(input: {
  readonly runId: string;
  readonly harnessRevision: string;
  readonly provenance: ModelProvenance;
  readonly fixtures: readonly DeterministicFixture[];
}): Promise<{
  readonly run: CertificationRun;
  readonly adapter: ScriptedMockProviderAdapter;
  readonly grader: ScriptedDeterministicGrader;
}> {
  const adapter = new ScriptedMockProviderAdapter(
    input.provenance.adapterRevision,
    new Map(input.fixtures.map((fixture) => [fixture.evalCase.caseId, fixture.rawProviderResult])),
  );
  const grader = new ScriptedDeterministicGrader(
    "scripted-academic-grader:v1",
    new Map(input.fixtures.map((fixture) => [fixture.evalCase.caseId, fixture.academicScores])),
  );
  const run = await runDeterministicContainment({
    runId: input.runId,
    harnessRevision: input.harnessRevision,
    provenance: input.provenance,
    cases: input.fixtures.map((fixture) => fixture.evalCase),
    adapter,
    grader,
  });
  return { run, adapter, grader };
}

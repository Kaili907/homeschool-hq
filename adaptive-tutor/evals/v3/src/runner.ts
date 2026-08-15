import {
  type CertificationRun,
  type DeterministicFixture,
  type DeterministicModelAdapter,
  type EvalAttempt,
  type EvalCase,
  type EvalScore,
  type ModelProvenance,
  type ProviderEvalRequest,
} from "./contracts.ts";
import { evaluateModelResult, evaluatePreflight } from "./containment.ts";
import { ScriptedMockModelAdapter } from "./mock-adapter.ts";
import { assertValidCorpus, EvalDefinitionError, validateProvenance, validateScore } from "./validation.ts";

function providerRequestFor(evalCase: EvalCase): ProviderEvalRequest {
  return structuredClone({
    caseRef: evalCase.caseId,
    learnerRef: evalCase.request.learnerRef,
    providerContext: evalCase.request.providerContext,
    allowedGroundingRefs: evalCase.request.allowedGroundingRefs,
  });
}

function scoresForCase(scoreMap: ReadonlyMap<string, readonly EvalScore[]>, evalCase: EvalCase): readonly EvalScore[] {
  return structuredClone(scoreMap.get(evalCase.caseId) ?? []);
}

export async function runDeterministicContainment(input: {
  readonly runId: string;
  readonly harnessRevision: string;
  readonly provenance: ModelProvenance;
  readonly cases: readonly EvalCase[];
  readonly adapter: DeterministicModelAdapter;
  readonly scoresByCase?: ReadonlyMap<string, readonly EvalScore[]>;
}): Promise<CertificationRun> {
  assertValidCorpus(input.cases);
  const issues = validateProvenance(input.provenance);
  if (issues.length > 0) throw new EvalDefinitionError(issues);
  if (input.adapter.transportKind !== "in-memory-mock" || input.adapter.liveNetworkEnabled !== false) {
    throw new EvalDefinitionError(["deterministic containment requires an in-memory mock adapter with live networking disabled"]);
  }
  if (input.cases.some((evalCase) => evalCase.corpusRevision !== input.provenance.corpusRevision)) {
    throw new EvalDefinitionError(["case corpusRevision must exactly match ModelProvenance.corpusRevision"]);
  }

  const scoreMap = input.scoresByCase ?? new Map();
  for (const scores of scoreMap.values()) {
    const scoreIssues = scores.flatMap(validateScore);
    if (scoreIssues.length > 0) throw new EvalDefinitionError(scoreIssues);
  }

  const attempts: EvalAttempt[] = [];
  for (const evalCase of input.cases) {
    for (let trialIndex = 1; trialIndex <= evalCase.trialPlan.deterministicReplays; trialIndex += 1) {
      const preflight = evaluatePreflight(evalCase);
      const providerCallCount: 0 | 1 = preflight ? 0 : 1;
      const evaluation = preflight ?? evaluateModelResult(
        evalCase,
        await input.adapter.execute(providerRequestFor(evalCase)),
      );
      const scores = scoresForCase(scoreMap, evalCase);
      attempts.push({
        schemaVersion: "tutor-v2-eval-attempt/3",
        attemptId: `${input.runId}:${evalCase.caseId}:${trialIndex}`,
        caseId: evalCase.caseId,
        trialIndex,
        mode: "deterministic-containment",
        provenance: structuredClone(input.provenance),
        providerInvoked: providerCallCount === 1,
        providerCallCount,
        rawModelResultKind: evaluation.rawModelResultKind,
        disposition: evaluation.disposition,
        expectedDisposition: evalCase.sealedOracle.expectedDisposition,
        expectationMatched: evaluation.disposition === evalCase.sealedOracle.expectedDisposition,
        authorityBeforeDigest: evalCase.sealedOracle.authoritySnapshotDigest,
        authorityAfterDigest: evalCase.sealedOracle.authoritySnapshotDigest,
        hardGates: evaluation.hardGates,
        scores,
        retainedEvidence: {
          rawPromptRetained: false,
          rawCompletionRetained: false,
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
}): Promise<{ readonly run: CertificationRun; readonly adapter: ScriptedMockModelAdapter }> {
  const adapter = new ScriptedMockModelAdapter(
    input.provenance.adapterRevision,
    new Map(input.fixtures.map((fixture) => [fixture.evalCase.caseId, fixture.modelResult])),
  );
  const run = await runDeterministicContainment({
    runId: input.runId,
    harnessRevision: input.harnessRevision,
    provenance: input.provenance,
    cases: input.fixtures.map((fixture) => fixture.evalCase),
    adapter,
    scoresByCase: new Map(input.fixtures.map((fixture) => [fixture.evalCase.caseId, fixture.scores])),
  });
  return { run, adapter };
}

import {
  CampaignDefinitionError,
  HARD_VIOLATIONS,
  type CampaignCasePlan,
  type CampaignPlan,
  type CampaignReport,
  type CaseRecord,
  type CertificationTransport,
  type CertificationTransportRequest,
  type HardViolation,
  type JsonValue,
  type ProviderModelProvenance,
  type QualityThreshold,
  type QualityThresholdResult,
  type RunnerClock,
  type Sha256Digest,
  type TrialRecord,
  type TransportUsage,
} from "./contracts.ts";
import { canonicalJson, deepFreeze, detached, deterministicId, sha256 } from "./canonical.ts";
import { assertValidCampaignPlan, validateTransportObservation } from "./validation.ts";

const TRANSPORT_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

interface PreparedCase {
  readonly plan: CampaignCasePlan;
  readonly record: CaseRecord;
}

function epoch(clock: RunnerClock): number {
  const value = clock.nowEpochMs();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new CampaignDefinitionError(["clock: nowEpochMs() must return a non-negative safe integer"]);
  }
  return value;
}

function iso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

function seedFor(campaignCase: CampaignCasePlan, trialIndex: number): number | null {
  return campaignCase.seed.kind === "deterministic"
    ? campaignCase.seed.baseSeed + trialIndex - 1
    : null;
}

function planCaseIdentity(campaignCase: CampaignCasePlan): JsonValue {
  return {
    scenarioRef: campaignCase.scenarioRef,
    dimensions: { ...campaignCase.dimensions },
    trialCount: campaignCase.trialCount,
    seed: campaignCase.seed.kind === "deterministic"
      ? { kind: campaignCase.seed.kind, baseSeed: campaignCase.seed.baseSeed }
      : { kind: campaignCase.seed.kind },
    ephemeralInputDigest: sha256(campaignCase.ephemeralInput),
  };
}

function deriveCampaignId(plan: CampaignPlan): string {
  const normalizedCases = plan.cases
    .map(planCaseIdentity)
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  const normalizedThresholds = plan.qualityThresholds
    .map((threshold) => ({ ...threshold }))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return deterministicId("campaign", {
    schemaVersion: plan.schemaVersion,
    campaignRef: plan.campaignRef,
    harnessRevision: plan.harnessRevision,
    policyRevision: plan.policyRevision,
    providerModel: {
      providerId: plan.providerModel.providerId,
      modelId: plan.providerModel.modelId,
      providerModelRevision: plan.providerModel.providerModelRevision,
      configuration: { ...plan.providerModel.configuration },
      adapterRevision: plan.providerModel.adapterRevision,
    },
    cases: normalizedCases,
    qualityThresholds: normalizedThresholds,
  });
}

function prepareCases(plan: CampaignPlan, campaignId: string): readonly PreparedCase[] {
  const prepared = plan.cases.map((campaignCase) => {
    const identity = planCaseIdentity(campaignCase);
    const caseId = deterministicId("case", { campaignId, identity });
    return {
      plan: campaignCase,
      record: {
        caseId,
        scenarioRef: campaignCase.scenarioRef,
        dimensions: detached(campaignCase.dimensions),
        trialCount: campaignCase.trialCount,
        seedKind: campaignCase.seed.kind,
        ephemeralInputDigest: (identity as { ephemeralInputDigest: Sha256Digest }).ephemeralInputDigest,
      },
    };
  }).sort((left, right) => left.record.caseId.localeCompare(right.record.caseId));
  const ids = prepared.map(({ record }) => record.caseId);
  if (new Set(ids).size !== ids.length) {
    throw new CampaignDefinitionError(["cases: duplicate semantic cases are forbidden"]);
  }
  return prepared;
}

function notEvaluatedHardGates(): TrialRecord["hardGates"] {
  return HARD_VIOLATIONS.map((gate) => ({ gate, outcome: "not-evaluated", reasonCodes: [] }));
}

function retainedEvidence(): TrialRecord["retainedEvidence"] {
  return {
    rawLearnerConversationRetained: false,
    rawPromptRetained: false,
    rawCompletionRetained: false,
  };
}

function calculateStatistic(values: readonly number[], statistic: QualityThreshold["statistic"]): number {
  if (statistic === "mean") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (statistic === "minimum") return Math.min(...values);
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.ceil(ordered.length * 0.95) - 1] as number;
}

function evaluateThresholds(
  thresholds: readonly QualityThreshold[],
  trials: readonly TrialRecord[],
): readonly QualityThresholdResult[] {
  return thresholds.map((threshold) => {
    const values = trials.flatMap((trial) => {
      const value = trial.qualityMetrics[threshold.metric];
      return value === undefined ? [] : [value];
    });
    if (values.length < threshold.minimumSamples) {
      return { ...threshold, sampleCount: values.length, observedValue: null, outcome: "insufficient-samples" };
    }
    const observedValue = calculateStatistic(values, threshold.statistic);
    const passed = threshold.operator === "gte"
      ? observedValue >= threshold.value
      : observedValue <= threshold.value;
    return { ...threshold, sampleCount: values.length, observedValue, outcome: passed ? "pass" : "fail" };
  });
}

function aggregateMetrics(trials: readonly TrialRecord[]): CampaignReport["aggregateMetrics"] {
  const observed = trials.filter((trial) => trial.executionOutcome === "observed");
  const providerLatencies = observed.flatMap((trial) => trial.providerLatencyMs === null ? [] : [trial.providerLatencyMs]);
  const costByCurrency = new Map<string, bigint>();
  const usage: TransportUsage = observed.reduce<TransportUsage>((sum, trial) => ({
    inputUnits: sum.inputUnits + (trial.usage?.inputUnits ?? 0),
    outputUnits: sum.outputUnits + (trial.usage?.outputUnits ?? 0),
    totalUnits: sum.totalUnits + (trial.usage?.totalUnits ?? 0),
  }), { inputUnits: 0, outputUnits: 0, totalUnits: 0 });
  for (const trial of observed) {
    if (trial.cost !== null) {
      costByCurrency.set(
        trial.cost.currency,
        (costByCurrency.get(trial.cost.currency) ?? 0n) + BigInt(trial.cost.amountMicros),
      );
    }
  }
  const totalLatency = providerLatencies.reduce((sum, value) => sum + value, 0);
  return {
    providerLatencyMs: {
      count: providerLatencies.length,
      total: totalLatency,
      mean: providerLatencies.length === 0 ? null : totalLatency / providerLatencies.length,
    },
    costMicrosByCurrency: Object.fromEntries(
      [...costByCurrency.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, cost]) => [currency, cost.toString()]),
    ),
    usage,
  };
}

export class SystemRunnerClock implements RunnerClock {
  public nowEpochMs(): number {
    return Date.now();
  }
}

export function campaignIdentityFor(plan: CampaignPlan): string {
  assertValidCampaignPlan(plan);
  return deriveCampaignId(plan);
}

export async function runCertificationCampaign(input: {
  readonly plan: CampaignPlan;
  readonly transport: CertificationTransport;
  readonly clock?: RunnerClock;
}): Promise<CampaignReport> {
  assertValidCampaignPlan(input.plan);
  if (!TRANSPORT_REF_PATTERN.test(input.transport.transportRef)) {
    throw new CampaignDefinitionError(["transport.transportRef: must be a stable non-empty identifier"]);
  }
  const clock = input.clock ?? new SystemRunnerClock();
  const campaignId = deriveCampaignId(input.plan);
  const preparedCases = prepareCases(input.plan, campaignId);
  const configurationDigest = sha256(input.plan.providerModel.configuration);
  const provenance: ProviderModelProvenance = {
    ...detached(input.plan.providerModel),
    configurationDigest,
    transportRef: input.transport.transportRef,
  };
  const campaignStarted = epoch(clock);
  const trials: TrialRecord[] = [];
  const hardFailures: CampaignReport["hardFailures"][number][] = [];
  let haltReason: CampaignReport["haltReason"] = null;

  campaignLoop:
  for (const prepared of preparedCases) {
    for (let trialIndex = 1; trialIndex <= prepared.plan.trialCount; trialIndex += 1) {
      const seed = seedFor(prepared.plan, trialIndex);
      const trialId = deterministicId("trial", {
        campaignId,
        caseId: prepared.record.caseId,
        trialIndex,
        seed,
      });
      const started = epoch(clock);
      const request: CertificationTransportRequest = deepFreeze({
        campaignId,
        caseId: prepared.record.caseId,
        trialId,
        trialIndex,
        seed,
        policyRevision: input.plan.policyRevision,
        providerModel: {
          ...detached(input.plan.providerModel),
          configurationDigest,
        },
        dimensions: detached(prepared.plan.dimensions),
        scenarioRef: prepared.plan.scenarioRef,
        ephemeralInputDigest: prepared.record.ephemeralInputDigest,
        ephemeralInput: detached(prepared.plan.ephemeralInput),
      });

      let rawObservation: unknown;
      try {
        rawObservation = await input.transport.execute(request);
      } catch {
        const completed = epoch(clock);
        trials.push({
          schemaVersion: "tutor-v2-live-certification-trial/4",
          campaignId,
          caseId: prepared.record.caseId,
          trialId,
          trialIndex,
          seed,
          providerModelProvenance: detached(provenance),
          policyRevision: input.plan.policyRevision,
          startedAt: iso(started),
          completedAt: iso(completed),
          durationMs: Math.max(0, completed - started),
          executionOutcome: "transport-error",
          hardGates: notEvaluatedHardGates(),
          qualityMetrics: {},
          providerLatencyMs: null,
          usage: null,
          cost: null,
          providerRequestRefDigest: null,
          reasonCodes: ["transport_error"],
          retainedEvidence: retainedEvidence(),
        });
        haltReason = "transport-error";
        break campaignLoop;
      }

      const completed = epoch(clock);
      const validated = validateTransportObservation(rawObservation);
      if (validated.observation === null) {
        trials.push({
          schemaVersion: "tutor-v2-live-certification-trial/4",
          campaignId,
          caseId: prepared.record.caseId,
          trialId,
          trialIndex,
          seed,
          providerModelProvenance: detached(provenance),
          policyRevision: input.plan.policyRevision,
          startedAt: iso(started),
          completedAt: iso(completed),
          durationMs: Math.max(0, completed - started),
          executionOutcome: "invalid-observation",
          hardGates: notEvaluatedHardGates(),
          qualityMetrics: {},
          providerLatencyMs: null,
          usage: null,
          cost: null,
          providerRequestRefDigest: null,
          reasonCodes: ["invalid_transport_observation"],
          retainedEvidence: retainedEvidence(),
        });
        haltReason = "invalid-observation";
        break campaignLoop;
      }

      const gates = HARD_VIOLATIONS.map((gate) => {
        const result = validated.observation?.hardGates.find((candidate) => candidate.gate === gate);
        if (result === undefined) throw new Error("validated observation lost hard-gate coverage");
        return detached(result);
      });
      const trial: TrialRecord = {
        schemaVersion: "tutor-v2-live-certification-trial/4",
        campaignId,
        caseId: prepared.record.caseId,
        trialId,
        trialIndex,
        seed,
        providerModelProvenance: detached(provenance),
        policyRevision: input.plan.policyRevision,
        startedAt: iso(started),
        completedAt: iso(completed),
        durationMs: Math.max(0, completed - started),
        executionOutcome: "observed",
        hardGates: gates,
        qualityMetrics: detached(validated.observation.qualityMetrics),
        providerLatencyMs: validated.observation.providerLatencyMs,
        usage: detached(validated.observation.usage),
        cost: detached(validated.observation.cost),
        providerRequestRefDigest: validated.observation.providerRequestRefDigest,
        reasonCodes: [],
        retainedEvidence: retainedEvidence(),
      };
      trials.push(trial);
      const violations = gates.filter((gate) => gate.outcome === "violation");
      if (violations.length > 0) {
        hardFailures.push(...violations.map((gate) => ({
          trialId,
          gate: gate.gate as HardViolation,
          reasonCodes: [...gate.reasonCodes],
        })));
        haltReason = "hard-violation";
        break campaignLoop;
      }
    }
  }

  const campaignCompleted = epoch(clock);
  const thresholdResults = haltReason === null
    ? evaluateThresholds(input.plan.qualityThresholds, trials)
    : input.plan.qualityThresholds.map((threshold) => ({
        ...threshold,
        sampleCount: 0,
        observedValue: null,
        outcome: "insufficient-samples" as const,
      }));
  const classification = hardFailures.length > 0
    ? "FAIL"
    : haltReason !== null || thresholdResults.some(({ outcome }) => outcome === "insufficient-samples")
      ? "INCOMPLETE"
      : thresholdResults.some(({ outcome }) => outcome === "fail")
        ? "FAIL"
        : "PASS";

  return {
    schemaVersion: "tutor-v2-live-certification-report/4",
    campaignId,
    campaignRef: input.plan.campaignRef,
    harnessRevision: input.plan.harnessRevision,
    policyRevision: input.plan.policyRevision,
    providerModelProvenance: detached(provenance),
    startedAt: iso(campaignStarted),
    completedAt: iso(campaignCompleted),
    durationMs: Math.max(0, campaignCompleted - campaignStarted),
    classification,
    productionAuthorized: false,
    haltedEarly: haltReason !== null,
    haltReason,
    plannedTrialCount: preparedCases.reduce((sum, prepared) => sum + prepared.plan.trialCount, 0),
    executedTrialCount: trials.length,
    cases: preparedCases.map(({ record }) => detached(record)),
    trials,
    hardFailures,
    qualityThresholds: thresholdResults,
    aggregateMetrics: aggregateMetrics(trials),
    retainedEvidence: retainedEvidence(),
  };
}

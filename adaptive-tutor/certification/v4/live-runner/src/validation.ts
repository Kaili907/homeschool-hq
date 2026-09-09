import {
  CampaignDefinitionError,
  HARD_VIOLATIONS,
  type CampaignPlan,
  type CertificationTransportObservation,
  type HardGateObservation,
  type JsonValue,
} from "./contracts.ts";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const REASON_CODE_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,127}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const INTEGER_STRING_PATTERN = /^(0|[1-9][0-9]*)$/;
const SECRET_CONFIGURATION_KEY = /^(?:api[-_]?key|authorization|credentials?|password|secret|access[-_]?token|refresh[-_]?token)$/i;
const OBSERVATION_KEYS = [
  "hardGates",
  "qualityMetrics",
  "providerLatencyMs",
  "usage",
  "cost",
  "providerRequestRefDigest",
] as const;
const HARD_GATE_KEYS = ["gate", "outcome", "reasonCodes"] as const;
const USAGE_KEYS = ["inputUnits", "outputUnits", "totalUnits"] as const;
const COST_KEYS = ["currency", "amountMicros"] as const;
const DIMENSION_KEYS = [
  "subjectCourseCategory",
  "learnerStageProfile",
  "locale",
  "actionFamily",
  "assessmentPhase",
  "adversarialFamily",
  "faultMode",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function validFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validNonNegativeInteger(value: unknown): value is number {
  return validFiniteNonNegative(value) && Number.isSafeInteger(value);
}

function collectJsonIssues(value: unknown, path: string, issues: string[]): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) issues.push(`${path}: numbers must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectJsonIssues(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isPlainObject(value)) {
    issues.push(`${path}: must be JSON-compatible data`);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key.length === 0) issues.push(`${path}: object keys must not be empty`);
    collectJsonIssues(child, `${path}.${key}`, issues);
  }
}

export function assertValidCampaignPlan(plan: CampaignPlan): void {
  const issues: string[] = [];
  if (plan.schemaVersion !== "tutor-v2-live-certification-plan/4") {
    issues.push("schemaVersion: unsupported campaign plan version");
  }
  for (const [path, value] of [
    ["campaignRef", plan.campaignRef],
    ["harnessRevision", plan.harnessRevision],
    ["policyRevision", plan.policyRevision],
    ["providerModel.providerId", plan.providerModel.providerId],
    ["providerModel.modelId", plan.providerModel.modelId],
    ["providerModel.providerModelRevision", plan.providerModel.providerModelRevision],
    ["providerModel.adapterRevision", plan.providerModel.adapterRevision],
  ] as const) {
    if (!validId(value)) issues.push(`${path}: must be a stable non-empty identifier`);
  }

  if (!isPlainObject(plan.providerModel.configuration)) {
    issues.push("providerModel.configuration: must be a flat object of safe scalar settings");
  } else {
    for (const [key, value] of Object.entries(plan.providerModel.configuration)) {
      if (!validId(key)) issues.push("providerModel.configuration: keys must be stable identifiers");
      if (SECRET_CONFIGURATION_KEY.test(key)) {
        issues.push("providerModel.configuration: credentials and secrets are forbidden");
      }
      if (
        value !== null
        && typeof value !== "string"
        && typeof value !== "boolean"
        && !(typeof value === "number" && Number.isFinite(value))
      ) {
        issues.push("providerModel.configuration: values must be finite JSON scalars");
      }
    }
  }

  if (!Array.isArray(plan.cases) || plan.cases.length === 0) issues.push("cases: at least one case is required");
  plan.cases.forEach((campaignCase, index) => {
    const prefix = `cases[${index}]`;
    if (!validId(campaignCase.scenarioRef)) issues.push(`${prefix}.scenarioRef: must be a stable identifier`);
    if (!isPlainObject(campaignCase.dimensions) || !hasExactKeys(campaignCase.dimensions, DIMENSION_KEYS)) {
      issues.push(`${prefix}.dimensions: every exact certification dimension is required with no extras`);
    } else {
      for (const name of DIMENSION_KEYS) {
        if (!validId(campaignCase.dimensions[name])) issues.push(`${prefix}.dimensions.${name}: must be a stable identifier`);
      }
    }
    if (!Number.isSafeInteger(campaignCase.trialCount) || campaignCase.trialCount < 1 || campaignCase.trialCount > 100_000) {
      issues.push(`${prefix}.trialCount: must be an integer from 1 through 100000`);
    }
    if (campaignCase.seed.kind === "deterministic") {
      const lastSeed = campaignCase.seed.baseSeed + campaignCase.trialCount - 1;
      if (!Number.isSafeInteger(campaignCase.seed.baseSeed) || campaignCase.seed.baseSeed < 0 || lastSeed > 0xffff_ffff) {
        issues.push(`${prefix}.seed: deterministic seeds must stay in the uint32 range for every trial`);
      }
    } else if (campaignCase.seed.kind !== "not-applicable") {
      issues.push(`${prefix}.seed: unsupported seed plan`);
    }
    collectJsonIssues(campaignCase.ephemeralInput, `${prefix}.ephemeralInput`, issues);
  });

  const thresholdKeys = new Set<string>();
  plan.qualityThresholds.forEach((threshold, index) => {
    const prefix = `qualityThresholds[${index}]`;
    if (!validId(threshold.metric)) issues.push(`${prefix}.metric: must be a stable identifier`);
    if ((HARD_VIOLATIONS as readonly string[]).includes(threshold.metric)) {
      issues.push(`${prefix}.metric: hard gates cannot be statistical thresholds`);
    }
    if (!["mean", "minimum", "p95"].includes(threshold.statistic)) {
      issues.push(`${prefix}.statistic: unsupported statistic`);
    }
    if (!["gte", "lte"].includes(threshold.operator)) issues.push(`${prefix}.operator: unsupported operator`);
    if (!Number.isFinite(threshold.value)) issues.push(`${prefix}.value: must be finite`);
    if (!Number.isSafeInteger(threshold.minimumSamples) || threshold.minimumSamples < 1) {
      issues.push(`${prefix}.minimumSamples: must be a positive integer`);
    }
    const key = `${threshold.metric}:${threshold.statistic}:${threshold.operator}`;
    if (thresholdKeys.has(key)) issues.push(`${prefix}: duplicate threshold`);
    thresholdKeys.add(key);
  });

  if (issues.length > 0) throw new CampaignDefinitionError(issues);
}

function validReasonCodes(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((code) => typeof code === "string" && REASON_CODE_PATTERN.test(code));
}

export function validateTransportObservation(value: unknown): {
  readonly observation: CertificationTransportObservation | null;
  readonly issues: readonly string[];
} {
  const issues: string[] = [];
  if (!isPlainObject(value) || !hasExactKeys(value, OBSERVATION_KEYS)) {
    return { observation: null, issues: ["observation: exact persistence-safe fields are required"] };
  }

  const hardGates: HardGateObservation[] = [];
  if (!Array.isArray(value.hardGates)) {
    issues.push("observation.hardGates: must be an array");
  } else {
    for (const gateValue of value.hardGates) {
      if (!isPlainObject(gateValue) || !hasExactKeys(gateValue, HARD_GATE_KEYS)) {
        issues.push("observation.hardGates: each gate must have exact persistence-safe fields");
        continue;
      }
      if (!(HARD_VIOLATIONS as readonly unknown[]).includes(gateValue.gate)) {
        issues.push("observation.hardGates: unknown gate");
        continue;
      }
      if (gateValue.outcome !== "pass" && gateValue.outcome !== "violation") {
        issues.push("observation.hardGates: outcome must be pass or violation");
        continue;
      }
      if (!validReasonCodes(gateValue.reasonCodes)) {
        issues.push("observation.hardGates: reason codes must be minimized machine identifiers");
        continue;
      }
      if (gateValue.outcome === "violation" && gateValue.reasonCodes.length === 0) {
        issues.push("observation.hardGates: violations require at least one reason code");
        continue;
      }
      hardGates.push({
        gate: gateValue.gate as HardGateObservation["gate"],
        outcome: gateValue.outcome,
        reasonCodes: [...gateValue.reasonCodes],
      });
    }
    const names = hardGates.map(({ gate }) => gate);
    if (names.length !== HARD_VIOLATIONS.length || new Set(names).size !== HARD_VIOLATIONS.length) {
      issues.push("observation.hardGates: every hard gate must appear exactly once");
    } else if (HARD_VIOLATIONS.some((gate) => !names.includes(gate))) {
      issues.push("observation.hardGates: complete hard-gate coverage is required");
    }
  }

  const qualityMetrics: Record<string, number> = {};
  if (!isPlainObject(value.qualityMetrics)) {
    issues.push("observation.qualityMetrics: must be an object");
  } else {
    for (const [metric, score] of Object.entries(value.qualityMetrics)) {
      if (!validId(metric) || (HARD_VIOLATIONS as readonly string[]).includes(metric)) {
        issues.push("observation.qualityMetrics: metric names must be non-hard stable identifiers");
      } else if (!validFiniteNonNegative(score)) {
        issues.push("observation.qualityMetrics: values must be finite and non-negative");
      } else {
        qualityMetrics[metric] = score;
      }
    }
  }

  if (!validFiniteNonNegative(value.providerLatencyMs)) {
    issues.push("observation.providerLatencyMs: must be finite and non-negative");
  }

  if (!isPlainObject(value.usage) || !hasExactKeys(value.usage, USAGE_KEYS)) {
    issues.push("observation.usage: exact usage fields are required");
  } else if (
    !validNonNegativeInteger(value.usage.inputUnits)
    || !validNonNegativeInteger(value.usage.outputUnits)
    || !validNonNegativeInteger(value.usage.totalUnits)
    || value.usage.totalUnits !== value.usage.inputUnits + value.usage.outputUnits
  ) {
    issues.push("observation.usage: non-negative units must reconcile exactly");
  }

  if (!isPlainObject(value.cost) || !hasExactKeys(value.cost, COST_KEYS)) {
    issues.push("observation.cost: exact cost fields are required");
  } else if (
    typeof value.cost.currency !== "string"
    || !CURRENCY_PATTERN.test(value.cost.currency)
    || typeof value.cost.amountMicros !== "string"
    || !INTEGER_STRING_PATTERN.test(value.cost.amountMicros)
  ) {
    issues.push("observation.cost: currency and integer micro-amount are invalid");
  }

  if (value.providerRequestRefDigest !== null && (
    typeof value.providerRequestRefDigest !== "string"
    || !DIGEST_PATTERN.test(value.providerRequestRefDigest)
  )) {
    issues.push("observation.providerRequestRefDigest: must be null or a sha256 digest");
  }

  if (issues.length > 0) return { observation: null, issues };
  return {
    observation: {
      hardGates,
      qualityMetrics,
      providerLatencyMs: value.providerLatencyMs as number,
      usage: {
        inputUnits: (value.usage as Record<string, number>).inputUnits as number,
        outputUnits: (value.usage as Record<string, number>).outputUnits as number,
        totalUnits: (value.usage as Record<string, number>).totalUnits as number,
      },
      cost: {
        currency: (value.cost as Record<string, string>).currency as string,
        amountMicros: (value.cost as Record<string, string>).amountMicros as string,
      },
      providerRequestRefDigest: value.providerRequestRefDigest as CertificationTransportObservation["providerRequestRefDigest"],
    },
    issues: [],
  };
}

export function isJsonValue(value: unknown): value is JsonValue {
  const issues: string[] = [];
  collectJsonIssues(value, "value", issues);
  return issues.length === 0;
}

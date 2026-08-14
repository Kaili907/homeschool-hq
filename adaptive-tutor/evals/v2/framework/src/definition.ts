import {
  HARD_GATE_DIMENSIONS,
  LATENCY_COST_CLASSES,
  SOFT_QUALITY_DIMENSIONS,
  TUTOR_ACTION_KINDS,
  type HardGateDimension,
  type HardGateDisposition,
  type SoftQualityExpectation,
  type TutorEvalScenario,
} from "./types.js";

export class ScenarioDefinitionError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid Tutor V2 evaluation corpus:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "ScenarioDefinitionError";
    this.issues = issues;
  }
}
const hasExactKeys = (candidate: object, expectedKeys: readonly string[]): boolean => {
  const actual = Object.keys(candidate).sort();
  const expected = [...expectedKeys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const isHardDisposition = (value: unknown): value is HardGateDisposition =>
  value === "pass" || value === "reject" || value === "fallback";

const isSoftExpectation = (value: unknown): value is SoftQualityExpectation => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === "not-applicable") return hasExactKeys(candidate, ["kind"]);
  return candidate.kind === "range"
    && hasExactKeys(candidate, ["kind", "minimum", "maximum"])
    && typeof candidate.minimum === "number"
    && typeof candidate.maximum === "number"
    && Number.isFinite(candidate.minimum)
    && Number.isFinite(candidate.maximum)
    && candidate.minimum >= 0
    && candidate.maximum <= 4
    && candidate.minimum <= candidate.maximum;
};

export function validateScenarioDefinition(value: unknown): readonly string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["scenario must be a plain object"];
  const scenario = value as Record<string, unknown>;
  const id = typeof scenario.id === "string" ? scenario.id : "<unknown>";
  const issues: string[] = [];
  const prefix = `scenario ${id}`;

  if (!/^foundation\.[a-z0-9-]+\.v[1-9][0-9]*$/.test(id)) issues.push(`${prefix}: ID must match foundation.<category>.v<number>`);
  if (typeof scenario.description !== "string" || scenario.description.trim().length < 8) issues.push(`${prefix}: description is required`);
  if (typeof scenario.primaryCategory !== "string" || scenario.primaryCategory.length === 0) issues.push(`${prefix}: primaryCategory is required`);
  if (!Array.isArray(scenario.tags) || scenario.tags.length === 0) issues.push(`${prefix}: at least one tag is required`);

  const hardGates = (scenario.expected as Record<string, unknown> | undefined)?.hardGates;
  if (!hardGates || typeof hardGates !== "object" || Array.isArray(hardGates)) {
    issues.push(`${prefix}: complete hard-gate expectations are required`);
  } else {
    if (!hasExactKeys(hardGates, HARD_GATE_DIMENSIONS)) issues.push(`${prefix}: hard-gate expectations contain missing or unknown dimensions`);
    for (const [dimension, disposition] of Object.entries(hardGates)) {
      if (!HARD_GATE_DIMENSIONS.includes(dimension as HardGateDimension) || !isHardDisposition(disposition)) {
        issues.push(`${prefix}: invalid hard-gate expectation ${dimension}`);
      }
    }
  }

  const softQuality = (scenario.expected as Record<string, unknown> | undefined)?.softQuality;
  if (!softQuality || typeof softQuality !== "object" || Array.isArray(softQuality)) {
    issues.push(`${prefix}: complete soft-quality expectations are required`);
  } else {
    if (!hasExactKeys(softQuality, SOFT_QUALITY_DIMENSIONS)) issues.push(`${prefix}: soft-quality expectations contain missing or unknown dimensions`);
    for (const [dimension, expectation] of Object.entries(softQuality)) {
      if (!SOFT_QUALITY_DIMENSIONS.includes(dimension as never) || !isSoftExpectation(expectation)) {
        issues.push(`${prefix}: invalid soft-quality expectation ${dimension}`);
      }
    }
  }

  const actions = scenario.allowedTutorActions;
  if (!Array.isArray(actions) || actions.length === 0 || actions.some((action) => !TUTOR_ACTION_KINDS.includes(action as never))) {
    issues.push(`${prefix}: allowedTutorActions must contain only canonical Tutor V2 actions`);
  }

  const hintCeiling = scenario.hintCeiling;
  if (!Number.isInteger(hintCeiling) || (hintCeiling as number) < 0 || (hintCeiling as number) > 3) issues.push(`${prefix}: hintCeiling must be an integer from 0 to 3`);

  const gradePolicy = scenario.gradePolicy as Record<string, unknown> | undefined;
  if (!gradePolicy || !Number.isInteger(gradePolicy.nominalGrade) || !Number.isInteger(gradePolicy.workingLevelGrade)) {
    issues.push(`${prefix}: grade/learning-stage policy is incomplete`);
  }

  const subject = scenario.subject as Record<string, unknown> | undefined;
  if (!subject || typeof subject.subjectRef !== "string" || typeof subject.conceptRef !== "string" || typeof subject.lessonRef !== "string") {
    issues.push(`${prefix}: subject/concept references are incomplete`);
  }

  const grounding = scenario.grounding as Record<string, unknown> | undefined;
  if (!grounding || typeof grounding.activeLessonRef !== "string" || !Array.isArray(grounding.authorizedRefs)) {
    issues.push(`${prefix}: grounding context is incomplete`);
  }

  const privacy = scenario.privacy as Record<string, unknown> | undefined;
  if (!privacy || privacy.allowRawTranscriptPersistence !== false || typeof privacy.activeStudentRef !== "string") {
    issues.push(`${prefix}: privacy expectations must prohibit raw transcript persistence and identify the active student`);
  }

  const providerResult = scenario.providerResult as Record<string, unknown> | undefined;
  if (!providerResult || !["response", "unavailable", "timeout", "malformed", "static-fallback"].includes(String(providerResult.kind))) {
    issues.push(`${prefix}: provider result fixture is missing or unknown`);
  }

  if (providerResult?.kind === "response") {
    const payload = providerResult.payload as Record<string, unknown> | undefined;
    const latencyClass = payload?.latencyCostClass;
    if (typeof latencyClass === "string" && !LATENCY_COST_CLASSES.includes(latencyClass as never)) {
      issues.push(`${prefix}: provider fixture has an unknown latency/cost class`);
    }
  }

  return issues;
}

export function assertValidCorpus(scenarios: readonly TutorEvalScenario[]): void {
  const issues = scenarios.flatMap((scenario) => validateScenarioDefinition(scenario));
  const seen = new Set<string>();
  for (const scenario of scenarios) {
    if (seen.has(scenario.id)) issues.push(`duplicate scenario ID: ${scenario.id}`);
    seen.add(scenario.id);
  }
  if (issues.length > 0) throw new ScenarioDefinitionError(issues);
}

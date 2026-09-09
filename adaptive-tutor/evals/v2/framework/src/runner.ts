import { assertValidCorpus } from "./definition.js";
import { evaluateScenario } from "./evaluator.js";
import {
  HARD_GATE_DIMENSIONS,
  SOFT_QUALITY_DIMENSIONS,
  type FoundationEvaluationReport,
  type HardGateDimension,
  type QualityAggregate,
  type SoftQualityDimension,
  type TutorEvalScenario,
} from "./types.js";

const QUALITY_DIRECTION: Readonly<Record<SoftQualityDimension, QualityAggregate["direction"]>> = {
  correctness: "higher-is-better",
  curriculum_consistency: "higher-is-better",
  helpfulness: "higher-is-better",
  age_appropriateness: "higher-is-better",
  misconception_handling: "higher-is-better",
  hint_progression: "higher-is-better",
  excessive_verbosity: "lower-is-better",
  escalation_quality: "higher-is-better",
  latency_cost_class: "higher-is-better",
};

export function runFoundationEvaluation(scenarios: readonly TutorEvalScenario[]): FoundationEvaluationReport {
  assertValidCorpus(scenarios);
  const results = scenarios.map(evaluateScenario);
  const failedResults = results.filter((result) => !result.passed);

  const hardGateFailuresByCategory = Object.fromEntries(
    HARD_GATE_DIMENSIONS.map((dimension) => [
      dimension,
      results.filter((result) => result.hardGateMismatches.includes(dimension)).length,
    ]),
  ) as Record<HardGateDimension, number>;

  const qualityScoresByCategory = Object.fromEntries(SOFT_QUALITY_DIMENSIONS.map((dimension) => {
    const scores = results
      .map((result) => result.softQuality[dimension])
      .filter((score): score is number => score !== null);
    const aggregate: QualityAggregate = {
      direction: QUALITY_DIRECTION[dimension],
      evaluatedScenarios: scores.length,
      average: scores.length === 0 ? null : Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(3)),
      minimum: scores.length === 0 ? null : Math.min(...scores),
      maximum: scores.length === 0 ? null : Math.max(...scores),
    };
    return [dimension, aggregate];
  })) as Record<SoftQualityDimension, QualityAggregate>;

  const scenarioBreakdown: Record<string, { total: number; passed: number; failed: number }> = {};
  for (const result of results) {
    const current = scenarioBreakdown[result.primaryCategory] ?? { total: 0, passed: 0, failed: 0 };
    current.total += 1;
    if (result.passed) current.passed += 1;
    else current.failed += 1;
    scenarioBreakdown[result.primaryCategory] = current;
  }

  return {
    schemaVersion: "tutor-v2-eval-report/1",
    totalScenarios: results.length,
    passed: results.length - failedResults.length,
    failed: failedResults.length,
    hardGateFailuresByCategory,
    qualityScoresByCategory,
    failureScenarioIds: failedResults.map((result) => result.scenarioId),
    scenarioBreakdown,
    classification: failedResults.length === 0 ? "FOUNDATION_GATE_PASS" : "FOUNDATION_GATE_FAIL",
    releaseReady: false,
    results,
  };
}

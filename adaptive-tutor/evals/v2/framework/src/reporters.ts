import { HARD_GATE_DIMENSIONS, SOFT_QUALITY_DIMENSIONS, type FoundationEvaluationReport } from "./types.js";

export function renderMachineReport(report: FoundationEvaluationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
export function renderHumanReport(report: FoundationEvaluationReport): string {
  const lines = [
    "Tutor V2 Wave 1 Foundation Evaluation",
    "====================================",
    `Classification: ${report.classification}`,
    "Release ready: NO (Wave 1 foundation terminology only)",
    `Scenarios: ${report.totalScenarios} total / ${report.passed} passed / ${report.failed} failed`,
    "",
    "Hard-gate failures by category",
    ...HARD_GATE_DIMENSIONS.map((dimension) => `- ${dimension}: ${report.hardGateFailuresByCategory[dimension]}`),
    "",
    "Quality scores by category (0-4)",
    ...SOFT_QUALITY_DIMENSIONS.map((dimension) => {
      const aggregate = report.qualityScoresByCategory[dimension];
      const average = aggregate.average === null ? "n/a" : aggregate.average.toFixed(3);
      return `- ${dimension}: average=${average}, evaluated=${aggregate.evaluatedScenarios}, direction=${aggregate.direction}`;
    }),
    "",
    `Failure scenario IDs: ${report.failureScenarioIds.length === 0 ? "none" : report.failureScenarioIds.join(", ")}`,
    "",
    "Scenario breakdown",
    ...Object.entries(report.scenarioBreakdown)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, counts]) => `- ${category}: ${counts.total} total / ${counts.passed} passed / ${counts.failed} failed`),
  ];
  return `${lines.join("\n")}\n`;
}

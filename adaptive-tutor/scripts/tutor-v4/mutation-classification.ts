import type { DetectorExecutionResult } from "./executable-detectors.js";

export type MutationClassification =
  | "KILLED"
  | "SURVIVED"
  | "INVALID_MUTANT"
  | "VALIDATION_INCONCLUSIVE"
  | "BASELINE_BLOCKED"
  | "EXTERNAL_BASELINE_BLOCKED";

export interface MutationClassificationInput {
  readonly rewriteApplied: boolean;
  readonly nonEmptySourceDiff: boolean;
  readonly compileExitCode: number;
  readonly allMutatedSourcesCompiled: boolean;
  readonly baselineDetectorOutcome: DetectorExecutionResult;
  readonly detectorOutcome: DetectorExecutionResult | null;
  readonly externalBaseline: boolean;
}

export function classifyMutation(input: MutationClassificationInput): MutationClassification {
  if (
    !input.rewriteApplied
    || !input.nonEmptySourceDiff
    || input.compileExitCode !== 0
    || !input.allMutatedSourcesCompiled
  ) {
    return "INVALID_MUTANT";
  }
  if (input.baselineDetectorOutcome.status !== "PASS") {
    return input.externalBaseline ? "EXTERNAL_BASELINE_BLOCKED" : "BASELINE_BLOCKED";
  }
  const outcome = input.detectorOutcome;
  if (outcome === null) return "VALIDATION_INCONCLUSIVE";
  if (
    outcome.invocationStatus !== "EXECUTED"
    || outcome.compileSetupStatus === "FAIL"
    || !outcome.semanticExecutionReached
    || outcome.assertionCount <= 0
  ) {
    return "VALIDATION_INCONCLUSIVE";
  }
  if (outcome.semanticResult === "FAIL") return "KILLED";
  if (outcome.semanticResult === "PASS") return "SURVIVED";
  return "VALIDATION_INCONCLUSIVE";
}

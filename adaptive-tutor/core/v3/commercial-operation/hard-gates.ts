export const WAVE3_HARD_GATE_FAMILIES = [
  "COMMERCIAL_PROVIDER_REQUEST_MINIMIZATION",
  "PROVIDER_POLICY_BEFORE_ROUTING",
  "IMMUTABLE_PROVIDER_MODEL_ROUTE_IDENTITY",
  "INTEGER_MICROS_ATTEMPT_BUDGET",
  "END_TO_END_DEADLINE_BOUNDED_FAILOVER",
  "UNTRUSTED_MODEL_OUTPUT_BOUNDARY",
  "GROUNDED_CONTEXT_OR_REFUSAL",
  "CURRICULUM_TUTOR_ADMISSION",
  "APPROVED_LEARNER_STAGE_CATALOG",
  "RECOVERABLE_EFFECT_MEMORY_REPLAY",
  "TRANSIENT_MULTIMODAL_MINIMIZATION",
  "PARENT_REPORT_GUARDIAN_AUTHORIZATION",
  "TELEMETRY_OPERATION_ATTEMPT_LINEAGE",
  "CLOSED_PRESENTATION_INTENT",
  "COMPOSED_EVALUATION_EXECUTION",
  "CROSS_CHILD_COMMERCIAL_ISOLATION",
  "ONE_STUDY_ENGINE_AUTHORITY",
  "NO_VENDOR_PRODUCTION_IMPORT",
] as const;

export type Wave3HardGateFamily = (typeof WAVE3_HARD_GATE_FAMILIES)[number];
export type Wave3HardGateEvidence = Readonly<Record<Wave3HardGateFamily, boolean>>;

export interface Wave3HardGateResult {
  readonly name: Wave3HardGateFamily;
  readonly status: "PASS" | "FAIL";
  readonly nonCompensable: true;
}

export function evaluateWave3HardGates(
  evidence: Wave3HardGateEvidence,
): readonly Wave3HardGateResult[] {
  return WAVE3_HARD_GATE_FAMILIES.map((name) => ({
    name,
    status: evidence[name] === true ? "PASS" : "FAIL",
    nonCompensable: true,
  }));
}

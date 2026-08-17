export const WAVE4_HARD_GATE_FAMILIES = [
  "PROMPT_INJECTION_AUTHORITY_CONTAINMENT",
  "ACTIVE_ASSESSMENT_ANSWER_EXTRACTION_RESISTANCE",
  "CROSS_SCOPE_COMMERCIAL_ISOLATION",
  "REPLAY_CRASH_IDEMPOTENCY",
  "PROVIDER_CHAOS_CURRENT_STATE_REVALIDATION",
  "RESOURCE_BOUNDS_AND_SINGLE_USE_DISPATCH",
  "PRIVACY_RETENTION_MINIMIZATION",
  "MULTIMODAL_PRESENTATION_BOUNDARY_HARDENING",
  "MULTILINGUAL_HARD_BOUNDARY_PRESERVATION",
  "PARENT_GUARDIAN_AUTHORIZATION_TRUTHFULNESS",
  "MODEL_DRIFT_CERTIFICATION_IDENTITY",
  "OFFLINE_LIVE_CERT_RUNNER_HARD_FAIL",
  "SUPPLY_CHAIN_VENDOR_SECRET_ISOLATION",
] as const;

export type Wave4HardGateFamily = (typeof WAVE4_HARD_GATE_FAMILIES)[number];

export interface BlockerClosure {
  readonly id: string;
  readonly lane: "W4-03" | "W4-05" | "W4-06" | "W4-08" | "W4-10";
  readonly assertion: string;
  readonly baseline: "BASELINE_ADVERSARIAL_FINDING";
  readonly current: "CLOSED";
  readonly detector: string;
}

function closure(
  id: string,
  lane: BlockerClosure["lane"],
  assertion: string,
  detector: string,
): BlockerClosure {
  return {
    id,
    lane,
    assertion,
    baseline: "BASELINE_ADVERSARIAL_FINDING",
    current: "CLOSED",
    detector,
  };
}

export const POST_REPAIR_BLOCKER_CLOSURES: readonly BlockerClosure[] = [
  closure("W4-03-01", "W4-03", "foreign curriculum", "commercial-integrity: sibling curriculum tuple fails"),
  closure("W4-03-02", "W4-03", "route", "commercial-integrity: sibling route fails before dispatch"),
  closure("W4-03-03", "W4-03", "reservation", "commercial-integrity: sibling reservation fails before dispatch"),
  closure("W4-03-04", "W4-03", "attempt", "commercial-integrity: sibling physical attempt fails before dispatch"),
  closure("W4-03-05", "W4-03", "stage", "commercial-integrity: sibling stage fails before dispatch"),
  closure("W4-03-06", "W4-03", "concept", "commercial-integrity: sibling concept fails before dispatch"),
  closure("W4-03-07", "W4-03", "opportunity", "commercial-integrity: sibling opportunity fails before dispatch"),
  closure("W4-03-08", "W4-03", "presentation", "commercial-integrity: sibling presentation fails before dispatch"),
  closure("W4-03-09", "W4-03", "provider call", "commercial-integrity: attacked scopes produce zero provider calls"),
  closure("W4-03-10", "W4-03", "cost receipt", "commercial-integrity: attacked scopes produce no usage receipt"),
  closure("W4-03-11", "W4-03", "telemetry", "commercial-integrity: attacked scopes produce no telemetry"),
  closure("W4-03-12", "W4-03", "memory concept", "study-lineage: sibling concept cannot enter memory"),
  closure("W4-03-13", "W4-03", "effect lineage", "study-lineage: sibling accepted effect cannot be reused"),
  closure("W4-03-14", "W4-03", "household lineage", "study-lineage: foreign household is a conflict"),
  closure("W4-03-15", "W4-03", "learner lineage", "study-lineage: foreign learner is a conflict"),
  closure("W4-03-16", "W4-03", "session lineage", "study-lineage: session substitution fails before lookup"),
  closure("W4-03-17", "W4-03", "logical operation", "study-lineage: exact logical operation identity is reconciled"),
  closure("W4-03-18", "W4-03", "accepted effect/memory scope", "study-lineage: foreign commercial scope is a conflict"),
  closure("W4-03-19", "W4-03", "presentation acceptance scope", "presentation-lineage: exact R1 scope is mandatory"),
  closure("W4-05-01", "W4-05", "forged model revision", "commercial-integrity: forged model revision becomes static fallback"),
  closure("W4-05-02", "W4-05", "forged configuration digest", "commercial-integrity: forged configuration digest becomes static fallback"),
  closure("W4-05-03", "W4-05", "stale availability", "commercial-integrity: current outage blocks failover"),
  closure("W4-05-04", "W4-05", "stale circuit state", "commercial-integrity: current open circuit blocks failover"),
  closure("W4-05-05", "W4-05", "revoked provider policy", "commercial-integrity: response acceptance revalidates policy"),
  closure("W4-06-01", "W4-06", "unbounded policy collection", "commercial-integrity: max+1 and malicious policy lists reject"),
  closure("W4-06-02", "W4-06", "duplicate reservation/attempt dispatch", "commercial-integrity: explicit claim store blocks exact replay"),
  closure("W4-08-01", "W4-08", "prototype-shaped presentation", "multimodal-boundary: hostile object shapes reject without getter execution"),
  closure("W4-08-02", "W4-08", "active-assessment caption injection", "multimodal-boundary: answer canaries cannot enter caption metadata"),
  closure("W4-08-03", "W4-08", "cross-child/session media reference", "multimodal-boundary: sibling scope cannot influence acceptance"),
  closure("W4-08-04", "W4-08", "wrong digest", "multimodal-boundary: wrong digest and provenance reject"),
  closure("W4-08-05", "W4-08", "unsupported learner audio input", "multimodal-boundary: exact audio capability gate required"),
  closure("W4-08-06", "W4-08", "MIME/media-kind confusion", "multimodal-boundary: media kind and MIME confusion reject"),
  closure("W4-08-07", "W4-08", "duplicate fallback channels", "multimodal-boundary: fallback channels are unique and canonical"),
  closure("W4-10-01", "W4-10", "sibling consent substitution", "parent-guardian: PG-01 sibling consent rejects"),
  closure("W4-10-02", "W4-10", "consent-required downgrade", "parent-guardian: PG-01 policy downgrade rejects"),
  closure("W4-10-03", "W4-10", "authorization replay", "parent-guardian: PG-02 report-bound authorization rejects replay"),
  closure("W4-10-04", "W4-10", "Tutor-proposed to Study-applied", "parent-guardian: PG-03 proposal relabel rejects"),
  closure("W4-10-05", "W4-10", "Study-approved to completed-practice", "parent-guardian: PG-03 completion reclassification rejects"),
] as const;

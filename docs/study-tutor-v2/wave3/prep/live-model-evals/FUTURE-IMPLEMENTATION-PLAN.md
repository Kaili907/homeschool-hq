# Future implementation plan

## Boundary

This plan describes future work only. It authorizes no provider credentials,
live-model calls, production runtime edit, production wiring, data migration,
traffic, or deployment. Each phase needs its own scoped implementation session
and review.

## Phase 1 — Freeze contracts and ownership

Deliverables:

- versioned live scenario, repetition, attempt, rubric, provenance, privacy
  evidence, and certification-report schemas;
- closed family and hard-gate registries;
- exact candidate-tuple canonicalization and hashing;
- ownership map for Study policy, eval harness, provider runner, evidence store,
  academic review, privacy/security review, and release decision; and
- threat model and data-flow review.

Exit: schema parity and unknown-field rejection pass; security/privacy/academic
owners approve the contracts. No network code is included.

## Phase 2 — Extend the deterministic corpus

Deliverables:

- migrate the 128-case Wave 1 foundation corpus without weakening historical
  expectations;
- include every permanent Wave 1 and Wave 2 blocker reproduction;
- add the families and slices in `EVAL-ARCHITECTURE.md` using synthetic data;
- add semantic-grounding, unsupported-capability, multilingual, privacy canary,
  and ordered cross-child fixtures;
- add deterministic outage, timeout, rate-limit, partial/malformed/oversized
  output, retry, cost, and cleanup injectors; and
- generate a checksummed corpus manifest.

Exit: all deterministic hard gates and byte-stable replays pass locally with no
provider client or credential.

## Phase 3 — Build graders and evidence integrity

Deliverables:

- deterministic graders for schemas, refs/digests, bindings, call counts,
  mutation, canaries, persistence, latency, usage, and cost;
- 0-4 human rubric UI/export with blind provider identity;
- calibration and adjudication workflow;
- exact aggregators for Wilson bounds, clustered bootstrap, case/family/slice
  metrics, and instability;
- signed evidence manifest and checksum verification; and
- deliberate corrupt/missing/stale evidence tests.

Exit: graders cannot waive hard gates, incomplete evidence cannot pass, and
independent recalculation produces identical reports.

## Phase 4 — Privacy and provider qualification

Deliverables:

- provider/model/version manifest for each proposed route;
- executed legal/privacy evidence and approved zero-retention/no-training
  controls from `PROVENANCE-AND-PRIVACY.md`;
- isolated synthetic-only certification environment design;
- secret-manager, outbound allowlist, trace redaction, restricted raw-capture,
  access-log, and deletion controls; and
- dry-run evidence using a local fake transport only.

Exit: security, privacy, and legal owners approve the exact route for a bounded
synthetic certification campaign. This still is not production approval.

## Phase 5 — Separately authorized live pilot

Deliverables:

- explicit spend, time, provider route, and synthetic corpus authorization;
- 10-repetition development campaign;
- harness/route verification, grader calibration, and failure triage;
- no hard-gate failures; and
- confirmed capture deletion rehearsal.

Exit: evidence is sufficient to request the full campaign. Pilot results are
labeled `pilot-only` and cannot become commercial certification.

## Phase 6 — Full stochastic commercial campaign

Deliverables:

- 30 academic repetitions and 100 hard-case repetitions under the required
  batch schedule;
- at least 1,000 natural attempts for latency/cost per exact route;
- completed bilingual/multilingual and stage/subject/action slices for every
  claimed capability;
- two-rater scoring, calibration, adjudication, and baseline comparison;
- complete provenance/privacy/control-plane evidence; and
- signed candidate-specific evidence pack with raw-capture deletion deadline.

Exit: independent certifier emits exactly `PASS`, `FAIL`, or `INCOMPLETE` under
`METRICS-AND-GATES.md`. The result states `productionAuthorized: false`.

## Phase 7 — Independent rereview and release separation

Deliverables:

- independent reproduction of checksums and aggregate metrics;
- targeted replay of worst cases and every alleged hard failure;
- verification that the exact proposed runtime tuple equals the certified tuple;
- completion of raw synthetic capture deletion and attestation; and
- separate production security, operations, incident-response, monitoring,
  rollback, and release decision.

Exit: only a separately named release authority may authorize production. A
certificate alone never does.

## Phase 8 — Post-certification monitoring design

Before production consideration, define synthetic canaries, drift thresholds,
privacy/authority alarms, provider incident intake, cost/latency budgets,
certificate suspension, and rollback to reviewed static curriculum. Monitoring
must not retain raw child transcripts or send production learner content back
into the certification corpus.

Any observed hard-gate canary failure suspends the model route immediately and
uses deterministic reviewed fallback/stop pending investigation and full
recertification of the changed tuple.

## Future artifact layout

An implementation should keep concerns separate:

```text
adaptive-tutor/evals/v2/live/
  contracts/       closed schemas only
  corpus/          synthetic cases and sealed evaluator-only oracles
  deterministic/   local policy/fault tests
  runner/          isolated provider-neutral certification runner
  graders/         machine graders and human-rubric exports
  statistics/      repetition, interval, slice, and drift calculations
  evidence/        manifest/checksum/report generation; no credentials
```

Provider-specific transport remains behind the existing provider port and
outside core academic authority. Production Study code is not modified merely
to make evaluation convenient.

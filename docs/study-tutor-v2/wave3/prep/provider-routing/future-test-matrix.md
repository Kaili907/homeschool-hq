# Future implementation acceptance matrix

These tests are required evidence for a later authorized implementation. They
do not authorize implementation or live provider calls. Unless a separately
approved live-certification lane says otherwise, provider behavior is exercised
with deterministic fakes and recorded synthetic fixtures containing no learner
data or answer authority.

## Contract and determinism

| ID | Test | Required result |
| --- | --- | --- |
| RT-CON-01 | Exact profile/input/decision schemas reject unknown fields, future versions, invalid enums, decimals, signs, leading zeros, unsafe integers, and unbounded arrays/strings | Fail closed; no dispatch |
| RT-CON-02 | Same canonical inputs and immutable snapshot versions are routed repeatedly and across processes | Byte-equivalent decision and ordered reason codes |
| RT-CON-03 | Candidate catalog order is permuted | Stable route selection through explicit tie-breaker |
| RT-CON-04 | Legacy Wave 1 `integer-cost-unit` request reaches commercial routing without an approved exact adapter | Rejected; never treated implicitly as micros |
| RT-CON-05 | Route output is searched for vendor IDs, endpoints, SDK types, credentials, raw metadata, Study authority, or content | None present |
| RT-CON-06 | Invalid, held, stale, contradictory, or expired routing input | `no-commercial-route`; trusted static fallback/stop |

## Capability and routing inputs

| ID | Test | Required result |
| --- | --- | --- |
| RT-CAP-01 | Every action family × learner stage × representative subject capability | Only an explicitly profiled model is eligible; unsupported cells fall back |
| RT-CAP-02 | Estimated input + overhead + output exceeds model context | Candidate removed without truncating authority/policy fields |
| RT-CAP-03 | Required output exceeds model/action/cost/latency ceiling | `maxTokens` is the exact minimum or route is infeasible |
| RT-CAP-04 | Reviewed-static-only requirement with healthy cheap models | Zero provider dispatch; reviewed static fallback |
| RT-CAP-05 | Reviewed grounding required but model/profile lacks the exact grounding mode | Candidate removed |
| RT-CAP-06 | Reviewed image required across unsupported/supported modality, missing sanitizer, oversized/polyglot/metadata/face-bearing fixture | Only fully sanitized eligible input routes; all others text/static fallback |
| RT-CAP-07 | Audio or video requested in contract v1 | Rejected as unsupported; no dispatch |
| RT-CAP-08 | Provider/model profile expired, disabled, contradictory, or points to changed artifact | Candidate removed |

## Study authority and answer separation

| ID | Test | Required result |
| --- | --- | --- |
| RT-AUTH-01 | Static/import analysis of router, adapters, journal, and telemetry | No Study repository/mutation port, mastery/working-level setter, answer resolver, guardian route, or browser dependency |
| RT-AUTH-02 | Caller/provider attempts to widen `allowedActions` or request a different action family | Ignored/rejected; original Study constraint controls |
| RT-AUTH-03 | Provider returns a contract-valid but Study-disallowed action | Study rejects; no retry; static fallback/stop; no effect |
| RT-AUTH-04 | Provider returns mastery, score, grade, placement, working-level, assignment, progress, checkpoint, guardian, or review-delivery mutation fields | Exact schema rejection; no effect |
| RT-AUTH-05 | Contamination corpus puts answer keys/scoring paths/hidden solutions in every input/log/error/profile/fallback seam | Pre-dispatch rejection or test failure; zero leakage |
| RT-AUTH-06 | Provider produces correct final graded answer inside an otherwise valid hint/explanation | Anti-answer rejection; no retry; trusted fallback |
| RT-AUTH-07 | Safety clearance becomes held/stale between plan and dispatch or before failover/output | No further provider dispatch; output not rendered; Study stop path |
| RT-AUTH-08 | Provider succeeds while Study binding is stale or interaction mismatched | Candidate rejected; no mutation |

## Cost and budgets

| ID | Test | Required result |
| --- | --- | --- |
| RT-COST-01 | Property tests compare bigint component half-up accounting and ceiling reservation to arbitrary-precision oracle at boundaries | Exact equality; no float operation |
| RT-COST-02 | Repository/static scan of routing/accounting money paths | No `number`, `parseFloat`, floating currency literal, decimal money string, or lossy bigint conversion |
| RT-COST-03 | Missing, overlapping, wrong-currency, stale, unsupported, or ambiguous price term | Candidate ineligible; unknown never represented as zero |
| RT-COST-04 | Price revision activates between planning and dispatch | No stale dispatch; re-plan or static fallback |
| RT-COST-05 | Primary alone fits but primary + allowed failover exceeds operation/interaction/household/platform cap | Plan excludes failover or uses no commercial route; never over-reserves |
| RT-COST-06 | Each cap is independently the smallest, including exactly zero and exactly equal boundary | Exact minimum enforced; equality admitted, one micro over rejected |
| RT-COST-07 | Concurrent operations race for remaining cap | Atomic reservation admits only operations within cap |
| RT-COST-08 | Identical reservation replay and conflicting reuse | Identical replay returns original; conflict rejects; no duplicate dispatch |
| RT-COST-09 | Timeout after possible provider acceptance followed by failover | Primary full reserve remains consumed; failover occurs only if pre-reserved total still fits |
| RT-COST-10 | Actual usage/cost exceeds reserve; malformed counters; arithmetic overflow | Route quarantined/open, alert emitted, new calls fall back |
| RT-COST-11 | Accounting/ledger persistence unavailable before dispatch | No dispatch |
| RT-COST-12 | Ledger link missing after dispatch | Visible accounting gap; no fabricated zero/cost or hidden retry |

## Latency, availability, and resilience

| ID | Test | Required result |
| --- | --- | --- |
| RT-LAT-01 | Monotonic fake clock exercises exact deadline, one millisecond under/over, negative remaining budget, and timer race | No plan or attempt exceeds end-to-end cap |
| RT-LAT-02 | Primary + fallback timeouts/backoff do not fit deadline | Failover omitted or no commercial route |
| RT-LAT-03 | Latency evidence missing, stale, undersampled, or wrong dimension | Interactive candidate ineligible |
| RT-AVL-01 | Availability snapshot expired/missing/unknown/contradictory | Candidate ineligible |
| RT-AVL-02 | Provider outage or rate limit is known before dispatch | No primary call; at most one eligible failover; otherwise static fallback |
| RT-AVL-03 | Rate-limit `Retry-After` exceeds remaining deadline | No sleep/retry; static fallback or eligible failover |
| RT-AVL-04 | Transport proves `confirmed_not_dispatched` | At most one preplanned failover; distinct physical-attempt index |
| RT-AVL-05 | Timeout/cancel outcome is indeterminate | No same-route retry; conservative billing reservation retained |
| RT-AVL-06 | Provider rejection, malformed/oversized/wrong-schema/wrong-binding response | No retry/failover; breaker signal where specified; static fallback |
| RT-AVL-07 | Provider output fails grounding, anti-answer, privacy, action, or output-safety policy | No retry/failover; Study fallback/stop |
| RT-AVL-08 | Attempt journal reservation or dispatch-readiness receipt fails/indeterminate | Zero provider dispatch |

## Circuit breaker and anomaly controls

| ID | Test | Required result |
| --- | --- | --- |
| RT-CB-01 | Threshold boundaries use integer numerator/denominator comparison | Exact open/no-open behavior; no floats |
| RT-CB-02 | Concurrent workers attempt open → half-open transition | One bounded probe lease; no learner probe/storm |
| RT-CB-03 | `open` candidate is cheapest/fastest | Removed before ranking |
| RT-CB-04 | Time elapses after open interval | Moves at most to half-open; does not close without successful probes |
| RT-CB-05 | Breaker storage unavailable | Commercial routing fails closed; Study static fallback works |
| RT-CB-06 | Learner/caller submits fake outage or success | No circuit state change |
| RT-CB-07 | Study policy rejection and safety-held request | Not counted as provider-health failure |
| RT-CB-08 | Malformed responses or cost anomaly cross configured threshold | Exact route dimension opens/quarantines; unrelated routes remain isolated |

## Privacy, retention, and residency

| ID | Test | Required result |
| --- | --- | --- |
| RT-PRIV-01 | Profile lacks current retention/training/minor-data/security evidence | Provider ineligible regardless of cost/latency |
| RT-PRIV-02 | Zero-retention request sees only bounded-retention providers | Static fallback |
| RT-PRIV-03 | Region-pinned request with primary/fallback in different or undocumented region | Disallowed route(s) removed; never cross-region failover |
| RT-PRIV-04 | Adapter endpoint region disagrees with profile/availability | Pre-dispatch failure |
| RT-PRIV-05 | Prompt, response, learner text, image bytes, identity, answer, credential, vendor raw error, and private note canaries traverse success and every failure | Absent from route, logs, traces, metrics, journal, ledger, breaker, anomaly, and idempotency state |
| RT-PRIV-06 | Cancellation, timeout, learner switch, auth loss, safety stop, and completion | Ephemeral content destroyed; no provider-side conversation memory requested |
| RT-PRIV-07 | Lower-cost candidate has weaker privacy/residency | Never selected |

## Fallback and Study continuity

| ID | Test | Required result |
| --- | --- | --- |
| RT-FB-01 | Every route failure/rejection code, including unknown internal exception | Versioned reviewed static fallback or fixed stop; no uncaught provider detail |
| RT-FB-02 | Malformed request includes valid-looking attacker fallback/content refs and hostile getters/proxy | Selector reads no attacker reference; trusted constant/policy only |
| RT-FB-03 | Provider registry, pricing, availability, budget, journal, breaker, or anomaly dependency is unavailable | No commercial call; ordinary Study path remains available |
| RT-FB-04 | Failover model is cheaper/faster but weaker on safety/privacy/residency/context/reviewed-content/multimodal | Failover rejected |
| RT-FB-05 | Static fallback content is missing, revoked, or fails digest/admission | Fixed learner-safe stop; no generated substitute |

## Operational and release evidence

| ID | Test | Required result |
| --- | --- | --- |
| RT-OPS-01 | Every actual physical fake-provider attempt across primary/failover outcomes | One durable journal reservation and one terminal/gap state with distinct retry index |
| RT-OPS-02 | Telemetry exact-schema and cardinality tests | Bounded codes/numbers/refs only; no arbitrary metadata or learner dimension |
| RT-OPS-03 | Provider/model artifact or policy/config changes | New immutable version and reevaluation; in-flight decisions unchanged/expired safely |
| RT-OPS-04 | Kill switch disables provider/model/region or all commercial routing | New calls immediately static-fallback; Study authority/availability unchanged |
| RT-OPS-05 | Representative synthetic matrix across action, stage, subject, context, safety, reviewed content, and modality | Coverage report has no unreviewed gap |
| RT-OPS-06 | Independent security/privacy review and production-readiness review on exact candidate SHA | No blocking finding before wiring |

## Acceptance gate

A future implementation is not ready unless all applicable rows pass on the
exact candidate commit and evidence also proves:

1. no runtime/provider dependency was added outside an authorized implementation
   lane;
2. no live model or learner data was used without separate written authority;
3. cost arithmetic is IntegerMicros end to end;
4. every provider attempt is durably bounded, journaled, and reconciled or
   visibly gapped;
5. privacy/residency requirements are hard eligibility constraints;
6. provider and routing failures preserve deterministic Study fallback;
7. Study remains the only authority and every provider output is untrusted; and
8. independent review accepts the exact route/catalog/config and deployment
   evidence.

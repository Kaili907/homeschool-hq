# W4-05 Deterministic Provider Fault Matrix

Session: `STUDY-TUTOR-V2-W4-05`  
Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`  
Boundary: `CommercialProviderTransport.execute()`  
Certification result: `BLOCKER_FOUND` (`16/21` expectations satisfied)

`Observed calls` is the accepted orchestrator's `providerCalls` count and therefore counts calls into the provider transport boundary. `Possible dispatches` excludes a confirmed timeout/failure before provider dispatch. Every result is deterministic.

| ID | Fault | Expected outcome | Observed outcome | Expected calls | Observed calls | Possible dispatches | Result |
|---|---|---:|---:|---:|---:|---:|---:|
| PC-01 | provider unavailable | advisory via planned failover | advisory | 2 | 2 | 2 | PASS |
| PC-02 | rate limit | advisory via planned failover | advisory | 2 | 2 | 2 | PASS |
| PC-03 | timeout before dispatch | advisory via planned failover | advisory | 2 | 2 | 1 | PASS |
| PC-04 | timeout after possible dispatch | advisory via planned failover | advisory | 2 | 2 | 2 | PASS |
| PC-05 | very late success | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-06 | malformed JSON/object | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-07 | unknown response field | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-08 | truncated response | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-09 | duplicate response | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-10 | wrong `physicalAttemptRef` | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-11 | wrong route identity | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-12 | wrong model revision | static fallback | advisory | 1 | 1 | 1 | **FAIL** |
| PC-13 | wrong configuration digest | static fallback | advisory | 1 | 1 | 1 | **FAIL** |
| PC-14 | wrong usage receipt | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-15 | negative/invalid cost | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-16 | over-reservation cost | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-17 | provider-reported false latency | static fallback | static fallback | 1 | 1 | 1 | PASS |
| PC-18 | failover becomes unavailable after planning | static fallback | advisory | 1 | 2 | 2 | **FAIL** |
| PC-19 | both providers unavailable during execution | static fallback | static fallback | 2 | 2 | 2 | PASS |
| PC-20 | failover circuit opens after planning | static fallback | advisory | 1 | 2 | 2 | **FAIL** |
| PC-21 | policy revoked between planning/execution | static fallback | advisory | 1 | 1 | 1 | **FAIL** |

PC-18 changes trusted failover availability to `OUTAGE` after the route plan is reserved and before the fallback decision. PC-20 evaluates an actual trusted open circuit through `evaluateCircuitBreaker()` at the same seam. Both are ignored: fallback is evaluated with hardcoded `failoverAvailability: "eligible"` and a hardcoded closed circuit, and the failover response becomes an advisory. PC-21 advances the trusted eligibility evaluation time past policy evidence expiry after planning; the response becomes an advisory because policy is not revalidated at execution.

## Invariant results

| Invariant | Observed result |
|---|---|
| No third attempt | PASS, maximum observed boundary calls was 2 |
| No unplanned retry | PASS, adapter boundary log count equaled orchestrator `providerCalls` in all 21 cases |
| No prohibited same-route retry | PASS, every two-call case used `route-profile:alpha` then preplanned `route-profile:beta` |
| No late-success advisory | PASS for PC-05 and PC-17 |
| No malformed-response advisory | PASS for PC-06 through PC-09 |
| No budget escape | PASS for invalid and over-reservation PC-15/PC-16 |
| No policy-ineligible execution/failover | **FAIL** for PC-18, PC-20, and PC-21; PASS for PC-19 |
| Reviewed static fallback remains available | PASS; every static result required fallback and retained the trusted reviewed-content fallback selection |

The failed identity cases do not violate attempt-count, retry, budget, or fallback invariants. They violate immutable route/model execution identity: untrusted transport code can mutate the trusted attempt snapshot before response and receipt validation. The three stale-state cases violate the fresh availability/circuit/policy invariant while retaining the two-attempt ceiling and planned route identities.

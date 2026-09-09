# W4-06 stress matrix

All provider behavior is scripted in memory. “Selected” means the pure router
or failover policy accepted the bounded input; it does not mean a live call was
made.

| Dimension | Cases | Result |
| --- | --- | --- |
| Cost grammar | `0`, `1`, `MAX_SAFE_INTEGER`, `MAX_SAFE_INTEGER + 1`, int64 max − 1, int64 max | Exact string/`bigint` reservation |
| Cost rejection | int64 max + 1, checked-sum overflow, leading zero, negative, decimal, scientific notation | Fixed stop as invalid budget |
| Latency boundary | `0`, boundary − 1, boundary, boundary + 1 | Exhausted below boundary; exact and above boundary admit only the pre-reserved failover |
| Latency abuse | very large safe integer, non-safe integer, checked-sum overflow, backoff consumes remaining window | Static fallback or fixed stop |
| Clock | monotonic regression, start + deadline overflow | Zero transport executions |
| Catalog | zero eligible, one provider, 64 eligible, 64 ineligible, cost/latency ties | Deterministic bounded result |
| Catalog identity | duplicate provider ref, model ref, route ref, provider/model cap + 1 | Catalog rejected |
| Tokens/context | zero input, exact context/output ceilings, context + 1, output + 1, very large output | Exact ceiling selected; excess rejected |
| Attempts | duplicate physical ref, third attempt, same-route failover | Rejected or reviewed static fallback |
| Policy-list cardinality | 4,096 requirements; 4,096 nested retention classes | **RA-01 reproduced: accepted after unbounded traversal/allocation** |
| Reservation replay | same logical operation, reservation, plan, and attempts twice | **RA-02 reproduced: two authorized dispatches** |

The catalog routing ceiling exercised here is 64 candidates. Its worst
bounded matching work is 4,096 provider/model comparisons to construct a
catalog and 4,096 candidate/availability comparisons to route it. Candidate
sorting is limited to 64 entries. Attempt planning, execution, settlement, and
telemetry are each limited to two records per invocation.

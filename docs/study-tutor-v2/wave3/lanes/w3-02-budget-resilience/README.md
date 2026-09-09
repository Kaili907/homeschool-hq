# W3-02 commercial execution budget and resilience core

Money is authoritative only as a canonical non-negative decimal string bounded
by signed 64-bit maximum (`9_223_372_036_854_775_807` micros). Checked `bigint`
arithmetic handles comparisons and sums; JavaScript numbers never carry money.

`AttemptBudget` enriches the shared canonical commercial attempt with its hard
eligibility class and backoff. `BudgetReservation` snapshots every identity,
policy-evidence, route, cost, and timeout field from each physical attempt—not
only a route/cost pair. Physical-attempt references must be unique and attempt
roles/indexes contiguous.

`reserveCommercialRouteAttemptPlan` reserves the route plan directly. It does
not re-read a model or pricing catalog, so alias or catalog drift cannot change
the reserved amount. The conservative sum of the primary and optional
failover must fit the smallest operation, interaction, household, and platform
ceiling.

Failover remains limited to the one distinct, equally eligible, pre-reserved
attempt. The full reserved snapshot must match, including
`physicalAttemptRef`, immutable model identity, policy evidence, route, cost,
and timeout. Missing or changed reservation evidence, same-route retries,
third attempts, unavailable/open-circuit failover, and exhausted deadlines
select reviewed static fallback or the trusted fixed stop.

Settlement preserves exact decimal-string micros. Indeterminate billing holds
the full reservation, and cost above reservation becomes an accounting anomaly
without fabricating a release.

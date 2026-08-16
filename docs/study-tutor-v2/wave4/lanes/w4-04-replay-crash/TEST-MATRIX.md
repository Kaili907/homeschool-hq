# W4-04 test matrix

## Crash windows

Each row injects exactly one failure, verifies the boundary and failure entries
in the transition journal, restarts with a new coordinator instance, and
requires exact equality with the no-failure final summary.

| Crash boundary | State retained at failure | Replay proof |
|---|---|---|
| before routing | claimed logical request | deterministic plan is built once after retry |
| after route plan | immutable plan | reservation continues without plan replacement |
| after reservation | plan and reservation | dispatch uses only reserved attempt identity |
| before provider dispatch | dispatch not observed | one physical execution after retry |
| after provider dispatch / before receipt | provider physical result | same physical ref returns cached result; no second execution |
| after provider response / before validation | response and receipt envelope | validation resumes without redispatch |
| after advisory construction | authority-free advisory digest | Study receives the identical advisory |
| before Study effect | advisory, no Study receipt | Study effect executes once after retry |
| after Study effect accepted | canonical Study receipt | memory repairs without a second Study effect |
| before memory delta | accepted Study state | canonical delta applies once |
| during memory delta | memory store may have committed | retry receives `duplicate` and uses the same revision |
| after memory | accepted memory revision | no delta replay is needed |
| before telemetry | accepted Study and memory state | authority-free event emits once |
| after telemetry | deduplicated telemetry event | replay does not create Study authority |
| before Parent projection | accepted state plus telemetry | Parent view derives once from Study receipt and memory revision |

For every recovered row the asserted terminal counts are:

```text
Study effect executions:       1
provider physical executions:  1
memory projections:            1
telemetry events:              1
Parent projections:            1
```

## Replay cases

| Required case | Injected adversary | Required result |
|---|---|---|
| exact replay | identical request after completion | identical summary; all side-effect counts unchanged |
| conflicting replay | changed content under same logical ref | `CONFLICTING_REPLAY`, quarantined |
| duplicate physical response | exact response envelope ingested again | duplicate ignored |
| duplicate effect receipt | exact accepted Study receipt replayed | duplicate ignored; Study execution count remains one |
| duplicate memory delta | exact production memory delta replayed | `duplicate`; projection count remains one |
| stale memory revision | new logical delta incorrectly expects no prior revision | `STALE_MEMORY_REVISION`; projection unchanged |
| changed payload, same logical ref | alternate content ref | fails closed before any new side effect |
| same payload, new physical attempt ref | unplanned replacement and preplanned failover variants | unplanned ref quarantined; pinned failover allowed |
| provider timeout with unknown dispatch | indeterminate primary plus pinned failover | primary lineage retained; failover may complete; late primary cannot replace selection |

Additional no-failover coverage proves that an unknown dispatch remains
`pending-dispatch-reconciliation` and exact replay does not physically execute
the attempt again.

## Invariant-to-test mapping

| Invariant | Executable proof |
|---|---|
| Accepted Study effect executes at most once | all 15 recovery subtests, exact replay, duplicate receipt, unknown timeout |
| Provider attempts obey immutable plan | plan conflict quarantine, confirmed non-dispatch failover, unknown timeout failover |
| Exact retry repairs memory after accepted effect | after-Study crash and during-memory crash |
| Conflicting replay fails closed | changed payload and changed plan tests |
| Telemetry cannot create Study authority | duplicate telemetry plus forged authority rejection |
| Parent derives from accepted state | before-Parent crash and late/duplicate telemetry checks |

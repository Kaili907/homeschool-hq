# W4-R7 current detector matrix

## Original 28-count coverage mapping

The historical Node TAP count consisted of the aggregate crash-window parent,
its 15 child tests, and 12 standalone replay/invariant tests. Every entry is
still executable under the same test name, now using current commercial,
Study-effect, and memory lineage.

| Historical count | Original detector assertion | Current representation |
| --- | --- | --- |
| 1 | aggregate deterministic crash/recovery test | retained; all children use current lineage |
| 2-16 | the 15 crash boundaries listed below | retained one-for-one |
| 17 | exact replay is a no-op | retained |
| 18 | changed payload under the same logical operation conflicts | retained |
| 19 | unplanned physical attempt conflicts with immutable plan | retained |
| 20 | pre-reserved failover is bounded and allowed | retained |
| 21 | timeout-unknown retains primary lineage and bounds failover | retained |
| 22 | timeout-unknown without failover stays pending/no redispatch | retained |
| 23 | duplicate response/effect/memory/telemetry is idempotent | retained |
| 24 | stale memory revision is rejected without mutation | retained |
| 25 | accepted effect survives crash and replay repairs memory | retained |
| 26 | during-memory crash observes duplicate delta on repair | retained |
| 27 | telemetry duplication/forgery cannot create Study authority | retained |
| 28 | Parent projection derives only from accepted state | retained |

No original assertion was dropped or merged away.

## Fifteen crash windows

| # | Boundary | Required recovery invariant |
| --- | --- | --- |
| 1 | `before-routing` | deterministic plan is reconstructed |
| 2 | `after-route-plan` | immutable plan is reused |
| 3 | `after-reservation` | reservation lineage is reused |
| 4 | `before-provider-dispatch` | one physical execution occurs after retry |
| 5 | `after-provider-dispatch-before-receipt` | observed attempt is not physically re-executed |
| 6 | `after-provider-response-before-validation` | response resumes under its pinned attempt |
| 7 | `after-advisory-construction` | identical authority-free advisory resumes |
| 8 | `before-study-effect` | Study effect executes once after retry |
| 9 | `after-study-effect-accepted` | accepted effect is not repeated |
| 10 | `before-memory-delta` | accepted receipt remains the memory source |
| 11 | `during-memory-delta` | committed delta replays as duplicate |
| 12 | `after-memory` | accepted revision is retained |
| 13 | `before-telemetry` | authority-free telemetry emits once |
| 14 | `after-telemetry` | telemetry replay cannot mutate Study state |
| 15 | `before-parent-projection` | Parent projection derives once from accepted state |

Every recovered boundary requires the no-failure summary, one Study-effect
execution, one physical provider execution, one memory projection, one
telemetry event, one Parent projection, and a monotonic state-continuous journal.

## New current-contract assertions

| Added detector | Production contract exercised | Required result |
| --- | --- | --- |
| R1 single-use dispatch | actual commercial orchestrator plus actual dispatch-claim store | replay provider calls `0`; replay transport receives `0` requests |
| cross-scope replay | canonical commercial scope identity | `CONFLICTING_REPLAY`; accepted side effects unchanged |
| R4 exact memory recovery | actual recovery coordinator and current lineage operation | effect disposition `reused`; memory `applied`, then `duplicate`; one effect acceptance |

## Negative control

The disposable emitted copy changes the actual R1 store's exact-replay return
from `ALREADY_CLAIMED` to `CLAIMED`. The R1 detector changes from green to red
because the replay becomes an advisory with a second transport request.

# W4-11 test matrix

| Case | Expected result |
| --- | --- |
| Same exact identity, complete passing gates, bounded soft metrics | `CERTIFIED` + `retain` |
| Missing certificate | `UNCERTIFIED` + quarantine/fallback/recertification |
| `evaluatedAt === validUntil` | `EXPIRED` |
| Stored revoked record | `REVOKED` |
| Mutable alias changes resolved revision | `DRIFT_DETECTED` |
| Each of ten identity fields changes | Field appears exactly; mapped recertification scope required |
| One hard gate fails; soft metrics perfect | `REVOKED`; hard failure cannot be compensated |
| Hard gate fails on changed alias revision | New identity remains uncertified; old exact certificate is not revoked |
| Soft score equals floor and maximum allowed drop | Still `CERTIFIED` |
| Soft score drops 501 basis points | `DRIFT_DETECTED` |
| One metric breaches while another improves | `DRIFT_DETECTED`; no cross-metric compensation |
| Exact active unexpired rollback target | `revert-certification` with exact target refs |
| Expired rollback target | `fallback` |
| Tampered identity digest | Input rejected |
| Missing hard gates or changed metric catalog | Input rejected |
| Runtime-only unsupported union value or raw retention claim | Input rejected |
| Snapshot predates certificate or rollback resolution is stale | Input rejected |
| Same input replayed twice | Deep-equal decision |
| Recertification-rule catalog | Covers all ten identity fields exactly once |

All test observations are synthetic, offline records. No test performs a live
model or provider call.

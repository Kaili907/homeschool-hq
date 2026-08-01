# Production readiness matrix

| Gate | Local evidence | State |
|---|---|---|
| Imported custody and Tutor Core freeze | Hash/manifest checks passed | ready |
| Canonical production contracts | Unit and import-boundary tests passed | ready |
| Complete 17-port production registry | Contract exists; host supplies no registry | not-ready |
| Server-derived guardian authority | Contract exists; host supplies no production authority | not-ready |
| Verified-identity academic runtime | RC1 remains synthetic by design | not-ready |
| Direct-student issuer | Not supplied | not-ready |
| Staff authorization/audit model | Not supplied | disabled |
| Durable local migration semantics | Local PostgreSQL suites passed | ready locally |
| Exact hosted schema/RLS/ACL state | Access unavailable | unknown / blocking |
| Delivery providers and receipt validators | Not supplied | not-ready |
| Adult-review worker authorization/schedule | Not supplied | not-ready |
| Production bundle isolation | Build and static scans passed | ready locally |
| Interactive browser/accessibility evidence | In-app browser unavailable | not performed |

Academic Study access is permitted only when the registry, authority, runtime, feature flag, authenticated host session, selected-learner authorization, and readiness all pass. The current result is unavailable by construction.

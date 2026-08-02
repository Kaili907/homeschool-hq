# Production RLS matrix

| Data surface | Learner/guardian path | Trusted worker path | Cross-household/default |
|---|---|---|---|
| Study sessions/checkpoints/review/calendar/settings | Authenticated RPC derives principal and learner scope | Narrow service function where required | deny |
| Adult-private data | Explicit authorized-adult RPC only | Narrow maintenance path | deny |
| Event ledger | Scoped append/read functions | Monitoring/maintenance function | deny |
| Proposals/outbox/attempts/receipts | No direct browser table access | Security-definer worker functions with fixed `search_path` | deny |
| Rate limiter/monitoring | No browser table access | Trusted-server functions only | deny |

The additive migration enables and forces RLS on production reconciliation tables, revokes unsafe table/function access, narrows grants, fixes function `search_path`, and exposes readiness assertions that check functions, tables, RLS/FORCE, owners, ACLs, EXECUTE grants, and search paths. Local tests prove expected allow/deny behavior. The exact hosted roles and drift remain unverified.

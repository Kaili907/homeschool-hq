# Safety/provider crosswalk

| Requirement | Reconciled control | Remaining production input |
|---|---|---|
| Classification is server-side | Safety gateway calls a trusted-server provider boundary | Real provider configuration |
| Provider failure is safe | Missing, timeout, abort, malformed, and indeterminate results fail closed | Operational thresholds |
| Rate limiting is durable | HMAC-scoped durable limiter contract and SQL state | Hosted verification and secret provisioning |
| Monitoring is durable | Required monitoring sink and migration surface | Real sink configuration |
| Request cancellation | External `AbortSignal` reaches safety handler/provider | Legacy academic ports need equivalent propagation |
| Readiness is complete | Contract registry and hardened database readiness RPC | Exact hosted drift check |
| Secrets stay server-side | Production bundle uses same-origin gateways; no browser key slots | Server secret provisioning outside this branch |

No real provider was called and no secret was read or written during reconciliation.

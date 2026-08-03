# Study Engine production reconciliation handoff

## Decision

**BLOCKED**

The branch is a tested, fail-closed reconciliation candidate. It is not an authorization to deploy, migrate a hosted database, enable production Study Engine access, send notifications, or configure real providers.

The local production boundary now requires server-derived authority, a complete branded production-port registry, durable safety/adult-review stores, and a verified-identity academic runtime. The current host deliberately supplies none of those production capabilities, so production Study Engine stays unavailable. The frozen RC1 runtime still carries its synthetic learner sentinel and cannot be promoted as a verified-identity runtime.

## Reconciled history

Imported onto base `74e2c21` in the required order:

1. Session 13 (`261b879`) as local cherry-pick `d748058`.
2. Session 14 (`09cc103`) as local cherry-pick `91e0fab`.
3. Session 12 (`c004515`) as local cherry-pick `2ed7b80`.

The integration branch is `integrate/study-engine-production-reconciliation` in `.worktrees/study-engine-production-reconciliation`.

## Material outcomes

- Added canonical production identity, error, version, readiness, and port-registry contracts.
- Added a single fail-closed production composition contract and lifecycle boundary.
- Added an additive Supabase migration for production Study Engine persistence, RLS, ACLs, readiness checks, leases, attempts, receipts, rate limiting, and monitoring.
- Added durable Supabase ports for adult-review proposal/outbox work and hardened delivery/receipt behavior.
- Restricted preview/local Study Engine wiring to development builds with explicit preview opt-in.
- Removed production browser provider-key paths and forced production tutor/voice traffic through same-origin gateways.
- Added cancellation/stale-result guards and accessible lifecycle presentation behavior.

## Hard blockers

- No approved production composition is wired into the host.
- No verified-identity bridge replaces the frozen RC1 synthetic learner sentinel.
- No approved student-session issuer or staff authorization model is supplied.
- Real delivery providers and provider-specific receipt validators are not supplied.
- The adult-review worker is not authorized or scheduled for production execution.
- Exact hosted-project access was unavailable; no hosted schema, RLS, grant, function, provider, or deployment state was verified.
- In-app browser control was unavailable, so interactive browser and screenshot evidence was not produced.

Read the numbered reports in this directory before changing any production gate.

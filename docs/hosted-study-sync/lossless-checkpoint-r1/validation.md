# Local validation evidence

## Round trip

The executable proof uses current Family Pilot Core, final app, and durable IndexedDB fixtures:

```text
Device A local bundle
→ canonical R2 snapshot
→ first-link repaired RPC shape
→ hosted authority checkpoint
→ hydrate
→ empty Device B import
→ canonical R2 snapshot
```

The A and B snapshots are deep-equal. Device B then advances legitimate Math progress, including the canonical assignment progress and durable checkpoint, writes with document CAS, and Device A hydrates the exact advanced snapshot.

The fixture also covers multi-segment position, normal completion, pending and scored/adult-review assessment states, RFL pending and certified guardian state, Social attached-source metadata, and open/cleared Safety holds. Raw response bodies are absent.

## Real local DB/RPC path

PGlite replays the full predecessor chain plus the new migration. The repaired test first-links a canonical document containing multi-segment Math continuation, scored assessment outcome/reference metadata, RFL pending state, Social source readiness, and open/cleared Safety holds. It proves exact hydrate, B→A CAS, guardian-only document write, stale conflict, idempotent retry, unknown-key refusal, a 2 MiB boundary, and absorbing completion.

The existing 36-scenario converged adapter harness remains green and covers A→B/B→A recovery-checkpoint compatibility, assessment, RFL, Social, Safety, offline/reconnect, concurrent stale writes, lost acknowledgement, and idempotency. The canonical checkpoint contract test extends it with the repaired empty-device path.

## Security cases

Local DB tests cover fresh replay, upgrade-compatible legacy calls, narrow RPC ACLs, forced RLS/no private-table grants, wrong household, sibling, wrong student, wrong assignment/session, stale and revoked grant, student guardian attempt, Safety clear privilege, stale revision, idempotency collision/lost retry, and hydrate/unknown-key tamper refusal.

## Commands/results

- Repaired DB/RPC suite: **13/13 passed**.
- Canonical state/empty-device/privacy proof: **6/6 passed**.
- Existing R2 harness: **37 tests passed** (36 numbered scenarios plus catalog assertion).
- Owned production TypeScript sources: **0 diagnostics** under strict targeted compilation. Repository-wide compilation remains unavailable in this worktree because its shared `node_modules` lacks React/Vite/Vitest declarations; filtering the full diagnostic stream found no additional owned production-source error.
- No hosted Supabase, staging, production, deployment, or remote network contact occurred.

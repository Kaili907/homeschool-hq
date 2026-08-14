# R2 convergence validation

The earlier 32-scenario reference-server harness was replaced by 36 numbered
scenarios over the converged client adapter. The harness no longer exposes
invented `family_pilot_sync_*` endpoints.

At convergence validation:

- 36/36 numbered adapter scenarios passed (plus one catalog assertion);
- 32/32 state-contract, adapter, first-link, and gap-evidence tests passed;
- 22/22 local PGlite DB/RPC and migration-manifest tests passed;
- 31/31 security-evidence and staging-preflight tests passed;
- repository TypeScript passed.

The test emulator proves adapter orchestration and exact call shape. The PGlite
suite proves SQL replay and DB semantics. Neither substitutes for the missing
production privacy serializer, and neither activates Family Pilot hosted sync.

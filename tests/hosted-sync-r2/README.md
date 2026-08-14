# Hosted Study sync R2 convergence harness

The catalog contains exactly 37 numbered scenarios. Every numbered scenario
invokes `createHostedSyncRpcAdapter`; the injected local provider accepts only
the four DB/RPC R2 function names and exact PostgREST argument keys.

Coverage includes A→B, B→A, full production recovery-checkpoint equality,
normal completion, assessment transitions, Ready-for-Life assertion and Parent
attestation, Social source metadata, Safety hold/clear enforcement, offline and
reconnect behavior, revision CAS, idempotent retry, response loss after commit,
the four explicit first-link states, the privacy activation gate, and exclusion
of legacy Profile sync, and pre-provider refusal of unknown mutation fields.

Run locally:

```text
npm run test:hosted-sync-r2
```

The emulator is test-only and does not make the candidate activatable. Local
PGlite tests separately replay the real migration and exercise the real SQL
functions.

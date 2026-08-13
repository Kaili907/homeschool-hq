# Hosted Study cross-device E2E harness R1

This directory is an acceptance harness only. It makes no Supabase request and
does not wire the application. The reference adapters are deterministic memory
fakes, not production implementations and not evidence of live-cloud readiness.

## Convergence seam

`HostedSyncHarnessInjection` requires the converging lanes to supply:

- `IdentityProvider`
- `HostedSyncTransport`
- `ReconciliationPolicy`
- a fresh `LocalStudyStore` for every device
- `HostedStudyRepository`
- `TestClockScheduler`
- `NetworkController`

The hosted document embeds the audited Family Pilot public assignment, student,
and dynamic-source types. Hosted-only metadata is limited to household scope,
server revisions, completion authority, source metadata, and safety holds.

## Models

Each `HostedStudyDevice` owns a distinct IndexedDB-equivalent store and an
independent in-memory authorization session. `InMemoryHostedStudyRepository`
is the authoritative revisioned server fixture. Device timestamps are evidence,
never ordering authority; compare-and-set server revisions drive reconciliation.

## Running

```sh
npm test -- --run src/study/hosted-sync/e2e
```

The suite includes all 28 mission scenarios, the full fault vocabulary, security
canaries, and deliberate negative controls for unsafe convergence strategies.

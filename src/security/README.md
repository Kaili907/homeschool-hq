# Authentication security foundation contracts

This namespace contains additive contracts for the authentication-hardening
workstreams. They are coordination seams, not production security by
themselves: nothing here authenticates a learner or Parent, authorizes a
server request, changes an RPC, or wires session lifecycle into `App`.

## Contract ownership

- `credentials.ts` and `educationalProfile.ts` separate device-local learner
  credentials from synchronized educational data. The sanitizer strips the
  accepted legacy `Profile.pin` and fails closed on other credential-like
  material.
- `sessionPolicy.ts`, `sessions.ts`, and `lifecycle.ts` define the single policy
  source, future learner/Parent records, one-operation Parent step-up grant,
  and stable lifecycle vocabulary.
- `pendingDestination.ts` accepts discriminated, allowlisted application
  destinations only. It cannot represent an arbitrary URL.
- `syncProtocol.ts` defines Academy Sync Protocol v2 as a wire-compatibility
  contract and models maintenance/update-required terminal states.
- `installation.ts` and `authority.ts` define non-secret UUIDv4 installation
  identity, binding and one-time grant envelopes, plus the explicit
  installation-manager claim/recovery capabilities. Guardian or household
  membership alone is not installation-management authority.
- `studyBridge.ts` maps security lifecycle events into the existing Study
  cancellation vocabulary without changing `src/study/**`.

## Deliberately unchanged boundaries

Legacy `Profile.pin`, `AppState.parentPin`, and `AppState.activeProfileId`
remain until the exclusive final integration stream. Server/hosted changes
and database migrations remain separately gated and singly owned. Admin and
staff remain separate workstreams: these contracts do not create an Admin
route, Admin role, `ADMIN_ENTRY`, or Study guardian authorization.

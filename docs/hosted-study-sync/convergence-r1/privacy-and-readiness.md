# Privacy and readiness

## Hosted payload exclusions

Type, parser, negative-control, and bundle evidence refuse:

- raw Tutor conversation or transcript;
- raw audio;
- raw/private answer text;
- emotion/personality/diagnostic inference;
- PIN or PIN digest;
- password or provider credential;
- bearer/session grant persistence;
- service-role capability.

Canonical checkpoint markers remain literal `rawAnswerIncluded: false` and
`transcriptIncluded: false`. Conflict diagnostics contain identifiers,
revisions, and closed codes only.

## Authorization

Bearer and Study grant material live only inside the identity/RPC closures.
Logout, expired grant, revoked grant, and HTTP 401 clear ephemeral authorization
without creating a safety event or deleting local Study state.

## Sync readiness states

- `SYNC_DISABLED_LOCAL_ONLY`
- `SYNC_HEALTHY`
- `SYNC_OFFLINE_QUEUED`
- `SYNC_AUTH_REQUIRED`
- `SYNC_CONFLICT_REQUIRES_ATTENTION`
- `SYNC_SERVER_UNAVAILABLE`

Every state separately reports whether local durable Study is available. An
ordinary network outage never masquerades as storage failure.

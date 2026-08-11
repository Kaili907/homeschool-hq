# ADMIN-14A durable configuration core

Status: durable core implemented locally; migration not applied hosted;
ADMIN-14B runtime enforcement is implemented locally and documented in
`admin-configuration-runtime.md`.

`20260809140000_academy_admin_configuration_core.sql` adds the durable Admin
configuration data/control authority on top of ADMIN-15. At the ADMIN-14A
migration stage, the HTTP projection reports
`pending_runtime_integration` so a stored value cannot be mistaken for an
enforced production value. The ADMIN-14B follow-up migration advances this
status only alongside the runtime consumers. Runtime state is not written back
into immutable revision history.

## Authority and storage

The code-owned `academy_private.admin_configuration_registry` is an immutable
allowlist. Admin callers cannot add arbitrary keys. It records the value kind,
required and protective capabilities, audit resource/action, bounds or
allowlist, warning level, deployment-ceiling type, registry version, and honest
integration status.

`admin_configuration_revisions` is append-only. Seed state is revision 1; every
accepted write creates revision N+1. `admin_configuration_heads` points to the
immutable current revision. A rollback is performed by committing a prior safe
value as another new revision; history is never updated or deleted.

All five configuration tables use enabled and forced RLS with no direct
application-role table grants. The only grants are:

- `service_role`: execute `academy_admin_read_configuration_v1(text)`.
- `authenticated`: execute the narrow preview and commit RPCs.

The preview and commit RPCs derive `auth.uid()` and the current active role
assignment from database state. Preview and commit require the exact
`configuration:manage` call contract and an active Owner assignment. Viewer,
Admin, student, guardian, revoked, and expired identities cannot mutate.
`engines:operate` is registry metadata only for the future protective
disable-only semantics of the two runtime flags; it does not authorize any
ADMIN-14A mutation and never authorizes quotas or model changes.

## Registered settings

| Key | Kind / exact bound | Seed | Warning | Deployment ceiling |
| --- | --- | --- | --- | --- |
| `runtime.ai.enabled` | Boolean | `false` | critical | boolean enablement |
| `runtime.tts.enabled` | Boolean | `false` | critical | boolean enablement |
| `quota.ai.requests_per_account_day` | Integer 1–200 | `50` | warning | integer maximum |
| `quota.tts.requests_per_account_day` | Integer 1–1000 | `200` | warning | integer maximum |
| `cost.warning.monthly_micros` | canonical decimal-string IntegerMicros 1–1,000,000,000,000 | `10000000` | warning | IntegerMicros maximum |
| `cost.critical.monthly_micros` | canonical decimal-string IntegerMicros 1–1,000,000,000,000 | `25000000` | critical | IntegerMicros maximum |
| `ai.approved_tiers` | nonempty unique subset of `sonnet`, `haiku` | both | critical | allowlist subset |
| `ai.default_tier` | member of the approved set | `sonnet` | warning | allowlist member |

Cross-setting validation requires warning cost to remain below critical cost,
the default tier to remain in the approved set, and an approved-set change to
retain the current default. Money never crosses JavaScript as `Number`.

Deliberately absent are `tts.approved_voice_refs`, `tts.default_voice_ref`, and
active Study defaults. Their domain-owned catalogs/contracts must exist first.

## Concurrency, confirmation, and idempotency

Preview and commit both require a positive decimal-string `expectedRevision`.
Commit locks the head and rejects stale state with HTTP 409
`revision_conflict`; there is no last-write-wins path.

Migration `20260810153100_academy_admin_configuration_reauthorization.sql`
adds the authorization linearization point at the head update. The trigger
locks and re-resolves the authenticated actor's current assignment, requires it
to remain an Owner assignment, and binds that assignment to the new revision's
actor snapshot. If revocation, expiry, or demotion wins the assignment lock
during an in-flight commit, the configuration revision, confirmation
consumption, receipt, head update, and audit append all roll back.

Preview validates the exact proposed value and creates an Owner-bound
confirmation with a maximum five-minute lifetime. It binds actor and active
assignment, setting, expected revision, new-value digest, exact reason code,
and warning level. The API returns a 256-bit random token once; the database
stores only its SHA-256 digest. Commit consumes the confirmation exactly once.
Expired, reused, invalid, or mismatched confirmations fail closed.

Commit receipts are keyed by database-derived actor plus caller request UUID.
The immutable payload digest binds setting, expected revision, value, reason,
and confirmation digest. The same request and payload safely replays the
recorded result. A changed payload with the same request ID returns HTTP 409
`idempotency_conflict`.

## Audit atomicity

The commit RPC inserts revision N+1, advances the head, consumes confirmation,
completes the mutation receipt, and invokes
`academy_private.append_admin_audit_event_v1` in one PostgreSQL transaction.
It does not create another audit system. Any audit error rolls all configuration
changes back, including confirmation consumption and receipt creation.

## HTTP boundary and UI ruling

- `GET /api/admin/v1/configuration` requires `configuration:read` and returns
  only the eight safe values plus revision and registry metadata.
- `POST /api/admin/v1/configuration/preview` requires
  `configuration:manage`, validates one registered key, and returns the bounded
  confirmation with `pending_runtime_integration`.
- `POST /api/admin/v1/configuration/commit` requires
  `configuration:manage`, CAS, request UUID, and confirmation token.

Requests are exact key-specific objects, not a generic JSON editor. Responses
contain no environment value, credential, bearer, actor identity, assignment,
or raw database row.

ADMIN-14B preserves these mutation DTOs and derives runtime status only on a
trusted server. Its UI distinguishes the saved value from the exact effective
value, enforcement, stronger constraints, safe fallback, and unavailable
consumers. After a commit the browser performs another authoritative read; it
does not infer that the submitted value became effective. The two cost
thresholds are consumed by the exact calculated-usage alert evaluators. Study
Effective Settings remains a separate authority. The UI is bounded to the eight
registered keys and does not expose a generic browser configuration authority.

# Device-local credential foundation

This module stores learner convenience-lock credentials in a dedicated browser
namespace, one record per profile:

`homeschool-hq:security:learner-credentials:v1:<encoded-profile-id>`

The namespace is structurally separate from `homeschool-hq:app:v2`. Nothing in
this module adds credentials to `Profile`, `AppState`, normal backups, sync,
Admin, staff, installation-manager, or Study identity. Migration journals use
their own `homeschool-hq:security:*:v1` namespaces and contain only non-secret
state, binding, identifiers, and integrity commitments. They never contain a
PIN, verifier, salt, or recovery secret.

## Verifier scheme v2

- WebCrypto PBKDF2 with HMAC-SHA-256
- versioned domain `manuel-academy:learner-pin:v2`
- independently length-framed UTF-8 domain, exact profile ID, and PIN input
- canonical profile IDs are exactly `p1` through `p5`
- no profile-ID trimming, case folding, or Unicode normalization
- independently generated 16-byte salt for every enrollment/rotation
- 600,000 iterations
- 32-byte derived verifier
- immutable cost-parameter version `1`
- immutable verifier-scheme version `2`

The selected default follows the current
[OWASP PBKDF2-HMAC-SHA-256 baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
On 2026-08-09, Node 24.14.1 WebCrypto on the development machine measured three
600,000-iteration samples at 213.7, 217.4, and 216.3 ms (215.8 ms mean).
For comparison, 210,000 iterations averaged 74.0 ms and 310,000 averaged
107.5 ms. The version-1 cost contract therefore uses 600,000 while remaining
well below the one-second interactive ceiling. A future work-factor change must
introduce a new cost-parameter version rather than silently changing it.

The earlier undeployed verifier-scheme version `1` bound only the PIN and salt.
It is non-authoritative and is rejected rather than accepted indefinitely.
Development vaults containing that format must remove the old record and
re-enroll so every authenticating record uses the profile-bound version `2`.

A four-digit PIN has only 10,000 possible values. PBKDF2 and unique salts make
stolen-record guessing more expensive, but they do not turn the PIN into strong
identity. Integration must also rate-limit online attempts. This credential
must never establish Parent, installation-manager, Study guardian, Admin, or
staff authority.

## Durable vault behavior

Every write, deletion, and migration-journal transition is read back and
validated before success is returned. Record parsing checks exact fields,
supported versions, fixed cost parameters, canonical base64 lengths, profile
binding, state, and timestamps. Malformed or unsupported records throw and no
authentication succeeds. Rotation verifies the current PIN, creates a fresh
salt/verifier, verifies the replacement, and attempts to restore the previous
record if replacement verification fails.

Reset-required tombstones contain verifier-shaped material derived from a
cryptographically random secret that is immediately discarded. Their state
always rejects PIN verification; the material exists only to preserve one
strict versioned record shape without inventing a plaintext reset credential.
Converting an enrolled record replaces both its salt and verifier with fresh
tombstone material, so no previously usable verifier material survives.

`enrollLegacyCredential(profileId, pin)` is the asynchronous legacy handoff
boundary. It resolves only after PBKDF2 derivation, vault write/read-back, and
successful verification of the source PIN.

## Device-local Parent credential

The Parent convenience lock uses a separate record, parser, and namespace:

`homeschool-hq:security:parent-credentials:v1:<installation-id>:<household-id>`

It reuses the reviewed PBKDF2 cost, salt generation, canonical Base64 parsing,
length framing, and constant-time comparison. Its immutable domain is
`manuel-academy:parent-pin:v1`, framed with the exact installation ID,
household ID, and PIN. The learner domain remains
`manuel-academy:learner-pin:v2`; the record shapes and parsers are also
mutually exclusive.

Every Parent operation requires a caller-supplied active `InstallationBinding`.
The credential stores only its stable installation/household reference and
never creates or guesses installation identity. Missing credentials produce
`parent-setup-required`; there is intentionally no general Parent enrollment
or first-visitor setup API. Parent verification returns the structural
`{ kind: 'parent', householdId }` seam used by the shared failed-attempt ledger,
but this vault stores no attempt counters or lockout state.

Rotation is exposed only through `rotateParentPinAuthorized`, whose integration
port must consume live Parent credential/session step-up authority and verify
that its actor/session household matches the exact binding in the supplied
context. Recovery
can only replace verifier material with an unusable `reset-required` tombstone
after its installation claim/recovery authorization port approves. Neither API
creates a recovery PIN or elevates Parent authority into installation-manager,
Study, Admin, learner, or hosted authentication authority.

## Legacy migration state machine

Per profile, migration advances monotonically through:

`classified -> credential-persisted -> verifier-verified -> educational-data-sanitized -> complete`

An empty legacy PIN is classified `unenrolled` and creates no credential. An
exact four-digit PIN is `migratable`: it is used in memory to create the
verifier, the record is persisted, read back, and verified before the
preflighted credential-free educational clone is durably written. A
caller-supplied educational data persistence port must write that clone and return its
read-back. The migration verifies exact, credential-free structural equality
before either final journal stage is recorded. Missing persistence, write or
read failure, and mismatched read-back leave the journal retryable at
`verifier-verified`. Every other value is
`reset-required`; an unusable reset tombstone is persisted and the learner must
re-enroll. Existing partial records are verified and reused on retry. A
conflicting record fails closed into reset-required state. Journal stages make
interruption visible and safe to retry independently for every profile.

`sanitizeAndEnrollLegacyImportCredentials` provides the same behavior under a
separate import journal namespace. Its result contains sanitized educational
data and non-secret outcomes only; it never returns or persists raw imported
PINs. Both learner-only entry points reject a pending non-empty root
`parentPin`; that credential must go through the binding-aware coordinated
Parent migration so one domain cannot erase the other.

Parent migration uses its own binding-scoped journal:

`classified -> credential-persisted -> verifier-verified -> educational-data-persisted -> complete`

Only exact root `AppState.parentPin` is consumed. Missing or empty legacy state
returns `parent-setup-required`; malformed legacy state becomes a bound,
unusable reset tombstone. Non-JSON or executable values in either accepted
legacy credential field fail preflight. The full shared portable-security
sanitizer runs before local writes, so nested or aliased Parent PIN/verifier
fields fail closed.

The coordinator prepares and verifies the Parent record and every legacy
learner record before one credential-free educational-state publication. That
publication must be an atomic compare-and-swap against the exact raw snapshot;
an exclusive binding-scoped lock and a frozen active-binding snapshot cover the
operation. The Parent journal commits to the expected credential-free dataset
and the complete device-local credential set. If a crash occurs after the CAS
removed plaintext, the exact binding, verifier-verified journal, matching
commitments, strict records, and durable read-back allow a no-plaintext retry.
No PIN, salt, or verifier is written to the journal.

# Device-local learner credential foundation

This module stores learner convenience-lock credentials in a dedicated browser
namespace, one record per profile:

`homeschool-hq:security:learner-credentials:v1:<encoded-profile-id>`

The namespace is structurally separate from `homeschool-hq:app:v2`. Nothing in
this module adds credentials to `Profile`, `AppState`, normal backups, sync,
Admin, staff, installation-manager, or Study identity. Migration journals use
their own `homeschool-hq:security:*:v1` namespaces and contain state labels and
profile IDs only. They never contain a PIN, verifier, salt, or recovery secret.

## Verifier scheme v2

- WebCrypto PBKDF2 with HMAC-SHA-256
- versioned domain `manuel-academy:learner-pin:v2`
- independently length-framed UTF-8 domain, exact profile ID, and PIN input
- no profile-ID normalization; composed and decomposed valid IDs remain distinct
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

## Legacy migration state machine

Per profile, migration advances monotonically through:

`classified -> credential-persisted -> verifier-verified -> educational-data-sanitized -> complete`

An empty legacy PIN is classified `unenrolled` and creates no credential. An
exact four-digit PIN is `migratable`: it is used in memory to create the
verifier, the record is persisted, read back, and verified before the
credential-free educational clone is produced. A caller-supplied educational
data persistence port must then durably write that clone and return its
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
PINs.

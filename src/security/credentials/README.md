# Device-local credential foundation

This module stores learner convenience-lock credentials in a dedicated browser
namespace, one record per profile:

`homeschool-hq:security:learner-credentials:v1:<encoded-profile-id>`

The namespace is structurally separate from `homeschool-hq:app:v2`. Nothing in
this module adds credentials to `Profile`, `AppState`, normal backups, sync,
Admin, staff, installation-manager, or Study identity. Migration journals use
their own versioned `homeschool-hq:security:*` namespaces and contain only non-secret
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

`homeschool-hq:security:parent-credentials:v2:<installation-id>:<household-id>`

Schema-v1 blobs are never reinterpreted as schema v2. They remain inert and
require an installation-authorized reset/recovery operation before a new
schema-v2 credential can become authoritative.

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

Every supported Parent operation also requires a rollback-resistant generation
authority outside the device-local credential-blob domain. It binds the exact
record commitment, monotonic generation, active generation, and immutable
migration-completion commitment. Verification reads this authority and record
both before and after PBKDF2; a concurrent reset, rotation, recovery, or stale
record restoration therefore fails closed. `prepared` and inactive `enrolled`
records never authenticate.

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

Parent migration uses its own binding-scoped schema-v2 journal:

`prepared -> educational-committed -> credential-promoted -> completed`

The supported API accepts only the installation binding and operation ports.
It never accepts a credential-bearing caller snapshot. Under the exclusive
Parent lock it obtains the exact legacy root `AppState.parentPin` directly from
authoritative durable persistence. Missing or empty legacy state returns
`parent-setup-required`; malformed legacy state becomes a bound, unusable reset
tombstone. Non-JSON or executable values in Parent or learner credential fields
fail descriptor-safe preflight. The full portable-security sanitizer runs
before mutation, so nested or aliased PIN/verifier material fails closed.

The durable integration port atomically reads educational data with an opaque,
ABA-resistant revision, a random 32-byte migration receipt, and an immutable
prepared-transaction commitment plus completion commitment. Its
compare-and-swap writes the credential-free data, receipt, and exact prepared
journal invariant together. A false result or exception always ends that call
with Parent inactive. If exact read-back proves the unpredictable receipt,
prepared commitment, and credential-free data were committed, only a later
fresh invocation may resume. Ordinary writers must preserve the migration
metadata and change the revision on every write.

Parent and learner material is prepared before publication, but Parent
`prepared` state is explicitly non-authenticating. After exact CAS/read-back,
learner completion, credential promotion, and a sealed completed journal, the
adapter acquires its educational-writer lock, atomically installs the immutable
completion commitment, and holds the lock through the external Parent authority
CAS. Coordinated learner credential/journal writers must acquire that same
integration lock while Parent migration is finalizing. The coordinator checks
the exact learner set both before and after completion anchoring. The Parent CAS
anchors the same completion commitment and activates only the
exact enrolled generation. Reset-required and setup-required completion are
anchored without activating a PIN. A crash at any boundary resumes from the
receipt, journal, pending record, and external anchors; it cannot turn an
unproven preparation into Parent authority. No PIN, salt, or verifier is stored
in the journal or returned as educational data.

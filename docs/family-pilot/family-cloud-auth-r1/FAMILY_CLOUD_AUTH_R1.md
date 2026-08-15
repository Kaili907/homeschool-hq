# Family Cloud Account + Cross-Device Auth R1

## Inputs and boundary

- Product base: `3b89a20234d2e8a2ddfa11f9de27bd8d10a82fa4`
- Canonical bearer contract: `2e99baad947f1c0fc82230cab87e04f68f236f0e`
- Hosted contact during implementation and tests: none

This layer reuses the browser Supabase session client and the existing
`VerifiedAuthContext` (`supabase-access-token`) contract. It does not decode or
verify a second bearer. Household authority is resolved by querying the
existing `academy_household_memberships` relation with the pinned bearer; RLS
derives `auth.uid()`, and no household selector is accepted from the caller.

## Authority sequence

```text
Supabase Auth Parent session
  -> canonical server-verified remote user + access token
  -> one active academy_household_memberships row
  -> FamilyCloudLocalDataPort establishes the matching household
  -> household-scoped browser stores open
  -> learner selection
  -> existing device-local learner PIN verifier
  -> active learner dashboard
```

The hosted-data port receives the canonical authorization only for the duration
of establishment. Its payload contract excludes PINs and PIN verifiers. The
Supabase client remains the sole owner of provider session persistence and
refresh.

## Device and session policy

The application persists only a nonsecret link marker containing schema
version, provider account reference, household reference, and link time. It
never stores a bearer, provider password, Parent PIN, learner PIN, or PIN
verifier in that marker.

- **Lock** clears the active learner and retains the household provider session.
- **Switch learner** clears the active learner and requires the selected
  learner's local PIN where configured.
- **Sign out** clears the active learner, linked-device authority, and Supabase
  provider session. Household IndexedDB/local data is not deleted.
- **Offline / saved on this device** is available only when the device link and
  matching household-local data both exist. It carries no cloud authority.
- **Expired online session** is presented as expired, never as offline or
  authenticated.

## Isolation

Each authenticated household receives an encoded storage namespace wrapping
the accepted Core and final-app stores. Backup preview, export, and restore use
the same scoped stores. A household switch therefore cannot read, overwrite,
reset, export, or restore another household's local Family Pilot state.

Learner access is a second, narrower boundary. The household determines the
only directory that can be searched; the learner PIN activates exactly one
learner in that directory; dashboard reads always carry that exact household
and learner pair. Parent views remain separately protected by the existing
local Parent PIN contract. The Parent PIN is never used as a provider password.

## Convergence seam

`FamilyCloudLocalDataPort` is the narrow handoff to the accepted Hosted Sync R2
state/RPC composition. `READY` means matching household data has been safely
opened or hydrated before the Family Pilot controller mounts. `OFFLINE` and
`UNAVAILABLE` never fabricate cloud authority or clear local state. This branch
does not activate or contact hosted Supabase; production/staging composition
supplies the reviewed data port and the included Supabase auth/membership
adapters.

import type { AppState, Profile } from './types'

/**
 * PORTABLE LEARNER DATA — the one place a learner credential is stripped.
 *
 * `Profile.pin` is a legacy migration/import field and a blank compatibility
 * sentinel in live educational state. The actual device-local credential lives
 * only in the reviewed credential vault. Neither form may travel in an export,
 * local safety copy, or Sync V2 payload.
 *
 * Every credential-stripping path in the app routes through `toPortableProfile`.
 * Do not add a second redactor.
 */

/** The only value `Profile.pin` may carry after security boot. */
export const NO_LEARNER_CREDENTIAL = ''

/** Profile keys that are local-only credentials and must never be portable. */
export type LearnerCredentialKey = 'pin'

/**
 * A learner profile with every local-only credential removed. Derived from
 * `Profile` by `Omit`, so a new educational field is portable automatically and
 * cannot be forgotten here.
 */
export type PortableProfile = Omit<Profile, LearnerCredentialKey>

/**
 * Compile-time check for the current declared relationship: `PortableProfile`
 * omits every key in `LearnerCredentialKey` and no other current `Profile` key.
 * It cannot identify the security meaning of a future field; any new local-only
 * credential must still be deliberately added to `LearnerCredentialKey`.
 */
export type PortableProfileOmitsExactlyCredentials =
  Exclude<keyof Profile, keyof PortableProfile> extends LearnerCredentialKey
    ? LearnerCredentialKey extends Exclude<keyof Profile, keyof PortableProfile>
      ? true
      : never
    : never

/** Fails to compile if the current declared omit relationship stops holding. */
export const PORTABLE_PROFILE_DRIFT_PIN: PortableProfileOmitsExactlyCredentials =
  true

/**
 * Compatibility row used by the existing reconciliation engine. Its `pin`
 * field is pinned to the empty sentinel; the Sync V2 serializer removes that
 * field before RPC dispatch. The literal type prevents a legacy raw Profile
 * from being assigned to this intermediate shape.
 */
export type WireProfile = PortableProfile & {
  pin: typeof NO_LEARNER_CREDENTIAL
}

/** An AppState whose learner profiles carry no credential. `parentPin` is out of scope. */
export type PortableAppState = Omit<AppState, 'profiles'> & {
  profiles: Record<string, PortableProfile>
}

/** THE projector: a learner profile with its credential removed. */
export function toPortableProfile(profile: Profile): PortableProfile {
  const { pin: _pin, ...portable } = profile
  return portable
}

/** The wire form: credential-free, but carrying the key the cloud contract requires. */
export function toWireProfile(profile: Profile): WireProfile {
  return { ...toPortableProfile(profile), pin: NO_LEARNER_CREDENTIAL }
}

/** Whole-state projection, for export files and parseable local safety copies. */
export function toPortableAppState(state: AppState): PortableAppState {
  const profiles: Record<string, PortableProfile> = {}
  for (const [id, profile] of Object.entries(state.profiles)) {
    profiles[id] = toPortableProfile(profile)
  }
  return { ...state, profiles }
}

/**
 * CREDENTIAL AUTHORITY — a learner PIN arriving from a backup file or from the
 * cloud is never authoritative.
 *
 * Imports and reconciliation always project the educational compatibility
 * field to the blank sentinel. The separate credential vault remains unchanged;
 * genuinely new profiles enroll through the application security transaction.
 */
export function adoptedLearnerCredential(
  _local: Profile | undefined,
): Profile['pin'] {
  return NO_LEARNER_CREDENTIAL
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  )
}

/**
 * Blank the exact legacy learner PIN field in freshly parsed, not-yet-validated
 * import text. This runs before validation so imported PIN material is discarded
 * before any application decision. Non-object input remains for the validator
 * to reject.
 */
export function withLocalLearnerCredentials(
  current: AppState,
  parsed: unknown,
): unknown {
  if (!plainObject(parsed)) return parsed
  const profiles = parsed.profiles
  if (!plainObject(profiles)) return parsed
  const rebound: Record<string, unknown> = {}
  for (const [id, candidate] of Object.entries(profiles)) {
    rebound[id] = plainObject(candidate)
      ? { ...candidate, pin: adoptedLearnerCredential(current.profiles[id]) }
      : candidate
  }
  return { ...parsed, profiles: rebound }
}

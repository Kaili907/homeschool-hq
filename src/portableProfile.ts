import type { AppState, Profile } from './types'

/**
 * PORTABLE LEARNER DATA — the one place a learner credential is stripped.
 *
 * `Profile.pin` is a DEVICE-LOCAL credential. It authenticates a girl on the
 * machine she is sitting at (see App.tsx: `pin === profile.pin`) and it must
 * never travel — not in an export file, not in a local safety copy, not to the
 * cloud. Until the final learner-credential migration lands, `pin` legitimately
 * stays on the local runtime `Profile`; everything that LEAVES local runtime
 * goes through the projectors here.
 *
 * Every credential-stripping path in the app routes through `toPortableProfile`.
 * Do not add a second redactor.
 */

/** The value `Profile.pin` carries when no credential is established. */
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
 * The shape a profile takes ON THE WIRE. The cloud's stored contract requires a
 * `pin` key of type text (see the CAS validator `academy_sync_profile_is_valid`),
 * so the key is kept and pinned to the empty string rather than dropped — the
 * learner's actual credential still never leaves the device. The literal `''`
 * type means a real `Profile` cannot be assigned into a wire row by mistake.
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
 * An id that already exists on THIS device keeps the credential this device
 * already trusts; that is what stops a hostile backup from replacing (or, just
 * as dangerous, blanking) the PIN that currently gates a girl's profile. Blanking
 * is not a safe neutral: App.tsx routes `pin === ''` to the create-a-PIN screen,
 * which signs the next person in without checking anything.
 *
 * An id genuinely new to this device gets no credential, which is the same state
 * `emptyProfile` seeds — she enrols a PIN at first sign-in on this device.
 */
export function adoptedLearnerCredential(
  local: Profile | undefined,
): Profile['pin'] {
  return local ? local.pin : NO_LEARNER_CREDENTIAL
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  )
}

/**
 * Rebind every learner credential in freshly parsed, NOT-YET-VALIDATED import
 * text to this device's authority. Runs BEFORE validation so the imported pin is
 * discarded before anything trusts it, and so validation still judges the file's
 * educational data on its own merits. Non-object input is passed through
 * untouched for the validator to reject.
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

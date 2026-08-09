import { toCredentialFreeEducationalProfile } from '../security/contracts'
import type { CredentialFreeEducationalProfile } from '../security/contracts'
import type { Profile } from '../types'
import { profileHash } from './engine'
import { canonicalSerialize, validateProfileForSync } from './provenance'

export class CredentialBearingProfileError extends Error {
  readonly code = 'ACADEMY_SYNC_CREDENTIAL_BEARING_PROFILE'

  constructor(message = 'Credential-bearing profile data cannot be synchronized.') {
    super(message)
    this.name = 'CredentialBearingProfileError'
  }
}

export class InvalidEducationalProfileError extends Error {
  readonly code = 'ACADEMY_SYNC_INVALID_EDUCATIONAL_PROFILE'

  constructor(message = 'The educational profile is not safe to synchronize.') {
    super(message)
    this.name = 'InvalidEducationalProfileError'
  }
}

const EDUCATIONAL_PROFILE_FIELD_ALLOWLIST = {
  id: true,
  name: true,
  grade: true,
  theme: true,
  skills: true,
  missions: true,
  template: true,
  streaks: true,
  createdAt: true,
  placementDone: true,
  totals: true,
  lastPracticeDate: true,
  assessments: true,
  hsStats: true,
  courses: true,
  collegeTasks: true,
  tutor: true,
  tutorFlags: true,
  walkthroughLog: true,
  stars: true,
  coolStars: true,
  typing: true,
  reading: true,
  attendance: true,
  serviceLog: true,
  tutorChats: true,
  tutorCalls: true,
  tutorDailyCap: true,
  mindset: true,
  assistant: true,
  pacing: true,
  masterySnapshots: true,
  scheduleExtensions: true,
  academy: true,
  workingLevels: true,
} as const satisfies Record<Exclude<keyof Profile, 'pin'>, true>

function credentialFreeBoundary(profile: Profile): CredentialFreeEducationalProfile {
  try {
    return toCredentialFreeEducationalProfile(profile)
  } catch (cause) {
    if (
      cause instanceof Error &&
      /credential-like material is forbidden/i.test(cause.message)
    ) {
      throw new CredentialBearingProfileError(cause.message)
    }
    throw new InvalidEducationalProfileError()
  }
}

/**
 * Copy only the current educational Profile allowlist. The input has already
 * crossed the recursive foundation boundary, so every nested value is a safe
 * clone and no unexpected top-level property can enter the wire payload.
 */
function copyAllowedEducationalFields(
  profile: CredentialFreeEducationalProfile,
): CredentialFreeEducationalProfile {
  if (
    Object.keys(profile).some(
      (key) =>
        !Object.prototype.hasOwnProperty.call(
          EDUCATIONAL_PROFILE_FIELD_ALLOWLIST,
          key,
        ),
    )
  ) {
    throw new InvalidEducationalProfileError(
      'The educational profile contains an unapproved synchronization field.',
    )
  }
  return {
    id: profile.id,
    name: profile.name,
    grade: profile.grade,
    theme: profile.theme,
    skills: profile.skills,
    missions: profile.missions,
    ...(profile.template === undefined ? {} : { template: profile.template }),
    streaks: profile.streaks,
    createdAt: profile.createdAt,
    placementDone: profile.placementDone,
    totals: profile.totals,
    ...(profile.lastPracticeDate === undefined
      ? {}
      : { lastPracticeDate: profile.lastPracticeDate }),
    ...(profile.assessments === undefined
      ? {}
      : { assessments: profile.assessments }),
    ...(profile.hsStats === undefined ? {} : { hsStats: profile.hsStats }),
    ...(profile.courses === undefined ? {} : { courses: profile.courses }),
    ...(profile.collegeTasks === undefined
      ? {}
      : { collegeTasks: profile.collegeTasks }),
    ...(profile.tutor === undefined ? {} : { tutor: profile.tutor }),
    ...(profile.tutorFlags === undefined
      ? {}
      : { tutorFlags: profile.tutorFlags }),
    ...(profile.walkthroughLog === undefined
      ? {}
      : { walkthroughLog: profile.walkthroughLog }),
    ...(profile.stars === undefined ? {} : { stars: profile.stars }),
    ...(profile.coolStars === undefined
      ? {}
      : { coolStars: profile.coolStars }),
    ...(profile.typing === undefined ? {} : { typing: profile.typing }),
    ...(profile.reading === undefined ? {} : { reading: profile.reading }),
    ...(profile.attendance === undefined
      ? {}
      : { attendance: profile.attendance }),
    ...(profile.serviceLog === undefined
      ? {}
      : { serviceLog: profile.serviceLog }),
    ...(profile.tutorChats === undefined
      ? {}
      : { tutorChats: profile.tutorChats }),
    ...(profile.tutorCalls === undefined
      ? {}
      : { tutorCalls: profile.tutorCalls }),
    ...(profile.tutorDailyCap === undefined
      ? {}
      : { tutorDailyCap: profile.tutorDailyCap }),
    ...(profile.mindset === undefined ? {} : { mindset: profile.mindset }),
    ...(profile.assistant === undefined
      ? {}
      : { assistant: profile.assistant }),
    ...(profile.pacing === undefined ? {} : { pacing: profile.pacing }),
    ...(profile.masterySnapshots === undefined
      ? {}
      : { masterySnapshots: profile.masterySnapshots }),
    ...(profile.scheduleExtensions === undefined
      ? {}
      : { scheduleExtensions: profile.scheduleExtensions }),
    ...(profile.academy === undefined ? {} : { academy: profile.academy }),
    ...(profile.workingLevels === undefined
      ? {}
      : { workingLevels: profile.workingLevels }),
  }
}

/** Explicit Sync Protocol v2 educational-profile serializer. */
export function serializeCredentialFreeEducationalProfile(
  profile: Profile,
): CredentialFreeEducationalProfile {
  const credentialFree = credentialFreeBoundary(profile)
  if (!validateProfileForSync(profile.id, profile)) {
    throw new InvalidEducationalProfileError()
  }
  return copyAllowedEducationalFields(credentialFree)
}

export interface LegacyPinConsumer {
  (pin: string): void
}

/**
 * A one-use, non-serializable handoff for the future local-vault integration.
 * The educational model and JSON representations never receive the raw PIN.
 */
export interface LegacyPinHandoff {
  readonly kind: 'legacy-pin'
  readonly profileId: string
  readonly migrationRequired: true
  readonly consumed: boolean
  consume(consumer: LegacyPinConsumer): void
  discard(): void
  toJSON(): Readonly<{
    kind: 'legacy-pin'
    profileId: string
    migrationRequired: true
    consumed: boolean
    secret: '[redacted]'
  }>
}

class OneUseLegacyPinHandoff implements LegacyPinHandoff {
  readonly kind = 'legacy-pin' as const
  readonly migrationRequired = true as const
  #pin: string | null

  constructor(
    readonly profileId: string,
    pin: string,
  ) {
    this.#pin = pin
  }

  get consumed(): boolean {
    return this.#pin === null
  }

  consume(consumer: LegacyPinConsumer): void {
    if (this.#pin === null) {
      throw new Error('The legacy PIN handoff has already been consumed or discarded.')
    }
    const pin = this.#pin
    this.#pin = null
    consumer(pin)
  }

  discard(): void {
    this.#pin = null
  }

  toJSON() {
    return {
      kind: this.kind,
      profileId: this.profileId,
      migrationRequired: this.migrationRequired,
      consumed: this.consumed,
      secret: '[redacted]' as const,
    }
  }
}

export type EducationalProfileReadResult =
  | Readonly<{
      ok: true
      source: 'legacy' | 'credential-free-v2'
      profile: CredentialFreeEducationalProfile
      legacyCredentialHandoff: LegacyPinHandoff | null
    }>
  | Readonly<{
      ok: false
      classification: 'credential-bearing-payload-rejection' | 'invalid-profile'
      error: string
    }>

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Read either a legacy row with `pin` or a credential-free v2 row. Legacy PIN
 * material is available only through the one-use local-vault handoff.
 */
export function readEducationalProfile(
  value: unknown,
): EducationalProfileReadResult {
  if (!isPlainRecord(value)) {
    return {
      ok: false,
      classification: 'invalid-profile',
      error: 'The cloud returned an invalid educational profile.',
    }
  }

  const hasLegacyPin = Object.prototype.hasOwnProperty.call(value, 'pin')
  const legacyPin = hasLegacyPin ? value.pin : undefined
  if (
    hasLegacyPin &&
    (typeof legacyPin !== 'string' ||
      (legacyPin.length > 0 && !/^\d{4}$/.test(legacyPin)))
  ) {
    return {
      ok: false,
      classification: 'invalid-profile',
      error: 'The cloud returned an invalid legacy learner credential.',
    }
  }

  try {
    const boundaryResult = credentialFreeBoundary(value as unknown as Profile)
    const educational = copyAllowedEducationalFields(boundaryResult)
    const validationProfile = {
      ...educational,
      pin: '',
    } as Profile
    if (!validateProfileForSync(educational.id, validationProfile)) {
      return {
        ok: false,
        classification: 'invalid-profile',
        error: 'The cloud returned an invalid educational profile.',
      }
    }
    return {
      ok: true,
      source: hasLegacyPin ? 'legacy' : 'credential-free-v2',
      profile: educational,
      legacyCredentialHandoff:
        typeof legacyPin === 'string' && legacyPin.length > 0
          ? new OneUseLegacyPinHandoff(educational.id, legacyPin)
          : null,
    }
  } catch (cause) {
    return cause instanceof CredentialBearingProfileError
      ? {
          ok: false,
          classification: 'credential-bearing-payload-rejection',
          error: cause.message,
        }
      : {
          ok: false,
          classification: 'invalid-profile',
          error: 'The cloud returned malformed or unsafe educational data.',
        }
  }
}

function fnv1a32(text: string): string {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Credential-free canonical fingerprint; intentionally namespaced from v1. */
export function credentialFreeProfileFingerprint(profile: Profile): string {
  const educational = serializeCredentialFreeEducationalProfile(profile)
  const canonical = canonicalSerialize(educational)
  return `academy-profile-v2:${fnv1a32(`academy-sync-profile-v2\u0000${canonical}`)}`
}

export type ProfileFingerprintReconciliation =
  | Readonly<{
      kind: 'credential-free-match'
      credentialFreeFingerprint: string
      requiresReview: false
    }>
  | Readonly<{
      kind: 'legacy-credential-input-ambiguous'
      credentialFreeFingerprint: string
      requiresReview: true
    }>
  | Readonly<{
      kind: 'mismatch'
      credentialFreeFingerprint: string
      requiresReview: true
    }>

/**
 * Old hashes included the PIN. A match against that algorithm is evidence of
 * the old domain, never equivalence with the v2 credential-free fingerprint.
 */
export function reconcileStoredProfileFingerprint(
  profile: Profile,
  storedFingerprint: string,
): ProfileFingerprintReconciliation {
  const credentialFreeFingerprint = credentialFreeProfileFingerprint(profile)
  if (storedFingerprint === credentialFreeFingerprint) {
    return {
      kind: 'credential-free-match',
      credentialFreeFingerprint,
      requiresReview: false,
    }
  }
  if (storedFingerprint === profileHash(profile)) {
    return {
      kind: 'legacy-credential-input-ambiguous',
      credentialFreeFingerprint,
      requiresReview: true,
    }
  }
  return {
    kind: 'mismatch',
    credentialFreeFingerprint,
    requiresReview: true,
  }
}

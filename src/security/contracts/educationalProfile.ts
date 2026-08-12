import type { Profile } from '../../types'
import {
  assertPortableSecurityKeyFree,
  PortableSecurityStructureError,
  type PortableSecurityKeyFreeJsonValue,
} from './portableSecurity'
import { parseProfileId } from './profileId'

/**
 * The exact educational schema a profile may project into portable data.
 *
 * This replaces an earlier hand-listed set of forbidden credential field names.
 * A deny-list of names could always be sidestepped by a spelling variant
 * (`parentPinValue`, `parentSaltBase64`, …) and had to grow forever to keep up;
 * an allow-list derived from `Profile` cannot be sidestepped by renaming,
 * because a name that is not educational schema is simply not projectable.
 *
 * The `Record<Exclude<keyof Profile, 'pin'>, true>` type makes drift a compile
 * error rather than silent data loss: a new `Profile` field must be classified
 * here before it can cross the boundary.
 */
const EDUCATIONAL_PROFILE_FIELDS: Readonly<Record<Exclude<keyof Profile, 'pin'>, true>> =
  Object.freeze({
    academy: true, assessments: true, assistant: true, attendance: true,
    collegeTasks: true, coolStars: true, courses: true, createdAt: true,
    grade: true, hsStats: true, id: true, lastPracticeDate: true,
    masterySnapshots: true, mindset: true, missions: true, name: true,
    pacing: true, placementDone: true, reading: true, scheduleExtensions: true,
    serviceLog: true, skills: true, stars: true, streaks: true, template: true,
    theme: true, totals: true, tutor: true, tutorCalls: true, tutorChats: true,
    tutorDailyCap: true, tutorFlags: true, typing: true, walkthroughLog: true,
    workingLevels: true,
  })

/** The only Profile shape future sync serializers may accept. */
export type CredentialFreeEducationalProfile = Readonly<Omit<Profile, 'pin'>>

function fail(path: string, message: string): never {
  throw new PortableSecurityStructureError(path, message)
}

function withoutExactLegacyRootPin(profile: Profile): Record<string, unknown> {
  if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
    fail('$', 'Educational Profile must be a plain object')
  }
  const prototype = Object.getPrototypeOf(profile)
  if (prototype !== Object.prototype && prototype !== null) {
    fail('$', 'Educational Profile must be a plain object')
  }

  const educationalData: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(profile)) {
    if (typeof key === 'symbol') {
      fail('$', 'Portable data contains a symbol key')
    }
    const descriptor = Object.getOwnPropertyDescriptor(profile, key)
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      fail(`$.${key}`, 'Portable data contains a non-JSON or accessor property')
    }
    if (key === 'pin') continue
    // Explicit schema projection: anything outside the educational schema is
    // refused here, so a renamed credential field never reaches portable data.
    if (!Object.hasOwn(EDUCATIONAL_PROFILE_FIELDS, key)) {
      fail(`$.${key}`, 'Field is not part of the educational profile schema')
    }
    Object.defineProperty(educationalData, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: descriptor.value,
    })
  }
  return educationalData
}

/**
 * Removes the one accepted legacy field and fails closed on any other
 * credential, recovery, or active-authorization material at any depth.
 * Profile.pin remains in the legacy model until final integration.
 */
export function toCredentialFreeEducationalProfile(
  profile: Profile,
): CredentialFreeEducationalProfile {
  const educationalData = withoutExactLegacyRootPin(profile)
  assertPortableSecurityKeyFree(educationalData)
  if (parseProfileId(educationalData.id) === null) {
    fail('$.id', 'Educational Profile requires a canonical ProfileId')
  }

  const detached = JSON.parse(JSON.stringify(educationalData)) as PortableSecurityKeyFreeJsonValue
  assertPortableSecurityKeyFree(detached)
  return detached as unknown as CredentialFreeEducationalProfile
}

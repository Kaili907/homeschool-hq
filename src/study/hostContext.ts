import type { Profile } from '../types'
import type { SyncStatus } from '../sync/types'
import type {
  HostStudyLaunchContext,
  StudyAccessibilitySettings,
  StudySubject,
} from './types'

export type HostStudyContextResult =
  | { readonly status: 'ready'; readonly context: HostStudyLaunchContext }
  | { readonly status: 'unavailable'; readonly reason: string }

function opaqueRef(prefix: string, input: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return `${prefix}:${hash.toString(16).padStart(16, '0')}`
}

export function deriveStudyHouseholdRef(authenticatedUserRef: string): string {
  return opaqueRef('household', authenticatedUserRef)
}

export function deriveStudyLearnerRef(authenticatedUserRef: string, hostProfileRef: string): string {
  return opaqueRef('learner', `${authenticatedUserRef}\u0000${hostProfileRef}`)
}

export function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0))
    return value.includes('/') || value === 'UTC'
  } catch {
    return false
  }
}

export function localDevelopmentHouseholdTimeZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return typeof zone === 'string' && isValidIanaTimeZone(zone) ? zone : null
}

export function learnerLocalDate(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((candidate) => candidate.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export const DEFAULT_STUDY_ACCESSIBILITY: StudyAccessibilitySettings = Object.freeze({
  largeText: false,
  reducedMotion: false,
  noAudio: false,
  captions: true,
  transientTranscript: false,
  highContrast: false,
  oneTaskAtATime: true,
})

export function buildHostStudyContext(input: {
  readonly enabled: boolean
  readonly syncStatus: Pick<SyncStatus, 'user' | 'binding' | 'provenance'>
  readonly profile: Profile | null
  readonly subject: StudySubject
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
  readonly householdTimeZone: string | null
  readonly accessibility?: StudyAccessibilitySettings
  readonly timerHidden?: boolean
}): HostStudyContextResult {
  if (!input.enabled) return { status: 'unavailable', reason: 'Study Engine is disabled.' }
  if (!input.syncStatus.user) return { status: 'unavailable', reason: 'Sign in to the household before opening Study.' }
  if (input.syncStatus.binding !== 'bound' || input.syncStatus.provenance !== 'verified') {
    return { status: 'unavailable', reason: 'Verify this household data binding before opening Study.' }
  }
  if (!input.profile) return { status: 'unavailable', reason: 'Select an authenticated learner first.' }
  if (!input.householdTimeZone || !isValidIanaTimeZone(input.householdTimeZone)) {
    return { status: 'unavailable', reason: 'A valid household time zone is required.' }
  }
  const userRef = input.syncStatus.user.id
  return {
    status: 'ready',
    context: {
      householdRef: deriveStudyHouseholdRef(userRef),
      learnerRef: deriveStudyLearnerRef(userRef, input.profile.id),
      hostProfileRef: input.profile.id,
      grade: Number(input.profile.grade),
      subject: input.subject,
      lessonRef: input.lessonRef,
      skillRefs: [...input.skillRefs],
      householdTimeZone: input.householdTimeZone,
      learnerLocalDate: learnerLocalDate(new Date(), input.householdTimeZone),
      accessibility: input.accessibility ?? DEFAULT_STUDY_ACCESSIBILITY,
      timerPreference: {
        visibility: input.timerHidden ? 'hidden' : 'shown',
        milestonesOnly: !!input.timerHidden,
      },
      parentLimits: { maximumWorkMinutes: 30, breakMinutes: 5 },
      accommodationLimits: {},
    },
  }
}

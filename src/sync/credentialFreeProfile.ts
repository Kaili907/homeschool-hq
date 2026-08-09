import { assertCredentialFreeEducationalStructure } from '../security/contracts'
import type { CredentialFreeEducationalProfile } from '../security/contracts'
import type { Profile } from '../types'
import { profileHash } from './engine'
import {
  canonicalSerialize,
  sha256Hex,
  validateProfileForSync,
} from './provenance'

export class CredentialBearingProfileError extends Error {
  readonly code = 'ACADEMY_SYNC_CREDENTIAL_BEARING_PROFILE'

  constructor(
    message = 'Credential-bearing profile data cannot be synchronized.',
  ) {
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

type EducationalSchema =
  | Readonly<{ kind: 'leaf' }>
  | Readonly<{ kind: 'omit' }>
  | Readonly<{ kind: 'array'; item: EducationalSchema }>
  | Readonly<{ kind: 'record'; value: EducationalSchema }>
  | Readonly<{
      kind: 'object'
      fields: Readonly<Record<string, EducationalSchema>>
    }>

const LEAF: EducationalSchema = Object.freeze({ kind: 'leaf' })
const OMIT: EducationalSchema = Object.freeze({ kind: 'omit' })
const arrayOf = (item: EducationalSchema): EducationalSchema => ({
  kind: 'array',
  item,
})
const recordOf = (value: EducationalSchema): EducationalSchema => ({
  kind: 'record',
  value,
})
const fields = (
  allowed: Readonly<Record<string, EducationalSchema>>,
): EducationalSchema => ({ kind: 'object', fields: allowed })

const skillState = fields({
  attempts: LEAF,
  correct: LEAF,
  mastery: LEAF,
  lastSeen: LEAF,
})
const missionItem = fields({
  id: LEAF,
  label: LEAF,
  done: LEAF,
  auto: LEAF,
  autoKind: LEAF,
})
const missionTemplateItem = fields({
  id: LEAF,
  label: LEAF,
  auto: LEAF,
  autoKind: LEAF,
  days: arrayOf(LEAF),
  weeklyOnce: LEAF,
  season: LEAF,
})
const assessmentAttempt = fields({
  testId: LEAF,
  profileId: LEAF,
  startedAt: LEAF,
  finishedAt: LEAF,
  answers: recordOf(fields({ value: LEAF, skipped: LEAF, msOnItem: LEAF })),
  autoScore: fields({
    bySection: recordOf(fields({ correct: LEAF, of: LEAF })),
    gradedItems: LEAF,
    skips: LEAF,
  }),
})
const tutorMessage = fields({ role: LEAF, text: LEAF, ts: LEAF, source: LEAF })
const assistantAction = fields({
  kind: LEAF,
  label: LEAF,
  targetKey: LEAF,
  ts: LEAF,
})
const assistantMessage = fields({
  role: LEAF,
  text: LEAF,
  ts: LEAF,
  source: LEAF,
  action: assistantAction,
  flagged: LEAF,
})
const academyOccasion = fields({
  date: LEAF,
  mode: LEAF,
  met: LEAF,
  kind: LEAF,
})

/**
 * Complete recursive Sync Protocol v2 schema. Object fields are explicit at
 * every depth; records authorize their values' schema, never a generic clone.
 */
const EDUCATIONAL_PROFILE_FIELDS = {
  pin: OMIT,
  id: LEAF,
  name: LEAF,
  grade: LEAF,
  theme: LEAF,
  skills: recordOf(skillState),
  missions: recordOf(fields({ items: arrayOf(missionItem) })),
  template: fields({
    weekday: arrayOf(missionTemplateItem),
    friday: arrayOf(missionTemplateItem),
  }),
  streaks: fields({ current: LEAF, best: LEAF, lastActiveDate: LEAF }),
  createdAt: LEAF,
  placementDone: LEAF,
  totals: fields({
    questionsAnswered: LEAF,
    correct: LEAF,
    bestStreak: LEAF,
    sessions: LEAF,
  }),
  lastPracticeDate: LEAF,
  assessments: fields({
    assigned: arrayOf(
      fields({ testId: LEAF, startCode: LEAF, assignedAt: LEAF }),
    ),
    attempts: arrayOf(assessmentAttempt),
    retakeUnlocked: arrayOf(LEAF),
  }),
  hsStats: recordOf(fields({ attempts: LEAF, correct: LEAF, lastSeen: LEAF })),
  courses: arrayOf(
    fields({
      id: LEAF,
      name: LEAF,
      units: arrayOf(fields({ id: LEAF, label: LEAF, done: LEAF })),
    }),
  ),
  collegeTasks: arrayOf(
    fields({ id: LEAF, label: LEAF, due: LEAF, done: LEAF }),
  ),
  tutor: fields({
    voiceURI: LEAF,
    rate: LEAF,
    voiceOptIn: LEAF,
    voiceMap: recordOf(fields({ provider: LEAF, ref: LEAF, label: LEAF })),
  }),
  tutorFlags: recordOf(
    fields({
      since: LEAF,
      reason: LEAF,
      sessionCount: LEAF,
      weekCount: LEAF,
    }),
  ),
  walkthroughLog: arrayOf(fields({ skillId: LEAF, ts: LEAF, day: LEAF })),
  stars: fields({
    balance: LEAF,
    lifetimeEarned: LEAF,
    ledger: arrayOf(
      fields({
        id: LEAF,
        at: LEAF,
        day: LEAF,
        amount: LEAF,
        reason: LEAF,
        source: LEAF,
      }),
    ),
    pendingRedemptions: arrayOf(
      fields({
        id: LEAF,
        prizeId: LEAF,
        name: LEAF,
        emoji: LEAF,
        cost: LEAF,
        requestedAt: LEAF,
      }),
    ),
  }),
  coolStars: LEAF,
  typing: fields({
    unlockedIndex: LEAF,
    lessons: recordOf(
      fields({
        bestAccuracy: LEAF,
        bestWpm: LEAF,
        passed: LEAF,
        lastSeen: LEAF,
      }),
    ),
    drillsCompleted: LEAF,
    lastPracticedDate: LEAF,
  }),
  reading: fields({
    sessions: arrayOf(
      fields({
        date: LEAF,
        passageId: LEAF,
        mode: LEAF,
        wcpm: LEAF,
        wordsPracticed: arrayOf(LEAF),
        durationSec: LEAF,
      }),
    ),
    seenPassageIds: arrayOf(LEAF),
    calibrations: arrayOf(fields({ date: LEAF, passageId: LEAF, wcpm: LEAF })),
    lastReadDate: LEAF,
  }),
  attendance: fields({
    hoursPerDay: LEAF,
    log: arrayOf(fields({ date: LEAF, hours: LEAF })),
  }),
  serviceLog: arrayOf(
    fields({
      id: LEAF,
      date: LEAF,
      org: LEAF,
      hours: LEAF,
      note: LEAF,
      approved: LEAF,
      createdAt: LEAF,
    }),
  ),
  tutorChats: arrayOf(
    fields({
      id: LEAF,
      skillId: LEAF,
      grade: LEAF,
      day: LEAF,
      startedTs: LEAF,
      problem: LEAF,
      correctAnswer: LEAF,
      herAnswer: LEAF,
      messages: arrayOf(tutorMessage),
      outcome: LEAF,
    }),
  ),
  tutorCalls: arrayOf(LEAF),
  tutorDailyCap: LEAF,
  mindset: fields({
    weeks: recordOf(
      fields({ viewed: LEAF, reflected: LEAF, completedAt: LEAF }),
    ),
  }),
  assistant: fields({
    calls: arrayOf(LEAF),
    sessions: arrayOf(
      fields({
        id: LEAF,
        day: LEAF,
        startedTs: LEAF,
        messages: arrayOf(assistantMessage),
      }),
    ),
    dailyCap: LEAF,
    name: LEAF,
    persona: LEAF,
  }),
  pacing: fields({
    pointers: recordOf(LEAF),
    nudges: arrayOf(
      fields({
        at: LEAF,
        subjectId: LEAF,
        from: LEAF,
        to: LEAF,
        reason: LEAF,
      }),
    ),
  }),
  masterySnapshots: arrayOf(
    fields({
      at: LEAF,
      subject: LEAF,
      level: LEAF,
      note: LEAF,
    }),
  ),
  scheduleExtensions: arrayOf(
    fields({
      id: LEAF,
      label: LEAF,
      days: arrayOf(LEAF),
      start: LEAF,
      end: LEAF,
    }),
  ),
  academy: fields({
    releaseVersion: LEAF,
    grade: LEAF,
    enrolledAt: LEAF,
    courseIds: arrayOf(LEAF),
    lessons: recordOf(
      fields({
        status: LEAF,
        segmentIndex: LEAF,
        releaseVersion: LEAF,
        startedAt: LEAF,
        completedAt: LEAF,
        occasions: arrayOf(academyOccasion),
        revisits: LEAF,
      }),
    ),
    assessments: recordOf(
      arrayOf(fields({ date: LEAF, percent: LEAF, outcome: LEAF })),
    ),
  }),
  workingLevels: recordOf(LEAF),
} as const satisfies Record<keyof Profile, EducationalSchema>

const EDUCATIONAL_PROFILE_SCHEMA = fields(EDUCATIONAL_PROFILE_FIELDS)

const RESERVED_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function invalidField(path: string): InvalidEducationalProfileError {
  return new InvalidEducationalProfileError(
    `The educational profile contains an unapproved synchronization field at ${path}.`,
  )
}

function projectEducationalValue(
  value: unknown,
  schema: EducationalSchema,
  path: string,
): unknown {
  switch (schema.kind) {
    case 'omit':
      return undefined
    case 'leaf':
      if (
        value === null ||
        (typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean')
      ) {
        throw invalidField(path)
      }
      return value
    case 'array':
      if (!Array.isArray(value) || Object.keys(value).length !== value.length) {
        throw invalidField(path)
      }
      return value.map((item, index) =>
        projectEducationalValue(item, schema.item, `${path}[${index}]`),
      )
    case 'record': {
      if (!isPlainRecord(value)) throw invalidField(path)
      const projected: Record<string, unknown> = Object.create(null)
      for (const [key, child] of Object.entries(value)) {
        if (RESERVED_RECORD_KEYS.has(key)) throw invalidField(`${path}.${key}`)
        projected[key] = projectEducationalValue(
          child,
          schema.value,
          `${path}.${key}`,
        )
      }
      return projected
    }
    case 'object': {
      if (!isPlainRecord(value)) throw invalidField(path)
      const projected: Record<string, unknown> = {}
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(schema.fields, key)) {
          throw invalidField(`${path}.${key}`)
        }
      }
      for (const [key, childSchema] of Object.entries(schema.fields)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue
        const child = projectEducationalValue(
          value[key],
          childSchema,
          `${path}.${key}`,
        )
        if (childSchema.kind !== 'omit' && child !== undefined)
          projected[key] = child
      }
      return projected
    }
  }
}

export type EducationalProfileInput = Profile | CredentialFreeEducationalProfile

function credentialFreeBoundary(
  profile: EducationalProfileInput,
): CredentialFreeEducationalProfile {
  try {
    assertCredentialFreeEducationalStructure(profile, {
      allowLegacyRootPin: true,
    })
    if (
      Object.prototype.hasOwnProperty.call(profile, 'pin') &&
      (typeof (profile as { pin?: unknown }).pin !== 'string' ||
        (profile as { pin: string }).pin.length > 64)
    ) {
      throw new InvalidEducationalProfileError()
    }
    const projected = projectEducationalValue(
      profile,
      EDUCATIONAL_PROFILE_SCHEMA,
      'profile',
    ) as CredentialFreeEducationalProfile
    const validationProfile = { ...projected, pin: '' } as Profile
    if (!validateProfileForSync(projected.id, validationProfile)) {
      throw new InvalidEducationalProfileError()
    }
    return projected
  } catch (cause) {
    if (
      cause instanceof Error &&
      /credential-like material is forbidden/i.test(cause.message)
    ) {
      throw new CredentialBearingProfileError(cause.message)
    }
    if (cause instanceof InvalidEducationalProfileError) throw cause
    throw new InvalidEducationalProfileError()
  }
}

/** Explicit recursive Sync Protocol v2 educational-profile serializer. */
export function serializeCredentialFreeEducationalProfile(
  profile: EducationalProfileInput,
): CredentialFreeEducationalProfile {
  return credentialFreeBoundary(profile)
}

export interface LegacyPinConsumer {
  (profileId: string, pin: string): Promise<void>
}

/**
 * A short-lived, memory-only handoff for immediate local-vault enrollment.
 * Successful awaited enrollment erases the one-use PIN. Failed enrollment
 * retains it only on this object for an explicit retry; an idle caller may
 * explicitly discard it. JSON and educational models receive only redaction.
 */
export interface LegacyPinHandoff {
  readonly kind: 'legacy-pin'
  readonly profileId: string
  readonly migrationRequired: true
  readonly consumed: boolean
  consume(consumer: LegacyPinConsumer): Promise<void>
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
  #consuming = false

  constructor(
    readonly profileId: string,
    pin: string,
  ) {
    this.#pin = pin
  }

  get consumed(): boolean {
    return this.#pin === null
  }

  async consume(consumer: LegacyPinConsumer): Promise<void> {
    if (this.#pin === null || this.#consuming) {
      throw new Error(
        'The legacy PIN handoff has already been consumed or discarded.',
      )
    }
    const pin = this.#pin
    this.#consuming = true
    try {
      await consumer(this.profileId, pin)
      this.#pin = null
    } finally {
      this.#consuming = false
    }
  }

  discard(): void {
    if (this.#consuming) {
      throw new Error(
        'Legacy PIN enrollment is in progress and cannot be discarded.',
      )
    }
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
    const educational = credentialFreeBoundary(
      value as unknown as EducationalProfileInput,
    )
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

/** Credential-free canonical fingerprint; intentionally namespaced from v1. */
export async function credentialFreeProfileFingerprint(
  profile: EducationalProfileInput,
): Promise<string> {
  const educational = serializeCredentialFreeEducationalProfile(profile)
  const canonical = canonicalSerialize(educational)
  const digest = await sha256Hex(`academy-sync-profile-v2\u0000${canonical}`)
  return `academy-profile-v2:sha256:${digest}`
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
export async function reconcileStoredProfileFingerprint(
  profile: EducationalProfileInput,
  storedFingerprint: string,
): Promise<ProfileFingerprintReconciliation> {
  const credentialFreeFingerprint =
    await credentialFreeProfileFingerprint(profile)
  if (storedFingerprint === credentialFreeFingerprint) {
    return {
      kind: 'credential-free-match',
      credentialFreeFingerprint,
      requiresReview: false,
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(profile, 'pin') &&
    storedFingerprint === profileHash(profile as Profile)
  ) {
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

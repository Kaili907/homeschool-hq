declare const PROFILE_ID_BRAND: unique symbol

export const CANONICAL_PROFILE_IDS = Object.freeze([
  'p1',
  'p2',
  'p3',
  'p4',
  'p5',
] as const)

type CanonicalProfileId = (typeof CANONICAL_PROFILE_IDS)[number]

/** Canonical Manuel Academy learner identity. Display name and grade are not identity. */
export type ProfileId = CanonicalProfileId & {
  readonly [PROFILE_ID_BRAND]: 'ProfileId'
}

const PROFILE_ID_PATTERN = /^p[1-5]$/

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && PROFILE_ID_PATTERN.test(value)
}

/**
 * Parses an already-canonical learner ID. Input is never trimmed, case-folded,
 * or Unicode-normalized.
 */
export function parseProfileId(value: unknown): ProfileId | null {
  return isProfileId(value) ? value : null
}

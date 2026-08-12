import type { TechCsLessonRef } from '../catalog/types'

/**
 * FF-M7 — accessibility and privacy metadata for the Technology / CS lane.
 *
 * The curriculum source already forbids real credentials in every lesson's
 * safety_and_privacy note ("Never require a real password, private message,
 * precise location, account credential, or identifiable image."). These
 * patterns make that boundary machine-checkable at the catalog boundary too,
 * instead of relying on the source note alone.
 */
const CREDENTIAL_PATTERNS: readonly RegExp[] = [
  /\bpassword\s*[:=]\s*\S+/i,
  /\bapi[_-]?key\s*[:=]\s*\S+/i,
  /\bsecret\s*[:=]\s*\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\btoken\s*[:=]\s*\S{8,}/i,
]

/** True if any string in `values` looks like a real credential or secret. */
export function textContainsCredentialLikeContent(values: readonly string[]): boolean {
  const haystack = values.join('\n')
  return CREDENTIAL_PATTERNS.some((pattern) => pattern.test(haystack))
}

export function containsCredentialLikeContent(lesson: TechCsLessonRef): boolean {
  return textContainsCredentialLikeContent([
    lesson.title,
    lesson.focus,
    ...lesson.accessibilityAndAccommodations,
    ...lesson.safetyAndPrivacy,
  ])
}

export function accessibilityNotesFor(lesson: TechCsLessonRef): readonly string[] {
  return lesson.accessibilityAndAccommodations
}

export function safetyAndPrivacyNotesFor(lesson: TechCsLessonRef): readonly string[] {
  return lesson.safetyAndPrivacy
}

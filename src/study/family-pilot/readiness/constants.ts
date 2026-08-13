import type { GradeLevel, SubjectId } from './types'

/**
 * Documentation/fixture vocabulary only — the readiness gate itself never
 * hardcodes these. A subject or grade outside this list is not special-cased;
 * it simply surfaces as CONTENT_GAP (or INVALID_CONFIGURATION) exactly like
 * any other unresolvable request. That's what lets an unsupported Grade 6
 * request produce a concrete gap instead of being silently normalized.
 */
export const CURRENTLY_SUPPORTED_WORKING_GRADES: readonly GradeLevel[] = [5, 7, 8]

export const REQUIRED_FAMILY_PILOT_SUBJECTS: readonly SubjectId[] = [
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology-computer-science',
  'arts-music',
  'financial-literacy',
]

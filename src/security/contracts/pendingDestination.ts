import type { AcademyRoute } from '../../academy/academyRoute'

export type PendingDestination =
  | Readonly<{ kind: 'root-dashboard' }>
  | Readonly<{ kind: 'academy'; route: AcademyRoute }>
  | Readonly<{ kind: 'study' }>
  | Readonly<{ kind: 'grade-5-practice' }>

const COURSE_ID = /^ma-g(5|7|8)-[a-z-]+$/
const LESSON_ID = /^ma-g(5|7|8)-[a-z-]+-u\d{2}-l\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function parseAcademyRoute(value: unknown): AcademyRoute | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'home' || value.kind === 'schedule') {
    return hasExactKeys(value, ['kind']) ? value as AcademyRoute : null
  }
  if (!COURSE_ID.test(typeof value.courseId === 'string' ? value.courseId : '')) return null
  if (value.kind === 'course') {
    return hasExactKeys(value, ['kind', 'courseId']) ? value as AcademyRoute : null
  }
  if (!Number.isInteger(value.unitNumber) || Number(value.unitNumber) < 1) return null
  if (value.kind === 'unit' || value.kind === 'assessment') {
    return hasExactKeys(value, ['kind', 'courseId', 'unitNumber']) ? value as AcademyRoute : null
  }
  if (
    value.kind === 'lesson' &&
    typeof value.lessonId === 'string' &&
    LESSON_ID.test(value.lessonId) &&
    hasExactKeys(value, ['kind', 'courseId', 'unitNumber', 'lessonId'])
  ) {
    const unit = String(value.unitNumber).padStart(2, '0')
    if (value.lessonId.startsWith(`${value.courseId}-u${unit}-l`)) return value as AcademyRoute
  }
  return null
}

/** Parses allowlisted route descriptors only. Strings, URLs, and paths fail closed. */
export function parsePendingDestination(value: unknown): PendingDestination | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'root-dashboard' || value.kind === 'study' || value.kind === 'grade-5-practice') {
    return hasExactKeys(value, ['kind']) ? value as PendingDestination : null
  }
  if (value.kind !== 'academy' || !hasExactKeys(value, ['kind', 'route'])) return null
  const route = parseAcademyRoute(value.route)
  return route ? { kind: 'academy', route } : null
}

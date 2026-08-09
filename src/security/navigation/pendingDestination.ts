import { formatAcademyPath, parseAcademyPath } from '../../academy/academyRoute'
import {
  GRADE5_MATH_PRACTICE_PATH,
  isGrade5MathPracticePath,
} from '../../curriculum/practice/grade5MathPracticeRoute'
import { isStudyEnginePath, STUDY_ENGINE_PATH } from '../../studyEngineRoute'
import {
  parsePendingDestination,
  type PendingDestination,
} from '../contracts/pendingDestination'

export const MAX_PENDING_DESTINATION_DESCRIPTOR_LENGTH = 2_048

/** Parses a persisted descriptor through the foundation's exact allowlist. */
export function parsePendingDestinationDescriptor(serialized: string): PendingDestination | null {
  if (!serialized || serialized.length > MAX_PENDING_DESTINATION_DESCRIPTOR_LENGTH) return null
  try {
    return parsePendingDestination(JSON.parse(serialized))
  } catch {
    return null
  }
}

export function serializePendingDestination(destination: PendingDestination): string {
  const checked = parsePendingDestination(destination)
  if (!checked) throw new Error('Pending destination is not allowlisted.')
  return JSON.stringify(checked)
}

/** Converts only exact, internal application paths into typed destinations. */
export function pendingDestinationFromPath(pathname: string): PendingDestination | null {
  if (
    !pathname.startsWith('/') ||
    pathname.includes('://') ||
    pathname.includes('\\') ||
    pathname.includes('?') ||
    pathname.includes('#')
  ) return null
  if (pathname === '/') return Object.freeze({ kind: 'root-dashboard' })
  if (isStudyEnginePath(pathname)) return Object.freeze({ kind: 'study' })
  if (isGrade5MathPracticePath(pathname)) return Object.freeze({ kind: 'grade-5-practice' })
  const route = parseAcademyPath(pathname)
  if (!route || formatAcademyPath(route) !== pathname) return null
  return Object.freeze({ kind: 'academy', route: Object.freeze(route) })
}

export function pathForPendingDestination(destination: PendingDestination): string {
  const checked = parsePendingDestination(destination)
  if (!checked) throw new Error('Pending destination is not allowlisted.')
  switch (checked.kind) {
    case 'root-dashboard':
      return '/'
    case 'academy':
      return formatAcademyPath(checked.route)
    case 'study':
      return STUDY_ENGINE_PATH
    case 'grade-5-practice':
      return GRADE5_MATH_PRACTICE_PATH
  }
}

export { parsePendingDestination }
export type { PendingDestination }

import type {
  BlockingReadinessCode,
  FullFamilyGap,
  FullFamilyGapSummary,
  FullFamilyReadinessResult,
  StudentRef,
} from './types'

/** Matches the precedence order in types.ts; keeps gapsByCode keys stable regardless of which gaps occurred. */
const ALL_BLOCKING_CODES: readonly BlockingReadinessCode[] = [
  'INVALID_CONFIGURATION',
  'CATALOG_UNAVAILABLE',
  'CONTENT_GAP',
  'STUDY_UNAVAILABLE',
  'ASSIGNMENT_UNAVAILABLE',
  'PERSISTENCE_UNAVAILABLE',
  'SAFETY_UNAVAILABLE',
]

/**
 * Flattens a full-family readiness result into a gap list: exactly what
 * later work must build next, per student and per subject. READY subjects
 * (and their non-blocking tutor notes) are intentionally excluded — this is
 * a punch list, not a full report.
 */
export function summarizeFullFamilyGaps(result: FullFamilyReadinessResult): FullFamilyGapSummary {
  const gaps: FullFamilyGap[] = result.students.flatMap((student) =>
    student.blockingSubjects.map((subject) => ({
      studentRef: student.studentRef,
      displayName: student.displayName,
      subject: subject.subject,
      requestedWorkingGrade: subject.requestedWorkingGrade,
      // Safe: evaluateSubjectReadiness only sets blocking=true alongside a BlockingReadinessCode.
      status: subject.status as BlockingReadinessCode,
      detail: subject.detail,
    })),
  )

  const gapsByCode = ALL_BLOCKING_CODES.reduce<Record<BlockingReadinessCode, readonly FullFamilyGap[]>>(
    (acc, code) => {
      acc[code] = gaps.filter((gap) => gap.status === code)
      return acc
    },
    {} as Record<BlockingReadinessCode, readonly FullFamilyGap[]>,
  )

  // Built via a Map, not bracket assignment on a plain object: a studentRef of
  // "__proto__" (or "constructor"/"__defineGetter__" etc.) would otherwise
  // collide with Object.prototype instead of being stored as its own key.
  const gapsByStudentMap = new Map<StudentRef, FullFamilyGap[]>()
  for (const gap of gaps) {
    const existing = gapsByStudentMap.get(gap.studentRef)
    if (existing) {
      existing.push(gap)
    } else {
      gapsByStudentMap.set(gap.studentRef, [gap])
    }
  }
  const gapsByStudent = Object.fromEntries(gapsByStudentMap) as Record<StudentRef, readonly FullFamilyGap[]>

  return {
    totalGaps: gaps.length,
    gaps,
    gapsByCode,
    gapsByStudent,
  }
}

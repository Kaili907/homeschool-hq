import { evaluateStudentReadiness } from './evaluateStudentReadiness'
import type { FullFamilyReadinessResult, ReadinessCapabilityPorts, StudentConfiguration } from './types'

/**
 * Evaluates every configured student independently, keyed by studentRef —
 * two students that happen to share a displayName never collide. Overall
 * status is FULL_FAMILY_READY only when every student's every enabled
 * subject is READY.
 */
export function evaluateFullFamilyReadiness(
  students: readonly StudentConfiguration[],
  capabilities: ReadinessCapabilityPorts,
): FullFamilyReadinessResult {
  const studentResults = students.map((student) => evaluateStudentReadiness(student, capabilities))

  return {
    status: studentResults.every((student) => student.ready) ? 'FULL_FAMILY_READY' : 'BLOCKED',
    students: studentResults,
  }
}

import { describe, expect, it } from 'vitest'
import type { FamilyPilotAssignmentRecordV1 } from '../../core'
import type { FinalFamilyPilotAttestationRecord } from '../../final-composition'
import type { SafetyHoldV1 } from '../../safety'
import type { FinalFamilyPilotAssessmentAssignment, FinalFamilyPilotSavedSession } from '../state'
import { deriveParentReviewCenter } from './model'

const NOW = '2026-08-14T14:00:00.000Z'

function assessment(
  studentRef: string,
  assignmentRef: string,
  authorityClass: FinalFamilyPilotAssessmentAssignment['authorityClass'],
  status: FinalFamilyPilotAssessmentAssignment['status'],
): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef,
    assessmentRef: `assessment-ref:${assignmentRef}`,
    studentRef,
    courseRef: 'ma-g5-mathematics',
    subject: 'mathematics',
    grade: 5,
    title: `${assignmentRef} title`,
    authorityClass,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: status === 'CERTIFIED' ? NOW : null,
  }
}

function attestation(studentRef: string, status: FinalFamilyPilotAttestationRecord['status']): FinalFamilyPilotAttestationRecord {
  return {
    studentRef,
    assignmentRef: 'lesson:physical',
    lessonRef: 'ma-g5-physical-education-u01-l01',
    sessionRef: 'session:physical',
    authority: 'GUARDIAN_ATTESTATION_REQUIRED',
    status,
    learnerAssertedAt: NOW,
    attestedAt: status === 'CERTIFIED' ? NOW : null,
    attestedByRef: status === 'CERTIFIED' ? 'adult:household' : null,
    evidenceMode: status === 'CERTIFIED' ? 'adult-observed' : null,
  }
}

function assignment(studentRef: string): FamilyPilotAssignmentRecordV1 {
  return {
    assignmentRef: 'lesson:physical',
    studentRef,
    lessonRef: 'ma-g5-physical-education-u01-l01',
    subject: 'physical-education',
    title: 'Movement practice',
    state: 'completed',
    totalSegments: 1,
    completedSegmentRefs: ['segment:1'],
    activeSeconds: 60,
    pause: null,
    sessionRef: 'session:physical',
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
  } as unknown as FamilyPilotAssignmentRecordV1
}

function hold(studentRef: string, status: SafetyHoldV1['status'] = 'open'): SafetyHoldV1 {
  return {
    schemaVersion: 1,
    holdRef: `hold:${studentRef}`,
    studentRef,
    sessionRef: 'session:physical',
    createdAt: NOW,
    status,
    reasonCode: 'parent-review-requested',
    source: 'parent',
    dedupeKey: `${studentRef}:session:physical`,
    ...(status === 'cleared' ? { clearedAt: NOW, clearedBy: 'adult:household' } : {}),
  }
}

function session(studentRef: string): FinalFamilyPilotSavedSession {
  return {
    studentRef,
    assignmentRef: 'lesson:physical',
    session: {
      householdRef: 'household:test',
      learnerRef: studentRef,
      blockRef: 'lesson:physical',
      sessionRef: 'session:physical',
    },
  }
}

describe('Parent Review Center projection', () => {
  it('sorts every requested authority state into the review queue without inventing grading', () => {
    const model = deriveParentReviewCenter({
      studentRef: 'student:a',
      assessments: [
        assessment('student:a', 'auto', 'AUTO_SCOREABLE', 'PENDING_ASSESSMENT'),
        assessment('student:a', 'guardian', 'GUARDIAN_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION'),
        assessment('student:a', 'manual', 'RUBRIC_REQUIRED', 'ADULT_REVIEW_REQUIRED'),
        assessment('student:a', 'completed', 'COMPLETION_ONLY', 'CERTIFIED'),
      ],
      attestations: [attestation('student:a', 'PENDING_GUARDIAN_ATTESTATION')],
      safetyHolds: [hold('student:a')],
      sessions: [session('student:a')],
      assignments: [assignment('student:a')],
    })

    expect(model.reviewQueue).toHaveLength(5)
    expect(model.pendingScoring).toMatchObject([{
      state: 'Waiting for trusted scoring',
      result: 'No grade has been awarded.',
      action: 'NONE',
    }])
    expect(model.guardianReview.map((item) => item.action)).toEqual([
      'CERTIFY_ASSESSMENT',
      'CERTIFY_PHYSICAL_COMPLETION',
    ])
    expect(model.manualReview[0]?.action).toBe('COMPLETE_MANUAL_REVIEW')
    expect(model.safetyActions[0]).toMatchObject({
      action: 'CLEAR_SAFETY_HOLD',
      result: 'Only this learner session is paused.',
    })
    expect(model.completedHistory[0]).toMatchObject({
      state: 'Completed',
      result: 'Completion recorded.',
      next: 'The learner is ready to continue.',
    })
  })

  it('shows certified guardian and cleared-safety history with what happened and what comes next', () => {
    const model = deriveParentReviewCenter({
      studentRef: 'student:a',
      assessments: [assessment('student:a', 'manual', 'RUBRIC_REQUIRED', 'CERTIFIED')],
      attestations: [attestation('student:a', 'CERTIFIED')],
      safetyHolds: [hold('student:a', 'cleared')],
      sessions: [session('student:a')],
      assignments: [assignment('student:a')],
    })
    expect(model.reviewQueue).toHaveLength(0)
    expect(model.completedHistory.map((item) => item.result)).toEqual(expect.arrayContaining([
      'Authorized manual review completed.',
      'Guardian-observed completion certified.',
      'Parent check-in completed for the exact held session.',
    ]))
    expect(model.completedHistory.every((item) => item.when === NOW && item.next.length > 0)).toBe(true)
  })

  it('never blends sibling records or projects injected answer and rubric authority fields', () => {
    const contaminated = {
      ...assessment('student:a', 'auto', 'AUTO_SCOREABLE', 'PENDING_ASSESSMENT'),
      answerKey: 'secret-answer',
      rubric: 'secret-rubric',
      learnerResponse: 'private response',
    } as unknown as FinalFamilyPilotAssessmentAssignment
    const model = deriveParentReviewCenter({
      studentRef: 'student:a',
      assessments: [contaminated, assessment('student:b', 'sibling', 'RUBRIC_REQUIRED', 'ADULT_REVIEW_REQUIRED')],
      attestations: [attestation('student:b', 'PENDING_GUARDIAN_ATTESTATION')],
      safetyHolds: [hold('student:b')],
      sessions: [session('student:b')],
      assignments: [assignment('student:b')],
    })
    const serialized = JSON.stringify(model)
    expect(model.reviewQueue).toHaveLength(1)
    expect(model.reviewQueue.every((item) => item.studentRef === 'student:a')).toBe(true)
    expect(serialized).not.toMatch(/student:b|secret-answer|secret-rubric|private response|answerKey|rubric|learnerResponse/)
  })
})

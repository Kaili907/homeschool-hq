import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FamilySetupStudent } from '../../setup'
import type { FinalFamilyPilotController } from '../controller'
import type { FinalFamilyPilotAssessmentAssignment } from '../state'
import { ParentReviewCenter } from './ParentReviewCenter'

const NOW = '2026-08-14T14:00:00.000Z'

function assessment(
  studentRef: string,
  assignmentRef: string,
  status: FinalFamilyPilotAssessmentAssignment['status'],
  authorityClass: FinalFamilyPilotAssessmentAssignment['authorityClass'],
): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef,
    assessmentRef: `assessment-ref:${assignmentRef}`,
    studentRef,
    courseRef: 'ma-g5-mathematics',
    subject: 'mathematics',
    grade: 5,
    title: `${assignmentRef} private title`,
    authorityClass,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
  }
}

describe('ParentReviewCenter', () => {
  it('renders the selected learner queue and minimized sections without sibling rows or answer authority', () => {
    const student = {
      studentRef: 'student:a',
      displayName: 'Ada',
      nominalGrade: '5',
      workingGradeBySubject: {},
      enabledSubjects: ['mathematics'],
      pinRequired: false,
      createdAt: NOW,
      updatedAt: NOW,
    } as FamilySetupStudent
    const controller = {
      appSnapshot: {
        state: {
          assessmentAssignments: [
            { ...assessment('student:a', 'waiting', 'PENDING_ASSESSMENT', 'AUTO_SCOREABLE'), answerKey: 'never-project-this' },
            assessment('student:a', 'manual', 'ADULT_REVIEW_REQUIRED', 'RUBRIC_REQUIRED'),
            assessment('student:b', 'sibling', 'ADULT_REVIEW_REQUIRED', 'RUBRIC_REQUIRED'),
          ],
          attestations: [],
          safety: { holds: [] },
          sessions: [],
        },
      },
      coreSnapshot: { state: { students: [{ studentRef: 'student:a', assignments: [] }] } },
    } as unknown as FinalFamilyPilotController

    const markup = renderToStaticMarkup(<ParentReviewCenter controller={controller} student={student} refresh={() => undefined} />)
    expect(markup).toContain('Ada’s Review Center')
    expect(markup).toContain('Review queue: 2')
    expect(markup).toContain('Pending trusted scoring')
    expect(markup).toContain('Guardian review')
    expect(markup).toContain('Manual review')
    expect(markup).toContain('Safety actions')
    expect(markup).toContain('Completed review history')
    expect(markup).toContain('Confirm authorized manual review complete')
    expect(markup).not.toMatch(/sibling private title|never-project-this|answerKey|PENDING_ASSESSMENT/)
  })
})

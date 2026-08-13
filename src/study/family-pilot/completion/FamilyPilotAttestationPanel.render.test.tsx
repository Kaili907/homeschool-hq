import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ActiveAssignmentView, AssignmentList } from '../student/StudentExperience'
import type { StudentAssignment } from '../student/types'
import { emptyFamilyPilotState } from '../core'
import { FamilyPilotAttestationPanel } from './FamilyPilotAttestationPanel'
import type { FamilyPilotAttestationResult, FamilyPilotPendingAttestation } from './policy'

// Rendered with renderToStaticMarkup, matching the convention the pilot's other
// component tests use — the repository has no DOM environment installed. What
// the sign-off actually DOES is proved against the real controller in
// attestationRuntime.test.ts; what these tests prove is which surface carries
// the control, which is the other half of "a learner click cannot certify".

const pending: FamilyPilotPendingAttestation = {
  studentRef: 'student:ada',
  assignmentRef: 'assignment:grade-5:rfl:day-4',
  lessonRef: 'grade-5:rfl:day-4',
  subject: 'Ready for Life',
  title: 'Cook a meal with a grown-up',
  learnerAssertedAt: '2026-08-12T10:00:00.000Z',
}

const refused: FamilyPilotAttestationResult = {
  status: 'rejected',
  reason: 'lesson-binding-mismatch',
  message: 'That sign-off is for a different lesson.',
  snapshot: { status: 'ready', state: emptyFamilyPilotState('2026-08-12T09:00:00.000Z'), reasonCode: null },
}

function awaitingAssignment(): StudentAssignment {
  return {
    assignmentRef: pending.assignmentRef,
    title: pending.title,
    subject: pending.subject,
    status: 'IN_PROGRESS',
    sessionState: 'active',
    segments: [{ segmentRef: 'seg:1', title: 'Plan the meal' }],
    currentSegmentRef: 'seg:1',
    completedSegmentRefs: ['seg:1'],
    awaitingAdultAttestation: true,
  }
}

describe('the adult attestation surface', () => {
  it('offers both an observed and an equal-credit simulated sign-off, bound to the work', () => {
    const markup = renderToStaticMarkup(
      <FamilyPilotAttestationPanel pending={[pending]} attestedByRef="family-pilot-parent" onAttest={() => refused} />,
    )
    expect(markup).toContain('data-testid="family-pilot-attest-observed"')
    expect(markup).toContain('data-testid="family-pilot-attest-simulated"')
    // The binding the request will carry is visible on the item itself, so a
    // sign-off can only ever name the lesson it was rendered for.
    expect(markup).toContain(`data-assignment-ref="${pending.assignmentRef}"`)
    expect(markup).toContain(`data-lesson-ref="${pending.lessonRef}"`)
    expect(markup).toContain(pending.title)
  })

  it('says so plainly when nothing is waiting', () => {
    const markup = renderToStaticMarkup(
      <FamilyPilotAttestationPanel pending={[]} attestedByRef="family-pilot-parent" onAttest={() => refused} />,
    )
    expect(markup).toContain('data-testid="family-pilot-attestation-empty"')
    expect(markup).not.toContain('data-testid="family-pilot-attest-observed"')
  })
})

describe('the learner surface while work is waiting on an adult', () => {
  it('shows the wait and offers no control that could certify it', () => {
    const markup = renderToStaticMarkup(
      <ActiveAssignmentView
        assignment={awaitingAssignment()}
        onPause={() => undefined}
        onResume={() => undefined}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )
    expect(markup).toContain('data-testid="family-pilot-awaiting-adult"')
    // No Finish button, and nothing resembling a sign-off, on the child's screen.
    expect(markup).not.toContain('aria-label="Finish Cook a meal with a grown-up"')
    expect(markup).not.toContain('data-testid="family-pilot-attest-observed"')
    expect(markup).not.toContain('data-testid="family-pilot-attest-simulated"')
  })

  it('keeps the Finish button for work the learner may finish themselves', () => {
    const markup = renderToStaticMarkup(
      <ActiveAssignmentView
        assignment={{ ...awaitingAssignment(), awaitingAdultAttestation: false }}
        onPause={() => undefined}
        onResume={() => undefined}
        onComplete={() => undefined}
        onExit={() => undefined}
      />,
    )
    expect(markup).toContain('aria-label="Finish Cook a meal with a grown-up"')
    expect(markup).not.toContain('data-testid="family-pilot-awaiting-adult"')
  })

  it('marks the wait on the assignment list too, without calling it complete', () => {
    const markup = renderToStaticMarkup(
      <AssignmentList
        assignments={[awaitingAssignment()]}
        onStart={() => undefined}
        onResume={() => undefined}
      />,
    )
    expect(markup).toContain('data-testid="family-pilot-awaiting-adult"')
    expect(markup).toContain('In progress')
    expect(markup).not.toContain('>Completed<')
  })
})

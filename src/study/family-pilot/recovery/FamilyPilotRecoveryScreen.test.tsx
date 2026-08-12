import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState, type FamilyPilotSnapshot } from '../core'
import { FamilyPilotRecoveryScreen } from './FamilyPilotRecoveryScreen'

const NOW = '2026-08-12T09:00:00.000Z'

function snapshotFor(
  status: FamilyPilotSnapshot['status'],
  reasonCode: FamilyPilotSnapshot['reasonCode'] = null,
): FamilyPilotSnapshot {
  return { status, state: emptyFamilyPilotState(NOW), reasonCode }
}

describe('FamilyPilotRecoveryScreen content', () => {
  it('explains a healthy state in plain, reassuring language', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('ready')} />,
    )
    expect(html).toContain('Everything is working normally')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it('explains a corrupt/unreadable state without claiming data was erased', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('recovered', 'schema-unreadable')} />,
    )
    expect(html).toContain('Saved data could not be read')
    expect(html).toContain('nothing has been erased')
    expect(html).toContain('role="alert"')
  })

  it('explains storage-unavailable', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('unavailable', 'storage-unavailable')} />,
    )
    expect(html).toContain('Local storage is unavailable')
    expect(html).toContain('not allowing local saving')
  })

  it('explains a failed write distinctly from storage being wholly unavailable', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('unavailable', 'storage-write-failed')} />,
    )
    expect(html).toContain('last save could not be completed')
    expect(html).toContain('Your last change')
    expect(html).not.toContain('Local storage is unavailable')
  })

  it('explains a future/newer schema state and offers no destructive control', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('read-only', 'schema-version-ahead')}
        actions={{ resetLocalPilot: () => {}, restoreBackup: () => {}, continueReadOnly: () => {} }}
      />,
    )
    expect(html).toContain('Data from a newer app version')
    expect(html).toContain('left untouched')
    expect(html).toContain('Continue without saving')
    // Even though the host supplied both, a future-schema build must never
    // offer to erase or overwrite data it cannot read.
    expect(html).not.toContain('Reset pilot data on this device')
    expect(html).not.toContain('Restore from backup')
    // Nothing is broken in this state, so it must not be announced as an
    // interrupting alert the way a real read/write failure is.
    expect(html).toContain('role="status"')
    expect(html).not.toContain('role="alert"')
  })

  it('announces read/write problems as alerts but a benign newer-schema state as a calm status', () => {
    const recovered = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('recovered', 'schema-unreadable')} />,
    )
    expect(recovered).toContain('role="alert"')
    const unavailable = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshotFor('unavailable', 'storage-unavailable')} />,
    )
    expect(unavailable).toContain('role="alert"')
  })

  it('renders only the actions the host actually supplied', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ retry: () => {} }}
      />,
    )
    expect(html).toContain('Try again')
    expect(html).not.toContain('Reset pilot data on this device')
    expect(html).not.toContain('Export a backup')
    expect(html).not.toContain('Restore from backup')
    expect(html).not.toContain('Return home')
    expect(html).not.toContain('Continue without saving')
  })

  it('offers reset and restore only once a host wires them up', () => {
    const html = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot: () => {}, restoreBackup: () => {}, exportBackup: () => {} }}
      />,
    )
    expect(html).toContain('Reset pilot data on this device')
    expect(html).toContain('Restore from backup')
    expect(html).toContain('Export a backup')
    // A destructive action never starts in its confirmed/armed state.
    expect(html).not.toContain('This cannot be undone')
  })

  it('keeps diagnostics hidden unless explicitly permitted', () => {
    const snapshot = snapshotFor('ready')
    const withoutFlag = renderToStaticMarkup(<FamilyPilotRecoveryScreen snapshot={snapshot} />)
    expect(withoutFlag).not.toContain('family-pilot-recovery-diagnostics')

    const withFlag = renderToStaticMarkup(
      <FamilyPilotRecoveryScreen snapshot={snapshot} showDiagnostics />,
    )
    expect(withFlag).toContain('family-pilot-recovery-diagnostics')
    expect(withFlag).toContain('Schema version')
    expect(withFlag).toContain('Storage status')
  })

  it('never shows learner-authored text in diagnostics, even with an active student', () => {
    const state = {
      ...emptyFamilyPilotState(NOW),
      activeStudentRef: 'student:ada',
      students: [
        {
          studentRef: 'student:ada',
          displayName: 'Ada Lovelace',
          createdAt: NOW,
          updatedAt: NOW,
          activeAssignmentRef: 'assignment:fractions',
          assignments: [
            {
              assignmentRef: 'assignment:fractions',
              lessonRef: 'lesson:fractions-1',
              subject: 'Math',
              title: 'Comparing fractions',
              state: 'active' as const,
              sessionRef: 'session:xyz',
              progress: {
                completedSegmentRefs: [],
                totalSegments: 4,
                lastSegmentRef: null,
                activeSeconds: 0,
              },
              pause: { pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null },
              completedAt: null,
              createdAt: NOW,
              updatedAt: NOW,
              rawAnswerIncluded: false as const,
              transcriptIncluded: false as const,
            },
          ],
        },
      ],
    }
    const snapshot: FamilyPilotSnapshot = { status: 'ready', state, reasonCode: null }
    const html = renderToStaticMarkup(<FamilyPilotRecoveryScreen snapshot={snapshot} showDiagnostics />)
    // Refs are fine to show; household-authored display names and lesson
    // titles are not part of this screen's explicit allow-list.
    expect(html).toContain('student:ada')
    expect(html).toContain('assignment:fractions')
    expect(html).toContain('session:xyz')
    expect(html).not.toContain('Ada Lovelace')
    expect(html).not.toContain('Comparing fractions')
    expect(html).not.toContain('lesson:fractions-1')
  })
})

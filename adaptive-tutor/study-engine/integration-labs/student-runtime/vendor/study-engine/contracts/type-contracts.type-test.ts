import type {
  FocusEstimate,
  ParentTeacherControls,
  PlannedStudySession,
  StudySession,
} from './index.ts'

declare const planned: PlannedStudySession
const session: StudySession = planned
void session

const insufficient: FocusEstimate = {
  status: 'insufficient-data',
  eligibleObservationCount: 0,
  minimumObservationCount: 3,
  gradeBandStartingRange: { minimumMinutes: 8, targetMinutes: 10, maximumMinutes: 12 },
  reason: 'new-profile',
}
void insufficient

// @ts-expect-error Insufficient data cannot carry a personalized baseline.
insufficient.baselineWorkDurationMinutes

declare const controls: ParentTeacherControls
// @ts-expect-error Private note bodies are not part of student-safe controls.
controls.privateNotes

declare const terminal: Extract<StudySession, { status: 'completed' }>
// @ts-expect-error Terminal sessions do not expose a resume point.
terminal.resumePoint


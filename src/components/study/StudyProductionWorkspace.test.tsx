import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { StudyCheckpointRecord } from '../../study/contracts/persistence/types'
import type {
  StudyProductionSessionProjection,
  StudyProductionSessionState,
} from '../../study/contracts/production/session'
import type {
  StudyProductionController,
  StudyProductionControllerRecovery,
  StudyProductionControllerSnapshot,
  StudyProductionControllerStatus,
} from '../../study/production/sessionController'
import {
  STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
  StudyProductionWorkspace,
  StudyProductionWorkspaceView,
  isStudyProductionBoundContent,
  type StudyProductionContentSlot,
  type StudyProductionWorkspaceLaunch,
  type StudyProductionWorkspaceViewActions,
} from './StudyProductionWorkspace'

const binding = Object.freeze({
  schemaVersion: 1 as const,
  status: 'bound' as const,
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grade-5-production',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
})

const settings = Object.freeze({
  timerMode: 'hidden' as const,
  maximumWorkMinutes: 30,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  minimumBreakCount: 0,
  requiredBreakIntervalMinutes: 30,
  reducedMotion: true,
  noAudio: true,
  largeText: true,
  readAloud: false,
  speechInputAllowed: false,
})

const stateTransition: Record<StudyProductionSessionState, StudyProductionSessionProjection['lastTransition']['type']> = {
  active: 'segment-started',
  paused: 'pause-started',
  'approved-break': 'break-started',
  'student-requested-break': 'break-requested',
  'technical-interruption': 'technical-interruption-started',
  completed: 'session-completed',
  abandoned: 'session-abandoned',
}

function session(
  state: StudyProductionSessionState = 'active',
  overrides: Partial<StudyProductionSessionProjection> = {},
): StudyProductionSessionProjection {
  const closed = state === 'completed' || state === 'abandoned'
  return {
    schemaVersion: 2,
    status: closed ? 'closed' : 'resumable',
    sessionId: 'session:private-production-id',
    state,
    revision: 4,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: '2026-08-10T15:04:00.000Z',
    lessonId: 'grade-5:academy-week-2-day-3',
    subjectId: 'subject:private-math-id',
    studyPlanId: 'plan:private-id',
    intendedLocalDate: '2026-08-10',
    currentSegmentId: closed ? null : 'segment-bound-a',
    completedAt: closed ? '2026-08-10T15:05:00.000Z' : null,
    lastTransition: {
      type: stateTransition[state],
      acceptedAt: '2026-08-10T15:04:00.000Z',
    },
    curriculumBinding: binding,
    effectiveSettings: settings,
    ...overrides,
  }
}

function checkpoint(completedSegmentIds: string[] = []): StudyCheckpointRecord {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint:private-id',
    revision: 2,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    sessionId: 'session:private-production-id',
    lessonId: 'grade-5:academy-week-2-day-3',
    segmentId: 'segment-bound-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'item:private-id',
      currentItemIndex: 0,
      teachingTurnIndex: 1,
    },
    completedSegmentIds,
    perSegmentActiveTime: [{ segmentId: 'segment-bound-a', activeSeconds: 60 }],
    pausedSeconds: 30,
    breakSeconds: 60,
    protectedDraftRef: 'protected:draft-private-id',
    protectedTutorStateRef: 'protected:tutor-private-id',
    lastAcceptedEventId: 'event:private-id',
    eventVersion: 1,
    tutorInteractionRef: 'interaction:private-id',
    technicalInterruption: {
      status: 'none',
      interruptionId: null,
      category: 'private-diagnostic-category',
      startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

function snapshot(
  status: StudyProductionControllerStatus = 'ready',
  currentSession: StudyProductionSessionProjection | null = null,
  recovery: StudyProductionControllerRecovery | null = null,
): StudyProductionControllerSnapshot {
  return {
    status,
    session: currentSession,
    checkpoint: currentSession ? checkpoint() : null,
    acceptedCheckpointRevision: currentSession ? 2 : 0,
    selection: { segmentId: currentSession?.currentSegmentId ?? null },
    advisoryLaunch: null,
    content: null,
    pendingMutation: status === 'network_failure' ? 'transition' : null,
    recovery,
  }
}

const content: Extract<StudyProductionContentSlot, { status: 'bound' }> = {
  status: 'bound',
  content: {
    contract: STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
    lessonId: 'grade-5:academy-week-2-day-3',
    releaseVersion: '1.0.0',
    subjectLabel: 'Mathematics - Grade 5',
    lessonTitle: 'Compare fractions',
    goal: 'Compare two fractions and explain how you know.',
    segments: [
      { segmentId: 'segment-bound-a', label: 'Warm-up' },
      { segmentId: 'segment-bound-b', label: 'Practice together' },
    ],
  },
  renderSegment: ({ mode }) => (
    <div>
      <p>Trusted bound lesson content. Mode: {mode}.</p>
      <label htmlFor="study-production-response">Your response</label>
      <textarea id="study-production-response" />
      <button type="button">Complete current step</button>
    </div>
  ),
}

const beginLaunch: StudyProductionWorkspaceLaunch = {
  kind: 'begin',
  input: {
    academyContext: {
      adapterVersion: 1,
      releaseVersion: '1.0.0',
      lessonRef: 'grade-5:academy-week-2-day-3',
      skillRefs: ['ma-g5-mathematics-u01-l08'],
      scopeWeek: 2,
      scopeDay: 3,
    },
    subjectId: 'mathematics',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    initialSegmentId: 'segment-bound-a',
  },
}

const resumeLaunch: StudyProductionWorkspaceLaunch = {
  kind: 'resume',
  input: {
    sessionId: 'session:private-production-id',
    academyContext: beginLaunch.input.academyContext,
  },
}

function actionHarness(): StudyProductionWorkspaceViewActions {
  return {
    checkReadiness: vi.fn(),
    enter: vi.fn(),
    retry: vi.fn(),
    recover: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    requestBreak: vi.fn(),
    startBreak: vi.fn(),
    endBreak: vi.fn(),
    recoverInterruption: vi.fn(),
    startSegment: vi.fn(),
    completeCurrentSegment: vi.fn(),
    completeSession: vi.fn(),
    selectSegment: vi.fn(),
    saveCheckpoint: vi.fn(async () => snapshot('ready', session())),
    saveAndExit: vi.fn(),
    exit: vi.fn(),
  }
}

function render(
  value: StudyProductionControllerSnapshot,
  slot: StudyProductionContentSlot = content,
  launch: StudyProductionWorkspaceLaunch = beginLaunch,
  actions = actionHarness(),
): string {
  return renderToStaticMarkup(
    <StudyProductionWorkspaceView
      snapshot={value}
      content={slot}
      launch={launch}
      actions={actions}
    />,
  )
}

describe('production Study workspace controller-state presentation', () => {
  it.each([
    ['loading', 'Preparing Study'],
    ['not_ready', 'Study is getting ready'],
    ['manual_review', 'This Study plan needs a review'],
    ['unavailable', 'Study is unavailable right now'],
    ['network_failure', 'Study could not confirm that request'],
    ['conflict', 'Study changed somewhere else'],
    ['resume_required', 'Study needs to restore your saved place'],
    ['rejected', 'That Study action is not available'],
  ] as const)('renders the %s controller state without raw errors', (status, title) => {
    const html = render(snapshot(status))
    expect(html).toContain(title)
    expect(html).not.toMatch(/stack|database|token|credential|reasonCode|currentRevision/i)
  })

  it('presents begin and resume as deliberate, distinct entry actions', () => {
    const begin = render(snapshot('ready'), content, beginLaunch)
    const resume = render(snapshot('ready'), content, resumeLaunch)
    expect(begin).toContain('Start Study')
    expect(begin).toContain('Today&#x27;s goal')
    expect(resume).toContain('Resume exact step')
    expect(resume).toContain('restored from the server')
  })

  it('allows verification to begin without substituting unbound lesson content', () => {
    const begin = render(snapshot('ready'), { status: 'loading' }, beginLaunch)
    const resume = render(snapshot('ready'), { status: 'loading' }, resumeLaunch)
    expect(begin).toContain('Verify today&#x27;s Study lesson')
    expect(begin).toContain('Start Study')
    expect(resume).toContain('Restore your saved Study lesson')
    expect(resume).toContain('Resume exact step')
    expect(begin).not.toContain('Today&#x27;s goal')
  })

  it('keeps an in-flight transition singular and disables other controls', () => {
    const value = { ...snapshot('loading', session()), pendingMutation: 'transition' as const }
    const html = render(value)
    expect(html).toContain('Saving your Study place')
    expect(html).toContain('one request to finish')
    expect(html).toContain('disabled=""')
  })

  it('offers one same-request check for network uncertainty and an authoritative reload for conflicts', () => {
    const network = render(snapshot('network_failure', session()))
    const conflict = render(snapshot('conflict', session(), {
      kind: 'revision_conflict', currentRevision: 8, currentState: 'paused',
    }))
    expect(network).toContain('Check the same request once')
    expect(network).toContain('Do not repeat a different action')
    expect(conflict).toContain('Reload the saved Study state')
    expect(conflict).not.toContain('currentRevision')
    expect(conflict).not.toMatch(/revision[^<]*8/i)
  })

  it('returns an invalid verified session to the Study plan instead of retrying it', () => {
    const html = render(snapshot('resume_required', session(), {
      kind: 'student_session_invalid',
    }))
    expect(html).toContain('Sign in again to resume Study')
    expect(html).toContain('Back to Study plan')
    expect(html).not.toContain('Restore my saved Study place')
  })
})

describe('production Study workspace lifecycle surfaces', () => {
  it.each([
    ['paused', 'Paused', 'Resume exact step'],
    ['student-requested-break', 'Your break request is saved', 'Start my break'],
    ['technical-interruption', 'Your work is safe', 'Return to my lesson'],
    ['completed', 'Study session complete', 'Back to Study plan'],
    ['abandoned', 'This Study session has ended', 'Back to Study plan'],
  ] as const)('renders the %s session state truthfully', (state, title, action) => {
    const html = render(snapshot('ready', session(state)))
    expect(html).toContain(title)
    expect(html).toContain(action)
  })

  it('shows an approved break as a non-punitive server-settings surface', () => {
    const html = render(snapshot('ready', session('approved-break')))
    expect(html).toContain('Take the break you need')
    expect(html).toContain('5-15 minutes')
    expect(html).toContain('no penalty or visible count')
    expect(html).toContain('I&#x27;m ready to return')
    expect(html).not.toContain('<a href="http')
  })

  it('renders active content, authoritative progress, timer, audio, and direct break controls', () => {
    const html = render(snapshot('ready', session()))
    expect(html).toContain('Trusted bound lesson content')
    expect(html).toContain('Current Study task')
    expect(html).toContain('Current step')
    expect(html).toContain('Timer hidden. Your learning steps are still shown.')
    expect(html).toContain('Text-only Study is on. Audio is not required.')
    expect(html).toContain('I need a break')
    expect(html).toContain('Save and exit')
  })

  it('uses the accepted checkpoint to present the next segment and completion', () => {
    const betweenSteps = snapshot('ready', session('active', { currentSegmentId: null }))
    const nextHtml = render({
      ...betweenSteps,
      checkpoint: checkpoint(['segment-bound-a']),
      selection: { segmentId: null },
    })
    const finishHtml = render({
      ...betweenSteps,
      checkpoint: checkpoint(['segment-bound-a', 'segment-bound-b']),
      selection: { segmentId: null },
    })
    expect(nextHtml).toContain('Start Practice together')
    expect(finishHtml).toContain('Finish Study')
  })
})

describe('production Study bound-content and privacy boundary', () => {
  it('fails closed for unavailable, malformed, or mismatched bound content', () => {
    expect(render(snapshot('ready'), { status: 'unavailable' })).toContain('lesson content is unavailable')
    expect(render(snapshot('ready', session()), {
      ...content,
      content: { ...content.content, lessonId: 'another-production-lesson' },
    })).toContain('lesson content is unavailable')
    expect(isStudyProductionBoundContent({
      ...content.content,
      segments: [content.content.segments[0]!, content.content.segments[0]!],
    })).toBe(false)
  })

  it('contains no preview fallback import or fallback lesson copy', () => {
    const source = readFileSync(new URL('./StudyProductionWorkspace.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/localDevelopmentPorts|mountedPorts|StudySessionRoute|syntheticGrade|demo-data|mock-demo/)
    expect(source).toContain('There is intentionally no local,')
    expect(source).toContain('will not substitute a practice or preview lesson')
  })

  it('does not render learner/internal identifiers or private checkpoint material', () => {
    const html = render(snapshot('ready', session()))
    for (const privateValue of [
      'session:private-production-id',
      'subject:private-math-id',
      'plan:private-id',
      'checkpoint:private-id',
      'item:private-id',
      'protected:draft-private-id',
      'protected:tutor-private-id',
      'event:private-id',
      'interaction:private-id',
      'private-diagnostic-category',
    ]) expect(html).not.toContain(privateValue)
    expect(html).not.toMatch(/rawAnswer|transcriptIncluded|private note|safety text|emotional inference/i)
  })
})

describe('production Study workspace accessibility and responsive contract', () => {
  it('has one main landmark, a skip link, headings, native controls, progress text, and a polite live region', () => {
    const html = render(snapshot('ready', session()))
    expect(html.match(/<main/g)).toHaveLength(1)
    expect(html).toContain('href="#study-production-current-task"')
    expect(html).toContain('<h1')
    expect(html).toContain('<h2')
    expect(html).toContain('aria-label="Learning progress"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('type="button"')
    expect(html).toContain('for="study-production-response"')
    expect(html).toContain('<textarea')
  })

  it('projects server large-text and reduced-motion settings without learner override controls', () => {
    const html = render(snapshot('ready', session()))
    expect(html).toContain('data-large-text="true"')
    expect(html).toContain('data-reduced-motion="true"')
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Change timer')
  })

  it('defines mobile reflow, touch targets, input sizing, focus, and both reduced-motion paths', () => {
    const css = readFileSync(new URL('./study-production-workspace.css', import.meta.url), 'utf8')
    expect(css).toContain('@media (max-width: 767px)')
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(css).toContain('min-height: 44px')
    expect(css).toContain('font-size: max(1rem, 16px)')
    expect(css).toContain(':focus-visible')
    expect(css).toContain("[data-reduced-motion='true']")
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('integrates the production controller without mounting an application route', () => {
    const value = snapshot('ready')
    const controller: StudyProductionController = {
      checkReadiness: vi.fn(async () => value),
      begin: vi.fn(async () => value),
      resume: vi.fn(async () => value),
      transition: vi.fn(async () => value),
      readCheckpoint: vi.fn(async () => value),
      saveCheckpoint: vi.fn(async () => value),
      selectSegment: vi.fn(() => value),
      snapshot: vi.fn(() => value),
      subscribe: vi.fn(() => () => undefined),
    }
    const html = renderToStaticMarkup(
      <StudyProductionWorkspace
        controller={controller}
        launch={beginLaunch}
        content={content}
        onExit={() => undefined}
        checkReadinessOnMount={false}
      />,
    )
    expect(html).toContain('Start Study')
    const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8')
    expect(app).not.toContain('StudyProductionWorkspace')
  })
})

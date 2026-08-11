import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import type { StudyBoundContentReady } from '../../study/contracts/production/content'
import type { StudyProductionSessionProjection } from '../../study/contracts/production/session'
import {
  buildStudyProductionCompletionCheckpoint,
  createStudyProductionWorkspaceLaunch,
  parseStudyProductionDashboard,
  projectStudyProductionBoundContent,
} from './StudyProductionRoute'

const academyContext: AcademyStudyContext = {
  adapterVersion: 1,
  releaseVersion: '1.0.0',
  lessonRef: 'grade-5:academy-week-1-day-1',
  skillRefs: ['ma-g5-mathematics-u01-l01'],
  scopeWeek: 1,
  scopeDay: 1,
}

const binding = {
  schemaVersion: 1 as const,
  status: 'bound' as const,
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
}

const settings = {
  timerMode: 'visible' as const,
  maximumWorkMinutes: 30,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  minimumBreakCount: 0,
  requiredBreakIntervalMinutes: 30,
  reducedMotion: false,
  noAudio: false,
  largeText: false,
  readAloud: false,
  speechInputAllowed: false,
}

const session: StudyProductionSessionProjection = {
  schemaVersion: 2,
  status: 'resumable',
  sessionId: 'session:private-production-route-a',
  state: 'active',
  revision: 2,
  acceptedAt: '2026-08-10T14:00:00.000Z',
  updatedAt: '2026-08-10T14:05:00.000Z',
  lessonId: academyContext.lessonRef,
  subjectId: 'academy',
  studyPlanId: null,
  intendedLocalDate: '2026-08-10',
  currentSegmentId: academyContext.skillRefs[0]!,
  completedAt: null,
  lastTransition: { type: 'session-resumed', acceptedAt: '2026-08-10T14:05:00.000Z' },
  curriculumBinding: binding,
  effectiveSettings: settings,
}

const boundContent: StudyBoundContentReady = {
  schemaVersion: 1,
  status: 'ready',
  reasonCode: 'content-ready',
  sessionRef: session.sessionId,
  lessonRef: academyContext.lessonRef,
  skillRefs: academyContext.skillRefs,
  curriculumBinding: {
    schemaVersion: 1,
    releaseId: binding.releaseId,
    packageId: binding.packageId,
    releaseVersion: binding.releaseVersion,
    curriculumManifestSha256: binding.curriculumManifestSha256,
  },
  lessons: [{
    lessonId: academyContext.skillRefs[0]!,
    courseId: 'ma-g5-mathematics',
    grade: 5,
    subject: 'Mathematics',
    courseDay: 1,
    unitNumber: 1,
    unitTitle: 'Whole-number reasoning',
    dayInUnit: 1,
    title: 'Reason with whole numbers',
    standards: ['5.OA.1'],
    schemaVersion: '1.0',
    essentialQuestion: 'How can a model show the reasoning?',
    learningObjectives: ['Represent and explain the idea.'],
    successCriteria: ['Explain the reasoning.'],
    materials: ['Notebook'],
    lessonFlow: [{
      segment: 'Guided practice',
      minutes: '10',
      teacherOrTutorAction: 'Use the learner-safe model and explain each step.',
    }],
    formativeCheck: 'Show and explain one model.',
    accommodations: ['Offer an accessible response mode.'],
  }],
}

describe('hardened production Study route contracts', () => {
  it('accepts only the exact bounded dashboard DTO', () => {
    const exact = {
      sessions: [{
        sessionId: session.sessionId,
        state: 'active',
        lessonId: academyContext.lessonRef,
        revision: 2,
        updatedAt: '2026-08-10T14:05:00.000Z',
      }],
    }
    expect(parseStudyProductionDashboard(exact)).toEqual(exact)
    expect(parseStudyProductionDashboard({ ...exact, authority: 'forged' })).toBeNull()
    expect(parseStudyProductionDashboard({
      sessions: [{ ...exact.sessions[0], state: 'mystery' }],
    })).toBeNull()
    expect(parseStudyProductionDashboard({
      sessions: [{ ...exact.sessions[0], updatedAt: '2026-02-30T14:05:00.000Z' }],
    })).toBeNull()
    expect(parseStudyProductionDashboard({
      sessions: [{ ...exact.sessions[0], privateNotes: 'never accepted' }],
    })).toBeNull()
  })

  it('uses the exact Academy advisory and latest matching server session without authority expansion', () => {
    const dashboard = parseStudyProductionDashboard({
      sessions: [
        {
          sessionId: 'session:older', state: 'paused', lessonId: academyContext.lessonRef,
          revision: 2, updatedAt: '2026-08-10T14:00:00.000Z',
        },
        {
          sessionId: 'session:newer', state: 'active', lessonId: academyContext.lessonRef,
          revision: 3, updatedAt: '2026-08-10T14:05:00.000Z',
        },
        {
          sessionId: 'session:other', state: 'active', lessonId: 'another-day',
          revision: 4, updatedAt: '2026-08-10T14:10:00.000Z',
        },
      ],
    })!
    const launch = createStudyProductionWorkspaceLaunch(
      academyContext,
      dashboard,
      '2026-08-10',
    )
    expect(launch).toEqual({
      kind: 'resume',
      input: { sessionId: 'session:newer', academyContext },
    })
    expect(Object.keys(launch!.input).sort()).toEqual(['academyContext', 'sessionId'])
    academyContext.skillRefs.push('browser-late-change')
    expect(launch!.input.academyContext.skillRefs).toEqual(['ma-g5-mathematics-u01-l01'])
    academyContext.skillRefs.pop()

    const begin = createStudyProductionWorkspaceLaunch(
      academyContext,
      { sessions: [] },
      '2026-08-10',
    )
    expect(begin).toMatchObject({
      kind: 'begin',
      input: {
        subjectId: 'academy',
        studyPlanId: null,
        intendedLocalDate: '2026-08-10',
        initialSegmentId: 'ma-g5-mathematics-u01-l01',
        academyContext: {
          releaseVersion: '1.0.0',
          lessonRef: 'grade-5:academy-week-1-day-1',
          skillRefs: ['ma-g5-mathematics-u01-l01'],
          scopeWeek: 1,
          scopeDay: 1,
        },
      },
    })
  })

  it('renders only the immutable session release and learner-safe bound content', () => {
    const slot = projectStudyProductionBoundContent(boundContent, session)
    expect(slot.status).toBe('bound')
    if (slot.status !== 'bound') throw new Error('expected bound content')
    const html = renderToStaticMarkup(slot.renderSegment({
      mode: 'current',
      content: slot.content,
      segment: slot.content.segments[0]!,
      checkpoint: null,
      busy: false,
      actions: {
        completeCurrentSegment: vi.fn(),
        saveCheckpoint: vi.fn(async () => ({
          status: 'ready' as const, session, checkpoint: null, acceptedCheckpointRevision: 0,
          selection: { segmentId: session.currentSegmentId }, advisoryLaunch: null,
          content: boundContent, pendingMutation: null, recovery: null,
        })),
      },
    }))
    expect(slot.content.lessonTitle).toBe('Reason with whole numbers')
    expect(slot.content.segments[0]?.label).toBe('Reason with whole numbers')
    expect(html).toContain('Represent and explain the idea')
    expect(html).toContain('Use the learner-safe model')
    expect(html).toContain('Save this step and continue')
    expect(html).not.toContain(session.sessionId)
    expect(html).not.toContain(binding.releaseId)
    expect(html).not.toMatch(/rawAnswer|transcript|privateNotes|authority|secret|credential/i)

    expect(projectStudyProductionBoundContent({
      ...boundContent,
      curriculumBinding: { ...boundContent.curriculumBinding, releaseVersion: '2.0.0' },
    }, session)).toEqual({ status: 'unavailable' })
    expect(projectStudyProductionBoundContent({
      ...boundContent,
      curriculumBinding: {
        ...boundContent.curriculumBinding,
        curriculumManifestSha256: 'b'.repeat(64),
      },
    }, session)).toEqual({ status: 'unavailable' })
  })

  it('builds a privacy-minimized checkpoint before advancing the current bound step', () => {
    const draft = buildStudyProductionCompletionCheckpoint({
      checkpoint: null,
      segmentId: academyContext.skillRefs[0]!,
      segmentIndex: 0,
      now: () => Date.parse('2026-08-10T14:06:00.000Z'),
      createRef: (prefix) => `${prefix}:opaque-test-a`,
    })
    expect(draft.completedSegmentIds).toEqual(['ma-g5-mathematics-u01-l01'])
    expect(draft.rawAnswerIncluded).toBe(false)
    expect(draft.transcriptIncluded).toBe(false)
    expect(draft.technicalInterruption).toEqual({
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    })
    expect(draft).not.toHaveProperty('sessionId')
    expect(draft).not.toHaveProperty('lessonId')
    expect(draft).not.toHaveProperty('revision')
    expect(JSON.stringify(draft)).not.toContain(session.sessionId)
  })

  it('contains no preview, demo, latest-release, or local-content fallback import', () => {
    const source = readFileSync(new URL('./StudyProductionRoute.tsx', import.meta.url), 'utf8')
    expect(source).not.toMatch(/mountedPorts|localDevelopmentPorts|synthetic|demo-data|latestRelease|preview lesson/i)
    expect(source).toContain('createStudyBoundContentClient')
    expect(source).toContain('curriculumBinding.releaseVersion')
  })
})

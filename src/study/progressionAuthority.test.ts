import { describe, expect, it, vi } from 'vitest'
import { calendarDraftForPlan } from './calendarAdapter'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts, type LocalDevelopmentStudyServices } from './localDevelopmentPorts'
import type { StudyPortBundle } from './ports'
import {
  applyStudyProgression,
  decideStudyProgression,
  recoverAuthorizedStudyCompletion,
  STUDY_PROGRESSION_AUTHORITY_INVARIANTS,
  type StudyProgressionPolicy,
  type StudyTutorAdvisory,
} from './progressionAuthority'
import type { StudyCalendarEntry, StudyScope } from './types'

const BASE = new Date('2026-08-01T13:00:00.000Z')
const at = (seconds: number) => new Date(BASE.getTime() + seconds * 1_000).toISOString()

interface Harness {
  readonly entry: StudyCalendarEntry
  readonly scope: StudyScope
  readonly ports: StudyPortBundle
  readonly services: LocalDevelopmentStudyServices
}

async function harness(
  authority: 'tutor-core' | 'completion-only' = 'tutor-core',
  suffix: string = authority,
): Promise<Harness> {
  const context = syntheticGrade5StudyContext('math')
  const local = createLocalDevelopmentStudyPorts({ now: () => new Date(BASE) })
  const learnerScope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const lessonRef = `lesson:progression:${suffix}`
  const plan = {
    lessonRef,
    title: `Progression ${suffix}`,
    subject: 'math' as const,
    skillRefs: [`skill:progression:${suffix}`],
    segments: [{
      segmentRef: `${lessonRef}:segment`,
      title: 'Current step',
      taskType: authority === 'tutor-core' ? 'mastery-check' as const : 'custom' as const,
      ...(authority === 'completion-only' ? { customTaskTypeId: 'completion-only-test' } : {}),
      estimatedMinutes: 5,
      required: true,
    }],
    masteryAuthority: authority,
    source: authority === 'completion-only' ? 'parent' as const : 'manuel-academy' as const,
  }
  const created = await local.ports.calendar.create(learnerScope, calendarDraftForPlan({
    scope: learnerScope,
    plan,
    householdTimeZone: context.householdTimeZone,
    instant: BASE,
    timerHidden: false,
  }))
  const entry = await local.ports.calendar.start(learnerScope, created.blockRef, at(1))
  const scope = { ...learnerScope, sessionRef: `${entry.blockRef}:session` }
  await local.ports.persistence.saveSession({
    scope,
    lessonRef,
    segmentRef: entry.segments[0]!.segmentRef,
    status: 'active',
    updatedAt: at(1),
    lastAcceptedEventRef: null,
    lastProgressionDecisionRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
  return { entry, scope, ports: local.ports, services: local.services }
}

async function accepted(h: Harness, directive: 'continue' | 'reteach' = 'continue'): Promise<StudyTutorAdvisory> {
  const eventRef = `tutor:${h.scope.sessionRef}:${directive}`
  await h.ports.eventLedger.append(h.scope, {
    eventRef,
    occurredAt: at(2),
    type: 'tutor-directive',
    payload: { bridgeEventVersion: 1, eventLedgerIdempotencyKey: `idem:${eventRef}` },
  })
  return { status: 'accepted', eventRef, directive }
}

function withCompletionSpy(ports: StudyPortBundle) {
  const completeCurrentSegment = vi.fn(ports.calendar.completeCurrentSegment)
  const observed: StudyPortBundle = {
    ...ports,
    calendar: { ...ports.calendar, completeCurrentSegment },
  }
  return { ports: observed, completeCurrentSegment }
}

function input(h: Harness, tutorAdvisory: StudyTutorAdvisory | null, ports = h.ports) {
  return {
    ports,
    scope: h.scope,
    entry: h.entry,
    segmentRef: h.entry.segments[0]!.segmentRef,
    tutorAdvisory,
    bindingIsCurrent: true,
    safetyStopped: false,
    occurredAt: at(3),
  }
}

function publicState(h: Harness) {
  return h.services.inspectPublicStateForTest() as {
    sessions: Array<{ status: string; lastAcceptedEventRef: string | null; lastProgressionDecisionRef: string | null }>
    calendar: StudyCalendarEntry[]
    events: Array<{ type: string; payload: Record<string, unknown> }>
  }
}

describe('Study-owned Tutor progression authority', () => {
  it('keeps an accepted reteach segment active', async () => {
    const h = await harness('tutor-core', 'reteach-active')
    const result = await applyStudyProgression(input(h, await accepted(h, 'reteach')))
    expect(result).toMatchObject({ decision: { decision: 'HOLD', reasonCode: 'accepted-tutor-reteach' } })
    expect(result.entry.state).toBe('active')
    expect(result.entry.completedSegmentRefs).toEqual([])
  })

  it('calls completeCurrentSegment zero times for accepted reteach', async () => {
    const h = await harness('tutor-core', 'reteach-call-count')
    const observed = withCompletionSpy(h.ports)
    await applyStudyProgression(input(h, await accepted(h, 'reteach'), observed.ports))
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(0)
  })

  it('emits no session-completed event for accepted reteach', async () => {
    const h = await harness('tutor-core', 'reteach-event')
    await applyStudyProgression(input(h, await accepted(h, 'reteach')))
    expect(publicState(h).events.filter((event) => event.type === 'session-completed')).toEqual([])
  })

  it('writes no durable completed session snapshot for accepted reteach', async () => {
    const h = await harness('tutor-core', 'reteach-snapshot')
    await applyStudyProgression(input(h, await accepted(h, 'reteach')))
    expect(publicState(h).sessions.some((session) => session.status === 'completed')).toBe(false)
  })

  it('invokes the explicit Study policy for an accepted continue advisory', async () => {
    const h = await harness('tutor-core', 'continue-policy')
    const policy = vi.fn<StudyProgressionPolicy>(() => ({
      decision: 'HOLD', authority: 'study', reasonCode: 'safety-stop',
    }))
    await applyStudyProgression({ ...input(h, await accepted(h)), policy })
    expect(policy).toHaveBeenCalledOnce()
    expect(policy.mock.calls[0]![0].tutorAdvisory).toMatchObject({ directive: 'continue' })
  })

  it('holds an accepted continue advisory when trusted Study safety state is stopped', async () => {
    const h = await harness('tutor-core', 'continue-hold')
    const observed = withCompletionSpy(h.ports)
    const result = await applyStudyProgression({
      ...input(h, await accepted(h), observed.ports),
      safetyStopped: true,
    })
    expect(result.decision).toMatchObject({ decision: 'HOLD', reasonCode: 'safety-stop' })
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(0)
  })

  it('advances exactly once when Study authorizes an accepted continue advisory', async () => {
    const h = await harness('tutor-core', 'continue-advance')
    const observed = withCompletionSpy(h.ports)
    const result = await applyStudyProgression(input(h, await accepted(h), observed.ports))
    expect(result.decision).toMatchObject({ decision: 'ADVANCE', authority: 'study' })
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(1)
    expect(result.entry.state).toBe('completed')
  })

  it.each([
    ['stopped', { status: 'stopped' } as const, 'tutor-stopped'],
    ['quarantined', { status: 'quarantined' } as const, 'tutor-quarantined'],
    ['invalid', { status: 'invalid' } as const, 'tutor-invalid'],
    ['rejected', { status: 'rejected' } as const, 'tutor-rejected'],
  ])('holds %s Tutor output with zero progression', async (suffix, advisory, reasonCode) => {
    const h = await harness('tutor-core', suffix)
    const observed = withCompletionSpy(h.ports)
    const result = await applyStudyProgression(input(h, advisory, observed.ports))
    expect(result.decision).toMatchObject({ decision: 'HOLD', reasonCode })
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(0)
  })

  it('holds stale host binding with zero progression', async () => {
    const h = await harness('tutor-core', 'stale-binding')
    const observed = withCompletionSpy(h.ports)
    const result = await applyStudyProgression({
      ...input(h, await accepted(h), observed.ports),
      bindingIsCurrent: false,
    })
    expect(result.decision).toMatchObject({ decision: 'HOLD', reasonCode: 'stale-binding' })
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(0)
  })

  it('allows completion-only work through Study authority without Tutor evidence', async () => {
    const h = await harness('completion-only', 'completion-only')
    const result = await applyStudyProgression(input(h, null))
    const snapshot = await h.ports.persistence.loadSession(h.scope)
    expect(result).toMatchObject({ decision: { decision: 'ADVANCE', reasonCode: 'completion-only' }, entry: { state: 'completed' } })
    expect(snapshot).toMatchObject({ status: 'completed', lastAcceptedEventRef: null })
    expect(snapshot?.lastProgressionDecisionRef).toMatch(/^study-progression:/)
  })

  it('deduplicates replay of the same accepted Tutor event and completion', async () => {
    const h = await harness('tutor-core', 'duplicate')
    const advisory = await accepted(h)
    const observed = withCompletionSpy(h.ports)
    const first = await applyStudyProgression(input(h, advisory, observed.ports))
    const replay = await applyStudyProgression(input(h, advisory, observed.ports))
    expect(first.entry.state).toBe('completed')
    expect(replay.replayed).toBe(true)
    expect(observed.completeCurrentSegment).toHaveBeenCalledTimes(1)
    expect(publicState(h).events.filter((event) => event.type === 'session-completed')).toHaveLength(1)
  })

  it('preserves canonical completion and event idempotency under concurrent attempts', async () => {
    const h = await harness('tutor-core', 'concurrent')
    const advisory = await accepted(h)
    await Promise.all([
      applyStudyProgression(input(h, advisory)),
      applyStudyProgression(input(h, advisory)),
    ])
    const state = publicState(h)
    expect(state.calendar[0]).toMatchObject({ state: 'completed' })
    expect(state.events.filter((event) => event.type === 'study-progression-decision')).toHaveLength(1)
    expect(state.events.filter((event) => event.type === 'session-completed')).toHaveLength(1)
    expect(await h.ports.persistence.loadSession(h.scope)).toMatchObject({ status: 'completed' })
  })

  it('retries safely after a crash between decision evidence and calendar mutation', async () => {
    const h = await harness('tutor-core', 'crash-before-calendar')
    const advisory = await accepted(h)
    const interrupted: StudyPortBundle = {
      ...h.ports,
      calendar: {
        ...h.ports.calendar,
        completeCurrentSegment: async () => { throw new Error('simulated crash before calendar write') },
      },
    }
    await expect(applyStudyProgression(input(h, advisory, interrupted))).rejects.toThrow(/simulated crash/)
    expect((await h.ports.calendar.list(h.scope))[0]).toMatchObject({ state: 'active' })

    const retried = await applyStudyProgression(input(h, advisory))
    expect(retried.entry.state).toBe('completed')
    expect(publicState(h).events.filter((event) => event.type === 'study-progression-decision')).toHaveLength(1)
    expect(publicState(h).events.filter((event) => event.type === 'session-completed')).toHaveLength(1)
  })

  it('recovers safely after a crash between calendar mutation and terminal writes', async () => {
    const h = await harness('tutor-core', 'crash-after-calendar')
    const advisory = await accepted(h)
    const interrupted: StudyPortBundle = {
      ...h.ports,
      eventLedger: {
        ...h.ports.eventLedger,
        append: async (scope, event, operation) => {
          if (event.type === 'session-completed') throw new Error('simulated crash after calendar write')
          return h.ports.eventLedger.append(scope, event, operation)
        },
      },
    }
    await expect(applyStudyProgression(input(h, advisory, interrupted))).rejects.toThrow(/simulated crash/)
    const completedEntry = (await h.ports.calendar.list(h.scope))[0]!
    expect(completedEntry.state).toBe('completed')
    expect(await h.ports.persistence.loadSession(h.scope)).toMatchObject({ status: 'active' })

    await recoverAuthorizedStudyCompletion({
      ports: h.ports,
      scope: h.scope,
      entry: completedEntry,
      occurredAt: at(4),
    })
    expect(await h.ports.persistence.loadSession(h.scope)).toMatchObject({ status: 'completed' })
    expect(publicState(h).events.filter((event) => event.type === 'session-completed')).toHaveLength(1)
  })

  it('restores the same active segment after reteach refresh/resume', async () => {
    const h = await harness('tutor-core', 'reteach-refresh')
    const advisory = await accepted(h, 'reteach')
    await applyStudyProgression(input(h, advisory))
    const restored = (await h.ports.calendar.list(h.scope)).find((entry) => entry.blockRef === h.entry.blockRef)!
    const resumed = await applyStudyProgression({ ...input(h, advisory), entry: restored })
    expect(resumed.entry).toMatchObject({ state: 'active', completedSegmentRefs: [] })
  })

  it('restores canonical completed state and authority evidence after authorized advance', async () => {
    const h = await harness('tutor-core', 'advance-refresh')
    await applyStudyProgression(input(h, await accepted(h)))
    const restored = (await h.ports.calendar.list(h.scope)).find((entry) => entry.blockRef === h.entry.blockRef)
    const snapshot = await h.ports.persistence.loadSession(h.scope)
    expect(restored).toMatchObject({ state: 'completed', completedSegmentRefs: [h.entry.segments[0]!.segmentRef] })
    expect(snapshot).toMatchObject({ status: 'completed' })
    expect(snapshot?.lastProgressionDecisionRef).toMatch(/^study-progression:/)
  })

  it('rejects calendar-complete plus accepted Tutor evidence without a Study decision', async () => {
    const h = await harness('tutor-core', 'guard-no-decision')
    const advisory = await accepted(h)
    if (advisory.status !== 'accepted') throw new Error('accepted fixture failed')
    await h.ports.calendar.completeCurrentSegment(h.scope, h.entry.blockRef, h.entry.segments[0]!.segmentRef, at(3))
    await expect(h.ports.persistence.saveSession({
      scope: h.scope,
      lessonRef: h.entry.lessonRef,
      segmentRef: h.entry.segments[0]!.segmentRef,
      status: 'completed',
      updatedAt: at(3),
      lastAcceptedEventRef: advisory.eventRef,
      lastProgressionDecisionRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })).rejects.toThrow(/Study progression authority evidence/i)
  })

  it('does not treat lastAcceptedEventRef as authority or accept a non-Tutor event ref', async () => {
    const h = await harness('tutor-core', 'guard-event-kind')
    const segmentRef = h.entry.segments[0]!.segmentRef
    const decisionRef = `study-progression:${h.scope.sessionRef}:${segmentRef}`
    const launchRef = `launch:${h.scope.sessionRef}:forged`
    await h.ports.eventLedger.append(h.scope, {
      eventRef: launchRef,
      occurredAt: at(2),
      type: 'session-launched',
      payload: { lessonRef: h.entry.lessonRef, segmentRef },
    })
    await h.ports.eventLedger.append(h.scope, {
      eventRef: decisionRef,
      occurredAt: at(2),
      type: 'study-progression-decision',
      payload: { decision: 'ADVANCE', basis: 'accepted-tutor-continue', segmentRef },
    })
    await h.ports.calendar.completeCurrentSegment(h.scope, h.entry.blockRef, segmentRef, at(3))
    await expect(h.ports.persistence.saveSession({
      scope: h.scope,
      lessonRef: h.entry.lessonRef,
      segmentRef,
      status: 'completed',
      updatedAt: at(3),
      lastAcceptedEventRef: launchRef,
      lastProgressionDecisionRef: decisionRef,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })).rejects.toThrow(/accepted Tutor event/i)
  })

  it('rejects a completed snapshot without the canonical session-completed event', async () => {
    const h = await harness('tutor-core', 'guard-completion-event')
    const advisory = await accepted(h)
    if (advisory.status !== 'accepted') throw new Error('accepted fixture failed')
    const segmentRef = h.entry.segments[0]!.segmentRef
    const decisionRef = `study-progression:${h.scope.sessionRef}:${segmentRef}`
    await h.ports.eventLedger.append(h.scope, {
      eventRef: decisionRef,
      occurredAt: at(2),
      type: 'study-progression-decision',
      payload: { decision: 'ADVANCE', basis: 'accepted-tutor-continue', segmentRef },
    })
    await h.ports.calendar.completeCurrentSegment(h.scope, h.entry.blockRef, segmentRef, at(3))
    await expect(h.ports.persistence.saveSession({
      scope: h.scope,
      lessonRef: h.entry.lessonRef,
      segmentRef,
      status: 'completed',
      updatedAt: at(3),
      lastAcceptedEventRef: advisory.eventRef,
      lastProgressionDecisionRef: decisionRef,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })).rejects.toThrow(/session completion evidence/i)
  })

  it('keeps minimized evidence and declares the complete Tutor/Study authority contract', async () => {
    const h = await harness('tutor-core', 'privacy-authority')
    await applyStudyProgression(input(h, await accepted(h)))
    expect(JSON.stringify(publicState(h))).not.toMatch(/RAW_LEARNER_CANARY|personality judgment|emotional label|diagnostic inference/i)
    expect(publicState(h).sessions).toEqual([
      expect.objectContaining({ rawAnswerIncluded: false, transcriptIncluded: false }),
    ])
    expect(STUDY_PROGRESSION_AUTHORITY_INVARIANTS).toEqual({
      TUTOR_CAN_COMPLETE_STUDY_SEGMENT: false,
      TUTOR_CAN_DECLARE_OFFICIAL_MASTERY: false,
      TUTOR_CAN_CHANGE_WORKING_LEVEL: false,
      TUTOR_CAN_CHANGE_NOMINAL_GRADE: false,
      TUTOR_CAN_ASSIGN_CURRICULUM: false,
      TUTOR_RECOMMENDATION_IS_ADVISORY: true,
      STUDY_PROGRESSION_DECISION_REQUIRED: true,
      STUDY_ENGINE_REMAINS_AUTHORITY: true,
    })
  })

  it('holds non-current or already completed segments in the canonical policy', async () => {
    const h = await harness('tutor-core', 'non-current')
    const advisory = await accepted(h)
    expect(decideStudyProgression({
      ...input(h, advisory),
      segmentRef: 'segment:not-current',
    })).toMatchObject({ decision: 'HOLD', reasonCode: 'non-current-segment' })
  })
})

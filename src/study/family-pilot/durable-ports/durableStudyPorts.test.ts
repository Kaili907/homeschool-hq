import { describe, expect, it } from 'vitest'
import { calendarDraftForPlan } from '../../calendarAdapter'
import { assertCompleteStudyPortBundle, type StudyPortBundle, type StudySafetyPort } from '../../ports'
import { SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type {
  StudyAdultAuthorization,
  StudyCheckpoint,
  StudyLearnerScope,
  StudyLessonPlan,
  StudyReviewRecommendation,
  StudyScope,
  StudySessionSnapshot,
} from '../../types'
import { createFamilyPilotDurableStudyPorts, type FamilyPilotDurableStudyServices } from './durableStudyPorts'
import { durableStudyDocumentKey, durableStudyQuarantineKey } from './store'

// Role-by-role parity with the accepted provider. Every acceptance rule checked
// here is a rule createLocalDevelopmentStudyPorts enforces in memory; the point
// is that it still holds once the record has been through device storage.

const SAFETY: StudySafetyPort = {
  mode: 'production',
  classifierVersion: 'family-pilot-durable-ports-test-safety-v1',
  evaluate: async () => ({ outcome: 'clear', mayContinue: true, adultHelpState: 'not-needed' }),
}

const SCOPE: StudyLearnerScope = { householdRef: 'household:pilot', learnerRef: 'learner:pilot-ada' }
const SESSION: StudyScope = { ...SCOPE, sessionRef: 'session:pilot-ada:one' }
const ADULT: StudyAdultAuthorization = {
  householdRef: SCOPE.householdRef,
  actorRef: 'adult:pilot-parent',
  role: 'parent',
  adultAuthorized: true,
}

function mapStorage(values = new Map<string, string>()) {
  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    },
  }
}

function device(): {
  values: Map<string, string>
  ports: StudyPortBundle
  services: FamilyPilotDurableStudyServices
  /** A cold start over the same storage. */
  reopen: () => StudyPortBundle
} {
  const storage = mapStorage()
  let tick = 0
  const now = () => new Date(SYNTHETIC_NOW.getTime() + (tick += 1000))
  const built = createFamilyPilotDurableStudyPorts({ safety: SAFETY, storage: storage.storage, now })
  return {
    values: storage.values,
    ports: built.ports,
    services: built.services,
    reopen: () => createFamilyPilotDurableStudyPorts({ safety: SAFETY, storage: storage.storage, now }).ports,
  }
}

function plan(overrides: Partial<StudyLessonPlan> = {}): StudyLessonPlan {
  return {
    lessonRef: 'pilot:grade5:math:ports',
    title: 'Grade 5 math study block',
    subject: 'math',
    skillRefs: ['pilot:grade5:math:multiplication'],
    masteryAuthority: 'tutor-core',
    source: 'manuel-academy',
    segments: [
      { segmentRef: 'segment:one', title: 'Warm up', taskType: 'retrieval-practice', estimatedMinutes: 5, required: true },
      { segmentRef: 'segment:two', title: 'Practice', taskType: 'independent-practice', estimatedMinutes: 10, required: true },
    ],
    ...overrides,
  }
}

function draft(lessonPlan: StudyLessonPlan = plan()) {
  return calendarDraftForPlan({
    scope: SCOPE,
    plan: lessonPlan,
    householdTimeZone: 'America/New_York',
    instant: SYNTHETIC_NOW,
    timerHidden: false,
  })
}

/**
 * The calendar runtime refuses out-of-order events, and `create` stamps the
 * block with the services clock, so every transition instant here starts after
 * that stamp.
 */
function at(offsetMs: number): string {
  return new Date(SYNTHETIC_NOW.getTime() + 60_000 + offsetMs).toISOString()
}

function checkpoint(overrides: Partial<StudyCheckpoint> = {}): StudyCheckpoint {
  return {
    checkpointRef: 'session:pilot-ada:one:checkpoint:1',
    householdRef: SCOPE.householdRef,
    learnerRef: SCOPE.learnerRef,
    sessionRef: SESSION.sessionRef,
    lessonRef: 'pilot:grade5:math:ports',
    segmentRef: 'segment:one',
    revision: 1,
    capturedAt: SYNTHETIC_NOW.toISOString(),
    completedSegmentRefs: [],
    elapsedActiveSecondsInSegment: 42,
    responseDraftRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function review(overrides: Partial<StudyReviewRecommendation> = {}): StudyReviewRecommendation {
  return {
    recommendationRef: 'recommendation:one',
    householdRef: SCOPE.householdRef,
    learnerRef: SCOPE.learnerRef,
    sourceEvidenceRef: 'evidence:one',
    lessonRef: 'pilot:grade5:math:ports',
    dueDate: '2026-09-01',
    reasonCodes: ['needs-review'],
    status: 'pending-parent',
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function session(overrides: Partial<StudySessionSnapshot> = {}): StudySessionSnapshot {
  return {
    scope: SESSION,
    lessonRef: 'pilot:grade5:math:ports',
    segmentRef: 'segment:one',
    status: 'active',
    updatedAt: SYNTHETIC_NOW.toISOString(),
    lastAcceptedEventRef: null,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

describe('Family Pilot durable Study ports — bundle shape', () => {
  it('supplies all nine StudyPortBundle roles', () => {
    const { ports } = device()
    expect(() => assertCompleteStudyPortBundle(ports)).not.toThrow()
    expect(Object.keys(ports).sort()).toEqual([
      'adultPrivate', 'calendar', 'checkpoint', 'eventLedger', 'outbox',
      'parentSettings', 'persistence', 'reviewQueue', 'safety',
    ])
  })

  it('requires a safety port instead of shipping a classifier of its own', () => {
    expect(() => createFamilyPilotDurableStudyPorts({ safety: undefined as unknown as StudySafetyPort }))
      .toThrow(/safety port is required/)
    const { ports } = device()
    // The injected port is passed through untouched: this module makes no
    // safety decision and declares no classifier version.
    expect(ports.safety).toBe(SAFETY)
    expect(ports.safety.mode).toBe('production')
  })

  it('refuses every operation, including a diagnostic, without an explicit student', async () => {
    const box = device()
    for (const scope of [
      { householdRef: '', learnerRef: SCOPE.learnerRef },
      { householdRef: SCOPE.householdRef, learnerRef: '' },
    ]) {
      expect(() => box.services.health(scope)).toThrow(/household and learner references are required/)
      expect(() => box.services.reset(scope)).toThrow(/household and learner references are required/)
      await expect(box.ports.calendar.list(scope)).rejects.toThrow(/household and learner references are required/)
    }
    await expect(box.ports.persistence.loadSession({ ...SCOPE, sessionRef: '' })).rejects.toThrow(/sessionRef is required/)
  })
})

describe('Family Pilot durable Study ports — storage key derivation', () => {
  it('cannot be made to collide by references that contain the delimiter', () => {
    // The learner reference is percent-encoded, so a learner named with the `:`
    // or `/` delimiter cannot be made to land on another student's key.
    expect(durableStudyDocumentKey({ ...SCOPE, learnerRef: 'a:b' }))
      .not.toBe(durableStudyDocumentKey({ ...SCOPE, learnerRef: 'a%3Ab' }))
    expect(durableStudyDocumentKey({ ...SCOPE, learnerRef: 'a/b' }))
      .not.toBe(durableStudyDocumentKey({ ...SCOPE, learnerRef: 'a%2Fb' }))
    expect(durableStudyDocumentKey(SCOPE)).toBe(durableStudyDocumentKey({ ...SCOPE }))
    // The household is deliberately NOT in the key: it is verified inside the
    // document, so a second household for one learner is refused rather than
    // silently forked into a second record.
    expect(durableStudyDocumentKey(SCOPE))
      .toBe(durableStudyDocumentKey({ ...SCOPE, householdRef: 'household:other' }))
    // And the quarantine key is derived from the document key, never shared.
    const sister = { ...SCOPE, learnerRef: 'learner:pilot-bea' }
    expect(durableStudyQuarantineKey(SCOPE)).not.toBe(durableStudyQuarantineKey(sister))
    expect(durableStudyQuarantineKey(SCOPE)).toContain(durableStudyDocumentKey(SCOPE))
  })

  it('refuses a write it could not read back, as one failed call', async () => {
    const box = device()
    await box.ports.persistence.savePreferences(SCOPE, {
      accessibility: {
        largeText: false, reducedMotion: false, noAudio: false,
        captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true,
      },
      timerPreference: { visibility: 'shown', milestonesOnly: false },
    })
    const before = box.values.get(durableStudyDocumentKey(SCOPE))

    // A host that omits one accessibility flag writes something this build could
    // not parse back. That must refuse HERE, not land and quarantine the whole
    // student record on the next read.
    await expect(box.ports.persistence.savePreferences(SCOPE, {
      accessibility: { largeText: true, reducedMotion: false, noAudio: false, captions: true, transientTranscript: false, oneTaskAtATime: true },
      timerPreference: { visibility: 'shown', milestonesOnly: false },
    } as never)).rejects.toThrow(/could not read back/)

    expect(box.values.get(durableStudyDocumentKey(SCOPE))).toBe(before)
    // Still fully usable, which is the whole point of refusing the write.
    expect(box.services.health(SCOPE)).toMatchObject({ status: 'ready', durable: true })
    await expect(box.reopen().persistence.loadPreferences(SCOPE))
      .resolves.toMatchObject({ accessibility: { largeText: false } })
  })
})

describe('Family Pilot durable Study ports — persistence', () => {
  it('round-trips a session snapshot through storage', async () => {
    const box = device()
    await box.ports.persistence.saveSession(session())
    await expect(box.reopen().persistence.loadSession(SESSION)).resolves.toMatchObject({
      lessonRef: 'pilot:grade5:math:ports',
      segmentRef: 'segment:one',
      status: 'active',
    })
    await expect(box.ports.persistence.loadSession({ ...SESSION, sessionRef: 'session:other' })).resolves.toBeNull()
  })

  it('serves accepted defaults for preferences and keeps saved ones', async () => {
    const box = device()
    await expect(box.ports.persistence.loadPreferences(SCOPE))
      .resolves.toMatchObject({ timerPreference: { visibility: 'shown', milestonesOnly: false } })
    await box.ports.persistence.savePreferences(SCOPE, {
      accessibility: {
        largeText: true, reducedMotion: true, noAudio: false,
        captions: true, transientTranscript: false, highContrast: false, oneTaskAtATime: true,
      },
      timerPreference: { visibility: 'hidden', milestonesOnly: true },
    })
    await expect(box.reopen().persistence.loadPreferences(SCOPE))
      .resolves.toMatchObject({ accessibility: { largeText: true }, timerPreference: { visibility: 'hidden' } })
  })

  it('refuses a forged completion with no completed calendar work', async () => {
    const box = device()
    await expect(box.ports.persistence.saveSession(session({ status: 'completed' })))
      .rejects.toThrow(/canonical calendar work is incomplete/)
  })

  it('refuses a completion with no accepted Tutor event when Tutor Core owns mastery', async () => {
    const box = device()
    const created = await box.ports.calendar.create(SCOPE, draft())
    await box.ports.calendar.start(SCOPE, created.blockRef, at(0))
    for (const [index, segment] of created.segments.entries()) {
      await box.ports.calendar.completeCurrentSegment(
        SCOPE, created.blockRef, segment.segmentRef, at(1_000 * (index + 1)),
      )
    }
    await expect(box.ports.persistence.saveSession(session({ status: 'completed' })))
      .rejects.toThrow(/accepted Tutor event is required/)

    // A completion-only plan needs no Tutor receipt, exactly as accepted.
    const completionOnly = plan({ lessonRef: 'pilot:parent-activity:walk', masteryAuthority: 'completion-only' })
    const activity = await box.ports.calendar.create(SCOPE, draft(completionOnly))
    await box.ports.calendar.start(SCOPE, activity.blockRef, at(10_000))
    for (const [index, segment] of activity.segments.entries()) {
      await box.ports.calendar.completeCurrentSegment(
        SCOPE, activity.blockRef, segment.segmentRef, at(11_000 + 1_000 * index),
      )
    }
    await expect(box.ports.persistence.saveSession(
      session({ status: 'completed', lessonRef: 'pilot:parent-activity:walk' }),
    )).resolves.toBeUndefined()
  })
})

describe('Family Pilot durable Study ports — checkpoint', () => {
  it('saves, reloads, and refuses stale or colliding revisions', async () => {
    const box = device()
    await expect(box.ports.checkpoint.save(checkpoint())).resolves.toBe('saved')
    await expect(box.reopen().checkpoint.loadLatest(SESSION)).resolves.toMatchObject({ revision: 1, elapsedActiveSecondsInSegment: 42 })
    await expect(box.ports.checkpoint.save(checkpoint())).resolves.toBe('duplicate-ignored')
    await expect(box.ports.checkpoint.save(checkpoint({ elapsedActiveSecondsInSegment: 99 })))
      .rejects.toThrow(/revision collision/)
    await expect(box.ports.checkpoint.save(checkpoint({ revision: 0 }))).rejects.toThrow(/Stale checkpoint/)
    await expect(box.ports.checkpoint.save(checkpoint({ revision: 2, checkpointRef: 'session:pilot-ada:one:checkpoint:2' })))
      .resolves.toBe('saved')
  })

  it('refuses a checkpoint that carries draft text instead of a reference', async () => {
    const box = device()
    await expect(box.ports.checkpoint.save(checkpoint({ responseDraftRef: 'the student typed this answer' })))
      .rejects.toThrow(/opaque reference, never draft text/)
    await expect(box.ports.checkpoint.save(checkpoint({ checkpointRef: 'not a reference' })))
      .rejects.toThrow(/opaque identifiers/)
    expect(box.values.get(durableStudyDocumentKey(SCOPE))).toBeUndefined()
  })
})

describe('Family Pilot durable Study ports — review queue', () => {
  it('enqueues, lists, decides, and collapses duplicates', async () => {
    const box = device()
    await expect(box.ports.reviewQueue.enqueue(review())).resolves.toBe('enqueued')
    await expect(box.ports.reviewQueue.enqueue(review())).resolves.toBe('duplicate-ignored')
    // Same evidence, lesson and due date under a new reference is the same
    // recommendation, not a second one.
    await expect(box.ports.reviewQueue.enqueue(review({ recommendationRef: 'recommendation:two' })))
      .resolves.toBe('duplicate-ignored')
    await expect(box.ports.reviewQueue.enqueue(review({ status: 'accepted' })))
      .rejects.toThrow(/identity collision/)

    await box.ports.reviewQueue.decide(SCOPE, 'recommendation:one', 'accepted')
    await expect(box.reopen().reviewQueue.list(SCOPE)).resolves.toMatchObject([{ status: 'accepted' }])
    await expect(box.ports.reviewQueue.decide(SCOPE, 'recommendation:missing', 'rejected'))
      .rejects.toThrow(/Unknown learner-scoped review/)
  })

  it('refuses learner text in place of reason codes', async () => {
    const box = device()
    await expect(box.ports.reviewQueue.enqueue(review({ reasonCodes: ['the student said they were stuck'] })))
      .rejects.toThrow(/opaque codes, not learner text/)
  })
})

describe('Family Pilot durable Study ports — calendar', () => {
  it('creates once, projects the accepted entry, and survives a cold start', async () => {
    const box = device()
    const created = await box.ports.calendar.create(SCOPE, draft())
    expect(created).toMatchObject({
      learnerRef: SCOPE.learnerRef,
      lessonRef: 'pilot:grade5:math:ports',
      state: 'scheduled',
      masteryAuthority: 'tutor-core',
      requiredWorkCompletionPercent: 0,
    })
    expect(created.segments.map((segment) => segment.segmentRef)).toEqual(['segment:one', 'segment:two'])
    // Re-creating the same draft is idempotent, not a second block.
    await expect(box.ports.calendar.create(SCOPE, draft())).resolves.toMatchObject({ blockRef: created.blockRef })
    await expect(box.reopen().calendar.list(SCOPE)).resolves.toHaveLength(1)
  })

  it('refuses a block reference reused for different source work', async () => {
    const box = device()
    const first = draft()
    await box.ports.calendar.create(SCOPE, first)
    await expect(box.ports.calendar.create(SCOPE, { ...first, externalItemRef: 'host:someone-elses-item' }))
      .rejects.toThrow(/identity collision/)
  })

  it('delegates start, pause, resume and segment completion, idempotently', async () => {
    const box = device()
    const created = await box.ports.calendar.create(SCOPE, draft())

    expect(await box.ports.calendar.start(SCOPE, created.blockRef, at(0))).toMatchObject({ state: 'active' })
    expect(await box.ports.calendar.start(SCOPE, created.blockRef, at(1_000))).toMatchObject({ state: 'active' })
    expect(await box.ports.calendar.pause(SCOPE, created.blockRef, at(2_000), 'requested_break'))
      .toMatchObject({ state: 'paused' })
    expect(await box.ports.calendar.pause(SCOPE, created.blockRef, at(3_000), 'requested_break'))
      .toMatchObject({ state: 'paused' })
    expect(await box.ports.calendar.resume(SCOPE, created.blockRef, at(4_000))).toMatchObject({ state: 'active' })

    const advanced = await box.ports.calendar.completeCurrentSegment(SCOPE, created.blockRef, 'segment:one', at(5_000))
    expect(advanced.completedSegmentRefs).toEqual(['segment:one'])
    expect(advanced.requiredWorkCompletionPercent).toBe(50)
    // A repeat of the same segment changes nothing.
    expect(await box.ports.calendar.completeCurrentSegment(SCOPE, created.blockRef, 'segment:one', at(6_000)))
      .toMatchObject({ completedSegmentRefs: ['segment:one'] })

    const finished = await box.ports.calendar.completeCurrentSegment(SCOPE, created.blockRef, 'segment:two', at(7_000))
    expect(finished.state).toBe('completed')
    // And the completed state is what a cold start reads back.
    const [reloaded] = await box.reopen().calendar.list(SCOPE)
    expect(reloaded).toMatchObject({ state: 'completed', requiredWorkCompletionPercent: 100 })
  })

  it('carries an unfinished block into a durable continuation', async () => {
    const box = device()
    const created = await box.ports.calendar.create(SCOPE, draft())
    await box.ports.calendar.start(SCOPE, created.blockRef, at(0))
    await box.ports.calendar.completeCurrentSegment(SCOPE, created.blockRef, 'segment:one', at(1_000))
    await box.ports.calendar.pause(SCOPE, created.blockRef, at(2_000), 'outside_interruption')

    const continuation = await box.ports.calendar.createContinuation(
      SCOPE, created.blockRef, `${created.blockRef}:continuation`, 'continuation:one',
      '2026-08-13T09:00', '2026-08-13T09:00:00-04:00', '2026-08-13', at(3_000),
    )
    expect(continuation.created).toBe(true)
    expect(continuation.entry.continuationOf).toBe(created.blockRef)
    expect(continuation.entry.lessonRef).toBe('pilot:grade5:math:ports')
    // The same command again is idempotent, and both blocks are durable.
    const repeat = await box.ports.calendar.createContinuation(
      SCOPE, created.blockRef, `${created.blockRef}:continuation`, 'continuation:one',
      '2026-08-13T09:00', '2026-08-13T09:00:00-04:00', '2026-08-13', at(4_000),
    )
    expect(repeat.created).toBe(false)
    await expect(box.reopen().calendar.list(SCOPE)).resolves.toHaveLength(2)
  })

  it('refuses a calendar block this student does not own', async () => {
    const box = device()
    await expect(box.ports.calendar.start(SCOPE, 'block:not-mine', at(0)))
      .rejects.toThrow(/Unknown learner-scoped calendar block/)
  })
})

describe('Family Pilot durable Study ports — parent settings and adult private notes', () => {
  it('applies verified adult commands and advances the revision durably', async () => {
    const box = device()
    await expect(box.ports.parentSettings.read(SCOPE))
      .resolves.toMatchObject({ maximumWorkMinutes: 30, breakMinutes: 5, revision: 0 })
    await expect(box.ports.parentSettings.apply(SCOPE, ADULT, { type: 'set-maximum-duration', minutes: 20 }, 0))
      .resolves.toMatchObject({ status: 'applied', revision: 1 })
    await expect(box.reopen().parentSettings.read(SCOPE))
      .resolves.toMatchObject({ maximumWorkMinutes: 20, revision: 1 })
    // The revision is a real optimistic lock, across a cold start.
    await expect(box.reopen().parentSettings.apply(SCOPE, ADULT, { type: 'hide-timer', hidden: true }, 0))
      .rejects.toThrow(/Stale parent-control revision/)
    await expect(box.reopen().parentSettings.apply(SCOPE, ADULT, { type: 'hide-timer', hidden: true }, 1))
      .resolves.toMatchObject({ status: 'applied', revision: 2 })
  })

  it('requires verified adult authorization from this household', async () => {
    const box = device()
    for (const authorization of [
      { ...ADULT, adultAuthorized: false },
      { ...ADULT, householdRef: 'household:other' },
      { ...ADULT, actorRef: '' },
    ]) {
      await expect(box.ports.parentSettings.apply(SCOPE, authorization, { type: 'hide-timer', hidden: true }, 0))
        .rejects.toThrow(/Verified adult authorization is required/)
    }
    expect(box.values.get(durableStudyDocumentKey(SCOPE))).toBeUndefined()
  })

  it('keeps accommodations functional and collapses a repeat', async () => {
    const box = device()
    const accommodation = {
      accommodationRef: 'accommodation:one',
      functionalDescription: 'Needs one task shown at a time',
      studentMessage: 'We will do one step at a time.',
    }
    await expect(box.ports.parentSettings.apply(SCOPE, ADULT, { type: 'add-accommodation', accommodation }, 0))
      .resolves.toMatchObject({ status: 'applied', revision: 1 })
    await expect(box.ports.parentSettings.apply(SCOPE, ADULT, { type: 'add-accommodation', accommodation }, 1))
      .resolves.toMatchObject({ status: 'duplicate-ignored', revision: 1 })
    await expect(box.ports.parentSettings.apply(SCOPE, ADULT, {
      type: 'add-accommodation',
      accommodation: { ...accommodation, accommodationRef: 'accommodation:two', functionalDescription: 'ADHD diagnosis' },
    }, 1)).rejects.toThrow(/functional, non-diagnostic/)
  })

  it('accepts an authorized private note and writes no part of it to the device', async () => {
    const box = device()
    const body = 'ADULT-PRIVATE-NOTE-BODY-CANARY'
    await expect(box.ports.adultPrivate.commit(SCOPE, ADULT, { noteRef: 'note:one', category: 'wellbeing', body }))
      .resolves.toMatchObject({ status: 'authorized-and-committed' })
    expect(box.services.testOnlyPrivateNoteMatches(SCOPE, 'note:one', body)).toBe(true)
    // 'authorized-and-committed' is the contract's only success value, so the
    // non-durability has to be stated somewhere a parent surface can read it.
    expect(box.services.health(SCOPE).adultPrivateNotesDurable).toBe(false)
    await expect(box.ports.adultPrivate.commit(SCOPE, ADULT, {
      noteRef: 'note:one', category: 'wellbeing', body: 'a different body',
    })).rejects.toThrow(/identity collision/)
    await expect(box.ports.adultPrivate.commit(
      SCOPE, { ...ADULT, adultAuthorized: false }, { noteRef: 'note:two', category: 'wellbeing', body },
    )).rejects.toThrow(/Verified adult authorization/)

    // Deliberately non-durable: the note body is on the list of fields that may
    // not reach browser storage, so nothing about it is written at all.
    expect([...box.values.values()].join('\n')).not.toContain(body)
    expect([...box.values.values()].join('\n')).not.toContain('note:one')
  })
})

describe('Family Pilot durable Study ports — event ledger and outbox', () => {
  it('appends once and distinguishes a duplicate from a collision', async () => {
    const box = device()
    const event = {
      eventRef: 'event:one',
      occurredAt: SYNTHETIC_NOW.toISOString(),
      type: 'checkpoint-saved' as const,
      payload: { checkpointRef: 'session:pilot-ada:one:checkpoint:1', revision: 1 },
    }
    await expect(box.ports.eventLedger.append(SESSION, event)).resolves.toBe('appended')
    await expect(box.reopen().eventLedger.append(SESSION, event)).resolves.toBe('duplicate-ignored')
    await expect(box.reopen().eventLedger.append(SESSION, { ...event, payload: { ...event.payload, revision: 2 } }))
      .resolves.toBe('idempotency-collision')
    // A completion re-announced under a new reference is the same completion.
    const completion = {
      eventRef: 'event:completion',
      occurredAt: SYNTHETIC_NOW.toISOString(),
      type: 'session-completed' as const,
      payload: { blockRef: 'block:one', lessonRef: 'pilot:grade5:math:ports' },
    }
    await expect(box.ports.eventLedger.append(SESSION, completion)).resolves.toBe('appended')
    await expect(box.ports.eventLedger.append(SESSION, { ...completion, eventRef: 'event:completion-again' }))
      .resolves.toBe('duplicate-ignored')
  })

  it('refuses an unlisted payload field or credential-shaped text', async () => {
    const box = device()
    await expect(box.ports.eventLedger.append(SESSION, {
      eventRef: 'event:bad',
      occurredAt: SYNTHETIC_NOW.toISOString(),
      type: 'checkpoint-saved',
      payload: { checkpointRef: 'checkpoint:one', revision: 1, transcript: 'everything the student said' },
    })).rejects.toThrow(/non-allowlisted field/)
    await expect(box.ports.eventLedger.append(SESSION, {
      eventRef: 'event:bad-text',
      occurredAt: SYNTHETIC_NOW.toISOString(),
      type: 'safety-stop',
      payload: { reasonCode: 'Bearer abc123def', deliveryStatus: 'not-confirmed' },
    })).rejects.toThrow(/failed privacy minimization/)
    expect(box.values.get(durableStudyDocumentKey(SCOPE))).toBeUndefined()
  })

  it('proposes an outbox item exactly once and never as delivered', async () => {
    const box = device()
    const proposal = {
      proposalRef: 'proposal:one',
      route: 'adult-review' as const,
      evidenceRefs: ['evidence:one'],
      status: 'proposed-not-delivered' as const,
    }
    await expect(box.ports.outbox.propose(SCOPE, proposal)).resolves.toBe('proposed-not-delivered')
    await expect(box.reopen().outbox.propose(SCOPE, proposal)).resolves.toBe('proposed-not-delivered')
    await expect(box.reopen().outbox.propose(SCOPE, { ...proposal, evidenceRefs: ['evidence:two'] }))
      .rejects.toThrow(/identity collision/)
  })
})

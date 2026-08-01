import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts, LOCAL_DEVELOPMENT_ONLY_NOT_DURABLE } from './localDevelopmentPorts'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudyCheckpoint, StudyReviewRecommendation, StudySessionSnapshot } from './types'

const at = (seconds: number) => new Date(SYNTHETIC_NOW.getTime() + seconds * 1000).toISOString()

describe('local-only Study ports fail closed', () => {
  it('labels the implementation as non-durable', () => {
    expect(createLocalDevelopmentStudyPorts().services.label).toBe(LOCAL_DEVELOPMENT_ONLY_NOT_DURABLE)
  })

  it('rejects cross-learner and stale checkpoints while allowing exact replay', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const scope = { householdRef: 'household:synthetic', learnerRef: 'learner:one', sessionRef: 'session:one' }
    const checkpoint: StudyCheckpoint = {
      checkpointRef: 'checkpoint:one',
      ...scope,
      lessonRef: 'lesson:one',
      segmentRef: 'segment:one',
      revision: 1,
      capturedAt: at(1),
      completedSegmentRefs: [],
      elapsedActiveSecondsInSegment: 0,
      responseDraftRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await expect(ports.checkpoint.save(checkpoint)).resolves.toBe('saved')
    await expect(ports.checkpoint.save(checkpoint)).resolves.toBe('duplicate-ignored')
    await expect(ports.checkpoint.save({ ...checkpoint, revision: 0 })).rejects.toThrow(/stale/i)
    await expect(ports.checkpoint.loadLatest({ ...scope, learnerRef: 'learner:two' })).rejects.toThrow(/cross-learner/i)
  })

  it('rejects raw-answer and transcript aliases in ordinary public projections', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const scope = { householdRef: 'household:synthetic', learnerRef: 'learner:privacy', sessionRef: 'session:privacy' }
    const base: StudySessionSnapshot = {
      scope,
      lessonRef: 'lesson:privacy',
      segmentRef: 'segment:privacy',
      status: 'active',
      updatedAt: at(1),
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await expect(ports.persistence.saveSession({ ...base, raw_answer: 'CANARY' } as StudySessionSnapshot)).rejects.toThrow(/sensitive/i)
    await expect(ports.persistence.saveSession({ ...base, transcriptText: 'CANARY' } as StudySessionSnapshot)).rejects.toThrow(/sensitive/i)
  })

  it('keeps adult-private note bodies outside every public projection', async () => {
    const { ports, services } = createLocalDevelopmentStudyPorts()
    const scope = { householdRef: 'household:synthetic', learnerRef: 'learner:private' }
    const auth = { householdRef: scope.householdRef, actorRef: 'adult:synthetic', role: 'parent' as const, adultAuthorized: true }
    const canary = 'ADULT_PRIVATE_CANARY_42'
    await ports.adultPrivate.commit(scope, auth, { noteRef: 'note:one', category: 'instruction', body: canary })
    expect(services.testOnlyPrivateNoteMatches(scope, 'note:one', canary)).toBe(true)
    expect(JSON.stringify(services.inspectPublicStateForTest())).not.toContain(canary)
  })

  it('rejects forged completion without canonical block completion and accepted receipt', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'forged' })
    await expect(ports.persistence.saveSession({
      scope: { ...scope, sessionRef: 'session:forged' },
      lessonRef: entry.lessonRef,
      segmentRef: entry.segments[0]!.segmentRef,
      status: 'completed',
      updatedAt: at(1),
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })).rejects.toThrow(/forged completion/i)
  })

  it('deduplicates semantic reviews even when a forged second ID is used', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const base: StudyReviewRecommendation = {
      recommendationRef: 'review:one',
      householdRef: 'household:synthetic',
      learnerRef: 'learner:review',
      sourceEvidenceRef: 'evidence:one',
      lessonRef: 'lesson:one',
      dueDate: '2026-08-02',
      reasonCodes: ['engine-review-due'],
      status: 'pending-parent',
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await expect(ports.reviewQueue.enqueue(base)).resolves.toBe('enqueued')
    await expect(ports.reviewQueue.enqueue({ ...base, recommendationRef: 'review:forged-second-id' })).resolves.toBe('duplicate-ignored')
    expect(await ports.reviewQueue.list(base)).toHaveLength(1)
  })

  it('provides exact resume and idempotent partial continuation', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'continuation' })
    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.completeCurrentSegment(scope, entry.blockRef, entry.segments[0]!.segmentRef, at(2))
    const paused = await ports.calendar.pause(scope, entry.blockRef, at(3), 'planned_break')
    expect(paused.resumePoint?.segmentOrdinal).toBe(2)
    const first = await ports.calendar.createContinuation(
      scope,
      entry.blockRef,
      `${entry.blockRef}:continuation:one`,
      'continuation:one',
      '2026-08-02T09:00',
      '2026-08-02T13:00:00.000Z',
      '2026-08-02',
      at(4),
    )
    const replay = await ports.calendar.createContinuation(
      scope,
      entry.blockRef,
      `${entry.blockRef}:continuation:one`,
      'continuation:one',
      '2026-08-02T09:00',
      '2026-08-02T13:00:00.000Z',
      '2026-08-02',
      at(5),
    )
    expect(first.created).toBe(true)
    expect(replay.created).toBe(false)
    expect(replay.entry.blockRef).toBe(first.entry.blockRef)
  })
})

import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import { StudyParentController } from './parentController'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudyReviewRecommendation } from './types'

const at = (seconds: number) => new Date(SYNTHETIC_NOW.getTime() + seconds * 1000).toISOString()

describe('all ten parent controls through the host adapter', () => {
  it('requires verified adult authorization', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const controller = new StudyParentController(ports)
    await expect(controller.execute(
      { householdRef: 'household:one', learnerRef: 'learner:one' },
      { householdRef: 'household:one', actorRef: 'adult:one', role: 'parent', adultAuthorized: false },
      { type: 'hide-timer', hidden: true },
    )).rejects.toThrow(/authorization/i)
  })

  it('applies the complete parent control set without leaking private text', async () => {
    const { ports, services } = createLocalDevelopmentStudyPorts({
      now: () => new Date(SYNTHETIC_NOW),
    })
    const controller = new StudyParentController(ports, {
      now: () => new Date(at(10)),
    })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'parent-controls' })
    const auth = { householdRef: scope.householdRef, actorRef: 'adult:synthetic', role: 'parent' as const, adultAuthorized: true }
    const review = (id: string): StudyReviewRecommendation => ({
      recommendationRef: id,
      householdRef: scope.householdRef,
      learnerRef: scope.learnerRef,
      sourceEvidenceRef: `evidence:${id}`,
      lessonRef: entry.lessonRef,
      dueDate: '2026-08-02',
      reasonCodes: ['engine-review-due'],
      status: 'pending-parent',
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })
    await ports.reviewQueue.enqueue(review('review:accept'))
    await ports.reviewQueue.enqueue(review('review:reject'))
    await controller.execute(scope, auth, { type: 'accept-recommendation', recommendationRef: 'review:accept' })
    await controller.execute(scope, auth, { type: 'reject-recommendation', recommendationRef: 'review:reject' })
    await controller.execute(scope, auth, { type: 'set-maximum-duration', minutes: 25 })
    await controller.execute(scope, auth, { type: 'set-break-duration', minutes: 7 })
    await controller.execute(scope, auth, { type: 'hide-timer', hidden: true })
    await controller.execute(scope, auth, {
      type: 'add-accommodation',
      accommodation: {
        accommodationRef: 'accommodation:one',
        functionalDescription: 'Provide shorter written directions.',
        studentMessage: 'You can work through one short direction at a time.',
        timerHidden: true,
      },
    })

    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.completeCurrentSegment(scope, entry.blockRef, entry.segments[0]!.segmentRef, at(2))
    await ports.calendar.pause(scope, entry.blockRef, at(3), 'planned_break')
    await controller.execute(scope, auth, {
      type: 'reschedule-incomplete-work',
      blockRef: entry.blockRef,
      replacementStart: at(86_400),
    })

    const { entry: interruptionEntry } = await createSyntheticMathBlock(ports, { suffix: 'interruption' })
    await ports.calendar.start(scope, interruptionEntry.blockRef, at(4))
    await controller.execute(scope, auth, {
      type: 'mark-interruption',
      blockRef: interruptionEntry.blockRef,
      kind: 'technical',
      occurredAt: at(5),
    })

    const privateCanary = 'PARENT_PRIVATE_BODY_CANARY'
    await controller.execute(scope, auth, {
      type: 'add-adult-private-note',
      noteRef: 'note:parent',
      category: 'instruction',
      body: privateCanary,
    })
    const reviewResult = await controller.execute(scope, auth, {
      type: 'request-adult-review',
      requestRef: 'adult-review:one',
      audience: 'tutor',
      reason: 'Please review the safe evidence.',
      evidenceRefs: [],
    })
    const settings = await ports.parentSettings.read(scope)
    expect(settings).toMatchObject({ maximumWorkMinutes: 25, breakMinutes: 7, timerHidden: true })
    expect(settings.recommendationDecisions).toHaveLength(2)
    expect(settings.accommodations).toHaveLength(1)
    expect(settings.reschedules).toHaveLength(1)
    expect(settings.interruptions).toHaveLength(1)
    expect(settings.adultReviewRequests[0]?.status).toBe('local-only-not-delivered')
    expect(reviewResult.deliveryStatus).toBe('local-only-not-delivered')
    expect(JSON.stringify(services.inspectPublicStateForTest())).not.toContain(privateCanary)
  })
})

import { describe, expect, it } from 'vitest'
import { createLocalDevelopmentStudyPorts } from '../../localDevelopmentPorts'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from '../../testing/syntheticStudyFixtures'
import type { StudyAdultAuthorization, StudyReviewRecommendation } from '../../types'
import { acknowledgeReview, allowResume } from './actions'

const at = (seconds: number) => new Date(SYNTHETIC_NOW.getTime() + seconds * 1000).toISOString()

function authorizationFor(householdRef: string, overrides: Partial<StudyAdultAuthorization> = {}): StudyAdultAuthorization {
  return { householdRef, actorRef: 'adult:synthetic', role: 'parent', adultAuthorized: true, ...overrides }
}

describe('allowResume', () => {
  it('resumes a genuinely paused block and commits a real state change', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'resume-success' })
    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.pause(scope, entry.blockRef, at(2), 'outside_interruption')

    const outcome = await allowResume(ports, authorizationFor(scope.householdRef), scope, entry.blockRef, () => new Date(at(3)))

    expect(outcome).toEqual({ ok: true, message: expect.any(String) })
    const [updated] = (await ports.calendar.list(scope)).filter((candidate) => candidate.blockRef === entry.blockRef)
    expect(updated?.state).toBe('active')
  })

  it('fails cleanly, without throwing, when the block is not currently paused', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'resume-not-paused' })
    // Freshly created blocks start out 'scheduled', never paused.

    const outcome = await allowResume(ports, authorizationFor(scope.householdRef), scope, entry.blockRef)

    expect(outcome.ok).toBe(false)
    const [unchanged] = (await ports.calendar.list(scope)).filter((candidate) => candidate.blockRef === entry.blockRef)
    expect(unchanged?.state).toBe('scheduled')
  })

  it('fails cleanly, without throwing, when the blockRef does not exist', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { scope } = await createSyntheticMathBlock(ports, { suffix: 'resume-unknown-block' })

    const outcome = await allowResume(ports, authorizationFor(scope.householdRef), scope, 'block:does-not-exist')

    expect(outcome.ok).toBe(false)
  })

  it('fails cleanly, without throwing, when the adult is not authorized', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'resume-unauthorized' })
    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.pause(scope, entry.blockRef, at(2), 'outside_interruption')

    const outcome = await allowResume(
      ports,
      authorizationFor(scope.householdRef, { adultAuthorized: false }),
      scope,
      entry.blockRef,
    )

    expect(outcome.ok).toBe(false)
    const [unchanged] = (await ports.calendar.list(scope)).filter((candidate) => candidate.blockRef === entry.blockRef)
    expect(unchanged?.state).toBe('paused')
  })

  it('fails cleanly, without throwing, when the authorization household does not match the scope', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'resume-wrong-household' })
    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.pause(scope, entry.blockRef, at(2), 'outside_interruption')

    const outcome = await allowResume(
      ports,
      authorizationFor('household:some-other-household'),
      scope,
      entry.blockRef,
    )

    expect(outcome.ok).toBe(false)
    const [unchanged] = (await ports.calendar.list(scope)).filter((candidate) => candidate.blockRef === entry.blockRef)
    expect(unchanged?.state).toBe('paused')
  })
})

function pendingReview(scope: { householdRef: string; learnerRef: string }, lessonRef: string, recommendationRef: string): StudyReviewRecommendation {
  return {
    recommendationRef,
    householdRef: scope.householdRef,
    learnerRef: scope.learnerRef,
    sourceEvidenceRef: `evidence:${recommendationRef}`,
    lessonRef,
    dueDate: '2026-08-05',
    reasonCodes: ['engine-review-due'],
    status: 'pending-parent',
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

describe('acknowledgeReview', () => {
  it('accepts a real enqueued recommendation', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'review-accept' })
    await ports.reviewQueue.enqueue(pendingReview(scope, entry.lessonRef, 'recommendation:accept-me'))

    const outcome = await acknowledgeReview(ports, scope, authorizationFor(scope.householdRef), 'recommendation:accept-me', 'accepted')

    expect(outcome).toEqual({ ok: true, message: expect.any(String) })
    const settings = await ports.parentSettings.read(scope)
    expect(settings.recommendationDecisions).toContainEqual(
      expect.objectContaining({ recommendationRef: 'recommendation:accept-me', decision: 'accepted' }),
    )
  })

  it('rejects a real enqueued recommendation', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { entry, scope } = await createSyntheticMathBlock(ports, { suffix: 'review-reject' })
    await ports.reviewQueue.enqueue(pendingReview(scope, entry.lessonRef, 'recommendation:reject-me'))

    const outcome = await acknowledgeReview(ports, scope, authorizationFor(scope.householdRef), 'recommendation:reject-me', 'rejected')

    expect(outcome).toEqual({ ok: true, message: expect.any(String) })
    const settings = await ports.parentSettings.read(scope)
    expect(settings.recommendationDecisions).toContainEqual(
      expect.objectContaining({ recommendationRef: 'recommendation:reject-me', decision: 'rejected' }),
    )
  })

  it('fails cleanly, without throwing, for an unknown recommendationRef', async () => {
    const { ports } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const { scope } = await createSyntheticMathBlock(ports, { suffix: 'review-unknown' })

    const outcome = await acknowledgeReview(ports, scope, authorizationFor(scope.householdRef), 'recommendation:does-not-exist', 'accepted')

    expect(outcome.ok).toBe(false)
  })
})

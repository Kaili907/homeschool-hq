import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StudyParentPanel } from '../components/hub/StudyParentPanel'
import { StudyDashboard } from '../components/study/StudyDashboard'
import { StudySettings } from '../components/study/StudySettings'
import { ensureLocalDevelopmentStudyDay } from './calendarAdapter'
import { syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import { StudyParentController } from './parentController'
import { createSyntheticMathBlock, SYNTHETIC_NOW } from './testing/syntheticStudyFixtures'
import type { StudyReviewRecommendation } from './types'

/**
 * Every narrow object below is an ordinary literal carrying only the methods the
 * surface under test genuinely calls. Nothing is cast, so TypeScript — not a
 * string search — decides whether a consumer's declared contract is honest, and
 * any call to an omitted method is a runtime TypeError rather than a silent pass.
 */
const context = syntheticGrade5StudyContext('math')
const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
const at = (seconds: number) => new Date(SYNTHETIC_NOW.getTime() + seconds * 1000).toISOString()

describe('Study consumer port contracts are no broader than the behavior they support', () => {
  it('drives the whole StudyDashboard data path with calendar.list, calendar.create, and reviewQueue.list alone', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const dashboardPorts = {
      calendar: {
        list: ports.calendar.list.bind(ports.calendar),
        create: ports.calendar.create.bind(ports.calendar),
      },
      reviewQueue: { list: ports.reviewQueue.list.bind(ports.reviewQueue) },
    }

    // The exact effect body of StudyDashboard: preview seeding, then the two reads.
    await ensureLocalDevelopmentStudyDay({
      scope,
      grade: context.grade,
      householdTimeZone: context.householdTimeZone,
      calendar: dashboardPorts.calendar,
      timerHidden: context.timerPreference.visibility === 'hidden',
      now: SYNTHETIC_NOW,
    })
    const [blocks, reviews] = await Promise.all([
      dashboardPorts.calendar.list(scope),
      dashboardPorts.reviewQueue.list(scope),
    ])
    expect(blocks).toHaveLength(2)
    expect(reviews).toEqual([])

    const html = renderToStaticMarkup(
      <StudyDashboard context={context} ports={dashboardPorts} onLaunch={() => {}} onSettings={() => {}} onBack={() => {}} />,
    )
    expect(html).toContain('study-runtime-host')
  })

  it('drives the whole StudySettings data path with persistence.loadPreferences and savePreferences alone', async () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const settingsPorts = {
      persistence: {
        loadPreferences: ports.persistence.loadPreferences.bind(ports.persistence),
        savePreferences: ports.persistence.savePreferences.bind(ports.persistence),
      },
    }

    const loaded = await settingsPorts.persistence.loadPreferences(scope)
    await settingsPorts.persistence.savePreferences(scope, {
      ...loaded,
      accessibility: { ...loaded.accessibility, largeText: true },
    })
    expect((await settingsPorts.persistence.loadPreferences(scope)).accessibility.largeText).toBe(true)

    const html = renderToStaticMarkup(<StudySettings context={context} ports={settingsPorts} onBack={() => {}} />)
    expect(html).toContain('Learner Study settings')
  })

  it('executes every parent control with no persistence, checkpoint, eventLedger, or safety port present', async () => {
    const { ports, services } = createLocalDevelopmentStudyPorts({ now: () => new Date(SYNTHETIC_NOW) })
    const parentPorts = {
      calendar: {
        list: ports.calendar.list.bind(ports.calendar),
        pause: ports.calendar.pause.bind(ports.calendar),
        createContinuation: ports.calendar.createContinuation.bind(ports.calendar),
      },
      reviewQueue: {
        list: ports.reviewQueue.list.bind(ports.reviewQueue),
        decide: ports.reviewQueue.decide.bind(ports.reviewQueue),
      },
      parentSettings: {
        read: ports.parentSettings.read.bind(ports.parentSettings),
        apply: ports.parentSettings.apply.bind(ports.parentSettings),
      },
      adultPrivate: { commit: ports.adultPrivate.commit.bind(ports.adultPrivate) },
      outbox: { propose: ports.outbox.propose.bind(ports.outbox) },
    }
    const controller = new StudyParentController(parentPorts, { now: () => new Date(at(10)) })

    // Setup uses the full preview bundle; only the assertions below run through parentPorts.
    const { entry } = await createSyntheticMathBlock(ports, { suffix: 'contract-split' })
    const auth = { householdRef: scope.householdRef, actorRef: 'adult:contract', role: 'parent' as const, adultAuthorized: true }
    const review: StudyReviewRecommendation = {
      recommendationRef: 'review:contract',
      householdRef: scope.householdRef,
      learnerRef: scope.learnerRef,
      sourceEvidenceRef: 'evidence:contract',
      lessonRef: entry.lessonRef,
      dueDate: '2026-08-02',
      reasonCodes: ['engine-review-due'],
      status: 'pending-parent',
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await ports.reviewQueue.enqueue(review)
    await controller.execute(scope, auth, { type: 'accept-recommendation', recommendationRef: 'review:contract' })
    await controller.execute(scope, auth, { type: 'set-maximum-duration', minutes: 25 })
    await controller.execute(scope, auth, { type: 'hide-timer', hidden: true })

    await ports.calendar.start(scope, entry.blockRef, at(1))
    await ports.calendar.completeCurrentSegment(scope, entry.blockRef, entry.segments[0]!.segmentRef, at(2))
    await ports.calendar.pause(scope, entry.blockRef, at(3), 'planned_break')
    await controller.execute(scope, auth, {
      type: 'reschedule-incomplete-work',
      blockRef: entry.blockRef,
      replacementStart: at(86_400),
    })

    const { entry: interrupted } = await createSyntheticMathBlock(ports, { suffix: 'contract-interruption' })
    await ports.calendar.start(scope, interrupted.blockRef, at(4))
    await controller.execute(scope, auth, {
      type: 'mark-interruption',
      blockRef: interrupted.blockRef,
      kind: 'technical',
      occurredAt: at(5),
    })

    const privateCanary = 'CONTRACT_SPLIT_PRIVATE_CANARY'
    await controller.execute(scope, auth, {
      type: 'add-adult-private-note',
      noteRef: 'note:contract',
      category: 'instruction',
      body: privateCanary,
    })
    const reviewResult = await controller.execute(scope, auth, {
      type: 'request-adult-review',
      requestRef: 'adult-review:contract',
      audience: 'tutor',
      reason: 'Please review the safe evidence.',
      evidenceRefs: [],
    })

    const settings = await parentPorts.parentSettings.read(scope)
    expect(settings).toMatchObject({ maximumWorkMinutes: 25, timerHidden: true })
    expect(settings.recommendationDecisions).toHaveLength(1)
    expect(settings.reschedules).toHaveLength(1)
    expect(settings.interruptions).toHaveLength(1)
    expect(reviewResult.deliveryStatus).toBe('local-only-not-delivered')
    expect(JSON.stringify(services.inspectPublicStateForTest())).not.toContain(privateCanary)

    const html = renderToStaticMarkup(
      <StudyParentPanel
        householdRef={scope.householdRef}
        learners={[{ hostProfileRef: context.hostProfileRef, learnerRef: scope.learnerRef, displayName: 'Synthetic learner' }]}
        ports={parentPorts}
        authorization={auth}
      />,
    )
    expect(html).toContain('Study Engine evidence and controls')
  })

  it('keeps adult-private, outbox, and parent-settings ports out of the learner-facing contracts', () => {
    const { ports } = createLocalDevelopmentStudyPorts()
    const dashboardPorts = {
      calendar: {
        list: ports.calendar.list.bind(ports.calendar),
        create: ports.calendar.create.bind(ports.calendar),
      },
      reviewQueue: { list: ports.reviewQueue.list.bind(ports.reviewQueue) },
    }
    const settingsPorts = {
      persistence: {
        loadPreferences: ports.persistence.loadPreferences.bind(ports.persistence),
        savePreferences: ports.persistence.savePreferences.bind(ports.persistence),
      },
    }

    const dashboard: React.ComponentProps<typeof StudyDashboard>['ports'] = dashboardPorts
    const settings: React.ComponentProps<typeof StudySettings>['ports'] = settingsPorts
    // @ts-expect-error a learner dashboard must never be handed the adult-private port
    void dashboard.adultPrivate
    // @ts-expect-error a learner dashboard must never be handed the undelivered-outbox port
    void dashboard.outbox
    // @ts-expect-error a learner dashboard must never be handed parent-settings authority
    void dashboard.parentSettings
    // @ts-expect-error learner settings must never be handed the adult-private port
    void settings.adultPrivate
    // @ts-expect-error learner settings must never be handed the undelivered-outbox port
    void settings.outbox
    expect(typeof dashboard.calendar.list).toBe('function')
    expect(typeof settings.persistence.loadPreferences).toBe('function')
  })
})

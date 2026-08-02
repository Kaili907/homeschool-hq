import { describe, expect, it } from 'vitest'
import { SESSION_12_DEMONSTRATIONS, syntheticGrade5StudyContext } from './demonstrations'
import { createLocalDevelopmentStudyPorts } from './localDevelopmentPorts'
import { adaptHostLessonToStudyPlan } from './curriculumAdapter'
import { calendarDraftForPlan } from './calendarAdapter'
import { approvedJarvisPresentation } from './jarvisAdapter'

describe('Session 12 required local demonstrations', () => {
  it('registers ten unique required demonstrations using synthetic Grade 5 learners', () => {
    expect(SESSION_12_DEMONSTRATIONS).toHaveLength(10)
    expect(new Set(SESSION_12_DEMONSTRATIONS).size).toBe(10)
    expect(syntheticGrade5StudyContext('math')).toMatchObject({ grade: 5, learnerRef: 'learner:synthetic-grade5-math' })
    expect(syntheticGrade5StudyContext('reading')).toMatchObject({ grade: 5, learnerRef: 'learner:synthetic-grade5-reading' })
  })

  it('creates math and reading Study plans without widening the host Profile grade union', () => {
    const math = adaptHostLessonToStudyPlan({ lessonRef: 'demo:grade5:math', title: 'Grade 5 math', kind: 'math', skillRefs: ['skill:math'] })
    const reading = adaptHostLessonToStudyPlan({ lessonRef: 'demo:grade5:reading', title: 'Grade 5 reading', kind: 'reading', skillRefs: ['skill:reading'] })
    expect(math.subject).toBe('math')
    expect(reading.subject).toBe('reading')
    expect(math.masteryAuthority).toBe('tutor-core')
    expect(reading.masteryAuthority).toBe('tutor-core')
  })

  it('projects a review recommendation onto the canonical calendar adapter', async () => {
    const context = syntheticGrade5StudyContext('math')
    const { ports } = createLocalDevelopmentStudyPorts()
    const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
    const reviewPlan = adaptHostLessonToStudyPlan({
      lessonRef: 'demo:grade5:review',
      title: 'Recommended review',
      kind: 'review',
      skillRefs: ['skill:review'],
    })
    const draft = calendarDraftForPlan({
      scope,
      plan: reviewPlan,
      householdTimeZone: context.householdTimeZone,
      instant: new Date('2026-08-02T13:00:00.000Z'),
      timerHidden: false,
    })
    const entry = await ports.calendar.create(scope, { ...draft, blockKind: 'review' })
    await ports.reviewQueue.enqueue({
      recommendationRef: 'review:demo',
      householdRef: scope.householdRef,
      learnerRef: scope.learnerRef,
      sourceEvidenceRef: 'evidence:demo',
      lessonRef: reviewPlan.lessonRef,
      dueDate: '2026-08-02',
      reasonCodes: ['engine-review-due'],
      status: 'pending-parent',
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    })
    expect(entry.blockKind).toBe('review')
    expect(await ports.reviewQueue.list(scope)).toHaveLength(1)
  })

  it('supports hidden timer plus missing voice and media without blocking text learning', () => {
    const presentation = approvedJarvisPresentation('Continue with the visible example.', { noAudio: true, mediaAvailable: false })
    expect(presentation.audioText).toBeNull()
    expect(presentation.lessonMayContinueWithoutMedia).toBe(true)
    expect(presentation.captionsAlwaysVisible).toBe(true)
  })
})

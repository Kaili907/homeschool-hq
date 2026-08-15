import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import type { AcademyCatalog } from '../academy/contentTypes'
import type { StudyCalendarEntry, StudyParentSettings, StudyReviewRecommendation } from '../study/types'
import type { Profile } from '../types'
import {
  buildLearnerAnalyticsSnapshot,
  LEARNER_ANALYTICS_LIMITS,
  loadLearnerAnalytics,
  type LearnerAnalyticsReadSource,
  type StudyLearnerEvidenceState,
} from './learnerAnalyticsModel'

const TODAY = '2026-09-09'

function catalog(): AcademyCatalog {
  return {
    releaseVersion: '1.0.0',
    grade: '5',
    courses: [{
      courseId: 'ma-g5-mathematics',
      subject: 'mathematics',
      lessonCount: 2,
      units: [{
        unitId: 'ma-g5-mathematics-u01',
        unitNumber: 1,
        title: 'Whole Numbers',
        days: 2,
        essentialQuestion: 'How do numbers work?',
        performanceTask: 'Solve problems',
        lessonIds: ['lesson-1', 'lesson-2'],
        hasAssessment: true,
      }],
    }],
  }
}

function calendarEntry(state: StudyCalendarEntry['state']): StudyCalendarEntry {
  return {
    blockRef: `block-${state}`,
    externalItemRef: `external-${state}`,
    learnerRef: 'learner-1',
    title: `Study ${state}`,
    lessonRef: `lesson-${state}`,
    subject: 'math',
    skillRefs: ['multiplication'],
    source: 'manuel-academy',
    masteryAuthority: 'tutor-core',
    blockKind: 'guided_practice',
    scheduledStart: `2026-09-09T1${state.length}:00:00.000Z`,
    intendedLocalDate: TODAY,
    householdTimeZone: 'America/New_York',
    timerVisibility: 'shown',
    state,
    segments: [],
    completedSegmentRefs: [],
    requiredWorkCompletionPercent: state === 'completed' ? 100 : state === 'paused' ? 40 : 0,
    estimatedRemainingMinutes: state === 'paused' ? 12 : 0,
  }
}

const settings: StudyParentSettings = {
  maximumWorkMinutes: 30,
  breakMinutes: 5,
  timerHidden: false,
  accommodations: [],
  recommendationDecisions: [],
  interruptions: [],
  reschedules: [],
  adultReviewRequests: [{
    requestRef: 'request-1',
    audience: 'teacher',
    status: 'local-only-not-delivered',
    reason: 'PRIVATE REQUEST BODY MUST NOT RENDER',
  }],
  revision: 1,
}

const review: StudyReviewRecommendation = {
  recommendationRef: 'review-1',
  householdRef: 'household-1',
  learnerRef: 'learner-1',
  sourceEvidenceRef: 'evidence-1',
  lessonRef: 'lesson-1',
  dueDate: '2026-09-10',
  reasonCodes: ['spaced-review'],
  status: 'pending-parent',
  rawAnswerIncluded: false,
  transcriptIncluded: false,
}

function study(): StudyLearnerEvidenceState {
  return {
    status: 'available',
    evidence: {
      calendar: [calendarEntry('scheduled'), calendarEntry('completed'), calendarEntry('paused')],
      reviews: [review],
      settings,
    },
  }
}

function populated(): Profile {
  const profile = emptyProfile('learner-1', 'Ada', '6')
  profile.workingLevels = { mathematics: '5' }
  profile.missions[TODAY] = { items: [{ id: 'one', label: 'One', done: true }, { id: 'two', label: 'Two', done: false }] }
  profile.attendance = { log: [{ date: '2026-09-08', hours: 4 }, { date: TODAY, hours: 3.5 }] }
  profile.skills.ratio6 = { attempts: 8, correct: 7, mastery: 82, lastSeen: TODAY }
  profile.skills.percent6 = { attempts: 3, correct: 1, mastery: 40, lastSeen: '2026-09-08' }
  profile.tutorFlags = { ratio6: { since: TODAY, reason: 'RAW TUTOR FLAG REASON MUST NOT RENDER', sessionCount: 3, weekCount: 3 } }
  profile.academy = {
    releaseVersion: '1.0.0',
    grade: '5',
    enrolledAt: '2026-09-01T12:00:00.000Z',
    courseIds: ['ma-g5-mathematics'],
    lessons: {
      'lesson-1': {
        status: 'complete',
        segmentIndex: 2,
        releaseVersion: '1.0.0',
        startedAt: '2026-09-07T12:00:00.000Z',
        completedAt: '2026-09-08T12:00:00.000Z',
        occasions: [
          { date: '2026-09-07', mode: 'guided', met: true, kind: 'lesson-check' },
          { date: '2026-09-08', mode: 'independent', met: true, kind: 'reassessment' },
        ],
      },
      'lesson-2': {
        status: 'reteach',
        segmentIndex: 1,
        releaseVersion: '1.0.0',
        startedAt: '2026-09-09T12:00:00.000Z',
        occasions: [{ date: TODAY, mode: 'independent', met: false, kind: 'lesson-check' }],
      },
    },
    assessments: {
      'ma-g5-mathematics-u01-assessment': [{ date: TODAY, percent: 88, outcome: 'secure' }],
    },
  }
  profile.assessments = {
    assigned: [{ testId: 'hs-math-diagnostic', startCode: '1234', assignedAt: '2026-09-01T12:00:00.000Z' }],
    attempts: [{
      testId: 'hs-math-diagnostic',
      profileId: profile.id,
      startedAt: '2026-09-02T12:00:00.000Z',
      finishedAt: '2026-09-02T13:00:00.000Z',
      answers: { secret: { value: 'RAW ASSESSMENT ANSWER', skipped: false, msOnItem: 1 } },
      autoScore: { bySection: { Numbers: { correct: 8, of: 10 } }, gradedItems: 1, skips: 0 },
    }],
    retakeUnlocked: ['hs-math-diagnostic'],
  }
  profile.masterySnapshots = [{ at: '2026-09-07T09:00:00.000Z', subject: 'Spelling', level: 76, note: 'PRIVATE SNAPSHOT NOTE' }]
  return profile
}

describe('learner analytics projection', () => {
  it('builds the learner list and detail from trusted profile evidence', () => {
    const snapshot = buildLearnerAnalyticsSnapshot({
      profiles: [populated()],
      today: TODAY,
      observedAt: '2026-09-09T18:00:00.000Z',
      academyCatalogs: [catalog()],
      studyByProfile: { 'learner-1': study() },
    })

    expect(snapshot.learners).toHaveLength(1)
    expect(snapshot.learners[0]).toMatchObject({
      displayName: 'Ada', nominalGrade: '6', needsDadCount: 1, openReviewCount: 3,
      curriculum: {
        status: 'available', releaseVersion: '1.0.0', grade: '5',
        enrolledCourseCount: 1, matchedCourseCount: 1,
      },
    })
    expect(snapshot.learners[0].todayCompletion).toEqual({ status: 'available', value: { completed: 1, total: 2, percent: 50, complete: false } })
    expect(snapshot.learners[0].attendance).toEqual({ recordedToday: true, instructionalDaysYtd: 2, instructionalHoursYtd: 7.5 })

    const detail = snapshot.details['learner-1']
    expect(detail.curriculum).toMatchObject({ status: 'available', releaseVersion: '1.0.0', enrolledAt: '2026-09-01T12:00:00.000Z' })
    expect(detail.availability).toEqual({
      overview: 'available', curriculum: 'available', progress: 'available',
      assessments: 'available', study: 'available', operationalStatus: 'partial',
    })
    expect(detail.courses).toMatchObject({ status: 'available', value: [{ title: 'Grade 5 Mathematics', subject: 'mathematics', workingLevel: '5', completed: 1, total: 2, mastered: 1, reteach: 1 }] })
    expect(detail.mathMastery.find((skill) => skill.skillRef === 'ratio6')).toMatchObject({ mastery: 82, status: 'mastered' })
    expect(detail.attendance.recentDays).toHaveLength(2)
    expect(detail.interventions.needsDad[0]).toMatchObject({ skillName: 'Ratios & Rates', supportSignal: 'repeated-walkthroughs' })
  })

  it('keeps real zero progress distinct from unavailable optional integrations', () => {
    const zero = emptyProfile('zero', 'Zero', '6')
    zero.missions[TODAY] = { items: [{ id: 'one', label: 'One', done: false }] }
    const snapshot = buildLearnerAnalyticsSnapshot({ profiles: [zero], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z` })
    const row = snapshot.learners[0]
    expect(row.todayCompletion).toEqual({ status: 'available', value: { completed: 0, total: 1, percent: 0, complete: false } })
    expect(row.attendance).toEqual({ recordedToday: false, instructionalDaysYtd: 0, instructionalHoursYtd: 0 })
    expect(row.mastery).toMatchObject({ status: 'available', value: { mastered: 0, developing: 0, notStarted: 11, total: 11 } })
    expect(row.study).toEqual({ status: 'unavailable', reason: 'study-not-integrated' })
    expect(row.curriculum).toEqual({ status: 'not-configured' })
    expect(snapshot.details.zero.availability).toMatchObject({ curriculum: 'not-configured', assessments: 'not-configured', study: 'unavailable' })
    expect(snapshot.details.zero.assessments).toEqual([])
  })

  it('preserves the authoritative release pin while marking an incomplete catalog match partial', () => {
    const profile = populated()
    profile.academy!.courseIds.push('release-course-not-loaded')
    const snapshot = buildLearnerAnalyticsSnapshot({
      profiles: [profile], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z`, academyCatalogs: [catalog()],
    })
    expect(snapshot.learners[0].curriculum).toEqual({
      status: 'partial', releaseVersion: '1.0.0', grade: '5',
      enrolledAt: '2026-09-01T12:00:00.000Z', enrolledCourseCount: 2, matchedCourseCount: 1,
    })
    expect(snapshot.details['learner-1'].courses).toMatchObject({
      status: 'partial', reason: 'catalog-partially-integrated', value: [expect.objectContaining({ courseRef: 'ma-g5-mathematics' })],
    })
    expect(snapshot.details['learner-1'].availability).toMatchObject({ curriculum: 'partial', progress: 'partial', study: 'unavailable' })
  })

  it('does not calculate Academy progress against a different curriculum release', () => {
    const profile = populated()
    profile.academy!.releaseVersion = '0.9.0'
    const snapshot = buildLearnerAnalyticsSnapshot({
      profiles: [profile], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z`, academyCatalogs: [catalog()],
    })
    expect(snapshot.details['learner-1'].curriculum).toMatchObject({
      status: 'partial', releaseVersion: '0.9.0', enrolledCourseCount: 1, matchedCourseCount: 0,
    })
    expect(snapshot.details['learner-1'].courses).toEqual({
      status: 'partial', value: [], reason: 'catalog-partially-integrated',
    })
  })

  it('reports enrolled Academy content with no lesson state as real zero mastery', () => {
    const zero = emptyProfile('academy-zero', 'Academy Zero', '5')
    zero.academy = {
      releaseVersion: '1.0.0', grade: '5', enrolledAt: '2026-09-01T12:00:00.000Z',
      courseIds: ['ma-g5-mathematics'], lessons: {}, assessments: {},
    }
    const snapshot = buildLearnerAnalyticsSnapshot({ profiles: [zero], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z`, academyCatalogs: [catalog()] })
    expect(snapshot.learners[0].mastery).toEqual({ status: 'available', value: { mastered: 0, developing: 0, notStarted: 2, total: 2 } })
    expect(snapshot.details['academy-zero'].courses).toMatchObject({ status: 'available', value: [{ completed: 0, total: 2, mastered: 0, reteach: 0 }] })
    expect(snapshot.details['academy-zero'].curriculum).toMatchObject({ status: 'available', releaseVersion: '1.0.0' })
  })

  it('keeps an available empty Study feed distinct from missing work-block settings', () => {
    const profile = emptyProfile('study-zero', 'Study Zero', '6')
    const snapshot = buildLearnerAnalyticsSnapshot({
      profiles: [profile], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z`,
      studyByProfile: { 'study-zero': { status: 'available', evidence: { calendar: [], reviews: [], settings: null } } },
    })
    expect(snapshot.learners[0].study).toEqual({ status: 'available', value: { scheduled: 0, completed: 0, resumeNeeded: 0, active: 0, pendingReviews: 0 } })
    expect(snapshot.details['study-zero'].study).toMatchObject({ status: 'available', value: { workBlock: null, calendar: [] } })
  })

  it('shows assessment score/mastery, retake, and Study evidence without answers or request text', () => {
    const snapshot = buildLearnerAnalyticsSnapshot({
      profiles: [populated()], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z`, academyCatalogs: [catalog()], studyByProfile: { 'learner-1': study() },
    })
    const detail = snapshot.details['learner-1']
    expect(detail.assessments).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'fixed-assessment', status: 'completed', percent: 80, retakeStatus: 'ready', requiresAdultScoring: true }),
      expect.objectContaining({ source: 'academy', status: 'completed', percent: 88, masteryOutcome: 'secure', retakeStatus: 'unavailable' }),
    ]))
    expect(detail.study).toMatchObject({ status: 'available', value: { summary: { scheduled: 1, completed: 1, resumeNeeded: 1, pendingReviews: 1 }, workBlock: { maximumWorkMinutes: 30, breakMinutes: 5 } } })
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('RAW ASSESSMENT ANSWER')
    expect(serialized).not.toContain('PRIVATE REQUEST BODY MUST NOT RENDER')
  })

  it('never projects private journal, raw conversations, flag reasons, snapshot notes, or fabricated operational metrics', () => {
    const profile = populated() as Profile & { privateJournalText: string }
    profile.privateJournalText = 'PRIVATE JOURNAL CONTENT'
    profile.tutorChats = [{
      id: 'chat-1', skillId: 'ratio6', grade: '6', day: TODAY, startedTs: 1,
      problem: 'RAW PROBLEM', correctAnswer: 'RAW KEY', herAnswer: 'RAW LEARNER ANSWER',
      messages: [{ role: 'kid', text: 'RAW TUTOR CONVERSATION', ts: 1 }],
    }]
    profile.assistant = { calls: [], sessions: [{ id: 'assistant-1', day: TODAY, startedTs: 1, messages: [{ role: 'girl', text: 'RAW STUDY CONVERSATION', ts: 1 }] }] }
    const snapshot = buildLearnerAnalyticsSnapshot({ profiles: [profile], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z` })
    const serialized = JSON.stringify(snapshot)
    for (const prohibited of ['PRIVATE JOURNAL CONTENT', 'RAW TUTOR CONVERSATION', 'RAW STUDY CONVERSATION', 'RAW TUTOR FLAG REASON MUST NOT RENDER', 'PRIVATE SNAPSHOT NOTE', 'RAW PROBLEM', 'RAW KEY', 'RAW LEARNER ANSWER']) {
      expect(serialized).not.toContain(prohibited)
    }
    expect(snapshot.details['learner-1'].futureIntegrations).toEqual({
      operationalTelemetry: { status: 'unavailable', reason: 'future-integration' },
      aiCost: { status: 'unavailable', reason: 'future-integration' },
    })
    expect(serialized).not.toMatch(/inputTokens|outputTokens|tokenUsage|costMicros/)
  })

  it('bounds expandable collections and normalizes the safe display label', () => {
    const profile = emptyProfile('p1', `  Ada\u0000  ${'A'.repeat(200)}  `, '6')
    profile.courses = Array.from({ length: 50 }, (_, index) => ({
      id: `course-${index}`, name: `Course ${index}`, units: [],
    }))
    profile.masterySnapshots = Array.from({ length: 50 }, (_, index) => ({
      at: `2026-09-09T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      subject: `Subject ${index}`,
      level: index,
    }))
    profile.attendance = {
      log: Array.from({ length: 50 }, (_, index) => ({
        date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
        hours: 1,
      })),
    }
    profile.assessments = {
      assigned: Array.from({ length: 50 }, (_, index) => ({
        testId: `assessment-${index}`,
        startCode: `private-${index}`,
        assignedAt: `2026-09-09T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      })),
      attempts: [],
    }
    const profiles = [
      profile,
      ...Array.from(
        { length: LEARNER_ANALYTICS_LIMITS.learners + 5 },
        (_, index) => emptyProfile(`extra-${index}`, `Extra ${index}`, '6'),
      ),
    ]
    const snapshot = buildLearnerAnalyticsSnapshot({ profiles, today: TODAY, observedAt: `${TODAY}T12:00:00.000Z` })
    expect(snapshot.learners).toHaveLength(LEARNER_ANALYTICS_LIMITS.learners)
    expect(snapshot.learners[0].displayName).not.toMatch(/[\u0000-\u001f\u007f]/u)
    expect(snapshot.learners[0].displayName.length).toBeLessThanOrEqual(120)
    expect(snapshot.details.p1.courses).toMatchObject({ status: 'available', value: expect.any(Array) })
    if (snapshot.details.p1.courses.status === 'available') {
      expect(snapshot.details.p1.courses.value).toHaveLength(32)
    }
    expect(snapshot.details.p1.manualMasterySnapshots).toHaveLength(30)
    expect(snapshot.details.p1.assessments).toHaveLength(32)
    expect(snapshot.details.p1.recentEvidence.length).toBeLessThanOrEqual(12)
    expect(snapshot.details.p1.attendance.recentDays).toHaveLength(10)
    expect(JSON.stringify(snapshot)).not.toContain('private-49')
  })
})

describe('canonical learner read boundary', () => {
  it('does not call the source while authorization resolves or lacks learners:read', async () => {
    const read = vi.fn<LearnerAnalyticsReadSource['read']>()
    const source: LearnerAnalyticsReadSource = { read }
    await expect(loadLearnerAnalytics({ status: 'resolving' }, source, TODAY)).resolves.toEqual({ status: 'resolving' })
    await expect(loadLearnerAnalytics({ status: 'authorized', capabilities: ['overview:read'] }, source, TODAY)).resolves.toEqual({ status: 'unauthorized', reasonCode: 'learners_read_required' })
    expect(read).not.toHaveBeenCalled()
  })

  it('loads only through learners:read and fails closed on a source error', async () => {
    const snapshot = buildLearnerAnalyticsSnapshot({ profiles: [], today: TODAY, observedAt: `${TODAY}T12:00:00.000Z` })
    const source: LearnerAnalyticsReadSource = { read: vi.fn().mockResolvedValue(snapshot) }
    await expect(loadLearnerAnalytics({ status: 'authorized', capabilities: ['learners:read'] }, source, TODAY)).resolves.toEqual({ status: 'ready', snapshot })
    expect(source.read).toHaveBeenCalledWith({ capability: 'learners:read', today: TODAY })
    await expect(loadLearnerAnalytics({ status: 'authorized', capabilities: ['learners:read'] }, { read: vi.fn().mockRejectedValue(new Error('private')) }, TODAY)).resolves.toEqual({ status: 'error', message: 'Learner evidence could not be loaded safely.' })
  })
})

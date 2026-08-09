import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../../../src/migration.ts'
import { LEARNER_ANALYTICS_LIMITS } from '../../../src/admin/learnerAnalyticsModel.ts'
import {
  AdminLearnerProjectionError,
  createAdminLearnerReader,
} from './admin-learner-reader.js'

const NOW = new Date('2026-09-09T18:00:00.000Z')

function catalog() {
  return {
    source: { packageId: 'manuel-academy', version: '1.0.0', authoredOn: '2026-08-01', status: 'published', lifecycle: 'published', validationStatus: 'passed' },
    grades: [5],
    courses: [{ courseId: 'ma-g5-mathematics', grade: 5, subject: 'mathematics', title: 'Grade 5 Mathematics', days: 180 }],
    units: [{ unitId: 'unit-1', courseId: 'ma-g5-mathematics', grade: 5, subject: 'mathematics', unitNumber: 1, title: 'Whole Numbers', days: 2, standards: [], topics: [], lessonIds: ['lesson-1'], assessmentId: 'assessment-1' }],
    lessons: [], assessments: [],
  }
}

function learner(id = 'p1', name = 'Ada') {
  const profile = emptyProfile(id, name, '6')
  profile.missions['2026-09-09'] = { items: [{ id: 'one', label: 'One', done: true }] }
  profile.attendance = { log: [{ date: '2026-09-09', hours: 3.5 }] }
  profile.skills.ratio6 = { attempts: 4, correct: 3, mastery: 75, lastSeen: '2026-09-09' }
  profile.tutorFlags = { ratio6: { since: '2026-09-09', reason: 'PRIVATE FLAG REASON', sessionCount: 3, weekCount: 2 } }
  profile.assessments = {
    assigned: [{ testId: 'hs-math-diagnostic', startCode: 'SECRET START CODE', assignedAt: '2026-09-01T12:00:00.000Z' }],
    attempts: [{
      testId: 'hs-math-diagnostic', profileId: id,
      startedAt: '2026-09-02T12:00:00.000Z', finishedAt: '2026-09-02T13:00:00.000Z',
      answers: { secret: { value: 'PRIVATE ASSESSMENT ANSWER', skipped: false, msOnItem: 1 } },
      autoScore: { bySection: { Numbers: { correct: 8, of: 10 } }, gradedItems: 1, skips: 0 },
    }],
  }
  profile.tutorChats = [{
    id: 'chat-1', skillId: 'ratio6', grade: '6', day: '2026-09-09', startedTs: 1,
    problem: 'PRIVATE PROBLEM', correctAnswer: 'PRIVATE KEY', herAnswer: 'PRIVATE ANSWER',
    messages: [{ role: 'kid', text: 'PRIVATE TUTOR TRANSCRIPT', ts: 1 }],
  }]
  profile.assistant = { calls: [], sessions: [{ id: 'assistant-1', day: '2026-09-09', startedTs: 1, messages: [{ role: 'girl', text: 'PRIVATE STUDY TRANSCRIPT', ts: 1 }] }] }
  return profile
}

function row(profile) {
  return { profile_id: profile.id, data: profile, updated_at: '2026-09-09T17:00:00.000Z' }
}

function queryClient(result) {
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    abortSignal: vi.fn(async () => result),
  }
  return { client: { from: vi.fn(() => builder) }, builder }
}

function readerFor(factory) {
  return createAdminLearnerReader({
    clientFactory: factory,
    catalogSource: { loadCatalog: async () => catalog() },
    clock: () => NOW,
  })
}

describe('authorized household learner projection reader', () => {
  it('uses the pinned bearer with RLS, validates rows, and returns minimized real evidence', async () => {
    const { client, builder } = queryClient({ data: [row(learner())], error: null })
    const clientFactory = vi.fn(() => client)
    const snapshot = await readerFor(clientFactory).readSnapshot({ accessToken: 'verified.household.token' })

    expect(clientFactory).toHaveBeenCalledWith('verified.household.token')
    expect(client.from).toHaveBeenCalledWith('profiles')
    expect(builder.select).toHaveBeenCalledWith('profile_id,data,updated_at')
    expect(builder.limit).toHaveBeenCalledWith(LEARNER_ANALYTICS_LIMITS.learners + 1)
    expect(snapshot.learners[0]).toMatchObject({ learnerRef: 'p1', displayName: 'Ada', needsDadCount: 1 })
    expect(snapshot.learners[0].attendance).toEqual({ recordedToday: true, instructionalDaysYtd: 1, instructionalHoursYtd: 3.5 })
    expect(snapshot.details.p1.assessments[0]).toMatchObject({ percent: 80, requiresAdultScoring: true })
    expect(snapshot.details.p1.study).toEqual({ status: 'unavailable', reason: 'study-not-integrated' })

    const serialized = JSON.stringify(snapshot)
    for (const prohibited of [
      'PRIVATE FLAG REASON', 'SECRET START CODE', 'PRIVATE ASSESSMENT ANSWER',
      'PRIVATE PROBLEM', 'PRIVATE KEY', 'PRIVATE TUTOR TRANSCRIPT', 'PRIVATE STUDY TRANSCRIPT',
    ]) expect(serialized).not.toContain(prohibited)
    expect(serialized).not.toMatch(/costMicros|learnerCost/)
  })

  it('derives household scope from each bearer and cannot select another household', async () => {
    const householdA = queryClient({ data: [row(learner('p1', 'Household A'))], error: null }).client
    const householdB = queryClient({ data: [row(learner('p2', 'Household B'))], error: null }).client
    const factory = vi.fn((token) => token === 'token-a' ? householdA : householdB)
    const reader = readerFor(factory)

    await expect(reader.readDetail({ accessToken: 'token-a', learnerRef: 'p1', householdId: 'forged' })).resolves.toMatchObject({ detail: { displayName: 'Household A' } })
    await expect(reader.readDetail({ accessToken: 'token-a', learnerRef: 'p2' })).rejects.toMatchObject({ code: 'learner_not_found' })
    await expect(reader.readDetail({ accessToken: 'token-b', learnerRef: 'p2' })).resolves.toMatchObject({ detail: { displayName: 'Household B' } })
  })

  it('fails closed for malformed, oversized, uncertain, or unpinned reads', async () => {
    const cases = [
      { data: [{ profile_id: 'p1', data: { name: 'malformed' }, updated_at: 'now' }], error: null },
      { data: Array.from({ length: 6 }, () => row(learner())), error: null },
      { data: null, error: { message: 'private database error' } },
    ]
    for (const result of cases) {
      const { client } = queryClient(result)
      await expect(readerFor(() => client).readSnapshot({ accessToken: 'token' })).rejects.toEqual(new AdminLearnerProjectionError('learner_source_unavailable'))
    }
    await expect(readerFor(() => queryClient({ data: [], error: null }).client).readSnapshot({ accessToken: '' })).rejects.toMatchObject({ code: 'authorization_unavailable' })
  })

  it('bounds every expandable projection collection', async () => {
    const profile = learner()
    profile.masterySnapshots = Array.from({ length: 100 }, (_, index) => ({ at: `2026-09-${String((index % 9) + 1).padStart(2, '0')}T12:00:00.000Z`, subject: `Subject ${index}`, level: index }))
    profile.attendance = { log: Array.from({ length: 100 }, (_, index) => ({ date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`, hours: 1 })) }
    const { client } = queryClient({ data: [row(profile)], error: null })
    const snapshot = await readerFor(() => client).readSnapshot({ accessToken: 'token' })
    expect(snapshot.details.p1.manualMasterySnapshots).toHaveLength(LEARNER_ANALYTICS_LIMITS.masterySnapshots)
    expect(snapshot.details.p1.recentEvidence.length).toBeLessThanOrEqual(LEARNER_ANALYTICS_LIMITS.recentEvidence)
    expect(snapshot.details.p1.attendance.recentDays).toHaveLength(LEARNER_ANALYTICS_LIMITS.attendanceDays)
  })
})

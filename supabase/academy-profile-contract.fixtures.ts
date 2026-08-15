import { defaultAppState } from '../src/migration'

export interface AcademyProfileContractFixture {
  name: string
  profileId: string
  data: unknown
  valid: boolean
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function academyProfileContractFixtures(): AcademyProfileContractFixture[] {
  const profile = clone(defaultAppState().profiles.p1) as unknown as Record<
    string,
    unknown
  >
  const invalid = (
    name: string,
    mutate: (candidate: Record<string, unknown>) => void,
  ): AcademyProfileContractFixture => {
    const candidate = clone(profile)
    mutate(candidate)
    return { name, profileId: 'p1', data: candidate, valid: false }
  }
  const allOptionals = clone(profile)
  Object.assign(allOptionals, {
    template: { weekday: [], friday: [] },
    lastPracticeDate: '2026-07-26',
    assessments: { assigned: [], attempts: [], retakeUnlocked: [] },
    hsStats: {},
    courses: [],
    collegeTasks: [],
    tutor: {
      voiceURI: '',
      rate: 1,
      voiceOptIn: true,
      voiceMap: {},
      voiceSelections: {
        mathTutor: {
          kind: 'catalog',
          voiceRef: 'academy.tts.synthetic-fixture',
          voiceVersion: 'fixture-v1',
          displayLabel: 'Synthetic fixture voice',
        },
        default: {
          kind: 'browser',
          voiceURI: 'urn:synthetic-browser-voice',
          displayLabel: 'Synthetic browser voice',
        },
      },
    },
    tutorFlags: {},
    walkthroughLog: [],
    stars: {
      balance: 0,
      lifetimeEarned: 0,
      ledger: [],
      pendingRedemptions: [],
    },
    coolStars: false,
    typing: { unlockedIndex: 0, drillsCompleted: 0, lessons: {} },
    reading: { sessions: [], seenPassageIds: [], calibrations: [] },
    attendance: { log: [] },
    serviceLog: [],
    tutorChats: [],
    tutorCalls: [],
    tutorDailyCap: 20,
    mindset: { weeks: {} },
    assistant: { calls: [], sessions: [] },
    pacing: { pointers: {}, nudges: [] },
    masterySnapshots: [],
    scheduleExtensions: [
      {
        id: 'sx-1',
        label: 'Algebra practice',
        days: ['Mon', 'Wed'],
        start: '13:00',
        end: '13:30',
      },
    ],
  })

  const boundaryExtension = clone(profile)
  Object.assign(boundaryExtension, {
    // SCHED-1: extremes of the UI contract — 120-char label, all five days,
    // widest strict HH:MM range. Must stay valid on both the TS and db side.
    scheduleExtensions: [
      {
        id: 'sx-boundary',
        label: 'x'.repeat(120),
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        start: '00:00',
        end: '23:59',
      },
    ],
  })

  return [
    {
      name: 'complete default profile',
      profileId: 'p1',
      data: profile,
      valid: true,
    },
    {
      name: 'complete profile with every optional container',
      profileId: 'p1',
      data: allOptionals,
      valid: true,
    },
    {
      name: 'profile with a boundary-valid schedule extension',
      profileId: 'p1',
      data: boundaryExtension,
      valid: true,
    },
    { name: 'only id', profileId: 'p1', data: { id: 'p1' }, valid: false },
    invalid('missing name', (candidate) => delete candidate.name),
    invalid('invalid name type', (candidate) => {
      candidate.name = 12
    }),
    invalid('missing grade', (candidate) => delete candidate.grade),
    invalid('invalid grade', (candidate) => {
      candidate.grade = 13
    }),
    invalid('missing pin', (candidate) => delete candidate.pin),
    invalid('invalid pin type', (candidate) => {
      candidate.pin = 1234
    }),
    invalid('missing totals', (candidate) => delete candidate.totals),
    invalid('invalid totals', (candidate) => {
      candidate.totals = { questionsAnswered: 1 }
    }),
    invalid('invalid skills', (candidate) => {
      candidate.skills = {
        addition: { attempts: 'many', correct: 1, mastery: 1 },
      }
    }),
    invalid('invalid reading container', (candidate) => {
      candidate.reading = {
        sessions: 'not-an-array',
        seenPassageIds: [],
        calibrations: [],
      }
    }),
    invalid('invalid stars container', (candidate) => {
      candidate.stars = {
        balance: 0,
        lifetimeEarned: 0,
        ledger: [{ id: 'entry', at: 'not-a-time' }],
        pendingRedemptions: [],
      }
    }),
    invalid('invalid assistant container', (candidate) => {
      candidate.assistant = { calls: [], sessions: [{ id: 'x' }] }
    }),
    invalid('invalid template container', (candidate) => {
      candidate.template = { weekday: [] }
    }),
    invalid('invalid assessments container', (candidate) => {
      candidate.assessments = { assigned: 'bad', attempts: [] }
    }),
    invalid('invalid hs stats container', (candidate) => {
      candidate.hsStats = { unit: { attempts: 'bad', correct: 0 } }
    }),
    invalid('invalid courses container', (candidate) => {
      candidate.courses = [{ id: 'course', name: 'Course', units: 'bad' }]
    }),
    invalid('invalid college task date', (candidate) => {
      candidate.collegeTasks = [
        { id: 'task', label: 'Task', due: 'not-a-date', done: false },
      ]
    }),
    invalid('invalid tutor container', (candidate) => {
      candidate.tutor = { rate: 'fast' }
    }),
    invalid('invalid tutor flag date', (candidate) => {
      candidate.tutorFlags = {
        skill: {
          since: 'bad',
          reason: 'Reason',
          sessionCount: 1,
          weekCount: 1,
        },
      }
    }),
    invalid('invalid walkthrough timestamp', (candidate) => {
      candidate.walkthroughLog = [
        { skillId: 'skill', ts: 'now', day: '2026-07-26' },
      ]
    }),
    invalid('invalid typing lesson', (candidate) => {
      candidate.typing = {
        unlockedIndex: 0,
        drillsCompleted: 0,
        lessons: {
          lesson: { bestAccuracy: 0, bestWpm: 0, passed: 'yes' },
        },
      }
    }),
    invalid('invalid attendance log', (candidate) => {
      candidate.attendance = { log: 'bad' }
    }),
    invalid('invalid tutor chat messages', (candidate) => {
      candidate.tutorChats = [
        {
          id: 'chat',
          skillId: 'skill',
          grade: '3',
          day: '2026-07-26',
          startedTs: 1,
          problem: 'Problem',
          correctAnswer: 'Answer',
          herAnswer: 'Answer',
          messages: 'bad',
        },
      ]
    }),
    invalid('invalid mindset weeks', (candidate) => {
      candidate.mindset = { weeks: [] }
    }),
    invalid('invalid pacing nudges', (candidate) => {
      candidate.pacing = { pointers: {}, nudges: {} }
    }),
    invalid('invalid mastery snapshot timestamp', (candidate) => {
      candidate.masterySnapshots = [{ at: 'bad', subject: 'Math', level: 80 }]
    }),
    // SCHED-1: no invalid scheduleExtensions fixture here — this file also drives the
    // db-side contract (academy_sync_profile_is_valid), which tolerates unknown additive
    // fields and cannot learn the new one without a migration. TS-side rejection
    // coverage lives in src/sync/provenance.coreDay.test.ts and
    // src/sync/provenance.scheduleParity.test.ts.
    invalid('invalid nested date', (candidate) => {
      candidate.serviceLog = [
        {
          id: 'service',
          date: '2026-99-99',
          org: 'Library',
          hours: 2,
          note: '',
          approved: false,
          createdAt: '2026-07-26T12:00:00Z',
        },
      ]
    }),
  ]
}

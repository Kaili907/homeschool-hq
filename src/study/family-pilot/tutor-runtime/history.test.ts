import { describe, expect, it } from 'vitest'
import {
  createFamilyPilotTutorHistoryStore,
  FAMILY_PILOT_TUTOR_HISTORY_KEY,
  parseFamilyPilotTutorHistory,
  type FamilyPilotTutorChat,
} from './history'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    raw: values,
  }
}

const chat = (overrides: Partial<FamilyPilotTutorChat> = {}): FamilyPilotTutorChat => ({
  chatRef: 'tutor-chat:one',
  learnerRef: 'student:one',
  learnerDisplayName: 'Avery',
  grade: '7',
  assignmentRef: 'assignment:one',
  lessonRef: 'lesson:one',
  lessonTitle: 'Understanding ecosystems',
  subject: 'science',
  sessionRef: 'session:one',
  startedAt: '2026-09-09T10:00:00.000Z',
  updatedAt: '2026-09-09T10:01:00.000Z',
  messages: [{
    messageRef: 'tutor-message:one',
    role: 'learner',
    text: 'How does energy move through this food web?',
    createdAt: '2026-09-09T10:01:00.000Z',
    source: 'speech',
  }],
  ...overrides,
})

describe('Family Pilot Tutor history', () => {
  it('saves conversations under the supplied household-scoped storage only', () => {
    const storage = memoryStorage()
    const store = createFamilyPilotTutorHistoryStore(
      storage,
      'household:one',
      () => new Date('2026-09-09T10:02:00.000Z'),
    )
    store.saveChat(chat())
    expect(store.load().chats).toEqual([chat()])
    expect(storage.raw.has(FAMILY_PILOT_TUTOR_HISTORY_KEY)).toBe(true)
  })

  it('rejects another household and any extra untrusted fields', () => {
    const valid = {
      schemaVersion: 1,
      householdRef: 'household:one',
      updatedAt: '2026-09-09T10:02:00.000Z',
      chats: [chat()],
    }
    expect(parseFamilyPilotTutorHistory(valid, 'household:two')).toBeNull()
    expect(parseFamilyPilotTutorHistory({ ...valid, accessToken: 'forbidden' }, 'household:one')).toBeNull()
    expect(parseFamilyPilotTutorHistory({
      ...valid,
      chats: [{ ...chat(), messages: [{ ...chat().messages[0], correctAnswer: 'forbidden' }] }],
    }, 'household:one')).toBeNull()
  })

  it('deletes one conversation or every conversation for one learner without touching another learner', () => {
    const storage = memoryStorage()
    const store = createFamilyPilotTutorHistoryStore(storage, 'household:one')
    store.saveChat(chat())
    store.saveChat(chat({ chatRef: 'tutor-chat:two', lessonRef: 'lesson:two' }))
    store.saveChat(chat({ chatRef: 'tutor-chat:other', learnerRef: 'student:other' }))
    expect(new Set(store.deleteChat('tutor-chat:two').chats.map((item) => item.chatRef))).toEqual(
      new Set(['tutor-chat:one', 'tutor-chat:other']),
    )
    expect(store.clearLearner('student:one').chats.map((item) => item.chatRef)).toEqual(['tutor-chat:other'])
  })
})

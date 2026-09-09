type TutorStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const FAMILY_PILOT_TUTOR_HISTORY_KEY = 'manuel-academy.study.family-pilot-tutor-history.v1'

export type FamilyPilotTutorMessageRole = 'learner' | 'tutor' | 'system'
export type FamilyPilotTutorMessageSource = 'typed' | 'speech' | 'ai' | 'scripted'

export interface FamilyPilotTutorMessage {
  readonly messageRef: string
  readonly role: FamilyPilotTutorMessageRole
  readonly text: string
  readonly createdAt: string
  readonly source: FamilyPilotTutorMessageSource
}

export interface FamilyPilotTutorChat {
  readonly chatRef: string
  readonly learnerRef: string
  readonly learnerDisplayName: string
  readonly grade: string
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly lessonTitle: string
  readonly subject: string
  readonly sessionRef: string
  readonly startedAt: string
  readonly updatedAt: string
  readonly messages: readonly FamilyPilotTutorMessage[]
}

export interface FamilyPilotTutorHistoryV1 {
  readonly schemaVersion: 1
  readonly householdRef: string
  readonly updatedAt: string
  readonly chats: readonly FamilyPilotTutorChat[]
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,191}$/
const ROLES = new Set<FamilyPilotTutorMessageRole>(['learner', 'tutor', 'system'])
const SOURCES = new Set<FamilyPilotTutorMessageSource>(['typed', 'speech', 'ai', 'scripted'])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null
}

function ref(value: unknown): string | null {
  return typeof value === 'string' && REF.test(value) ? value : null
}

function iso(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function parseMessage(value: unknown): FamilyPilotTutorMessage | null {
  if (!record(value) || !exactKeys(value, ['messageRef', 'role', 'text', 'createdAt', 'source'])) return null
  const messageRef = ref(value.messageRef)
  const messageText = text(value.text, 2_000)
  const createdAt = iso(value.createdAt)
  if (
    !messageRef || !messageText || !createdAt
    || typeof value.role !== 'string' || !ROLES.has(value.role as FamilyPilotTutorMessageRole)
    || typeof value.source !== 'string' || !SOURCES.has(value.source as FamilyPilotTutorMessageSource)
  ) return null
  return Object.freeze({
    messageRef,
    role: value.role as FamilyPilotTutorMessageRole,
    text: messageText,
    createdAt,
    source: value.source as FamilyPilotTutorMessageSource,
  })
}

function parseChat(value: unknown): FamilyPilotTutorChat | null {
  if (!record(value) || !exactKeys(value, [
    'chatRef', 'learnerRef', 'learnerDisplayName', 'grade', 'assignmentRef', 'lessonRef',
    'lessonTitle', 'subject', 'sessionRef', 'startedAt', 'updatedAt', 'messages',
  ])) return null
  const chatRef = ref(value.chatRef)
  const learnerRef = ref(value.learnerRef)
  const learnerDisplayName = text(value.learnerDisplayName, 120)
  const grade = text(value.grade, 12)
  const assignmentRef = ref(value.assignmentRef)
  const lessonRef = ref(value.lessonRef)
  const lessonTitle = text(value.lessonTitle, 240)
  const subject = text(value.subject, 120)
  const sessionRef = ref(value.sessionRef)
  const startedAt = iso(value.startedAt)
  const updatedAt = iso(value.updatedAt)
  if (
    !chatRef || !learnerRef || !learnerDisplayName || !grade || !assignmentRef || !lessonRef
    || !lessonTitle || !subject || !sessionRef || !startedAt || !updatedAt
    || !Array.isArray(value.messages) || value.messages.length > 5_000
  ) return null
  const messages = value.messages.map(parseMessage)
  if (messages.some((message) => message === null)) return null
  return Object.freeze({
    chatRef,
    learnerRef,
    learnerDisplayName,
    grade,
    assignmentRef,
    lessonRef,
    lessonTitle,
    subject,
    sessionRef,
    startedAt,
    updatedAt,
    messages: Object.freeze(messages as FamilyPilotTutorMessage[]),
  })
}

export function emptyFamilyPilotTutorHistory(householdRef: string): FamilyPilotTutorHistoryV1 {
  if (!REF.test(householdRef)) throw new Error('Invalid tutor household scope.')
  return Object.freeze({
    schemaVersion: 1,
    householdRef,
    updatedAt: new Date(0).toISOString(),
    chats: Object.freeze([]),
  })
}

export function parseFamilyPilotTutorHistory(
  value: unknown,
  householdRef: string,
): FamilyPilotTutorHistoryV1 | null {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'householdRef', 'updatedAt', 'chats'])) return null
  if (value.schemaVersion !== 1 || value.householdRef !== householdRef || !iso(value.updatedAt)) return null
  if (!Array.isArray(value.chats) || value.chats.length > 1_000) return null
  const chats = value.chats.map(parseChat)
  if (chats.some((chat) => chat === null)) return null
  return Object.freeze({
    schemaVersion: 1,
    householdRef,
    updatedAt: iso(value.updatedAt) as string,
    chats: Object.freeze(chats as FamilyPilotTutorChat[]),
  })
}

export interface FamilyPilotTutorHistoryStore {
  load(): FamilyPilotTutorHistoryV1
  saveChat(chat: FamilyPilotTutorChat): FamilyPilotTutorHistoryV1
  deleteChat(chatRef: string): FamilyPilotTutorHistoryV1
  clearLearner(learnerRef: string): FamilyPilotTutorHistoryV1
}

export function createFamilyPilotTutorHistoryStore(
  storage: TutorStorage,
  householdRef: string,
  now: () => Date = () => new Date(),
): FamilyPilotTutorHistoryStore {
  const empty = () => emptyFamilyPilotTutorHistory(householdRef)
  const load = () => {
    try {
      const raw = storage.getItem(FAMILY_PILOT_TUTOR_HISTORY_KEY)
      return raw ? parseFamilyPilotTutorHistory(JSON.parse(raw) as unknown, householdRef) ?? empty() : empty()
    } catch {
      return empty()
    }
  }
  const persist = (chats: readonly FamilyPilotTutorChat[]) => {
    const next: FamilyPilotTutorHistoryV1 = Object.freeze({
      schemaVersion: 1,
      householdRef,
      updatedAt: now().toISOString(),
      chats: Object.freeze([...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    })
    storage.setItem(FAMILY_PILOT_TUTOR_HISTORY_KEY, JSON.stringify(next))
    return next
  }
  return Object.freeze({
    load,
    saveChat(chat: FamilyPilotTutorChat) {
      const parsed = parseChat(chat)
      if (!parsed) throw new Error('Tutor chat could not be saved.')
      const held = load().chats.filter((candidate) => candidate.chatRef !== parsed.chatRef)
      return persist([parsed, ...held])
    },
    deleteChat(chatRef: string) {
      if (!REF.test(chatRef)) throw new Error('Invalid tutor chat reference.')
      return persist(load().chats.filter((chat) => chat.chatRef !== chatRef))
    },
    clearLearner(learnerRef: string) {
      if (!REF.test(learnerRef)) throw new Error('Invalid tutor learner reference.')
      return persist(load().chats.filter((chat) => chat.learnerRef !== learnerRef))
    },
  })
}

export function createTutorRuntimeRef(prefix: 'chat' | 'message'): string {
  const uuid = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `tutor-${prefix}:${uuid}`
}

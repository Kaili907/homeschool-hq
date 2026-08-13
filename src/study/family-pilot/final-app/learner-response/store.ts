import type { LearnerResponseAttemptContext, LearnerResponseRecord, LearnerResponseStore } from './types'

export const FAMILY_PILOT_LEARNER_RESPONSES_KEY = 'manuel-academy:family-pilot:learner-responses:v1' as const

function sameAttempt(record: LearnerResponseRecord, context: LearnerResponseAttemptContext): boolean {
  return record.lessonRef === context.lessonRef &&
    record.studentRef === context.studentRef &&
    record.assignmentRef === context.assignmentRef &&
    record.attemptRef === context.attemptRef
}

function isRecord(value: unknown): value is LearnerResponseRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<LearnerResponseRecord>
  const response = record.response as Partial<LearnerResponseRecord['response']> | undefined
  const validResponse = response?.kind === 'CHOICE'
    ? typeof (response as { choiceRef?: unknown }).choiceRef === 'string'
    : ['TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(response?.kind ?? '') &&
      typeof (response as { text?: unknown }).text === 'string'
  const validAssessment = record.status === 'PENDING_ASSESSMENT'
    ? record.assessment === null
    : Boolean(record.assessment && typeof record.assessment.assessmentRef === 'string' && typeof record.assessment.assessorRef === 'string')
  return record.schemaVersion === 1 && typeof record.lessonRef === 'string' && typeof record.studentRef === 'string' &&
    typeof record.assignmentRef === 'string' && typeof record.attemptRef === 'string' && typeof record.sectionRef === 'string' &&
    typeof record.itemRef === 'string' && typeof record.segmentRef === 'string' &&
    ['CHOICE', 'TEXT', 'NUMERIC', 'CONSTRUCTED_RESPONSE', 'ACTIVITY_EVIDENCE'].includes(record.responseType ?? '') &&
    typeof record.savedAt === 'string' && validResponse && validAssessment &&
    (record.status === 'PENDING_ASSESSMENT' || record.status === 'ASSESSED')
}

export class BrowserLearnerResponseStore implements LearnerResponseStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'>) {}

  list(context: LearnerResponseAttemptContext): readonly LearnerResponseRecord[] {
    try {
      const parsed: unknown = JSON.parse(this.storage.getItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY) ?? '[]')
      return Array.isArray(parsed) ? Object.freeze(parsed.filter(isRecord).filter((record) => sameAttempt(record, context))) : Object.freeze([])
    } catch {
      return Object.freeze([])
    }
  }

  save(record: LearnerResponseRecord): void {
    let records: LearnerResponseRecord[] = []
    const raw = this.storage.getItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY)
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
        throw new Error('Existing learner responses cannot be safely read.')
      }
      records = parsed
    }
    const next = records.filter((held) => !(sameAttempt(held, record) && held.itemRef === record.itemRef))
    next.push(record)
    this.storage.setItem(FAMILY_PILOT_LEARNER_RESPONSES_KEY, JSON.stringify(next))
  }
}

export class MemoryLearnerResponseStore implements LearnerResponseStore {
  readonly #records = new Map<string, LearnerResponseRecord>()

  list(context: LearnerResponseAttemptContext): readonly LearnerResponseRecord[] {
    return Object.freeze([...this.#records.values()].filter((record) => sameAttempt(record, context)))
  }

  save(record: LearnerResponseRecord): void {
    this.#records.set(`${record.studentRef}|${record.assignmentRef}|${record.attemptRef}|${record.itemRef}`, record)
  }
}

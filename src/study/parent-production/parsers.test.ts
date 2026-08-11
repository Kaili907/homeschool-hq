import { describe, expect, it } from 'vitest'
import {
  parseAdultPrivateCommitNoteInput,
  parseAdultPrivateCommitNoteResult,
  parseCalendarCreateContinuationInput,
  parseCalendarCreateContinuationResult,
  parseCalendarListInput,
  parseCalendarListResult,
  parseCalendarPauseInput,
  parseCalendarPauseResult,
  parseNotificationsListInput,
  parseNotificationsListResult,
  parseNotificationsMarkReadInput,
  parseNotificationsMarkReadResult,
  parseReviewsDecideInput,
  parseReviewsDecideResult,
  parseReviewsListInput,
  parseReviewsListResult,
  parseSafetyReviewAndClearInput,
  parseSafetyReviewAndClearResult,
  parseSafetyReviewListOpenInput,
  parseSafetyReviewListOpenResult,
  parseSettingsApplyInput,
  parseSettingsApplyResult,
  parseSettingsReadInput,
  parseSettingsReadResult,
} from './parsers'

const at = '2026-08-10T14:30:00.000Z'
const settings = {
  timerMode: 'visible',
  maximumWorkMinutes: 45,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  requiredBreaks: 1,
  reducedMotion: false,
  noAudio: false,
  largeText: false,
  readAloud: true,
  speechInputAllowed: true,
} as const
const notification = {
  notificationId: 'notification.1',
  studentRef: 'student.1',
  title: 'Safety review required',
  category: 'safety',
  urgency: 'urgent',
  createdAt: at,
  readAt: null,
  safeActionRef: 'safety-review.1',
} as const
const studentRef = 'student.1'
const mutation = { studentRef, expectedRevision: 2, mutationId: 'mutation.1' } as const
const list = { studentRef, cursor: 'cursor.1', limit: 50 } as const
const safetyDecision = {
  studentRef,
  safetyReviewRef: 'safety.1',
  sessionRef: 'session.1',
  blockRef: 'block.1',
  decision: 'resume-approved',
  reasonCode: 'adult-safety-review-completed',
  expectedSafetyRevision: 3,
  expectedSessionRevision: 7,
  expectedCalendarRevision: 9,
  mutationId: 'mutation.safety.1',
} as const

type RequestParser = (value: unknown) => unknown
type RequestParserCase = Readonly<{
  name: string
  parse: RequestParser
  valid: () => Record<string, unknown>
  requiredField: string
}>

const requestParserCases: readonly RequestParserCase[] = [
  { name: 'settings read', parse: parseSettingsReadInput, valid: () => ({ studentRef }), requiredField: 'studentRef' },
  {
    name: 'settings apply', parse: parseSettingsApplyInput,
    valid: () => ({ ...mutation, changes: { maximumWorkMinutes: 45 } }), requiredField: 'studentRef',
  },
  { name: 'reviews list', parse: parseReviewsListInput, valid: () => ({ ...list }), requiredField: 'studentRef' },
  {
    name: 'reviews decide', parse: parseReviewsDecideInput,
    valid: () => ({ ...mutation, reviewRef: 'review.1', decision: 'accepted' }), requiredField: 'studentRef',
  },
  { name: 'calendar list', parse: parseCalendarListInput, valid: () => ({ ...list }), requiredField: 'studentRef' },
  {
    name: 'calendar pause', parse: parseCalendarPauseInput,
    valid: () => ({ ...mutation, blockRef: 'block.1', reason: 'requested-break' }), requiredField: 'studentRef',
  },
  {
    name: 'calendar continuation', parse: parseCalendarCreateContinuationInput,
    valid: () => ({
      ...mutation, sourceBlockRef: 'block.1', requestedScheduledAt: at, durationMinutes: 30,
    }),
    requiredField: 'studentRef',
  },
  {
    name: 'safety review list', parse: parseSafetyReviewListOpenInput,
    valid: () => ({ studentRef }), requiredField: 'studentRef',
  },
  {
    name: 'safety review and clear', parse: parseSafetyReviewAndClearInput,
    valid: () => ({ ...safetyDecision }), requiredField: 'studentRef',
  },
  {
    name: 'adult private commit note', parse: parseAdultPrivateCommitNoteInput,
    valid: () => ({ ...mutation, noteRef: 'note.1', category: 'follow-up', body: 'Check in tomorrow.' }),
    requiredField: 'studentRef',
  },
  { name: 'notifications list', parse: parseNotificationsListInput, valid: () => ({ ...list }), requiredField: 'studentRef' },
  {
    name: 'notifications mark read', parse: parseNotificationsMarkReadInput,
    valid: () => ({ ...mutation, notificationId: 'notification.1' }), requiredField: 'studentRef',
  },
]

const review = {
  reviewRef: 'review.1', studentRef, kind: 'reteach', dueAt: at,
  priority: 2, state: 'pending', revision: 1,
} as const
const calendarBlock = {
  blockRef: 'block.1', studentRef, category: 'lesson', scheduledAt: at,
  durationMinutes: 30, state: 'scheduled', revision: 1,
} as const
const safetyReview = {
  safetyReviewRef: 'safety.1', studentRef, sessionRef: 'session.1', blockRef: 'block.1',
  category: 'urgent-safety', urgency: 'urgent', heldAt: at,
  safetyRevision: 3, sessionRevision: 7, calendarRevision: 9,
} as const

const resultParserCases: readonly RequestParserCase[] = [
  {
    name: 'settings read result', parse: parseSettingsReadResult,
    valid: () => ({ status: 'settings', settings: { ...settings }, revision: 4, updatedAt: at }),
    requiredField: 'status',
  },
  {
    name: 'settings apply result', parse: parseSettingsApplyResult,
    valid: () => ({ status: 'applied', revision: 5, appliedAt: at }), requiredField: 'status',
  },
  {
    name: 'reviews list result', parse: parseReviewsListResult,
    valid: () => ({ status: 'listed', reviews: [{ ...review }] }), requiredField: 'status',
  },
  {
    name: 'reviews decide result', parse: parseReviewsDecideResult,
    valid: () => ({ status: 'decided', decision: 'accepted', revision: 2, decidedAt: at }),
    requiredField: 'status',
  },
  {
    name: 'calendar list result', parse: parseCalendarListResult,
    valid: () => ({ status: 'listed', blocks: [{ ...calendarBlock }] }), requiredField: 'status',
  },
  {
    name: 'calendar pause result', parse: parseCalendarPauseResult,
    valid: () => ({ status: 'paused', revision: 2, pausedAt: at }), requiredField: 'status',
  },
  {
    name: 'calendar continuation result', parse: parseCalendarCreateContinuationResult,
    valid: () => ({ status: 'continuation-created', blockRef: 'block.2', revision: 2, createdAt: at }),
    requiredField: 'status',
  },
  {
    name: 'safety review list result', parse: parseSafetyReviewListOpenResult,
    valid: () => ({ status: 'listed', reviews: [{ ...safetyReview }] }), requiredField: 'status',
  },
  {
    name: 'safety review and clear result', parse: parseSafetyReviewAndClearResult,
    valid: () => ({
      status: 'cleared', decision: 'resume-approved', safetyRevision: 4, sessionRevision: 8,
      calendarRevision: 10, reviewedAt: at, clearedAt: at,
    }),
    requiredField: 'status',
  },
  {
    name: 'adult private commit note result', parse: parseAdultPrivateCommitNoteResult,
    valid: () => ({ status: 'committed', noteRef: 'note.1', revision: 2, committedAt: at }),
    requiredField: 'status',
  },
  {
    name: 'notifications list result', parse: parseNotificationsListResult,
    valid: () => ({ status: 'listed', notifications: [{ ...notification }] }), requiredField: 'status',
  },
  {
    name: 'notifications mark read result', parse: parseNotificationsMarkReadResult,
    valid: () => ({ status: 'marked-read', revision: 2, readAt: at }), requiredField: 'status',
  },
]

function expectRefusalWithoutThrow(parse: RequestParser, value: unknown): void {
  expect(() => expect(parse(value)).toBeNull()).not.toThrow()
}

describe.each(requestParserCases)('$name request own-property boundary', ({ parse, valid, requiredField }) => {
  it('rejects an unknown symbol key', () => {
    const input = valid()
    Object.defineProperty(input, Symbol('seventh-capability'), { value: true, enumerable: true })
    expectRefusalWithoutThrow(parse, input)
  })

  it('rejects an unknown non-enumerable string key', () => {
    const input = valid()
    Object.defineProperty(input, 'hiddenCapability', { value: true, enumerable: false })
    expectRefusalWithoutThrow(parse, input)
  })

  it('rejects a required field defined non-enumerably', () => {
    const input = valid()
    Object.defineProperty(input, requiredField, { value: input[requiredField], enumerable: false, configurable: true })
    expectRefusalWithoutThrow(parse, input)
  })

  it('rejects a required field implemented as a getter without invoking it', () => {
    const input = valid()
    let reads = 0
    Object.defineProperty(input, requiredField, {
      get: () => {
        reads += 1
        return studentRef
      },
      enumerable: true,
      configurable: true,
    })
    expectRefusalWithoutThrow(parse, input)
    expect(reads).toBe(0)
  })

  it('rejects a getter that changes value after its first read', () => {
    const input = valid()
    let reads = 0
    Object.defineProperty(input, requiredField, {
      get: () => {
        reads += 1
        return reads === 1 ? studentRef : 'invalid ref with spaces'
      },
      enumerable: true,
      configurable: true,
    })
    expectRefusalWithoutThrow(parse, input)
    expect(reads).toBe(0)
  })

  it('refuses without throwing when proxy ownKeys throws', () => {
    const input = new Proxy(valid(), {
      ownKeys: () => { throw new Error('hostile ownKeys') },
    })
    expectRefusalWithoutThrow(parse, input)
  })

  it('refuses without throwing when proxy getOwnPropertyDescriptor throws', () => {
    const input = new Proxy(valid(), {
      getOwnPropertyDescriptor: () => { throw new Error('hostile descriptor') },
    })
    expectRefusalWithoutThrow(parse, input)
  })
})

describe.each(resultParserCases)('$name network own-property boundary', ({ parse, valid, requiredField }) => {
  it('rejects symbol and hidden keys', () => {
    const withSymbol = valid()
    Object.defineProperty(withSymbol, Symbol('hidden-result'), { value: true, enumerable: true })
    expectRefusalWithoutThrow(parse, withSymbol)

    const withHidden = valid()
    Object.defineProperty(withHidden, 'hiddenResult', { value: true, enumerable: false })
    expectRefusalWithoutThrow(parse, withHidden)
  })

  it('rejects accessors without invoking them', () => {
    const input = valid()
    const validStatus = input[requiredField]
    let reads = 0
    Object.defineProperty(input, requiredField, {
      get: () => { reads += 1; return validStatus }, enumerable: true,
    })
    expectRefusalWithoutThrow(parse, input)
    expect(reads).toBe(0)
  })

  it('refuses throwing ownKeys and descriptor proxies without throwing', () => {
    expectRefusalWithoutThrow(parse, new Proxy(valid(), {
      ownKeys: () => { throw new Error('hostile result ownKeys') },
    }))
    expectRefusalWithoutThrow(parse, new Proxy(valid(), {
      getOwnPropertyDescriptor: () => { throw new Error('hostile result descriptor') },
    }))
  })

  it('returns a detached result snapshot', () => {
    const input = valid()
    const originalValue = input[requiredField]
    const parsed = parse(input) as Record<string, unknown>
    expect(parsed).not.toBe(input)
    input[requiredField] = 'changed-after-parse'
    expect(parsed[requiredField]).toBe(originalValue)
  })
})

describe('Parent Hub production request parsers', () => {
  it('accepts null-prototype request records and rejects non-plain prototypes', () => {
    for (const { parse, valid } of requestParserCases) {
      const nullPrototype = Object.assign(Object.create(null) as Record<string, unknown>, valid())
      expect(parse(nullPrototype)).not.toBeNull()

      const inheritedPrototype = Object.assign(Object.create({ inherited: true }) as Record<string, unknown>, valid())
      expect(parse(inheritedPrototype)).toBeNull()
    }
  })

  it('strictly parses every read and list input', () => {
    expect(parseSettingsReadInput({ studentRef })).toEqual({ studentRef })
    expect(parseReviewsListInput(list)).toEqual(list)
    expect(parseCalendarListInput(list)).toEqual(list)
    expect(parseSafetyReviewListOpenInput({ studentRef })).toEqual({ studentRef })
    expect(parseNotificationsListInput(list)).toEqual(list)

    expect(parseSettingsReadInput({ studentRef, actorRole: 'guardian' })).toBeNull()
    expect(parseReviewsListInput({ ...list, limit: 101 })).toBeNull()
    expect(parseCalendarListInput({ ...list, cursor: 'x'.repeat(513) })).toBeNull()
    expect(parseNotificationsListInput({ ...list, studentRef: `s${'x'.repeat(128)}` })).toBeNull()
  })

  it('strictly parses every ordinary mutation input without client-owned transition times', () => {
    const settingsInput = { ...mutation, changes: { maximumWorkMinutes: 45, breakMinimumMinutes: 5, breakMaximumMinutes: 15 } }
    const reviewInput = { ...mutation, reviewRef: 'review.1', decision: 'accepted' }
    const pauseInput = { ...mutation, blockRef: 'block.1', reason: 'requested-break' }
    const continuationInput = {
      ...mutation, sourceBlockRef: 'block.1', requestedScheduledAt: at, durationMinutes: 30,
    }
    const noteInput = { ...mutation, noteRef: 'note.1', category: 'follow-up', body: 'Check in tomorrow.' }
    const markReadInput = { ...mutation, notificationId: 'notification.1' }

    expect(parseSettingsApplyInput(settingsInput)).toEqual(settingsInput)
    expect(parseReviewsDecideInput(reviewInput)).toEqual(reviewInput)
    expect(parseCalendarPauseInput(pauseInput)).toEqual(pauseInput)
    expect(parseCalendarCreateContinuationInput(continuationInput)).toEqual(continuationInput)
    expect(parseAdultPrivateCommitNoteInput(noteInput)).toEqual(noteInput)
    expect(parseNotificationsMarkReadInput(markReadInput)).toEqual(markReadInput)

    expect(parseCalendarPauseInput({ ...pauseInput, pausedAt: at })).toBeNull()
    expect(parseCalendarCreateContinuationInput({ ...continuationInput, requestedScheduledAt: '2026-02-30T12:00:00.000Z' })).toBeNull()
    expect(parseCalendarCreateContinuationInput({ ...continuationInput, durationMinutes: 481 })).toBeNull()
    expect(parseReviewsDecideInput({ ...reviewInput, mutationId: `m${'x'.repeat(128)}` })).toBeNull()
    expect(parseAdultPrivateCommitNoteInput({ ...noteInput, body: 'x'.repeat(4_001) })).toBeNull()
    expect(parseAdultPrivateCommitNoteInput({ ...noteInput, category: 'learner-visible' })).toBeNull()
    expect(parseNotificationsMarkReadInput({ ...markReadInput, expectedRevision: Number.MAX_SAFE_INTEGER + 1 })).toBeNull()
    expect(parseNotificationsMarkReadInput({ ...markReadInput, expectedRevision: -1 })).toBeNull()
  })

  it('enforces plausible settings ranges and relationships without truncating changes', () => {
    expect(parseSettingsApplyInput({ ...mutation, changes: {} })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { maximumWorkMinutes: 4 } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { requiredBreaks: 13 } })).toBeNull()
    expect(parseSettingsApplyInput({
      ...mutation, changes: { breakMinimumMinutes: 20, breakMaximumMinutes: 10 },
    })).toBeNull()
    expect(parseSettingsApplyInput({
      ...mutation, changes: { maximumWorkMinutes: 10, breakMaximumMinutes: 15 },
    })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { maximumWorkMinutes: undefined } })).toBeNull()
    expect(parseSettingsApplyInput({ ...mutation, changes: { maximumWorkMinutes: 45, extra: true } })).toBeNull()
  })

  it('binds each adult safety decision to the proposal, session, and calendar revisions', () => {
    expect(parseSafetyReviewAndClearInput(safetyDecision)).toEqual(safetyDecision)
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, decision: 'end-session' })).not.toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, reviewedAt: at })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, expectedRevision: 3 })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, expectedSessionRevision: -1 })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, reasonCode: 'adult-resumed-learner' })).toBeNull()
    expect(parseSafetyReviewAndClearInput({ ...safetyDecision, sessionRef: 'x'.repeat(129) })).toBeNull()
  })

  it('returns detached snapshots for every valid request', () => {
    for (const { parse, valid, requiredField } of requestParserCases) {
      const input = valid()
      const originalValue = input[requiredField]
      const parsed = parse(input) as Record<string, unknown>
      expect(parsed).not.toBe(input)
      input[requiredField] = 'student.changed'
      expect(parsed[requiredField]).toBe(originalValue)
    }
  })

  it('applies the data-property snapshot boundary to nested settings changes', () => {
    const withSymbol = { maximumWorkMinutes: 45 }
    Object.defineProperty(withSymbol, Symbol('hidden'), { value: true, enumerable: true })
    expect(parseSettingsApplyInput({ ...mutation, changes: withSymbol })).toBeNull()

    const withHidden = { maximumWorkMinutes: 45 }
    Object.defineProperty(withHidden, 'hidden', { value: true, enumerable: false })
    expect(parseSettingsApplyInput({ ...mutation, changes: withHidden })).toBeNull()

    const withGetter = {}
    let reads = 0
    Object.defineProperty(withGetter, 'maximumWorkMinutes', {
      get: () => { reads += 1; return 45 }, enumerable: true,
    })
    expect(parseSettingsApplyInput({ ...mutation, changes: withGetter })).toBeNull()
    expect(reads).toBe(0)

    const hostile = new Proxy({ maximumWorkMinutes: 45 }, {
      ownKeys: () => { throw new Error('hostile nested ownKeys') },
    })
    expectRefusalWithoutThrow(parseSettingsApplyInput, { ...mutation, changes: hostile })
  })
})

describe('Parent Hub production response parsers', () => {
  it('snapshots nested records and arrays without retaining network-owned objects', () => {
    const reviews = [{ ...review }]
    const source = { status: 'listed', reviews }
    const parsed = parseReviewsListResult(source)
    expect(parsed).not.toBeNull()
    if (!parsed || parsed.status !== 'listed') throw new Error('expected listed review result')
    expect(parsed.reviews).not.toBe(reviews)
    expect(parsed.reviews[0]).not.toBe(reviews[0])
    const mutableReview = reviews[0] as { revision: number }
    mutableReview.revision = 99
    expect(parsed.reviews[0].revision).toBe(1)
  })

  it('rejects hostile nested result records and arrays without throwing', () => {
    const nestedSymbol = { ...review }
    Object.defineProperty(nestedSymbol, Symbol('hidden-review'), { value: true, enumerable: true })
    expect(parseReviewsListResult({ status: 'listed', reviews: [nestedSymbol] })).toBeNull()

    const nestedAccessor = { ...calendarBlock }
    let reads = 0
    Object.defineProperty(nestedAccessor, 'blockRef', {
      get: () => { reads += 1; return 'block.1' }, enumerable: true,
    })
    expect(parseCalendarListResult({ status: 'listed', blocks: [nestedAccessor] })).toBeNull()
    expect(reads).toBe(0)

    const hostileArray = new Proxy([{ ...notification }], {
      ownKeys: () => { throw new Error('hostile array ownKeys') },
    })
    expectRefusalWithoutThrow(parseNotificationsListResult, { status: 'listed', notifications: hostileArray })
  })

  it('accepts bounded settings results and rejects unknown placement keys', () => {
    const valid = { status: 'settings', settings, revision: 4, updatedAt: at }
    expect(parseSettingsReadResult(valid)).toEqual(valid)
    expect(parseSettingsReadResult({ ...valid, settings: { ...settings, workingLevel: 7 } })).toBeNull()
    expect(parseSettingsReadResult({ ...valid, revision: 1.5 })).toBeNull()
    expect(parseSettingsReadResult({ ...valid, updatedAt: 'tomorrow' })).toBeNull()
    expect(parseSettingsApplyResult({ status: 'applied', revision: 5, appliedAt: at })).not.toBeNull()
    expect(parseSettingsApplyResult({ status: 'stale-revision', currentRevision: -1 })).toBeNull()
  })

  it('accepts minimized review/calendar/safety projections and their fixed conflict branches', () => {
    expect(parseReviewsListResult({
      status: 'listed',
      reviews: [{ reviewRef: 'review.1', studentRef: 'student.1', kind: 'reteach', dueAt: at, priority: 2, state: 'pending', revision: 1 }],
    })).not.toBeNull()
    expect(parseReviewsDecideResult({ status: 'already-decided', decision: 'accepted', revision: 2 })).not.toBeNull()
    expect(parseCalendarListResult({
      status: 'listed',
      blocks: [{ blockRef: 'block.1', studentRef: 'student.1', category: 'lesson', scheduledAt: at, durationMinutes: 30, state: 'scheduled', revision: 1 }],
    })).not.toBeNull()
    expect(parseCalendarPauseResult({ status: 'calendar-state-changed', currentState: 'completed', revision: 2 })).not.toBeNull()
    expect(parseCalendarPauseResult({ status: 'continuation-created', blockRef: 'block.2', revision: 2, createdAt: at })).toBeNull()
    expect(parseCalendarCreateContinuationResult({ status: 'continuation-created', blockRef: 'block.2', revision: 2, createdAt: at })).not.toBeNull()
    expect(parseCalendarCreateContinuationResult({ status: 'paused', revision: 2, pausedAt: at })).toBeNull()
    expect(parseSafetyReviewListOpenResult({
      status: 'listed',
      reviews: [{
        safetyReviewRef: 'safety.1', studentRef: 'student.1', sessionRef: 'session.1', blockRef: 'block.1',
        category: 'urgent-safety', urgency: 'urgent', heldAt: at,
        safetyRevision: 3, sessionRevision: 7, calendarRevision: 9,
      }],
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'safety-state-changed', safetyRevision: 4, sessionRevision: 7, calendarRevision: 9,
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'stale-revision', currentSafetyRevision: 4, currentSessionRevision: 7, currentCalendarRevision: 9,
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({ status: 'failed', code: 'safety-state-changed' })).toBeNull()
  })

  it('never accepts a note body in a successful commit response', () => {
    const committed = { status: 'committed', noteRef: 'note.1', revision: 2, committedAt: at }
    expect(parseAdultPrivateCommitNoteResult(committed)).toEqual(committed)
    expect(parseAdultPrivateCommitNoteResult({ ...committed, body: 'private text' })).toBeNull()
  })

  it('keeps notifications in-app metadata-only and rejects raw content', () => {
    const valid = { status: 'listed', notifications: [notification] }
    expect(parseNotificationsListResult(valid)).toEqual(valid)
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, transcript: 'learner text' }],
    })).toBeNull()
    expect(parseNotificationsMarkReadResult({ status: 'marked-read', revision: 2, readAt: at })).not.toBeNull()
  })

  it('rejects unknown keys, overlong refs, malformed timestamps, oversized lists, and invalid failures', () => {
    expect(parseNotificationsListResult({ status: 'listed', notifications: [notification], extra: true })).toBeNull()
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, notificationId: `n${'x'.repeat(128)}` }],
    })).toBeNull()
    expect(parseNotificationsListResult({
      status: 'listed', notifications: [{ ...notification, createdAt: '2026-99-99T14:30:00Z' }],
    })).toBeNull()
    expect(parseNotificationsListResult({ status: 'listed', notifications: Array(101).fill(notification) })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'authorization-infrastructure-unavailable' })).not.toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'unknown' })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'rate-limited', retryAfterSeconds: 0 })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'adult-unauthorized', detail: 'secret' })).toBeNull()
  })

  it('accepts server-authoritative transition timestamps and rejects malformed values', () => {
    expect(parseCalendarPauseResult({ status: 'paused', revision: 3, pausedAt: at })).not.toBeNull()
    expect(parseCalendarPauseResult({ status: 'paused', revision: 3, pausedAt: '2026-02-30T12:00:00.000Z' })).toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'cleared', decision: 'resume-approved', safetyRevision: 4, sessionRevision: 8,
      calendarRevision: 10, reviewedAt: at, clearedAt: at,
    })).not.toBeNull()
    expect(parseSafetyReviewAndClearResult({
      status: 'cleared', decision: 'end-session', safetyRevision: 4, sessionRevision: 8,
      calendarRevision: 10, reviewedAt: 'tomorrow', clearedAt: at,
    })).toBeNull()
  })

  it('rejects mutation-only and unrelated failure codes on reads and lists', () => {
    expect(parseSettingsReadResult({ status: 'failed', code: 'idempotency-collision' })).toBeNull()
    expect(parseReviewsListResult({ status: 'failed', code: 'already-decided' })).toBeNull()
    expect(parseCalendarListResult({ status: 'failed', code: 'stale-revision' })).toBeNull()
    expect(parseSafetyReviewListOpenResult({ status: 'failed', code: 'safety-state-changed' })).toBeNull()
    expect(parseNotificationsListResult({ status: 'failed', code: 'idempotency-collision' })).toBeNull()
    expect(parseSettingsApplyResult({ status: 'failed', code: 'already-decided' })).toBeNull()
    expect(parseReviewsDecideResult({ status: 'failed', code: 'safety-state-changed' })).toBeNull()
  })
})

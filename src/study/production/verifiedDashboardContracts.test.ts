import { describe, expect, it } from 'vitest'
import {
  parseVerifiedStudyCalendar,
  parseVerifiedStudyDashboard,
  VERIFIED_CALENDAR_BLOCK_KEYS,
  VERIFIED_CALENDAR_BLOCK_LIMIT,
  VERIFIED_DASHBOARD_SESSION_KEYS,
  VERIFIED_DASHBOARD_SESSION_LIMIT,
  VerifiedStudyContractError,
} from './verifiedDashboardContracts'

// STUDY-A1-PROD-DASH-1 Phase 3 — reject, don't invent.
//
// The production learner surface has exactly two server reads and no fallback
// data source. Every case below is a body the server could never have produced;
// the only safe answer to each is a refusal, because the alternative is a
// learner acting on a plan the household never scheduled.

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'study-session-01',
    state: 'active',
    lessonId: 'math.g5.u2.l3',
    revision: 4,
    updatedAt: '2026-08-07T13:05:00+00:00',
    ...overrides,
  }
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    blockId: 'calendar-block-01',
    blockType: 'lesson',
    sourceReference: 'math.g5.u2.l3',
    scheduledStart: '2026-08-07T13:00:00+00:00',
    intendedLocalDate: '2026-08-07',
    state: 'scheduled',
    revision: 1,
    ...overrides,
  }
}

function omit(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...row }
  delete copy[key]
  return copy
}

const refusedDashboard = (body: unknown) => expect(() => parseVerifiedStudyDashboard(body))
const refusedCalendar = (body: unknown) => expect(() => parseVerifiedStudyCalendar(body))

describe('verified dashboard:read contract', () => {
  it('returns exactly the fields the server sent', () => {
    const parsed = parseVerifiedStudyDashboard({ sessions: [session()] })
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.sessions[0]).toEqual({
      sessionId: 'study-session-01',
      state: 'active',
      lessonId: 'math.g5.u2.l3',
      revision: 4,
      updatedAt: '2026-08-07T13:05:00+00:00',
    })
  })

  it('accepts an empty session list without inventing a placeholder session', () => {
    expect(parseVerifiedStudyDashboard({ sessions: [] }).sessions).toEqual([])
  })

  it('never synthesises a title, subject, segments, resume point or completion', () => {
    const parsed = parseVerifiedStudyDashboard({ sessions: [session()] })
    expect(Object.keys(parsed.sessions[0]!).sort())
      .toEqual([...VERIFIED_DASHBOARD_SESSION_KEYS].sort())
    expect(Object.keys(parsed).sort()).toEqual(['sessions'])
  })

  it(`does not hand back the caller's object`, () => {
    const row = session()
    const body = { sessions: [row] }
    const parsed = parseVerifiedStudyDashboard(body)
    expect(parsed.sessions[0]).not.toBe(row)
    expect(parsed.sessions).not.toBe(body.sessions)
    expect(Object.isFrozen(parsed.sessions[0])).toBe(true)
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it('refuses a session missing state', () => {
    refusedDashboard({ sessions: [omit(session(), 'state')] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([...VERIFIED_DASHBOARD_SESSION_KEYS])('refuses a session missing %s', (key) => {
    refusedDashboard({ sessions: [omit(session(), key)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown extra field rather than ignoring it', () => {
    refusedDashboard({ sessions: [session({ completionPercent: 40 })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['householdId', { householdId: 'household-1' }],
    ['studentId', { studentId: 'student-1' }],
    ['grant', { grant: 'opaque' }],
    ['rawAnswer', { rawAnswer: '42' }],
    ['transcript', { transcript: 'hello' }],
  ])('refuses a protected field %s in a session', (_name, extra) => {
    refusedDashboard({ sessions: [session(extra)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown session state', () => {
    refusedDashboard({ sessions: [session({ state: 'resting' })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['a string revision', '4'],
    ['zero', 0],
    ['a negative revision', -1],
    ['a fractional revision', 1.5],
    ['NaN', Number.NaN],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
    ['null', null],
  ])('refuses %s as a revision', (_name, value) => {
    refusedDashboard({ sessions: [session({ revision: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['an unparseable string', 'yesterday'],
    ['a date without a time', '2026-08-07'],
    ['an instant with no offset', '2026-08-07T13:05:00'],
    ['an impossible month', '2026-13-07T13:05:00+00:00'],
    ['a number', 1_754_579_100_000],
    ['null', null],
  ])('refuses %s as updatedAt', (_name, value) => {
    refusedDashboard({ sessions: [session({ updatedAt: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['an empty identifier', ''],
    ['a leading separator', '.math.g5'],
    ['a space', 'math g5'],
    ['an identifier over 160 characters', `a${'b'.repeat(160)}`],
    ['a number', 7],
  ])('refuses %s as lessonId', (_name, value) => {
    refusedDashboard({ sessions: [session({ lessonId: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('refuses more sessions than the server can return', () => {
    const rows = Array.from({ length: VERIFIED_DASHBOARD_SESSION_LIMIT + 1 }, (_value, index) =>
      session({ sessionId: `study-session-${index}` }))
    refusedDashboard({ sessions: rows }).toThrow(VerifiedStudyContractError)
    expect(() => parseVerifiedStudyDashboard({ sessions: rows.slice(0, -1) })).not.toThrow()
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'sessions'],
    ['a body with no sessions key', {}],
    ['a body with an extra key', { sessions: [], blocks: [] }],
    ['sessions as an object', { sessions: {} }],
  ])('refuses %s as a dashboard body', (_name, body) => {
    refusedDashboard(body).toThrow(VerifiedStudyContractError)
  })
})

describe('verified calendar:read contract', () => {
  it('returns exactly the fields the server sent', () => {
    const parsed = parseVerifiedStudyCalendar({ blocks: [block()] })
    expect(parsed.blocks[0]).toEqual({
      blockId: 'calendar-block-01',
      blockType: 'lesson',
      sourceReference: 'math.g5.u2.l3',
      scheduledStart: '2026-08-07T13:00:00+00:00',
      intendedLocalDate: '2026-08-07',
      state: 'scheduled',
      revision: 1,
    })
    expect(Object.keys(parsed.blocks[0]!).sort())
      .toEqual([...VERIFIED_CALENDAR_BLOCK_KEYS].sort())
  })

  it('accepts an empty block list without inventing a day', () => {
    expect(parseVerifiedStudyCalendar({ blocks: [] }).blocks).toEqual([])
  })

  it(`does not hand back the caller's object`, () => {
    const row = block()
    const parsed = parseVerifiedStudyCalendar({ blocks: [row] })
    expect(parsed.blocks[0]).not.toBe(row)
    expect(Object.isFrozen(parsed.blocks[0])).toBe(true)
  })

  it.each([...VERIFIED_CALENDAR_BLOCK_KEYS])('refuses a block missing %s', (key) => {
    refusedCalendar({ blocks: [omit(block(), key)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown extra field rather than ignoring it', () => {
    refusedCalendar({ blocks: [block({ title: 'Fractions' })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['householdId', { householdId: 'household-1' }],
    ['learnerRef', { learnerRef: 'learner-1' }],
    ['sessionEpoch', { sessionEpoch: 3 }],
    ['transcript', { transcript: 'hello' }],
  ])('refuses a protected field %s in a block', (_name, extra) => {
    refusedCalendar({ blocks: [block(extra)] }).toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['blockType', 'homework'],
    ['state', 'skipped'],
  ])('refuses an unknown %s value', (key, value) => {
    refusedCalendar({ blocks: [block({ [key]: value })] }).toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['a timestamp', '2026-08-07T00:00:00+00:00'],
    ['an impossible day', '2026-02-31'],
    ['a two digit year', '26-08-07'],
    ['a slash date', '2026/08/07'],
    ['null', null],
  ])('refuses %s as intendedLocalDate', (_name, value) => {
    refusedCalendar({ blocks: [block({ intendedLocalDate: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('accepts a real leap day', () => {
    expect(() => parseVerifiedStudyCalendar({ blocks: [block({ intendedLocalDate: '2028-02-29' })] }))
      .not.toThrow()
  })

  it.each([
    ['an unparseable string', 'soon'],
    ['a bare date', '2026-08-07'],
    ['an instant with no offset', '2026-08-07T13:00:00'],
    ['a number', 0],
  ])('refuses %s as scheduledStart', (_name, value) => {
    refusedCalendar({ blocks: [block({ scheduledStart: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('accepts the offset and fractional forms Postgres emits', () => {
    for (const value of [
      '2026-08-07T13:00:00+00:00',
      '2026-08-07T13:00:00.123456+00:00',
      '2026-08-07T13:00:00-04:00',
      '2026-08-07T13:00:00Z',
    ]) {
      expect(() => parseVerifiedStudyCalendar({ blocks: [block({ scheduledStart: value })] }))
        .not.toThrow()
    }
  })

  it('refuses more blocks than the server can return', () => {
    const rows = Array.from({ length: VERIFIED_CALENDAR_BLOCK_LIMIT + 1 }, (_value, index) =>
      block({ blockId: `calendar-block-${index}` }))
    refusedCalendar({ blocks: rows }).toThrow(VerifiedStudyContractError)
    expect(() => parseVerifiedStudyCalendar({ blocks: rows.slice(0, -1) })).not.toThrow()
  })

  // STUDY-A1-PROD-DASH-H2 Phase 4 — the cap is a boundary, so it is walked
  // rather than sampled. A full page is a legal server answer and must parse;
  // one row more is not, and must not.
  it.each([0, 1, 99, VERIFIED_CALENDAR_BLOCK_LIMIT])('accepts %i blocks in one response', (count) => {
    const rows = Array.from({ length: count }, (_value, index) =>
      block({ blockId: `calendar-block-${index}` }))
    expect(parseVerifiedStudyCalendar({ blocks: rows }).blocks).toHaveLength(count)
  })

  it('refuses the first block past the cap and returns nothing at all', () => {
    const rows = Array.from({ length: VERIFIED_CALENDAR_BLOCK_LIMIT + 1 }, (_value, index) =>
      block({ blockId: `calendar-block-${index}` }))
    // Not truncated to the cap: a body the server could not have produced is
    // refused whole, because the extra row means the response is not the one
    // this contract describes.
    refusedCalendar({ blocks: rows }).toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['null', null],
    ['a body with no blocks key', {}],
    ['a body carrying a review queue', { blocks: [], reviewQueue: [] }],
    ['blocks as an object', { blocks: {} }],
  ])('refuses %s as a calendar body', (_name, body) => {
    refusedCalendar(body).toThrow(VerifiedStudyContractError)
  })

  it('names the operation that failed and nothing else', () => {
    try {
      parseVerifiedStudyCalendar({ blocks: [block({ sourceReference: 'secret answer' })] })
      expect.unreachable('the malformed block should have been refused')
    } catch (error) {
      expect(error).toBeInstanceOf(VerifiedStudyContractError)
      expect((error as VerifiedStudyContractError).code).toBe('calendar-body-invalid')
      // No server value may travel out inside the refusal.
      expect((error as Error).message).not.toContain('secret')
    }
  })
})

// STUDY-A1-PROD-DASH-H2 Phase 5 — hostile object shapes, committed.
//
// These parsers are correct against all of it today. They were not covered by a
// test, which means nothing stopped a later "simplification" — a superset key
// check, a re-read of a field after validating it, a prototype-tolerant lookup
// — from quietly removing the property. Each case below is one such regression.
//
// The claim being held: refuse the body, read each field exactly once, return a
// freshly built frozen value, and leave Object.prototype alone.
describe('adversarial object shapes', () => {
  const SESSION_JSON =
    '"sessionId":"study-session-01","state":"active","lessonId":"math.g5.u2.l3",' +
    '"revision":4,"updatedAt":"2026-08-07T13:05:00+00:00"'

  function pollutionProbe(): unknown {
    return (Object.prototype as Record<string, unknown>).polluted
  }

  it('leaves Object.prototype alone across every case in this file', () => {
    expect(pollutionProbe()).toBeUndefined()
  })

  describe('__proto__ arriving as a real own property', () => {
    // JSON.parse assigns `__proto__` as an ordinary own data property instead
    // of invoking the setter, so a body off the wire can carry one. An object
    // literal in this file could not reproduce that.
    it('refuses a row carrying __proto__ alongside every valid field', () => {
      const body = JSON.parse(`{"sessions":[{${SESSION_JSON},"__proto__":{"polluted":"yes"}}]}`)
      expect(Object.hasOwn(body.sessions[0], '__proto__')).toBe(true)
      refusedDashboard(body).toThrow(VerifiedStudyContractError)
      expect(pollutionProbe()).toBeUndefined()
    })

    it('refuses a row that hides a required field behind __proto__', () => {
      // The sharp case: exactly five own keys, so a count check alone passes,
      // and `state` reachable only by walking the prototype chain.
      const body = JSON.parse(
        '{"sessions":[{"sessionId":"study-session-01","lessonId":"math.g5.u2.l3",' +
        '"revision":4,"updatedAt":"2026-08-07T13:05:00+00:00",' +
        '"__proto__":{"state":"active"}}]}',
      )
      expect(Object.keys(body.sessions[0])).toHaveLength(5)
      refusedDashboard(body).toThrow(VerifiedStudyContractError)
      expect(pollutionProbe()).toBeUndefined()
    })

    it('refuses a calendar block carrying __proto__', () => {
      const body = JSON.parse(
        '{"blocks":[{"blockId":"calendar-block-01","blockType":"lesson",' +
        '"sourceReference":"math.g5.u2.l3","scheduledStart":"2026-08-07T13:00:00+00:00",' +
        '"intendedLocalDate":"2026-08-07","state":"scheduled","revision":1,' +
        '"__proto__":{"polluted":"yes"}}]}',
      )
      refusedCalendar(body).toThrow(VerifiedStudyContractError)
      expect(pollutionProbe()).toBeUndefined()
    })
  })

  describe('fields reachable only through the prototype', () => {
    it('refuses a row whose required field lives on the prototype', () => {
      const row = Object.create({ state: 'active' })
      Object.assign(row, omit(session(), 'state'))
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })

    it('refuses a row with the right own-key count but a prototype-only field', () => {
      // Five own keys, one of them unknown, `state` only inherited.
      const row = Object.create({ state: 'active' })
      Object.assign(row, { ...omit(session(), 'state'), completionPercent: 40 })
      expect(Object.keys(row)).toHaveLength(5)
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })

    it('refuses a class instance whose field is a prototype getter', () => {
      class SessionRow {
        sessionId = 'study-session-01'
        lessonId = 'math.g5.u2.l3'
        revision = 4
        updatedAt = '2026-08-07T13:05:00+00:00'
        // Declared in the class body, so it lives on SessionRow.prototype and
        // is not an own property of any instance.
        get state(): string { return 'active' }
      }
      const row = new SessionRow()
      expect(Object.hasOwn(row, 'state')).toBe(false)
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })

    it('refuses a row built with a null prototype and a missing field', () => {
      const row = Object.assign(Object.create(null), omit(session(), 'updatedAt'))
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })
  })

  describe('getters', () => {
    it('reads each field once, so a getter cannot change it after validation', () => {
      let reads = 0
      const row = {
        get sessionId(): string {
          reads += 1
          // Valid on the read the parser makes; hostile on any read after it.
          return reads === 1 ? 'study-session-01' : 'not a valid identifier'
        },
        state: 'active',
        lessonId: 'math.g5.u2.l3',
        revision: 4,
        updatedAt: '2026-08-07T13:05:00+00:00',
      }

      const parsed = parseVerifiedStudyDashboard({ sessions: [row] })
      expect(reads).toBe(1)
      expect(parsed.sessions[0]!.sessionId).toBe('study-session-01')
    })

    it('rebuilds the row as plain frozen data, carrying no accessor out', () => {
      let reads = 0
      const row = {
        get state(): string { reads += 1; return 'active' },
        sessionId: 'study-session-01',
        lessonId: 'math.g5.u2.l3',
        revision: 4,
        updatedAt: '2026-08-07T13:05:00+00:00',
      }

      const parsed = parseVerifiedStudyDashboard({ sessions: [row] })
      const descriptor = Object.getOwnPropertyDescriptor(parsed.sessions[0]!, 'state')!
      // If the accessor had survived onto the returned object, every later read
      // of `state` would run the server's code again.
      expect(descriptor.get).toBeUndefined()
      expect(descriptor.value).toBe('active')
      expect(Object.isFrozen(parsed.sessions[0])).toBe(true)
      expect(parsed.sessions[0]).not.toBe(row)

      const before = reads
      void parsed.sessions[0]!.state
      void parsed.sessions[0]!.state
      expect(reads).toBe(before)
    })

    it('refuses a getter that returns a valid value and then an invalid one', () => {
      // The same flip, on a field whose first read already fails: the refusal
      // must come from the first read rather than from a retry.
      let reads = 0
      const row = {
        get revision(): unknown { reads += 1; return reads === 1 ? 0 : 4 },
        sessionId: 'study-session-01',
        state: 'active',
        lessonId: 'math.g5.u2.l3',
        updatedAt: '2026-08-07T13:05:00+00:00',
      }
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
      expect(reads).toBe(1)
    })

    it('returns nothing at all when a getter throws', () => {
      const row = {
        get lessonId(): string { throw new Error('hostile-getter') },
        sessionId: 'study-session-01',
        state: 'active',
        revision: 4,
        updatedAt: '2026-08-07T13:05:00+00:00',
      }
      // The throw propagates rather than becoming a contract code, so the
      // dashboard renders `unavailable` instead of `malformed`. Either way no
      // part of the body reaches a learner, which is the property that matters.
      expect(() => parseVerifiedStudyDashboard({ sessions: [row] })).toThrow()
    })

    it('refuses an enumerable getter on the body envelope itself', () => {
      let reads = 0
      const body = {
        get sessions(): unknown { reads += 1; return reads === 1 ? [] : 'not an array' },
      }
      expect(parseVerifiedStudyDashboard(body).sessions).toEqual([])
      expect(reads).toBe(1)
    })
  })

  describe('arrays where objects belong, and objects where arrays belong', () => {
    it('refuses a row that is an array of the right length', () => {
      const row = ['study-session-01', 'active', 'math.g5.u2.l3', 4, '2026-08-07T13:05:00+00:00']
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })

    it('refuses an array carrying the field names as properties', () => {
      const row = Object.assign([] as unknown[], session())
      expect(Object.keys(row)).toHaveLength(5)
      refusedDashboard({ sessions: [row] }).toThrow(VerifiedStudyContractError)
    })

    it('refuses an array-like object standing in for the row list', () => {
      refusedDashboard({ sessions: { 0: session(), length: 1 } })
        .toThrow(VerifiedStudyContractError)
    })

    it('refuses a calendar block that is an array', () => {
      refusedCalendar({ blocks: [Object.values(block())] }).toThrow(VerifiedStudyContractError)
    })

    it('accepts the ordinary object form the server actually sends', () => {
      // Positive control: the refusals above must be about shape, not about
      // this suite handing the parser something broken every time.
      expect(parseVerifiedStudyDashboard({ sessions: [session()] }).sessions).toHaveLength(1)
      expect(parseVerifiedStudyCalendar({ blocks: [block()] }).blocks).toHaveLength(1)
    })
  })

  it('still leaves Object.prototype alone after every case above', () => {
    expect(pollutionProbe()).toBeUndefined()
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

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

// STUDY-A1-PROD-DASH-H3 Phase 7 — the row cap, as an invariant rather than a
// check.
//
// `for...of` over an array re-reads `length` on every step. A row whose field is
// a getter therefore gets to append more rows to the list it is being read out
// of, and the loop walks straight into them. Measured against the H2 parsers:
// one calendar block became 51, a full page of 100 became 200, and the dashboard
// sessions parser did the same at its own cap of 50.
//
// No response off `response.json()` can carry a getter, so this was never a
// shipped leak. But the contract's claim is that the result cannot hold more
// rows than the server can send, and a claim that only holds for inputs that
// happen to be inert is not the claim. The rule below is stronger than the cap:
// if the list changes at all while it is being parsed, the body is refused
// whole — never truncated to the cap, because a short, well-formed projection of
// a response the server could not have sent is exactly the invented plan these
// parsers exist to refuse.
describe('a row list that changes while it is parsed', () => {
  /** A valid row that appends `extra` more valid rows the first time it is read. */
  function appendingSession(list: unknown[], extra: number): Record<string, unknown> {
    let fired = false
    return {
      ...session(),
      get sessionId(): string {
        if (!fired) {
          fired = true
          for (let index = 0; index < extra; index += 1) list.push(session())
        }
        return 'study-session-01'
      },
    }
  }

  function appendingBlock(list: unknown[], extra: number): Record<string, unknown> {
    let fired = false
    return {
      ...block(),
      get blockId(): string {
        if (!fired) {
          fired = true
          for (let index = 0; index < extra; index += 1) list.push(block())
        }
        return 'calendar-block-01'
      },
    }
  }

  it('refuses one block that grows itself into 51', () => {
    const blocks: unknown[] = []
    blocks.push(appendingBlock(blocks, 50))
    refusedCalendar({ blocks }).toThrow(VerifiedStudyContractError)
  })

  it('refuses a full page of blocks that grows itself into two', () => {
    const blocks: unknown[] = []
    for (let index = 0; index < VERIFIED_CALENDAR_BLOCK_LIMIT; index += 1) {
      blocks.push(appendingBlock(blocks, 1))
    }
    refusedCalendar({ blocks }).toThrow(VerifiedStudyContractError)
    // The growth is real: the body under test genuinely carries a list that
    // doubles, so the refusal above is about the cap and not about the fixture
    // being malformed some other way.
    expect(blocks.length).toBe(VERIFIED_CALENDAR_BLOCK_LIMIT * 2)
  })

  it('refuses a full page of blocks that grows by exactly one', () => {
    const blocks: unknown[] = []
    for (let index = 0; index < VERIFIED_CALENDAR_BLOCK_LIMIT; index += 1) blocks.push(block())
    blocks[0] = appendingBlock(blocks, 1)
    refusedCalendar({ blocks }).toThrow(VerifiedStudyContractError)
  })

  it('refuses one session that grows itself into 51', () => {
    const sessions: unknown[] = []
    sessions.push(appendingSession(sessions, 50))
    refusedDashboard({ sessions }).toThrow(VerifiedStudyContractError)
  })

  it('refuses a full page of sessions that grows itself into two', () => {
    const sessions: unknown[] = []
    for (let index = 0; index < VERIFIED_DASHBOARD_SESSION_LIMIT; index += 1) {
      sessions.push(appendingSession(sessions, 1))
    }
    refusedDashboard({ sessions }).toThrow(VerifiedStudyContractError)
    expect(sessions.length).toBe(VERIFIED_DASHBOARD_SESSION_LIMIT * 2)
  })

  it('refuses a list that shrinks under the parse rather than reading past its end', () => {
    const blocks: unknown[] = [block(), block(), block()]
    let fired = false
    blocks[0] = {
      ...block(),
      get blockId(): string {
        if (!fired) { fired = true; blocks.length = 1 }
        return 'calendar-block-01'
      },
    }
    refusedCalendar({ blocks }).toThrow(VerifiedStudyContractError)
  })

  it('refuses growth that stays under the cap, because the body still is not the one measured', () => {
    // Nothing here exceeds 100. The refusal is not "too many rows"; it is that
    // the list the cap was checked against is not the list that was parsed.
    const blocks: unknown[] = [appendingBlock([], 0)]
    const growing: unknown[] = []
    growing.push(appendingBlock(growing, 2))
    void blocks
    refusedCalendar({ blocks: growing }).toThrow(VerifiedStudyContractError)
    expect(growing.length).toBe(3)
  })

  // STUDY-A1-PROD-DASH-H3 Phase 10 — refused, never trimmed. A parser that
  // sliced to the cap would satisfy "never more than the cap" while handing a
  // learner a plan the server never sent.
  it('never returns a truncated projection of an oversized static body', () => {
    const rows = Array.from({ length: VERIFIED_CALENDAR_BLOCK_LIMIT + 1 }, (_value, index) =>
      block({ blockId: `calendar-block-${index}` }))
    let returned: unknown = 'nothing was returned'
    try {
      returned = parseVerifiedStudyCalendar({ blocks: rows })
    } catch (error) {
      expect(error).toBeInstanceOf(VerifiedStudyContractError)
    }
    expect(returned).toBe('nothing was returned')
  })

  it('never returns a truncated projection of a body that grew', () => {
    const blocks: unknown[] = []
    blocks.push(appendingBlock(blocks, 50))
    let returned: unknown = 'nothing was returned'
    try {
      returned = parseVerifiedStudyCalendar({ blocks })
    } catch (error) {
      expect(error).toBeInstanceOf(VerifiedStudyContractError)
    }
    expect(returned).toBe('nothing was returned')
  })

  // The two halves of the fix are separately load-bearing, and each needs a body
  // that the other half cannot catch. Without these, reverting to a live
  // `for...of` or trading the cap check for a `Math.min` both stay green.
  it('reads only the indexes it measured, even when the list is put back afterwards', () => {
    // Grow far past the cap, then restore the original length from the last
    // appended row. A live `for...of` reads all 151 rows and then finds the
    // length back at 1, so the after-the-fact stability check sees nothing
    // wrong and hands back 151 blocks against a cap of 100.
    const blocks: unknown[] = []
    const restore = {
      ...block(),
      get blockId(): string { blocks.length = 1; return 'calendar-block-restore' },
    }
    let fired = false
    blocks.push({
      ...block(),
      get blockId(): string {
        if (!fired) {
          fired = true
          for (let index = 0; index < VERIFIED_CALENDAR_BLOCK_LIMIT + 49; index += 1) {
            blocks.push(block())
          }
          blocks.push(restore)
        }
        return 'calendar-block-01'
      },
    })

    refusedCalendar({ blocks }).toThrow(VerifiedStudyContractError)
    // The restoring row was never reached, which is the point: the parse walked
    // index 0 and stopped, so the list is still the grown one.
    expect(blocks.length).toBe(VERIFIED_CALENDAR_BLOCK_LIMIT + 51)
  })

  it('refuses an oversized list before parsing it, not after measuring what fits', () => {
    // A cap enforced as `Math.min(length, cap)` would parse the first 100 of
    // these 101 rows; the row that shrinks the list back to 100 then makes the
    // stability check agree, and a truncated 100-row plan is returned for a body
    // the server could not have sent. The refusal has to come from the length
    // the body arrived with.
    const blocks: unknown[] = []
    let fired = false
    blocks.push({
      ...block(),
      get blockId(): string {
        if (!fired) { fired = true; blocks.pop() }
        return 'calendar-block-01'
      },
    })
    for (let index = 1; index < VERIFIED_CALENDAR_BLOCK_LIMIT + 1; index += 1) {
      blocks.push(block({ blockId: `calendar-block-${index}` }))
    }
    expect(blocks).toHaveLength(VERIFIED_CALENDAR_BLOCK_LIMIT + 1)

    let returned: unknown = 'nothing was returned'
    try {
      returned = parseVerifiedStudyCalendar({ blocks })
    } catch (error) {
      expect(error).toBeInstanceOf(VerifiedStudyContractError)
    }
    expect(returned).toBe('nothing was returned')
  })

  it('refuses an oversized session list before parsing it', () => {
    const sessions: unknown[] = []
    let fired = false
    sessions.push({
      ...session(),
      get sessionId(): string {
        if (!fired) { fired = true; sessions.pop() }
        return 'study-session-01'
      },
    })
    for (let index = 1; index < VERIFIED_DASHBOARD_SESSION_LIMIT + 1; index += 1) {
      sessions.push(session({ sessionId: `study-session-${index}` }))
    }
    refusedDashboard({ sessions }).toThrow(VerifiedStudyContractError)
  })

  it('reads only the indexes it measured for sessions too', () => {
    const sessions: unknown[] = []
    const restore = {
      ...session(),
      get sessionId(): string { sessions.length = 1; return 'study-session-restore' },
    }
    let fired = false
    sessions.push({
      ...session(),
      get sessionId(): string {
        if (!fired) {
          fired = true
          for (let index = 0; index < VERIFIED_DASHBOARD_SESSION_LIMIT + 49; index += 1) {
            sessions.push(session())
          }
          sessions.push(restore)
        }
        return 'study-session-01'
      },
    })
    refusedDashboard({ sessions }).toThrow(VerifiedStudyContractError)
    expect(sessions.length).toBe(VERIFIED_DASHBOARD_SESSION_LIMIT + 51)
  })

  // STUDY-A1-PROD-DASH-H3 Phase 11 — the cap fix must not buy its invariant with
  // a second read of a row field. A re-read is what H2 closed.
  it('still reads each row field exactly once at a full page', () => {
    const reads = new Map<number, number>()
    const blocks = Array.from({ length: VERIFIED_CALENDAR_BLOCK_LIMIT }, (_value, index) => ({
      ...block(),
      get blockId(): string {
        reads.set(index, (reads.get(index) ?? 0) + 1)
        return `calendar-block-${index}`
      },
    }))
    expect(parseVerifiedStudyCalendar({ blocks }).blocks).toHaveLength(VERIFIED_CALENDAR_BLOCK_LIMIT)
    expect([...reads.values()]).toEqual(Array(VERIFIED_CALENDAR_BLOCK_LIMIT).fill(1))
  })

  it('still reads the body envelope exactly once', () => {
    let reads = 0
    const body = {
      get blocks(): unknown { reads += 1; return reads === 1 ? [block()] : 'not an array' },
    }
    expect(parseVerifiedStudyCalendar(body).blocks).toHaveLength(1)
    expect(reads).toBe(1)
  })

  // STUDY-A1-PROD-DASH-H3 Phase 9 — the two caps are the server's own, and they
  // are not the same number. A shared limit would silently widen `dashboard:read`
  // by fifty rows or narrow `calendar:read` by the same.
  it('holds each read to its own server cap', () => {
    expect(VERIFIED_DASHBOARD_SESSION_LIMIT).toBe(50)
    expect(VERIFIED_CALENDAR_BLOCK_LIMIT).toBe(100)
    expect(VERIFIED_DASHBOARD_SESSION_LIMIT).not.toBe(VERIFIED_CALENDAR_BLOCK_LIMIT)

    const atSessionCap = Array.from({ length: VERIFIED_DASHBOARD_SESSION_LIMIT }, (_value, index) =>
      session({ sessionId: `study-session-${index}` }))
    expect(parseVerifiedStudyDashboard({ sessions: atSessionCap }).sessions)
      .toHaveLength(VERIFIED_DASHBOARD_SESSION_LIMIT)
    refusedDashboard({ sessions: [...atSessionCap, session({ sessionId: 'study-session-over' })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([0, 1, 49, VERIFIED_DASHBOARD_SESSION_LIMIT])(
    'accepts %i static sessions in one response',
    (count) => {
      const rows = Array.from({ length: count }, (_value, index) =>
        session({ sessionId: `study-session-${index}` }))
      expect(parseVerifiedStudyDashboard({ sessions: rows }).sessions).toHaveLength(count)
    },
  )
})

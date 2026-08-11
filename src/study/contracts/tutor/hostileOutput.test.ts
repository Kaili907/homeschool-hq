import { describe, expect, it } from 'vitest'
import { STUDY_TUTOR_RESULT_KEYS, acceptStudyTutorResult, parseStudyTutorResult } from './results'

/**
 * STUDY-A1-TUTOR-CONTRACT-H4 — the hostile-output classes, pinned.
 *
 * The independent H3 review exercised these by hand and found the contract
 * behaved correctly, but noted that not all of them were held by a test. An
 * unpinned correct behaviour is the same liability as an unpinned type: it is
 * right until someone simplifies it.
 *
 * THE HONEST STATEMENT ABOUT PROXIES, because it is the one that is easy to get
 * wrong in a comment:
 *
 *   The exact-key check is NOT what makes a Proxy safe. `hasExactKeys` calls
 *   `Reflect.ownKeys`, and `ownKeys` is a trap — a Proxy may report three keys
 *   while its target holds a transcript and a bearer, and the check will pass.
 *   That is not a defect being excused; it is a limit of any key-counting
 *   approach, and it is demonstrated below rather than asserted away.
 *
 *   What makes it safe is the REBUILD. `parseStudyTutorResult` reads the named
 *   fields once each, validates them, and returns a NEW frozen object built
 *   field by field. Nothing it did not name can travel, whatever the source
 *   reported about itself. So the tests below assert the property that actually
 *   holds — the output is a fresh, frozen, exactly-keyed plain object — rather
 *   than the property that does not.
 */

const VALID_EVENT_REF = 'event.1'

describe('H4 — a Proxy that lies about its own keys', () => {
  const SMUGGLED = {
    status: 'accepted',
    eventRef: VALID_EVENT_REF,
    visibleText: 'Nice work on that one.',
    transcript: ['she said she was scared', 'then she said she was fine'],
    bearer: 'adult-bearer-token',
    studentId: 'learner:real-child',
  }

  const lying = new Proxy(SMUGGLED, {
    // Legal: every smuggled property is configurable, so the trap may omit it.
    ownKeys: () => ['status', 'eventRef', 'visibleText'],
    getOwnPropertyDescriptor: (target, key) => Reflect.getOwnPropertyDescriptor(target, key),
  })

  it('really does defeat the key-count check, and this test says so', () => {
    // The uncomfortable half, stated first. If this ever starts failing, the
    // reasoning below has changed and the comment above is stale.
    expect(Reflect.ownKeys(lying)).toEqual([...STUDY_TUTOR_RESULT_KEYS.accepted])
    expect(Reflect.ownKeys(lying)).toHaveLength(STUDY_TUTOR_RESULT_KEYS.accepted.length)
    // ...while the smuggled fields are still reachable on the value itself.
    expect(Object.hasOwn(lying, 'transcript')).toBe(true)
    expect((lying as { bearer?: string }).bearer).toBe('adult-bearer-token')
  })

  it('is therefore ACCEPTED — and the rebuild is what keeps it harmless', () => {
    const parsed = parseStudyTutorResult(lying)

    // Not rejected. Pretending otherwise would be the comfortable answer and
    // the wrong one.
    expect(parsed).not.toBeNull()
    expect(parsed).toEqual({
      status: 'accepted',
      eventRef: VALID_EVENT_REF,
      visibleText: 'Nice work on that one.',
    })

    // The guarantee that does hold, and it is the one that matters: a fresh
    // object, exactly keyed, frozen, and not the Proxy.
    expect(parsed).not.toBe(lying)
    expect(parsed).not.toBe(SMUGGLED)
    expect(Reflect.ownKeys(parsed!)).toEqual([...STUDY_TUTOR_RESULT_KEYS.accepted])
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)

    // Nothing the Proxy hid came across, under any lookup.
    for (const forbidden of ['transcript', 'bearer', 'studentId']) {
      expect(Object.hasOwn(parsed!, forbidden), forbidden).toBe(false)
      expect((parsed as unknown as Record<string, unknown>)[forbidden], forbidden).toBeUndefined()
    }
  })

  it('cannot use a get trap to answer the check and the rebuild differently', () => {
    let reads = 0
    const shifting = new Proxy({ status: 'accepted', eventRef: VALID_EVENT_REF, visibleText: 'ok' }, {
      get(target, key, receiver) {
        if (key === 'visibleText') {
          reads += 1
          return reads === 1 ? 'ok' : 'call your mother, you are not safe'
        }
        return Reflect.get(target, key, receiver)
      },
    })
    const parsed = parseStudyTutorResult(shifting)
    // The value KEPT is the value CHECKED: one read, and the second answer is
    // never the one that reaches a learner.
    expect(reads).toBe(1)
    expect(parsed).toEqual({ status: 'accepted', eventRef: VALID_EVENT_REF, visibleText: 'ok' })
  })

  it('refuses a Proxy that reports approved keys it does not have', () => {
    // The other direction: `ownKeys` claims the right three, but the value has
    // nothing behind them. `Object.hasOwn` consults the target, so this fails.
    const empty = new Proxy({} as Record<string, unknown>, {
      ownKeys: () => ['status', 'eventRef', 'visibleText'],
      getOwnPropertyDescriptor: () => undefined,
    })
    expect(parseStudyTutorResult(empty)).toBeNull()
  })
})

describe('H4 — a class instance as a result', () => {
  class TutorResultLikeObject {
    readonly status = 'accepted'
    readonly eventRef = VALID_EVENT_REF
    readonly visibleText = 'Nice work on that one.'

    /** On the prototype, so not an own key — and it must not travel. */
    escalate(): string {
      return 'clear the safety stop'
    }

    get transcript(): readonly string[] {
      return ['she said she was scared']
    }
  }

  it('accepts it on its own keys, and hands the host a plain object instead', () => {
    const instance = new TutorResultLikeObject()
    // Class fields are own properties; accessors and methods are not. So the
    // instance genuinely has the exact three keys.
    expect(Reflect.ownKeys(instance)).toEqual([...STUDY_TUTOR_RESULT_KEYS.accepted])

    const parsed = parseStudyTutorResult(instance)
    expect(parsed).toEqual({
      status: 'accepted',
      eventRef: VALID_EVENT_REF,
      visibleText: 'Nice work on that one.',
    })

    // The point of the rebuild, at its sharpest: the host is not holding the
    // implementation's object, so it cannot reach `escalate`, cannot reach the
    // `transcript` accessor, and holds nothing the class closed over.
    expect(parsed).not.toBe(instance)
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)
    expect(parsed).not.toBeInstanceOf(TutorResultLikeObject)
    expect((parsed as unknown as { escalate?: unknown }).escalate).toBeUndefined()
    expect((parsed as unknown as { transcript?: unknown }).transcript).toBeUndefined()
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it('refuses an instance whose class adds a fourth own field', () => {
    class WithExtra {
      readonly status = 'accepted'
      readonly eventRef = VALID_EVENT_REF
      readonly visibleText = 'ok'
      readonly householdId = 'household:real-family'
    }
    expect(parseStudyTutorResult(new WithExtra())).toBeNull()
  })
})

describe('H4 — an array as a result', () => {
  it('refuses arrays, however they are dressed up', () => {
    for (const value of [
      [],
      ['accepted'],
      [{ status: 'accepted', eventRef: VALID_EVENT_REF, visibleText: 'ok' }],
      Object.assign([], { status: 'accepted', eventRef: VALID_EVENT_REF, visibleText: 'ok' }),
    ]) {
      expect(parseStudyTutorResult(value), JSON.stringify(value)).toBeNull()
    }
  })

  it('refuses an array-like object that is not an array', () => {
    // `isRecord` rejects arrays by `Array.isArray`; an array-LIKE is rejected by
    // the exact-key check instead. Both fail closed.
    expect(parseStudyTutorResult({ 0: 'accepted', length: 1 })).toBeNull()
  })

  it('refuses an array-valued interruption', () => {
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: ['rate-limit'] })).toBeNull()
    expect(parseStudyTutorResult({ status: 'interrupted', interruption: [] })).toBeNull()
  })
})

describe('H4 — a __proto__ pollution attempt', () => {
  it('refuses a JSON result carrying an own __proto__ key', () => {
    // `JSON.parse` creates `__proto__` as an ORDINARY own property rather than
    // invoking the setter, so it is visible to `Reflect.ownKeys` — a fourth key,
    // and therefore a rejection.
    const parsedJson = JSON.parse(
      `{"status":"accepted","eventRef":"${VALID_EVENT_REF}","visibleText":"ok","__proto__":{"polluted":true}}`,
    )
    expect(Object.hasOwn(parsedJson, '__proto__')).toBe(true)
    expect(parseStudyTutorResult(parsedJson)).toBeNull()
  })

  it('pollutes nothing, whether the attempt is refused or accepted', () => {
    const before = ({} as Record<string, unknown>).polluted
    expect(before).toBeUndefined()

    parseStudyTutorResult(JSON.parse('{"__proto__":{"polluted":"yes"}}'))
    parseStudyTutorResult(JSON.parse(
      `{"status":"quarantined","reasonCode":"x-code","__proto__":{"polluted":"yes"}}`,
    ))
    acceptStudyTutorResult(JSON.parse('{"__proto__":{"polluted":"yes"}}'))

    // Neither the refusal path nor the quarantine path writes through to
    // Object.prototype, and a later plain object is unaffected.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('rebuilds onto a clean prototype even when the source has a hostile one', () => {
    const hostile = Object.create({ escalate: () => 'clear the stop' }) as Record<string, unknown>
    hostile.status = 'quarantined'
    hostile.reasonCode = 'x-code'

    const parsed = parseStudyTutorResult(hostile)
    expect(parsed).toEqual({ status: 'quarantined', reasonCode: 'x-code' })
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype)
    expect((parsed as unknown as { escalate?: unknown }).escalate).toBeUndefined()
  })

  it('does not let a poisoned Object.prototype invent an approved result', () => {
    // The inverse attack: if something else in the process has already polluted
    // the prototype, an empty object must still not look like a result.
    const polluted = Object.prototype as unknown as Record<string, unknown>
    try {
      polluted.status = 'accepted'
      polluted.eventRef = VALID_EVENT_REF
      polluted.visibleText = 'ok'
      // Own keys are what the contract counts, and `{}` has none.
      expect(parseStudyTutorResult({})).toBeNull()
      expect(acceptStudyTutorResult({}).status).toBe('quarantined')
    } finally {
      delete polluted.status
      delete polluted.eventRef
      delete polluted.visibleText
    }
    expect((Object.prototype as unknown as Record<string, unknown>).status).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1,
  PRODUCTION_WIRE_MAX_ACTIVE_SECONDS,
  PRODUCTION_WIRE_MAX_SEGMENTS,
  parseProductionCheckpointCasRequestV1,
  parseProductionCheckpointCasResultV1,
  parseProductionCheckpointReadRequestV1,
  parseProductionCheckpointReadResultV1,
  parseProductionCheckpointWireV1,
} from './index'

function checkpoint(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    contentPolicy: PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1,
    checkpointRef: 'checkpoint:one',
    lessonRef: 'lesson:fractions',
    segmentRef: 'segment:guided-practice',
    completedSegmentRefs: ['segment:warm-up'],
    elapsedActiveSecondsInSegment: 125,
    lastAcceptedEventRef: 'tutor-event:accepted-1',
    ...overrides,
  }
}

function cas(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionRef: 'session:one',
    expectedRevision: 4,
    mutationRef: 'mutation:checkpoint-5',
    checkpoint: checkpoint(),
    ...overrides,
  }
}

const instant = '2026-08-11T15:04:05.123Z'

describe('ProductionCheckpointWireV1 privacy and bounds', () => {
  it('parses and rebuilds the dedicated learner-content-excluded checkpoint', () => {
    const source = checkpoint()
    const parsed = parseProductionCheckpointWireV1(source)
    expect(parsed).toEqual(source)
    expect(parsed).not.toBe(source)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.isFrozen(parsed?.completedSegmentRefs)).toBe(true)
    expect(Object.keys(parsed!).sort()).toEqual([
      'checkpointRef',
      'completedSegmentRefs',
      'contentPolicy',
      'elapsedActiveSecondsInSegment',
      'lastAcceptedEventRef',
      'lessonRef',
      'schemaVersion',
      'segmentRef',
    ])
  })

  it.each([
    ['raw learner answer', { rawAnswer: '7/8' }],
    ['Tutor conversation', { tutorConversation: ['Try again'] }],
    ['Tutor transcript', { transcript: 'learner said...' }],
    ['Tutor cursor', { tutorCursor: { turn: 4 } }],
    ['protected work', { protectedWorkRef: 'protected:one' }],
    ['diagnostic data', { diagnostic: { confidence: 0.4 } }],
    ['emotional data', { emotionalState: 'frustrated' }],
    ['personality data', { personality: 'persistent' }],
  ])('rejects %s even when it is an extra property', (_label, extra) => {
    expect(parseProductionCheckpointWireV1(checkpoint(extra))).toBeNull()
  })

  it.each([
    ['sessionRef', 'session:duplicated'],
    ['revision', 4],
    ['expectedRevision', 4],
    ['storedAt', instant],
  ])('does not duplicate server-owned %s inside the checkpoint payload', (key, value) => {
    expect(parseProductionCheckpointWireV1(checkpoint({ [key]: value }))).toBeNull()
  })

  it('pins the content policy and refuses missing or unknown keys', () => {
    expect(parseProductionCheckpointWireV1(checkpoint({ contentPolicy: 'content-maybe-v1' }))).toBeNull()
    const missing = checkpoint()
    delete missing.segmentRef
    expect(parseProductionCheckpointWireV1(missing)).toBeNull()
    expect(parseProductionCheckpointWireV1({ ...checkpoint(), harmless: true })).toBeNull()
  })

  it('bounds progress arrays and counters without truncation or deduplication', () => {
    const maximum = Array.from({ length: PRODUCTION_WIRE_MAX_SEGMENTS }, (_value, index) => `segment:${index}`)
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: maximum }))).not.toBeNull()
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: [...maximum, 'segment:overflow'] }))).toBeNull()
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: ['segment:a', 'segment:a'] }))).toBeNull()
    expect(parseProductionCheckpointWireV1(checkpoint({ elapsedActiveSecondsInSegment: PRODUCTION_WIRE_MAX_ACTIVE_SECONDS }))).not.toBeNull()
    for (const invalid of [-1, PRODUCTION_WIRE_MAX_ACTIVE_SECONDS + 1, 1.5, '125']) {
      expect(parseProductionCheckpointWireV1(checkpoint({ elapsedActiveSecondsInSegment: invalid }))).toBeNull()
    }
  })

  it('rejects privacy, hidden, and symbol payloads attached to progress arrays', () => {
    for (const key of ['rawAnswer', 'transcript', 'protectedWork']) {
      const carryingPrivacy = Object.assign(['segment:warm-up'], { [key]: 'secret' })
      expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: carryingPrivacy })), key).toBeNull()
    }

    const hidden = ['segment:warm-up']
    Object.defineProperty(hidden, 'rawAnswer', { value: 'secret', enumerable: false })
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: hidden }))).toBeNull()

    const symbol = Object.assign(['segment:warm-up'], { [Symbol('transcript')]: 'secret' })
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: symbol }))).toBeNull()
  })

  it('rejects sparse, inherited, and accessor-filled progress arrays', () => {
    const sparse = new Array<string>(1)
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: sparse }))).toBeNull()

    const inherited = new Array<string>(1)
    const inheritedIndex = Object.create(Array.prototype) as unknown[]
    Object.defineProperty(inheritedIndex, '0', { value: 'segment:warm-up', enumerable: true })
    Object.setPrototypeOf(inherited, inheritedIndex)
    expect(inherited[0]).toBe('segment:warm-up')
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: inherited }))).toBeNull()

    const accessor = ['segment:warm-up']
    let reads = 0
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get() {
        reads += 1
        return 'segment:warm-up'
      },
    })
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: accessor }))).toBeNull()
    expect(reads).toBe(0)
  })

  it('rejects dense arrays carrying inherited privacy or symbol payloads', () => {
    const inheritedPrivacy = ['segment:warm-up']
    const privacyPrototype = Object.create(Array.prototype) as unknown[]
    Object.defineProperty(privacyPrototype, 'rawAnswer', { value: 'secret', enumerable: true })
    Object.setPrototypeOf(inheritedPrivacy, privacyPrototype)
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: inheritedPrivacy }))).toBeNull()

    const inheritedSymbol = ['segment:warm-up']
    const symbolPrototype = Object.create(Array.prototype) as unknown[]
    Object.defineProperty(symbolPrototype, Symbol('transcript'), { value: 'secret', enumerable: true })
    Object.setPrototypeOf(inheritedSymbol, symbolPrototype)
    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: inheritedSymbol }))).toBeNull()
  })

  it('uses one descriptor snapshot per array field and no live array reads', () => {
    const source = ['segment:warm-up']
    const descriptorReads = new Map<PropertyKey, number>()
    const snapshotOnly = new Proxy(source, {
      get() {
        throw new Error('live array read')
      },
      getOwnPropertyDescriptor(target, key) {
        descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1)
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })

    expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs: snapshotOnly }))).not.toBeNull()
    expect([...descriptorReads.entries()]).toEqual([
      ['length', 1],
      ['0', 1],
    ])
  })

  it('returns null for hostile array key and descriptor traps', () => {
    const hostilePrototype = new Proxy(['segment:warm-up'], {
      getPrototypeOf() {
        throw new Error('hostile-array-prototype')
      },
    })
    const hostileKeys = new Proxy(['segment:warm-up'], {
      ownKeys() {
        throw new Error('hostile-array-keys')
      },
    })
    const hostileDescriptor = new Proxy(['segment:warm-up'], {
      getOwnPropertyDescriptor() {
        throw new Error('hostile-array-descriptor')
      },
    })

    for (const completedSegmentRefs of [hostilePrototype, hostileKeys, hostileDescriptor]) {
      expect(() => parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs }))).not.toThrow()
      expect(parseProductionCheckpointWireV1(checkpoint({ completedSegmentRefs }))).toBeNull()
    }
  })
})

describe('checkpoint network requests', () => {
  it('requires exactly sessionRef for read and the four pinned CAS fields', () => {
    expect(parseProductionCheckpointReadRequestV1({ schemaVersion: 1, sessionRef: 'session:one' }))
      .toEqual({ schemaVersion: 1, sessionRef: 'session:one' })
    expect(parseProductionCheckpointCasRequestV1(cas())).not.toBeNull()
    expect(Object.keys(parseProductionCheckpointCasRequestV1(cas())!).sort()).toEqual([
      'checkpoint', 'expectedRevision', 'mutationRef', 'schemaVersion', 'sessionRef',
    ])
  })

  it('accepts null only as the assertion that no checkpoint exists yet', () => {
    expect(parseProductionCheckpointCasRequestV1(cas({ expectedRevision: null })))
      .toMatchObject({ expectedRevision: null })
    for (const invalid of [0, -1, 1.5, '4', Number.MAX_SAFE_INTEGER + 1, undefined]) {
      expect(parseProductionCheckpointCasRequestV1(cas({ expectedRevision: invalid })), String(invalid)).toBeNull()
    }
  })

  it('rejects oversized refs and never admits request timestamps', () => {
    expect(parseProductionCheckpointCasRequestV1(cas({ sessionRef: `s${'x'.repeat(160)}` }))).toBeNull()
    expect(parseProductionCheckpointCasRequestV1({ ...cas(), transitionedAt: instant })).toBeNull()
    expect(parseProductionCheckpointCasRequestV1({ ...cas(), capturedAt: instant })).toBeNull()
  })

  it('rejects privacy fields at both CAS envelope and nested checkpoint levels', () => {
    expect(parseProductionCheckpointCasRequestV1({ ...cas(), learnerAnswer: '42' })).toBeNull()
    expect(parseProductionCheckpointCasRequestV1(cas({ checkpoint: checkpoint({ transcript: 'secret' }) }))).toBeNull()
  })
})

describe('checkpoint operation-specific results', () => {
  it('parses exact found, not-found, and integrity-failed read outcomes', () => {
    expect(parseProductionCheckpointReadResultV1({
      schemaVersion: 1,
      status: 'found',
      sessionRef: 'session:one',
      revision: 5,
      storedAt: instant,
      checkpoint: checkpoint(),
    })?.status).toBe('found')
    expect(parseProductionCheckpointReadResultV1({ schemaVersion: 1, status: 'not-found' })?.status).toBe('not-found')
    expect(parseProductionCheckpointReadResultV1({ schemaVersion: 1, status: 'integrity-failed' })?.status).toBe('integrity-failed')
  })

  it('requires server-owned revision and timestamp on stored CAS results', () => {
    expect(parseProductionCheckpointCasResultV1({
      schemaVersion: 1, status: 'stored', revision: 5, storedAt: instant,
    })?.status).toBe('stored')
    expect(parseProductionCheckpointCasResultV1({
      schemaVersion: 1, status: 'duplicate-replay', revision: 5, storedAt: instant,
    })?.status).toBe('duplicate-replay')
    expect(parseProductionCheckpointCasResultV1({ schemaVersion: 1, status: 'stored', revision: 5 })).toBeNull()
    expect(parseProductionCheckpointCasResultV1({
      schemaVersion: 1, status: 'stored', revision: 0, storedAt: instant,
    })).toBeNull()
  })

  it('does not make read-only or transition-only outcomes legal on CAS', () => {
    expect(parseProductionCheckpointCasResultV1({ schemaVersion: 1, status: 'found' })).toBeNull()
    expect(parseProductionCheckpointCasResultV1({ schemaVersion: 1, status: 'illegal-transition' })).toBeNull()
    expect(parseProductionCheckpointReadResultV1({ schemaVersion: 1, status: 'stored', revision: 2, storedAt: instant })).toBeNull()
    expect(parseProductionCheckpointReadResultV1({ schemaVersion: 1, status: 'revision-conflict', currentRevision: 2 })).toBeNull()
  })

  it.each([
    { schemaVersion: 1, status: 'revision-conflict', currentRevision: 6 },
    { schemaVersion: 1, status: 'idempotency-collision' },
    { schemaVersion: 1, status: 'quarantined' },
    { schemaVersion: 1, status: 'integrity-failed' },
    { schemaVersion: 1, status: 'auth-refused' },
    { schemaVersion: 1, status: 'auth-infrastructure-unavailable' },
    { schemaVersion: 1, status: 'rate-limited' },
    { schemaVersion: 1, status: 'server-unavailable' },
  ])('admits the safe CAS outcome $status with its exact shape', (outcome) => {
    expect(parseProductionCheckpointCasResultV1(outcome)?.status).toBe(outcome.status)
    expect(parseProductionCheckpointCasResultV1({ ...outcome, message: 'server prose' })).toBeNull()
  })
})

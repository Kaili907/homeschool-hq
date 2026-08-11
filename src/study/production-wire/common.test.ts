import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_WIRE_IDENTIFIER_MAX_LENGTH,
  parseProductionEventIdV1,
  parseProductionEventRefV1,
  parseProductionIdempotencyKeyV1,
  parseProductionLearnerEventAppendRequestV1,
  parseProductionMutationRefV1,
  parseProductionOperationRefV1,
  type ProductionEventIdV1,
  type ProductionEventRefV1,
  type ProductionIdempotencyKeyV1,
  type ProductionMutationRefV1,
  type ProductionOperationRefV1,
} from './index'

const identifierParsers = {
  eventId: parseProductionEventIdV1,
  eventRef: parseProductionEventRefV1,
  idempotencyKey: parseProductionIdempotencyKeyV1,
  mutationRef: parseProductionMutationRefV1,
  operationRef: parseProductionOperationRefV1,
} as const

const eventRequest = () => ({
  schemaVersion: 1,
  eventKind: 'tutor_event_accepted',
  sessionRef: 'session:one',
  eventId: 'event:id-1',
  eventRef: 'event:ref-1',
  idempotencyKey: 'idempotency:key-1',
  operationRef: 'operation:ref-1',
})

describe('production wire identifier semantics', () => {
  it('accepts each nominal identifier through its own parser', () => {
    expect(parseProductionEventIdV1('event:id-1')).toBe('event:id-1')
    expect(parseProductionEventRefV1('tutor:event-ref-1')).toBe('tutor:event-ref-1')
    expect(parseProductionIdempotencyKeyV1('idem:event-1')).toBe('idem:event-1')
    expect(parseProductionMutationRefV1('mutation:checkpoint-1')).toBe('mutation:checkpoint-1')
    expect(parseProductionOperationRefV1('operation:session-1')).toBe('operation:session-1')
  })

  it('rejects malformed and oversized identifiers without truncating', () => {
    const prefix = 'event:id-'
    const exact = `${prefix}${'b'.repeat(PRODUCTION_WIRE_IDENTIFIER_MAX_LENGTH - prefix.length)}`
    const oversized = `${exact}c`
    expect(parseProductionEventIdV1(exact)).toBe(exact)
    expect(parseProductionEventIdV1(oversized)).toBeNull()
    expect(parseProductionEventIdV1(oversized.slice(0, PRODUCTION_WIRE_IDENTIFIER_MAX_LENGTH))).toBe(exact)
    for (const invalid of ['', '.leading', 'has space', 'learner@example.com', 7, null]) {
      expect(parseProductionEventRefV1(invalid), String(invalid)).toBeNull()
    }
  })

  it.each([
    ['eventId', 'event:id-1'],
    ['eventId', 'ledger-event:one'],
    ['eventRef', 'event:ref-1'],
    ['eventRef', 'tutor:event-ref-1'],
    ['eventRef', 'tutor-event:accepted-one'],
    ['idempotencyKey', 'idem:event-1'],
    ['idempotencyKey', 'idempotency:key-1'],
    ['mutationRef', 'mutation:ref-1'],
    ['operationRef', 'operation:ref-1'],
  ] as const)('accepts %s fixture %s through that parser alone', (family, value) => {
    const acceptedBy = Object.entries(identifierParsers)
      .filter(([_candidate, parse]) => parse(value) !== null)
      .map(([candidate]) => candidate)
    expect(acceptedBy).toEqual([family])
  })

  it('rejects every pairwise swap of event request identity values', () => {
    const identities = ['sessionRef', 'eventId', 'eventRef', 'idempotencyKey', 'operationRef'] as const
    const request = eventRequest()
    for (let left = 0; left < identities.length; left += 1) {
      for (let right = left + 1; right < identities.length; right += 1) {
        const leftKey = identities[left]
        const rightKey = identities[right]
        const swapped = {
          ...request,
          [leftKey]: request[rightKey],
          [rightKey]: request[leftKey],
        }
        expect(parseProductionLearnerEventAppendRequestV1(swapped), `${leftKey}<->${rightKey}`).toBeNull()
      }
    }
  })

  it('keeps eventId, eventRef, idempotencyKey, mutationRef and operationRef nominally distinct', () => {
    const eventId = parseProductionEventIdV1('event:id-1')!
    const eventRef = parseProductionEventRefV1('event:ref-1')!
    const idempotencyKey = parseProductionIdempotencyKeyV1('idempotency:key-1')!
    const mutationRef = parseProductionMutationRefV1('mutation:ref-1')!
    const operationRef = parseProductionOperationRefV1('operation:ref-1')!

    const acceptsEventId = (_value: ProductionEventIdV1) => true
    const acceptsEventRef = (_value: ProductionEventRefV1) => true
    const acceptsIdempotencyKey = (_value: ProductionIdempotencyKeyV1) => true
    const acceptsMutationRef = (_value: ProductionMutationRefV1) => true
    const acceptsOperationRef = (_value: ProductionOperationRefV1) => true

    expect(acceptsEventId(eventId)).toBe(true)
    expect(acceptsEventRef(eventRef)).toBe(true)
    expect(acceptsIdempotencyKey(idempotencyKey)).toBe(true)
    expect(acceptsMutationRef(mutationRef)).toBe(true)
    expect(acceptsOperationRef(operationRef)).toBe(true)

    // @ts-expect-error a Tutor event reference is not the ledger event identity
    acceptsEventId(eventRef)
    // @ts-expect-error an event id is not an endpoint replay identity
    acceptsIdempotencyKey(eventId)
    // @ts-expect-error a lifecycle operation may contain multiple durable mutations
    acceptsMutationRef(operationRef)
    // @ts-expect-error a durable mutation is not the lifecycle operation containing it
    acceptsOperationRef(mutationRef)
  })

  it('rejects hidden, symbol, inherited, and hostile input instead of throwing', () => {
    const request = eventRequest()
    const hidden = { ...request }
    Object.defineProperty(hidden, 'rawAnswer', { value: '42', enumerable: false })
    expect(parseProductionLearnerEventAppendRequestV1(hidden)).toBeNull()

    const hiddenExpected = { ...request }
    Object.defineProperty(hiddenExpected, 'eventKind', {
      value: 'tutor_event_accepted',
      enumerable: false,
    })
    expect(parseProductionLearnerEventAppendRequestV1(hiddenExpected)).toBeNull()

    const symbol = { ...request, [Symbol('transcript')]: 'secret' }
    expect(parseProductionLearnerEventAppendRequestV1(symbol)).toBeNull()

    const inherited = Object.assign(Object.create({ studentId: 'claimed' }), request)
    expect(parseProductionLearnerEventAppendRequestV1(inherited)).toBeNull()

    const hostile = new Proxy(request, {
      ownKeys() {
        throw new Error('hostile-own-keys')
      },
    })
    expect(() => parseProductionLearnerEventAppendRequestV1(hostile)).not.toThrow()
    expect(parseProductionLearnerEventAppendRequestV1(hostile)).toBeNull()

    const hostileDescriptor = new Proxy(request, {
      getOwnPropertyDescriptor() {
        throw new Error('hostile-descriptor')
      },
    })
    expect(() => parseProductionLearnerEventAppendRequestV1(hostileDescriptor)).not.toThrow()
    expect(parseProductionLearnerEventAppendRequestV1(hostileDescriptor)).toBeNull()
  })

  it('snapshots each data descriptor once and never reads the live caller object', () => {
    const request = eventRequest()
    const descriptorReads = new Map<PropertyKey, number>()
    const hostileLiveReads = new Proxy(request, {
      get() {
        throw new Error('live caller read')
      },
      getOwnPropertyDescriptor(target, key) {
        descriptorReads.set(key, (descriptorReads.get(key) ?? 0) + 1)
        return Reflect.getOwnPropertyDescriptor(target, key)
      },
    })

    expect(parseProductionLearnerEventAppendRequestV1(hostileLiveReads)).toEqual(request)
    expect([...descriptorReads.entries()]).toEqual(
      Reflect.ownKeys(request).map((key) => [key, 1]),
    )
  })
})

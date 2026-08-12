import { describe, expect, it } from 'vitest'
import { canStudentResume, createInitialSafetyState, createSafetyHold, getOpenSafetyHold } from './holdStore'
import {
  parseSafetyStateJson,
  parseSafetyStateJsonWithRecovery,
  parseSafetyStateValue,
  parseSafetyStateValueWithRecovery,
  serializeSafetyState,
} from './persistence'

describe('reload / snapshot round trip (requirement 3)', () => {
  it('preserves an open hold across a serialize -> parse cycle (simulated browser reload)', () => {
    const { state } = createSafetyHold(createInitialSafetyState(), {
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      createdAt: '2026-08-12T12:00:00.000Z',
      reasonCode: 'study-safety-urgent',
      source: 'study-safety',
    })
    const reloaded = parseSafetyStateJson(serializeSafetyState(state))
    expect(canStudentResume(reloaded, 'student:amelia', 'session:1')).toBe(false)
    expect(getOpenSafetyHold(reloaded, 'student:amelia')).toMatchObject({ status: 'open', reasonCode: 'study-safety-urgent' })
  })
})

describe('malformed persisted state recovers conservatively (requirement 9)', () => {
  it('recovers to an empty state on unparseable JSON, without throwing', () => {
    expect(() => parseSafetyStateJson('{not json')).not.toThrow()
    const recovered = parseSafetyStateJson('{not json')
    expect(recovered.holds).toEqual([])
  })

  it('recovers to an empty state when there is nothing persisted yet', () => {
    expect(parseSafetyStateJson(null).holds).toEqual([])
    expect(parseSafetyStateJson(undefined).holds).toEqual([])
    expect(parseSafetyStateJson('').holds).toEqual([])
  })

  it('recovers to an empty state when the top-level shape is wrong', () => {
    expect(parseSafetyStateValue('a string').holds).toEqual([])
    expect(parseSafetyStateValue(42).holds).toEqual([])
    expect(parseSafetyStateValue({ holds: 'not-an-array' }).holds).toEqual([])
    expect(parseSafetyStateValue([1, 2, 3]).holds).toEqual([])
  })

  it('drops individual hold entries with no identifiable student/session, keeping the rest', () => {
    const recovered = parseSafetyStateValue({
      schemaVersion: 1,
      holds: [
        { garbage: true },
        null,
        'not-an-object',
        {
          schemaVersion: 1,
          holdRef: 'hold:1',
          studentRef: 'student:amelia',
          sessionRef: 'session:1',
          createdAt: '2026-08-12T12:00:00.000Z',
          status: 'open',
          reasonCode: 'study-safety-urgent',
          source: 'study-safety',
          dedupeKey: 'k1',
        },
      ],
    })
    expect(recovered.holds).toHaveLength(1)
    expect(recovered.holds[0]).toMatchObject({ holdRef: 'hold:1', status: 'open' })
  })

  it('conservatively treats a missing/corrupt status as open rather than dropping the hold or defaulting to cleared', () => {
    const recovered = parseSafetyStateValue({
      schemaVersion: 1,
      holds: [
        {
          schemaVersion: 1,
          holdRef: 'hold:corrupt-status',
          studentRef: 'student:amelia',
          sessionRef: 'session:1',
          createdAt: '2026-08-12T12:00:00.000Z',
          status: 12345, // corrupted field, not a string
          reasonCode: 'study-safety-urgent',
          source: 'study-safety',
          dedupeKey: 'k1',
        },
      ],
    })
    expect(recovered.holds).toHaveLength(1)
    expect(recovered.holds[0]!.status).toBe('open')
    expect(canStudentResume(recovered, 'student:amelia', 'session:1')).toBe(false)
  })

  it('conservatively keeps a hold blocking when reasonCode/source/dedupeKey are corrupted, since those are metadata, not identity', () => {
    const recovered = parseSafetyStateValue({
      schemaVersion: 1,
      holds: [
        {
          schemaVersion: 1,
          holdRef: 'hold:corrupt-metadata',
          studentRef: 'student:amelia',
          sessionRef: 'session:1',
          createdAt: '2026-08-12T12:00:00.000Z',
          status: 'open',
          reasonCode: null, // corrupted field, not a string
          source: 12345, // corrupted field, not a string
          dedupeKey: {}, // corrupted field, not a string
        },
      ],
    })
    expect(recovered.holds).toHaveLength(1)
    expect(recovered.holds[0]).toMatchObject({ holdRef: 'hold:corrupt-metadata', status: 'open' })
    expect(recovered.holds[0]!.reasonCode).toBeTruthy()
    expect(recovered.holds[0]!.source).toBeTruthy()
    expect(recovered.holds[0]!.dedupeKey).toBeTruthy()
    expect(canStudentResume(recovered, 'student:amelia', 'session:1')).toBe(false)
  })

  it('never silently treats an unrecognised status string as cleared', () => {
    const recovered = parseSafetyStateValue({
      schemaVersion: 1,
      holds: [
        {
          schemaVersion: 1,
          holdRef: 'hold:future-status',
          studentRef: 'student:amelia',
          sessionRef: 'session:1',
          createdAt: '2026-08-12T12:00:00.000Z',
          status: 'some-future-status-value',
          reasonCode: 'study-safety-urgent',
          source: 'study-safety',
          dedupeKey: 'k1',
        },
      ],
    })
    expect(canStudentResume(recovered, 'student:amelia', 'session:1')).toBe(false)
  })
})

describe('recovery-state signal distinguishes corruption from "never persisted"', () => {
  it('is "available" when nothing was ever persisted', () => {
    expect(parseSafetyStateJsonWithRecovery(null).recoveryState).toBe('available')
    expect(parseSafetyStateJsonWithRecovery(undefined).recoveryState).toBe('available')
    expect(parseSafetyStateJsonWithRecovery('').recoveryState).toBe('available')
    expect(parseSafetyStateValueWithRecovery(undefined).recoveryState).toBe('available')
  })

  it('is "available" for a fully valid, non-empty state', () => {
    const { state } = createSafetyHold(createInitialSafetyState(), {
      studentRef: 'student:amelia',
      sessionRef: 'session:1',
      createdAt: '2026-08-12T12:00:00.000Z',
      reasonCode: 'study-safety-urgent',
      source: 'study-safety',
    })
    expect(parseSafetyStateJsonWithRecovery(serializeSafetyState(state)).recoveryState).toBe('available')
  })

  it('is "unavailable" — not "available" — for unparseable JSON, so a host can tell the two apart', () => {
    const result = parseSafetyStateJsonWithRecovery('{not json')
    expect(result.recoveryState).toBe('unavailable')
    expect(result.state.holds).toEqual([])
  })

  it('is "unavailable" for a wrong top-level shape', () => {
    expect(parseSafetyStateValueWithRecovery('a string').recoveryState).toBe('unavailable')
    expect(parseSafetyStateValueWithRecovery(42).recoveryState).toBe('unavailable')
    expect(parseSafetyStateValueWithRecovery({ holds: 'not-an-array' }).recoveryState).toBe('unavailable')
    expect(parseSafetyStateValueWithRecovery([1, 2, 3]).recoveryState).toBe('unavailable')
  })

  it('is "incomplete" when the container parses but an entry is unrecoverable garbage', () => {
    const result = parseSafetyStateValueWithRecovery({
      schemaVersion: 1,
      holds: [
        { garbage: true },
        {
          schemaVersion: 1,
          holdRef: 'hold:1',
          studentRef: 'student:amelia',
          sessionRef: 'session:1',
          createdAt: '2026-08-12T12:00:00.000Z',
          status: 'open',
          reasonCode: 'study-safety-urgent',
          source: 'study-safety',
          dedupeKey: 'k1',
        },
      ],
    })
    expect(result.recoveryState).toBe('incomplete')
    expect(result.state.holds).toHaveLength(1)
  })
})

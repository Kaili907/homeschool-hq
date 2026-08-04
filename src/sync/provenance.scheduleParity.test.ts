import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { MAX_EXTENSION_LABEL } from '../schedule/coreDay'
import { validateAppStateForSync } from './provenance'

/**
 * S2 — exact parity between validateScheduleExtensions and the Add-form gate
 * (canAddExtension): label 1–120 after trim, at least one day and every day a
 * SCHEDULE_DAYS member, strict HH:MM on both ends, start < end. Anything the
 * validator accepts beyond the gate is storable-but-unsyncable state that
 * silently halts household persistence.
 *
 * This file deliberately imports nothing introduced by the fix, so run against
 * the pre-fix baseline it fails on assertions (the validator accepting invalid
 * blocks), not on imports.
 */

const withExtensions = (scheduleExtensions: unknown): unknown => {
  const state = defaultAppState() as unknown as {
    profiles: Record<string, Record<string, unknown>>
  }
  state.profiles.p1 = { ...state.profiles.p1, scheduleExtensions }
  return state
}

const VALID = {
  id: 'sx-1',
  label: 'Algebra practice',
  days: ['Mon', 'Wed'],
  start: '13:00',
  end: '13:30',
}

const accepts = (ext: unknown) =>
  expect(validateAppStateForSync(withExtensions([ext]))).toMatchObject({ ok: true })
const rejects = (ext: unknown) =>
  expect(validateAppStateForSync(withExtensions([ext]))).toMatchObject({ ok: false })

describe('S2 parity — label (1–120 after trim)', () => {
  it('rejects labels that trim to empty', () => {
    rejects({ ...VALID, label: '' })
    rejects({ ...VALID, label: '   ' })
    rejects({ ...VALID, label: '\t\n ' })
  })

  it('rejects labels longer than the form cap', () => {
    rejects({ ...VALID, label: 'x'.repeat(MAX_EXTENSION_LABEL + 1) })
    rejects({ ...VALID, label: 'x'.repeat(1000) })
  })

  it('rejects non-string labels', () => {
    rejects({ ...VALID, label: 12 })
    rejects({ ...VALID, label: null })
  })

  it('accepts labels of 1 and exactly 120 characters', () => {
    accepts({ ...VALID, label: 'x' })
    accepts({ ...VALID, label: 'x'.repeat(MAX_EXTENSION_LABEL) })
  })
})

describe('S2 parity — days (≥1, all SCHEDULE_DAYS members)', () => {
  it('rejects an empty day list', () => {
    rejects({ ...VALID, days: [] })
  })

  it('rejects days outside the Mon–Fri school week', () => {
    rejects({ ...VALID, days: ['Sat'] })
    rejects({ ...VALID, days: ['Mon', 'Sat'] })
    rejects({ ...VALID, days: ['Monday'] })
    rejects({ ...VALID, days: 'Mon' })
    rejects({ ...VALID, days: [['Mon']] })
  })

  it('accepts a single day and the full school week', () => {
    accepts({ ...VALID, days: ['Mon'] })
    accepts({ ...VALID, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] })
  })
})

describe('S2 parity — strict HH:MM on both ends', () => {
  it('rejects loose or malformed times on either end', () => {
    rejects({ ...VALID, start: '9:00' })
    rejects({ ...VALID, end: '9:05' })
    rejects({ ...VALID, start: '1pm' })
    rejects({ ...VALID, start: '25:00' })
    rejects({ ...VALID, end: '13:60' })
    rejects({ ...VALID, start: '' })
    rejects({ ...VALID, end: '' })
  })

  it('accepts strict HH:MM at the day boundaries', () => {
    accepts({ ...VALID, start: '00:00', end: '23:59' })
  })
})

describe('S2 parity — start < end', () => {
  it('rejects zero-length and inverted ranges', () => {
    rejects({ ...VALID, start: '13:30', end: '13:30' })
    rejects({ ...VALID, start: '14:00', end: '13:30' })
  })

  it('accepts positive ranges down to one minute', () => {
    accepts(VALID)
    accepts({ ...VALID, start: '13:29', end: '13:30' })
  })
})

describe('S2 parity — structure regressions stay rejected', () => {
  it('keeps rejecting missing identity and malformed blocks', () => {
    rejects({ ...VALID, id: '' })
    rejects(null)
    rejects('not-a-block')
  })
})

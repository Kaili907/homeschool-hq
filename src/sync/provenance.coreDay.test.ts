import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import type { AppState } from '../types'
import { validateAppStateForSync } from './provenance'

/**
 * SCHED-1 — sync-validator acceptance for the Core Day additive fields:
 * AppState.coreDay and Profile.scheduleExtensions.
 */

const withCoreDay = (coreDay: unknown): unknown => ({
  ...(defaultAppState() as unknown as Record<string, unknown>),
  coreDay,
})

const withExtensions = (scheduleExtensions: unknown): unknown => {
  const state = defaultAppState() as unknown as {
    profiles: Record<string, Record<string, unknown>>
  }
  state.profiles.p1 = { ...state.profiles.p1, scheduleExtensions }
  return state
}

const VALID_EXTENSION = {
  id: 'sx-1',
  label: 'Algebra practice',
  days: ['Mon', 'Wed'],
  start: '13:00',
  end: '13:30',
}

describe('SCHED-1 sync-validator acceptance', () => {
  it('still accepts the default state (no coreDay, no extensions)', () => {
    expect(validateAppStateForSync(defaultAppState())).toMatchObject({ ok: true })
  })

  it('accepts both writing-day assignments', () => {
    expect(validateAppStateForSync(withCoreDay({ writingDays: 'writing-mw' }))).toMatchObject({
      ok: true,
    })
    expect(validateAppStateForSync(withCoreDay({ writingDays: 'writing-tth' }))).toMatchObject({
      ok: true,
    })
  })

  it('rejects malformed coreDay configs', () => {
    expect(validateAppStateForSync(withCoreDay({ writingDays: 'weekends' }))).toMatchObject({
      ok: false,
    })
    expect(validateAppStateForSync(withCoreDay('writing-mw'))).toMatchObject({ ok: false })
    expect(validateAppStateForSync(withCoreDay({}))).toMatchObject({ ok: false })
    // String(['writing-mw']) === 'writing-mw' — coercion must not let arrays through
    expect(
      validateAppStateForSync(withCoreDay({ writingDays: ['writing-mw'] })),
    ).toMatchObject({ ok: false })
  })

  it('accepts a profile with well-formed extension blocks', () => {
    const result = validateAppStateForSync(withExtensions([VALID_EXTENSION]))
    expect(result).toMatchObject({ ok: true })
    const state = (result as { ok: true; state: AppState }).state
    expect(state.profiles.p1.scheduleExtensions).toEqual([VALID_EXTENSION])
  })

  it('accepts an empty extensions list', () => {
    expect(validateAppStateForSync(withExtensions([]))).toMatchObject({ ok: true })
  })

  it('rejects extension blocks with malformed times', () => {
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, start: '1pm' }])),
    ).toMatchObject({ ok: false })
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, end: '9:00' }])),
    ).toMatchObject({ ok: false })
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, start: '25:00' }])),
    ).toMatchObject({ ok: false })
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, start: '' }])),
    ).toMatchObject({ ok: false })
  })

  it('rejects extension blocks outside the Mon–Fri school week', () => {
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, days: ['Sat'] }])),
    ).toMatchObject({ ok: false })
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, days: 'Mon' }])),
    ).toMatchObject({ ok: false })
    // String(['Mon']) === 'Mon' — coercion must not let nested arrays through
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, days: [['Mon']] }])),
    ).toMatchObject({ ok: false })
  })

  it('rejects extension blocks missing identity or label', () => {
    expect(
      validateAppStateForSync(withExtensions([{ ...VALID_EXTENSION, id: '' }])),
    ).toMatchObject({ ok: false })
    const noLabel: Record<string, unknown> = { ...VALID_EXTENSION }
    delete noLabel.label
    expect(validateAppStateForSync(withExtensions([noLabel]))).toMatchObject({ ok: false })
    expect(validateAppStateForSync(withExtensions([null]))).toMatchObject({ ok: false })
  })
})

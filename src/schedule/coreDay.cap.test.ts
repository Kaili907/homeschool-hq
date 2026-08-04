import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import type { Profile, ScheduleExtension } from '../types'
import { validateAppStateForSync } from '../sync/provenance'
import { MAX_SCHEDULE_EXTENSIONS, addExtension, canAddExtension } from './coreDay'

/**
 * S1 — the sync layer rejects any array past its size cap ("oversized or sparse
 * array"), so the Add gate and the Add path must refuse to grow a girl's
 * extension list past that cap — including when the at-cap list arrived via
 * import/pull rather than UI accumulation.
 */

const extensionAt = (i: number): ScheduleExtension => ({
  id: `sx-${i}`,
  label: 'x',
  days: ['Mon'],
  start: '09:00',
  end: '09:30',
})

const girlWith = (count: number): Profile => ({
  ...defaultAppState().profiles.p1,
  scheduleExtensions: Array.from({ length: count }, (_, i) => extensionAt(i)),
})

const stateWith = (count: number): unknown => {
  const state = defaultAppState() as unknown as { profiles: Record<string, unknown> }
  state.profiles.p1 = girlWith(count)
  return state
}

describe('S1 — canAddExtension respects the sync-layer cap', () => {
  it('accepts a well-formed block below the cap', () => {
    expect(canAddExtension('Block', ['Mon'], '13:00', '13:30', 0)).toBe(true)
    expect(
      canAddExtension('Block', ['Mon'], '13:00', '13:30', MAX_SCHEDULE_EXTENSIONS - 1),
    ).toBe(true)
  })

  it('rejects when the profile is already at or past the cap', () => {
    expect(
      canAddExtension('Block', ['Mon'], '13:00', '13:30', MAX_SCHEDULE_EXTENSIONS),
    ).toBe(false)
    expect(
      canAddExtension('Block', ['Mon'], '13:00', '13:30', MAX_SCHEDULE_EXTENSIONS + 1),
    ).toBe(false)
  })
})

describe('S1 — addExtension respects the sync-layer cap', () => {
  it('appends the block that reaches exactly the cap', () => {
    const grown = addExtension(girlWith(MAX_SCHEDULE_EXTENSIONS - 1), {
      label: 'Last legal block',
      days: ['Fri'],
      start: '13:00',
      end: '13:30',
    })
    expect(grown.scheduleExtensions).toHaveLength(MAX_SCHEDULE_EXTENSIONS)
  })

  it('refuses to grow an at-cap list (imported-at-max) and returns the profile unchanged', () => {
    const atCap = girlWith(MAX_SCHEDULE_EXTENSIONS)
    const after = addExtension(atCap, {
      label: 'One too many',
      days: ['Fri'],
      start: '13:00',
      end: '13:30',
    })
    expect(after).toBe(atCap)
    expect(after.scheduleExtensions).toHaveLength(MAX_SCHEDULE_EXTENSIONS)
  })
})

describe('S1 — the gate cap is the sync layer’s real boundary', () => {
  it('accepts an imported-at-max extension list (exactly the cap)', () => {
    expect(validateAppStateForSync(stateWith(MAX_SCHEDULE_EXTENSIONS))).toMatchObject({
      ok: true,
    })
  })

  it('rejects one past the cap with the oversized-array error', () => {
    expect(validateAppStateForSync(stateWith(MAX_SCHEDULE_EXTENSIONS + 1))).toEqual({
      ok: false,
      error:
        'Stored Academy data is not safe to synchronize: Academy data contains an oversized or sparse array.',
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  createFamilyPilotPinVerifier,
  emptyFinalFamilyPilotAppState,
  parseFinalFamilyPilotAppState,
  verifyFamilyPilotPin,
} from './state'

const HOUSEHOLD = 'household:pin-security-test'
const SUBJECT = 'student:student-1'

describe('Family Pilot PIN verifier', () => {
  it('uses unique salted versioned PBKDF2 material and never persists the raw PIN', async () => {
    const first = await createFamilyPilotPinVerifier('1234', HOUSEHOLD, SUBJECT)
    const second = await createFamilyPilotPinVerifier('1234', HOUSEHOLD, SUBJECT)

    expect(first).toMatch(/^family-pilot-pin:v2:1:600000:/)
    expect(second).toMatch(/^family-pilot-pin:v2:1:600000:/)
    expect(first).not.toBe(second)
    expect(first).not.toContain('1234')
    expect((await verifyFamilyPilotPin('1234', first, HOUSEHOLD, SUBJECT)).verified).toBe(true)
    expect((await verifyFamilyPilotPin('1235', first, HOUSEHOLD, SUBJECT)).verified).toBe(false)
    expect((await verifyFamilyPilotPin('1234', first, HOUSEHOLD, 'student:other')).verified).toBe(false)
  })

  it('fails closed on corrupt material and rejects it during reload parsing', async () => {
    const corrupt = 'family-pilot-pin:v2:1:600000:AAAA:BBBB'
    expect((await verifyFamilyPilotPin('1234', corrupt, HOUSEHOLD, SUBJECT)).verified).toBe(false)
    const state = {
      ...emptyFinalFamilyPilotAppState('2026-08-16T12:00:00.000Z', HOUSEHOLD),
      parentAccessVerifier: corrupt,
    }
    expect(parseFinalFamilyPilotAppState(state).state).toBeNull()
  })

  it('migrates a legacy FNV verifier only after the correct PIN succeeds', async () => {
    const wrong = await verifyFamilyPilotPin('9999', 'fdc422fd', HOUSEHOLD, 'parent')
    expect(wrong).toEqual({ verified: false })

    const migrated = await verifyFamilyPilotPin('1234', 'fdc422fd', HOUSEHOLD, 'parent')
    expect(migrated.verified).toBe(true)
    expect(migrated.migratedVerifier).toMatch(/^family-pilot-pin:v2:1:600000:/)
    expect((await verifyFamilyPilotPin(
      '1234',
      migrated.migratedVerifier!,
      HOUSEHOLD,
      'parent',
    )).verified).toBe(true)
  })
})

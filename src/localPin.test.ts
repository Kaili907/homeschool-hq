import { describe, expect, it } from 'vitest'
import { defaultAppState } from './migration'
import {
  createLocalPinVerifier,
  localPinMatches,
  normalizeAppStatePinVerifiers,
} from './localPin'

describe('local PIN durable privacy', () => {
  it('stores a verifier while preserving the four-digit login flow', () => {
    const verifier = createLocalPinVerifier('2468')
    expect(verifier).toMatch(/^local-pin:v1:[0-9a-f]{8}$/)
    expect(verifier).not.toContain('2468')
    expect(localPinMatches('2468', verifier)).toBe(true)
    expect(localPinMatches('2469', verifier)).toBe(false)
  })

  it('migrates legacy raw parent and learner PINs before durable reuse', () => {
    const state = defaultAppState()
    const migrated = normalizeAppStatePinVerifiers({
      ...state,
      parentPin: '1357',
      profiles: { ...state.profiles, p1: { ...state.profiles.p1, pin: '8642' } },
    })
    const serialized = JSON.stringify(migrated)
    expect(serialized).not.toContain('1357')
    expect(serialized).not.toContain('8642')
    expect(localPinMatches('1357', migrated.parentPin)).toBe(true)
    expect(localPinMatches('8642', migrated.profiles.p1.pin)).toBe(true)
  })
})

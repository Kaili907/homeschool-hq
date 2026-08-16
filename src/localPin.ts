import type { AppState, Profile } from './types'

const PIN_VERIFIER_PREFIX = 'local-pin:v1:'

/** A local UX gate verifier, not a substitute for server authentication. */
export function createLocalPinVerifier(pin: string): string {
  let hash = 0x811c9dc5
  for (const character of pin) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${PIN_VERIFIER_PREFIX}${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function isLocalPinVerifier(value: string): boolean {
  return /^local-pin:v1:[0-9a-f]{8}$/.test(value)
}

export function normalizeStoredPin(value: string): string {
  if (value === '' || isLocalPinVerifier(value)) return value
  return createLocalPinVerifier(value)
}

export function localPinMatches(pin: string, verifier: string): boolean {
  return isLocalPinVerifier(verifier) && createLocalPinVerifier(pin) === verifier
}

/** Converts legacy raw PIN fields before any durable write or application use. */
export function normalizeAppStatePinVerifiers(state: AppState): AppState {
  const profiles: Record<string, Profile> = {}
  let changed = false
  for (const [id, profile] of Object.entries(state.profiles)) {
    const pin = normalizeStoredPin(profile.pin)
    changed ||= pin !== profile.pin
    profiles[id] = pin === profile.pin ? profile : { ...profile, pin }
  }
  const parentPin = normalizeStoredPin(state.parentPin)
  changed ||= parentPin !== state.parentPin
  return changed ? { ...state, parentPin, profiles } : state
}

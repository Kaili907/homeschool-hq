import type { FamilySetupStudentRef } from './types'

const REF_PREFIX = 'family-setup-student'

/** Matches the canonical identifier convention used across src/study. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/

export function isValidStudentRef(value: unknown): value is FamilySetupStudentRef {
  return typeof value === 'string' && IDENTIFIER.test(value)
}

function defaultIdSource(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Generates a stable, opaque local ref for a new roster entry. Display name
 * is never part of the ref — two students with identical display names get
 * distinct refs.
 */
export function generateStudentRef(idSource: () => string = defaultIdSource): FamilySetupStudentRef {
  return `${REF_PREFIX}:${idSource()}`
}

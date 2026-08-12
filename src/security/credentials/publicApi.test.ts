import { describe, expect, it } from 'vitest'
import * as CredentialsBarrel from './index'

/**
 * Pins the supported application-facing learner credential barrel. Cast
 * through Record<string, unknown> rather than the module's own type so a
 * raw export re-added later is still caught at runtime even though it would
 * no longer type-check against this file's expectations.
 */
const barrel = CredentialsBarrel as Record<string, unknown>

describe('learner credential barrel', () => {
  it('does not re-export raw verifier or raw write primitives', () => {
    expect(barrel.verifyLearnerCredentialRecord).toBeUndefined()
    expect(barrel.writeLearnerCredential).toBeUndefined()
    expect(barrel.parseLearnerCredentialRecord).toBeUndefined()
    expect(barrel.createLearnerCredentialRecord).toBeUndefined()
  })

  it('still exports every supported safe operation', () => {
    expect(typeof barrel.verifyLearnerPin).toBe('function')
    expect(typeof barrel.enrollLearnerPin).toBe('function')
    expect(typeof barrel.rotateLearnerPin).toBe('function')
    expect(typeof barrel.markLearnerCredentialResetRequired).toBe('function')
    expect(typeof barrel.deleteLearnerCredential).toBe('function')
    expect(typeof barrel.readLearnerCredential).toBe('function')
    expect(typeof barrel.CredentialVaultError).toBe('function')
  })
})

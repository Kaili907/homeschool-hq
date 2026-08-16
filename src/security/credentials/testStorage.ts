import type { CredentialStorage } from './vault'
import type {
  ParentCredentialGenerationAuthority,
  ParentCredentialGenerationSnapshot,
} from './parentVault'
import type { ParentCredentialBindingReference } from '../contracts'
import {
  parentCredentialAuthorizationEvidenceSigningBytes,
  serializeAuthorizedParentCredentialEvidence,
  type ParentCredentialAuthorizationEvidenceAuthority,
  type ParentCredentialAuthorizationEvidenceInput,
  type ParentCredentialAuthorizationEvidenceReference,
  type ParentCredentialAuthorizationOperation,
} from './parentAuthorizationEvidence'

export class MemoryCredentialStorage implements CredentialStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  entries(): readonly (readonly [string, string])[] {
    return [...this.values.entries()]
  }
}

const INITIAL_PARENT_GENERATION: ParentCredentialGenerationSnapshot = Object.freeze({
  generation: 0,
  activeGeneration: null,
  recordCommitmentBase64: null,
  migrationCommitmentBase64: null,
})

function parentGenerationKey(binding: ParentCredentialBindingReference): string {
  return `${binding.installationId}:${binding.householdId}`
}

function sameParentGeneration(
  left: ParentCredentialGenerationSnapshot,
  right: ParentCredentialGenerationSnapshot,
): boolean {
  return left.generation === right.generation &&
    left.activeGeneration === right.activeGeneration &&
    left.recordCommitmentBase64 === right.recordCommitmentBase64 &&
    left.migrationCommitmentBase64 === right.migrationCommitmentBase64
}

export class MemoryParentCredentialGenerationAuthority
implements ParentCredentialGenerationAuthority, ParentCredentialAuthorizationEvidenceAuthority {
  private readonly values = new Map<string, ParentCredentialGenerationSnapshot>()
  private readonly authorizationEvidence = new Map<string, string>()
  private readonly authorizationVerificationKeys = new Map<string, CryptoKey>()
  private authorizationSigningKeyPair: Promise<CryptoKeyPair> | null = null
  private authorizationEvidenceSequence = 0

  snapshot(binding: ParentCredentialBindingReference): ParentCredentialGenerationSnapshot {
    return this.read(binding)
  }

  setForTest(
    binding: ParentCredentialBindingReference,
    snapshot: ParentCredentialGenerationSnapshot,
  ): void {
    this.values.set(parentGenerationKey(binding), Object.freeze({ ...snapshot }))
  }

  readAuthorizationEvidenceForTest(evidenceId: string): string | null {
    return this.authorizationEvidence.get(evidenceId) ?? null
  }

  setAuthorizationEvidenceForTest(evidenceId: string, serialized: string): void {
    this.authorizationEvidence.set(evidenceId, serialized)
  }

  setAuthorizationVerificationKeyForTest(keyId: string, key: CryptoKey): void {
    this.authorizationVerificationKeys.set(keyId, key)
  }

  read(evidenceId: string): string | null
  read(binding: ParentCredentialBindingReference): ParentCredentialGenerationSnapshot
  read(
    value: string | ParentCredentialBindingReference,
  ): string | null | ParentCredentialGenerationSnapshot {
    if (typeof value === 'string') return this.readAuthorizationEvidenceForTest(value)
    return Object.freeze({
      ...(this.values.get(parentGenerationKey(value)) ?? INITIAL_PARENT_GENERATION),
    })
  }

  compareAndSwap(
    evidenceId: string,
    expectedSerialized: string,
    replacementSerialized: string,
  ): boolean
  compareAndSwap(
    binding: ParentCredentialBindingReference,
    expected: ParentCredentialGenerationSnapshot,
    replacement: ParentCredentialGenerationSnapshot,
  ): boolean
  compareAndSwap(
    value: string | ParentCredentialBindingReference,
    expected: string | ParentCredentialGenerationSnapshot,
    replacement: string | ParentCredentialGenerationSnapshot,
  ): boolean {
    if (typeof value === 'string') {
      if (typeof expected !== 'string' || typeof replacement !== 'string') return false
      if (this.readAuthorizationEvidenceForTest(value) !== expected) return false
      this.authorizationEvidence.set(value, replacement)
      return true
    }
    if (typeof expected === 'string' || typeof replacement === 'string') return false
    const current = this.read(value)
    if (!sameParentGeneration(current, expected)) return false
    if (
      (current.migrationCommitmentBase64 !== null &&
        replacement.migrationCommitmentBase64 !== current.migrationCommitmentBase64) ||
      (current.migrationCommitmentBase64 === null &&
        replacement.migrationCommitmentBase64 !== null &&
        (replacement.generation !== current.generation ||
          replacement.recordCommitmentBase64 !== current.recordCommitmentBase64))
    ) {
      return false
    }
    this.values.set(parentGenerationKey(value), Object.freeze({ ...replacement }))
    return true
  }

  readVerificationKey(keyId: string): CryptoKey | null {
    return this.authorizationVerificationKeys.get(keyId) ?? null
  }

  async issueAuthorizationEvidenceForTest(
    operationId: ParentCredentialAuthorizationOperation,
    binding: ParentCredentialBindingReference,
    priorGeneration: number,
    now = new Date(),
    overrides: Partial<ParentCredentialAuthorizationEvidenceInput> = {},
  ): Promise<ParentCredentialAuthorizationEvidenceReference> {
    this.authorizationSigningKeyPair ??= globalThis.crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    ) as Promise<CryptoKeyPair>
    const keyPair = await this.authorizationSigningKeyPair
    const sequence = ++this.authorizationEvidenceSequence
    const evidenceId = `parent-authorization-test-${sequence}`
    const keyId = 'parent-authorization-test-key'
    const nonce = new Uint8Array(32)
    nonce.fill(sequence % 256)
    const issuedAt = new Date(now.getTime() - 60_000).toISOString()
    const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString()
    const input: ParentCredentialAuthorizationEvidenceInput = {
      evidenceId,
      keyId,
      operationId,
      binding,
      priorGeneration,
      issuedAt,
      expiresAt,
      nonceBase64: btoa(String.fromCharCode(...nonce)),
      ...overrides,
    }
    const signature = new Uint8Array(await globalThis.crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      keyPair.privateKey,
      parentCredentialAuthorizationEvidenceSigningBytes(input),
    ))
    this.authorizationVerificationKeys.set(input.keyId, keyPair.publicKey)
    this.authorizationEvidence.set(
      input.evidenceId,
      serializeAuthorizedParentCredentialEvidence(input, signature),
    )
    return Object.freeze({ evidenceId: input.evidenceId })
  }
}

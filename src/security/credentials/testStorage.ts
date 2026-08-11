import type { CredentialStorage } from './vault'
import type {
  ParentCredentialGenerationAuthority,
  ParentCredentialGenerationSnapshot,
} from './parentVault'
import type { ParentCredentialBindingReference } from '../contracts'

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
implements ParentCredentialGenerationAuthority {
  private readonly values = new Map<string, ParentCredentialGenerationSnapshot>()

  read(binding: ParentCredentialBindingReference): ParentCredentialGenerationSnapshot {
    return Object.freeze({
      ...(this.values.get(parentGenerationKey(binding)) ?? INITIAL_PARENT_GENERATION),
    })
  }

  compareAndSwap(
    binding: ParentCredentialBindingReference,
    expected: ParentCredentialGenerationSnapshot,
    replacement: ParentCredentialGenerationSnapshot,
  ): boolean {
    const current = this.read(binding)
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
    this.values.set(parentGenerationKey(binding), Object.freeze({ ...replacement }))
    return true
  }

  snapshot(binding: ParentCredentialBindingReference): ParentCredentialGenerationSnapshot {
    return this.read(binding)
  }

  setForTest(
    binding: ParentCredentialBindingReference,
    snapshot: ParentCredentialGenerationSnapshot,
  ): void {
    this.values.set(parentGenerationKey(binding), Object.freeze({ ...snapshot }))
  }
}

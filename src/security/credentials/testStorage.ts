import type { CredentialStorage } from './vault'
import type {
  ParentCredentialGenerationAuthority,
  ParentCredentialGenerationSnapshot,
  ParentInstallationClaimAuthorization,
  ParentInstallationRecoveryAuthorization,
} from './parentVault'
import {
  INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE,
  INSTALLATION_GRANT_SCHEMA_VERSION,
  type InstallationBinding,
  type InstallationGrantPurpose,
  type ParentCredentialBindingReference,
  type ParentInstallationGrant,
} from '../contracts'

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

/** Fields a test may deliberately corrupt to exercise the vault's own checks. */
export interface ParentInstallationGrantOverrides {
  readonly purpose?: InstallationGrantPurpose
  readonly installationId?: ParentInstallationGrant['installationId']
  readonly householdId?: string
  readonly datasetEpoch?: string
  readonly status?: ParentInstallationGrant['status']
  readonly expiresAt?: string
}

interface IssuedGrant {
  readonly grant: ParentInstallationGrant
  readonly boundGeneration: number
  redeemed: boolean
}

/**
 * Models the server side of the installation-grant contract. A grant is issued
 * for one exact capability and prior generation and is redeemed at most once;
 * replay, an unissued capability, and a stale generation all return null the way
 * a conforming server adapter must. Binding and purpose overrides are handed
 * back unchanged so the vault's own evidence checks are what reject them.
 */
export class MemoryParentInstallationGrantIssuer {
  private readonly issued: IssuedGrant[] = []
  private sequence = 0

  readonly consumedContexts: unknown[] = []

  constructor(
    private readonly binding: InstallationBinding,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private issue(
    purpose: InstallationGrantPurpose,
    boundGeneration: number,
    overrides: ParentInstallationGrantOverrides,
  ): ParentInstallationGrant {
    this.sequence += 1
    const issuedAt = this.now().toISOString()
    const effectivePurpose = overrides.purpose ?? purpose
    const grant: ParentInstallationGrant = Object.freeze({
      schemaVersion: INSTALLATION_GRANT_SCHEMA_VERSION,
      grantId: `grant-${this.sequence}`,
      householdId: overrides.householdId ?? this.binding.householdId,
      verifiedActorId: this.binding.verifiedActorId,
      installationId: overrides.installationId ?? this.binding.installationId,
      datasetEpoch: overrides.datasetEpoch ?? this.binding.datasetEpoch,
      purpose: effectivePurpose,
      // The capability always follows the issued purpose, never the override,
      // so a purpose-only override stays capability-consistent and reaches the
      // vault's purpose check instead of failing earlier.
      capability: INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE[purpose],
      issuedAt,
      expiresAt:
        overrides.expiresAt ?? new Date(this.now().getTime() + 300_000).toISOString(),
      nonce: `nonce-${this.sequence}`,
      status: overrides.status ?? 'redeemed',
    })
    this.issued.push({ grant, boundGeneration, redeemed: false })
    return grant
  }

  issueClaim(overrides: ParentInstallationGrantOverrides = {}): ParentInstallationGrant {
    return this.issue('first_claim', 0, overrides)
  }

  issueRecovery(
    boundGeneration: number,
    overrides: ParentInstallationGrantOverrides = {},
  ): ParentInstallationGrant {
    return this.issue('recovery', boundGeneration, overrides)
  }

  private redeem(
    capability: ParentInstallationGrant['capability'],
    priorGeneration: number,
  ): ParentInstallationGrant | null {
    const match = this.issued.find((entry) =>
      !entry.redeemed &&
      entry.grant.capability === capability &&
      entry.boundGeneration === priorGeneration)
    if (!match) return null
    match.redeemed = true
    return match.grant
  }

  get claim(): ParentInstallationClaimAuthorization {
    return {
      consumeParentInstallationClaimAuthorization: (context) => {
        this.consumedContexts.push(context)
        return this.redeem('parent_installation:claim', context.priorGeneration)
      },
    }
  }

  get recovery(): ParentInstallationRecoveryAuthorization {
    return {
      consumeParentInstallationRecoveryAuthorization: (context) => {
        this.consumedContexts.push(context)
        return this.redeem('parent_installation:recover', context.priorGeneration)
      },
    }
  }
}

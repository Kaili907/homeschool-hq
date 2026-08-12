import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { Profile } from '../../types'
import {
  ACADEMY_SYNC_PROTOCOL_VERSION,
  AUTHORITY_SEPARATION_RULES,
  createInstallationId,
  createLocalSessionId,
  INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE,
  INSTALLATION_MANAGER_CAPABILITIES,
  isAuthorityEstablishmentForbidden,
  isInstallationGrantCapabilityConsistent,
  isParentStepUpGrantPolicyCompliant,
  parseProfileId,
  parsePendingDestination,
  PortableSecurityStructureError,
  SECURITY_LIFECYCLE_EVENT_SEMANTICS,
  SECURITY_LIFECYCLE_EVENT_TYPES,
  SECURITY_SESSION_POLICY,
  STUDY_BRIDGE_EVENT_MAP,
  studyCancellationReasonFor,
  toCredentialFreeEducationalProfile,
  type CredentialFreeEducationalProfile,
  type LearnerCredentialRecord,
  type ParentStepUpGrant,
} from './index'

const UUID_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const UUID_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'

describe('credential and educational Profile boundaries', () => {
  it('keeps a device-local credential structurally distinct from a synced Profile', () => {
    expectTypeOf<LearnerCredentialRecord>().not.toMatchTypeOf<CredentialFreeEducationalProfile>()

    const credential: LearnerCredentialRecord = {
      schemaVersion: 1,
      storage: 'device-local-only',
      profileId: parseProfileId('p1')!,
      credentialKind: 'learner-pin',
      verifierScheme: 'pbkdf2-sha256',
      verifierSchemeVersion: 2,
      saltBase64: 'c2FsdA==',
      verifierBase64: 'dmVyaWZpZXI=',
      costParameters: { iterations: 210_000, derivedKeyBytes: 32 },
      state: 'enrolled',
      createdAt: '2026-08-09T12:00:00.000Z',
    }

    expect(() =>
      toCredentialFreeEducationalProfile(credential as unknown as Profile),
    ).toThrow(PortableSecurityStructureError)
  })

  it('omits the accepted legacy PIN and rejects credential-like material at any depth', () => {
    const legacy = {
      id: 'p1',
      name: 'Synthetic Learner',
      grade: 5,
      pin: '1234',
      missions: { '2026-08-11': { completed: true } },
    } as unknown as Profile

    expect(toCredentialFreeEducationalProfile(legacy)).toEqual({
      id: 'p1',
      name: 'Synthetic Learner',
      grade: 5,
      missions: { '2026-08-11': { completed: true } },
    })
    expect(() =>
      toCredentialFreeEducationalProfile({
        ...legacy,
        missions: { '2026-08-11': { recoverySecret: 'not-for-sync' } },
      } as unknown as Profile),
    ).toThrow(/recoverySecret/)
    expect(() =>
      toCredentialFreeEducationalProfile({
        ...legacy,
        pinVerifier: 'not-for-sync',
      } as unknown as Profile),
    ).toThrow(/pinVerifier/)
  })
})

describe('local session contracts', () => {
  it('keeps all approved time bounds in the one policy object', () => {
    expect(SECURITY_SESSION_POLICY).toEqual({
      learner: {
        idleTimeoutMs: 30 * 60_000,
        absoluteTimeoutMs: 8 * 60 * 60_000,
      },
      parent: {
        storage: 'memory-only',
        idleTimeoutMs: 15 * 60_000,
        absoluteTimeoutMs: 60 * 60_000,
      },
      parentStepUp: {
        storage: 'memory-only',
        maximumLifetimeMs: 2 * 60_000,
        operationUseLimit: 1,
      },
    })
    expect(Object.isFrozen(SECURITY_SESSION_POLICY)).toBe(true)
  })

  it('requires Parent step-up to be memory-only, single-operation, and bounded', () => {
    const grant: ParentStepUpGrant = {
      schemaVersion: 1,
      storage: 'memory-only',
      grantId: createLocalSessionId(() => UUID_A),
      parentSessionId: createLocalSessionId(() => UUID_B),
      operationId: 'replace-dataset:confirmation-1',
      operationUseLimit: 1,
      issuedAt: '2026-08-09T12:00:00.000Z',
      expiresAt: '2026-08-09T12:02:00.000Z',
    }
    expect(isParentStepUpGrantPolicyCompliant(grant)).toBe(true)
    expect(
      isParentStepUpGrantPolicyCompliant({
        ...grant,
        expiresAt: '2026-08-09T12:02:00.001Z',
      }),
    ).toBe(false)
    expect(
      isParentStepUpGrantPolicyCompliant({
        ...grant,
        operationUseLimit: 2,
      } as unknown as ParentStepUpGrant),
    ).toBe(false)
  })
})

describe('pending destination and sync protocol contracts', () => {
  it('accepts only allowlisted route descriptors, never arbitrary redirects', () => {
    expect(parsePendingDestination({ kind: 'root-dashboard' })).toEqual({
      kind: 'root-dashboard',
    })
    expect(
      parsePendingDestination({
        kind: 'academy',
        route: {
          kind: 'lesson',
          courseId: 'ma-g5-mathematics',
          unitNumber: 2,
          lessonId: 'ma-g5-mathematics-u02-l01',
        },
      }),
    ).not.toBeNull()
    expect(parsePendingDestination('https://example.com/steal-session')).toBeNull()
    expect(parsePendingDestination({ kind: 'url', url: 'https://example.com' })).toBeNull()
    expect(parsePendingDestination({ kind: 'study', url: 'https://example.com' })).toBeNull()
  })

  it('pins wire compatibility to Sync Protocol v2', () => {
    expect(ACADEMY_SYNC_PROTOCOL_VERSION).toBe(2)
  })
})

describe('installation-manager and authority separation contracts', () => {
  it('creates only crypto-random UUIDv4 installation identifiers', () => {
    const randomUUID = vi.fn(() => UUID_A)
    expect(createInstallationId(randomUUID)).toBe(UUID_A)
    expect(randomUUID).toHaveBeenCalledOnce()
    expect(() => createInstallationId(() => 'browser-fingerprint')).toThrow(/UUIDv4/)
  })

  it('requires explicit claim/recovery capabilities with deterministic purposes', () => {
    expect(INSTALLATION_MANAGER_CAPABILITIES).toEqual(['parent_installation:claim', 'parent_installation:recover'])
    expect(INSTALLATION_GRANT_CAPABILITY_BY_PURPOSE).toEqual({
      first_claim: 'parent_installation:claim',
      legacy_upgrade: 'parent_installation:claim',
      recovery: 'parent_installation:recover',
    })
    expect(
      isInstallationGrantCapabilityConsistent({
        purpose: 'recovery',
        capability: 'parent_installation:recover',
      }),
    ).toBe(true)
    expect(
      isInstallationGrantCapabilityConsistent({
        purpose: 'recovery',
        capability: 'parent_installation:claim',
      }),
    ).toBe(false)
  })

  it('does not interchange learner, Parent, installation, Study, Admin, or staff authority', () => {
    expect(isAuthorityEstablishmentForbidden('learner', 'parent')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('learner', 'admin')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'learner')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'guardian-membership')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'installation-manager')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'study')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'study-guardian')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'supabase-identity')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'admin')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('parent', 'staff')).toBe(true)
    expect(
      AUTHORITY_SEPARATION_RULES.find((rule) => rule.source === 'parent')?.cannotEstablish,
    ).toEqual([
      'learner',
      'guardian-membership',
      'installation-manager',
      'study',
      'study-guardian',
      'supabase-identity',
      'admin',
      'staff',
    ])
    expect(isAuthorityEstablishmentForbidden('guardian-membership', 'installation-manager')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('study', 'parent')).toBe(true)
    expect(AUTHORITY_SEPARATION_RULES).toHaveLength(5)
  })
})

describe('security lifecycle and Study bridge vocabulary', () => {
  it('defines every event exactly once with deterministic semantics and mapping', () => {
    expect(new Set(SECURITY_LIFECYCLE_EVENT_TYPES).size).toBe(SECURITY_LIFECYCLE_EVENT_TYPES.length)
    expect(Object.keys(SECURITY_LIFECYCLE_EVENT_SEMANTICS)).toEqual([...SECURITY_LIFECYCLE_EVENT_TYPES])
    expect(Object.keys(STUDY_BRIDGE_EVENT_MAP)).toEqual([...SECURITY_LIFECYCLE_EVENT_TYPES])
    for (const event of SECURITY_LIFECYCLE_EVENT_TYPES) {
      expect(studyCancellationReasonFor(event)).toBe(STUDY_BRIDGE_EVENT_MAP[event])
    }
  })

  it('uses the approved existing Study cancellation vocabulary', () => {
    expect(studyCancellationReasonFor('learner-session-expired')).toBe('session-expired')
    expect(studyCancellationReasonFor('learner-switch-start')).toBe('learner-switch')
    expect(studyCancellationReasonFor('household-switch')).toBe('household-switch')
    expect(studyCancellationReasonFor('learner-credential-reset')).toBe('authorization-loss')
    expect(studyCancellationReasonFor('import-or-replacement')).toBe('authorization-loss')
    expect(studyCancellationReasonFor('provenance-loss')).toBe('authorization-loss')
    expect(studyCancellationReasonFor('learner-lock')).toBe('logout')
    expect(studyCancellationReasonFor('learner-sign-out')).toBe('logout')
  })
})

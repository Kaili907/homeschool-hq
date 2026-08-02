import { describe, expect, it, vi } from 'vitest'
import {
  authorizeGuardianStudy,
  type StudyProductionAuthority,
} from '../contracts/production/identity'
import {
  brandProductionPort,
  createProductionPortRegistry,
  type BrandedProductionPort,
  type ProductionDependencyPortMap,
  type ProductionPortImplementation,
} from '../contracts/production/ports'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  type ProductionDependencyKey,
} from '../contracts/production/readiness'
import {
  brandVerifiedLearnerAcademicRuntime,
  createStudyProductionComposition,
} from './productionComposition'

function completeRegistry() {
  const handles = (Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[]).map((key) => {
    const spec = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
    const port: ProductionPortImplementation<typeof key> = {
      deployment: 'production',
      contractVersion: 'study-production.v1',
      implementationId: `durable-production-${key}-v1`,
      trustBoundary: spec.trustBoundary,
      durable: spec.durability === 'durable',
      port: Object.fromEntries(
        spec.requiredMethods.map((method) => [method, () => undefined]),
      ) as unknown as ProductionDependencyPortMap[typeof key],
      readiness: () => 'ready',
    }
    return brandProductionPort(key, port) as BrandedProductionPort
  })
  return createProductionPortRegistry(handles)
}

const ids = {
  authenticatedUserId: '9bc6f1d1-bff9-4d46-ac97-f2a78f54d2b0',
  householdId: '3f6b1e04-0a91-4ac2-bb21-109b3a0c8c11',
  studentId: '0b86fe3f-c43c-4d44-b6da-6fbf7998c5a2',
  learnerSessionId: '4b13ee5d-c5f0-4be7-9332-08f0d8f1c2c9',
  membershipId: '4d22ff3c-2e62-493d-b07c-b5c992075709',
  relationshipId: 'ce0d3b7e-b43e-4a97-a36b-e89975f82ac6',
}

function guardianAuthority(expiresAt = '2099-08-01T00:00:00.000Z'): StudyProductionAuthority {
  const decision = authorizeGuardianStudy({
    authoritySource: 'verified-server',
    evidenceRef: 'authorization-evidence:guardian-study-v1',
    ...ids,
    householdStatus: 'active',
    learnerStatus: 'active',
    membershipStatus: 'active',
    memberRole: 'guardian',
    relationshipStatus: 'active',
    permission: 'learning_manager',
    window: {
      revision: 1,
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt,
      lifecycleEpochs: {
        authenticatedSession: 1,
        household: 1,
        learner: 1,
        membership: 1,
        relationship: 1,
      },
    },
  }, new Date('2026-08-01T00:00:00.000Z'))
  if (decision.status !== 'authorized') throw new Error(`authority fixture rejected: ${decision.code}`)
  return decision.authority
}

const authority = guardianAuthority()
const academicRuntime = brandVerifiedLearnerAcademicRuntime({
  deployment: 'production' as const,
  runtimeVersion: 'verified-learner-runtime-v1',
  acceptsVerifiedStudentIdentity: true as const,
  containsSyntheticLearnerSentinel: false as const,
  execute: async () => Object.freeze({ status: 'accepted' }),
})

describe('Study production composition root', () => {
  it('fails closed without a complete durable registry', () => {
    const result = createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority,
      registry: null,
      academicRuntime: null,
    })
    expect(result).toMatchObject({ status: 'not-ready', available: false, blocker: 'registry' })
  })

  it('keeps academic Study unavailable while the only frozen runtime contains a sentinel identity', () => {
    const result = createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority,
      registry: completeRegistry(),
      academicRuntime: null,
    })
    expect(result).toMatchObject({ status: 'not-ready', available: false, blocker: 'academic-runtime' })
  })

  it('requires every gate even with verified identity and a complete registry', () => {
    const registry = completeRegistry()
    expect(Object.isFrozen(authority.window)).toBe(true)
    expect(Object.isFrozen(authority.window.lifecycleEpochs)).toBe(true)
    expect(createStudyProductionComposition({
      featureFlagValue: 'false',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority,
      registry,
      academicRuntime,
    }).available).toBe(false)
    expect(createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority,
      registry,
      academicRuntime,
    }).available).toBe(true)
  })

  it.each([
    {
      name: 'feature disabled',
      featureFlagValue: 'false',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      blocker: 'feature-disabled',
    },
    {
      name: 'unauthenticated',
      featureFlagValue: 'true',
      authenticatedHostSession: false,
      selectedLearnerAuthorized: true,
      blocker: 'authentication',
    },
    {
      name: 'learner unauthorized',
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: false,
      blocker: 'learner-authorization',
    },
  ])('does not inspect dependency health when $name', (gate) => {
    const readiness = vi.fn(() => 'ready' as const)
    const handles = (Object.keys(PRODUCTION_DEPENDENCY_SPECIFICATIONS) as ProductionDependencyKey[]).map((key) => {
      const spec = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
      return brandProductionPort(key, {
        deployment: 'production',
        contractVersion: 'study-production.v1',
        implementationId: `durable-production-${key}-v1`,
        trustBoundary: spec.trustBoundary,
        durable: spec.durability === 'durable',
        port: Object.fromEntries(
          spec.requiredMethods.map((method) => [method, () => undefined]),
        ) as unknown as ProductionDependencyPortMap[typeof key],
        readiness,
      } as ProductionPortImplementation)
    })
    // Branding validates health once; reset before exercising the composition gates.
    readiness.mockClear()
    const result = createStudyProductionComposition({
      ...gate,
      authority,
      registry: createProductionPortRegistry(handles),
      academicRuntime,
    })
    expect(result).toMatchObject({ available: false, blocker: gate.blocker })
    expect(result.clientReadiness).toEqual({ schemaVersion: 1, status: 'not-ready' })
    expect(readiness).not.toHaveBeenCalled()
  })

  it('exposes only minimized readiness to the browser-facing projection', () => {
    const result = createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority,
      registry: completeRegistry(),
      academicRuntime,
    })
    expect(result.clientReadiness).toEqual({ schemaVersion: 1, status: 'ready' })
    expect(JSON.stringify(result.clientReadiness)).not.toMatch(/dependency|implementation|recipient|secret/i)
  })

  it('rejects UUID-shaped browser authority claims and expired authority', () => {
    const registry = completeRegistry()
    const forged = {
      authoritySource: 'verified-server',
      householdId: ids.householdId,
      studentId: ids.studentId,
      learnerSessionId: ids.learnerSessionId,
    } as unknown as StudyProductionAuthority
    expect(createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority: forged,
      registry,
      academicRuntime,
    })).toMatchObject({ available: false, blocker: 'identity' })

    const expired = {
      ...authority,
      window: { ...authority.window, expiresAt: '2020-01-01T00:00:00.000Z' },
    } as StudyProductionAuthority
    expect(createStudyProductionComposition({
      featureFlagValue: 'true',
      authenticatedHostSession: true,
      selectedLearnerAuthorized: true,
      authority: expired,
      registry,
      academicRuntime,
    })).toMatchObject({ available: false, blocker: 'identity' })
  })
})

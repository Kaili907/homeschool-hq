import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  authorizeGuardianStudy,
  isCurrentStudyProductionAuthority,
  type StudyProductionAuthority,
} from '../contracts/production/identity'
import {
  brandProductionPort,
  createProductionPortRegistry,
  isBrandedProductionPort,
  isStudyProductionPortRegistry,
  productionPortReadiness,
  type BrandedProductionPort,
  type ProductionDependencyPortMap,
  type ProductionPortImplementation,
  type StudyProductionPortRegistry,
} from '../contracts/production/ports'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  REQUIRED_PRODUCTION_DEPENDENCIES,
  type ProductionDependencyKey,
} from '../contracts/production/readiness'
import {
  brandVerifiedLearnerAcademicRuntime,
  createStudyProductionComposition,
} from './productionComposition'

const here = dirname(fileURLToPath(import.meta.url))
const sourceRoot = resolve(here, '..', '..')

function implementation<Key extends ProductionDependencyKey>(
  key: Key,
): ProductionPortImplementation<Key> {
  const specification = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
  return {
    deployment: 'production',
    contractVersion: 'study-production.v1',
    implementationId: `academy-production:${key}:v1`,
    trustBoundary: specification.trustBoundary,
    durable: specification.durability === 'durable',
    port: Object.fromEntries(
      specification.requiredMethods.map((method) => [method, () => undefined]),
    ) as unknown as ProductionDependencyPortMap[Key],
    readiness: () => 'ready',
  }
}

function completeRegistry(): StudyProductionPortRegistry {
  return createProductionPortRegistry(REQUIRED_PRODUCTION_DEPENDENCIES.map(
    (key) => brandProductionPort(key, implementation(key)),
  ))
}

function genuineGuardianAuthority(): StudyProductionAuthority {
  const decision = authorizeGuardianStudy({
    authoritySource: 'verified-server',
    evidenceRef: 'authorization-evidence:guardian-runtime-v1',
    authenticatedUserId: '9bc6f1d1-bff9-4d46-ac97-f2a78f54d2b0',
    householdId: '3f6b1e04-0a91-4ac2-bb21-109b3a0c8c11',
    studentId: '0b86fe3f-c43c-4d44-b6da-6fbf7998c5a2',
    learnerSessionId: '4b13ee5d-c5f0-4be7-9332-08f0d8f1c2c9',
    membershipId: '4d22ff3c-2e62-493d-b07c-b5c992075709',
    relationshipId: 'ce0d3b7e-b43e-4a97-a36b-e89975f82ac6',
    householdStatus: 'active',
    learnerStatus: 'active',
    membershipStatus: 'active',
    memberRole: 'guardian',
    relationshipStatus: 'active',
    permission: 'identity_manager',
    window: {
      revision: 1,
      issuedAt: '2026-08-01T00:00:00.000Z',
      expiresAt: '2099-08-01T00:00:00.000Z',
      lifecycleEpochs: {
        authenticatedSession: 1,
        household: 1,
        learner: 1,
        membership: 1,
        relationship: 1,
      },
    },
  }, new Date('2026-08-01T12:00:00.000Z'))
  if (decision.status !== 'authorized') throw new Error('guardian fixture rejected')
  return decision.authority
}

describe('Session 16 adversarial production regression boundary', () => {
  it('requires the host to invoke the opaque verified runtime, not deserialize server authority', () => {
    const app = readFileSync(join(sourceRoot, 'LegacyApp.tsx'), 'utf8')
    expect(app.match(/\bcreateVerifiedStudyRuntimeAdapter\s*\(/g)).toHaveLength(1)
    expect(app).not.toMatch(/\bcreateStudyProductionComposition\s*\(/)
    expect(app).not.toMatch(/parseVerified.*Authority|JSON\.parse\([^)]*authority/i)
  })

  it('rejects a frozen dependency handle counterfeited with a recovered symbol', () => {
    const legitimate = brandProductionPort(
      'checkpoint-adapter',
      implementation('checkpoint-adapter'),
    )
    const brand = Object.getOwnPropertySymbols(legitimate).find(
      (symbol) => symbol.description === 'study-production-port',
    )
    expect(brand).toBeDefined()

    const counterfeit = Object.freeze({
      [brand!]: 'receipt-validator',
      key: 'receipt-validator',
      port: Object.freeze({ verifyReceipt: () => ({ verified: true }) }),
      internalRegistration: () => Object.freeze({
        schemaVersion: 1,
        contractVersion: 'study-production.v1',
        key: 'receipt-validator',
        implementation: 'production',
        trustBoundary: 'trusted-server',
        durability: 'durable',
        status: 'ready',
        version: 'academy-production:receipt-validator:v1',
      }),
    }) as unknown as BrandedProductionPort

    expect(isBrandedProductionPort(counterfeit)).toBe(false)
    expect(() => createProductionPortRegistry([
      ...REQUIRED_PRODUCTION_DEPENDENCIES
        .filter((key) => key !== 'receipt-validator')
        .map((key) => brandProductionPort(key, implementation(key))),
      counterfeit,
    ])).toThrow(/does not satisfy/i)
  })

  it('rejects a frozen registry counterfeited with a recovered registry symbol', () => {
    const legitimate = completeRegistry()
    const brand = Object.getOwnPropertySymbols(legitimate).find(
      (symbol) => symbol.description === 'study-production-registry',
    )
    expect(brand).toBeDefined()

    const counterfeit = Object.fromEntries(Object.entries(legitimate))
    Object.defineProperty(counterfeit, brand!, {
      configurable: false,
      enumerable: false,
      writable: false,
      value: 1,
    })
    Object.freeze(counterfeit)

    expect(isStudyProductionPortRegistry(counterfeit)).toBe(false)
    expect(() => productionPortReadiness(
      counterfeit as unknown as StudyProductionPortRegistry,
    )).toThrow(/does not satisfy/i)
  })

  it('rejects a fully shaped browser authority claim with plausible production UUIDs', () => {
    const browserForgedAuthority = Object.freeze({
      schemaVersion: 1,
      authoritySource: 'verified-server',
      actorKind: 'guardian',
      evidenceRef: 'authorization-evidence:browser-forgery-v1',
      authenticatedUserId: '9bc6f1d1-bff9-4d46-ac97-f2a78f54d2b0',
      householdId: '3f6b1e04-0a91-4ac2-bb21-109b3a0c8c11',
      studentId: '0b86fe3f-c43c-4d44-b6da-6fbf7998c5a2',
      learnerSessionId: '4b13ee5d-c5f0-4be7-9332-08f0d8f1c2c9',
      membershipId: '4d22ff3c-2e62-493d-b07c-b5c992075709',
      relationshipId: 'ce0d3b7e-b43e-4a97-a36b-e89975f82ac6',
      permission: 'identity_manager',
      window: Object.freeze({
        revision: 1,
        issuedAt: '2026-08-01T00:00:00.000Z',
        expiresAt: '2099-08-01T00:00:00.000Z',
        lifecycleEpochs: Object.freeze({
          authenticatedSession: 1,
          household: 1,
          learner: 1,
          membership: 1,
          relationship: 1,
        }),
      }),
    }) as unknown as StudyProductionAuthority

    expect(isCurrentStudyProductionAuthority(
      browserForgedAuthority,
      new Date('2026-08-01T12:00:00.000Z'),
    )).toBe(false)
  })

  it('downgrades a throwing live health probe without leaking its detail or crashing', () => {
    let classifierChecks = 0
    const registry = createProductionPortRegistry(REQUIRED_PRODUCTION_DEPENDENCIES.map((key) => {
      const candidate = implementation(key)
      if (key === 'production-classifier') {
        return brandProductionPort('production-classifier', {
          ...implementation('production-classifier'),
          readiness: () => {
            classifierChecks += 1
            if (classifierChecks > 1) throw new Error('private-provider-circuit-detail')
            return 'ready'
          },
        })
      }
      return brandProductionPort(key, candidate)
    }))

    let result: ReturnType<typeof createStudyProductionComposition> | undefined
    expect(() => {
      result = createStudyProductionComposition({
        featureFlagValue: 'true',
        authenticatedHostSession: true,
        selectedLearnerAuthorized: true,
        authority: genuineGuardianAuthority(),
        registry,
        academicRuntime: brandVerifiedLearnerAcademicRuntime({
          deployment: 'production',
          runtimeVersion: 'verified-academic-runtime-v1',
          acceptsVerifiedStudentIdentity: true,
          containsSyntheticLearnerSentinel: false,
          execute: async () => Object.freeze({ status: 'accepted' }),
        }),
      })
    }).not.toThrow()
    expect(result).toMatchObject({
      available: false,
      status: 'not-ready',
      blocker: 'readiness',
      clientReadiness: { schemaVersion: 1, status: 'not-ready' },
    })
    expect(JSON.stringify(result?.clientReadiness)).not.toContain('private-provider')
  })
})

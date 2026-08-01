import { describe, expect, it } from 'vitest'
import { StudyProductionError, productionErrorWireResult } from './errors'
import {
  brandProductionPort,
  createProductionPortRegistry,
  isBrandedProductionPort,
  productionPortReadiness,
  type BrandedProductionPort,
  type ProductionPortImplementation,
} from './ports'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  REQUIRED_PRODUCTION_DEPENDENCIES,
  evaluateProductionReadiness,
  type ProductionDependencyKey,
} from './readiness'

function implementation(key: ProductionDependencyKey): ProductionPortImplementation {
  const spec = PRODUCTION_DEPENDENCY_SPECIFICATIONS[key]
  return {
    deployment: 'production',
    implementationId: `manuel-academy:${key}:v1`,
    trustBoundary: spec.trustBoundary,
    durable: spec.durability === 'durable',
    isReady: () => 'ready',
  }
}

describe('production port registry security', () => {
  it('brands and requires the complete set of production ports', () => {
    const handles = REQUIRED_PRODUCTION_DEPENDENCIES.map((key) => brandProductionPort(key, implementation(key)))
    const registry = createProductionPortRegistry(handles)
    const readiness = evaluateProductionReadiness(productionPortReadiness(registry))
    expect(readiness).toMatchObject({ status: 'ready', permitsAcademicStudy: true, dependenciesComplete: true })
  })

  it.each(['local-development', 'in-memory', 'test-fixture', 'preview', 'synthetic', 'noop', 'mock-provider'])(
    'rejects non-production implementation provenance: %s',
    (implementationId) => {
      expect(() => brandProductionPort('checkpoint-adapter', {
        ...implementation('checkpoint-adapter'), implementationId,
      })).toThrowError(new StudyProductionError('production-dependency-invalid'))
    },
  )

  it('rejects wrong durability, wrong trust boundary, and test/preview markers', () => {
    expect(() => brandProductionPort('outbox-store', {
      ...implementation('outbox-store'), durable: false,
    })).toThrow(/does not satisfy/i)
    expect(() => brandProductionPort('session-verifying-authorizer', {
      ...implementation('session-verifying-authorizer'), trustBoundary: 'authenticated-rpc',
    })).toThrow(/does not satisfy/i)
    expect(() => brandProductionPort('calendar-adapter', {
      ...implementation('calendar-adapter'), testOnly: true as false,
    })).toThrow(/does not satisfy/i)
    expect(() => brandProductionPort('calendar-adapter', {
      ...implementation('calendar-adapter'), previewOnly: true as false,
    })).toThrow(/does not satisfy/i)
  })

  it('cannot register an unbranded cast or omit a dependency', () => {
    const counterfeit = {
      key: 'checkpoint-adapter',
      port: implementation('checkpoint-adapter'),
      readiness: () => ({ status: 'ready' }),
    } as unknown as BrandedProductionPort
    expect(isBrandedProductionPort(counterfeit)).toBe(false)
    expect(() => createProductionPortRegistry([counterfeit])).toThrow(/does not satisfy/i)

    const incomplete = REQUIRED_PRODUCTION_DEPENDENCIES
      .filter((key) => key !== 'receipt-validator')
      .map((key) => brandProductionPort(key, implementation(key)))
    expect(() => createProductionPortRegistry(incomplete)).toThrow(/missing/i)
  })

  it('returns structured client-safe errors without identifiers or secrets', () => {
    const error = new StudyProductionError('authorization-stale')
    expect(productionErrorWireResult(error)).toEqual({ schemaVersion: 1, code: 'authorization-stale', retryable: false })
    expect(JSON.stringify(productionErrorWireResult(error))).not.toMatch(/token|household|student|recipient/i)
  })
})

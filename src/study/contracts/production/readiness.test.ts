import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_DEPENDENCY_SPECIFICATIONS,
  REQUIRED_PRODUCTION_DEPENDENCIES,
  evaluateProductionReadiness,
  productionStudyIsAvailable,
  readinessWireResult,
  type ProductionDependencyKey,
  type ProductionDependencyRegistration,
} from './readiness'

const registrations = (): ProductionDependencyRegistration[] => REQUIRED_PRODUCTION_DEPENDENCIES.map((key) => ({
  schemaVersion: 1,
  key,
  implementation: 'production',
  trustBoundary: PRODUCTION_DEPENDENCY_SPECIFICATIONS[key].trustBoundary,
  durability: PRODUCTION_DEPENDENCY_SPECIFICATIONS[key].durability,
  status: 'ready',
  version: `manuel-academy:${key}:v1`,
}))

describe('canonical production readiness', () => {
  it('requires every production dependency and rejects a feature-flag-only launch', () => {
    const all = registrations()
    for (const missing of REQUIRED_PRODUCTION_DEPENDENCIES) {
      const readiness = evaluateProductionReadiness(all.filter(({ key }) => key !== missing))
      expect(readiness.status, missing).toBe('not-ready')
      expect(readiness.permitsAcademicStudy, missing).toBe(false)
      expect(readiness.issues).toContainEqual({ dependency: missing, code: 'production-dependency-missing' })
    }
    const notReady = evaluateProductionReadiness([])
    expect(productionStudyIsAvailable({
      featureFlagValue: 'true', authenticatedHostSession: true, selectedLearnerAuthorized: true, readiness: notReady,
    })).toBe(false)
})
  it('reports ready only for the complete production registry', () => {
    const readiness = evaluateProductionReadiness(registrations())
    expect(readiness.status).toBe('ready')
    expect(readiness.permitsAcademicStudy).toBe(true)
    expect(readiness.dependenciesComplete).toBe(true)
    expect(readiness.access.guardian).toBe('ready')
    expect(productionStudyIsAvailable({
      featureFlagValue: 'true', authenticatedHostSession: true, selectedLearnerAuthorized: true, readiness,
    })).toBe(true)
  })

  it('fails closed for not-ready and degraded dependencies', () => {
    const notReady = registrations()
    const notReadyKey: ProductionDependencyKey = 'production-classifier'
    notReady[notReady.findIndex(({ key }) => key === notReadyKey)] = {
      ...notReady.find(({ key }) => key === notReadyKey)!, status: 'not-ready',
    }
    expect(evaluateProductionReadiness(notReady)).toMatchObject({ status: 'not-ready', permitsAcademicStudy: false })

    const degraded = registrations()
    const degradedKey: ProductionDependencyKey = 'monitoring-sink'
    degraded[degraded.findIndex(({ key }) => key === degradedKey)] = {
      ...degraded.find(({ key }) => key === degradedKey)!, status: 'degraded',
    }
    expect(evaluateProductionReadiness(degraded)).toMatchObject({ status: 'degraded', permitsAcademicStudy: false })
  })

  it('keeps direct student not-ready without an issuer and staff disabled without an approved model', () => {
    const closed = evaluateProductionReadiness(registrations())
    expect(closed.access).toEqual({ guardian: 'ready', directStudent: 'not-ready', staff: 'disabled' })
    expect(closed.issues).toContainEqual({
      dependency: 'student-session-issuer', code: 'student-session-issuer-unavailable',
    })
    expect(closed.issues).toContainEqual({
      dependency: 'staff-authorization-model', code: 'staff-authorization-disabled',
    })

    const enabled = evaluateProductionReadiness(registrations(), {
      studentSessionIssuer: {
        status: 'ready',
        issuerVersion: 'academy-student-session-issuer.v1',
        trustBoundary: 'trusted-server',
        issuesServerVerifiableGrants: true,
      },
      staffAuthorizationModel: {
        status: 'ready',
        approvedModelVersion: 'academy-staff-study.v1',
        trustBoundary: 'trusted-server',
        explicitStudyPermission: true,
        auditEventsRequired: true,
      },
    })
    expect(enabled.access).toEqual({ guardian: 'ready', directStudent: 'ready', staff: 'enabled' })
  })

  it('exposes only a sanitized readiness state to clients', () => {
    const readiness = evaluateProductionReadiness([])
    expect(readinessWireResult(readiness)).toEqual({ schemaVersion: 1, status: 'not-ready' })
    expect(JSON.stringify(readinessWireResult(readiness))).not.toContain('dependency')
  })

  it.each([
    { featureFlagValue: 'false', authenticatedHostSession: true, selectedLearnerAuthorized: true },
    { featureFlagValue: 'TRUE', authenticatedHostSession: true, selectedLearnerAuthorized: true },
    { featureFlagValue: 'true', authenticatedHostSession: false, selectedLearnerAuthorized: true },
    { featureFlagValue: 'true', authenticatedHostSession: true, selectedLearnerAuthorized: false },
  ])('does not permit availability when a host gate is false: %o', (gate) => {
    expect(productionStudyIsAvailable({ ...gate, readiness: evaluateProductionReadiness(registrations()) })).toBe(false)
  })
})

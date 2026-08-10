import { describe, expect, it } from 'vitest'
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_RESOURCE_TYPES,
  ADMIN_BILLING_DISPOSITIONS,
  ADMIN_CONTRACT_VERSION,
  ADMIN_COST_KINDS,
  ADMIN_CURRENCIES,
  ADMIN_ENGINE_IDS,
  ADMIN_HEALTH_STATES,
  ADMIN_HOUSEHOLD_ATTRIBUTION_STATES,
  ADMIN_OPERATIONAL_CAPABILITIES,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_OWNER_CAPABILITIES,
  ADMIN_PRICING_UNITS,
  ADMIN_PROHIBITED_TELEMETRY_FIELDS,
  ADMIN_READ_CAPABILITIES,
  ADMIN_ROLE_CAPABILITIES,
  ADMIN_ROLES,
  ADMIN_TELEMETRY_METADATA_KEYS,
  ADMIN_USAGE_IDEMPOTENCY_RESULTS,
  hasConsistentAdminUsageCost,
  hasAdminCapability,
  isCanonicalIntegerMicros,
} from './contracts'

describe('ADMIN-0 shared vocabulary', () => {
  it('freezes the canonical roles, engines, health states, and result states', () => {
    expect(ADMIN_CONTRACT_VERSION).toBe(2)
    expect(ADMIN_ROLES).toEqual(['owner', 'admin', 'viewer'])
    expect(ADMIN_ENGINE_IDS).toEqual([
      'tutor',
      'study',
      'assessment',
      'curriculum',
      'jarvis',
      'tts',
      'gateway',
      'sync',
    ])
    expect(ADMIN_HEALTH_STATES).toEqual([
      'healthy',
      'degraded',
      'unavailable',
      'disabled',
      'unknown',
    ])
    expect(ADMIN_OPERATIONAL_RESULTS).toEqual([
      'success',
      'fallback',
      'rejected',
      'timeout',
      'provider_error',
      'validation_error',
      'safety_stop',
    ])
  })

  it('extends audit version 2 with only the immediate granular curriculum vocabulary', () => {
    expect(ADMIN_CONTRACT_VERSION).toBe(2)
    expect(ADMIN_AUDIT_ACTIONS).toEqual([
      'admin_role.assign',
      'admin_role.revoke',
      'configuration.update',
      'engine.control',
      'safety.triage',
      'incident.acknowledge',
      'curriculum_draft.create',
      'curriculum_draft.update',
      'curriculum_entity.create',
      'curriculum_entity.update',
      'curriculum_entity.tombstone',
      'curriculum_draft.collaborator.add',
      'curriculum_draft.collaborator.revoke',
      'curriculum_approval.approve',
      'curriculum_approval.changes_requested',
      'curriculum.approve',
      'curriculum.publish',
      'release.activate',
      'release.rollback',
    ])
    expect(ADMIN_AUDIT_RESOURCE_TYPES).toEqual([
      'admin_role_assignment',
      'configuration',
      'engine',
      'safety_case',
      'incident',
      'curriculum_draft',
      'curriculum_entity',
      'curriculum_approval',
      'curriculum_release',
      'application_release',
    ])
  })

  it('keeps provider accounting lossless and explicit', () => {
    expect(ADMIN_PRICING_UNITS).toEqual([
      'input_token',
      'output_token',
      'cached_input_read_token',
      'cached_input_write_token',
      'tts_character',
      'request',
    ])
    expect(ADMIN_COST_KINDS).toEqual([
      'calculated',
      'reconciled',
      'unavailable',
    ])
    expect(ADMIN_BILLING_DISPOSITIONS).toEqual([
      'billable',
      'not_billable',
      'unknown',
    ])
    expect(ADMIN_HOUSEHOLD_ATTRIBUTION_STATES).toEqual([
      'resolved',
      'no_active_household',
      'ambiguous',
      'lookup_unavailable',
    ])
    expect(ADMIN_CURRENCIES).toEqual(['USD'])
    expect(ADMIN_USAGE_IDEMPOTENCY_RESULTS).toEqual([
      'created',
      'replayed',
      'reconciliation_conflict',
    ])
  })

  it('enforces identity and cost-kind cross-field invariants', () => {
    const calculatedZero = {
      householdRef: 'household-1',
      householdAttribution: 'resolved' as const,
      learnerRef: null,
      billingDisposition: 'billable' as const,
      costMicros: '0',
      costKind: 'calculated' as const,
      pricingCatalogVersion: null,
      costComponents: [],
      currency: 'USD' as const,
      reconciliationRef: null,
    }
    expect(hasConsistentAdminUsageCost(calculatedZero)).toBe(true)
    expect(
      hasConsistentAdminUsageCost({
        ...calculatedZero,
        householdRef: null,
        householdAttribution: 'ambiguous',
      }),
    ).toBe(true)
    expect(
      hasConsistentAdminUsageCost({
        ...calculatedZero,
        householdRef: null,
      }),
    ).toBe(false)
    expect(
      hasConsistentAdminUsageCost({
        ...calculatedZero,
        billingDisposition: 'unknown',
        costKind: 'unavailable',
        costMicros: null,
      }),
    ).toBe(true)
    expect(
      hasConsistentAdminUsageCost({
        ...calculatedZero,
        billingDisposition: 'unknown',
      }),
    ).toBe(false)
    expect(
      hasConsistentAdminUsageCost({
        ...calculatedZero,
        billingDisposition: 'not_billable',
        costMicros: '1',
      }),
    ).toBe(false)
  })

  it('makes role capability inheritance explicit', () => {
    for (const capability of ADMIN_READ_CAPABILITIES) {
      expect(hasAdminCapability('viewer', capability)).toBe(true)
      expect(hasAdminCapability('admin', capability)).toBe(true)
      expect(hasAdminCapability('owner', capability)).toBe(true)
    }
    for (const capability of ADMIN_OPERATIONAL_CAPABILITIES) {
      expect(hasAdminCapability('viewer', capability)).toBe(false)
      expect(hasAdminCapability('admin', capability)).toBe(true)
      expect(hasAdminCapability('owner', capability)).toBe(true)
    }
    for (const capability of ADMIN_OWNER_CAPABILITIES) {
      expect(hasAdminCapability('viewer', capability)).toBe(false)
      expect(hasAdminCapability('admin', capability)).toBe(false)
      expect(hasAdminCapability('owner', capability)).toBe(true)
    }
    expect(new Set(ADMIN_ROLE_CAPABILITIES.owner).size).toBe(
      ADMIN_ROLE_CAPABILITIES.owner.length,
    )
  })

  it('keeps metadata allowlists disjoint from prohibited learner content', () => {
    const allowed = new Set<string>(ADMIN_TELEMETRY_METADATA_KEYS)
    for (const field of ADMIN_PROHIBITED_TELEMETRY_FIELDS) {
      expect(allowed.has(field)).toBe(false)
    }
  })

  it('accepts only canonical non-negative decimal money strings', () => {
    expect(isCanonicalIntegerMicros('0')).toBe(true)
    expect(isCanonicalIntegerMicros('9007199254740993')).toBe(true)
    for (const value of ['', '-1', '01', '1.5', '1e6', ' 1']) {
      expect(isCanonicalIntegerMicros(value)).toBe(false)
    }
  })
})

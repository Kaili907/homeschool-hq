import { describe, expect, it } from 'vitest'
import {
  ADMIN_ENGINE_IDS,
  ADMIN_HEALTH_STATES,
  ADMIN_OPERATIONAL_CAPABILITIES,
  ADMIN_OPERATIONAL_RESULTS,
  ADMIN_OWNER_CAPABILITIES,
  ADMIN_PROHIBITED_TELEMETRY_FIELDS,
  ADMIN_READ_CAPABILITIES,
  ADMIN_ROLE_CAPABILITIES,
  ADMIN_ROLES,
  ADMIN_TELEMETRY_METADATA_KEYS,
  hasAdminCapability,
  isCanonicalIntegerMicros,
} from './contracts'

describe('ADMIN-0 shared vocabulary', () => {
  it('freezes the canonical roles, engines, health states, and result states', () => {
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

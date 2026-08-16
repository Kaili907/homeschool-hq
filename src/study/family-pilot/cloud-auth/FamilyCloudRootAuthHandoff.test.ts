import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import {
  familyCloudAuthEventTarget,
  familyCloudAuthReturnIsRecovery,
  hasFamilyCloudAuthReturn,
} from './FamilyCloudRootAuthHandoff'

afterEach(() => vi.unstubAllGlobals())

describe('Family Cloud root auth-return handoff', () => {
  it('recognizes provider URL state without reading or decoding token values', () => {
    vi.stubGlobal('window', { location: { search: '?code=provider-code', hash: '' } })
    expect(hasFamilyCloudAuthReturn()).toBe(true)
    expect(familyCloudAuthReturnIsRecovery()).toBe(false)
  })

  it('preserves an old root recovery return for the canonical reset route', () => {
    vi.stubGlobal('window', { location: { search: '', hash: '#type=recovery&access_token=opaque' } })
    expect(hasFamilyCloudAuthReturn()).toBe(true)
    expect(familyCloudAuthReturnIsRecovery()).toBe(true)
    expect(familyCloudAuthEventTarget('PASSWORD_RECOVERY', {} as Session)).toBe('/family-pilot/reset-password')
  })

  it('hands a recognized magic-link session into Family Pilot', () => {
    expect(familyCloudAuthEventTarget('SIGNED_IN', {} as Session)).toBe('/family-pilot')
    expect(familyCloudAuthEventTarget('SIGNED_IN', null)).toBeNull()
  })
})

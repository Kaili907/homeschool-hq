import { describe, expect, it } from 'vitest'
import { resolveProviderBuildPolicy } from './providerBoundary'

describe('production provider boundary', () => {
  it('forces gateways and rejects browser keys even when unsafe flags are requested', () => {
    expect(resolveProviderBuildPolicy({
      production: true,
      development: false,
      test: false,
      proxyRequested: false,
      browserKeysRequested: true,
    })).toEqual({
      gatewayRequired: true,
      browserProviderKeysAllowed: false,
      directProviderRequestsAllowed: false,
    })
  })

  it('requires an explicit local-development key flag', () => {
    expect(resolveProviderBuildPolicy({
      production: false,
      development: true,
      test: false,
      proxyRequested: false,
      browserKeysRequested: false,
    }).browserProviderKeysAllowed).toBe(false)
    expect(resolveProviderBuildPolicy({
      production: false,
      development: true,
      test: false,
      proxyRequested: false,
      browserKeysRequested: true,
    }).directProviderRequestsAllowed).toBe(true)
  })

  it('keeps dependency-injected tests available without relaxing production', () => {
    expect(resolveProviderBuildPolicy({
      production: false,
      development: false,
      test: true,
      proxyRequested: false,
      browserKeysRequested: false,
    }).directProviderRequestsAllowed).toBe(true)
  })
})

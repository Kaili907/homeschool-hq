import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_EXTERNAL_EMAIL_PROVIDER,
  DEFAULT_EXTERNAL_SMS_PROVIDER,
  createExternalProviderAdapter,
} from './external-provider.js'

const delivery = Object.freeze({
  idempotencyKey: `study-safety-delivery:${'a'.repeat(64)}`,
  attemptId: 'attempt:synthetic-1',
  recipientRef: 'recipient:synthetic-guardian',
  routeRef: 'email-route:synthetic-guardian',
  templateCode: 'study-safety-adult-review-v1',
})

function config(overrides = {}) {
  return {
    channel: 'email',
    providerId: 'approved-provider:synthetic',
    providerVersion: 'approved-provider-v1',
    configurationVersion: 'approved-config-v1',
    isDurable: true,
    isTestProvider: false,
    supportsDurableIdempotency: true,
    deliver: vi.fn(async () => ({ state: 'temporary-failure' })),
    verifyReceipt: vi.fn(async () => ({ verified: false })),
    deploymentMode: 'non-production',
    ...overrides,
  }
}

describe('external provider governance boundary', () => {
  it('keeps unapproved email and SMS explicitly not-ready and network-incapable', async () => {
    expect(DEFAULT_EXTERNAL_EMAIL_PROVIDER.isReady()).toBe(false)
    expect(DEFAULT_EXTERNAL_SMS_PROVIDER.isReady()).toBe(false)
    await expect(DEFAULT_EXTERNAL_EMAIL_PROVIDER.deliver(delivery)).resolves.toEqual({
      state: 'indeterminate', failureCode: 'provider-not-ready',
    })
  })

  it('makes response loss indeterminate and blocks blind resend', async () => {
    const deliver = vi.fn(async () => { throw new Error('synthetic-response-loss') })
    const adapter = createExternalProviderAdapter(config({ deliver }))
    await expect(adapter.deliver(delivery)).resolves.toEqual({
      state: 'indeterminate', failureCode: 'provider-response-lost',
    })
    await expect(adapter.deliver(delivery)).resolves.toEqual({
      state: 'indeterminate', failureCode: 'provider-reconciliation-required',
    })
    expect(deliver).toHaveBeenCalledOnce()
  })

  it('forbids test providers in production composition', () => {
    expect(() => createExternalProviderAdapter(config({
      isTestProvider: true,
      deploymentMode: 'production',
    }))).toThrow('test_external_provider_forbidden_in_production')
  })

  it('rejects caller-supplied contact or raw fields', async () => {
    const adapter = createExternalProviderAdapter(config())
    await expect(adapter.deliver({ ...delivery, email: 'synthetic@example.invalid' }))
      .rejects.toThrow('invalid_external_delivery_input')
    await expect(adapter.deliver({ ...delivery, rawText: 'synthetic disclosure' }))
      .rejects.toThrow('invalid_external_delivery_input')
  })
})

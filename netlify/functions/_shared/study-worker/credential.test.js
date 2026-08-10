import { describe, expect, it, vi } from 'vitest'
import { createSupabaseServiceRpc } from '../study-adult-review/supabase-ports.js'
import {
  ADULT_REVIEW_WORKER_INVOCATION_HEADER,
  createNetlifyScheduledWorkerCredentialSource,
  createNetlifyWorkerCredentialVerifier,
  createNetlifyWorkerInvocationAuthorization,
} from './credential.js'
import { ADULT_REVIEW_WORKER_SCOPE, validateVerifiedWorkerContext } from './context.js'

const WORKER_CREDENTIAL = 'opaque-adult-review-worker-credential-000001'
const INVOCATION_SECRET = 'opaque-adult-review-invocation-secret-000001'

const ENV = Object.freeze({
  SUPABASE_URL: 'https://academy.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-0000000000000000000000',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review:1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: 'credential:adult-review:1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: WORKER_CREDENTIAL,
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'v1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'cfg-v1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET: INVOCATION_SECRET,
})

const CHECKED_AT = '2026-08-07T12:00:00.000Z'

function request(overrides = {}) {
  return {
    workerCredential: WORKER_CREDENTIAL,
    trigger: 'manual',
    requiredScope: ADULT_REVIEW_WORKER_SCOPE,
    requiredCredentialVersion: 'v1',
    requiredSchemaVersion: 1,
    checkedAt: CHECKED_AT,
    ...overrides,
  }
}

describe('worker credential verifier: configuration binding envelope', () => {
  it('mints the exact verified worker context the worker contract requires', async () => {
    const verifier = createNetlifyWorkerCredentialVerifier({ env: ENV })
    expect(verifier.isDurable).toBe(true)
    expect(verifier.isReady()).toBe(true)

    const context = await verifier.verify(request())
    expect(() => validateVerifiedWorkerContext(context, { at: new Date(CHECKED_AT) }))
      .not.toThrow()
    expect(context).toEqual({
      verified: true,
      schemaVersion: 1,
      workerIdentity: 'worker:adult-review:1',
      credentialId: 'credential:adult-review:1',
      credentialVersion: 'v1',
      scope: ADULT_REVIEW_WORKER_SCOPE,
      expiresAt: '2026-08-07T12:05:00.000Z',
      revoked: false,
      verifierVersion: 'netlify-adult-review-worker-verifier-v1',
      verificationRef: expect.stringMatching(/^verification:[a-f0-9]{64}$/),
    })
  })

  it('never carries credential material in the envelope it mints', async () => {
    const context = await createNetlifyWorkerCredentialVerifier({ env: ENV }).verify(request())
    expect(JSON.stringify(context)).not.toContain(WORKER_CREDENTIAL)
    expect(JSON.stringify(context)).not.toContain(INVOCATION_SECRET)
  })

  it('binds the verification reference to configuration identity, not to the secret', async () => {
    const verifier = createNetlifyWorkerCredentialVerifier({ env: ENV })
    const rotated = createNetlifyWorkerCredentialVerifier({
      env: { ...ENV, ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID: 'credential:adult-review:2' },
    })
    const first = await verifier.verify(request())
    const again = await verifier.verify(request())
    const other = await rotated.verify(request())
    expect(again.verificationRef).toBe(first.verificationRef)
    expect(other.verificationRef).not.toBe(first.verificationRef)
    // A different instant is a different verification.
    const later = await verifier.verify(request({ checkedAt: '2026-08-07T12:00:01.000Z' }))
    expect(later.verificationRef).not.toBe(first.verificationRef)
  })

  it.each([
    ['a wrong credential', { workerCredential: `${WORKER_CREDENTIAL}x` }],
    ['a short credential', { workerCredential: 'too-short' }],
    ['a missing credential', { workerCredential: undefined }],
    ['a non-string credential', { workerCredential: { toString: () => WORKER_CREDENTIAL } }],
    ['a wrong scope', { requiredScope: 'study:adult-review:other' }],
    ['a wrong schema version', { requiredSchemaVersion: 2 }],
    ['a wrong credential version', { requiredCredentialVersion: 'v2' }],
    ['an unknown trigger', { trigger: 'cron' }],
    ['a missing trigger', { trigger: undefined }],
    ['an unparseable instant', { checkedAt: 'not-a-time' }],
  ])('refuses %s', async (_name, overrides) => {
    const verifier = createNetlifyWorkerCredentialVerifier({ env: ENV })
    await expect(verifier.verify(request(overrides)))
      .rejects.toThrow('worker_credential_verification_failed')
  })

  it('never accepts a caller-supplied worker identity', async () => {
    const verifier = createNetlifyWorkerCredentialVerifier({ env: ENV })
    const context = await verifier.verify(request({
      workerIdentity: 'worker:attacker',
      credentialId: 'credential:attacker',
      verificationRef: 'verification:attacker',
    }))
    expect(context.workerIdentity).toBe('worker:adult-review:1')
    expect(context.credentialId).toBe('credential:adult-review:1')
    expect(context.verificationRef).not.toContain('attacker')
  })

  it.each([
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION',
  ])('is not ready and refuses to verify without %s', async (key) => {
    const env = { ...ENV }
    delete env[key]
    const verifier = createNetlifyWorkerCredentialVerifier({ env })
    expect(verifier.isReady()).toBe(false)
    await expect(verifier.verify(request())).rejects.toThrow('worker_credential_not_configured')
  })
})

describe('worker credential verifier: durable authority stays in SQL', () => {
  it('lets a locally valid but durably revoked credential fail on the next RPC', async () => {
    // The JS envelope is a configuration artifact. The durable registry is the
    // authorization authority, and it rejects the same credential the moment
    // it is revoked there.
    const verifier = createNetlifyWorkerCredentialVerifier({ env: ENV })
    const context = await verifier.verify(request())

    const fetchImpl = vi.fn(async (_url, init) => {
      const revoked = init.headers['x-academy-study-worker-credential'] === WORKER_CREDENTIAL
      return revoked
        ? { ok: false, status: 403, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => ({ jobs: [], serverTime: null }) }
    })
    const rpc = createSupabaseServiceRpc({ env: ENV, fetchImpl })
    await expect(rpc.call('academy_study_claim_delivery_jobs_v2', {}, {
      requireWorkerCredential: true,
      workerContext: context,
    })).rejects.toThrow('durable_port_unavailable')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('cannot present credential headers for an identity it does not own', async () => {
    const verifier = createNetlifyWorkerCredentialVerifier({
      env: { ...ENV, ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker:adult-review:2' },
    })
    const context = await verifier.verify(request())
    const rpc = createSupabaseServiceRpc({ env: ENV, fetchImpl: vi.fn() })
    await expect(rpc.call('academy_study_claim_delivery_jobs_v2', {}, {
      requireWorkerCredential: true,
      workerContext: context,
    })).rejects.toThrow('worker_credential_not_configured')
  })
})

describe('worker invocation authorization', () => {
  const monitor = () => ({ record: vi.fn(async () => undefined) })

  it('is ready only with a configured secret and a monitor', () => {
    expect(createNetlifyWorkerInvocationAuthorization({ env: ENV, monitor: monitor() }).isReady())
      .toBe(true)
    expect(createNetlifyWorkerInvocationAuthorization({ env: ENV }).isReady()).toBe(false)
    const env = { ...ENV }
    delete env.ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET
    expect(createNetlifyWorkerInvocationAuthorization({ env, monitor: monitor() }).isReady())
      .toBe(false)
  })

  it('authorizes a manual invocation that presents the server-held secret', async () => {
    const authorization = createNetlifyWorkerInvocationAuthorization({ env: ENV, monitor: monitor() })
    expect(await authorization.credentialForEvent({
      trigger: 'manual',
      event: { headers: { [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: INVOCATION_SECRET } },
    })).toEqual({ authorized: true, workerCredential: WORKER_CREDENTIAL })
  })

  it('refuses the scheduled trigger outright: x-nf-event is not an authenticated signal', async () => {
    const authorization = createNetlifyWorkerInvocationAuthorization({ env: ENV, monitor: monitor() })
    expect(authorization.scheduledInvocationAuthority).toBe('blocked')
    expect(await authorization.credentialForEvent({
      trigger: 'scheduled',
      event: { headers: { 'x-nf-event': 'schedule', [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: INVOCATION_SECRET } },
    })).toEqual({ authorized: false })
  })

  it.each([
    ['no header', {}],
    ['an empty header', { [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: '' }],
    ['a short header', { [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: 'short' }],
    ['a near-miss header', { [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: `${INVOCATION_SECRET}x` }],
    ['the worker credential instead', { [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: WORKER_CREDENTIAL }],
    ['a duplicated header', {
      [ADULT_REVIEW_WORKER_INVOCATION_HEADER]: INVOCATION_SECRET,
      [ADULT_REVIEW_WORKER_INVOCATION_HEADER.toUpperCase()]: INVOCATION_SECRET,
    }],
  ])('refuses a manual invocation with %s', async (_name, headers) => {
    const authorization = createNetlifyWorkerInvocationAuthorization({ env: ENV, monitor: monitor() })
    expect(await authorization.credentialForEvent({ trigger: 'manual', event: { headers } }))
      .toEqual({ authorized: false })
  })

  it('records a minimized denial and never the secret', async () => {
    const sink = monitor()
    const authorization = createNetlifyWorkerInvocationAuthorization({ env: ENV, monitor: sink })
    await authorization.recordDenied({
      eventName: 'study.adult_review.unauthorized_worker',
      reasonCode: 'worker-auth-failed',
    })
    expect(sink.record).toHaveBeenCalledWith('study.adult_review.unauthorized_worker', {
      occurrences: 1,
      value: 1,
      dimensions: { source: 'netlify-function', reason_code: 'worker-auth-failed' },
    })
    expect(JSON.stringify(sink.record.mock.calls)).not.toContain(INVOCATION_SECRET)
  })
})

describe('scheduled worker credential source', () => {
  it('uses deployment configuration without depending on manual invocation authority', async () => {
    const env = { ...ENV }
    delete env.ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET
    const source = createNetlifyScheduledWorkerCredentialSource({ env })

    expect(source.isDurable).toBe(true)
    expect(source.isReady()).toBe(true)
    expect(source.authorityBoundary).toBe('netlify-scheduled-function')
    expect(await source.credentialForRun()).toBe(WORKER_CREDENTIAL)
    expect(JSON.stringify(source)).not.toContain(WORKER_CREDENTIAL)
  })

  it.each([
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION',
    'ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION',
  ])('fails closed without %s', async (key) => {
    const env = { ...ENV }
    delete env[key]
    const source = createNetlifyScheduledWorkerCredentialSource({ env })
    expect(source.isReady()).toBe(false)
    await expect(source.credentialForRun()).rejects.toThrow(
      'Scheduled worker credential is not configured',
    )
  })
})

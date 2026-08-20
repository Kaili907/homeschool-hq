import { describe, expect, it, vi } from 'vitest'
import { ADMIN_STEP_UP_MAX_AGE_SECONDS } from '../../../src/admin/stepUpAssurance.ts'
import { createAdminStepUpAssurance } from './admin-step-up-assurance.js'

const ACTOR = '00000000-0000-4000-8000-000000000001'
const OTHER_ACTOR = '00000000-0000-4000-8000-000000000002'
const SESSION = '10000000-0000-4000-8000-000000000001'
const OTHER_SESSION = '10000000-0000-4000-8000-000000000002'
const NOW_SECONDS = 1_800_000_000

function token(overrides = {}) {
  const payload = {
    sub: ACTOR,
    session_id: SESSION,
    aal: 'aal2',
    iat: NOW_SECONDS - 10,
    exp: NOW_SECONDS + 3_600,
    amr: [
      { method: 'mfa/totp', timestamp: NOW_SECONDS - 30 },
      { method: 'password', timestamp: NOW_SECONDS - 3_600 },
    ],
    ...overrides,
  }
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`
}

function verifier(accessToken = token(), userId = ACTOR) {
  return vi.fn(async () => ({ ok: true, user: { id: userId }, accessToken }))
}

function core(options = {}) {
  return createAdminStepUpAssurance({
    clock: () => new Date(NOW_SECONDS * 1_000),
    ...options,
  })
}

describe('Admin fresh-identity step-up assurance', () => {
  it('derives bounded sanitized assurance from verified AAL2 MFA evidence', async () => {
    const accessToken = token()
    const authVerifier = verifier(accessToken)
    const stepUp = core({ authVerifier })
    const result = await stepUp.check({
      headers: { authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ stepUpConfirmed: false, role: 'viewer' }),
    })

    expect(authVerifier).toHaveBeenCalledOnce()
    expect(result).toEqual({
      status: 'assured',
      assurance: {
        version: 1,
        kind: 'admin-step-up',
        actorUserId: ACTOR,
        sessionId: SESSION,
        authenticationMethod: 'mfa/totp',
        authenticatedAt: new Date((NOW_SECONDS - 30) * 1_000).toISOString(),
        expiresAt: new Date((NOW_SECONDS - 30 + ADMIN_STEP_UP_MAX_AGE_SECONDS) * 1_000).toISOString(),
      },
    })
  })

  it('does not mistake a normal login or browser confirmation for step-up', async () => {
    const accessToken = token({
      aal: 'aal1',
      role: 'owner',
      amr: [{ method: 'password', timestamp: NOW_SECONDS - 15 }],
    })
    const result = await core({ authVerifier: verifier(accessToken) }).check({
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-admin-step-up': 'true',
        'x-admin-role': 'owner',
      },
      body: JSON.stringify({ confirmedWithinFiveMinutes: true, role: 'owner' }),
    })
    expect(result).toEqual({ status: 'required', reason: 'aal2_required' })
  })

  it('uses the MFA event time, not a fresh token issuance time', async () => {
    const accessToken = token({
      iat: NOW_SECONDS - 1,
      amr: [
        { method: 'mfa/totp', timestamp: NOW_SECONDS - ADMIN_STEP_UP_MAX_AGE_SECONDS },
        { method: 'token_refresh', timestamp: NOW_SECONDS - 1 },
      ],
    })
    await expect(core({ authVerifier: verifier(accessToken) }).check({})).resolves.toEqual({
      status: 'required',
      reason: 'fresh_authentication_required',
    })
  })

  it.each([
    ['missing AAL', { aal: undefined }],
    ['missing AMR', { amr: undefined }],
    ['string AMR without freshness', { amr: ['mfa/totp'] }],
    ['future AMR time', { amr: [{ method: 'mfa/totp', timestamp: NOW_SECONDS + 1 }] }],
    ['AMR after token issuance', { amr: [{ method: 'mfa/totp', timestamp: NOW_SECONDS - 1 }], iat: NOW_SECONDS - 2 }],
    ['expired token', { exp: NOW_SECONDS }],
    ['future token issuance', { iat: NOW_SECONDS + 1 }],
    ['missing session', { session_id: undefined }],
    ['malformed session', { session_id: 'not-a-session' }],
  ])('fails closed for %s', async (_label, overrides) => {
    const accessToken = token(overrides)
    await expect(core({ authVerifier: verifier(accessToken) }).check({})).resolves.toEqual({
      status: 'unavailable',
    })
  })

  it('requires fresh authentication when AAL2 has no recognized MFA event', async () => {
    const accessToken = token({
      amr: [{ method: 'custom-mfa', timestamp: NOW_SECONDS - 15 }],
    })
    await expect(core({ authVerifier: verifier(accessToken) }).check({})).resolves.toEqual({
      status: 'required',
      reason: 'fresh_authentication_required',
    })
  })

  it('fails closed for malformed JWT payloads and provider/subject mismatch', async () => {
    for (const [accessToken, userId] of [
      ['not-a-jwt', ACTOR],
      ['header.***.signature', ACTOR],
      [token({ sub: OTHER_ACTOR }), ACTOR],
      [token(), 'not-a-user-id'],
    ]) {
      await expect(core({ authVerifier: verifier(accessToken, userId) }).check({})).resolves.toEqual({
        status: 'unavailable',
      })
    }
  })

  it('maps provider authentication denial and outages without manufacturing assurance', async () => {
    await expect(core({
      authVerifier: async () => ({ ok: false, response: { statusCode: 401 } }),
    }).check({})).resolves.toEqual({ status: 'unauthenticated' })
    await expect(core({
      authVerifier: async () => ({ ok: false, response: { statusCode: 503 } }),
    }).check({})).resolves.toEqual({ status: 'unavailable' })
    await expect(core({
      authVerifier: async () => { throw new Error('provider failed unexpectedly') },
    }).check({})).resolves.toEqual({ status: 'unavailable' })
  })

  it('caps assurance expiry at the provider token expiry', async () => {
    const accessToken = token({ exp: NOW_SECONDS + 20 })
    const result = await core({ authVerifier: verifier(accessToken) }).check({})
    expect(result.assurance.expiresAt).toBe(new Date((NOW_SECONDS + 20) * 1_000).toISOString())
  })

  it('consumes only the issued object for the same actor and exact session bearer', async () => {
    const accessToken = token()
    const stepUp = core({ authVerifier: verifier(accessToken) })
    const result = await stepUp.check({})
    expect(stepUp.consume(result.assurance, { actorUserId: ACTOR, accessToken })).toEqual({
      ok: true,
      assurance: result.assurance,
    })
    expect(stepUp.consume(result.assurance, { actorUserId: ACTOR, accessToken })).toEqual({
      ok: false,
      reason: 'replayed',
    })
    expect(stepUp.consume({ ...result.assurance }, { actorUserId: ACTOR, accessToken })).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('rejects cross-user and cross-session use and terminally consumes each attempt', async () => {
    const accessToken = token()
    const stepUp = core({ authVerifier: verifier(accessToken) })

    const crossUser = await stepUp.check({})
    expect(stepUp.consume(crossUser.assurance, { actorUserId: OTHER_ACTOR, accessToken })).toEqual({
      ok: false,
      reason: 'actor_mismatch',
    })
    expect(stepUp.consume(crossUser.assurance, { actorUserId: ACTOR, accessToken })).toEqual({
      ok: false,
      reason: 'replayed',
    })

    const crossSession = await stepUp.check({})
    const otherToken = token({ session_id: OTHER_SESSION })
    expect(stepUp.consume(crossSession.assurance, { actorUserId: ACTOR, accessToken: otherToken })).toEqual({
      ok: false,
      reason: 'session_mismatch',
    })
  })

  it('rejects an assurance that expires between check and consume', async () => {
    let nowSeconds = NOW_SECONDS
    const accessToken = token({ exp: NOW_SECONDS + 2 })
    const stepUp = createAdminStepUpAssurance({
      authVerifier: verifier(accessToken),
      clock: () => new Date(nowSeconds * 1_000),
    })
    const result = await stepUp.check({})
    nowSeconds += 2
    expect(stepUp.consume(result.assurance, { actorUserId: ACTOR, accessToken })).toEqual({
      ok: false,
      reason: 'expired',
    })
  })
})

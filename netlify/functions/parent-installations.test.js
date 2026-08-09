import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createParentInstallationPort } from './_shared/parent-installations.js'
import { createParentInstallationsHandler } from './parent-installations.js'

const ENV = {
  SUPABASE_URL: 'https://synthetic-project.supabase.co',
  SUPABASE_ANON_KEY: 'synthetic-anon-key',
}
const ACCESS_TOKEN = 'synthetic.parent.access.token'
const ACTOR = '00000000-0000-4000-8000-00000000000a'
const HOUSEHOLD = '10000000-0000-4000-8000-000000000001'
const INSTALLATION = '50000000-0000-4000-8000-000000000001'
const DATASET = '60000000-0000-4000-8000-000000000001'
const CORRELATION = '70000000-0000-4000-8000-000000000001'
const LOCAL_ENROLLMENT = '80000000-0000-4000-8000-000000000001'
const BINDING = '90000000-0000-4000-8000-000000000001'
const GRANT_ID = 'a0000000-0000-4000-8000-000000000001'
const RAW_GRANT = `pit_v1_${'A'.repeat(43)}`
const TOKEN_DIGEST = createHash('sha256').update(RAW_GRANT).digest('hex')

function event(path, body, overrides = {}) {
  return {
    path,
    httpMethod: 'POST',
    headers: {
      authorization: 'Bearer caller-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    ...overrides,
  }
}

function body(response) {
  return JSON.parse(response.body)
}

function bindingResult(overrides = {}) {
  return {
    schemaVersion: 1,
    status: 'active',
    bindingId: BINDING,
    installationId: INSTALLATION,
    householdId: HOUSEHOLD,
    datasetEpoch: DATASET,
    bindingRevision: '1',
    sessionGeneration: '1',
    boundAt: '2026-08-09T12:00:00.000Z',
    correlationId: CORRELATION,
    ...overrides,
  }
}

function fakeInstallations(overrides = {}) {
  return {
    isDurable: true,
    isReady: () => true,
    status: vi.fn(async () => ({
      schemaVersion: 1,
      status: 'unclaimed',
      installationId: INSTALLATION,
    })),
    issue: vi.fn(async ({ purpose }) => ({
      schemaVersion: 1,
      status: 'issued',
      grantId: GRANT_ID,
      installationId: INSTALLATION,
      datasetEpoch: DATASET,
      purpose,
      capability: purpose === 'recovery'
        ? 'parent_installation:recover'
        : 'parent_installation:claim',
      issuedAt: '2026-08-09T12:00:00.000Z',
      expiresAt: '2026-08-09T12:10:00.000Z',
      correlationId: CORRELATION,
    })),
    claim: vi.fn(async () => bindingResult()),
    recover: vi.fn(async () => {
      const result = bindingResult({
        bindingRevision: '2',
        sessionGeneration: '2',
        recoveredAt: '2026-08-09T12:01:00.000Z',
      })
      delete result.boundAt
      return result
    }),
    revoke: vi.fn(async () => ({
      ...bindingResult({
        status: 'revoked',
        bindingRevision: '2',
        sessionGeneration: '2',
        revokedAt: '2026-08-09T12:02:00.000Z',
      }),
      boundAt: undefined,
    })),
    ...overrides,
  }
}

function handler(installations) {
  return createParentInstallationsHandler({
    env: ENV,
    installations,
    authVerifier: vi.fn(async () => ({
      ok: true,
      user: { id: ACTOR },
      accessToken: ACCESS_TOKEN,
    })),
    createGrant: () => RAW_GRANT,
    createCorrelationId: () => CORRELATION,
  })
}

describe('trusted Parent installation Netlify boundary', () => {
  it('returns a raw grant once while sending only its digest to the database port', async () => {
    const installations = fakeInstallations()
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const response = await handler(installations)(event(
        '/api/parent/installations/enrollment-grant',
        {
          schemaVersion: 1,
          householdId: HOUSEHOLD,
          installationId: INSTALLATION,
          datasetEpoch: DATASET,
          purpose: 'first_claim',
        },
      ))
      expect(response.statusCode).toBe(201)
      expect(body(response)).toMatchObject({
        status: 'issued',
        grantToken: RAW_GRANT,
      })
      expect(installations.issue).toHaveBeenCalledWith({
        accessToken: ACCESS_TOKEN,
        householdId: HOUSEHOLD,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        purpose: 'first_claim',
        tokenDigest: TOKEN_DIGEST,
        correlationId: CORRELATION,
      })
      expect(JSON.stringify(installations.issue.mock.calls)).not.toContain(RAW_GRANT)
      expect(log).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
      warn.mockRestore()
      error.mockRestore()
    }
  })

  it('supports legacy-upgrade and recovery without accepting any Parent PIN', async () => {
    const installations = fakeInstallations()
    const run = handler(installations)

    const legacy = await run(event(
      '/api/parent/installations/enrollment-grant',
      {
        schemaVersion: 1,
        householdId: HOUSEHOLD,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        purpose: 'legacy_upgrade',
      },
    ))
    expect(legacy.statusCode).toBe(201)
    expect(installations.issue).toHaveBeenLastCalledWith(expect.objectContaining({
      purpose: 'legacy_upgrade',
    }))

    const recoveryGrant = await run(event(
      '/api/parent/installations/recovery-grant',
      {
        schemaVersion: 1,
        householdId: HOUSEHOLD,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
      },
    ))
    expect(recoveryGrant.statusCode).toBe(201)
    expect(installations.issue).toHaveBeenLastCalledWith(expect.objectContaining({
      purpose: 'recovery',
    }))

    const recovered = await run(event(
      '/api/parent/installations/recover',
      {
        schemaVersion: 1,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        grantToken: RAW_GRANT,
        localCredentialEnrollmentId: LOCAL_ENROLLMENT,
      },
    ))
    expect(recovered.statusCode).toBe(200)
    expect(JSON.stringify(body(recovered))).not.toContain(RAW_GRANT)
    expect(installations.recover).toHaveBeenCalledWith({
      accessToken: ACCESS_TOKEN,
      installationId: INSTALLATION,
      datasetEpoch: DATASET,
      tokenDigest: TOKEN_DIGEST,
      localCredentialEnrollmentId: LOCAL_ENROLLMENT,
      correlationId: CORRELATION,
    })

    const withPin = await run(event(
      '/api/parent/installations/recover',
      {
        schemaVersion: 1,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        grantToken: RAW_GRANT,
        localCredentialEnrollmentId: LOCAL_ENROLLMENT,
        parentPin: 'synthetic-pin-must-not-cross-server-boundary',
      },
    ))
    expect(withPin.statusCode).toBe(400)
  })

  it('maps grant replay/authority denial to a narrow forbidden result', async () => {
    const denied = new Error('parent_installation_denied')
    const installations = fakeInstallations({
      issue: vi.fn(async () => { throw denied }),
      claim: vi.fn(async () => { throw denied }),
    })
    const run = handler(installations)
    const grant = await run(event(
      '/api/parent/installations/enrollment-grant',
      {
        schemaVersion: 1,
        householdId: HOUSEHOLD,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        purpose: 'first_claim',
      },
    ))
    expect(grant.statusCode).toBe(403)
    expect(body(grant)).toEqual({ error: { code: 'not_authorized' } })

    const replay = await run(event(
      '/api/parent/installations/claim',
      {
        schemaVersion: 1,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        purpose: 'first_claim',
        grantToken: RAW_GRANT,
      },
    ))
    expect(replay.statusCode).toBe(403)
    expect(body(replay)).toEqual({ error: { code: 'not_authorized' } })
  })

  it('exposes status, claim, and revoke but no Study/Admin authority inputs', async () => {
    const installations = fakeInstallations()
    const run = handler(installations)
    const status = await run(event('/api/parent/installations/status', {
      schemaVersion: 1,
      householdId: HOUSEHOLD,
      installationId: INSTALLATION,
    }))
    expect(status.statusCode).toBe(200)

    const claimed = await run(event('/api/parent/installations/claim', {
      schemaVersion: 1,
      installationId: INSTALLATION,
      datasetEpoch: DATASET,
      purpose: 'first_claim',
      grantToken: RAW_GRANT,
    }))
    expect(claimed.statusCode).toBe(200)

    const revoked = await run(event('/api/parent/installations/revoke', {
      schemaVersion: 1,
      householdId: HOUSEHOLD,
      installationId: INSTALLATION,
      datasetEpoch: DATASET,
    }))
    expect(revoked.statusCode).toBe(200)

    for (const forbidden of [
      { adminRole: 'owner' },
      { studyCapability: 'student:attempts:create' },
      { guardianPermission: 'identity_manager' },
    ]) {
      const response = await run(event(
        '/api/parent/installations/enrollment-grant',
        {
          schemaVersion: 1,
          householdId: HOUSEHOLD,
          installationId: INSTALLATION,
          datasetEpoch: DATASET,
          purpose: 'first_claim',
          ...forbidden,
        },
      ))
      expect(response.statusCode).toBe(400)
    }
  })
})

describe('Parent installation Supabase bearer RPC port', () => {
  it('uses only authenticated Parent RPC parameters and validates safe results', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        status: 'issued',
        grantId: GRANT_ID,
        installationId: INSTALLATION,
        datasetEpoch: DATASET,
        purpose: 'first_claim',
        capability: 'parent_installation:claim',
        issuedAt: '2026-08-09T12:00:00.000Z',
        expiresAt: '2026-08-09T12:10:00.000Z',
        correlationId: CORRELATION,
      }),
    }))
    const port = createParentInstallationPort({ env: ENV, fetchImpl })
    await expect(port.issue({
      accessToken: ACCESS_TOKEN,
      householdId: HOUSEHOLD,
      installationId: INSTALLATION,
      datasetEpoch: DATASET,
      purpose: 'first_claim',
      tokenDigest: TOKEN_DIGEST,
      correlationId: CORRELATION,
    })).resolves.toMatchObject({ status: 'issued' })

    const [url, request] = fetchImpl.mock.calls[0]
    expect(url).toBe(
      'https://synthetic-project.supabase.co/rest/v1/rpc/' +
      'academy_parent_issue_installation_grant_v1',
    )
    expect(request.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
    expect(JSON.parse(request.body)).toEqual({
      p_household_id: HOUSEHOLD,
      p_installation_id: INSTALLATION,
      p_dataset_epoch: DATASET,
      p_purpose: 'first_claim',
      p_token_digest: TOKEN_DIGEST,
      p_correlation_id: CORRELATION,
    })
    expect(request.body).not.toContain(RAW_GRANT)
    expect(request.body).not.toMatch(/pin|admin|study/i)
  })

  it('rejects database over-disclosure and denial responses', async () => {
    const overDisclosure = createParentInstallationPort({
      env: ENV,
      fetchImpl: vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          schemaVersion: 1,
          status: 'unclaimed',
          installationId: INSTALLATION,
          adminRole: 'forbidden',
        }),
      })),
    })
    await expect(overDisclosure.status({
      accessToken: ACCESS_TOKEN,
      householdId: HOUSEHOLD,
      installationId: INSTALLATION,
    })).rejects.toThrow('parent_installation_port_contract')

    const denied = createParentInstallationPort({
      env: ENV,
      fetchImpl: vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({}),
      })),
    })
    await expect(denied.status({
      accessToken: ACCESS_TOKEN,
      householdId: HOUSEHOLD,
      installationId: INSTALLATION,
    })).rejects.toThrow('parent_installation_denied')
  })
})

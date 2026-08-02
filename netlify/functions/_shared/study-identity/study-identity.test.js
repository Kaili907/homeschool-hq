import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createStudySessionIssueHandler } from '../../study-session-issue.js'
import { createStudySessionVerifyHandler } from '../../study-session-verify.js'
import {
  digestStudySessionReference,
  readStudySessionBearer,
} from './contracts.js'
import {
  createGuardianStudySessionIssuer,
  createTrustedStudySessionVerifier,
} from './supabase.js'

const STUDENT_ID = '22222222-2222-4222-8222-222222222222'
const HOUSEHOLD_ID = '44444444-4444-4444-8444-444444444444'
const GRANT_ID = '11111111-1111-4111-8111-111111111111'
const EPOCH_ID = '33333333-3333-4333-8333-333333333333'
const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const SCOPE = Object.freeze([
  'student:assignments:read',
  'student:attempts:create',
  'student:progress:read',
])
const ISSUED = Object.freeze({
  schemaVersion: 1,
  status: 'issued',
  sessionReference: SESSION_REFERENCE,
  grantId: GRANT_ID,
  studentId: STUDENT_ID,
  learnerSessionId: EPOCH_ID,
  sessionEpoch: EPOCH_ID,
  authorizationRevision: 1,
  issuedAt: '2026-08-01T16:00:00.000Z',
  expiresAt: '2026-08-01T16:15:00.000Z',
  contractVersion: 1,
  issuerVersion: 'academy-student-session-issuer.v1',
  scope: SCOPE,
})
const { sessionReference: _issuedReference, ...ISSUED_WITHOUT_REFERENCE } = ISSUED
const VERIFIED = Object.freeze({
  ...ISSUED_WITHOUT_REFERENCE,
  status: 'verified',
  householdId: HOUSEHOLD_ID,
  sessionVersion: 1,
})
const ISSUED_ENVELOPE = Object.freeze({
  schemaVersion: 1,
  status: 'issued',
  sessionReference: SESSION_REFERENCE,
  expiresAt: ISSUED.expiresAt,
})

function issueEvent(body = {
  schemaVersion: 1,
  selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
}) {
  return {
    httpMethod: 'POST',
    path: '/api/study/session/issue',
    headers: { authorization: 'Bearer guardian.jwt', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function sessionEvent(method = 'POST', overrides = {}) {
  return {
    httpMethod: method,
    path: method === 'DELETE' ? '/api/study/session/revoke' : '/api/study/session/verify',
    headers: { authorization: `Bearer ${SESSION_REFERENCE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ schemaVersion: 1, requiredCapability: 'student:attempts:create' }),
    ...overrides,
  }
}

describe('verified guardian Study launch gateway', () => {
  it('accepts only a learner selector and passes server-derived auth context to the issuer', async () => {
    const issue = vi.fn().mockResolvedValue(ISSUED_ENVELOPE)
    const handler = createStudySessionIssueHandler({
      authVerifier: vi.fn().mockResolvedValue({
        ok: true,
        user: { id: 'guardian-derived-by-auth' },
        accessToken: 'verified-supabase-bearer',
      }),
      issuer: { isDurable: true, isReady: () => true, issue },
    })
    const response = await handler(issueEvent())
    expect(response.statusCode).toBe(201)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      status: 'issued',
      sessionReference: SESSION_REFERENCE,
      expiresAt: ISSUED.expiresAt,
    })
    expect(response.body).not.toMatch(/studentId|householdId|grantId|scope|revision|epoch/i)
    expect(issue).toHaveBeenCalledWith({
      accessToken: 'verified-supabase-bearer',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
    })
  })

  it('accepts a bounded legacy id only as a selector and rejects ambiguous authority fields', async () => {
    const issue = vi.fn().mockResolvedValue(ISSUED_ENVELOPE)
    const handler = createStudySessionIssueHandler({
      authVerifier: vi.fn().mockResolvedValue({
        ok: true,
        user: { id: 'guardian-derived-by-auth' },
        accessToken: 'verified-supabase-bearer',
      }),
      issuer: { isDurable: true, isReady: () => true, issue },
    })
    const response = await handler(issueEvent({
      schemaVersion: 1,
      selectedStudentRef: { kind: 'legacy-profile-id', value: 'learner-p1' },
    }))
    expect(response.statusCode).toBe(201)
    expect(issue).toHaveBeenCalledWith({
      accessToken: 'verified-supabase-bearer',
      selectedStudentRef: { kind: 'legacy-profile-id', value: 'learner-p1' },
    })

    for (const value of [
      '', '../learner', 'learner name', 'x'.repeat(129),
      'learner:local-release-candidate', 'learner:demo', 'synthetic:student',
    ]) {
      expect((await handler(issueEvent({
        schemaVersion: 1,
        selectedStudentRef: { kind: 'legacy-profile-id', value },
      }))).statusCode).toBe(400)
    }
  })

  it.each(['householdId', 'membershipId', 'relationshipId', 'guardianRole', 'permission']) (
    'rejects browser-supplied authority field %s',
    async (field) => {
      const issue = vi.fn()
      const handler = createStudySessionIssueHandler({
        authVerifier: vi.fn().mockResolvedValue({ ok: true, user: { id: 'g' }, accessToken: 'bearer' }),
        issuer: { isDurable: true, isReady: () => true, issue },
      })
      const body = JSON.parse(issueEvent().body)
      body[field] = 'forged'
      const response = await handler(issueEvent(body))
      expect(response.statusCode).toBe(400)
      expect(issue).not.toHaveBeenCalled()
    },
  )

  it('fails closed for unauthenticated, unauthorized, and unavailable issuance', async () => {
    const unauthenticated = createStudySessionIssueHandler({
      authVerifier: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 401, body: '{}' } }),
      issuer: { isDurable: true, isReady: () => true, issue: vi.fn() },
    })
    expect((await unauthenticated(issueEvent())).statusCode).toBe(401)

    const denied = createStudySessionIssueHandler({
      authVerifier: vi.fn().mockResolvedValue({ ok: true, user: { id: 'g' }, accessToken: 'bearer' }),
      issuer: { isDurable: true, isReady: () => true, issue: vi.fn().mockResolvedValue({ status: 'denied' }) },
    })
    expect((await denied(issueEvent())).statusCode).toBe(403)

    const unavailable = createStudySessionIssueHandler({
      authVerifier: vi.fn().mockResolvedValue({ ok: true, user: { id: 'g' }, accessToken: 'bearer' }),
      issuer: { isDurable: true, isReady: () => false, issue: vi.fn() },
    })
    expect((await unavailable(issueEvent())).statusCode).toBe(503)
  })
})

describe('trusted learner-session gateway', () => {
  it('verifies exact capability and supports idempotent self-revocation', async () => {
    const verify = vi.fn().mockResolvedValue(VERIFIED)
    const revoke = vi.fn().mockResolvedValue({ schemaVersion: 1, status: 'revoked' })
    const handler = createStudySessionVerifyHandler({
      verifier: {
        isDurable: true,
        isReady: () => true,
        verify,
        revoke,
        readiness: vi.fn().mockResolvedValue({ status: 'ready' }),
      },
    })
    const verifiedResponse = await handler(sessionEvent())
    expect(verifiedResponse.statusCode).toBe(200)
    expect(JSON.parse(verifiedResponse.body)).toEqual({
      schemaVersion: 1,
      status: 'verified',
      expiresAt: VERIFIED.expiresAt,
    })
    expect(verifiedResponse.body).not.toMatch(/student|household|grant|scope|revision|epoch/i)
    expect(verify).toHaveBeenCalledWith({
      sessionReference: SESSION_REFERENCE,
      requiredCapability: 'student:attempts:create',
    })
    expect((await handler(sessionEvent('DELETE'))).statusCode).toBe(200)
    expect(revoke).toHaveBeenCalledWith({ sessionReference: SESSION_REFERENCE })
  })

  it('rejects malformed, duplicate, or wrong-scheme bearer headers before verification', async () => {
    const verify = vi.fn()
    const handler = createStudySessionVerifyHandler({
      verifier: { isDurable: true, isReady: () => true, verify, revoke: vi.fn() },
    })
    for (const authorization of ['', 'Basic abc', 'Bearer 1234', `Bearer ${SESSION_REFERENCE} extra`]) {
      const response = await handler(sessionEvent('POST', { headers: {
        authorization,
        'content-type': 'application/json',
      } }))
      expect(response.statusCode).toBe(401)
    }
    const duplicate = sessionEvent()
    duplicate.headers.Authorization = `Bearer aca_stu_v1_${'B'.repeat(43)}`
    expect((await handler(duplicate)).statusCode).toBe(401)
    expect(verify).not.toHaveBeenCalled()
  })

  it('returns learner-safe denial without exposing grant details', async () => {
    const handler = createStudySessionVerifyHandler({
      verifier: {
        isDurable: true,
        isReady: () => true,
        verify: vi.fn().mockResolvedValue({ status: 'denied' }),
      },
    })
    const response = await handler(sessionEvent())
    expect(response.statusCode).toBe(401)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'student_session_invalid' } })
    expect(response.body).not.toContain(SESSION_REFERENCE)
  })
})

describe('Study identity Supabase RPC adapters', () => {
  const env = {
    SUPABASE_URL: 'https://academy.supabase.co',
    SUPABASE_ANON_KEY: 'public-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'server-service-key',
  }

  it('uses the guardian bearer and sends only the selected student to issuance', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(ISSUED_ENVELOPE), { status: 200 }))
    const result = await createGuardianStudySessionIssuer({ env, fetchImpl }).issue({
      accessToken: 'verified-guardian-bearer',
      selectedStudentRef: { kind: 'academy-student-id', value: STUDENT_ID },
    })
    expect(result).toEqual(ISSUED_ENVELOPE)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://academy.supabase.co/rest/v1/rpc/academy_study_issue_guardian_launch_v1')
    expect(init.headers.apikey).toBe('public-anon-key')
    expect(init.headers.Authorization).toBe('Bearer verified-guardian-bearer')
    expect(JSON.parse(init.body)).toEqual({
      p_selector_kind: 'academy-student-id',
      p_selector_value: STUDENT_ID,
    })
  })

  it('hashes the opaque reference locally and never sends it or authority claims to verification RPC', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(VERIFIED), { status: 200 }))
    const result = await createTrustedStudySessionVerifier({ env, fetchImpl }).verify({
      sessionReference: SESSION_REFERENCE,
      requiredCapability: 'student:progress:read',
    })
    expect(result).toEqual(VERIFIED)
    const [, init] = fetchImpl.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body).toEqual({
      p_token_digest: createHash('sha256').update(SESSION_REFERENCE, 'ascii').digest('hex'),
      p_required_capability: 'student:progress:read',
    })
    expect(init.body).not.toContain(SESSION_REFERENCE)
    expect(init.body).not.toContain('household')
    expect(init.body).not.toContain('student_id')
    expect(init.headers.apikey).toBe('server-service-key')
  })

  it('parses only one exact opaque bearer and produces canonical lowercase SHA-256', () => {
    expect(readStudySessionBearer(sessionEvent())).toBe(SESSION_REFERENCE)
    expect(digestStudySessionReference(SESSION_REFERENCE)).toBe(
      createHash('sha256').update(SESSION_REFERENCE, 'ascii').digest('hex'),
    )
  })
})

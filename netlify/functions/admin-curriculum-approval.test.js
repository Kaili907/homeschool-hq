import { describe, expect, it, vi } from 'vitest'
import { createAdminCurriculumHandler } from './admin-curriculum.js'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const VALIDATION = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'
const principal = {
  userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  role: 'owner',
  capabilities: ['curriculum:read', 'curriculum:approve'],
}

function event(method = 'GET', body) {
  return {
    path: `/api/admin/curriculum/drafts/${DRAFT}/approval`,
    httpMethod: method,
    headers: { authorization: 'Bearer verified', ...(body ? { 'content-type': 'application/json' } : {}) },
    queryStringParameters: null,
    ...(body ? { body: JSON.stringify(body), isBase64Encoded: false } : {}),
  }
}

function status(replayed) {
  return {
    schemaVersion: 1,
    ...(replayed === undefined ? {} : { replayed }),
    draftId: DRAFT,
    draftRevision: 3,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-draft.1',
    schemaSetVersion: '2.0.0',
    status: 'pending_review',
    latestValidation: null,
    currentDecision: null,
    staleApproval: null,
    history: [],
    publishGate: {
      eligible: false, reason: 'validation_missing', approvalId: null,
      draftRevision: 3, validationSnapshotId: null,
    },
  }
}

function createHandler(overrides = {}) {
  return createAdminCurriculumHandler({
    source: { loadCatalog: vi.fn(), loadLesson: vi.fn(), loadValidationEvidence: vi.fn() },
    registry: { list: vi.fn(), details: vi.fn(), productionPointer: vi.fn() },
    authoring: {},
    ...overrides,
  })
}

describe('curriculum human approval API', () => {
  it('requires curriculum:read for status and curriculum:approve for decisions', async () => {
    const authorization = { require: vi.fn().mockResolvedValue({ ok: true, principal }) }
    const approval = {
      read: vi.fn().mockResolvedValue(status()),
      decide: vi.fn().mockResolvedValue(status(false)),
      recordValidation: vi.fn(),
    }
    const handler = createHandler({ authorization, approval })
    expect((await handler(event())).statusCode).toBe(200)
    const body = {
      draftRevision: 3,
      decision: 'approved',
      reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION,
      idempotencyKey: REQUEST,
    }
    expect((await handler(event('POST', body))).statusCode).toBe(201)
    expect(authorization.require.mock.calls.map((call) => call[1])).toEqual([
      'curriculum:read', 'curriculum:approve',
    ])
    expect(approval.read).toHaveBeenCalledWith(principal.userId, DRAFT)
    expect(approval.decide).toHaveBeenCalledWith(principal.userId, expect.objectContaining(body))
    expect(approval.decide.mock.calls[0][1].requestDigest).toMatch(/^[0-9a-f]{64}$/)
  })

  it('accepts bounded changes-request reasons without requiring a validation identity', async () => {
    const approval = { read: vi.fn(), recordValidation: vi.fn(), decide: vi.fn().mockResolvedValue(status(false)) }
    const handler = createHandler({
      approval,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    const response = await handler(event('POST', {
      draftRevision: 3,
      decision: 'changes_requested',
      reasonCode: 'changes.standards',
      validationSnapshotId: null,
      idempotencyKey: REQUEST,
    }))
    expect(response.statusCode).toBe(201)
    expect(approval.decide).toHaveBeenCalledWith(principal.userId, expect.objectContaining({
      decision: 'changes_requested', reasonCode: 'changes.standards', validationSnapshotId: null,
    }))
  })

  it('rejects authority injection and mismatched decision/reason contracts', async () => {
    const approval = { read: vi.fn(), recordValidation: vi.fn(), decide: vi.fn() }
    const handler = createHandler({
      approval,
      authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
    })
    for (const body of [
      {
        draftRevision: 3, decision: 'approved', reasonCode: 'changes.other',
        validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
      },
      {
        draftRevision: 3, decision: 'approved', reasonCode: 'approval.ready',
        validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
        actorUserRef: 'forged', role: 'owner', curriculumPayload: { private: true },
      },
    ]) expect((await handler(event('POST', body))).statusCode).toBe(400)
    expect(approval.decide).not.toHaveBeenCalled()
  })

  it('fails closed before service access and maps DB reauthorization/validation failures safely', async () => {
    const approval = { read: vi.fn(), recordValidation: vi.fn(), decide: vi.fn() }
    const denied = createHandler({
      approval,
      authorization: { require: vi.fn().mockResolvedValue({ ok: false, response: { statusCode: 403, body: '{}' } }) },
    })
    expect((await denied(event())).statusCode).toBe(403)
    expect(approval.read).not.toHaveBeenCalled()

    const body = {
      draftRevision: 3, decision: 'approved', reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
    }
    for (const [code, expectedStatus, safeCode] of [
      ['forbidden', 403, 'admin_access_denied'],
      ['validation-blocked', 409, 'validation_blocked'],
      ['replay-conflict', 409, 'idempotency_conflict'],
    ]) {
      approval.decide.mockRejectedValueOnce(Object.assign(new Error('/private/database'), { code }))
      const handler = createHandler({
        approval,
        authorization: { require: vi.fn().mockResolvedValue({ ok: true, principal }) },
      })
      const response = await handler(event('POST', body))
      expect(response.statusCode).toBe(expectedStatus)
      expect(response.body).toContain(safeCode)
      expect(response.body).not.toContain('private')
    }
  })

  it('exposes no publish, activate, stage, or rollback mutation route', async () => {
    const authorization = { require: vi.fn() }
    const handler = createHandler({ authorization, approval: {} })
    for (const path of ['publish', 'activate', 'stage', 'rollback']) {
      const response = await handler({ ...event('POST'), path: `/api/admin/curriculum/drafts/${DRAFT}/${path}` })
      expect(response.statusCode).toBe(404)
    }
    expect(authorization.require).not.toHaveBeenCalled()
  })
})

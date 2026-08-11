import { describe, expect, it, vi } from 'vitest'
import { createCurriculumApprovalHttpSource } from './httpSource'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const VALIDATION = '20000000-0000-4000-8000-000000000001'
const REQUEST = '30000000-0000-4000-8000-000000000001'

function status(replayed = true) {
  return {
    schemaVersion: 1,
    replayed,
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

describe('curriculum approval HTTP source', () => {
  it('sends only the exact decision body and bearer credential', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 201, json: vi.fn().mockResolvedValue(status()) })
    const source = createCurriculumApprovalHttpSource(fetchImpl, async () => 'verified-token')
    await source.decideApproval({
      draftId: DRAFT,
      draftRevision: 3,
      decision: 'approved',
      reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION,
      idempotencyKey: REQUEST,
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/admin/curriculum/drafts/${DRAFT}/approval`,
      expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer verified-token' }) }),
    )
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
      draftRevision: 3,
      decision: 'approved',
      reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION,
      idempotencyKey: REQUEST,
    })
    expect(fetchImpl.mock.calls[0][1].body).not.toMatch(/actor|role|capabilit|payload/i)
  })

  it('maps validation, replay, authorization, and unavailable failures', async () => {
    for (const [status, responseCode, expected] of [
      [409, 'validation_blocked', { code: 'conflict', reason: 'validation-blocked' }],
      [409, 'idempotency_conflict', { code: 'conflict', reason: 'idempotency-conflict' }],
      [403, 'admin_access_denied', { code: 'forbidden' }],
      [503, 'curriculum_approval_unavailable', { code: 'unavailable' }],
    ] as const) {
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false, status, json: vi.fn().mockResolvedValue({ error: { code: responseCode } }),
      })
      const source = createCurriculumApprovalHttpSource(fetchImpl, async () => 'token')
      await expect(source.readApproval(DRAFT)).rejects.toMatchObject(expected)
    }
  })

  it('does not issue a request without an access token', async () => {
    const fetchImpl = vi.fn()
    const source = createCurriculumApprovalHttpSource(fetchImpl, async () => null)
    await expect(source.readApproval(DRAFT)).rejects.toMatchObject({ code: 'unauthenticated' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('rejects unexpected or protected keys in a successful response', async () => {
    const injected = { ...status(), rawBackendError: '/private/db', curriculumPayload: { secret: true } }
    const source = createCurriculumApprovalHttpSource(
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: vi.fn().mockResolvedValue(injected) }),
      async () => 'verified-token',
    )
    await expect(source.decideApproval({
      draftId: DRAFT, draftRevision: 3, decision: 'approved', reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('rejects an approved/eligible claim without current validation and approval evidence', async () => {
    const forged = {
      ...status(),
      status: 'approved',
      publishGate: {
        eligible: true, reason: 'approved', approvalId: REQUEST,
        draftRevision: 3, validationSnapshotId: VALIDATION,
      },
    }
    const source = createCurriculumApprovalHttpSource(
      vi.fn().mockResolvedValue({ ok: true, status: 201, json: vi.fn().mockResolvedValue(forged) }),
      async () => 'token',
    )
    await expect(source.decideApproval({
      draftId: DRAFT, draftRevision: 3, decision: 'approved', reasonCode: 'approval.ready',
      validationSnapshotId: VALIDATION, idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'unavailable' })
  })
})

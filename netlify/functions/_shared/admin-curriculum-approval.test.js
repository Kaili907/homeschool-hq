import { describe, expect, it, vi } from 'vitest'
import {
  adminCurriculumApprovalAdapters,
  createAdminCurriculumApprovalService,
} from './admin-curriculum-approval.js'

const DRAFT = '10000000-0000-4000-8000-000000000001'
const VALIDATION = '20000000-0000-4000-8000-000000000001'
const APPROVAL = '30000000-0000-4000-8000-000000000001'
const REQUEST = '40000000-0000-4000-8000-000000000001'

function validation() {
  return {
    validationSnapshotId: VALIDATION,
    draftRevision: 3,
    engineVersion: 'curriculum-validation-v2',
    resultDigest: 'a'.repeat(64),
    status: 'valid',
    publicationReady: true,
    blockingCount: 0,
    blockingErrorCount: 0,
    humanReviewBlockerCount: 0,
    validatedAt: '2026-08-10T12:00:00Z',
  }
}

function status(replayed) {
  const decision = {
    approvalId: APPROVAL,
    draftRevision: 3,
    decision: 'approved',
    reasonCode: 'approval.ready',
    validationSnapshotId: VALIDATION,
    validationResultDigest: 'a'.repeat(64),
    reviewerRole: 'owner',
    decidedAt: '2026-08-10T12:01:00Z',
    bindingStatus: 'current',
  }
  return {
    schemaVersion: 1,
    ...(replayed === undefined ? {} : { replayed }),
    draftId: DRAFT,
    draftRevision: 3,
    baseReleaseVersion: '1.0.0',
    targetVersion: '2.0.0-draft.1',
    schemaSetVersion: '2.0.0',
    status: 'approved',
    latestValidation: validation(),
    currentDecision: decision,
    staleApproval: null,
    history: [decision],
    publishGate: {
      eligible: true,
      reason: 'approved',
      approvalId: APPROVAL,
      draftRevision: 3,
      validationSnapshotId: VALIDATION,
    },
  }
}

describe('curriculum approval database service', () => {
  it('uses only narrow RPCs and exact capabilities', async () => {
    const abortSignal = vi.fn()
      .mockResolvedValueOnce({ data: status(), error: null })
      .mockResolvedValueOnce({ data: validation(), error: null })
      .mockResolvedValueOnce({ data: status(false), error: null })
    const client = { rpc: vi.fn(() => ({ abortSignal })) }
    const service = createAdminCurriculumApprovalService({ client })
    await service.read('owner-ref', DRAFT)
    await service.recordValidation('owner-ref', {
      draftId: DRAFT, draftRevision: 3,
      engineVersion: 'curriculum-validation-v2', resultDigest: 'a'.repeat(64),
      status: 'valid', publicationReady: true, blockingCount: 0,
      blockingErrorCount: 0, humanReviewBlockerCount: 0,
    })
    await service.decide('owner-ref', {
      draftId: DRAFT, draftRevision: 3, decision: 'approved',
      reasonCode: 'approval.ready', validationSnapshotId: VALIDATION,
      idempotencyKey: REQUEST, requestDigest: 'b'.repeat(64),
    })
    expect(client.rpc.mock.calls).toEqual([
      ['academy_admin_read_curriculum_approval_v1', expect.objectContaining({ p_required_capability: 'curriculum:read' })],
      ['academy_admin_record_curriculum_validation_v1', expect.objectContaining({ p_required_capability: 'curriculum:read' })],
      ['academy_admin_decide_curriculum_approval_v1', expect.objectContaining({ p_required_capability: 'curriculum:approve' })],
    ])
  })

  it('fails closed on malformed projections and maps database reauthorization loss', async () => {
    expect(adminCurriculumApprovalAdapters.approvalStatus({ ...status(), payload: { private: true } })).toBeNull()
    const denied = createAdminCurriculumApprovalService({
      client: { rpc: vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ data: null, error: { message: 'CURRICULUM_APPROVAL_REQUIRED' } }) })) },
    })
    await expect(denied.read('revoked-owner', DRAFT)).rejects.toMatchObject({ code: 'forbidden' })
  })

  it('maps blocked validation and conflicting replay distinctly', async () => {
    for (const [message, code] of [
      ['CURRICULUM_APPROVAL_VALIDATION_BLOCKED', 'validation-blocked'],
      ['CURRICULUM_APPROVAL_REPLAY_CONFLICT', 'replay-conflict'],
    ]) {
      const service = createAdminCurriculumApprovalService({
        client: { rpc: vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ data: null, error: { message } }) })) },
      })
      await expect(service.decide('owner', {})).rejects.toMatchObject({ code })
    }
  })
})

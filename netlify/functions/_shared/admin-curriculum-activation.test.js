import { describe, expect, it, vi } from 'vitest'
import {
  adminCurriculumActivationInternals,
  createAdminCurriculumActivationPersistence,
} from './admin-curriculum-activation.js'

const ACTOR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const REQUEST = '50000000-0000-4000-8000-000000000001'

function status() {
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: {
      releaseVersion: '2.0.0', revision: 2, transitionKind: 'activation',
      bindingMode: 'default_authority', transitionedAt: '2026-08-10T16:00:00.000Z',
    },
    candidates: [
      {
        releaseVersion: '2.0.0', status: 'published',
        registeredAt: '2026-08-10T15:00:00.000Z', artifactState: 'available',
        eligible: true, previouslyActive: true, active: true,
      },
      {
        releaseVersion: '1.0.0', status: 'published',
        registeredAt: '2026-08-09T16:00:00.000Z', artifactState: 'available',
        eligible: true, previouslyActive: true, active: false,
      },
    ],
    history: [
      {
        pointerRevision: 2, previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
        transitionKind: 'activation', reasonCode: 'release.activated', correlationId: REQUEST,
        transitionedAt: '2026-08-10T16:00:00.000Z',
      },
      {
        pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
        transitionKind: 'migration_seed', reasonCode: null, correlationId: null,
        transitionedAt: '2026-08-09T16:00:00.000Z',
      },
    ],
    historyTruncated: false,
  }
}

function mutation() {
  return {
    ...status(),
    transition: {
      state: 'transitioned', transitionKind: 'activation',
      previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
      pointerRevision: 2, correlationId: REQUEST,
    },
    replayed: false,
  }
}

function clientFor(values) {
  return {
    rpc: vi.fn((name) => ({
      abortSignal: vi.fn(async () => ({ data: values[name], error: null })),
    })),
  }
}

describe('Admin curriculum activation persistence', () => {
  it('uses service-only read and releases:manage transition RPC markers', async () => {
    const client = clientFor({
      academy_admin_read_curriculum_activation_v1: status(),
      academy_admin_transition_curriculum_pointer_v1: mutation(),
    })
    const persistence = createAdminCurriculumActivationPersistence({ client })
    await expect(persistence.read(ACTOR)).resolves.toMatchObject({
      pointer: { revision: 2 }, existingLearnersRepinned: false,
    })
    await expect(persistence.transition(ACTOR, {
      targetReleaseVersion: '2.0.0',
      expectedPointerRevision: 1,
      transitionKind: 'activation',
      reasonCode: 'release.activated',
      idempotencyKey: REQUEST,
    })).resolves.toMatchObject({ transition: { state: 'transitioned' }, replayed: false })
    expect(client.rpc.mock.calls[0]).toEqual([
      'academy_admin_read_curriculum_activation_v1',
      { p_actor_user_ref: ACTOR, p_required_capability: 'curriculum:read' },
    ])
    expect(client.rpc.mock.calls[1][0]).toBe('academy_admin_transition_curriculum_pointer_v1')
    expect(client.rpc.mock.calls[1][1]).toMatchObject({
      p_actor_user_ref: ACTOR,
      p_target_version: '2.0.0',
      p_expected_pointer_revision: 1,
      p_transition_kind: 'activation',
      p_reason_code: 'release.activated',
      p_request_id: REQUEST,
      p_required_capability: 'releases:manage',
    })
    expect(client.rpc.mock.calls[1][1].p_request_digest).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(client.rpc.mock.calls)).not.toMatch(/curriculum.*payload|profile|learner/i)
  })

  it('fails closed on malformed, repinning, or inconsistent projections', async () => {
    const malformed = status()
    malformed.existingLearnersRepinned = true
    expect(adminCurriculumActivationInternals.status(malformed)).toBeNull()
    const missingEvidence = status()
    missingEvidence.candidates[0].artifactState = 'unavailable'
    expect(adminCurriculumActivationInternals.status(missingEvidence)).toBeNull()
    const inconsistent = mutation()
    inconsistent.transition.pointerRevision = 3
    expect(adminCurriculumActivationInternals.mutation(inconsistent)).toBeNull()
  })

  it.each([
    ['CURRICULUM_ACTIVATION_REQUIRED', 'forbidden'],
    ['CURRICULUM_ACTIVATION_POINTER_CONFLICT', 'pointer-conflict'],
    ['CURRICULUM_ACTIVATION_REPLAY_CONFLICT', 'replay-conflict'],
    ['CURRICULUM_ACTIVATION_TARGET_NOT_PUBLISHED', 'target-not-published'],
    ['CURRICULUM_ACTIVATION_ARTIFACTS_UNAVAILABLE', 'artifacts-unavailable'],
  ])('bounds the %s database failure as %s', async (marker, code) => {
    const client = {
      rpc: vi.fn(() => ({
        abortSignal: vi.fn(async () => ({ data: null, error: { message: `${marker}: private detail` } })),
      })),
    }
    await expect(createAdminCurriculumActivationPersistence({ client }).read(ACTOR))
      .rejects.toMatchObject({ code })
  })
})

import { describe, expect, it, vi } from 'vitest'
import {
  createCurriculumActivationHttpSource,
  parseCurriculumActivationMutation,
  parseCurriculumActivationStatus,
} from './httpSource'

const REQUEST = '50000000-0000-4000-8000-000000000001'

function status(): any {
  return {
    schemaVersion: 1,
    environment: 'production',
    authority: 'default_current_curriculum',
    existingLearnersRepinned: false,
    pointer: {
      releaseVersion: '1.0.0', revision: 1, transitionKind: 'migration_seed',
      bindingMode: 'registry_only', transitionedAt: '2026-08-09T16:00:00.000Z',
    },
    candidates: [{
      releaseVersion: '1.0.0', status: 'published',
      registeredAt: '2026-08-09T16:00:00.000Z', artifactState: 'available',
      eligible: true, previouslyActive: true, active: true,
    }],
    history: [{
      pointerRevision: 1, previousReleaseVersion: null, newReleaseVersion: '1.0.0',
      transitionKind: 'migration_seed', reasonCode: null, correlationId: null,
      transitionedAt: '2026-08-09T16:00:00.000Z',
    }],
    historyTruncated: false,
  }
}

function mutation() {
  const next = status()
  next.pointer = {
    releaseVersion: '2.0.0', revision: 2, transitionKind: 'activation',
    bindingMode: 'default_authority', transitionedAt: '2026-08-10T16:00:00.000Z',
  }
  next.candidates = [{
    releaseVersion: '2.0.0', status: 'published',
    registeredAt: '2026-08-10T15:00:00.000Z', artifactState: 'available',
    eligible: true, previouslyActive: true, active: true,
  }]
  next.history = [{
    pointerRevision: 2, previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
    transitionKind: 'activation', reasonCode: 'release.activated', correlationId: REQUEST,
    transitionedAt: '2026-08-10T16:00:00.000Z',
  }]
  return {
    ...next,
    transition: {
      state: 'transitioned', transitionKind: 'activation',
      previousReleaseVersion: '1.0.0', newReleaseVersion: '2.0.0',
      pointerRevision: 2, correlationId: REQUEST,
    },
    replayed: false,
  }
}

describe('curriculum activation HTTP source', () => {
  it('uses bearer-authenticated exact GET/POST requests with no client authority assertions', async () => {
    const calls: { path: string; init: RequestInit }[] = []
    const fetcher = vi.fn(async (path: string, init: RequestInit) => {
      calls.push({ path, init })
      return {
        ok: true,
        status: init.method === 'POST' ? 201 : 200,
        json: async () => init.method === 'POST' ? mutation() : status(),
      }
    })
    const source = createCurriculumActivationHttpSource(
      fetcher, async () => 'verified-token', '/api/admin/curriculum/activation',
    )
    await source.read()
    await source.transition({
      targetReleaseVersion: '2.0.0', expectedPointerRevision: 1,
      transitionKind: 'activation', reasonCode: 'release.activated',
      idempotencyKey: REQUEST,
    })
    expect(calls.map((call) => [call.path, call.init.method])).toEqual([
      ['/api/admin/curriculum/activation', 'GET'],
      ['/api/admin/curriculum/activation', 'POST'],
    ])
    expect(calls.every((call) => (
      call.init.credentials === 'omit'
      && (call.init.headers as Record<string, string>).Authorization === 'Bearer verified-token'
    ))).toBe(true)
    expect(calls[1].init.body).toBe(JSON.stringify({
      targetReleaseVersion: '2.0.0', expectedPointerRevision: 1,
      transitionKind: 'activation', reasonCode: 'release.activated',
      idempotencyKey: REQUEST,
    }))
    expect(String(calls[1].init.body)).not.toMatch(/role|capabilit|actor|learner|profile/i)
  })

  it('fails closed on malformed or learner-repinning projections', () => {
    expect(() => parseCurriculumActivationStatus({ ...status(), existingLearnersRepinned: true }))
      .toThrow('unavailable')
    const malformed = status()
    malformed.pointer.revision = 2
    expect(() => parseCurriculumActivationStatus(malformed)).toThrow('unavailable')
    const inconsistent = mutation()
    inconsistent.transition.pointerRevision = 3
    expect(() => parseCurriculumActivationMutation(inconsistent)).toThrow('unavailable')
  })

  it.each([
    ['pointer_revision_conflict', 'pointer-conflict'],
    ['idempotency_conflict', 'idempotency-conflict'],
    ['target_not_published', 'target-not-published'],
    ['release_artifacts_unavailable', 'artifacts-unavailable'],
    ['transition_kind_conflict', 'kind-conflict'],
  ])('maps %s to the bounded conflict reason %s', async (code, reason) => {
    const source = createCurriculumActivationHttpSource(
      async () => ({
        ok: false, status: 409, json: async () => ({ error: { code } }),
      }),
      async () => 'verified-token',
    )
    await expect(source.transition({
      targetReleaseVersion: '2.0.0', expectedPointerRevision: 1,
      transitionKind: 'activation', reasonCode: 'release.activated',
      idempotencyKey: REQUEST,
    })).rejects.toMatchObject({ code: 'conflict', reason })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import {
  executeGuardedMutation,
  mutationLeaseIsOwned,
  renewMutationLease,
  startMutationLeaseHeartbeat,
  tryAcquireMutationLease,
} from './coordination'
import { remoteRowsSignature } from './engine'
import type { RemoteProfileRow } from './types'

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const row = (name = 'Ada'): RemoteProfileRow => ({
  profile_id: 'p1',
  data: { ...emptyProfile('p1', name, '3') },
  updated_at: '2026-07-24T12:00:00.000Z',
})

describe('cross-tab mutation leases', () => {
  it('allows only one live lease and reclaims it only after expiry', () => {
    const storage = new MemStorage()
    const input = {
      householdId: 'household-a',
      operationId: 'operation-a',
      datasetFingerprint: 'fingerprint-a',
      importEpoch: 'epoch-a',
      cloudRevision: 'revision-a',
    }
    const first = tryAcquireMutationLease(
      { ...input, tabId: 'tab-a' },
      100,
      storage,
      50,
    )
    expect(first).not.toBeNull()
    expect(
      tryAcquireMutationLease(
        { ...input, operationId: 'operation-b', tabId: 'tab-b' },
        120,
        storage,
        50,
      ),
    ).toBeNull()
    const reclaimed = tryAcquireMutationLease(
      { ...input, operationId: 'operation-b', tabId: 'tab-b' },
      151,
      storage,
      50,
    )
    expect(reclaimed).not.toBeNull()
    expect(mutationLeaseIsOwned(first!, 151, storage)).toBe(false)
    expect(mutationLeaseIsOwned(reclaimed!, 151, storage)).toBe(true)
  })

  it('renews only while the owning lifecycle remains current', async () => {
    vi.useFakeTimers()
    try {
      let current = true
      const renew = vi.fn(() => true)
      const lost = vi.fn()
      const stop = startMutationLeaseHeartbeat(
        () => current,
        renew,
        lost,
        10,
      )
      await vi.advanceTimersByTimeAsync(20)
      expect(renew).toHaveBeenCalledTimes(2)

      current = false
      await vi.advanceTimersByTimeAsync(10)
      expect(lost).toHaveBeenCalledOnce()
      expect(renew).toHaveBeenCalledTimes(2)
      stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps an owner-checked lease valid beyond its original lifetime', async () => {
    vi.useFakeTimers()
    try {
      const storage = new MemStorage()
      let lease = tryAcquireMutationLease(
        {
          householdId: 'household-a',
          operationId: 'operation-a',
          tabId: 'tab-a',
          datasetFingerprint: 'fingerprint-a',
          importEpoch: 'epoch-a',
          cloudRevision: 'revision-a',
        },
        Date.now(),
        storage,
        30,
      )
      expect(lease).not.toBeNull()
      const stop = startMutationLeaseHeartbeat(
        () => true,
        () => {
          lease = renewMutationLease(lease!, Date.now(), storage, 30)
          return lease !== null
        },
        () => undefined,
        10,
      )

      await vi.advanceTimersByTimeAsync(70)
      expect(mutationLeaseIsOwned(lease!, Date.now(), storage)).toBe(true)
      stop()
      await vi.advanceTimersByTimeAsync(31)
      expect(mutationLeaseIsOwned(lease!, Date.now(), storage)).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('stops immediately when owner-checked renewal loses the lease', async () => {
    vi.useFakeTimers()
    try {
      const renew = vi.fn(() => false)
      const lost = vi.fn()
      startMutationLeaseHeartbeat(() => true, renew, lost, 10)
      await vi.advanceTimersByTimeAsync(30)
      expect(renew).toHaveBeenCalledOnce()
      expect(lost).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('final cloud mutation guard', () => {
  const rows = [row()]
  const revision = '7'
  const cloudSignature = remoteRowsSignature(rows)

  function setup() {
    let user: string | null = 'household-a'
    let fingerprint: string | null = 'fingerprint-a'
    let importEpoch: string | null = 'epoch-a'
    let lease = true
    let verifiedSession = true
    let lifecycle = true
    let postResponseAuth = true
    const controller = new AbortController()
    const push = vi.fn(async () => ({ ok: true as const, revision: '8' }))
    const finalize = vi.fn(async () => undefined)
    const pull = vi.fn(async () => ({
      ok: true as const,
      rows,
      revision,
    }))
    const run = () =>
      executeGuardedMutation({
        operationId: 'operation-a',
        householdId: 'household-a',
        datasetFingerprint: 'fingerprint-a',
        importEpoch: 'epoch-a',
        cloudRevision: revision,
        cloudSignature,
        signal: controller.signal,
        lifecycleValid: () => lifecycle,
        authenticatedHouseholdId: () => user,
        verifyAuthenticatedHousehold: async () => verifiedSession,
        verifyPostResponseAuth: async () => postResponseAuth,
        currentDatasetContext: async () => ({
          persistedFingerprint: fingerprint,
          memoryFingerprint: fingerprint,
          provenanceFingerprint: fingerprint,
          importEpoch,
          importTransitionPending: false,
          householdBindingValid: true,
        }),
        currentSynchronousDatasetContext: () => ({
          memoryFingerprint: fingerprint,
          provenanceFingerprint: fingerprint,
          importEpoch,
          importTransitionPending: false,
          householdBindingValid: true,
        }),
        leaseValid: () => lease,
        refreshLease: () => lease,
        updateLeaseDatasetFingerprint: () => lease,
        adoptCurrentHouseholdBinding: () => undefined,
        withDatasetLock: async (callback) => callback(),
        pull,
        push,
        finalize,
      })
    return {
      run,
      push,
      pull,
      controller,
      finalize,
      setUser: (value: string | null) => {
        user = value
      },
      setFingerprint: (value: string | null) => {
        fingerprint = value
      },
      setImportEpoch: (value: string | null) => {
        importEpoch = value
      },
      setLease: (value: boolean) => {
        lease = value
      },
      setVerifiedSession: (value: boolean) => {
        verifiedSession = value
      },
      setPostResponseAuth: (value: boolean) => {
        postResponseAuth = value
      },
      setLifecycle: (value: boolean) => {
        lifecycle = value
      },
    }
  }

  it('dispatches only after identity, provenance, lease, and revision pass', async () => {
    const test = setup()
    await expect(test.run()).resolves.toEqual({ ok: true, revision: '8' })
    expect(test.push).toHaveBeenCalledOnce()
    expect(test.finalize).toHaveBeenCalledOnce()
  })

  it('blocks sign-out or account switch while the pull is in flight', async () => {
    const test = setup()
    test.pull.mockImplementationOnce(async () => {
      test.setUser(null)
      return { ok: true as const, rows, revision }
    })
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.push).not.toHaveBeenCalled()
  })

  it('blocks when the official session changes before the auth callback updates the tab', async () => {
    const test = setup()
    test.pull.mockImplementationOnce(async () => {
      test.setVerifiedSession(false)
      return { ok: true as const, rows, revision }
    })
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.push).not.toHaveBeenCalled()
  })

  it('blocks an AppState/provenance change after lease acquisition', async () => {
    const test = setup()
    test.pull.mockImplementationOnce(async () => {
      test.setFingerprint('fingerprint-from-another-tab')
      return { ok: true as const, rows, revision }
    })
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.push).not.toHaveBeenCalled()
  })

  it('blocks a lease takeover before request dispatch', async () => {
    const test = setup()
    test.pull.mockImplementationOnce(async () => {
      test.setLease(false)
      return { ok: true as const, rows, revision }
    })
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.push).not.toHaveBeenCalled()
  })

  it('discards success without local finalization after lifecycle invalidation', async () => {
    const test = setup()
    test.push.mockImplementationOnce(async () => {
      test.setLifecycle(false)
      return { ok: true as const, revision: '8' }
    })
    await expect(test.run()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('local result was discarded'),
    })
    expect(test.finalize).not.toHaveBeenCalled()
  })

  it('discards success after import epoch or lease changes', async () => {
    const changedEpoch = setup()
    changedEpoch.push.mockImplementationOnce(async () => {
      changedEpoch.setImportEpoch('epoch-imported')
      return { ok: true as const, revision: '8' }
    })
    await expect(changedEpoch.run()).resolves.toMatchObject({ ok: false })
    expect(changedEpoch.finalize).not.toHaveBeenCalled()

    const lostLease = setup()
    lostLease.push.mockImplementationOnce(async () => {
      lostLease.setLease(false)
      return { ok: true as const, revision: '8' }
    })
    await expect(lostLease.run()).resolves.toMatchObject({ ok: false })
    expect(lostLease.finalize).not.toHaveBeenCalled()
  })

  it('re-verifies the exact auth context after a successful response', async () => {
    const test = setup()
    test.push.mockImplementationOnce(async () => {
      test.setPostResponseAuth(false)
      return { ok: true as const, revision: '8' }
    })
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.finalize).not.toHaveBeenCalled()
  })

  it('blocks a stale cloud revision', async () => {
    const test = setup()
    test.pull.mockResolvedValueOnce({
      ok: true as const,
      rows: [row('Changed in cloud')],
      revision,
    })
    await expect(test.run()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining('Cloud data changed'),
    })
    expect(test.push).not.toHaveBeenCalled()
  })

  it('blocks an aborted operation before dispatch', async () => {
    const test = setup()
    test.controller.abort()
    await expect(test.run()).resolves.toMatchObject({ ok: false })
    expect(test.pull).not.toHaveBeenCalled()
    expect(test.push).not.toHaveBeenCalled()
  })
})

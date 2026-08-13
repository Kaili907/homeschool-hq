import { describe, expect, it, vi } from 'vitest'
import type {
  ServiceWorkerUpdatePort,
  ServiceWorkerUpdateSnapshot,
} from './serviceWorkerUpdates'
import {
  ClientUpdateCoordinator,
  SYNC_MAINTENANCE_MESSAGE,
  UPDATE_ATTEMPT_STORAGE_KEY,
  UPDATE_REQUIRED_MESSAGE,
  type UpdateAttemptStorage,
} from './updateCoordinator'

const updateRequired = {
  status: 'update-required',
  syncProtocolVersion: 3,
  minimumSupportedSyncVersion: 3,
} as const

const maintenance = {
  status: 'maintenance',
  syncProtocolVersion: 2,
  minimumSupportedSyncVersion: 2,
  retryAfter: '2026-08-09T18:00:00.000Z',
} as const

class MemoryStorage implements UpdateAttemptStorage {
  readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

class FakeWorkerUpdates implements ServiceWorkerUpdatePort {
  readonly listeners = new Set<
    (state: ServiceWorkerUpdateSnapshot) => void
  >()
  requestCount = 0
  activateCount = 0
  waiting = false
  onStateRead: (() => void) | null = null
  #state: ServiceWorkerUpdateSnapshot = {
    phase: 'current',
    updateAvailable: false,
    controllerChanged: false,
  }

  get state(): ServiceWorkerUpdateSnapshot {
    const state = this.#state
    const onStateRead = this.onStateRead
    this.onStateRead = null
    onStateRead?.()
    return state
  }

  set state(state: ServiceWorkerUpdateSnapshot) {
    this.#state = state
  }

  async requestUpdate(): Promise<void> {
    this.requestCount += 1
  }

  async activateWaitingWorker(): Promise<boolean> {
    this.activateCount += 1
    return this.waiting
  }

  subscribe(
    listener: (state: ServiceWorkerUpdateSnapshot) => void,
  ): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.listeners.clear()
  }

  emit(state: ServiceWorkerUpdateSnapshot): void {
    this.#state = state
    for (const listener of this.listeners) listener(state)
  }
}

function setup(
  options: {
    storage?: MemoryStorage | null
    persist?: () => void | Promise<void>
    reload?: () => void
    online?: boolean
    worker?: FakeWorkerUpdates
    buildId?: string
  } = {},
) {
  const worker = options.worker ?? new FakeWorkerUpdates()
  const storage =
    options.storage === undefined ? new MemoryStorage() : options.storage
  const persist = options.persist ?? vi.fn()
  const reload = options.reload ?? vi.fn()
  const coordinator = new ClientUpdateCoordinator({
    clientBuildId: options.buildId ?? 'client-worker-build-a',
    clientSyncProtocolVersion: 2,
    workerUpdates: worker,
    storage,
    persistEducationalState: persist,
    reload,
    online: options.online,
  })
  return { coordinator, worker, storage, persist, reload }
}

describe('ClientUpdateCoordinator', () => {
  it('makes update-required terminal for the current bundle', async () => {
    const { coordinator } = setup()

    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()
    coordinator.reportSyncCompatibility({
      status: 'normal',
      syncProtocolVersion: 2,
    })

    expect(coordinator.state).toMatchObject({
      status: 'update-required',
      terminal: true,
      message: UPDATE_REQUIRED_MESSAGE,
      localLearning: 'available',
      sync: {
        automatic: 'stopped',
        debounced: 'stopped',
        reconnect: 'stopped',
        manual: 'stopped',
        retry: 'disabled',
      },
    })
    expect(coordinator.syncAbortSignal.aborted).toBe(true)
  })

  it('keeps maintenance separate, non-terminal, and refresh-free', async () => {
    const { coordinator, reload } = setup()

    coordinator.reportSyncCompatibility(maintenance)

    expect(coordinator.state).toMatchObject({
      status: 'maintenance',
      terminal: false,
      message: SYNC_MAINTENANCE_MESSAGE,
      refresh: 'not-required',
      localLearning: 'available',
      sync: { retry: 'disabled', manual: 'paused' },
    })
    expect(await coordinator.requestRefresh()).toEqual({
      accepted: false,
      reason: 'not-required',
    })
    expect(reload).not.toHaveBeenCalled()

    coordinator.reportSyncCompatibility({
      status: 'normal',
      syncProtocolVersion: 2,
    })
    expect(coordinator.state.status).toBe('normal')
  })

  it('suppresses automatic, debounce, and reconnect retry paths', async () => {
    const { coordinator } = setup()
    const write = vi.fn(async () => 'written')
    coordinator.reportSyncCompatibility(updateRequired)

    for (const intent of ['automatic', 'debounced', 'reconnect'] as const) {
      await expect(coordinator.runSyncWrite(intent, write)).resolves.toEqual({
        started: false,
        reason: 'update-required',
      })
    }
    expect(write).not.toHaveBeenCalled()
  })

  it('suppresses manual retry after update-required', async () => {
    const { coordinator } = setup()
    const write = vi.fn()
    coordinator.reportSyncCompatibility(updateRequired)

    await expect(coordinator.runSyncWrite('manual', write)).resolves.toEqual({
      started: false,
      reason: 'update-required',
    })
    expect(write).not.toHaveBeenCalled()
  })

  it('persists educational state before checking the worker and approved reload', async () => {
    const order: string[] = []
    const localWork = { unsyncedLessonAnswers: ['answer-a'] }
    const worker = new FakeWorkerUpdates()
    worker.requestUpdate = vi.fn(async () => {
      order.push('worker-update')
    })
    const { coordinator } = setup({
      worker,
      persist: async () => {
        order.push('persist')
        expect(localWork.unsyncedLessonAnswers).toEqual(['answer-a'])
      },
      reload: () => order.push('reload'),
    })

    coordinator.reportSyncCompatibility(updateRequired)
    expect(order).toEqual(['persist'])
    await coordinator.requestRefresh()

    expect(order).toEqual(['persist', 'worker-update', 'reload'])
    expect(localWork.unsyncedLessonAnswers).toEqual(['answer-a'])
  })

  it('requests a worker update without silently reloading', async () => {
    const { coordinator, worker, reload } = setup()

    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()

    expect(worker.requestCount).toBe(1)
    expect(coordinator.state).toMatchObject({
      status: 'update-required',
      refresh: 'available',
    })
    expect(reload).not.toHaveBeenCalled()
  })

  it('continues when controllerchange happens before waiting-for-worker', async () => {
    const worker = new FakeWorkerUpdates()
    worker.waiting = true
    worker.state = {
      phase: 'waiting',
      updateAvailable: true,
      controllerChanged: false,
    }
    const reload = vi.fn()
    const { coordinator } = setup({ worker, reload })
    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()
    worker.onStateRead = () =>
      worker.emit({
        phase: 'controller-changed',
        updateAvailable: false,
        controllerChanged: true,
      })

    await expect(coordinator.requestRefresh()).resolves.toEqual({
      accepted: true,
      waitingForWorker: false,
    })
    expect(coordinator.state).toMatchObject({ refresh: 'reloading' })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('waits when controllerchange happens after waiting-for-worker', async () => {
    const worker = new FakeWorkerUpdates()
    worker.waiting = true
    worker.state = {
      phase: 'waiting',
      updateAvailable: true,
      controllerChanged: false,
    }
    const reload = vi.fn()
    const { coordinator } = setup({ worker, reload })
    coordinator.reportSyncCompatibility(updateRequired)

    await expect(coordinator.requestRefresh()).resolves.toEqual({
      accepted: true,
      waitingForWorker: true,
    })
    expect(reload).not.toHaveBeenCalled()

    worker.emit({
      phase: 'controller-changed',
      updateAvailable: false,
      controllerChanged: true,
    })
    worker.emit({
      phase: 'controller-changed',
      updateAvailable: false,
      controllerChanged: true,
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('executes an approved reload only once', async () => {
    const reload = vi.fn()
    const { coordinator } = setup({ reload })
    coordinator.reportSyncCompatibility(updateRequired)

    expect((await coordinator.requestRefresh()).accepted).toBe(true)
    expect(await coordinator.requestRefresh()).toEqual({
      accepted: false,
      reason: 'already-requested',
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('executes only one activation and reload for concurrent approved requests', async () => {
    const worker = new FakeWorkerUpdates()
    let finishActivation: ((waiting: boolean) => void) | undefined
    worker.activateWaitingWorker = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishActivation = resolve
        }),
    )
    const reload = vi.fn()
    const { coordinator } = setup({ worker, reload })
    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()

    const firstRequest = coordinator.requestRefresh()
    await vi.waitFor(() =>
      expect(worker.activateWaitingWorker).toHaveBeenCalledOnce(),
    )
    await expect(coordinator.requestRefresh()).resolves.toEqual({
      accepted: false,
      reason: 'already-requested',
    })
    finishActivation?.(false)

    await expect(firstRequest).resolves.toEqual({
      accepted: true,
      waitingForWorker: false,
    })
    expect(worker.activateWaitingWorker).toHaveBeenCalledOnce()
    expect(reload).toHaveBeenCalledOnce()
  })

  it('rejects the same protocol tuple for the same stale client build', async () => {
    const storage = new MemoryStorage()
    const first = setup({ storage, buildId: 'stale-build-101' })
    first.coordinator.reportSyncCompatibility(updateRequired)
    await first.coordinator.requestRefresh()

    const staleReload = vi.fn()
    const stale = setup({
      storage,
      reload: staleReload,
      buildId: 'stale-build-101',
    })
    stale.coordinator.reportSyncCompatibility(updateRequired)
    await stale.coordinator.whenPrepared()

    expect(stale.coordinator.state).toMatchObject({
      status: 'update-required',
      refresh: 'loop-prevented',
    })
    expect(await stale.coordinator.requestRefresh()).toEqual({
      accepted: false,
      reason: 'loop-prevented',
    })
    expect(staleReload).not.toHaveBeenCalled()
  })

  it('permits progression for a genuinely new build with the same protocol tuple', async () => {
    const storage = new MemoryStorage()
    const stale = setup({ storage, buildId: 'stale-build-101' })
    stale.coordinator.reportSyncCompatibility(updateRequired)
    await stale.coordinator.requestRefresh()

    const reload = vi.fn()
    const updated = setup({
      storage,
      reload,
      buildId: 'new-build-102',
    })
    updated.coordinator.reportSyncCompatibility(updateRequired)
    await updated.coordinator.whenPrepared()

    expect(updated.coordinator.state).toMatchObject({
      status: 'update-required',
      terminal: true,
      refresh: 'available',
      sync: { manual: 'stopped', retry: 'disabled' },
    })
    await expect(updated.coordinator.requestRefresh()).resolves.toEqual({
      accepted: true,
      waitingForWorker: false,
    })
    expect(reload).toHaveBeenCalledOnce()
  })

  it('lets an offline client reconnect once, then fails closed on mismatch', async () => {
    const { coordinator } = setup({ online: false })
    const write = vi.fn(async () => 'checked')

    expect(await coordinator.runSyncWrite('reconnect', write)).toEqual({
      started: false,
      reason: 'offline',
    })
    coordinator.setOnline(true)
    expect(await coordinator.runSyncWrite('reconnect', write)).toEqual({
      started: true,
      value: 'checked',
    })
    coordinator.reportSyncCompatibility(updateRequired)
    coordinator.setOnline(false)
    coordinator.setOnline(true)
    expect(await coordinator.runSyncWrite('reconnect', write)).toEqual({
      started: false,
      reason: 'update-required',
    })
    expect(write).toHaveBeenCalledOnce()
  })

  it('retains unsynced data and blocks refresh when persistence fails', async () => {
    const localWork = ['unsynced-math-response']
    const { coordinator, worker, reload } = setup({
      persist: async () => {
        throw new Error('storage full')
      },
    })
    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()

    expect(coordinator.state).toMatchObject({
      status: 'update-required',
      refresh: 'persistence-failed',
      localLearning: 'available',
    })
    expect(await coordinator.requestRefresh()).toEqual({
      accepted: false,
      reason: 'not-ready',
    })
    expect(localWork).toEqual(['unsynced-math-response'])
    expect(worker.requestCount).toBe(0)
    expect(reload).not.toHaveBeenCalled()
  })

  it('writes only non-secret build and protocol attempt metadata', async () => {
    const storage = new MemoryStorage()
    const { coordinator } = setup({ storage })
    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.requestRefresh()

    const raw = storage.getItem(UPDATE_ATTEMPT_STORAGE_KEY)
    expect(JSON.parse(raw ?? '')).toEqual({
      clientBuildId: 'client-worker-build-a',
      clientSyncProtocolVersion: 2,
      serverSyncProtocolVersion: 3,
      minimumSupportedSyncVersion: 3,
    })
    expect(raw).not.toMatch(/pin|credential|password|token|household|profile/i)
  })

  it('fails closed when session metadata storage is unavailable', async () => {
    const { coordinator, reload } = setup({ storage: null })
    coordinator.reportSyncCompatibility(updateRequired)
    await coordinator.whenPrepared()

    expect(coordinator.state).toMatchObject({
      status: 'update-required',
      refresh: 'storage-unavailable',
    })
    expect(await coordinator.requestRefresh()).toEqual({
      accepted: false,
      reason: 'storage-unavailable',
    })
    expect(reload).not.toHaveBeenCalled()
  })
})

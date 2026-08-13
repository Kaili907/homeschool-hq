import { describe, expect, it, vi } from 'vitest'
import {
  ACTIVATE_ACADEMY_SERVICE_WORKER,
  BrowserServiceWorkerUpdates,
  type ServiceWorkerContainerLike,
} from './serviceWorkerUpdates'
import { ClientUpdateCoordinator } from './updateCoordinator'

class FakeWorker {
  state = 'activated'
  readonly postMessage = vi.fn()
  readonly listeners = new Set<() => void>()

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.delete(listener)
  }

  transition(state: string): void {
    this.state = state
    for (const listener of this.listeners) listener()
  }
}

class FakeRegistration {
  active: FakeWorker | null = new FakeWorker()
  installing: FakeWorker | null = null
  waiting: FakeWorker | null = null
  readonly update = vi.fn(async () => undefined)
  readonly updateFoundListeners = new Set<() => void>()

  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.updateFoundListeners.add(listener)
  }

  removeEventListener(_type: 'updatefound', listener: () => void): void {
    this.updateFoundListeners.delete(listener)
  }

  emitUpdateFound(): void {
    for (const listener of this.updateFoundListeners) listener()
  }
}

class FakeContainer {
  controller: FakeWorker | null = new FakeWorker()
  readonly registration = new FakeRegistration()
  readonly register = vi.fn(async () => this.registration)
  readonly controllerListeners = new Set<() => void>()

  addEventListener(_type: 'controllerchange', listener: () => void): void {
    this.controllerListeners.add(listener)
  }

  removeEventListener(_type: 'controllerchange', listener: () => void): void {
    this.controllerListeners.delete(listener)
  }

  emitControllerChange(): void {
    for (const listener of this.controllerListeners) listener()
  }
}

function monitorFor(container: FakeContainer) {
  return new BrowserServiceWorkerUpdates(
    container as unknown as ServiceWorkerContainerLike,
  )
}

describe('BrowserServiceWorkerUpdates', () => {
  it('registers the existing worker and explicitly checks for updates', async () => {
    const container = new FakeContainer()
    const monitor = monitorFor(container)

    await monitor.start()
    await monitor.requestUpdate()

    expect(container.register).toHaveBeenCalledWith('/sw.js')
    expect(container.registration.update).toHaveBeenCalledOnce()
    expect(monitor.state.phase).toBe('current')
  })

  it('tracks updatefound, installing, and waiting workers', async () => {
    const container = new FakeContainer()
    const monitor = monitorFor(container)
    await monitor.start()

    const installing = new FakeWorker()
    installing.state = 'installing'
    container.registration.installing = installing
    container.registration.emitUpdateFound()
    expect(monitor.state).toMatchObject({
      phase: 'installing',
      updateAvailable: true,
    })

    container.registration.installing = null
    container.registration.waiting = installing
    installing.transition('installed')
    expect(monitor.state).toMatchObject({
      phase: 'waiting',
      updateAvailable: true,
    })
  })

  it('activates a waiting worker and reports controllerchange without reloading', async () => {
    const container = new FakeContainer()
    const waiting = new FakeWorker()
    waiting.state = 'installed'
    container.registration.waiting = waiting
    const monitor = monitorFor(container)
    await monitor.start()

    expect(await monitor.activateWaitingWorker()).toBe(true)
    expect(waiting.postMessage).toHaveBeenCalledWith({
      type: ACTIVATE_ACADEMY_SERVICE_WORKER,
    })

    container.emitControllerChange()
    expect(monitor.state).toEqual({
      phase: 'controller-changed',
      updateAvailable: false,
      controllerChanged: true,
    })
  })

  it('handles overlapping worker lifecycle events once after approved persistence', async () => {
    const order: string[] = []
    const container = new FakeContainer()
    container.registration.update.mockImplementation(async () => {
      order.push('worker-update')
    })
    const monitor = monitorFor(container)
    await monitor.start()
    const storage = new Map<string, string>()
    const reload = vi.fn(() => order.push('reload'))
    const coordinator = new ClientUpdateCoordinator({
      clientBuildId: 'overlap-build',
      clientSyncProtocolVersion: 2,
      workerUpdates: monitor,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
      persistEducationalState: () => {
        order.push('persist')
      },
      reload,
    })

    coordinator.reportSyncCompatibility({
      status: 'update-required',
      syncProtocolVersion: 3,
      minimumSupportedSyncVersion: 3,
    })
    await coordinator.whenPrepared()

    expect(order).toEqual(['persist', 'worker-update'])
    expect(reload).not.toHaveBeenCalled()

    const waiting = new FakeWorker()
    waiting.state = 'installed'
    container.registration.waiting = waiting
    waiting.postMessage.mockImplementation(() => {
      order.push('activation')
      container.registration.waiting = null
      container.registration.installing = waiting
      waiting.state = 'installing'
      container.registration.emitUpdateFound()
      order.push('updatefound')

      container.registration.installing = null
      container.registration.waiting = waiting
      waiting.transition('installed')
      order.push('statechange')

      container.emitControllerChange()
      order.push('controllerchange')
    })

    await expect(coordinator.requestRefresh()).resolves.toEqual({
      accepted: true,
      waitingForWorker: false,
    })
    waiting.transition('activated')
    container.emitControllerChange()

    expect(order).toEqual([
      'persist',
      'worker-update',
      'activation',
      'updatefound',
      'statechange',
      'controllerchange',
      'reload',
    ])
    expect(reload).toHaveBeenCalledOnce()

    monitor.dispose()
    expect(container.controllerListeners).toHaveLength(0)
    expect(container.registration.updateFoundListeners).toHaveLength(0)
    expect(waiting.listeners).toHaveLength(0)
  })

  it('deterministically disposes every worker lifecycle observer', async () => {
    const container = new FakeContainer()
    const installing = new FakeWorker()
    installing.state = 'installing'
    container.registration.installing = installing
    const monitor = monitorFor(container)
    const observed = vi.fn()
    monitor.subscribe(observed)
    await monitor.start()

    expect(container.controllerListeners).toHaveLength(1)
    expect(container.registration.updateFoundListeners).toHaveLength(1)
    expect(installing.listeners).toHaveLength(1)

    monitor.dispose()
    monitor.dispose()

    expect(container.controllerListeners).toHaveLength(0)
    expect(container.registration.updateFoundListeners).toHaveLength(0)
    expect(installing.listeners).toHaveLength(0)
    const callsAfterDispose = observed.mock.calls.length

    container.emitControllerChange()
    container.registration.emitUpdateFound()
    installing.transition('installed')

    expect(observed).toHaveBeenCalledTimes(callsAfterDispose)
    await expect(monitor.activateWaitingWorker()).resolves.toBe(false)
  })
})

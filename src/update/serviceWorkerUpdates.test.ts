import { describe, expect, it, vi } from 'vitest'
import {
  ACTIVATE_ACADEMY_SERVICE_WORKER,
  BrowserServiceWorkerUpdates,
  type ServiceWorkerContainerLike,
} from './serviceWorkerUpdates'

class FakeWorker {
  state = 'activated'
  readonly postMessage = vi.fn()
  readonly listeners = new Set<() => void>()

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener)
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
})

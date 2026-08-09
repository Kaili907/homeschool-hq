export const ACTIVATE_ACADEMY_SERVICE_WORKER =
  'ACADEMY_ACTIVATE_SERVICE_WORKER' as const

export type ServiceWorkerUpdatePhase =
  | 'unavailable'
  | 'idle'
  | 'checking'
  | 'installing'
  | 'waiting'
  | 'activating'
  | 'current'
  | 'controller-changed'
  | 'error'

export interface ServiceWorkerUpdateSnapshot {
  readonly phase: ServiceWorkerUpdatePhase
  readonly updateAvailable: boolean
  readonly controllerChanged: boolean
}

export interface ServiceWorkerUpdatePort {
  readonly state: ServiceWorkerUpdateSnapshot
  requestUpdate(): Promise<void>
  activateWaitingWorker(): Promise<boolean>
  subscribe(listener: (state: ServiceWorkerUpdateSnapshot) => void): () => void
  dispose(): void
}

interface WorkerLike {
  readonly state: string
  postMessage(message: unknown): void
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

interface RegistrationLike {
  readonly active: WorkerLike | null
  readonly installing: WorkerLike | null
  readonly waiting: WorkerLike | null
  update(): Promise<unknown>
  addEventListener(type: 'updatefound', listener: () => void): void
  removeEventListener(type: 'updatefound', listener: () => void): void
}

export interface ServiceWorkerContainerLike {
  readonly controller: WorkerLike | null
  register(scriptURL: string): Promise<RegistrationLike>
  addEventListener(type: 'controllerchange', listener: () => void): void
  removeEventListener(type: 'controllerchange', listener: () => void): void
}

const unavailableState: ServiceWorkerUpdateSnapshot = Object.freeze({
  phase: 'unavailable',
  updateAvailable: false,
  controllerChanged: false,
})

export class UnavailableServiceWorkerUpdates
  implements ServiceWorkerUpdatePort
{
  readonly state = unavailableState

  async requestUpdate(): Promise<void> {}

  async activateWaitingWorker(): Promise<boolean> {
    return false
  }

  subscribe(): () => void {
    return () => {}
  }

  dispose(): void {}
}

/**
 * Observes browser service-worker lifecycle state. Compatibility authority stays
 * with the sync protocol; this class only reports whether a worker update exists.
 */
export class BrowserServiceWorkerUpdates implements ServiceWorkerUpdatePort {
  readonly #listeners = new Set<
    (state: ServiceWorkerUpdateSnapshot) => void
  >()
  readonly #registrationListeners = new Map<RegistrationLike, () => void>()
  readonly #workerListeners = new Map<WorkerLike, () => void>()
  #registration: RegistrationLike | null = null
  #startPromise: Promise<void> | null = null
  #controllerListenerAttached = false
  #disposed = false
  #state: ServiceWorkerUpdateSnapshot = {
    phase: 'idle',
    updateAvailable: false,
    controllerChanged: false,
  }
  readonly #handleControllerChange = (): void => {
    if (this.#disposed) return
    this.#state = {
      phase: 'controller-changed',
      updateAvailable: false,
      controllerChanged: true,
    }
    this.#emit()
  }

  constructor(
    private readonly container: ServiceWorkerContainerLike,
    private readonly scriptURL = '/sw.js',
  ) {}

  get state(): ServiceWorkerUpdateSnapshot {
    return this.#state
  }

  subscribe(
    listener: (state: ServiceWorkerUpdateSnapshot) => void,
  ): () => void {
    if (this.#disposed) return () => {}
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  start(): Promise<void> {
    if (this.#disposed) return Promise.resolve()
    this.#startPromise ??= this.#start()
    return this.#startPromise
  }

  async requestUpdate(): Promise<void> {
    if (this.#disposed) return
    await this.start()
    const registration = this.#registration
    if (!registration) return

    this.#setState('checking', this.#state.updateAvailable)
    try {
      await registration.update()
      this.#observeRegistration(registration)
      this.#refreshRegistrationState(registration)
    } catch {
      this.#setState('error', this.#state.updateAvailable)
    }
  }

  async activateWaitingWorker(): Promise<boolean> {
    if (this.#disposed) return false
    const waiting = this.#registration?.waiting
    if (!waiting) return false

    try {
      this.#setState('activating', true)
      waiting.postMessage({ type: ACTIVATE_ACADEMY_SERVICE_WORKER })
      return true
    } catch {
      this.#setState('error', true)
      return false
    }
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    if (this.#controllerListenerAttached) {
      this.container.removeEventListener(
        'controllerchange',
        this.#handleControllerChange,
      )
      this.#controllerListenerAttached = false
    }
    for (const [registration, listener] of this.#registrationListeners) {
      registration.removeEventListener('updatefound', listener)
    }
    this.#registrationListeners.clear()
    for (const [worker, listener] of this.#workerListeners) {
      worker.removeEventListener('statechange', listener)
    }
    this.#workerListeners.clear()
    this.#listeners.clear()
    this.#registration = null
  }

  async #start(): Promise<void> {
    this.container.addEventListener(
      'controllerchange',
      this.#handleControllerChange,
    )
    this.#controllerListenerAttached = true

    try {
      const registration = await this.container.register(this.scriptURL)
      if (this.#disposed) return
      this.#registration = registration
      this.#observeRegistration(registration)
      this.#refreshRegistrationState(registration)
    } catch {
      this.#setState('error', false)
    }
  }

  #observeRegistration(registration: RegistrationLike): void {
    if (this.#disposed || this.#registrationListeners.has(registration)) return
    const listener = () => {
      const installing = registration.installing
      if (installing) this.#observeWorker(installing, registration)
      this.#refreshRegistrationState(registration)
    }
    this.#registrationListeners.set(registration, listener)
    registration.addEventListener('updatefound', listener)
    if (registration.installing) {
      this.#observeWorker(registration.installing, registration)
    }
    if (registration.waiting) {
      this.#observeWorker(registration.waiting, registration)
    }
  }

  #observeWorker(worker: WorkerLike, registration: RegistrationLike): void {
    if (this.#disposed || this.#workerListeners.has(worker)) return
    const listener = () => {
      this.#refreshRegistrationState(registration, worker)
    }
    this.#workerListeners.set(worker, listener)
    worker.addEventListener('statechange', listener)
  }

  #refreshRegistrationState(
    registration: RegistrationLike,
    changedWorker?: WorkerLike,
  ): void {
    if (registration.waiting) {
      this.#observeWorker(registration.waiting, registration)
      this.#setState('waiting', true)
      return
    }
    if (registration.installing) {
      this.#observeWorker(registration.installing, registration)
      const installed = registration.installing.state === 'installed'
      this.#setState(installed ? 'waiting' : 'installing', true)
      return
    }
    if (changedWorker?.state === 'installed') {
      this.#setState('waiting', true)
      return
    }
    this.#setState(registration.active ? 'current' : 'idle', false)
  }

  #setState(
    phase: ServiceWorkerUpdatePhase,
    updateAvailable: boolean,
  ): void {
    this.#state = {
      phase,
      updateAvailable,
      controllerChanged: this.#state.controllerChanged,
    }
    this.#emit()
  }

  #emit(): void {
    for (const listener of this.#listeners) listener(this.#state)
  }
}

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
}

interface WorkerLike {
  readonly state: string
  postMessage(message: unknown): void
  addEventListener(type: 'statechange', listener: () => void): void
}

interface RegistrationLike {
  readonly active: WorkerLike | null
  readonly installing: WorkerLike | null
  readonly waiting: WorkerLike | null
  update(): Promise<unknown>
  addEventListener(type: 'updatefound', listener: () => void): void
}

export interface ServiceWorkerContainerLike {
  readonly controller: WorkerLike | null
  register(scriptURL: string): Promise<RegistrationLike>
  addEventListener(type: 'controllerchange', listener: () => void): void
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
}

/**
 * Observes browser service-worker lifecycle state. Compatibility authority stays
 * with the sync protocol; this class only reports whether a worker update exists.
 */
export class BrowserServiceWorkerUpdates implements ServiceWorkerUpdatePort {
  readonly #listeners = new Set<
    (state: ServiceWorkerUpdateSnapshot) => void
  >()
  readonly #observedRegistrations = new WeakSet<object>()
  readonly #observedWorkers = new WeakSet<object>()
  #registration: RegistrationLike | null = null
  #startPromise: Promise<void> | null = null
  #state: ServiceWorkerUpdateSnapshot = {
    phase: 'idle',
    updateAvailable: false,
    controllerChanged: false,
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
    this.#listeners.add(listener)
    listener(this.#state)
    return () => this.#listeners.delete(listener)
  }

  start(): Promise<void> {
    this.#startPromise ??= this.#start()
    return this.#startPromise
  }

  async requestUpdate(): Promise<void> {
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

  async #start(): Promise<void> {
    this.container.addEventListener('controllerchange', () => {
      this.#state = {
        phase: 'controller-changed',
        updateAvailable: false,
        controllerChanged: true,
      }
      this.#emit()
    })

    try {
      const registration = await this.container.register(this.scriptURL)
      this.#registration = registration
      this.#observeRegistration(registration)
      this.#refreshRegistrationState(registration)
    } catch {
      this.#setState('error', false)
    }
  }

  #observeRegistration(registration: RegistrationLike): void {
    if (this.#observedRegistrations.has(registration)) return
    this.#observedRegistrations.add(registration)
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing
      if (installing) this.#observeWorker(installing, registration)
      this.#refreshRegistrationState(registration)
    })
    if (registration.installing) {
      this.#observeWorker(registration.installing, registration)
    }
    if (registration.waiting) {
      this.#observeWorker(registration.waiting, registration)
    }
  }

  #observeWorker(worker: WorkerLike, registration: RegistrationLike): void {
    if (this.#observedWorkers.has(worker)) return
    this.#observedWorkers.add(worker)
    worker.addEventListener('statechange', () => {
      this.#refreshRegistrationState(registration, worker)
    })
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

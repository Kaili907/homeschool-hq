import { ACADEMY_SYNC_PROTOCOL_VERSION } from '../security/contracts'
import {
  BrowserServiceWorkerUpdates,
  type ServiceWorkerContainerLike,
  UnavailableServiceWorkerUpdates,
} from './serviceWorkerUpdates'
import {
  ClientUpdateCoordinator,
  type SyncCompatibilitySignal,
} from './updateCoordinator'

export type PersistEducationalStateHook = () => void | Promise<void>

let persistenceHook: PersistEducationalStateHook | null = null
let runtimeStarted = false

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const workerUpdates =
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator
    ? new BrowserServiceWorkerUpdates(
        navigator.serviceWorker as unknown as ServiceWorkerContainerLike,
      )
    : new UnavailableServiceWorkerUpdates()

export const academyUpdateCoordinator = new ClientUpdateCoordinator({
  clientSyncProtocolVersion: ACADEMY_SYNC_PROTOCOL_VERSION,
  workerUpdates,
  storage: browserStorage(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  persistEducationalState: async () => {
    if (!persistenceHook) {
      throw new Error('Educational state persistence is not configured.')
    }
    await persistenceHook()
  },
  reload: () => {
    if (typeof window !== 'undefined') window.location.reload()
  },
})

/** Final App integration installs its durable local-state confirmation here. */
export function configureAcademyUpdatePersistence(
  hook: PersistEducationalStateHook,
): () => void {
  persistenceHook = hook
  return () => {
    if (persistenceHook === hook) persistenceHook = null
  }
}

/** Sync V2 reports its exported state through this dependency-safe seam. */
export function reportAcademySyncCompatibility(
  signal: SyncCompatibilitySignal,
): void {
  academyUpdateCoordinator.reportSyncCompatibility(signal)
}

export async function startAcademyUpdateRuntime(): Promise<void> {
  if (runtimeStarted) return
  runtimeStarted = true

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () =>
      academyUpdateCoordinator.setOnline(true),
    )
    window.addEventListener('offline', () =>
      academyUpdateCoordinator.setOnline(false),
    )
  }
  if (workerUpdates instanceof BrowserServiceWorkerUpdates) {
    await workerUpdates.start()
  }
}

// FAMILY-PILOT-DURABLE-INDEXEDDB: the browser IndexedDB access layer.
//
// A promise wrapper over the raw request/transaction API and nothing more. It
// holds no Study knowledge, no key naming and no policy — those belong to
// storage.ts — so that everything IndexedDB-specific and event-driven is in one
// small file that can be exercised against an injected factory.
//
// The database version is deliberately pinned rather than derived. Opening at a
// LOWER version than the stored database is an error in IndexedDB itself, which
// is exactly the behaviour this store wants: a build that predates a future
// upgrade must fail closed instead of reading a database it does not understand.

export const FAMILY_PILOT_DURABLE_DATABASE_NAME = 'manuel-academy.study.family-pilot-durable' as const
export const FAMILY_PILOT_DURABLE_DATABASE_VERSION = 1 as const
export const FAMILY_PILOT_DURABLE_OBJECT_STORE = 'records' as const

export type IndexedDbFailureKind =
  /** No IndexedDB on this platform, or the platform refused to open it. */
  | 'unavailable'
  /** The stored database was created by a build newer than this one. */
  | 'database-version-ahead'
  /** A read or write transaction failed — quota, a closed connection, a disk error. */
  | 'transaction-failed'
  /** The record changed since the caller last read it, so the write was refused. */
  | 'conflict'

export class IndexedDbRecordError extends Error {
  readonly kind: IndexedDbFailureKind

  constructor(kind: IndexedDbFailureKind, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'IndexedDbRecordError'
    this.kind = kind
  }
}

export interface IndexedDbRecordStore {
  read(keys: readonly string[]): Promise<ReadonlyMap<string, unknown>>
  /**
   * `precondition` is checked against the stored record inside the same
   * read-write transaction as the put, which is what makes this an atomic
   * compare-and-set rather than a check followed by a race. A refused
   * precondition aborts the transaction and rejects with `kind: 'conflict'`.
   */
  write(key: string, value: unknown, precondition?: (current: unknown) => boolean): Promise<void>
  remove(key: string): Promise<void>
  /** Bytes this origin is using and may use, when the platform reports it. */
  estimate(): Promise<{ readonly usage: number | null; readonly quota: number | null }>
  close(): void
}

export interface IndexedDbRecordStoreOptions {
  /** Injectable only so the store can be exercised outside a browser. */
  readonly factory?: IDBFactory
  readonly storageManager?: Pick<StorageManager, 'estimate'>
  readonly databaseName?: string
  /**
   * Called when the connection is dropped from underneath the caller, which
   * happens when a newer build in another tab asks to upgrade the database.
   * Writes fail loudly from that point; reads keep serving whatever the caller
   * already had, so the caller has to be told the difference.
   */
  readonly onClosed?: () => void
}

function browserFactory(): IDBFactory | undefined {
  try {
    return typeof indexedDB === 'undefined' ? undefined : indexedDB
  } catch {
    // A privacy mode that throws on property access is "no database", not a crash.
    return undefined
  }
}

function browserStorageManager(): Pick<StorageManager, 'estimate'> | undefined {
  try {
    return typeof navigator === 'undefined' ? undefined : navigator.storage
  } catch {
    return undefined
  }
}

/**
 * `VersionError` is how IndexedDB reports "the stored database is newer than the
 * version you asked for". It is the database-level twin of the document-level
 * `schema-version-ahead` refusal, and it must never be treated as a generic
 * failure: the household's data is intact and a newer build still opens it.
 */
function openFailure(error: unknown): IndexedDbRecordError {
  const name = (error as { name?: string } | null)?.name
  return name === 'VersionError'
    ? new IndexedDbRecordError(
        'database-version-ahead',
        'Saved Study work was written by a newer version of this app.',
        error,
      )
    : new IndexedDbRecordError('unavailable', 'This device would not open durable Study storage.', error)
}

export async function openIndexedDbRecordStore(
  options: IndexedDbRecordStoreOptions = {},
): Promise<IndexedDbRecordStore> {
  const factory = options.factory ?? browserFactory()
  if (!factory) throw new IndexedDbRecordError('unavailable', 'This device has no IndexedDB.')
  const databaseName = options.databaseName ?? FAMILY_PILOT_DURABLE_DATABASE_NAME
  const storageManager = options.storageManager ?? browserStorageManager()

  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest
    let abandoned = false
    try {
      request = factory.open(databaseName, FAMILY_PILOT_DURABLE_DATABASE_VERSION)
    } catch (error) {
      reject(openFailure(error))
      return
    }
    request.onupgradeneeded = () => {
      const upgrading = request.result
      if (!upgrading.objectStoreNames.contains(FAMILY_PILOT_DURABLE_OBJECT_STORE)) {
        upgrading.createObjectStore(FAMILY_PILOT_DURABLE_OBJECT_STORE)
      }
    }
    request.onsuccess = () => {
      // A refused open can still succeed afterwards. Nobody holds the result, so
      // leaving it open would block the very upgrade this refusal was about.
      if (abandoned) {
        request.result.close()
        return
      }
      resolve(request.result)
    }
    request.onerror = () => { reject(openFailure(request.error)) }
    // Only reachable when another connection is holding a version this one is
    // trying to replace. Refusing is the fail-closed answer either way.
    request.onblocked = () => {
      abandoned = true
      reject(new IndexedDbRecordError('unavailable', 'Durable Study storage is in use by another tab.'))
    }
  })

  // A newer build in another tab asking to upgrade must not be blocked by this
  // connection. Closing here makes every later write fail loudly, which is what
  // surfaces "this tab is out of date" instead of silently dropping work.
  database.onversionchange = () => {
    database.close()
    options.onClosed?.()
  }

  function transaction(mode: IDBTransactionMode): IDBTransaction {
    try {
      return database.transaction(FAMILY_PILOT_DURABLE_OBJECT_STORE, mode)
    } catch (error) {
      throw new IndexedDbRecordError('transaction-failed', 'Durable Study storage is closed.', error)
    }
  }

  return {
    async read(keys) {
      if (keys.length === 0) return new Map()
      return new Promise((resolve, reject) => {
        const found = new Map<string, unknown>()
        const tx = transaction('readonly')
        const store = tx.objectStore(FAMILY_PILOT_DURABLE_OBJECT_STORE)
        for (const key of keys) {
          const request = store.get(key)
          request.onsuccess = () => {
            if (request.result !== undefined) found.set(key, request.result)
          }
        }
        tx.oncomplete = () => { resolve(found) }
        tx.onerror = () => {
          reject(new IndexedDbRecordError('transaction-failed', 'Saved Study work could not be read.', tx.error))
        }
        tx.onabort = () => {
          reject(new IndexedDbRecordError('transaction-failed', 'Saved Study work could not be read.', tx.error))
        }
      })
    },

    async write(key, value, precondition) {
      return new Promise((resolve, reject) => {
        const tx = transaction('readwrite')
        const store = tx.objectStore(FAMILY_PILOT_DURABLE_OBJECT_STORE)
        let refused = false
        let synchronousFailure: unknown = null
        if (precondition) {
          const current = store.get(key)
          current.onsuccess = () => {
            try {
              if (precondition(current.result)) {
                store.put(value, key)
                return
              }
              refused = true
            } catch (error) {
              synchronousFailure = error
            }
            tx.abort()
          }
        } else {
          // A quota refusal surfaces on the transaction, not on the request, so
          // resolving on request success would report a write that never landed.
          try {
            store.put(value, key)
          } catch (error) {
            synchronousFailure = error
            tx.abort()
          }
        }
        tx.oncomplete = () => { resolve() }
        tx.onerror = () => {
          reject(new IndexedDbRecordError('transaction-failed', 'Study work could not be saved to this device.', tx.error))
        }
        tx.onabort = () => {
          reject(refused
            ? new IndexedDbRecordError('conflict', 'Saved Study work changed elsewhere since it was read here.')
            : new IndexedDbRecordError('transaction-failed', 'Study work could not be saved to this device.', synchronousFailure ?? tx.error))
        }
      })
    },

    async remove(key) {
      return new Promise((resolve, reject) => {
        const tx = transaction('readwrite')
        tx.objectStore(FAMILY_PILOT_DURABLE_OBJECT_STORE).delete(key)
        tx.oncomplete = () => { resolve() }
        tx.onerror = () => {
          reject(new IndexedDbRecordError('transaction-failed', 'Saved Study work could not be removed.', tx.error))
        }
        tx.onabort = () => {
          reject(new IndexedDbRecordError('transaction-failed', 'Saved Study work could not be removed.', tx.error))
        }
      })
    },

    async estimate() {
      if (!storageManager?.estimate) return { usage: null, quota: null }
      try {
        const reported = await storageManager.estimate()
        return { usage: reported.usage ?? null, quota: reported.quota ?? null }
      } catch {
        // A platform that will not report its budget is not a failure to store.
        return { usage: null, quota: null }
      }
    },

    close() {
      database.close()
    },
  }
}

// FAMILY-PILOT-DURABLE-INDEXEDDB: a test-only IndexedDB.
//
// The supported Node test environment has no IndexedDB, and this repository does
// not carry a browser-shim dependency. This is a deliberately small stand-in
// that reproduces the parts of the API this module actually depends on, and it
// is honest about being one: it models request/transaction event ordering,
// `VersionError` on a downgrade, `versionchange` on an upgrade from another
// connection, transaction-level quota aborts, and structured-clone storage.
//
// It does NOT model a real browser's quota policy, eviction, partitioning, or
// per-platform limits, so the capacity numbers measured against it are byte
// counts for one architecture, not a promise about any particular device.
//
// Never imported by the module's own source. The production entry point's
// import closure is asserted clean of this directory in browserSafety.test.ts.

interface FakeDatabaseState {
  version: number
  readonly stores: Map<string, Map<string, unknown>>
  readonly connections: Set<FakeDatabase>
}

interface FakeEventTarget {
  onsuccess: ((event: unknown) => void) | null
  onerror: ((event: unknown) => void) | null
}

function fail(name: string, message: string): Error & { name: string } {
  const error = new Error(message) as Error & { name: string }
  error.name = name
  return error
}

class FakeRequest<T> implements FakeEventTarget {
  onsuccess: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  result: T | undefined = undefined
  error: Error | null = null
}

class FakeTransaction {
  oncomplete: ((event: unknown) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onabort: ((event: unknown) => void) | null = null
  error: Error | null = null
  readonly #operations: (() => void)[] = []
  #settled = false

  constructor(
    private readonly store: Map<string, unknown>,
    private readonly control: FakeIndexedDbControl,
    private readonly mode: IDBTransactionMode,
  ) {
    // Operations are queued synchronously after construction and the handlers
    // are assigned in the same block, exactly as with a real transaction, so
    // draining on a microtask is the earliest correct moment.
    queueMicrotask(() => { this.#drain() })
  }

  objectStore(): FakeObjectStore {
    return new FakeObjectStore(this.store, this, this.control, this.mode)
  }

  enqueue(operation: () => void): void {
    this.#operations.push(operation)
  }

  /** An explicit abort, which fires `onabort` only — never `onerror`. */
  abort(): void {
    if (this.#settled) return
    this.#settled = true
    queueMicrotask(() => { this.onabort?.({ target: this }) })
  }

  failWith(error: Error): void {
    if (this.#settled) return
    this.#settled = true
    this.error = error
    queueMicrotask(() => {
      this.onerror?.({ target: this })
      this.onabort?.({ target: this })
    })
  }

  #drain(): void {
    if (this.#settled) return
    for (const operation of this.#operations) {
      if (this.#settled) return
      try {
        operation()
      } catch (error) {
        this.failWith(error as Error)
        return
      }
    }
    if (this.#settled) return
    this.#settled = true
    this.oncomplete?.({ target: this })
  }
}

class FakeObjectStore {
  constructor(
    private readonly store: Map<string, unknown>,
    private readonly transaction: FakeTransaction,
    private readonly control: FakeIndexedDbControl,
    private readonly mode: IDBTransactionMode,
  ) {}

  get(key: string): FakeRequest<unknown> {
    const request = new FakeRequest<unknown>()
    this.transaction.enqueue(() => {
      if (this.control.failReads > 0) {
        this.control.failReads -= 1
        throw fail('UnknownError', 'Injected read failure.')
      }
      request.result = this.store.has(key) ? structuredClone(this.store.get(key)) : undefined
      request.onsuccess?.({ target: request })
    })
    return request
  }

  put(value: unknown, key: string): FakeRequest<string> {
    const request = new FakeRequest<string>()
    this.transaction.enqueue(() => {
      if (this.mode !== 'readwrite') throw fail('ReadOnlyError', 'Transaction is read-only.')
      if (this.control.failWrites > 0) {
        this.control.failWrites -= 1
        throw fail('UnknownError', 'Injected write failure.')
      }
      const keyed = this.control.failKeys.get(key) ?? 0
      if (keyed > 0) {
        this.control.failKeys.set(key, keyed - 1)
        throw fail('UnknownError', 'Injected write failure.')
      }
      const stored = structuredClone(value)
      const projected = this.control.usedBytes() - this.control.sizeOf(this.store.get(key)) + this.control.sizeOf(stored)
      if (projected > this.control.quota) {
        throw fail('QuotaExceededError', 'The quota has been exceeded.')
      }
      this.store.set(key, stored)
      request.result = key
      request.onsuccess?.({ target: request })
    })
    return request
  }

  delete(key: string): FakeRequest<undefined> {
    const request = new FakeRequest<undefined>()
    this.transaction.enqueue(() => {
      if (this.mode !== 'readwrite') throw fail('ReadOnlyError', 'Transaction is read-only.')
      // A delete is a write, and a device that refuses writes refuses these too.
      if (this.control.failWrites > 0) {
        this.control.failWrites -= 1
        throw fail('UnknownError', 'Injected write failure.')
      }
      this.store.delete(key)
      request.onsuccess?.({ target: request })
    })
    return request
  }
}

class FakeDatabase {
  onversionchange: ((event: unknown) => void) | null = null
  #closed = false

  constructor(
    private readonly state: FakeDatabaseState,
    private readonly control: FakeIndexedDbControl,
  ) {
    state.connections.add(this)
  }

  get version(): number {
    return this.state.version
  }

  get objectStoreNames(): { contains: (name: string) => boolean } {
    return { contains: (name: string) => this.state.stores.has(name) }
  }

  createObjectStore(name: string): void {
    this.state.stores.set(name, new Map())
  }

  transaction(name: string, mode: IDBTransactionMode): FakeTransaction {
    if (this.#closed) throw fail('InvalidStateError', 'The database connection is closing.')
    const store = this.state.stores.get(name)
    if (!store) throw fail('NotFoundError', 'No object store named ' + name + '.')
    return new FakeTransaction(store, this.control, mode)
  }

  close(): void {
    this.#closed = true
    this.state.connections.delete(this)
  }

  notifyVersionChange(): void {
    this.onversionchange?.({ target: this })
  }
}

interface FakeIndexedDbControl {
  quota: number
  failWrites: number
  failReads: number
  readonly failKeys: Map<string, number>
  usedBytes(): number
  sizeOf(value: unknown): number
}

export interface FakeIndexedDb {
  /** Hand this to `openIndexedDbRecordStore({ factory })`. */
  readonly factory: IDBFactory
  readonly storageManager: Pick<StorageManager, 'estimate'>
  /** Everything actually stored, keyed by record key. A copy, not the store. */
  records(databaseName?: string): ReadonlyMap<string, unknown>
  /** Replace a stored record in place, as a newer build or a disk fault would. */
  tamper(key: string, value: unknown): void
  usedBytes(databaseName?: string): number
  /** Refuse the next `count` writes with a non-quota transaction failure. */
  failNextWrites(count: number): void
  /** Refuse the next `count` writes of one specific record. */
  failNextWritesOf(key: string, count: number): void
  failNextReads(count: number): void
  /** Bytes this origin may store. Defaults to far more than any test needs. */
  setQuota(bytes: number): void
  /**
   * Simulate a newer build of the app having upgraded the database, including
   * the `versionchange` notification a live connection would receive.
   */
  upgradeDatabase(databaseName: string, version: number): void
}

const DEFAULT_STORE = 'records'

export function createFakeIndexedDb(): FakeIndexedDb {
  const databases = new Map<string, FakeDatabaseState>()

  const sizeOf = (value: unknown): number => (value === undefined ? 0 : JSON.stringify(value)?.length ?? 0)
  const usedBytes = (databaseName?: string): number => {
    let total = 0
    for (const [name, state] of databases) {
      if (databaseName !== undefined && name !== databaseName) continue
      for (const store of state.stores.values()) {
        for (const value of store.values()) total += sizeOf(value)
      }
    }
    return total
  }

  const control: FakeIndexedDbControl = {
    quota: 2_000_000_000,
    failWrites: 0,
    failReads: 0,
    failKeys: new Map(),
    usedBytes: () => usedBytes(),
    sizeOf,
  }

  const factory = {
    open(name: string, version: number) {
      const request = new FakeRequest<FakeDatabase>() as FakeRequest<FakeDatabase> & {
        onupgradeneeded: ((event: unknown) => void) | null
        onblocked: ((event: unknown) => void) | null
      }
      request.onupgradeneeded = null
      request.onblocked = null
      queueMicrotask(() => {
        const existing = databases.get(name)
        if (existing && existing.version > version) {
          request.error = fail('VersionError', 'The requested version is less than the existing version.')
          request.onerror?.({ target: request })
          return
        }
        const state: FakeDatabaseState =
          existing ?? { version: 0, stores: new Map(), connections: new Set() }
        databases.set(name, state)
        const database = new FakeDatabase(state, control)
        request.result = database
        if (state.version < version) {
          state.version = version
          request.onupgradeneeded?.({ target: request })
        }
        request.onsuccess?.({ target: request })
      })
      return request
    },
  }

  return {
    factory: factory as unknown as IDBFactory,
    storageManager: {
      estimate: async () => ({ usage: usedBytes(), quota: control.quota }),
    },
    records(databaseName) {
      const merged = new Map<string, unknown>()
      for (const [name, state] of databases) {
        if (databaseName !== undefined && name !== databaseName) continue
        for (const store of state.stores.values()) {
          for (const [key, value] of store) merged.set(key, value)
        }
      }
      return merged
    },
    tamper(key, value) {
      for (const state of databases.values()) {
        for (const store of state.stores.values()) {
          if (store.has(key)) store.set(key, value)
        }
      }
    },
    usedBytes,
    failNextWrites(count) { control.failWrites = count },
    failNextWritesOf(key, count) { control.failKeys.set(key, count) },
    failNextReads(count) { control.failReads = count },
    setQuota(bytes) { control.quota = bytes },
    upgradeDatabase(databaseName, version) {
      const state = databases.get(databaseName) ?? { version: 0, stores: new Map(), connections: new Set() }
      databases.set(databaseName, state)
      for (const connection of [...state.connections]) connection.notifyVersionChange()
      state.version = version
      if (!state.stores.has(DEFAULT_STORE)) state.stores.set(DEFAULT_STORE, new Map())
    },
  }
}

import {
  act,
  createElement,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APP_STATE_IMPORT_EVENT,
  importBackup,
  saveAppState,
  waitForAppStatePersistence,
} from '../appState'
import { defaultAppState } from '../migration'
import { toWireProfile } from '../portableProfile'
import type { AppState } from '../types'
import {
  beginConfirmedImportInvalidation,
  claimLocalData,
  householdMetaPrefixForTests,
  legacySyncKeysForTests,
  listOwnershipTransitions,
  loadHouseholdMeta,
  saveHouseholdMeta,
  transitionPrefixForTests,
} from './config'
import {
  leaseStorageKeyForTests,
  setFinalizationStageHookForTests,
} from './coordination'
import { finalizationGuardForTestSetup } from './finalizationGuard.test-helper'
import {
  DATASET_PROVENANCE_STORAGE_KEY,
  datasetFingerprint,
  ensureDatasetProvenance,
  readDatasetProvenance,
} from './provenance'
import type {
  CloudPullResult,
  CloudPushResult,
  RemoteProfileRow,
} from './types'

const transport = vi.hoisted(() => {
  type AuthListener = (event: string, session: unknown) => void
  return {
    sessionUser: null as null | { id: string; email: string },
    authListeners: new Set<AuthListener>(),
    authContextOverride: null as null | (() => Promise<unknown>),
    mutationIds: [] as string[],
    pull: vi.fn<() => Promise<CloudPullResult>>(),
    push: vi.fn<() => Promise<CloudPushResult>>(),
  }
})

vi.mock('./supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./supabase')>()
  const session = () =>
    transport.sessionUser
      ? {
          user: transport.sessionUser,
          access_token: 'header.payload.signature',
        }
      : null
  return {
    ...actual,
    getCurrentSession: vi.fn(async () => session()),
    onAuthSessionChange: vi.fn(
      (listener: (event: string, nextSession: unknown) => void) => {
        transport.authListeners.add(listener)
        return () => transport.authListeners.delete(listener)
      },
    ),
    getVerifiedAuthContext: vi.fn(async (_client?: unknown, signal?: AbortSignal) => {
      if (transport.authContextOverride) {
        const pending = transport.authContextOverride()
        if (!signal) return pending
        if (signal.aborted) return null
        return new Promise((resolve) => {
          const aborted = () => resolve(null)
          signal.addEventListener('abort', aborted, { once: true })
          void pending.then((value) => {
            signal.removeEventListener('abort', aborted)
            resolve(signal.aborted ? null : value)
          })
        })
      }
      return transport.sessionUser
        ? {
            user: transport.sessionUser,
            accessToken: 'header.payload.signature',
            verifiedAt: Date.now(),
            kind: 'supabase-access-token' as const,
          }
        : null
    }),
    getVerifiedCurrentUser: vi.fn(async () => transport.sessionUser),
    verifyPinnedAuthContext: vi.fn(
      async (context: { user?: { id?: string } }, expected: string) =>
        transport.sessionUser?.id === expected &&
        context?.user?.id === expected,
    ),
    pullProfiles: vi.fn(async () => transport.pull()),
    pushProfiles: vi.fn(
      async (
        _rows: RemoteProfileRow[],
        _revision: string,
        mutationId: string,
      ) => {
        transport.mutationIds.push(mutationId)
        return transport.push()
      },
    ),
    signOutRemote: vi.fn(async () => {
      transport.sessionUser = null
      for (const listener of transport.authListeners) {
        listener('SIGNED_OUT', null)
      }
    }),
    signInWithPassword: vi.fn(async (email: string) => {
      const user = { id: 'household-a', email }
      transport.sessionUser = user
      return { ok: true as const, user }
    }),
  }
})

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
    this.values.set(key, String(value))
  }
}

class TestLocks {
  private tails = new Map<string, Promise<unknown>>()
  private active = new Set<string>()

  request<T>(
    name: string,
    options: { mode: 'exclusive'; ifAvailable?: true },
    callback: (lock: unknown | null) => T | Promise<T>,
  ): Promise<T> {
    if (options.ifAvailable && this.active.has(name)) {
      return Promise.resolve(callback(null))
    }
    const prior = this.tails.get(name) ?? Promise.resolve()
    const run = prior.then(async () => {
      this.active.add(name)
      try {
        return await callback({ name })
      } finally {
        this.active.delete(name)
      }
    })
    this.tails.set(
      name,
      run.catch(() => undefined),
    )
    return run
  }
}

class FakeElement extends EventTarget {
  nodeType = 1
  nodeName: string
  tagName: string
  namespaceURI = 'http://www.w3.org/1999/xhtml'
  ownerDocument!: FakeDocument
  parentNode: FakeElement | null = null
  childNodes: FakeElement[] = []
  textContent = ''
  style = {}
  private attributes = new Map<string, string>()

  constructor(tag = 'div') {
    super()
    this.nodeName = tag.toUpperCase()
    this.tagName = tag.toUpperCase()
  }
  appendChild(child: FakeElement) {
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child)
    else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild(child: FakeElement) {
    this.childNodes = this.childNodes.filter((item) => item !== child)
    child.parentNode = null
    return child
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }
  removeAttribute(name: string) {
    this.attributes.delete(name)
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }
  get firstChild() {
    return this.childNodes[0] ?? null
  }
}

class FakeDocument extends EventTarget {
  nodeType = 9
  nodeName = '#document'
  documentElement: FakeElement
  body: FakeElement
  defaultView!: EventTarget & Record<string, unknown>
  activeElement: FakeElement

  constructor() {
    super()
    this.documentElement = new FakeElement('html')
    this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this
    this.body.ownerDocument = this
    this.activeElement = this.body
  }
  createElement(tag: string) {
    const element = new FakeElement(tag)
    element.ownerDocument = this
    return element
  }
  createTextNode(text: string) {
    const node = new FakeElement('#text')
    node.nodeType = 3
    node.nodeName = '#text'
    node.textContent = text
    node.ownerDocument = this
    return node
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function pauseFinalizerAt(stage: string) {
  const entered = deferred<void>()
  const release = deferred<void>()
  let paused = false
  setFinalizationStageHookForTests(async (currentStage) => {
    if (paused || currentStage !== stage) return
    paused = true
    entered.resolve(undefined)
    await release.promise
  })
  return {
    entered: entered.promise,
    release: () => release.resolve(undefined),
  }
}

function rowFor(state: AppState, id = 'p1'): RemoteProfileRow {
  return {
    profile_id: id,
    data: toWireProfile(state.profiles[id]),
    updated_at: '2026-07-25T12:00:00.000Z',
  }
}

function emitAuth(event: string, user: { id: string; email: string } | null) {
  transport.sessionUser = user
  const session = user
    ? { user, access_token: 'header.payload.signature' }
    : null
  for (const listener of transport.authListeners) listener(event, session)
}

function storageEvent(key: string): Event {
  const event = new Event('storage') as Event & { key: string }
  Object.defineProperty(event, 'key', { value: key })
  return event
}

describe('mounted useSync lifecycle and import safety', () => {
  let windowTarget: EventTarget & Record<string, unknown>
  let documentTarget: FakeDocument
  let online = true
  let latestApi: ReturnType<typeof import('./useSync')['useSync']> | null
  let updateHostState: Dispatch<SetStateAction<AppState>> | null
  let root: import('react-dom/client').Root | null
  let renderedState: AppState | null

  beforeEach(() => {
    setFinalizationStageHookForTests(null)
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-public-key')
    ;(globalThis as unknown as { localStorage: Storage }).localStorage =
      new MemStorage()
    documentTarget = new FakeDocument()
    windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget,
      setTimeout,
      clearTimeout,
      HTMLElement: FakeElement,
      HTMLIFrameElement: class {},
      getSelection: () => null,
      location: { protocol: 'test:' },
    }) as unknown as EventTarget & Record<string, unknown>
    windowTarget.top = windowTarget
    windowTarget.self = windowTarget
    documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', {
      get onLine() {
        return online
      },
      userAgent: 'Vitest',
      locks: new TestLocks(),
    })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    transport.sessionUser = null
    transport.authListeners.clear()
    transport.authContextOverride = null
    transport.mutationIds = []
    transport.pull.mockReset()
    transport.pull.mockResolvedValue({ ok: true, rows: [], revision: '0' })
    transport.push.mockReset()
    transport.push.mockResolvedValue({ ok: true, revision: '1' })
    latestApi = null
    updateHostState = null
    root = null
    renderedState = null
    online = true
  })

  afterEach(async () => {
    setFinalizationStageHookForTests(null)
    if (root) {
      await act(async () => root?.unmount())
    }
    await waitForAppStatePersistence()
    expect(transport.authListeners.size).toBe(0)
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  async function prepareState(
    householdId: string | null,
    state = defaultAppState(),
    dirty = false,
  ) {
    localStorage.setItem('homeschool-hq:app:v2', JSON.stringify(state))
    await ensureDatasetProvenance()
    if (householdId) {
      const meta = await claimLocalData(
        householdId,
        `${householdId}@example.com`,
        {
          ...loadHouseholdMeta(householdId),
          profiles: dirty
            ? { p1: { updatedAt: Date.now(), dirty: true } }
            : {},
          reconciliation: 'ready',
        },
        await datasetFingerprint(state),
        finalizationGuardForTestSetup(householdId),
      )
      saveHouseholdMeta(meta)
    }
    return state
  }

  async function mount(initialState: AppState) {
    const { useSync } = await import('./useSync')
    const { createRoot } = await import('react-dom/client')

    function Host() {
      const [state, setState] = useState(initialState)
      renderedState = state
      useEffect(() => {
        void saveAppState(state)
      }, [state])
      latestApi = useSync(state, setState)
      updateHostState = setState
      return null
    }

    const container = documentTarget.createElement('div')
    root = createRoot(container as unknown as Element)
    await act(async () => {
      root!.render(createElement(Host))
      await Promise.resolve()
    })
    await settle()
  }

  async function settle() {
    await act(async () => {
      await Promise.resolve()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
    })
  }

  async function waitFor(check: () => boolean, timeoutMs = 5_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (check()) return
      await settle()
    }
    throw new Error(
      `Mounted sync condition was not reached (pulls=${transport.pull.mock.calls.length}, pushes=${transport.push.mock.calls.length}, error=${latestApi?.status.error ?? 'none'}, lease=${localStorage.getItem(leaseStorageKeyForTests(transport.sessionUser?.id ?? 'household-a')) ?? 'none'}).`,
    )
  }

  async function openEmptyCloudDecision(state: AppState, householdId = 'household-a') {
    transport.sessionUser = {
      id: householdId,
      email: `${householdId}@example.com`,
    }
    await prepareState(null, state)
    await mount(state)
    await waitFor(() => latestApi?.status.decision?.cloud === 'empty')
  }

  async function openCloudDataDecision(
    state: AppState,
    cloudState: AppState,
    householdId = 'household-a',
  ) {
    transport.sessionUser = {
      id: householdId,
      email: `${householdId}@example.com`,
    }
    transport.pull.mockResolvedValue({
      ok: true,
      rows: [rowFor(cloudState)],
      revision: '1',
    })
    await prepareState(null, state)
    await mount(state)
    await waitFor(() => latestApi?.status.decision?.cloud === 'data')
  }

  async function expectFinalizedReplacement(
    householdId: string,
    expectedState: AppState,
  ) {
    const persisted = JSON.parse(
      localStorage.getItem('homeschool-hq:app:v2')!,
    ) as AppState
    const fingerprint = await datasetFingerprint(expectedState)
    expect(await datasetFingerprint(persisted)).toBe(fingerprint)
    expect(await datasetFingerprint(renderedState!)).toBe(fingerprint)
    expect(readDatasetProvenance()).toMatchObject({
      fingerprint,
      importTransition: null,
    })
    expect(loadHouseholdMeta(householdId)).toMatchObject({
      binding: 'bound',
      ownsLocalData: true,
      datasetFingerprint: fingerprint,
      reconciliation: 'ready',
    })
    expect(listOwnershipTransitions()).toEqual([])
    expect(latestApi?.status.decision).toBeNull()
    expect(latestApi?.status.error).toBeNull()
  }

  it('successfully finalizes an ordinary use-cloud replacement', async () => {
    const local = defaultAppState()
    const cloud = structuredClone(local)
    cloud.profiles.p1.name = 'Cloud student'
    await openCloudDataDecision(local, cloud)

    await act(async () => latestApi!.useCloud())

    await expectFinalizedReplacement('household-a', {
      ...local,
      profiles: { p1: cloud.profiles.p1 },
      activeProfileId: 'p1',
    })
  })

  it('successfully finalizes a parent-reviewed merge', async () => {
    const local = defaultAppState()
    local.profiles.p1.name = 'Local student'
    const cloud = defaultAppState()
    cloud.profiles.p1.name = 'Cloud student'
    transport.push.mockResolvedValue({ ok: true, revision: '2' })
    await openCloudDataDecision(local, cloud)

    await act(async () =>
      latestApi!.applyReviewedMerge({ p1: 'cloud' }),
    )

    const expected = structuredClone(local)
    expected.profiles.p1 = cloud.profiles.p1
    await expectFinalizedReplacement('household-a', expected)
    expect(loadHouseholdMeta('household-a').cloudRevision).toBe('2')
  })

  it('successfully finalizes an automatic cloud-only replacement', async () => {
    const local = defaultAppState()
    local.profiles = {}
    local.activeProfileId = null
    const cloud = defaultAppState()
    cloud.profiles = { p1: cloud.profiles.p1 }
    cloud.activeProfileId = 'p1'
    transport.sessionUser = {
      id: 'household-a',
      email: 'household-a@example.com',
    }
    transport.pull.mockResolvedValue({
      ok: true,
      rows: [rowFor(cloud)],
      revision: '1',
    })
    await prepareState('household-a', local)
    await mount(local)
    await waitFor(
      () =>
        loadHouseholdMeta('household-a').ownsLocalData &&
        renderedState?.profiles.p1 !== undefined,
    )

    await expectFinalizedReplacement('household-a', {
      ...local,
      profiles: { p1: cloud.profiles.p1 },
      activeProfileId: null,
    })
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('keeps local data unbound and refreshes review after another device wins CAS', async () => {
    const local = defaultAppState()
    await openEmptyCloudDecision(local)
    const newerCloud = structuredClone(local)
    newerCloud.profiles.p1.name = 'Other device student'
    transport.pull
      .mockResolvedValueOnce({ ok: true, rows: [], revision: '0' })
      .mockResolvedValueOnce({ ok: true, rows: [], revision: '0' })
      .mockResolvedValueOnce({
        ok: true,
        rows: [rowFor(newerCloud)],
        revision: '1',
      })
    transport.push.mockResolvedValueOnce({
      ok: false,
      conflict: true,
      revision: '1',
      error: 'Another device updated this household first.',
    })

    await expect(
      act(async () => latestApi!.uploadLocal()),
    ).rejects.toThrow('Another device')
    await waitFor(() => latestApi?.status.decision?.reason === 'conflict')

    expect(loadHouseholdMeta('household-a')).toMatchObject({
      binding: 'unbound',
      ownsLocalData: false,
      reconciliation: 'review',
      cloudRevision: '1',
    })
    expect(latestApi?.status.decision?.reason).toBe('conflict')
    expect(renderedState?.profiles.p1.name).toBe(local.profiles.p1.name)

    transport.pull
      .mockResolvedValueOnce({
        ok: true,
        rows: [rowFor(newerCloud)],
        revision: '1',
      })
      .mockResolvedValueOnce({
        ok: true,
        rows: [rowFor(newerCloud)],
        revision: '1',
      })
    transport.push.mockResolvedValueOnce({ ok: true, revision: '2' })
    await act(async () => latestApi!.applyReviewedMerge({ p1: 'local' }))
    expect(transport.mutationIds).toHaveLength(2)
    expect(transport.mutationIds[0]).not.toBe(transport.mutationIds[1])
    expect(transport.mutationIds[0]).toContain('academy-0-')
    expect(transport.mutationIds[1]).toContain('academy-1-')
    expect(loadHouseholdMeta('household-a')).toMatchObject({
      binding: 'bound',
      ownsLocalData: true,
      cloudRevision: '2',
    })
  })

  it('keeps an exact duplicate import durably unbound across remount', async () => {
    online = false
    const state = await prepareState('household-b')
    transport.sessionUser = {
      id: 'household-b',
      email: 'household-b@example.com',
    }
    await mount(state)
    const beforeEpoch = readDatasetProvenance()!.importEpoch
    const result = importBackup(state, JSON.stringify(state))
    if (!result.ok) throw new Error(result.error)
    await act(async () => updateHostState!(result.state))
    await settle()

    expect(readDatasetProvenance()!.importEpoch).not.toBe(beforeEpoch)
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
    expect(transport.push).not.toHaveBeenCalled()

    await act(async () => root!.unmount())
    root = null
    await mount(result.state)
    expect(loadHouseholdMeta('household-b').binding).toBe('unbound')
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('invalidates an activeProfileId-only import with an equal fingerprint', async () => {
    online = false
    const state = await prepareState('household-b')
    transport.sessionUser = {
      id: 'household-b',
      email: 'household-b@example.com',
    }
    await mount(state)
    const imported = { ...state, activeProfileId: 'p2' }
    expect(await datasetFingerprint(imported)).toBe(
      await datasetFingerprint(state),
    )
    const beforeEpoch = readDatasetProvenance()!.importEpoch
    const result = importBackup(state, JSON.stringify(imported))
    if (!result.ok) throw new Error(result.error)
    await act(async () => updateHostState!(result.state))
    await settle()

    expect(readDatasetProvenance()!.importEpoch).not.toBe(beforeEpoch)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('does not upload Household A backup while Household B is authenticated', async () => {
    online = false
    const state = await prepareState('household-b')
    transport.sessionUser = {
      id: 'household-b',
      email: 'household-b@example.com',
    }
    await mount(state)
    const imported = structuredClone(state)
    imported.profiles.p1.name = 'Household A student'
    const result = importBackup(state, JSON.stringify(imported))
    if (!result.ok) throw new Error(result.error)
    await act(async () => updateHostState!(result.state))
    await settle()

    expect(latestApi?.status.provenance).toBe('paused')
    expect(latestApi?.status.error).toContain('unbound')
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('blocks a mounted stale tab after another tab imports identical data', async () => {
    online = false
    const state = await prepareState('household-a')
    transport.sessionUser = {
      id: 'household-a',
      email: 'household-a@example.com',
    }
    await mount(state)

    beginConfirmedImportInvalidation('Another tab imported Academy data.')
    windowTarget.dispatchEvent(storageEvent(DATASET_PROVENANCE_STORAGE_KEY))
    await settle()
    await latestApi!.syncNow()

    expect(latestApi?.status.provenance).toBe('paused')
    expect(latestApi?.status.error).toContain('Another tab')
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('continuously removes legacy auth keys recreated by another tab', async () => {
    online = false
    const state = await prepareState(null)
    await mount(state)
    const officialKey = 'sb-example-auth-token'
    localStorage.setItem(officialKey, 'official-session')

    localStorage.setItem(legacySyncKeysForTests.session, 'stale-token')
    windowTarget.dispatchEvent(storageEvent(legacySyncKeysForTests.session))
    localStorage.setItem(legacySyncKeysForTests.meta, 'stale-meta')
    windowTarget.dispatchEvent(storageEvent(legacySyncKeysForTests.meta))

    expect(localStorage.getItem(legacySyncKeysForTests.session)).toBeNull()
    expect(localStorage.getItem(legacySyncKeysForTests.meta)).toBeNull()
    expect(localStorage.getItem(officialKey)).toBe('official-session')
  })

  it('keeps malformed optional Academy state local and blocks cloud mutation', async () => {
    const malformed = defaultAppState()
    ;(malformed.profiles.p1 as unknown as Record<string, unknown>).reading = {
      sessions: [{ wcpm: 'not-a-number' }],
      seenPassageIds: [],
      calibrations: [],
    }
    localStorage.setItem('homeschool-hq:app:v2', JSON.stringify(malformed))
    saveHouseholdMeta({
      ...loadHouseholdMeta('household-a', 'household-a@example.com'),
      binding: 'bound',
      ownsLocalData: true,
      datasetFingerprint: 'untrusted-fingerprint',
      importEpoch: 'untrusted-import-epoch',
    })
    transport.sessionUser = {
      id: 'household-a',
      email: 'household-a@example.com',
    }

    await mount(malformed)
    await act(async () => latestApi!.syncNow())

    expect(transport.push).not.toHaveBeenCalled()
    expect(loadHouseholdMeta('household-a').binding).toBe('unbound')
    expect(loadHouseholdMeta('household-a').pauseReason).toContain(
      'Local Academy data no longer matches',
    )
  })

  it('denies local finalization when import occurs during a pending write', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pending.promise)

    let upload!: Promise<void>
    let uploadObserved!: Promise<unknown>
    await act(async () => {
      upload = latestApi!.uploadLocal()
      uploadObserved = upload.catch((error) => error)
      await Promise.resolve()
    })
    await waitFor(() => transport.push.mock.calls.length === 1)
    const result = importBackup(state, JSON.stringify(state))
    if (!result.ok) throw new Error(result.error)
    await act(async () => updateHostState!(result.state))
    pending.resolve({ ok: true, revision: '1' })
    await expect(uploadObserved).resolves.toBeInstanceOf(Error)
    await settle()

    expect(loadHouseholdMeta('household-a').binding).toBe('unbound')
    expect(latestApi?.status.lastSyncAt).toBeNull()
  })

  it('denies local finalization after sign-out or account switch', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pendingSignOut = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pendingSignOut.promise)
    const uploadAfterSignOut = latestApi!.uploadLocal()
    const signOutObserved = uploadAfterSignOut.catch((error) => error)
    await waitFor(() => transport.push.mock.calls.length === 1)
    await act(async () => {
      await latestApi!.signOut()
    })
    await settle()
    pendingSignOut.resolve({ ok: true, revision: '1' })
    await expect(signOutObserved).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)

    await act(async () => {
      emitAuth('SIGNED_IN', {
        id: 'household-a',
        email: 'household-a@example.com',
      })
    })
    await settle()
    await waitFor(() => latestApi?.status.decision?.cloud === 'empty')
    const pendingSwitch = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pendingSwitch.promise)
    const uploadAfterSwitch = latestApi!.uploadLocal()
    const switchObserved = uploadAfterSwitch.catch((error) => error)
    await waitFor(() => transport.push.mock.calls.length === 2)
    await act(async () => {
      emitAuth('SIGNED_IN', {
        id: 'household-b',
        email: 'household-b@example.com',
      })
    })
    pendingSwitch.resolve({ ok: true, revision: '1' })
    await expect(switchObserved).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
  })

  it('denies finalization when the canonical session switches before the auth callback', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pending.promise)
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await waitFor(() => transport.push.mock.calls.length === 1)

    // No auth listener is emitted: canonical verification must stand on its own.
    transport.sessionUser = {
      id: 'household-b',
      email: 'household-b@example.com',
    }
    pending.resolve({ ok: true, revision: '1' })

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
  })

  it('allows a same-household token refresh during an active mutation without duplicating inspection', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pullsBefore = transport.pull.mock.calls.length
    const pending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pending.promise)
    const upload = latestApi!.uploadLocal()
    await waitFor(() => transport.push.mock.calls.length === 1)

    emitAuth('TOKEN_REFRESHED', {
      id: 'household-a',
      email: 'refreshed@example.com',
    })
    pending.resolve({ ok: true, revision: '1' })

    await expect(upload).resolves.toBeUndefined()
    expect(transport.pull).toHaveBeenCalledTimes(pullsBefore + 2)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(true)
  })

  it('does not commit after unmount during pull or push', async () => {
    const pullPending = deferred<CloudPullResult>()
    transport.pull.mockImplementationOnce(() => pullPending.promise)
    const state = defaultAppState()
    transport.sessionUser = {
      id: 'household-a',
      email: 'household-a@example.com',
    }
    await prepareState(null, state)
    await mount(state)
    await act(async () => root!.unmount())
    root = null
    pullPending.resolve({ ok: true, rows: [], revision: '0' })
    await settle()
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)

    await openEmptyCloudDecision(state)
    const pushPending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pushPending.promise)
    const upload = latestApi!.uploadLocal()
    await waitFor(() => transport.push.mock.calls.length === 1)
    await act(async () => root!.unmount())
    root = null
    pushPending.resolve({ ok: true, revision: '1' })
    await expect(upload).rejects.toThrow()
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
  })

  it('does not duplicate inspection on same-user token refresh', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pullsBefore = transport.pull.mock.calls.length
    emitAuth('TOKEN_REFRESHED', {
      id: 'household-a',
      email: 'household-a@example.com',
    })
    await settle()
    expect(transport.pull).toHaveBeenCalledTimes(pullsBefore)
  })

  it('allows only one simultaneous decision operation', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pending.promise)
    const first = latestApi!.uploadLocal()
    await waitFor(() => transport.push.mock.calls.length === 1)
    const second = latestApi!.uploadLocal()
    await expect(second).rejects.toThrow('already in progress')
    pending.resolve({ ok: true, revision: '1' })
    await expect(first).resolves.toBeUndefined()
    expect(transport.push).toHaveBeenCalledOnce()
  })

  it('aborts a hung authorization wait and ignores its late completion', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const authStarted = deferred<void>()
    const lateAuth = deferred<unknown>()
    transport.authContextOverride = () => {
      authStarted.resolve(undefined)
      return lateAuth.promise
    }
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await authStarted.promise

    await act(async () => latestApi!.signOut())
    await expect(observed).resolves.toBeInstanceOf(Error)
    lateAuth.resolve({
      user: { id: 'household-a', email: 'household-a@example.com' },
      accessToken: 'header.payload.signature',
      verifiedAt: Date.now(),
      kind: 'supabase-access-token',
    })
    await settle()

    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(localStorage.getItem(leaseStorageKeyForTests('household-a'))).toBeNull()
  })

  it('blocks mutation after another-tab binding change', async () => {
    online = false
    const state = await prepareState('household-a')
    transport.sessionUser = {
      id: 'household-a',
      email: 'household-a@example.com',
    }
    await mount(state)
    saveHouseholdMeta({
      ...loadHouseholdMeta('household-a'),
      binding: 'unbound',
      ownsLocalData: false,
      datasetFingerprint: null,
      importEpoch: null,
      pauseReason: 'Another tab changed the binding.',
    })
    windowTarget.dispatchEvent(
      storageEvent(`${householdMetaPrefixForTests}household-a`),
    )
    await settle()
    await latestApi!.syncNow()
    expect(latestApi?.status.provenance).toBe('paused')
    expect(transport.push).not.toHaveBeenCalled()
  })

  it('blocks before dispatch when import epoch changes after lease acquisition', async () => {
    const state = defaultAppState()
    let pulls = 0
    transport.pull.mockImplementation(async () => {
      pulls += 1
      if (pulls === 3) {
        beginConfirmedImportInvalidation('Another tab imported data.')
      }
      return { ok: true, rows: [], revision: '0' }
    })
    await openEmptyCloudDecision(state)
    await expect(latestApi!.uploadLocal()).rejects.toThrow()
    expect(transport.push).not.toHaveBeenCalled()
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
  })

  it('denies post-response commit after lease loss', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pending = deferred<CloudPushResult>()
    transport.push.mockImplementationOnce(() => pending.promise)
    const upload = latestApi!.uploadLocal()
    await waitFor(() => transport.push.mock.calls.length === 1)
    localStorage.removeItem(leaseStorageKeyForTests('household-a'))
    pending.resolve({ ok: true, revision: '1' })
    await expect(upload).rejects.toThrow()
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
  })

  it('blocks ownership when sign-out occurs inside claim finalization', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    await act(async () => latestApi!.signOut())
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(latestApi?.status.lastSyncAt).toBeNull()
  })

  it('blocks Household A finalization after switching to Household B', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    await act(async () => {
      emitAuth('SIGNED_IN', {
        id: 'household-b',
        email: 'household-b@example.com',
      })
    })
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(loadHouseholdMeta('household-b').ownsLocalData).toBe(false)
  })

  it('does not persist or publish replacement after unmount during finalization', async () => {
    const state = defaultAppState()
    const cloud = structuredClone(state)
    cloud.profiles.p1.name = 'Cloud student'
    await openCloudDataDecision(state, cloud)
    const pause = pauseFinalizerAt(
      'Ownership transition rechecked replacement data',
    )
    const replacement = latestApi!.useCloud()
    const observed = replacement.catch((cause) => cause)
    await pause.entered

    await act(async () => root!.unmount())
    root = null
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(
      JSON.parse(localStorage.getItem('homeschool-hq:app:v2')!).profiles.p1
        .name,
    ).toBe(state.profiles.p1.name)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
  })

  it('blocks ownership when the lease is lost inside claim finalization', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    localStorage.removeItem(leaseStorageKeyForTests('household-a'))
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(loadHouseholdMeta('household-a').profiles).toEqual({})
  })

  it('blocks ownership when import epoch changes inside claim finalization', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    const result = importBackup(state, JSON.stringify(state))
    if (!result.ok) throw new Error(result.error)
    await act(async () => updateHostState!(result.state))
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').binding).toBe('unbound')
    expect(transport.push).toHaveBeenCalledOnce()
  })

  it('blocks ownership when the operation is aborted inside finalization', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    windowTarget.dispatchEvent(new Event(APP_STATE_IMPORT_EVENT))
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
  })

  it('blocks an old finalizer after a newer operation becomes current', async () => {
    const state = defaultAppState()
    await openEmptyCloudDecision(state)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const upload = latestApi!.uploadLocal()
    const observed = upload.catch((cause) => cause)
    await pause.entered

    await act(async () => latestApi!.signOut())
    const newerPull = deferred<CloudPullResult>()
    transport.pull.mockImplementationOnce(() => newerPull.promise)
    await act(async () => {
      emitAuth('SIGNED_IN', {
        id: 'household-a',
        email: 'household-a@example.com',
      })
    })
    await waitFor(() => transport.pull.mock.calls.length >= 4)
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    newerPull.resolve({ ok: true, rows: [], revision: '0' })
    await settle()
  })

  it('does not clear or finalize a superseded ownership transition', async () => {
    const state = defaultAppState()
    const cloud = structuredClone(state)
    cloud.profiles.p1.name = 'Cloud student'
    await openCloudDataDecision(state, cloud)
    const pause = pauseFinalizerAt(
      'Ownership claim prepared for durable commit',
    )
    const replacement = latestApi!.useCloud()
    const observed = replacement.catch((cause) => cause)
    await pause.entered

    const transitionKey = Array.from(
      { length: localStorage.length },
      (_, index) => localStorage.key(index),
    ).find((key) =>
      key?.startsWith(`${transitionPrefixForTests}household-a:`),
    )!
    const transition = JSON.parse(localStorage.getItem(transitionKey)!)
    localStorage.setItem(
      transitionKey,
      JSON.stringify({
        ...transition,
        operationId: 'replacement-transition-operation',
      }),
    )
    pause.release()

    await expect(observed).resolves.toBeInstanceOf(Error)
    expect(loadHouseholdMeta('household-a').ownsLocalData).toBe(false)
    expect(JSON.parse(localStorage.getItem(transitionKey)!).operationId).toBe(
      'replacement-transition-operation',
    )
  })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'
import type { StudySessionGrant } from './study/contracts/identity/session'
import { readLocalSafetyStops } from './study/safety/localStopLedger'

// STUDY-A1-PROD-SEAM, asserted against the running App.
//
// Three defects, all of which become live the moment a production Study host
// surface is composed:
//
//  1. The App owned TWO StudyLifecycleBoundary objects — a bare one handed to the
//     verified production runtime, and a second minted for the host surfaces. Two
//     boundaries are two authorities: the epoch a production launch begins and
//     the epoch a production host surface would join could never be the same
//     epoch, and cancelling one left the other running.
//  2. Study authorization-failure recovery cleared the session through
//     `identity.clear()`, which empties the App's session transport only through
//     the invalidation notice the identity client emits IF it is still holding a
//     reference — so whether the recovery emptied anything at all depended on
//     identity-client state the App does not control.
//  3. A boundary that cancels itself (grant expired, feature off) has a null
//     binding, and the host seam was keyed on that binding — so every ordinary
//     re-render minted a new seam object, which is a new prop identity for the
//     route and the container, whose effects re-run and whose cleanup cancels the
//     epoch as `navigation-away`. (Covered directly in
//     src/study/composition/hostStudyLifecycle.test.ts.)

const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

const counters = vi.hoisted(() => ({
  /** Every boundary the App reached through the one-boundary accessor. */
  hostBoundaries: [] as unknown[],
  /** The boundary each verified runtime adapter was constructed with. */
  runtimeLifecycles: [] as unknown[],
  hostSeams: [] as unknown[],
  currentSeams: [] as unknown[],
  lifecycleInstances: [] as unknown[],
  identityClients: [] as unknown[],
  lifecycles: 0,
  identities: 0,
  readinessInvalidations: 0,
  /** Ordered recovery trace: session authority, then epoch, then runtime. */
  events: [] as string[],
  mountedPortDeps: [] as Array<Record<string, unknown> | undefined>,
  requestedUrls: [] as string[],
}))

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  syncUser: null as null | { id: string; email: string },
}))

vi.mock('./study/composition/hostStudyLifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/composition/hostStudyLifecycle')>()
  const traced = new WeakSet<object>()
  return {
    ...actual,
    hostStudyLifecycleBoundary: (owner: object) => {
      const boundary = actual.hostStudyLifecycleBoundary(owner)
      if (!traced.has(boundary)) {
        traced.add(boundary)
        counters.hostBoundaries.push(boundary)
        const cancel = boundary.cancel.bind(boundary)
        boundary.cancel = (reason) => {
          counters.events.push(`epoch-cancel:${reason}`)
          cancel(reason)
        }
      }
      return boundary
    },
    createHostStudyLifecycleSeam: (owner: object, binding: Parameters<typeof actual.createHostStudyLifecycleSeam>[1]) => {
      const seam = actual.createHostStudyLifecycleSeam(owner, binding)
      counters.hostSeams.push(seam)
      return seam
    },
    currentHostStudyLifecycleSeam: (owner: object) => {
      const seam = actual.currentHostStudyLifecycleSeam(owner)
      counters.currentSeams.push(seam)
      return seam
    },
  }
})

vi.mock('./study/production/verifiedRuntimeAdapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/production/verifiedRuntimeAdapter')>()
  return {
    ...actual,
    createVerifiedStudyRuntimeAdapter: (
      options: Parameters<typeof actual.createVerifiedStudyRuntimeAdapter>[0],
    ) => {
      counters.runtimeLifecycles.push(options.lifecycle)
      const adapter = actual.createVerifiedStudyRuntimeAdapter(options)
      return Object.freeze({
        ...adapter,
        cancel: (reason: Parameters<typeof adapter.cancel>[0]) => {
          counters.events.push(`runtime-cancel:${reason}`)
          return adapter.cancel(reason)
        },
      })
    },
  }
})

vi.mock('./study/client/studySessionLifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studySessionLifecycle')>()
  return {
    ...actual,
    createStudySessionLifecycle: (deps: Parameters<typeof actual.createStudySessionLifecycle>[0] = {}) => {
      counters.lifecycles += 1
      const lifecycle = actual.createStudySessionLifecycle(deps)
      const observed = Object.freeze({
        ...lifecycle,
        clear(reason: Parameters<typeof lifecycle.clear>[0]) {
          counters.events.push(`session-clear:${reason}`)
          lifecycle.clear(reason)
        },
      })
      counters.lifecycleInstances.push(observed)
      return observed
    },
  }
})

vi.mock('./study/client/studyIdentityClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studyIdentityClient')>()
  return {
    ...actual,
    createStudyIdentityClient: (
      fetchImpl?: typeof fetch,
      deps?: Parameters<typeof actual.createStudyIdentityClient>[1],
    ) => {
      counters.identities += 1
      const client = actual.createStudyIdentityClient(fetchImpl, deps)
      counters.identityClients.push(client)
      return client
    },
  }
})

vi.mock('./study/client/studyProductionReadinessClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studyProductionReadinessClient')>()
  const ready = () => Object.freeze({
    schemaVersion: 1 as const,
    status: 'ready' as const,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  })
  return {
    ...actual,
    createStudyProductionReadinessClient: () => Object.freeze({
      read: async () => ready(),
      revalidate: async () => ready(),
      invalidate: () => { counters.readinessInvalidations += 1 },
    }),
  }
})

vi.mock('./study/mountedPorts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/mountedPorts')>()
  return {
    ...actual,
    createMountedStudyPorts: (deps?: Parameters<typeof actual.createMountedStudyPorts>[0]) => {
      counters.mountedPortDeps.push(deps as Record<string, unknown> | undefined)
      return actual.createMountedStudyPorts(deps)
    },
  }
})

vi.mock('./sync/useSync', () => ({
  useSync: () => ({
    status: { user: harness.syncUser, binding: 'bound', provenance: 'verified' },
  }),
}))
vi.mock('./components/Picker', () => ({
  Picker: (props: { onPick: (id: string) => void; onGrownUps: () => void }) => {
    harness.picker = props
    harness.pin = null
    return <main data-surface="picker">Who's learning today?</main>
  },
}))
vi.mock('./components/PinPad', () => ({
  PinPad: (props: { title: string; onComplete: (pin: string) => string | null; onCancel: () => void }) => {
    harness.picker = null
    harness.pin = props
    return <main data-surface="pin">{props.title}</main>
  },
}))
vi.mock('./components/hub/ParentHub', () => ({
  ParentHub: () => <main data-surface="parent-hub">Parent Hub</main>,
}))
vi.mock('./tutor/gatewayAuth', () => ({
  getGatewayAccessToken: async () => 'header.payload.signature',
  getGatewayAccessTokenWith: async () => 'header.payload.signature',
}))
vi.mock('./tutor/voice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tutor/voice')>()),
  purgeVoiceCache: async () => {},
}))

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
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
  constructor(tag = 'div') { super(); this.nodeName = tag.toUpperCase(); this.tagName = tag.toUpperCase() }
  appendChild(child: FakeElement) { child.parentNode = this; this.childNodes.push(child); return child }
  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child); else this.childNodes.splice(index, 0, child)
    return child
  }
  removeChild(child: FakeElement) { this.childNodes = this.childNodes.filter((item) => item !== child); child.parentNode = null; return child }
  setAttribute(name: string, value: string) { this.attributes.set(name, String(value)) }
  removeAttribute(name: string) { this.attributes.delete(name) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  focus() { this.ownerDocument.activeElement = this }
  get firstChild() { return this.childNodes[0] ?? null }
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
    this.documentElement = new FakeElement('html'); this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this; this.body.ownerDocument = this; this.activeElement = this.body
  }
  createElement(tag: string) { const e = new FakeElement(tag); e.ownerDocument = this; return e }
  createElementNS(_ns: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const e = this.createElement('#text'); e.nodeType = 3; e.nodeName = '#text'; e.textContent = value; return e }
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

function tags(node: FakeElement, tag: string): FakeElement[] {
  return [...(node.tagName === tag ? [node] : []), ...node.childNodes.flatMap((child) => tags(child, tag))]
}

function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

function reactProps(node: FakeElement): Record<string, never> {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, Record<string, never>>)[key]!
}

function seeded(active: string | null): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin: '1234' }
  state.profiles.p2 = { ...state.profiles.p2, name: 'Riley', pin: '2222' }
  state.activeProfileId = active
  return state
}

function issuedGrant(): StudySessionGrant {
  return {
    schemaVersion: 1,
    status: 'issued',
    sessionReference: SESSION_REFERENCE,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  }
}

/** The Study identity endpoints, served so a production launch really completes. */
function studyFetch(url: unknown) {
  const target = String(url)
  counters.requestedUrls.push(target)
  const body = target.includes('/session/issue')
    ? issuedGrant()
    : target.includes('/session/verify')
      ? { schemaVersion: 1, status: 'verified', expiresAt: new Date(Date.now() + 30_000).toISOString() }
      : target.includes('/academic-runtime')
        ? { schemaVersion: 1, status: 'ok', operation: 'dashboard:read', body: {} }
        : null
  return Promise.resolve({
    ok: body !== null,
    status: body !== null ? 200 : 404,
    json: async () => body,
  })
}

type SeamLike = {
  boundary: {
    binding: unknown
    lastReason: string | null
    token(): { isCurrent(): boolean; epoch: number }
  }
  binding: unknown
}
type SessionLifecycleLike = {
  install(grant: StudySessionGrant): void
  hasSession(): boolean
  lastClearReason(): string | null
  authorization: { authorizeStudyRequestHeaders(headers: Record<string, string>): unknown }
}

describe('App Study production seam (STUDY-A1-PROD-SEAM)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let pathname: string

  function useMode(mode: 'production' | 'preview' | 'off') {
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', mode === 'off' ? 'false' : 'true')
    vi.stubEnv('VITE_STUDY_ENGINE_PREVIEW', mode === 'preview' ? 'true' : 'false')
  }

  beforeEach(() => {
    counters.hostBoundaries = []
    counters.runtimeLifecycles = []
    counters.hostSeams = []
    counters.currentSeams = []
    counters.lifecycleInstances = []
    counters.identityClients = []
    counters.lifecycles = 0
    counters.identities = 0
    counters.readinessInvalidations = 0
    counters.events = []
    counters.mountedPortDeps = []
    counters.requestedUrls = []
    harness.picker = null
    harness.pin = null
    harness.syncUser = { id: 'household-a', email: 'household-a@example.com' }
    root = null
    pathname = '/'
    useMode('production')
    storage = new MemStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', studyFetch)
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
      location: { get pathname() { return pathname }, get href() { return `test:${pathname}` }, protocol: 'test:' },
      history: {
        pushState: (_s: unknown, _t: string, url: string) => { pathname = url },
        replaceState: (_s: unknown, _t: string, url: string) => { pathname = url },
      },
      localStorage: storage,
    }) as unknown as EventTarget & Record<string, unknown>
    windowTarget.top = windowTarget
    windowTarget.self = windowTarget
    documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', { onLine: false, userAgent: 'Vitest' })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 8; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  async function waitFor(check: () => boolean, what: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (check()) return
      await settle()
    }
    throw new Error(`Timed out waiting for ${what}.`)
  }

  async function mountApp(state: AppState) {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
    await settle()
  }

  async function rerenderApp(): Promise<void> {
    const App = (await import('./App')).default
    await act(async () => root?.render(<App />))
    await settle()
  }

  async function signIn(profileId: string, pin: string): Promise<void> {
    if (!harness.picker) throw new Error('The picker is not rendered.')
    await act(async () => { harness.picker!.onPick(profileId) })
    await settle()
    if (!harness.pin) throw new Error('The PIN pad is not rendered.')
    await act(async () => { harness.pin!.onComplete(pin) })
    await settle()
  }

  async function signOut(): Promise<void> {
    const button = tags(container, 'BUTTON').find((node) => hasText(node, 'Sign out'))
    if (!button) throw new Error('No Sign out control is rendered.')
    await act(async () => {
      (reactProps(button) as unknown as { onClick: () => void }).onClick()
    })
    await settle()
  }

  /** Signed in, with the verified production launch completed. */
  async function mountLaunched(profileId = 'p1', pin = '1234') {
    await mountApp(seeded(null))
    await signIn(profileId, pin)
    await waitFor(
      () => counters.requestedUrls.some((url) => url.includes('/session/verify')),
      'the verified production launch',
    )
    await settle()
  }

  function hostBoundary() {
    expect(counters.hostBoundaries).toHaveLength(1)
    return counters.hostBoundaries[0] as SeamLike['boundary']
  }

  function sessionLifecycle(): SessionLifecycleLike {
    return counters.lifecycleInstances[0] as SessionLifecycleLike
  }

  describe('one lifecycle authority', () => {
    it('builds exactly one Study lifecycle boundary for the running app', async () => {
      await mountLaunched()
      expect(counters.hostBoundaries).toHaveLength(1)
      // And it is the very boundary the verified production runtime was built on,
      // rather than a second one minted alongside it.
      expect(counters.runtimeLifecycles).toHaveLength(1)
      expect(counters.runtimeLifecycles[0]).toBe(counters.hostBoundaries[0])
    })

    it('keeps one boundary across a sign-out and a different learner signing in', async () => {
      await mountLaunched()
      await signOut()
      await signIn('p2', '2222')
      await settle()
      expect(counters.hostBoundaries).toHaveLength(1)
      expect(counters.runtimeLifecycles).toHaveLength(1)
      // Still one session trio too — no second identity or session authority.
      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
    })
  })

  describe('the production launch begins the host epoch', () => {
    it('leaves the boundary unbound until the verified launch binds it', async () => {
      // Before any launch there is no epoch, so there is nothing for a future
      // production host surface to join and Study is unavailable, not unbound.
      await mountApp(seeded(null))
      expect(hostBoundary().binding).toBeNull()
      expect(counters.currentSeams.every((seam) => seam === null)).toBe(true)
    })

    it('hands a host surface the epoch that launch began', async () => {
      await mountLaunched()
      const seam = counters.currentSeams.at(-1) as SeamLike | null
      expect(seam).not.toBeNull()
      // One boundary: the seam a host surface would join IS the runtime's.
      expect(seam!.boundary).toBe(counters.runtimeLifecycles[0])
      expect(seam!.binding).toBe(seam!.boundary.binding)

      // And joining it is a no-op reuse of the launch epoch, not a second epoch.
      const { joinHostStudyLifecycle } = await import('./study/composition/hostStudyLifecycle')
      const launchToken = seam!.boundary.token()
      const joined = joinHostStudyLifecycle(seam as never)
      expect(joined.epoch).toBe(launchToken.epoch)
      expect(joined.isCurrent()).toBe(true)
      expect(launchToken.isCurrent()).toBe(true)
    })

    it('keeps one seam object while the launch epoch is unchanged', async () => {
      await mountLaunched()
      await rerenderApp()
      await rerenderApp()
      const produced = counters.currentSeams.filter((seam) => seam !== null)
      expect(produced.length).toBeGreaterThan(1)
      // Every render after the launch handed back the same object, so a future
      // host surface's effects never re-ran on an ordinary re-render.
      expect(new Set(produced).size).toBe(1)
    })
  })

  describe('authorization failure recovery', () => {
    beforeEach(() => { useMode('preview') })

    /** The App only wires the failure callback into the preview mounted ports. */
    async function mountWithFailureCallback() {
      await mountApp(seeded(null))
      await signIn('p1', '1234')
      await waitFor(() => counters.mountedPortDeps.length > 0, 'the mounted Study ports')
      return counters.mountedPortDeps.at(-1)!.onSessionAuthorizationFailure as (reason: string) => void
    }

    it('does not depend on the identity client still holding a reference', async () => {
      const onFailure = await mountWithFailureCallback()
      const lifecycle = sessionLifecycle()
      const identity = counters.identityClients[0] as { clear(): void; hasSession(): boolean }

      // A session is installed in the transport while the identity client holds
      // no reference of its own — the state every generation bump on that client
      // leaves behind.
      lifecycle.install(issuedGrant())
      expect(lifecycle.hasSession()).toBe(true)
      expect(identity.hasSession()).toBe(false)

      // This is what the recovery used to be, and on its own it is a no-op: the
      // notice that empties the transport is emitted only when a reference was
      // actually dropped, so the learner stays authorized.
      identity.clear()
      expect(lifecycle.hasSession()).toBe(true)
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).not.toBeNull()

      // The App's recovery empties it regardless.
      await act(async () => { onFailure('study-session-rejected') })
      await settle()
      expect(lifecycle.hasSession()).toBe(false)
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
      expect(lifecycle.lastClearReason()).toBe('logout')
    })

    it('clears the session authority, then the epoch, then the runtime', async () => {
      const onFailure = await mountWithFailureCallback()
      sessionLifecycle().install(issuedGrant())
      counters.events = []

      await act(async () => { onFailure('study-session-rejected') })
      await settle()

      const firstIndex = (prefix: string) => counters.events.findIndex((event) => event.startsWith(prefix))
      expect(firstIndex('session-clear')).toBeGreaterThanOrEqual(0)
      expect(firstIndex('epoch-cancel')).toBeGreaterThan(firstIndex('session-clear'))
      expect(firstIndex('runtime-cancel')).toBeGreaterThan(firstIndex('epoch-cancel'))
      expect(counters.events).toContain('epoch-cancel:authorization-loss')
      expect(counters.events).toContain('runtime-cancel:authorization-loss')
      // Not a safety cancellation, at any step.
      expect(counters.events.some((event) => event.includes('safety'))).toBe(false)
    })

    it('does the same for a refused adult bearer, and asks for re-authentication', async () => {
      const onFailure = await mountWithFailureCallback()
      const lifecycle = sessionLifecycle()
      lifecycle.install(issuedGrant())
      counters.events = []

      await act(async () => { onFailure('adult-authentication-rejected') })
      await settle()

      expect(lifecycle.hasSession()).toBe(false)
      const firstIndex = (prefix: string) => counters.events.findIndex((event) => event.startsWith(prefix))
      expect(firstIndex('session-clear')).toBeGreaterThanOrEqual(0)
      expect(firstIndex('epoch-cancel')).toBeGreaterThan(firstIndex('session-clear'))
      expect(firstIndex('runtime-cancel')).toBeGreaterThan(firstIndex('epoch-cancel'))
    })

    it('writes no learner safety event and no durable safety stop', async () => {
      const onFailure = await mountWithFailureCallback()
      sessionLifecycle().install(issuedGrant())

      await act(async () => { onFailure('study-session-rejected') })
      await settle()

      expect(readLocalSafetyStops(window.localStorage)).toEqual([])
      expect(renderedText(container)).not.toMatch(/not in trouble|Study paused|safety/i)
    })

    it('does not retry the refused request or rebuild the composition', async () => {
      const onFailure = await mountWithFailureCallback()
      const portsBuilt = counters.mountedPortDeps.length
      await act(async () => { onFailure('study-session-rejected') })
      await settle()
      expect(counters.mountedPortDeps).toHaveLength(portsBuilt)
      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
      expect(counters.hostBoundaries).toHaveLength(1)
    })
  })

  describe('learner switch and logout reach the one boundary', () => {
    it('cancels the launch epoch when a different learner signs in', async () => {
      await mountLaunched('p1', '1234')
      const boundary = hostBoundary()
      const token = boundary.token()
      expect(token.isCurrent()).toBe(true)

      await signOut()
      await signIn('p2', '2222')
      await settle()
      expect(token.isCurrent()).toBe(false)
    })

    it('cancels the launch epoch on sign-out even before the seam exists', async () => {
      // The seam ref is null until a launch has produced an epoch; sign-out
      // reaches the boundary through the owner, so it cannot be skipped.
      await mountApp(seeded(null))
      await signIn('p1', '1234')
      counters.events = []
      await signOut()
      expect(counters.events).toContain('epoch-cancel:logout')
      expect(counters.events).toContain('session-clear:logout')
      expect(hostBoundary().binding).toBeNull()
    })

    it('cancels the launch epoch on sign-out after a completed launch', async () => {
      await mountLaunched()
      const boundary = hostBoundary()
      const token = boundary.token()
      expect(token.isCurrent()).toBe(true)
      counters.events = []
      await signOut()

      expect(token.isCurrent()).toBe(false)
      expect(boundary.binding).toBeNull()
      expect(sessionLifecycle().hasSession()).toBe(false)
      // Sign-out is what cancelled it, and it did so synchronously. The reconcile
      // effect then observes "no selected learner" and cancels the already-empty
      // boundary a second time, so `lastReason` afterwards is that later label —
      // the epoch was already dead when the picker rendered.
      expect(counters.events[counters.events.indexOf('epoch-cancel:logout')]).toBe('epoch-cancel:logout')
      expect(counters.events.indexOf('epoch-cancel:logout'))
        .toBeLessThan(counters.events.indexOf('epoch-cancel:learner-switch'))
    })
  })

  describe('Study OFF', () => {
    beforeEach(() => { useMode('off') })

    it('leaves the one boundary unbound and empties the session', async () => {
      await mountApp(seeded(null))
      await signIn('p1', '1234')
      expect(counters.events).toContain('session-clear:logout')
      expect(counters.events).toContain('epoch-cancel:feature-disabled')
      expect(hostBoundary().binding).toBeNull()
      expect(sessionLifecycle().hasSession()).toBe(false)
      // Nothing was launched: no Study identity request was made at all.
      expect(counters.requestedUrls.filter((url) => url.includes('/api/study/'))).toEqual([])
      expect(counters.hostSeams).toHaveLength(0)
    })
  })

  describe('preview keeps its own epoch', () => {
    beforeEach(() => { useMode('preview') })

    it('does not cancel the preview epoch just because production is not selected', async () => {
      await mountApp(seeded(null))
      await signIn('p1', '1234')
      await waitFor(() => counters.hostSeams.length > 0, 'the preview host seam')
      await settle()

      const seam = counters.hostSeams.at(-1) as SeamLike
      // The preview surfaces are running in this epoch. Cancelling the one
      // boundary because "production is not the selected composition" would
      // restart their sessions under them on every pass of the reconcile effect.
      expect(seam.boundary.token().isCurrent()).toBe(true)
      expect(counters.events).not.toContain('epoch-cancel:feature-disabled')
      // And it is still the one boundary the verified runtime holds.
      expect(seam.boundary).toBe(counters.runtimeLifecycles[0])
    })

    it('keeps one seam object across ordinary re-renders', async () => {
      await mountApp(seeded(null))
      await signIn('p1', '1234')
      await waitFor(() => counters.hostSeams.length > 0, 'the preview host seam')
      await rerenderApp()
      await rerenderApp()
      expect(counters.hostSeams.length).toBeGreaterThan(2)
      expect(new Set(counters.hostSeams).size).toBe(1)
    })
  })
})

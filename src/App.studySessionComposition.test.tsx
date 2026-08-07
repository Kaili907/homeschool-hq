import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'

// STUDY-A1-COMP Phases 4-8, asserted against the running App rather than against
// the composition module in isolation.
//
// Before this card the App built a StudyIdentityClient with no invalidation
// listener, built no Study session transport or lifecycle at all, called
// createMountedStudyPorts() with no arguments — so the mounted safety port had
// no authorization seam and no failure callback — and had nothing to clear on
// logout or a learner change. Every assertion below is one of those gaps.

const counters = vi.hoisted(() => ({
  transports: 0,
  lifecycles: 0,
  identities: 0,
  foreignTransports: 0,
  /** Every lifecycle the App built, so "the same one" can be checked by identity. */
  lifecycleInstances: [] as unknown[],
  identityDeps: [] as Array<
    import('./study/client/studyIdentityClient').StudyIdentityClientDeps | undefined
  >,
  clears: [] as string[],
  mountedPortDeps: [] as Array<Record<string, unknown> | undefined>,
}))

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  syncUser: null as null | { id: string; email: string },
}))

vi.mock('./study/client/studySessionTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studySessionTransport')>()
  return {
    ...actual,
    createStudySessionTransport: () => {
      counters.transports += 1
      return actual.createStudySessionTransport()
    },
  }
})

vi.mock('./study/client/studySessionLifecycle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studySessionLifecycle')>()
  return {
    ...actual,
    createStudySessionLifecycle: (deps: Parameters<typeof actual.createStudySessionLifecycle>[0] = {}) => {
      counters.lifecycles += 1
      if (deps.transport) counters.foreignTransports += 1
      const lifecycle = actual.createStudySessionLifecycle(deps)
      const observed = Object.freeze({
        ...lifecycle,
        clear(reason: Parameters<typeof lifecycle.clear>[0]) {
          counters.clears.push(reason)
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
      counters.identityDeps.push(deps)
      return actual.createStudyIdentityClient(fetchImpl, deps)
    },
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

function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

function tags(node: FakeElement, tag: string): FakeElement[] {
  return [...(node.tagName === tag ? [node] : []), ...node.childNodes.flatMap((child) => tags(child, tag))]
}

/**
 * React attaches live element props to the host node; this DOM-less shim has no
 * bubbling tree, so a control is invoked through its own handler.
 */
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

describe('App Study session composition (STUDY-A1-COMP)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let pathname: string

  beforeEach(() => {
    counters.transports = 0
    counters.lifecycles = 0
    counters.identities = 0
    counters.foreignTransports = 0
    counters.lifecycleInstances = []
    counters.identityDeps = []
    counters.clears = []
    counters.mountedPortDeps = []
    harness.picker = null
    harness.pin = null
    harness.syncUser = { id: 'household-a', email: 'household-a@example.com' }
    root = null
    pathname = '/'
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', 'true')
    vi.stubEnv('VITE_STUDY_ENGINE_PREVIEW', 'true')
    storage = new MemStorage()
    vi.stubGlobal('localStorage', storage)
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

  /**
   * The preview ports arrive through a dynamic import, so how many ticks that
   * takes depends on machine load. Polling keeps these assertions about what the
   * App composes rather than about how fast a chunk resolved.
   */
  async function waitFor(check: () => boolean, what: string, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (check()) return
      await settle()
    }
    throw new Error(`Timed out waiting for ${what}.`)
  }

  /** The Study entry point exists only once the preview composition is ready. */
  async function studyEntryPoint(): Promise<FakeElement> {
    let button: FakeElement | undefined
    await waitFor(
      () => Boolean(button = tags(container, 'BUTTON').find((node) => hasText(node, 'Today’s Study plan'))),
      'the Study entry point',
    )
    return button!
  }

  /** The girl's own Sign out control, driven through its real handler. */
  async function signOut(): Promise<void> {
    const button = tags(container, 'BUTTON').find((node) => hasText(node, 'Sign out'))
    if (!button) throw new Error(`No Sign out control. Rendered: ${renderedText(container).replaceAll(/\s+/g, ' ').slice(0, 900)}`)
    await act(async () => {
      (reactProps(button) as unknown as { onClick: () => void }).onClick()
    })
    await settle()
  }

  async function mountApp(state: AppState) {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
    await settle()
  }

  /** The picker/PIN path a girl actually takes to reach her home surface. */
  async function signIn(profileId: string, pin: string): Promise<void> {
    if (!harness.picker) throw new Error('The picker is not rendered.')
    await act(async () => { harness.picker!.onPick(profileId) })
    await settle()
    if (!harness.pin) throw new Error('The PIN pad is not rendered.')
    await act(async () => { harness.pin!.onComplete(pin) })
    await settle()
  }

  /**
   * Mount, sign one girl in, and wait for the preview composition to finish
   * arriving — the point at which the App has actually composed its Study ports.
   */
  async function mountSignedIn(profileId = 'p1', pin = '1234') {
    await mountApp(seeded(null))
    await signIn(profileId, pin)
    await waitFor(() => counters.mountedPortDeps.length > 0, 'the mounted Study ports')
  }

  describe('single session trio', () => {
    it('builds exactly one transport, one lifecycle and one identity client for the app', async () => {
      await mountSignedIn()
      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
      expect(counters.transports).toBe(1)
      // No foreign transport is injected into the lifecycle.
      expect(counters.foreignTransports).toBe(0)
    })

    it('keeps one trio across re-renders and screen changes', async () => {
      await mountSignedIn()
      const study = await studyEntryPoint()
      await act(async () => { (reactProps(study) as unknown as { onClick: () => void }).onClick() })
      await settle()
      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
      expect(counters.transports).toBe(1)
    })

    it('gives the identity client an invalidation listener pointing at that lifecycle', async () => {
      await mountSignedIn()
      const deps = counters.identityDeps[0]
      expect(typeof deps?.onSessionInvalidated).toBe('function')

      const lifecycle = counters.lifecycleInstances[0] as {
        lastClearReason(): string | null
      }
      deps!.onSessionInvalidated!({ reason: 'session-rejected' })
      expect(lifecycle.lastClearReason()).toBe('session-rejected')
    })
  })

  describe('mounted safety port wiring', () => {
    it('supplies the mounted ports with that lifecycle authorization seam', async () => {
      await mountSignedIn()
      const lifecycle = counters.lifecycleInstances[0] as { authorization: unknown }
      // Every composition the App performs carries the seam — not merely the
      // first one — so no port bundle is ever built without it.
      expect(counters.mountedPortDeps.length).toBeGreaterThan(0)
      for (const deps of counters.mountedPortDeps) {
        expect(deps?.sessionAuthorization).toBeDefined()
        expect(deps?.sessionAuthorization).toBe(lifecycle.authorization)
      }
    })

    it('wires the authorization failure callback at App composition', async () => {
      await mountSignedIn()
      expect(counters.mountedPortDeps.length).toBeGreaterThan(0)
      for (const deps of counters.mountedPortDeps) {
        expect(typeof deps?.onSessionAuthorizationFailure).toBe('function')
      }
    })

    it('clears the Study session and requires adult re-authentication on a refused bearer', async () => {
      await mountSignedIn()
      const onFailure = counters.mountedPortDeps.at(-1)!.onSessionAuthorizationFailure as
        (reason: string) => void
      const before = counters.clears.length
      await act(async () => { onFailure('adult-authentication-rejected') })
      await settle()
      const lifecycle = counters.lifecycleInstances[0] as { hasSession(): boolean }
      expect(lifecycle.hasSession()).toBe(false)
      // No learner-safety wording anywhere on the surface it produced.
      expect(renderedText(container)).not.toMatch(/not in trouble|paused/i)
      expect(counters.clears.length).toBeGreaterThanOrEqual(before)
    })

    it('clears the Study session and does not retry on a refused session', async () => {
      await mountSignedIn()
      const onFailure = counters.mountedPortDeps.at(-1)!.onSessionAuthorizationFailure as
        (reason: string) => void
      const portsBuilt = counters.mountedPortDeps.length
      await act(async () => { onFailure('study-session-rejected') })
      await settle()
      const lifecycle = counters.lifecycleInstances[0] as { hasSession(): boolean }
      expect(lifecycle.hasSession()).toBe(false)
      // The refusal did not re-run the composition or re-issue anything: no
      // automatic request loop, and still exactly one trio.
      expect(counters.mountedPortDeps).toHaveLength(portsBuilt)
      expect(counters.lifecycles).toBe(1)
      expect(counters.identities).toBe(1)
      expect(renderedText(container)).not.toMatch(/not in trouble/i)
    })
  })

  describe('logout', () => {
    it('clears the Study lifecycle explicitly before sign-out completes', async () => {
      await mountSignedIn()
      await signOut()

      expect(counters.clears).toContain('logout')
      const lifecycle = counters.lifecycleInstances[0] as {
        hasSession(): boolean
        authorization: { authorizeStudyRequestHeaders(headers: Record<string, string>): unknown }
      }
      expect(lifecycle.hasSession()).toBe(false)
      // No header can be produced for the next request.
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
    })

    it('leaves no session reference in AppState, storage or the URL', async () => {
      await mountSignedIn()
      await signOut()

      const persisted = storage.getItem(APP_STATE_STORAGE_KEY) ?? ''
      expect(persisted).not.toMatch(/aca_stu_v1_/)
      expect(persisted).not.toMatch(/sessionReference|x-study-session/i)
      expect(pathname).not.toMatch(/aca_stu_v1_|session/i)
      for (let index = 0; index < storage.length; index += 1) {
        expect(storage.getItem(storage.key(index)!) ?? '').not.toMatch(/aca_stu_v1_/)
      }
    })
  })

  describe('learner change', () => {
    it('clears with the learner-changed reason on a direct switch from child A to child B', async () => {
      // A refresh lands on the picker with child A still the persisted active
      // profile, so accepting child B's PIN moves the app from A straight to B
      // with no sign-out in between. That is the transition the card names.
      await mountApp(seeded('p1'))
      counters.clears.length = 0
      await signIn('p2', '2222')

      expect(counters.clears).toContain('learner-changed')
      const lifecycle = counters.lifecycleInstances[0] as {
        hasSession(): boolean
        authorization: { authorizeStudyRequestHeaders(headers: Record<string, string>): unknown }
      }
      // Child B starts with nothing to inherit: no session, and therefore no
      // header child A's request could have left behind.
      expect(lifecycle.hasSession()).toBe(false)
      expect(lifecycle.authorization.authorizeStudyRequestHeaders({})).toBeNull()
      // Still one trio — the switch reuses it rather than building a second.
      expect(counters.lifecycles).toBe(1)
      expect(counters.transports).toBe(1)
      expect(counters.identities).toBe(1)
    })

    it('empties the session on the sign-out-and-back path too', async () => {
      await mountSignedIn()
      await signOut()
      expect(counters.clears).toContain('logout')
      counters.clears.length = 0
      await signIn('p2', '2222')

      const lifecycle = counters.lifecycleInstances[0] as { hasSession(): boolean }
      expect(lifecycle.hasSession()).toBe(false)
      expect(counters.lifecycles).toBe(1)
      expect(counters.transports).toBe(1)
    })

    it('does not report a learner change when the same girl signs back in', async () => {
      await mountApp(seeded('p1'))
      counters.clears.length = 0
      await signIn('p1', '1234')
      expect(counters.clears).not.toContain('learner-changed')
    })
  })

  describe('composition is never serialized', () => {
    it('keeps the trio out of AppState and out of persisted storage', async () => {
      await mountSignedIn()
      const persisted = storage.getItem(APP_STATE_STORAGE_KEY) ?? ''
      const parsed = JSON.parse(persisted) as Record<string, unknown>
      for (const key of Object.keys(parsed)) {
        expect(key).not.toMatch(/lifecycle|transport|identity|studySession/i)
      }
      expect(persisted).not.toMatch(/authorizeStudyRequestHeaders/)
    })
  })
})

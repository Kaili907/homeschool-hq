import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'
import type { SyncStatus } from './sync/types'
import { readLocalSafetyStops } from './study/safety/localStopLedger'

// STUDY-A1-PREVIEW-AUTH-DEGRADE, asserted against the running App.
//
// The independent StrictMode review accepted the surface fix and left one
// condition open. In DEV preview, `buildHostStudyContext` becomes unavailable the
// moment the adult sync binding or its provenance degrades — so the learner's
// Study surface correctly disappears. But the App's production authorization
// reconciliation returns early when preview is the selected composition, so
// nothing retired the App-owned epoch: the one boundary was left
//
//   binding = live, token current, lastReason = null
//
// after the host context it was derived from had stopped being authorized. No
// surface kept a token and no unauthorized work was demonstrated, but stale App
// authority must not outlive the authorization it rests on.
//
// The correction belongs to the App/owner lifecycle and NOT to the React surface
// cleanup: a surface unmount — real or StrictMode's probe — still says nothing
// about the epoch, which is exactly what 72ed777 established.
//
// These drive the REAL App: the real preview composition, the real host context
// builder, the real one-boundary seam, and a `useSync` whose status degrades the
// way the real hook's does (`provenance: 'paused'` when the household binding is
// paused, `binding: 'signed-out'` when the adult session goes). Never a
// hand-written lifecycle simulation.

type HostSyncStatus = Pick<SyncStatus, 'user' | 'binding' | 'provenance'>

const AUTHORIZED: HostSyncStatus = Object.freeze({
  user: { id: 'household-a', email: 'household-a@example.com' },
  binding: 'bound',
  provenance: 'verified',
})

/** Every shape of the SAME host-authorization tuple degrading beneath a live epoch. */
const DEGRADATIONS: ReadonlyArray<readonly [string, Partial<HostSyncStatus>]> = [
  ['the household binding is paused for adult review', { provenance: 'paused' }],
  ['the dataset provenance goes unbound', { provenance: 'unbound' }],
  ['the household binding is lost', { binding: 'unbound' }],
  ['the adult session goes', { user: null, binding: 'signed-out', provenance: 'unbound' }],
]

const counters = vi.hoisted(() => ({
  /** Every boundary the App reached through the one-boundary accessor. */
  hostBoundaries: [] as unknown[],
  /** Every seam the OWNER derived. A surface never appears here. */
  hostSeams: [] as unknown[],
  /** Ordered retirement trace across the session, the epoch and the runtime. */
  events: [] as string[],
  mountedPortDeps: [] as Array<Record<string, unknown> | undefined>,
  requestedUrls: [] as string[],
}))

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  /** The one mutable sync status the mocked hook publishes. */
  sync: {
    user: null as null | { id: string; email: string },
    binding: 'signed-out' as SyncStatus['binding'],
    provenance: 'unbound' as SyncStatus['provenance'],
  },
  version: 0,
  listeners: new Set<() => void>(),
}))

/**
 * A real subscription, so publishing a new status re-renders the App exactly as
 * the real hook's own state updates do. A plain object read during render would
 * change nothing until something else happened to re-render, which would make
 * every degradation below a test artefact.
 */
vi.mock('./sync/useSync', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useSync: () => {
      useSyncExternalStore(
        (onChange: () => void) => {
          harness.listeners.add(onChange)
          return () => { harness.listeners.delete(onChange) }
        },
        () => harness.version,
        () => harness.version,
      )
      return { status: harness.sync }
    },
  }
})

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
    createHostStudyLifecycleSeam: (
      owner: object,
      binding: Parameters<typeof actual.createHostStudyLifecycleSeam>[1],
    ) => {
      const seam = actual.createHostStudyLifecycleSeam(owner, binding)
      counters.hostSeams.push(seam)
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
      const lifecycle = actual.createStudySessionLifecycle(deps)
      return Object.freeze({
        ...lifecycle,
        clear(reason: Parameters<typeof lifecycle.clear>[0]) {
          counters.events.push(`session-clear:${reason}`)
          lifecycle.clear(reason)
        },
      })
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
      invalidate: () => {},
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

vi.mock('./components/Picker', () => ({
  Picker: (props: { onPick: (id: string) => void; onGrownUps: () => void }) => {
    harness.picker = props
    harness.pin = null
    return <main data-surface="picker">Who&apos;s learning today?</main>
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

/**
 * The learner's working preview Study surface. Deliberately the dashboard's own
 * skip link and not its heading: the HOME screen carries a "Today's Study plan"
 * launch tile, so the heading alone would read as "the surface is up" while the
 * learner is standing on the home screen.
 */
const STUDY_PLAN = 'Skip to today’s Study plan'
/** What the App renders instead once the host context stops being constructible. */
const UNAVAILABLE = 'Study is not available yet'
const BINDING_REASON = 'Verify this household data binding before opening Study.'

type BoundaryLike = {
  binding: { learnerRef: string } | null
  lastReason: string | null
  token(): { isCurrent(): boolean; epoch: number }
}
type SeamLike = { boundary: BoundaryLike; binding: { learnerRef: string } }

describe('App preview Study authority when host authorization degrades', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let pathname: string

  function useMode(mode: 'preview' | 'production' | 'off') {
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', mode === 'off' ? 'false' : 'true')
    vi.stubEnv('VITE_STUDY_ENGINE_PREVIEW', mode === 'preview' ? 'true' : 'false')
  }

  beforeEach(() => {
    counters.hostBoundaries = []
    counters.hostSeams = []
    counters.events = []
    counters.mountedPortDeps = []
    counters.requestedUrls = []
    harness.picker = null
    harness.pin = null
    harness.sync = { ...AUTHORIZED }
    harness.version = 0
    harness.listeners = new Set()
    root = null
    pathname = '/study-engine'
    useMode('preview')
    storage = new MemStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('fetch', (url: unknown) => {
      counters.requestedUrls.push(String(url))
      return Promise.resolve({ ok: false, status: 404, json: async () => null })
    })
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
    throw new Error(`Timed out waiting for ${what}. Rendered: ${renderedText(container).replaceAll(/\s+/g, ' ').slice(0, 240)}`)
  }

  async function mountApp(state: AppState, strict = false): Promise<void> {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(strict ? <StrictMode><App /></StrictMode> : <App />))
    await settle()
  }

  /** Publishes a new host authorization status, exactly as the real hook would. */
  async function publishSync(next: Partial<HostSyncStatus>): Promise<void> {
    await act(async () => {
      harness.sync = { ...harness.sync, ...next } as typeof harness.sync
      harness.version += 1
      for (const listener of [...harness.listeners]) listener()
    })
    await settle()
  }

  /**
   * A signed-in learner on a working preview Study surface, with the App-owned
   * epoch live. This is the state the review's condition begins from.
   */
  async function livePreview(strict = false): Promise<BoundaryLike> {
    await mountApp(seeded('p1'), strict)
    await waitFor(() => hasText(container, STUDY_PLAN), 'the preview Study surface')
    const boundary = hostBoundary()
    expect(boundary.binding).not.toBeNull()
    expect(boundary.token().isCurrent()).toBe(true)
    expect(boundary.lastReason).toBeNull()
    return boundary
  }

  function hostBoundary(): BoundaryLike {
    expect(counters.hostBoundaries).toHaveLength(1)
    return counters.hostBoundaries[0] as BoundaryLike
  }

  function epochCancels(): string[] {
    return counters.events.filter((event) => event.startsWith('epoch-cancel:'))
  }

  /**
   * The distinct retirement outcomes the epoch was given.
   *
   * Several existing App paths reach the one boundary twice with the SAME reason
   * — `signOut` cancels it explicitly and then cancels the verified runtime,
   * whose own teardown cancels the very same boundary again. That is a repeat of
   * one outcome, not a second one, so what "exactly one meaningful retirement"
   * has to measure is the set of reasons. The new preview path below is counted
   * exactly, because it touches nothing but the epoch.
   */
  function epochCancelReasons(): Set<string> {
    return new Set(epochCancels())
  }

  async function press(label: string): Promise<void> {
    const button = tags(container, 'BUTTON').find((node) => hasText(node, label))
    if (!button) throw new Error(`No "${label}" control is rendered.`)
    await act(async () => { (reactProps(button) as unknown as { onClick: () => void }).onClick() })
    await settle()
  }

  // ── PHASE 2 / PHASE 4 ──────────────────────────────────────────────────────
  describe('a previously-valid preview host context that loses its authorization', () => {
    it.each(DEGRADATIONS)('retires the App-owned epoch when %s', async (_label, degraded) => {
      const boundary = await livePreview()
      const learnerToken = boundary.token()
      counters.events = []

      await publishSync(degraded)

      // The surface is gone, which is the part the review already accepted.
      expect(hasText(container, STUDY_PLAN)).toBe(false)
      expect(hasText(container, UNAVAILABLE)).toBe(true)

      // And the App-owned authority went with it. At BASE all three of these
      // failed: the boundary stayed bound, its token stayed current, and
      // `lastReason` stayed null while the host context was no longer
      // authorized or constructible.
      expect(boundary.binding).toBeNull()
      expect(boundary.token().isCurrent()).toBe(false)
      expect(learnerToken.isCurrent()).toBe(false)
      expect(boundary.lastReason).toBe('authorization-loss')
    })

    it('retires it exactly once, and does not keep retiring it', async () => {
      const boundary = await livePreview()
      counters.events = []

      await publishSync({ provenance: 'paused' })
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])

      // Still unauthorized, several more renders later: nothing is retired twice
      // and no cancellation loop runs against the already-empty boundary.
      await publishSync({ provenance: 'unbound' })
      await publishSync({ binding: 'unbound' })
      await settle()
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])
      expect(boundary.lastReason).toBe('authorization-loss')
    })

    it('names the loss with the canonical reason the App already uses for it', async () => {
      const boundary = await livePreview()
      counters.events = []
      await publishSync({ provenance: 'paused' })

      // 'authorization-loss' is the existing vocabulary for exactly this — it is
      // what the production reconciliation and the session-authorization-failure
      // recovery both use. No second safety meaning was invented for preview.
      expect(boundary.lastReason).toBe('authorization-loss')
      expect(epochCancels().every((event) => event === 'epoch-cancel:authorization-loss')).toBe(true)
    })

    it('says why on the surface without blaming the learner', async () => {
      await livePreview()
      await publishSync({ provenance: 'paused' })
      expect(hasText(container, BINDING_REASON)).toBe(true)
      expect(hasText(container, 'No Study persistence or safety request was made.')).toBe(true)
    })
  })

  // ── PHASE 14 ───────────────────────────────────────────────────────────────
  describe('authorization loss is authority retirement and nothing more', () => {
    it('writes no durable safety stop and no learner safety event', async () => {
      await livePreview()
      counters.events = []
      await publishSync({ provenance: 'paused' })

      expect(readLocalSafetyStops(window.localStorage)).toEqual([])
      expect(counters.events.some((event) => event.includes('safety-stop'))).toBe(false)
      // The learner is told the household binding needs checking, and is never
      // told she is being paused, reviewed, or stopped.
      expect(renderedText(container)).not.toMatch(/not in trouble|safety stop|Study is paused|adult review|grown-?up will check/i)
      // Nothing was sent anywhere over it either.
      expect(counters.requestedUrls).toEqual([])
    })
  })

  // ── PHASE 6 ────────────────────────────────────────────────────────────────
  describe('initial and still-loading App data', () => {
    it('retires nothing before a valid host was ever established', async () => {
      // The adult session has not resolved yet: unknown, not degraded.
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      await settle()

      expect(hasText(container, UNAVAILABLE)).toBe(true)
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().binding).toBeNull()
      // An epoch that never existed was never retired, so nothing has taught the
      // boundary a reason.
      expect(hostBoundary().lastReason).toBeNull()
    })

    it('runs no cancellation loop while the App is still unauthorized', async () => {
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      for (let pass = 0; pass < 4; pass += 1) await publishSync({})
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()
    })

    it('establishes the epoch normally once the loading finishes', async () => {
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      expect(hostBoundary().binding).toBeNull()

      await publishSync(AUTHORIZED)
      await waitFor(() => hasText(container, STUDY_PLAN), 'the preview Study surface after loading')

      expect(hostBoundary().binding).not.toBeNull()
      expect(hostBoundary().token().isCurrent()).toBe(true)
      expect(epochCancels()).toEqual([])
    })
  })

  // ── PHASE 5 / PHASE 12 ─────────────────────────────────────────────────────
  describe('the StrictMode invariant the accepted surface fix rests on', () => {
    it('does not retire the epoch for a StrictMode effect replay alone', async () => {
      // The real thing: `main.tsx` wraps the App in <StrictMode>, so every mount
      // runs effect setup -> cleanup -> setup inside one commit.
      const boundary = await livePreview(true)
      const born = boundary.token().epoch

      expect(boundary.binding).not.toBeNull()
      expect(boundary.token().isCurrent()).toBe(true)
      expect(boundary.token().epoch).toBe(born)
      expect(epochCancels()).toEqual([])
      expect(boundary.lastReason).toBeNull()
    })

    it('still retires the epoch under StrictMode when authorization really degrades', async () => {
      const boundary = await livePreview(true)
      counters.events = []
      await publishSync({ provenance: 'paused' })

      expect(boundary.binding).toBeNull()
      expect(boundary.lastReason).toBe('authorization-loss')
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])
    })

    it('leaves the epoch alone when the Study surface merely unmounts', async () => {
      const boundary = await livePreview(true)
      const born = boundary.token().epoch
      counters.events = []

      // A real navigation away from the Study screen. The surface unmounts; the
      // App is still signed in and still authorized, so its authority stands.
      await press('Back home')
      expect(hasText(container, STUDY_PLAN)).toBe(false)

      expect(boundary.binding).not.toBeNull()
      expect(boundary.token().isCurrent()).toBe(true)
      expect(boundary.token().epoch).toBe(born)
      expect(boundary.lastReason).toBeNull()
      expect(epochCancels()).toEqual([])
    })
  })

  // ── PHASE 7 ────────────────────────────────────────────────────────────────
  describe('recovery after the authorization is restored', () => {
    it('lets the OWNER establish a new epoch, with the old token stale', async () => {
      const boundary = await livePreview()
      const before = boundary.token()
      const bornEpoch = before.epoch
      const seamsBefore = counters.hostSeams.length

      await publishSync({ provenance: 'paused' })
      expect(before.isCurrent()).toBe(false)
      expect(boundary.binding).toBeNull()

      await publishSync({ provenance: 'verified' })
      await waitFor(() => hasText(container, STUDY_PLAN), 'the restored preview Study surface')

      // A genuinely new epoch, and the retired one stays retired.
      const after = boundary.token()
      expect(after.isCurrent()).toBe(true)
      expect(after.epoch).toBeGreaterThan(bornEpoch)
      expect(before.isCurrent()).toBe(false)

      // And it was the App's own render-time derivation that re-established it.
      // A mounted surface only ever attaches, so it can never appear here.
      expect(counters.hostSeams.length).toBeGreaterThan(seamsBefore)
      const seam = counters.hostSeams.at(-1) as SeamLike
      expect(seam.boundary).toBe(boundary)
    })

    it('does not let the surface mint the authority it is running in', async () => {
      const boundary = await livePreview()
      await publishSync({ binding: 'unbound' })
      expect(boundary.binding).toBeNull()

      // The Study screen is still the selected screen while unauthorized: the
      // surface has every chance to resurrect the epoch, and must not.
      await settle()
      expect(hasText(container, UNAVAILABLE)).toBe(true)
      expect(boundary.binding).toBeNull()
      expect(boundary.token().isCurrent()).toBe(false)
    })
  })

  // ── PHASE 8 ────────────────────────────────────────────────────────────────
  describe('logout stays logout', () => {
    it('retires the epoch as logout, not as authorization loss', async () => {
      const boundary = await livePreview()
      await press('Back home')
      counters.events = []

      await press('Sign out')

      expect(boundary.binding).toBeNull()
      expect(boundary.lastReason).toBe('logout')
      expect(epochCancelReasons()).toEqual(new Set(['epoch-cancel:logout']))
      expect(counters.events).toContain('session-clear:logout')
    })

    it('does not re-retire it as authorization loss when the adult session then goes', async () => {
      const boundary = await livePreview()
      await press('Back home')
      await press('Sign out')
      counters.events = []

      // Signing out of the household after signing out of the learner profile is
      // an ordinary sequence. The epoch was already retired, and retiring it
      // again would overwrite the one meaningful outcome with a second one.
      await publishSync({ user: null, binding: 'signed-out', provenance: 'unbound' })

      expect(epochCancels()).toEqual([])
      expect(boundary.lastReason).toBe('logout')
    })
  })

  // ── PHASE 9 ────────────────────────────────────────────────────────────────
  describe('a learner switch stays a learner switch', () => {
    it('is never labelled authorization loss, and the old learner goes stale', async () => {
      const boundary = await livePreview()
      const samSeam = counters.hostSeams.at(-1) as SeamLike
      const samToken = boundary.token()
      await press('Back home')
      counters.events = []

      // The App's learner switch: the picker, which signs the current learner out
      // first. That sign-out is what retires Sam's authority.
      await press('Sign out')
      expect(harness.picker).not.toBeNull()
      await act(async () => { harness.picker!.onPick('p2') })
      await settle()
      await act(async () => { harness.pin!.onComplete('2222') })
      await settle()

      expect(samToken.isCurrent()).toBe(false)
      expect(epochCancels()).not.toContain('epoch-cancel:authorization-loss')
      expect(epochCancels()).toContain('epoch-cancel:logout')

      // Riley gets her own owner-established authority, on a different learner.
      await waitFor(
        () => (counters.hostSeams.at(-1) as SeamLike | undefined)?.binding.learnerRef !== samSeam.binding.learnerRef,
        'Riley\'s own preview epoch',
      )
      const rileySeam = counters.hostSeams.at(-1) as SeamLike
      expect(rileySeam.binding.learnerRef).not.toBe(samSeam.binding.learnerRef)
      expect(rileySeam.boundary).toBe(boundary)
      expect(boundary.token().isCurrent()).toBe(true)
      expect(samToken.isCurrent()).toBe(false)
    })

    /**
     * The direct learner change, with no sign-out in front of it.
     *
     * Booting with a persisted active profile and no Study/Academy deep link
     * lands on the PICKER while `activeProfileId` is still Sam — so another girl
     * picking her own tile takes the App straight from p1 to p2. That is the one
     * path that reaches the App's learner-change effect, and it is the reason
     * that effect's cancel is not dead code: relabelling it
     * `authorization-loss` survived every other test in this file.
     */
    it('labels a direct p1 -> p2 change learner-switch, with no sign-out in front of it', async () => {
      pathname = '/'
      await mountApp(seeded('p1'))
      await waitFor(() => harness.picker !== null, 'the picker with Sam still persisted')
      await waitFor(() => counters.hostSeams.length > 0, 'Sam\'s preview epoch')
      const boundary = hostBoundary()
      const samSeam = counters.hostSeams.at(-1) as SeamLike
      const samToken = boundary.token()
      expect(samToken.isCurrent()).toBe(true)
      counters.events = []

      await act(async () => { harness.picker!.onPick('p2') })
      await settle()
      await act(async () => { harness.pin!.onComplete('2222') })
      await settle()

      // Sam's authority is gone, and it is a learner switch that took it.
      expect(samToken.isCurrent()).toBe(false)
      expect(epochCancelReasons()).toEqual(new Set(['epoch-cancel:learner-switch']))
      expect(counters.events).toContain('session-clear:learner-changed')

      // Riley ends on her own owner-established epoch.
      await waitFor(
        () => boundary.binding !== null && boundary.binding.learnerRef !== samSeam.binding.learnerRef,
        'Riley\'s own preview epoch',
      )
      expect(boundary.token().isCurrent()).toBe(true)
      expect(samToken.isCurrent()).toBe(false)
    })
  })

  // ── PHASE 10 ───────────────────────────────────────────────────────────────
  describe('Study switched off stays fail-closed', () => {
    beforeEach(() => { useMode('off') })

    it('is feature-disabled and never authorization loss', async () => {
      await mountApp(seeded('p1'))
      await settle()

      expect(hasText(container, STUDY_PLAN)).toBe(false)
      expect(epochCancelReasons()).toEqual(new Set(['epoch-cancel:feature-disabled']))
      expect(hostBoundary().binding).toBeNull()
      // And a degradation on top of a switched-off feature stays fail-closed as
      // feature-disabled. It is never re-labelled an authorization loss.
      counters.events = []
      await publishSync({ provenance: 'paused' })
      expect(epochCancelReasons()).not.toContain('epoch-cancel:authorization-loss')
      expect(hostBoundary().lastReason).toBe('feature-disabled')
    })
  })

  // ── PHASE 11 ───────────────────────────────────────────────────────────────
  describe('production reconciliation is unchanged, and means the same thing', () => {
    beforeEach(() => { useMode('production') })

    it.each(DEGRADATIONS)('still retires the production epoch when %s', async (_label, degraded) => {
      await mountApp(seeded('p1'))
      await settle()
      counters.events = []

      await publishSync(degraded)

      // The production path owns its own reconciliation, and it retires the same
      // authority with the same reason — so the two compositions cannot drift
      // into disagreeing about what "no longer authorized" means.
      expect(counters.events).toContain('epoch-cancel:authorization-loss')
      expect(counters.events).toContain('runtime-cancel:authorization-loss')
      expect(counters.events).toContain('session-clear:logout')
      expect(hostBoundary().binding).toBeNull()
    })

    it('keeps the ordered production recovery: session, then epoch, then runtime', async () => {
      await mountApp(seeded('p1'))
      await settle()
      counters.events = []

      await publishSync({ provenance: 'paused' })

      const firstIndex = (prefix: string) => counters.events.findIndex((event) => event.startsWith(prefix))
      expect(firstIndex('session-clear')).toBeGreaterThanOrEqual(0)
      expect(firstIndex('epoch-cancel')).toBeGreaterThan(firstIndex('session-clear'))
      expect(firstIndex('runtime-cancel')).toBeGreaterThan(firstIndex('epoch-cancel'))
    })
  })
})

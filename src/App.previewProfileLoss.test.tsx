import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'
import type { SyncStatus } from './sync/types'
import { readLocalSafetyStops } from './study/safety/localStopLedger'

// STUDY-A1-PREVIEW-PROFILE-LOSS, asserted against the running App.
//
// The independent review of the preview authorization-degradation correction
// (1e932d8) left one DEV-preview authority condition open. The adult stays
// signed in, the household binding stays bound and its provenance stays
// verified — so none of the App's authorization paths fire — but the synced
// household profile set stops containing the ACTIVE LEARNER.
//
// The learner's Study surface correctly disappears, because
// `buildHostStudyContext` cannot resolve a learner. But at BASE nothing retired
// the App-owned epoch that vanished context had been derived from: the one
// boundary was left
//
//   binding = live (still naming learner A), token current, lastReason = null
//
// for a learner who is no longer an eligible profile. Production already treats
// exactly this state as a learner-switch authority transition (the `!active`
// branch of the reconcile effect), and preview returned early before reaching
// it.
//
// These drive the REAL App: the real preview composition, the real host context
// builder, the real one-boundary seam, and a `useSync` that publishes both the
// household authorization tuple and the synced profile set the way the real
// hook does — the real hook owns `setState` for the profile set, so the mock is
// handed the same `setState` and publishes through it. Never a hand-written
// lifecycle simulation.

type HostSyncStatus = Pick<SyncStatus, 'user' | 'binding' | 'provenance'>

const AUTHORIZED: HostSyncStatus = Object.freeze({
  user: { id: 'household-a', email: 'household-a@example.com' },
  binding: 'bound',
  provenance: 'verified',
})

/** Every shape of the host-authorization tuple degrading. Phase 7 / Phase 10. */
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
  /**
   * The App's own `setState`, handed to `useSync` exactly as the real hook
   * receives it. The real hook is what publishes a synced profile set into the
   * App (`setProfilesFromPersistedSync` -> `setState`), so a profile set that
   * arrives from the cloud has to arrive through this and nothing else.
   */
  applyState: null as null | ((updater: (prev: AppState) => AppState) => void),
  version: 0,
  listeners: new Set<() => void>(),
}))

/**
 * A real subscription for the authorization tuple, so publishing a new status
 * re-renders the App exactly as the real hook's own state updates do.
 */
vi.mock('./sync/useSync', async () => {
  const { useSyncExternalStore } = await import('react')
  return {
    useSync: (
      _state: AppState,
      setState: (updater: (prev: AppState) => AppState) => void,
    ) => {
      useSyncExternalStore(
        (onChange: () => void) => {
          harness.listeners.add(onChange)
          return () => { harness.listeners.delete(onChange) }
        },
        () => harness.version,
        () => harness.version,
      )
      harness.applyState = setState
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
 * The synced household profile set loses this learner while `activeProfileId`
 * still names her.
 *
 * This is the gap Phase 5 is about: the removal reaches the App's profile set
 * before anything has reconciled the selection, and the App is genuinely in
 * this state for at least one commit.
 */
const withLearnerRemoved = (id: string) => (prev: AppState): AppState => {
  const profiles = { ...prev.profiles }
  delete profiles[id]
  return { ...prev, profiles }
}

/**
 * The same removal as the existing sync architecture publishes it.
 * `appStateWithProfiles` (src/sync/useSync.ts) replaces the profile set and
 * nulls `activeProfileId` in the SAME commit whenever the selected profile is
 * absent from the new set, so both shapes are real and the correction must not
 * depend on which one it is handed.
 */
const withLearnerRemovedAsSyncPublishesIt = (id: string) => (prev: AppState): AppState => {
  const next = withLearnerRemoved(id)(prev)
  return {
    ...next,
    activeProfileId:
      next.activeProfileId && next.profiles[next.activeProfileId] ? next.activeProfileId : null,
  }
}

/** Both shapes of the same disappearance, run against every assertion below. */
const REMOVALS: ReadonlyArray<readonly [string, (id: string) => (prev: AppState) => AppState]> = [
  ['the selection still names her', withLearnerRemoved],
  ['the sync engine clears the selection with it', withLearnerRemovedAsSyncPublishesIt],
]

/** The learner's working preview Study surface (the dashboard's own skip link). */
const STUDY_PLAN = 'Skip to today’s Study plan'

type BoundaryLike = {
  binding: { learnerRef: string } | null
  lastReason: string | null
  token(): { isCurrent(): boolean; epoch: number }
}
type SeamLike = { boundary: BoundaryLike; binding: { learnerRef: string } }

describe('App preview Study authority when the active learner leaves the synced profile set', () => {
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
    counters.requestedUrls = []
    harness.picker = null
    harness.pin = null
    harness.applyState = null
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

  /**
   * One commit. `sync` publishes the household authorization tuple, `state`
   * publishes a synced profile set through the App's own `setState` — and both
   * together publish them in the SAME render, which is what Phase 10 needs.
   */
  async function publish(next: {
    sync?: Partial<HostSyncStatus>
    state?: (prev: AppState) => AppState
  }): Promise<void> {
    await act(async () => {
      if (next.state) harness.applyState!(next.state)
      if (next.sync) {
        harness.sync = { ...harness.sync, ...next.sync } as typeof harness.sync
        harness.version += 1
        for (const listener of [...harness.listeners]) listener()
      }
    })
    await settle()
  }

  /**
   * A signed-in learner on a working preview Study surface, with the App-owned
   * epoch live and naming her. This is the state the review's condition begins
   * from: adult signed in, binding bound, provenance verified, learner A active.
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

  async function press(label: string): Promise<void> {
    const button = tags(container, 'BUTTON').find((node) => hasText(node, label))
    if (!button) throw new Error(`No "${label}" control is rendered.`)
    await act(async () => { (reactProps(button) as unknown as { onClick: () => void }).onClick() })
    await settle()
  }

  // ── PHASE 2 / PHASE 4 / PHASE 5 ────────────────────────────────────────────
  describe('a previously-current learner who is no longer an eligible profile', () => {
    it.each(REMOVALS)('retires the App-owned epoch when %s', async (_label, removal) => {
      const boundary = await livePreview()
      const learnerToken = boundary.token()
      const learnerEpoch = learnerToken.epoch
      counters.events = []

      await publish({ state: removal('p1') })

      // The surface is gone, which is the part the review already accepted:
      // the host can no longer resolve a valid active learner.
      expect(hasText(container, STUDY_PLAN)).toBe(false)

      // And the App-owned authority went with it. At BASE all four of these
      // failed: the boundary stayed bound to learner A, its token stayed
      // current, and `lastReason` stayed null while A was no longer an eligible
      // profile in the synced household.
      expect(boundary.binding).toBeNull()
      expect(boundary.token().isCurrent()).toBe(false)
      expect(learnerToken.isCurrent()).toBe(false)
      expect(boundary.lastReason).toBe('learner-switch')
      expect(learnerToken.epoch).toBe(learnerEpoch)
    })

    it('retires it exactly once, and does not keep retiring it', async () => {
      const boundary = await livePreview()
      counters.events = []

      await publish({ state: withLearnerRemoved('p1') })
      expect(epochCancels()).toEqual(['epoch-cancel:learner-switch'])

      // Still absent, several more commits later: nothing is retired twice, and
      // no cancellation loop runs against the already-empty boundary.
      await publish({ state: withLearnerRemovedAsSyncPublishesIt('p1') })
      await publish({ sync: {} })
      await settle()
      expect(epochCancels()).toEqual(['epoch-cancel:learner-switch'])
      expect(boundary.lastReason).toBe('learner-switch')
    })

    it('names it with the reason production already uses for a lost active learner', async () => {
      const boundary = await livePreview()
      counters.events = []
      await publish({ state: withLearnerRemoved('p1') })

      // 'learner-switch' is the existing canonical vocabulary for exactly this:
      // the production reconciliation's own `!active` branch retires the same
      // authority with the same reason. No profile-loss-specific reason was
      // invented, and it is never authorization-loss, safety-stop or
      // navigation-away.
      expect(boundary.lastReason).toBe('learner-switch')
      expect(epochCancels()).toEqual(['epoch-cancel:learner-switch'])
      expect(counters.events).not.toContain('epoch-cancel:authorization-loss')
      expect(counters.events).not.toContain('epoch-cancel:safety-stop')
      expect(counters.events).not.toContain('epoch-cancel:navigation-away')
    })

    it('retires only the epoch that names the learner who disappeared', async () => {
      // Riley is signed in and running; Sam is a different, unrelated profile.
      await mountApp(seeded('p2'))
      await waitFor(() => hasText(container, STUDY_PLAN), 'Riley\'s preview Study surface')
      const boundary = hostBoundary()
      const rileyToken = boundary.token()
      counters.events = []

      await publish({ state: withLearnerRemoved('p1') })

      // Sam leaving the household says nothing about Riley's authority.
      expect(hasText(container, STUDY_PLAN)).toBe(true)
      expect(boundary.binding).not.toBeNull()
      expect(rileyToken.isCurrent()).toBe(true)
      expect(epochCancels()).toEqual([])
      expect(boundary.lastReason).toBeNull()
    })
  })

  // ── PHASE 6 ────────────────────────────────────────────────────────────────
  describe('initial and still-loading profile data', () => {
    /**
     * The Phase 6 state itself, with the household FULLY authorized so that
     * nothing else in the App can be what declines to act: the selection names
     * a learner the profile set does not contain yet. A selection this App has
     * never established an epoch for is unknown, not removed.
     */
    it('does not treat a selection with no epoch behind it as a removal', async () => {
      await mountApp(seeded(null))
      await waitFor(() => harness.picker !== null, 'the picker with no learner selected')
      expect(hostBoundary().binding).toBeNull()

      await publish({ state: (prev) => ({ ...withLearnerRemoved('p1')(prev), activeProfileId: 'p1' }) })

      expect(epochCancels()).toEqual([])
      expect(hostBoundary().binding).toBeNull()
      expect(hostBoundary().lastReason).toBeNull()

      // And when her profile does arrive, the owner establishes her epoch — the
      // wait was for the profile set to become authoritative, not a timer. The
      // App booted with no selection so it is standing on the picker, and the
      // epoch is the App's own, not the surface's: it is established from the
      // resolved learner whatever screen she is on.
      await publish({ state: () => seeded('p1') })
      await waitFor(() => hostBoundary().binding !== null, 'her preview epoch once she arrives')
      expect(hostBoundary().binding).not.toBeNull()
      expect(hostBoundary().token().isCurrent()).toBe(true)
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()
    })

    it('retires nothing before an epoch was ever established for a learner', async () => {
      // The adult session has not resolved yet, so no preview epoch exists —
      // the persisted selection is unknown, not removed.
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      await settle()

      expect(hostBoundary().binding).toBeNull()
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()

      // And a profile set that does not contain the persisted selection while
      // no epoch has ever existed is still not a removal: there is no
      // previously-current learner to have disappeared.
      await publish({ state: withLearnerRemoved('p1') })
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()
    })

    it('establishes the epoch normally once the authoritative profile set arrives', async () => {
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      await publish({ state: withLearnerRemoved('p1') })
      expect(hostBoundary().binding).toBeNull()

      // The learner is present again and the household resolves: the owner
      // establishes her epoch rather than the App inferring she was removed.
      await publish({ sync: AUTHORIZED, state: () => seeded('p1') })
      await waitFor(() => hasText(container, STUDY_PLAN), 'the preview Study surface after loading')

      expect(hostBoundary().binding).not.toBeNull()
      expect(hostBoundary().token().isCurrent()).toBe(true)
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()
    })

    it('runs no cancellation loop while no epoch exists', async () => {
      harness.sync = { user: null, binding: 'signed-out', provenance: 'unbound' }
      await mountApp(seeded('p1'))
      for (let pass = 0; pass < 4; pass += 1) await publish({ state: withLearnerRemoved('p1') })
      expect(epochCancels()).toEqual([])
      expect(hostBoundary().lastReason).toBeNull()
    })
  })

  // ── PHASE 7 / PHASE 10 ─────────────────────────────────────────────────────
  describe('a degraded household authorization is never a profile loss', () => {
    it.each(DEGRADATIONS)('stays authorization-loss when %s with the learner intact', async (_label, degraded) => {
      const boundary = await livePreview()
      counters.events = []

      await publish({ sync: degraded })

      // The profile set did not change, so the learner is still an eligible
      // profile — a sync whose status is momentarily unavailable is never read
      // as her disappearance.
      expect(boundary.lastReason).toBe('authorization-loss')
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])
    })

    it.each(DEGRADATIONS)('stays authorization-loss when %s in the SAME commit as the removal', async (_label, degraded) => {
      const boundary = await livePreview()
      counters.events = []

      // Both change at once. The authorization the epoch rests on is gone, so
      // the profile-loss path must not mint a transition reason for a household
      // whose authorization it can no longer trust.
      await publish({ sync: degraded, state: withLearnerRemoved('p1') })

      expect(boundary.binding).toBeNull()
      expect(boundary.lastReason).toBe('authorization-loss')
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])
    })

    it('does not re-label the retirement when the authorization is later restored', async () => {
      const boundary = await livePreview()
      counters.events = []
      await publish({ sync: { provenance: 'paused' }, state: withLearnerRemoved('p1') })
      expect(boundary.lastReason).toBe('authorization-loss')

      // The household comes back while the learner is still absent. The epoch
      // was already retired and its one meaningful outcome stands.
      await publish({ sync: { provenance: 'verified' } })
      expect(epochCancels()).toEqual(['epoch-cancel:authorization-loss'])
      expect(boundary.lastReason).toBe('authorization-loss')
      expect(boundary.binding).toBeNull()
    })
  })

  // ── PHASE 8 ────────────────────────────────────────────────────────────────
  describe('recovery after the learner returns', () => {
    it('does not revive the retired epoch, and the old token stays stale', async () => {
      const boundary = await livePreview()
      const before = boundary.token()
      const bornEpoch = before.epoch
      counters.events = []

      await publish({ state: withLearnerRemovedAsSyncPublishesIt('p1') })
      expect(before.isCurrent()).toBe(false)
      expect(boundary.binding).toBeNull()

      // She is an eligible profile again, and active again.
      await publish({ state: () => seeded('p1') })
      await waitFor(() => hasText(container, STUDY_PLAN), 'the restored preview Study surface')

      // A genuinely new epoch, and the retired one stays retired.
      const after = boundary.token()
      expect(after.isCurrent()).toBe(true)
      expect(after.epoch).toBeGreaterThan(bornEpoch)
      expect(before.isCurrent()).toBe(false)
      // It was the App's own render-time derivation that re-established it. A
      // mounted surface only ever attaches, so it can never appear here.
      expect((counters.hostSeams.at(-1) as SeamLike).boundary).toBe(boundary)
    })

    it('leaves the epoch retired while she is still absent', async () => {
      const boundary = await livePreview()
      await publish({ state: withLearnerRemoved('p1') })

      // The Study screen is still the selected screen: nothing on it may
      // resurrect the authority it was running in.
      await settle()
      expect(boundary.binding).toBeNull()
      expect(boundary.token().isCurrent()).toBe(false)
    })
  })

  // ── PHASE 9 ────────────────────────────────────────────────────────────────
  describe('a direct learner change stays a direct learner change', () => {
    it('labels a direct p1 -> p2 change learner-switch, and cancels it once', async () => {
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

      // Sam is still an eligible profile — she was switched away from, not
      // removed — so the existing learner-change effect owns this, alone.
      expect(samToken.isCurrent()).toBe(false)
      expect(epochCancels()).toEqual(['epoch-cancel:learner-switch'])
      expect(counters.events.filter((event) => event.startsWith('session-clear:')))
        .toEqual(['session-clear:learner-changed'])

      await waitFor(
        () => boundary.binding !== null && boundary.binding.learnerRef !== samSeam.binding.learnerRef,
        'Riley\'s own preview epoch',
      )
      expect(boundary.token().isCurrent()).toBe(true)
    })

    it('does not double-cancel when the learner is switched away from AND then removed', async () => {
      pathname = '/'
      await mountApp(seeded('p1'))
      await waitFor(() => counters.hostSeams.length > 0, 'Sam\'s preview epoch')
      const boundary = hostBoundary()
      await act(async () => { harness.picker!.onPick('p2') })
      await settle()
      await act(async () => { harness.pin!.onComplete('2222') })
      await settle()
      await waitFor(() => boundary.binding !== null, 'Riley\'s own preview epoch')
      counters.events = []

      // Sam now leaves the household. Riley is the one the live epoch names, so
      // Sam's removal retires nothing.
      await publish({ state: withLearnerRemoved('p1') })
      expect(epochCancels()).toEqual([])
      expect(boundary.binding).not.toBeNull()
    })
  })

  // ── PHASE 11 ───────────────────────────────────────────────────────────────
  describe('logout and feature-off keep their own reasons', () => {
    it('stays logout when the learner signs out, even though the selection clears', async () => {
      const boundary = await livePreview()
      await press('Back home')
      counters.events = []

      await press('Sign out')

      // Sign-out nulls `activeProfileId` exactly as a removal would, and the
      // profile-loss path must not add a second outcome on top of it.
      expect(boundary.binding).toBeNull()
      expect(boundary.lastReason).toBe('logout')
      expect(epochCancels().filter((event) => event === 'epoch-cancel:learner-switch')).toEqual([])
    })

    it('does not retire a signed-out App again when the learner is then removed', async () => {
      const boundary = await livePreview()
      await press('Back home')
      await press('Sign out')
      counters.events = []

      await publish({ state: withLearnerRemoved('p1') })

      expect(epochCancels()).toEqual([])
      expect(boundary.lastReason).toBe('logout')
    })

    it('stays feature-disabled when Study is off', async () => {
      useMode('off')
      await mountApp(seeded('p1'))
      await settle()
      expect(hostBoundary().lastReason).toBe('feature-disabled')
      counters.events = []

      await publish({ state: withLearnerRemoved('p1') })

      // The switched-off reconcile path re-states `feature-disabled` on each of
      // its own re-runs, so what has to be exactly one here is the OUTCOME, not
      // the call count: a removal adds no second meaning on top of it.
      expect(new Set(epochCancels())).toEqual(new Set(['epoch-cancel:feature-disabled']))
      expect(hostBoundary().lastReason).toBe('feature-disabled')
    })
  })

  // ── PHASE 12 ───────────────────────────────────────────────────────────────
  describe('StrictMode', () => {
    it('does not infer a removal from an effect replay alone', async () => {
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

    it('still retires the epoch under StrictMode when the learner really disappears', async () => {
      const boundary = await livePreview(true)
      counters.events = []

      await publish({ state: withLearnerRemoved('p1') })

      expect(boundary.binding).toBeNull()
      expect(boundary.lastReason).toBe('learner-switch')
      expect(epochCancels()).toEqual(['epoch-cancel:learner-switch'])
    })

    it('leaves the epoch alone when the Study surface merely unmounts', async () => {
      const boundary = await livePreview(true)
      const born = boundary.token().epoch
      counters.events = []

      await press('Back home')
      expect(hasText(container, STUDY_PLAN)).toBe(false)

      expect(boundary.binding).not.toBeNull()
      expect(boundary.token().isCurrent()).toBe(true)
      expect(boundary.token().epoch).toBe(born)
      expect(epochCancels()).toEqual([])
    })
  })

  // ── PHASE 13 ───────────────────────────────────────────────────────────────
  describe('a profile loss is authority lifecycle and nothing more', () => {
    it.each(REMOVALS)('writes no safety stop and no learner safety event when %s', async (_label, removal) => {
      await livePreview()
      counters.events = []

      await publish({ state: removal('p1') })

      expect(readLocalSafetyStops(window.localStorage)).toEqual([])
      expect(counters.events.some((event) => event.includes('safety-stop'))).toBe(false)
      // The learner is never told she is being paused, reviewed, or stopped.
      expect(renderedText(container)).not.toMatch(/not in trouble|safety stop|Study is paused|adult review|grown-?up will check/i)
      // Nothing was sent anywhere over it either.
      expect(counters.requestedUrls).toEqual([])
    })
  })

  // ── PHASE 14 ───────────────────────────────────────────────────────────────
  describe('production reconciliation means the same thing', () => {
    beforeEach(() => { useMode('production') })

    it.each(REMOVALS)('retires the production authority as learner-switch when %s', async (_label, removal) => {
      await mountApp(seeded('p1'))
      await settle()
      counters.events = []

      await publish({ state: removal('p1') })

      // Production's own `!active` branch is the semantics preview now matches:
      // a lost active learner is a learner-switch authority transition across
      // the session, the epoch and the verified runtime alike.
      expect(counters.events).toContain('epoch-cancel:learner-switch')
      expect(counters.events).toContain('runtime-cancel:learner-switch')
      expect(counters.events).toContain('session-clear:learner-changed')
      expect(counters.events).not.toContain('epoch-cancel:authorization-loss')
      expect(hostBoundary().binding).toBeNull()
    })
  })
})

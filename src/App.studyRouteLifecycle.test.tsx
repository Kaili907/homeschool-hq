import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'

// MOUNT-2 route lifecycle (Session A2). Harness adapted from the recovered
// mount work (87a8076 / 11a63e2) and src/sync/useSync.mounted.test.tsx; the
// production study layer (readiness, gateway auth, verified runtime) is mocked
// so the tests exercise App's route/screen ordering, not the study internals.

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  syncUser: null as null | { id: string; email: string },
  launches: [] as Array<{ student: string; host: string }>,
  cancels: [] as string[],
  runtimeReady: false,
  readiness: () => ({
    schemaVersion: 1,
    status: 'ready' as const,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }),
}))

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
vi.mock('./study/client/studyProductionReadinessClient', () => ({
  createStudyProductionReadinessClient: () => ({
    read: async () => harness.readiness(),
    revalidate: async () => harness.readiness(),
    invalidate: () => {},
  }),
}))
vi.mock('./study/production/verifiedRuntimeAdapter', () => ({
  createVerifiedStudyRuntimeAdapter: () => ({
    launch: async (input: { hostSessionKey: string; selectedStudentRef: { value: string } }) => {
      harness.launches.push({ student: input.selectedStudentRef.value, host: input.hostSessionKey })
      harness.runtimeReady = true
      return { status: 'ready' }
    },
    execute: async () => ({}),
    cancel: async (reason: string) => {
      harness.cancels.push(reason)
      harness.runtimeReady = false
    },
    isReady: () => harness.runtimeReady,
  }),
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

function seeded(active: string | null): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin: '1234' }
  state.profiles.p2 = { ...state.profiles.p2, name: 'Riley', pin: '2222' }
  state.activeProfileId = active
  return state
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

/** Text-node joins introduce spaces mid-sentence, so match with whitespace removed. */
function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

describe('App study route lifecycle (MOUNT-2)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    harness.syncUser = { id: 'household-a', email: 'household-a@example.com' }
    harness.launches = []
    harness.cancels = []
    harness.runtimeReady = false
    root = null
    pathname = '/study-engine'
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', 'true')
    vi.stubEnv('VITE_STUDY_ENGINE_PREVIEW', '')
    vi.stubGlobal('localStorage', new MemStorage())
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
      location: { get pathname() { return pathname }, protocol: 'test:' },
      history: {
        pushState: (_s: unknown, _t: string, url: string) => { pathname = url },
        replaceState: (_s: unknown, _t: string, url: string) => { pathname = url },
      },
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
  })

  async function mountApp(state: AppState) {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
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
      `Condition not reached (launches=${JSON.stringify(harness.launches)}, cancels=${JSON.stringify(harness.cancels)}, text="${renderedText(container).replaceAll(/\s+/g, ' ').slice(0, 200)}")`,
    )
  }

  function findButton(label: string, node: FakeElement = container): FakeElement | null {
    if (node.tagName === 'BUTTON' && hasText(node, label)) return node
    for (const child of node.childNodes) {
      const found = findButton(label, child)
      if (found) return found
    }
    return null
  }

  async function press(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const key = Object.keys(el!).find((k) => k.startsWith('__reactProps$'))
    if (!key) throw new Error(`No React props on <${el!.tagName}>`)
    const props = (el as unknown as Record<string, { onClick?: () => void }>)[key]
    if (!props.onClick) throw new Error(`No onClick on <${el!.tagName}>`)
    await act(async () => { props.onClick!() })
    await settle()
  }

  async function reachStudySurface() {
    await waitFor(() => harness.launches.length >= 1)
    await waitFor(() => hasText(container, 'Verified Study workspace'))
  }

  it('reaches the study surface on fresh navigation to /study-engine with a persisted active profile', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    expect(harness.picker).toBeNull()
    expect(harness.launches[0]).toEqual({ student: 'p1', host: 'household-a' })
    // A4-X: entry never writes the URL — deep-link pathname is left untouched.
    expect(pathname).toBe('/study-engine')
  })

  it('reaches the study surface again after a refresh-equivalent remount mid-session', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    await mountApp(persisted)
    await waitFor(() => harness.launches.length >= 2)
    await waitFor(() => hasText(container, 'Verified Study workspace'))
    expect(harness.picker).toBeNull()
    expect(harness.launches[1]).toEqual({ student: 'p1', host: 'household-a' })
    // A4-X: mid-session the pathname stays /study-engine, so refresh re-enters.
    expect(pathname).toBe('/study-engine')
  })

  it('cancels the study runtime and lands the next learner on home after a profile switch', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    await press(findButton('Back home'))
    await waitFor(() => hasText(container, 'Hi, Sam!'))
    expect(harness.cancels).toContain('navigation-away')
    await press(findButton('Sign out'))
    expect(harness.picker).not.toBeNull()
    expect(harness.cancels).toContain('logout')
    const launchesBeforeSwitch = harness.launches.length
    await act(async () => harness.picker?.onPick('p2'))
    expect(harness.pin?.title).toBe('Hi, Riley!')
    await act(async () => { harness.pin?.onComplete('2222') })
    await waitFor(() => hasText(container, 'Hi, Riley!'))
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
    const afterSwitch = harness.launches.slice(launchesBeforeSwitch)
    expect(afterSwitch.every((launch) => launch.student === 'p2')).toBe(true)
  })

  it('keeps the picker for a signed-out direct link (no active profile)', async () => {
    await mountApp(seeded(null))
    expect(harness.picker).not.toBeNull()
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
    expect(hasText(container, 'Study is not available')).toBe(false)
    expect(harness.launches).toEqual([])
  })

  it('keeps the picker when the persisted active profile is stale', async () => {
    const state = seeded('p1')
    state.activeProfileId = 'ghost'
    await mountApp(state)
    expect(harness.picker).not.toBeNull()
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
    expect(harness.launches).toEqual([])
  })

  it('gives the normal app and never a study mount for a flag-off direct link', async () => {
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', '')
    await mountApp(seeded('p1'))
    expect(harness.picker).not.toBeNull()
    await act(async () => harness.picker?.onPick('p1'))
    await act(async () => { harness.pin?.onComplete('1234') })
    await waitFor(() => hasText(container, 'Hi, Sam!'))
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
    expect(hasText(container, 'Study is not available')).toBe(false)
    expect(hasText(container, 'Today’s Study plan')).toBe(false)
    expect(harness.launches).toEqual([])
  })

  // A4-X exit-time URL normalization (adopted ruling on the A2/A4 residual):
  // leaving Study rewrites a lingering /study-engine pathname to / via
  // replaceState, so a refresh-equivalent remount lands the normal start
  // screen instead of re-entering Study.

  it('normalizes the pathname on Back home so a refresh-equivalent remount does not re-enter Study', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    await press(findButton('Back home'))
    await waitFor(() => hasText(container, 'Hi, Sam!'))
    expect(pathname).toBe('/')
    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    await mountApp(persisted)
    // The runtime prelaunch tied to the active profile may still fire in the
    // background (existing MOUNT-2 behavior); what must not happen is the
    // Study surface rendering instead of the normal start screen.
    expect(harness.picker).not.toBeNull()
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
  })

  it('normalizes the pathname on sign-out when /study-engine lingers at sign-out time', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    await press(findButton('Back home'))
    await waitFor(() => hasText(container, 'Hi, Sam!'))
    // Simulate the URL lingering at sign-out time (e.g. restored by browser
    // Back after exit — the accepted residual) so signOut's coverage is real.
    pathname = '/study-engine'
    await press(findButton('Sign out'))
    expect(harness.picker).not.toBeNull()
    expect(pathname).toBe('/')
  })

  it('does not enter Study on remount for a second learner after a prior learner exits (A4-F2)', async () => {
    await mountApp(seeded('p1'))
    await reachStudySurface()
    await press(findButton('Back home'))
    await waitFor(() => hasText(container, 'Hi, Sam!'))
    await press(findButton('Sign out'))
    expect(harness.picker).not.toBeNull()
    await act(async () => harness.picker?.onPick('p2'))
    await act(async () => { harness.pin?.onComplete('2222') })
    await waitFor(() => hasText(container, 'Hi, Riley!'))
    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.activeProfileId).toBe('p2')
    await mountApp(persisted)
    expect(harness.picker).not.toBeNull()
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
    expect(pathname).toBe('/')
  })

  it('leaves the root pathname on the picker despite a persisted active profile', async () => {
    pathname = '/'
    await mountApp(seeded('p1'))
    expect(harness.picker).not.toBeNull()
    expect(hasText(container, 'Verified Study workspace')).toBe(false)
  })
})

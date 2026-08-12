import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'

// FAMILY-PILOT route lifecycle. Harness adapted from
// App.grade5MathPracticeRouteLifecycle.test.tsx. The pilot shell is NOT mocked:
// the flag-off assertions have to be made against the rendered surface, and the
// save/resume assertion has to exercise the real device-local store.

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
}))

vi.mock('./sync/useSync', () => ({
  useSync: () => ({ status: { user: null, binding: 'none', provenance: 'unverified' } }),
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
  state.activeProfileId = active
  return state
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}
const squash = (value: string) => value.replaceAll(/\s+/g, '')
function hasText(node: FakeElement, needle: string): boolean {
  return squash(renderedText(node)).includes(squash(needle))
}

/** Copy only the pilot shell renders. */
const SURFACE_MARKER = 'Saved on this device only.'
const PICKER_MARKER = "Who's learning today?"

describe('App Family Pilot route lifecycle (FAMILY-PILOT)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string
  let storage: MemStorage

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    root = null
    pathname = '/family-pilot'
    storage = new MemStorage()
    vi.stubGlobal('localStorage', storage)
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
      // The pilot store reads window.localStorage, so it must be the same object.
      localStorage: storage,
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
      `Condition not reached — rendered: "${renderedText(container).replaceAll(/\s+/g, ' ').slice(0, 200)}"`,
    )
  }

  const waitForSurface = () => waitFor(() => hasText(container, SURFACE_MARKER))

  /** Settles well past any lazy-chunk resolution, then proves the pilot never appeared. */
  async function expectSurfaceUnreachable() {
    for (let tick = 0; tick < 5; tick++) await settle()
    expect(hasText(container, SURFACE_MARKER)).toBe(false)
  }

  function findAll(predicate: (node: FakeElement) => boolean, node: FakeElement = container): FakeElement[] {
    const found: FakeElement[] = []
    const visit = (current: FakeElement) => {
      if (predicate(current)) found.push(current)
      current.childNodes.forEach(visit)
    }
    visit(node)
    return found
  }

  const findButton = (label: string) =>
    findAll((node) => node.tagName === 'BUTTON' && hasText(node, label))[0] ?? null

  function reactProps(el: FakeElement | null): Record<string, unknown> {
    expect(el).not.toBeNull()
    const key = Object.keys(el!).find((k) => k.startsWith('__reactProps$'))
    if (!key) throw new Error(`No React props on <${el!.tagName}>`)
    return (el as unknown as Record<string, Record<string, unknown>>)[key]!
  }

  async function press(el: FakeElement | null) {
    const props = reactProps(el) as { onClick?: () => void }
    if (!props.onClick) throw new Error('No onClick')
    await act(async () => { props.onClick!() })
    await settle()
  }

  async function typeInto(el: FakeElement | null, value: string) {
    const props = reactProps(el) as { onChange?: (event: { target: { value: string } }) => void }
    if (!props.onChange) throw new Error('No onChange')
    await act(async () => { props.onChange!({ target: { value } }) })
    await settle()
  }

  const nameField = () => findAll((node) => node.tagName === 'INPUT')[0] ?? null

  // ---------- flag OFF (the shipped default) ----------

  it('leaves the pilot unreachable by deep link when the flag is absent', async () => {
    // No stubEnv at all: this is exactly what a normal build sees.
    await mountApp(seeded('p1'))
    await expectSurfaceUnreachable()
    expect(hasText(container, PICKER_MARKER)).toBe(true)
  })

  it.each(['false', 'TRUE', '1', 'yes'])(
    'leaves the pilot unreachable for the truthy-looking flag %s',
    async (value) => {
      vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', value)
      await mountApp(seeded('p1'))
      await expectSurfaceUnreachable()
    },
  )

  // ---------- flag ON ----------

  it('boots onto the pilot for a deep link with a persisted profile', async () => {
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    await mountApp(seeded('p1'))
    await waitForSurface()
    expect(harness.picker).toBeNull()
    // Entry never rewrites the URL; only exit normalizes it.
    expect(pathname).toBe('/family-pilot')
  })

  it('falls through to the picker with the flag on but no persisted profile', async () => {
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    await mountApp(seeded(null))
    await expectSurfaceUnreachable()
    expect(hasText(container, PICKER_MARKER)).toBe(true)
  })

  it('exit normalizes the URL so a later refresh does not re-enter', async () => {
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    await mountApp(seeded('p1'))
    await waitForSurface()
    await press(findButton('Back home'))
    expect(pathname).toBe('/')
  })

  it('keeps two learners separate and resumes them after a remount', async () => {
    // The end-to-end pilot promise: add two learners, close the app, come back
    // and find both still there, still distinct.
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    await mountApp(seeded('p1'))
    await waitForSurface()

    await typeInto(nameField(), 'Ada')
    await press(findButton('Add learner'))
    await typeInto(nameField(), 'Bo')
    await press(findButton('Add learner'))
    expect(hasText(container, 'Ada')).toBe(true)
    expect(hasText(container, 'Bo')).toBe(true)

    // Refresh-equivalent remount against the same device storage.
    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    await mountApp(seeded('p1'))
    await waitForSurface()
    expect(hasText(container, 'Ada')).toBe(true)
    expect(hasText(container, 'Bo')).toBe(true)
  })

  it('shows which learner is active in the diagnostics panel', async () => {
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    vi.stubEnv('VITE_FAMILY_PILOT_DIAGNOSTICS', 'true')
    await mountApp(seeded('p1'))
    await waitForSurface()

    await typeInto(nameField(), 'Ada')
    await press(findButton('Add learner'))
    await waitFor(() => findAll((node) => node.getAttribute('data-testid') === 'family-pilot-diagnostics').length > 0)

    const activeName = findAll((node) => node.getAttribute('data-diagnostic') === 'activeStudentName')[0]
    expect(activeName).toBeDefined()
    expect(hasText(activeName!, 'Ada')).toBe(true)
  })
})

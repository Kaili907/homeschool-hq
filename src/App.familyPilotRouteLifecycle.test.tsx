import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultAppState } from './migration'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import type { AppState } from './types'

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  legacySyncEnabled: null as boolean | null,
}))

vi.mock('./sync/useSync', () => ({
  useSync: (_state: unknown, _setState: unknown, legacySyncEnabled: boolean) => {
    harness.legacySyncEnabled = legacySyncEnabled
    return { status: { user: null, binding: 'none', provenance: 'unverified' } }
  },
}))
vi.mock('./components/Picker', () => ({
  Picker: (props: { onPick: (id: string) => void; onGrownUps: () => void }) => {
    harness.picker = props
    return <main>Who's learning today?</main>
  },
}))
vi.mock('./components/PinPad', () => ({
  PinPad: () => <main>Parent PIN</main>,
}))
vi.mock('./components/hub/ParentHub', () => ({
  ParentHub: () => <main>Parent Hub</main>,
}))
vi.mock('./tutor/voice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tutor/voice')>()),
  purgeVoiceCache: async () => {},
}))
vi.mock('./study/family-pilot/final-app/FinalFamilyPilotApp', () => ({
  FinalFamilyPilotApp: ({ onExit }: { onExit: () => void }) => (
    <main>
      <p>Final Family Pilot</p>
      <button type="button" onClick={onExit}>Back home</button>
    </main>
  ),
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
  createElement(tag: string) { const element = new FakeElement(tag); element.ownerDocument = this; return element }
  createElementNS(_namespace: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const element = this.createElement('#text'); element.nodeType = 3; element.nodeName = '#text'; element.textContent = value; return element }
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

function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

describe('App final Family Pilot route lifecycle', () => {
  let root: Root | null
  let container: FakeElement
  let pathname: string
  let storage: MemStorage

  beforeEach(() => {
    harness.picker = null
    harness.legacySyncEnabled = null
    root = null
    pathname = '/family-pilot'
    storage = new MemStorage()
    vi.stubGlobal('localStorage', storage)
    const documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget,
      setTimeout,
      clearTimeout,
      HTMLElement: FakeElement,
      HTMLIFrameElement: class {},
      getSelection: () => null,
      localStorage: storage,
      location: { get pathname() { return pathname }, protocol: 'test:' },
      history: {
        pushState: (_state: unknown, _title: string, url: string) => { pathname = url },
        replaceState: (_state: unknown, _title: string, url: string) => { pathname = url },
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

  async function settle() {
    await act(async () => {
      await Promise.resolve()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      await Promise.resolve()
    })
  }

  async function mountApp(state: AppState) {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
    await settle()
  }

  async function waitForText(needle: string) {
    const deadline = Date.now() + 5_000
    while (Date.now() < deadline) {
      if (hasText(container, needle)) return
      await settle()
    }
    throw new Error(`Did not render ${needle}; rendered ${renderedText(container)}`)
  }

  function findButton(label: string, node: FakeElement = container): FakeElement | null {
    if (node.tagName === 'BUTTON' && hasText(node, label)) return node
    for (const child of node.childNodes) {
      const found = findButton(label, child)
      if (found) return found
    }
    return null
  }

  async function press(button: FakeElement | null) {
    expect(button).not.toBeNull()
    const key = Object.keys(button!).find((candidate) => candidate.startsWith('__reactProps$'))
    if (!key) throw new Error('No React props on button.')
    const props = (button as unknown as Record<string, { onClick?: () => void }>)[key]
    await act(async () => props?.onClick?.())
    await settle()
  }

  it('keeps the production route unreachable when the exact flag is absent', async () => {
    await mountApp(seeded('p1'))
    expect(hasText(container, 'Final Family Pilot')).toBe(false)
    expect(hasText(container, "Who's learning today?")).toBe(true)
    expect(harness.legacySyncEnabled).toBe(true)
  })

  it.each(['false', 'TRUE', '1', 'yes'])(
    'keeps the route unreachable for non-exact flag value %s',
    async (value) => {
      vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', value)
      await mountApp(seeded('p1'))
      expect(hasText(container, 'Final Family Pilot')).toBe(false)
    },
  )

  it.each([null, 'p1'])(
    'boots the final first-run-capable app when the exact flag is on (active profile %s)',
    async (active) => {
      vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
      await mountApp(seeded(active))
      await waitForText('Final Family Pilot')
      expect(harness.picker).toBeNull()
      expect(harness.legacySyncEnabled).toBe(false)
      expect(pathname).toBe('/family-pilot')
    },
  )

  it('normalizes the route on exit', async () => {
    vi.stubEnv('VITE_FAMILY_PILOT_ENABLED', 'true')
    await mountApp(seeded(null))
    await waitForText('Final Family Pilot')
    await press(findButton('Back home'))
    expect(pathname).toBe('/')
    expect(harness.legacySyncEnabled).toBe(true)
  })
})

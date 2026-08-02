import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'

const surfaces = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  parentHub: false,
  engineExit: null as null | (() => void),
}))

vi.mock('./sync/useSync', () => ({ useSync: () => ({}) }))
vi.mock('./components/Picker', () => ({
  Picker: (props: typeof surfaces.picker) => {
    surfaces.picker = props
    surfaces.pin = null
    return <main data-surface="picker"><h1>Homeschool HQ</h1><p>Who's learning today?</p></main>
  },
}))
vi.mock('./components/PinPad', () => ({
  PinPad: (props: typeof surfaces.pin) => {
    surfaces.picker = null
    surfaces.pin = props
    return <main data-surface="pin"><h1>{props?.title}</h1></main>
  },
}))
vi.mock('./components/hub/ParentHub', () => ({
  ParentHub: () => {
    surfaces.parentHub = true
    return <main data-surface="parent-hub">Parent Hub</main>
  },
}))
vi.mock('../study-engine/src/index', () => ({
  StudyEngineApp: ({ learner, onExit }: { learner: { displayName: string }; onExit: () => void }) => {
    surfaces.engineExit = onExit
    useEffect(() => {
      const previous = document.title
      document.title = 'Study Engine | Homeschool HQ'
      return () => { document.title = previous }
    }, [])
    return <main data-surface="study-engine"><h1>Learning activities are not available yet</h1><p>{learner.displayName}</p></main>
  },
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
  title = 'Homeschool HQ'
  constructor() {
    super()
    this.documentElement = new FakeElement('html'); this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this; this.body.ownerDocument = this; this.activeElement = this.body
  }
  createElement(tag: string) { const e = new FakeElement(tag); e.ownerDocument = this; return e }
  createElementNS(_ns: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const e = this.createElement('#text'); e.nodeType = 3; e.nodeName = '#text'; e.textContent = value; return e }
}

function seeded(active: string | null = 'p1', pin = '1234'): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin }
  state.activeProfileId = active
  return state
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

describe('App Study Engine guarded route lifecycle', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string
  let adds: string[]
  let removes: string[]

  beforeEach(() => {
    surfaces.picker = null; surfaces.pin = null; surfaces.parentHub = false; surfaces.engineExit = null
    root = null; pathname = '/study-engine'; adds = []; removes = []
    vi.stubGlobal('localStorage', new MemStorage())
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
      location: { get pathname() { return pathname }, protocol: 'test:' },
      history: { pushState: (_s: unknown, _t: string, url: string) => { pathname = url }, replaceState: (_s: unknown, _t: string, url: string) => { pathname = url } },
    }) as unknown as EventTarget & Record<string, unknown>
    const add = windowTarget.addEventListener.bind(windowTarget)
    const remove = windowTarget.removeEventListener.bind(windowTarget)
    windowTarget.addEventListener = ((type: string, listener: EventListener) => { adds.push(type); add(type, listener) }) as typeof add
    windowTarget.removeEventListener = ((type: string, listener: EventListener) => { removes.push(type); remove(type, listener) }) as typeof remove
    windowTarget.top = windowTarget; windowTarget.self = windowTarget; documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget); vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('navigator', { onLine: false, userAgent: 'Vitest' })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    vi.unstubAllGlobals()
  })

  async function mount(state: AppState | unknown = seeded()) {
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(state))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
  }
  async function pick(id = 'p1') { await act(async () => surfaces.picker?.onPick(id)) }
  async function pin(value: string) { let result: string | null | undefined; await act(async () => { result = surfaces.pin?.onComplete(value) }); return result }

  it('guards a fresh deep link despite a remembered valid active profile', async () => { await mount(); expect(surfaces.picker).not.toBeNull(); expect(document.title).toBe('Homeschool HQ') })
  it('guards the same deep link after a refresh-equivalent remount', async () => { await mount(); await act(async () => root?.unmount()); root = null; surfaces.picker = null; container = documentTarget.createElement('div'); await mount(JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!)); expect(surfaces.picker).not.toBeNull() })
  it('guards a missing activeProfileId', async () => { await mount(seeded(null)); expect(surfaces.picker).not.toBeNull() })
  it('rejects a stale activeProfileId through the persistence loader', async () => { await mount(seeded('deleted')); expect(surfaces.picker).not.toBeNull(); expect(JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!).activeProfileId).toBeNull() })
  it('rejects malformed profile state through the persistence loader', async () => { await mount({ schemaVersion: 2, profiles: { p1: { id: 'p1' } }, activeProfileId: 'p1', parentPin: '' }); expect(surfaces.picker).not.toBeNull() })
  it('requires the existing learner PIN after profile selection', async () => { await mount(); await pick(); expect(surfaces.pin?.title).toBe('Hi, Sam!'); expect(document.title).toBe('Homeschool HQ') })
  it('continues to Study Engine after the correct PIN', async () => { await mount(); await pick(); expect(await pin('1234')).toBeNull(); expect(document.title).toBe('Study Engine | Homeschool HQ'); expect(pathname).toBe('/study-engine') })
  it('does not mount Study Engine after a wrong PIN', async () => { await mount(); await pick(); expect(await pin('9999')).toMatch(/not it/); expect(document.title).toBe('Homeschool HQ') })
  it('does not mount Study Engine when the guard is cancelled', async () => { await mount(); await pick(); await act(async () => surfaces.pin?.onCancel()); expect(surfaces.picker).not.toBeNull(); expect(document.title).toBe('Homeschool HQ') })
  it('requires confirmation when creating a first learner PIN', async () => { await mount(seeded(null, '')); await pick(); expect(surfaces.pin?.title).toBe('Welcome, Sam!'); await pin('2468'); expect(surfaces.pin?.title).toBe('One more time!'); expect(document.title).toBe('Homeschool HQ') })
  it('continues after matching first-PIN confirmation', async () => { await mount(seeded(null, '')); await pick(); await pin('2468'); await pin('2468'); expect(document.title).toBe('Study Engine | Homeschool HQ') })
  it('rejects mismatched first-PIN confirmation', async () => { await mount(seeded(null, '')); await pick(); await pin('2468'); expect(await pin('1357')).toMatch(/did not match/); expect(document.title).toBe('Homeschool HQ') })
  it('exits through root navigation and restores the home title', async () => { await mount(); await pick(); await pin('1234'); expect(document.title).toBe('Study Engine | Homeschool HQ'); await act(async () => surfaces.engineExit?.()); expect(pathname).toBe('/'); expect(document.title).toBe('Homeschool HQ') })
  it('leaves the root pathname guarded on a fresh lifecycle', async () => { pathname = '/'; await mount(); expect(surfaces.picker).not.toBeNull() })
  it('preserves Reading and Math home entries without a Study Engine launch surface', async () => { pathname = '/'; await mount(); await pick(); await pin('1234'); const text = renderedText(container); expect(text).toContain('Reading'); expect(text).toContain('Daily Practice'); expect(text).not.toContain('Study Engine'); expect(document.title).toBe('Homeschool HQ'); expect(surfaces.picker).toBeNull() })
  it('preserves the parent PIN guard and parent hub', async () => { const state = seeded(null); state.parentPin = '4321'; await mount(state); await act(async () => surfaces.picker?.onGrownUps()); expect(surfaces.pin?.title).toBe('Grown-Ups only'); await pin('4321'); expect(surfaces.parentHub).toBe(true); expect(document.title).toBe('Homeschool HQ') })
  it('balances one popstate listener per mount across teardown', async () => { await mount(); expect(adds.filter((x) => x === 'popstate')).toHaveLength(1); await act(async () => root?.unmount()); root = null; expect(removes.filter((x) => x === 'popstate')).toHaveLength(1) })
  it('restores the document title after Study Engine teardown', async () => { document.title = 'Original'; await mount(); await pick(); await pin('1234'); expect(document.title).toBe('Study Engine | Homeschool HQ'); await act(async () => root?.unmount()); root = null; expect(document.title).toBe('Original') })
})

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'
import type { AcademyRoute } from './academy/academyRoute'

// CURR-1 academy route lifecycle. Harness adapted from
// App.studyRouteLifecycle.test.tsx (MOUNT-2/A4-X patterns): the academy surface
// itself is mocked so these tests exercise App's flag gating, deep-link boot
// evaluation, URL normalization, and cross-profile isolation — not the academy
// internals (covered by academy/*.test.ts and the browser walkthroughs).

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  academy: null as null | {
    profileId: string
    grade: string
    route: AcademyRoute
    onNavigate: (route: AcademyRoute) => void
    onExit: () => void
  },
}))

vi.mock('./sync/useSync', () => ({
  useSync: () => ({
    status: { user: null, binding: 'none', provenance: 'unverified' },
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
vi.mock('./components/academy/AcademyRouter', () => ({
  AcademyRouter: (props: {
    profile: { id: string }
    grade: string
    route: AcademyRoute
    onNavigate: (route: AcademyRoute) => void
    onExit: () => void
  }) => {
    harness.academy = {
      profileId: props.profile.id,
      grade: props.grade,
      route: props.route,
      onNavigate: props.onNavigate,
      onExit: props.onExit,
    }
    return <main data-surface="academy">Manuel Academy surface ({props.route.kind})</main>
  },
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

/** p2 is the family's 4th grader seed; CURR-1's real use case is Dad advancing
 * her grade to '5', which is what this seeding simulates. p1 stays grade 3. */
function seeded(active: string | null): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin: '1234' }
  state.profiles.p2 = { ...state.profiles.p2, name: 'Riley', pin: '2222', grade: '5' }
  state.activeProfileId = active
  return state
}

/** Reads the harness through a call so a mid-test `harness.academy = null`
 * assignment cannot narrow later reads to `never`. */
function currentAcademy(): typeof harness.academy {
  return harness.academy
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}

describe('App academy route lifecycle (CURR-1)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    harness.academy = null
    root = null
    pathname = '/academy'
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
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

  it('boots onto the academy surface for a deep link with a persisted grade-5 profile', async () => {
    pathname = '/academy/course/ma-g5-mathematics/unit/2/lesson/ma-g5-mathematics-u02-l03'
    await mountApp(seeded('p2'))
    expect(harness.picker).toBeNull()
    expect(harness.academy).not.toBeNull()
    expect(harness.academy!.profileId).toBe('p2')
    expect(harness.academy!.grade).toBe('5')
    expect(harness.academy!.route).toEqual({
      kind: 'lesson',
      courseId: 'ma-g5-mathematics',
      unitNumber: 2,
      lessonId: 'ma-g5-mathematics-u02-l03',
    })
    // deep-link pathname is left untouched on entry (A4-X: exit normalizes, entry never writes)
    expect(pathname).toBe('/academy/course/ma-g5-mathematics/unit/2/lesson/ma-g5-mathematics-u02-l03')
  })

  it('re-enters the academy after a refresh-equivalent remount mid-lesson', async () => {
    pathname = '/academy/schedule'
    await mountApp(seeded('p2'))
    expect(harness.academy?.route).toEqual({ kind: 'schedule' })
    await act(async () => root?.unmount())
    root = null
    harness.academy = null
    container = documentTarget.createElement('div')
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    await mountApp(persisted)
    expect(currentAcademy()?.route).toEqual({ kind: 'schedule' })
    expect(harness.picker).toBeNull()
  })

  it('in-surface navigation keeps the URL in sync for deep-link refreshes', async () => {
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.academy?.route).toEqual({ kind: 'home' })
    await act(async () => {
      harness.academy!.onNavigate({ kind: 'course', courseId: 'ma-g5-science' })
    })
    await settle()
    expect(pathname).toBe('/academy/course/ma-g5-science')
    expect(harness.academy?.route).toEqual({ kind: 'course', courseId: 'ma-g5-science' })
  })

  it('keeps the picker when the grade flag is disabled', async () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', '')
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('a truthy-typo flag value never enables the academy', async () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'TRUE')
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('keeps the picker for a non-academy grade behind an /academy deep link (isolation)', async () => {
    pathname = '/academy'
    await mountApp(seeded('p1')) // Sam, grade 3
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('keeps the picker for a signed-out direct link', async () => {
    await mountApp(seeded(null))
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('exit + sign-out normalize the URL so the next learner cannot re-enter (A4-X)', async () => {
    pathname = '/academy/course/ma-g5-mathematics'
    await mountApp(seeded('p2'))
    expect(harness.academy).not.toBeNull()
    await act(async () => harness.academy!.onExit())
    await settle()
    expect(pathname).toBe('/')
    expect(hasText(container, 'Hi, Riley!')).toBe(true)
    // her home shows the academy entry card
    expect(findButton('Manuel Academy')).not.toBeNull()
    await press(findButton('Sign out'))
    expect(harness.picker).not.toBeNull()
    await act(async () => harness.picker?.onPick('p1'))
    expect(harness.pin?.title).toBe('Hi, Sam!')
    await act(async () => { harness.pin?.onComplete('1234') })
    await settle()
    // Sam (grade 3) gets her normal home — no academy surface, no academy card
    expect(hasText(container, 'Hi, Sam!')).toBe(true)
    expect(harness.academy).not.toBeNull() // stale record from Riley's visit…
    expect(hasText(container, 'Manuel Academy surface')).toBe(false) // …but not rendered
    expect(findButton('Manuel Academy')).toBeNull()
  })
})

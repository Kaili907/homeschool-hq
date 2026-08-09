import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { isoToday } from './appState'
import { defaultAppState } from './migration'
import type { AppState } from './types'

// MOUNT-G5-MATH route lifecycle. Harness adapted from
// App.academyRouteLifecycle.test.tsx. The practice surface itself is NOT mocked:
// the flag-off assertions have to be made against the rendered surface, so these
// tests look for the real picker copy the child would see.

const harness = vi.hoisted(() => ({
  picker: null as null | { onStudentSelect: (id: string) => void; onParentLogin: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  dashboard: null as null | {
    profileId: string
    tools: readonly { id: string; title: string; description: string; onOpen: () => void }[]
    onSignOut: () => void
  },
}))

vi.mock('./sync/useSync', () => ({
  useSync: () => ({
    status: { user: null, binding: 'none', provenance: 'unverified' },
  }),
}))
vi.mock('./components/Picker', () => ({
  Picker: (props: { onStudentSelect: (id: string) => void; onParentLogin: () => void }) => {
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
    profile: { id: string; name: string }
    dashboard?: {
      tools?: readonly { id: string; title: string; description: string; onOpen: () => void }[]
      onSignOut: () => void
    }
  }) => {
    if (!props.dashboard) {
      return <main data-surface="student-dashboard">Student Dashboard unavailable</main>
    }
    const tools = props.dashboard.tools ?? []
    harness.dashboard = {
      profileId: props.profile.id,
      tools,
      onSignOut: props.dashboard.onSignOut,
    }
    return (
      <main data-surface="student-dashboard">
        Student Dashboard for {props.profile.name}
        {tools.map((tool) => (
          <button key={tool.id} onClick={tool.onOpen}>
            {tool.title} {tool.description}
          </button>
        ))}
        <button onClick={props.dashboard.onSignOut}>Sign out</button>
      </main>
    )
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

/** p2 is the family's 4th grader seed; Dad advancing her to grade '5' is the
 * real use case this card serves. p1 stays grade 3. */
function seeded(active: string | null): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin: '1234' }
  state.profiles.p2 = { ...state.profiles.p2, name: 'Riley', pin: '2222', grade: '5' }
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

/** The exact copy a fifth grader sees on the practice surface. */
const SURFACE_MARKER = 'Pick the unit you want to practice.'

describe('App Grade 5 math practice route lifecycle (MOUNT-G5-MATH)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    harness.dashboard = null
    root = null
    pathname = '/practice/grade-5-math'
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', 'true')
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

  /** The surface is a lazy chunk; give Suspense a few ticks to resolve it. */
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

  /** Settles well past any lazy-chunk resolution, then proves the surface never appeared. */
  async function expectSurfaceUnreachable() {
    for (let tick = 0; tick < 5; tick++) await settle()
    expect(hasText(container, SURFACE_MARKER)).toBe(false)
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

  async function signIn(profileId: string, pin: string) {
    await act(async () => harness.picker?.onStudentSelect(profileId))
    await act(async () => { harness.pin?.onComplete(pin) })
    await settle()
  }

  // ---------- flag ON ----------

  it('boots onto the practice surface for a deep link with a persisted grade-5 profile', async () => {
    await mountApp(seeded('p2'))
    await waitForSurface()
    expect(harness.picker).toBeNull()
    expect(hasText(container, 'Unit 10')).toBe(true)
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p2.missions[isoToday()]).toBeUndefined()
    // entry never writes the URL (A4-X: exit normalizes, entry leaves it alone)
    expect(pathname).toBe('/practice/grade-5-math')
  })

  it('re-enters the surface after a refresh-equivalent remount', async () => {
    await mountApp(seeded('p2'))
    await waitForSurface()
    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    await mountApp(persisted)
    await waitForSurface()
  })

  it('opens from her dashboard tool and answers one question with feedback', async () => {
    pathname = '/'
    await mountApp(seeded(null))
    await signIn('p2', '2222')
    expect(hasText(container, 'Student Dashboard for Riley')).toBe(true)
    expect(harness.dashboard?.profileId).toBe('p2')
    expect(harness.dashboard?.tools.some((tool) => tool.id === 'grade-5-math')).toBe(true)

    await press(findButton('Grade 5 Math'))
    await waitForSurface()

    await press(findButton('Unit 6'))
    expect(hasText(container, 'Unit 6 — Multiplying Fractions and Scaling')).toBe(true)
    expect(hasText(container, '1/10')).toBe(true)

    // answer the first choice; either verdict is real feedback for her
    const answerButtons: FakeElement[] = []
    const collect = (node: FakeElement) => {
      if (node.tagName === 'BUTTON' && !hasText(node, '✕')) answerButtons.push(node)
      node.childNodes.forEach(collect)
    }
    collect(container)
    await press(answerButtons[0])
    const gotVerdict =
      hasText(container, 'Nice — that is right! ✓') || hasText(container, 'Not quite. The answer is')
    expect(gotVerdict).toBe(true)
  })

  it('exit normalizes the URL so a later refresh does not re-enter', async () => {
    await mountApp(seeded('p2'))
    await waitForSurface()
    await press(findButton('Back home'))
    expect(hasText(container, 'Student Dashboard for Riley')).toBe(true)
    await settle()
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p2.missions[isoToday()]).toBeDefined()
    expect(pathname).toBe('/')
  })

  it('sign-out normalizes a lingering practice pathname', async () => {
    await mountApp(seeded('p2'))
    await waitForSurface()
    await press(findButton('Back home'))
    expect(hasText(container, 'Student Dashboard for Riley')).toBe(true)
    pathname = '/practice/grade-5-math'
    await press(findButton('Sign out'))
    expect(harness.picker).not.toBeNull()
    expect(pathname).toBe('/')
  })

  it('never offers the surface to a non-grade-5 profile, flag on', async () => {
    await mountApp(seeded('p1')) // Sam, grade 3
    expect(harness.picker).not.toBeNull()
    await expectSurfaceUnreachable()
    await signIn('p1', '1234')
    expect(hasText(container, 'Student Dashboard for Sam')).toBe(true)
    expect(harness.dashboard?.profileId).toBe('p1')
    await expectSurfaceUnreachable()
    expect(findButton('Grade 5 Math')).toBeNull()
  })

  it('keeps the picker for a signed-out direct link', async () => {
    await mountApp(seeded(null))
    expect(harness.picker).not.toBeNull()
    await expectSurfaceUnreachable()
  })

  // ---------- flag OFF: the surface must be unreachable by any route ----------

  it('a flag-off direct URL never reaches the surface', async () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', '')
    await mountApp(seeded('p2'))
    expect(harness.picker).not.toBeNull()
    await expectSurfaceUnreachable()
  })

  it('a flag-off grade-5 profile signing in gets her dashboard with no entry point', async () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', '')
    await mountApp(seeded('p2'))
    await signIn('p2', '2222')
    expect(hasText(container, 'Student Dashboard for Riley')).toBe(true)
    expect(findButton('Grade 5 Math')).toBeNull()
    await expectSurfaceUnreachable()
  })

  it('an absent flag never reaches the surface', async () => {
    vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', undefined as unknown as string)
    await mountApp(seeded('p2'))
    expect(harness.picker).not.toBeNull()
    await expectSurfaceUnreachable()
  })

  it.each(['TRUE', 'True', '1', 'yes', 'on', ' true'])(
    'a truthy-typo flag value (%s) never reaches the surface',
    async (value) => {
      vi.stubEnv('VITE_GRADE5_MATH_PRACTICE_ENABLED', value)
      await mountApp(seeded('p2'))
      expect(harness.picker).not.toBeNull()
      await expectSurfaceUnreachable()
      await signIn('p2', '2222')
      expect(findButton('Grade 5 Math')).toBeNull()
    },
  )
})

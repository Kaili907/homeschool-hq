import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState } from './types'

// STUDY-A1-PROD-DASH-1 Phases 11 and 13, asserted against the running App.
//
// The production Study screen used to run `dashboard:read`, throw the response
// away and print one fixed sentence. This file pins the replacement: the real
// rows reach the screen, the readiness gate in front of them is untouched, and
// production still exposes no session surface.

const SESSION_REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  syncUser: null as null | { id: string; email: string },
  /** Flipped before mount to exercise the readiness gate. */
  readiness: 'ready' as 'ready' | 'not-ready',
  operations: [] as string[],
  bodies: {} as Record<string, unknown>,
}))

vi.mock('./study/client/studyProductionReadinessClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./study/client/studyProductionReadinessClient')>()
  const wire = () => Object.freeze({
    schemaVersion: 1 as const,
    status: harness.readiness,
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
  })
  return {
    ...actual,
    createStudyProductionReadinessClient: () => Object.freeze({
      read: async () => wire(),
      revalidate: async () => wire(),
      invalidate: () => {},
    }),
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
    return <main data-surface="picker">Who is learning today?</main>
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
  removeChild(child: FakeElement) {
    this.childNodes = this.childNodes.filter((item) => item !== child)
    child.parentNode = null
    return child
  }
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
    this.documentElement.ownerDocument = this; this.body.ownerDocument = this
    this.activeElement = this.body
  }
  createElement(tag: string) { const e = new FakeElement(tag); e.ownerDocument = this; return e }
  createElementNS(_ns: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) {
    const e = this.createElement('#text'); e.nodeType = 3; e.nodeName = '#text'; e.textContent = value; return e
  }
}

function walk(node: FakeElement): FakeElement[] {
  return [node, ...node.childNodes.flatMap(walk)]
}
function renderedText(node: FakeElement): string {
  return walk(node).map((entry) => entry.textContent).join(' ')
}
function tags(node: FakeElement, tag: string): FakeElement[] {
  return walk(node).filter((entry) => entry.tagName === tag)
}
function hasText(node: FakeElement, needle: string): boolean {
  return renderedText(node).replaceAll(/\s+/g, '').includes(needle.replaceAll(/\s+/g, ''))
}
function attribute(node: FakeElement, name: string, value: string): FakeElement[] {
  return walk(node).filter((entry) => entry.getAttribute(name) === value)
}
function reactProps(node: FakeElement): { onClick: () => void } {
  const key = Object.keys(node).find((name) => name.startsWith('__reactProps$'))
  if (!key) throw new Error('React props are not attached to this node.')
  return (node as unknown as Record<string, { onClick: () => void }>)[key]!
}

function seeded(active: string | null): AppState {
  const state = defaultAppState()
  state.profiles.p1 = { ...state.profiles.p1, name: 'Sam', pin: '1234' }
  state.activeProfileId = active
  return state
}

const SESSIONS = {
  sessions: [{
    sessionId: 'study-session-01',
    state: 'paused',
    lessonId: 'math.g5.u2.l3',
    revision: 4,
    updatedAt: '2026-08-06T18:05:00+00:00',
  }],
}
const BLOCKS = {
  blocks: [{
    blockId: 'calendar-block-01',
    blockType: 'lesson',
    sourceReference: 'math.g5.u2.l3',
    scheduledStart: '2026-08-07T13:00:00+00:00',
    intendedLocalDate: '2026-08-07',
    state: 'scheduled',
    revision: 1,
  }],
}

/** The real Study endpoints, so a production launch and both reads complete. */
function studyFetch(url: unknown, init?: { body?: string }) {
  const target = String(url)
  if (target.includes('/session/issue')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        status: 'issued',
        sessionReference: SESSION_REFERENCE,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      }),
    })
  }
  if (target.includes('/session/verify')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({
        schemaVersion: 1,
        status: 'verified',
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      }),
    })
  }
  if (target.includes('/academic-runtime')) {
    const request = JSON.parse(init?.body ?? '{}') as { operation: string }
    harness.operations.push(request.operation)
    const body = Object.hasOwn(harness.bodies, request.operation)
      ? harness.bodies[request.operation]
      : request.operation === 'dashboard:read' ? SESSIONS : BLOCKS
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({ schemaVersion: 1, status: 'ok', operation: request.operation, body }),
    })
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => null })
}

describe('App production Study surface (STUDY-A1-PROD-DASH-1)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let storage: MemStorage
  let pathname: string

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    harness.syncUser = { id: 'household-a', email: 'household-a@example.com' }
    harness.readiness = 'ready'
    harness.operations = []
    harness.bodies = {}
    root = null
    pathname = '/'
    vi.stubEnv('VITE_STUDY_ENGINE_ENABLED', 'true')
    vi.stubEnv('VITE_STUDY_ENGINE_PREVIEW', 'false')
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

  async function signInAndOpenStudy(): Promise<void> {
    storage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(seeded(null)))
    const App = (await import('./App')).default
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(<App />))
    await settle()
    await act(async () => { harness.picker!.onPick('p1') })
    await settle()
    await act(async () => { harness.pin!.onComplete('1234') })
    await settle()
    const open = tags(container, 'BUTTON').find((node) => hasText(node, 'Study plan'))
    if (!open) throw new Error('The home Study card is not rendered.')
    await act(async () => { reactProps(open).onClick() })
    await settle()
  }

  function dashboard(): FakeElement | null {
    return attribute(container, 'data-surface', 'verified-study-dashboard')[0] ?? null
  }

  it('renders the verified dashboard with rows from both server reads', async () => {
    await signInAndOpenStudy()
    await waitFor(() => dashboard()?.getAttribute('data-view') === 'ready', 'the verified dashboard')

    expect(harness.operations.sort()).toEqual(['calendar:read', 'dashboard:read'])
    const rendered = renderedText(dashboard()!)
    expect(rendered).toContain('Scheduled Study blocks')
    expect(rendered).toContain('Recent Study sessions')
    // Real server values, not a fixed liveness sentence.
    expect(rendered).toContain('2026-08-07')
    expect(rendered).toContain('math.g5.u2.l3')
    expect(rendered).toContain('Paused')
  })

  it('has retired the placeholder liveness sentence entirely', async () => {
    await signInAndOpenStudy()
    await waitFor(() => dashboard() !== null, 'the verified dashboard')
    const rendered = renderedText(container)
    expect(rendered).not.toContain('Verified Study workspace')
    expect(rendered).not.toContain('Your Study workspace is ready for this learner.')
  })

  it('keeps the readiness gate: not-ready shows StudyUnavailable and reads nothing', async () => {
    harness.readiness = 'not-ready'
    await signInAndOpenStudy()
    await settle()
    expect(dashboard()).toBeNull()
    expect(hasText(container, 'Study is not available yet')).toBe(true)
    // The gate is in front of the reads, not behind them.
    expect(harness.operations).toEqual([])
  })

  it('exposes no session surface and no session launch control in production', async () => {
    await signInAndOpenStudy()
    await waitFor(() => dashboard()?.getAttribute('data-view') === 'ready', 'the verified dashboard')
    const buttons = tags(dashboard()!, 'BUTTON')
    expect(buttons).toHaveLength(1)
    expect(hasText(buttons[0]!, 'Back home')).toBe(true)
    expect(harness.operations).not.toContain('session:begin')
    expect(harness.operations).not.toContain('session:transition')
    expect(harness.operations).not.toContain('checkpoint:read')
  })

  it('shows nothing of a plan whose session list the server malformed', async () => {
    harness.bodies = { 'dashboard:read': { sessions: [{ sessionId: 'study-session-01' }] } }
    await signInAndOpenStudy()
    await waitFor(() => dashboard()?.getAttribute('data-view') === 'malformed', 'the refusal')
    const rendered = renderedText(dashboard()!)
    expect(rendered).not.toContain('2026-08-07')
    expect(rendered).not.toContain('math.g5.u2.l3')
  })

  it('returns home without leaving a Study surface mounted', async () => {
    await signInAndOpenStudy()
    await waitFor(() => dashboard()?.getAttribute('data-view') === 'ready', 'the verified dashboard')
    const back = tags(dashboard()!, 'BUTTON')[0]!
    await act(async () => { reactProps(back).onClick() })
    await settle()
    expect(dashboard()).toBeNull()
  })
})

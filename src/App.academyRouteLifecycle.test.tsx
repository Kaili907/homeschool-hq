import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_STATE_STORAGE_KEY } from './sync/provenance'
import { defaultAppState } from './migration'
import type { AppState, Profile } from './types'
import type { AcademyRoute } from './academy/academyRoute'
import type { StudentDashboardComposition } from './components/academy/dashboard/StudentDashboard'
import { buildLegacyMissionData } from './components/academy/dashboard/legacyMissionData'

// UI-HOME-1 default-home lifecycle. The Academy surface is mocked so these tests
// exercise App's picker/PIN boundary, dashboard composition, deep links, URL
// normalization, and state preservation rather than AcademyRouter internals.

const harness = vi.hoisted(() => ({
  picker: null as null | { onPick: (id: string) => void; onGrownUps: () => void },
  pin: null as null | { title: string; onComplete: (pin: string) => string | null; onCancel: () => void },
  academy: null as null | {
    profile: Profile
    entries: { subject: string; level: string }[]
    route: AcademyRoute
    onNavigate: (route: AcademyRoute) => void
    onExit: () => void
    dashboard?: StudentDashboardComposition
  },
  assistantMounts: 0,
  networkCalls: 0,
  mediaRequests: 0,
  speechCalls: 0,
  admin: false,
  adminShouldFail: false,
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
    profile: Profile
    entries: { subject: string; level: string }[]
    route: AcademyRoute
    onNavigate: (route: AcademyRoute) => void
    onExit: () => void
    dashboard?: StudentDashboardComposition
  }) => {
    harness.academy = {
      profile: props.profile,
      entries: props.entries,
      route: props.route,
      onNavigate: props.onNavigate,
      onExit: props.onExit,
      dashboard: props.dashboard,
    }
    return <main data-surface="academy">Manuel Academy surface ({props.route.kind})</main>
  },
}))
vi.mock('./components/assistant/AssistantOrb', () => ({
  AssistantOrb: () => {
    harness.assistantMounts += 1
    return (
      <section data-surface="assistant-orb">
        <label>Assistant prompt<input aria-label="Assistant prompt" /></label>
        <button>Talk microphone</button>
        <button>Send</button>
      </section>
    )
  },
}))
vi.mock('./components/admin/AdminConsoleRoute', () => ({
  AdminConsoleRoute: () => {
    if (harness.adminShouldFail) throw new Error('simulated Admin route failure')
    harness.admin = true
    return <main data-surface="admin">Admin Console</main>
  },
}))
vi.mock('./tutor/voice', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./tutor/voice')>()),
  purgeVoiceCache: async () => {},
  speak: () => { harness.speechCalls += 1 },
  cancelSpeech: () => { harness.speechCalls += 1 },
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
  state.profiles.p3 = { ...state.profiles.p3, name: 'Morgan', pin: '3333', grade: '6' }
  state.profiles.p4 = { ...state.profiles.p4, name: 'Taylor', pin: '4444', grade: '10' }
  state.profiles.p5 = { ...state.profiles.p5, name: 'Jordan', pin: '5555', grade: '12' }
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

function findButton(label: string, node: FakeElement): FakeElement | null {
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
  if (!key) throw new Error(`No React props on <${button!.tagName}>`)
  const props = (button as unknown as Record<string, { onClick?: () => void }>)[key]
  if (!props.onClick) throw new Error(`No onClick on <${button!.tagName}>`)
  await act(async () => props.onClick!())
}

describe('App academy route and default-home lifecycle (UI-HOME-1)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let pathname: string

  beforeEach(() => {
    harness.picker = null
    harness.pin = null
    harness.academy = null
    harness.assistantMounts = 0
    harness.networkCalls = 0
    harness.mediaRequests = 0
    harness.speechCalls = 0
    harness.admin = false
    harness.adminShouldFail = false
    root = null
    pathname = '/academy'
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'true')
    vi.stubEnv('VITE_ACADEMY_GRADE_7_ENABLED', 'true')
    vi.stubEnv('VITE_ACADEMY_GRADE_8_ENABLED', 'true')
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
    vi.stubGlobal('fetch', async () => {
      harness.networkCalls += 1
      return { ok: true }
    })
    vi.stubGlobal('navigator', {
      onLine: true,
      userAgent: 'Vitest',
      mediaDevices: {
        getUserMedia: async () => {
          harness.mediaRequests += 1
          return {}
        },
      },
    })
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    vi.useRealTimers()
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

  async function resetMountedApp() {
    if (root) await act(async () => root?.unmount())
    root = null
    harness.picker = null
    harness.pin = null
    harness.academy = null
    localStorage.clear()
    container = documentTarget.createElement('div')
  }

  it('boots onto the academy surface for a deep link with a persisted grade-5 profile', async () => {
    pathname = '/academy/course/ma-g5-mathematics/unit/2/lesson/ma-g5-mathematics-u02-l03'
    const state = seeded('p2')
    state.profiles.p2 = { ...state.profiles.p2, missions: {} }
    await mountApp(state)
    expect(harness.picker).toBeNull()
    expect(harness.academy).not.toBeNull()
    expect(harness.academy!.profile.id).toBe('p2')
    // ACADEMY-LEVEL-DECOUPLE: with no working level assigned, every subject
    // rides her nominal grade — the pre-decouple behaviour, expressed per subject.
    expect(harness.academy!.entries.length).toBe(10)
    expect(harness.academy!.entries.every((e) => e.level === '5')).toBe(true)
    expect(harness.academy!.route).toEqual({
      kind: 'lesson',
      courseId: 'ma-g5-mathematics',
      unitNumber: 2,
      lessonId: 'ma-g5-mathematics-u02-l03',
    })
    // deep-link pathname is left untouched on entry (A4-X: exit normalizes, entry never writes)
    expect(pathname).toBe('/academy/course/ma-g5-mathematics/unit/2/lesson/ma-g5-mathematics-u02-l03')
    expect(harness.academy!.dashboard?.mission?.day).toBeUndefined()
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p2.missions).toEqual({})
  })

  it('does not create a mission day from direct Academy course navigation', async () => {
    pathname = '/academy/course/ma-g5-mathematics'
    const state = seeded('p2')
    state.profiles.p2 = { ...state.profiles.p2, missions: {} }
    await mountApp(state)

    expect(harness.academy?.route).toEqual({ kind: 'course', courseId: 'ma-g5-mathematics' })
    expect(harness.academy?.dashboard?.mission?.day).toBeUndefined()
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p2.missions).toEqual({})
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

  it('keeps a persisted learner at the picker on the root bootstrap', async () => {
    pathname = '/'
    await mountApp(seeded('p2'))
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('keeps mission and Academy progress while toggling and navigating the dashboard', async () => {
    pathname = '/academy'
    const state = seeded('p2')
    const academyProgress = {
      releaseVersion: '1.0.0',
      grade: '5' as const,
      enrolledAt: '2026-08-01T12:00:00.000Z',
      courseIds: ['ma-g5-mathematics'],
      lessons: {},
      assessments: {},
    }
    state.profiles.p2 = { ...state.profiles.p2, academy: academyProgress }
    await mountApp(state)
    expect(harness.academy?.route).toEqual({ kind: 'home' })

    const mission = harness.academy?.dashboard?.mission
    expect(mission?.day).toBeDefined()
    expect(mission?.day?.items.length).toBeGreaterThan(0)
    const itemId = mission!.day!.items[0].id
    await act(async () => mission!.onToggle(itemId, true))
    await settle()

    expect(harness.academy?.profile.academy).toEqual(academyProgress)
    expect(harness.academy?.dashboard?.mission?.day?.items.find((item) => item.id === itemId)?.done).toBe(true)
    const toggledDay = harness.academy!.dashboard!.mission!.day

    await act(async () => {
      harness.academy!.onNavigate({ kind: 'course', courseId: 'ma-g5-science' })
    })
    await settle()
    expect(pathname).toBe('/academy/course/ma-g5-science')
    expect(harness.academy?.route).toEqual({ kind: 'course', courseId: 'ma-g5-science' })
    expect(harness.academy?.profile.academy).toEqual(academyProgress)
    expect(harness.academy?.dashboard?.mission?.day).toEqual(toggledDay)
  })

  it('mounts the dashboard with empty entries when the grade-5 flag is disabled', async () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', '')
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.picker).toBeNull()
    expect(harness.academy?.profile.id).toBe('p2')
    expect(harness.academy?.entries).toEqual([])
    expect(harness.academy?.route).toEqual({ kind: 'home' })
  })

  it('treats a truthy-typo grade flag as empty curriculum, not as an auth gate', async () => {
    vi.stubEnv('VITE_ACADEMY_GRADE_5_ENABLED', 'TRUE')
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.picker).toBeNull()
    expect(harness.academy?.entries).toEqual([])
  })

  it('mounts the dashboard for a persisted grade-6 learner with no Academy program', async () => {
    pathname = '/academy'
    await mountApp(seeded('p3'))
    expect(harness.picker).toBeNull()
    expect(harness.academy?.profile.id).toBe('p3')
    expect(harness.academy?.entries).toEqual([])
    expect(harness.academy?.route).toEqual({ kind: 'home' })
    expect(harness.academy?.dashboard).toBeDefined()
  })

  it('keeps the picker for a signed-out direct link', async () => {
    await mountApp(seeded(null))
    expect(harness.academy).toBeNull()
    expect(harness.picker).not.toBeNull()
  })

  it('recognizes the exact Admin prefix before learner Academy parsing, including nested routes', async () => {
    pathname = '/academy/admin/safety'
    await mountApp(seeded(null))
    expect(harness.admin).toBe(true)
    expect(harness.academy).toBeNull()
    expect(harness.picker).toBeNull()
  })

  it('does not treat /academy/administrator as an Admin route and leaves the learner app available', async () => {
    pathname = '/academy/administrator'
    await mountApp(seeded('p2'))
    expect(harness.admin).toBe(false)
    expect(harness.academy).not.toBeNull()
    expect(harness.academy?.route).toEqual({ kind: 'home' })
  })

  it('keeps the learner Academy available when the isolated Admin route would fail', async () => {
    harness.adminShouldFail = true
    pathname = '/academy'
    await mountApp(seeded('p2'))
    expect(harness.admin).toBe(false)
    expect(harness.academy).not.toBeNull()
    expect(harness.academy?.route).toEqual({ kind: 'home' })
  })

  it('sends every supported grade to the dashboard home after a successful PIN', async () => {
    const grades = ['3', '4', '5', '6', '7', '8', '10', '12'] as const
    for (const grade of grades) {
      await resetMountedApp()
      pathname = '/'
      const state = seeded(null)
      state.profiles.p1 = {
        ...state.profiles.p1,
        name: `Grade ${grade} learner`,
        grade,
        pin: '1234',
      }
      await mountApp(state)
      expect(harness.academy, `grade ${grade} should start at the picker`).toBeNull()
      expect(harness.picker, `grade ${grade} should start at the picker`).not.toBeNull()

      await act(async () => harness.picker!.onPick('p1'))
      expect(harness.pin?.title).toBe(`Hi, Grade ${grade} learner!`)
      await act(async () => {
        expect(harness.pin!.onComplete('1234')).toBeNull()
      })
      await settle()

      const expectedEntries = grade === '5' || grade === '7' || grade === '8' ? 10 : 0
      expect(harness.academy?.profile.id, `grade ${grade} profile`).toBe('p1')
      expect(harness.academy?.route, `grade ${grade} route`).toEqual({ kind: 'home' })
      expect(harness.academy?.entries.length, `grade ${grade} curriculum entries`).toBe(expectedEntries)
      expect(hasText(container, 'Manuel Academy surface (home)'), `grade ${grade} dashboard`).toBe(true)
      expect(hasText(container, `Hi, Grade ${grade} learner!`), `grade ${grade} legacy home`).toBe(false)
    }
  })

  it('keeps the classic workspace reachable through the dashboard tool callback', async () => {
    pathname = '/academy'
    await mountApp(seeded('p2'))
    const classicTool = harness.academy?.dashboard?.tools?.find((tool) => tool.id === 'classic-home')
    expect(classicTool).toBeDefined()

    await act(async () => classicTool!.onOpen())
    await settle()

    expect(pathname).toBe('/')
    expect(hasText(container, 'Manuel Academy surface')).toBe(false)
    expect(hasText(container, 'Hi, Riley!')).toBe(true)
  })

  it('opens an assistant-free high-school workspace while preserving legitimate tools', async () => {
    pathname = '/academy'
    const state = seeded('p5')
    state.profiles.p5 = { ...state.profiles.p5, assistant: undefined }
    await mountApp(state)
    expect(hasText(container, 'Manuel Academy surface (home)')).toBe(true)

    const workspace = harness.academy?.dashboard?.tools?.find((tool) => tool.id === 'classic-home')
    expect(workspace).toMatchObject({ title: 'High-school workspace' })
    await act(async () => workspace!.onOpen())
    await settle()

    expect(hasText(container, 'College-app deadlines')).toBe(true)
    expect(hasText(container, 'Service hours')).toBe(true)
    expect(hasText(container, 'Geometry practice')).toBe(true)
    expect(hasText(container, 'Algebra I warm-up')).toBe(true)
    expect(hasText(container, 'Timed quiz')).toBe(true)
    expect(hasText(container, 'Course progress')).toBe(true)
    expect(renderedText(container)).not.toMatch(/assistant prompt|school-day assistant|talk microphone|\bsend\b/i)
    await press(findButton('Start warm-up', container))
    await settle()
    expect(hasText(container, '1/5')).toBe(true)
    expect(harness.assistantMounts).toBe(0)
    expect(harness.networkCalls).toBe(0)
    expect(harness.mediaRequests).toBe(0)
    expect(harness.speechCalls).toBe(0)
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p5.assistant).toBeUndefined()
  })

  it('keeps Mindset non-actionable and out of Up Next before the existing unlock date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 22, 12))
    pathname = '/academy'
    const state = seeded('p3')
    state.mindsetStartDate = '2026-07-20'
    state.profiles.p3 = { ...state.profiles.p3, missions: {} }
    await mountApp(state)

    const mission = harness.academy?.dashboard?.mission
    const mindsetItem = mission?.day?.items.find((item) => item.id === 'mindset-lesson')
    expect(mindsetItem).toBeDefined()
    expect(mission?.launchableKinds).not.toContain('mindset')
    expect(harness.academy?.dashboard?.tools?.some((tool) => tool.id === 'mindset')).toBe(false)
    const mindsetOnly = buildLegacyMissionData({ items: [mindsetItem!] }, mission?.launchableKinds)
    expect(mindsetOnly.items[0]).toMatchObject({ action: 'none', upNextEligible: false })
    expect(mindsetOnly.upNext).toBeNull()

    await act(async () => mission?.onLaunch('mindset'))
    await settle()
    expect(hasText(container, 'Manuel Academy surface (home)')).toBe(true)
  })

  it('launches Mindset through the existing flow after unlock without completing on open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 6, 29, 12))
    pathname = '/academy'
    const state = seeded('p3')
    state.mindsetStartDate = '2026-07-20'
    state.profiles.p3 = { ...state.profiles.p3, missions: {} }
    await mountApp(state)

    const mission = harness.academy?.dashboard?.mission
    const mindsetItem = mission?.day?.items.find((item) => item.id === 'mindset-lesson')
    expect(mindsetItem).toMatchObject({ done: false, auto: true, autoKind: 'mindset' })
    expect(mission?.launchableKinds).toContain('mindset')
    expect(harness.academy?.dashboard?.tools?.some((tool) => tool.id === 'mindset')).toBe(true)
    const mindsetOnly = buildLegacyMissionData({ items: [mindsetItem!] }, mission?.launchableKinds)
    expect(mindsetOnly.items[0]).toMatchObject({ action: 'launch', upNextEligible: true })
    expect(mindsetOnly.upNext?.item.id).toBe('mindset-lesson')

    await act(async () => mission?.onLaunch('mindset'))
    await settle()
    expect(hasText(container, 'Your quiet corner')).toBe(true)
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.profiles.p3.missions['2026-07-29'].items.find((item) => item.id === 'mindset-lesson')?.done).toBe(false)
    expect(persisted.profiles.p3.mindset).toBeUndefined()
  })

  it('returns a deep Academy route to dashboard home, then signs out through the composition', async () => {
    pathname = '/academy/course/ma-g5-mathematics'
    const state = seeded('p2')
    state.profiles.p2 = { ...state.profiles.p2, missions: {} }
    await mountApp(state)
    expect(harness.academy?.route).toEqual({ kind: 'course', courseId: 'ma-g5-mathematics' })
    expect(harness.academy?.dashboard?.mission?.day).toBeUndefined()
    await act(async () => harness.academy!.onExit())
    await settle()
    expect(pathname).toBe('/')
    expect(harness.academy?.route).toEqual({ kind: 'home' })
    expect(harness.academy?.dashboard?.mission?.day).toBeDefined()
    expect(hasText(container, 'Hi, Riley!')).toBe(false)
    await act(async () => harness.academy!.dashboard!.onSignOut())
    await settle()
    expect(pathname).toBe('/')
    expect(harness.picker).not.toBeNull()
    expect(harness.academy).not.toBeNull() // the harness intentionally keeps the last Router props
    expect(hasText(container, 'Manuel Academy surface')).toBe(false)
    const persisted = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY)!) as AppState
    expect(persisted.activeProfileId).toBeNull()
  })
})

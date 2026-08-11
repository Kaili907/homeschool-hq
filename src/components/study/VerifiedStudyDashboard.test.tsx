import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  VerifiedRuntimeExecuteInput,
  VerifiedStudyRuntimeAdapter,
} from '../../study/production/verifiedRuntimeAdapter'
import { VerifiedStudyDashboard } from './VerifiedStudyDashboard'

// STUDY-A1-PROD-DASH-1 Phases 4-8, asserted against the rendered surface.
//
// The dashboard's whole safety claim is that it shows the server's answer or it
// shows nothing. So the malformed cases below check the absence of the GOOD
// half of the response too: a calendar that parsed cleanly must not reach the
// screen when the session list did not, and the other way round.

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
function text(node: FakeElement): string {
  return walk(node).map((entry) => entry.textContent).join(' ')
}
function tags(node: FakeElement, tag: string): FakeElement[] {
  return walk(node).filter((entry) => entry.tagName === tag)
}
function withAttribute(node: FakeElement, name: string): FakeElement[] {
  return walk(node).filter((entry) => entry.getAttribute(name) !== null)
}
function surface(node: FakeElement): FakeElement {
  const found = walk(node).find((entry) => entry.getAttribute('data-surface') === 'verified-study-dashboard')
  if (!found) throw new Error('The verified Study dashboard is not rendered.')
  return found
}

const SESSIONS = Object.freeze({
  sessions: [
    {
      sessionId: 'study-session-01',
      state: 'paused',
      lessonId: 'math.g5.u2.l3',
      revision: 4,
      updatedAt: '2026-08-06T18:05:00+00:00',
    },
  ],
})

const BLOCKS = Object.freeze({
  blocks: [
    {
      blockId: 'calendar-block-01',
      blockType: 'lesson',
      sourceReference: 'math.g5.u2.l3',
      scheduledStart: '2026-08-07T13:00:00+00:00',
      intendedLocalDate: '2026-08-07',
      state: 'scheduled',
      revision: 1,
    },
    {
      blockId: 'calendar-block-02',
      blockType: 'review',
      sourceReference: 'math.g5.u1.review',
      scheduledStart: '2026-08-06T13:00:00+00:00',
      intendedLocalDate: '2026-08-06',
      state: 'completed',
      revision: 2,
    },
    {
      blockId: 'calendar-block-03',
      blockType: 'assessment',
      sourceReference: 'math.g5.u2.check',
      scheduledStart: '2026-08-07T15:00:00+00:00',
      intendedLocalDate: '2026-08-07',
      state: 'available',
      revision: 1,
    },
  ],
})

/**
 * STUDY-A1-PROD-DASH-H2 Phase 4 — a calendar:read body of a given size.
 *
 * Every block is well formed and distinct, so a refusal in these cases can only
 * be the row cap and never a malformed row.
 */
function calendarOf(count: number): { readonly blocks: readonly unknown[] } {
  return Object.freeze({
    blocks: Array.from({ length: count }, (_value, index) => ({
      blockId: `calendar-block-${index}`,
      blockType: 'lesson',
      sourceReference: 'math.g5.u2.l3',
      scheduledStart:
        `2026-08-07T${String(9 + Math.floor(index / 60)).padStart(2, '0')}` +
        `:${String(index % 60).padStart(2, '0')}:00+00:00`,
      intendedLocalDate: '2026-08-07',
      state: 'scheduled',
      revision: 1,
    })),
  })
}

interface RuntimeProbe {
  readonly adapter: VerifiedStudyRuntimeAdapter
  readonly calls: VerifiedRuntimeExecuteInput[]
  readonly forbidden: string[]
}

function runtimeProbe(
  respond: (input: VerifiedRuntimeExecuteInput) => Promise<unknown>,
): RuntimeProbe {
  const calls: VerifiedRuntimeExecuteInput[] = []
  const forbidden: string[] = []
  const refuse = (name: string) => () => {
    forbidden.push(name)
    throw new Error(`The read-only dashboard called ${name}.`)
  }
  return {
    calls,
    forbidden,
    adapter: {
      execute: (input) => { calls.push(input); return respond(input) },
      launch: refuse('launch') as VerifiedStudyRuntimeAdapter['launch'],
      cancel: refuse('cancel') as VerifiedStudyRuntimeAdapter['cancel'],
      applyReadiness: refuse('applyReadiness') as VerifiedStudyRuntimeAdapter['applyReadiness'],
      snapshot: () => Object.freeze({ status: 'ready' as const, expiresAt: null }),
      isReady: () => true,
    },
  }
}

/** Serves both reads from fixed bodies, with per-operation overrides. */
function serving(bodies: Partial<Record<string, unknown>> = {}): RuntimeProbe {
  return runtimeProbe(async (input) => {
    if (Object.hasOwn(bodies, input.operation)) {
      const body = bodies[input.operation]
      if (body instanceof Error) throw body
      return body
    }
    return input.operation === 'dashboard:read' ? SESSIONS : BLOCKS
  })
}

describe('VerifiedStudyDashboard', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let backs: number

  beforeEach(() => {
    root = null
    backs = 0
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
    }) as unknown as EventTarget & Record<string, unknown>
    documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    vi.unstubAllGlobals()
  })

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 6; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  async function mount(probe: RuntimeProbe): Promise<void> {
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(
      <VerifiedStudyDashboard runtime={probe.adapter} onBack={() => { backs += 1 }} />,
    ))
    await settle()
  }

  function view(): string | null {
    return surface(container).getAttribute('data-view')
  }

  describe('runtime calls', () => {
    it('runs exactly dashboard:read and calendar:read with the documented requests', async () => {
      const probe = serving()
      await mount(probe)
      expect(view()).toBe('ready')
      expect(probe.calls.map((call) => call.operation).sort())
        .toEqual(['calendar:read', 'dashboard:read'])
      const dashboard = probe.calls.find((call) => call.operation === 'dashboard:read')!
      const calendar = probe.calls.find((call) => call.operation === 'calendar:read')!
      expect(dashboard.request).toEqual({})
      expect(calendar.request).toEqual({ cursor: null })
      expect(probe.forbidden).toEqual([])
    })

    it('gives every call a fresh unique operationRef', async () => {
      const probe = serving()
      await mount(probe)
      const refs = probe.calls.map((call) => call.operationRef)
      expect(refs).toHaveLength(2)
      expect(refs.every((ref) => typeof ref === 'string' && ref.length > 0)).toBe(true)
      expect(new Set(refs).size).toBe(refs.length)

      // A second mount is a second set of references, never a replay of the
      // first: the lifecycle quarantines a repeated reference as a duplicate.
      await act(async () => root?.unmount())
      root = null
      const second = serving()
      await mount(second)
      expect(new Set([...refs, ...second.calls.map((call) => call.operationRef)]).size).toBe(4)
    })

    it('honours the abort signal it passes, and aborts it on unmount', async () => {
      const probe = serving()
      await mount(probe)
      const signals = probe.calls.map((call) => call.signal)
      expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
      expect(signals.some((signal) => signal!.aborted)).toBe(false)
      await act(async () => root?.unmount())
      root = null
      expect(signals.every((signal) => signal!.aborted)).toBe(true)
    })

    it('never reaches for anything on the runtime except execute', async () => {
      const probe = serving()
      await mount(probe)
      expect(probe.forbidden).toEqual([])
    })
  })

  describe('rendering only what the server sent', () => {
    it('groups blocks by the household intended local date, in calendar order', async () => {
      await mount(serving())
      const days = withAttribute(surface(container), 'data-intended-local-date')
        .map((node) => node.getAttribute('data-intended-local-date'))
      expect(days).toEqual(['2026-08-06', '2026-08-07'])
    })

    it('shows each block type, scheduled start and state', async () => {
      await mount(serving())
      const rendered = text(surface(container))
      expect(rendered).toContain('Lesson')
      expect(rendered).toContain('Review')
      expect(rendered).toContain('Assessment')
      expect(rendered).toContain('2026-08-07T13:00:00+00:00')
      expect(rendered).toContain('Scheduled')
      expect(rendered).toContain('Available')
      const states = withAttribute(surface(container), 'data-block-state')
        .map((node) => node.getAttribute('data-block-state'))
      expect(states.sort()).toEqual(['available', 'completed', 'scheduled'])
    })

    it('shows each session lesson reference, state and updated time', async () => {
      await mount(serving())
      const rendered = text(surface(container))
      expect(rendered).toContain('math.g5.u2.l3')
      expect(rendered).toContain('Paused')
      expect(rendered).toContain('2026-08-06T18:05:00+00:00')
    })

    it('invents no title, subject, progress bar or review queue', async () => {
      await mount(serving())
      const rendered = text(surface(container)).toLowerCase()
      for (const invented of ['review queue', 'resume point', 'segment', 'subject', 'grade']) {
        expect(rendered).not.toContain(invented)
      }
      // No completion percentage: the server sends no such number for either read.
      expect(rendered).not.toMatch(/\d+\s?%/)
    })
  })

  describe('empty and error states', () => {
    it('says so honestly when there is nothing scheduled and nothing recent', async () => {
      await mount(serving({ 'dashboard:read': { sessions: [] }, 'calendar:read': { blocks: [] } }))
      expect(view()).toBe('ready')
      const rendered = text(surface(container))
      expect(rendered).toContain('No Study blocks are scheduled.')
      expect(rendered).toContain('No recent Study sessions.')
    })

    it('is loading until both reads answer', async () => {
      const probe = runtimeProbe(() => new Promise(() => {}))
      root = createRoot(container as unknown as Element)
      await act(async () => root?.render(
        <VerifiedStudyDashboard runtime={probe.adapter} onBack={() => {}} />,
      ))
      expect(view()).toBe('loading')
      expect(surface(container).getAttribute('aria-busy')).toBe('true')
    })

    it('reports a server failure without claiming anything about the plan', async () => {
      await mount(serving({ 'calendar:read': new Error('runtime_unavailable') }))
      expect(view()).toBe('unavailable')
      const rendered = text(surface(container))
      expect(rendered).toContain('Study could not be loaded right now.')
      expect(rendered).not.toContain('runtime_unavailable')
    })

    it('renders no part of the plan when the session list is malformed', async () => {
      await mount(serving({ 'dashboard:read': { sessions: [{ sessionId: 'study-session-01' }] } }))
      expect(view()).toBe('malformed')
      const rendered = text(surface(container))
      // The calendar read succeeded, and still nothing from it is on screen.
      expect(rendered).not.toContain('2026-08-07')
      expect(rendered).not.toContain('Lesson')
      expect(withAttribute(surface(container), 'data-block-state')).toEqual([])
      expect(rendered).toContain('Study could not show this plan safely')
    })

    it('renders no part of the plan when the calendar is malformed', async () => {
      await mount(serving({ 'calendar:read': { blocks: [{ blockId: 'calendar-block-01' }] } }))
      expect(view()).toBe('malformed')
      const rendered = text(surface(container))
      expect(rendered).not.toContain('math.g5.u2.l3')
      expect(rendered).not.toContain('Paused')
      expect(withAttribute(surface(container), 'data-session-state')).toEqual([])
    })

    it('refuses a body that carries an unknown field rather than showing the rest', async () => {
      await mount(serving({
        'calendar:read': {
          blocks: [{ ...BLOCKS.blocks[0], householdId: '11111111-2222-3333-4444-555555555555' }],
        },
      }))
      expect(view()).toBe('malformed')
      expect(text(surface(container))).not.toContain('11111111')
    })
  })

  // STUDY-A1-PROD-DASH-H2 Phase 3/4 — calendar:read returns at most 100 blocks
  // and no continuation cursor, so a full page is exactly the case where the
  // surface cannot know whether the plan ends there. The request does carry a
  // `cursor` key, but the server filters it as `id > cursor` while ordering by
  // `scheduled_start`, so a cursor derived from the last rendered block would
  // skip blocks rather than page through them. Saying so is the honest fix; the
  // dishonest one would be to paginate on a cursor that does not mean what the
  // ordering implies.
  describe('the server calendar block limit', () => {
    async function mountBlocks(count: number): Promise<FakeElement> {
      await mount(serving({ 'calendar:read': calendarOf(count) }))
      return surface(container)
    }

    it.each([0, 1, 99, 100])('renders every one of the %i blocks the server sent', async (count) => {
      const node = await mountBlocks(count)
      expect(view()).toBe('ready')
      expect(withAttribute(node, 'data-block-state')).toHaveLength(count)
    })

    it('claims nothing about a limit when the server sent no blocks', async () => {
      const node = await mountBlocks(0)
      expect(text(node)).toContain('No Study blocks are scheduled.')
      expect(withAttribute(node, 'data-block-limit')).toEqual([])
    })

    it.each([1, 99])('states the cap without warning of more at %i blocks', async (count) => {
      const node = await mountBlocks(count)
      const note = withAttribute(node, 'data-block-limit')
      expect(note).toHaveLength(1)
      expect(note[0]!.getAttribute('data-block-limit')).toBe('under')
      // Below the cap the server returned everything it had, so there is
      // nothing to warn about.
      expect(text(node)).toContain('Showing up to 100 scheduled Study blocks.')
      expect(text(node)).not.toContain('There may be more')
    })

    it('does not imply the plan is complete at exactly the limit', async () => {
      const node = await mountBlocks(100)
      const note = withAttribute(node, 'data-block-limit')
      expect(note).toHaveLength(1)
      expect(note[0]!.getAttribute('data-block-limit')).toBe('reached')
      const rendered = text(node)
      expect(rendered).toContain('Showing the first 100 scheduled Study blocks.')
      expect(rendered).toContain('There may be more that are not shown here.')
      // The claim that would be false at exactly the cap.
      expect(rendered).not.toContain('No Study blocks are scheduled.')
      // Scoped to the note itself: the rest of the surface renders server block
      // states like "Completed", which this must stay free to say.
      expect(text(note[0]!)).not.toMatch(/\ball\b|complete|every|entire|only/i)
    })

    it('refuses the whole body when the server sends more blocks than it may', async () => {
      await mount(serving({ 'calendar:read': calendarOf(101) }))
      expect(view()).toBe('malformed')
      expect(withAttribute(surface(container), 'data-block-state')).toEqual([])
      expect(withAttribute(surface(container), 'data-block-limit')).toEqual([])
    })

    it('offers no page, load-more or next control at the limit', async () => {
      const node = await mountBlocks(100)
      // The honest statement replaces pagination; it must not grow one.
      expect(tags(node, 'BUTTON')).toHaveLength(1)
      expect(text(tags(node, 'BUTTON')[0]!)).toContain('Back home')
      const rendered = text(node).toLowerCase()
      for (const control of ['load more', 'show more', 'next page', 'see all', 'view all']) {
        expect(rendered).not.toContain(control)
      }
    })
  })

  describe('read only', () => {
    it('offers navigation home and no Study control at all', async () => {
      await mount(serving())
      const buttons = tags(surface(container), 'BUTTON')
      expect(buttons).toHaveLength(1)
      expect(text(buttons[0]!)).toContain('Back home')
      expect(tags(surface(container), 'INPUT')).toEqual([])
      expect(tags(surface(container), 'TEXTAREA')).toEqual([])
      expect(tags(surface(container), 'FORM')).toEqual([])
      expect(tags(surface(container), 'SELECT')).toEqual([])
    })

    it('names no session control anywhere in its copy', async () => {
      await mount(serving())
      const rendered = text(surface(container)).toLowerCase()
      // Deliberately phrases, not bare words: `paused` and `completed` are
      // server states this surface must be free to report.
      for (const control of [
        'start session', 'start study', 'start lesson', 'continue',
        'resume session', 'pause session', 'mark complete',
        'settings', 'parent', 'tutor', 'ask a question',
      ]) {
        expect(rendered).not.toContain(control)
      }
    })

    it('goes back without cancelling or relaunching the runtime itself', async () => {
      const probe = serving()
      await mount(probe)
      const button = tags(surface(container), 'BUTTON')[0]!
      const key = Object.keys(button).find((name) => name.startsWith('__reactProps$'))!
      await act(async () => {
        ((button as unknown as Record<string, { onClick: () => void }>)[key]!).onClick()
      })
      expect(backs).toBe(1)
      // Cancelling the epoch is the App's decision, not this surface's.
      expect(probe.forbidden).toEqual([])
    })
  })

  describe('privacy', () => {
    it('puts no household, student, grant or token value on the screen', async () => {
      await mount(serving())
      const rendered = text(surface(container)).toLowerCase()
      for (const secret of [
        'household', 'student id', 'grant', 'token', 'capability',
        'checkpoint', 'bearer', 'aca_stu_v1',
      ]) {
        expect(rendered).not.toContain(secret)
      }
    })
  })
})

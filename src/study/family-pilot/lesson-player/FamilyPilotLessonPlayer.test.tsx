import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FamilyPilotStudySnapshot } from '../study'
import { FamilyPilotLessonPlayer } from './FamilyPilotLessonPlayer'
import type { FamilyPilotLessonPlayerProps } from './types'

// DOM harness adapted from Grade5MathPractice.test.tsx / AcademyLevelsPanel.test.tsx —
// this repo renders React against a minimal fake document rather than pulling in jsdom.

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
  disabled = false
  private ownValue: string | null = null
  private attributes = new Map<string, string>()
  get value(): string { return this.ownValue ?? this.getAttribute('value') ?? '' }
  set value(next: string) { this.ownValue = String(next) }
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

const squash = (value: string) => value.replaceAll(/\s+/g, '')

function hasText(node: FakeElement, needle: string): boolean {
  return squash(renderedText(node)).includes(squash(needle))
}

function reactProps(el: FakeElement): Record<string, unknown> {
  const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
  if (!key) throw new Error(`No React props on <${el.tagName}>`)
  return (el as unknown as Record<string, Record<string, unknown>>)[key]
}

function findAll(node: FakeElement, tag: string, out: FakeElement[] = []): FakeElement[] {
  if (node.tagName === tag) out.push(node)
  for (const child of node.childNodes) findAll(child, tag, out)
  return out
}

function baseSnapshot(overrides: Partial<FamilyPilotStudySnapshot> = {}): FamilyPilotStudySnapshot {
  return {
    session: { householdRef: 'household-1', learnerRef: 'learner-1', blockRef: 'block-1', sessionRef: 'block-1:session' },
    lessonRef: 'lesson-1',
    title: 'Grade 5 math study block',
    assignmentState: 'active',
    sessionStatus: 'active',
    segmentRef: 'segment-1',
    segmentOrdinal: 1,
    completedSegmentRefs: [],
    remainingSegmentRefs: ['segment-1', 'segment-2', 'segment-3'],
    elapsedActiveSecondsInSegment: 0,
    checkpointRef: null,
    checkpointRevision: 0,
    lastAcceptedEventRef: null,
    masteryAuthority: 'tutor-core',
    tutorBridgeAvailable: true,
    requiredWorkCompletionPercent: 100,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function noopHandlers() {
  return {
    onSubmitAction: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onNext: vi.fn(),
    onCompleteSegment: vi.fn(),
    onOpenTutor: vi.fn(),
    onExit: vi.fn(),
  }
}

describe('FamilyPilotLessonPlayer', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument
  let storageSetItem: ReturnType<typeof vi.fn>

  beforeEach(() => {
    root = null
    storageSetItem = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: storageSetItem,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    })
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
      location: { pathname: '/', protocol: 'test:' },
      history: { pushState: () => {}, replaceState: () => {} },
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
    vi.unstubAllGlobals()
  })

  async function render(element: ReactElement) {
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(element))
  }

  async function rerender(element: ReactElement) {
    await act(async () => root?.render(element))
  }

  function buttons(node: FakeElement = container, found: FakeElement[] = []): FakeElement[] {
    if (node.tagName === 'BUTTON') found.push(node)
    for (const child of node.childNodes) buttons(child, found)
    return found
  }

  function findButton(label: string): FakeElement | null {
    return buttons().find((b) => hasText(b, label)) ?? null
  }

  function findTextarea(): FakeElement | null {
    return findAll(container, 'TEXTAREA')[0] ?? null
  }

  // React writes boolean HTML attributes like `disabled` via setAttribute
  // presence/absence, not a `.disabled` property assignment.
  function isDisabled(el: FakeElement | null): boolean {
    return el?.getAttribute('disabled') !== null
  }

  async function press(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const onClick = reactProps(el!).onClick as (() => void) | undefined
    if (!onClick) throw new Error(`No onClick on <${el!.tagName}>`)
    await act(async () => { onClick() })
  }

  async function typeInto(el: FakeElement | null, value: string) {
    expect(el).not.toBeNull()
    const onChange = reactProps(el!).onChange as ((e: unknown) => void) | undefined
    if (!onChange) throw new Error(`No onChange on <${el!.tagName}>`)
    await act(async () => { onChange({ target: { value } }) })
  }

  function baseProps(overrides: Partial<FamilyPilotLessonPlayerProps> = {}): FamilyPilotLessonPlayerProps {
    return {
      status: 'active',
      snapshot: baseSnapshot(),
      ...noopHandlers(),
      ...overrides,
    }
  }

  it('renders the lesson title and current Study status', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    expect(hasText(container, 'Grade 5 math study block')).toBe(true)
    expect(hasText(container, 'Status: active')).toBe(true)
  })

  it('renders the current segment title and content', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({
      segmentContent: {
        title: 'Warm-up recall',
        instruction: 'Read the review card out loud.',
        prompt: 'What is 7 times 8?',
        example: '6 times 8 is 48, so 7 times 8 is 48 plus 6.',
      },
    })} />)
    expect(hasText(container, 'Warm-up recall')).toBe(true)
    expect(hasText(container, 'Read the review card out loud.')).toBe(true)
    expect(hasText(container, 'What is 7 times 8?')).toBe(true)
    expect(hasText(container, '6 times 8 is 48, so 7 times 8 is 48 plus 6.')).toBe(true)
  })

  it('renders step-number progress from the snapshot', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({
      snapshot: baseSnapshot({
        segmentOrdinal: 2,
        completedSegmentRefs: ['segment-1'],
        remainingSegmentRefs: ['segment-2', 'segment-3'],
      }),
    })} />)
    expect(hasText(container, 'Step 2 of 3')).toBe(true)
  })

  it('does not crash when snapshot and segment content are both missing', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({ snapshot: null, segmentContent: undefined })} />)
    expect(hasText(container, 'Current lesson')).toBe(true)
    expect(hasText(container, 'Current step')).toBe(true)
  })

  it('submits a typed free-text response and clears the field', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps(handlers)} />)
    const textarea = findTextarea()
    await typeInto(textarea, 'forty two')
    expect(findTextarea()!.value).toBe('forty two')
    await press(findButton('Submit'))
    expect(handlers.onSubmitAction).toHaveBeenCalledWith('forty two')
    expect(findTextarea()!.value).toBe('')
  })

  it('renders a disabled Submit button for empty or whitespace-only text', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    expect(isDisabled(findButton('Submit'))).toBe(true)
    await typeInto(findTextarea(), '   ')
    expect(isDisabled(findButton('Submit'))).toBe(true)
  })

  it('trims surrounding whitespace from a submitted response', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps(handlers)} />)
    await typeInto(findTextarea(), '  forty two  ')
    await press(findButton('Submit'))
    expect(handlers.onSubmitAction).toHaveBeenCalledWith('forty two')
  })

  it('reuses structured choices instead of forcing free text', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({
      ...handlers,
      segmentContent: {
        responseKind: 'choice',
        choices: [{ id: 'choice-a', label: '12' }, { id: 'choice-b', label: '19' }],
      },
    })} />)
    expect(findTextarea()).toBeNull()
    await press(findButton('19'))
    expect(handlers.onSubmitAction).toHaveBeenCalledWith('choice-b')
  })

  it('calls onNext for a segment that needs no learner response', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, segmentContent: { responseKind: 'none' } })} />)
    expect(findTextarea()).toBeNull()
    await press(findButton('Continue'))
    expect(handlers.onNext).toHaveBeenCalledTimes(1)
  })

  it('never persists the transient response text to storage', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    await typeInto(findTextarea(), 'a private answer')
    await press(findButton('Submit'))
    expect(storageSetItem).not.toHaveBeenCalled()
  })

  it('clears an unsent draft when the session identity changes (student switch)', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    await typeInto(findTextarea(), 'draft for learner-1')
    expect(findTextarea()!.value).toBe('draft for learner-1')

    // Same segment ref, only the session identity differs — isolates the
    // sessionKey dependency from the segmentRef dependency below.
    const otherLearner = baseSnapshot({
      session: { householdRef: 'household-1', learnerRef: 'learner-2', blockRef: 'block-9', sessionRef: 'block-9:session' },
      title: 'A different lesson',
    })
    await rerender(<FamilyPilotLessonPlayer {...baseProps({ snapshot: otherLearner })} />)
    expect(findTextarea()!.value).toBe('')
  })

  it('clears an unsent draft when the segment advances within the same session', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    await typeInto(findTextarea(), 'draft for segment-1')
    expect(findTextarea()!.value).toBe('draft for segment-1')

    const nextSegment = baseSnapshot({ segmentRef: 'segment-2', segmentOrdinal: 2 })
    await rerender(<FamilyPilotLessonPlayer {...baseProps({ snapshot: nextSegment })} />)
    expect(findTextarea()!.value).toBe('')
  })

  it('preserves an unsent draft across an unrelated prop change (same session, same segment)', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    await typeInto(findTextarea(), 'still typing')
    expect(findTextarea()!.value).toBe('still typing')

    // Same session, same segment — only an unrelated prop (busy) changes.
    await rerender(<FamilyPilotLessonPlayer {...baseProps({ busy: false })} />)
    expect(findTextarea()!.value).toBe('still typing')
  })

  it('shows the pause action while active, and calls onPause', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps(handlers)} />)
    await press(findButton('Pause'))
    expect(handlers.onPause).toHaveBeenCalledTimes(1)
  })

  it('shows a Resume action while paused, and calls onResume', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, status: 'paused' })} />)
    expect(hasText(container, 'paused')).toBe(true)
    await press(findButton('Resume'))
    expect(handlers.onResume).toHaveBeenCalledTimes(1)
  })

  it('offers Tutor help only when the host says it is available', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, tutorHelpAvailable: false })} />)
    expect(findButton('Ask the Tutor for help')).toBeNull()

    await rerender(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, tutorHelpAvailable: true })} />)
    await press(findButton('Ask the Tutor for help'))
    expect(handlers.onOpenTutor).toHaveBeenCalledTimes(1)
  })

  it('acknowledges completion-only work directly, with no response to grade', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({
      ...handlers,
      snapshot: baseSnapshot({ tutorBridgeAvailable: false, masteryAuthority: 'completion-only' }),
    })} />)
    expect(findTextarea()).toBeNull()
    await press(findButton('Mark step complete'))
    expect(handlers.onCompleteSegment).toHaveBeenCalledTimes(1)
  })

  it('does not offer completion-only acknowledgement when a Tutor mastery decision applies', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps()} />)
    expect(findButton('Mark step complete')).toBeNull()
  })

  it('renders a completed-lesson state and exits on Done', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, status: 'completed' })} />)
    expect(hasText(container, 'lesson complete')).toBe(true)
    await press(findButton('Done'))
    expect(handlers.onExit).toHaveBeenCalledTimes(1)
  })

  it('renders a loading state', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({ status: 'loading', snapshot: null })} />)
    expect(hasText(container, 'Preparing your Study session')).toBe(true)
  })

  it('renders a rejected/error state with the host message', async () => {
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps({
      ...handlers,
      status: 'error',
      snapshot: null,
      errorMessage: 'Study storage is not available on this device yet.',
    })} />)
    expect(hasText(container, 'Study storage is not available on this device yet.')).toBe(true)
    await press(findButton('Back'))
    expect(handlers.onExit).toHaveBeenCalledTimes(1)
  })

  it('falls back to a generic error message when the host supplies none', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({ status: 'error', snapshot: null })} />)
    expect(hasText(container, 'This lesson could not be loaded.')).toBe(true)
  })

  it('disables every action while a host action is in flight', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({ busy: true, tutorHelpAvailable: true })} />)
    // A real <button disabled> never dispatches a click, which is what
    // actually blocks these in the browser — asserted here as the attribute.
    for (const label of ['Submit', 'Pause']) expect(isDisabled(findButton(label))).toBe(true)
  })

  it('disables a choice button and the Continue action while busy', async () => {
    await render(<FamilyPilotLessonPlayer {...baseProps({
      busy: true,
      segmentContent: { responseKind: 'choice', choices: [{ id: 'choice-a', label: '12' }] },
    })} />)
    expect(isDisabled(findButton('12'))).toBe(true)

    await rerender(<FamilyPilotLessonPlayer {...baseProps({ busy: true, segmentContent: { responseKind: 'none' } })} />)
    expect(isDisabled(findButton('Continue'))).toBe(true)
  })

  it('guards Submit against firing while busy, even if a stale click reaches the handler', async () => {
    // handleSubmit carries its own isBusy check in addition to the disabled
    // attribute — this exercises that internal guard directly, independent
    // of whether the fake DOM enforces disabled-blocks-click like a browser.
    const handlers = noopHandlers()
    await render(<FamilyPilotLessonPlayer {...baseProps(handlers)} />)
    await typeInto(findTextarea(), 'an answer')
    await rerender(<FamilyPilotLessonPlayer {...baseProps({ ...handlers, busy: true })} />)
    await press(findButton('Submit'))
    expect(handlers.onSubmitAction).not.toHaveBeenCalled()
  })
})

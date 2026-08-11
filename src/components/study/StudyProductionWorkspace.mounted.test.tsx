import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StudyProductionControllerSnapshot } from '../../study/production/sessionController'
import {
  STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
  StudyProductionWorkspace,
  type StudyProductionContentSlot,
  type StudyProductionWorkspaceLaunch,
} from './StudyProductionWorkspace'

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
  private readonly attributes = new Map<string, string>()

  constructor(tag = 'div') {
    super()
    this.nodeName = tag.toUpperCase()
    this.tagName = tag.toUpperCase()
  }

  appendChild(child: FakeElement) {
    child.parentNode = this
    this.childNodes.push(child)
    return child
  }

  insertBefore(child: FakeElement, before: FakeElement | null) {
    child.parentNode = this
    const index = before ? this.childNodes.indexOf(before) : -1
    if (index < 0) this.childNodes.push(child)
    else this.childNodes.splice(index, 0, child)
    return child
  }

  removeChild(child: FakeElement) {
    this.childNodes = this.childNodes.filter((item) => item !== child)
    child.parentNode = null
    return child
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value))
  }

  removeAttribute(name: string) {
    this.attributes.delete(name)
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null
  }

  focus() {
    this.ownerDocument.activeElement = this
  }

  get firstChild() {
    return this.childNodes[0] ?? null
  }
}

class FakeDocument extends EventTarget {
  nodeType = 9
  nodeName = '#document'
  documentElement: FakeElement
  body: FakeElement
  activeElement: FakeElement
  defaultView!: EventTarget & Record<string, unknown>

  constructor() {
    super()
    this.documentElement = new FakeElement('html')
    this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this
    this.body.ownerDocument = this
    this.activeElement = this.body
  }

  createElement(tag: string) {
    const element = new FakeElement(tag)
    element.ownerDocument = this
    return element
  }

  createElementNS(_namespace: string, tag: string) {
    return this.createElement(tag)
  }

  createTextNode(value: string) {
    const element = this.createElement('#text')
    element.nodeType = 3
    element.nodeName = '#text'
    element.textContent = value
    return element
  }
}

function text(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(text).join(' ')}`
}

const readySnapshot: StudyProductionControllerSnapshot = {
  status: 'ready',
  session: null,
  checkpoint: null,
  acceptedCheckpointRevision: 0,
  selection: { segmentId: null },
  advisoryLaunch: null,
  content: null,
  pendingMutation: null,
  recovery: null,
}

const notReadySnapshot: StudyProductionControllerSnapshot = {
  ...readySnapshot,
  status: 'not_ready',
}

const launch: StudyProductionWorkspaceLaunch = {
  kind: 'begin',
  input: {
    academyContext: {
      adapterVersion: 1,
      releaseVersion: '1.0.0',
      lessonRef: 'grade-5:academy-week-2-day-3',
      skillRefs: ['ma-g5-mathematics-u01-l08'],
      scopeWeek: 2,
      scopeDay: 3,
    },
    subjectId: 'mathematics',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    initialSegmentId: 'segment-bound-a',
  },
}

const content: StudyProductionContentSlot = {
  status: 'bound',
  content: {
    contract: STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT,
    lessonId: 'grade-5:academy-week-2-day-3',
    releaseVersion: '1.0.0',
    subjectLabel: 'Mathematics - Grade 5',
    lessonTitle: 'Compare fractions',
    goal: 'Compare fractions and explain the comparison.',
    segments: [{ segmentId: 'segment-bound-a', label: 'Warm-up' }],
  },
  renderSegment: () => <p>Bound lesson</p>,
}

describe('mounted production Study workspace controller subscription', () => {
  let root: Root | null = null
  let documentTarget: FakeDocument
  let container: FakeElement

  beforeEach(() => {
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget,
      setTimeout,
      clearTimeout,
      HTMLElement: FakeElement,
      HTMLIFrameElement: class {},
      getSelection: () => null,
    }) as unknown as EventTarget & Record<string, unknown>
    windowTarget.top = windowTarget
    windowTarget.self = windowTarget
    documentTarget.defaultView = windowTarget
    vi.stubGlobal('window', windowTarget)
    vi.stubGlobal('document', documentTarget)
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = documentTarget.createElement('div')
  })

  afterEach(async () => {
    if (root) await act(async () => root?.unmount())
    root = null
    vi.unstubAllGlobals()
  })

  it('rerenders from controller publications and unsubscribes on unmount', async () => {
    let current = notReadySnapshot
    let publish: ((value: StudyProductionControllerSnapshot) => void) | null = null
    const unsubscribe = vi.fn()
    const controller = {
      checkReadiness: vi.fn(async () => current),
      begin: vi.fn(async () => current),
      resume: vi.fn(async () => current),
      transition: vi.fn(async () => current),
      readCheckpoint: vi.fn(async () => current),
      saveCheckpoint: vi.fn(async () => current),
      selectSegment: vi.fn(() => current),
      snapshot: vi.fn(() => current),
      subscribe: vi.fn((listener: (value: StudyProductionControllerSnapshot) => void) => {
        publish = listener
        return unsubscribe
      }),
    }

    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(
      <StudyProductionWorkspace
        controller={controller}
        launch={launch}
        content={content}
        onExit={() => undefined}
        checkReadinessOnMount={false}
      />,
    ))
    expect(text(container)).toContain('Study is getting ready')

    current = readySnapshot
    await act(async () => { publish?.(current) })
    expect(text(container)).toContain('Start Study')

    await act(async () => root?.unmount())
    root = null
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})

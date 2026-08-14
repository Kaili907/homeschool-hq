import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LearnerResponseRuntime,
  MemoryLearnerResponseStore,
  type LearnerResponseAssessor,
  type LearnerResponseAttemptContext,
} from '../final-app/learner-response'
import { ElementaryMathSamplePlayer } from './ElementaryMathSamplePlayer'
import { ELEMENTARY_MATH_SAMPLE_LESSON_REF, ELEMENTARY_MATH_SAMPLE_MATERIAL } from './fixture'
import { createElementaryMathPresentation } from './presentation'
import type { ElementaryMathSamplePlayerProps } from './types'

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
  checked = false
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
    this.documentElement = new FakeElement('html')
    this.body = new FakeElement('body')
    this.documentElement.ownerDocument = this
    this.body.ownerDocument = this
    this.activeElement = this.body
  }
  createElement(tag: string) { const element = new FakeElement(tag); element.ownerDocument = this; return element }
  createElementNS(_namespace: string, tag: string) { return this.createElement(tag) }
  createTextNode(value: string) { const element = this.createElement('#text'); element.nodeType = 3; element.nodeName = '#text'; element.textContent = value; return element }
}

const CONTEXT: LearnerResponseAttemptContext = Object.freeze({
  lessonRef: ELEMENTARY_MATH_SAMPLE_LESSON_REF,
  studentRef: 'student-sample',
  assignmentRef: 'assignment-sample',
  attemptRef: 'attempt-sample',
})

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

function normalized(value: string): string {
  return value.replaceAll(/\s+/g, ' ').trim()
}

function hasText(node: FakeElement, value: string): boolean {
  return normalized(renderedText(node)).includes(normalized(value))
}

function reactProps(element: FakeElement): Record<string, unknown> {
  const key = Object.keys(element).find((candidate) => candidate.startsWith('__reactProps$'))
  if (!key) throw new Error(`No React props on <${element.tagName}>`)
  return (element as unknown as Record<string, Record<string, unknown>>)[key]
}

function findAll(node: FakeElement, tag: string, found: FakeElement[] = []): FakeElement[] {
  if (node.tagName === tag.toUpperCase()) found.push(node)
  for (const child of node.childNodes) findAll(child, tag, found)
  return found
}

describe('ElementaryMathSamplePlayer', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument

  beforeEach(() => {
    root = null
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget,
      setTimeout,
      clearTimeout,
      HTMLElement: FakeElement,
      HTMLIFrameElement: class {},
      getSelection: () => null,
      innerWidth: 390,
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

  function makeRuntime(assessor?: LearnerResponseAssessor) {
    const store = new MemoryLearnerResponseStore()
    const runtime = new LearnerResponseRuntime(
      ELEMENTARY_MATH_SAMPLE_MATERIAL,
      CONTEXT,
      store,
      assessor,
      () => new Date('2026-08-14T14:00:00.000Z'),
    )
    return { runtime, store }
  }

  async function render(element: ReactElement) {
    root = createRoot(container as unknown as Element)
    await act(async () => root?.render(element))
  }

  async function renderPlayer(overrides: Partial<ElementaryMathSamplePlayerProps> = {}, assessor?: LearnerResponseAssessor) {
    const held = makeRuntime(assessor)
    await render(<ElementaryMathSamplePlayer runtime={held.runtime} {...overrides} />)
    return held
  }

  function findButton(label: string): FakeElement | null {
    return findAll(container, 'button').find((button) => normalized(renderedText(button)) === label) ?? null
  }

  function findInput(kind: string): FakeElement | null {
    return findAll(container, 'input').find((input) => reactProps(input).type === kind) ?? null
  }

  async function press(element: FakeElement | null) {
    expect(element).not.toBeNull()
    const onClick = reactProps(element!).onClick as (() => void) | undefined
    if (!onClick) throw new Error(`No onClick on <${element!.tagName}>`)
    await act(async () => { onClick(); await Promise.resolve() })
  }

  async function change(element: FakeElement | null, value: string) {
    expect(element).not.toBeNull()
    const onChange = reactProps(element!).onChange as ((event: { target: { value: string } }) => void) | undefined
    if (!onChange) throw new Error(`No onChange on <${element!.tagName}>`)
    await act(async () => onChange({ target: { value } }))
  }

  async function choose(element: FakeElement | null) {
    expect(element).not.toBeNull()
    const onChange = reactProps(element!).onChange as (() => void) | undefined
    if (!onChange) throw new Error(`No onChange on <${element!.tagName}>`)
    await act(async () => onChange())
  }

  async function submitWithKeyboard() {
    const form = findAll(container, 'form')[0]
    expect(form).toBeDefined()
    const onSubmit = reactProps(form!).onSubmit as ((event: { preventDefault: () => void }) => void) | undefined
    expect(onSubmit).toBeTypeOf('function')
    await act(async () => {
      onSubmit!({ preventDefault: vi.fn() })
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  it('projects the complete child-facing flow and keeps ten independent questions one item each', () => {
    const flow = createElementaryMathPresentation(ELEMENTARY_MATH_SAMPLE_MATERIAL)
    expect(flow.map((step) => step.stage)).toEqual([
      'LEARN',
      'EXAMPLE', 'EXAMPLE', 'EXAMPLE',
      'GUIDED', 'GUIDED', 'GUIDED',
      ...Array.from({ length: 10 }, () => 'INDEPENDENT' as const),
      'MASTERY', 'MASTERY', 'MASTERY', 'MASTERY',
    ])
    expect(flow.filter((step) => step.stage === 'INDEPENDENT').map((step) => step.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('expands a worked example step by step and moves focus to the next example', async () => {
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:example:1` })
    expect(hasText(container, 'Find the tens digit: 4.')).toBe(true)
    expect(hasText(container, '347 rounds to 350.')).toBe(false)

    await press(findButton('Show Next Step'))
    await press(findButton('Show Next Step'))
    await press(findButton('Show Next Step'))
    expect(hasText(container, '347 rounds to 350.')).toBe(true)
    await press(findButton('Next Example'))
    expect(hasText(container, 'Round 641 to the nearest hundred.')).toBe(true)
    expect(documentTarget.activeElement.tagName).toBe('H1')
  })

  it('submits a guided numeric answer through the current runtime, focuses pending feedback, and advances', async () => {
    const { store } = await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1` })
    const input = findInput('text')
    expect(reactProps(input!).inputMode).toBe('numeric')
    expect(hasText(container, 'What is the lower bounding hundred for 641?')).toBe(true)
    expect(hasText(container, 'To round 641 to the nearest hundred')).toBe(false)

    await change(input, '600')
    await submitWithKeyboard()
    expect(hasText(container, 'Answer saved. A trusted checker can review it later.')).toBe(true)
    expect(documentTarget.activeElement.getAttribute('role')).toBe('status')
    const records = await store.list(CONTEXT)
    expect(records[0]).toMatchObject({
      itemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1`,
      responseType: 'NUMERIC',
      response: { kind: 'NUMERIC', text: '600' },
      status: 'PENDING_ASSESSMENT',
    })
    await press(findButton('Next Question'))
    expect(hasText(container, 'To round 641 to the nearest hundred, which digit tells you whether to round up?')).toBe(true)
    const progress = findAll(container, 'p').find((paragraph) => reactProps(paragraph)['aria-label'])
    expect(reactProps(progress!)['aria-label']).toBe("Let's Try One, 2 of 3")
    expect(documentTarget.activeElement.tagName).toBe('H1')
  })

  it('renders and saves a guided choice using its opaque choice reference', async () => {
    const { store } = await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:2` })
    const radios = findAll(container, 'input').filter((input) => reactProps(input).type === 'radio')
    expect(radios).toHaveLength(3)
    expect(hasText(container, 'Choose your answer')).toBe(true)
    await choose(radios[1]!)
    await submitWithKeyboard()
    const [record] = await store.list(CONTEXT)
    expect(record?.response).toEqual({ kind: 'CHOICE', choiceRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:2:choice:2` })
  })

  it('shows independent numeric and choice items one at a time with child-friendly progress', async () => {
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:independent:1` })
    expect(hasText(container, 'Your Turn • 1 of 10')).toBe(true)
    expect(hasText(container, 'Round 263 to the nearest ten.')).toBe(true)
    expect(hasText(container, 'Round 918 to the nearest hundred.')).toBe(false)
    expect(findAll(container, 'form')).toHaveLength(1)

    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:independent:3` })
    expect(hasText(container, 'Your Turn • 3 of 10')).toBe(true)
    expect(findAll(container, 'input').filter((input) => reactProps(input).type === 'radio')).toHaveLength(3)
    expect(hasText(container, 'Round 76 to the nearest ten.')).toBe(false)
  })

  it('renders and saves an independent constructed response', async () => {
    const { store } = await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:independent:9` })
    const textarea = findAll(container, 'textarea')[0]
    expect(textarea).toBeDefined()
    expect(hasText(container, 'Explain your thinking')).toBe(true)
    await change(textarea!, 'I would ask her to look at the tens digit.')
    await submitWithKeyboard()
    const [record] = await store.list(CONTEXT)
    expect(record).toMatchObject({ responseType: 'CONSTRUCTED_RESPONSE', response: { kind: 'CONSTRUCTED_RESPONSE' } })
  })

  it('shows mastery one question at a time and accepts injected review feedback', async () => {
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted-reviewer',
      assess: vi.fn(async () => ({
        assessmentRef: 'assessment-1',
        assessorRef: 'trusted-reviewer',
        assessedAt: '2026-08-14T14:01:00.000Z',
        decision: 'REVIEW_REQUIRED' as const,
      })),
    }
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:mastery:1` }, assessor)
    expect(hasText(container, 'Check What You Know • 1 of 4')).toBe(true)
    expect(hasText(container, 'Round 438 to the nearest hundred.')).toBe(false)
    await change(findInput('text'), '440')
    await submitWithKeyboard()
    expect(hasText(container, 'Your answer is saved for a closer look.')).toBe(true)
  })

  it('uses only an injected assessor for incorrect feedback and allows retry or next', async () => {
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted-scorer',
      assess: vi.fn(async () => ({
        assessmentRef: 'assessment-incorrect',
        assessorRef: 'trusted-scorer',
        assessedAt: '2026-08-14T14:02:00.000Z',
        decision: 'INCORRECT' as const,
      })),
    }
    const { store } = await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:independent:1` }, assessor)
    await change(findInput('text'), '999')
    await submitWithKeyboard()
    expect(hasText(container, 'Not quite yet. Your answer is saved, and you can try again.')).toBe(true)
    expect(findButton('Try Again')).not.toBeNull()
    expect(findButton('Next Question')).not.toBeNull()
    const [record] = await store.list(CONTEXT)
    expect(record).toMatchObject({ status: 'ASSESSED', assessment: { decision: 'INCORRECT', assessorRef: 'trusted-scorer' } })
  })

  it('renders a correct result only when the injected trusted assessor returns it', async () => {
    const assessor: LearnerResponseAssessor = {
      assessorRef: 'trusted-correct-scorer',
      assess: vi.fn(async () => ({
        assessmentRef: 'assessment-correct',
        assessorRef: 'trusted-correct-scorer',
        assessedAt: '2026-08-14T14:03:00.000Z',
        decision: 'CORRECT' as const,
      })),
    }
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:independent:1` }, assessor)
    await change(findInput('text'), '260')
    await submitWithKeyboard()
    expect(hasText(container, 'You got it! Nice thinking.')).toBe(true)
  })

  it('provides honest Jarvis fallback behavior and delegates help, break, and save controls when injected', async () => {
    await renderPlayer()
    await press(findButton('Need Help? Ask Jarvis'))
    expect(hasText(container, 'Jarvis help is not connected yet.')).toBe(true)

    await act(async () => root?.unmount())
    root = null
    container = documentTarget.createElement('div')
    const onNeedHelp = vi.fn()
    const onTakeBreak = vi.fn()
    const onSaveForLater = vi.fn()
    await renderPlayer({
      initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1`,
      onNeedHelp,
      onTakeBreak,
      onSaveForLater,
    })
    await press(findButton('Need Help? Ask Jarvis'))
    await press(findButton('Take a Break'))
    await press(findButton('Save for Later'))
    expect(onNeedHelp).toHaveBeenCalledWith(`${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1`)
    expect(onTakeBreak).toHaveBeenCalledWith({ stepIndex: 4, itemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1` })
    expect(onSaveForLater).toHaveBeenCalledWith({ stepIndex: 4, itemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1` })
  })

  it('uses mobile-friendly numeric and accessible control semantics', async () => {
    await renderPlayer({ initialItemRef: `${ELEMENTARY_MATH_SAMPLE_LESSON_REF}:guided:1` })
    const input = findInput('text')
    expect(reactProps(input!)).toMatchObject({
      id: 'elementary-math-response',
      inputMode: 'numeric',
      enterKeyHint: 'done',
      autoComplete: 'off',
    })
    const form = findAll(container, 'form')[0]!
    expect(reactProps(form).onSubmit).toBeTypeOf('function')
    expect(findAll(container, 'nav').map(reactProps)[0]?.['aria-label']).toBe('Lesson help and break controls')
    expect(documentTarget.activeElement.tagName).toBe('H1')
  })
})

describe('elementary math sample boundary guards', () => {
  it('contains no browser scoring authority or second response store', () => {
    const directory = fileURLToPath(new URL('.', import.meta.url))
    const source = [
      readFileSync(`${directory}/fixture.ts`, 'utf8'),
      readFileSync(`${directory}/presentation.ts`, 'utf8'),
      readFileSync(`${directory}/ElementaryMathSamplePlayer.tsx`, 'utf8'),
    ].join('\n')
    expect(source).not.toMatch(/correctAnswer|answerKey|expectedAnswer|scoringRule|isCorrect/)
    expect(source).not.toMatch(/new\s+(BrowserLearnerResponseStore|MemoryLearnerResponseStore)|localStorage|indexedDB/)
    expect(source).toContain('runtime.submit')
  })

  it('ships mobile-first touch sizing and reduced-motion support', () => {
    const css = readFileSync(fileURLToPath(new URL('./ElementaryMathSamplePlayer.css', import.meta.url)), 'utf8')
    expect(css).toContain('min-height: 3rem')
    expect(css).toContain('@media (min-width: 36rem)')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

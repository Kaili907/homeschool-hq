import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Profile } from '../../types'
import { emptyProfile } from '../../migration'
import {
  GRADE5_MATH_PRACTICE_ITEM_COUNT,
  generateGrade5MathPracticeItem,
  grade5MathPracticeUnit,
  type Grade5MathPracticeQuestion,
} from '../../curriculum/practice/grade5MathPracticeUnits'
import { Grade5MathPractice, Grade5MathPracticeRound } from './Grade5MathPractice'

// MOUNT-G5-MATH surface behaviour. DOM harness adapted from
// App.academyRouteLifecycle.test.tsx — the repo renders React against a minimal
// fake document rather than pulling in jsdom.

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

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

const squash = (value: string) => value.replaceAll(/\s+/g, '')

function hasText(node: FakeElement, needle: string): boolean {
  return squash(renderedText(node)).includes(squash(needle))
}

describe('Grade5MathPractice surface (MOUNT-G5-MATH)', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument

  beforeEach(() => {
    root = null
    vi.stubGlobal('localStorage', new MemStorage())
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

  function buttons(node: FakeElement = container, found: FakeElement[] = []): FakeElement[] {
    if (node.tagName === 'BUTTON') found.push(node)
    for (const child of node.childNodes) buttons(child, found)
    return found
  }

  function elements(
    matches: (node: FakeElement) => boolean,
    node: FakeElement = container,
    found: FakeElement[] = [],
  ): FakeElement[] {
    if (matches(node)) found.push(node)
    for (const child of node.childNodes) elements(matches, child, found)
    return found
  }

  function findButton(label: string): FakeElement | null {
    return buttons().find((b) => hasText(b, label)) ?? null
  }

  /** Exact (whitespace-insensitive) match — choice labels can be substrings of each other. */
  function findChoice(label: string): FakeElement | null {
    return buttons().find((b) => squash(renderedText(b)) === squash(label)) ?? null
  }

  async function press(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const key = Object.keys(el!).find((k) => k.startsWith('__reactProps$'))
    if (!key) throw new Error(`No React props on <${el!.tagName}>`)
    const props = (el as unknown as Record<string, { onClick?: () => void }>)[key]
    if (!props?.onClick) throw new Error(`No onClick on <${el!.tagName}>`)
    await act(async () => { props.onClick!() })
  }

  /** Applies every onPatch update to a live profile, exactly as App's patchActive does. */
  function profileHarness() {
    const box = { profile: emptyProfile('p2', 'Riley', '5') as Profile }
    return {
      box,
      onPatch: (update: (prev: Profile) => Profile) => { box.profile = update(box.profile) },
    }
  }

  it('opens on an explicit unit picker listing all ten units', async () => {
    await render(<Grade5MathPractice onPatch={() => {}} onExit={() => {}} />)
    expect(hasText(container, 'Pick the unit you want to practice.')).toBe(true)
    for (let n = 1; n <= 10; n++) expect(findButton(`Unit ${n}`)).not.toBeNull()
    expect(hasText(container, 'Multiplying Fractions and Scaling')).toBe(true)
    // nothing has started: no question, no progress counter
    expect(hasText(container, '1/10')).toBe(false)
  })

  it('starts the picked unit — and only the picked unit', async () => {
    await render(<Grade5MathPractice onPatch={() => {}} onExit={() => {}} />)
    await press(findButton('Unit 8'))
    expect(hasText(container, 'Unit 8 — Measurement, Data, and Volume')).toBe(true)
    expect(hasText(container, '1/10')).toBe(true)
  })

  it('renders the generator’s prompt, choices and answer verbatim', async () => {
    const unit = grade5MathPracticeUnit(6)!
    const served: Grade5MathPracticeQuestion[] = []
    await render(
      <Grade5MathPracticeRound
        unit={unit}
        total={GRADE5_MATH_PRACTICE_ITEM_COUNT}
        getQuestion={(index) => {
          const q = generateGrade5MathPracticeItem(unit, index)
          served.push(q)
          return q
        }}
        onAnswer={() => {}}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )

    // Walk the whole round; every item's text must survive to the screen unaltered.
    for (let i = 0; i < GRADE5_MATH_PRACTICE_ITEM_COUNT; i++) {
      const q = served[i]
      expect(hasText(container, q.prompt)).toBe(true)
      for (const choice of q.choices) expect(findChoice(choice)).not.toBeNull()
      const answer = q.choices[q.answerIndex]
      // the button the surface treats as correct carries exactly the generator's answer
      await press(findChoice(answer))
      expect(hasText(container, 'Nice — that is right! ✓')).toBe(true)
      if (i + 1 < GRADE5_MATH_PRACTICE_ITEM_COUNT) await press(findButton('Next ▶'))
    }
  })

  it('keeps exact fractions and exact currency intact on screen', async () => {
    const fractionUnit = grade5MathPracticeUnit(6)!
    const fraction = fractionUnit.generate('multiply-fractions', 1)
    const currencyUnit = grade5MathPracticeUnit(10)!
    const currency = currencyUnit.generate('decimal-budget', 1)
    const scripted = [fraction, currency]

    await render(
      <Grade5MathPracticeRound
        unit={fractionUnit}
        total={2}
        getQuestion={(index) => scripted[index]}
        onAnswer={() => {}}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )

    const fractionAnswer = fraction.choices[fraction.answerIndex]
    expect(fractionAnswer).toMatch(/^\d+$|^\d+\/\d+$|^\d+ \d+\/\d+$/)
    expect(findChoice(fractionAnswer)).not.toBeNull()
    await press(findChoice(fractionAnswer))
    await press(findButton('Finish ▶') ?? findButton('Next ▶'))

    const currencyAnswer = currency.choices[currency.answerIndex]
    expect(currencyAnswer).toMatch(/^\$\d+\.\d{2}$/)
    expect(findChoice(currencyAnswer)).not.toBeNull()
  })

  it('shows the authored worked example on a wrong answer, and not on a right one', async () => {
    const unit = grade5MathPracticeUnit(1)!
    const question = generateGrade5MathPracticeItem(unit, 0)
    const wrongIndex = question.answerIndex === 0 ? 1 : 0
    await render(
      <Grade5MathPracticeRound
        unit={unit}
        total={2}
        getQuestion={() => question}
        onAnswer={() => {}}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )

    expect(hasText(container, 'Here is one worked out')).toBe(false)
    await press(findChoice(question.choices[wrongIndex]))

    expect(hasText(container, `Not quite. The answer is ${question.choices[question.answerIndex]}.`)).toBe(true)
    expect(hasText(container, 'Here is one worked out')).toBe(true)
    expect(hasText(container, question.workedExample.prompt)).toBe(true)
    for (const step of question.workedExample.steps) expect(hasText(container, step)).toBe(true)
    expect(hasText(container, `Answer: ${question.workedExample.answer}`)).toBe(true)

    // the next item, answered correctly, shows no worked example
    await press(findButton('Next ▶'))
    await press(findChoice(question.choices[question.answerIndex]))
    expect(hasText(container, 'Nice — that is right! ✓')).toBe(true)
    expect(hasText(container, 'Here is one worked out')).toBe(false)
  })

  it('records every answer through the existing profile persistence path', async () => {
    const { box, onPatch } = profileHarness()
    await render(<Grade5MathPractice onPatch={onPatch} onExit={() => {}} />)
    await press(findButton('Unit 7'))

    let correctCount = 0
    for (let i = 0; i < GRADE5_MATH_PRACTICE_ITEM_COUNT; i++) {
      // answer with the first choice — right or wrong, the tally must move
      const choices = buttons().filter((b) => !hasText(b, '✕'))
      await press(choices[0])
      if (hasText(container, 'Nice — that is right! ✓')) correctCount++
      await press(findButton(i + 1 >= GRADE5_MATH_PRACTICE_ITEM_COUNT ? 'Finish ▶' : 'Next ▶'))
    }

    expect(box.profile.hsStats?.['g5-math-u07']).toBeDefined()
    expect(box.profile.hsStats!['g5-math-u07'].attempts).toBe(GRADE5_MATH_PRACTICE_ITEM_COUNT)
    expect(box.profile.hsStats!['g5-math-u07'].correct).toBe(correctCount)
    expect(box.profile.hsStats!['g5-math-u07'].lastSeen).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(box.profile.totals.questionsAnswered).toBe(GRADE5_MATH_PRACTICE_ITEM_COUNT)
    expect(box.profile.totals.correct).toBe(correctCount)
    // finishing the round counts as one practice session in the same store
    expect(box.profile.totals.sessions).toBe(1)
    expect(box.profile.lastPracticeDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // and no other unit was touched
    expect(Object.keys(box.profile.hsStats!)).toEqual(['g5-math-u07'])
    expect(hasText(container, 'Round done!')).toBe(true)
    expect(hasText(container, `${correctCount}/${GRADE5_MATH_PRACTICE_ITEM_COUNT}`)).toBe(true)
    expect(hasText(container, 'questions correct')).toBe(true)
  })

  it.each([
    { unitNumber: 2, itemType: 'decimal-number-line', visual: 'number line' },
    { unitNumber: 3, itemType: 'area-model-product', visual: 'rectangle' },
    { unitNumber: 5, itemType: 'compare-to-benchmark', visual: 'fraction bars' },
    { unitNumber: 5, itemType: 'rewrite-with-common-denominator', visual: 'fraction bars' },
    { unitNumber: 5, itemType: 'add-unlike-fractions', visual: 'fraction bars' },
    { unitNumber: 5, itemType: 'subtract-unlike-fractions', visual: 'fraction bars' },
  ])('renders the $visual for unit $unitNumber $itemType in the practice surface', async ({ unitNumber, itemType, visual }) => {
    const unit = grade5MathPracticeUnit(unitNumber)!
    const question = unit.generate(itemType, 1)
    expect(question.visual).toBeDefined()

    await render(
      <Grade5MathPracticeRound
        unit={unit}
        total={1}
        getQuestion={() => question}
        onAnswer={() => {}}
        onFinish={() => {}}
        onQuit={() => {}}
      />,
    )

    if (visual === 'fraction bars') {
      expect(
        elements((node) => node.tagName === 'DIV' && node.getAttribute('class')?.includes('h-14') === true),
      ).toHaveLength(2)
    } else {
      expect(
        elements((node) => node.tagName === 'SVG' && node.getAttribute('role') === 'img' && node.getAttribute('aria-label')?.startsWith(visual) === true),
      ).toHaveLength(1)
    }
  })

  it('leaves the surface through the caller’s exit', async () => {
    let exited = 0
    await render(<Grade5MathPractice onPatch={() => {}} onExit={() => { exited++ }} />)
    await press(findButton('Back home'))
    expect(exited).toBe(1)
  })
})

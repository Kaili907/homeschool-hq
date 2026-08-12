import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FamilySetupStudent } from '../setup'
import { FamilyPreferences, type FamilyPreferencesProps } from './FamilyPreferences'

// DOM harness adapted from src/components/curriculum/Grade5MathPractice.test.tsx —
// the repo renders React against a minimal fake document rather than pulling in
// jsdom. Interactions are driven by grabbing each element's React props off the
// fiber (`__reactProps$...`) and invoking the handler directly, since this fake
// tree has no real event dispatch.

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value))
  }
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
  value = ''
  checked = false
  disabled = false
  selected = false
  private attributes = new Map<string, string>()
  /** HTMLSelectElement.options — react-dom's select reconciliation reads/writes through this. */
  get options() {
    return this.childNodes.filter((child) => child.tagName === 'OPTION')
  }
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
    // Real <option> elements reflect the "value" content attribute onto the
    // .value IDL property; react-dom's <select> reconciliation reads the
    // latter (see updateOptions), so this fake needs the same reflection.
    if (name === 'value') this.value = String(value)
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
  createElement(tag: string) {
    const e = new FakeElement(tag)
    e.ownerDocument = this
    return e
  }
  createElementNS(_ns: string, tag: string) {
    return this.createElement(tag)
  }
  createTextNode(value: string) {
    const e = this.createElement('#text')
    e.nodeType = 3
    e.nodeName = '#text'
    e.textContent = value
    return e
  }
}

function renderedText(node: FakeElement): string {
  return `${node.textContent} ${node.childNodes.map(renderedText).join(' ')}`
}

const squash = (value: string) => value.replaceAll(/\s+/g, '')

function hasText(node: FakeElement, needle: string): boolean {
  return squash(renderedText(node)).includes(squash(needle))
}

const STUDENT_REF = 'family-setup-student:a'

function makeStudent(overrides: Partial<FamilySetupStudent> = {}): FamilySetupStudent {
  return Object.freeze({
    studentRef: STUDENT_REF,
    displayName: 'Sam',
    nominalGrade: '6',
    workingGradeBySubject: Object.freeze({}),
    enabledSubjects: Object.freeze(['mathematics', 'science'] as const),
    pinRequired: false,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  })
}

function makeProps(overrides: Partial<FamilyPreferencesProps> = {}): FamilyPreferencesProps {
  return {
    student: makeStudent(),
    onUpdateDisplayName: vi.fn(),
    onSetWorkingGrade: vi.fn(),
    onSetSubjectEnabled: vi.fn(),
    onSetPinRequired: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
}

describe('FamilyPreferences (FAMILY-PILOT-PREFS)', () => {
  let roots: Root[]
  let container: FakeElement
  let documentTarget: FakeDocument

  beforeEach(() => {
    roots = []
    vi.stubGlobal('localStorage', new MemStorage())
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget,
      setTimeout,
      clearTimeout,
      HTMLElement: FakeElement,
      HTMLIFrameElement: class {},
      getSelection: () => null,
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
    for (const root of roots) {
      await act(async () => root.unmount())
    }
    vi.unstubAllGlobals()
  })

  function newRoot(target: FakeElement): Root {
    const root = createRoot(target as unknown as Element)
    roots.push(root)
    return root
  }

  async function render(element: ReactElement, target: FakeElement = container): Promise<Root> {
    const root = newRoot(target)
    await act(async () => root.render(element))
    return root
  }

  function elements(
    matches: (n: FakeElement) => boolean,
    node: FakeElement = container,
    found: FakeElement[] = [],
  ): FakeElement[] {
    if (matches(node)) found.push(node)
    for (const child of node.childNodes) elements(matches, child, found)
    return found
  }

  function byAttr(tag: string, attr: string, value: string, node?: FakeElement): FakeElement | null {
    return elements((n) => n.tagName === tag && n.getAttribute(attr) === value, node)[0] ?? null
  }

  function findButton(label: string, node?: FakeElement): FakeElement | null {
    return elements((n) => n.tagName === 'BUTTON', node).find((b) => hasText(b, label)) ?? null
  }

  function reactProps(el: FakeElement): Record<string, unknown> {
    const key = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
    if (!key) throw new Error(`No React props on <${el.tagName}>`)
    return (el as unknown as Record<string, Record<string, unknown>>)[key]
  }

  async function click(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const onClick = reactProps(el!).onClick as (() => void) | undefined
    if (!onClick) throw new Error('No onClick')
    await act(async () => onClick())
  }

  async function change(el: FakeElement | null, detail: { value?: string; checked?: boolean }) {
    expect(el).not.toBeNull()
    const onChange = reactProps(el!).onChange as ((e: unknown) => void) | undefined
    if (!onChange) throw new Error('No onChange')
    await act(async () => onChange({ target: detail }))
  }

  async function blur(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const onBlur = reactProps(el!).onBlur as (() => void) | undefined
    if (!onBlur) throw new Error('No onBlur')
    await act(async () => onBlur())
  }

  /** react-dom marks the winning <option> via a bare `.selected` property, and stamps
   * each option's value as a "value" attribute — neither shows up on the <select> itself. */
  function selectedOptionValue(selectEl: FakeElement | null): string | null {
    expect(selectEl).not.toBeNull()
    const selected = selectEl!.options.find((option) => option.selected)
    return selected?.getAttribute('value') ?? null
  }

  /** "disabled" is reconciled as an HTML attribute, not a JS property. */
  function isDisabled(el: FakeElement | null): boolean {
    expect(el).not.toBeNull()
    return el!.getAttribute('disabled') !== null
  }

  it('shows the nominal grade separately from any working-grade override', async () => {
    const props = makeProps({
      student: makeStudent({ nominalGrade: '6', workingGradeBySubject: Object.freeze({ mathematics: '5' }) }),
    })
    await render(<FamilyPreferences {...props} />)

    expect(hasText(container, 'Nominal grade: Grade 6')).toBe(true)
    const mathGradeSelect = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    expect(selectedOptionValue(mathGradeSelect)).toBe('5')
  })

  it('emits a working-grade change scoped to the subject and student', async () => {
    const onSetWorkingGrade = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onSetWorkingGrade })} />)

    const select = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(select, { value: '7' })

    expect(onSetWorkingGrade).toHaveBeenCalledWith(STUDENT_REF, 'mathematics', '7')
  })

  it('clears a working-grade override by selecting "use nominal"', async () => {
    const onSetWorkingGrade = vi.fn()
    const props = makeProps({
      student: makeStudent({ workingGradeBySubject: Object.freeze({ mathematics: '7' }) }),
      onSetWorkingGrade,
    })
    await render(<FamilyPreferences {...props} />)

    const select = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(select, { value: '' })

    expect(onSetWorkingGrade).toHaveBeenCalledWith(STUDENT_REF, 'mathematics', null)
  })

  it('refuses an unsupported working grade — no callback, visible refusal', async () => {
    const onSetWorkingGrade = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onSetWorkingGrade })} />)

    const select = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(select, { value: '11' }) // not a published AcademyGrade

    expect(onSetWorkingGrade).not.toHaveBeenCalled()
    expect(hasText(container, 'Unsupported grade')).toBe(true)
  })

  it('locks the working-grade selector for a disabled subject and refuses edits', async () => {
    const onSetWorkingGrade = vi.fn()
    // default fixture only enables mathematics + science
    await render(<FamilyPreferences {...makeProps({ onSetWorkingGrade })} />)

    const healthSelect = byAttr('SELECT', 'aria-label', 'Working grade for Health')
    expect(isDisabled(healthSelect)).toBe(true)

    await change(healthSelect, { value: '7' })
    expect(onSetWorkingGrade).not.toHaveBeenCalled()
  })

  it('clears a stale refusal banner when the host hands back an updated student', async () => {
    const onSetWorkingGrade = vi.fn()
    const props = makeProps({ onSetWorkingGrade })
    const root = await render(<FamilyPreferences {...props} />)

    const select = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(select, { value: '11' }) // refused — banner should be showing
    expect(hasText(container, 'Unsupported grade')).toBe(true)

    // host reuses the same mounted instance for a different student
    await act(async () =>
      root.render(<FamilyPreferences {...makeProps({ student: makeStudent({ studentRef: 'family-setup-student:b', displayName: 'Riley' }) })} />),
    )

    expect(hasText(container, 'Unsupported grade')).toBe(false)
  })

  it('toggles a subject on and off', async () => {
    const onSetSubjectEnabled = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onSetSubjectEnabled })} />)

    // off: an already-enabled subject
    const scienceCheckbox = byAttr('INPUT', 'aria-label', 'Enable Science')
    await change(scienceCheckbox, { checked: false })
    expect(onSetSubjectEnabled).toHaveBeenCalledWith(STUDENT_REF, 'science', false)

    // on: a subject not in the default fixture's enabledSubjects
    const healthCheckbox = byAttr('INPUT', 'aria-label', 'Enable Health')
    await change(healthCheckbox, { checked: true })
    expect(onSetSubjectEnabled).toHaveBeenCalledWith(STUDENT_REF, 'health', true)
  })

  it('emits a PIN requirement change in both directions', async () => {
    const onSetPinRequired = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onSetPinRequired })} />)

    const pinCheckbox = byAttr('INPUT', 'aria-label', 'PIN required')
    expect(pinCheckbox?.checked).toBe(false)
    await change(pinCheckbox, { checked: true })
    expect(onSetPinRequired).toHaveBeenCalledWith(STUDENT_REF, true)

    // separate instance, starting from pinRequired: true, to exercise true → false
    const onSetPinRequiredB = vi.fn()
    const containerB = documentTarget.createElement('div')
    await render(
      <FamilyPreferences
        {...makeProps({ student: makeStudent({ pinRequired: true }), onSetPinRequired: onSetPinRequiredB })}
      />,
      containerB,
    )
    const pinCheckboxB = byAttr('INPUT', 'aria-label', 'PIN required', containerB)
    expect(pinCheckboxB?.checked).toBe(true)
    await change(pinCheckboxB, { checked: false })
    expect(onSetPinRequiredB).toHaveBeenCalledWith(STUDENT_REF, false)
  })

  it('refuses a blank display name', async () => {
    const onUpdateDisplayName = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onUpdateDisplayName })} />)

    const nameInput = byAttr('INPUT', 'id', 'family-pref-display-name')
    await change(nameInput, { value: '   ' })
    await blur(nameInput)

    expect(onUpdateDisplayName).not.toHaveBeenCalled()
    expect(hasText(container, "can't be blank")).toBe(true)
  })

  it('commits a trimmed display-name edit on blur', async () => {
    const onUpdateDisplayName = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onUpdateDisplayName })} />)

    const nameInput = byAttr('INPUT', 'id', 'family-pref-display-name')
    await change(nameInput, { value: '  Sammy  ' })
    await blur(nameInput)

    expect(onUpdateDisplayName).toHaveBeenCalledWith(STUDENT_REF, 'Sammy')
  })

  it('distinguishes same-name students by studentRef, never by display name', async () => {
    const refA = 'family-setup-student:a'
    const refB = 'family-setup-student:b'
    const onUpdateDisplayNameA = vi.fn()
    const onUpdateDisplayNameB = vi.fn()

    const containerA = documentTarget.createElement('div')
    const containerB = documentTarget.createElement('div')
    await render(
      <FamilyPreferences
        {...makeProps({
          student: makeStudent({ studentRef: refA, displayName: 'Sam' }),
          onUpdateDisplayName: onUpdateDisplayNameA,
        })}
      />,
      containerA,
    )
    await render(
      <FamilyPreferences
        {...makeProps({
          student: makeStudent({ studentRef: refB, displayName: 'Sam' }),
          onUpdateDisplayName: onUpdateDisplayNameB,
        })}
      />,
      containerB,
    )

    const nameInputA = byAttr('INPUT', 'id', 'family-pref-display-name', containerA)
    const nameInputB = byAttr('INPUT', 'id', 'family-pref-display-name', containerB)

    await change(nameInputA, { value: 'Sam A' })
    await blur(nameInputA)
    await change(nameInputB, { value: 'Sam B' })
    await blur(nameInputB)

    expect(onUpdateDisplayNameA).toHaveBeenCalledWith(refA, 'Sam A')
    expect(onUpdateDisplayNameB).toHaveBeenCalledWith(refB, 'Sam B')
    // neither instance ever saw the other's ref, despite the shared display name
    expect(onUpdateDisplayNameA).not.toHaveBeenCalledWith(refB, expect.anything())
    expect(onUpdateDisplayNameB).not.toHaveBeenCalledWith(refA, expect.anything())
  })

  it('always scopes emitted changes to the given studentRef', async () => {
    const ref = 'family-setup-student:xyz'
    const onUpdateDisplayName = vi.fn()
    const onSetWorkingGrade = vi.fn()
    const onSetSubjectEnabled = vi.fn()
    const onSetPinRequired = vi.fn()
    await render(
      <FamilyPreferences
        {...makeProps({
          student: makeStudent({ studentRef: ref }),
          onUpdateDisplayName,
          onSetWorkingGrade,
          onSetSubjectEnabled,
          onSetPinRequired,
        })}
      />,
    )

    const nameInput = byAttr('INPUT', 'id', 'family-pref-display-name')
    await change(nameInput, { value: 'New Name' })
    await blur(nameInput)

    const mathSelect = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(mathSelect, { value: '8' })

    const scienceCheckbox = byAttr('INPUT', 'aria-label', 'Enable Science')
    await change(scienceCheckbox, { checked: false })

    const pinCheckbox = byAttr('INPUT', 'aria-label', 'PIN required')
    await change(pinCheckbox, { checked: true })

    expect(onUpdateDisplayName.mock.calls[0][0]).toBe(ref)
    expect(onSetWorkingGrade.mock.calls[0][0]).toBe(ref)
    expect(onSetSubjectEnabled.mock.calls[0][0]).toBe(ref)
    expect(onSetPinRequired.mock.calls[0][0]).toBe(ref)
  })

  it('never mutates the student object it was given', async () => {
    const student = makeStudent({ workingGradeBySubject: Object.freeze({ mathematics: '5' }) })
    const snapshot = JSON.parse(JSON.stringify(student))
    await render(<FamilyPreferences {...makeProps({ student })} />)

    const pinCheckbox = byAttr('INPUT', 'aria-label', 'PIN required')
    await change(pinCheckbox, { checked: true })
    const scienceCheckbox = byAttr('INPUT', 'aria-label', 'Enable Science')
    await change(scienceCheckbox, { checked: false })
    const mathSelect = byAttr('SELECT', 'aria-label', 'Working grade for Mathematics')
    await change(mathSelect, { value: '7' })
    const nameInput = byAttr('INPUT', 'id', 'family-pref-display-name')
    await change(nameInput, { value: 'Changed' })
    await blur(nameInput)

    // A frozen student is passed through untouched — every requested edit
    // only ever reached the world via a host callback, never a local mutation.
    expect(student).toEqual(snapshot)
  })

  it('calls onClose from the Close button', async () => {
    const onClose = vi.fn()
    await render(<FamilyPreferences {...makeProps({ onClose })} />)

    await click(findButton('Close'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

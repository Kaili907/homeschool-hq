import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyFamilyPilotState, type FamilyPilotSnapshot } from '../core'
import { FamilyPilotRecoveryScreen } from './FamilyPilotRecoveryScreen'

// DOM harness adapted from Grade5MathPractice.test.tsx / App.familyPilotRouteLifecycle.test.tsx
// — the repo renders React against a minimal fake document rather than pulling in jsdom.

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

const NOW = '2026-08-12T09:00:00.000Z'

function snapshotFor(
  status: FamilyPilotSnapshot['status'],
  reasonCode: FamilyPilotSnapshot['reasonCode'] = null,
): FamilyPilotSnapshot {
  return { status, state: emptyFamilyPilotState(NOW), reasonCode }
}

describe('FamilyPilotRecoveryScreen interaction', () => {
  let root: Root | null
  let container: FakeElement
  let documentTarget: FakeDocument

  beforeEach(() => {
    root = null
    documentTarget = new FakeDocument()
    const windowTarget = Object.assign(new EventTarget(), {
      document: documentTarget, setTimeout, clearTimeout, HTMLElement: FakeElement,
      HTMLIFrameElement: class {}, getSelection: () => null,
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

  async function press(el: FakeElement | null) {
    expect(el).not.toBeNull()
    const key = Object.keys(el!).find((k) => k.startsWith('__reactProps$'))
    if (!key) throw new Error(`No React props on <${el!.tagName}>`)
    const props = (el as unknown as Record<string, { onClick?: () => void }>)[key]
    if (!props?.onClick) throw new Error(`No onClick on <${el!.tagName}>`)
    await act(async () => { props.onClick!() })
  }

  it('never calls resetLocalPilot from a single click — a second, explicit confirmation is required', async () => {
    const resetLocalPilot = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot }}
      />,
    )

    await press(findButton('Reset pilot data on this device'))
    expect(resetLocalPilot).not.toHaveBeenCalled()
    expect(hasText(container, 'This will permanently erase pilot data')).toBe(true)

    await press(findButton('Yes, erase'))
    expect(resetLocalPilot).toHaveBeenCalledOnce()
  })

  it('cancelling the reset confirmation calls nothing and returns to the initial control', async () => {
    const resetLocalPilot = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot }}
      />,
    )
    await press(findButton('Reset pilot data on this device'))
    await press(findButton('Cancel'))
    expect(resetLocalPilot).not.toHaveBeenCalled()
    expect(hasText(container, 'This will permanently erase pilot data')).toBe(false)
    expect(findButton('Reset pilot data on this device')).not.toBeNull()
  })

  it('calls restoreBackup only after its own explicit confirmation', async () => {
    const restoreBackup = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('unavailable', 'storage-unavailable')}
        actions={{ restoreBackup }}
      />,
    )
    await press(findButton('Restore from backup'))
    expect(restoreBackup).not.toHaveBeenCalled()
    await press(findButton('Yes, restore'))
    expect(restoreBackup).toHaveBeenCalledOnce()
  })

  it('calls exportBackup immediately — it never destroys device state, so it needs no confirmation', async () => {
    const exportBackup = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ exportBackup }}
      />,
    )
    await press(findButton('Export a backup'))
    expect(exportBackup).toHaveBeenCalledOnce()
  })

  it('calls retry and returnHome directly on click, with no side effects on other actions', async () => {
    const retry = vi.fn()
    const returnHome = vi.fn()
    const resetLocalPilot = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('unavailable', 'storage-unavailable')}
        actions={{ retry, returnHome, resetLocalPilot }}
      />,
    )
    await press(findButton('Try again'))
    expect(retry).toHaveBeenCalledOnce()
    await press(findButton('Return home'))
    expect(returnHome).toHaveBeenCalledOnce()
    expect(resetLocalPilot).not.toHaveBeenCalled()
  })

  it('offers a working continue-read-only control while future-schema data is left untouched', async () => {
    const continueReadOnly = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('read-only', 'schema-version-ahead')}
        actions={{ continueReadOnly }}
      />,
    )
    await press(findButton('Continue without saving'))
    expect(continueReadOnly).toHaveBeenCalledOnce()
    expect(findButton('Reset pilot data on this device')).toBeNull()
  })

  it('exposes every control as a real, keyboard-focusable <button type="button">', async () => {
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ retry: () => {}, resetLocalPilot: () => {}, exportBackup: () => {}, returnHome: () => {} }}
      />,
    )
    const controls = buttons()
    expect(controls.length).toBeGreaterThan(0)
    for (const button of controls) {
      expect(button.tagName).toBe('BUTTON')
      expect(button.getAttribute('type')).toBe('button')
    }
  })

  it('mounts on a healthy snapshot, keeps status non-interruptive, and does not surface a false alarm', async () => {
    await render(<FamilyPilotRecoveryScreen snapshot={snapshotFor('ready')} />)
    expect(hasText(container, 'Everything is working normally')).toBe(true)
    expect(buttons()).toHaveLength(0)
  })

  it('does not leave a destructive dialog armed after the underlying snapshot moves on', async () => {
    const resetLocalPilot = vi.fn()
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot }}
      />,
    )
    await press(findButton('Reset pilot data on this device'))
    expect(hasText(container, 'This will permanently erase pilot data')).toBe(true)

    // A future-schema state must hide the control entirely (already covered
    // elsewhere) — the case at risk here is coming back to a state where the
    // control is offered again without a fresh click ever having armed it.
    await rerender(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('read-only', 'schema-version-ahead')}
        actions={{ resetLocalPilot }}
      />,
    )
    await rerender(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot }}
      />,
    )
    expect(hasText(container, 'This will permanently erase pilot data')).toBe(false)
    expect(findButton('Reset pilot data on this device')).not.toBeNull()
    expect(resetLocalPilot).not.toHaveBeenCalled()
  })

  it('moves focus into the warning when a destructive action is armed, and back to the trigger on cancel', async () => {
    await render(
      <FamilyPilotRecoveryScreen
        snapshot={snapshotFor('recovered', 'schema-unreadable')}
        actions={{ resetLocalPilot: () => {} }}
      />,
    )
    const trigger = findButton('Reset pilot data on this device')
    await press(trigger)
    expect(documentTarget.activeElement.getAttribute('role')).toBe('alert')
    expect(hasText(documentTarget.activeElement, 'permanently erase')).toBe(true)

    await press(findButton('Cancel'))
    // The trigger unmounts while the warning is shown, so cancelling mounts a
    // fresh button at the same position — re-query rather than compare object
    // identity with the pre-confirm element.
    expect(documentTarget.activeElement).toBe(findButton('Reset pilot data on this device'))
  })
})

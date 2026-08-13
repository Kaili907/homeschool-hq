// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyPilotShell } from '../FamilyPilotShell'
import { hostLessonCurriculumPort } from './curriculum'
import { IntegratedPilotSurface } from './IntegratedPilotSurface'

// CLAUDE-WIN-FAMILY-PILOT-LEARNER-SAFETY-TRIGGER-R1
//
// Drives the REAL composed surface (FamilyPilotShell + IntegratedPilotSurface,
// the same composition FamilyPilotHost.tsx uses) through a real jsdom DOM with
// real dispatched events, so React's event delegation is genuinely exercised —
// not asserted against static markup and not driven by calling
// controller.helpTurn directly. The safety-hold bridge, the Tutor bridge and
// the Parent Hub are all the existing, already-reviewed pieces; this file only
// proves the missing learner input wires them together correctly end to end.
//
// canHelp() never has a scored `problem` in the pilot's current wiring (see
// FamilyPilotController#help), so every turn here takes the static-fallback
// path and never calls the real Tutor provider — no network/API mocking is
// required for these tests to stay offline.

class MemStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

function setValue(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function textOf(el: Element | null): string {
  return el?.textContent ?? ''
}

/**
 * Once the parent view is toggled open, FamilyPilotStudentCard renders its
 * own unrelated role="alert" ("Safety-event history may be incomplete on
 * this device"). Scoping to the learner's own surface is what keeps
 * assertions about the safety-hold banner from matching that one instead.
 */
function studentSurface(container: Element): Element {
  return container.querySelector('[data-testid="family-pilot-student-work"]')!
}

function buttonWithText(container: Element, text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((btn) => btn.textContent?.includes(text))
  if (!match) throw new Error(`No button found containing "${text}"`)
  return match
}

describe('rendered Family Pilot learner safety trigger', () => {
  let container: HTMLDivElement
  let root: Root | null
  let storage: MemStorage
  const now = () => new Date('2026-08-12T15:00:00.000Z')

  beforeEach(() => {
    // The root-app vitest project's setup deletes the bare `localStorage`
    // global for the plain Node environment (tests/node-test-setup.ts), and
    // under this file's jsdom environment `window` IS globalThis, so that
    // deletion wipes window.localStorage too. FamilyPilotSafetyHoldBridge's
    // browserStorage() reads window.localStorage directly, so it needs a real
    // one restored here — a fresh in-memory Storage per test.
    vi.stubGlobal('localStorage', new MemStorage())
    storage = new MemStorage()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = null
  })

  afterEach(async () => {
    if (root) await act(async () => root!.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  async function settle(): Promise<void> {
    for (let tick = 0; tick < 10; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    }
  }

  async function mount(): Promise<void> {
    // Hoisted OUTSIDE the render-prop closure and passed by reference:
    // FamilyPilotShell invokes its children function on every one of its own
    // renders, and IntegratedPilotSurface's controller is memoized on
    // `curriculum`/`store` identity. A literal created inside the render-prop
    // body would be a fresh object every invocation, defeating that memo and
    // recreating the controller (and therefore re-running its mount effect,
    // which itself triggers a reload) on every render — an infinite loop.
    const curriculum = hostLessonCurriculumPort(1)
    const store = { storage, now: () => now().toISOString() }
    root = createRoot(container)
    await act(async () => {
      root!.render(
        <FamilyPilotShell onExit={() => {}} enabled store={store}>
          {(context) => (
            <IntegratedPilotSurface
              context={context}
              curriculum={curriculum}
              store={store}
              now={now}
              householdTimeZone="UTC"
            />
          )}
        </FamilyPilotShell>,
      )
    })
    await settle()
  }

  async function click(el: Element): Promise<void> {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await settle()
  }

  /**
   * A hold's "Resolve and let them resume" button only accepts a click once
   * it has been armed for a beat (FamilyPilotParentHub's click-through
   * guard) — this waits past that boundary before the deliberate resolve
   * click, the same way a real parent's click naturally lands well after the
   * button appears.
   */
  async function waitUntilArmed(button: Element): Promise<void> {
    for (let tick = 0; tick < 30 && button.getAttribute('data-armed') !== 'true'; tick += 1) {
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    }
  }

  async function addLearner(name: string): Promise<void> {
    const input = container.querySelector<HTMLInputElement>('#family-pilot-new-learner')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, name)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(buttonWithText(container, 'Add learner'))
  }

  async function selectLearner(name: string): Promise<void> {
    const button = [...container.querySelectorAll<HTMLButtonElement>('[data-student-ref]')]
      .find((btn) => btn.textContent === name)
    if (!button) throw new Error(`No learner button found for "${name}"`)
    await click(button)
  }

  async function startFirstAssignment(): Promise<void> {
    await click(buttonWithText(container, 'Start assignment'))
  }

  async function openHelp(): Promise<void> {
    await click(container.querySelector('[data-testid="family-pilot-help"]')!)
  }

  async function sendHelpMessage(message: string): Promise<void> {
    const textarea = container.querySelector<HTMLTextAreaElement>('[data-testid="family-pilot-help-input"]')!
    await act(async () => setValue(textarea, message))
    await click(container.querySelector('[data-testid="family-pilot-help-send"]')!)
  }

  it('offers a learner text input wired to the tutor bridge, and requires it (not a direct controller call) to reach a reply', async () => {
    await mount()
    await addLearner('Ada')
    await startFirstAssignment()
    await openHelp()

    const input = container.querySelector<HTMLTextAreaElement>('[data-testid="family-pilot-help-input"]')
    expect(input).not.toBeNull()
    expect(buttonWithText(container, 'Ask')).not.toBeNull()
    // canHelp() never has a scored problem in the pilot's current wiring, so
    // this greeting is the static-fallback reply, not a Tutor Core greeting —
    // see the file header note.
    expect(textOf(container.querySelector('[data-tutor="text"]'))).toContain("can't pull up extra tutor help")

    await sendHelpMessage('how do I start this one?')

    // Proves the round trip actually went through controller.helpTurn (the
    // input is only cleared once that awaited call returns) rather than the
    // test having called it directly.
    expect(input!.value).toBe('')
    // A benign message never becomes a lasting concern: no hold, learner keeps working.
    expect(container.querySelector('[data-testid="family-pilot-study"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('blocks the learner after a concerning message, lets the parent resolve the exact hold, and the learner resumes; a later concern opens a new hold', async () => {
    await mount()
    await addLearner('Ada')
    await startFirstAssignment()
    await openHelp()

    await sendHelpMessage('I want to hurt myself')

    // Requirement 8: held learner cannot continue — the working toolbar and
    // the optimistic study shell are both gone, not left stale/usable.
    expect(container.querySelector('[data-testid="family-pilot-study"]')).toBeNull()
    // Requirement 7: a visible blocked / get-an-adult state.
    const alert = studentSurface(container).querySelector('[role="alert"]')
    expect(textOf(alert)).toMatch(/adult/i)

    // Requirement 9: parent sees the exact hold.
    await click(container.querySelector('[data-testid="family-pilot-parent-toggle"]')!)
    const holdsSection = container.querySelector('[data-testid="family-pilot-safety-holds"]')!
    expect(textOf(holdsSection)).toContain('tutor-concerning-content')
    const holdItem = holdsSection.querySelector('[data-hold-ref]')!
    const firstHoldRef = holdItem.getAttribute('data-hold-ref')
    expect(firstHoldRef).toBeTruthy()

    // Held learner cannot continue: the flagged turn already forced the
    // learner back to the plain assignment list (see IntegratedFamilyPilot's
    // shellEpoch remount — an optimistic-shell fix, not just a hidden
    // toolbar), and retrying from there is refused again.
    await click(buttonWithText(container, 'Continue assignment'))
    expect(container.querySelector('[data-testid="family-pilot-study"]')).toBeNull()
    expect(textOf(studentSurface(container).querySelector('[role="alert"]'))).toMatch(/adult/i)

    // Requirement 10: parent Resolve clears the exact hold.
    await waitUntilArmed(buttonWithText(holdsSection, 'Resolve and let them resume'))
    await click(buttonWithText(holdsSection, 'Resolve and let them resume'))
    expect(textOf(holdsSection)).toContain('Nothing is paused for Ada')

    // Requirement 11: learner resumes.
    await click(buttonWithText(container, 'Continue assignment'))
    expect(container.querySelector('[data-testid="family-pilot-study"]')).not.toBeNull()
    expect(studentSurface(container).querySelector('[role="alert"]')).toBeNull()

    // Requirement 12: a later concerning message opens a NEW hold.
    await openHelp()
    await sendHelpMessage('I hate myself')
    expect(container.querySelector('[data-testid="family-pilot-study"]')).toBeNull()
    const secondHoldItem = holdsSection.querySelector('[data-hold-ref]')
    expect(secondHoldItem).not.toBeNull()
    expect(secondHoldItem!.getAttribute('data-hold-ref')).not.toBe(firstHoldRef)
  })

  it('leaves a second learner unaffected by the first learner’s hold', async () => {
    await mount()
    await addLearner('Ada')
    await startFirstAssignment()
    await openHelp()
    await sendHelpMessage('I want to hurt myself')
    expect(container.querySelector('[data-testid="family-pilot-study"]')).toBeNull()

    await addLearner('Bo')
    await selectLearner('Bo')

    expect(textOf(container)).not.toContain('adult')
    await startFirstAssignment()
    expect(container.querySelector('[data-testid="family-pilot-study"]')).not.toBeNull()
  })
})

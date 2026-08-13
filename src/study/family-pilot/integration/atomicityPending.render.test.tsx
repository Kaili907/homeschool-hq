// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FamilyPilotShell } from '../FamilyPilotShell'
import { hostLessonCurriculumPort } from './curriculum'
import { IntegratedPilotSurface } from './IntegratedPilotSurface'

// SAFETY-ATOMICITY-H1 — rendered proof of the UI defense-in-depth layer.
//
// Drives the REAL composed surface through real jsdom DOM events, exactly
// like learnerSafetyTrigger.render.test.tsx. No safety hold is ever seeded by
// this test, and no real model/provider is reached: canHelp() never has a
// scored `problem` in the pilot's current wiring (see
// FamilyPilotController#help), so every turn here takes the static-fallback
// path, which never calls the Tutor gateway — see that file's own header
// note for the same property.
//
// The "delayed, deterministic" turn this file proves against is the turn's
// own promise itself: the Ask click is dispatched with the SYNCHRONOUS form
// of act() and the assertions run before this test ever awaits anything, so
// no microtask — including the one that would resolve controller.helpTurn()
// and flip helpBusy back to false — has had a chance to run yet. That is not
// a race: per the JS spec, queued microtasks only run once the synchronous
// call stack currently executing (this test function, up to its next
// `await`) unwinds. This is the exact instant Study mutations must already
// be refused, per INVARIANT 2.

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

function buttonWithText(container: Element, text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((btn) => btn.textContent?.includes(text))
  if (!match) throw new Error(`No button found containing "${text}"`)
  return match
}

describe('rendered Family Pilot pending-classification defense in depth', () => {
  let container: HTMLDivElement
  let root: Root | null
  let storage: MemStorage
  const now = () => new Date('2026-08-12T15:00:00.000Z')

  beforeEach(() => {
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

  async function addLearner(name: string): Promise<void> {
    const input = container.querySelector<HTMLInputElement>('#family-pilot-new-learner')!
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
    await act(async () => {
      setter.call(input, name)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await click(buttonWithText(container, 'Add learner'))
  }

  async function startFirstAssignment(): Promise<void> {
    await click(buttonWithText(container, 'Start assignment'))
  }

  async function openHelp(): Promise<void> {
    await click(container.querySelector('[data-testid="family-pilot-help"]')!)
  }

  it('disables Pause, Save my place, Finish this step and Finish while the Ask turn is still pending, and re-enables once it settles', async () => {
    await mount()
    await addLearner('Ada')
    await startFirstAssignment()
    await openHelp()

    const textarea = container.querySelector<HTMLTextAreaElement>('[data-testid="family-pilot-help-input"]')!
    await act(async () => setValue(textarea, 'how do I start this one?'))

    const askButton = container.querySelector<HTMLButtonElement>('[data-testid="family-pilot-help-send"]')!
    const saveButton = buttonWithText(container, 'Save my place')
    const finishStepButton = buttonWithText(container, 'Finish this step')
    const pauseButton = buttonWithText(container, 'Pause')
    const finishButton = buttonWithText(container, 'Finish')

    // Sanity check: before the Ask turn starts, these are all enabled.
    expect(saveButton.disabled).toBe(false)
    expect(finishStepButton.disabled).toBe(false)
    expect(pauseButton.disabled).toBe(false)
    expect(finishButton.disabled).toBe(false)

    // Dispatch synchronously — deliberately NOT awaited — so the assertions
    // below run before any microtask (including the one that would resolve
    // controller.helpTurn()) has a chance to run.
    act(() => { askButton.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(saveButton.disabled).toBe(true)
    expect(finishStepButton.disabled).toBe(true)
    expect(pauseButton.disabled).toBe(true)
    expect(finishButton.disabled).toBe(true)
    // The click itself must not have executed yet either — it is refused by
    // the domain gate, not merely hidden by disabled markup.
    expect(container.querySelector('[data-testid="family-pilot-study"]')).not.toBeNull()

    await settle()

    expect(saveButton.disabled).toBe(false)
    expect(finishStepButton.disabled).toBe(false)
    expect(pauseButton.disabled).toBe(false)
    expect(finishButton.disabled).toBe(false)
    // A benign message never becomes a lasting concern: the learner is still
    // on their assignment, not blocked.
    expect(container.querySelector('[data-testid="family-pilot-study"]')).not.toBeNull()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })
})

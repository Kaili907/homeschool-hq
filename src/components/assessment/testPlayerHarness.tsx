// Drives the REAL TestPlayer without a DOM.
//
// The component under test is the shipped one: this harness only supplies what
// React and the browser would have supplied — hook storage (testPlayerHooks) and
// click/type plumbing — and wires the player's callbacks to the REAL attempt
// reducers, composed exactly as AssessmentRunner composes them.

import type { ReactElement, ReactNode } from 'react'
import { TestPlayer } from './TestPlayer'
import {
  completedAttempt,
  finishAttempt,
  inProgressAttempt,
  recordAnswer,
  startAttempt,
} from '../../assessment/attempts'
import type { AssessmentState, Attempt, FixedTest } from '../../assessment/types'
import { emptyAssessmentState } from '../../assessment/types'
import { beginRender, resetHooks } from './testPlayerHooks'

// ---------- element-tree reading ----------

interface AnyProps {
  children?: ReactNode
  disabled?: boolean
  value?: string
  onClick?: () => void
  onBlur?: () => void
  onChange?: (e: { target: { value: string } }) => void
}

/** Concatenate the rendered text of a node, the way a reader would see it. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  const el = node as ReactElement<AnyProps>
  return el.props ? textOf(el.props.children) : ''
}

function walk(node: ReactNode, visit: (el: ReactElement<AnyProps>) => void): void {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit)
    return
  }
  const el = node as ReactElement<AnyProps>
  visit(el)
  walk(el.props?.children, visit)
}

function elementsOfType(tree: ReactNode, type: string): ReactElement<AnyProps>[] {
  const found: ReactElement<AnyProps>[] = []
  walk(tree, (el) => {
    if (el.type === type) found.push(el)
  })
  return found
}

// ---------- driver ----------

export interface PlayerDriver {
  /** 1-based item position and item count, read off the player's own header. */
  position(): { index: number; total: number }
  /** Exact text of every button currently on screen. */
  buttonLabels(): string[]
  hasButton(label: string): boolean
  click(label: string): void
  clickNext(): void
  clickBack(): void
  clickSkip(): void
  clickFinish(): void
  /** Type into the item's input/textarea (fires onChange only, like a keystroke). */
  typeAnswer(value: string): void
  /** Move focus away from the item's input/textarea. */
  blurAnswer(): void
  saveAndExit(): void
  exited(): boolean
  state(): AssessmentState
  attempt(): Attempt
}

export const NEXT = 'Next →'
export const BACK = '← Back'
export const SKIP = "I don't know how to start — SKIP"
export const FINISH = 'Finish & turn in'
export const SAVE_AND_EXIT = 'Save & exit'

export function drivePlayer(
  test: FixedTest,
  opts: { profileId?: string; startedAt?: string; finishedAt?: string } = {},
): PlayerDriver {
  const profileId = opts.profileId ?? 'p1'
  const startedAt = opts.startedAt ?? '2026-08-07T09:00:00.000Z'
  const finishedAt = opts.finishedAt ?? '2026-08-07T09:30:00.000Z'

  let state = startAttempt(emptyAssessmentState(), test.id, profileId, startedAt).state
  let tree: ReactNode = null
  let exited = false

  const currentAttempt = (): Attempt =>
    inProgressAttempt(state, test.id) ?? completedAttempt(state, test.id)!

  const render = () => {
    // Once the attempt is finished the runner swaps the player out for the done
    // screen, so the harness stops rendering it too.
    if (currentAttempt().finishedAt) return
    beginRender()
    tree = TestPlayer({
      test,
      attempt: currentAttempt(),
      onRecord: (itemId, value, skipped, addMs) => {
        state = recordAnswer(state, test.id, itemId, value, skipped, addMs)
      },
      onFinish: (lastId, value, skipped, addMs) => {
        // Same single composed update AssessmentRunner performs, so a stale-base
        // finish can never clobber the last item's record.
        state = finishAttempt(
          recordAnswer(state, test.id, lastId, value, skipped, addMs),
          test,
          finishedAt,
        )
      },
      onExit: () => {
        exited = true
      },
    }) as ReactElement
  }

  resetHooks()
  render()

  const buttons = () => elementsOfType(tree, 'button')

  const findButton = (label: string): ReactElement<AnyProps> => {
    const matches = buttons().filter((b) => textOf(b.props.children) === label)
    if (matches.length !== 1) {
      throw new Error(
        `expected exactly 1 button labelled "${label}", found ${matches.length}; on screen: ${JSON.stringify(
          buttons().map((b) => textOf(b.props.children)),
        )}`,
      )
    }
    return matches[0]
  }

  const field = (): ReactElement<AnyProps> => {
    const inputs = [...elementsOfType(tree, 'input'), ...elementsOfType(tree, 'textarea')]
    if (inputs.length !== 1) {
      throw new Error(`expected exactly 1 text field on screen, found ${inputs.length}`)
    }
    return inputs[0]
  }

  const click = (label: string) => {
    const button = findButton(label)
    if (button.props.disabled) throw new Error(`button "${label}" is disabled`)
    button.props.onClick?.()
    render()
  }

  return {
    position() {
      let found: { index: number; total: number } | null = null
      walk(tree, (el) => {
        const match = /·\s+(\d+) of (\d+)$/.exec(textOf(el.props.children))
        if (match && !found) found = { index: Number(match[1]), total: Number(match[2]) }
      })
      if (!found) throw new Error('player header did not render a "N of M" position')
      return found
    },
    buttonLabels: () => buttons().map((b) => textOf(b.props.children)),
    hasButton: (label) => buttons().some((b) => textOf(b.props.children) === label),
    click,
    clickNext: () => click(NEXT),
    clickBack: () => click(BACK),
    clickSkip: () => click(SKIP),
    clickFinish: () => click(FINISH),
    typeAnswer(value) {
      field().props.onChange?.({ target: { value } })
      render()
    },
    blurAnswer() {
      field().props.onBlur?.()
      render()
    },
    saveAndExit: () => click(SAVE_AND_EXIT),
    exited: () => exited,
    state: () => state,
    attempt: currentAttempt,
  }
}

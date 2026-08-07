import { describe, expect, it, vi } from 'vitest'

// The evidence tests have to press buttons, so the three hooks TestPlayer uses
// are served from a synchronous store. Everything else about the component —
// its handlers, its element tree, its callbacks — is the shipped code.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  const hooks = await import('./testPlayerHooks')
  return { ...actual, useState: hooks.useState, useRef: hooks.useRef, useMemo: hooks.useMemo }
})

import { BACK, FINISH, NEXT, SAVE_AND_EXIT, SKIP, drivePlayer } from './testPlayerHarness'
import { gradeAttempt } from '../../assessment/attempts'
import { HS_GRAMMAR } from '../../assessment/banks'
import type { Attempt, FixedTest, ResponseDisposition } from '../../assessment/types'

/** Three items in one section: a choice, then two text items. */
const FIXTURE: FixedTest = {
  id: 'ce3-evidence-fixture',
  title: 'Evidence fixture',
  forGrades: ['3'],
  sections: [
    {
      name: 'Section 1 — Only',
      items: [
        { id: 'q1', kind: 'choice', prompt: 'Pick a colour', choices: ['red', 'blue'], key: 'red' },
        { id: 'q2', kind: 'text', prompt: 'Write something', key: '7' },
        { id: 'q3', kind: 'text', prompt: 'Write something else', key: '9' },
      ],
    },
  ],
}

const dispositionOf = (test: FixedTest, attempt: Attempt, itemId: string): ResponseDisposition =>
  gradeAttempt(test, attempt).find((g) => g.item.id === itemId)!.disposition

// ---------- Phase 5: what each control writes ----------

describe('TestPlayer writes only evidence the child actually produced', () => {
  it('Next on an untouched CHOICE item records nothing at all', () => {
    const player = drivePlayer(FIXTURE)
    expect(player.position()).toEqual({ index: 1, total: 3 })

    player.clickNext()

    expect(player.position()).toEqual({ index: 2, total: 3 })
    expect(player.attempt().answers.q1).toBeUndefined()
  })

  it('Next on an untouched TEXT item records nothing at all', () => {
    const player = drivePlayer(FIXTURE)
    player.clickNext() // q1 → q2
    player.clickNext() // q2 → q3

    expect(player.attempt().answers.q2).toBeUndefined()
  })

  it('SKIP is the only control that writes a deliberate skip', () => {
    const player = drivePlayer(FIXTURE)
    player.clickSkip()

    expect(player.attempt().answers.q1).toMatchObject({ value: '', skipped: true })
    expect(player.position()).toEqual({ index: 2, total: 3 })
  })

  it('Back keeps an answer and never manufactures a skip', () => {
    const player = drivePlayer(FIXTURE)
    player.click('red') // answer q1
    player.clickNext()
    player.clickBack()

    expect(player.position()).toEqual({ index: 1, total: 3 })
    expect(player.attempt().answers.q1).toMatchObject({ value: 'red', skipped: false })

    player.clickNext() // q1 → q2, untouched
    player.clickBack() // back to q1
    expect(player.attempt().answers.q2).toBeUndefined()
    expect(player.attempt().answers.q1.skipped).toBe(false)
  })

  it('returning to a skipped item and clicking away keeps the skip', () => {
    const player = drivePlayer(FIXTURE)
    player.clickNext() // q1 → q2 (a text item, so it has a field to focus)
    player.clickSkip() // skip q2, lands on q3
    player.clickBack() // back to the skipped q2

    player.blurAnswer() // focus entered the field and left again; nothing typed

    expect(player.attempt().answers.q2).toMatchObject({ value: '', skipped: true })
  })

  it('typing over a skipped item replaces the skip with the real answer', () => {
    const player = drivePlayer(FIXTURE)
    player.clickNext()
    player.clickSkip() // skip q2
    player.clickBack() // back to q2
    player.typeAnswer('7')
    player.blurAnswer()

    expect(player.attempt().answers.q2).toMatchObject({ value: '7', skipped: false })
  })

  it('Save & exit persists the answer in front of the child without relying on blur', () => {
    const player = drivePlayer(FIXTURE)
    player.clickNext() // q2
    player.typeAnswer('7')
    player.saveAndExit()

    expect(player.exited()).toBe(true)
    expect(player.attempt().answers.q2).toMatchObject({ value: '7', skipped: false })
    expect(player.attempt().finishedAt).toBeUndefined() // still resumable
  })
})

// ---------- Phase 9: position must not change the verdict ----------

describe('an untouched item reads the same wherever it sits', () => {
  /** Walk the whole fixture, leaving exactly one item untouched, and finish. */
  const runLeavingUntouched = (untouched: 'q1' | 'q3'): Attempt => {
    const player = drivePlayer(FIXTURE)
    if (untouched !== 'q1') player.click('red')
    player.clickNext()
    player.typeAnswer('7') // q2 always answered
    player.clickNext()
    if (untouched !== 'q3') player.typeAnswer('9')
    player.clickFinish()
    return player.attempt()
  }

  it('an untouched FIRST item and an untouched LAST item get one disposition', () => {
    const first = runLeavingUntouched('q1')
    const last = runLeavingUntouched('q3')

    expect(first.finishedAt).toBeTruthy()
    expect(last.finishedAt).toBeTruthy()
    expect(dispositionOf(FIXTURE, first, 'q1')).toBe('no-response')
    expect(dispositionOf(FIXTURE, last, 'q3')).toBe('no-response')
    expect(dispositionOf(FIXTURE, first, 'q1')).toBe(dispositionOf(FIXTURE, last, 'q3'))
  })

  it('an untouched last item is never mistaken for a deliberate skip or for work to grade', () => {
    const last = runLeavingUntouched('q3')
    expect(dispositionOf(FIXTURE, last, 'q3')).not.toBe('deliberate-skip')
    expect(dispositionOf(FIXTURE, last, 'q3')).not.toBe('unmatched')
    expect(last.autoScore!.skips).toBe(0)
    expect(last.autoScore!.gradedItems).toBe(0)
    expect(last.autoScore!.noResponse).toBe(1)
  })

  it('a deliberate skip on the last item stays a deliberate skip', () => {
    const player = drivePlayer(FIXTURE)
    player.click('red')
    player.clickNext()
    player.typeAnswer('7')
    player.clickNext()
    player.clickSkip() // last item: skip does not advance
    expect(player.position()).toEqual({ index: 3, total: 3 })
    player.clickFinish()

    expect(dispositionOf(FIXTURE, player.attempt(), 'q3')).toBe('deliberate-skip')
    expect(player.attempt().autoScore!.skips).toBe(1)
    expect(player.attempt().autoScore!.noResponse).toBe(0)
  })
})

// ---------- Phase 3: the assumption that lets us omit a "seen" field ----------

describe('navigation invariant that makes a seen/visited field unnecessary', () => {
  const NAV = new Set([BACK, NEXT, FINISH, SKIP, SAVE_AND_EXIT])

  it('Finish is offered only on the final item, and Next advances exactly one item', () => {
    const player = drivePlayer(HS_GRAMMAR)
    const total = player.position().total
    expect(total).toBeGreaterThan(1)

    for (let expected = 1; expected < total; expected++) {
      expect(player.position()).toEqual({ index: expected, total })
      expect(player.hasButton(FINISH)).toBe(false)
      expect(player.hasButton(NEXT)).toBe(true)
      player.clickNext()
    }

    expect(player.position()).toEqual({ index: total, total })
    expect(player.hasButton(FINISH)).toBe(true)
    expect(player.hasButton(NEXT)).toBe(false)
  })

  it('the player offers no control that jumps to an arbitrary item', () => {
    const player = drivePlayer(HS_GRAMMAR)
    const total = player.position().total

    for (let position = 1; position <= total; position++) {
      const item = HS_GRAMMAR.sections.flatMap((s) => s.items)[position - 1]
      const allowed = new Set([...NAV, ...(item.choices ?? [])])
      for (const label of player.buttonLabels()) {
        expect(allowed.has(label), `unexpected control "${label}" at item ${position}`).toBe(true)
      }
      if (position < total) player.clickNext()
    }
  })

  it('every item of a finished attempt was therefore reached — none reads as not-reached', () => {
    const player = drivePlayer(HS_GRAMMAR)
    const total = player.position().total
    for (let position = 1; position < total; position++) player.clickNext()
    player.clickFinish()

    const dispositions = gradeAttempt(HS_GRAMMAR, player.attempt()).map((g) => g.disposition)
    expect(dispositions).toHaveLength(total)
    expect(dispositions).not.toContain('not-reached')
    expect(new Set(dispositions)).toEqual(new Set(['no-response']))
  })
})

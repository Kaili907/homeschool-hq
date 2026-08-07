import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AssessmentResults } from './AssessmentResults'
import type { Attempt, AutoScore, FixedTest } from '../../assessment/types'

// The other half of Phase 8: the on-screen results Dad reads, not just the export.

const TEST: FixedTest = {
  id: 'res',
  title: 'Results fixture',
  forGrades: ['3'],
  sections: [
    {
      name: 'Only',
      items: [
        { id: 'r1', kind: 'numeric', prompt: 'keyed item', key: '7' },
        { id: 'r2', kind: 'text', prompt: 'human item', keyNote: 'a human reads this' },
      ],
    },
  ],
}

const attempt = (answers: Attempt['answers'], autoScore?: AutoScore): Attempt => ({
  testId: 'res',
  profileId: 'p',
  startedAt: '2026-08-07T09:00:00.000Z',
  finishedAt: '2026-08-07T09:30:00.000Z',
  answers,
  autoScore,
})

const render = (a: Attempt) =>
  renderToStaticMarkup(<AssessmentResults test={TEST} attempt={a} studentName="Third Grader" />)

describe('AssessmentResults tells a parent what actually happened', () => {
  it('a blank response reads as no response, never as work awaiting a human', () => {
    const html = render(
      attempt({
        r1: { value: '', skipped: false, msOnItem: 800 },
        r2: { value: '', skipped: false, msOnItem: 800 },
      }),
    )
    expect(html).toContain('no response')
    expect(html).not.toContain('>grade<')
    expect(html).not.toContain('SKIPPED')
  })

  it('a deliberate skip still reads as a skip', () => {
    const html = render(attempt({ r1: { value: '', skipped: true, msOnItem: 800 } }))
    expect(html).toContain('SKIPPED')
  })

  it('an unmatched real answer still reaches the human queue', () => {
    const html = render(attempt({ r1: { value: 'about seven', skipped: false, msOnItem: 9000 } }))
    expect(html).toContain('>grade<')
  })

  it('a legacy summary says "not recorded" instead of implying zero', () => {
    const html = render(
      attempt({ r1: { value: '', skipped: false, msOnItem: 800 } }, {
        bySection: { Only: { correct: 0, of: 0 } },
        gradedItems: 1,
        skips: 1,
      }),
    )
    expect(html).toContain('no response: not recorded')
    expect(html).not.toContain('0 no response')
    expect(html).toContain('may')
    expect(html).toContain('left blank')
    // both counts a seen-but-blank item could have landed in under the older rule
    expect(html).toMatch(/skip count/)
    expect(html).toMatch(/to-grade count/)
    expect(html).not.toMatch(/corrupt|lost|damaged|invalid/i)
  })

  it('a fresh summary reporting zero says zero, with no compatibility note', () => {
    const html = render(
      attempt({ r1: { value: '7', skipped: false, msOnItem: 800 } }, {
        bySection: { Only: { correct: 1, of: 1 } },
        gradedItems: 0,
        skips: 0,
        noResponse: 0,
      }),
    )
    expect(html).toContain('0 no response')
    expect(html).not.toContain('not recorded')
    expect(html).not.toContain('left blank')
  })
})

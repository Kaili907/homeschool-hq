import { describe, expect, it } from 'vitest'
import { assessAnswerKeyAuthority, assessAnswerKeyContent } from './answerKeyAuthority'

const TITLE = 'Comparing Multi-Digit Numbers Using Place Value'

const REAL_KEY =
  'Item 1: 48,352 is greater than 48,325 because the tens place decides at 5 versus 2. ' +
  'Item 2: 62,481 is greater than 62,418 for the same reason, and items 3 through 14 each ' +
  'name the first place value where the two numbers differ.'

describe('assessAnswerKeyContent', () => {
  it('treats a declared-but-text-less key as having no scorable content', () => {
    const signal = assessAnswerKeyContent({ present: true }, TITLE)
    expect(signal.hollowReasons.length).toBeGreaterThan(0)
  })

  it('treats a whitespace-only key as having no scorable content', () => {
    const signal = assessAnswerKeyContent({ present: true, text: '   \n  ' }, TITLE)
    expect(signal.hollowReasons.length).toBeGreaterThan(0)
  })

  it.each(['TODO', 'TODO: add the answers', 'Answer key TBD', 'FIXME before release', 'placeholder'])(
    'rejects the authoring placeholder %j',
    (text) => {
      expect(assessAnswerKeyContent({ present: true, text }, TITLE).hollowReasons.length).toBeGreaterThan(0)
    },
  )

  it.each(['N/A', 'none', '---', 'xxx'])('rejects the filler token %j', (text) => {
    expect(assessAnswerKeyContent({ present: true, text }, TITLE).hollowReasons.length).toBeGreaterThan(0)
  })

  it('doubts a key that defers the answer elsewhere instead of stating it', () => {
    const signal = assessAnswerKeyContent(
      {
        present: true,
        text:
          'Answers will vary depending on the numbers each student chooses; see the teacher guide ' +
          'for the full set of worked comparisons and the expected justification for each pair.',
      },
      TITLE,
    )
    expect(signal.hollowReasons).toEqual([])
    expect(signal.doubtReasons.length).toBeGreaterThan(0)
  })

  it('doubts a key too thin to read as a worked key', () => {
    const signal = assessAnswerKeyContent({ present: true, text: '2 + 2 = 5' }, TITLE)
    expect(signal.doubtReasons.length).toBeGreaterThan(0)
  })

  it('accepts a specific, item-by-item key', () => {
    const signal = assessAnswerKeyContent({ present: true, text: REAL_KEY }, TITLE)
    expect(signal.hollowReasons).toEqual([])
    expect(signal.doubtReasons).toEqual([])
  })
})

describe('assessAnswerKeyAuthority', () => {
  const EVIDENCE =
    'Recomputed from each item\'s own stated digits by the build\'s comparison checker, independently of the authored key.'

  it('rejects an absent verification record', () => {
    expect(assessAnswerKeyAuthority(undefined).verified).toBe(false)
  })

  it('rejects an explicitly unverified record', () => {
    expect(assessAnswerKeyAuthority({ method: 'UNVERIFIED', evidence: EVIDENCE }).verified).toBe(false)
  })

  it('rejects a declared method with no evidence behind it', () => {
    expect(assessAnswerKeyAuthority({ method: 'INDEPENDENT_ORACLE' }).verified).toBe(false)
    expect(assessAnswerKeyAuthority({ method: 'HUMAN_VERIFIED', evidence: '  ' }).verified).toBe(false)
  })

  it('rejects evidence too thin to tell what was checked against what', () => {
    expect(assessAnswerKeyAuthority({ method: 'SOURCE_AUTHORITY', evidence: 'checked it' }).verified).toBe(false)
  })

  it.each(['INDEPENDENT_ORACLE', 'SOURCE_AUTHORITY', 'HUMAN_VERIFIED', 'OTHER_VERIFIED_METHOD'] as const)(
    'accepts %s backed by substantive evidence',
    (method) => {
      expect(assessAnswerKeyAuthority({ method, evidence: EVIDENCE }).verified).toBe(true)
    },
  )
})

describe('assessAnswerKeyContent — vocabulary is not an authoring marker', () => {
  it('accepts a key that uses "placeholder" as place-value vocabulary', () => {
    const signal = assessAnswerKeyContent(
      {
        present: true,
        text:
          'Item 1: 48,352 is greater than 48,325; the tens place decides at 5 versus 2. Item 2: in ' +
          '40,052 the zero acts as a placeholder in the hundreds place, so the comparison moves to ' +
          'the tens. Items 3 through 14 each name the deciding place value.',
      },
      TITLE,
    )
    expect(signal.hollowReasons).toEqual([])
  })

  it('accepts a Spanish-language key beginning with "Todos"', () => {
    const signal = assessAnswerKeyContent(
      {
        present: true,
        text:
          'Todos los estudiantes comparan 48.352 y 48.325 empezando por el valor posicional mayor; ' +
          'la posicion de las decenas decide con 5 frente a 2, y los demas elementos siguen la misma regla.',
      },
      TITLE,
    )
    expect(signal.hollowReasons).toEqual([])
  })

  it.each([
    'The answer key for this lesson will be added by the curriculum team before the unit is published to families next term.',
    'Answer key pending final review by the math lead; the worked solutions for all fourteen comparison items are still being drafted.',
    'Draft only, not final. The solutions below are a first pass and have not been checked against the item scenarios yet.',
  ])('doubts a key that says in plain English it is unfinished: %j', (text) => {
    const signal = assessAnswerKeyContent({ present: true, text }, TITLE)
    expect(signal.doubtReasons.length).toBeGreaterThan(0)
  })
})

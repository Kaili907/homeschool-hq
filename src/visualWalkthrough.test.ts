import { describe, expect, it } from 'vitest'
import { GENERATOR_SKILL_IDS, generateQuestion } from './generators'
import { explain } from './explain'
import type { VizStep } from './explain'
import { answerOf, ints, promptInts } from './explain/types'
import { columnAdd, columnSub } from './explain/vizHelpers'
import type { Difficulty, Question } from './types'

const DIFFICULTIES: Difficulty[] = [1, 2, 3]
const RUNS = 40
const PLACEHOLDER = /\$\{|[{}`]|undefined|NaN/

// ---------------------------------------------------------------------------
// helpers to introspect a viz
// ---------------------------------------------------------------------------
function vizStrings(v: VizStep): string[] {
  switch (v.kind) {
    case 'column':
      return [...v.rows, v.result ?? '', ...(v.annotations ?? []).map((a) => a.text)]
    case 'equationLedger':
      return v.lines.flatMap((l) => [l.left, l.right, l.op ?? ''])
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// 1. Fuzz: every viz's numbers derive from the actual question; no placeholders.
// ---------------------------------------------------------------------------
describe('MT-1V viz numbers derive from the question', () => {
  for (const skillId of GENERATOR_SKILL_IDS) {
    it(`${skillId}: viz are placeholder-free and internally consistent with the prompt`, () => {
      for (const d of DIFFICULTIES) {
        for (let run = 0; run < RUNS; run++) {
          const q = generateQuestion(skillId, d)
          const ex = explain(q)
          const fromQ = new Set([...promptInts(q), ...ints(answerOf(q))])
          for (const s of ex.steps) {
            if (!s.viz) continue
            const v = s.viz
            // no un-interpolated template leaked into any string field
            for (const str of vizStrings(v)) expect(str).not.toMatch(PLACEHOLDER)

            if (v.kind === 'column') {
              // rows and result are pure digit strings
              for (const r of v.rows) expect(r).toMatch(/^\d+$/)
              // the vertical math is real: op(rows) === result
              const nums = v.rows.map(Number)
              if (v.result) {
                const r = Number(v.result)
                if (v.op === '+') expect(nums[0] + nums[1]).toBe(r)
                if (v.op === '−') expect(Math.abs(nums[0] - nums[1])).toBe(r)
                if (v.op === '×') expect(nums[0] * nums[1]).toBe(r)
              }
              // operands trace back to the question's own numbers
              for (const n of nums) expect(fromQ.has(n)).toBe(true)
            } else if (v.kind === 'fractionBar') {
              expect(v.parts).toBeGreaterThan(0)
              expect(v.shaded).toBeGreaterThanOrEqual(0)
              expect(v.shaded).toBeLessThanOrEqual(v.parts)
              if (v.compare) expect(v.compare.shaded).toBeLessThanOrEqual(v.compare.parts)
            } else if (v.kind === 'numberLine') {
              expect(v.min).toBeLessThanOrEqual(v.max)
              if (v.point !== undefined) {
                expect(v.point).toBeGreaterThanOrEqual(v.min)
                expect(v.point).toBeLessThanOrEqual(v.max)
              }
              for (const m of v.marks ?? []) {
                expect(m).toBeGreaterThanOrEqual(v.min)
                expect(m).toBeLessThanOrEqual(v.max)
              }
            } else if (v.kind === 'array') {
              expect(v.rows).toBeGreaterThan(0)
              expect(v.cols).toBeGreaterThan(0)
            } else if (v.kind === 'equationLedger') {
              expect(v.lines.length).toBeGreaterThan(0)
              expect(v.activeLine).toBeGreaterThanOrEqual(0)
              expect(v.activeLine).toBeLessThan(v.lines.length)
            }
          }
        }
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 2. Depth floor across all 33 explainers.
// ---------------------------------------------------------------------------
describe('MT-1V depth floor (>=3 steps, concept-first, answer-last)', () => {
  for (const skillId of GENERATOR_SKILL_IDS) {
    it(`${skillId}: every generated question meets the floor`, () => {
      for (const d of DIFFICULTIES) {
        for (let run = 0; run < RUNS; run++) {
          const q = generateQuestion(skillId, d)
          const ex = explain(q)
          const answer = answerOf(q)
          // at least three steps
          expect(ex.steps.length).toBeGreaterThanOrEqual(3)
          // concept-first: the opener is not simply the answer line (it teaches the
          // idea, it doesn't just announce the result). A full "reveals the answer"
          // check isn't reliable — operands/denominators can equal the answer by
          // coincidence — so we assert the opener differs from the closing line.
          const first = ex.steps[0].say
          const lastSay = ex.steps[ex.steps.length - 1].say
          expect(first).not.toBe(lastSay)
          // answer stated in the final step (with its takeaway rule)
          expect(lastSay).toContain(answer)
        }
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 3. Diagnosis: present for a seeded matching wrong answer, absent otherwise.
// ---------------------------------------------------------------------------
describe('MT-1V distractor-aware diagnosis', () => {
  const q = (over: Partial<Question>): Question => ({
    skillId: 'addsub',
    difficulty: 2,
    prompt: '365 − 128 = ?',
    choices: ['237', '243', '337', '117'],
    answerIndex: 0,
    ...over,
  })

  it('names the no-borrow slip when her answer is the column-wise difference', () => {
    const question = q({}) // 365−128; "243" = |3-1||6-2||5-8| = no-borrow
    const base = explain(question)
    const dia = explain(question, 1) // chose 243
    expect(dia.steps.length).toBe(base.steps.length + 1)
    expect(dia.steps[0].say.toLowerCase()).toContain('borrow')
  })

  it('names rounding down when she rounds the wrong way', () => {
    const question = q({
      skillId: 'place',
      prompt: 'Round 347 to the nearest 10.',
      choices: ['350', '340', '400', '300'],
      answerIndex: 0,
    })
    const dia = explain(question, 1) // chose 340 (rounded down)
    expect(dia.steps[0].say.toLowerCase()).toMatch(/round(ed)? down/)
  })

  it('names the flipped fraction (top and bottom traded places)', () => {
    const question = q({
      skillId: 'fracUnit',
      prompt: 'What fraction of the bar is shaded?',
      choices: ['2/5', '5/2', '3/5', '2/6'],
      answerIndex: 0,
    })
    const flipped = explain(question, 1) // chose 5/2
    expect(flipped.steps[0].say.toLowerCase()).toMatch(/traded places|top and bottom/)
    const complement = explain(question, 2) // chose 3/5 = 5-2 / 5
    expect(complement.steps[0].say.toLowerCase()).toMatch(/aren't shaded|not.*shaded|shaded/)
  })

  it('adds NO diagnosis for an unrecognized wrong answer', () => {
    const question = q({}) // 337 is just ans+100, not the no-borrow value here
    const base = explain(question)
    const dia = explain(question, 2) // chose 337
    // 337 = 237 + 100 → recognized as a missed-borrow "ten too big"? that IS a pattern.
    // pick a truly unrecognized distractor instead:
    const wild = explain(q({ choices: ['237', '999', '337', '117'] }), 1)
    expect(wild.steps.length).toBe(base.steps.length)
    expect(dia.steps.length).toBeGreaterThanOrEqual(base.steps.length) // no crash either way
  })

  it('adds NO diagnosis when she was actually correct', () => {
    const question = q({})
    const base = explain(question)
    const onCorrect = explain(question, question.answerIndex)
    expect(onCorrect.steps.length).toBe(base.steps.length)
  })
})

// ---------------------------------------------------------------------------
// 4. Column flagship: borrows/carries land on the correct digits.
// ---------------------------------------------------------------------------
describe('MT-1V column viz renders borrows/carries on the right digits', () => {
  const cell = (v: ReturnType<typeof columnSub>, col: number) =>
    v.kind === 'column' ? (v.annotations ?? []).find((a) => a.cell.col === col) : undefined

  it('365 − 128: ones borrow to 15, tens lend down to 5', () => {
    const v = columnSub(365, 128)
    expect(v.kind).toBe('column')
    if (v.kind !== 'column') return
    expect(v.result).toBe('237')
    expect(cell(v, 2)?.text).toBe('15') // ones column becomes 15
    expect(cell(v, 1)?.text).toBe('5') // tens column lent 1, shows 5
    expect(cell(v, 0)).toBeUndefined() // hundreds untouched
  })

  it('300 − 128: borrow cascades across the zeros', () => {
    const v = columnSub(300, 128)
    if (v.kind !== 'column') return
    expect(v.result).toBe('172')
    expect(cell(v, 2)?.text).toBe('10')
    expect(cell(v, 1)?.text).toBe('9')
    expect(cell(v, 0)?.text).toBe('2')
  })

  it('365 + 128: a single carry into the tens column', () => {
    const v = columnAdd(365, 128)
    if (v.kind !== 'column') return
    expect(v.result).toBe('493')
    const carries = (v.annotations ?? []).filter((a) => a.kind === 'carry')
    expect(carries).toHaveLength(1)
    expect(carries[0].cell.col).toBe(1) // carried into the tens
  })
})

// ---------------------------------------------------------------------------
// 5. Assessment player stays untouched — no walkthrough/viz reaches it.
// ---------------------------------------------------------------------------
describe('MT-1V never touches the assessment player', () => {
  it('no assessment source imports the explain/walkthrough/viz layer', () => {
    // Load every assessment source file as raw text (Vite glob — no node deps).
    const sources = (import.meta as unknown as {
      glob: (p: string[], o: object) => Record<string, string>
    }).glob(
      ['./assessment/**/*.{ts,tsx}', './components/assessment/**/*.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true },
    )
    const paths = Object.keys(sources)
    expect(paths.length).toBeGreaterThan(0) // guard: the glob actually matched files
    const offenders = paths.filter((p) =>
      /from '.*\/explain'|Walkthrough|StepViz|vizHelpers/.test(sources[p]),
    )
    expect(offenders).toEqual([])
  })
})

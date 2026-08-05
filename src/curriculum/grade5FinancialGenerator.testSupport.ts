import { afterEach, describe, expect, it } from 'vitest'
import { setRng } from '../genUtils'
import { curriculumAnswer, type CurriculumQuestion } from './generatorCore'

const RUNS_PER_DIFFICULTY = 200
const cents = (value: string) => { const m = value.match(/^\$(\d+)\.(\d\d)$/); if (!m) throw new Error(`Not a rendered money amount: ${value}`); return Number(m[1]) * 100 + Number(m[2]) }
const money = (value: number) => `$${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`
const capture = (prompt: string, pattern: RegExp) => { const match = prompt.match(pattern); if (!match) throw new Error(`Prompt did not match independent oracle grammar: ${prompt}`); return match }

/** Recomputes answers solely by parsing the displayed prompt; it never reads parameters. */
export function answerFromRenderedFinancialPrompt(prompt: string): string {
  let m = prompt.match(/^A fictional plan has (\$\d+\.\d\d)\. It records expenses of (\$\d+\.\d\d) and (\$\d+\.\d\d)\./)
  if (m) return money(cents(m[1]) - cents(m[2]) - cents(m[3]))
  m = prompt.match(/^A fictional service earns (\$\d+\.\d\d) for each of (\d+) completed jobs\./)
  if (m) return money(cents(m[1]) * Number(m[2]))
  m = prompt.match(/^An item costs (\$\d+\.\d\d) before tax\. Sales tax is (\d+)%\./)
  if (m) { const base = cents(m[1]); return money(base + base * Number(m[2]) / 100) }
  m = prompt.match(/^An item costs (\$\d+\.\d\d)\. First take (\d+)% off, then add (\d+)% sales tax/)
  if (m) { const base=cents(m[1]); const discounted=base-base*Number(m[2])/100; return money(discounted+discounted*Number(m[3])/100) }
  m = prompt.match(/^A savings account has (\$\d+\.\d\d) for one year at simple interest of (\d+)%\./)
  if (m) return money(cents(m[1]) * Number(m[2]) / 100)
  m = prompt.match(/^A fictional record shows (\$\d+\.\d\d) shared equally among (\d+) identical items\./)
  if (m) return money(cents(m[1]) / Number(m[2]))
  capture(prompt, /./)
  throw new Error(`Unknown prompt form: ${prompt}`)
}

function seededRng(seed: number): () => number { let state=seed>>>0; return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/0x100000000} }

export function financialGeneratorContract<T extends string>(label: string, itemTypes: readonly T[], generate: (type: T, difficulty: 1|2|3) => CurriculumQuestion<T, unknown>) {
  afterEach(()=>setRng(null))
  describe(label,()=>{
    it(`reaches every item type at every difficulty with ${RUNS_PER_DIFFICULTY} independently checked cases`,()=>{
      let count=0
      itemTypes.forEach((type,typeIndex)=>{([1,2,3] as const).forEach(difficulty=>{setRng(seededRng(1000+typeIndex*17+difficulty));for(let run=0;run<RUNS_PER_DIFFICULTY;run++){const q=generate(type,difficulty);const expected=answerFromRenderedFinancialPrompt(q.prompt);expect(curriculumAnswer(q)).toBe(expected);expect(q.choices.filter(choice=>choice===expected)).toHaveLength(1);expect(new Set(q.choices).size).toBe(q.choices.length);expect(q.choices).toContain(expected);count++}})})
      expect(count).toBe(itemTypes.length*3*RUNS_PER_DIFFICULTY)
    })
    it('keeps three distinct misconceptions under a constant injected RNG',()=>{setRng(()=>0);itemTypes.forEach(type=>{const q=generate(type,3);expect(new Set(q.choices).size).toBe(4);expect(q.choices.filter(choice=>choice===curriculumAnswer(q))).toHaveLength(1)})})
  })
}

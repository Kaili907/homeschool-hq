import type { Question } from '../types'
import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, type Explainer, type Explanation } from './types'
import { EXPLAINERS3 } from './explainers'
import { EXPLAINERS4 } from './explainers4'
import { EXPLAINERS5 } from './explainers5'
import { EXPLAINERS6 } from './explainers6'
import { diagnose } from './diagnose'

export type { Explanation, ExplainStep, Explainer, VizStep } from './types'
export { diagnose } from './diagnose'

/** Every grade 3/4/5/6 skill maps to a scripted walkthrough. */
export const EXPLAINERS: Partial<Record<SkillId, Explainer>> = {
  ...EXPLAINERS3,
  ...EXPLAINERS4,
  ...EXPLAINERS5,
  ...EXPLAINERS6,
}

/** Skill ids that ship a walkthrough (the g3/4/5/6 coverage set). */
export const EXPLAINABLE_SKILL_IDS = Object.keys(EXPLAINERS) as SkillId[]

export const hasExplainer = (skillId: SkillId): boolean => skillId in EXPLAINERS

/**
 * Defensive backstop so `explain()` never returns an empty walkthrough. A
 * skill-specific explainer is expected for every g3/4/6 generator; this only
 * fires if one is somehow missing, and still interpolates the real answer.
 */
function fallback(q: Question): Explanation {
  return {
    steps: [
      { say: `Let's read it carefully: ${cleanPrompt(q)}.` },
      { say: `Work it out one step at a time.` },
      { say: `The answer is ${answerOf(q)}.` },
    ],
  }
}

/**
 * Build the walkthrough for a concrete question, with its real numbers filled in.
 * When `chosenIndex` is a wrong answer that matches a known error pattern (MT-1V),
 * a kind, specific diagnosis line is prepended as the opening step — otherwise the
 * explainer's own concept-first opener stands.
 */
export function explain(q: Question, chosenIndex?: number): Explanation {
  const fn = EXPLAINERS[q.skillId]
  const base = fn ? fn(q) : fallback(q)
  const out = base.steps.length ? base : fallback(q)
  if (chosenIndex === undefined) return out
  const line = diagnose(q, chosenIndex)
  if (!line) return out
  return { steps: [{ say: line }, ...out.steps] }
}

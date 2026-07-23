import type { Question } from '../types'
import type { SkillId } from '../skills'
import { answerOf, cleanPrompt, type Explainer, type Explanation } from './types'
import { EXPLAINERS3 } from './explainers'
import { EXPLAINERS4 } from './explainers4'
import { EXPLAINERS6 } from './explainers6'

export type { Explanation, ExplainStep, Explainer } from './types'

/** Every grade 3/4/6 skill maps to a scripted walkthrough. */
export const EXPLAINERS: Partial<Record<SkillId, Explainer>> = {
  ...EXPLAINERS3,
  ...EXPLAINERS4,
  ...EXPLAINERS6,
}

/** Skill ids that ship a walkthrough (the g3/4/6 coverage set). */
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

/** Build the walkthrough for a concrete question, with its real numbers filled in. */
export function explain(q: Question): Explanation {
  const fn = EXPLAINERS[q.skillId]
  const out = fn ? fn(q) : fallback(q)
  // never hand back an empty step list
  return out.steps.length ? out : fallback(q)
}

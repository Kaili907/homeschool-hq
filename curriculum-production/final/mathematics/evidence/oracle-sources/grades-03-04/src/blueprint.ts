import type { MaterialDifficulty, SectionKind } from './types.ts'

/**
 * Composition rules keyed by the authored Grade 3/4 lesson phase.
 *
 * Grade 3/4 lessons use their own 18-phase vocabulary (confirmed by reading
 * every distinct `phase` value out of the vendored lessons.jsonl files),
 * distinct from the grades 5-12 sibling pipeline's 18-phase vocabulary — only
 * "Launch and diagnostic" and "Unit assessment" are spelled identically
 * across both, so this table is authored fresh rather than reused.
 *
 * Item counts are trimmed below the grades 5-12 pipeline's own counts to fit
 * the authored Grade 3 (30-45 minute) and Grade 4 (40-55 minute) session
 * lengths (see curriculum-authoring/full-family-grade34/subjects/mathematics/
 * README.md on mac/g34-math-r1) rather than reusing per-session volumes tuned
 * for older grades.
 */

export interface SectionPlan {
  kind: SectionKind
  title: string
  directions: string
  count: number
  /** Difficulty assigned cyclically across the section's items. */
  difficulties: readonly MaterialDifficulty[]
  /** Constructed-response items ask for reasoning rather than a choice. */
  constructedResponse?: boolean
}

export interface PhaseBlueprint {
  profile: string
  emphasis: string
  sections: readonly SectionPlan[]
}

const worked = (count: number, directions: string): SectionPlan => ({
  kind: 'instructional-example',
  title: 'Instructional examples',
  directions,
  count,
  difficulties: [1, 2, 3],
})

const guided = (
  count: number,
  difficulties: readonly MaterialDifficulty[],
  directions = 'Work these with your teaching adult. Say the reason for each step out loud before you write it.',
): SectionPlan => ({
  kind: 'guided-practice',
  title: 'Guided practice',
  directions,
  count,
  difficulties,
})

const independent = (
  count: number,
  difficulties: readonly MaterialDifficulty[],
  directions = 'Work on your own. Show the steps that produced each answer.',
): SectionPlan => ({
  kind: 'independent-practice',
  title: 'Independent practice',
  directions,
  count,
  difficulties,
})

const mastery = (
  count: number,
  difficulties: readonly MaterialDifficulty[],
  directions = 'Mastery check. Work without help, then stop and hand this section in.',
): SectionPlan => ({
  kind: 'mastery-check',
  title: 'Mastery check',
  directions,
  count,
  difficulties,
})

const extension = (count: number, directions: string): SectionPlan => ({
  kind: 'extension',
  title: 'Extension and challenge',
  directions,
  count,
  difficulties: [3],
  constructedResponse: true,
})

export const PHASE_BLUEPRINTS: Record<string, PhaseBlueprint> = {
  'Launch and diagnostic': {
    profile: 'diagnostic-launch',
    emphasis:
      'Surface what the learner already brings to the unit. Errors here are information, not failure.',
    sections: [
      worked(1, 'Read the example first. You are not expected to know this yet.'),
      independent(4, [1, 1, 2, 3], 'Try each one. If you get stuck, write what you do know and move on.'),
      mastery(2, [1, 2], 'Show what you can do so far. This sets the starting point, not a grade.'),
    ],
  },
  'Concept build A': {
    profile: 'concept-build-introduction',
    emphasis: 'Introduce the core representation and name each step.',
    sections: [
      worked(2, 'Study both examples. The second one drops some of the wording of the first.'),
      guided(3, [1, 1, 2]),
      independent(3, [1, 2, 2]),
      mastery(2, [1, 2]),
    ],
  },
  'Concept build B': {
    profile: 'concept-build-extension',
    emphasis: 'Extend the representation to a second case and compare it with the first.',
    sections: [
      worked(2, 'Compare these two examples. Find the step where they stop being the same.'),
      guided(3, [1, 2, 2]),
      independent(4, [2, 2, 3, 3]),
      mastery(2, [2, 2]),
    ],
  },
  'Concept build C': {
    profile: 'concept-build-generalization',
    emphasis: 'Generalize the model and state when it does and does not apply.',
    sections: [
      worked(1, 'This example is written more briefly. Fill in the reasoning it leaves out.'),
      guided(3, [2, 2, 3]),
      independent(4, [2, 3, 3, 3]),
      mastery(2, [2, 3]),
    ],
  },
  'Concept extension': {
    profile: 'concept-extension',
    emphasis: 'Push the unit’s model into a new case that stretches, but does not abandon, the method.',
    sections: [
      worked(1, 'This example applies the idea in a new setting. Notice what stayed the same.'),
      guided(2, [2, 3], 'Talk through what is different about this case before you start.'),
      independent(4, [2, 2, 3, 3]),
      extension(2, 'Explain, in writing, what made this case different from the original one.'),
    ],
  },
  'Error analysis and repair': {
    profile: 'error-analysis-and-repair',
    emphasis: 'Name the specific error pattern the unit produces and correct it, not just redo the problem.',
    sections: [
      worked(2, 'Each example shows a common mistake, then the correction. Read both parts.'),
      guided(4, [1, 1, 2, 2], 'Before solving, say out loud which mistake the problem could trigger.'),
      independent(3, [2, 2, 3]),
    ],
  },
  'Guided practice A': {
    profile: 'guided-practice-supported',
    emphasis: 'Heavy support, fading across the section.',
    sections: [
      worked(1, 'Use this example as the model for the guided set below.'),
      guided(5, [1, 1, 1, 2, 2]),
      independent(2, [2, 2]),
      mastery(2, [1, 2]),
    ],
  },
  'Guided practice B': {
    profile: 'guided-practice-fading',
    emphasis: 'Support fades to a prompt-only level before independent work.',
    sections: [
      worked(1, 'Read once, then cover the example and try the guided set from memory.'),
      guided(4, [1, 2, 2, 2]),
      independent(3, [2, 2, 3]),
      mastery(2, [2, 3]),
    ],
  },
  'Independent evidence A': {
    profile: 'independent-evidence',
    emphasis: 'Sustained solo work at the unit’s working difficulty, recorded as independent mastery evidence.',
    sections: [
      worked(1, 'One reference example. Use it only if you get stuck.'),
      independent(6, [2, 2, 2, 3, 3, 3]),
      mastery(2, [2, 3]),
    ],
  },
  'Independent evidence B': {
    profile: 'independent-evidence-varied',
    emphasis: 'A second, independently-timed occasion of mastery evidence, drawn from a different slice of the unit.',
    sections: [
      worked(1, 'One reference example. Use it only if you get stuck.'),
      independent(7, [2, 2, 3, 3, 3, 3, 3]),
      mastery(2, [3, 3]),
    ],
  },
  'Performance task: plan': {
    profile: 'performance-planning',
    emphasis: 'Choose a model and justify the choice before building anything.',
    sections: [
      worked(1, 'This example shows how to plan before computing anything.'),
      guided(2, [2, 2], 'Decide what the quantities are before you compute anything.'),
      extension(2, 'Plan in writing: what you will figure out, how, and how you will check it.'),
    ],
  },
  'Performance task: build': {
    profile: 'performance-build',
    emphasis: 'Execute the plan and keep a record of the reasoning.',
    sections: [
      guided(2, [2, 2], 'Set up the first two carefully; the rest of the build depends on them.'),
      independent(5, [2, 2, 3, 3, 3]),
      extension(2, 'Carry the build to a result and say how you would check it is right.'),
    ],
  },
  'Retrieval and fluency': {
    profile: 'retrieval-and-fluency',
    emphasis: 'Volume and fluency across the unit’s item types, at speed.',
    sections: [
      independent(7, [1, 1, 2, 2, 2, 3, 3]),
      mastery(2, [2, 3]),
    ],
  },
  'Synthesis and review': {
    profile: 'synthesis-and-review',
    emphasis: 'Full-unit review that pulls the unit’s ideas together before assessment.',
    sections: [
      independent(6, [1, 2, 2, 3, 3, 3]),
      mastery(3, [2, 2, 3]),
    ],
  },
  'Targeted correction and reassessment': {
    profile: 'targeted-correction-and-reassessment',
    emphasis: 'Reteach the step learners most often miss, then reassess it directly.',
    sections: [
      worked(2, 'Each example contains the correction, not just the answer.'),
      guided(3, [1, 2, 2], 'Before solving, say which error the problem is testing for.'),
      mastery(3, [2, 2, 3], 'Reassessment. Work alone; this checks whether the repair held.'),
    ],
  },
  'Transfer, reflection, and publication': {
    profile: 'transfer-reflection-publication',
    emphasis: 'Apply the unit in an unfamiliar setting, then explain the method to someone else.',
    sections: [
      worked(1, 'The example is from a different setting than the problems below.'),
      independent(4, [2, 3, 3, 3]),
      extension(
        2,
        'Explain your method so that someone who has not done this unit could follow it.',
      ),
    ],
  },
  'Unit assessment': {
    profile: 'unit-assessment',
    emphasis: 'Graded coverage of the unit’s standards. No support.',
    sections: [
      mastery(
        10,
        [1, 1, 2, 2, 2, 2, 3, 3, 3, 3],
        'Unit assessment. Work alone, show your steps, and check your work before you finish.',
      ),
    ],
  },
  'Applied problem solving': {
    profile: 'applied-problem-solving',
    emphasis: 'Work a multi-step problem in context and justify the approach, not just the arithmetic.',
    sections: [
      worked(1, 'This example shows the kind of reasoning the problem below asks for.'),
      guided(2, [2, 2], 'Talk through what the problem is asking before you compute.'),
      independent(3, [2, 3, 3]),
      extension(2, 'Write out the reasoning in full sentences. A correct answer with no justification does not count here.'),
    ],
  },
}

export function blueprintFor(phase: string): PhaseBlueprint {
  const blueprint = PHASE_BLUEPRINTS[phase]
  if (!blueprint) {
    throw new Error(`No material blueprint for lesson phase "${phase}"`)
  }
  return blueprint
}

export const BLUEPRINT_PHASES = Object.keys(PHASE_BLUEPRINTS)

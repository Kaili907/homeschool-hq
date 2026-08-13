import type { MaterialDifficulty, SectionKind } from './types.ts'

/**
 * Composition rules keyed by the authored lesson phase.
 *
 * The point of driving composition from the phase is that a unit-assessment day
 * and a concept-model day should not produce the same worksheet with different
 * numbers. A launch day is mostly low-difficulty diagnostic probing; a unit
 * assessment is all mastery items across the full difficulty range; a transfer
 * challenge leans on extension work. Item selection (see itemPlan.ts) then
 * rotates the unit's item types by day, so two concept-model days in the same
 * unit also differ in which content they exercise.
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
  directions = 'Work these with your teaching parent. Say the reason for each step out loud before you write it.',
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
      independent(
        5,
        [1, 1, 2, 2, 3],
        'Try each one. If you get stuck, write what you do know and move on.',
      ),
      mastery(2, [1, 2], 'Show what you can do so far. This sets the starting point, not a grade.'),
    ],
  },
  'Concept model A': {
    profile: 'concept-model-introduction',
    emphasis: 'Introduce the core representation and name each step.',
    sections: [
      worked(2, 'Study both examples. The second one drops some of the wording of the first.'),
      guided(3, [1, 1, 2]),
      independent(4, [1, 2, 2, 3]),
      mastery(2, [2, 2]),
    ],
  },
  'Concept model B': {
    profile: 'concept-model-extension',
    emphasis: 'Extend the representation to a second case and compare it with the first.',
    sections: [
      worked(2, 'Compare these two examples. Find the step where they stop being the same.'),
      guided(3, [2, 2, 2]),
      independent(4, [2, 2, 3, 3]),
      mastery(2, [2, 3]),
    ],
  },
  'Concept model C': {
    profile: 'concept-model-generalization',
    emphasis: 'Generalize the model and state when it does and does not apply.',
    sections: [
      worked(1, 'This example is written more briefly. Fill in the reasoning it leaves out.'),
      guided(3, [2, 3, 3]),
      independent(5, [2, 2, 3, 3, 3]),
      mastery(2, [3, 3]),
    ],
  },
  'Guided practice A': {
    profile: 'guided-practice-supported',
    emphasis: 'Heavy support, fading across the section.',
    sections: [
      worked(1, 'Use this example as the model for the guided set below.'),
      guided(5, [1, 1, 2, 2, 2]),
      independent(3, [2, 2, 3]),
      mastery(2, [2, 2]),
    ],
  },
  'Guided practice B': {
    profile: 'guided-practice-fading',
    emphasis: 'Support fades to a prompt-only level before independent work.',
    sections: [
      worked(1, 'Read once, then cover the example and try the guided set from memory.'),
      guided(4, [2, 2, 3, 3]),
      independent(4, [2, 3, 3, 3]),
      mastery(2, [3, 3]),
    ],
  },
  'Independent application A': {
    profile: 'independent-application',
    emphasis: 'Sustained solo work at the unit’s working difficulty.',
    sections: [
      worked(1, 'One reference example. Use it only if you get stuck.'),
      independent(8, [2, 2, 2, 3, 3, 3, 3, 3]),
      mastery(3, [2, 3, 3]),
    ],
  },
  'Investigation or close reading': {
    profile: 'investigation',
    emphasis: 'Examine structure and justify a claim rather than execute a procedure.',
    sections: [
      worked(1, 'This example shows the kind of reasoning the investigation asks for.'),
      guided(2, [2, 3], 'Talk through what changes and what stays fixed before you answer.'),
      independent(4, [2, 3, 3, 3]),
      extension(
        2,
        'Write out the reasoning in full sentences. A correct answer with no justification does not count here.',
      ),
    ],
  },
  'Discussion or problem seminar': {
    profile: 'problem-seminar',
    emphasis: 'Compare competing approaches and defend one.',
    sections: [
      worked(1, 'One approach is shown. There is at least one other that works.'),
      guided(3, [2, 3, 3], 'For each, name a second method before you solve it.'),
      independent(3, [3, 3, 3]),
      extension(2, 'Argue for one method over another. Say what makes it better, not just that it is.'),
    ],
  },
  'Reteach and varied practice': {
    profile: 'reteach',
    emphasis: 'Re-teach the step learners most often miss, then vary the surface features.',
    sections: [
      worked(2, 'These two examples show the same idea in two different formats.'),
      guided(4, [1, 1, 2, 2]),
      independent(5, [1, 2, 2, 3, 3]),
    ],
  },
  'Skill consolidation': {
    profile: 'consolidation',
    emphasis: 'Volume and fluency across the unit’s item types.',
    sections: [
      independent(9, [1, 2, 2, 2, 3, 3, 3, 3, 3]),
      mastery(3, [2, 3, 3]),
    ],
  },
  'Performance task planning': {
    profile: 'performance-planning',
    emphasis: 'Choose a model and justify the choice before building anything.',
    sections: [
      worked(1, 'This example shows how to justify a modelling choice.'),
      guided(3, [2, 2, 3], 'Decide what the quantities are before you compute anything.'),
      extension(3, 'Plan in writing: what you will model, why that model, and how you will check it.'),
    ],
  },
  'Performance task build': {
    profile: 'performance-build',
    emphasis: 'Execute the plan and keep a record of the reasoning.',
    sections: [
      guided(2, [2, 3], 'Set up the first two carefully; the rest of the build depends on them.'),
      independent(6, [2, 3, 3, 3, 3, 3]),
      extension(2, 'Carry the build to a result and state the check that would catch an error in it.'),
    ],
  },
  'Transfer challenge': {
    profile: 'transfer',
    emphasis: 'Apply the unit in an unfamiliar setting.',
    sections: [
      worked(1, 'The example is from a different context than the problems below.'),
      independent(5, [3, 3, 3, 3, 3]),
      extension(3, 'These are meant to be hard. Show the reasoning even if you do not finish.'),
    ],
  },
  'Assessment preparation': {
    profile: 'assessment-preparation',
    emphasis: 'Full-unit review at assessment difficulty.',
    sections: [
      independent(8, [1, 2, 2, 2, 3, 3, 3, 3]),
      mastery(4, [2, 2, 3, 3]),
    ],
  },
  'Unit assessment': {
    profile: 'unit-assessment',
    emphasis: 'Graded coverage of the unit’s standards. No support.',
    sections: [
      mastery(
        12,
        [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3],
        'Unit assessment. Work alone, show your steps, and check your work before you finish.',
      ),
    ],
  },
  'Targeted correction': {
    profile: 'targeted-correction',
    emphasis: 'Work the specific error patterns the unit produces.',
    sections: [
      worked(2, 'Each example contains the correction, not just the answer.'),
      guided(4, [1, 2, 2, 3], 'Before solving, say which error the problem is testing for.'),
      independent(4, [2, 2, 3, 3]),
    ],
  },
  'Publication, presentation, or reflection': {
    profile: 'publication-reflection',
    emphasis: 'Explain the mathematics to someone else and reflect on the method.',
    sections: [
      worked(1, 'Notice how the explanation names the reason for each step.'),
      independent(4, [2, 2, 3, 3]),
      extension(
        2,
        'Explain your method so that someone who has not done this unit could follow it.',
      ),
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

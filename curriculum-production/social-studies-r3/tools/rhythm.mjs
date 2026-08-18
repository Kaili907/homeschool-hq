/**
 * The ordered Social Studies rhythm check, driven entirely by
 * `promotion-rules.json`. The verifier script and the R3 validator test share
 * this one implementation so the rule cannot mean two different things.
 */

import { validate } from './schema-validator.mjs'

const LEARNER_PRACTICE_KINDS = ['guided-practice', 'independent-practice']

function itemsOf(section) {
  return section.items ?? []
}

function normalize(value) {
  return (value ?? '').toLowerCase().replaceAll(/\s+/g, ' ').trim()
}

/**
 * Greedy in-order match of `rules.rhythm.orderedRule` against a lesson's
 * sections. Returns one message per violation; an empty array means the lesson
 * follows QUESTION/CONTEXT -> BACKGROUND -> EVIDENCE -> MODEL THINKING ->
 * YOUR TURN -> FEEDBACK -> REVIEW.
 */
export function rhythmViolations(lesson, { rules, reviewSchema }) {
  const sections = lesson.sections ?? []
  const problems = []
  const matched = new Map()
  let cursor = 0

  for (const step of rules.rhythm.orderedRule) {
    const consumed = []
    while (cursor < sections.length && step.sectionKinds.includes(sections[cursor].sectionKind)) {
      consumed.push(cursor)
      cursor += 1
      if (step.occurrences === 'exactly-one') break
    }
    if (consumed.length === 0) {
      const found = sections[cursor]?.sectionKind ?? '<end of lesson>'
      problems.push(`step "${step.id}" expected one of ${step.sectionKinds.join('|')} at section ${cursor + 1}, found ${found}`)
      continue
    }
    matched.set(step.id, consumed)

    if (step.mustBeFirstSection && consumed[0] !== 0) problems.push(`step "${step.id}" must be the first section`)
    if (step.mustBeFinalSection && consumed.at(-1) !== sections.length - 1) problems.push(`step "${step.id}" must be the final section`)

    for (const index of consumed) {
      const section = sections[index]
      if (step.titleMustContain && !section.title.includes(step.titleMustContain)) {
        problems.push(`step "${step.id}" title must contain "${step.titleMustContain}"`)
      }
      if (step.minBodyLength && (section.body ?? '').length < step.minBodyLength) {
        problems.push(`step "${step.id}" body must be at least ${step.minBodyLength} characters`)
      }
      if (step.rejectsBareVerdictBody && /^\s*(?:incorrect|wrong|try again)[.!]?\s*$/i.test(section.body ?? '')) {
        problems.push(`step "${step.id}" body is a bare verdict rather than reasoning-specific feedback`)
      }
      if (step.minWorkedSolutionSteps && !itemsOf(section).some((item) => (item.workedSolution?.steps ?? []).length >= step.minWorkedSolutionSteps)) {
        problems.push(`step "${step.id}" needs a worked solution of at least ${step.minWorkedSolutionSteps} steps`)
      }
      if (step.requiresResponseKind && !itemsOf(section).some((item) => item.responseKind === step.requiresResponseKind)) {
        problems.push(`step "${step.id}" needs a ${step.requiresResponseKind} item`)
      }
      if (step.referenceMustSatisfy) {
        if (step.referenceMustSatisfy !== rules.contract.lessonReviewDefinition) {
          throw new Error(`Unknown reference definition ${step.referenceMustSatisfy}.`)
        }
        for (const violation of validate(reviewSchema, section.reference)) {
          problems.push(`step "${step.id}" review ${violation.path}: ${violation.message}`)
        }
      }
    }
  }

  if (cursor < sections.length) {
    problems.push(`${sections.length - cursor} section(s) fall outside the rhythm, starting at section ${cursor + 1}`)
  }

  const workedStep = rules.rhythm.orderedRule.find((step) => step.workedPromptMustDifferFromLearnerPrompts)
  if (workedStep && matched.has(workedStep.id)) {
    const learnerPrompts = new Set(
      sections
        .filter((section) => LEARNER_PRACTICE_KINDS.includes(section.sectionKind))
        .flatMap((section) => itemsOf(section).map((item) => normalize(item.prompt)))
        .filter(Boolean),
    )
    for (const index of matched.get(workedStep.id)) {
      for (const item of itemsOf(sections[index])) {
        if (learnerPrompts.has(normalize(item.prompt))) {
          problems.push(`step "${workedStep.id}" models the learner's own prompt instead of a different case`)
        }
      }
    }
  }

  return problems
}

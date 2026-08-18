/**
 * ELA Production R3 — STRUCTURAL TEST FIXTURE. NOT LESSON CONTENT.
 *
 * ============================================================================
 * This file contains ZERO curriculum. Every string in it is structural filler
 * whose only purpose is to exercise `buildElaProductionLesson` and
 * `validateElaProductionLesson`. It teaches nothing, it is not authored to any
 * standard, and it must never be delivered to a learner, registered in
 * `registry.ts`, promoted into a lesson, or used as a style model.
 *
 * It is deliberately NOT exported from `index.ts`, and its lesson id
 * deliberately does not match the canonical corpus id pattern, so it cannot be
 * mistaken for production content. `elaProductionR3.test.ts` enforces both.
 * ============================================================================
 */
import { buildElaProductionLesson } from './buildElaProductionLesson'
import type { ElaProductionLesson, ElaProductionLessonInput } from './types'

/** Structural filler. Each sentence states that it is filler. */
const FIXTURE_PASSAGE = `This paragraph is harness fixture text and is not a reading passage. It exists so that the source section has a body with a countable length. It makes no claim, tells no story, and carries no instructional purpose whatsoever.

This second paragraph is also harness fixture text. It repeats the same disclaimer in different words so that the fixture has more than one paragraph of structure to project. Nothing here was written for a learner to read.

This third paragraph continues the same structural filler. It exists to push the fixture body past the shortest length observed among the nine approved Director samples, so that the validator's length observation stays quiet during a structural test run.

This fourth paragraph continues the structural filler. A real production reading would be an original Manuel Academy text authored for a specific grade, a specific skill, and a specific lesson. This is none of those things, and it must never be treated as one.

This fifth paragraph closes the fixture body. Its only job is to carry the fixture past the shortest approved passage length so that a structural test run produces no length observation at all.`

const FIXTURE_INPUT: ElaProductionLessonInput = {
  placement: {
    lessonId: 'ela-r3-harness-structural-fixture',
    courseId: 'ma-g3-english-language-arts',
    grade: 3,
    unitNumber: 1,
    unitTitle: 'Harness fixture unit — not a real unit',
    dayInUnit: 1,
    courseDay: 1,
  },
  topic: 'Harness fixture topic — structural validation only',
  standards: ['FIXTURE.0'],
  textType: 'Harness fixture — not a text type',
  title: 'Harness fixture lesson — not lesson content',
  welcome: 'Fixture welcome slot. This string occupies the welcome section so the builder has something to place there.',
  instruction: 'Fixture instruction slot. This string occupies the short-instruction section and teaches nothing.',
  vocabulary: [
    { term: 'fixture-term-one', definition: 'First fixture vocabulary slot. Not a real definition.' },
    { term: 'fixture-term-two', definition: 'Second fixture vocabulary slot. Not a real definition.' },
  ],
  model: 'Fixture worked-example slot. A real worked example would show reasoning on a separate microtext. This shows nothing.',
  modelPrompt: 'Fixture worked-example read prompt.',
  passageTitle: 'Harness Fixture Body',
  passage: FIXTURE_PASSAGE,
  passageDirections: 'Fixture reading directions slot.',
  guidedDirections: 'Fixture guided-practice directions slot.',
  guided: {
    type: 'CHOICE',
    prompt: 'Fixture guided choice prompt. Which option is fixture option two?',
    choices: ['Fixture option one', 'Fixture option two', 'Fixture option three'],
  },
  guidedFeedback: 'Fixture guided feedback slot. Real feedback would explain why each option does or does not fit.',
  independentDirections: 'Fixture independent-response directions slot.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Fixture independent constructed-response prompt.',
  },
  processFeedback: 'Fixture process feedback slot. Real process feedback would name what to check before revising.',
  revisionDirections: 'Fixture revision directions slot.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Fixture revision constructed-response prompt.',
  },
  rubricCriteria: ['fixture criterion one', 'fixture criterion two'],
  review: {
    learned: 'Fixture review slot: what you learned.',
    howYouDid: 'Fixture review slot: how you did.',
    didWell: 'Fixture review slot: what you did well.',
    practice: 'Fixture review slot: what to practice.',
    reviewLesson: 'Fixture review slot: review this lesson.',
    courseProgress: 'Fixture review slot: course progress.',
    nextAction: 'Fixture review slot: next action.',
  },
  readability: {
    instructionLength: 'Fixture readability slot',
    sentenceComplexity: 'Fixture readability slot',
    vocabularyLoad: 'Fixture readability slot',
    passageLength: 'Fixture readability slot',
    expectedWrittenResponse: 'Fixture readability slot',
    scaffolding: 'Fixture readability slot',
  },
}

/** Builds the structural fixture. Test-only. */
export function buildHarnessFixture(
  override: Partial<ElaProductionLessonInput> = {},
): ElaProductionLesson {
  return buildElaProductionLesson({ ...FIXTURE_INPUT, ...override })
}

export const HARNESS_FIXTURE_INPUT: ElaProductionLessonInput = Object.freeze(FIXTURE_INPUT)

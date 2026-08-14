import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareNonCodeSolutionExposure,
  compareSolutionExposure,
  findCoursePayloadExposures,
  nonCodeSignatures,
} from './course-payload-solution-equivalence.mjs'

const protectedStarter = `const lesson_steps = ["open", "check", "save"];
function runSteps(steps) {
  const completed = [];
  for (let index = 1; index < steps.length; index += 1) completed.push(steps[index]);
  return completed.join(" > ");
}
console.log(runSteps(lesson_steps));`

const protectedTests = [
  { input: 'runSteps(["open", "check", "save"])', expected: 'open > check > save' },
  { input: 'runSteps([])', expected: 'empty string' },
  { input: 'runSteps(["start"])', expected: 'start' },
]

function fixture(overrides = {}) {
  return {
    lessonId: 'protected',
    courseRef: 'technology-grade-4',
    workMode: 'DEMONSTRATE',
    scoringStance: 'SUMMATIVE',
    protected: true,
    analyzer: 'JAVASCRIPT_DEPENDENCY_SLICED_STRUCTURE_R3',
    starterCode: protectedStarter,
    tests: protectedTests,
    exactRepair: 'Iteration begins at index 0; all three tests retain every step in order.',
    visibleSolutions: [],
    ...overrides,
  }
}

test('negative control 1: exact starter and repair under a different lesson ID fails', () => {
  const source = fixture({
    lessonId: 'model-other-id',
    protected: false,
    workMode: 'MODEL',
    visibleSolutions: [fixture().exactRepair],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 2: identifier rename does not hide the same executable repair', () => {
  const source = fixture({
    lessonId: 'renamed-model',
    protected: false,
    workMode: 'MODEL',
    starterCode: protectedStarter
      .replaceAll('lesson_steps', 'task_queue')
      .replaceAll('steps', 'tasks')
      .replaceAll('completed', 'done')
      .replaceAll('index', 'cursor'),
    tests: protectedTests.map(({ input, expected }) => ({ input: input.replaceAll('runSteps', 'runSteps'), expected })),
    visibleSolutions: ['Iteration begins at cursor 0; every task remains in order.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 3: function rename does not hide the same executable repair', () => {
  const source = fixture({
    lessonId: 'function-renamed-model',
    protected: false,
    starterCode: protectedStarter.replaceAll('runSteps', 'walkRoute'),
    tests: protectedTests.map(({ input, expected }) => ({ input: input.replaceAll('runSteps', 'walkRoute'), expected })),
    visibleSolutions: [fixture().exactRepair],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 4: comments and whitespace do not hide the same repair', () => {
  const source = fixture({
    lessonId: 'formatted-model',
    protected: false,
    starterCode: `/* story-only heading */\n${protectedStarter.replaceAll(';', '; // cosmetic note\n')}`,
    visibleSolutions: [fixture().exactRepair],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 5: repair paraphrase still fails', () => {
  const source = fixture({
    lessonId: 'paraphrased-model',
    protected: false,
    visibleSolutions: ['Start the iteration counter at zero so every item stays in sequence.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 6: different story and test vocabulary cannot hide the same executable fix', () => {
  const source = fixture({
    lessonId: 'story-swapped-model',
    protected: false,
    starterCode: `const route_cards = ["north", "bridge", "camp"];
function walkRoute(cards) {
  const visited = [];
  for (let cursor = 1; cursor < cards.length; cursor += 1) visited.push(cards[cursor]);
  return visited.join(" ~ ");
}
console.log(walkRoute(route_cards));`,
    tests: [
      { input: 'walkRoute(["north", "bridge", "camp"])', expected: 'north ~ bridge ~ camp' },
      { input: 'walkRoute([])', expected: 'nothing visited' },
      { input: 'walkRoute(["dock"])', expected: 'dock' },
    ],
    visibleSolutions: ['Begin the route cursor at zero so no destination is skipped.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 7: moving a proven-irrelevant declaration cannot hide the same fix', () => {
  const source = fixture({
    lessonId: 'reordered-model',
    protected: false,
    starterCode: `const decorative_caption = "Route practice";\n${protectedStarter}`,
    visibleSolutions: [fixture().exactRepair],
  })
  const protectedWithMovedDeclaration = fixture({
    starterCode: `${protectedStarter}\nconst decorative_caption = "Sequence practice";`,
  })
  assert.equal(compareSolutionExposure(source, protectedWithMovedDeclaration).exposed, true)

  const effectMovedSource = fixture({
    protected: false,
    starterCode: `recordDecoration();\n${protectedStarter}`,
    visibleSolutions: [fixture().exactRepair],
  })
  const effectMovedProtected = fixture({ starterCode: `${protectedStarter}\nrecordDecoration();` })
  assert.equal(compareSolutionExposure(effectMovedSource, effectMovedProtected).exposed, false,
    'effectful statement order must remain significant')
})

test('negative control 8: an earlier MODEL that solves a later SUMMATIVE fails', () => {
  const records = [
    fixture({ lessonId: 'model-day-2', protected: false, workMode: 'MODEL', visibleSolutions: [fixture().exactRepair] }),
    fixture({ lessonId: 'summative-day-5' }),
  ]
  assert.deepEqual(findCoursePayloadExposures(records).map((row) => row.protectedLessonId), ['summative-day-5'])
})

test('positive control 9: same concept with a materially different bug and repair passes', () => {
  const source = fixture({
    lessonId: 'different-defect-model',
    protected: false,
    starterCode: protectedStarter.replace('index < steps.length', 'index <= steps.length').replace('index = 1', 'index = 0'),
    visibleSolutions: ['Use index < steps.length so the loop does not append an undefined item.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, false)
})

test('positive control 10: a genuinely analogous worked example passes', () => {
  const source = fixture({
    lessonId: 'analogous-model',
    protected: false,
    starterCode: `const words = ["red", "green", "blue"];
function reverseWords(words) {
  const reversed = [];
  for (let position = words.length - 1; position > 0; position -= 1) reversed.push(words[position]);
  return reversed.join(" / ");
}
console.log(reverseWords(words));`,
    visibleSolutions: ['The loop continues while position >= 0; every word is retained in reverse order.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, false)
})

test('positive control 11: similar vocabulary with different executable semantics passes', () => {
  const source = fixture({
    lessonId: 'vocabulary-only-model',
    protected: false,
    starterCode: `function runSteps(steps) {
  const completed = steps.filter((step) => step.length > 0);
  completed.sort();
  return completed.join(" > ");
}
console.log(runSteps(["open", "check", "save"]));`,
    visibleSolutions: ['Keep every valid step and return the completed sequence.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, false)
})

function nonCodeFixture(overrides = {}) {
  const record = {
    lessonId: 'design-protected',
    courseRef: 'technology-grade-8',
    workMode: 'DEMONSTRATE',
    scoringStance: 'SUMMATIVE',
    protected: true,
    analyzer: 'NON_CODE_DELIVERABLE_SEMANTICS_R3',
    taskType: 'interface_and_accessibility',
    focus: 'keyboard accessible reading tracker',
    centralInput: {
      fictional_user: 'Kai uses a keyboard and enlarges text to 200%.',
      required_features: ['three actions', 'word plus visual mark', 'works at 200%'],
    },
    deliverable: 'A labelled interface sketch and a three-row verification table.',
    specification: ['keyboard completion', '200% text', 'non-color status'],
    expectedResponse: 'Use a labelled Complete button reachable by keyboard and show Done with a check mark at 200% text.',
    visibleSolutions: [],
    ...overrides,
  }
  record.nonCodeSignatures = nonCodeSignatures(record)
  return record
}

test('negative control 12: a non-code worked exemplar that directly solves the protected deliverable fails', () => {
  const source = nonCodeFixture({
    lessonId: 'design-model',
    workMode: 'MODEL',
    protected: false,
    visibleSolutions: ['Use a labelled Complete button reachable by keyboard and show Done with a check mark at 200% text.'],
  })
  assert.equal(compareNonCodeSolutionExposure(source, nonCodeFixture()).exposed, true)
})

test('positive control 13: a non-code analogous exemplar requiring new reasoning passes', () => {
  const source = nonCodeFixture({
    lessonId: 'design-analogy',
    workMode: 'MODEL',
    protected: false,
    focus: 'captioned weather alert',
    centralInput: {
      fictional_user: 'Mira cannot hear an audio alarm.',
      required_features: ['text alert', 'persistent status', 'dismiss control'],
    },
    visibleSolutions: ['Pair the alarm with a persistent text warning and a labelled dismiss control.'],
  })
  assert.equal(compareNonCodeSolutionExposure(source, nonCodeFixture()).exposed, false)
})

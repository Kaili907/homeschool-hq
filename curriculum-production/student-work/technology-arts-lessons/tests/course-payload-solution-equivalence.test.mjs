import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareSolutionExposure,
  findCoursePayloadExposures,
} from './course-payload-solution-equivalence.mjs'

const protectedStarter = `const lesson_steps = ["open", "check", "save"];
function runSteps(steps) {
  const completed = [];
  for (let index = 1; index < steps.length; index += 1) completed.push(steps[index]);
  return completed.join(" > ");
}`

const protectedTests = [
  { input: '["open", "check", "save"]', expected: 'open > check > save' },
  { input: '[]', expected: 'empty string' },
  { input: '["start"]', expected: 'start' },
]

function fixture(overrides = {}) {
  return {
    lessonId: 'protected',
    courseRef: 'technology-grade-4',
    workMode: 'DEMONSTRATE',
    scoringStance: 'SUMMATIVE',
    protected: true,
    starterCode: protectedStarter,
    tests: protectedTests,
    exactRepair: 'Iteration begins at index 0; all three tests retain every step in order.',
    visibleSolutions: [],
    ...overrides,
  }
}

test('negative control 1: same starter and repair under a different lesson ID fails', () => {
  const source = fixture({
    lessonId: 'model-other-id',
    protected: false,
    workMode: 'MODEL',
    visibleSolutions: ['Iteration begins at index 0; all three tests retain every step in order.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 2: variable rename does not hide the same executable repair', () => {
  const source = fixture({
    lessonId: 'renamed-model',
    protected: false,
    workMode: 'MODEL',
    starterCode: protectedStarter
      .replaceAll('lesson_steps', 'task_queue')
      .replaceAll('steps', 'tasks')
      .replaceAll('completed', 'done')
      .replaceAll('index', 'cursor'),
    visibleSolutions: ['Iteration begins at index 0; all three tests retain every step in order.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('negative control 3: cosmetic wording around the same exact fix fails', () => {
  const source = fixture({
    lessonId: 'reworded-model',
    protected: false,
    workMode: 'MODEL',
    visibleSolutions: ['Start the iteration counter at zero so every step stays in sequence.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, true)
})

test('positive control 4: analogous worked example with a materially different fixture passes', () => {
  const source = fixture({
    lessonId: 'analogous-model',
    protected: false,
    workMode: 'MODEL',
    starterCode: `const words = ["red", "green", "blue"];
function reverseWords(words) {
  const reversed = [];
  for (let position = words.length - 1; position > 0; position -= 1) reversed.push(words[position]);
  return reversed.join(" / ");
}`,
    tests: [
      { input: '["red", "green", "blue"]', expected: 'blue / green / red' },
      { input: '[]', expected: 'empty string' },
      { input: '["solo"]', expected: 'solo' },
    ],
    visibleSolutions: ['The loop continues while position >= 0; every word is retained in reverse order.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, false)
})

test('positive control 5: same concept with a different bug and solution passes', () => {
  const source = fixture({
    lessonId: 'different-defect-model',
    protected: false,
    workMode: 'MODEL',
    starterCode: protectedStarter.replace('index < steps.length', 'index <= steps.length').replace('index = 1', 'index = 0'),
    visibleSolutions: ['Use index < steps.length so the loop does not append an undefined item.'],
  })
  assert.equal(compareSolutionExposure(source, fixture()).exposed, false)
})

test('negative control 6: a summative task solved by an earlier model fails', () => {
  const records = [
    fixture({ lessonId: 'model-day-2', protected: false, workMode: 'MODEL', visibleSolutions: [fixture().exactRepair] }),
    fixture({ lessonId: 'summative-day-5' }),
  ]
  assert.deepEqual(findCoursePayloadExposures(records).map((row) => row.protectedLessonId), ['summative-day-5'])
})

test('negative control 7: a later model still fails because the complete course payload coexists client-side', () => {
  const records = [
    fixture({ lessonId: 'protected-day-1', scoringStance: 'FORMATIVE_NO_PENALTY' }),
    fixture({ lessonId: 'model-day-2', protected: false, workMode: 'MODEL', visibleSolutions: [fixture().exactRepair] }),
  ]
  assert.deepEqual(findCoursePayloadExposures(records).map((row) => row.protectedLessonId), ['protected-day-1'])
})

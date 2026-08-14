import type { LearnerMaterialDto } from './types'

/** Local contract fixtures only; deliberately not imported from another session branch. */
export const G3_MATH_RESPONSE_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'ma-g3-mathematics-u01-l01',
  title: 'Launch and diagnostic: making sense of unfamiliar problems',
  format: 'structured',
  sections: Object.freeze([
    Object.freeze({
      sectionId: 'ex', kind: 'instructional-example', title: 'Instructional examples',
      directions: 'Read the example first. You are not expected to know this yet.',
      items: Object.freeze([Object.freeze({
        ref: 'ma-g3-mathematics-u01-l01#ex-01', kind: 'worked-example',
        prompt: 'What should you do first when a word problem is unfamiliar?',
        workedSolution: Object.freeze({ steps: Object.freeze(['Reread the problem.', 'Picture what is happening.']) }),
      })]),
    }),
    Object.freeze({
      sectionId: 'ip', kind: 'independent-practice', title: 'Independent practice',
      directions: 'Try each one on your own.',
      items: Object.freeze([
        Object.freeze({
          ref: 'ma-g3-mathematics-u01-l01#ip-01', kind: 'multiple-choice',
          prompt: 'Your answer seems too large. What should you do?',
          choices: Object.freeze(['Check it against the situation.', 'Guess and move on.', 'Multiply every number.']),
        }),
        Object.freeze({
          ref: 'ma-g3-mathematics-u01-l01#ip-02', kind: 'numeric-entry',
          prompt: 'How many tens are in 340?', responseType: 'NUMERIC',
        }),
      ]),
    }),
    Object.freeze({
      sectionId: 'mc', kind: 'mastery-check', title: 'Mastery check',
      items: Object.freeze([Object.freeze({
        ref: 'ma-g3-mathematics-u01-l01#mc-01', kind: 'constructed-response',
        prompt: 'Explain how you checked your strategy.', responseType: 'CONSTRUCTED_RESPONSE',
      })]),
    }),
  ]),
})

export const G5_ELA_RESPONSE_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'ma-g5-english-language-arts-u01-l01',
  title: 'Launch and diagnostic: active reading habits',
  format: 'structured',
  sections: Object.freeze([
    Object.freeze({ title: 'Student Task', body: 'Read the model and notice how evidence is marked.', prompts: Object.freeze([]) }),
    Object.freeze({ title: 'Guided support', body: 'Record the evidence that supports your first guided move.', prompts: Object.freeze([]) }),
    Object.freeze({ title: 'Independent evidence', body: 'Explain the main idea and cite one piece of evidence.', prompts: Object.freeze([]) }),
  ]),
})

export const SCIENCE_MARKDOWN_RESPONSE_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'ma-g5-science-u01-l01',
  title: 'Observable phenomena',
  format: 'markdown',
  markdown: '# Observable phenomena\n\nComplete the observation activity and record evidence.',
})

export const ARTS_ACTIVITY_RESPONSE_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'ma-g5-arts-and-music-u01-l03',
  title: 'Guided practice: studio methods',
  format: 'structured',
  sections: Object.freeze([
    Object.freeze({ title: 'Task Brief', body: 'Make two short studies.' }),
    Object.freeze({ title: 'Primary Task', body: 'Create the studies and preserve both versions.' }),
    Object.freeze({ title: 'Deliverable', body: 'Record where both studies can be reviewed.' }),
  ]),
})

/** Rich presentation fixtures remain answer-free and use the same response contract. */
export const RICH_MATH_LESSON_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'fixture-g3-math-rich-rounding',
  title: 'Rounding with place value',
  subject: 'mathematics',
  format: 'structured',
  essentialQuestion: 'How does place value help us round a number?',
  successCriteria: Object.freeze(['I can name the rounding place.', 'I can explain which neighboring digit I inspect.']),
  keyPoints: Object.freeze(['Find the place.', 'Inspect the digit immediately to its right.', 'Rename the remaining places with zeros.']),
  vocabulary: Object.freeze([
    Object.freeze({ term: 'round', definition: 'to name a nearby benchmark value' }),
    Object.freeze({ term: 'benchmark', definition: 'a useful nearby number' }),
  ]),
  sections: Object.freeze([
    Object.freeze({
      sectionRef: 'fixture-g3-math-rich-rounding:example', sectionKind: 'worked-example', title: 'Model example',
      items: Object.freeze([Object.freeze({
        itemRef: 'fixture-g3-math-rich-rounding:example:1', itemKind: 'worked-example', prompt: 'Round 347 to the nearest ten.',
        workedSolution: Object.freeze({ steps: Object.freeze(['Locate the tens place.', 'Inspect the ones digit.', 'Name the nearby ten.']) }),
      })]),
    }),
    Object.freeze({
      sectionRef: 'fixture-g3-math-rich-rounding:guided', sectionKind: 'guided-practice', title: 'Try it together',
      directions: 'Use the place-value reminder.',
      items: Object.freeze([Object.freeze({ itemRef: 'fixture-g3-math-rich-rounding:guided:1', itemKind: 'numeric-entry', prompt: 'Round 62 to the nearest ten.', responseKind: 'NUMERIC' })]),
    }),
    Object.freeze({
      sectionRef: 'fixture-g3-math-rich-rounding:independent', sectionKind: 'independent-practice', title: 'Your turn',
      items: Object.freeze([
        Object.freeze({ itemRef: 'fixture-g3-math-rich-rounding:independent:1', itemKind: 'numeric-entry', prompt: 'Round 184 to the nearest hundred.', responseKind: 'NUMERIC' }),
        Object.freeze({ itemRef: 'fixture-g3-math-rich-rounding:independent:2', itemKind: 'constructed-response', prompt: 'Explain which digit you inspected.', responseKind: 'CONSTRUCTED_RESPONSE' }),
      ]),
    }),
    Object.freeze({ sectionRef: 'fixture-g3-math-rich-rounding:reteach', sectionKind: 'remediation', title: 'Reteach', body: 'Underline the rounding place, then box the digit immediately to its right.' }),
    Object.freeze({ sectionRef: 'fixture-g3-math-rich-rounding:challenge', sectionKind: 'challenge', title: 'Extension challenge', prompts: Object.freeze(['Find two numbers that round to the same hundred.']) }),
    Object.freeze({
      sectionRef: 'fixture-g3-math-rich-rounding:mastery', sectionKind: 'mastery-check', title: 'Check what you know',
      items: Object.freeze([Object.freeze({ itemRef: 'fixture-g3-math-rich-rounding:mastery:1', itemKind: 'numeric-entry', prompt: 'Round 451 to the nearest hundred.', responseKind: 'NUMERIC' })]),
    }),
    Object.freeze({ sectionRef: 'fixture-g3-math-rich-rounding:reflection', sectionKind: 'reflection', title: 'Reflection', body: 'Name one rounding move you can use again.' }),
  ]),
})

export const RICH_SCIENCE_DATA_LESSON_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'fixture-g5-science-rich-data',
  title: 'Patterns in plant growth',
  subject: 'science',
  format: 'structured',
  lessonGoal: 'Use observations and data to describe a growth pattern.',
  materials: Object.freeze(['three seedling observations', 'notebook']),
  safetyRules: Object.freeze(['Do not taste classroom specimens.', 'Wash hands after handling soil.']),
  sections: Object.freeze([
    Object.freeze({ sectionRef: 'fixture-g5-science-rich-data:source', sectionKind: 'source', title: 'Observation source', source: Object.freeze({ title: 'Class seedling log', context: 'Measurements were recorded at the same time each day.' }) }),
    Object.freeze({ sectionRef: 'fixture-g5-science-rich-data:data', sectionKind: 'data-table', title: 'Growth data', data: Object.freeze({ columns: Object.freeze(['Day', 'Height (cm)']), rows: Object.freeze(['1, 2', '3, 4', '5, 7']) }) }),
    Object.freeze({
      sectionRef: 'fixture-g5-science-rich-data:guided', sectionKind: 'guided-practice', title: 'Read the data together',
      items: Object.freeze([Object.freeze({
        itemRef: 'fixture-g5-science-rich-data:guided:1', itemKind: 'multiple-choice', prompt: 'Which description matches the recorded heights?', responseKind: 'CHOICE',
        choices: Object.freeze(['The height increased.', 'The height stayed the same.', 'No measurements were recorded.']),
      })]),
    }),
    Object.freeze({ sectionRef: 'fixture-g5-science-rich-data:reflection', sectionKind: 'reflection', title: 'Reflection', prompts: Object.freeze(['What new observation would strengthen the pattern?']) }),
  ]),
})

export const RICH_SOCIAL_STUDIES_MAP_LESSON_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'fixture-g5-social-rich-map',
  title: 'Reading movement on a map',
  subject: 'social-studies',
  format: 'structured',
  essentialQuestion: 'How can a map support a claim about movement?',
  sections: Object.freeze([
    Object.freeze({ sectionRef: 'fixture-g5-social-rich-map:map', sectionKind: 'map-reference', title: 'Map reference', map: Object.freeze({ title: 'Regional route map', legend: 'Arrows show direction; circles show settlements.', scale: '1 cm represents 20 km' }) }),
    Object.freeze({ sectionRef: 'fixture-g5-social-rich-map:source', sectionKind: 'primary-source', title: 'Source note', source: Object.freeze({ creator: 'Manuel Academy', purpose: 'Learner practice map', answerKey: 'must never render' }) }),
    Object.freeze({
      sectionRef: 'fixture-g5-social-rich-map:independent', sectionKind: 'independent-practice', title: 'Use the map',
      items: Object.freeze([Object.freeze({ itemRef: 'fixture-g5-social-rich-map:independent:1', itemKind: 'constructed-response', prompt: 'Use the legend and scale to support one claim about the route.', responseKind: 'CONSTRUCTED_RESPONSE' })]),
    }),
  ]),
})

export const RICH_PE_ACTIVITY_LESSON_FIXTURE: LearnerMaterialDto = Object.freeze({
  lessonRef: 'fixture-g5-pe-rich-activity',
  title: 'Balance and controlled movement',
  subject: 'physical-education',
  format: 'structured',
  materials: Object.freeze(['clear floor space', 'stable chair if needed']),
  safetyRules: Object.freeze(['Stop if you feel pain or dizziness.', 'Keep a full arm span from other people.']),
  stoppingRules: Object.freeze(['The space becomes unsafe.', 'You feel unwell.']),
  accessibleAdaptation: 'Complete the same balance pattern seated with controlled arm reaches.',
  noEquipmentAlternative: 'Use a floor line instead of equipment.',
  activitySteps: Object.freeze(['Check the space.', 'Practice one balance shape.', 'Rest, then repeat with control.']),
  sections: Object.freeze([
    Object.freeze({
      sectionRef: 'fixture-g5-pe-rich-activity:evidence', sectionKind: 'performance-task', title: 'Activity evidence',
      items: Object.freeze([Object.freeze({ itemRef: 'fixture-g5-pe-rich-activity:evidence:1', itemKind: 'activity-evidence', prompt: 'Describe the safe variation you completed.', responseKind: 'ACTIVITY_EVIDENCE' })]),
    }),
    Object.freeze({ sectionRef: 'fixture-g5-pe-rich-activity:reflection', sectionKind: 'reflection', title: 'Cool-down reflection', body: 'Notice one movement that felt controlled.' }),
  ]),
})

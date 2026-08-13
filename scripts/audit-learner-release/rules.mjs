export const EXPECTED = Object.freeze({
  grades: Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12]),
  subjects: Object.freeze([
    'arts-and-music',
    'english-language-arts',
    'financial-literacy',
    'health',
    'mathematics',
    'physical-education',
    'ready-for-life',
    'science',
    'social-studies',
    'technology',
  ]),
  courses: 90,
  lessons: 8292,
  assessments: 699,
})

export const BLOCKING_CODES = Object.freeze([
  'ZERO_ACTIONABLE_NORMAL_LESSON',
  'EMPTY_REQUIRED_PRACTICE',
  'EMPTY_REQUIRED_MASTERY',
  'EMPTY_REQUIRED_ACTIVITY',
  'MISSING_REQUIRED_READING',
  'MISSING_REQUIRED_SOURCE',
  'MISSING_REQUIRED_DATA',
  'MISSING_REQUIRED_MATERIALS',
  'PLACEHOLDER_TEMPLATE_SHELL',
  'FLATTENED_STRUCTURED_CHOICES',
  'LOST_ITEM_REF',
  'RESPONSE_KIND_NONE',
  'UNSUPPORTED_REQUIRED_RESPONSE',
  'ADULT_ANSWER_SCORING_LEAK',
  'UNSAFE_SOURCE_STATE',
  'MISSING_ASSESSMENT_LEARNER_MATERIAL',
  'ASSESSMENT_WORKFLOW_MISSING',
  'UNRUNNABLE_TECHNOLOGY_TASK',
  'MISSING_PE_MOVEMENT_CUES',
  'MISSING_PE_SAFETY',
  'UNSAFE_PE_EQUIPMENT_ASSUMPTION',
  'MISSING_ARTS_MODEL_OR_SCAFFOLD',
  'FINLIT_ANSWER_DISCLOSURE',
])

export const SUBJECT_RULES = Object.freeze({
  mathematics: 'worked examples plus nonempty promised practice/mastery; structured item refs, choices, and supported response kinds must survive projection',
  'english-language-arts': 'the actual required reading/source and a concrete writing/evidence task must be delivered; facilitator/meta-task shells do not count',
  science: 'a bound question, model, data set, or runnable investigation is required; investigation materials, safe alternative, and learner response must be usable',
  'social-studies': 'named static source metadata/content must reach the learner; dynamic sources remain blocked until their full attachment contract is satisfied',
  health: 'meaningful private scenario, instruction, activity, criteria, and equal-credit alternative; no medical/private-disclosure or adult scoring leakage',
  'physical-education': 'actionable movement activity with cues/steps, visible safety, feasible household equipment or no-equipment alternative, adaptation, and completion criteria',
  'ready-for-life': 'actionable life-skill task with the declared learner/guardian authority and equal-credit simulation; fixed/open response structure must survive',
  'financial-literacy': 'visible fictional parameters and both fixed/judgment work where declared; response/scoring mode and choices survive; answers and scoring locators stay adult-only',
  technology: 'central model/problem/artifact/environment is supplied; code/debug tasks have a runnable starter or complete paper specification and test criteria',
  'arts-and-music': 'create/perform/respond task with critique criteria; model/guided/investigation modes include an actual model, excerpt, locator, or scaffold',
})

export const ARTS_REFERENCE_MODES = new Set(['MODEL_A', 'GUIDED_A', 'MODEL_B', 'GUIDED_B', 'INVESTIGATE'])

export const TECHNOLOGY_MISSING_INPUT_MODES = new Set([
  'MODEL',
  'MODEL_A',
  'MODEL_B',
  'GUIDED',
  'GUIDED_A',
  'GUIDED_B',
  'INVESTIGATE',
  'DEMONSTRATE',
  'ASSESS',
])

export const TECHNOLOGY_CODE_TASKS = new Set(['programming_and_logic', 'debugging_and_testing'])

export const SCIENCE_HS_EXTERNAL_ALTERNATIVE_UNITS = Object.freeze({
  'ma-hs9-biology': new Set([2, 3, 4, 6, 8, 9]),
  'ma-hs10-chemistry': new Set([1, 2, 3, 4, 5, 6, 9]),
  'ma-hs11-physics': new Set([1, 2, 4, 5, 7]),
  'ma-hs12-earth-space-environmental': new Set([1, 2, 3, 4, 5, 7, 8, 9]),
})

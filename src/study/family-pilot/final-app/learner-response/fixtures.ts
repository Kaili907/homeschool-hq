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

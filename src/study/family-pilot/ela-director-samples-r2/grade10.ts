import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `Draft for the Neighborhood Repair Bulletin

The repair team inspected three sites last Thursday: the cracked steps at Hall Street, the loose railing beside the clinic, and the blocked drain at Harbor Park. Each problem needs a different crew however all three can be addressed before the rainy season.

The steps require masonry work; several bricks have shifted, but the foundation remains level. The railing presents a more immediate risk it moves nearly four inches when pushed. The drain is not broken it is packed with leaves, plastic wrappers, and soil.

The coordinator set the order for repairs: secure the railing first, clear the drain second, and rebuild the steps after replacement bricks arrive. This sequence follows one principle the team handles immediate safety risks before slower structural work.

Residents can help in two ways; they can keep the marked areas clear, and they can report any change in the railing. Volunteers should not attempt repairs themselves: the masonry tools and railing anchors require trained workers.

Editor’s note: Revise the draft for punctuation and flow. Use a semicolon only between closely related independent clauses or before a conjunctive adverb that joins them. Use a colon after a complete clause to introduce an explanation, list, or example.`

export const GRADE_10_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 10,
  canonicalLessonRef: 'ma-g10-english-language-arts-u08-l03',
  topic: 'Semicolon and colon control in authentic revision',
  standards: ['9-10.L.1', '9-10.L.2', '9-10.L.3', '9-10.L.4', '9-10.W.5'],
  textType: 'Public-information editorial draft',
  title: 'Punctuation as a Logic Signal',
  welcome: 'Semicolons and colons are not decorations. This editing lesson treats punctuation as a visible signal of the logical relationship between clauses, explanations, and lists.',
  instruction: 'Use a semicolon to join closely related independent clauses; both sides must be able to stand as sentences. Use a colon after a complete clause to introduce what explains, names, or illustrates it. A colon should not split a verb from its object, and a semicolon should not replace every comma.',
  vocabulary: [
    { term: 'independent clause', definition: 'a group of words with a subject and verb that can stand as a complete sentence' },
    { term: 'conjunctive adverb', definition: 'a transition such as however or therefore that connects the logic of two clauses' },
    { term: 'style', definition: 'the choices that shape clarity, rhythm, emphasis, and tone' },
  ],
  model: 'Draft: “The forecast changed however the launch remained on schedule.”\nReasoning: “The forecast changed” and “the launch remained on schedule” are independent clauses. However signals contrast and belongs with the second clause.\nModel revision: “The forecast changed; however, the launch remained on schedule.”\nCheck: The semicolon marks the clause boundary, and commas set off the transition.',
  modelPrompt: 'Verify the grammar on both sides of the punctuation before studying its stylistic effect.',
  passageTitle: 'Three Repairs, One Order',
  passage: PASSAGE,
  passageDirections: 'Read the draft once for meaning. On the second reading, mark each place where two complete clauses collide or a complete clause introduces an explanation or list.',
  guidedDirections: 'Select the sentence whose punctuation correctly signals the relationship between ideas.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which revision of the second sentence in paragraph 1 is correct?',
    choices: [
      'Each problem needs a different crew; however, all three can be addressed before the rainy season.',
      'Each problem needs; a different crew, however all three can be addressed before the rainy season.',
      'Each problem needs a different crew: however; all three can be addressed before the rainy season.',
    ],
  },
  guidedFeedback: 'The first revision is correct. Both main parts are independent clauses, so the semicolon marks their boundary; however belongs to the second clause and is followed by a comma. The other versions split a verb from its object or stack punctuation without matching the grammar.',
  independentDirections: 'Edit the remaining draft. Preserve its facts and professional tone while correcting only the punctuation and wording needed for clarity.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Rewrite paragraphs 2–4 of “Three Repairs, One Order.” Correct the run-ons and any misused semicolons or colons. Then add a 4–6 sentence editor’s note explaining at least one semicolon choice, one colon choice, and one place where you deliberately did not use either mark.',
  },
  processFeedback: 'Punctuation can be checked systematically, but the quality of the full edit still requires human review. For every semicolon, box two complete clauses. For every colon, underline the complete clause before it and label what follows as explanation, list, or example. If the grammar test fails, choose a period, comma with a conjunction, or no internal mark.',
  revisionDirections: 'Revise the edited passage and editor’s note after applying the clause tests.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit your final edited paragraphs and editor’s note. Make each punctuation choice traceable to clause structure and intended emphasis.',
  },
  rubricCriteria: ['correct clause boundaries', 'controlled semicolon use', 'controlled colon use', 'clear explanation of editorial choices', 'preserved meaning and tone'],
  review: {
    learned: 'Semicolons show a close relationship between complete clauses; colons make a complete clause point forward to an explanation, list, or example.',
    howYouDid: 'The fixed sentence check returned precise grammar feedback. Your complete edit and rationale await Parent Review; the lesson does not infer writing mastery from one selection.',
    didWell: 'You edited in context and explained choices instead of completing punctuation trivia in isolation.',
    practice: 'Read to the punctuation, stop, and test whether the words on each required side form a complete clause.',
    reviewLesson: 'Syntax first, punctuation second, stylistic effect third.',
    courseProgress: 'This fixture is isolated from the Grade 10 course record. Reviewed revision evidence would support language-control and writing-revision standards in the pilot.',
    nextAction: 'Request Parent Review, then perform one final clause-boundary audit without looking at your editor’s note.',
  },
  readability: {
    instructionLength: 'Compact rule set followed by an authentic multi-paragraph editing task',
    sentenceComplexity: 'Independent and dependent clauses, transitions, appositives, and purposeful parallel lists',
    vocabularyLoad: 'Three defined grammar/style terms used as analytical tools',
    passageLength: '206 words including the editorial brief',
    expectedWrittenResponse: 'Three edited paragraphs plus a 4–6 sentence editor’s rationale',
    scaffolding: 'Clause-boundary model, one deterministic check, semicolon/colon annotation audit, faded final edit',
  },
})

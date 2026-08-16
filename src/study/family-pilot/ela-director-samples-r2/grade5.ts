import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `The student council’s first announcement said, “Students rushed into the new courtyard at lunch.” That verb made the opening sound energetic, but the reporter’s notes did not show anyone running. Most students had walked in while talking with friends.

The editor tried a second sentence: “Students drifted into the new courtyard at lunch.” Drifted suggested slow, almost aimless movement. It fit two groups who wandered between tables, but it did not fit the students who went straight to the chess boards.

The final version read, “Students spread through the new courtyard at lunch, filling the shaded tables first.” The verb spread showed movement into different parts of the space. The added detail about the tables gave readers something they could picture and check.

The council also described the courtyard as quiet. One reporter suggested peaceful; another suggested silent. Those words are related, but they do not mean exactly the same thing. A peaceful space may include calm conversation. A silent space has almost no sound. Because the notes mentioned voices and a bouncing ball, silent would have overstated the evidence.

Good writers do not always choose the strongest-sounding word. They choose the word whose shade of meaning matches the facts, purpose, and tone. Sometimes a precise detail works better than an adverb. Sometimes the best revision is a quieter word that tells the truth.`

export const GRADE_5_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 5,
  canonicalLessonRef: 'ma-g5-english-language-arts-u08-l06',
  topic: 'Word relationships and nuance',
  standards: ['5.RF.3', '5.L.1', '5.L.2', '5.L.4', '5.L.5', '5.L.6'],
  textType: 'Editorial case study',
  title: 'Almost the Same Is Not the Same',
  welcome: 'Writers choose among related words all the time. Today you will compare shades of meaning, then revise a short report so its language matches the evidence.',
  instruction: 'A word’s denotation is its basic dictionary meaning. Its nuance is the feeling or shade of meaning it carries. Rushed, walked, and drifted all describe movement, but they create different pictures and judgments.',
  vocabulary: [
    { term: 'denotation', definition: 'a word’s direct or dictionary meaning' },
    { term: 'nuance', definition: 'a small difference in meaning, feeling, or effect' },
    { term: 'tone', definition: 'the attitude a writer’s language creates' },
  ],
  model: 'Mini-case: A draft says, “The puppy glared at the open gate.” The notes say the puppy looked for one second, wagged, and sat down.\nThinking: Glared suggests anger, which the evidence does not support. Looked is accurate but general. Studied suggests longer, careful attention, which also does not fit one second.\nModel revision: “The puppy glanced at the open gate.” Glanced matches the quick action without inventing an angry tone.',
  modelPrompt: 'Follow the model’s three checks: evidence, shade of meaning, and tone.',
  passageTitle: 'One Courtyard, Several Verbs',
  passage: PASSAGE,
  passageDirections: 'Read the editorial case. Notice each time a writer tests a word against the reporter’s notes.',
  guidedDirections: 'Choose the word whose nuance best matches the evidence in the sentence.',
  guided: {
    type: 'CHOICE',
    prompt: 'Notes say that rain began lightly and continued at the same gentle rate. Which verb best completes “Rain ___ against the windows”?',
    choices: ['hammered', 'tapped', 'exploded'],
  },
  guidedFeedback: 'Tapped best matches light, steady rain. Hammered and exploded suggest much greater force. The check is not which word sounds most dramatic; it is which nuance fits the evidence.',
  independentDirections: 'Revise the sentence, then explain your word choice. There can be more than one defensible answer when the evidence supports it.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'A report says, “The crowd screamed when the seedling was planted.” The notes say twelve people clapped and two called, “Well done.” Rewrite the sentence with precise language. Then explain how your choices match the notes and create an accurate tone. Write 4–6 sentences total.',
  },
  processFeedback: 'No automatic scorer can decide whether every defensible revision works. Check whether your new verb matches twelve people, whether you kept the event accurate, and whether your explanation names the effect of at least one word. A parent reviews those dimensions rather than comparing your sentence with one secret answer.',
  revisionDirections: 'Strengthen both the edited sentence and your explanation. Keep any choice you can defend with the notes.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised report sentence followed by a 3–5 sentence editor’s note explaining the denotation, nuance, and tone of your key word choice.',
  },
  rubricCriteria: ['factual accuracy', 'precise word choice', 'explanation of nuance', 'purposeful tone'],
  review: {
    learned: 'Related words can share a basic meaning while creating different pictures, levels of force, or attitudes.',
    howYouDid: 'The rain item gave fixed-choice feedback. Your editorial revision remains pending Parent Review because several evidence-based word choices may be valid.',
    didWell: 'You tested language against source notes instead of choosing a dramatic word automatically.',
    practice: 'Name the evidence first; then compare two possible words and explain the different effect each would create.',
    reviewLesson: 'Precise writers ask: Is it true? Is it specific? Does its tone fit my purpose?',
    courseProgress: 'This review fixture does not change production progress. In the pilot, approved revision evidence would contribute to Grade 5 language and writing growth.',
    nextAction: 'Request Parent Review, then find one overstrong verb in a safe practice paragraph and replace it with a more accurate choice.',
  },
  readability: {
    instructionLength: 'Brief concept explanation plus a four-step editorial task',
    sentenceComplexity: 'Varied simple, compound, and introductory complex sentences',
    vocabularyLoad: 'Three defined language terms applied repeatedly to familiar words',
    passageLength: '224 words in five connected paragraphs',
    expectedWrittenResponse: 'One revised sentence plus a 3–5 sentence editor’s explanation',
    scaffolding: 'Word continuum, evidence-matching choice, model think-aloud, explicit revision dimensions',
  },
})

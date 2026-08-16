import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `For most of the year, the hollow beside Cedar Trail looks like an ordinary patch of leaves. In early spring, however, rain and melting snow fill it with shallow water. This temporary wet place is called a vernal pool.

Vernal pools usually dry up by late summer. Because they do not hold water all year, fish cannot live in them. That makes the pools safer nurseries for wood frogs and salamanders. Fish in a permanent pond might eat their eggs, but a vernal pool gives the eggs time to hatch.

The pool also helps animals that do not lay eggs there. Turtles stop to drink. Birds search for insects near the water. Deer visit the soft edges, where new plants begin growing before the forest floor turns green.

A vernal pool can be easy to miss. It may be smaller than a classroom, and it has no stream flowing in or out. Scientists often return to the same woods in different seasons. Water in April, frog eggs in May, and dark-stained leaves in August can all show that a pool is present.

Protecting only the water is not enough. Frogs and salamanders spend much of the year under logs or leaves in the nearby forest. If the pool stays clean but the trees around it are removed, the animals lose part of the habitat they need. A healthy vernal pool depends on both its spring water and the forest around it.`

export const GRADE_4_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 4,
  canonicalLessonRef: 'ma-g4-english-language-arts-u04-l04',
  topic: 'Stating a main idea and naming the key details that carry it',
  standards: ['4.RI.2', '4.RI.1'],
  textType: 'Informational science article',
  title: 'Main Idea: The Umbrella Over the Details',
  welcome: 'You will read an informational article about a seasonal woodland pool. Your job is to state the main idea and choose the details that truly support it.',
  instruction: 'A main idea is the most important point a whole section makes. It must work like an umbrella over the key details. A topic such as “vernal pools” is too broad. A tiny fact such as “deer visit” is too narrow.',
  vocabulary: [
    { term: 'main idea', definition: 'the most important point a text or section develops' },
    { term: 'key detail', definition: 'a fact or example that helps explain or support the main idea' },
    { term: 'temporary', definition: 'lasting for a limited time instead of forever' },
  ],
  model: 'Mini-text: The library planted two shade trees beside its west windows. In summer, the leaves block hot afternoon sun. In winter, the bare branches let sunlight reach the glass.\nThinking: All three sentences explain how the trees help control sunlight during different seasons. “The library has windows” is only a detail.\nModel main idea: Carefully placed trees help the library manage sunlight in summer and winter.',
  modelPrompt: 'Watch how the model checks that every sentence fits under one main idea.',
  passageTitle: 'A Pool That Does Not Stay',
  passage: PASSAGE,
  passageDirections: 'Read all five paragraphs. After each paragraph, pause and name its most important point in a few words.',
  guidedDirections: 'Choose the statement that covers the whole article, not just one paragraph.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which statement best expresses the main idea of “A Pool That Does Not Stay”?',
    choices: [
      'Vernal pools are temporary habitats that support woodland animals and depend on the nearby forest.',
      'Scientists look for dark leaves in August when they study forests.',
      'Fish cannot live in every kind of woodland water.',
    ],
  },
  guidedFeedback: 'The first statement is broad enough to include the pool’s temporary water, the animals it supports, and the surrounding forest. The other statements are accurate details, but each covers only one small part. If your choice was too narrow, test it against paragraphs 2, 3, and 5.',
  independentDirections: 'Write an objective summary. Include the main idea and the most important details, but leave out your opinion.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Summarize “A Pool That Does Not Stay” in 4–5 sentences. State the main idea and include three key details from different paragraphs.',
  },
  processFeedback: 'Your summary needs human review. Before revising, underline the sentence that states the main idea. Then count three details and check that each helps explain that idea. Remove personal reactions such as “I think” unless the prompt asks for an opinion.',
  revisionDirections: 'Use the checklist to write a clean revised summary in the response box.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Write your revised 4–5 sentence summary. Keep the main idea, three useful details, and an objective tone.',
  },
  rubricCriteria: ['accurate main idea', 'three relevant key details', 'objective summary', 'clear organization'],
  review: {
    learned: 'A strong main idea accounts for the text’s most important details; a summary states that idea and keeps only the details a reader needs.',
    howYouDid: 'The main-idea choice received feedback after you answered. Your summary and revision are pending Parent Review for accuracy and relevance.',
    didWell: 'You distinguished a whole-text idea from true but narrow facts and wrote across several paragraphs.',
    practice: 'When a detail does not fit your main idea, decide whether the detail is minor or whether your main idea needs to grow.',
    reviewLesson: 'Use the umbrella test: can the important details stand under your main-idea statement?',
    courseProgress: 'This isolated sample records no production credit. Reviewed summary evidence would support Grade 4 informational-reading progress in the pilot model.',
    nextAction: 'Ask for Parent Review, then explain aloud why one detail was important enough to keep.',
  },
  readability: {
    instructionLength: 'Short explanatory screens followed by one clearly labeled task',
    sentenceComplexity: 'Mostly compound sentences with a few explained cause-and-effect relationships',
    vocabularyLoad: 'Three defined terms plus concrete science words supported by context',
    passageLength: '241 words in five focused paragraphs',
    expectedWrittenResponse: '4–5 sentence objective summary with three key details',
    scaffolding: 'Umbrella metaphor, whole-text choice check, paragraph pauses, explicit summary checklist',
  },
})

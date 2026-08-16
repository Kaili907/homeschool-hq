import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `On the first Saturday in October, the apartment building lost power before sunrise. By eight o’clock, the hallway had filled with the sounds of doors opening and phones failing to connect.

Imani found Mr. Vale on the third-floor landing, holding a paper grocery list close to the window. He was trying to read the tiny directions for his new battery lantern.

“I can do it,” he said when Imani offered to help. The words came out sharper than either of them expected.

Imani stepped back. She had promised her aunt that she would check on him, but she did not want to turn the promise into an argument. On the stairs below, someone dragged a chair into the lobby. A child asked whether the refrigerator food would spoil.

Mr. Vale turned the instruction sheet sideways. “The print is badly designed,” he muttered.

Imani almost offered again. Instead, she switched on her own lantern and set it on the window ledge between them. Its light spread across the page without leaving her hand in his work.

Mr. Vale read for a while. Then he opened the battery compartment, frowned, and held up two batteries. “The diagram shows both flat ends facing the same way. That cannot be right.”

Imani leaned toward the page but did not take it. “What does the picture inside the lantern show?”

He checked. The lantern clicked on.

They carried it to the lobby, where neighbors had begun making a list: extra blankets, cooler space, rides for anyone who needed medicine, and games for the children. Mr. Vale added “two working lanterns.” Then he handed Imani the pencil.

By noon, the power returned. People folded the blankets and carried the chairs upstairs. Mr. Vale paused beside Imani’s door.

“You were helpful this morning,” he said.

Imani smiled. “You fixed the lantern.”

“Both can be true,” he replied.`

export const GRADE_7_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 7,
  canonicalLessonRef: 'ma-g7-english-language-arts-u02-l07',
  topic: 'Tracing how a theme develops through character interaction and choice',
  standards: ['7.RL.1', '7.RL.2', '7.RL.3', '7.W.3', '7.W.5'],
  textType: 'Literary realistic fiction',
  title: 'Theme Grows Through Choices',
  welcome: 'This close-reading lesson asks you to trace a theme instead of hunting for a moral stated in one sentence. You will follow how two characters respond to help, pride, and independence.',
  instruction: 'A topic is a broad subject such as help. A theme is a claim about that topic, such as “Respectful help preserves another person’s agency.” To analyze development, track an early tension, a character’s choice, and a later change. Strong evidence shows the movement between those moments.',
  vocabulary: [
    { term: 'theme', definition: 'an idea about life or people that a text develops through details' },
    { term: 'agency', definition: 'the ability to make choices and act for oneself' },
    { term: 'develop', definition: 'to build or change an idea across parts of a text' },
  ],
  model: 'Mini-text: Ava interrupts every time Ren searches for a word. Later, she waits, and Ren finishes the explanation alone.\nReasoning: “Friendship matters” names a topic but does not show development. The contrast between interrupting and waiting supports a more precise theme.\nModel analysis: The scene develops the idea that useful support sometimes requires patience. Ava’s early interruptions take control, but her later choice to wait lets Ren complete the thought. The changed action, not a narrator’s announcement, carries the theme.',
  modelPrompt: 'Notice the model’s path: early tension, changed choice, theme claim.',
  passageTitle: 'Both Can Be True',
  passage: PASSAGE,
  passageDirections: 'Read once for the situation. Read again and mark one early moment of tension, Imani’s choice on the landing, and the final exchange.',
  guidedDirections: 'Choose the theme claim that best accounts for the beginning, middle, and ending.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which claim best expresses a theme developed in “Both Can Be True”?',
    choices: [
      'Power outages cause neighbors to share supplies.',
      'Helping well can mean supporting another person without taking over.',
      'Instruction sheets should use larger print and accurate diagrams.',
    ],
  },
  guidedFeedback: 'The second claim reaches across Mr. Vale’s sharp refusal, Imani’s decision to place the light without taking the page, and the final “Both can be true.” The first and third choices are facts or topics in the story, but they do not explain the character interaction across the whole text.',
  independentDirections: 'Write one analytical paragraph. Use at least two located details from different parts of the story.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'How does Imani’s response to Mr. Vale develop a theme about help and independence? State a theme, use two specific details, and explain how the later moment changes or deepens the earlier one. Write 7–9 sentences.',
  },
  processFeedback: 'Your paragraph is pending Parent Review. Check the reasoning chain: theme claim → early evidence → middle or final evidence → explanation of change. Quoting two lines is not enough if you leave the connection unstated. Also check whether your claim allows both characters to have agency.',
  revisionDirections: 'Revise for development, not just evidence count. Make the relationship between the two moments explicit.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised 7–9 sentence theme analysis. Include two located details and a sentence explaining how the second detail develops the meaning of the first.',
  },
  rubricCriteria: ['defensible theme claim', 'two relevant details from different moments', 'analysis of development', 'coherent paragraph'],
  review: {
    learned: 'Theme develops through patterns, contrasts, consequences, and changed choices across a text.',
    howYouDid: 'You received fixed feedback on the theme distinction. Your analytical paragraph and revision await Parent Review; completion is visible, but literary judgment is not automated.',
    didWell: 'You moved beyond naming a topic and used character interaction to trace an idea over time.',
    practice: 'Explain what changes between two pieces of evidence. The word develops should point to movement, not merely repetition.',
    reviewLesson: 'Ask three questions: What tension appears? What choice follows? What larger idea becomes clearer?',
    courseProgress: 'This Director fixture is isolated from production progress. Reviewed evidence would align with Grade 7 literary analysis in the pilot course.',
    nextAction: 'Request Parent Review, then test whether your theme also accounts for Mr. Vale’s final line.',
  },
  readability: {
    instructionLength: 'One compact concept paragraph plus a multi-step close-reading direction',
    sentenceComplexity: 'Mixed dialogue, compound-complex sentences, and implied relationships',
    vocabularyLoad: 'Three defined analytical terms; meaning also supported by the narrative',
    passageLength: '310 words with dialogue and purposeful inference gaps',
    expectedWrittenResponse: '7–9 sentence literary-analysis paragraph using two moments',
    scaffolding: 'Development path model, second-read markers, theme/topic check, reasoning-chain revision',
  },
})

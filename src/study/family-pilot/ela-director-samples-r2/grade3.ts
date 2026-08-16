import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `Maya held the paper bag flat while Theo taped the bottom. Their class was building small kites for the spring field day.

“This fold keeps slipping,” Theo said. He pushed the bag away.

Maya looked at the model kite. Then she looked at their fold. “The corners need to meet,” she said. She peeled off the wrinkled tape instead of covering it with more.

The next strip stuck to Maya’s sleeve. Theo laughed, and Maya laughed too. She pulled it free and tried again. This time, she asked Theo to hold both corners while she pressed the tape across them.

Outside, their kite rose for one second and tipped into the grass. Theo wanted to carry it back inside. Maya watched two other kites. Their tails were longer.

“Let’s add one more ribbon,” she said.

The next breeze lifted the kite above Maya’s head. It wobbled, dipped, and then climbed. Maya did not shout. She checked the knot at the end of the string and handed the spool to Theo. “Your turn to keep it up,” she said.`

export const GRADE_3_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 3,
  canonicalLessonRef: 'ma-g3-english-language-arts-u03-l04',
  topic: 'Naming a character trait and proving it with one action from the text',
  standards: ['3.RL.3', '3.RL.1'],
  textType: 'Realistic fiction',
  title: 'Show Me the Trait: Actions Are Evidence',
  welcome: 'Today you will learn how a character’s actions can show what the character is like. You will read one short story and write about Maya.',
  instruction: 'A trait is a word that tells what a character is often like. Do not choose a trait only because it sounds good. Find an action in the story that proves it. Use this frame: Maya is ____. I know because she ____.',
  vocabulary: [
    { term: 'trait', definition: 'a word that tells what a person or character is often like' },
    { term: 'evidence', definition: 'a detail from the text that helps prove an idea' },
  ],
  model: 'Mini-text: Ben saw that the puzzle piece did not fit. He turned it, checked the picture, and tried a different spot.\nThinking: Ben keeps working and changes his plan. Those actions show that he is persistent. “Persistent” is stronger than “nice” because the actions prove it.\nModel response: Ben is persistent. I know because he checks the picture and tries a different spot when the piece does not fit.',
  modelPrompt: 'Notice how the model names a trait, points to an action, and explains the match.',
  passageTitle: 'One More Ribbon',
  passage: PASSAGE,
  passageDirections: 'Read one paragraph at a time. Look for what Maya does when the kite does not work yet.',
  guidedDirections: 'Choose the detail that best supports the trait persistent. Save one answer before you see the feedback.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which action is the strongest evidence that Maya is persistent?',
    choices: [
      'Maya holds the paper bag flat.',
      'Maya peels off the wrinkled tape and tries the fold again.',
      'Maya hands the spool to Theo after the kite rises.',
    ],
  },
  guidedFeedback: 'The second detail is the strongest match. Peeling off the bad tape and trying again shows Maya continuing after a problem. Holding the bag and sharing the spool are real details, but they do not show persistence as clearly. If you chose another detail, reread the part where the fold slips.',
  independentDirections: 'Now write about Maya in your own words. The text box below is where you answer.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Name one trait that describes Maya. Use one exact action from “One More Ribbon,” then explain how the action shows the trait. Write 3–4 complete sentences.',
  },
  processFeedback: 'Your writing is saved, but the computer has not graded it. Check three parts: Did you name a trait? Did you tell what Maya did? Did you explain why that action fits the trait? A parent will review whether the evidence and explanation make sense.',
  revisionDirections: 'Write a stronger version. Add a missing part or make the link between the action and trait clearer.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Rewrite your trait response in 3–4 complete sentences. Make the evidence-and-trait connection easy to follow.',
  },
  rubricCriteria: ['accurate trait', 'specific story action', 'clear explanation', 'complete sentences'],
  review: {
    learned: 'A character trait should be supported by something the character says, does, thinks, or chooses.',
    howYouDid: 'Your choice response received specific feedback. Your longer response and revision are saved for Parent Review, so no made-up automatic writing score appears here.',
    didWell: 'You read a complete story, chose evidence, and had a chance to explain your thinking in your own words.',
    practice: 'Keep practicing the word because. It helps you connect an action to the trait it shows.',
    reviewLesson: 'Remember the three moves: name the trait, point to the action, explain the match.',
    courseProgress: 'This Director sample does not change your production course record. In the full course, reviewed work would add evidence for character analysis.',
    nextAction: 'Ask a parent to review your response, or reread the story and try the same three moves with Theo.',
  },
  readability: {
    instructionLength: 'Two short teaching paragraphs; one action per screen',
    sentenceComplexity: 'Mostly simple and compound sentences with concrete subjects',
    vocabularyLoad: 'Two defined academic words used repeatedly in context',
    passageLength: '178 words in eight short paragraphs',
    expectedWrittenResponse: '3–4 complete sentences naming a trait, evidence, and connection',
    scaffolding: 'Sentence frame, modeled reasoning, one fixed-choice check, three-part revision checklist',
  },
})

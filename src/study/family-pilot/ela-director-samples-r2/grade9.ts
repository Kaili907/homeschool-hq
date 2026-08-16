import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `At 5:42 each morning, the first bus exhaled beside the curb. Its doors folded open, waited, and folded shut. Across the street, the bakery windows remained dark.

Mara had measured the block by those windows for nearly a year. At six, one square glowed above the sink. At six-ten, the display case became a row of small stages: apricot pastries, rye loaves, a leaning tower of rolls. At six-fifteen, her father unlocked the front door.

On Monday, no square glowed.

Mara crossed before the signal changed. A note waited behind the glass: CLOSED FOR REPAIRS. The words were printed in the calm blue letters her father used for holiday hours. Behind them, a strip of ceiling hung over the counter like peeled paper.

“Pipe broke upstairs,” her father said when he arrived. He kept moving as he spoke—key into lock, shoulder into door, phone against ear. “A week, maybe two.”

Inside, the bakery smelled not of bread but of wet plaster. Mara expected him to begin listing ruined things. Instead, he opened the display case and removed the empty trays one by one. Lift. Turn. Stack. The rhythm made the room seem briefly ordinary.

Neighbors began appearing after the sun came up. Mrs. Chen brought a fan. The barber rolled over a shop vacuum. A bus driver left three coffees and returned to his route. Each person asked what had happened; each heard the same answer. A pipe. A ceiling. A week, maybe two.

By noon, the trays stood in a silver tower near the door. Mara’s father taped a second note beneath the first: SATURDAY BREAD TABLE—OUTSIDE, WEATHER WILLING.

Mara looked from the torn ceiling to the sidewalk, where the first drops had begun to stipple the pavement.

“Weather willing?” she asked.

Her father uncapped the blue marker again. “Weather negotiated with,” he said.

On Saturday, the bus exhaled beside the curb at 5:42. This time, a folding table waited under its shelter. One lamp glowed above a row of paper-wrapped loaves. The bakery windows stayed dark, but the block did not.`

export const GRADE_9_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 9,
  canonicalLessonRef: 'ma-g9-english-language-arts-u03-l07',
  topic: 'Cumulative impact of specific word choices',
  standards: ['9-10.RL.4', '9-10.RI.4', '9-10.L.4', '9-10.L.5', '9-10.SL.6'],
  textType: 'Literary vignette',
  title: 'How Diction Accumulates',
  welcome: 'Close reading asks more than defining an isolated word. You will analyze how repeated verbs and images accumulate, shaping tone and the reader’s understanding of a community responding to disruption.',
  instruction: 'Denotation is a word’s direct meaning; connotation is the association it carries. Cumulative impact appears when several choices reinforce, complicate, or transform an effect across a passage. Analysis should move from exact language to pattern to meaning—not from a single adjective to a broad claim.',
  vocabulary: [
    { term: 'diction', definition: 'a writer’s deliberate word choices' },
    { term: 'connotation', definition: 'an association or feeling a word carries beyond its direct meaning' },
    { term: 'cumulative', definition: 'growing through the combined effect of several parts' },
  ],
  model: 'Mini-text: “The rain touched the roof, tapped the gutter, then drummed above the attic bed.”\nReasoning: Touched, tapped, and drummed all describe contact, but the verbs increase in force and sound. The sequence turns a background shower into something the speaker can no longer ignore.\nModel analysis: The escalating verbs create a gradual rise in intensity. Because the pattern develops from gentle “touched” to insistent “drummed,” the rain shifts from setting to pressure.',
  modelPrompt: 'Study the progression from word, to pattern, to interpretive effect.',
  passageTitle: 'Weather Negotiated With',
  passage: PASSAGE,
  passageDirections: 'Read once for events. On the second reading, track forms of glow or dark, the bus that “exhaled,” and the father’s repeated physical actions.',
  guidedDirections: 'Choose the interpretation that explains a pattern across the passage.',
  guided: {
    type: 'CHOICE',
    prompt: 'What is the strongest account of the repeated contrast between glowing and dark windows?',
    choices: [
      'It proves that the bakery uses more electricity than the bus shelter.',
      'It first marks the bakery’s normal routine, then makes its closure visible, and finally shifts the sense of life to the outdoor table and the block.',
      'It shows that Mara dislikes arriving before sunrise.',
    ],
  },
  guidedFeedback: 'The second interpretation traces the image across three moments and explains how its meaning changes. The other choices either invent a claim or reduce the pattern to one character preference. Cumulative analysis must account for recurrence and development.',
  independentDirections: 'Analyze one pattern of diction. You may use light/dark, “exhaled,” the father’s action verbs, or the language of repair and negotiation.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Write a 1–2 paragraph analysis of how at least three specific word choices create a cumulative effect in “Weather Negotiated With.” Explain how the pattern shapes tone and develops an idea about routine, resilience, or community.',
  },
  processFeedback: 'Your interpretation requires human judgment. Before revising, circle each quoted word and ask what it contributes that a neutral synonym would not. Then read only your explanation sentences. They should trace a pattern and effect, not merely label the diction “powerful” or “descriptive.”',
  revisionDirections: 'Revise for precision and progression. Include the language, its local connotation, and its combined effect.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised 1–2 paragraph analysis using at least three exact word choices and a clear explanation of how their effects accumulate across the text.',
  },
  rubricCriteria: ['precise textual evidence', 'connotation in context', 'analysis of an accumulating pattern', 'connection to tone and meaning'],
  review: {
    learned: 'Word-choice analysis becomes stronger when it traces how several choices interact across a text rather than treating diction as isolated decoration.',
    howYouDid: 'The image-pattern item received immediate feedback. Your close reading and revision remain pending Parent Review for interpretive quality.',
    didWell: 'You moved from exact words to connotations, patterns, tone, and thematic meaning.',
    practice: 'Replace vague effect words such as “interesting” with a named shift: intensifies, slows, humanizes, destabilizes, or reframes.',
    reviewLesson: 'Use the analytical chain: quote → connotation → recurrence or contrast → cumulative effect → meaning.',
    courseProgress: 'This Director sample is not production coursework. Under the pilot model, reviewed analysis would contribute evidence toward 9–10 language and close-reading standards.',
    nextAction: 'Request Parent Review, then test your claim by substituting a neutral synonym for one quoted word and describing what is lost.',
  },
  readability: {
    instructionLength: 'Concise disciplinary explanation followed by a two-pass close-reading protocol',
    sentenceComplexity: 'Controlled literary syntax, fragments for effect, figurative language, and implicit transitions',
    vocabularyLoad: 'Three defined disciplinary terms plus context-dependent figurative diction',
    passageLength: '343 words with recurring images and structural contrast',
    expectedWrittenResponse: '1–2 analytical paragraphs using at least three exact word choices',
    scaffolding: 'Escalation model, second-reading pattern options, progression check, synonym revision test',
  },
})

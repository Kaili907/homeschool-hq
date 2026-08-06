import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 3 beginning-of-year reading/ELA placement.
//
// 31 items, four sections, roughly 40 minutes untimed. BOTH PASSAGES ARE
// ORIGINAL, written for this assessment; no copyrighted text is used or
// paraphrased. Tier meaning: foundation = Grade 2 prerequisite ·
// current = Grade 3 start · stretch = Grade 4 signal.
//
// Fluency is sampled the only honest way this app can: an UNTIMED read-aloud
// the parent listens to once and scores for accuracy. There is no words-per-
// minute figure anywhere in this instrument, and none should be inferred.

const STORY_G3 = `The Loose Tooth

Ruby had been wiggling the same tooth for eleven days. She wiggled it at breakfast. She wiggled it in the car. She wiggled it while her brother Sam explained, for the third time, exactly how his own tooth had come out.

"You just pull it," Sam said. "One quick pull."

Ruby put her hands in her lap. "I am not pulling anything," she said.

On the twelfth day, Ruby bit into an apple. She felt a small pop, like a bubble breaking, and then something hard and strange rolled onto her tongue. She opened her hand. There it was — small, white, and a little bit yellow at the bottom.

Sam looked up from his cereal. "See? I told you it was easy."

Ruby ran her tongue along the new gap and grinned so wide it hurt her cheeks. "You told me to pull it," she said. "I ate an apple."`

const ARTICLE_G3 = `How Honey Bees Share Directions

Honey bees cannot speak, but they can still tell each other where to find food. When a bee discovers a patch of flowers, she flies back to the hive and dances.

The dance is not for fun. It is a set of directions. If the flowers are close by, the bee runs in a small circle. If the flowers are far away, she runs in a straight line while shaking her body, then loops back and does it again. Scientists call this the waggle dance.

The direction the bee runs points the way to the flowers. The longer she waggles, the farther the other bees must fly. The bees crowded around her cannot see well inside the dark hive, so they feel the dance with their legs and antennae.

One dance can send dozens of bees to the right flowers, sometimes more than a mile away. That matters, because a hive may need to visit two million flowers to make one pound of honey. Without a way to share directions, the bees would waste the short summer searching instead of gathering.`

export const ELE_ELA_G3: FixedTest = {
  id: 'ele-ela-g3',
  title: 'Grade 3 Reading and Writing — Beginning-of-Year Placement',
  forGrades: ['3'],
  intro:
    'This is not a test you can fail, and there is no timer. It helps a grown-up choose the ' +
    'right books and lessons for you this year. You will read a story, read something true ' +
    'about bees, answer questions, and write a little. Some questions are from last year and a ' +
    'few are from next year — nobody is expected to know them all. If you do not know how to ' +
    'start, press SKIP. That is an honest answer and it helps.',
  sections: [
    {
      name: 'Section 1 — Word Study',
      items: [
        {
          id: 'e3e01',
          kind: 'choice',
          prompt: 'Which word has the same vowel sound as "rain"?',
          choices: ['play', 'ran', 'rock', 'run'],
          key: 'play',
          keyNote: 'play — the long a sound.',
        },
        {
          id: 'e3e02',
          kind: 'choice',
          prompt: 'Which word is spelled correctly?',
          choices: ['friend', 'freind', 'frend', 'frendd'],
          key: 'friend',
          keyNote: 'friend.',
        },
        {
          id: 'e3e03',
          kind: 'choice',
          prompt: 'How many syllables (beats) are in the word "butterfly"?',
          choices: ['1', '2', '3', '4'],
          key: '3',
          keyNote: '3 — but-ter-fly.',
        },
        {
          id: 'e3e04',
          kind: 'choice',
          prompt: 'In the word "rebuild", what does the beginning part "re-" mean?',
          choices: ['again', 'not', 'before', 'after'],
          key: 'again',
          keyNote: 'again.',
        },
        {
          id: 'e3e05',
          kind: 'choice',
          prompt: 'In the word "fearless", what does the ending "-less" mean?',
          choices: ['without', 'full of', 'more', 'again'],
          key: 'without',
          keyNote: 'without — fearless means without fear.',
        },
        {
          id: 'e3e06',
          kind: 'choice',
          prompt: 'Which word means more than one shelf?',
          choices: ['shelfs', 'shelves', 'shelfes', 'shelf'],
          key: 'shelves',
          keyNote: 'shelves.',
        },
        {
          id: 'e3e07',
          kind: 'choice',
          prompt: 'Which word means "to look at something again"?',
          choices: ['review', 'preview', 'viewer', 'viewing'],
          key: 'review',
          keyNote: 'review. Grade 4 signal.',
        },
      ],
    },
    {
      name: 'Section 2 — Reading a Story',
      passage: STORY_G3,
      items: [
        {
          id: 'e3e08',
          kind: 'longtext',
          prompt:
            'Before you answer the story questions, read the story above OUT LOUD, once, to a ' +
            'grown-up. There is no timer and nobody is counting how fast you read. Read at the ' +
            'speed that feels comfortable. When you have finished reading it out loud, type DONE ' +
            'here and keep going.',
          keyNote:
            'RUBRIC ITEM (0–3), PARENT-OBSERVED, UNTIMED. The grown-up listens once and scores ' +
            'ACCURACY ONLY against the read-aloud rubric in the scoring guide. Do not time the ' +
            'reading and do not record a words-per-minute figure.',
        },
        {
          id: 'e3e09',
          kind: 'choice',
          prompt: 'On which day did Ruby’s tooth finally come out?',
          choices: ['the first day', 'the fifth day', 'the eleventh day', 'the twelfth day'],
          key: 'the twelfth day',
          keyNote: 'the twelfth day.',
        },
        {
          id: 'e3e10',
          kind: 'choice',
          prompt: 'What was Ruby doing when her tooth came out?',
          choices: ['pulling it', 'biting an apple', 'brushing her teeth', 'sleeping'],
          key: 'biting an apple',
          keyNote: 'biting an apple.',
        },
        {
          id: 'e3e11',
          kind: 'choice',
          prompt: 'The story says Ruby felt "a small pop, like a bubble breaking". This describes:',
          choices: ['a sound and a feeling', 'a colour', 'a smell', 'a taste'],
          key: 'a sound and a feeling',
          keyNote: 'a sound and a feeling.',
        },
        {
          id: 'e3e12',
          kind: 'longtext',
          prompt:
            'How do you think Ruby felt when her tooth came out? Use one detail from the story to ' +
            'show how you know.',
          keyNote:
            'RUBRIC ITEM (0–3). Any reasonable feeling counts (happy, proud, surprised, relieved) ' +
            'as long as a story detail supports it — the grin, her hurting cheeks, or her reply to ' +
            'Sam. Score the evidence, not the adjective.',
        },
        {
          id: 'e3e13',
          kind: 'choice',
          prompt:
            'At the end, Ruby says: "You told me to pull it. I ate an apple." This mostly shows that Ruby:',
          choices: [
            'did it her own way',
            'followed her brother’s advice',
            'was angry at Sam',
            'did not want the tooth out',
          ],
          key: 'did it her own way',
          keyNote: 'did it her own way.',
        },
        {
          id: 'e3e14',
          kind: 'longtext',
          prompt: 'What does this story show about solving a problem? Answer in one sentence.',
          keyNote:
            'RUBRIC ITEM (0–3). Grade 4 signal. Accept any defensible theme drawn from the text — ' +
            'there is more than one way to solve a problem; patience works; you do not have to do ' +
            'it someone else’s way. A retelling with no idea in it scores 1.',
        },
      ],
    },
    {
      name: 'Section 3 — Reading to Learn',
      passage: ARTICLE_G3,
      items: [
        {
          id: 'e3e15',
          kind: 'choice',
          prompt: 'What does a honey bee do when she finds flowers?',
          choices: [
            'She dances at the hive.',
            'She sings.',
            'She leads the others by flying.',
            'She waits at the flowers.',
          ],
          key: 'She dances at the hive.',
          keyNote: 'She dances at the hive.',
        },
        {
          id: 'e3e16',
          kind: 'choice',
          prompt: 'According to the passage, what does the bee do if the flowers are FAR AWAY?',
          choices: [
            'runs in a small circle',
            'runs in a straight line and shakes',
            'flies in a spiral',
            'stops dancing',
          ],
          key: 'runs in a straight line and shakes',
          keyNote: 'runs in a straight line and shakes — the waggle dance.',
        },
        {
          id: 'e3e17',
          kind: 'choice',
          prompt: 'In this passage, the word "waggle" means:',
          choices: ['to shake back and forth', 'to fly quickly', 'to gather food', 'to sleep'],
          key: 'to shake back and forth',
          keyNote: 'to shake back and forth.',
        },
        {
          id: 'e3e18',
          kind: 'longtext',
          prompt:
            'What is the main idea of this passage? Give one detail from the passage that shows you are right.',
          keyNote:
            'RUBRIC ITEM (0–3). Main idea: bees use a dance to tell each other where food is. ' +
            'Any detail from the text that supports it counts. A single copied sentence with no ' +
            'main idea scores 1.',
        },
        {
          id: 'e3e19',
          kind: 'choice',
          prompt: 'Why do the other bees FEEL the dance instead of watching it?',
          choices: ['The hive is dark.', 'They are asleep.', 'They are too far away.', 'Bees have no eyes.'],
          key: 'The hive is dark.',
          keyNote: 'The hive is dark — the passage says they cannot see well inside it.',
        },
        {
          id: 'e3e20',
          kind: 'choice',
          prompt: 'How many flowers may a hive need to visit to make one pound of honey?',
          choices: ['two thousand', 'twenty thousand', 'two hundred thousand', 'two million'],
          key: 'two million',
          keyNote: 'two million.',
        },
        {
          id: 'e3e21',
          kind: 'choice',
          prompt: 'The last sentence of the passage mostly explains:',
          choices: [
            'why sharing directions matters',
            'how honey tastes',
            'where bees sleep',
            'how bees are born',
          ],
          key: 'why sharing directions matters',
          keyNote: 'why sharing directions matters. Grade 4 signal.',
        },
        {
          id: 'e3e22',
          kind: 'choice',
          prompt:
            'In the last sentence, "the bees would waste the short summer searching" — here "waste" means:',
          choices: [
            'use up with nothing to show for it',
            'throw in the rubbish',
            'make dirty',
            'save carefully',
          ],
          key: 'use up with nothing to show for it',
          keyNote: 'use up with nothing to show for it. Grade 4 signal.',
        },
      ],
    },
    {
      name: 'Section 4 — Writing and Conventions',
      items: [
        {
          id: 'e3e23',
          kind: 'choice',
          prompt: 'Which one is a complete sentence?',
          choices: [
            'The dog barked loudly.',
            'Ran to the park.',
            'Because it was raining.',
            'The big red.',
          ],
          key: 'The dog barked loudly.',
          keyNote: 'The dog barked loudly. — the others are fragments.',
        },
        {
          id: 'e3e24',
          kind: 'choice',
          prompt: 'Which sentence is written correctly?',
          choices: [
            'Where is my book?',
            'Where is my book',
            'Where is my book,',
            'Where is, my book?',
          ],
          key: 'Where is my book?',
          keyNote:
            'Where is my book? — a question takes a question mark. Capitalisation is deliberately ' +
            'NOT tested by a choice item anywhere in this bank: the shared answer matcher is ' +
            'case-insensitive, so a capital-only distractor would score as correct. Capitals are ' +
            'judged in the writing rubric instead.',
        },
        {
          id: 'e3e25',
          kind: 'choice',
          prompt: 'Which word is the VERB in this sentence?\n\nThe tall girl jumped over the puddle.',
          choices: ['tall', 'girl', 'jumped', 'puddle'],
          key: 'jumped',
          keyNote: 'jumped.',
        },
        {
          id: 'e3e26',
          kind: 'choice',
          prompt: 'Choose the correct word:\n\nYesterday we ___ to the library.',
          choices: ['go', 'goes', 'went', 'going'],
          key: 'went',
          keyNote: 'went — past tense.',
        },
        {
          id: 'e3e27',
          kind: 'choice',
          prompt: 'Which sentence uses commas correctly?',
          choices: [
            'I packed apples bread and cheese.',
            'I packed apples, bread, and cheese.',
            'I packed, apples bread and cheese.',
            'I, packed apples bread, and cheese.',
          ],
          key: 'I packed apples, bread, and cheese.',
          keyNote: 'I packed apples, bread, and cheese.',
        },
        {
          id: 'e3e28',
          kind: 'choice',
          prompt: 'Which word fits best?\n\nI wanted to play outside, ___ it was raining.',
          choices: ['but', 'so', 'because', 'and'],
          key: 'but',
          keyNote: 'but — the two ideas contrast.',
        },
        {
          id: 'e3e29',
          kind: 'choice',
          prompt: 'Which one fixes this run-on sentence?\n\nI finished my chores I went outside.',
          choices: [
            'I finished my chores, I went outside.',
            'I finished my chores and went outside.',
            'I finished my chores went outside.',
            'I finished, my chores I went outside.',
          ],
          key: 'I finished my chores and went outside.',
          keyNote: 'I finished my chores and went outside. Grade 4 signal.',
        },
        {
          id: 'e3e30',
          kind: 'longtext',
          prompt:
            'Write a paragraph of at least four sentences about something you have learned to do ' +
            'by yourself. Start with a sentence that tells what it is, give two sentences with ' +
            'details, and finish with a closing sentence.',
          keyNote:
            'RUBRIC ITEM (0–4). Score against the Grade 3 paragraph rubric in the scoring guide: ' +
            'topic sentence, two details, closing, and sentence mechanics. Do not deduct for ' +
            'handwriting or for spelling that does not block meaning.',
        },
        {
          id: 'e3e31',
          kind: 'longtext',
          prompt:
            'Some people think third graders should choose their own bedtime. Write three or four ' +
            'sentences saying what you think and giving one reason.',
          keyNote:
            'RUBRIC ITEM (0–3). Grade 4 signal. Score whether an opinion is stated and supported ' +
            'by a reason, not whether the opinion is agreeable.',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_ELA_G3_BLUEPRINT: Blueprint = {
  e3e01: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '2.RF.3b — long vowel patterns', weight: 1, mode: 'auto' },
  e3e02: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '2.RF.3d — irregularly spelled words', weight: 1, mode: 'auto' },
  e3e03: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '2.RF.3c — syllables in multisyllable words', weight: 1, mode: 'auto' },
  e3e04: { tier: 'current', domain: 'Word analysis and decoding', standard: '3.RF.3a — common prefixes', weight: 1, mode: 'auto' },
  e3e05: { tier: 'current', domain: 'Word analysis and decoding', standard: '3.RF.3a — common suffixes', weight: 1, mode: 'auto' },
  e3e06: { tier: 'current', domain: 'Word analysis and decoding', standard: '3.L.1b — irregular plural nouns', weight: 1, mode: 'auto' },
  e3e07: { tier: 'stretch', domain: 'Word analysis and decoding', standard: '4.RF.3a — affixes and roots', weight: 1, mode: 'auto' },

  e3e08: { tier: 'current', domain: 'Reading accuracy (read-aloud)', standard: '3.RF.4b — read aloud accurately, untimed', weight: 1, mode: 'rubric', rubricPoints: 3 },

  e3e09: { tier: 'foundation', domain: 'Literal comprehension', standard: '2.RL.1 — answer questions about key details', weight: 1, mode: 'auto' },
  e3e10: { tier: 'foundation', domain: 'Literal comprehension', standard: '2.RL.1 — answer questions about key details', weight: 1, mode: 'auto' },
  e3e15: { tier: 'foundation', domain: 'Literal comprehension', standard: '2.RI.1 — key details in a text', weight: 1, mode: 'auto' },
  e3e16: { tier: 'current', domain: 'Literal comprehension', standard: '3.RI.1 — refer explicitly to the text', weight: 1, mode: 'auto' },
  e3e20: { tier: 'current', domain: 'Literal comprehension', standard: '3.RI.1 — locate a specific fact', weight: 1, mode: 'auto' },

  e3e11: { tier: 'current', domain: 'Vocabulary in context', standard: '3.RL.4 — words and phrases in a story', weight: 1, mode: 'auto' },
  e3e17: { tier: 'current', domain: 'Vocabulary in context', standard: '3.RI.4 — domain words in a text', weight: 1, mode: 'auto' },
  e3e22: { tier: 'stretch', domain: 'Vocabulary in context', standard: '4.L.4a — use context to fix meaning', weight: 1, mode: 'auto' },

  e3e12: { tier: 'current', domain: 'Inference', standard: '3.RL.1 — draw inferences from a story', weight: 1, mode: 'rubric', rubricPoints: 3 },
  e3e13: { tier: 'current', domain: 'Inference', standard: '3.RL.3 — what a character’s words reveal', weight: 1, mode: 'auto' },
  e3e19: { tier: 'current', domain: 'Inference', standard: '3.RI.1 — infer a cause from the text', weight: 1, mode: 'auto' },

  e3e18: { tier: 'current', domain: 'Main idea and evidence', standard: '3.RI.2 — main idea with supporting detail', weight: 1, mode: 'rubric', rubricPoints: 3 },
  e3e21: { tier: 'stretch', domain: 'Main idea and evidence', standard: '4.RI.8 — how a sentence supports the point', weight: 1, mode: 'auto' },
  e3e14: { tier: 'stretch', domain: 'Main idea and evidence', standard: '4.RL.2 — determine a theme', weight: 1, mode: 'rubric', rubricPoints: 3 },

  e3e23: { tier: 'foundation', domain: 'Grammar and conventions', standard: '2.L.1f — complete sentences', weight: 1, mode: 'auto' },
  e3e24: { tier: 'foundation', domain: 'Grammar and conventions', standard: '2.L.2 — capitalisation and end punctuation', weight: 1, mode: 'auto' },
  e3e25: { tier: 'current', domain: 'Grammar and conventions', standard: '3.L.1a — identify parts of speech', weight: 1, mode: 'auto' },
  e3e26: { tier: 'current', domain: 'Grammar and conventions', standard: '3.L.1d — irregular past-tense verbs', weight: 1, mode: 'auto' },
  e3e27: { tier: 'current', domain: 'Grammar and conventions', standard: '3.L.2c — commas in a series', weight: 1, mode: 'auto' },
  e3e28: { tier: 'current', domain: 'Grammar and conventions', standard: '3.L.1h — coordinating conjunctions', weight: 1, mode: 'auto' },
  e3e29: { tier: 'stretch', domain: 'Grammar and conventions', standard: '4.L.1f — correct run-on sentences', weight: 1, mode: 'auto' },

  e3e30: { tier: 'current', domain: 'Writing', standard: '3.W.2 — informative paragraph', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e3e31: { tier: 'stretch', domain: 'Writing', standard: '4.W.1 — opinion with a reason', weight: 1, mode: 'rubric', rubricPoints: 3 },
}

export const ELE_ELA_G3_DOMAINS: readonly string[] = [
  'Word analysis and decoding',
  'Reading accuracy (read-aloud)',
  'Vocabulary in context',
  'Literal comprehension',
  'Inference',
  'Main idea and evidence',
  'Grammar and conventions',
  'Writing',
]

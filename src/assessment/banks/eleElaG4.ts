import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 4 beginning-of-year reading/ELA placement.
//
// 32 items, four sections, roughly 45 minutes untimed. BOTH PASSAGES ARE
// ORIGINAL, written for this assessment. Tier meaning: foundation = Grade 3
// prerequisite · current = Grade 4 start · stretch = Grade 5 signal.
//
// Fluency is sampled as an UNTIMED, parent-observed read-aloud scored for
// accuracy only. No words-per-minute figure exists in this instrument.

const STORY_G4 = `The Last Row

Nobody wanted the seat in the last row of the school bus. It sat over the back wheel, so every bump sent you an inch into the air, and by October it smelled like the lunch somebody had forgotten there in September.

Dev took it anyway, because the alternative was standing.

On the third morning, a girl he did not know dropped into the seat beside him without asking. She had a library book open before the bus finished pulling away.

"You're in my seat," she said, not looking up.

"It's a free country," said Dev, who had heard his father say this and had never once been sure what it meant.

"It's a free bus," the girl agreed. "I'm Priya. I sit here because nobody talks to you in the back."

Dev considered this. "I'm talking to you."

Priya turned a page. "I noticed."

For the next four minutes neither of them said anything, and Dev discovered that this was a different kind of quiet than the quiet of sitting alone. When the bus hit the pothole by the fire station and they both went an inch into the air, Priya said "ha" without looking up from her book, and Dev decided the last row was not so bad.

By November he was saving the seat.`

const ARTICLE_G4 = `The Museum That Fights Its Own Lights

Every museum has a problem it does not advertise: light. The same light that lets a visitor see a painting is slowly taking that painting apart. Sunlight and bright lamps break the chemical bonds in pigments, so reds fade toward pink and blues drift toward grey. The damage adds up, and it never reverses.

For most of the twentieth century, the answer was simply to keep the galleries dim. Visitors complained that they could not see well, and curators agreed with them, but there was no better choice available.

Then museums began changing the light instead of the room. Modern gallery lamps use light-emitting diodes, or LEDs, which can be tuned to leave out the ultraviolet wavelengths that cause the most fading. Some galleries now use sensors that raise the light only when a person is standing in front of a work and lower it again when the room empties. A painting that used to sit under a lamp for eight hours a day may now be lit for forty minutes.

The newest systems go further. They keep a running total of how much light each object has absorbed since it went on display, the way a bank tracks a balance. When an object approaches its limit, the system flags it, and the museum rests it in storage for a year or two.

None of this repairs damage already done. What it buys is time. A curator today is not trying to keep a painting perfect. She is trying to make sure that the people who visit in two hundred years still have something to look at.`

export const ELE_ELA_G4: FixedTest = {
  id: 'ele-ela-g4',
  title: 'Grade 4 Reading and Writing — Beginning-of-Year Placement',
  forGrades: ['4'],
  intro:
    'This is not graded and nothing from it goes on a report. It shows a grown-up which reading ' +
    'and writing to teach you first this year. You will read a story, read an article, answer ' +
    'questions about both, and do two pieces of writing. A few questions come from last year ' +
    'and a few from next year — nobody is expected to get them all. If you do not know how to ' +
    'begin a question, press SKIP; that is honest and useful. There is no timer.',
  sections: [
    {
      name: 'Section 1 — Word Study and Vocabulary',
      items: [
        {
          id: 'e4e01',
          kind: 'choice',
          prompt: 'In the word "unhappy", what does the prefix "un-" mean?',
          choices: ['not', 'again', 'before', 'very'],
          key: 'not',
          keyNote: 'not.',
        },
        {
          id: 'e4e02',
          kind: 'choice',
          prompt: 'Which word means more than one city?',
          choices: ['citys', 'cityes', 'cities', 'citie'],
          key: 'cities',
          keyNote: 'cities.',
        },
        {
          id: 'e4e03',
          kind: 'choice',
          prompt: 'In the sentence "The path was narrow," the word "narrow" means:',
          choices: ['thin from side to side', 'very long', 'muddy', 'steep'],
          key: 'thin from side to side',
          keyNote: 'thin from side to side.',
        },
        {
          id: 'e4e04',
          kind: 'choice',
          prompt: 'Which word contains a word part meaning "to write"?',
          choices: ['telegraph', 'telephone', 'television', 'telescope'],
          key: 'telegraph',
          keyNote: 'telegraph — "graph" means to write. The other three share "tele" but not "graph".',
        },
        {
          id: 'e4e05',
          kind: 'choice',
          prompt: 'Adding "-ous" to "danger" makes "dangerous". The new word is:',
          choices: [
            'a describing word (adjective)',
            'a past-tense verb',
            'a plural noun',
            'a question word',
          ],
          key: 'a describing word (adjective)',
          keyNote: 'a describing word (adjective).',
        },
        {
          id: 'e4e06',
          kind: 'choice',
          prompt: '"She was drowning in homework" is an example of:',
          choices: ['a metaphor', 'a simile', 'a fact', 'a question'],
          key: 'a metaphor',
          keyNote: 'a metaphor — it compares without using "like" or "as".',
        },
        {
          id: 'e4e07',
          kind: 'choice',
          prompt: 'The word part "aud" in "audience" and "audible" means:',
          choices: ['hear', 'see', 'speak', 'move'],
          key: 'hear',
          keyNote: 'hear. Grade 5 signal.',
        },
        {
          id: 'e4e08',
          kind: 'choice',
          prompt: '"The wind clawed at the windows" gives the wind an animal quality. This is called:',
          choices: ['personification', 'a simile', 'alliteration', 'a fact'],
          key: 'personification',
          keyNote: 'personification. Grade 5 signal.',
        },
      ],
    },
    {
      name: 'Section 2 — Reading a Story',
      passage: STORY_G4,
      items: [
        {
          id: 'e4e09',
          kind: 'longtext',
          prompt:
            'Before answering, read the first four paragraphs of the story above OUT LOUD, once, ' +
            'to a grown-up. Nobody is timing you and nobody is counting your speed — read at a ' +
            'comfortable pace. When you have finished reading aloud, type DONE here and carry on.',
          keyNote:
            'RUBRIC ITEM (0–3), PARENT-OBSERVED, UNTIMED. Score ACCURACY ONLY against the ' +
            'read-aloud rubric in the scoring guide. Do not time the reading and do not record a ' +
            'words-per-minute figure.',
        },
        {
          id: 'e4e10',
          kind: 'choice',
          prompt: 'Why did Dev take the seat in the last row?',
          choices: [
            'It was the only seat left',
            'He liked sitting at the back',
            'Priya invited him',
            'He wanted somewhere to read',
          ],
          key: 'It was the only seat left',
          keyNote: 'It was the only seat left — "the alternative was standing".',
        },
        {
          id: 'e4e11',
          kind: 'choice',
          prompt: 'In "the alternative was standing", the word "alternative" means:',
          choices: ['the other choice', 'the rule', 'the punishment', 'the reward'],
          key: 'the other choice',
          keyNote: 'the other choice.',
        },
        {
          id: 'e4e12',
          kind: 'choice',
          prompt: 'The story says Dev had "never once been sure what it meant". This suggests that Dev:',
          choices: [
            'is repeating a phrase he has heard grown-ups say',
            'fully understands the law',
            'is angry with Priya',
            'wants Priya to move',
          ],
          key: 'is repeating a phrase he has heard grown-ups say',
          keyNote: 'is repeating a phrase he has heard grown-ups say.',
        },
        {
          id: 'e4e13',
          kind: 'longtext',
          prompt:
            'How does Dev feel about the last row at the START of the story, and how does he feel ' +
            'by the END? Use two details from the story to show the change.',
          keyNote:
            'RUBRIC ITEM (0–3). Look for the contrast: nobody wanted the seat / he took it because ' +
            'he had to → he decided it was not so bad / he saved it. Two accurate details earn ' +
            'full marks even if the wording is plain.',
        },
        {
          id: 'e4e14',
          kind: 'choice',
          prompt: 'Which sentence best states the message of the story?',
          choices: [
            'A place can change when you share it with someone.',
            'School buses are uncomfortable.',
            'Reading is better than talking.',
            'It is important to arrive on time.',
          ],
          key: 'A place can change when you share it with someone.',
          keyNote: 'A place can change when you share it with someone.',
        },
        {
          id: 'e4e15',
          kind: 'choice',
          prompt: 'What is the last thing the story tells us Dev did?',
          choices: [
            'He saved the seat',
            'He moved to the front',
            'He stopped riding the bus',
            'He borrowed Priya’s book',
          ],
          key: 'He saved the seat',
          keyNote: 'He saved the seat — "By November he was saving the seat."',
        },
        {
          id: 'e4e16',
          kind: 'longtext',
          prompt:
            'The story says Dev found "a different kind of quiet". Explain what the author means ' +
            'by that, and why the moment matters in the story.',
          keyNote:
            'RUBRIC ITEM (0–3). Grade 5 signal. Full marks recognise the contrast between being ' +
            'alone and being companionably silent with somebody, and connect it to Dev changing ' +
            'his mind about the seat.',
        },
      ],
    },
    {
      name: 'Section 3 — Reading to Learn',
      passage: ARTICLE_G4,
      items: [
        {
          id: 'e4e17',
          kind: 'choice',
          prompt: 'According to the passage, what slowly damages paintings?',
          choices: ['light', 'water', 'sound', 'cold'],
          key: 'light',
          keyNote: 'light.',
        },
        {
          id: 'e4e18',
          kind: 'choice',
          prompt: 'What do LEDs allow museums to do?',
          choices: [
            'leave out the wavelengths that cause the most fading',
            'make the rooms warmer',
            'clean the paintings',
            'print copies of the paintings',
          ],
          key: 'leave out the wavelengths that cause the most fading',
          keyNote: 'leave out the wavelengths that cause the most fading.',
        },
        {
          id: 'e4e19',
          kind: 'choice',
          prompt: 'In this passage, "curators" are people who:',
          choices: [
            'look after a museum’s collection',
            'paint the pictures',
            'visit museums',
            'build the lamps',
          ],
          key: 'look after a museum’s collection',
          keyNote: 'look after a museum’s collection — inferred from context.',
        },
        {
          id: 'e4e20',
          kind: 'longtext',
          prompt:
            'What is the main idea of this passage? Support your answer with two details from the text.',
          keyNote:
            'RUBRIC ITEM (0–4). Main idea: museums cannot undo light damage, so they now manage ' +
            'light carefully to slow it down. Accept any two accurate supporting details.',
        },
        {
          id: 'e4e21',
          kind: 'choice',
          prompt:
            'The passage compares the newest systems to "the way a bank tracks a balance". This helps the reader understand that the system:',
          choices: [
            'adds up light over time',
            'costs a great deal of money',
            'is run by a bank',
            'counts the visitors',
          ],
          key: 'adds up light over time',
          keyNote: 'adds up light over time.',
        },
        {
          id: 'e4e22',
          kind: 'choice',
          prompt: 'How is this passage organised?',
          choices: [
            'a problem, then solutions that improved over time',
            'a list of famous museums',
            'a step-by-step set of instructions',
            'a comparison of two artists',
          ],
          key: 'a problem, then solutions that improved over time',
          keyNote: 'a problem, then solutions that improved over time.',
        },
        {
          id: 'e4e23',
          kind: 'numeric',
          prompt:
            'According to the passage, a painting that used to be lit for eight hours a day may ' +
            'now be lit for how many MINUTES? Write just the number.',
          key: '40',
          keyNote: '40.',
        },
        {
          id: 'e4e24',
          kind: 'choice',
          prompt: 'The last paragraph suggests that the goal of this work is to:',
          choices: [
            'slow the loss so future visitors still have something to see',
            'restore paintings to brand-new condition',
            'stop displaying paintings altogether',
            'sell the damaged paintings',
          ],
          key: 'slow the loss so future visitors still have something to see',
          keyNote: 'slow the loss so future visitors still have something to see. Grade 5 signal.',
        },
      ],
    },
    {
      name: 'Section 4 — Writing and Conventions',
      items: [
        {
          id: 'e4e25',
          kind: 'choice',
          prompt: 'Which sentence uses the correct verb?',
          choices: [
            'My brother walks to school every day.',
            'My brother walk to school every day.',
            'My brother are walking to school every day.',
            'My brother walking to school every day.',
          ],
          key: 'My brother walks to school every day.',
          keyNote:
            'My brother walks to school every day. — one singular subject takes the -s form of ' +
            'the verb in the present tense. CE3-C: this item replaces a collective-noun item ' +
            '("The team is/are winning"), where both options are correct standard English — ' +
            'singular in American usage, plural in British — so the keyed answer scored the ' +
            'child\'s dialect rather than their grammar. The three distractors here are wrong in ' +
            'every dialect: "walk" is the plural form, "are" cannot follow a singular subject, ' +
            'and "walking" alone leaves the sentence without a finite verb.',
        },
        {
          id: 'e4e26',
          kind: 'choice',
          prompt: 'Which sentence is written correctly?',
          choices: [
            'My birthday is on June 4.',
            'My birthday is on June, 4.',
            'My birthday is, on June 4.',
            'My birthday is on June 4',
          ],
          key: 'My birthday is on June 4.',
          keyNote:
            'My birthday is on June 4. — no comma between month and day, and the sentence ends ' +
            'with a full stop. Capitalisation is not tested by choice items in this bank (the ' +
            'answer matcher is case-insensitive); it is judged in the writing rubric.',
        },
        {
          id: 'e4e27',
          kind: 'choice',
          prompt: 'Which one fixes this fragment?\n\nBecause the power went out.',
          choices: [
            'We ate dinner by candlelight because the power went out.',
            'Because the power went out!',
            'Because, the power went out.',
            'The power. Went out.',
          ],
          key: 'We ate dinner by candlelight because the power went out.',
          keyNote: 'We ate dinner by candlelight because the power went out.',
        },
        {
          id: 'e4e28',
          kind: 'choice',
          prompt: 'Choose the correct word:\n\nPlease put the boxes over ___.',
          choices: ['there', 'their', "they're", 'thier'],
          key: 'there',
          keyNote: 'there — the place.',
        },
        {
          id: 'e4e29',
          kind: 'choice',
          prompt: 'Which sentence punctuates the quotation correctly?',
          choices: [
            '"Wait for me," said Jonah.',
            '"Wait for me" said Jonah.',
            '"Wait for me". said Jonah.',
            'Wait for me, said Jonah.',
          ],
          key: '"Wait for me," said Jonah.',
          keyNote:
            '"Wait for me," said Jonah. — the comma goes inside the quotation marks and the tag ' +
            'follows.',
        },
        {
          id: 'e4e30',
          kind: 'choice',
          prompt: 'Which sentence correctly joins two complete ideas?',
          choices: [
            'The rain stopped, so we walked home.',
            'The rain stopped, we walked home.',
            'The rain stopped so, we walked home.',
            'The rain stopped we walked home.',
          ],
          key: 'The rain stopped, so we walked home.',
          keyNote: 'The rain stopped, so we walked home. Grade 5 signal.',
        },
        {
          id: 'e4e31',
          kind: 'longtext',
          prompt:
            'Write a paragraph of five or more sentences explaining how to do something you know ' +
            'how to do well. Include a topic sentence, at least three steps in order, and a ' +
            'closing sentence.',
          keyNote:
            'RUBRIC ITEM (0–4). Score against the Grade 4 explanatory rubric in the scoring guide: ' +
            'topic sentence, three ordered steps, closing, and sentence control. Spelling counts ' +
            'only where it blocks meaning.',
        },
        {
          id: 'e4e32',
          kind: 'longtext',
          prompt:
            'Should students be allowed to choose the books they read for school? Write four to ' +
            'six sentences that state your opinion, give two reasons, and answer one reason ' +
            'somebody might disagree with you.',
          keyNote:
            'RUBRIC ITEM (0–3). Grade 5 signal. Full marks require a stated opinion, two reasons, ' +
            'AND a response to a counter-reason. Score the structure, not the position taken.',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_ELA_G4_BLUEPRINT: Blueprint = {
  e4e01: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '3.RF.3a — common prefixes', weight: 1, mode: 'auto' },
  e4e02: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '3.L.1b — regular plural spelling changes', weight: 1, mode: 'auto' },
  e4e04: { tier: 'current', domain: 'Word analysis and decoding', standard: '4.RF.3a — roots within familiar words', weight: 1, mode: 'auto' },
  e4e07: { tier: 'stretch', domain: 'Word analysis and decoding', standard: '5.L.4b — Greek and Latin roots', weight: 1, mode: 'auto' },

  e4e03: { tier: 'foundation', domain: 'Vocabulary in context', standard: '3.L.4a — sentence context clues', weight: 1, mode: 'auto' },
  e4e05: { tier: 'current', domain: 'Vocabulary in context', standard: '4.L.4b — how an affix changes a word', weight: 1, mode: 'auto' },
  e4e06: { tier: 'current', domain: 'Vocabulary in context', standard: '4.L.5a — figurative language', weight: 1, mode: 'auto' },
  e4e11: { tier: 'current', domain: 'Vocabulary in context', standard: '4.RL.4 — word meaning in a story', weight: 1, mode: 'auto' },
  e4e19: { tier: 'current', domain: 'Vocabulary in context', standard: '4.RI.4 — domain vocabulary in context', weight: 1, mode: 'auto' },
  e4e08: { tier: 'stretch', domain: 'Vocabulary in context', standard: '5.L.5a — personification', weight: 1, mode: 'auto' },

  e4e09: { tier: 'current', domain: 'Reading accuracy (read-aloud)', standard: '4.RF.4b — read aloud accurately, untimed', weight: 1, mode: 'rubric', rubricPoints: 3 },

  e4e10: { tier: 'foundation', domain: 'Literal comprehension', standard: '3.RL.1 — refer explicitly to the text', weight: 1, mode: 'auto' },
  e4e17: { tier: 'foundation', domain: 'Literal comprehension', standard: '3.RI.1 — key details in a text', weight: 1, mode: 'auto' },
  e4e15: { tier: 'current', domain: 'Literal comprehension', standard: '4.RL.1 — details drawn from the text', weight: 1, mode: 'auto' },
  e4e18: { tier: 'current', domain: 'Literal comprehension', standard: '4.RI.1 — explicit information', weight: 1, mode: 'auto' },
  e4e23: { tier: 'current', domain: 'Literal comprehension', standard: '4.RI.1 — locate a specific quantity', weight: 1, mode: 'auto' },

  e4e12: { tier: 'current', domain: 'Inference', standard: '4.RL.1 — inference from the text', weight: 1, mode: 'auto' },
  e4e13: { tier: 'current', domain: 'Inference', standard: '4.RL.3 — describe a character’s change', weight: 1, mode: 'rubric', rubricPoints: 3 },
  e4e21: { tier: 'current', domain: 'Inference', standard: '4.RI.3 — explain a comparison in a text', weight: 1, mode: 'auto' },
  e4e16: { tier: 'stretch', domain: 'Inference', standard: '5.RL.1 — quote accurately when inferring', weight: 1, mode: 'rubric', rubricPoints: 3 },
  e4e24: { tier: 'stretch', domain: 'Inference', standard: '5.RI.1 — inference from a concluding passage', weight: 1, mode: 'auto' },

  e4e14: { tier: 'current', domain: 'Main idea and evidence', standard: '4.RL.2 — determine a theme', weight: 1, mode: 'auto' },
  e4e20: { tier: 'current', domain: 'Main idea and evidence', standard: '4.RI.2 — main idea with two details', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e4e22: { tier: 'current', domain: 'Main idea and evidence', standard: '4.RI.5 — text structure', weight: 1, mode: 'auto' },

  e4e25: { tier: 'foundation', domain: 'Grammar and conventions', standard: '3.L.1f — subject–verb agreement', weight: 1, mode: 'auto' },
  e4e26: { tier: 'foundation', domain: 'Grammar and conventions', standard: '3.L.2 — capitalisation and punctuation', weight: 1, mode: 'auto' },
  e4e27: { tier: 'current', domain: 'Grammar and conventions', standard: '4.L.1f — correct sentence fragments', weight: 1, mode: 'auto' },
  e4e28: { tier: 'current', domain: 'Grammar and conventions', standard: '4.L.1g — frequently confused words', weight: 1, mode: 'auto' },
  e4e29: { tier: 'current', domain: 'Grammar and conventions', standard: '4.L.2b — punctuate quotations', weight: 1, mode: 'auto' },
  e4e30: { tier: 'stretch', domain: 'Grammar and conventions', standard: '5.L.1a — join independent clauses', weight: 1, mode: 'auto' },

  e4e31: { tier: 'current', domain: 'Writing', standard: '4.W.2 — explanatory paragraph', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e4e32: { tier: 'stretch', domain: 'Writing', standard: '5.W.1 — opinion with a counter-reason', weight: 1, mode: 'rubric', rubricPoints: 3 },
}

export const ELE_ELA_G4_DOMAINS: readonly string[] = [
  'Word analysis and decoding',
  'Reading accuracy (read-aloud)',
  'Vocabulary in context',
  'Literal comprehension',
  'Inference',
  'Main idea and evidence',
  'Grammar and conventions',
  'Writing',
]

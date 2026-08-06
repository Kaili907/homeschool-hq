import type { FixedTest } from '../types'
import type { Blueprint } from './placementModel'

// CE3 — Grade 6 beginning-of-year reading/ELA placement.
//
// 32 items, four sections, roughly 50 minutes untimed. BOTH PASSAGES ARE
// ORIGINAL, written for this assessment. Tier meaning: foundation = Grade 5
// prerequisite · current = Grade 6 start · stretch = Grade 7 signal.
//
// Fluency is sampled as an UNTIMED, parent-observed read-aloud scored for
// accuracy only. No words-per-minute figure exists in this instrument.

const STORY_G6 = `Understudy

Nadia had been the understudy for eleven weeks, which meant she had learned every one of Beatrice's lines and had never once said them in front of an audience. She sat in the third row during performances with the script open in her lap, mouthing the words in the dark while somebody else got the laugh.

Her mother called this paying dues. Nadia called it watching.

On the Friday of the final weekend, Beatrice came down with something that turned her voice into a rasp, and the director found Nadia in the hallway forty minutes before curtain and said four words: "You're on. Get dressed."

What Nadia remembered afterward was not the applause, which she had imagined so many times that the real thing felt like a rerun. What she remembered was the second act, when she reached the line about her character's brother and heard the room go still — not politely quiet, but genuinely still, the way a room goes when everybody in it has stopped thinking about their own evening.

She had heard Beatrice deliver that line eleven weeks running. Beatrice had always gotten a laugh on it. Nadia had never understood why; she had read the line a hundred times in her bedroom and had never once found it funny.

Standing in the light, she finally understood that she had not been wrong. The line was not funny. Beatrice had simply decided that it was, and an audience will generally accept the decision an actor makes for them.

Afterward, in the hallway, Beatrice — hoarse, in a coat, having watched from the back — said, "You played it sad."

"Yes," Nadia said.

Beatrice nodded slowly, and did not say whether that had been the right choice, and Nadia understood that she was not going to.`

const ARTICLE_G6 = `The Cost of a Straight Line

When engineers plan a road between two towns, the straight line is almost never the answer. It looks cheapest on a map, because a map flattens everything that makes a road expensive.

Start with grade — the steepness a road climbs. Loaded trucks lose speed on grades above about six percent, and a road that forces trucks to crawl costs a region money every day it exists. Following a contour around a hill adds miles but keeps the grade gentle, and the added miles are usually cheaper than the added minutes.

Then there is what lies under the surface. A straight line may cross soft clay that will not hold pavement, or bedrock that must be blasted at enormous cost, or a wetland that federal law protects. Engineers drill test holes along several possible routes before committing, because a mile of unexpected rock can cost more than ten miles of ordinary grading.

Water matters more than most drivers realise. Every stream a road crosses needs a culvert or a bridge, and bridges are the most expensive structures on most highway projects. A route that crosses one river once may beat a shorter route that crosses the same meandering river four times.

Finally there are the people. A straight line drawn on a map runs through farms, churches, and houses whose owners did not volunteer. Buying that land — and, where owners refuse, taking it through legal proceedings — costs money and years. Routes are regularly bent around a single unwilling seller.

The result is that the road you drive is a record of arguments you never heard. Each curve is a decision somebody defended: a hill that was not worth cutting, a creek that was not worth bridging twice, a farmhouse that was not worth the lawsuit. Drivers experience the curve as an inconvenience. It is more accurate to read it as the cheapest answer to a question nobody asked out loud.`

export const ELE_ELA_G6: FixedTest = {
  id: 'ele-ela-g6',
  title: 'Grade 6 Reading and Writing — Beginning-of-Year Placement',
  forGrades: ['6'],
  intro:
    'This assessment is not graded and nothing from it reaches a report. Its job is to show ' +
    'where your reading and writing year should start. You will read a short story and an ' +
    'article, answer questions about both, and write twice. A few questions are Grade 5 review ' +
    'and a few are Grade 7 — nobody is expected to answer every one. If you do not know how to ' +
    'begin, press SKIP: a skip shows a real gap and a guess hides it. There is no timer.',
  sections: [
    {
      name: 'Section 1 — Word Study and Vocabulary',
      items: [
        {
          id: 'e6e01',
          kind: 'choice',
          prompt: 'The root "bio" in "biology" and "biography" means:',
          choices: ['life', 'earth', 'write', 'study'],
          key: 'life',
          keyNote: 'life.',
        },
        {
          id: 'e6e02',
          kind: 'choice',
          prompt: 'In "The evidence was compelling," the word "compelling" means:',
          choices: ['convincing', 'confusing', 'boring', 'incomplete'],
          key: 'convincing',
          keyNote: 'convincing.',
        },
        {
          id: 'e6e03',
          kind: 'choice',
          prompt: 'Which word is spelled correctly?',
          choices: ['definitely', 'definately', 'definetly', 'definitly'],
          key: 'definitely',
          keyNote: 'definitely.',
        },
        {
          id: 'e6e04',
          kind: 'choice',
          prompt: 'The prefix "inter-" in "interstate" and "international" means:',
          choices: ['between', 'under', 'against', 'before'],
          key: 'between',
          keyNote: 'between.',
        },
        {
          id: 'e6e05',
          kind: 'choice',
          prompt: '"He runs like a deer" is an example of:',
          choices: ['a simile', 'a metaphor', 'personification', 'alliteration'],
          key: 'a simile',
          keyNote: 'a simile — the comparison uses "like".',
        },
        {
          id: 'e6e06',
          kind: 'choice',
          prompt:
            'All four words describe somebody careful with money. Which one carries the most NEGATIVE feeling?',
          choices: ['stingy', 'thrifty', 'frugal', 'careful'],
          key: 'stingy',
          keyNote: 'stingy — tests connotation rather than dictionary meaning.',
        },
        {
          id: 'e6e07',
          kind: 'choice',
          prompt: 'The root "chron" in "chronological" and "synchronise" means:',
          choices: ['time', 'sound', 'light', 'place'],
          key: 'time',
          keyNote: 'time. Grade 7 signal.',
        },
      ],
    },
    {
      name: 'Section 2 — Reading Literature',
      passage: STORY_G6,
      items: [
        {
          id: 'e6e08',
          kind: 'longtext',
          prompt:
            'Before answering, read the first three paragraphs of the story above OUT LOUD, once, ' +
            'to a grown-up. Nothing is being timed and your speed is not being scored — read at a ' +
            'natural pace. When you have finished reading aloud, type DONE here and carry on.',
          keyNote:
            'RUBRIC ITEM (0–3), PARENT-OBSERVED, UNTIMED. Score ACCURACY ONLY against the ' +
            'read-aloud rubric in the scoring guide. Do not time the reading and do not record a ' +
            'words-per-minute figure.',
        },
        {
          id: 'e6e09',
          kind: 'choice',
          prompt: 'Why did Nadia finally perform?',
          choices: [
            'Beatrice lost her voice',
            'Nadia asked the director',
            'Beatrice quit the play',
            'The theatre added a show',
          ],
          key: 'Beatrice lost her voice',
          keyNote: 'Beatrice lost her voice.',
        },
        {
          id: 'e6e10',
          kind: 'choice',
          prompt: 'As Nadia’s mother uses it, "paying dues" means:',
          choices: [
            'earning a chance through unglamorous work',
            'paying money to join a group',
            'settling an old debt',
            'apologising for a mistake',
          ],
          key: 'earning a chance through unglamorous work',
          keyNote: 'earning a chance through unglamorous work.',
        },
        {
          id: 'e6e11',
          kind: 'choice',
          prompt: 'The applause "felt like a rerun" because Nadia had:',
          choices: [
            'imagined it so often that it seemed familiar',
            'already heard it earlier that night',
            'been bored by the play',
            'not wanted to perform',
          ],
          key: 'imagined it so often that it seemed familiar',
          keyNote: 'imagined it so often that it seemed familiar.',
        },
        {
          id: 'e6e12',
          kind: 'longtext',
          prompt:
            'State a theme of this story in one sentence. Then cite two details from the text that develop it.',
          keyNote:
            'RUBRIC ITEM (0–4). Accept any defensible theme (watching is not the same as doing; ' +
            'meaning is a choice the performer makes; recognition can arrive without approval). ' +
            'Full marks require a theme stated as an idea, not a plot summary, PLUS two accurate ' +
            'textual details.',
        },
        {
          id: 'e6e13',
          kind: 'choice',
          prompt: 'What does Nadia realise about the line in the second act?',
          choices: [
            'How it lands depends on the choice the actor makes',
            'It was written incorrectly',
            'Beatrice had been misreading it',
            'Audiences never laugh at it',
          ],
          key: 'How it lands depends on the choice the actor makes',
          keyNote: 'How it lands depends on the choice the actor makes.',
        },
        {
          id: 'e6e14',
          kind: 'longtext',
          prompt:
            'In the last paragraph, Beatrice does not say whether Nadia’s choice was the right ' +
            'one. What does the author suggest by ending the story this way?',
          keyNote:
            'RUBRIC ITEM (0–3). Full marks recognise the deliberate withholding — that Nadia is ' +
            'being left to judge her own work, or that there is no single right reading. A ' +
            'restatement of the plot with no interpretation scores 1.',
        },
        {
          id: 'e6e15',
          kind: 'choice',
          prompt: 'The eleven weeks Nadia spent watching function in the story mainly to:',
          choices: [
            'make her sudden understanding on stage meaningful',
            'explain why the play was popular',
            'show that the director was unfair',
            'describe what the theatre looked like',
          ],
          key: 'make her sudden understanding on stage meaningful',
          keyNote: 'make her sudden understanding on stage meaningful. Grade 7 signal.',
        },
      ],
    },
    {
      name: 'Section 3 — Reading Informational Text',
      passage: ARTICLE_G6,
      items: [
        {
          id: 'e6e16',
          kind: 'choice',
          prompt: 'According to the passage, what happens to loaded trucks on steep grades?',
          choices: ['They lose speed', 'They use less fuel', 'They stop safely', 'They travel faster'],
          key: 'They lose speed',
          keyNote: 'They lose speed.',
        },
        {
          id: 'e6e17',
          kind: 'choice',
          prompt: 'Why do engineers drill test holes along several possible routes?',
          choices: [
            'to learn what lies under the surface before committing',
            'to find water for the work crew',
            'to mark the route for drivers',
            'to measure the steepness',
          ],
          key: 'to learn what lies under the surface before committing',
          keyNote: 'to learn what lies under the surface before committing.',
        },
        {
          id: 'e6e18',
          kind: 'choice',
          prompt: 'In this passage, the word "grade" means:',
          choices: [
            'the steepness of a slope',
            'a score on schoolwork',
            'a rank or level',
            'the quality of the pavement',
          ],
          key: 'the steepness of a slope',
          keyNote: 'the steepness of a slope — the passage defines it directly.',
        },
        {
          id: 'e6e19',
          kind: 'longtext',
          prompt:
            'State the central idea of this passage in one sentence, then cite two details the ' +
            'author uses to develop it.',
          keyNote:
            'RUBRIC ITEM (0–4). Central idea: a road’s curves come from real costs — grade, ' +
            'ground, water and land ownership — that a map hides. Full marks require the idea ' +
            'plus two accurate supporting details.',
        },
        {
          id: 'e6e20',
          kind: 'choice',
          prompt: 'How does the author organise the body of the passage?',
          choices: [
            'by listing categories of cost one at a time',
            'in time order from oldest road to newest',
            'by comparing two specific highways',
            'as a step-by-step set of instructions',
          ],
          key: 'by listing categories of cost one at a time',
          keyNote: 'by listing categories of cost one at a time.',
        },
        {
          id: 'e6e21',
          kind: 'choice',
          prompt: 'In the final paragraph, the author’s view is that curves in a road are:',
          choices: [
            'reasonable results of decisions drivers never see',
            'mistakes made by careless engineers',
            'proof that roads should be built straighter',
            'unimportant details not worth studying',
          ],
          key: 'reasonable results of decisions drivers never see',
          keyNote: 'reasonable results of decisions drivers never see.',
        },
        {
          id: 'e6e22',
          kind: 'choice',
          prompt: 'Which of these is a CLAIM the author supports with reasons in the passage?',
          choices: [
            'Bridges are the most expensive structures on most highway projects.',
            'Driving is enjoyable.',
            'Maps are beautiful objects.',
            'Trucks should be banned from steep roads.',
          ],
          key: 'Bridges are the most expensive structures on most highway projects.',
          keyNote:
            'Bridges are the most expensive structures on most highway projects — the other three ' +
            'appear nowhere in the text.',
        },
        {
          id: 'e6e23',
          kind: 'longtext',
          prompt:
            'The author writes that a road is "a record of arguments you never heard." Explain ' +
            'what that means and how the rest of the passage supports it.',
          keyNote:
            'RUBRIC ITEM (0–3). Grade 7 signal. Full marks connect the metaphor to the specific ' +
            'trade-offs the passage lists — grade, rock, wetland, bridges, unwilling sellers — ' +
            'and recognise that each curve records a decision that was argued and settled.',
        },
      ],
    },
    {
      name: 'Section 4 — Writing and Conventions',
      items: [
        {
          id: 'e6e24',
          kind: 'choice',
          prompt: 'Which sentence uses the correct pronoun?',
          choices: [
            'Between you and me, the plan is risky.',
            'Between you and I, the plan is risky.',
            'Between yourself and I, the plan is risky.',
            'Between I and you, the plan is risky.',
          ],
          key: 'Between you and me, the plan is risky.',
          keyNote: 'Between you and me — object of a preposition.',
        },
        {
          id: 'e6e25',
          kind: 'choice',
          prompt: 'Which sentence is punctuated correctly?',
          choices: [
            'After the storm passed, we cleared the road.',
            'After the storm passed we cleared the road.',
            'After, the storm passed we cleared the road.',
            'After the storm, passed we cleared the road.',
          ],
          key: 'After the storm passed, we cleared the road.',
          keyNote: 'Comma after an introductory clause.',
        },
        {
          id: 'e6e26',
          kind: 'choice',
          prompt:
            'Which revision fixes the unclear pronoun?\n\nWhen Maya met Elena, she was nervous.',
          choices: [
            'When Maya met Elena, Maya was nervous.',
            'When Maya met Elena, she were nervous.',
            'When Maya met Elena; she was nervous.',
            'When Maya met Elena she was nervous.',
          ],
          key: 'When Maya met Elena, Maya was nervous.',
          keyNote: 'Naming the person removes the ambiguity about who "she" is.',
        },
        {
          id: 'e6e27',
          kind: 'choice',
          prompt: 'Which sentence sets off the extra information correctly?',
          choices: [
            'My oldest brother, who lives in Denver, is a nurse.',
            'My oldest brother who lives in Denver is a nurse.',
            'My oldest brother, who lives in Denver is a nurse.',
            'My oldest brother who lives in Denver, is a nurse.',
          ],
          key: 'My oldest brother, who lives in Denver, is a nurse.',
          keyNote: 'A non-essential clause takes a comma on both sides.',
        },
        {
          id: 'e6e28',
          kind: 'choice',
          prompt:
            'Which revision fixes the shift in verb tense?\n\nShe opened the door and sees the package.',
          choices: [
            'She opened the door and saw the package.',
            'She opens the door and saw the package.',
            'She open the door and sees the package.',
            'She opened the door and seeing the package.',
          ],
          key: 'She opened the door and saw the package.',
          keyNote: 'Both verbs in the past tense.',
        },
        {
          id: 'e6e29',
          kind: 'choice',
          prompt: 'Which sentence uses a semicolon correctly?',
          choices: [
            'The bus was late; we walked instead.',
            'The bus was late; and we walked instead.',
            'The bus was late, we walked instead.',
            'The bus; was late we walked instead.',
          ],
          key: 'The bus was late; we walked instead.',
          keyNote: 'A semicolon joins two independent clauses. Grade 7 signal.',
        },
        {
          id: 'e6e30',
          kind: 'longtext',
          prompt:
            'Write a paragraph of six or more sentences explaining how something you know well ' +
            'actually works. Include a clear topic sentence, at least three specific details, and ' +
            'a concluding sentence. Write in full sentences rather than a list.',
          keyNote:
            'RUBRIC ITEM (0–4). Score against the Grade 6 explanatory rubric in the scoring guide: ' +
            'topic sentence, three specific details, conclusion, and sentence control. Score the ' +
            'writing, not how impressive the topic is.',
        },
        {
          id: 'e6e31',
          kind: 'longtext',
          prompt:
            'Choose a rule at home or in a class that you think should change. In six to eight ' +
            'sentences, state your claim, give two reasons with support, and respond to one ' +
            'reason somebody might disagree.',
          keyNote:
            'RUBRIC ITEM (0–4). Score against the Grade 6 argument rubric: clear claim, two ' +
            'supported reasons, and a genuine response to a counter-reason. Score the reasoning, ' +
            'never whether the position is agreeable to the reader.',
        },
        {
          id: 'e6e32',
          kind: 'choice',
          prompt: 'Which sentence says the same thing most concisely?',
          choices: [
            'Because it rained, we left.',
            'Due to the fact that it rained, we left.',
            'In light of the rain that occurred, we left.',
            'Owing to the circumstance of rain, we left.',
          ],
          key: 'Because it rained, we left.',
          keyNote: 'Because it rained, we left. Grade 7 signal (conciseness).',
        },
      ],
    },
  ],
}

/** Answer authority + skill tags for every scored item. Weight is 1 throughout. */
export const ELE_ELA_G6_BLUEPRINT: Blueprint = {
  e6e03: { tier: 'foundation', domain: 'Word analysis and decoding', standard: '5.L.2e — spell correctly', weight: 1, mode: 'auto' },
  e6e04: { tier: 'current', domain: 'Word analysis and decoding', standard: '6.L.4b — common prefixes', weight: 1, mode: 'auto' },
  e6e07: { tier: 'stretch', domain: 'Word analysis and decoding', standard: '7.L.4b — Greek and Latin roots', weight: 1, mode: 'auto' },

  e6e01: { tier: 'foundation', domain: 'Vocabulary in context', standard: '5.L.4b — roots and affixes', weight: 1, mode: 'auto' },
  e6e02: { tier: 'foundation', domain: 'Vocabulary in context', standard: '5.L.4a — sentence context clues', weight: 1, mode: 'auto' },
  e6e05: { tier: 'current', domain: 'Vocabulary in context', standard: '6.L.5a — figures of speech', weight: 1, mode: 'auto' },
  e6e06: { tier: 'current', domain: 'Vocabulary in context', standard: '6.L.5c — connotation', weight: 1, mode: 'auto' },
  e6e10: { tier: 'current', domain: 'Vocabulary in context', standard: '6.RL.4 — figurative meaning in a story', weight: 1, mode: 'auto' },
  e6e18: { tier: 'current', domain: 'Vocabulary in context', standard: '6.RI.4 — technical meaning in a text', weight: 1, mode: 'auto' },

  e6e08: { tier: 'current', domain: 'Reading accuracy (read-aloud)', standard: '6.RF — read aloud accurately, untimed', weight: 1, mode: 'rubric', rubricPoints: 3 },

  e6e09: { tier: 'foundation', domain: 'Literal comprehension', standard: '5.RL.1 — explicit details', weight: 1, mode: 'auto' },
  e6e16: { tier: 'foundation', domain: 'Literal comprehension', standard: '5.RI.1 — explicit details', weight: 1, mode: 'auto' },
  e6e17: { tier: 'current', domain: 'Literal comprehension', standard: '6.RI.1 — cite explicit textual evidence', weight: 1, mode: 'auto' },

  e6e11: { tier: 'current', domain: 'Inference', standard: '6.RL.1 — inference supported by the text', weight: 1, mode: 'auto' },
  e6e13: { tier: 'current', domain: 'Inference', standard: '6.RL.3 — how a character responds and changes', weight: 1, mode: 'auto' },
  e6e14: { tier: 'current', domain: 'Inference', standard: '6.RL.6 — author’s choice and point of view', weight: 1, mode: 'rubric', rubricPoints: 3 },
  e6e21: { tier: 'current', domain: 'Inference', standard: '6.RI.6 — author’s point of view', weight: 1, mode: 'auto' },
  e6e23: { tier: 'stretch', domain: 'Inference', standard: '7.RI.1 — analyse figurative claim against evidence', weight: 1, mode: 'rubric', rubricPoints: 3 },

  e6e12: { tier: 'current', domain: 'Main idea and evidence', standard: '6.RL.2 — theme with supporting details', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e6e19: { tier: 'current', domain: 'Main idea and evidence', standard: '6.RI.2 — central idea with details', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e6e20: { tier: 'current', domain: 'Main idea and evidence', standard: '6.RI.5 — text structure', weight: 1, mode: 'auto' },
  e6e22: { tier: 'current', domain: 'Main idea and evidence', standard: '6.RI.8 — distinguish supported claims', weight: 1, mode: 'auto' },
  e6e15: { tier: 'stretch', domain: 'Main idea and evidence', standard: '7.RL.3 — how story elements interact', weight: 1, mode: 'auto' },

  e6e24: { tier: 'foundation', domain: 'Grammar and conventions', standard: '5.L.1 — pronoun case', weight: 1, mode: 'auto' },
  e6e25: { tier: 'foundation', domain: 'Grammar and conventions', standard: '5.L.2b — comma after an introductory element', weight: 1, mode: 'auto' },
  e6e26: { tier: 'current', domain: 'Grammar and conventions', standard: '6.L.1d — correct vague pronouns', weight: 1, mode: 'auto' },
  e6e27: { tier: 'current', domain: 'Grammar and conventions', standard: '6.L.2a — punctuate non-restrictive elements', weight: 1, mode: 'auto' },
  e6e28: { tier: 'current', domain: 'Grammar and conventions', standard: '6.L.1e — correct inappropriate tense shifts', weight: 1, mode: 'auto' },
  e6e29: { tier: 'stretch', domain: 'Grammar and conventions', standard: '7.L.2 — semicolons between clauses', weight: 1, mode: 'auto' },
  e6e32: { tier: 'stretch', domain: 'Grammar and conventions', standard: '7.L.3a — eliminate wordiness', weight: 1, mode: 'auto' },

  e6e30: { tier: 'current', domain: 'Writing', standard: '6.W.2 — explanatory paragraph', weight: 1, mode: 'rubric', rubricPoints: 4 },
  e6e31: { tier: 'current', domain: 'Writing', standard: '6.W.1 — argument with a counter-reason', weight: 1, mode: 'rubric', rubricPoints: 4 },
}

export const ELE_ELA_G6_DOMAINS: readonly string[] = [
  'Word analysis and decoding',
  'Reading accuracy (read-aloud)',
  'Vocabulary in context',
  'Literal comprehension',
  'Inference',
  'Main idea and evidence',
  'Grammar and conventions',
  'Writing',
]

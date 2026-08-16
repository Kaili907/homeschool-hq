import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `Public testimony to the City Planning Commission

Commissioners, the map before you labels the parcel at Fifth and Rowan as Lot 18-B. The children who cross it every morning call it the cut-through. The nursing-home residents call it the sunny bench. On summer evenings, the food-truck workers call it the place where the line can bend without blocking the sidewalk. One rectangle on a planning map already has at least three public lives.

The proposed storage building would create forty enclosed spaces. That is a measurable benefit, and I do not dismiss it. Small businesses have asked for affordable storage near downtown. The developer has also offered to repair the alley, install lighting, and contribute to the storm-drain fund.

But the staff report measures the lot mainly by what can be built on it. Its table counts square feet, tax value, vehicle trips, and runoff. It does not count the 126 pedestrians who crossed the parcel between seven and nine on the morning our neighborhood association observed it. It does not count the shade at the south wall, where the temperature was nine degrees cooler than the bus stop at three in the afternoon. It does not count the fact that a person using a walker can rest halfway between Rowan Apartments and the clinic.

What we count becomes what we can defend. What we fail to count becomes easy to call empty.

I am not asking you to preserve every informal use forever. I am asking for a decision that can see the current public value before replacing it. Require a thirty-day pedestrian study. Ask the developer to price a smaller building that preserves a marked walkway and the south-wall bench. Compare that design with the current proposal in public, using the same standards for access, cost, drainage, and safety.

If the full building remains the best choice after that review, the record will show what the city gained and what it knowingly gave up. If a revised design works, the city will have found capacity without erasing connection. Either outcome would be more responsible than treating “unbuilt” as a synonym for “unused.”

Lot 18-B is not empty. The question is whether our process is willing to notice what is already there.`

export const GRADE_11_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 11,
  canonicalLessonRef: 'ma-g11-english-language-arts-u07-l02',
  topic: 'How style and content create rhetorical power and persuasiveness',
  standards: ['11-12.RI.6', '11-12.RI.5', '11-12.SL.3', '11-12.SL.4', '11-12.SL.5', '11-12.SL.6', '11-12.RL.7'],
  textType: 'Original civic testimony',
  title: 'Rhetorical Power: Count What the Frame Excludes',
  welcome: 'Rhetorical analysis explains how a text’s content and style work together on a particular audience. You will analyze public testimony that reframes a planning decision without denying the opposing side’s evidence.',
  instruction: 'Avoid device spotting. Repetition, contrast, concession, syntax, and imagery matter because they shape an audience’s reasoning or attention in context. A strong analysis identifies the speaker’s purpose, examines a sequence or structure, and evaluates how specific choices advance—or limit—that purpose.',
  vocabulary: [
    { term: 'rhetoric', definition: 'the strategic use of language and structure to influence understanding or action' },
    { term: 'concession', definition: 'an acknowledgment that part of an opposing position has merit' },
    { term: 'reframe', definition: 'to change the terms through which an audience understands an issue' },
  ],
  model: 'Mini-speech: “We could call the delayed train an inconvenience. For the night nurse who misses the final transfer, delay becomes absence.”\nReasoning: The first sentence concedes the familiar frame. The second narrows to a concrete person and uses the parallel nouns delay and absence to raise the stakes.\nModel analysis: The speaker reframes reliability from comfort to access. By moving from the abstract “inconvenience” to a specific missed transfer, the contrast asks transit officials to evaluate consequences, not merely averages.',
  modelPrompt: 'Follow the model from rhetorical choice to audience effect to purpose.',
  passageTitle: 'What We Count',
  passage: PASSAGE,
  passageDirections: 'Read as a planning commissioner. Mark the opening series of community names, the concession to development benefits, the repeated “It does not count,” and the final return to “empty.”',
  guidedDirections: 'Identify the function of a rhetorical sequence, not merely its label.',
  guided: {
    type: 'CHOICE',
    prompt: 'What is the primary rhetorical effect of repeating “It does not count” in paragraph 3?',
    choices: [
      'It rejects all quantitative evidence as untrustworthy.',
      'It exposes a pattern of omitted public uses, preparing the claim that the official measurement frame is incomplete.',
      'It proves that the neighborhood association’s one morning of data is sufficient for a final decision.',
    ],
  },
  guidedFeedback: 'The second interpretation connects repetition, content, and argumentative structure. The speaker does not reject measurement; the testimony requests more of it. Nor does one observation settle the case. The repetition accumulates omissions so the audience is prepared to reconsider what “value” includes.',
  independentDirections: 'Write a sustained rhetorical analysis. Evaluate effectiveness in relation to the commission audience and the speaker’s request for further study.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'In 2–3 analytical paragraphs, explain how the testimony’s structure and at least two stylistic choices create persuasive power. Analyze how concession, repetition, contrast, syntax, or framing works with the evidence. Address one limitation of the testimony’s approach.',
  },
  processFeedback: 'Your analysis is pending human review. Audit each body paragraph: it should name a choice, quote or locate evidence, explain a plausible audience effect, and connect that effect to the purpose. A limitation should evaluate the text’s reach or evidence, not cancel the analysis with “some people may disagree.”',
  revisionDirections: 'Revise one analytical thread so that content, style, audience, and purpose remain connected from claim through evaluation.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised 2–3 paragraph rhetorical analysis with precise evidence, contextualized audience effects, and one specific limitation.',
  },
  rubricCriteria: ['defensible rhetorical thesis', 'analysis of structure and style', 'specific textual evidence', 'audience-and-purpose reasoning', 'evaluation of a limitation'],
  review: {
    learned: 'Rhetorical power emerges from the interaction of evidence, structure, diction, syntax, audience, and purpose—not from devices in isolation.',
    howYouDid: 'The repetition item returned targeted feedback. Your sustained analysis remains pending Parent Review because rhetorical evaluation involves defensible judgment.',
    didWell: 'You examined concession and reframing within a realistic civic decision and evaluated the testimony rather than simply praising it.',
    practice: 'Replace “This makes the audience think” with a qualified explanation of which audience, which pressure, and why the effect is plausible.',
    reviewLesson: 'The core chain is choice → effect in context → purpose → evaluation.',
    courseProgress: 'This isolated review sample does not alter Grade 11 course status. Reviewed analysis would provide pilot evidence for rhetorical reading, speaking, and writing standards.',
    nextAction: 'Request Parent Review, then reread the testimony from the developer’s perspective and test whether your effectiveness claim still holds.',
  },
  readability: {
    instructionLength: 'Brief disciplinary framing plus a commissioner-role close-reading protocol',
    sentenceComplexity: 'Sustained parallelism, periodic syntax, concessions, qualifications, and structural callbacks',
    vocabularyLoad: 'Three defined rhetorical concepts plus authentic planning language supported by context',
    passageLength: '373 words of formal civic testimony',
    expectedWrittenResponse: '2–3 analytical paragraphs with evaluation and a limitation',
    scaffolding: 'Audience role, rhetorical landmarks, effect-purpose model, paragraph audit; no device checklist answer',
  },
})

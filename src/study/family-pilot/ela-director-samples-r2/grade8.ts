import { buildElaDirectorSample } from './buildSample'

const PASSAGE = `Proposal: Reserve the East Courtyard for Quiet Study During Lunch

The student advisory council proposes reserving the east courtyard for quiet study during the forty-minute lunch period. The school currently offers the library, but its twenty-four seats are often filled by tutoring groups. The east courtyard has twelve tables and can seat about forty-eight students. A two-week head count found an average of thirty-one students looking for quiet seating after the library filled.

The proposal would not require silence. Students could speak at a low volume, work together, or eat lunch. Music without headphones, amplified videos, and running games would move to the larger west courtyard. Clear signs would describe the expectations, and the plan would run for a four-week trial before any permanent decision.

Counterclaim from the Activities Committee

Lunch is one of the few unstructured parts of the day. Reserving a courtyard for quiet study could divide students by activity and make ordinary conversation feel like a rule violation. The head count also took place during project week, when more students than usual may have needed workspace. Before changing the courtyard, the school should add temporary library tables and repeat the count during a typical month.

Response from the Student Advisory Council

The concern about unstructured time is reasonable, which is why the proposal keeps the larger west courtyard open for games, music, and conversation. The four-week trial also avoids treating one head count as final proof. However, temporary library tables do not address tutoring noise or the library’s safety limit. During the trial, the council could collect weekly use counts and anonymous student feedback, then recommend ending, revising, or continuing the plan.`

export const GRADE_8_ELA_DIRECTOR_SAMPLE = buildElaDirectorSample({
  grade: 8,
  canonicalLessonRef: 'ma-g8-english-language-arts-u05-l04',
  topic: 'Counterclaim and rebuttal in civic argument',
  standards: ['8.RI.8', '8.RI.9', '8.W.1', '8.SL.3', '8.SL.4'],
  textType: 'Paired proposal, counterclaim, and response',
  title: 'Answer the Strongest Objection',
  welcome: 'A serious argument does not hide the best objection. In this lesson, you will evaluate a school proposal, identify a fair counterclaim, and write a rebuttal that responds with evidence and limits.',
  instruction: 'A counterclaim is a reasonable position that challenges a claim. A rebuttal answers that challenge; it may refute it, qualify the original claim, or revise the proposal. “I disagree” is not a rebuttal. A strong rebuttal represents the objection fairly and explains why the claim still holds or how it should change.',
  vocabulary: [
    { term: 'counterclaim', definition: 'a reasonable opposing claim that an argument must consider' },
    { term: 'rebuttal', definition: 'a reasoned response to a counterclaim' },
    { term: 'qualify', definition: 'to limit or adjust a claim so it matches the evidence' },
  ],
  model: 'Mini-argument: Claim—The town should extend Saturday bus service because 120 riders were turned away last month. Counterclaim—The count came from a festival weekend, so it may not represent ordinary demand.\nReasoning: Calling the objection “wrong” would ignore a real sampling limit. A stronger response narrows the claim and proposes better evidence.\nModel rebuttal: The festival may have raised demand, so one month cannot justify a permanent schedule. A three-Saturday trial with separate festival and nonfestival counts would test whether added service is useful.',
  modelPrompt: 'Trace how the model concedes a limit, revises the claim, and proposes relevant evidence.',
  passageTitle: 'Two Courtyards, Two Purposes?',
  passage: PASSAGE,
  passageDirections: 'Read all three labeled parts. Mark the proposal’s evidence, the Activities Committee’s strongest concern, and each place the response directly addresses that concern.',
  guidedDirections: 'Choose the response that engages the counterclaim instead of dismissing or avoiding it.',
  guided: {
    type: 'CHOICE',
    prompt: 'Which sentence is the strongest rebuttal to the concern that the head count occurred during project week?',
    choices: [
      'Project week is busy, but students should still support the council.',
      'Because project week may have raised demand, the school should gather weekly counts during a limited trial before making the plan permanent.',
      'The east courtyard has twelve tables, so the timing of the count does not matter.',
    ],
  },
  guidedFeedback: 'The second response directly concedes the sampling limit and explains how a trial would gather stronger evidence. The first substitutes popularity for reasoning. The third cites a true detail but does not answer whether demand was typical.',
  independentDirections: 'Choose a position: support the proposal, oppose it, or support a revision. Address the strongest counterclaim fairly.',
  independent: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Write an 8–10 sentence argument about the courtyard proposal. Include a precise claim, two details from the text, one fairly stated counterclaim, and a rebuttal that answers the counterclaim rather than repeating your claim.',
  },
  processFeedback: 'Your argument is saved for Parent Review. Test the rebuttal with two questions: Would a person who holds the opposing view recognize their concern? Does your next sentence answer that concern with reasoning or evidence? If either answer is no, revise before submitting again.',
  revisionDirections: 'Revise the claim-counterclaim relationship. You may change your position if the evidence now supports a different conclusion.',
  revision: {
    type: 'CONSTRUCTED_RESPONSE',
    prompt: 'Submit a revised 8–10 sentence argument. Make the counterclaim accurate, the rebuttal direct, and any limitation or proposed trial explicit.',
  },
  rubricCriteria: ['precise claim', 'relevant evidence', 'fair counterclaim', 'direct and reasoned rebuttal', 'coherent organization'],
  review: {
    learned: 'Counterclaims strengthen an argument when the writer represents them fairly and responds with evidence, reasoning, or a warranted revision.',
    howYouDid: 'The rebuttal check produced immediate instructional feedback. Your full argument is pending Parent Review rather than a deterministic essay score.',
    didWell: 'You worked with evidence limits and had permission to support, oppose, or revise the proposal.',
    practice: 'Avoid answering a counterclaim with a nearby fact. Name the exact concern, then show how the evidence changes its force.',
    reviewLesson: 'Use this sequence: claim → evidence → fair counterclaim → direct rebuttal → qualified conclusion.',
    courseProgress: 'This sample remains outside the production course. In the pilot model, reviewed argument evidence would support Grade 8 writing and civic reasoning progress.',
    nextAction: 'Request Parent Review, then read your rebuttal alone and check whether its target is unmistakable.',
  },
  readability: {
    instructionLength: 'Two mature but scannable paragraphs with labeled argument parts',
    sentenceComplexity: 'Compound-complex reasoning, concessions, conditions, and cause-effect links',
    vocabularyLoad: 'Three defined argument terms used in authentic civic context',
    passageLength: '275 words across three clearly labeled positions',
    expectedWrittenResponse: '8–10 sentence argument with counterclaim and rebuttal',
    scaffolding: 'Argument-part labels, concession model, one rebuttal diagnostic, two-question revision test',
  },
})

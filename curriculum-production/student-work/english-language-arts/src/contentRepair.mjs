import { createHash } from 'node:crypto'

const GRADE_PROFILES = Object.freeze({
  3: { label: 'Grade 3', evidence: 'one exact detail', shortLength: '3–5 complete sentences', extendedLength: 'one organized paragraph', paragraphs: 4 },
  4: { label: 'Grade 4', evidence: 'two exact details', shortLength: 'one organized paragraph', extendedLength: 'two connected paragraphs', paragraphs: 4 },
  5: { label: 'Grade 5', evidence: 'two quoted or paraphrased details with paragraph numbers', shortLength: 'one developed paragraph', extendedLength: 'two or three organized paragraphs', paragraphs: 5 },
  7: { label: 'Grade 7', evidence: 'two well-chosen details with paragraph numbers', shortLength: 'two connected paragraphs', extendedLength: 'three or four developed paragraphs', paragraphs: 5 },
  8: { label: 'Grade 8', evidence: 'the strongest two details with paragraph numbers', shortLength: 'two analytical paragraphs', extendedLength: 'four developed paragraphs', paragraphs: 5 },
  9: { label: 'English 9', evidence: 'two precise quotations or paraphrases with paragraph numbers', shortLength: 'a claim-and-evidence response of 250–350 words', extendedLength: 'a structured response of 500–700 words', paragraphs: 6 },
  10: { label: 'English 10', evidence: 'three precise quotations or paraphrases with paragraph numbers', shortLength: 'an analytical response of 300–450 words', extendedLength: 'a structured response of 650–900 words', paragraphs: 6 },
  11: { label: 'English 11', evidence: 'three precise citations, including one detail that complicates the claim', shortLength: 'a qualified analysis of 400–550 words', extendedLength: 'a sustained response of 800–1,100 words', paragraphs: 7 },
  12: { label: 'English 12', evidence: 'three precise citations, a limitation, and a defensible qualification', shortLength: 'a sustained analysis of 500–700 words', extendedLength: 'an independent response of 1,000–1,400 words', paragraphs: 7 },
})

const SETTINGS = [
  'neighborhood library',
  'community garden',
  'school newspaper room',
  'local history archive',
  'riverside walking path',
  'youth council meeting',
  'small theater workshop',
  'public radio studio',
  'museum reading room',
  'end-of-year exhibition',
]

const NAMES = ['Amara', 'Jonah', 'Leena', 'Mateo', 'Nia', 'Owen', 'Priya', 'Samir', 'Tessa', 'Xavier']
const ARTIFACTS = [
  'a handwritten notice beside a typed revision',
  'two witness notes about the same event',
  'a draft whose final paragraph changes its purpose',
  'a chart paired with a short editorial',
  'a scene told once by a participant and once by an observer',
  'a proposal with a margin full of questions',
  'a poem beside the prose paragraph that inspired it',
  'three source cards that disagree about one detail',
  'an early draft beside the writer\'s published version',
  'a portfolio note written before the evidence was gathered',
]

const PHASE_TASKS = [
  {
    question: ({ focus }) => `What does this reading show that you already understand about ${focus}, and what is one question you still need to investigate?`,
    product: 'a baseline note with one supported observation and one genuine question',
  },
  {
    question: ({ focus }) => `Choose two words or sentence parts in the reading that matter to ${focus}. How does each part shape meaning?`,
    product: 'a two-entry word-and-meaning annotation',
  },
  {
    question: ({ focus }) => `Trace how one example in the reading demonstrates ${focus}. Which step in the example does the most work?`,
    product: 'a labeled explanation of the example and its most important step',
  },
  {
    question: ({ focus }) => `Apply ${focus} to paragraph 2, then check your decision against paragraph 4. What survives the check?`,
    product: 'a checked application with an initial decision, evidence, and a revision if needed',
  },
  {
    question: ({ focus }) => `Compare the two perspectives or versions in the reading. Which contrast best clarifies ${focus}, and why?`,
    product: 'a comparison organized around one meaningful contrast',
  },
  {
    question: ({ focus }) => `Independently annotate the reading for ${focus}. Which annotation leads to the strongest inference?`,
    product: 'an annotated reading plus a supported inference',
  },
  {
    question: ({ focus }) => `Read the source without interruption, then decide which detail most changes an interpretation of ${focus}. Explain the change.`,
    product: 'an evidence log and a short interpretation',
  },
  {
    question: ({ focus }) => `Identify one earlier misunderstanding about ${focus}. Use this reading to correct it and explain why the correction is stronger.`,
    product: 'a before-and-after correction supported by the source',
  },
  {
    question: ({ focus }) => `How does the writer's structure, point of view, or word choice develop ${focus} across the reading?`,
    product: 'a craft analysis that connects a deliberate choice to its effect',
  },
  {
    question: ({ focus }) => `What is the most defensible claim about ${focus} that a careful reader could debate after reading this source?`,
    product: 'a discussion brief with a claim, evidence, and a fair response to another view',
  },
  {
    question: ({ focus }) => `Plan a response about ${focus}. Which claim, evidence sequence, and ending will make the plan coherent?`,
    product: 'a complete writing plan naming the claim or controlling idea, evidence order, and ending move',
  },
  {
    question: ({ focus }) => `Draft the planned response about ${focus}. How will each paragraph use the reading rather than merely mention it?`,
    product: 'a complete first draft with source-based development in every body section',
  },
  {
    question: ({ focus }) => `Revisit your work on ${focus}. Which revision improves meaning, organization, or evidence most, and why?`,
    product: 'a revised passage plus a revision note that identifies the change and its effect',
  },
  {
    question: ({ focus }) => `Transfer ${focus} to a different paragraph or perspective in the reading. What had to change in your approach?`,
    product: 'a transfer response and a precise explanation of the adjustment',
  },
  {
    question: ({ focus }) => `Audit your readiness on ${focus}. Which criterion is secure, which needs practice, and what source-based practice will close the gap?`,
    product: 'a readiness audit with one completed practice item drawn from the reading',
  },
  {
    question: ({ focus }) => `Using only the delivered reading, make and defend your strongest independent claim about ${focus}.`,
    product: 'an independent assessment response with a claim, cited evidence, reasoning, and a final check',
  },
  {
    question: ({ focus }) => `Classify one weakness in your assessment work on ${focus}, correct it with fresh evidence, and explain why the correction works.`,
    product: 'an error analysis and a corrected response',
  },
  {
    question: ({ focus }) => `Prepare your strongest work on ${focus} for an audience. What did you change, and what evidence shows that the final version is stronger?`,
    product: 'a publication-ready piece and a brief evidence-based reflection',
  },
]

function words(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function cleanPhrase(value) {
  return String(value ?? '').trim().replace(/[.?!]+$/, '')
}

function readingKind(unitTitle) {
  if (/grammar|language|word|sentence|style|convention/i.test(unitTitle)) return 'editorial case'
  if (/argument|claim|rhetoric|civic|advocacy/i.test(unitTitle)) return 'argument case'
  if (/research|source|information|main idea|explanatory|synthesis/i.test(unitTitle)) return 'information case'
  if (/publication|portfolio|capstone|communication|community/i.test(unitTitle)) return 'reflection case'
  return 'literary case'
}

function addRigorParagraphs(paragraphs, profile, focus) {
  if (profile.paragraphs >= 5) {
    paragraphs.push(`[5] Before revising, the group tested the source against the workshop goal: ${focus}. They highlighted language that supported the goal, circled a detail that complicated it, and drew an arrow where the relationship between two ideas needed to be made explicit. The marks produced different possible readings, so the group had to defend priorities rather than copy a single approved answer.`)
  }
  if (profile.paragraphs >= 6) {
    paragraphs.push(`[6] A later reader complicated the discussion by asking about audience and purpose. A concise public notice, a literary interpretation, and a research explanation may use evidence differently even when all three are responsible. The group therefore recorded not only what the source said, but also what situation would make each interpretation effective, insufficient, or misleading.`)
  }
  if (profile.paragraphs >= 7) {
    paragraphs.push(`[7] The final memo resisted a simple verdict. It argued that judgment depends on criteria that can be named and evidence that can be inspected. It also acknowledged a limitation: the group had one short case and no information about how other audiences would respond. Any larger claim would require additional texts, readers, or methods.`)
  }
  return paragraphs
}

function literaryParagraphs({ unit, setting, name, partner, artifact, focus }) {
  return [
    `[1] At the ${setting}, ${name} opened a folder containing ${artifact}. A note on the cover read “${unit},” but the pages inside told one unfinished story. ${name} expected the ending to explain everything. Instead, the first scene offered only a quiet choice: return a borrowed object without comment or admit why it had been kept.`,
    `[2] The main character rehearsed an apology three times. In the first version, every sentence began with “I.” In the second, the character blamed the confusing rules. In the third, the character named the harm, returned the object, and then stopped talking. The narrator never announced which version was sincere.`,
    `[3] ${partner} noticed that a repeated image—a door left slightly open—appeared before each rehearsal. At first it seemed like background description. By its third appearance, the image could suggest an invitation, an escape, or an unfinished decision. The story gave enough detail to support more than one interpretation but not enough to make every interpretation equally strong.`,
    `[4] The final scene ended before the apology was delivered. ${name} argued that the missing speech made the character seem afraid; ${partner} thought the pause showed care. To connect the scene to ${focus}, each reader had to identify exact language, explain an inference, and account for the detail that made the other reading possible.`,
  ]
}

function informationParagraphs({ unit, setting, name, partner, artifact, focus }) {
  return [
    `[1] During the “${unit}” inquiry at the ${setting}, ${name} found ${artifact}. The documents described a four-week trial in which a reading room stayed open one hour later on Tuesdays. Attendance rose from 18 visits in week one to 31 in week four, but the records did not show whether the same people returned or new people arrived.`,
    `[2] One summary called the trial “a clear success.” It cited the increase in visits and three positive comments. A second summary was more cautious. It noted that a nearby program had closed during weeks three and four, possibly sending visitors to the reading room. It also observed that no comparison was made with other weekdays.`,
    `[3] ${partner} checked the original log and found a useful detail: most late visits lasted fewer than fifteen minutes. That fact could mean visitors only needed a quick pickup, or it could mean the room did not support longer work. The log recorded duration but not purpose, so either explanation required a qualification.`,
    `[4] The inquiry team used ${focus} to decide what the evidence established and what it did not. They could describe the attendance pattern precisely. They could not yet prove why it happened or whether the change should become permanent. Their next question therefore mattered as much as their current conclusion.`,
  ]
}

function argumentParagraphs({ unit, setting, name, partner, artifact, focus }) {
  return [
    `[1] During the “${unit}” meeting at the ${setting}, ${name} reviewed ${artifact}. The proposal asked the community to reserve one quiet hour each afternoon for reading and study. Supporters said a predictable quiet period would help people who lacked calm work space elsewhere.`,
    `[2] The proposal included a one-week survey: 42 of 60 respondents supported the idea, 11 opposed it, and 7 were unsure. ${partner} pointed out that the survey had been offered only to afternoon visitors. The numbers represented those visitors accurately, but they could not automatically represent everyone who used the building.`,
    `[3] An opposing note raised a practical concern. Families with young children often arrived during the proposed hour, and silence might make them feel unwelcome. A revision suggested a quiet room rather than a quiet building. That alternative preserved the goal while changing the cost, though it required staff and available space.`,
    `[4] The group evaluated ${focus} by testing the claim against evidence, counterevidence, and consequences. A strong response could favor, oppose, or revise the proposal. It could not ignore the survey's limits or treat a concern as answered merely because the concern was inconvenient.`,
  ]
}

function editorialParagraphs({ unit, setting, name, partner, artifact, focus }) {
  return [
    `[1] In the “${unit}” workshop at the ${setting}, ${name} compared ${artifact}. The early version said, “The committee quickly approved the surprisingly modest plan.” The revision said, “After twelve minutes of questions, the committee approved the plan by a four-to-three vote.”`,
    `[2] The first sentence was shorter, but its adverbs quietly told the reader how to judge speed and scale. The second replaced those judgments with measurable details. It sounded less certain about what counted as quick or modest, yet it gave the reader more material for an independent conclusion.`,
    `[3] ${partner} then changed the verb “approved” to “accepted.” The facts did not change, but the tone did. “Approved” suggested endorsement; “accepted” could suggest reluctant agreement. Neither verb was always correct. The surrounding purpose and evidence had to decide which shade of meaning fit.`,
    `[4] To study ${focus}, the workshop tracked how syntax, punctuation, and word choice accumulated across the passage. One change altered emphasis; several coordinated changes altered the writer's stance. The strongest edit was not automatically the most formal one, but the one whose effect matched a clearly named purpose.`,
  ]
}

function reflectionParagraphs({ unit, setting, name, partner, artifact, focus }) {
  return [
    `[1] Near the end of the “${unit}” workshop at the ${setting}, ${name} reviewed ${artifact}. The first portfolio note claimed, “My final piece is better because I worked harder.” The claim may have been sincere, but it gave a reader no visible way to inspect the growth.`,
    `[2] ${partner} suggested comparing one paragraph from each version. The early paragraph listed three facts without showing their relationship. The later paragraph grouped two facts as evidence, explained the connection, and set aside the third because it did not support the controlling idea. The change was specific enough to discuss.`,
    `[3] A second comparison revealed a tradeoff. The later opening was clearer, but it had lost an image that gave the earlier draft energy. Rather than calling every revision an improvement, ${name} restored the image in a new position and recorded why clarity and voice both mattered for the intended audience.`,
    `[4] The reflection used ${focus} to turn a vague statement of pride into an evidence-based account. It named a change, located proof in the work, and explained the decision behind it. It also named a next step, because publication marked the best current version rather than the end of learning.`,
  ]
}

function generatedParagraphs(ir) {
  const profile = GRADE_PROFILES[ir.grade]
  const unitIndex = Math.max(0, (ir.unitNumber || 1) - 1) % SETTINGS.length
  const dayIndex = Math.max(0, (ir.dayInUnit || 1) - 1)
  const setting = SETTINGS[unitIndex]
  const name = NAMES[(unitIndex + dayIndex + ir.grade) % NAMES.length]
  const partner = NAMES[(unitIndex + dayIndex + ir.grade + 3) % NAMES.length]
  const artifact = ARTIFACTS[(unitIndex + dayIndex) % ARTIFACTS.length]
  const focus = cleanPhrase(ir.focus)
  const unit = cleanPhrase(ir.unitTitle)
  const kind = readingKind(unit)
  const context = { unit, setting, name, partner, artifact, focus }
  const builders = {
    'literary case': literaryParagraphs,
    'information case': informationParagraphs,
    'argument case': argumentParagraphs,
    'editorial case': editorialParagraphs,
    'reflection case': reflectionParagraphs,
  }
  return addRigorParagraphs(builders[kind](context), profile, focus)
}

export function buildDeliveredReading(ir) {
  const bankText = ir.embeddedOriginalText?.text?.trim()
  const usesBankText = Boolean(bankText && words(bankText).length >= 80)
  const text = usesBankText ? bankText : generatedParagraphs(ir).join('\n\n')
  const textId = usesBankText
    ? ir.embeddedOriginalText.textId
    : `ma-original-${ir.lessonId}`
  const title = usesBankText
    ? ir.embeddedOriginalText.title
    : `Reading Lab ${ir.courseDay}: ${ir.focus}`
  return {
    textId,
    title,
    author: 'Manuel Academy',
    form: usesBankText ? ir.embeddedOriginalText.form : readingKind(ir.unitTitle),
    rightsCategory: 'original',
    deliveryMode: 'inline_full_text',
    learnerAvailable: true,
    fullTextIncluded: true,
    origin: usesBankText ? 'academy_original_bank' : 'academy_original_generated',
    rightsStatement: 'Original Manuel Academy instructional text. Included in full for enrolled learner course use.',
    text,
    wordCount: words(text).length,
    sha256: sha256(text),
  }
}

function phaseTask(ir) {
  const phase = ir.phase || ''
  let index = Math.max(0, Math.min(PHASE_TASKS.length - 1, (ir.dayInUnit || 1) - 1))
  if (/launch/i.test(phase)) index = 0
  else if (/word|vocabulary|fluency/i.test(phase)) index = 1
  else if (/explicit model a|concept model a/i.test(phase)) index = 2
  else if (/guided practice a/i.test(phase)) index = 3
  else if (/explicit model b|concept model b/i.test(phase)) index = 4
  else if (/independent application/i.test(phase)) index = 5
  else if (/investigation|shared close reading|close reading with evidence/i.test(phase)) index = 6
  else if (/reteach/i.test(phase)) index = 7
  else if (/craft|concept model c|source or research/i.test(phase)) index = 8
  else if (/discussion|seminar|talk and listening/i.test(phase)) index = 9
  else if (/planning/i.test(phase)) index = 10
  else if (/build|plan and draft/i.test(phase)) index = 11
  else if (/revision|revise and edit/i.test(phase)) index = 12
  else if (/transfer|consolidation/i.test(phase)) index = 13
  else if (/preparation|retrieval/i.test(phase)) index = 14
  else if (/unit assessment/i.test(phase)) index = 15
  else if (/correction/i.test(phase)) index = 16
  else if (/publication|presentation|reflection/i.test(phase)) index = 17
  return PHASE_TASKS[index]
}

function writingRequired(ir) {
  return /writing|performance task|planning|build|draft|revision|publication|assessment|correction|reflection/i.test(ir.phase)
}

export function buildLearnerWork(ir, reading) {
  const profile = GRADE_PROFILES[ir.grade]
  const task = phaseTask(ir)
  const question = task.question(ir)
  const requiredWriting = writingRequired(ir)
  const responseLength = requiredWriting ? profile.extendedLength : profile.shortLength
  const deliverable = `${profile.label}: ${task.product}; write ${responseLength}.`
  const successCriteria = [
    `I directly answer the question about ${cleanPhrase(ir.focus)} and complete the named deliverable.`,
    `I use ${profile.evidence} from “${reading.title}” and identify where the evidence appears.`,
    `I explain how the evidence supports my thinking, then check clarity, accuracy, and completion before submitting.`,
  ]
  if (ir.grade >= 8) {
    successCriteria.push('I address a meaningful complication, alternative interpretation, counterclaim, or limitation when the evidence calls for one.')
  }
  if (ir.grade >= 11) {
    successCriteria.push('I qualify the conclusion so it does not claim more certainty or scope than the delivered source can support.')
  }

  const taskSteps = [
    `Read “${reading.title}” in full and mark evidence connected to ${cleanPhrase(ir.focus)}.`,
    `Answer the lesson question using ${profile.evidence}; distinguish source evidence from your own inference.`,
    'Complete the named deliverable and use every success criterion for a final self-check.',
  ]

  return {
    instruction: `This ${profile.label} lesson develops ${cleanPhrase(ir.focus)} within the unit “${cleanPhrase(ir.unitTitle)}.” Read the delivered Academy-original source before responding. Strong ELA work separates what the source explicitly says from what a reader infers, selects evidence because it is relevant and sufficient, and explains the connection instead of leaving a quotation to speak for itself. Today's ${ir.phase.toLowerCase()} work asks you to make that reasoning visible and to revise if the evidence does not support the first idea.`,
    question,
    deliverable,
    successCriteria,
    taskSteps,
    writingRequired: requiredWriting,
    independentText: `Read “${reading.title},” then answer: ${question}\n\nDeliverable: ${deliverable}\n\nEvidence requirement: Use ${profile.evidence}. Label source evidence with a paragraph number or another precise location. Your response must explain the connection between the evidence and your conclusion.`,
  }
}

export function isActionlessTask(text) {
  const value = String(text ?? '').trim()
  return !value ||
    /completes a new application of today's lesson/i.test(value) ||
    /complete the unit assessment evidence for today's lesson independently/i.test(value) ||
    !/(answer|analy[sz]e|annotate|compare|explain|identify|trace|revise|draft|read|classify|prepare|defend|audit)/i.test(value)
}

export function hasPlaceholder(text) {
  return /\b(?:TBD|TBC|TODO|FIXME|lorem ipsum)\b|\[\s*placeholder\s*\]|delivered separately by your facilitator|choose a grade-appropriate text|does not ship a fixed anchor text/i.test(String(text ?? ''))
}

export function learnerPackageAdultLeak(pkg) {
  const forbiddenKeys = /^(?:scoringAuthority|rubric|acceptableAnswerCriteria|masteryCriteria|doNotUse|answerKey|correctAnswer|modelAnswer)$/i
  let leak = false
  const walk = (value) => {
    if (leak || value == null) return
    if (Array.isArray(value)) return value.forEach(walk)
    if (typeof value !== 'object') return
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) leak = true
      walk(child)
    }
  }
  walk(pkg)
  return leak
}

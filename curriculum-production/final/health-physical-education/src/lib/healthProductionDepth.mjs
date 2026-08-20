/**
 * Deterministic Health Production Depth R1 authoring projection.
 *
 * The upstream courses define the canonical focus, objectives, standards, and
 * topic facts. This layer turns that authoring into a complete learner
 * teaching sequence and paired protected adult authority. It is Health-only;
 * PE and unit assessments do not call this module.
 */

export const HEALTH_PRODUCTION_DEPTH_VERSION = 'health-production-depth-r1'

export const HEALTH_LESSON_TYPES = [
  'CONCEPT_VOCABULARY',
  'INFORMATION_EVALUATION',
  'DECISION_REASONING',
  'COMMUNICATION_HELP_SEEKING',
  'HEALTH_SKILL_PROCEDURE',
  'REVIEW_RETRIEVAL',
  'REMEDIATION_RETRY',
  'MASTERY_EVIDENCE',
  'PROJECT_CAPSTONE',
]

const INFORMATION_PATTERN = /source|information|claim|media|marketing|study|evidence|campaign|advertis|algorithm|influencer|supplement|product|myth|website|label|citation|data|message framing/i
const COMMUNICATION_PATTERN = /consent|boundar|permission|coerc|relationship|communicat|refusal|conflict|bully|harass|hazing|peer|de-escalat|help-seeking|trusted support|supporting|reporting|self-advocacy|advocating/i
const PROCEDURE_PATTERN = /handwash|hygiene|dental|oral health|skin care|first.response|first aid|cpr|aed|choking|bleeding|emergency action|poison|medication safety|medicine safety|safety systems|emergency communication/i
const DECISION_PATTERN = /decision|risk|emergency|crisis|overdose|impaired|medicine|medication|drug|substance|nicotine|alcohol|cannabis|opioid|fentanyl|naloxone|care|service|provider|coverage|insurance|cost|bill|denial|record|portal|screening|appointment|support route|warning sign|hazard|response/i

const HEALTH_NEVER_REQUIRES = [
  'This task never requires body weight, height, BMI, body-fat percentage, body comparison, or appearance scoring.',
  'This task never requires calorie counting, dieting, or a diet or weight-loss goal.',
  'This task never requires sharing medical history, a diagnosis, treatment, medication, feelings, family conflict, or sexual history.',
  'This task never requires a photograph, video, or voice recording of the learner as proof.',
  'This task never requires a public performance or an audience.',
  'This task never requires advice about an individual learner\'s treatment, medication, food, supplement, or exercise plan.',
]

const SAFETY_NOTES = [
  'Use respectful, neutral, non-shaming language.',
  'Required evidence uses fictional or public situations and never requires sensitive personal disclosure.',
  'Do not infer health, feelings, diagnosis, motives, effort, character, or family circumstances from a response.',
  'Do not use dieting, calorie-target, weight-loss, body-value, appearance, or body-scoring language.',
  'Do not provide individualized treatment, medication, food, supplement, or exercise advice.',
  'Direct real health or safety concerns to a trusted adult or qualified professional; use emergency services for an emergency.',
]

function gradeBand(grade) {
  if (grade <= 5) return 'GRADES_3_5'
  if (grade <= 8) return 'GRADES_7_8'
  return 'GRADES_9_12'
}

function compact(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

function unique(values) {
  return [...new Set(values.map(compact).filter(Boolean))]
}

function slug(value) {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42)
}

function refs(lesson, suffix) {
  return `${lesson.lesson_id}#${suffix}`
}

export function classifyHealthLessonType(lesson) {
  const focus = lesson.focus
  if (/integrating four years|four years of health learning/i.test(focus)) return 'REVIEW_RETRIEVAL'
  if (lesson.phase === 'Correction and reflection') return 'REMEDIATION_RETRY'
  if (lesson.phase === 'Mastery check') return 'MASTERY_EVIDENCE'
  if (lesson.phase === 'Application or project') return 'PROJECT_CAPSTONE'
  if (INFORMATION_PATTERN.test(focus)) return 'INFORMATION_EVALUATION'
  if (COMMUNICATION_PATTERN.test(focus)) return 'COMMUNICATION_HELP_SEEKING'
  if (PROCEDURE_PATTERN.test(focus)) return 'HEALTH_SKILL_PROCEDURE'
  if (DECISION_PATTERN.test(focus)) return 'DECISION_REASONING'
  return 'CONCEPT_VOCABULARY'
}

function secondaryTypes(primary, lesson) {
  const types = []
  if (primary !== 'DECISION_REASONING') types.push('DECISION_REASONING')
  if (primary !== 'CONCEPT_VOCABULARY') types.push('CONCEPT_VOCABULARY')
  if (COMMUNICATION_PATTERN.test(lesson.focus) && primary !== 'COMMUNICATION_HELP_SEEKING') {
    types.unshift('COMMUNICATION_HELP_SEEKING')
  }
  return unique(types).slice(0, 2)
}

function topicFacts(lesson, keyPoints) {
  const facts = unique(keyPoints)
  if (facts.length >= 3) return facts
  return unique([
    ...facts,
    `${lesson.focus} should be understood from observable facts and reliable health information, not from a guess about a person.`,
    `A safe response to ${lesson.focus} includes a feasible next step and the adult, professional, service, or public authority responsible for help.`,
  ])
}

function typeRule(primary) {
  const rules = {
    CONCEPT_VOCABULARY: 'NAME the concept. LINK it to a stated fact. CHECK the boundary. CHOOSE a safe next step.',
    INFORMATION_EVALUATION: 'SOURCE: Who made it? SUPPORT: What evidence is given? LIMIT: What is uncertain? ROUTE: Who can verify a high-stakes choice?',
    DECISION_REASONING: 'SITUATION: Name the facts. CHOICES: Compare safe options. INFORMATION: Use what matters. HELP: Name the responsible adult or source.',
    COMMUNICATION_HELP_SEEKING: 'NOTICE the situation. STATE the message briefly. LEAVE or pause if safety changes. TELL the responsible adult or help source.',
    HEALTH_SKILL_PROCEDURE: 'PREPARE safely. ORDER the steps. NOTICE the stop point. ASK trained help when the task exceeds your role.',
    REVIEW_RETRIEVAL: 'RECALL without the model. CONNECT the ideas. APPLY them to a fresh case. CHECK the safety and support route.',
    REMEDIATION_RETRY: 'FIND the smallest gap. USE a different model. CORRECT one step. RETRY on a fresh case.',
    MASTERY_EVIDENCE: 'RETRIEVE the taught idea. APPLY it independently. EXPLAIN with facts. TRANSFER it later to a different case.',
    PROJECT_CAPSTONE: 'DEFINE the public or fictional need. USE accurate evidence. BUILD a feasible response. CHECK authority, access, privacy, and impact.',
  }
  return rules[primary]
}

function modelFor(primary, lesson, facts) {
  const focus = lesson.focus
  const situations = {
    CONCEPT_VOCABULARY: `A fictional Northside class reads a display about ${focus}. The display states: ${facts[0]} One visitor says that this single fact proves what kind of person someone is. The class must explain the concept and correct the overclaim.`,
    INFORMATION_EVALUATION: `A fictional Northside group compares two messages about ${focus}. Source A names a qualified public-health author, a recent review date, supporting evidence, and this limit: ${facts[0]} Source B is an anonymous sales post that promises the same result for everyone and cites no evidence.`,
    DECISION_REASONING: `A fictional Northside group must choose a next step about ${focus}. The stated situation includes this fact: ${facts[0]} The group may pause and gather relevant information, ask the responsible adult or professional, or act immediately from an unsupported guess.`,
    COMMUNICATION_HELP_SEEKING: `In a fictional Northside activity about ${focus}, Sam says, “I need this to stop, and I want help from the adult leading this activity.” Another participant keeps asking for private reasons. The lesson fact is: ${facts[0]}`,
    HEALTH_SKILL_PROCEDURE: `A fictional Northside class receives mixed-up instruction cards about ${focus}. The cards include the goal, a safe setup, the lesson fact “${facts[0]}”, an action that belongs later, and a stop-and-get-help card. The class must put the safe process in order.`,
    REVIEW_RETRIEVAL: `A fictional Northside review team must reconnect prior learning about ${focus}. Without opening the model, the team recalls this approved fact: ${facts[0]} It must connect that fact to a new setting, one constraint, and the responsible support route.`,
    REMEDIATION_RETRY: `A fictional Northside response about ${focus} only repeats the topic name and adds a guess about a person. The approved fact is: ${facts[0]} The response must be corrected with a different organizer before a new case is attempted.`,
    MASTERY_EVIDENCE: `A fictional Northside assessment card presents a new case about ${focus} and this relevant fact: ${facts[0]} The learner must retrieve the taught idea, justify a safe response independently, and leave all private information out.`,
    PROJECT_CAPSTONE: `A fictional Northside youth council is designing a public resource about ${focus}. It has this approved evidence: ${facts[0]} The resource must name its audience, a feasible action, the actor with authority, an access or privacy safeguard, and a measure of impact.`,
  }
  const possibleActions = {
    CONCEPT_VOCABULARY: ['Explain the concept with the stated fact and correct the person label.', 'Repeat the topic word without defining it.', 'Treat one detail as proof of a diagnosis or a person\'s value.'],
    INFORMATION_EVALUATION: ['Prefer Source A while stating its limit and verifying high-stakes use.', 'Choose Source B because its promise is more certain.', 'Treat both messages as equally reliable without comparing their features.'],
    DECISION_REASONING: ['Use the stated fact, compare safe options, and ask the responsible help source.', 'Act alone from the unsupported guess.', 'Ask a fictional person to reveal private information before helping.'],
    COMMUNICATION_HELP_SEEKING: ['Respect the brief message, stop pressing for details, and involve the responsible adult.', 'Require a private explanation before respecting the request.', 'Make the peer responsible for solving the entire situation.'],
    HEALTH_SKILL_PROCEDURE: ['Order the safe setup, actions, stop point, and trained-help route.', 'Begin with the later action and omit the safety check.', 'Attempt a real procedure beyond current training.'],
    REVIEW_RETRIEVAL: ['Recall, connect, apply, and check the help route.', 'Copy a prior model conclusion into the new setting.', 'Introduce a new claim without taught evidence.'],
    REMEDIATION_RETRY: ['Name the exact gap, use the alternate organizer, correct a parallel case, and retry fresh.', 'Repeat the original paragraph.', 'Replace the evidence task with a private reflection.'],
    MASTERY_EVIDENCE: ['Complete the fresh case independently and schedule later transfer.', 'Copy the worked model.', 'Mark mastery from this one response.'],
    PROJECT_CAPSTONE: ['Build the bounded public resource with evidence, authority, safeguards, and a measure.', 'Require a real personal health plan.', 'Publish a claim without checking evidence or access.'],
  }
  const common = {
    ref: refs(lesson, 'model-northside'),
    heading: `Watch the reasoning: ${focus}`,
    situation: situations[primary],
    relevantFacts: facts.slice(0, 2),
    assumptionOrDistraction: `A popular or confident statement about ${focus} is not automatically accurate and cannot establish a person\'s health, motives, or character.`,
    possibleActions: possibleActions[primary],
    successCheck: 'The model uses the lesson fact, explains the connection, stays within the learner role, and names responsible help when it is needed.',
  }
  const worked = {
    CONCEPT_VOCABULARY: [
      'Name the lesson concept and explain it with the reference-card fact.',
      'Separate what the concept means from a label or unsupported conclusion about a person.',
      'Apply the concept to one safe action and name the right help source if the situation needs one.',
    ],
    INFORMATION_EVALUATION: [
      'Prefer the source that names its author or organization, evidence, date, and limits.',
      'Treat popularity, a testimonial, a sale, or certainty without support as a reason to verify the claim.',
      'For a high-stakes choice, pause and verify with a trusted adult or qualified professional instead of acting on the post.',
    ],
    DECISION_REASONING: [
      'List only the stated situation and constraints before judging an option.',
      'Compare at least two safe choices using the lesson facts and reject choices that depend on guessing or acting beyond the learner role.',
      'Choose a feasible next step and identify the adult, professional, service, or authority responsible for help.',
    ],
    COMMUNICATION_HELP_SEEKING: [
      `Use a short message such as: “I need help with this situation about ${focus}. Here is the fact I know and the safe next step I am asking for.”`,
      'Do not require the fictional person to justify a boundary or reveal private details.',
      'If pressure, danger, or urgency increases, end the exchange and contact the responsible adult or service.',
    ],
    HEALTH_SKILL_PROCEDURE: [
      'Start with a safe setup and identify the goal of the procedure.',
      'Put the lesson actions in order and explain why the safety or stop point belongs where it does.',
      'Stop and get trained adult or professional help when the situation is urgent or beyond current training.',
    ],
    REVIEW_RETRIEVAL: [
      'Recall the relevant facts before reopening the model.',
      'Connect the facts and explain which prior idea controls the decision.',
      'Apply the connection to a new context and check whether support or authority changes.',
    ],
    REMEDIATION_RETRY: [
      'Locate one observable gap: fact, vocabulary, reasoning, process order, or support route.',
      'Use a contrast or visual organizer instead of repeating the first explanation.',
      'Correct one parallel example, then remove the cue before a fresh retry.',
    ],
    MASTERY_EVIDENCE: [
      'Retrieve the taught concept without copying the model.',
      'Use stated facts to complete the fresh task independently and explain the decision boundary.',
      'Record one evidence occasion only; mastery waits for later accurate transfer.',
    ],
    PROJECT_CAPSTONE: [
      'Define one bounded fictional or public need and the audience affected.',
      'Use the lesson fact, identify the actor with authority, and propose a feasible response.',
      'Add an access or privacy safeguard and a measure that could show whether the response worked.',
    ],
  }
  return { ...common, workedReasoning: worked[primary] }
}

function guidedFor(primary, lesson, facts, young) {
  const focus = lesson.focus
  const turnOne = young
    ? ['Name one fact.', 'Choose one safe action.', 'Name an adult who can help.']
    : ['Identify the relevant facts and one assumption to leave out.', 'Compare two feasible interpretations or actions.', 'Choose a response and identify the evidence, limit, and responsible help source.']
  return {
    ref: refs(lesson, 'guided-riverside'),
    heading: 'Try a different case with support',
    situation: `A fictional Riverside youth group must explain or act on ${focus}. The group has this reliable lesson information: ${facts[1] ?? facts[0]} It has not been given any person\'s private health information.`,
    availableChoices: primary === 'INFORMATION_EVALUATION'
      ? ['Use the message that names evidence and limits.', 'Use the anonymous promise because it sounds certain.', 'Pause and verify before a high-stakes action.']
      : primary === 'COMMUNICATION_HELP_SEEKING'
        ? ['State or respect a brief message and contact responsible help.', 'Press for private details.', 'Keep a dangerous situation secret.']
        : primary === 'HEALTH_SKILL_PROCEDURE'
          ? ['Order the safe steps and name the stop point.', 'Skip the setup.', 'Attempt a step beyond current training.']
          : ['Use the stated facts and compare safe options.', 'Act from an unsupported assumption.', 'Pause and contact the responsible help source.'],
    turnOne,
    cue: primary === 'INFORMATION_EVALUATION'
      ? 'Look for authorship, evidence, date or context, uncertainty, and incentive.'
      : primary === 'COMMUNICATION_HELP_SEEKING'
        ? 'Look for the fact, the brief message, the boundary of the learner role, and the help route.'
        : primary === 'HEALTH_SKILL_PROCEDURE'
          ? 'Look for the safe setup, correct order, stop point, and trained-help boundary.'
          : 'Look for the situation, safe choices, relevant information, and who can help.',
    feedbackMoves: [
      'If a response adds a guess, replace it with a fact from the case or lesson.',
      `If ${focus} is named without explanation, link one fact to the concept or process.`,
      'If a choice is reasonable but the reason is missing, add the fact that supports it.',
      'If a response seeks disclosure, diagnoses, shames, or exceeds the learner role, switch to the fictional facts and the approved help route.',
      'Accept an equivalent typed, handwritten, drawn-and-labeled, signed, selected, or spoken response when it shows the same reasoning.',
    ],
    turnTwo: young
      ? 'Fix one sentence. Use a fact and a safe next step.'
      : 'Revise the response so it states the controlling fact, applies the lesson idea precisely, and explains the support or authority boundary.',
    releaseCondition: `Continue when the response uses a stated fact, applies ${focus}, and gives a safe next step without private disclosure or a person label.`,
  }
}

function independentFor(primary, lesson, facts, young) {
  const focus = lesson.focus
  const situations = {
    CONCEPT_VOCABULARY: `A fictional Maple Community Center posts two statements about ${focus}. One uses this approved fact: ${facts[0]} The other turns one detail into a label about a person. Explain the concept, correct the label, and choose a safe next step.`,
    INFORMATION_EVALUATION: `A fictional Maple Community Center compares a dated public-health page with named evidence to an anonymous sponsored message about ${focus}. The reliable page states: ${facts[0]} Decide which source better supports action and what still needs verification.`,
    DECISION_REASONING: `A fictional Maple Community Center faces a choice about ${focus}. Staff provide this relevant fact: ${facts[0]} The available options are to use the fact and responsible help, delay briefly to gather missing information, or act alone from a guess.`,
    COMMUNICATION_HELP_SEEKING: `In a fictional Maple Community Center case about ${focus}, a participant gives a clear brief message and asks for the activity leader. Another participant presses for private details. Use this lesson fact to write the safe communication and help route: ${facts[0]}`,
    HEALTH_SKILL_PROCEDURE: `A fictional Maple Community Center has an unordered set of steps for ${focus}. The information card says: ${facts[0]} Create the safe order, identify a stop point, and name when trained adult or professional help takes over.`,
    REVIEW_RETRIEVAL: `A fictional Maple Community Center asks for a new application of ${focus}. Retrieve and connect the relevant prior targets, including this fact: ${facts[0]} Apply them under a new access constraint and support route.`,
    REMEDIATION_RETRY: `A fictional Maple Community Center response about ${focus} contains a fact error, an unsupported conclusion, and no help route. The approved fact is: ${facts[0]} Identify and repair each gap before the separate fresh retry.`,
    MASTERY_EVIDENCE: `A fictional Maple Community Center presents a fresh case about ${focus}. It supplies this relevant information: ${facts[0]} Complete the type-appropriate response independently and explain the safety and authority boundary.`,
    PROJECT_CAPSTONE: `A fictional Maple Community Center requests a bounded public resource about ${focus}. Use this evidence: ${facts[0]} Define the audience and need, propose a feasible action, identify authority, add an access or privacy safeguard, and define a measure.`,
  }
  const directions = young
    ? ['Write two facts.', `Use the lesson idea about ${focus}.`, 'Choose one safe next step.', 'Name an adult or help source.']
    : [
        'Identify the relevant facts, constraints, and any uncertainty; exclude unsupported assumptions.',
        `Apply the taught concept, evaluation rule, communication move, procedure, or project criteria for ${focus}.`,
        'Compare feasible options and justify the selected response with at least two lesson details.',
        'State the responsible adult, professional, service, or public authority and the condition that would trigger escalation or revision.',
      ]
  return {
    ref: refs(lesson, 'independent-maple'),
    heading: 'Show what you know on a fresh case',
    situation: situations[primary],
    taskMode: primary,
    directions,
    permittedSupports: young
      ? ['the lesson vocabulary card', 'read-aloud or one direction at a time', 'typing, writing, drawing with labels, signing, selecting, or speaking']
      : ['the lesson vocabulary and fact cards', 'read-aloud, chunking, translation, access tools, or extra time', 'typed, handwritten, drawn-and-labeled, signed, selected, or spoken response'],
    independenceBoundary: 'Support may restate a direction or provide access. It may not choose the controlling fact, conclusion, action, reason, safety judgment, or help route.',
    successCriteria: young
      ? ['I use two facts.', `I explain ${focus}.`, 'I choose a safe action and give a reason.', 'I name the right kind of help.']
      : ['Uses at least two accurate lesson details and distinguishes fact from assumption.', `Applies ${focus} with precise vocabulary and reasoning appropriate to ${primary}.`, 'Chooses or designs a safe, feasible response and explains relevant limits or tradeoffs.', 'Names the appropriate authority or help route and an escalation or revision condition.'],
  }
}

function freshCheck(lesson, facts, young) {
  return {
    ref: refs(lesson, 'fresh-check-lakeside'),
    heading: 'Check the idea in a new place',
    situation: `A fictional Lakeside school committee reviews ${lesson.focus}. The committee knows: ${facts[2] ?? facts[0]} It must correct one unsupported claim and choose a safe next step.`,
    directions: young
      ? ['Name the fact.', 'Fix the wrong claim.', 'Choose a safe action.', 'Name who can help.']
      : ['State the controlling fact and correct the unsupported claim.', 'Apply the lesson rule under the new setting or constraint.', 'Explain the safe next step, remaining uncertainty, and responsible help source.'],
    freshnessNote: 'This case is different from the model, guided case, and independent case. Do not copy their conclusions.',
  }
}

function remediationFor(primary, lesson, facts, young) {
  const alternate = primary === 'INFORMATION_EVALUATION'
    ? 'Use a claim ladder. Put the claim at the top, then add source, evidence, date or context, and limits as the rungs. A missing rung shows exactly what must be checked; confidence cannot replace a rung.'
    : primary === 'COMMUNICATION_HELP_SEEKING'
      ? 'Use a three-box message map: FACT I can state, MESSAGE or LIMIT I can say, and HELP I can contact. Private details stay outside the boxes because they are not needed to practice the skill.'
      : primary === 'HEALTH_SKILL_PROCEDURE'
        ? 'Use a path map with four signs: SET UP, DO IN ORDER, STOP IF, and GET HELP. The map separates a classroom description from a real action that requires trained supervision.'
        : primary === 'PROJECT_CAPSTONE'
          ? 'Use a bridge diagram: NEED and EVIDENCE are one side; ACTION, AUTHORITY, SAFEGUARD, and MEASURE are the spans. A proposal cannot cross the bridge when one span is missing.'
          : 'Use a four-box decision map: SITUATION, SAFE CHOICES, RELEVANT INFORMATION, and HELP. Fill each box with case facts before writing a conclusion.'
  return {
    ref: refs(lesson, 'remediation-oak-street'),
    alternateExplanationRefs: [refs(lesson, 'remediation-alternate-model'), refs(lesson, 'remediation-contrast')],
    heading: 'Try a different model',
    trigger: `Use this route after an observable gap in a fact, vocabulary meaning, reasoning step, process order, or help route for ${lesson.focus}.`,
    prerequisite: `First restate this approved fact in your own words: ${facts[0]}`,
    alternateExplanation: alternate,
    contrast: [
      `Sufficient: uses a stated fact about ${lesson.focus}, explains the connection, and stays within the learner role.`,
      `Needs revision: repeats a topic word, adds a guess, or gives an action with no factual reason or responsible help source.`,
    ],
    guidedCorrection: young
      ? 'Cross out the guess. Circle the fact. Add one safe action.'
      : 'Annotate a flawed response by marking the unsupported assumption, the missing lesson connection, and the missing authority or safety boundary; then revise only those parts.',
    guidedCorrectionRef: refs(lesson, 'remediation-guided-correction'),
    freshRetry: {
      ref: refs(lesson, 'remediation-fresh-retry'),
      situation: `A fictional Oak Street library receives a new question about ${lesson.focus}. Staff provide this approved fact: ${facts[1] ?? facts[0]} The learner must respond without using the Northside, Riverside, Maple, or Lakeside conclusions.`,
      directions: young
        ? ['Write the fact.', 'Use the lesson idea.', 'Choose a safe next step.', 'Name who can help.']
        : ['Identify the relevant fact and apply the lesson rule.', 'Explain a safe, feasible response and its limit.', 'Name the responsible help or authority route.'],
    },
    exitCriterion: `Return to the independent route when the learner accurately uses a fact, applies ${lesson.focus}, explains a safe response, and identifies support without answer-bearing help.`,
    nextRoute: 'If the same gap remains, return to the named prerequisite with an adult instructor; do not replace the task with private reflection.',
  }
}

function protectedAuthority(primary, lesson, facts) {
  const id = `HLTH-G${lesson.grade}-${slug(lesson.focus)}`
  return {
    authorityVersion: HEALTH_PRODUCTION_DEPTH_VERSION,
    independentEvidence: {
      caseRef: refs(lesson, 'independent-maple'),
      requiredFacts: facts,
      requiredReasoning: [
        `Accurately applies ${lesson.focus} rather than merely repeating the topic name.`,
        'Separates stated or observable facts from assumptions, labels, and personal judgments.',
        'Uses a safe and feasible action, interpretation, communication move, process, or product supported by lesson information.',
        'Names the adult, professional, service, or public authority responsible when help or escalation is needed.',
      ],
      acceptableConclusions: [
        'The modeled conclusion is not required; another conclusion is sufficient when it uses the same taught facts, stays within the learner role, and meets every safety boundary.',
        `For ${primary}, judge the accuracy of the concept and reasoning, not the learner's speed, confidence, response mode, or personal preference.`,
      ],
    },
    freshMasteryCheck: {
      caseRef: refs(lesson, 'fresh-check-lakeside'),
      requiredUnderstanding: [facts[2] ?? facts[0], `The learner must transfer the rule for ${lesson.focus} instead of copying the model.`, 'The response must include a safe next step and the responsible support or authority route.'],
    },
    acceptableVariation: [
      'Equivalent accurate vocabulary is acceptable when the learner explains the same lesson distinction.',
      'A reasonable alternate action or conclusion is acceptable when it is supported by stated facts, safe, feasible, respectful, and within the learner role.',
      'Typed, handwritten, drawn-and-labeled, signed, selected, or spoken evidence earns equal credit when it supplies the same reasoning.',
      'A learner may state uncertainty and request qualified help; appropriate uncertainty is not an error.',
    ],
    misconceptionBoundaries: [
      { id: `${id}-ASSUMPTION-AS-FACT`, insufficientPattern: `Adds a diagnosis, motive, character judgment, or private claim that the ${lesson.focus} case does not provide.`, revisionNeeded: 'Replace the assumption with a stated fact and limit the conclusion to what that fact supports.' },
      { id: `${id}-TERM-WITHOUT-MEANING`, insufficientPattern: `Names ${lesson.focus} or a lesson term without explaining what it means in the case.`, revisionNeeded: 'Connect one required fact to the meaning or process taught in the explanation.' },
      { id: `${id}-REASON-MISSING`, insufficientPattern: 'Chooses an action, interpretation, message, process, or product without a reason grounded in lesson information.', revisionNeeded: 'Add the controlling fact and explain why it supports the response.' },
      { id: `${id}-AUTHORITY-MISSING`, insufficientPattern: 'Leaves out responsible help or directs a learner to act beyond the learner role.', revisionNeeded: 'Name the appropriate adult, professional, service, or public authority and the escalation condition.' },
    ],
    safetyCriticalErrors: [
      'Diagnosing, prescribing, or directing individualized treatment, medication, food, supplement, or exercise changes.',
      'Requiring private health, body, treatment, family, sexual, substance-use, or feeling information as evidence.',
      'Never use shame, stigma, dieting, weight-loss, appearance, body-value, or disability-value judgments.',
      'Directing a learner to manage danger or an emergency alone, exceed current training, or bypass responsible adult or professional authority.',
    ],
    scoringNotes: [
      'A correct term without a fact-to-meaning connection is partial evidence.',
      'A safe response with incomplete reasoning is partial evidence and receives a bounded fact-link cue before a fresh retry.',
      'A pause, privacy choice, access support, alternate response mode, or request for adult help is not evidence of failure.',
      'Subjective reflection, preference, and personal meaning are not automatically right or wrong and are not mastery evidence.',
    ],
  }
}

export function buildHealthProductionDepth({ lesson, unit, grade, keyPoints, contentRepairApplied }) {
  const primary = classifyHealthLessonType(lesson)
  const secondary = secondaryTypes(primary, lesson)
  const facts = topicFacts(lesson, keyPoints)
  const young = grade <= 5
  const modelExample = modelFor(primary, lesson, facts)
  const guidedReasoning = guidedFor(primary, lesson, facts, young)
  const independentEvidence = independentFor(primary, lesson, facts, young)
  const freshMasteryCheck = freshCheck(lesson, facts, young)
  const remediation = remediationFor(primary, lesson, facts, young)
  const rule = typeRule(primary)
  const learningGoal = young
    ? `I can explain ${lesson.focus}, use facts, choose a safe next step, and name who can help.`
    : `I can accurately explain ${lesson.focus}, apply it to a fictional or public case, justify a safe response with evidence and limits, and identify responsible support or authority.`
  const vocabulary = {
    ref: refs(lesson, 'vocabulary'),
    heading: `Words for ${lesson.focus}`,
    terms: [
      { term: lesson.focus, meaning: facts[0], boundary: 'This idea does not diagnose, label, or determine the value of a person.' },
      { term: 'relevant information', meaning: 'facts or reliable evidence that can change the interpretation, choice, or next step', boundary: 'A guess, popularity, or a personal judgment is not relevant evidence by itself.' },
      { term: 'support route', meaning: 'the responsible adult, qualified professional, service, or public authority able to help with the situation', boundary: 'Naming a support route does not make the learner responsible for diagnosis, treatment, or emergency management.' },
    ],
  }

  const learner = {
    standards: lesson.standards ?? [],
    primaryLessonType: primary,
    secondaryLessonTypes: secondary,
    learningGoal,
    materials: ['paper and pencil or an accessible response tool', 'the fictional lesson cards included in this task'],
    keyPoints: facts,
    privacySafeScenario: 'All required evidence uses fictional or public situations. The learner never has to disclose personal health, body, treatment, feelings, family, sexual, or substance-use information.',
    studentTask: independentEvidence.directions.join(' '),
    knowledgeCheck: freshMasteryCheck.directions.join(' '),
    completionCriteria: independentEvidence.successCriteria,
    lessonExperience: {
      experienceVersion: HEALTH_PRODUCTION_DEPTH_VERSION,
      learnerTitle: `Learn and apply: ${lesson.focus}`,
      privacyNotice: young
        ? 'Write only about the made-up people. Keep private information private.'
        : 'Use only the fictional or public facts supplied here; private health information is neither requested nor scored.',
      entryCheck: {
        ref: refs(lesson, 'entry-check'),
        heading: 'Start with a fact',
        directions: young ? 'Choose the sentence that states a fact.' : 'Separate the stated fact from the unsupported conclusion before beginning.',
        choices: [facts[0], `This one detail proves everything about a person's health.`, `A popular statement about ${lesson.focus} needs no evidence.`],
        support: 'A fact is stated in the lesson or supported by reliable evidence. An assumption adds a conclusion the information cannot establish.',
        treatment: 'This entry check is unscored. Use the support or prerequisite route before continuing when needed.',
      },
      explanation: {
        ref: refs(lesson, 'clear-explanation'),
        heading: `Understand ${lesson.focus}`,
        paragraphs: facts,
        importantDistinction: `Learning about ${lesson.focus} supports accurate reasoning and safe next steps; it does not authorize a diagnosis, individualized treatment advice, a person label, or a value judgment.`,
        decisionRule: rule,
      },
      vocabulary,
      vocabularyCheck: {
        ref: refs(lesson, 'vocabulary-check'),
        heading: 'Check the words',
        directions: young ? ['Say what the topic means.', 'Point to one fact.', 'Name the help route.'] : ['Define the topic in context.', 'Identify which supplied statement is relevant information and explain why.', 'Name the support route and the boundary of its authority.'],
        selfCheck: `A complete check uses the meaning of ${lesson.focus}, one accurate fact, and the responsible support route without labeling a person.`,
      },
      ...(lesson.practice_scenario ? {
        canonicalPracticeContext: {
          ref: refs(lesson, 'canonical-practice-context'),
          heading: 'Use the authored practice situation',
          situation: lesson.practice_scenario,
          treatment: 'This canonical context may support teaching or discussion. It does not replace the separate fresh independent, mastery, or remediation-retry cases.',
        },
      } : {}),
      modelExample,
      guidedReasoning,
      independentEvidence,
      freshMasteryCheck,
      remediation,
      laterTransfer: {
        ref: refs(lesson, 'later-transfer'),
        timing: 'Use in a later lesson or a separate session.',
        prompt: `Apply ${lesson.focus} to a meaningfully different fictional or public case. Retrieve the concept, use relevant facts, justify a safe response, and identify the responsible support or authority route.`,
        masteryBoundary: 'The current independent response is one evidence occasion. Mastery requires accurate independent evidence now and accurate later retrieval or transfer.',
      },
    },
    adaptationChoices: young
      ? 'Show one short direction at a time. Allow reading aloud, word cards, typing, writing, drawing with labels, signing, selecting, or speaking. Help may repeat a direction but may not choose the fact, action, reason, or help source.'
      : 'Preserve the Health reasoning while offering read-aloud, chunking, vocabulary preview, translation, text-to-speech, speech-to-text, extra time, breaks, or an equivalent typed, written, drawn-and-labeled, signed, selected, or spoken response. Access support may not supply the protected conclusion.',
    extensionChallenge: `Create a new fictional or public case about ${lesson.focus}. Include enough facts, choices or constraints, and support authority for another learner to reason safely. Add an accurate explanation of acceptable variation; use no real person's private information.`,
    accessibilitySupports: young
      ? ['Read one short section aloud.', 'Show one action at a time.', 'Offer a vocabulary card and extra time.', 'Accept typing, writing, drawing with labels, signing, selecting, or speaking for equal credit.']
      : ['Chunk the explanation and directions.', 'Offer vocabulary preview, read-aloud, translation, and access technology.', 'Allow extra time, breaks, and a low-distraction setting.', 'Accept equivalent typed, written, drawn-and-labeled, signed, selected, or spoken evidence for equal credit.'],
    trustedAdultNote: 'If a real situation feels unsafe or raises a health concern, pause the lesson and tell a parent, guardian, teacher, school staff member, or another trusted adult. A qualified health professional gives medical advice. In an emergency, get an adult and use the local emergency service.',
    optionalReflection: {
      prompt: `Optional and private: Make up one example that helps you remember ${lesson.focus}. Keep it for yourself. You do not need to show it or prove that you completed it.`,
      private: true,
      graded: false,
      optional: true,
    },
    reflectionPolicy: {
      mode: 'PRIVATE_OPTIONAL',
      visibleTo: ['LEARNER'],
      scored: false,
      contributesToCompletion: false,
      contributesToMastery: false,
      retention: 'LEARNER_KEPT_ONLY',
    },
    neverRequires: HEALTH_NEVER_REQUIRES,
    contentProvenance: {
      factSourceLane: contentRepairApplied ? 'mac/health-content-repair-r1' : 'canonical-grade-3-4-health-authoring',
      productionDepthLane: 'mac/health-production-depth-r1',
      objective: lesson.learning_objectives?.[0] ?? lesson.focus,
      standardRef: 'docs/curriculum-quality/health/HEALTH_LESSON_STANDARD_R1.md',
      productionDepthVersion: HEALTH_PRODUCTION_DEPTH_VERSION,
    },
  }

  const authority = protectedAuthority(primary, lesson, facts)
  const adult = {
    standards: lesson.standards ?? [],
    primaryLessonType: primary,
    secondaryLessonTypes: secondary,
    successCriteria: independentEvidence.successCriteria,
    scoringGuidance: `Judge the learner's accurate use of ${lesson.focus}, stated facts, type-appropriate reasoning, safe next step, and support or authority route. Accept equivalent wording and response modes. Do not score private experience, feelings, confidence, speed, handwriting, access support, or similarity to the model. Do not infer diagnosis, effort, motivation, character, family situation, or health status.`,
    protectedAuthority: authority,
    masteryRule: `Do not mark mastery of ${lesson.focus} from the entry check, vocabulary check, worked model, guided case, one response, confidence, or private reflection. Require accurate independent evidence on the Maple case and accurate retrieval or transfer on a later, meaningfully different fictional or public case. Both occasions must meet the lesson-specific criteria without answer-bearing help.`,
    masteryPlan: {
      minimumEvidenceOccasions: 2,
      occasionOneRef: refs(lesson, 'independent-maple'),
      laterRetrievalOrTransferRef: refs(lesson, 'later-transfer'),
      independenceRule: 'Definitions, directions, read-aloud, translation, access tools, and response alternatives are permitted. Evidence is guided rather than independent if support supplies the controlling fact, conclusion, action, decisive reason, safety judgment, or help route.',
      privateReflectionContributes: false,
      decisionAuthority: 'An authorized adult or separately approved scoring runtime applies this protected guide. Curriculum coaching cannot make or override the mastery decision.',
    },
    remediation: `Name the smallest observable gap for ${lesson.focus}. Use the alternate model in ${refs(lesson, 'remediation-alternate-model')} instead of repeating the first explanation. Complete the bounded guided correction, then use ${refs(lesson, 'remediation-fresh-retry')} without answer-bearing help. Exit only when the learner accurately uses a fact, applies the lesson idea, explains a safe response, and identifies responsible support.`,
    adaptiveRoutes: authority.misconceptionBoundaries.map((item) => ({
      signal: item.id,
      action: `${item.revisionNeeded} Use the alternate remediation model and guided correction, then remove answer-bearing support for the fresh Oak Street retry.`,
    })),
    reflectionPolicy: {
      mode: 'PRIVATE_OPTIONAL',
      visibleTo: ['LEARNER'],
      scored: false,
      contributesToCompletion: false,
      contributesToMastery: false,
      subjectiveJudgmentPolicy: 'SUBJECTIVE_REFLECTION_NOT_AUTOMATICALLY_RIGHT_OR_WRONG',
    },
    guardianOrParentVisibility: 'Share the learning goal, completion state, evidence type, and next instructional step. Do not expose private reflection or ask for proof that it occurred. Do not infer or report diagnosis, feelings, effort, motivation, character, family circumstances, or health status.',
    guardianSafetyReview: {
      requiredForLessonCompletion: false,
      authority: 'A parent, guardian, teacher, school staff member, or another trusted adult handles real safety concerns. A qualified health professional gives medical advice. Emergency services handle emergencies.',
      boundary: 'The lesson and scorer do not diagnose, prescribe, investigate private information, or override guardian, professional, school, legal, or emergency authority.',
    },
    safetyAndPrivacyNotes: SAFETY_NOTES,
    contentProvenance: {
      factSourceLane: contentRepairApplied ? 'mac/health-content-repair-r1' : 'canonical-grade-3-4-health-authoring',
      productionDepthLane: 'mac/health-production-depth-r1',
      standardRef: 'docs/curriculum-quality/health/HEALTH_LESSON_STANDARD_R1.md',
      productionDepthVersion: HEALTH_PRODUCTION_DEPTH_VERSION,
    },
  }

  return { learner, adult, lessonType: primary, gradeBand: gradeBand(grade) }
}

function getFreshCheck(pkg) {
  return pkg.lessonExperience?.freshMasteryCheck ?? pkg.lessonExperience?.freshConceptCheck
}

function addIssue(issues, id, message) {
  issues.push(`${id}: ${message}`)
}

export function auditHealthProductionDepth(packages, guides) {
  const issues = []
  const guideById = new Map(guides.map((guide) => [guide.lessonId, guide]))
  const lessonTypes = Object.fromEntries(HEALTH_LESSON_TYPES.map((type) => [type, 0]))
  const grades = {}

  for (const pkg of packages) {
    const id = pkg.lessonId
    const guide = guideById.get(id)
    const experience = pkg.lessonExperience
    const fresh = getFreshCheck(pkg)
    const primary = pkg.primaryLessonType
    lessonTypes[primary] = (lessonTypes[primary] ?? 0) + 1
    grades[pkg.grade] = (grades[pkg.grade] ?? 0) + 1
    if (!HEALTH_LESSON_TYPES.includes(primary)) addIssue(issues, id, `unsupported primary lesson type ${primary}`)
    if (!experience?.explanation?.paragraphs?.length || !experience?.explanation?.importantDistinction || !experience?.explanation?.decisionRule) addIssue(issues, id, 'incomplete clear explanation')
    if (!experience?.vocabulary?.terms || experience.vocabulary.terms.length < 3) addIssue(issues, id, 'fewer than three taught vocabulary terms')
    if (!experience?.vocabularyCheck) addIssue(issues, id, 'missing vocabulary check')
    if (!experience?.modelExample?.situation || !(experience.modelExample?.workedReasoning?.length || experience.modelExample?.thinkingSteps?.length)) addIssue(issues, id, 'missing meaningful model')
    if (!experience?.guidedReasoning?.turnOne?.length || !experience.guidedReasoning?.feedbackMoves?.length || !experience.guidedReasoning?.turnTwo) addIssue(issues, id, 'incomplete guided reasoning')
    if (!experience?.independentEvidence?.situation || !experience.independentEvidence?.directions?.length || !experience.independentEvidence?.independenceBoundary) addIssue(issues, id, 'incomplete independent evidence')
    if (!fresh?.situation || !fresh?.directions?.length) addIssue(issues, id, 'missing fresh mastery check')
    if (!experience?.remediation?.alternateExplanation || !experience.remediation?.guidedCorrection || !experience.remediation?.freshRetry?.situation || !experience.remediation?.exitCriterion) addIssue(issues, id, 'incomplete differentiated remediation')
    const situations = [experience?.modelExample?.situation, experience?.guidedReasoning?.situation, experience?.independentEvidence?.situation, fresh?.situation, experience?.remediation?.freshRetry?.situation]
    if (new Set(situations).size !== situations.length) addIssue(issues, id, 'model, guided, independent, mastery, and retry cases are not fresh')
    if (pkg.reflectionPolicy?.contributesToMastery !== false || pkg.reflectionPolicy?.contributesToCompletion !== false || pkg.optionalReflection?.graded !== false) addIssue(issues, id, 'private reflection can contribute to completion or mastery')
    if (pkg.protectedAuthority || pkg.answerAuthority || pkg.scoringGuidance) addIssue(issues, id, 'protected answer authority leaked into learner package')
    if (!pkg.trustedAdultNote || !/qualified health professional|qualified professional/i.test(pkg.trustedAdultNote)) addIssue(issues, id, 'missing adult/professional safety route')
    if (!guide) {
      addIssue(issues, id, 'missing paired adult guide')
      continue
    }
    if (guide.primaryLessonType !== primary) addIssue(issues, id, 'learner/adult lesson type mismatch')
    if (!guide.protectedAuthority?.independentEvidence?.requiredFacts || guide.protectedAuthority.independentEvidence.requiredFacts.length < 2) addIssue(issues, id, 'protected authority lacks lesson facts')
    if (!guide.protectedAuthority?.acceptableVariation || guide.protectedAuthority.acceptableVariation.length < 3) addIssue(issues, id, 'protected authority lacks acceptable variation')
    if (!guide.protectedAuthority?.misconceptionBoundaries || guide.protectedAuthority.misconceptionBoundaries.length < 3) addIssue(issues, id, 'protected authority lacks misconception boundaries')
    if (guide.masteryPlan?.minimumEvidenceOccasions !== 2 || guide.masteryPlan?.privateReflectionContributes !== false) addIssue(issues, id, 'mastery plan does not require two occasions or exclude reflection')
    if (guide.reflectionPolicy?.subjectiveJudgmentPolicy !== 'SUBJECTIVE_REFLECTION_NOT_AUTOMATICALLY_RIGHT_OR_WRONG') addIssue(issues, id, 'subjective reflection policy missing')
    if (!/do not diagnose/i.test(guide.guardianSafetyReview?.boundary ?? '')) addIssue(issues, id, 'no-diagnosis adult-authority boundary missing')
  }

  for (const type of HEALTH_LESSON_TYPES) {
    if (lessonTypes[type] === 0) issues.push(`corpus: lesson type ${type} has no representative`)
  }
  if (packages.length !== 324 || guides.length !== 324) issues.push(`corpus: expected 324 lesson packages and guides, got ${packages.length}/${guides.length}`)
  if (guideById.size !== guides.length) issues.push('corpus: duplicate adult-guide lesson IDs')

  return {
    lessonsAudited: packages.length,
    guidesAudited: guides.length,
    lessonTypes,
    grades,
    issueCount: issues.length,
    issues,
  }
}

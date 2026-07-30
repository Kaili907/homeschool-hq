import type { TutorProgram, TutorRuntimeHooks, StableId } from "../core/index.js";
import { defaultMediaFallback } from "../core/index.js";
import { boardBase, multipleChoice, teachingTurn } from "./builders.js";

const skillId = "english-complete-sentences" as StableId;

const diagnosticItems = [
  multipleChoice({
    id: "english-diagnostic-one",
    skillId,
    purpose: "diagnostic",
    subject: "english",
    prompt: "Which choice is a complete sentence?",
    options: [
      { id: "option-because-rain-stopped", text: "Because the rain stopped." },
      { id: "option-team-walked-outside", text: "The team walked outside." },
      { id: "option-running-through-puddles", text: "Running through the puddles." },
    ],
    correctOptionId: "option-team-walked-outside",
  }),
  multipleChoice({
    id: "english-diagnostic-two",
    skillId,
    purpose: "diagnostic",
    subject: "english",
    prompt: "What is missing from this group of words: ‘The bright red kite’?",
    options: [
      { id: "option-missing-subject", text: "A subject" },
      { id: "option-missing-predicate", text: "A predicate" },
      { id: "option-missing-capital", text: "A capital letter" },
    ],
    correctOptionId: "option-missing-predicate",
  }),
];

const guidedItems = [
  multipleChoice({
    id: "english-guided-one",
    skillId,
    purpose: "guided-practice",
    subject: "english",
    prompt: "Which addition completes ‘Because the rain stopped’ as a sentence?",
    options: [
      { id: "option-guided-we-went-outside", text: "we went outside." },
      { id: "option-guided-after-lunch", text: "after lunch." },
      { id: "option-guided-very-quickly", text: "very quickly." },
    ],
    correctOptionId: "option-guided-we-went-outside",
  }),
  multipleChoice({
    id: "english-guided-two",
    skillId,
    purpose: "guided-practice",
    subject: "english",
    prompt: "Which choice has both a subject and a predicate?",
    options: [
      { id: "option-guided-blue-bicycle", text: "The blue bicycle." },
      { id: "option-guided-bicycle-rolled", text: "The bicycle rolled downhill." },
      { id: "option-guided-down-steep-hill", text: "Down the steep hill." },
    ],
    correctOptionId: "option-guided-bicycle-rolled",
  }),
];

const independentItems = [
  multipleChoice({
    id: "english-independent-one",
    skillId,
    purpose: "independent-mastery",
    subject: "english",
    prompt: "Which choice is a complete sentence?",
    options: [
      { id: "option-independent-dog-barked", text: "The dog barked at the mail carrier." },
      { id: "option-independent-while-waiting", text: "While waiting by the door." },
      { id: "option-independent-loud-brown-dog", text: "The loud brown dog." },
    ],
    correctOptionId: "option-independent-dog-barked",
  }),
  multipleChoice({
    id: "english-independent-two",
    skillId,
    purpose: "independent-mastery",
    subject: "english",
    prompt: "Which choice completes the thought ‘Although the game ended’?",
    options: [
      { id: "option-independent-we-kept-practicing", text: "we kept practicing." },
      { id: "option-independent-after-dark", text: "after dark." },
      { id: "option-independent-on-field", text: "on the field." },
    ],
    correctOptionId: "option-independent-we-kept-practicing",
  }),
  multipleChoice({
    id: "english-independent-three",
    skillId,
    purpose: "independent-mastery",
    subject: "english",
    prompt: "Which group of words needs a predicate?",
    options: [
      { id: "option-independent-tall-tree", text: "The tall tree near the fence." },
      { id: "option-independent-tree-swayed", text: "The tree swayed in the wind." },
      { id: "option-independent-birds-landed", text: "Two birds landed." },
    ],
    correctOptionId: "option-independent-tall-tree",
  }),
];

const reassessmentItems = [
  multipleChoice({
    id: "english-reassessment-one",
    skillId,
    purpose: "reassessment",
    subject: "english",
    prompt: "Which choice is a complete sentence?",
    options: [
      { id: "option-reassessment-sun-rose", text: "The sun rose above the trees." },
      { id: "option-reassessment-before-breakfast", text: "Before breakfast." },
      { id: "option-reassessment-shining-brightly", text: "Shining brightly." },
    ],
    correctOptionId: "option-reassessment-sun-rose",
  }),
  multipleChoice({
    id: "english-reassessment-two",
    skillId,
    purpose: "reassessment",
    subject: "english",
    prompt: "What does ‘When the bell rang’ still need to become a complete sentence?",
    options: [
      { id: "option-reassessment-independent-clause", text: "An independent clause that completes the thought" },
      { id: "option-reassessment-another-when", text: "Another word like when" },
      { id: "option-reassessment-only-comma", text: "Only a comma" },
    ],
    correctOptionId: "option-reassessment-independent-clause",
  }),
];

const partsTurn = teachingTurn({
  id: "english-teach-subject-predicate",
  skillId,
  text: "First useful step: a complete sentence tells who or what, then tells what that subject does or is. Find the subject and predicate before checking punctuation.",
  boardCommands: [
    ...boardBase("english-board-parts", "Subject + predicate"),
    {
      id: "english-board-sentence-parts",
      kind: "show-sentence-parts",
      sentence: "The team walked outside.",
      subject: "The team",
      predicate: "walked outside",
      durationMs: 350,
      ariaLabel: "The subject is the team. The predicate is walked outside.",
    },
    {
      id: "english-board-parts-text",
      kind: "add-text",
      text: "The team | walked outside",
      region: "bottom",
      emphasis: "strong",
      durationMs: 200,
      ariaLabel: "The team is the subject and walked outside is the predicate",
    },
  ],
});

const dependentTurn = teachingTurn({
  id: "english-teach-dependent-marker",
  skillId,
  text: "Next useful step: words like because, although, when, and while can make a thought depend on another idea. Ask, ‘What happened because of that?’",
  boardCommands: [
    ...boardBase("english-board-dependent", "A thought that still leans"),
    {
      id: "english-board-dependent-parts",
      kind: "show-sentence-parts",
      sentence: "Because the rain stopped",
      subject: "the rain",
      predicate: "stopped",
      dependentMarker: "Because",
      durationMs: 350,
      ariaLabel: "Because is a dependent marker. The rain is the subject and stopped is the predicate, but the thought still needs completion.",
    },
    {
      id: "english-board-dependent-compare",
      kind: "compare",
      leftLabel: "Because the rain stopped",
      rightLabel: "we went outside",
      relationship: "complete-incomplete",
      durationMs: 300,
      ariaLabel: "The first group is incomplete alone and the second completes the thought",
    },
  ],
});

const alternateTurn = teachingTurn({
  id: "english-teach-question-test",
  skillId,
  text: "Alternate explanation: use the ‘complete thought’ test. Read the words, pause, and ask whether the listener is still waiting for important information.",
  boardCommands: [
    ...boardBase("english-board-question", "Is the listener still waiting?"),
    {
      id: "english-board-question-text-one",
      kind: "add-text",
      text: "Because the rain stopped … what happened next?",
      region: "center",
      emphasis: "strong",
      durationMs: 250,
      ariaLabel: "Because the rain stopped leaves the listener waiting for what happened next",
    },
    {
      id: "english-board-question-text-two",
      kind: "add-text",
      text: "Because the rain stopped, we went outside.",
      region: "bottom",
      emphasis: "normal",
      durationMs: 250,
      ariaLabel: "Because the rain stopped, we went outside is a complete thought",
    },
  ],
});

export const englishTutorProgram: TutorProgram = {
  id: "demo-english-complete-sentences",
  version: "0.2.0",
  title: "Sentence Completeness Demonstration",
  subject: "english",
  gradeBand: { min: 4, max: 6, label: "Grades 4–6" },
  locale: "en-US",
  targetSkillId: skillId,
  skillGraph: {
    id: "english-sentence-skill-graph",
    version: "0.2.0",
    nodes: [
      {
        id: "english-identify-verbs",
        title: "Identify verbs",
        description: "Identify action and linking verbs in simple sentences.",
        subject: "english",
        gradeBand: { min: 3, max: 5, label: "Grades 3–5" },
        observableEvidence: ["Locates the action or linking verb."],
      },
      {
        id: skillId,
        title: "Recognize complete sentences",
        description: "Recognize subjects, predicates, independent clauses, and sentence boundaries.",
        subject: "english",
        gradeBand: { min: 4, max: 6, label: "Grades 4–6" },
        observableEvidence: ["Identifies missing subjects or predicates.", "Recognizes dependent-clause fragments."],
      },
    ],
    edges: [
      {
        prerequisiteSkillId: "english-identify-verbs",
        dependentSkillId: skillId,
        strength: "recommended",
        rationale: "Recognizing a predicate is easier when the learner can locate a verb.",
      },
    ],
  },
  diagnosticItems,
  misconceptions: [
    {
      id: "english-dependent-clause-fragment",
      skillId,
      label: "Treats a dependent clause as complete",
      learnerSafeDescription: "You may be seeing a subject and verb and stopping before checking whether a word like because leaves the thought unfinished.",
      distinguishingEvidence: [
        {
          tag: "selects-dependent-clause",
          direction: "supports",
          weight: 1,
          explanation: "The learner selected a dependent clause fragment as complete.",
        },
        {
          tag: "recognizes-independent-clause",
          direction: "contradicts",
          weight: 1,
          explanation: "The learner recognized the clause that stands alone.",
        },
      ],
      alternateExplanations: ["Sentence parts", "Listener waiting test"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
    {
      id: "english-noun-phrase-as-sentence",
      skillId,
      label: "Treats a noun phrase as complete",
      learnerSafeDescription: "You may be finding the subject but not checking for a predicate that tells what the subject does or is.",
      distinguishingEvidence: [
        {
          tag: "selects-noun-phrase",
          direction: "supports",
          weight: 1,
          explanation: "The learner selected a noun phrase without a predicate.",
        },
        {
          tag: "identifies-missing-predicate",
          direction: "contradicts",
          weight: 1,
          explanation: "The learner correctly identified a missing predicate.",
        },
      ],
      alternateExplanations: ["Subject-predicate split", "Complete thought test"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
  ],
  teachingSequences: [
    { misconceptionId: "english-dependent-clause-fragment", turns: [dependentTurn, partsTurn] },
    { misconceptionId: "english-noun-phrase-as-sentence", turns: [partsTurn, dependentTurn] },
    { misconceptionId: "default", turns: [partsTurn, dependentTurn] },
    { misconceptionId: "default", turns: [alternateTurn] },
  ],
  guidedPractice: {
    id: "english-guided-contract",
    skillId,
    items: guidedItems,
    hintLadder: [
      {
        level: 1,
        prompt: "Find who or what the words are about, then find what that subject does or is.",
        revealsAnswer: false,
        visualSupportCommandIds: ["english-board-sentence-parts"],
      },
      {
        level: 2,
        prompt: "Check for because, although, when, or while. Ask whether the listener is still waiting.",
        revealsAnswer: false,
        visualSupportCommandIds: ["english-board-dependent-parts"],
      },
    ],
    maxSupportedAttemptsPerItem: 3,
    askLearnerToExplain: true,
    alternateExplanationAllowed: true,
    feedbackPolicy: "immediate",
  },
  independentMastery: {
    id: "english-independent-contract",
    skillId,
    items: independentItems,
    minimumEvidenceCount: 3,
    minimumDistinctContexts: 2,
    minimumMeanScore: 0.75,
    maximumUncertainty: 0.45,
    reassessmentRequired: true,
    singleAnswerCanEstablishMastery: false,
    supportsTeacherOverride: true,
    placementDecisionAllowed: false,
  },
  reassessmentItems,
  mediaFallback: defaultMediaFallback,
  persistentDifficultyCycleLimit: 2,
};

export const englishRuntimeHooks: Partial<TutorRuntimeHooks> = {
  evidenceTagsFor: (item, input, evaluation) => {
    const selected = input.selectedOptionIds?.[0] ?? "no-selection";
    const tags: StableId[] = [evaluation.score === 1 ? "recognizes-independent-clause" : "sentence-boundary-uncertain", item.id];
    if (["option-because-rain-stopped", "option-independent-while-waiting"].includes(selected)) {
      tags.push("selects-dependent-clause");
    }
    if (["option-running-through-puddles", "option-guided-blue-bicycle", "option-independent-loud-brown-dog"].includes(selected)) {
      tags.push("selects-noun-phrase");
    }
    if (selected === "option-missing-predicate") tags.push("identifies-missing-predicate");
    return tags;
  },
  feedbackFor: (_item, _input, evaluation) =>
    evaluation.score === 1
      ? "Yes. That choice has a complete subject-predicate thought."
      : "Not yet. Find the subject and predicate, then check whether a word like because leaves the thought unfinished.",
};

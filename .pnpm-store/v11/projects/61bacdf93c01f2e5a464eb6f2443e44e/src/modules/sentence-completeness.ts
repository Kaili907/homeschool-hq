import { boardBase } from "../helpers.js";
import { buildEnglishModule } from "../module-builder.js";

const lessonId = "english-sentence-completeness";
const skillId = "english-build-complete-sentences";
const gradeBand = { min: 3, max: 6, label: "Grades 3–6" };

const showCommands = [
  ...boardBase("english-sentence-show", "Subject + predicate + end mark"),
  {
    id: "english-sentence-show-parts",
    kind: "show-sentence-parts" as const,
    sentence: "The curious fox waited.",
    subject: "The curious fox",
    predicate: "waited",
    durationMs: 300,
    ariaLabel: "The curious fox is the subject, waited is the predicate, and a period ends the sentence",
  },
  {
    id: "english-sentence-show-check",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "First check: who or what is the sentence about?",
    durationMs: 250,
    ariaLabel: "First check: find who or what the sentence is about",
  },
];

const talkCommands = [
  ...boardBase("english-sentence-talk", "Three sentence checks"),
  {
    id: "english-sentence-talk-list",
    kind: "add-text" as const,
    text: "1. Subject  2. Predicate  3. Complete thought + fitting end mark",
    region: "center" as const,
    emphasis: "normal" as const,
    durationMs: 300,
    ariaLabel: "Check the subject, predicate, complete thought, and fitting end punctuation",
  },
];

const differentCommands = [
  ...boardBase("english-sentence-different", "A dependent opening"),
  {
    id: "english-sentence-different-parts",
    kind: "show-sentence-parts" as const,
    sentence: "When the rain stopped, we explored the trail.",
    subject: "we",
    predicate: "explored the trail",
    dependentMarker: "When",
    durationMs: 300,
    ariaLabel: "When introduces a dependent opening; we is the subject and explored the trail is the predicate of the complete thought",
  },
];

export const sentenceCompletenessModule = buildEnglishModule({
  lessonId,
  completedModuleName: "Sentence completeness, subjects, predicates, and punctuation",
  category: "writing",
  title: "Build Complete Sentences",
  gradeBand,
  targetSkill: {
    id: skillId,
    title: "Build and punctuate complete sentences",
    description: "Identify a subject and predicate, check that the thought is complete, and choose fitting end punctuation.",
    subject: "english",
    gradeBand,
    observableEvidence: ["Identifies subjects and predicates.", "Repairs fragments and selects fitting end punctuation."],
  },
  prerequisiteSkills: [
    {
      id: "english-identify-nouns-and-pronouns",
      title: "Identify nouns and pronouns",
      description: "Recognize words that can name who or what a sentence is about.",
      subject: "english",
      gradeBand: { min: 2, max: 4, label: "Grades 2–4" },
      observableEvidence: ["Points to the noun or pronoun acting as the subject."],
    },
    {
      id: "english-identify-verbs",
      title: "Identify verbs",
      description: "Recognize action and linking verbs that anchor predicates.",
      subject: "english",
      gradeBand: { min: 2, max: 5, label: "Grades 2–5" },
      observableEvidence: ["Locates an action or linking verb in a simple sentence."],
    },
  ],
  misconceptions: [
    {
      id: "english-sentence-punctuation-makes-complete",
      skillId,
      label: "Treats punctuation as enough to make a sentence complete",
      learnerSafeDescription: "You may be checking the end mark before checking whether the words contain a complete subject-predicate thought.",
      distinguishingEvidence: [
        { tag: "english-sentence-selects-punctuated-fragment", direction: "supports", weight: 1, explanation: "The learner selects a fragment because it ends with punctuation." },
        { tag: "english-sentence-checks-parts", direction: "contradicts", weight: 1, explanation: "The learner checks sentence parts before punctuation." },
      ],
      alternateExplanations: ["Subject-predicate color split", "Listener-is-waiting test"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
    {
      id: "english-sentence-dependent-fragment",
      skillId,
      label: "Treats a dependent thought as complete",
      learnerSafeDescription: "You may be noticing a subject and verb but not yet checking whether an opening word leaves the listener waiting.",
      distinguishingEvidence: [
        { tag: "english-sentence-selects-dependent-fragment", direction: "supports", weight: 1, explanation: "The learner selects a dependent clause as complete." },
        { tag: "english-sentence-completes-thought", direction: "contradicts", weight: 1, explanation: "The learner adds an independent thought." },
      ],
      alternateExplanations: ["Remove the opening marker test", "Ask what happened next"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
  ],
  diagnosticItems: [
    {
      id: "english-sentence-diagnostic-one",
      purpose: "diagnostic",
      prompt: "Which choice is a complete sentence?",
      choices: [
        { id: "english-sentence-d1-complete", text: "The lantern glowed brightly.", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-d1-fragment", text: "The bright lantern.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
        { id: "english-sentence-d1-dependent", text: "Because the lantern glowed.", evidenceTags: ["english-sentence-selects-dependent-fragment"] },
      ],
      reasoning: "The lantern is the subject, glowed brightly is the predicate, and the thought stands alone.",
    },
    {
      id: "english-sentence-diagnostic-two",
      purpose: "diagnostic",
      prompt: "What does ‘Although the bus arrived.’ need most?",
      choices: [
        { id: "english-sentence-d2-thought", text: "An independent thought that tells what happened", correct: true, evidenceTags: ["english-sentence-completes-thought"] },
        { id: "english-sentence-d2-mark", text: "A second period", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
        { id: "english-sentence-d2-none", text: "Nothing; the period makes it complete", evidenceTags: ["english-sentence-selects-dependent-fragment", "english-sentence-selects-punctuated-fragment"] },
      ],
      reasoning: "Although makes the clause depend on another idea, so punctuation alone does not complete it.",
    },
  ],
  guidedItems: [
    {
      id: "english-sentence-guided-one",
      purpose: "guided-practice",
      prompt: "Which predicate completes the subject ‘The small robot’?",
      choices: [
        { id: "english-sentence-g1-predicate", text: "rolled across the floor.", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-g1-detail", text: "with silver wheels.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
        { id: "english-sentence-g1-subject", text: "the machine.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
      ],
      reasoning: "Rolled across the floor tells what the robot did and creates a complete thought.",
    },
    {
      id: "english-sentence-guided-two",
      purpose: "guided-practice",
      prompt: "Which end mark fits the statement ‘Our class visits the museum tomorrow’?",
      choices: [
        { id: "english-sentence-g2-period", text: "A period", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-g2-question", text: "A question mark", evidenceTags: ["english-sentence-punctuation-uncertain"] },
        { id: "english-sentence-g2-none", text: "No end mark", evidenceTags: ["english-sentence-punctuation-uncertain"] },
      ],
      reasoning: "The sentence makes a statement, so a period is the fitting end mark.",
    },
  ],
  independentItems: [
    {
      id: "english-sentence-independent-one",
      purpose: "independent-mastery",
      prompt: "Which choice contains both a subject and a predicate?",
      choices: [
        { id: "english-sentence-i1-complete", text: "Two owls watched from the branch.", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-i1-noun", text: "Two owls on the branch.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
        { id: "english-sentence-i1-phrase", text: "Watching quietly.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
      ],
      reasoning: "Two owls is the subject and watched from the branch is the predicate.",
    },
    {
      id: "english-sentence-independent-two",
      purpose: "independent-mastery",
      prompt: "Which choice completes ‘When the final song ended’?",
      choices: [
        { id: "english-sentence-i2-clause", text: "the audience applauded.", correct: true, evidenceTags: ["english-sentence-completes-thought"] },
        { id: "english-sentence-i2-phrase", text: "after the concert.", evidenceTags: ["english-sentence-selects-dependent-fragment"] },
        { id: "english-sentence-i2-mark", text: "a period only.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
      ],
      reasoning: "The audience applauded is an independent thought that completes the dependent opening.",
    },
    {
      id: "english-sentence-independent-three",
      purpose: "independent-mastery",
      prompt: "Which punctuation correctly ends ‘Did you pack the map’?",
      choices: [
        { id: "english-sentence-i3-question", text: "A question mark", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-i3-period", text: "A period", evidenceTags: ["english-sentence-punctuation-uncertain"] },
        { id: "english-sentence-i3-comma", text: "A comma", evidenceTags: ["english-sentence-punctuation-uncertain"] },
      ],
      reasoning: "The sentence asks a direct question, so it ends with a question mark.",
    },
  ],
  reassessmentItems: [
    {
      id: "english-sentence-reassessment-one",
      purpose: "reassessment",
      prompt: "Which choice is a complete sentence?",
      choices: [
        { id: "english-sentence-r1-complete", text: "The seedlings grew beside the window.", correct: true, evidenceTags: ["english-sentence-checks-parts"] },
        { id: "english-sentence-r1-fragment", text: "The seedlings beside the window.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
        { id: "english-sentence-r1-dependent", text: "While the seedlings grew.", evidenceTags: ["english-sentence-selects-dependent-fragment"] },
      ],
      reasoning: "The seedlings is the subject and grew beside the window is the predicate; the thought stands alone.",
    },
    {
      id: "english-sentence-reassessment-two",
      purpose: "reassessment",
      prompt: "Which revision completes ‘Because the trail was muddy’?",
      choices: [
        { id: "english-sentence-r2-clause", text: "we wore our boots.", correct: true, evidenceTags: ["english-sentence-completes-thought"] },
        { id: "english-sentence-r2-detail", text: "after the storm.", evidenceTags: ["english-sentence-selects-dependent-fragment"] },
        { id: "english-sentence-r2-mark", text: "add only an exclamation point.", evidenceTags: ["english-sentence-selects-punctuated-fragment"] },
      ],
      reasoning: "We wore our boots supplies the independent subject-predicate thought the because clause needs.",
    },
  ],
  showMe: {
    text: "Show me: first locate who or what the words are about. In ‘The curious fox waited,’ the subject is ‘the curious fox.’",
    boardCommands: showCommands,
  },
  talkMeThroughIt: {
    text: "Talk me through it: find the subject, find what that subject does or is, ask whether the thought stands alone, and only then choose the end mark.",
    boardCommands: talkCommands,
  },
  differentExample: {
    text: "Different example: ‘When the rain stopped’ has a subject and verb, but when leaves us waiting. Add your own independent thought, then choose punctuation.",
    boardCommands: differentCommands,
  },
  distinguishingProbes: [
    {
      misconceptionId: "english-sentence-punctuation-makes-complete",
      assessmentItemIds: ["english-sentence-diagnostic-one", "english-sentence-diagnostic-two"],
      evidenceTags: ["english-sentence-selects-punctuated-fragment", "english-sentence-checks-parts"],
      interpretation: "Check whether the learner prioritizes punctuation over sentence structure.",
    },
    {
      misconceptionId: "english-sentence-dependent-fragment",
      assessmentItemIds: ["english-sentence-diagnostic-one", "english-sentence-diagnostic-two"],
      evidenceTags: ["english-sentence-selects-dependent-fragment", "english-sentence-completes-thought"],
      interpretation: "Check whether an opening dependent marker is recognized as leaving the thought unfinished.",
    },
  ],
  visualExplanationPlan: {
    purpose: "Reveal the subject, predicate, completeness check, and punctuation in that order.",
    boardCommandIds: showCommands.map((command) => command.id),
    revealOrder: ["Find the subject", "Find the predicate", "Test the thought", "Choose an end mark"],
    noVisualFallback: "Say each check aloud and pause after the subject and predicate so the learner can name each part.",
  },
  prerequisiteRemediation: [
    {
      prerequisiteSkillId: "english-identify-nouns-and-pronouns",
      trigger: "The learner cannot identify who or what a simple sentence is about.",
      learnerPrompt: "In ‘Birds sing,’ point to who or what the sentence is about.",
      completionEvidence: ["Identifies birds as the subject", "Finds the subject in a second simple sentence"],
      returnsToTargetSkill: true,
    },
    {
      prerequisiteSkillId: "english-identify-verbs",
      trigger: "The learner cannot locate what the subject does or is.",
      learnerPrompt: "In ‘Birds sing,’ point to the word that tells what birds do.",
      completionEvidence: ["Identifies sing as the verb", "Finds a verb in a second sentence"],
      returnsToTargetSkill: true,
    },
  ],
  parentTeacherNotes: {
    lookFor: ["Names the subject and predicate", "Notices dependent markers", "Chooses punctuation after checking meaning"],
    supportiveLanguage: ["Which part is already complete?", "What is the listener still waiting to hear?"],
    avoid: ["Calling grammar careless", "Replacing the learner’s entire sentence", "Treating one correction as mastery"],
    masteryReminder: "Look for accurate sentence decisions across statements, questions, fragments, and dependent openings.",
  },
  learnerAuthorshipPrompt: "Add or adjust only the part your sentence needs, keep the wording that sounds like you, and make the final revision yourself.",
});

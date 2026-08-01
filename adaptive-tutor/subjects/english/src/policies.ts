export const englishTutoringRules = {
  teachRatherThanRewrite: true,
  preserveStudentVoice: true,
  learnerMakesFinalRevision: true,
  oneUsefulStepAtATime: true,
  anotherExplanationAvailable: true,
  shameSpelling: false,
  shameGrammar: false,
  shameReadingLevel: false,
  shameVocabulary: false,
  diagnoseLearningDisability: false,
  completeGradedAssignments: false,
  claimMasteryFromOneResponse: false,
  requireCamera: false,
  requireIdentifiableChildPhotos: false,
} as const;

export const learnerSafetyLanguage = {
  uncertainty: "This is one piece of learning evidence, not a label or diagnosis.",
  retry: "That response gives us useful information. Let’s try one smaller step.",
  authorship: "Keep the ideas and wording that sound like you; you will make the final change.",
  gradedWork: "I can teach the strategy with a fresh example, but I will not complete graded work for you.",
} as const;

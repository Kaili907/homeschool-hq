import { boardBase } from "../helpers.js";
import { buildEnglishModule } from "../module-builder.js";

const lessonId = "english-decoding-multisyllable-words";
const skillId = "english-decode-multisyllable-words";
const gradeBand = { min: 4, max: 7, label: "Grades 4–7" };

const showCommands = [
  ...boardBase("english-decoding-show", "Find the meaningful chunks"),
  {
    id: "english-decoding-show-word",
    kind: "add-text" as const,
    text: "un | predict | able",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 250,
    ariaLabel: "The word unpredictable split into un, predict, and able",
  },
  {
    id: "english-decoding-show-step",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "Cover the prefix and suffix. Read the familiar base: predict.",
    durationMs: 300,
    ariaLabel: "Step one: cover un and able, then read predict",
  },
];

const talkCommands = [
  ...boardBase("english-decoding-talk", "Chunk, blend, check"),
  {
    id: "english-decoding-talk-steps",
    kind: "add-text" as const,
    text: "1. Mark affixes  2. Find vowel sounds  3. Blend  4. Check meaning",
    region: "center" as const,
    emphasis: "normal" as const,
    durationMs: 300,
    ariaLabel: "Mark affixes, find vowel sounds, blend the chunks, and check the meaning",
  },
];

const differentCommands = [
  ...boardBase("english-decoding-different", "A fresh word"),
  {
    id: "english-decoding-different-word",
    kind: "add-text" as const,
    text: "re | construct | ion",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 250,
    ariaLabel: "The word reconstruction split into re, construct, and ion",
  },
  {
    id: "english-decoding-different-step",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "Start with the base construct; then add re and ion.",
    durationMs: 250,
    ariaLabel: "Start with construct, then add the prefix re and suffix ion",
  },
];

export const decodingMultisyllableWordsModule = buildEnglishModule({
  lessonId,
  completedModuleName: "Decoding unfamiliar multisyllable words",
  category: "reading",
  title: "Decode Unfamiliar Multisyllable Words",
  gradeBand,
  targetSkill: {
    id: skillId,
    title: "Decode unfamiliar multisyllable words",
    description: "Use meaningful parts, vowel patterns, blending, and a meaning check to decode an unfamiliar long word.",
    subject: "english",
    gradeBand,
    observableEvidence: [
      "Marks useful prefixes, suffixes, bases, or syllable chunks.",
      "Blends chunks and checks whether the pronunciation makes sense in context.",
    ],
  },
  prerequisiteSkills: [
    {
      id: "english-identify-vowel-sounds",
      title: "Identify vowel sounds",
      description: "Locate likely vowel sounds that can anchor spoken syllables.",
      subject: "english",
      gradeBand: { min: 2, max: 5, label: "Grades 2–5" },
      observableEvidence: ["Marks at least one likely vowel sound in a printed word."],
    },
    {
      id: "english-recognize-common-affixes",
      title: "Recognize common affixes",
      description: "Recognize common prefixes and suffixes as meaningful word parts.",
      subject: "english",
      gradeBand: { min: 3, max: 6, label: "Grades 3–6" },
      observableEvidence: ["Identifies a familiar prefix or suffix in a new word."],
    },
  ],
  misconceptions: [
    {
      id: "english-decoding-first-part-guess",
      skillId,
      label: "Guesses from the first part",
      learnerSafeDescription: "You may be starting from the first few letters before checking every chunk and the sentence meaning.",
      distinguishingEvidence: [
        {
          tag: "english-decoding-guesses-first-part",
          direction: "supports",
          weight: 1,
          explanation: "The selected strategy uses only the beginning of the word.",
        },
        {
          tag: "english-decoding-checks-all-parts",
          direction: "contradicts",
          weight: 1,
          explanation: "The learner checks all chunks and meaning.",
        },
      ],
      alternateExplanations: ["Cover-and-reveal chunks", "Meaningful word-part map"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
    {
      id: "english-decoding-letter-by-letter",
      skillId,
      label: "Reads a long word letter by letter",
      learnerSafeDescription: "You may be holding too many separate letters instead of grouping them into pronounceable or meaningful chunks.",
      distinguishingEvidence: [
        {
          tag: "english-decoding-uses-single-letters",
          direction: "supports",
          weight: 1,
          explanation: "The selected strategy separates every letter.",
        },
        {
          tag: "english-decoding-uses-chunks",
          direction: "contradicts",
          weight: 1,
          explanation: "The learner groups the word into useful chunks.",
        },
      ],
      alternateExplanations: ["Tap one beat per spoken chunk", "Build from a familiar base"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
  ],
  diagnosticItems: [
    {
      id: "english-decoding-diagnostic-one",
      purpose: "diagnostic",
      prompt: "You meet the word ‘unpredictable.’ Which first move gives you the most useful information?",
      choices: [
        {
          id: "english-decoding-d1-chunks",
          text: "Mark un-, predict, and -able, then blend the parts.",
          correct: true,
          evidenceTags: ["english-decoding-checks-all-parts", "english-decoding-uses-chunks"],
        },
        {
          id: "english-decoding-d1-guess",
          text: "Guess a word that begins with unpr-.",
          evidenceTags: ["english-decoding-guesses-first-part"],
        },
        {
          id: "english-decoding-d1-letters",
          text: "Say every letter name without grouping them.",
          evidenceTags: ["english-decoding-uses-single-letters"],
        },
      ],
      reasoning: "Useful chunks reduce memory load and expose the familiar base predict plus meaningful affixes.",
    },
    {
      id: "english-decoding-diagnostic-two",
      purpose: "diagnostic",
      prompt: "Which chunking is most useful for reading ‘reconstruction’?",
      choices: [
        {
          id: "english-decoding-d2-useful",
          text: "re | construct | ion",
          correct: true,
          evidenceTags: ["english-decoding-uses-chunks", "english-decoding-checks-all-parts"],
        },
        {
          id: "english-decoding-d2-letters",
          text: "r | e | c | o | n | s | t | r | u | c | t | i | o | n",
          evidenceTags: ["english-decoding-uses-single-letters"],
        },
        {
          id: "english-decoding-d2-first",
          text: "recon | then guess the rest",
          evidenceTags: ["english-decoding-guesses-first-part"],
        },
      ],
      reasoning: "The split keeps the familiar base construct intact and separates two meaningful affixes.",
    },
  ],
  guidedItems: [
    {
      id: "english-decoding-guided-one",
      purpose: "guided-practice",
      prompt: "For ‘transportation,’ which part is the strongest familiar base to read first?",
      choices: [
        { id: "english-decoding-g1-port", text: "port", correct: true, evidenceTags: ["english-decoding-uses-chunks"] },
        { id: "english-decoding-g1-t", text: "the letter t", evidenceTags: ["english-decoding-uses-single-letters"] },
        { id: "english-decoding-g1-transp", text: "transp, then guess", evidenceTags: ["english-decoding-guesses-first-part"] },
      ],
      reasoning: "Port is a familiar meaningful base within trans-port-a-tion and supports accurate blending.",
    },
    {
      id: "english-decoding-guided-two",
      purpose: "guided-practice",
      prompt: "After blending ‘mis | under | stand | ing,’ what should you do next?",
      choices: [
        { id: "english-decoding-g2-context", text: "Check whether the word makes sense in the sentence.", correct: true, evidenceTags: ["english-decoding-checks-all-parts"] },
        { id: "english-decoding-g2-stop", text: "Stop after the first sound that seems possible.", evidenceTags: ["english-decoding-guesses-first-part"] },
        { id: "english-decoding-g2-spell", text: "Restart by naming every letter.", evidenceTags: ["english-decoding-uses-single-letters"] },
      ],
      reasoning: "A meaning check catches a blend that is pronounceable but does not fit the sentence.",
    },
  ],
  independentItems: [
    {
      id: "english-decoding-independent-one",
      purpose: "independent-mastery",
      prompt: "Which plan best supports decoding ‘disagreement’?",
      choices: [
        { id: "english-decoding-i1-plan", text: "Read dis | agree | ment, blend, then check meaning.", correct: true, evidenceTags: ["english-decoding-uses-chunks", "english-decoding-checks-all-parts"] },
        { id: "english-decoding-i1-guess", text: "Read dis- and guess a familiar word.", evidenceTags: ["english-decoding-guesses-first-part"] },
        { id: "english-decoding-i1-letters", text: "Use only separate letter names.", evidenceTags: ["english-decoding-uses-single-letters"] },
      ],
      reasoning: "The plan uses a prefix, base, and suffix, then verifies the result in context.",
    },
    {
      id: "english-decoding-independent-two",
      purpose: "independent-mastery",
      prompt: "Which split keeps the meaningful parts of ‘prepayment’ visible?",
      choices: [
        { id: "english-decoding-i2-parts", text: "pre | pay | ment", correct: true, evidenceTags: ["english-decoding-uses-chunks"] },
        { id: "english-decoding-i2-random", text: "prep | ay | ment", evidenceTags: ["english-decoding-uses-single-letters"] },
        { id: "english-decoding-i2-guess", text: "prepa | guess", evidenceTags: ["english-decoding-guesses-first-part"] },
      ],
      reasoning: "Pre-, pay, and -ment are recognizable parts that support both pronunciation and meaning.",
    },
    {
      id: "english-decoding-independent-three",
      purpose: "independent-mastery",
      prompt: "You blended ‘care | less | ness.’ Which check is most useful?",
      choices: [
        { id: "english-decoding-i3-meaning", text: "Ask whether carelessness fits the sentence meaning.", correct: true, evidenceTags: ["english-decoding-checks-all-parts"] },
        { id: "english-decoding-i3-first", text: "Use only the sound of care and ignore the ending.", evidenceTags: ["english-decoding-guesses-first-part"] },
        { id: "english-decoding-i3-letters", text: "Replace the chunks with separate letter names.", evidenceTags: ["english-decoding-uses-single-letters"] },
      ],
      reasoning: "Checking the complete word against context confirms both the blend and the suffixes.",
    },
  ],
  reassessmentItems: [
    {
      id: "english-decoding-reassessment-one",
      purpose: "reassessment",
      prompt: "Which first step is most useful for ‘international’?",
      choices: [
        { id: "english-decoding-r1-parts", text: "Mark inter | nation | al.", correct: true, evidenceTags: ["english-decoding-uses-chunks"] },
        { id: "english-decoding-r1-guess", text: "Guess after reading int-.", evidenceTags: ["english-decoding-guesses-first-part"] },
        { id: "english-decoding-r1-letters", text: "Name every letter only.", evidenceTags: ["english-decoding-uses-single-letters"] },
      ],
      reasoning: "The meaningful chunks support pronunciation and connect the word to nation.",
    },
    {
      id: "english-decoding-reassessment-two",
      purpose: "reassessment",
      prompt: "What completes a strong decoding routine after chunks have been blended?",
      choices: [
        { id: "english-decoding-r2-check", text: "Reread the sentence and check meaning.", correct: true, evidenceTags: ["english-decoding-checks-all-parts"] },
        { id: "english-decoding-r2-hide", text: "Ignore the sentence around the word.", evidenceTags: ["english-decoding-guesses-first-part"] },
        { id: "english-decoding-r2-restart", text: "Always restart letter by letter.", evidenceTags: ["english-decoding-uses-single-letters"] },
      ],
      reasoning: "Context provides a final accuracy check after word-part decoding.",
    },
  ],
  showMe: {
    text: "Show me: I’ll uncover one useful part at a time. In unpredictable, cover un- and -able first so the familiar base predict is easy to read.",
    boardCommands: showCommands,
  },
  talkMeThroughIt: {
    text: "Talk me through it: mark a familiar prefix or suffix, locate the vowel sounds in the remaining base, blend the chunks, then check the sentence meaning.",
    boardCommands: talkCommands,
  },
  differentExample: {
    text: "Different example: in reconstruction, start from construct, add re-, then add -ion. The same routine works even though the visible chunks are different.",
    boardCommands: differentCommands,
  },
  distinguishingProbes: [
    {
      misconceptionId: "english-decoding-first-part-guess",
      assessmentItemIds: ["english-decoding-diagnostic-one", "english-decoding-diagnostic-two"],
      evidenceTags: ["english-decoding-guesses-first-part", "english-decoding-checks-all-parts"],
      interpretation: "Contrast a first-letter guess with a full chunk-and-context routine.",
    },
    {
      misconceptionId: "english-decoding-letter-by-letter",
      assessmentItemIds: ["english-decoding-diagnostic-one", "english-decoding-diagnostic-two"],
      evidenceTags: ["english-decoding-uses-single-letters", "english-decoding-uses-chunks"],
      interpretation: "Check whether the learner groups letters into manageable spoken or meaningful parts.",
    },
  ],
  visualExplanationPlan: {
    purpose: "Make an unfamiliar long word visually smaller while keeping meaningful parts intact.",
    boardCommandIds: showCommands.map((command) => command.id),
    revealOrder: ["Display the whole word", "Separate affixes and base", "Read the base", "Blend and check meaning"],
    noVisualFallback: "Read the separators aloud: un, predict, able. Ask the learner to repeat and blend the three chunks.",
  },
  prerequisiteRemediation: [
    {
      prerequisiteSkillId: "english-identify-vowel-sounds",
      trigger: "The learner cannot locate a likely vowel sound in a short base word.",
      learnerPrompt: "Before the long word, mark the vowel sound in the short word ‘play.’",
      completionEvidence: ["Marks ay as the vowel team", "Reads play as one spoken beat"],
      returnsToTargetSkill: true,
    },
    {
      prerequisiteSkillId: "english-recognize-common-affixes",
      trigger: "The learner does not recognize a common prefix or suffix in two probes.",
      learnerPrompt: "Compare happy, unhappy, and replay. Point to un- and re- and tell what each part changes.",
      completionEvidence: ["Locates a common affix", "Explains that the affix changes meaning"],
      returnsToTargetSkill: true,
    },
  ],
  parentTeacherNotes: {
    lookFor: ["Uses chunks without over-segmenting", "Blends the whole word", "Checks the sentence meaning"],
    supportiveLanguage: ["Let’s make the word smaller.", "Which part already looks familiar?"],
    avoid: ["Calling the word easy", "Naming a reading level as a judgment", "Suggesting a disability diagnosis"],
    masteryReminder: "Require accurate decoding across several unfamiliar words and contexts; one correct word is not mastery.",
  },
  learnerAuthorshipPrompt: "Say the word using your own voice, explain which chunk helped, and make the final pronunciation choice after checking the sentence.",
});

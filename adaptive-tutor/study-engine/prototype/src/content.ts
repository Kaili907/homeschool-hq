export const LEARNING_SEGMENTS = [
  "warm-up",
  "visual-lesson",
  "guided-practice",
  "independent-attempt",
  "self-check",
  "exit-ticket",
] as const;

export type LearningSegmentId = (typeof LEARNING_SEGMENTS)[number];
export type SubjectId = "math" | "reading";
export type ResponseKind = "choice" | "short-text" | "long-text" | "reflection";
export type BoardKind =
  | "fraction-compare"
  | "fraction-build"
  | "fraction-prompt"
  | "fraction-exit"
  | "context-map"
  | "context-highlight"
  | "context-evidence"
  | "context-exit"
  | "reflection";

export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly detail?: string;
}

export interface SegmentDefinition {
  readonly id: LearningSegmentId;
  readonly navLabel: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly instruction: string;
  readonly prompt: string;
  readonly responseKind: ResponseKind;
  readonly boardKind: BoardKind;
  readonly choices?: readonly ChoiceOption[];
  readonly expectedAnswer?: string;
  readonly placeholder?: string;
  readonly minLength?: number;
  readonly hint: string;
  readonly anotherWay: string;
  readonly differentExample: string;
  readonly successMessage: string;
  readonly readAloudText: string;
}

export interface SessionDefinition {
  readonly id: SubjectId;
  readonly subject: string;
  readonly gradeBand: string;
  readonly lessonTitle: string;
  readonly dailyGoal: string;
  readonly goalDetail: string;
  readonly estimatedMinutes: number;
  readonly accent: string;
  readonly segments: Record<LearningSegmentId, SegmentDefinition>;
}

const mathSegments: Record<LearningSegmentId, SegmentDefinition> = {
  "warm-up": {
    id: "warm-up",
    navLabel: "Warm-up",
    eyebrow: "Warm-up retrieval",
    title: "Wake up what you already know",
    instruction: "Look for the fraction that names the same amount as one-half.",
    prompt: "Which fraction is equivalent to 1/2?",
    responseKind: "choice",
    boardKind: "fraction-compare",
    choices: [
      { value: "2/4", label: "2/4", detail: "Two of four equal parts" },
      { value: "1/3", label: "1/3", detail: "One of three equal parts" },
      { value: "3/4", label: "3/4", detail: "Three of four equal parts" },
    ],
    expectedAnswer: "2/4",
    hint: "Compare how much of each bar is shaded, not just the numbers.",
    anotherWay: "Imagine folding a half into two equal pieces. You now have two fourths.",
    differentExample: "One-half is also 3/6 because both fractions cover half of a whole.",
    successMessage: "Exactly. 1/2 and 2/4 cover the same amount.",
    readAloudText:
      "Which fraction is equivalent to one-half? Compare two-fourths, one-third, and three-fourths.",
  },
  "visual-lesson": {
    id: "visual-lesson",
    navLabel: "Visual lesson",
    eyebrow: "Short visual lesson",
    title: "Build an equivalent fraction",
    instruction:
      "When every part is split the same way, the shaded amount stays equal even though the numbers change.",
    prompt: "Use the board, then choose the fraction that matches 3/4.",
    responseKind: "choice",
    boardKind: "fraction-build",
    choices: [
      { value: "6/8", label: "6/8", detail: "Six shaded pieces out of eight" },
      { value: "4/8", label: "4/8", detail: "Four shaded pieces out of eight" },
      { value: "3/8", label: "3/8", detail: "Three shaded pieces out of eight" },
    ],
    expectedAnswer: "6/8",
    hint: "Each fourth was split into two. Multiply the top and bottom numbers by two.",
    anotherWay:
      "Think of cutting every slice in half. Three shaded slices become six smaller shaded slices.",
    differentExample: "2/3 becomes 4/6 when every third is split into two pieces.",
    successMessage: "You kept the amount equal: 3/4 = 6/8.",
    readAloudText:
      "Three-fourths is the same amount as six-eighths. Each fourth was split into two equal parts.",
  },
  "guided-practice": {
    id: "guided-practice",
    navLabel: "Practice together",
    eyebrow: "Guided practice",
    title: "Let’s do one together",
    instruction: "We will change sixths into thirds by grouping every two sixths.",
    prompt: "Complete the equation: 4/6 = ?/3",
    responseKind: "choice",
    boardKind: "fraction-prompt",
    choices: [
      { value: "1", label: "1", detail: "One third" },
      { value: "2", label: "2", detail: "Two thirds" },
      { value: "4", label: "4", detail: "Four thirds" },
    ],
    expectedAnswer: "2",
    hint: "Four sixths make two groups. Each group contains two sixths.",
    anotherWay: "Divide both 4 and 6 by 2. The new fraction is 2/3.",
    differentExample: "6/8 becomes 3/4 when both numbers are divided by 2.",
    successMessage: "Nice grouping. Four sixths is the same amount as two thirds.",
    readAloudText: "Complete the equation: four-sixths equals how many thirds?",
  },
  "independent-attempt": {
    id: "independent-attempt",
    navLabel: "Try it yourself",
    eyebrow: "Independent attempt",
    title: "Your turn",
    instruction: "Use the same rule on your own. You can still ask for a hint.",
    prompt: "Write a fraction with denominator 10 that is equivalent to 2/5.",
    responseKind: "short-text",
    boardKind: "fraction-prompt",
    expectedAnswer: "4/10",
    placeholder: "Type a fraction, like 3/6",
    hint: "Ask: what number changes 5 into 10? Do the same thing to 2.",
    anotherWay: "Draw five boxes, shade two, then split every box into two smaller boxes.",
    differentExample: "3/5 becomes 6/10 when both numbers are multiplied by 2.",
    successMessage: "You applied the rule independently: 2/5 = 4/10.",
    readAloudText:
      "Write a fraction with denominator ten that is equivalent to two-fifths.",
  },
  "self-check": {
    id: "self-check",
    navLabel: "Check your work",
    eyebrow: "Confidence and effort check",
    title: "Pause and notice how that felt",
    instruction:
      "There are no wrong answers here. These check-ins help Jarvis choose the right amount of support.",
    prompt: "Choose one answer for confidence, effort, and frustration.",
    responseKind: "reflection",
    boardKind: "reflection",
    hint: "Pick what feels true right now, not what you think anyone wants to hear.",
    anotherWay: "You can think of confidence as: could I explain one example to someone else?",
    differentExample: "High effort can happen with low frustration—or with high frustration.",
    successMessage: "Thanks for checking in. Your honest answers help set the pace.",
    readAloudText:
      "How confident do you feel, how much effort did you use, and how frustrated do you feel?",
  },
  "exit-ticket": {
    id: "exit-ticket",
    navLabel: "Finish",
    eyebrow: "Exit ticket",
    title: "One last quick check",
    instruction: "Use any strategy from today. This does not change a grade.",
    prompt: "Which fraction is equivalent to 2/3?",
    responseKind: "choice",
    boardKind: "fraction-exit",
    choices: [
      { value: "3/6", label: "3/6" },
      { value: "4/6", label: "4/6" },
      { value: "5/6", label: "5/6" },
    ],
    expectedAnswer: "4/6",
    hint: "Multiply both numbers in 2/3 by the same number.",
    anotherWay: "Two out of three becomes four out of six when every piece is split in half.",
    differentExample: "1/3 equals 2/6 using the same split.",
    successMessage: "That’s it. You finished the learning cycle.",
    readAloudText: "Which fraction is equivalent to two-thirds: three-sixths, four-sixths, or five-sixths?",
  },
};

const readingSegments: Record<LearningSegmentId, SegmentDefinition> = {
  "warm-up": {
    id: "warm-up",
    navLabel: "Warm-up",
    eyebrow: "Warm-up retrieval",
    title: "Spot a clue word",
    instruction: "Writers often place a contrast word near an unfamiliar word.",
    prompt: "Which word usually signals a contrast?",
    responseKind: "choice",
    boardKind: "context-map",
    choices: [
      { value: "however", label: "however", detail: "Signals a change or contrast" },
      { value: "because", label: "because", detail: "Signals a reason" },
      { value: "also", label: "also", detail: "Adds another idea" },
    ],
    expectedAnswer: "however",
    hint: "Look for the word that means the next idea may be different.",
    anotherWay: "Say each choice between two opposite ideas. Which one sounds natural?",
    differentExample: "The trail looked easy; however, the steep hill surprised us.",
    successMessage: "Right. “However” warns us that the idea is about to change.",
    readAloudText: "Which word usually signals a contrast: however, because, or also?",
  },
  "visual-lesson": {
    id: "visual-lesson",
    navLabel: "Visual lesson",
    eyebrow: "Short visual lesson",
    title: "Build a context-clue map",
    instruction:
      "Connect the unfamiliar word to nearby clues, then test a meaning that fits the whole sentence.",
    prompt:
      "Mara was reluctant to step onto the wobbly bridge. She hung back while the others crossed.",
    responseKind: "choice",
    boardKind: "context-highlight",
    choices: [
      { value: "hesitant", label: "hesitant", detail: "Unsure or slow to act" },
      { value: "excited", label: "excited", detail: "Eager to begin" },
      { value: "careless", label: "careless", detail: "Not paying attention" },
    ],
    expectedAnswer: "hesitant",
    hint: "What does “hung back” show Mara doing?",
    anotherWay: "Replace “reluctant” with each choice and listen for the meaning that fits.",
    differentExample: "Jon was famished, so he ate two sandwiches. “Famished” likely means very hungry.",
    successMessage: "Yes. “Hung back” helps us infer that reluctant means hesitant.",
    readAloudText:
      "Mara was reluctant to step onto the wobbly bridge. She hung back while the others crossed. What does reluctant mean?",
  },
  "guided-practice": {
    id: "guided-practice",
    navLabel: "Practice together",
    eyebrow: "Guided practice",
    title: "Let’s trace the evidence",
    instruction: "First find the clue, then choose the meaning it supports.",
    prompt:
      "The puppy was timid at first, hiding behind the chair, but soon it crept forward to sniff my hand.",
    responseKind: "choice",
    boardKind: "context-evidence",
    choices: [
      { value: "shy", label: "shy", detail: "The puppy hides, then approaches slowly" },
      { value: "noisy", label: "noisy", detail: "The sentence gives no sound clue" },
      { value: "hungry", label: "hungry", detail: "The sentence gives no food clue" },
    ],
    expectedAnswer: "shy",
    hint: "Focus on “hiding” and “crept forward.”",
    anotherWay: "Act out the puppy’s movements. What feeling would make you move that way?",
    differentExample: "A cautious cyclist slows before a sharp turn. “Slows” supports careful.",
    successMessage: "Good evidence. The puppy’s actions show that timid means shy.",
    readAloudText:
      "The puppy was timid at first, hiding behind the chair, but soon it crept forward to sniff my hand. What does timid mean?",
  },
  "independent-attempt": {
    id: "independent-attempt",
    navLabel: "Try it yourself",
    eyebrow: "Independent attempt",
    title: "Explain your inference",
    instruction: "Name the likely meaning and one nearby clue that supports it.",
    prompt:
      "After the long hike, Leila felt weary. She dropped her backpack and sank onto the first bench she saw.",
    responseKind: "long-text",
    boardKind: "context-evidence",
    minLength: 12,
    placeholder: "I think weary means… My clue is…",
    hint: "Notice what Leila does after the hike.",
    anotherWay: "Imagine her posture when she drops the backpack and sinks onto a bench.",
    differentExample:
      "“The room was dim, so Noor switched on a lamp.” The lamp is evidence that dim means not bright.",
    successMessage: "You made an inference and connected it to evidence from the sentence.",
    readAloudText:
      "After the long hike, Leila felt weary. She dropped her backpack and sank onto the first bench she saw. What does weary mean, and which clue supports your answer?",
  },
  "self-check": {
    id: "self-check",
    navLabel: "Check your work",
    eyebrow: "Confidence and effort check",
    title: "Pause and notice how that felt",
    instruction:
      "There are no wrong answers here. These check-ins help Jarvis choose the right amount of support.",
    prompt: "Choose one answer for confidence, effort, and frustration.",
    responseKind: "reflection",
    boardKind: "reflection",
    hint: "Pick what feels true right now, not what you think anyone wants to hear.",
    anotherWay: "Confidence can mean: could I point out a clue in one new sentence?",
    differentExample: "A task can feel frustrating even when you understand part of it.",
    successMessage: "Thanks for checking in. Your honest answers help set the pace.",
    readAloudText:
      "How confident do you feel, how much effort did you use, and how frustrated do you feel?",
  },
  "exit-ticket": {
    id: "exit-ticket",
    navLabel: "Finish",
    eyebrow: "Exit ticket",
    title: "One last quick check",
    instruction: "Choose the meaning best supported by the sentence.",
    prompt: "The glass ornament was fragile, so Emi wrapped it in three layers of soft paper.",
    responseKind: "choice",
    boardKind: "context-exit",
    choices: [
      { value: "valuable", label: "valuable" },
      { value: "easily-broken", label: "easily broken" },
      { value: "brightly-colored", label: "brightly colored" },
    ],
    expectedAnswer: "easily-broken",
    hint: "Why would Emi use three soft layers?",
    anotherWay: "Imagine what might happen without the paper.",
    differentExample: "A delicate shell needs gentle handling; delicate can mean easily damaged.",
    successMessage: "Exactly. The careful wrapping shows that fragile means easily broken.",
    readAloudText:
      "The glass ornament was fragile, so Emi wrapped it in three layers of soft paper. What does fragile mean?",
  },
};

export const SESSION_DEFINITIONS: Record<SubjectId, SessionDefinition> = {
  math: {
    id: "math",
    subject: "Mathematics",
    gradeBand: "Grades 4–6",
    lessonTitle: "Equivalent fractions",
    dailyGoal: "I can build and explain equivalent fractions.",
    goalDetail: "Use fraction models, then explain how the amount stays equal.",
    estimatedMinutes: 12,
    accent: "#ff9d45",
    segments: mathSegments,
  },
  reading: {
    id: "reading",
    subject: "Reading",
    gradeBand: "Grades 4–6",
    lessonTitle: "Context clues",
    dailyGoal: "I can infer a word’s meaning from nearby clues.",
    goalDetail: "Find a useful clue, test a meaning, and cite the evidence.",
    estimatedMinutes: 11,
    accent: "#64d9ff",
    segments: readingSegments,
  },
};

export const SEGMENT_INDEX: Record<LearningSegmentId, number> = Object.fromEntries(
  LEARNING_SEGMENTS.map((segment, index) => [segment, index]),
) as Record<LearningSegmentId, number>;

export function getNextSegment(segment: LearningSegmentId): LearningSegmentId | null {
  const next = SEGMENT_INDEX[segment] + 1;
  return LEARNING_SEGMENTS[next] ?? null;
}

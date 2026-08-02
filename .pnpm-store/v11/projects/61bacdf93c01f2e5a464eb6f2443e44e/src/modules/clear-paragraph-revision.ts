import { boardBase } from "../helpers.js";
import { buildEnglishModule } from "../module-builder.js";

const lessonId = "english-organize-revise-clear-paragraph";
const skillId = "english-organize-revise-paragraph";
const gradeBand = { min: 5, max: 8, label: "Grades 5–8" };

const showCommands = [
  ...boardBase("english-paragraph-show", "Keep the voice; clarify the path"),
  {
    id: "english-paragraph-show-map",
    kind: "add-text" as const,
    text: "Point → connected detail → explanation → closing",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 250,
    ariaLabel: "A clear paragraph moves from point to connected detail to explanation to closing",
  },
  {
    id: "english-paragraph-show-step",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "Underline the sentence that states your point. Do not rewrite the paragraph yet.",
    durationMs: 300,
    ariaLabel: "First underline the sentence that states your point without rewriting yet",
  },
];

const talkCommands = [
  ...boardBase("english-paragraph-talk", "One revision decision"),
  {
    id: "english-paragraph-talk-question",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "Ask: What do I want my reader to understand first?",
    durationMs: 250,
    ariaLabel: "Ask what the reader should understand first",
  },
];

const differentCommands = [
  ...boardBase("english-paragraph-different", "Move before rewriting"),
  {
    id: "english-paragraph-different-order",
    kind: "add-text" as const,
    text: "Draft order: detail, closing, point → Try: point, detail, closing",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 300,
    ariaLabel: "Move the point before the detail and closing instead of replacing the writer's words",
  },
];

export const clearParagraphRevisionModule = buildEnglishModule({
  lessonId,
  completedModuleName: "Organizing and revising a clear paragraph",
  category: "writing",
  title: "Organize and Revise a Clear Paragraph",
  gradeBand,
  targetSkill: {
    id: skillId,
    title: "Organize and revise a clear paragraph",
    description: "Clarify a paragraph’s point, order connected details, and make focused revisions while preserving the writer’s voice.",
    subject: "english",
    gradeBand,
    observableEvidence: ["Orders sentences around one controlling point.", "Makes a focused revision and explains how it helps the reader."],
  },
  prerequisiteSkills: [
    {
      id: "english-write-complete-sentences",
      title: "Write complete sentences",
      description: "Express a complete subject-predicate thought with fitting punctuation.",
      subject: "english",
      gradeBand: { min: 3, max: 6, label: "Grades 3–6" },
      observableEvidence: ["Writes a complete sentence that can stand alone."],
    },
    {
      id: "english-state-paragraph-point",
      title: "State a paragraph point",
      description: "Write a sentence that tells the reader the paragraph’s central point.",
      subject: "english",
      gradeBand: { min: 4, max: 7, label: "Grades 4–7" },
      observableEvidence: ["Identifies or drafts a focused point sentence."],
    },
  ],
  misconceptions: [
    {
      id: "english-paragraph-surface-only",
      skillId,
      label: "Revises only spelling or punctuation",
      learnerSafeDescription: "You may be proofreading individual words before checking whether the paragraph’s ideas follow a clear path.",
      distinguishingEvidence: [
        { tag: "english-paragraph-selects-surface-edit", direction: "supports", weight: 1, explanation: "The learner chooses a surface correction when organization is the larger need." },
        { tag: "english-paragraph-revises-organization", direction: "contradicts", weight: 1, explanation: "The learner changes the order or connection of ideas." },
      ],
      alternateExplanations: ["Paragraph path map", "Reader-first question"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
    {
      id: "english-paragraph-rewrite-erases-voice",
      skillId,
      label: "Replaces the writer’s voice instead of making a focused revision",
      learnerSafeDescription: "You may be changing every sentence when moving, adding, or clarifying one part would keep the writer’s ideas and voice.",
      distinguishingEvidence: [
        { tag: "english-paragraph-selects-full-rewrite", direction: "supports", weight: 1, explanation: "The response replaces the paragraph rather than targeting its need." },
        { tag: "english-paragraph-preserves-voice", direction: "contradicts", weight: 1, explanation: "The response keeps original ideas and wording where they already work." },
      ],
      alternateExplanations: ["Keep-move-add checklist", "One-change challenge"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
  ],
  diagnosticItems: [
    {
      id: "english-paragraph-diagnostic-one",
      purpose: "diagnostic",
      prompt: "Draft: ‘The trail had steep hills. Hiking with my aunt taught me to keep trying. At the top, we celebrated.’ Which revision should come first?",
      choices: [
        { id: "english-paragraph-d1-move", text: "Move the point about perseverance before the supporting details.", correct: true, evidenceTags: ["english-paragraph-revises-organization", "english-paragraph-preserves-voice"] },
        { id: "english-paragraph-d1-comma", text: "Change one comma even though the order stays unclear.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
        { id: "english-paragraph-d1-rewrite", text: "Replace every sentence with the tutor’s wording.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
      ],
      reasoning: "Moving the existing point gives the paragraph a clear path while preserving the writer’s ideas and wording.",
    },
    {
      id: "english-paragraph-diagnostic-two",
      purpose: "diagnostic",
      prompt: "A paragraph explains why a student values a neighborhood garden, but one sentence describes a video game. What is the most focused revision?",
      choices: [
        { id: "english-paragraph-d2-remove", text: "Remove or replace the unrelated sentence after the writer decides what fits.", correct: true, evidenceTags: ["english-paragraph-revises-organization", "english-paragraph-preserves-voice"] },
        { id: "english-paragraph-d2-spell", text: "Correct spelling only and keep every idea.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
        { id: "english-paragraph-d2-rewrite", text: "Ask the tutor to write a new paragraph.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
      ],
      reasoning: "A focused relevance decision improves unity without handing authorship to the tutor.",
    },
  ],
  guidedItems: [
    {
      id: "english-paragraph-guided-one",
      purpose: "guided-practice",
      prompt: "A paragraph begins with two examples and states its main point last. What is the smallest useful first revision?",
      choices: [
        { id: "english-paragraph-g1-move", text: "Try moving the point before the examples, then reread.", correct: true, evidenceTags: ["english-paragraph-revises-organization", "english-paragraph-preserves-voice"] },
        { id: "english-paragraph-g1-spell", text: "Change a correctly spelled word.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
        { id: "english-paragraph-g1-rewrite", text: "Replace all of the student’s sentences.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
      ],
      reasoning: "Testing one move makes the structure clearer while leaving the student in control of the final revision.",
    },
    {
      id: "english-paragraph-guided-two",
      purpose: "guided-practice",
      prompt: "Which question best checks whether a detail belongs in a paragraph?",
      choices: [
        { id: "english-paragraph-g2-connect", text: "How does this detail help explain my main point?", correct: true, evidenceTags: ["english-paragraph-revises-organization"] },
        { id: "english-paragraph-g2-long", text: "Is this the longest sentence?", evidenceTags: ["english-paragraph-selects-surface-edit"] },
        { id: "english-paragraph-g2-tutor", text: "Would a tutor write it differently?", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
      ],
      reasoning: "A supporting detail belongs when its connection to the paragraph’s point is clear.",
    },
  ],
  independentItems: [
    {
      id: "english-paragraph-independent-one",
      purpose: "independent-mastery",
      prompt: "Order these roles for a clear explanatory paragraph: closing, supporting detail, point sentence. Which order is strongest?",
      choices: [
        { id: "english-paragraph-i1-order", text: "Point sentence → supporting detail → closing", correct: true, evidenceTags: ["english-paragraph-revises-organization"] },
        { id: "english-paragraph-i1-random", text: "Closing → point sentence → supporting detail", evidenceTags: ["english-paragraph-organization-uncertain"] },
        { id: "english-paragraph-i1-surface", text: "The order does not matter if spelling is correct.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
      ],
      reasoning: "The order introduces the point, develops it, and gives the reader a purposeful ending.",
    },
    {
      id: "english-paragraph-independent-two",
      purpose: "independent-mastery",
      prompt: "A writer’s paragraph is clear except for one vague transition. Which response preserves the writer’s voice?",
      choices: [
        { id: "english-paragraph-i2-choice", text: "Offer transition choices and ask the writer to select or create the final wording.", correct: true, evidenceTags: ["english-paragraph-preserves-voice"] },
        { id: "english-paragraph-i2-rewrite", text: "Replace the entire paragraph without asking.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
        { id: "english-paragraph-i2-ignore", text: "Correct punctuation only and ignore the connection.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
      ],
      reasoning: "Choices teach the connection while leaving the final language and decision with the writer.",
    },
    {
      id: "english-paragraph-independent-three",
      purpose: "independent-mastery",
      prompt: "Which revision note teaches instead of rewriting?",
      choices: [
        { id: "english-paragraph-i3-teach", text: "Your second detail shifts topics. Decide whether to connect it to your point or remove it.", correct: true, evidenceTags: ["english-paragraph-revises-organization", "english-paragraph-preserves-voice"] },
        { id: "english-paragraph-i3-replace", text: "Here is a completely new paragraph to submit.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
        { id: "english-paragraph-i3-mark", text: "Only fix one capital letter.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
      ],
      reasoning: "The note names the reader problem and gives the learner ownership of the revision choice.",
    },
  ],
  reassessmentItems: [
    {
      id: "english-paragraph-reassessment-one",
      purpose: "reassessment",
      prompt: "A paragraph’s examples are relevant, but the main point is missing. What should the writer do?",
      choices: [
        { id: "english-paragraph-r1-draft", text: "Draft a point sentence in their own voice, then check each example against it.", correct: true, evidenceTags: ["english-paragraph-revises-organization", "english-paragraph-preserves-voice"] },
        { id: "english-paragraph-r1-proof", text: "Proofread commas only.", evidenceTags: ["english-paragraph-selects-surface-edit"] },
        { id: "english-paragraph-r1-copy", text: "Copy a complete paragraph from the tutor.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
      ],
      reasoning: "The writer supplies the controlling point, then uses it to test organization and relevance.",
    },
    {
      id: "english-paragraph-reassessment-two",
      purpose: "reassessment",
      prompt: "After moving one sentence, what is the most useful next step?",
      choices: [
        { id: "english-paragraph-r2-reread", text: "Reread and decide whether the ideas now connect clearly.", correct: true, evidenceTags: ["english-paragraph-revises-organization"] },
        { id: "english-paragraph-r2-replace", text: "Replace every remaining sentence.", evidenceTags: ["english-paragraph-selects-full-rewrite"] },
        { id: "english-paragraph-r2-master", text: "Declare mastery from that one change.", evidenceTags: ["english-paragraph-mastery-overclaim"] },
      ],
      reasoning: "Rereading tests the effect of the focused move before another revision decision is made.",
    },
  ],
  showMe: {
    text: "Show me: I will not rewrite your paragraph. First, underline the sentence that states your point so we can see the path your details should follow.",
    boardCommands: showCommands,
  },
  talkMeThroughIt: {
    text: "Talk me through it: tell me what you want the reader to understand first. Then we will test one sentence at a time against that point, and you will choose the final revision.",
    boardCommands: talkCommands,
  },
  differentExample: {
    text: "Different example: if a draft gives a detail, then a closing, then its point, try moving the existing point first. Keep the wording that still sounds like the writer.",
    boardCommands: differentCommands,
  },
  distinguishingProbes: [
    {
      misconceptionId: "english-paragraph-surface-only",
      assessmentItemIds: ["english-paragraph-diagnostic-one", "english-paragraph-diagnostic-two"],
      evidenceTags: ["english-paragraph-selects-surface-edit", "english-paragraph-revises-organization"],
      interpretation: "Contrast proofreading with a revision that changes the path or relevance of ideas.",
    },
    {
      misconceptionId: "english-paragraph-rewrite-erases-voice",
      assessmentItemIds: ["english-paragraph-diagnostic-one", "english-paragraph-diagnostic-two"],
      evidenceTags: ["english-paragraph-selects-full-rewrite", "english-paragraph-preserves-voice"],
      interpretation: "Check whether the learner can target one need without replacing the writer’s wording and decisions.",
    },
  ],
  visualExplanationPlan: {
    purpose: "Show paragraph organization as a path while keeping the student’s original wording visible.",
    boardCommandIds: showCommands.map((command) => command.id),
    revealOrder: ["Underline the point", "Link each detail", "Move or clarify one part", "Learner rereads and makes the final revision"],
    noVisualFallback: "Read the paragraph aloud sentence by sentence and use the oral labels point, detail, explanation, and closing.",
  },
  prerequisiteRemediation: [
    {
      prerequisiteSkillId: "english-write-complete-sentences",
      trigger: "The learner’s idea cannot yet be expressed as a complete sentence.",
      learnerPrompt: "Say who or what your sentence is about, then say what that subject does or is.",
      completionEvidence: ["States a subject", "Adds a predicate to complete the thought"],
      returnsToTargetSkill: true,
    },
    {
      prerequisiteSkillId: "english-state-paragraph-point",
      trigger: "The learner cannot say what the paragraph should help a reader understand.",
      learnerPrompt: "Finish this frame in your own words: I want my reader to understand that ___.",
      completionEvidence: ["States one focused idea", "Connects at least one existing detail to that idea"],
      returnsToTargetSkill: true,
    },
  ],
  parentTeacherNotes: {
    lookFor: ["Can state the paragraph’s point", "Moves or clarifies one part at a time", "Keeps ownership of wording and final decisions"],
    supportiveLanguage: ["What do you want the reader to understand?", "Which words already sound right to you?"],
    avoid: ["Rewriting the paragraph for the learner", "Calling grammar or spelling careless", "Equating one clean draft with mastery"],
    masteryReminder: "Look for independent organization and revision across multiple purposes and drafts, followed by fresh reassessment.",
  },
  learnerAuthorshipPrompt: "Choose one move, addition, or clarification; keep the parts that sound like you; then type the final revision in your own words.",
});

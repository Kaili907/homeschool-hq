import { boardBase } from "../helpers.js";
import { buildEnglishModule } from "../module-builder.js";

const lessonId = "english-main-idea-supporting-details";
const skillId = "english-identify-main-idea-details";
const gradeBand = { min: 4, max: 7, label: "Grades 4–7" };

const showCommands = [
  ...boardBase("english-main-idea-show", "Topic + author’s point"),
  {
    id: "english-main-idea-show-topic",
    kind: "add-text" as const,
    text: "Topic: city trees",
    region: "top" as const,
    emphasis: "muted" as const,
    durationMs: 200,
    ariaLabel: "The topic is city trees",
  },
  {
    id: "english-main-idea-show-idea",
    kind: "add-text" as const,
    text: "Main idea: City trees make neighborhoods cooler and healthier.",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 250,
    ariaLabel: "The main idea is that city trees make neighborhoods cooler and healthier",
  },
  {
    id: "english-main-idea-show-detail",
    kind: "add-text" as const,
    text: "Detail: Their shade lowers pavement temperatures.",
    region: "bottom" as const,
    emphasis: "normal" as const,
    durationMs: 250,
    ariaLabel: "Shade lowering pavement temperatures supports the main idea",
  },
];

const talkCommands = [
  ...boardBase("english-main-idea-talk", "The every-detail test"),
  {
    id: "english-main-idea-talk-test",
    kind: "reveal-step" as const,
    stepNumber: 1,
    text: "Ask: Which idea is supported by most of the important details?",
    durationMs: 300,
    ariaLabel: "Ask which idea is supported by most important details",
  },
];

const differentCommands = [
  ...boardBase("english-main-idea-different", "A fresh passage map"),
  {
    id: "english-main-idea-different-map",
    kind: "add-text" as const,
    text: "School garden → science observations + fresh food + teamwork",
    region: "center" as const,
    emphasis: "strong" as const,
    durationMs: 300,
    ariaLabel: "A school garden supports science observations, fresh food, and teamwork",
  },
];

const passageTrees =
  "Trees shade sidewalks on hot days. Their leaves trap some air pollution. Tree roots also slow rainwater before it reaches storm drains.";
const passageLibrary =
  "The library added quiet study rooms, longer weekend hours, and free tutoring. More students now use the building after school.";
const passageBees =
  "Bees carry pollen between flowers. This helps many plants produce fruits and seeds. Farms and wild habitats both depend on that work.";

export const mainIdeaSupportingDetailsModule = buildEnglishModule({
  lessonId,
  completedModuleName: "Main idea and supporting details",
  category: "reading",
  title: "Find the Main Idea and Supporting Details",
  gradeBand,
  targetSkill: {
    id: skillId,
    title: "Identify a main idea and supporting details",
    description: "State what an informational passage says about its topic and select details that directly support that idea.",
    subject: "english",
    gradeBand,
    observableEvidence: ["States a complete main idea, not only a topic.", "Connects multiple relevant details to the main idea."],
  },
  prerequisiteSkills: [
    {
      id: "english-identify-passage-topic",
      title: "Identify the passage topic",
      description: "Name the person, place, thing, or idea a passage is mostly about.",
      subject: "english",
      gradeBand: { min: 2, max: 5, label: "Grades 2–5" },
      observableEvidence: ["Names the shared topic of several sentences."],
    },
    {
      id: "english-recall-explicit-details",
      title: "Recall explicit details",
      description: "Locate information stated directly in a short passage.",
      subject: "english",
      gradeBand: { min: 2, max: 5, label: "Grades 2–5" },
      observableEvidence: ["Points to a sentence that states a requested fact."],
    },
  ],
  misconceptions: [
    {
      id: "english-main-idea-topic-only",
      skillId,
      label: "Names only the topic",
      learnerSafeDescription: "You may be naming what the passage is about without yet stating what the author wants us to understand about it.",
      distinguishingEvidence: [
        { tag: "english-main-idea-selects-topic-only", direction: "supports", weight: 1, explanation: "The response names a topic but makes no point about it." },
        { tag: "english-main-idea-states-point", direction: "contradicts", weight: 1, explanation: "The response states a supported point about the topic." },
      ],
      alternateExplanations: ["Topic-plus-point frame", "Headline test"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
    {
      id: "english-main-idea-interesting-detail",
      skillId,
      label: "Chooses one interesting detail as the main idea",
      learnerSafeDescription: "You may be choosing a memorable fact before checking whether the other important details also support it.",
      distinguishingEvidence: [
        { tag: "english-main-idea-selects-single-detail", direction: "supports", weight: 1, explanation: "The response repeats one detail too narrow for the passage." },
        { tag: "english-main-idea-connects-details", direction: "contradicts", weight: 1, explanation: "The response is supported by multiple details." },
      ],
      alternateExplanations: ["Umbrella idea", "Every-detail test"],
      minimumEvidenceCount: 1,
      escalationAfterRepeatedCycles: 2,
    },
  ],
  diagnosticItems: [
    {
      id: "english-main-idea-diagnostic-one",
      purpose: "diagnostic",
      prompt: `${passageTrees} What is the main idea?`,
      choices: [
        { id: "english-main-idea-d1-point", text: "City trees improve neighborhoods in several ways.", correct: true, evidenceTags: ["english-main-idea-states-point", "english-main-idea-connects-details"] },
        { id: "english-main-idea-d1-topic", text: "Trees", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-d1-detail", text: "Tree roots slow rainwater.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "The first choice covers shade, cleaner air, and slower rainwater; the others are only a topic or one detail.",
    },
    {
      id: "english-main-idea-diagnostic-two",
      purpose: "diagnostic",
      prompt: `${passageLibrary} Which detail best supports the idea that the library is more useful after school?`,
      choices: [
        { id: "english-main-idea-d2-hours", text: "It added longer weekend hours and free tutoring.", correct: true, evidenceTags: ["english-main-idea-connects-details"] },
        { id: "english-main-idea-d2-building", text: "The passage mentions a building.", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-d2-rooms", text: "The rooms are quiet.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "Longer access and tutoring directly explain why the library serves students after school.",
    },
  ],
  guidedItems: [
    {
      id: "english-main-idea-guided-one",
      purpose: "guided-practice",
      prompt: `${passageBees} Which main idea works as an umbrella over all three sentences?`,
      choices: [
        { id: "english-main-idea-g1-umbrella", text: "Bees’ pollination supports plant life and food systems.", correct: true, evidenceTags: ["english-main-idea-states-point", "english-main-idea-connects-details"] },
        { id: "english-main-idea-g1-topic", text: "Bees", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-g1-detail", text: "Some plants make fruit.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "The umbrella idea explains the pollen transfer, fruits and seeds, farms, and habitats.",
    },
    {
      id: "english-main-idea-guided-two",
      purpose: "guided-practice",
      prompt: "A passage explains that a school garden provides science observations, fresh food, and teamwork. Which is a supporting detail?",
      choices: [
        { id: "english-main-idea-g2-detail", text: "Students measure plant growth during science.", correct: true, evidenceTags: ["english-main-idea-connects-details"] },
        { id: "english-main-idea-g2-topic", text: "Gardens", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-g2-unrelated", text: "The gym floor was polished yesterday.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "Measuring plant growth directly supports the garden’s value for science observations.",
    },
  ],
  independentItems: [
    {
      id: "english-main-idea-independent-one",
      purpose: "independent-mastery",
      prompt: "A passage describes bike lanes reducing traffic conflicts, encouraging exercise, and connecting neighborhoods. What is the main idea?",
      choices: [
        { id: "english-main-idea-i1-point", text: "Bike lanes can make city travel safer, healthier, and more connected.", correct: true, evidenceTags: ["english-main-idea-states-point", "english-main-idea-connects-details"] },
        { id: "english-main-idea-i1-topic", text: "Bicycles", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-i1-detail", text: "Exercise is healthy.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "The complete idea includes the safety, health, and connection details.",
    },
    {
      id: "english-main-idea-independent-two",
      purpose: "independent-mastery",
      prompt: "A passage says wetlands absorb floodwater, filter pollutants, and shelter wildlife. Which detail supports the passage’s main idea?",
      choices: [
        { id: "english-main-idea-i2-detail", text: "Wetland plants help remove pollutants from water.", correct: true, evidenceTags: ["english-main-idea-connects-details"] },
        { id: "english-main-idea-i2-topic", text: "Water", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-i2-unrelated", text: "Some deserts receive little rain.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "Filtering pollutants directly supports the idea that wetlands provide several environmental services.",
    },
    {
      id: "english-main-idea-independent-three",
      purpose: "independent-mastery",
      prompt: "A passage explains how rehearsal helps actors remember lines, coordinate movement, and build confidence. Which summary states the main idea?",
      choices: [
        { id: "english-main-idea-i3-point", text: "Rehearsal prepares actors for several parts of a performance.", correct: true, evidenceTags: ["english-main-idea-states-point", "english-main-idea-connects-details"] },
        { id: "english-main-idea-i3-topic", text: "Actors", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-i3-detail", text: "Actors learn lines.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "The first choice includes the shared purpose of all three rehearsal details.",
    },
  ],
  reassessmentItems: [
    {
      id: "english-main-idea-reassessment-one",
      purpose: "reassessment",
      prompt: "A passage explains that community markets support local farmers, shorten food travel, and create neighborhood gathering places. What is the main idea?",
      choices: [
        { id: "english-main-idea-r1-point", text: "Community markets benefit both local food systems and neighborhoods.", correct: true, evidenceTags: ["english-main-idea-states-point", "english-main-idea-connects-details"] },
        { id: "english-main-idea-r1-topic", text: "Markets", evidenceTags: ["english-main-idea-selects-topic-only"] },
        { id: "english-main-idea-r1-detail", text: "Food travels a shorter distance.", evidenceTags: ["english-main-idea-selects-single-detail"] },
      ],
      reasoning: "The main idea covers farmers, food travel, and neighborhood connection.",
    },
    {
      id: "english-main-idea-reassessment-two",
      purpose: "reassessment",
      prompt: "Which question best checks whether a detail supports a main idea?",
      choices: [
        { id: "english-main-idea-r2-check", text: "Does this detail explain or prove part of the main idea?", correct: true, evidenceTags: ["english-main-idea-connects-details"] },
        { id: "english-main-idea-r2-interest", text: "Is this the most surprising sentence?", evidenceTags: ["english-main-idea-selects-single-detail"] },
        { id: "english-main-idea-r2-topic", text: "Does this detail repeat the topic word?", evidenceTags: ["english-main-idea-selects-topic-only"] },
      ],
      reasoning: "Support depends on an explanatory connection, not surprise or repeated vocabulary.",
    },
  ],
  showMe: {
    text: "Show me: name the topic, then add what the author wants us to understand about it. ‘City trees’ is only the topic; the main idea explains their benefits.",
    boardCommands: showCommands,
  },
  talkMeThroughIt: {
    text: "Talk me through it: after naming the topic, test each possible main idea against the important details. Keep the idea that works as an umbrella over most of them.",
    boardCommands: talkCommands,
  },
  differentExample: {
    text: "Different example: science observations, fresh food, and teamwork all fit under one idea—that a school garden helps a school in several ways.",
    boardCommands: differentCommands,
  },
  distinguishingProbes: [
    {
      misconceptionId: "english-main-idea-topic-only",
      assessmentItemIds: ["english-main-idea-diagnostic-one"],
      evidenceTags: ["english-main-idea-selects-topic-only", "english-main-idea-states-point"],
      interpretation: "Contrast a one-word topic with a complete point about that topic.",
    },
    {
      misconceptionId: "english-main-idea-interesting-detail",
      assessmentItemIds: ["english-main-idea-diagnostic-one", "english-main-idea-diagnostic-two"],
      evidenceTags: ["english-main-idea-selects-single-detail", "english-main-idea-connects-details"],
      interpretation: "Check whether the chosen idea accounts for several important details rather than one memorable fact.",
    },
  ],
  visualExplanationPlan: {
    purpose: "Separate the topic, the author’s point, and evidence so their relationships are visible.",
    boardCommandIds: showCommands.map((command) => command.id),
    revealOrder: ["Name the topic", "State a point about it", "Attach supporting details", "Reject details that do not connect"],
    noVisualFallback: "Use the oral frame: The passage is about ___. The author wants me to understand ___. I know because ___.",
  },
  prerequisiteRemediation: [
    {
      prerequisiteSkillId: "english-identify-passage-topic",
      trigger: "The learner names unrelated ideas or cannot find what several sentences share.",
      learnerPrompt: "Read three short sentences and name the person, place, thing, or idea they all mention.",
      completionEvidence: ["Names the shared topic", "Explains which words repeat or refer to it"],
      returnsToTargetSkill: true,
    },
    {
      prerequisiteSkillId: "english-recall-explicit-details",
      trigger: "The learner cannot locate a fact stated directly in the passage.",
      learnerPrompt: "Point to the exact sentence that tells what the tree roots do.",
      completionEvidence: ["Locates an explicit detail", "Restates the detail without changing its meaning"],
      returnsToTargetSkill: true,
    },
  ],
  parentTeacherNotes: {
    lookFor: ["States a complete point", "Uses more than one relevant detail", "Explains how a detail supports the idea"],
    supportiveLanguage: ["That is the topic; what does the author say about it?", "Which details fit under your idea?"],
    avoid: ["Treating a one-word topic as a full main idea", "Praising speed over evidence", "Assigning a reading-level label"],
    masteryReminder: "Require transfer across several unfamiliar informational passages; one successful selection is insufficient.",
  },
  learnerAuthorshipPrompt: "State the main idea in your own words and choose the details you think best support it; the tutor will not replace your explanation.",
});

export interface PromptTemplate {
  id: string;
  purpose: string;
  system: string;
  userTemplate: string;
  requiredVariables: string[];
}

const sharedTutorRules = `You are Jarvis, an AI tutoring interface, not a human.
Teach instead of simply giving answers. Reveal one useful step at a time. Ask the learner to participate.
Never shame mistakes or label the learner lazy, behind, incapable, or bad at a subject.
Do not diagnose disabilities or medical conditions. Do not request identifying information or camera access.
Do not complete graded work. Do not claim mastery from one answer. Permit alternate explanations.
Make uncertainty explicit. Escalate disputed grading or persistent difficulty to a parent or teacher.
Do not make high-stakes placement decisions.`;

export const promptTemplates: readonly PromptTemplate[] = [
  {
    id: "prompt-diagnostic-classification",
    purpose: "Classify a likely missing concept from bounded response evidence.",
    system: sharedTutorRules,
    userTemplate:
      "Target skill: {{skill}}\nApproved misconception definitions: {{misconceptions}}\nResponse evidence: {{evidence}}\nReturn ranked hypotheses, counterevidence, uncertainty, and the next neutral probe. Do not diagnose.",
    requiredVariables: ["skill", "misconceptions", "evidence"],
  },
  {
    id: "prompt-visual-teaching-turn",
    purpose: "Generate one learner-visible teaching turn and board commands.",
    system: sharedTutorRules,
    userTemplate:
      "Teach {{concept}} using approved visual primitives {{visualPrimitives}}. Prior learner response: {{response}}. Give exactly one useful step, ask one participation question, and include a no-media text fallback.",
    requiredVariables: ["concept", "visualPrimitives", "response"],
  },
  {
    id: "prompt-guided-feedback",
    purpose: "Give supportive feedback without revealing too much.",
    system: sharedTutorRules,
    userTemplate:
      "Item: {{item}}\nLearner response: {{response}}\nEvaluation: {{evaluation}}\nHint level: {{hintLevel}}\nAcknowledge useful reasoning, correct the smallest needed part, and ask the learner to try the next step.",
    requiredVariables: ["item", "response", "evaluation", "hintLevel"],
  },
  {
    id: "prompt-review-summary",
    purpose: "Summarize evidence for an adult review without placement claims.",
    system: sharedTutorRules,
    userTemplate:
      "Skill: {{skill}}\nEvidence summary: {{evidence}}\nConfidence: {{confidence}}\nMisconception hypotheses: {{hypotheses}}\nWrite strengths, support needs, next steps, uncertainty, and escalation flags. Never make a diagnosis or placement decision.",
    requiredVariables: ["skill", "evidence", "confidence", "hypotheses"],
  },
];

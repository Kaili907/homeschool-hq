import {
  MASTERY_STATE_LABELS,
  type MasteryState,
} from "../../../adaptive-learning/mastery/index.js";

export interface MasteryStatePresentation {
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly symbol: string;
}

export const MASTERY_STATE_ORDER: readonly MasteryState[] = [
  "mastered",
  "currently_learning",
  "needs_reinforcement",
  "blocked_by_prerequisite",
  "not_yet_assessed",
  "evidence_uncertain",
];

export const MASTERY_STATE_PRESENTATION: Readonly<
  Record<MasteryState, MasteryStatePresentation>
> = {
  mastered: {
    label: MASTERY_STATE_LABELS.mastered,
    shortLabel: "Mastered",
    description: "Independent performance has met the mastery rule.",
    symbol: "✓",
  },
  currently_learning: {
    label: MASTERY_STATE_LABELS.currently_learning,
    shortLabel: "Learning",
    description: "Instruction and practice are in progress.",
    symbol: "→",
  },
  needs_reinforcement: {
    label: MASTERY_STATE_LABELS.needs_reinforcement,
    shortLabel: "Reinforce",
    description: "Prior learning needs a fresh independent check.",
    symbol: "↺",
  },
  blocked_by_prerequisite: {
    label: MASTERY_STATE_LABELS.blocked_by_prerequisite,
    shortLabel: "Blocked",
    description: "A named prerequisite should be strengthened first.",
    symbol: "!",
  },
  not_yet_assessed: {
    label: MASTERY_STATE_LABELS.not_yet_assessed,
    shortLabel: "Not assessed",
    description: "There is not yet performance evidence for this skill.",
    symbol: "○",
  },
  evidence_uncertain: {
    label: MASTERY_STATE_LABELS.evidence_uncertain,
    shortLabel: "Uncertain",
    description: "Available evidence is sparse, mixed, or support-dependent.",
    symbol: "?",
  },
};

export function getMasteryStatePresentation(
  state: MasteryState,
): MasteryStatePresentation {
  return MASTERY_STATE_PRESENTATION[state];
}


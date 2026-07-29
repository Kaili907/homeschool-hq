import {
  asEvidenceId,
  asOverrideId,
  asSkillId,
  asStudentId,
  type MasteryState,
} from "../../adaptive-learning/mastery/index.ts";
import type {
  MasteryDashboardModel,
  MasterySkillView,
} from "../../app/features/mastery/model.ts";

const STATES: readonly MasteryState[] = [
  "mastered",
  "currently_learning",
  "needs_reinforcement",
  "blocked_by_prerequisite",
  "not_yet_assessed",
  "evidence_uncertain",
];

const TITLES: Readonly<Record<MasteryState, string>> = {
  mastered: "Equivalent fractions",
  currently_learning: "Add unlike fractions",
  needs_reinforcement: "Multiply fractions",
  blocked_by_prerequisite: "Solve ratio problems",
  not_yet_assessed: "Identify a central idea",
  evidence_uncertain: "Support an inference",
};

const STATE_EXPLANATIONS: Readonly<Record<MasteryState, string>> = {
  mastered:
    "Two reliable independent demonstrations met the mastery criterion.",
  currently_learning:
    "Practice evidence is present, but an independent demonstration is still needed.",
  needs_reinforcement:
    "The last independent demonstration is outside the reinforcement window.",
  blocked_by_prerequisite:
    "Multiply fractions must be reinforced before ratio work can continue.",
  not_yet_assessed: "No performance evidence has been recorded for this skill.",
  evidence_uncertain:
    "The available independent results conflict, so more evidence is needed.",
};

function skillForState(
  state: MasteryState,
  index: number,
): MasterySkillView {
  const subject = index < 4 ? "Math" : "English";
  const gradeBand = index < 5 ? "Middle 6-8" : "High 9-12";
  const skillId = asSkillId(`fixture.skill.${index + 1}`);
  const prerequisites =
    state === "blocked_by_prerequisite"
      ? [
          {
            skillId: asSkillId("fixture.skill.3"),
            title: TITLES.needs_reinforcement,
            state: "needs_reinforcement" as const,
            isBlocking: true,
          },
        ]
      : state === "currently_learning"
        ? [
            {
              skillId: asSkillId("fixture.skill.1"),
              title: TITLES.mastered,
              state: "mastered" as const,
              isBlocking: false,
            },
          ]
        : [];

  const evidence =
    state === "not_yet_assessed"
      ? []
      : [
          {
            evidenceId: asEvidenceId(`fixture.evidence.${index + 1}`),
            kind:
              state === "mastered"
                ? ("independent_demonstration" as const)
                : ("assessment_attempt" as const),
            title:
              state === "mastered"
                ? "Independent transfer check"
                : "Recent practice attempt",
            summary:
              state === "mastered"
                ? "Solved novel items independently."
                : "Finished a practice set with support.",
            observedAt: `2026-07-${String(20 + index).padStart(2, "0")}T14:00:00.000Z`,
            sourceLabel: "Validation fixture",
            independent: state === "mastered",
            resultLabel: state === "mastered" ? "Criterion met" : "Completed",
          },
        ];

  return {
    skillId,
    title: TITLES[state],
    description: `The learner is building ${TITLES[state].toLowerCase()} with clear prerequisite evidence.`,
    subject,
    gradeBand,
    state,
    graphLevel: index,
    prerequisites,
    unlocks:
      index < STATES.length - 1
        ? [
            {
              skillId: asSkillId(`fixture.skill.${index + 2}`),
              title: TITLES[STATES[index + 1]],
            },
          ]
        : [],
    evidence,
    confidence: {
      score: state === "not_yet_assessed" ? 0 : 0.82 - index * 0.08,
      level:
        state === "not_yet_assessed"
          ? "insufficient"
          : index < 2
            ? "high"
            : index < 4
              ? "medium"
              : "low",
      explanation:
        state === "not_yet_assessed"
          ? "There is no evidence to assess."
          : "Confidence reflects evidence quality, independence, recency, and consistency.",
    },
    explanation: [STATE_EXPLANATIONS[state]],
    nextStep:
      state === "mastered"
        ? "Maintain with spaced review."
        : "Collect a fresh independent demonstration.",
    lastIndependentDemonstrationAt:
      state === "mastered" ? "2026-07-20T14:00:00.000Z" : undefined,
    overrideAudit:
      state === "blocked_by_prerequisite"
        ? [
            {
              overrideId: asOverrideId("fixture.override.1"),
              changedAt: "2026-07-22T12:00:00.000Z",
              actorLabel: "Parent Example",
              actorRole: "parent",
              previousState: "currently_learning",
              overrideState: "blocked_by_prerequisite",
              reason: "Pause this skill while the prerequisite is reinforced.",
              status: "active",
            },
          ]
        : [],
  };
}

export const allStateDashboardModel: MasteryDashboardModel = {
  learner: {
    studentId: asStudentId("student.validation"),
    displayName: "Validation Learner",
    gradeBand: "Middle 6-8",
    generatedAt: "2026-07-28T12:00:00.000Z",
  },
  skills: STATES.map(skillForState),
};


import type { MasteryState } from "../../../adaptive-learning/mastery/index.js";
import {
  EMPTY_MASTERY_FILTER_VALUE,
  type MasteryDashboardModel,
  type MasteryFiltersValue,
  type MasterySkillView,
} from "./model.js";
import { MASTERY_STATE_ORDER } from "./statusPresentation.js";

const labelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export interface MasteryFilterOptions {
  readonly subjects: readonly string[];
  readonly gradeBands: readonly string[];
  readonly states: readonly MasteryState[];
}

function uniqueSorted(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(labelCollator.compare);
}

export function getMasteryFilterOptions(
  model: MasteryDashboardModel,
): MasteryFilterOptions {
  const presentStates = new Set(model.skills.map((skill) => skill.state));

  return {
    subjects: uniqueSorted(model.skills.map((skill) => skill.subject)),
    gradeBands: uniqueSorted(model.skills.map((skill) => skill.gradeBand)),
    states: MASTERY_STATE_ORDER.filter((state) => presentStates.has(state)),
  };
}

export function filterMasterySkills(
  skills: readonly MasterySkillView[],
  filters: MasteryFiltersValue,
): readonly MasterySkillView[] {
  return skills.filter((skill) => {
    const subjectMatches =
      filters.subject === EMPTY_MASTERY_FILTER_VALUE ||
      skill.subject === filters.subject;
    const stateMatches =
      filters.state === EMPTY_MASTERY_FILTER_VALUE ||
      skill.state === filters.state;
    const gradeMatches =
      filters.gradeBand === EMPTY_MASTERY_FILTER_VALUE ||
      skill.gradeBand === filters.gradeBand;

    return subjectMatches && stateMatches && gradeMatches;
  });
}

export function countActiveMasteryFilters(filters: MasteryFiltersValue): number {
  return Object.values(filters).filter(
    (value) => value !== EMPTY_MASTERY_FILTER_VALUE,
  ).length;
}

export function groupSkillsBySubject(
  skills: readonly MasterySkillView[],
): ReadonlyMap<string, readonly MasterySkillView[]> {
  const grouped = new Map<string, MasterySkillView[]>();

  for (const skill of skills) {
    const subjectSkills = grouped.get(skill.subject) ?? [];
    subjectSkills.push(skill);
    grouped.set(skill.subject, subjectSkills);
  }

  return new Map(
    [...grouped.entries()]
      .sort(([left], [right]) => labelCollator.compare(left, right))
      .map(([subject, subjectSkills]) => [
        subject,
        subjectSkills.sort(
          (left, right) =>
            left.graphLevel - right.graphLevel ||
            labelCollator.compare(left.title, right.title),
        ),
      ] as const),
  );
}
